/**
 * Bakım betiği — türetilmiş rapor durumunu kayıtlardan yeniden yazar.
 *
 * İki şeyi onarıyor:
 *   1. `nihai_puan` kolonu (tamamlanmış hakem puanlarının ortalaması)
 *   2. `durum` alanı (bütün hakemler bitirdiyse "tamamlandi")
 *
 * Bir kez gerekliydi: eski koordinasyon puanlama formu bu kolona doğrudan
 * yazıyordu ve hakem puanı kaydedildiğinde kolon güncellenmiyordu. Sonuç,
 * listede 75,5 / detayda 71,8 gösteren bir rapordu.
 *
 * Yazma yolu artık tek (`nihaiPuaniYaz`), ama bu betik dursun: aynı sınıf
 * bir tutarsızlık bir daha çıkarsa onarımı elle SQL yazmadan yapılabilir.
 */
import { baglanti } from '@/lib/db/baglanti';
import { nihaiOzet, nihaiPuaniYaz } from '@/lib/db/hakem-depo';

const raporlar = baglanti()
  .prepare('SELECT id, basvuru_no, nihai_puan FROM rapor')
  .all() as Array<{ id: string; basvuru_no: string; nihai_puan: number | null }>;

let duzeltilen = 0;
for (const r of raporlar) {
  const dogru = nihaiOzet(r.id).puan ?? null;
  if (r.nihai_puan === dogru) continue;
  nihaiPuaniYaz(r.id);
  console.log(`${r.basvuru_no}: ${r.nihai_puan ?? '—'} → ${dogru ?? '—'}`);
  duzeltilen++;
}
/*
 * DURUM ONARIMI.
 *
 * Ön değerlendirme çalıştırmak raporun durumunu "hakem bekliyor"a geri
 * çeviriyordu (düzeltildi) ve bu, tamamlanmış raporların yarışmacı
 * sonucunu KAPATMIŞTI. Bu bölüm o hasarı onarıyor ve aynı sınıf bir
 * ayrışma yeniden çıkarsa elle SQL yazmadan düzeltilebilir kalıyor.
 *
 * Kural tek yönlü: bütün atanmış hakemler bitirdiyse "tamamlandi"
 * yazılıyor. Tersi YAPILMIYOR — "tamamlandi" olan bir raporu geri almak,
 * verilmiş bir kararı sistemin kendi başına iptal etmesi olurdu.
 */
const durumuAyrisan = baglanti()
  .prepare(
    `SELECT r.id, r.basvuru_no, r.durum
       FROM rapor r
       JOIN atama a ON a.rapor_id = r.id
       LEFT JOIN degerlendirme d
              ON d.rapor_id = a.rapor_id AND d.hakem_id = a.hakem_id
      WHERE r.durum NOT IN ('tamamlandi', 'manuel_inceleme')
      GROUP BY r.id
     HAVING COUNT(a.hakem_id) > 0
        AND SUM(CASE WHEN d.durum = 'tamamlandi' THEN 1 ELSE 0 END)
            >= COUNT(a.hakem_id)`,
  )
  .all() as Array<{ id: string; basvuru_no: string; durum: string }>;

for (const a of durumuAyrisan) {
  // Tamamlanma zamanı olarak son hakemin bitirdiği an yazılıyor: onarım
  // tarihi değil, işin gerçekten bittiği tarih.
  const son = (
    baglanti()
      .prepare(
        `SELECT MAX(tamamlandi) AS son FROM degerlendirme
          WHERE rapor_id = ? AND durum = 'tamamlandi'`,
      )
      .get(a.id) as { son: string | null }
  ).son ?? new Date().toISOString();

  baglanti()
    .prepare("UPDATE rapor SET durum = 'tamamlandi', tamamlandi = ? WHERE id = ?")
    .run(son, a.id);
  console.log(`${a.basvuru_no}: durum ${a.durum} → tamamlandi`);
  duzeltilen++;
}

console.log(
  duzeltilen
    ? `\n${duzeltilen} düzeltme yapıldı (${raporlar.length} rapor tarandı).`
    : `${raporlar.length} raporun tamamı tutarlı.`,
);
