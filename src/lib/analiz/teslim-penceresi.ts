/**
 * Teslim penceresi — yarışmacı şu an rapor yükleyebilir mi.
 *
 * ── TARİH NEREDEN GELİYOR ───────────────────────────────────────────────
 * Şartnamenin kendi takviminden. Koordinasyonun her kategori için teslim
 * tarihi girmesi istenmiyor: 90 değerlendirme biriminde bu 90 elle giriş
 * demek ve her biri yanlış girilebilir. Tarih zaten şartnamede yazıyor ve
 * `asamaTakvimi()` onu ücretsiz çıkarıyor.
 *
 * ── TARİH YOKSA KAPI AÇIK ───────────────────────────────────────────────
 * Şartname yüklenmemiş ya da takvimi okunamamış olabilir. O durumda
 * yükleme ENGELLENMİYOR. Sebep: tarihi bilmemek, tarihin geçtiği anlamına
 * gelmez. Bilinmeyen bir tarih yüzünden yarışmacının raporunu teslim
 * edememesi, sistemin çözmeye çalıştığı sorundan büyük bir sorun olurdu.
 * Koordinasyon isterse başvuruyu pasife alarak yüklemeyi kapatabiliyor —
 * o karar insanın.
 *
 * ── SON GÜN DAHİL ───────────────────────────────────────────────────────
 * "22.04.2026 son teslim" o günün sonuna kadar demek. `kalanGun === 0`
 * teslim günüdür ve yükleme açıktır; kapanma ertesi gün başlıyor.
 */

import { asamaTakvimi, type AsamaTakvimi } from './takvim';

export interface PencereDurumu {
  acik: boolean;
  /** Kapalıysa yarışmacıya gösterilecek sebep. */
  sebep?: string;
  /** ISO tarih — biliniyorsa. */
  teslim?: string;
  kalanGun?: number;
}

/**
 * Kategorinin teslim penceresi.
 *
 * `tarihler` şartname çözümlemesinden gelen takvim satırları, `asama`
 * kategorinin aşama kısaltması (ÖTR, KTR…). İkisi de yoksa pencere açık.
 */
export function teslimPenceresi(
  tarihler: Array<{ etiket: string; tarih: string }> | undefined,
  asama: string | undefined,
  bugun: Date = new Date(),
): PencereDurumu {
  if (!tarihler?.length || !asama) return { acik: true };

  const t: AsamaTakvimi | null = asamaTakvimi(tarihler, asama, bugun);
  if (!t?.teslim) return { acik: true };

  const kalanGun = t.kalanGun;
  if (kalanGun === undefined || Number.isNaN(kalanGun)) {
    return { acik: true, teslim: t.teslim };
  }

  if (kalanGun >= 0) {
    return { acik: true, teslim: t.teslim, kalanGun };
  }

  return {
    acik: false,
    teslim: t.teslim,
    kalanGun,
    sebep: 'Bu kategorinin son teslim tarihi geçti.',
  };
}
