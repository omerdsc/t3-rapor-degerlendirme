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
  aktif: boolean;
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

export interface HakemDegerlendirmesi {
  id: string;
  raporId: string;
  hakemId: string;
  puanlar: Array<{ kriterKodu: string; puan: number; not?: string }>;
  /** Ölçüt puanlarının toplamı; tamamlanmadan önce kısmi olabilir. */
  toplam?: number;
  aciklama?: string;
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
