/**
 * Veri tutarlılığı denetimi — bakım betiği.
 *
 * Proje yöneticisi taramasında elle sorulan soruları tek komuta indiriyor.
 * Her satır bir "olmaması gereken durum"; hepsi 0 olmalı.
 */
import { baglanti } from '@/lib/db/baglanti';
import { nihaiOzet } from '@/lib/db/hakem-depo';

const db = baglanti();
const sor = (sql: string) =>
  (db.prepare(sql).get() as { n: number }).n;

const kontroller: Array<[string, number]> = [
  ['Değerlendirmesi olup ataması olmayan kayıt',
    sor(`SELECT COUNT(*) n FROM degerlendirme d
         WHERE NOT EXISTS (SELECT 1 FROM atama a
           WHERE a.rapor_id = d.rapor_id AND a.hakem_id = d.hakem_id)`)],
  ['Olmayan rapora atama',
    sor(`SELECT COUNT(*) n FROM atama a
         WHERE NOT EXISTS (SELECT 1 FROM rapor r WHERE r.id = a.rapor_id)`)],
  ['Olmayan hakeme atama',
    sor(`SELECT COUNT(*) n FROM atama a
         WHERE NOT EXISTS (SELECT 1 FROM hakem h WHERE h.id = a.hakem_id)`)],
  /*
   * Sistem kaydına atama TAMAMEN yasak değil: göç, arşiv
   * değerlendirmelerinin geçerli bir atamaya bağlı olması için o satırları
   * bilerek yazıyor (`degerlendirmeKaydet` atama zorunlu tutuyor). Yasak
   * olan, DEĞERLENDİRMESİ OLMAYAN bir sistem ataması — o gerçekten
   * "kimsenin yapmayacağı işi atanmış saymak" olur.
   */
  ['Sistem kaydına yapılmış BOŞ atama (değerlendirmesi yok)',
    sor(`SELECT COUNT(*) n FROM atama a
         JOIN hakem h ON h.id = a.hakem_id
         WHERE h.sistem = 1
           AND NOT EXISTS (SELECT 1 FROM degerlendirme d
             WHERE d.rapor_id = a.rapor_id AND d.hakem_id = a.hakem_id)`)],
  ['Kategorisi olmayan rapor',
    sor(`SELECT COUNT(*) n FROM rapor r
         WHERE NOT EXISTS (SELECT 1 FROM kategori k WHERE k.id = r.kategori_id)`)],
  ['Yarışması olmayan kategori',
    sor(`SELECT COUNT(*) n FROM kategori k
         WHERE NOT EXISTS (SELECT 1 FROM yarisma y WHERE y.id = k.yarisma_id)`)],
  ['Raporu olmayan parmak izi',
    sor(`SELECT COUNT(*) n FROM parmakizi p
         WHERE NOT EXISTS (SELECT 1 FROM rapor r WHERE r.id = p.rapor_id)`)],
  ['"tamamlandi" ama hiç tamamlanmış hakem değerlendirmesi olmayan rapor',
    sor(`SELECT COUNT(*) n FROM rapor r WHERE r.durum = 'tamamlandi'
         AND NOT EXISTS (SELECT 1 FROM degerlendirme d
           WHERE d.rapor_id = r.id AND d.durum = 'tamamlandi')`)],
  ['Tamamlanmış değerlendirmesi olup durumu "tamamlandi" olmayan rapor',
    sor(`SELECT COUNT(*) n FROM rapor r WHERE r.durum <> 'tamamlandi'
         AND EXISTS (SELECT 1 FROM degerlendirme d
           WHERE d.rapor_id = r.id AND d.durum = 'tamamlandi')`)],
  /*
   * Başvuru numarası yarışmacı portalının TEK kimlik kanıtı. Yinelenen
   * numara, iki farklı takımın birbirinin sonucunu görmesi anlamına
   * gelebilir — veri girişi hatası olarak bildirilmeli.
   */
  ['Yinelenen başvuru numarası',
    sor(`SELECT COUNT(*) n FROM (
           SELECT basvuru_no FROM rapor
           GROUP BY UPPER(TRIM(basvuru_no)) HAVING COUNT(*) > 1)`)],
  ['Aynı hakemin aynı rapora ikinci ataması',
    sor(`SELECT COUNT(*) n FROM (
           SELECT rapor_id, hakem_id, COUNT(*) c FROM atama
           GROUP BY rapor_id, hakem_id HAVING c > 1)`)],
];

// Önbelleklenmiş nihai puan ile hesap ayrışması
const raporlar = db.prepare('SELECT id, nihai_puan FROM rapor').all() as
  Array<{ id: string; nihai_puan: number | null }>;
const ayrisan = raporlar.filter((r) => {
  const dogru = nihaiOzet(r.id).puan ?? null;
  return r.nihai_puan !== dogru;
}).length;
kontroller.push(['nihai_puan kolonu hesapla ayrışan rapor', ayrisan]);

let hata = 0;
console.log('VERİ TUTARLILIĞI\n');
for (const [ad, n] of kontroller) {
  console.log(`  ${n === 0 ? '✓' : '✗'} ${String(n).padStart(3)}  ${ad}`);
  if (n !== 0) hata++;
}
console.log(
  hata ? `\n${hata} kontrol başarısız.` : '\nTüm kontroller temiz.',
);
process.exitCode = hata ? 1 : 0;
