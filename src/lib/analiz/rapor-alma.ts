/**
 * Rapor alma boru hattı — YÜKLEYEN KİM OLURSA OLSUN AYNI.
 *
 * ── NİYE ORTAK MODÜL ────────────────────────────────────────────────────
 * Rapor artık iki kapıdan giriyor: koordinasyon (`/api/rapor`) ve
 * yarışmacının kendisi (`/api/basvuru/rapor`). Bu iki uçta boru hattını
 * ayrı ayrı yazmak, kontrollerin zamanla ayrışması demekti — bir tarafa
 * eklenen kontrol ötekinde eksik kalır ve raporun hangi kapıdan girdiği
 * NASIL DEĞERLENDİRİLDİĞİNİ etkilerdi. Değerlendirmenin eşitliği, boru
 * hattının tek olmasına bağlı.
 *
 * Uçlar yalnızca iki şeyde ayrışıyor ve ikisi de bu modülün DIŞINDA:
 * kimin yükleyebileceği (yetki) ve kimliğin nereden geldiği (form mu,
 * başvuru kaydı mı).
 */

import { raporuAnalizEt } from '@/lib/analiz';
import { bicimTespitEt } from '@/lib/analiz/belge-docx';
import { parmakiziCikar } from '@/lib/analiz/benzerlik';
import { benzerlikTazele } from '@/lib/analiz/benzerlik-tazele';
import { kimlikCikar, kimlikKarsilastir } from '@/lib/analiz/kimlik';
import { parmakiziSakla } from '@/lib/analiz/parmakizi-depo';
import { kategoriKumesi } from '@/lib/analiz/terim-depo';
import { dosyaKaydet, kimlik, raporGetir, raporKaydet } from '@/lib/depo/depo';
import type { Rapor, Yarisma, YarismaKategorisi } from '@/lib/depo/tipler';

/** Yükleme sınırı — vekil katmanı 30 MB'da kesiyor, uygulama 25'te. */
export const AZAMI_BOYUT = 25 * 1024 * 1024;

/**
 * Form alanındaki dosyayı okur; kabul edilemezse hazır `Response` döner.
 *
 * İki uç da aynı sınırı ve aynı mesajı vermeli: yarışmacı 26 MB'lık
 * raporunu yükleyemediğinde gördüğü metinle koordinasyonun gördüğü metin
 * farklı olursa, destek konuşması iki ayrı hatayı kovalar.
 */
export async function dosyayiOku(
  dosya: unknown,
): Promise<{ veri: Uint8Array; ad: string } | Response> {
  if (!(dosya instanceof File) || dosya.size === 0) {
    return Response.json({ hata: 'Dosya bulunamadı.' }, { status: 400 });
  }
  if (dosya.size > AZAMI_BOYUT) {
    return Response.json({ hata: 'Dosya 25 MB sınırını aşıyor.' }, { status: 413 });
  }
  return { veri: new Uint8Array(await dosya.arrayBuffer()), ad: dosya.name };
}

export interface BeyanEdilenKimlik {
  basvuruNo?: string;
  takim?: string;
  takimId?: string;
  proje?: string;
}

export interface AlmaGirdisi {
  veri: Uint8Array;
  dosyaAdi: string;
  yarisma: Yarisma;
  kategori: YarismaKategorisi;
  /**
   * Raporun kime ait olduğuna dair BEYAN.
   *
   * Koordinasyon yüklemesinde form alanları (çoğu zaman boş), yarışmacı
   * yüklemesinde başvuru kaydı (her zaman dolu). İkinci durumda beyan
   * doğrulanmış bir kimlik: kapaktan okunanla arasındaki fark, yanlış
   * dosya yüklendiğinin işareti oluyor.
   */
  beyan: BeyanEdilenKimlik;
  /** Başvuru kaydından geldiyse kimliği. Koordinasyon yüklemesinde yok. */
  basvuruId?: string;
  /** Yarışmacının beyan ettiği içerik alanı (MVP 4). */
  icerikKategori?: string;
}

export interface AlmaSonucu {
  rapor: Rapor;
  benzerlik: Awaited<ReturnType<typeof benzerlikTazele>> | null;
}

/**
 * Biçim tanınmadıysa hata döner; tanındıysa devam edilir.
 * Ayrı fonksiyon çünkü iki uç da aynı mesajı vermeli.
 */
export function bicimiDenetle(veri: Uint8Array): 'pdf' | 'docx' | Response {
  const bicim = bicimTespitEt(veri);
  if (bicim === 'bilinmiyor') {
    return Response.json(
      { hata: 'Dosya biçimi tanınmadı. Rapor PDF veya Word (.docx) olmalıdır.' },
      { status: 415 },
    );
  }
  return bicim;
}

/**
 * Raporu çözümler, kontrolleri koşturur, kaydeder ve benzerliği tazeler.
 *
 * ── KONTROLLER YÜKLEMEDE KOŞUYOR ────────────────────────────────────────
 * Maliyeti sıfır (hepsi yerel ve deterministik) ve gecikmesi bir kez.
 * Yapay zekâ değerlendirmesi burada YOK: o ücretli ve ayrı uçta, hakem
 * ya da koordinasyon tetikliyor.
 *
 * ── KAYNAK DOĞRULAMA AÇIK ───────────────────────────────────────────────
 * Sistemin varlık nedeninin merkezinde: raporlar yapay zekâ ile
 * yazıldığında kaynakça uydurulabiliyor — künye düzgün görünür ama o
 * yayın hiç yoktur. Dışarıya yalnızca kaynak BAŞLIKLARI gidiyor, raporun
 * içeriği hiçbir yere gönderilmiyor.
 */
export async function raporuAl(g: AlmaGirdisi): Promise<AlmaSonucu> {
  const id = kimlik();
  const bicim = bicimTespitEt(g.veri);

  /*
   * İÇERİK UYGUNLUĞU: KARŞILAŞTIRMA KÜMESİ GERÇEK ŞARTNAMELERDEN.
   * Profil dosyası yoksa yarışmanın kendi listesine düşülüyor — kontrol
   * tamamen kaybolmasın; ama profiller varsa gerçek veri kazanır.
   */
  const profiller = kategoriKumesi();
  const sonuc = await raporuAnalizEt(g.veri, {
    sablon: g.kategori.sablon,
    kategoriler: profiller.length >= 3 ? profiller : g.yarisma.icerikKategorileri,
    // Beyan, raporun yüklendiği KATEGORİDİR: yarışmacının ayrıca alan
    // seçmesine gerek yok, zaten bir kategoriye başvurdu.
    beyanEdilenKategori: profiller.length >= 3 ? g.kategori.id : g.icerikKategori,
    kaynakDogrula: process.env.KAYNAK_DOGRULA !== 'kapali',
    dogrulamaIletisim: process.env.DOGRULAMA_ILETISIM,
  });

  /*
   * Kapaktan kimlik okuma — ücretsiz, yerel. Her raporda sonuç vermiyor
   * (kapağı görsele gömülü raporlarda metin katmanında alan yok).
   * Bulunmaması bir kusur olarak işlenmiyor.
   */
  const kapakKimligi = sonuc.belge ? kimlikCikar(sonuc.belge) : undefined;

  /*
   * KİMLİK SIRASI: beyan → rapor kapağı → yer tutucu.
   *
   * BEYAN KAPAĞI EZER. Yarışmacı yüklemesinde beyan, doğrulanmış başvuru
   * kaydından geliyor: kapaktaki yazım hatası ya da eski künye onu
   * geçersiz kılmamalı. Koordinasyon yüklemesinde beyan çoğu zaman boş
   * ve kapak devreye giriyor — toplu yüklemede elle veri girişi
   * gerekmemesinin sebebi bu.
   */
  const basvuruNo =
    g.beyan.basvuruNo || kapakKimligi?.basvuruId || `TF-${id.slice(0, 8).toUpperCase()}`;
  const takim = g.beyan.takim || kapakKimligi?.takimAdi || 'Belirtilmemiş';
  const takimId = g.beyan.takimId || kapakKimligi?.takimId || id.slice(0, 8);
  const proje =
    g.beyan.proje || kapakKimligi?.projeAdi || g.dosyaAdi.replace(/\.(pdf|docx)$/i, '');

  const rapor: Rapor = {
    id,
    yarismaId: g.yarisma.id,
    kategoriId: g.kategori.id,
    basvuruId: g.basvuruId,
    basvuruNo,
    dosyaAdi: g.dosyaAdi,
    takim,
    takimId,
    proje,
    raporKimligi: kapakKimligi,
    /*
     * Uyuşmazlık YALNIZCA beyan edilen değerlere karşı ölçülüyor. Değer
     * zaten kapaktan alındıysa karşılaştırma kendi kendisiyle olur ve her
     * zaman "uyumlu" çıkar — anlamsız bir onay üretirdi.
     *
     * Yarışmacı yüklemesinde bu ölçüm asıl değerini kazanıyor: beyan
     * başvuru kaydından geldiği için, kapakla tutmaması "yanlış dosya
     * yüklendi" demek.
     */
    kimlikUyusmazligi: kapakKimligi
      ? kimlikKarsilastir(kapakKimligi, {
          takim: g.beyan.takim,
          takimId: g.beyan.takimId,
          basvuruNo: g.beyan.basvuruNo,
          proje: g.beyan.proje,
        })
      : undefined,
    icerikKategoriKodu: g.icerikKategori,
    yuklendi: new Date().toISOString(),
    // Okunamayan veya taranmış rapor doğrudan manuel incelemeye düşer.
    durum: !sonuc.basarili || sonuc.istatistik.taranmisMi ? 'manuel_inceleme' : 'hakem_bekliyor',
    kontroller: sonuc.kontroller,
    genelDurum: sonuc.genelDurum,
    kaynakDogrulamasi: sonuc.kaynakDogrulamasi,
    istatistik: {
      sayfaSayisi: sonuc.istatistik.sayfaSayisi,
      kelimeSayisi: sonuc.istatistik.kelimeSayisi,
      gorselSayisi: sonuc.istatistik.gorselSayisi,
      baslikSayisi: sonuc.istatistik.baslikSayisi,
      taranmisMi: sonuc.istatistik.taranmisMi,
      sureMs: sonuc.istatistik.sureMs,
    },
    dosyaYolu: bicim === 'pdf' ? dosyaKaydet(id, g.veri) : undefined,
    /*
     * Parmakizi yükleme anında çıkarılıyor: belge zaten ayrıştırılmış
     * durumda elimizde, ikinci bir maliyeti yok. Kategori kodu olarak
     * YARIŞMA KATEGORİSİ kullanılıyor, beyan edilen içerik alanı değil.
     */
    parmakizi: sonuc.belge
      ? parmakiziSakla(
          parmakiziCikar(
            sonuc.belge,
            { raporId: id, takimId, kategoriKodu: g.kategori.id, yil: g.yarisma.yil },
            g.kategori.sablon,
          ),
        )
      : undefined,
  };

  await raporKaydet(rapor);

  /*
   * BENZERLİK KORPUSA BAĞLI — KATEGORİNİN TAMAMI TAZELENİYOR.
   *
   * Yeni rapor yalnızca kendi bulgusunu doğurmuyor; ÖNCEDEN yüklenmiş
   * raporların benzerlik durumunu da değiştiriyor. Tazelemezsek ilk rapor
   * "temiz" olarak kalır ve kopya sessizce kaçar.
   *
   * Hata verse bile yükleme başarılı sayılır: raporu kaybetmek, bir
   * kontrolü geciktirmekten kötüdür.
   */
  let benzerlik: AlmaSonucu['benzerlik'] = null;
  try {
    benzerlik = await benzerlikTazele(g.yarisma.id, g.kategori.id);
  } catch {
    benzerlik = null;
  }

  // Tazeleme raporun kaydını değiştirmiş olabilir; güncel hali okunuyor.
  return { rapor: raporGetir(rapor.id) ?? rapor, benzerlik };
}
