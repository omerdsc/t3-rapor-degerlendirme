/**
 * Ölçüm raporlarını siler — `npm run hacim -- N kalsin` sonrası için.
 *
 * Ayrı betik olması bilinçli: ölçüm verisi demo sırasında bırakılabiliyor
 * ve temizlemenin tek, akılda kalır bir komutu olmalı. Silme yarışma
 * kimliğine bağlı, gerçek veriye dokunamaz.
 */
import { baglanti } from '@/lib/db/baglanti';

const OLCUM_YARISMA = 'olcum-hacim-yarismasi';

const db = baglanti();
const n = (
  db.prepare('SELECT COUNT(*) c FROM rapor WHERE yarisma_id = ?').get(OLCUM_YARISMA) as
    { c: number }
).c;

db.exec('BEGIN');
try {
  // ON DELETE CASCADE atama ve değerlendirmeleri de siliyor.
  db.prepare('DELETE FROM rapor WHERE yarisma_id = ?').run(OLCUM_YARISMA);
  db.prepare('DELETE FROM kategori WHERE yarisma_id = ?').run(OLCUM_YARISMA);
  db.prepare('DELETE FROM yarisma WHERE id = ?').run(OLCUM_YARISMA);
  db.exec('COMMIT');
} catch (e) {
  db.exec('ROLLBACK');
  throw e;
}

console.log(n ? `${n} ölçüm raporu silindi.` : 'Silinecek ölçüm verisi yok.');
