/** Şartname metninde belirli kalıpları arar — desen kalibrasyonu için. */
import { readFileSync } from 'node:fs';
import { pdfOku } from '../src/lib/analiz/pdf';
import { belgeKur } from '../src/lib/analiz/yapi';

async function main() {
  const okuma = await pdfOku(new Uint8Array(readFileSync(process.argv[2])));
  if (!okuma.tamam) return console.log('HATA:', okuma.hata);
  const belge = belgeKur(okuma.belge);

  console.log('=== BAŞLIKLAR ===');
  belge.bolumler.forEach((b) => console.log(`  s.${b.baslik.sayfa} [${b.baslik.numara ?? '-'}] ${b.baslik.sade.slice(0,60)} (${b.kelimeSayisi} kl)`));

  const desenler: Array<[string, RegExp]> = [
    ['TARİH satırları', /^.{0,60}(\d{1,2}[.\/ ][A-Za-zÇĞİÖŞÜçğıöşü]{3,10}[.\/ ]\d{4}|\d{2}[.\/]\d{2}[.\/]\d{4}).{0,60}$/gmi],
    ['KATEGORİ geçen satırlar', /^.{0,90}kategori.{0,90}$/gmi],
    ['SAYFA geçen satırlar', /^.{0,80}sayfa.{0,80}$/gmi],
    ['TAKVİM/TARİH başlığı', /^.{0,60}(takvim|tarihler|önemli tarih).{0,60}$/gmi],
  ];

  for (const [ad, d] of desenler) {
    const bulunan = [...belge.metin.matchAll(d)].map((m) => m[0].trim()).slice(0, 12);
    console.log(`\n=== ${ad} (${bulunan.length}) ===`);
    bulunan.forEach((b) => console.log('  ·', b.slice(0, 120)));
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
