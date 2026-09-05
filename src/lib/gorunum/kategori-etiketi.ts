/**
 * Kategori etiketi — ekranda ne yazacağı. SAF, test kapsamında.
 *
 * ── NİYE AYRI VE TESTLİ ─────────────────────────────────────────────────
 * Katalogdan gelen adlar üç türlü tekrar üretiyor ve üçü de ekranda
 * görüldü:
 *
 *   1. Kategori adı yarışma adının AYNISI (tek kategorili yarışmalarda):
 *      "Havacılıkta Yapay Zeka Yarışması · Havacılıkta Yapay Zeka Yarışması"
 *   2. Kategori adı zaten aşama kısaltmasını İÇERİYOR, üstüne bir de
 *      aşama ekleniyor: "Analog Tasarım · ÖTR · ÖTR"
 *   3. Kategori adı yarışma adıyla BAŞLIYOR:
 *      "FPV Drone İzleme Yarışması · FPV Drone İzleme Yarışması · ÖTR"
 *
 * Her seferinde ilgili ekranda tek tek düzeltildi ve bir sonraki ekranda
 * yeniden ortaya çıktı. Kural tek yerde olunca ekran sayısı arttıkça
 * tekrar üretmiyor.
 */

/** Karşılaştırma biçimi: boşluk ve büyük/küçük harf farkı yok sayılıyor. */
function sade(m: string): string {
  return m.trim().toLocaleLowerCase('tr').replace(/\s+/g, ' ');
}

/**
 * Kategori için gösterilecek metin.
 *
 * `yarismaAdi` verilmezse yalnızca aşama tekrarı ayıklanır — yarışma adının
 * ayrıca yazıldığı ekranlarda (kart başlığı gibi) bu yeterli.
 */
export function kategoriEtiketi(
  kategoriAdi: string,
  asama?: string,
  yarismaAdi?: string,
): string {
  let ad = kategoriAdi.trim();

  // (3) Yarışma adıyla başlıyorsa öneki at: "FPV … Yarışması ÖTR" → "ÖTR"
  if (yarismaAdi && sade(ad) !== sade(yarismaAdi) && sade(ad).startsWith(sade(yarismaAdi))) {
    const kalan = ad.slice(yarismaAdi.trim().length).replace(/^[\s·–—-]+/, '').trim();
    if (kalan) ad = kalan;
  }

  // (1) Yarışma adının aynısıysa kategori adı bilgi taşımıyor: aşama kalır.
  if (yarismaAdi && sade(ad) === sade(yarismaAdi)) {
    return asama?.trim() || ad;
  }

  if (!asama?.trim()) return ad;

  /*
   * (2) Aşama zaten adın içindeyse ekleme. Sınır denetimi gerekiyor:
   * "ÖTR" araması "PÖTRAL" gibi bir adda yanlış eşleşmesin diye kısaltma
   * ya sözcük başında/sonunda ya da ayıraçla çevrili olmalı.
   *
   * `\b` KULLANILMIYOR: JavaScript'te sözcük sınırı Türkçe harfleri
   * sözcük karakteri saymıyor ve "ÖTR" gibi bir kısaltmada sınır yanlış
   * yerde bulunuyor. Ayıraç kümesi elle yazılıyor.
   */
  const a = asama.trim();
  const kalip = new RegExp(
    `(^|[\\s·(\\[/,–—-])${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([\\s·)\\]/,–—-]|$)`,
    'i',
  );
  if (kalip.test(ad)) return ad;

  return `${ad} · ${a}`;
}

/**
 * Kart alt satırı: "Yarışma · Kategori" — tekrar etmeden.
 * Kategori bilgi taşımıyorsa yalnızca yarışma adı döner.
 */
export function yarismaKategoriEtiketi(
  yarismaAdi: string,
  kategoriAdi?: string,
  asama?: string,
): string {
  if (!kategoriAdi) return yarismaAdi;
  const k = kategoriEtiketi(kategoriAdi, asama, yarismaAdi);
  return sade(k) === sade(yarismaAdi) ? yarismaAdi : `${yarismaAdi} · ${k}`;
}
