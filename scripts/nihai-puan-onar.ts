/**
 * Bakım betiği — `nihai_puan` kolonunu hakem kayıtlarından yeniden yazar.
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
console.log(
  duzeltilen
    ? `\n${duzeltilen}/${raporlar.length} rapor düzeltildi.`
    : `${raporlar.length} raporun tamamı tutarlı.`,
);
