import { NextResponse, type NextRequest } from 'next/server';
import { COKKI, anahtarDogru, yetkiKurulu } from '@/lib/yetki/koordinasyon';

/**
 * Koordinasyon perimetresi.
 *
 * Next 16'da bu dosyanın adı `middleware.ts` DEĞİL `proxy.ts` — eski ad
 * kullanımdan kaldırıldı (`node_modules/next/dist/docs/.../proxy.md`).
 *
 * ── PERİMETRE TEK SAVUNMA DEĞİL ─────────────────────────────────────────
 * Next belgeleri bunu açıkça uyarıyor: matcher değişikliği ya da bir
 * rotanın taşınması proxy kapsamını SESSİZCE kaldırabilir. Bu yüzden
 * gerçek denetim rotaların içinde (`kapi()`), burası yalnızca ilk kapı —
 * asıl işi, yetkisiz kullanıcıyı boş ekranlar yerine giriş sayfasına
 * götürmek.
 *
 * ── HANGİ YOLLAR AÇIK KALIYOR ───────────────────────────────────────────
 * `/hakem/*` ve `/sonuc` başka izleyicilere ait: hakem kendi koduyla,
 * yarışmacı başvuru numarasıyla giriyor. Onları koordinasyon anahtarının
 * arkasına almak üç portalı tek portala indirirdi.
 *
 * `/giris` ve `/api/koordinasyon-giris` matcher'ın dışında: kilidi açan
 * kapının kilitli olması olmaz.
 *
 * `/api/rapor/:id/mesaj` de dışarıda — yazışmayı HAKEM de kullanıyor ve
 * kendi erişim koduyla giriyor. Perimetreye alınsaydı hakem koordinasyona
 * hiç yazamazdı. O uç yetkiyi kendi içinde denetliyor: kod geçerli mi ve
 * rapor o hakeme atanmış mı.
 */
export function proxy(istek: NextRequest) {
  if (!yetkiKurulu()) return NextResponse.next();

  const yol = istek.nextUrl.pathname;
  /*
   * Çerez VE başlık — ikisi de kabul, rota içindeki `kapi()` ile aynı.
   * Başlangıçta yalnızca çerez denetleniyordu ve sonuç şuydu: belgelenen
   * `x-koordinasyon-anahtari` başlığı, proxy'nin eşleştiği rotalarda
   * sessizce çalışmıyordu. İki katmanın aynı kuralı uygulamaması, tek
   * katmanın hiç olmamasından daha kafa karıştırıcı.
   */
  const cerez = istek.cookies.get(COKKI)?.value;
  if (cerez && anahtarDogru(cerez)) return NextResponse.next();

  const baslik = istek.headers.get('x-koordinasyon-anahtari');
  if (baslik && anahtarDogru(baslik)) return NextResponse.next();

  /*
   * API isteği tarayıcı gezintisi değil: 401 döndürülüyor, yönlendirilmiyor.
   * Yönlendirme yapılsa istemci HTML alıp JSON ayrıştırmaya çalışır ve
   * hata mesajı "beklenmeyen belirteç <" olur — asıl sebebi gizler.
   */
  if (yol.startsWith('/api/')) {
    return NextResponse.json(
      { hata: 'Koordinasyon yetkisi gerekli.' },
      { status: 401 },
    );
  }

  const hedef = istek.nextUrl.clone();
  hedef.pathname = '/giris';
  // Girişten sonra kullanıcı gitmek istediği yere dönsün.
  hedef.search = `?devam=${encodeURIComponent(yol + istek.nextUrl.search)}`;
  return NextResponse.redirect(hedef);
}

export const config = {
  /*
   * Yalnızca koordinasyon yüzeyi. `/api/hakem-degerlendirme` DIŞARIDA:
   * hakem panelinin puan gönderdiği uç ve kendi kod denetimi var — buraya
   * alınsa hakem hiç puan gönderemezdi.
   */
  matcher: [
    '/koordinasyon/:yol*',
    '/api/analiz',
    '/api/atama',
    '/api/benzerlik',
    '/api/disa-aktar',
    '/api/hakem',
    '/api/katalog/:yol*',
    '/api/kriter',
    '/api/ozet-toplu',
    '/api/rapor',
    '/api/rapor/:id/degerlendir',
    '/api/rapor/:id/kimlik',
    '/api/sartname',
    '/api/yarisma',
    '/api/yarisma/:yol*',
  ],
};
