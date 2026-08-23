/**
 * TEKNOFEST kataloğunu çeker ve veri/katalog.json'a yazar.
 *
 *   npx tsx scripts/katalog-cek.ts                    → 60 yarışma
 *   npx tsx scripts/katalog-cek.ts cip-tasarim-yarismasi  → yalnızca biri
 *
 * Maliyet: $0. Yapay zekâ çağrısı yok, yalnızca sayfa okuma.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { katalogCek } from '../src/lib/katalog/cek';

const KALIN = '\x1b[1m', R = '\x1b[0m', SOLUK = '\x1b[2m';
const YESIL = '\x1b[32m', AMBER = '\x1b[33m', KIRMIZI = '\x1b[31m';

async function main() {
  const yalnizca = process.argv.slice(2);
  console.log(`${SOLUK}teknofest.org taranıyor${yalnizca.length ? ` (${yalnizca.length} yarışma)` : ''}…${R}\n`);

  const katalog = await katalogCek({
    yalnizca: yalnizca.length ? yalnizca : undefined,
    ilerleme: (bitti, toplam, y) => {
      const isaret = y.sablonVar ? `${YESIL}●${R}` : `${AMBER}○${R}`;
      const etiketler = [
        y.sablonVar && `${y.belgeler.filter((b) => b.tur === 'sablon').length} şablon`,
        y.sartnameVar && 'şartname',
        y.teknikSartnameVar && `${YESIL}teknik şartname${R}`,
        y.kategoriler.length > 1 && `${y.kategoriler.length} kategori`,
        y.asamalar.length > 1 && y.asamalar.join('/'),
        y.adSeviyesi,
      ].filter(Boolean).join(' · ');
      console.log(
        `${isaret} ${String(bitti).padStart(2)}/${toplam} ${y.ad.slice(0, 52).padEnd(52)} ` +
          `${SOLUK}${etiketler}${R}`,
      );
    },
  });

  mkdirSync(join(process.cwd(), 'veri'), { recursive: true });
  const yol = join(process.cwd(), 'veri', 'katalog.json');
  writeFileSync(yol, JSON.stringify(katalog, null, 2), 'utf-8');

  const y = katalog.yarismalar;
  console.log(`\n${KALIN}ÖZET${R}`);
  console.log(`  yarışma            ${y.length}`);
  console.log(`  şablonu olan       ${y.filter((x) => x.sablonVar).length}`);
  console.log(`  şartnamesi olan    ${y.filter((x) => x.sartnameVar).length}`);
  console.log(`  teknik şartnameli  ${y.filter((x) => x.teknikSartnameVar).length}`);
  console.log(`  çok kategorili     ${y.filter((x) => x.kategoriler.length > 1).length}`);
  console.log(`  çok aşamalı        ${y.filter((x) => x.asamalar.length > 1).length}`);
  console.log(`  seviyeli (ad)      ${y.filter((x) => x.adSeviyesi).length}`);
  console.log(`  belge              ${y.reduce((t, x) => t + x.belgeler.length, 0)}`);

  if (katalog.uyarilar.length) {
    console.log(`\n${AMBER}UYARILAR (${katalog.uyarilar.length})${R}`);
    katalog.uyarilar.forEach((u) => console.log(`  ⚠ ${u}`));
  }
  console.log(`\n${SOLUK}yazıldı: ${yol}${R}`);
}

main().catch((e) => {
  console.error(`${KIRMIZI}${e instanceof Error ? e.message : e}${R}`);
  process.exit(1);
});
