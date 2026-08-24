/**
 * Hakem, atama ve değerlendirme tipleri.
 *
 * ── NEDEN DEĞERLENDİRME AYRI BİR VARLIK ─────────────────────────────────
 * Eski modelde puanlar raporun üzerindeydi (`rapor.hakemPuanlari`). Bir
 * rapora ikinci hakem atandığında ikinci puanlama birincinin üstüne
 * yazıyordu — sessiz veri kaybı. TEKNOFEST'te bir rapora birden çok hakem
 * bakmak olağan olduğu için bu bir tasarım hatasıydı.
 *
 * Artık her hakemin değerlendirmesi kendi satırında. Raporun nihai puanı
 * bunlardan TÜRETİLİYOR; türetme kuralı açıkça yazılı ve hakemler arası
 * sapma ölçülebiliyor.
 */

export interface Hakem {
  id: string;
  ad: string;
  eposta?: string;
  kurum?: string;
  /**
   * Hakemin panele erişim kodu.
   *
   * Kimlik doğrulama sistemi yok; hakem `/hakem/<kod>` adresinden giriyor.
   * Bu bir vekil çözüm ve sınırı açık: kodu bilen erişir. Kurum kimlik
   * sistemine bağlanana kadar geçerli, ve kod paylaşılabilir bir bağlantı
   * olduğu için e-postayla iletilmeye uygun.
   */
  kod: string;
  /** Uzmanlık alanları — atama önerisinde kullanılıyor. */
  uzmanlik: string[];
  /**
   * Hakem iş alabilir mi.
   *
   * Pasife alınmış hakem yeni rapor almıyor ama panele GİREBİLİYOR:
   * tamamladığı işi görme hakkı sürüyor.
   */
  aktif: boolean;
  /**
   * Bu kayıt bir insanı temsil ediyor mu.
   *
   * `true` ise etmiyor: veri taşımak için var olan arşiv kaydı gibi.
   * Panele giremez, rapor atanamaz, hakem listelerinde görünmez — ama
   * sahip olduğu eski değerlendirmeler kayıtta kalır, çünkü bir puanın
   * sahibi silinemez.
   *
   * `aktif = false` bunun yerine geçmiyor: ikisi ayrı sorular. Pasif
   * hakem çalışmayan bir insan; sistem kaydı hiç insan değil.
   */
  sistem: boolean;
  olusturuldu: string;
  notlar?: string;
}

export interface Atama {
  id: string;
  raporId: string;
  hakemId: string;
  atandi: string;
  /** Atamayı yapan kişi — denetim izi. */
  atayan?: string;
  sonTarih?: string;
}

export type DegerlendirmeDurumu = 'taslak' | 'tamamlandi';

/**
 * Hakemin onayladığı geri bildirim — YARIŞMACIYA GİDEN METİN.
 *
 * ── NİYE HAKEM ONAYINDAN GEÇİYOR ────────────────────────────────────────
 * Bu üç metni yapay zekâ üretiyor. Eskiden doğrudan model çıktısından
 * yarışmacı ekranına basılıyordu: kimse okumadan, kimse onaylamadan.
 * Puanı hakemden alıp METNİ modelden almak tutarsızdı — yarışmacı için
 * geri bildirim de bir karardır ve sahibi olmalı.
 *
 * PRD'nin madde 06 sırası da bunu istiyor: "hakeme AI 4. göz sunulur;
 * SONUÇLARDAN güçlü/zayıf yönler ve gelişim önerileri üretilir." Hakem
 * arada.
 *
 * Boş bırakılabilir. O zaman yarışmacı geri bildirim görmez — eksik
 * geri bildirim, onaysız geri bildirimden iyidir.
 */
export interface GeriBildirim {
  /** Projenin güçlü yönleri. */
  gucluYonler: string[];
  /** Geliştirilmesi gereken / gelişime açık alanlar. */
  gelisimAlanlari: string[];
  /** Ölçüt bazında somut öneri. */
  oneriler: Array<{ kriterKodu: string; metin: string }>;
}

export interface HakemDegerlendirmesi {
  id: string;
  raporId: string;
  hakemId: string;
  puanlar: Array<{ kriterKodu: string; puan: number; not?: string }>;
  /** Ölçüt puanlarının toplamı; tamamlanmadan önce kısmi olabilir. */
  toplam?: number;
  aciklama?: string;
  /** Hakemin onayladığı, yarışmacıya gidecek geri bildirim. */
  geriBildirim?: GeriBildirim;
  durum: DegerlendirmeDurumu;
  guncellendi: string;
  tamamlandi?: string;
}

/** Bir raporun hakem değerlendirmelerinden türetilen özet. */
export interface NihaiOzet {
  /** Tamamlanmış değerlendirme sayısı. */
  tamamlanan: number;
  /** Atanmış hakem sayısı. */
  atanan: number;
  /**
   * Nihai puan — tamamlanmış değerlendirmelerin ORTALAMASI.
   *
   * Ortalama seçildi çünkü TEKNOFEST uygulamasında yaygın ve açıklanabilir.
   * Ortanca aykırı hakemi bastırırdı ama iki hakemli bir raporda ortanca
   * ortalamaya eşit; üç hakemde ise aykırı değerlendirmeyi GÖRMEK istiyoruz,
   * gizlemek değil. Bu yüzden ortalama alınıp `sapma` ayrıca bildiriliyor.
   */
  puan?: number;
  /** Hakemler arası en büyük fark — yüksekse koordinasyon bakmalı. */
  sapma?: number;
  /** Hakem başına toplamlar; panoda yan yana gösterilir. */
  toplamlar: Array<{ hakemId: string; hakemAdi: string; toplam: number }>;
}

/** Hakemin kendi panelinde gördüğü iş kalemi. */
export interface HakemIsi {
  raporId: string;
  basvuruNo: string;
  /** Maskeli takım rumuzu — hakem gerçek adı görmüyor. */
  takimRumuzu: string;
  proje: string;
  yarismaAdi: string;
  kategoriAdi: string;
  atandi: string;
  sonTarih?: string;
  durum: DegerlendirmeDurumu | 'baslanmadi';
  /** Kaç ölçüt puanlandı / toplam ölçüt. */
  ilerleme: { girilen: number; toplam: number };
  /** Yapay zekâ ön değerlendirmesi hazır mı? */
  aiHazir: boolean;
  /** Otomatik kontrollerde kritik bulgu var mı? */
  kritikBulgu: boolean;
}
