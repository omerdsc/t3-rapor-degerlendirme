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
  /** Yazışmanın sahibi hakem; duyuruda ve eski kayıtlarda boş. */
  hakemId?: string;
  kanal?: 'koordinasyon' | 'kurul';
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

/**
 * Hangi hakemlerin sorusu cevapsız kalmış?
 *
 * ── NİYE "BEKLİYOR MU" YETMİYOR ─────────────────────────────────────────
 * `cevapBekliyorMu` tek bir sohbete bakıyor. Ama koordinasyon kanalı çok
 * hakemli bir raporda TEK sohbet değil — hakem başına ayrı sohbet. A'ya
 * cevap verilmişken B bekliyor olabilir; rapor düzeyinde bakan bir hesap
 * bunu "cevaplandı" sayıp B'yi görünmez yapardı.
 *
 * Kimliksiz koordinasyon mesajı (herkese duyuru) hiçbir sırayı
 * KAPATMIYOR: herkese yazılmış bir not, kimseye verilmiş bir cevap
 * değildir. Kimliksiz hakem mesajı (v4 öncesi kayıt) da kimseye
 * yazılamaz — hangi hakem olduğu bilinmiyor.
 */
export function bekleyenHakemler(mesajlar: YazismaMesaji[]): Set<string> {
  const bekleyen = new Set<string>();
  // Dizinin sırasına güvenmiyoruz: karar tarihe göre veriliyor.
  const sirali = [...mesajlar].sort((a, b) => (a.tarih < b.tarih ? -1 : 1));

  for (const m of sirali) {
    if ((m.kanal ?? 'koordinasyon') !== 'koordinasyon') continue;
    if (m.rol === 'sistem' || m.otomatikMi || !m.hakemId) continue;
    if (m.rol === 'hakem') bekleyen.add(m.hakemId);
    else bekleyen.delete(m.hakemId);
  }
  return bekleyen;
}
