/**
 * Koordinasyon yetkisi — paylaşılan anahtar.
 *
 * ── NİYE VAR ────────────────────────────────────────────────────────────
 * Proje yöneticisi gözüyle yapılan taramada 17 API rotasının 16'sında hiç
 * yetki denetimi olmadığı görüldü. Sunucuya erişebilen herkes hakem
 * silebiliyor, atama yapabiliyor, ÜCRETLİ yapay zekâ çağrısı
 * başlatabiliyor ve — en ağırı — GERÇEK yarışmacı belgelerini indirip
 * bütün veriyi CSV olarak dışa aktarabiliyordu.
 *
 * ── NİYE PAYLAŞILAN ANAHTAR, NİYE KULLANICI HESABI DEĞİL ────────────────
 * Kurum kimlik sistemi (LDAP/SSO) bu projenin kapsamında değil ve taklidini
 * yapmak yanlış olurdu — sahte bir kullanıcı tablosu, gerçek bir kimlik
 * doğrulaması gibi görünüp öyle olmazdı. Paylaşılan anahtar ne olduğunu
 * dürüstçe söylüyor: koordinasyon ekibinin ortak parolası. Kurumsal
 * kurulumda bu dosya SSO ile değiştirilir; değiştirilecek yer TEK.
 *
 * ── NİYE YAPILANDIRILMAMIŞSA AÇIK ───────────────────────────────────────
 * `KOORDINASYON_ANAHTARI` tanımlı değilse sistem açık çalışıyor ve her
 * koordinasyon ekranında uyarı gösteriyor. Kapalı kurmak, anahtarı
 * bilmeyen birinin projeyi hiç çalıştıramaması demek olurdu. Eksikliği
 * GİZLEMEK yerine GÖSTERMEK tercih edildi — kapalı bir kapı sanılan açık
 * kapı, açık olduğu bilinen kapıdan tehlikelidir.
 */

/** Tarayıcıda tutulan çerez adı. HttpOnly — betikler okuyamaz. */
export const COKKI = 'dg_koordinasyon';

/** Anahtar tanımlı mı? Değilse sistem açık ve bunu söylemek zorunda. */
export function yetkiKurulu(): boolean {
  return (process.env.KOORDINASYON_ANAHTARI ?? '').trim().length > 0;
}

/**
 * Verilen anahtar doğru mu.
 *
 * Karşılaştırma SABİT SÜRELİ: uzunluk ve içerik farkları yanıt süresine
 * yansımıyor. Kısa bir anahtar için pratikte fark etmez ama zamanlama
 * sızıntısına açık karşılaştırma yazmanın da bir gerekçesi yok.
 */
export function anahtarDogru(verilen: string): boolean {
  const beklenen = (process.env.KOORDINASYON_ANAHTARI ?? '').trim();
  if (!beklenen) return false;

  const a = new TextEncoder().encode(verilen);
  const b = new TextEncoder().encode(beklenen);
  // Uzunluk farkı tek başına sızıntı; yine de tüm baytlar taranıyor.
  let fark = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    fark |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return fark === 0;
}

/**
 * İstek koordinasyon yetkisine sahip mi.
 *
 * Anahtar kurulu değilse HERKES yetkili — açık kurulum. Kuruluysa çerez
 * ya da `x-koordinasyon-anahtari` başlığı aranıyor; başlık, betiklerin ve
 * `curl` ile yapılan denetimlerin çerez kurmadan çalışabilmesi için.
 */
export function istekYetkili(istek: Request): boolean {
  if (!yetkiKurulu()) return true;

  const baslik = istek.headers.get('x-koordinasyon-anahtari');
  if (baslik && anahtarDogru(baslik)) return true;

  const cerezler = istek.headers.get('cookie') ?? '';
  for (const parca of cerezler.split(';')) {
    const [ad, ...deger] = parca.trim().split('=');
    if (ad === COKKI && anahtarDogru(decodeURIComponent(deger.join('=')))) {
      return true;
    }
  }
  return false;
}

/**
 * API rotaları için tek satırlık kapı.
 *
 * `null` dönerse istek geçebilir; `Response` dönerse rota onu doğrudan
 * döndürmeli. Proxy katmanı da var ama Next belgeleri bunu açıkça
 * uyarıyor: matcher değişikliği ya da yeniden düzenleme proxy kapsamını
 * SESSİZCE kaldırabilir, bu yüzden denetim rotanın kendisinde de olmalı.
 */
export function kapi(istek: Request): Response | null {
  if (istekYetkili(istek)) return null;
  return Response.json(
    { hata: 'Koordinasyon yetkisi gerekli.' },
    { status: 401 },
  );
}
