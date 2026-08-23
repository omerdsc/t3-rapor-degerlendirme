/**
 * Türkçe PDF metni onarımı.
 *
 * Gerçek TEKNOFEST raporlarında metin katmanı düzgün gelmez: font encoding
 * yüzünden Türkçe harfler bozulur, ligatürler tek karakter olur, aksanlar
 * ayrı karakter olarak düşer. Başlık eşleştirmesi tam string eşitliğiyle
 * yapılırsa bu raporlarda çalışmaz.
 *
 * bkz. docs/gercek-dunya-sorunlari.md · B1
 */

/** UTF-8 metnin Latin-1 olarak okunmasından doğan bozulmalar. */
const MOJIBAKE: Array<[RegExp, string]> = [
  [/Ä°/g, 'İ'], [/Ä±/g, 'ı'], [/ÄŸ/g, 'ğ'], [/Ä/g, 'Ğ'],
  [/ÅŸ/g, 'ş'], [/Å/g, 'Ş'], [/Ã§/g, 'ç'], [/Ã‡/g, 'Ç'],
  [/Ã¶/g, 'ö'], [/Ã–/g, 'Ö'], [/Ã¼/g, 'ü'], [/Ãœ/g, 'Ü'],
];

/**
 * Türkçe (cp1254) metnin Batı Avrupa (cp1252) olarak okunmasından doğan
 * bozulmalar. İki kod sayfası altı baytta ayrışıyor:
 *
 *     0xDD  İ ↔ Ý      0xFD  ı ↔ ý
 *     0xDE  Ş ↔ Þ      0xFE  ş ↔ þ
 *     0xD0  Ğ ↔ Ð      0xF0  ğ ↔ ð
 *
 * Eski PDF üreticilerinde görülüyor. MOJIBAKE listesinden ayrı tutuluyor
 * çünkü KOŞULLU uygulanıyor: þ, ð, ý İzlandaca'da gerçek harfler. Bir
 * künyede "Þórsson" geçiyorsa onu "Şórsson" yapmak yeni bir bozulma olur.
 *
 * Koşul: belgede DÜZGÜN Türkçe karakter hiç yoksa ama bu karakterler
 * varsa, metin yanlış kod sayfasıyla okunmuş demektir. Türkçe bir raporda
 * tek bir ş/ğ/ı bile yoksa ve bolca þ/ð/ý varsa, başka açıklaması yok.
 */
const CP1254: Array<[RegExp, string]> = [
  [/Ý/g, 'İ'], [/ý/g, 'ı'], [/Þ/g, 'Ş'],
  [/þ/g, 'ş'], [/Ð/g, 'Ğ'], [/ð/g, 'ğ'],
];

/*
 * Koşulda YALNIZCA kod sayfaları arasında FARKLI olan harfler var.
 *
 * ç, ö, ü ve büyükleri cp1254 ile cp1252'de AYNI bayta düşüyor; yanlış
 * çözümlemede bozulmadan geçiyorlar. Onları "belge düzgün okunmuş"
 * kanıtı saymak hatalıydı: "Ýçindekiler" hem bozuk Ý hem sağlam ç
 * taşıyor ve ilk sürüm bu yüzden onarımı hiç çalıştırmıyordu.
 *
 * Bozulmaya uğrayan harfler ş, ğ, ı, İ, Ş, Ğ. Bunlardan biri düzgün
 * görünüyorsa belge doğru kod sayfasıyla okunmuş demektir.
 */
const DUZGUN_TURKCE = /[şğıİŞĞ]/;
const CP1254_IZI = /[ÝýÞþÐð]/;

/** Ligatürler ve tipografik karakterler. */
const LIGATUR: Array<[RegExp, string]> = [
  [/ﬀ/g, 'ff'], [/ﬁ/g, 'fi'], [/ﬂ/g, 'fl'],
  [/ﬃ/g, 'ffi'], [/ﬄ/g, 'ffl'], [/ﬅ/g, 'st'], [/ﬆ/g, 'st'],
  [/[‘’‛ʼ]/g, "'"], [/[“”„]/g, '"'],
  [/[‐-―]/g, '-'], [/…/g, '...'],
  [/[   ​‌‍]/g, ' '],
];

/**
 * Aksanın ayrı karakter olarak düştüğü durumlar.
 * `s` + boşluklu sedilla → `ş`, `g` + boşluklu breve → `ğ`.
 * Hem birleşen (combining) hem boşluklu (spacing) biçimleri kapsar.
 */
const AYRIK_AKSAN: Array<[RegExp, string]> = [
  [/s[̧¸̦]/g, 'ş'], [/S[̧¸̦]/g, 'Ş'],
  [/c[̧¸̦]/g, 'ç'], [/C[̧¸̦]/g, 'Ç'],
  [/g[̆˘]/g, 'ğ'], [/G[̆˘]/g, 'Ğ'],
  [/o[̈¨]/g, 'ö'], [/O[̈¨]/g, 'Ö'],
  [/u[̈¨]/g, 'ü'], [/U[̈¨]/g, 'Ü'],
  [/I[̇˙]/g, 'İ'],
];

/** Ham PDF metnini karşılaştırılabilir hâle getirir. */
export function onar(ham: string): string {
  let s = ham;
  for (const [d, y] of MOJIBAKE) s = s.replace(d, y);

  /*
   * cp1254 onarımı KOŞULLU: yalnızca metinde hiç düzgün Türkçe karakter
   * yokken uygulanıyor. Düzgün karakter varsa belge doğru okunmuş
   * demektir ve þ/ð/ý gerçek harflerdir (İzlandaca künye olabilir).
   */
  if (CP1254_IZI.test(s) && !DUZGUN_TURKCE.test(s)) {
    for (const [d, y] of CP1254) s = s.replace(d, y);
  }

  for (const [d, y] of LIGATUR) s = s.replace(d, y);
  s = s.normalize('NFC');
  for (const [d, y] of AYRIK_AKSAN) s = s.replace(d, y);
  // Kalan başıboş birleşen aksanlar — onarılamadıysa gürültü yaratmasınlar.
  s = s.replace(/[̀-ͯ]/g, '');
  return s.replace(/[ \t]+/g, ' ').trim();
}

/**
 * Onarımın ne kadar iş yaptığını ölçer. Yüksek oran, metin katmanının
 * bozuk olduğunu ve fuzzy eşleştirmenin şart olduğunu gösterir.
 */
export function bozulmaOrani(ham: string): number {
  if (!ham) return 0;
  let bozuk = 0;
  for (const [d] of [...MOJIBAKE, ...AYRIK_AKSAN]) {
    bozuk += (ham.match(d) ?? []).length;
  }
  return bozuk / Math.max(ham.length / 100, 1);
}

const ASCII_HARITA: Record<string, string> = {
  ı: 'i', İ: 'i', I: 'i', i: 'i',
  ğ: 'g', Ğ: 'g', ş: 's', Ş: 's',
  ç: 'c', Ç: 'c', ö: 'o', Ö: 'o', ü: 'u', Ü: 'u',
  â: 'a', Â: 'a', î: 'i', Î: 'i', û: 'u', Û: 'u',
};

/**
 * Karşılaştırma anahtarı: aksansız, küçük harfli, noktalamasız.
 * Türkçe'de `I` → `ı` olduğu için JS'in toLowerCase'ine güvenilmez;
 * i/ı ayrımı burada bilinçli olarak kaldırılır.
 */
export function anahtar(s: string): string {
  let r = '';
  for (const ch of onar(s)) r += ASCII_HARITA[ch] ?? ch;
  return r
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Başlıktan numarayı ayırır: "3.2. Özgün Tasarım" → { "3.2", "Özgün Tasarım" }. */
export function numarayiAyir(satir: string): { numara: string | null; sade: string } {
  const s = onar(satir).trim();
  // En çok üç düzey, her düzey en çok iki hane: "3.2.1" evet, "10.04.2026" hayır.
  const m = s.match(/^((?:\d{1,2}[.)]){1,3}\d{0,2}|[IVXLC]{1,5}[.)]|[A-ZÇĞİÖŞÜ][.)])\s+(.*)$/);
  if (m) return { numara: m[1].replace(/[.)]+$/, ''), sade: m[2].trim() };
  return { numara: null, sade: s };
}

/** Numaralandırmanın derinliği: "3.2.1" → 3. Numarasızsa 1. */
export function baslikSeviyesi(numara: string | null): number {
  if (!numara) return 1;
  return numara.split('.').filter(Boolean).length;
}

/** Levenshtein mesafesi — iki satırlık DP, uzun metinlerde de ucuz. */
export function mesafe(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let onceki = Array.from({ length: b.length + 1 }, (_, i) => i);
  let simdiki = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    simdiki[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const bedel = a[i - 1] === b[j - 1] ? 0 : 1;
      simdiki[j] = Math.min(simdiki[j - 1] + 1, onceki[j] + 1, onceki[j - 1] + bedel);
    }
    [onceki, simdiki] = [simdiki, onceki];
  }
  return onceki[b.length];
}

/** 0–1 arası benzerlik. Karşılaştırma anahtar üzerinden yapılır. */
export function benzerlik(a: string, b: string): number {
  const x = anahtar(a);
  const y = anahtar(b);
  if (!x && !y) return 1;
  const uzun = Math.max(x.length, y.length);
  if (!uzun) return 0;
  return 1 - mesafe(x, y) / uzun;
}

/** Kelimelere böler — kelime sayımı ve içerik doluluğu için. */
export function kelimeler(s: string): string[] {
  return onar(s)
    .split(/[^\p{L}\p{N}'’-]+/u)
    .filter((k) => k.length > 1);
}
