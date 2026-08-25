/**
 * MVP 6 tetikleyicisi — ÜCRETLİ uç nokta.
 *
 * Kasıtlı olarak otomatik değil: yükleme sırasında koşsaydı toplu yüklemede
 * bütçe farkında olmadan tükenirdi. Hakem veya yönetici bilinçli olarak
 * başlatır. Aynı rapor ikinci kez istenirse disk önbelleğinden gelir, para
 * harcanmaz.
 */

import { kapi } from '@/lib/yetki/koordinasyon';
import { join } from 'node:path';
import { pdfOku } from '@/lib/analiz/pdf';
import { belgeKur } from '@/lib/analiz/yapi';
import { docxOku, bicimTespitEt } from '@/lib/analiz/belge-docx';
import { sekilleriCikar } from '@/lib/analiz/gorsel';
import { sablonUyumu } from '@/lib/analiz/sablon';
import { raporuDegerlendir } from '@/lib/ai/degerlendirme';
import { ClaudeIstemcisi, ButceAsimiHatasi } from '@/lib/ai/istemci';
import { ozetiHazirla } from '@/lib/ai/ozet-hazirla';
import { onbellekDizini } from '@/lib/yol';
import {
  dosyaOku, kategoriGetir, raporGetir, raporGuncelle, yarismaGetir,
} from '@/lib/depo/depo';

export const maxDuration = 300;

export async function POST(request: Request, ctx: RouteContext<'/api/rapor/[id]/degerlendir'>) {
  const yetkisiz = kapi(request);
  if (yetkisiz) return yetkisiz;

  const { id } = await ctx.params;

  const rapor = raporGetir(id);
  if (!rapor) return Response.json({ hata: 'Rapor bulunamadı.' }, { status: 404 });

  const kategori = kategoriGetir(rapor.yarismaId, rapor.kategoriId);
  if (!kategori) return Response.json({ hata: 'Kategori bulunamadı.' }, { status: 404 });

  if (!kategori.rubrik.kriterler.length) {
    return Response.json(
      { hata: 'Bu yarışmanın rubriği boş. Yarışma kurulumundan kriterleri tanımlayın.' },
      { status: 409 },
    );
  }

  const bayt = dosyaOku(id);
  if (!bayt) {
    return Response.json(
      { hata: 'Rapor dosyası bulunamadı; yeniden yüklenmesi gerekiyor.' },
      { status: 409 },
    );
  }

  const veri = new Uint8Array(bayt);
  const bicim = bicimTespitEt(veri);

  // Belge kendi ayrıştırıcımızla okunur; ham PDF modele gönderilmez.
  // Şekiller ayrıca çıkarılıp modele verilir — yarışmacı akış şemasını
  // çizip görsel olarak eklemiş olabiliyor.
  let belge;
  let sekiller: Awaited<ReturnType<typeof sekilleriCikar>> = [];

  if (bicim === 'docx') {
    const okuma = docxOku(veri);
    if (!okuma.tamam) return Response.json({ hata: okuma.hata }, { status: 422 });
    belge = okuma.belge;
  } else {
    const okuma = await pdfOku(veri);
    if (!okuma.tamam) return Response.json({ hata: okuma.hata }, { status: 422 });
    belge = belgeKur(okuma.belge);
    // Yeni kopya: pdf.js önceki tamponu devraldı, aynı diziyi ikinci kez
    // veremeyiz — DataCloneError alınır.
    sekiller = await sekilleriCikar(new Uint8Array(bayt), belge);
  }

  const istemci = new ClaudeIstemcisi({
    toplamTavan: Number(process.env.TOPLAM_TAVAN ?? 8),
    diskOnbellegi: onbellekDizini(),
  });

  /*
   * ŞARTNAME ÖZETİ GEREKİYORSA BURADA ÜRETİLİR.
   *
   * Özet kategoriye bir kez üretilip kalıcı yazılıyor; sonraki raporlar
   * bedava kullanıyor. Peşin üretmek yerine burada üretmenin nedeni bütçe:
   * 37 farklı şartnameyi peşin özetlemek ~$5.55, oysa çoğu kategoride hiç
   * rapor değerlendirilmeyecek.
   *
   * Başarısız olursa değerlendirme özetsiz devam eder — şartname özeti
   * yardımcı bağlam, olmazsa olmaz değil.
   */
  const yarisma = yarismaGetir(rapor.yarismaId);
  let ozetMaliyeti = 0;
  let ozetNotu: string | undefined;
  let ozet = kategori.sartname?.ozet;
  if (yarisma && !ozet) {
    const o = await ozetiHazirla(yarisma, kategori, istemci);
    ozet = o.ozet;
    ozetMaliyeti = o.maliyet;
    ozetNotu = o.atlandi;
  }

  try {
    const degerlendirme = await raporuDegerlendir(belge, kategori.rubrik, {
      istemci,
      efor: 'medium',
      sekiller,
      uyum: sablonUyumu(belge, kategori.sablon),
      sartnameOzeti: ozet,
    });

    /*
     * ── DURUM GERİYE ALINMAZ ────────────────────────────────────────────
     * Bu satır eskiden şuydu:
     *   durum: rapor.durum === 'manuel_inceleme' ? rapor.durum : 'hakem_bekliyor'
     *
     * Yani TAMAMLANMIŞ bir rapora ön değerlendirme çalıştırmak durumu
     * "hakem bekliyor"a geri çeviriyordu ve yarışmacının YAYIMLANMIŞ
     * sonucu kapanıyordu. Ölçerek bulundu: toplu değerlendirme
     * çalıştırıldıktan sonra iki raporun bütün hakemleri bitmiş olmasına
     * rağmen durumu "hakem bekliyor" oldu.
     *
     * Ön değerlendirme bir DESTEK adımı; değerlendirmenin kendisi
     * değil. Hakem işini bitirmişse yapay zekâ çıktısı eklenmesi o kararı
     * geri almaz. Durum yalnızca ileri gidiyor:
     *   yuklendi/analiz_ediliyor → hakem_bekliyor → tamamlandi
     * ve "tamamlandi" ile "manuel_inceleme" olduğu gibi korunuyor.
     */
    const ilerlemez: Array<typeof rapor.durum> = ['tamamlandi', 'manuel_inceleme'];
    const guncel = await raporGuncelle(id, {
      aiDegerlendirme: degerlendirme,
      durum: ilerlemez.includes(rapor.durum) ? rapor.durum : 'hakem_bekliyor',
    });

    return Response.json({
      rapor: guncel,
      // Şartname özeti bu çağrıda üretildiyse maliyeti ayrı bildiriliyor:
      // kullanıcı neden bu raporun daha pahalı olduğunu görebilsin.
      maliyet: degerlendirme.kullanim.maliyet + ozetMaliyeti,
      ozetMaliyeti,
      ozetNotu,
      sekilSayisi: sekiller.length,
    });
  } catch (e) {
    if (e instanceof ButceAsimiHatasi) {
      return Response.json({ hata: e.message }, { status: 402 });
    }
    const mesaj = e instanceof Error ? e.message : String(e);
    return Response.json({ hata: `Değerlendirme başarısız: ${mesaj}` }, { status: 500 });
  }
}
