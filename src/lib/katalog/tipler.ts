/**
 * TEKNOFEST yarışma kataloğu.
 *
 * NEDEN AYRI BİR KATALOG
 * Depo (`src/lib/depo`) koordinasyonun ÜZERİNDE ÇALIŞTIĞI veriyi tutar:
 * yüklenmiş şablon, çözümlenmiş rubrik, hakem puanı. Katalog ise
 * teknofest.org'dan çekilmiş HAM LİSTEDİR — 60 yarışma, yüzlerce belge.
 * İkisini karıştırmak iki şeyi bozar:
 *
 *   1. Katalog yeniden çekildiğinde hakem puanları da tazelenirdi.
 *   2. Kullanılmayan 59 yarışmanın şablonu boşuna çözümlenirdi.
 *
 * Bu yüzden akış şu: katalog çekilir (ücretsiz) → yönetici bir yarışmayı
 * SEÇER → yalnızca o yarışmanın belgeleri indirilip depoya aktarılır.
 */

/** Belgenin işimize yarayan türü. */
export type BelgeTuru =
  /** Rapor şablonu — rubrik ve bölüm başlıkları buradan çıkar. */
  | 'sablon'
  /** Genel şartname — yarışma ne istiyor, ne eler. */
  | 'sartname'
  /**
   * Teknik şartname.
   *
   * Genel şartname "puanlandırma sistematiğinin detayları teknik şartnamede
   * açıklanacaktır" diyor. Yani puanlama eşikleri, çıktı biçimi ve teknik
   * kısıtlar bu belgede. Değerlendirme için genel şartnameden daha kritik.
   */
  | 'teknik_sartname'
  /** Yönerge, kılavuz, video talimatı — bilgi amaçlı, çözümlenmiyor. */
  | 'diger';

/**
 * Raporun hangi aşamaya ait olduğu.
 *
 * Bir yarışmada birden fazla rapor aşaması olabiliyor ve her birinin AYRI
 * ŞABLONU var: Robolig'de ÖDR + PDR, Çip Tasarım'da ÖTR + DTR, İnsansız Su
 * Altı'nda KTR. Aşamayı ayırmazsak iki farklı şablonu aynı kategoriye yazıp
 * birbirinin üstüne bindiririz.
 */
export type RaporAsamasi =
  | 'ÖTR'  // Ön Tasarım Raporu
  | 'ÖDR'  // Ön Değerlendirme Raporu
  | 'PDR'  // Proje Detay Raporu
  | 'DTR'  // Detaylı Tasarım Raporu
  | 'KTR'  // Kritik Tasarım Raporu
  | 'ÖNR'  // Öneri / Proje Öneri Raporu
  | 'diger';

export interface KatalogBelgesi {
  url: string;
  /** Sayfadaki bağlantı metni; yoksa dosya adından türetilir. */
  etiket: string;
  /** URL'den çözülmüş dosya adı (yüzde-kodu açılmış). */
  dosyaAdi: string;
  tur: BelgeTuru;
  asama?: RaporAsamasi;
  /**
   * Belge etiketinde geçen kategori adı — "Analog Tasarım Kategorisi" gibi.
   * Yoksa yarışmanın tek kategorisi vardır.
   */
  kategoriAdi?: string;
  /**
   * Belge "Tüm Kategoriler" için yayımlanmış.
   *
   * Biyoteknoloji'nin PDR şablonu böyle: kategoriler ÖDR aşamasında ayrışıyor
   * ama detay raporu hepsinde aynı. Bu belgeyi tek bir kategoriye yazmak,
   * öteki kategorileri şablonsuz bırakır.
   */
  tumKategoriler?: true;
  /**
   * Katılımcı seviyesi: Lise, Üniversite, Ortaokul, İlkokul, Yıldızlar, Mezun.
   *
   * DİKKAT: Seviye iki ayrı yerde belirebilir — yarışma adının kendisinde
   * ("İnsanlık Yararına Teknolojiler Yarışması Lise Seviyesi" ayrı bir
   * yarışmadır) veya belge etiketinde (tek yarışma, iki seviyeli şablon).
   * İkisi de yakalanır; hangisinden geldiği `seviyeKaynagi` ile ayrılır.
   */
  seviye?: string;
  uzanti: string;
  /**
   * Belgenin ait olduğu kategori — üç kaynaktan çözülür.
   *
   * `kategoriAdi` ve `seviye` HAM çıkarımlardır; bu alan karar verilmiş
   * halidir. Ham alanlar da saklanıyor: yönetici bir kategoriyi yanlış
   * bulduğunda hangi sinyalden geldiğini görebilmeli.
   */
  kategori?: string;
  /**
   * `etiket`    — belgede "… Kategorisi" yazıyordu
   * `seviye`    — kategori aslında katılımcı seviyesi (Lise / Üniversite)
   * `turetildi` — işaret yok; kardeş şablonlardan ayırt edici sözcükle bulundu
   */
  kategoriKaynagi?: 'etiket' | 'seviye' | 'turetildi';
  /**
   * Belgeyi kardeşlerinden ayıran sözcükler.
   *
   * Kategori DEĞİL. Elektronik Harp'ta iki şablon var: "KTR Şablonu" ve
   * "TYF Şablonu". Bunlar iki kategori değil, aynı kategorinin iki rapor
   * türüdür — ama yine de ayrı rubrik gerektirir ve ayrı ayrı aktarılmalı.
   * Kategori sanıp arayüzde "2 kategori" yazmak koordinasyonu yanıltır.
   *
   * `kategori` ile ilişkisi: türetim her zaman buraya yazılır; yarışmada
   * açık etiketli en az bir kategori varsa `kategori` olarak da kabul edilir
   * (bkz. cek.ts / kategoriyiCoz).
   */
  ayirtEdici?: string;
}

export interface KatalogYarismasi {
  slug: string;
  ad: string;
  url: string;
  /** Yarışma adından çıkan seviye — ayrı yarışma olarak yayımlananlar. */
  adSeviyesi?: string;
  belgeler: KatalogBelgesi[];
  /**
   * Belgelerden türetilmiş kategori adları.
   * Boşsa yarışmanın tek, adsız kategorisi var demektir.
   */
  kategoriler: string[];
  asamalar: RaporAsamasi[];
  /** Şablonu hiç bulunamayan yarışma değerlendirmeye hazır değildir. */
  sablonVar: boolean;
  sartnameVar: boolean;
  teknikSartnameVar: boolean;
}

export interface Katalog {
  /** ISO tarih — kataloğun ne zaman çekildiği. */
  cekildi: string;
  kaynak: string;
  yarismalar: KatalogYarismasi[];
  /** Çekim sırasında atlanan veya eksik kalan yarışmalar. */
  uyarilar: string[];
}
