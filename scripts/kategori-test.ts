/** Gerçek şartname profilleriyle içerik uygunluğu sınaması. */
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { pdfOku } from '../src/lib/analiz/pdf';
import { belgeKur } from '../src/lib/analiz/yapi';
import { kategoriKontrolu } from '../src/lib/analiz/kategori';
import { kategoriKumesi } from '../src/lib/analiz/terim-depo';

async function main() {
  const kategoriler = kategoriKumesi();
  console.log(`karşılaştırma kümesi: ${kategoriler.length} profil\n`);

  for (const yol of process.argv.slice(2)) {
    const o = await pdfOku(new Uint8Array(readFileSync(yol)));
    if (!o.tamam) { console.log('HATA', o.hata); continue; }
    const k = kategoriKontrolu(belgeKur(o.belge), kategoriler);
    console.log(`${basename(yol).slice(0, 40)}`);
    console.log(`  durum: ${k.durum} · ${k.ozet}`);
    const v = k.veri as { siralama?: Array<{ ad: string; oran: number }> } | undefined;
    for (const s of (v?.siralama ?? []).slice(0, 4)) {
      console.log(`    %${(s.oran * 100).toFixed(0).padStart(3)}  ${s.ad.slice(0, 58)}`);
    }
    console.log();
  }
}
main();
