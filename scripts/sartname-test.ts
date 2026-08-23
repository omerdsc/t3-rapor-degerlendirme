/** Şartnameden deterministik çıkarımı gösterir. Model çağrısı yok, $0. */
import { readFileSync } from 'node:fs';
import { pdfOku } from '../src/lib/analiz/pdf';
import { belgeKur } from '../src/lib/analiz/yapi';
import { sartnameCozumle } from '../src/lib/analiz/sartname';

const KALIN = '\x1b[1m', R = '\x1b[0m', SOLUK = '\x1b[2m', SARI = '\x1b[33m', KIRMIZI = '\x1b[31m';

async function main() {
  for (const yol of process.argv.slice(2)) {
    const okuma = await pdfOku(new Uint8Array(readFileSync(yol)));
    if (!okuma.tamam) { console.log('HATA:', okuma.hata); continue; }
    const c = sartnameCozumle(belgeKur(okuma.belge));
    const k = c.kurallar;

    console.log(`\n${KALIN}${'═'.repeat(74)}\n${yol.split(/[\/]/).pop()}${R}`);
    console.log(`${SOLUK}${c.sayfaSayisi} sayfa · ${c.kelimeSayisi} kelime${R}\n`);

    console.log(`${KALIN}SAYFA${R}      ${k.asgariSayfa ?? '—'} – ${k.azamiSayfa ?? '—'}`);
    console.log(`${KALIN}AZAMİ ÜYE${R}  ${k.azamiUye ?? '—'}${k.danismanZorunlu ? ' · danışman zorunlu' : ''}`);

    console.log(`\n${KALIN}AŞAMALAR (${k.asamalar.length})${R}`);
    k.asamalar.forEach((a: string) => console.log(`  · ${a}`));


    console.log(`\n${KALIN}TARİHLER (${k.tarihler.length})${R}`);
    k.tarihler.forEach((t: { etiket: string; tarih: string }) => console.log(`  ${t.tarih}  ${t.etiket}`));

    console.log(`\n${KALIN}${KIRMIZI}ELEYİCİ HÜKÜMLER (${k.eleyiciHukumler.length})${R}`);
    k.eleyiciHukumler.forEach((h: string) => console.log(`  ${KIRMIZI}▸${R} ${h.slice(0, 130)}`));

    if (c.uyarilar.length) {
      console.log(`\n${SARI}UYARILAR${R}`);
      c.uyarilar.forEach((u: string) => console.log(`  ⚠ ${u}`));
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
