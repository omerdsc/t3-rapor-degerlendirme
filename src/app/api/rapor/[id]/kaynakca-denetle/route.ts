/**
 * Kaynakça denetim ajanı tetikleyicisi — ÜCRETLİ uç nokta.
 *
 * `degerlendir` gibi kasten otomatik değil. Ajan döngüsü tek çağrı değil,
 * künye sayısına göre 3-8 tur; yüklemede kendiliğinden koşsaydı toplu bir
 * yüklemede bütçe farkında olmadan tükenirdi.
 *
 * ── BELGEDEN KAYNAKÇA ───────────────────────────────────────────────────
 * Künyeler burada ayrıştırılıyor, modele ham belge gönderilmiyor. Sebep
 * hem maliyet hem doğruluk: ajanın işi künyeleri ARAŞTIRMAK, belgeden
 * çıkarmak değil. Çıkarma deterministik bir iş ve `kaynaklariAyristir`
 * bunu zaten yapıyor.
 */

import { kapi } from '@/lib/yetki/koordinasyon';
import { ClaudeIstemcisi, ButceAsimiHatasi } from '@/lib/ai/istemci';
import { kaynakcayiDenetle } from '@/lib/ai/kaynakca-ajani';
import { kaynakcaDenetimiKaydet } from '@/lib/db/kaynakca-denetim-depo';
import { kaynaklariAyristir } from '@/lib/analiz/kaynakca';
import { belgeKur } from '@/lib/analiz/yapi';
import { bicimTespitEt, docxOku } from '@/lib/analiz/belge-docx';
import { pdfOku } from '@/lib/analiz/pdf';
import { onbellekDizini } from '@/lib/yol';
import { dosyaOku, kategoriGetir, raporGetir } from '@/lib/depo/depo';

export const maxDuration = 300;

export async function POST(
  istek: Request,
  ctx: RouteContext<'/api/rapor/[id]/kaynakca-denetle'>,
) {
  const yetkisiz = kapi(istek);
  if (yetkisiz) return yetkisiz;

  const { id } = await ctx.params;

  const rapor = raporGetir(id);
  if (!rapor) return Response.json({ hata: 'Rapor bulunamadı.' }, { status: 404 });

  const bayt = dosyaOku(id);
  if (!bayt) {
    return Response.json(
      { hata: 'Rapor dosyası bulunamadı; kaynakça okunamıyor.' },
      { status: 409 },
    );
  }

  const veri = new Uint8Array(bayt);
  let govde: string;
  if (bicimTespitEt(veri) === 'docx') {
    const okuma = docxOku(veri);
    if (!okuma.tamam) return Response.json({ hata: okuma.hata }, { status: 422 });
    govde = okuma.belge.metin;
  } else {
    const okuma = await pdfOku(veri);
    if (!okuma.tamam) return Response.json({ hata: okuma.hata }, { status: 422 });
    govde = belgeKur(okuma.belge).metin;
  }

  const kaynaklar = kaynaklariAyristir(govde);
  if (!kaynaklar.length) {
    return Response.json(
      { hata: 'Belgede kaynakça bulunamadı; denetlenecek künye yok.' },
      { status: 409 },
    );
  }

  const kategori = kategoriGetir(rapor.yarismaId, rapor.kategoriId);
  const istemci = new ClaudeIstemcisi({ diskOnbellegi: onbellekDizini() });

  try {
    const sonuc = await kaynakcayiDenetle(istemci, kaynaklar, {
      proje: rapor.proje ?? rapor.dosyaAdi,
      kategori: kategori?.ad ?? '—',
    });

    /*
     * YARIM SONUÇ DA KAYDEDİLİYOR.
     * Bütçe ya da tur sınırı yüzünden karar üretilemese bile iz duruyor:
     * hakem ajanın nereye kadar gittiğini görüyor ve koordinasyon
     * denetimi kaldığı yerden değil ama bilinçli olarak yeniden
     * başlatabiliyor. Kaydetmemek, harcanan parayı da çöpe atmak olurdu.
     */
    kaynakcaDenetimiKaydet({
      raporId: id,
      durum: sonuc.durum,
      karar: sonuc.karar,
      adimlar: sonuc.adimlar,
      tur: sonuc.turSayisi,
      maliyet: sonuc.kullanim.maliyet,
      hata: sonuc.hata,
    });

    return Response.json({
      durum: sonuc.durum,
      karar: sonuc.karar,
      adimlar: sonuc.adimlar,
      tur: sonuc.turSayisi,
      maliyet: sonuc.kullanim.maliyet,
      kunyeSayisi: kaynaklar.length,
      hata: sonuc.hata,
    });
  } catch (e) {
    if (e instanceof ButceAsimiHatasi) {
      return Response.json({ hata: e.message }, { status: 402 });
    }
    return Response.json(
      { hata: `Denetim başarısız: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }
}
