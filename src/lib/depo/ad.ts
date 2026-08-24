/**
 * Ad kısaltma — dar alanlara (çip, tablo hücresi) sığdırmak için.
 *
 * Kendi dosyasında ve test kapsamında, çünkü bu projede Türkçe metin
 * fonksiyonları defalarca SESSİZCE bozuldu: `\b` sınırının ı/ş harflerini
 * kelime karakteri saymaması, `İ` harfinin küçültülünce iki koda ayrılması
 * gibi. Bir istemci bileşeninin içinde kalsa test edilemezdi.
 */

/** Akademik ve mesleki unvanlar — kimliği taşıyan kısım bunlar değil. */
const UNVANLAR = new Set([
  'prof', 'doç', 'dr', 'öğr', 'gör', 'arş', 'müh', 'uzm', 'av', 'op',
]);

/** Nokta ve boşluk atılıp küçültülmüş hali; İ/I ayrımına dikkat. */
function sadeleştir(kelime: string): string {
  return kelime.replace(/\./g, '').toLocaleLowerCase('tr');
}

/**
 * Çipe sığacak kısa ad.
 *
 * "Son kelimeyi al" yetmiyordu: `Arşiv (geçiş öncesi)` adı için `öncesi)`
 * çıkıyordu — parantezli ek son kelime sayılıyordu. Sıra şu:
 * parantezli ekler atılır, unvanlar ayıklanır, kalan son kelime alınır.
 * Hiçbiri kalmazsa ham ad kırpılır — boş çip göstermemek için.
 */
export function kisaAd(ad: string, azami = 14): string {
  const govde = ad.replace(/\s*\([^)]*\)/g, '').trim();
  const kelimeler = govde
    .split(/\s+/)
    .filter((k) => k.length > 0 && !UNVANLAR.has(sadeleştir(k)));

  const secilen = kelimeler.at(-1) ?? govde ?? '';
  const sonuc = secilen || ad.trim();
  return sonuc.length > azami ? `${sonuc.slice(0, azami - 1)}…` : sonuc;
}
