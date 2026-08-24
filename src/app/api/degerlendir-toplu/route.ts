/**
 * Kategorinin raporlarını toplu ön değerlendirmeye alır.
 *
 * GET · kaç rapor, ne kadar tutar, hangileri — HİÇBİR ŞEY HARCAMAZ
 *
 * Değerlendirmenin KENDİSİ burada değil: istemci hedef listesini alıp
 * sırayla mevcut `/api/rapor/<id>/degerlendir` ucunu çağırıyor. O uç PDF
 * ayrıştırma, şekil çıkarma, şablon uyumu ve şartname özeti hattının
 * tamamını yürütüyor; aynı hattı burada kopyalamak iki ayrı
 * değerlendirme yolu yaratırdı — bu projede aynı hesabın iki kopyasının
 * sessizce ayrışması zaten yaşandı (nihai puan). Bu uç yalnızca
 * SÜRÜCÜ: neyin yapılacağını ve ne tutacağını söylüyor.
 *
 * ── NİYE VAR ────────────────────────────────────────────────────────────
 * PRD AKIŞ 01 şunu yazıyor: "Yarışma Yöneticisi ... raporları sisteme
 * aktarır → AI analiz SÜRECİNİ başlatır." Bizde ön değerlendirmeyi
 * başlatan tek yer rapor detay sayfasıydı, rapor rapor. 500 raporluk bir
 * kategoride bu 500 tıklama demek — özelliğin hiç kullanılmaması demek.
 *
 * ── NİYE TEK İSTEKTE HEPSİ DEĞİL ────────────────────────────────────────
 * Rapor başına ~90 saniye. 40 rapor tek istekte bir saat sürer, rota zaman
 * aşımına düşer ve kullanıcı ne kadar harcandığını göremez. Sırayla
 * gidince her adımdan sonra harcanan tutar görünüyor ve kullanıcı ORTADA
 * DURDURABİLİYOR. Bütçesi sert sınırlı bir sistemde bu bir gereklilik,
 * kolaylık değil.
 *
 * ── ÜCRETLİ ADIM OLDUĞU İÇİN ÖNCE MALİYET SÖYLENİYOR ────────────────────
 * GET hiçbir çağrı yapmadan hedef sayısını ve tahmini tutarı döndürüyor.
 * Kullanıcı "42 rapor × $0,167 = $7,01" görüp karar veriyor. Tavan da
 * ayrıca koruyor: aşılırsa istemci değil SUNUCU reddediyor.
 */

import { kapi } from '@/lib/yetki/koordinasyon';
import { kategoriGetir, raporlariListele } from '@/lib/depo/depo';

/** Rapor başına ölçülen maliyet — arayüzde tahmin göstermek için. */
const BIRIM_MALIYET = 0.167;

export async function GET(istek: Request) {
  const yetkisiz = kapi(istek);
  if (yetkisiz) return yetkisiz;

  const q = new URL(istek.url).searchParams;
  const yarismaId = q.get('yarisma');
  const kategoriId = q.get('kategori') ?? undefined;

  if (!yarismaId) {
    return Response.json({ hata: 'Yarışma gerekli.' }, { status: 400 });
  }

  const raporlar = raporlariListele(yarismaId, kategoriId);

  /*
   * Zaten değerlendirilmiş rapor hedef DEĞİL. Önbellek ikinci çağrıyı
   * ücretsiz yapıyor ama listeyi şişirmek kullanıcıya yanlış maliyet
   * gösterir — "42 rapor" deyip 3'ünü yeniden hesaplamak gibi.
   */
  const hedefler = raporlar
    .filter((r) => !r.aiDegerlendirme)
    .map((r) => ({
      raporId: r.id,
      basvuruNo: r.basvuruNo,
      proje: r.proje,
      /*
       * Ölçütleri onaylanmamış kategoride ön değerlendirme yapmak, yanlış
       * ölçütlerle puan önermek olur. Engellemiyoruz — koordinasyon
       * bilerek başlatabilir — ama sayısını söylüyoruz.
       */
      olcutOnayli: kategoriGetir(r.yarismaId, r.kategoriId)?.duzenlendi ?? false,
    }));

  const tavan = Number(process.env.TOPLAM_TAVAN ?? 8);

  return Response.json({
    hedefler,
    zatenVar: raporlar.length - hedefler.length,
    birimMaliyet: BIRIM_MALIYET,
    tahminiTutar: Number((hedefler.length * BIRIM_MALIYET).toFixed(2)),
    tavan,
    onaysizOlcut: hedefler.filter((h) => !h.olcutOnayli).length,
  });
}
