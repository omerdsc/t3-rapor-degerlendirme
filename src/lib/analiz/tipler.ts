/** Analiz motorunun ortak tipleri. */

export type Seviye = 'temiz' | 'bilgi' | 'uyari' | 'hata';

/** Tek bir tespit. Hakeme gösterilen en küçük birim. */
export interface Bulgu {
  /** Makine tarafından okunabilir kod — test ve raporlamada kullanılır. */
  kod: string;
  seviye: Seviye;
  baslik: string;
  aciklama: string;
  /** 1'den başlayan sayfa numarası. */
  sayfa?: number;
  /** Raporun kendisinden alınmış kanıt metni. */
  kanit?: string;
}

/** Bir kontrol adımının sonucu (MVP maddelerinin her biri bir kontrol). */
export interface KontrolSonucu {
  kod: 'dil' | 'sablon' | 'basliklar' | 'kaynakca' | 'kategori' | 'benzerlik';
  ad: string;
  durum: Seviye;
  /** Arayüzde rozet altında görünen tek satır. */
  ozet: string;
  bulgular: Bulgu[];
  /** Kontrole özel yapılandırılmış çıktı. */
  veri?: Record<string, unknown>;
}

// ---------------------------------------------------------------- PDF katmanı

export interface MetinOgesi {
  metin: string;
  x: number;
  /** PDF koordinat sisteminde y; sayfa altından yukarı artar. */
  y: number;
  genislik: number;
  puntoBoyutu: number;
  fontAdi: string;
}

export interface HamSayfa {
  no: number;
  genislik: number;
  yukseklik: number;
  ogeler: MetinOgesi[];
}

/** Rapordan çıkarılmış tek bir görsel ve algısal hash'i. */
export interface GorselIzi {
  sayfa: number;
  /** Sayfa içindeki sıra — "s.7, 2. görsel". */
  sira: number;
  genislik: number;
  yukseklik: number;
  /** 64 bit pHash, 16 haneli onaltılık. Çok küçük görsellerde null. */
  hash: string | null;
}

export interface HamBelge {
  sayfalar: HamSayfa[];
  sayfaSayisi: number;
  /** PDF metin katmanı hiç yok veya sayfa başına anlamsız derecede az. */
  taranmisMi: boolean;
  gorselSayisi: number;
  gorseller: GorselIzi[];
}

// ------------------------------------------------------------ Yapı katmanı

export interface Satir {
  metin: string;
  sayfa: number;
  y: number;
  x: number;
  /** Satırdaki en büyük punto — başlık tespitinde kullanılır. */
  punto: number;
  kalinMi: boolean;
  /** Sayfa başlığı/altlığı olarak elendi mi? */
  yinelenen: boolean;
}

export interface Baslik {
  /** Ham satır metni. */
  metin: string;
  /** "3.2" gibi numaralandırma; yoksa null. */
  numara: string | null;
  /** Numaralandırma ve noktalama temizlenmiş hâli. */
  sade: string;
  sayfa: number;
  satirIndeksi: number;
  seviye: number;
}

export interface Bolum {
  baslik: Baslik;
  /** Bölüm gövdesi — başlık satırı hariç. */
  govde: string;
  kelimeSayisi: number;
}

export interface Belge {
  sayfalar: HamSayfa[];
  satirlar: Satir[];
  /** Sayfa başlığı/altlığı ayıklanmış tam metin. */
  metin: string;
  basliklar: Baslik[];
  bolumler: Bolum[];
  yinelenenSatirlar: string[];
  sayfaSayisi: number;
  taranmisMi: boolean;
  gorselSayisi: number;
  gorseller: GorselIzi[];
  kelimeSayisi: number;
}

// ------------------------------------------------------------ Şablon tanımı

export interface SablonBaslik {
  /** Şablondaki numara, ör. "3.2". */
  numara?: string;
  /** Beklenen başlık metni. */
  ad: string;
  zorunlu: boolean;
  /**
   * Şablon bu başlığın raporda YER ALMAMASINI istiyor
   * (ör. "Bu başlık raporunuzda yer almamalıdır"). Raporda görülürse bulgudur.
   */
  raporda?: false;
  /** Bölümün anlamlı sayılması için gereken en az kelime. */
  asgariKelime?: number;
  /** Şablonun getirdiği üst kelime sınırı, ör. "150-250 kelime". */
  azamiKelime?: number;
  /** Rubrik ağırlığı — şablon başlığında "(N Puan)" olarak yazar. */
  puan?: number;
  /**
   * Üst başlık: puanı alt başlıklarına dağıtılmış. Rubriğe girmez, yoksa
   * aynı puan iki kez sayılır.
   */
  grupMu?: true;
  /** Şablonun bu bölüme koyduğu yönerge metni — raporda kalırsa bölüm boştur. */
  yonergeMetni?: string[];
}

/**
 * Kaynakça beklentisi yarışmadan yarışmaya değişir: bazıları akademik künye
 * ister, bazıları kaynakça bölümü hiç istemez. Bu yüzden kontrol şablona
 * bağlıdır, motora gömülü değildir.
 */
export interface KaynakcaKurali {
  /** Bu yarışmada kaynakça bölümü zorunlu mu? */
  zorunlu: boolean;
  /** Kabul edilen bölüm adları — fuzzy eşleştirilir. */
  adlar: string[];
  asgariKaynak: number;
  /** Metin içi atıf bekleniyor mu? Bazı yarışmalarda beklenmez. */
  atifBekleniyor: boolean;
}

/**
 * Bir yarışmanın rapor şablonu. Motorun tamamı bu nesne üzerinden çalışır;
 * farklı yarışma = farklı Sablon nesnesi, kod değişikliği yok.
 */
export interface Sablon {
  kod: string;
  ad: string;
  /** Şablon sürüm yılı — eski sürüm tespitinde kullanılır. */
  yil: number;
  beklenenDil: 'tr' | 'en';
  /** Şartnamede sayfa sınırı verilmemişse tanımsız bırakılır — uydurma sınır kontrol edilmez. */
  asgariSayfa?: number;
  azamiSayfa?: number;
  basliklar: SablonBaslik[];
  kaynakca?: KaynakcaKurali;
  /** Tüm şablona yayılmış placeholder kalıntıları. */
  placeholderDesenleri?: string[];
}

/** Kaynakça kuralı tanımlanmamış şablonlar için makul varsayılan. */
export const VARSAYILAN_KAYNAKCA: KaynakcaKurali = {
  zorunlu: true,
  adlar: [
    'Kaynakça', 'Kaynaklar', 'Kaynakça ve Referanslar',
    'Referanslar', 'Bibliyografya', 'References', 'Bibliography',
  ],
  asgariKaynak: 5,
  atifBekleniyor: true,
};
