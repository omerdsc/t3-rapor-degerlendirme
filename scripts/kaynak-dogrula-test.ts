/** Kaynakçayı çıkarır ve doğrular. Varsayılan ağsız; --ag ile indeks sorgusu yapar. */
import { readFileSync } from 'node:fs';
import { pdfOku } from '../src/lib/analiz/pdf';
import { belgeKur } from '../src/lib/analiz/yapi';
import { kaynakcayiCozumle } from '../src/lib/analiz/kaynakca';
import { kaynaklariDogrula, type Dogrulama } from '../src/lib/analiz/kaynak-dogrula';

const R = '\x1b[0m', KALIN = '\x1b[1m', SOLUK = '\x1b[2m';
const ROZET: Record<Dogrulama, string> = {
  dogrulandi:    '\x1b[32m DOĞRULANDI \x1b[0m',
  kismen:        '\x1b[33m   KISMEN   \x1b[0m',
  bulunamadi:    '\x1b[31m BULUNAMADI \x1b[0m',
  indekslenemez: '\x1b[36m İNDEKS DIŞI\x1b[0m',
  atlandi:       '\x1b[2m   ATLANDI  \x1b[0m',
};

async function main() {
  const yol = process.argv[2];
  const agKullan = process.argv.includes('--ag');

  const okuma = await pdfOku(new Uint8Array(readFileSync(yol)));
  if (!okuma.tamam) return console.log('HATA:', okuma.hata);
  const belge = belgeKur(okuma.belge);
  const k = kaynakcayiCozumle(belge);

  console.log(`${KALIN}${k.kaynaklar.length} kaynak · ağ sorgusu: ${agKullan ? 'AÇIK' : 'kapalı'}${R}\n`);

  const ozet = await kaynaklariDogrula(k.kaynaklar, {
    agKullan,
    iletisim: 'creathon55takim@turkiyeteknolojitakimi.org',
  });

  for (const x of ozet.kayitlar) {
    console.log(`${ROZET[x.sonuc]} [${String(x.numara ?? '?').padStart(2)}] ${SOLUK}${(x.baslik ?? '— başlık ayrıştırılamadı —').slice(0, 68)}${R}`);
    if (x.eslesme) {
      console.log(`             ${SOLUK}↳ ${x.eslesme.indeks}: "${x.eslesme.baslik.slice(0, 60)}" ${x.eslesme.yil ?? ''} ${x.eslesme.doi ?? ''}${R}`);
    }
    x.bayraklar.forEach((b) => console.log(`             \x1b[33m⚠${R} ${b}`));
  }

  console.log(`\n${KALIN}ÖZET${R}`);
  console.log(`  doğrulandı: ${ozet.dogrulanan} · kısmen: ${ozet.kismen} · bulunamadı: ${ozet.bulunamayan} · indeks dışı: ${ozet.indekslenemez}`);
  if (ozet.genelBayraklar.length) {
    console.log(`\n${KALIN}KAYNAKÇANIN BÜTÜNÜNE DAİR${R}`);
    ozet.genelBayraklar.forEach((b) => console.log(`  \x1b[33m⚠${R} ${b}`));
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
