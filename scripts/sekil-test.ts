/** Rapordan çıkarılan şekilleri listeler ve token maliyetini tahmin eder. */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pdfOku } from '../src/lib/analiz/pdf';
import { belgeKur } from '../src/lib/analiz/yapi';
import { sekilleriCikar, sekilliBolumler } from '../src/lib/analiz/gorsel';

async function main() {
  const yol = process.argv[2];
  const veri = new Uint8Array(readFileSync(yol));
  const okuma = await pdfOku(veri);
  if (!okuma.tamam) return console.log('HATA:', okuma.hata);
  const belge = belgeKur(okuma.belge);

  console.log(`ham gömülü görsel sayısı: ${belge.gorselSayisi}`);
  console.log(`şekilli bölümler: ${[...sekilliBolumler(belge)].join(' · ') || '—'}\n`);

  const sekiller = await sekilleriCikar(new Uint8Array(readFileSync(yol)), belge);
  console.log(`MODELE GÖNDERİLECEK ŞEKİL: ${sekiller.length}\n`);

  const cikti = join(process.cwd(), 'test-verisi', 'sekiller');
  mkdirSync(cikti, { recursive: true });

  let toplamToken = 0;
  for (const s of sekiller) {
    // Claude görsel token tahmini: (en × boy) / 750
    const token = Math.round((s.en * s.boy) / 750);
    toplamToken += token;
    const dosya = `s${s.sayfa}-${s.sira}.png`;
    writeFileSync(join(cikti, dosya), Buffer.from(s.png, 'base64'));
    console.log(`  s.${String(s.sayfa).padStart(2)} · ${s.en}×${s.boy} · ~${token} token`);
    console.log(`      bölüm  : ${s.bolum ?? '—'}`);
    console.log(`      altyazı: ${s.altYazi ?? '—'}`);
    console.log(`      kaydedildi: test-verisi/sekiller/${dosya}\n`);
  }
  console.log(`toplam ~${toplamToken} görsel token · ek maliyet ~$${((toplamToken * 5) / 1e6).toFixed(4)}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
