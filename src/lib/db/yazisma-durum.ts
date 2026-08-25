/**
 * Yazışmanın cevap bekleyip beklemediği — SAF fonksiyon.
 *
 * ── NİYE TÜRETİLİYOR, SAKLANMIYOR ───────────────────────────────────────
 * "Okundu" ya da "cevaplandı" diye bir alan tutulabilirdi. Tutulmadı:
 * saklanan durum gerçekle ayrışır (bu projede nihai puan tam böyle
 * ayrıştı). Kural basit ve kendini doğruluyor:
 *
 *   Yazışmadaki SON insan mesajı hakemden geldiyse → koordinasyon
 *   cevap vermemiş demektir.
 *
 * Sistem mesajları sayılmıyor: "değerlendirme tamamlandı" gibi otomatik
 * kayıtlar bir cevap değil. Koordinasyonun kendi mesajı da soruyu
 * kapatıyor — cevap verilmişse bekleyen bir şey yok.
 */

export interface YazismaMesaji {
  rol: 'hakem' | 'koordinasyon' | 'yarisma_yoneticisi' | 'sistem';
  tarih: string;
  otomatikMi?: boolean;
}

/** Koordinasyonun cevaplaması bekleniyor mu? */
export function cevapBekliyorMu(mesajlar: YazismaMesaji[]): boolean {
  const insan = mesajlar.filter((m) => m.rol !== 'sistem' && !m.otomatikMi);
  if (!insan.length) return false;
  // Tarihe göre son insan mesajı — dizinin sırasına güvenmiyoruz.
  const son = insan.reduce((a, b) => (a.tarih >= b.tarih ? a : b));
  return son.rol === 'hakem';
}

/** Hakemin bekleyen sorusu ne zamandan beri duruyor (ISO tarih)? */
export function bekleyenSoruTarihi(mesajlar: YazismaMesaji[]): string | null {
  if (!cevapBekliyorMu(mesajlar)) return null;

  /*
   * Hakem üst üste birkaç mesaj yazmış olabilir; bekleme süresi
   * SONUNCUSUNDAN değil, koordinasyonun cevaplamadığı İLK mesajdan
   * sayılmalı. "3 saat önce soruldu" demek, hakem araya bir hatırlatma
   * yazdı diye "5 dakika önce" olmamalı.
   */
  const insan = [...mesajlar]
    .filter((m) => m.rol !== 'sistem' && !m.otomatikMi)
    .sort((a, b) => (a.tarih < b.tarih ? -1 : 1));

  let ilk: string | null = null;
  for (let i = insan.length - 1; i >= 0; i--) {
    if (insan[i].rol !== 'hakem') break;
    ilk = insan[i].tarih;
  }
  return ilk;
}
