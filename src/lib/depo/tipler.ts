/**
 * Kalıcı veri modeli.
 *
 * Hiyerarşi: YARIŞMA → KATEGORİ → RAPOR
 *
 * Kategori seviyesi zorunlu, çünkü TEKNOFEST her yarışma için ayrı şablon
 * yayımlıyor ve aynı yarışmanın kategorileri de farklı şablon kullanabiliyor
 * (Havacılıkta YZ "Ön Tasarım Raporu", Maden "Ön Değerlendirme Raporu";
 * biri 6-15 sayfa, öteki ≤10; birinde "Kaynakça", ötekinde "Kaynaklar").
 * Şablon, rubrik ve kurallar bu yüzden KATEGORİYE bağlıdır, yarışmaya değil.
 *
 * Durum makinesi bilinçli olarak katı: yarışmacı, hakem nihai kararı vermeden
 * hiçbir şey göremez (AKIŞ 03).
 */

import type { KontrolSonucu, Sablon, Seviye } from '../analiz/tipler';
import type { Rubrik, SablonKurallari } from '../analiz/sablon-cikar';
import type { SartnameKurallari } from '../analiz/sartname';
import type { SartnameOzeti } from '../ai/sartname-ozeti';
import type { Kategori as KategoriTanimi } from '../analiz/kategori';
import type { Degerlendirme } from '../ai/degerlendirme';
import type { SakliParmakizi } from '../analiz/parmakizi-depo';
import type { KimlikUyusmazligi, RaporKimligi } from '../analiz/kimlik';
import type { DogrulamaOzeti } from '../analiz/kaynak-dogrula';

export type RaporDurumu =
  | 'yuklendi'
  | 'analiz_ediliyor'
  | 'hakem_bekliyor'
  | 'tamamlandi'
  | 'manuel_inceleme';

export const DURUM_ETIKET: Record<RaporDurumu, string> = {
  yuklendi: 'Yüklendi',
  analiz_ediliyor: 'Analiz ediliyor',
  hakem_bekliyor: 'Değerlendirme bekliyor',
  tamamlandi: 'Tamamlandı',
  manuel_inceleme: 'Manuel inceleme',
};

/**
 * Yarışma kategorisi — şablonun, rubriğin ve kuralların sahibi.
 *
 * Her kategori kendi şablonundan çıkarılır. Aynı yarışmada iki kategori
 * tamamen farklı yapıda olabilir.
 */
export interface YarismaKategorisi {
  id: string;
  ad: string;
  /** Şablon dosyasının adı — hangi dosyadan çıkarıldığı izlenebilsin. */
  sablonDosyasi: string;
  /**
   * Bu kategorinin rapor aşaması: ÖTR, ÖDR, PDR, DTR, KTR.
   *
   * Bir yarışmada birden çok aşama olabiliyor ve her aşamanın kendi şablonu,
   * kendi rubriği, kendi teslim tarihi var. Aşama biliniyorsa şartname
   * takviminden o aşamanın teslim ve sonuç tarihi çözülebilir — koordinasyon
   * "şu an hangi aşamadayız" sorusunu elle yanıtlamak zorunda kalmaz.
   * Katalogdan aktarımda doldurulur; elle yüklemede boş kalabilir.
   */
  asama?: string;
  olusturuldu: string;
  /** Çıkarım taslaktı; yönetici gözden geçirdi mi? */
  duzenlendi: boolean;
  sablon: Sablon;
  kurallar: SablonKurallari;
  rubrik: Rubrik;
  /** Şablonun kendi örnek künyeleri — raporda kalırsa bulgudur. */
  ornekKaynaklar: string[];
  /** Çıkarım sırasında yöneticiye sorulacak noktalar. */
  uyarilar: string[];

  /**
   * Şartname. Şablondan AYRI bir belge: şablon "raporu nasıl yaz" der,
   * şartname "yarışma nedir, ne değerlendirilir, ne eler" der.
   */
  sartname?: {
    dosyaAdi: string;
    yuklendi: string;
    sayfaSayisi: number;
    kelimeSayisi: number;
    /** Deterministik çıkarılan kurallar — modelsiz, $0. */
    kurallar: SartnameKurallari;
    /**
     * Kurulumda BİR KEZ üretilen AI özeti; her değerlendirmede bedava
     * kullanılır. Şartnamenin tamamını her rapora göndermek yerine.
     */
    ozet?: SartnameOzeti;
    /** Şablonla şartname arasındaki kural çakışmaları. */
    catismalar: string[];
    uyarilar: string[];
    /**
     * Belgenin katalogdaki kaynağı (teknofest.org CDN).
     *
     * AI özeti şartnamenin TAM METNİNİ gerektiriyor ama metin depoda
     * saklanmıyor — 30 sayfalık şartnameyi her kategori kaydına gömmek
     * dosyayı şişirir ve yalnızca tek bir adımda gerekiyor. Kaynak URL
     * saklanınca özet sonradan üretilebilir; yoksa yönetici katalogdan
     * gelen bir kategoride dosyayı ELLE yeniden yüklemek zorunda kalır.
     */
    kaynakUrl?: string;
    /** Bu bir teknik şartname mi? Puanlama detayı buradadır. */
    teknikMi?: true;
  };
}

export interface Yarisma {
  id: string;
  ad: string;
  /**
   * Katalogdaki kaynak slug'ı — "havacilikta-yapay-zeka-yarismasi".
   *
   * TEKNOFEST şablonları her yıl değişiyor; yönetici "güncelle" dediğinde
   * sistemin hangi katalog kaydından tazeleyeceğini bilmesi gerekiyor.
   * Slug olmadan güncelleme, yarışmayı silip yeniden kurmak demek olur ve
   * hakem puanları gider.
   */
  katalogSlug?: string;
  yil: number;
  olusturuldu: string;
  kategoriler: YarismaKategorisi[];
  /** İçerik sınıflandırması için terim tanımları (MVP 4). */
  icerikKategorileri: KategoriTanimi[];
}

/** Hakemin bir kritere verdiği nihai puan. */
export interface HakemPuani {
  kriterKodu: string;
  puan: number;
  not?: string;
}

/**
 * Rapor üzerindeki yazışma.
 *
 * Hakem ve koordinasyon arasındaki her not raporun içine yazılamaz; kimi şey
 * değerlendirme metnine girmemesi gereken bir soru, hatırlatma veya karardır.
 * Bu iz kaydı yarışmacıya GÖSTERİLMEZ.
 */
export interface Mesaj {
  id: string;
  yazar: string;
  rol: 'hakem' | 'koordinasyon' | 'yarisma_yoneticisi' | 'sistem';
  metin: string;
  tarih: string;
  /** Sistem tarafından üretilmiş olay kaydı mı (puan değişti, durum değişti). */
  otomatikMi?: boolean;
}

export interface Rapor {
  id: string;
  yarismaId: string;
  /** Hangi kategoriye ait — şablon ve rubrik buradan gelir. */
  kategoriId: string;
  basvuruNo: string;
  dosyaAdi: string;
  takim: string;
  takimId: string;
  proje: string;
  /** İçerik sınıflandırmasında beyan edilen alan (MVP 4). */
  icerikKategoriKodu?: string;
  yuklendi: string;
  durum: RaporDurumu;

  kontroller: KontrolSonucu[];
  genelDurum: Seviye;
  istatistik: {
    sayfaSayisi: number;
    kelimeSayisi: number;
    gorselSayisi: number;
    baslikSayisi: number;
    taranmisMi: boolean;
    sureMs: number;
  };

  kaynakDogrulamasi?: DogrulamaOzeti;

  /**
   * Rapor KAPAĞINDAN okunan kimlik alanları.
   *
   * Yükleme formundaki `takim`/`takimId`/`basvuruNo` alanlarından AYRI
   * tutuluyor: biri başvuru kaydından, öteki belgenin kendisinden geliyor.
   * İkisini aynı alana yazmak, çelişkiyi görünmez kılardı — oysa çelişki
   * (yanlış dosya yüklenmiş olması) tam olarak görmek istediğimiz şey.
   */
  raporKimligi?: RaporKimligi;
  /** Kapaktan okunan ile başvuruda girilen arasındaki farklar. */
  kimlikUyusmazligi?: KimlikUyusmazligi[];

  /**
   * MVP 5 parmakizi — yükleme anında BİR KEZ hesaplanır.
   *
   * Burada saklanmasa benzerlik ekranı her açılışta kategorideki bütün
   * raporları yeniden ayrıştırmak zorunda kalırdı; 100 raporlu bir
   * kategoride bu dakikalar sürer ve her açılışta yeniden sürer.
   * Taranmış/okunamayan raporda boş kalır.
   */
  parmakizi?: SakliParmakizi;

  /** MVP 6: AI ön değerlendirmesi. Hakem puanı DEĞİLDİR. */
  aiDegerlendirme?: Degerlendirme;

  hakemPuanlari?: HakemPuani[];
  hakemToplam?: number;
  hakemNotu?: string;
  tamamlandi?: string;

  /** Hakem–koordinasyon yazışması. Yarışmacıya gösterilmez. */
  mesajlar?: Mesaj[];

  dosyaYolu?: string;
}
