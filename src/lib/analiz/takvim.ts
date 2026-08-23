/**
 * Şartname takviminden aşama tarihini çözer.
 *
 * NEDEN GEREKLİ
 * Bir yarışmada birden çok rapor aşaması olabiliyor ve her birinin ayrı
 * şablonu var: Çip Tasarım'da ÖTR ve DTR, Robolig'de ÖDR ve PDR. Koordinasyon
 * "şu an hangi aşamayı değerlendiriyoruz" sorusunu her seferinde elle
 * yanıtlamak zorunda kalmasın — cevap zaten şartname takviminde yazıyor:
 *
 *     22.04.2026- 17:00   Ön Tasarım Raporu Son Teslim Tarihi
 *     15.05.2026          Ön Tasarım Raporu Sonuçlarının İlanı
 *
 * Tarihler `sartnameCozumle` tarafından ücretsiz çıkarılıyor; burada yalnızca
 * doğru satırla eşleştirilip bugüne göre yorumlanıyor. Yapay zekâ çağrısı yok.
 */

import { anahtar } from './normalize';

/** Aşama kısaltmasının takvimde nasıl yazıldığı. */
const ASAMA_ADLARI: Record<string, string[]> = {
  'ÖTR': ['on tasarim raporu', 'otr'],
  'ÖDR': ['on degerlendirme raporu', 'odr'],
  'PDR': ['proje detay raporu', 'pdr'],
  'DTR': ['detayli tasarim raporu', 'detay tasarim raporu', 'dtr'],
  'KTR': ['kritik tasarim raporu', 'ktr'],
  'ÖNR': ['proje oneri raporu', 'oneri raporu', 'onr'],
};

/**
 * Teslim satırını sonuç ilanı satırından ayırmak için.
 *
 * Aynı aşamanın takvimde iki satırı var: teslim ve sonuç ilanı. Hakemin
 * değerlendirme penceresi ikisinin ARASI; teslimi kaçırıp sonuç tarihini
 * "son teslim" sanmak aşamayı bir ay yanlış gösterir.
 */
const TESLIM_ISARETI = /son teslim|teslim tarihi|yukleme|gonderim/;
const SONUC_ISARETI = /sonuc|ilani|aciklan|degerlendirme sonuc/;

export type AsamaDurumu = 'gelecek' | 'degerlendirmede' | 'tamamlandi' | 'bilinmiyor';

export interface AsamaTakvimi {
  asama: string;
  /** ISO tarih — raporun son teslim günü. */
  teslim?: string;
  /** ISO tarih — sonuçların ilan günü. */
  sonucIlani?: string;
  durum: AsamaDurumu;
  /** Kalan/geçen gün. Negatifse tarih geçmiş. */
  kalanGun?: number;
}

/** "2026-05-15 → 2026-05-20" biçimindeki aralıklarda bitiş tarihi esastır. */
function tarihiNormalize(t: string): string {
  const parcalar = t.split('→').map((x) => x.trim());
  return parcalar[parcalar.length - 1];
}

function gunFarki(isoTarih: string, bugun: Date): number {
  const t = new Date(`${isoTarih}T00:00:00Z`);
  if (Number.isNaN(t.getTime())) return Number.NaN;
  const b = Date.UTC(bugun.getUTCFullYear(), bugun.getUTCMonth(), bugun.getUTCDate());
  return Math.round((t.getTime() - b) / 86_400_000);
}

/**
 * Bir aşamanın takvim durumunu çıkarır.
 *
 * `bugun` parametre olarak alınıyor: sunucu ve tarayıcı aynı sonucu vermeli,
 * yoksa Next'in yeniden çizimi tarih uyuşmazlığı üretir.
 */
export function asamaTakvimi(
  tarihler: Array<{ etiket: string; tarih: string }>,
  asama: string | undefined,
  bugun: Date,
): AsamaTakvimi | null {
  if (!asama) return null;
  const adlar = ASAMA_ADLARI[asama];
  if (!adlar) return null;

  let teslim: string | undefined;
  let sonucIlani: string | undefined;

  for (const t of tarihler) {
    const e = anahtar(t.etiket);
    if (!adlar.some((ad) => e.includes(ad))) continue;

    const tarih = tarihiNormalize(t.tarih);
    if (SONUC_ISARETI.test(e)) {
      sonucIlani ??= tarih;
    } else if (TESLIM_ISARETI.test(e)) {
      teslim ??= tarih;
    } else {
      // İşaretsiz satır: teslim olarak varsayılır ama sonuç zaten
      // bulunmuşsa ezmez.
      teslim ??= tarih;
    }
  }

  if (!teslim && !sonucIlani) return null;

  let durum: AsamaDurumu = 'bilinmiyor';
  let kalanGun: number | undefined;

  if (teslim) {
    kalanGun = gunFarki(teslim, bugun);
    if (!Number.isNaN(kalanGun)) {
      if (kalanGun > 0) {
        // Teslim günü gelmedi: raporlar hâlâ toplanıyor.
        durum = 'gelecek';
      } else {
        const sonuc = sonucIlani ? gunFarki(sonucIlani, bugun) : undefined;
        // Teslim geçti, sonuç ilan edilmedi → hakemler bu aşamada çalışıyor.
        durum = sonuc === undefined || sonuc >= 0 ? 'degerlendirmede' : 'tamamlandi';
      }
    }
  } else if (sonucIlani) {
    const sonuc = gunFarki(sonucIlani, bugun);
    durum = sonuc >= 0 ? 'degerlendirmede' : 'tamamlandi';
  }

  return { asama, teslim, sonucIlani, durum, kalanGun };
}

export const DURUM_ETIKETI: Record<AsamaDurumu, string> = {
  gelecek: 'Teslim sürüyor',
  degerlendirmede: 'Değerlendirme aşamasında',
  tamamlandi: 'Tamamlandı',
  bilinmiyor: 'Tarih belirsiz',
};

/** Takvimdeki tarihi okunur biçime çevirir. */
export function tarihYaz(iso: string | undefined): string {
  if (!iso) return '—';
  const [y, a, g] = iso.split('-');
  return g && a && y ? `${g}.${a}.${y}` : iso;
}
