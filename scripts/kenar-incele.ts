/** Sayfa kenarlarındaki satırları döker — header/footer tespitini kalibre etmek için. */
import { readFileSync } from 'node:fs';
import { pdfOku } from '../src/lib/analiz/pdf';
import { satirlariKur } from '../src/lib/analiz/yapi';

async function main() {
  const okuma = await pdfOku(new Uint8Array(readFileSync(process.argv[2])));
  if (!okuma.tamam) return console.log('HATA:', okuma.hata);

  for (const sayfa of okuma.belge.sayfalar.slice(0, 4)) {
    const satirlar = satirlariKur(sayfa);
    if (!satirlar.length) continue;
    const ust = Math.max(...satirlar.map((s) => s.y));
    const alt = Math.min(...satirlar.map((s) => s.y));
    console.log(`\n── sayfa ${sayfa.no} · yükseklik ${sayfa.yukseklik.toFixed(0)} · içerik y: ${alt.toFixed(0)}–${ust.toFixed(0)} · ${satirlar.length} satır`);
    console.log('   ÜST 3:');
    satirlar.slice(0, 3).forEach((s) => console.log(`     y=${s.y.toFixed(0)} oran=${((ust - s.y) / (ust - alt || 1)).toFixed(3)}  "${s.metin.slice(0, 60)}"`));
    console.log('   ALT 3:');
    satirlar.slice(-3).forEach((s) => console.log(`     y=${s.y.toFixed(0)} oran=${((ust - s.y) / (ust - alt || 1)).toFixed(3)}  "${s.metin.slice(0, 60)}"`));
  }
}
main();
