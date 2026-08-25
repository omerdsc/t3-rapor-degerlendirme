/**
 * Koordinasyon girişi — anahtarı çereze yazar.
 *
 * Bu uç bilerek proxy matcher'ının DIŞINDA: kilidi açan kapının kilitli
 * olması olmaz.
 */
import { COKKI, anahtarDogru, yetkiKurulu } from '@/lib/yetki/koordinasyon';

export async function POST(istek: Request) {
  if (!yetkiKurulu()) {
    return Response.json(
      { hata: 'Yetki kurulu değil; giriş gerekmiyor.' },
      { status: 400 },
    );
  }

  let g: { anahtar?: string };
  try {
    g = await istek.json();
  } catch {
    return Response.json({ hata: 'İstek okunamadı.' }, { status: 400 });
  }

  if (!g.anahtar || !anahtarDogru(g.anahtar)) {
    /*
     * "Anahtar yanlış" ile "anahtar boş" ayrılmıyor ve gecikme
     * eklenmiyor: bu bir creathon projesi, hız sınırlama altyapısı yok.
     * Sınırı yazmak, gizlemekten iyi — kaba kuvvete karşı korumasız,
     * anahtarın uzun olması gerekiyor.
     */
    return Response.json({ hata: 'Anahtar geçersiz.' }, { status: 401 });
  }

  const yanit = Response.json({ girildi: true });
  /*
   * HttpOnly: sayfadaki betikler okuyamıyor, XSS ile çalınamıyor.
   * SameSite=Lax: başka siteden gelen POST isteklerinde çerez gitmiyor.
   *
   * Secure BAĞLANTIYA GÖRE ekleniyor, ortama göre değil. Sebep: `Secure`
   * çerez http üzerinde hiç kurulmuyor — sabit açık bırakılsa geliştirme
   * girişi sessizce çalışmaz, sabit kapalı bırakılsa canlıda oturum
   * çerezi şifresiz taşınır. Doğru soru "hangi ortamdayız" değil, "bu
   * istek şifreli mi geldi".
   *
   * Ters vekil (Caddy/nginx) arkasında istek uygulamaya http olarak
   * ulaşıyor; asıl protokol `x-forwarded-proto` başlığında. Başlığı
   * yalnızca vekilin yazdığına güveniyoruz — doğrudan internete açık
   * çalıştırma senaryosu yok, dağıtım her zaman vekil arkasında.
   */
  yanit.headers.append(
    'set-cookie',
    `${COKKI}=${encodeURIComponent(g.anahtar)}; Path=/; HttpOnly; SameSite=Lax; `
      + `Max-Age=43200${sifreliMi(istek) ? '; Secure' : ''}`,
  );
  return yanit;
}

/** İstek kullanıcıya https olarak mı göründü? */
function sifreliMi(istek: Request): boolean {
  const iletilen = istek.headers.get('x-forwarded-proto');
  if (iletilen) return iletilen.split(',')[0].trim() === 'https';
  return new URL(istek.url).protocol === 'https:';
}

/** Çıkış — çerezi siler. */
export async function DELETE() {
  const yanit = Response.json({ cikildi: true });
  yanit.headers.append(
    'set-cookie',
    `${COKKI}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  );
  return yanit;
}
