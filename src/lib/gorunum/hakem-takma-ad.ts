/**
 * Hakem takma adları — bir hakem ötekinin adını GÖRMEZ.
 *
 * ── ÇÖZDÜĞÜ SORUN ───────────────────────────────────────────────────────
 * Kurul kanalı hakemlerin birbiriyle konuştuğu yer ve her mesajın üstünde
 * yazanın GERÇEK ADI duruyordu: "Prof. Dr. …". Aynı rapora atanmış iki
 * hakem, birbirinin kimliğini bu ekrandan öğreniyordu. Kişisel verinin
 * işlenme amacı hakemlik yapmak; ötekinin kim olduğunu bilmek bu amacın
 * içinde değil. KVKK'nın veri minimizasyonu ilkesi bunu istemiyor.
 *
 * Kimlik gizliliği ayrıca değerlendirmenin kendisini koruyor: hakem,
 * kurulda kimin ne dediğini kişi olarak bilmezse itibara göre değil
 * gerekçeye göre tartışır.
 *
 * ── NİYE SUNUCUDA ───────────────────────────────────────────────────────
 * Bu maskeleme yanıt gövdesine uygulanıyor, ekrana değil. İstemcide
 * gizlenseydi gerçek ad ağdan geçmeye devam ederdi ve geliştirici
 * araçlarını açan herkes görürdü — gizlenmiş bir alan silinmiş bir alan
 * değildir.
 *
 * ── KOORDİNASYON HARİÇ ──────────────────────────────────────────────────
 * Koordinasyon gerçek adları görüyor ve görmesi gerekiyor: atamayı o
 * yapıyor, itiraz hâlinde kaydı o tutuyor. Kısıtlanan taraf HAKEMİN
 * HAKEMİ görmesi.
 */

/**
 * Etiket alfabesi.
 *
 * I, Q, W, X yok: I Türkçe'de büyük harfken 'ı' okunuyor ve "Hakem I"
 * ekranda "Hakem ı" gibi duruyor; Q/W/X ise Türk alfabesinde yok. Kalan
 * harfler sesli okunduğunda karışmıyor.
 */
const ALFABE = 'ABCDEFGHJKLMNOPRSTUVYZ';

/** Sıradaki hakemin etiketi: A, B, … Z, sonra A2, B2 … */
function etiket(sira: number): string {
  const harf = ALFABE[sira % ALFABE.length];
  const tur = Math.floor(sira / ALFABE.length);
  return tur ? `${harf}${tur + 1}` : harf;
}

/**
 * Rapora atanmış hakemlerin kimlik → takma ad eşlemesi.
 *
 * Sıra ATAMA SIRASI (`raporunHakemleri` `ORDER BY atandi` veriyor):
 * herkes için aynı, oturumdan oturuma değişmiyor. Rastgele üretilseydi
 * hakem her açılışta farklı bir "Hakem C" görür ve iki mesajın aynı
 * kişiden gelip gelmediğini anlayamazdı.
 */
export function takmaAdlar(hakemIdleri: string[]): Map<string, string> {
  const eslem = new Map<string, string>();
  for (const id of hakemIdleri) {
    if (!eslem.has(id)) eslem.set(id, `Hakem ${etiket(eslem.size)}`);
  }
  return eslem;
}

export interface Yazarli {
  yazar: string;
  rol: 'hakem' | 'koordinasyon' | 'yarisma_yoneticisi' | 'sistem';
  /** Yazan (ya da muhatap) hakemin kimliği. */
  hakemId?: string;
}

/**
 * Tek bir mesajın yazar adını hakem gözüyle yaz.
 *
 * Koordinasyon ve sistem imzaları olduğu gibi kalıyor: onlar kurum, kişi
 * değil. Yalnızca HAKEM rolündeki mesajın adı takma adla değişiyor.
 */
export function maskeliYazar(
  m: Yazarli,
  adlar: Map<string, string>,
  benimId: string,
): string {
  if (m.rol !== 'hakem') return m.yazar;
  /*
   * Hakem kendi mesajını "Siz" diye görüyor — ama takma adı da yanında.
   * Kurulda ötekiler onu "Hakem B" diye görüyorsa, kendi yazdığının hangi
   * etiketle okunduğunu bilmeli; yoksa "Hakem B'nin dediği" cevabının
   * kendisine mi geldiğini anlayamaz.
   */
  const ad = m.hakemId ? adlar.get(m.hakemId) : undefined;
  if (m.hakemId && m.hakemId === benimId) return ad ? `Siz (${ad})` : 'Siz';
  /*
   * Tanınmayan ya da kimliksiz hakem mesajı: gerçek ada DÜŞMÜYOR. Eşleme
   * eksikse bilinmeyene "Hakem" deniyor — bir kimlik sızdırmaktansa bir
   * etiket kaybetmek yeğdir.
   */
  return ad ?? 'Hakem';
}

export interface AtanmisHakem {
  id: string;
  ad: string;
}

/**
 * Mesaj METNİNDEKİ hakem adlarını takma adla değiştirir.
 *
 * ── NİYE GEREKİYOR ─────────────────────────────────────────────────────
 * Yazar alanını maskelemek yetmiyor: ad metnin İÇİNDE de geçebiliyor.
 * Sistem "Nihai değerlendirme tamamlandı — Dr. …" diye yazıyordu ve sistem
 * mesajları kanal süzgecinden muaf; yani o satırı bütün atanmış hakemler
 * okuyordu. Metni yazan kod düzeltildi ama VERİTABANINDA duran eski kayıtlar
 * adı taşımaya devam ediyor. Okuma anında maskelemek ikisini birden
 * karşılıyor — geçmiş kayıtları da, ileride adI metne karıştıracak bir kod
 * yolunu da.
 *
 * ── NİYE REGEX YOK ──────────────────────────────────────────────────────
 * `split(ad).join(...)` birebir dizi eşleşmesi yapıyor. Kelime sınırı
 * (``) Türkçe harflerde sessizce yanlış çalışıyor ve `toLowerCase()`
 * I→ı eşliyor; ad maskelemede sessiz bir başarısızlık, doğrudan
 * sızıntı demek.
 *
 * Hakemin KENDİ adı değişmiyor: kendi kimliğini zaten biliyor ve cümleyi
 * kendi adıyla okumak daha anlaşılır.
 */
export function metinMaskele(
  metin: string,
  hakemler: AtanmisHakem[],
  benimId: string,
): string {
  /*
   * Uzun ad ÖNCE: "Dr. Elif Şahin" ile "Elif Şahin" aynı anda kayıtlıysa,
   * kısa olan önce değişirse geriye "Dr. Hakem A" gibi yarım maskelenmiş
   * bir dize kalır.
   */
  const adlar = takmaAdlar(hakemler.map((h) => h.id));
  const sirali = [...hakemler].sort((a, b) => b.ad.length - a.ad.length);
  let sonuc = metin;
  for (const h of sirali) {
    // Çok kısa ad maskelenmiyor: sıradan kelimelerin içinde geçer ve
    // cümleyi tanınmaz hâle getirir.
    if (h.id === benimId || !h.ad || h.ad.trim().length < 4) continue;
    sonuc = sonuc.split(h.ad).join(adlar.get(h.id) ?? 'Hakem');
  }
  return sonuc;
}

/** Mesaj listesini bir hakemin göreceği hâle çevirir — yazar da metin de. */
export function hakemGozuyle<T extends Yazarli & { metin?: string }>(
  mesajlar: T[],
  hakemler: AtanmisHakem[],
  benimId: string,
): T[] {
  const adlar = takmaAdlar(hakemler.map((h) => h.id));
  return mesajlar.map((m) => ({
    ...m,
    yazar: maskeliYazar(m, adlar, benimId),
    ...(typeof m.metin === 'string'
      ? { metin: metinMaskele(m.metin, hakemler, benimId) }
      : {}),
  }));
}
