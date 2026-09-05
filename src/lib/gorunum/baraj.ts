/**
 * Baraj puanı — geçti / geçemedi kararı.
 *
 * ── NİYE SAF FONKSİYON ──────────────────────────────────────────────────
 * Bu karar yarışmacıya "elendin" demeye kadar gidiyor. Yanlış bir eşik
 * karşılaştırması ya da erken verilmiş bir hüküm gerçek bir itiraz
 * doğurur. Kural üç ekrana (yarışmacı, koordinasyon, sonuç) dağılmış
 * `puan >= baraj` karşılaştırmaları olarak yazılsaydı, biri düzeltilip
 * ötekiler unutulduğunda sistem aynı rapor için iki farklı şey söylerdi.
 *
 * ── EN KRİTİK KURAL: DEĞERLENDİRME BİTMEDEN HÜKÜM YOK ───────────────────
 * Çok hakemli değerlendirmede nihai puan ORTALAMADIR. İki hakemden biri
 * bitirmişken ortalama tek kişinin puanıdır ve ikinci hakem geldiğinde
 * değişir. O ara değere bakıp "baraj altında" demek, sonradan geçen bir
 * yarışmacıya bir süre "elendin" göstermek olurdu. Değerlendirme
 * tamamlanmadan durum `beklemede`.
 *
 * ── EŞİTLİK GEÇER ───────────────────────────────────────────────────────
 * Baraj "en az şu kadar" demektir; tam eşik puanı alan geçer. Bu bir
 * yorum tercihi değil, barajın tanımı — ve tanımın kodda tek bir yerde
 * yazılı olması gerekiyor.
 */

export type BarajDurumu =
  /** Kategoride baraj tanımlı değil. */
  | 'yok'
  /** Baraj var ama değerlendirme sürüyor; hüküm verilemez. */
  | 'beklemede'
  | 'gecti'
  | 'gecemedi';

export interface BarajSonucu {
  durum: BarajDurumu;
  /** Eşik — `yok` dışında her durumda dolu. */
  baraj?: number;
  /** Nihai puan — yalnızca değerlendirme tamamlandıysa. */
  puan?: number;
  /** Barajı geçmek için gereken fark; geçtiyse 0. */
  eksik?: number;
}

export interface BarajGirdisi {
  /** Kategorinin baraj puanı; tanımsızsa baraj yok. */
  baraj?: number | null;
  /** Nihai puan (hakem ortalaması). */
  puan?: number | null;
  /** Atanmış BÜTÜN hakemler değerlendirmesini bitirdi mi? */
  tamamlandi: boolean;
}

export function barajDurumu(g: BarajGirdisi): BarajSonucu {
  const baraj = typeof g.baraj === 'number' && g.baraj > 0 ? g.baraj : null;
  if (baraj === null) return { durum: 'yok' };

  if (!g.tamamlandi || typeof g.puan !== 'number') {
    return { durum: 'beklemede', baraj };
  }

  /*
   * Yuvarlama EKRANDAKİ sayıyla aynı olmalı. Puanlar ondalıklı (74,5) ve
   * ekranda bir basamakla gösteriliyor. Ham değerle karşılaştırılsaydı
   * 69,96 puan alan bir yarışmacı ekranda "70,0" görüp "70 barajını
   * geçemedin" cümlesini okurdu — sistemin kendi kendini yalanlaması.
   */
  const puan = Math.round(g.puan * 10) / 10;
  const gecti = puan >= baraj;

  return {
    durum: gecti ? 'gecti' : 'gecemedi',
    baraj,
    puan,
    eksik: gecti ? 0 : Math.round((baraj - puan) * 10) / 10,
  };
}
