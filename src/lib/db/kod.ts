/**
 * Hakem erişim kodu — üretim ve normalleştirme. SAF, test kapsamında.
 *
 * ── NEDEN AYRI VE TESTLİ ────────────────────────────────────────────────
 * Kod `7KSN-NTBD` biçiminde üretiliyor. Giriş kutusu ise girdiyi
 * "harf ve rakam dışını at" diye temizliyordu — tireyi de atıyordu ve
 * `7KSNNTBD` üretiyordu. Sonuç: kodu DOĞRU yazan hakem 404 alıyordu.
 * Panele girmeyi kolaylaştırmak için eklenen kutu, girmeyi imkânsız
 * kılmıştı.
 *
 * Ders: kod hem üretilip hem gösterilip hem elle yazılıp hem panodan
 * yapıştırılıyor. Bu kadar el değmiş bir dizede "tam eşitlik" aramak
 * kırılgan. Karşılaştırma NORMAL BİÇİM üzerinden yapılıyor: tire,
 * boşluk, küçük/büyük harf farkı sonucu değiştirmiyor.
 */

/**
 * Karışabilecek karakterler alfabede YOK: 0/O, 1/I/l.
 * Kod telefonda okunup elle yazılabiliyor; O ile 0'ı karıştırmak
 * hakemin panele girememesi demek.
 */
const ALFABE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Görünen biçim: 4 karakter, tire, 4 karakter. Tire okunurluk için. */
export function kodUret(rastgele: () => number = Math.random): string {
  let k = '';
  for (let i = 0; i < 8; i++) {
    k += ALFABE[Math.floor(rastgele() * ALFABE.length)];
    if (i === 3) k += '-';
  }
  return k;
}

/**
 * Karşılaştırma biçimi: yalnızca harf ve rakam, büyük harf.
 *
 * `toUpperCase()` yerine `toLocaleUpperCase('en')`: alfabede Türkçe harf
 * yok, ama girdi kullanıcıdan geliyor ve Türkçe yerel ayarda `i` harfi
 * `İ`ye dönüşür. `en` ile davranış girdi ne olursa olsun aynı.
 */
export function kodNormal(kod: string): string {
  return kod.toLocaleUpperCase('en').replace(/[^A-Z0-9]/g, '');
}

/** Girilen kod, kayıtlı kodla aynı mı — biçim farkları göz ardı edilerek. */
export function kodEsler(girilen: string, kayitli: string): boolean {
  const g = kodNormal(girilen);
  return g.length > 0 && g === kodNormal(kayitli);
}
