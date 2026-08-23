/** Kaynakça künyelerini ham hâlde döker. */
import { readFileSync } from 'node:fs';
import { pdfOku } from '../src/lib/analiz/pdf';
import { belgeKur } from '../src/lib/analiz/yapi';
import { kaynakcayiCozumle } from '../src/lib/analiz/kaynakca';

async function main() {
  const okuma = await pdfOku(new Uint8Array(readFileSync(process.argv[2])));
  if (!okuma.tamam) return console.log('HATA:', okuma.hata);
  const k = kaynakcayiCozumle(belgeKur(okuma.belge));
  k.kaynaklar.forEach((x) => console.log(`[${x.numara}] ${x.ham}\n`));
}
main();
