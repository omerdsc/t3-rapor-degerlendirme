/**
 * Yarışmacı oturumu — çerez ↔ oturum tablosu.
 *
 * Çerezde yalnızca rastgele bir belirteç var; kimlik veritabanından
 * çözülüyor. Çerezin içeriğine hiç güvenilmiyor, yalnızca arama anahtarı
 * olarak kullanılıyor — böylece oturum iptal edilebilir kalıyor (parola
 * değişince ya da hesap kapanınca düşüyor).
 */

import {
  OTURUM_GUN, oturumYarismacisi, type Yarismaci,
} from '@/lib/db/yarismaci-depo';

export const YARISMACI_COKKI = 'tprds_yarismaci';

export function oturumSahibi(istek: Request): Yarismaci | null {
  const cerezler = istek.headers.get('cookie') ?? '';
  for (const parca of cerezler.split(';')) {
    const [ad, ...deger] = parca.trim().split('=');
    if (ad !== YARISMACI_COKKI) continue;
    return oturumYarismacisi(decodeURIComponent(deger.join('=')));
  }
  return null;
}

/** API rotaları için tek satırlık kapı. `kapi()` ile aynı sözleşme. */
export function yarismaciKapisi(istek: Request): Response | null {
  return oturumSahibi(istek)
    ? null
    : Response.json({ hata: 'Oturum bulunamadı. Giriş yapın.' }, { status: 401 });
}

/**
 * `Secure` bayrağı isteğin protokolünden kararlaştırılıyor.
 *
 * Sabit `true` yerelde (http) çerezi hiç kurmaz ve giriş sessizce
 * çalışmaz; sabit `false` canlıda çerezi şifresiz bağlantıya da
 * gönderirdi. Vekil arkasında olduğumuz için `x-forwarded-proto` da
 * okunuyor — Caddy isteği içeride http olarak iletiyor.
 */
export function guvenliMi(istek: Request): boolean {
  return (
    new URL(istek.url).protocol === 'https:'
    || istek.headers.get('x-forwarded-proto') === 'https'
  );
}

export function cerezYaz(belirtec: string, guvenli: boolean): string {
  return [
    `${YARISMACI_COKKI}=${encodeURIComponent(belirtec)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${OTURUM_GUN * 24 * 3600}`,
    guvenli ? 'Secure' : '',
  ].filter(Boolean).join('; ');
}

export function cerezSil(): string {
  return `${YARISMACI_COKKI}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
