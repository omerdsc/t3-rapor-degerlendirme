/**
 * Korpus geneli benzerlik taraması (MVP 5).
 *
 * Tek rapor analizinden farkı: benzerlik doğası gereği çiftler arasıdır.
 * Tüm raporların parmak izi çıkarılır, kategori bazlı doğal benzerlik tabanı
 * hesaplanır, tabanın belirgin üstündeki çiftler işaretlenir.
 *
 *   npx tsx scripts/korpus-tara.ts
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pdfOku } from '../src/lib/analiz/pdf';
import { belgeKur } from '../src/lib/analiz/yapi';
import { korpusTara, parmakiziCikar, type Parmakizi } from '../src/lib/analiz/benzerlik';
import { GUNCEL_SABLON } from '../src/lib/analiz/sablonlar';

const R = '\x1b[0m';
const KALIN = '\x1b[1m';
const SOLUK = '\x1b[2m';
const KIRMIZI = '\x1b[31m';
const SARI = '\x1b[33m';
const MAVI = '\x1b[36m';
const YESIL = '\x1b[32m';

interface ManifestKaydi {
  dosya: string;
  takim: string;
  takimId: string;
  proje: string;
  kategori: string;
  yil: number;
}

async function main() {
  const klasor = join(process.cwd(), 'test-verisi', 'korpus');
  const manifestYolu = join(klasor, 'manifest.json');

  const manifest: ManifestKaydi[] = existsSync(manifestYolu)
    ? JSON.parse(readFileSync(manifestYolu, 'utf-8'))
    : [];
  const meta = new Map(manifest.map((m) => [m.dosya, m]));

  const dosyalar = readdirSync(klasor).filter((d) => d.toLowerCase().endsWith('.pdf'));
  const parmakizleri: Parmakizi[] = [];

  console.log(`${KALIN}Parmak izi çıkarılıyor${R}\n`);
  const baslangic = Date.now();

  for (const dosya of dosyalar) {
    const veri = new Uint8Array(readFileSync(join(klasor, dosya)));
    const okuma = await pdfOku(veri);
    if (!okuma.tamam) {
      console.log(`  ${KIRMIZI}✕${R} ${dosya.padEnd(28)} ${okuma.hata}`);
      continue;
    }
    const belge = belgeKur(okuma.belge);
    const m = meta.get(dosya);

    const izi = parmakiziCikar(
      belge,
      {
        raporId: dosya.replace('.pdf', ''),
        takimId: m?.takimId,
        kategoriKodu: m?.kategori,
        yil: m?.yil,
      },
      GUNCEL_SABLON,
    );
    parmakizleri.push(izi);

    console.log(
      `  ${YESIL}✓${R} ${dosya.padEnd(28)} ${SOLUK}${izi.cumleler.length} cümle · ` +
        `${izi.shingleSayisi} shingle · ${izi.gorseller.length} görsel · ` +
        `${m?.kategori ?? '—'}${R}`,
    );
  }

  const korpus = korpusTara(parmakizleri);
  const sure = Date.now() - baslangic;

  console.log(`\n${KALIN}Kategori tabanları${R}  ${SOLUK}(aynı alandaki raporlar doğal olarak benzer)${R}\n`);
  for (const [kod, t] of Object.entries(korpus.tabanlar)) {
    console.log(
      `  ${kod.padEnd(12)} taban %${(t.taban * 100).toFixed(1).padStart(5)} → ` +
        `eşik %${(t.esik * 100).toFixed(1).padStart(5)}  ${SOLUK}${t.ciftSayisi} çift${R}`,
    );
  }

  console.log(
    `\n${KALIN}İşaretlenen çiftler${R}  ${SOLUK}${korpus.toplamCift} çiftten ` +
      `${korpus.isaretliler.length} tanesi${R}\n`,
  );

  if (!korpus.isaretliler.length) {
    console.log(`  ${SOLUK}— temiz —${R}`);
  }

  for (const c of korpus.isaretliler) {
    const etiket = c.ayniTakim
      ? `${MAVI}DEVAM PROJESİ${R}`
      : c.gorselEslesmeleri.length
        ? `${KIRMIZI}GÖRSEL KOPYA${R}`
        : `${SARI}METİN ÖRTÜŞMESİ${R}`;

    console.log(`${KALIN}${c.aId}  ↔  ${c.bId}${R}   ${etiket}`);
    console.log(
      `  kapsama %${(c.kapsama * 100).toFixed(1)} · jaccard %${(c.metinOrani * 100).toFixed(1)} · ` +
        `görsel %${(c.gorselOrani * 100).toFixed(1)} · ` +
        `${c.cumleEslesmeleri.length} cümle eşleşmesi`,
    );

    for (const g of c.gorselEslesmeleri.slice(0, 2)) {
      console.log(
        `    ${KIRMIZI}▸${R} görsel: s.${g.a.sayfa}/#${g.a.sira} ↔ s.${g.b.sayfa}/#${g.b.sira} ` +
          `— %${(g.oran * 100).toFixed(0)} ${SOLUK}(hamming ${g.hammingMesafesi}/64)${R}`,
      );
    }
    for (const e of c.cumleEslesmeleri.slice(0, 2)) {
      console.log(`    ${SARI}▸${R} %${(e.oran * 100).toFixed(0)} ${SOLUK}"${e.a.metin.slice(0, 88)}…"${R}`);
    }
    console.log();
  }

  console.log(
    `${SOLUK}${parmakizleri.length} rapor · ${korpus.toplamCift} çift · ${sure} ms · $0 API maliyeti${R}\n`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
