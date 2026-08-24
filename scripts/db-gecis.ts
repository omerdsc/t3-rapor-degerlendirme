/**
 * JSON dosya deposunu SQLite'a taşır. JSON dosyaları SİLİNMEZ.
 *   npx tsx scripts/db-gecis.ts
 */
import { gecisYap } from '../src/lib/db/gecis';
import { baglanti } from '../src/lib/db/baglanti';

const KALIN = '\x1b[1m', R = '\x1b[0m', SOLUK = '\x1b[2m', AMBER = '\x1b[33m';

const s = gecisYap();
console.log(`${KALIN}GEÇİŞ${R}`);
console.log(`  yarışma                ${s.yarisma}`);
console.log(`  kategori               ${s.kategori}`);
console.log(`  rapor                  ${s.rapor}`);
console.log(`  parmak izi             ${s.parmakizi}`);
console.log(`  mesaj                  ${s.mesaj}`);
console.log(`  arşive taşınan puanlama ${s.arsivDegerlendirmesi}`);
if (s.atlanan.length) {
  console.log(`\n${AMBER}ATLANAN (${s.atlanan.length})${R}`);
  for (const a of s.atlanan.slice(0, 10)) console.log(`  ⚠ ${a}`);
}

const db = baglanti();
console.log(`\n${KALIN}DOĞRULAMA${R}`);
for (const t of ['yarisma', 'kategori', 'rapor', 'parmakizi', 'hakem', 'atama', 'degerlendirme', 'mesaj']) {
  const n = db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number };
  console.log(`  ${t.padEnd(16)} ${n.n}`);
}
console.log(`\n${SOLUK}JSON dosyaları olduğu gibi duruyor — geri dönüş mümkün.${R}`);
