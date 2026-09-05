/**
 * Parola özeti — scrypt. SAF, test kapsamında.
 *
 * ── NİYE scrypt ─────────────────────────────────────────────────────────
 * Node'un içinde var, ek bağımlılık gerektirmiyor ve BELLEK-SIKI: hızlı
 * donanımla paralel deneme yapmayı pahalı kılıyor. Düz SHA-256 saniyede
 * milyarlarca deneme demekti; sızan bir veritabanında zayıf parolalar
 * dakikalar içinde çözülürdü.
 *
 * ── SAKLANAN BİÇİM ──────────────────────────────────────────────────────
 *     scrypt$<N>$<tuz base64>$<özet base64>
 * Parametre özetin İÇİNDE. Maliyet ileride artırıldığında eski kayıtlar
 * kendi parametreleriyle doğrulanmaya devam ediyor; hepsini birden
 * yeniden hesaplamak imkânsız (açık parolalar elimizde değil).
 */

import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (
  parola: string | Buffer,
  tuz: string | Buffer,
  uzunluk: number,
  secenek: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/*
 * N=16384 (2^14) — Node'un varsayılanı. Tek doğrulama bu makinede ~60 ms:
 * kullanıcının hissetmeyeceği kadar kısa, kaba kuvveti anlamsız kılacak
 * kadar uzun.
 */
const N = 16384;
const R = 8;
const P = 1;
const UZUNLUK = 64;
// maxmem varsayılanı 32 MB ve N=16384 için 128*N*r = 16 MB yetiyor; yine
// de açıkça veriliyor ki N artırıldığında sessizce "memory limit exceeded"
// ile patlamasın.
const MAXMEM = 64 * 1024 * 1024;

export async function parolaOzetle(parola: string): Promise<string> {
  const tuz = randomBytes(16);
  const ozet = await scryptAsync(parola.normalize('NFC'), tuz, UZUNLUK, {
    N, r: R, p: P, maxmem: MAXMEM,
  });
  return `scrypt$${N}$${tuz.toString('base64')}$${ozet.toString('base64')}`;
}

/**
 * Parola doğrulama.
 *
 * Karşılaştırma `timingSafeEqual` ile: baytların kaçıncısında ayrıldığı
 * yanıt süresine yansımıyor.
 *
 * Bozuk ya da tanınmayan bir özet `false` döndürüyor, hata FIRLATMIYOR:
 * veritabanında elle bozulmuş tek bir satır, giriş uç noktasının tamamını
 * 500'e düşürmemeli.
 */
export async function parolaDogrula(parola: string, saklanan: string): Promise<boolean> {
  try {
    const [alg, nMetin, tuzB64, ozetB64] = saklanan.split('$');
    if (alg !== 'scrypt') return false;

    const n = Number(nMetin);
    if (!Number.isInteger(n) || n < 1024 || n > 1_048_576) return false;

    const beklenen = Buffer.from(ozetB64, 'base64');
    if (beklenen.length !== UZUNLUK) return false;

    const hesap = await scryptAsync(
      parola.normalize('NFC'),
      Buffer.from(tuzB64, 'base64'),
      UZUNLUK,
      { N: n, r: R, p: P, maxmem: MAXMEM },
    );
    return timingSafeEqual(hesap, beklenen);
  } catch {
    return false;
  }
}

/**
 * Parola yeterli mi.
 *
 * En az 8 karakter. Karmaşıklık kuralı (büyük harf + rakam + simge) YOK:
 * ölçümler bu kuralların kullanıcıyı `Parola1!` gibi tahmin edilebilir
 * kalıplara ittiğini gösteriyor. Uzunluk daha iyi bir ölçü.
 */
export function parolaSorunu(parola: string): string | null {
  if (parola.length < 8) return 'Parola en az 8 karakter olmalı.';
  if (parola.length > 200) return 'Parola çok uzun.';
  if (!parola.trim()) return 'Parola yalnızca boşluktan oluşamaz.';
  return null;
}

/**
 * E-posta normalleştirme — TÜRKÇE YEREL AYAR TUZAĞI.
 *
 * `toLowerCase()` Türkçe yerel ayarda `I` harfini `ı`ya çeviriyor.
 * `ALI@X.COM` adresi `alı@x.com` olur ve kullanıcı bir daha asla giriş
 * yapamaz — kayıt sırasında bir biçim, girişte başka bir biçim üretilir.
 * `toLocaleLowerCase('en')` bu davranışı yerel ayardan bağımsız kılıyor.
 */
export function epostaNormal(eposta: string): string {
  return eposta.trim().toLocaleLowerCase('en');
}

/** Basit biçim denetimi: bir @ ve ondan sonra bir nokta. */
export function epostaGecerli(eposta: string): boolean {
  const e = eposta.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 254;
}
