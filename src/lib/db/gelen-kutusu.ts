/**
 * Koordinasyonun gelen kutusu — bütün konuşmalar tek listede.
 *
 * ── NİYE VAR ────────────────────────────────────────────────────────────
 * Mesajlar iki ayrı sayfanın DİBİNDE duruyordu: hakem yazışması rapor
 * sayfasında, yarışmacı yazışması başvuru sayfasında. Koordinasyonun bir
 * mesajı görmesi için hangi raporun ya da hangi başvurunun mesajı
 * olduğunu ÖNCEDEN bilmesi gerekiyordu. Kenar çubuğundaki bildirim
 * yalnızca CEVAPSIZ olanları sayıyordu; cevaplanmış bir konuşmaya geri
 * dönmenin hiçbir yolu yoktu.
 *
 * Bir kullanıcı "mesajlarım nerede" sorusunu soruyorsa mesajlaşma
 * çalışmıyor demektir. Bu modül iki kaynağı tek bir listede birleştiriyor;
 * arayüz onu bir çekmecede gösteriyor.
 *
 * ── NİYE İKİ TABLO BİRLEŞTİRİLİYOR, TEK TABLOYA TAŞINMIYOR ──────────────
 * Hakem yazışması kör puanlamayı korumak için yarışmacıdan gizli; iki
 * yazışmayı tek tabloda tutmak, süzgeçte yapılacak tek bir hatayı hakem
 * notlarının yarışmacıya sızması hâline getirirdi. Ayrılık veri
 * katmanında kalıyor, birleşme yalnızca KOORDİNASYONUN GÖRÜNÜMÜNDE
 * oluyor — çünkü ikisini de yalnızca koordinasyon görüyor.
 */

import { baglanti } from './baglanti';
import { cevapBekliyorMu } from './yazisma-durum';

export type KonusmaTuru = 'hakem' | 'yarismaci';

export interface Konusma {
  /** Çekmecede kullanılan bileşik anahtar: "hakem:<raporId>:<hakemId>" */
  anahtar: string;
  tur: KonusmaTuru;
  /** Karşı tarafın adı — hakem adı ya da takım adı. */
  kisi: string;
  /** Konu: başvuru numarası ve proje. */
  basvuruNo: string;
  proje: string;
  sonMesaj: string;
  tarih: string;
  /** Koordinasyon cevap vermeli mi. */
  bekliyor: boolean;
  /** Konuşmanın açılacağı sayfa — çekmece dışında da erişilebilsin. */
  yol: string;
}

export interface KonusmaMesaji {
  id: string;
  /** Koordinasyon mu yazdı, karşı taraf mı. */
  bizim: boolean;
  yazar: string;
  metin: string;
  tarih: string;
}

/** Bir metnin listede gösterilecek kısaltması. */
function kirp(m: string, n = 90): string {
  const t = m.replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

/**
 * Bütün konuşmalar — cevap bekleyenler ÜSTTE, sonra tarihe göre.
 *
 * Cevaplanmışlar da listede: gelen kutusunun işi yalnızca bekleyeni
 * göstermek değil, geçmişe dönebilmeyi sağlamak. Bildirim "ne bekliyor"
 * sorusunu cevaplıyor; gelen kutusu "kiminle ne konuştuk" sorusunu.
 */
export function konusmalar(): Konusma[] {
  const db = baglanti();
  const liste: Konusma[] = [];

  // ---------------------------------------------------- hakem yazışması
  const hakemSatirlari = db
    .prepare(
      `SELECT m.rapor_id, m.hakem_id, r.basvuru_no, r.proje,
              COALESCE(h.ad, m.yazar) AS kisi
         FROM mesaj m
         JOIN rapor r ON r.id = m.rapor_id
         LEFT JOIN hakem h ON h.id = m.hakem_id
        WHERE m.kanal = 'koordinasyon' AND m.rol <> 'sistem' AND m.otomatik = 0
        GROUP BY m.rapor_id, COALESCE(m.hakem_id, '')`,
    )
    .all() as Array<Record<string, string>>;

  for (const s of hakemSatirlari) {
    /*
     * Konuşmanın mesajları HAKEM BAŞINA çekiliyor. Rapor başına
     * çekilseydi çok hakemli bir raporda iki ayrı sohbet tek listeye
     * karışır ve kim ne sordu belirsizleşirdi.
     */
    const mesajlar = db
      .prepare(
        `SELECT id, yazar, rol, metin, tarih FROM mesaj
          WHERE rapor_id = ? AND kanal = 'koordinasyon'
            AND rol <> 'sistem' AND otomatik = 0
            AND COALESCE(hakem_id, '') = ?
          ORDER BY tarih`,
      )
      .all(s.rapor_id, s.hakem_id ?? '') as Array<Record<string, string>>;
    if (!mesajlar.length) continue;

    const son = mesajlar[mesajlar.length - 1];
    // Bekleme kuralı tek yerde ve testli: son insan mesajı hakemdense
    // koordinasyon cevap vermeli. Kuralı burada yeniden yazmak, iki yerin
    // zamanla ayrışması demekti.
    const bekliyor = cevapBekliyorMu(
      mesajlar.map((m) => ({
        rol: m.rol as 'hakem' | 'koordinasyon',
        tarih: m.tarih,
      })),
    );

    liste.push({
      anahtar: `hakem:${s.rapor_id}:${s.hakem_id ?? ''}`,
      tur: 'hakem',
      kisi: s.kisi,
      basvuruNo: s.basvuru_no,
      proje: s.proje,
      sonMesaj: kirp(son.metin),
      tarih: son.tarih,
      bekliyor,
      yol:
        `/koordinasyon/rapor/${s.rapor_id}`
        + (s.hakem_id ? `?hakem=${encodeURIComponent(s.hakem_id)}` : '')
        + '#yazisma',
    });
  }

  // ------------------------------------------------ yarışmacı yazışması
  const basvuruSatirlari = db
    .prepare(
      `SELECT b.id, b.basvuru_no, b.takim, COALESCE(b.proje, b.takim) AS proje
         FROM basvuru_mesaji m
         JOIN basvuru b ON b.id = m.basvuru_id
        GROUP BY b.id`,
    )
    .all() as Array<Record<string, string>>;

  for (const b of basvuruSatirlari) {
    const mesajlar = db
      .prepare(
        `SELECT id, yazar_rol, yazar_adi, metin, tarih, okundu
           FROM basvuru_mesaji WHERE basvuru_id = ? ORDER BY tarih`,
      )
      .all(b.id) as Array<Record<string, string | number>>;
    if (!mesajlar.length) continue;

    const son = mesajlar[mesajlar.length - 1];
    liste.push({
      anahtar: `yarismaci:${b.id}`,
      tur: 'yarismaci',
      kisi: b.takim,
      basvuruNo: b.basvuru_no,
      proje: b.proje,
      sonMesaj: kirp(String(son.metin)),
      tarih: String(son.tarih),
      bekliyor: son.yazar_rol === 'yarismaci' && son.okundu === 0,
      yol: `/koordinasyon/basvurular/${b.id}`,
    });
  }

  return liste.sort((a, b) => {
    if (a.bekliyor !== b.bekliyor) return a.bekliyor ? -1 : 1;
    return b.tarih.localeCompare(a.tarih);
  });
}

/** Tek bir konuşmanın mesajları. */
export function konusmaMesajlari(anahtar: string): KonusmaMesaji[] {
  const db = baglanti();
  const [tur, a, b] = anahtar.split(':');

  if (tur === 'hakem') {
    return (
      db
        .prepare(
          `SELECT id, yazar, rol, metin, tarih FROM mesaj
            WHERE rapor_id = ? AND kanal = 'koordinasyon'
              AND rol <> 'sistem' AND otomatik = 0
              AND COALESCE(hakem_id, '') = ?
            ORDER BY tarih`,
        )
        .all(a, b ?? '') as Array<Record<string, string>>
    ).map((m) => ({
      id: m.id,
      bizim: m.rol === 'koordinasyon',
      yazar: m.yazar,
      metin: m.metin,
      tarih: m.tarih,
    }));
  }

  if (tur === 'yarismaci') {
    return (
      db
        .prepare(
          `SELECT id, yazar_rol, yazar_adi, metin, tarih
             FROM basvuru_mesaji WHERE basvuru_id = ? ORDER BY tarih`,
        )
        .all(a) as Array<Record<string, string>>
    ).map((m) => ({
      id: m.id,
      bizim: m.yazar_rol === 'koordinasyon',
      yazar: m.yazar_adi,
      metin: m.metin,
      tarih: m.tarih,
    }));
  }

  return [];
}

/** Cevap bekleyen konuşma sayısı — çekmece rozetinin okuduğu sayı. */
export function bekleyenKonusmaSayisi(): number {
  return konusmalar().filter((k) => k.bekliyor).length;
}
