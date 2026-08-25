/**
 * Yazışma kanalları ve kim neyi görebilir — SAF fonksiyonlar.
 *
 * ── ÇÖZDÜĞÜ SORUN ───────────────────────────────────────────────────────
 * Yazışma rapor bazlıydı ve o rapora erişen herkese açıktı. Ortak
 * değerlendirilen bir raporda A hakemi, B hakeminin koordinasyona yazdığı
 * mesajı OKUYABİLİYORDU. Çok hakemli değerlendirmenin bütün değeri
 * hakemlerin bağımsız olmasından gelirken, B'nin "bu rapor zayıf" notunu
 * puanlamadan önce görmek o bağımsızlığı bozuyordu.
 *
 * ── İKİ KANAL ───────────────────────────────────────────────────────────
 *   koordinasyon · Yazan hakem ile koordinasyon arasında. Öteki hakemler
 *                  görmez. "Şablon sürümü doğru mu" gibi sorular buraya.
 *   kurul        · Rapora atanmış BÜTÜN hakemler + koordinasyon. Hakemlerin
 *                  birbiriyle konuştuğu yer.
 *
 * ── KURUL NİYE KİLİTLİ BAŞLIYOR ─────────────────────────────────────────
 * Herkes puanlamayı bitirene kadar kapalı. Sebebi akademik hakemlikteki
 * kuralın aynısı: önce bağımsız değerlendirme, sonra tartışma. Erken açık
 * olsa ilk yazan hakem ötekini etkiler ve ölçtüğümüz "hakemler arası
 * ayrışma" anlamını yitirir — ayrışmanın bilgi değeri, iki kişinin
 * BİRBİRİNDEN HABERSİZ aynı rapora bakmış olmasından geliyor.
 *
 * Kilit hakemi çaresiz bırakmıyor: koordinasyon kanalı her zaman açık ve
 * koordinasyon her iki kanalı da görüyor, gerekirse aracılık ediyor.
 */

export type Kanal = 'koordinasyon' | 'kurul';

export interface KanalMesaji {
  kanal: Kanal;
  /** Yazan hakemin kimliği; koordinasyon ya da sistem yazdıysa yok. */
  hakemId?: string;
  rol: 'hakem' | 'koordinasyon' | 'yarisma_yoneticisi' | 'sistem';
}

/**
 * Kurul kanalı açık mı?
 *
 * İki koşul: rapora birden çok hakem atanmış olmalı (tek hakemli raporda
 * kurul diye bir şey yok) ve atanmış hakemlerin HEPSİ değerlendirmesini
 * tamamlamış olmalı.
 */
export function kurulAcikMi(
  atananlar: Array<{ id: string; tamamladi: boolean }>,
): boolean {
  if (atananlar.length < 2) return false;
  return atananlar.every((h) => h.tamamladi);
}

/**
 * Bir hakem hangi mesajları görebilir?
 *
 * Koordinasyon bu fonksiyondan geçmiyor — o her şeyi görüyor ve görmesi
 * gerekiyor: aracılık eden taraf o.
 */
export function hakeminGorebilecekleri<T extends KanalMesaji>(
  mesajlar: T[],
  hakemId: string,
  kurulAcik: boolean,
): T[] {
  return mesajlar.filter((m) => {
    if (m.kanal === 'kurul') {
      // Kurul kapalıyken kimse okuyamıyor — yazılmış olsa bile.
      return kurulAcik;
    }
    /*
     * Koordinasyon kanalı: yalnızca o hakemin kendi yazışması.
     *
     * Sistem mesajları (değerlendirme tamamlandı vb.) hakem kimliği
     * taşımıyor ama herkesi ilgilendiriyor — rapor durumu ortak bilgi.
     * Koordinasyonun yazdığı yanıt da kime yazıldığını `hakemId` ile
     * taşıyor; taşımıyorsa herkese açık bir duyuru sayılıyor.
     */
    if (m.rol === 'sistem') return true;
    if (!m.hakemId) return m.rol !== 'hakem';
    return m.hakemId === hakemId;
  });
}
