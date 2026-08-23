/**
 * Yarışmayı ayırt eden terimleri ŞARTNAMEDEN çıkarır.
 *
 * NEYİN YERİNE GEÇİYOR
 * İçerik uygunluğu kontrolü şimdiye kadar elle yazılmış terim listelerine
 * dayanıyordu (`kategoriler.ts`): "Tarım Teknolojileri" için sensör, sulama,
 * verim… Bu listeleri ben uydurmuştum ve kodda da öyle işaretliydi. Uydurma
 * veriyle çalışan bir kontrol, doğru sonuç verse bile güvenilemez —
 * hangisinin isabet hangisinin şans olduğu bilinemez.
 *
 * Artık terimler her yarışmanın KENDİ ŞARTNAMESİNDEN çıkarılıyor. Kaynak
 * gerçek, ölçüt açık: "bu rapor, bu yarışmanın şartnamesinin konuştuğu
 * şeylerden mi bahsediyor?"
 *
 * ── NEDEN BU SORU DAHA DOĞRU ────────────────────────────────────────────
 * Eski soru "bu rapor tarım raporu mu?" idi. Ama sistemde artık 43 yarışma
 * var ve her birinin kendi şartnamesi. Doğru soru "bu rapor BU YARIŞMANIN
 * istediği şeyden mi bahsediyor?" — çok daha keskin ve kaynağı gerçek.
 *
 * MALİYET: $0. Yapay zekâ yok; frekans sayımı ve durak sözcük elemesi.
 */

import { anahtar } from './normalize';

/**
 * Türkçe durak sözcükler ve her belgede geçen kalıp ifadeler.
 *
 * Şartname dili son derece kalıplı: "madde", "fıkra", "yarışma", "takım",
 * "başvuru", "değerlendirme" her şartnamede geçer ve hiçbir yarışmayı ayırt
 * etmez. Bunlar elenmezse bütün yarışmalar birbirine benzer çıkar.
 */
const DURAK = new Set([
  // dilbilgisi
  'bir', 've', 'ile', 'icin', 'olan', 'olarak', 'daha', 'gibi', 'kadar', 'ise',
  'ancak', 'veya', 'ya', 'da', 'de', 'bu', 'su', 'o', 'her', 'tum', 'butun',
  'en', 'cok', 'az', 'gerekir', 'olmalidir', 'yapilir', 'edilir', 'olup',
  'uzere', 'ayrica', 'ancak', 'fakat', 'yani', 'hem', 'ne', 'hic', 'baska',
  // şartname kalıpları — her belgede var, ayırt etmez
  'yarisma', 'yarismasi', 'yarismanin', 'yarismaya', 'yarismada',
  'takim', 'takimi', 'takimlar', 'takimin', 'takimlarin',
  'basvuru', 'basvurusu', 'basvurulari', 'katilim', 'katilimci', 'katilimcilar',
  'rapor', 'raporu', 'raporun', 'raporlar', 'sartname', 'sartnamesi',
  'madde', 'fikra', 'bent', 'ek', 'eki', 'sayfa', 'bolum', 'baslik',
  'degerlendirme', 'degerlendirilir', 'puan', 'puanlama', 'kriter', 'olcut',
  'teknofest', 'festival', 'organizasyon', 'komite', 'kurul', 'jur', 'juri',
  'hakem', 'hakemler', 'sunum', 'final', 'finalist', 'odul', 'oduller',
  'tarih', 'tarihi', 'son', 'ilk', 'yil', 'yili', 'donem', 'asama', 'asamasi',
  'proje', 'projesi', 'projenin', 'projeler', 'calisma', 'calismalari',
  'sistem', 'sistemi', 'sistemler', 'teknoloji', 'teknolojileri',
  'kategori', 'kategorisi', 'kategoriler', 'seviye', 'seviyesi',
  'universite', 'lise', 'ogrenci', 'ogrenciler', 'danisman', 'uye', 'uyesi',
  'turkiye', 'turk', 'ulusal', 'uluslararasi', 'genel', 'ozel', 'ilgili',
  'gerekli', 'zorunlu', 'kabul', 'gecerli', 'uygun', 'uygulama',
]);

/** Terim aday sayılmak için en az bu kadar harf gerekiyor. */
const ASGARI_UZUNLUK = 4;

/**
 * Bir şartname metninden ayırt edici terimleri çıkarır.
 *
 * Yöntem sade: sözcük frekansı + durak elemesi. TF-IDF'in ikinci yarısı
 * (IDF) zaten `kategori.ts` içinde, karşılaştırma anında, TÜM yarışmaların
 * terim listeleri üzerinden hesaplanıyor. Burada IDF hesaplamak yanlış
 * olurdu: bir yarışmanın kendi içinde nadir olan sözcük, öteki yarışmalara
 * göre ayırt edici olmayabilir.
 */
export function terimleriCikar(sartnameMetni: string, azami = 40): string[] {
  const sayim = new Map<string, number>();

  for (const ham of anahtar(sartnameMetni).split(' ')) {
    if (ham.length < ASGARI_UZUNLUK) continue;
    if (DURAK.has(ham)) continue;
    // Salt sayı ya da sayı ağırlıklı belirteçler terim değil.
    if (/^\d/.test(ham)) continue;
    sayim.set(ham, (sayim.get(ham) ?? 0) + 1);
  }

  /*
   * TEK GEÇEN SÖZCÜK ALINMIYOR.
   *
   * Şartnamelerde bir kez geçen yüzlerce sözcük var (kurum adları, örnekler,
   * dipnotlar). Bunları terim saymak listeyi gürültüyle doldurur ve
   * eşleşmeyi rastlantısallaştırır. En az iki kez geçmesi, sözcüğün
   * belgenin konusu olduğuna dair asgari kanıt.
   */
  return [...sayim.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'tr'))
    .slice(0, azami)
    .map(([terim]) => terim);
}

/**
 * Bir yarışmanın terim profilini, kendi şartname özetinden de besler.
 *
 * Şartname metni uzun ve gürültülü; AI özeti (varsa) yarışmanın ÖZÜNÜ
 * söylüyor ve orada geçen sözcükler daha ayırt edici. Özet varsa
 * terimleri iki kez sayılıyor — ağırlıklandırma yerine tekrar, çünkü
 * frekans sayımı zaten ağırlık demek.
 */
export function profilCikar(
  sartnameMetni: string,
  ozetMetni?: string,
  azami = 40,
): string[] {
  const kaynak = ozetMetni
    ? `${sartnameMetni} ${ozetMetni} ${ozetMetni}`
    : sartnameMetni;
  return terimleriCikar(kaynak, azami);
}
