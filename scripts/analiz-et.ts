/**
 * Analiz motorunu komut satırından çalıştırır.
 *
 *   npx tsx scripts/analiz-et.ts                      → test-verisi/raporlar/*
 *   npx tsx scripts/analiz-et.ts yol/rapor.pdf        → tek dosya
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { raporuAnalizEt } from '../src/lib/analiz';
import type { AnalizSonucu } from '../src/lib/analiz';
import type { Seviye } from '../src/lib/analiz/tipler';

const R = '\x1b[0m';
const KALIN = '\x1b[1m';
const SOLUK = '\x1b[2m';

const ROZET: Record<Seviye, string> = {
  temiz: '\x1b[32m  OK  \x1b[0m',
  bilgi: '\x1b[36m BİLGİ\x1b[0m',
  uyari: '\x1b[33m UYARI\x1b[0m',
  hata: '\x1b[31m HATA \x1b[0m',
};

function yazdir(ad: string, s: AnalizSonucu) {
  console.log(`\n${KALIN}${'─'.repeat(78)}${R}`);
  console.log(`${KALIN}${ad}${R}  ${ROZET[s.genelDurum]}`);

  if (!s.basarili) {
    console.log(`  \x1b[31m${s.hata}${R}`);
    return;
  }

  const i = s.istatistik;
  console.log(
    `${SOLUK}  ${i.sayfaSayisi} sayfa · ${i.kelimeSayisi} kelime · ${i.baslikSayisi} başlık · ` +
      `${i.gorselSayisi} görsel · ${i.yinelenenSatirSayisi} yinelenen satır elendi · ${i.sureMs} ms${R}`,
  );

  for (const k of s.kontroller) {
    console.log(`\n  ${ROZET[k.durum]} ${KALIN}${k.ad.padEnd(12)}${R} ${SOLUK}${k.ozet}${R}`);
    for (const b of k.bulgular) {
      const renk = b.seviye === 'hata' ? '\x1b[31m' : b.seviye === 'uyari' ? '\x1b[33m' : '\x1b[36m';
      const sayfa = b.sayfa ? ` ${SOLUK}(s.${b.sayfa})${R}` : '';
      console.log(`         ${renk}▸${R} ${b.baslik}${sayfa}  ${SOLUK}${b.kod}${R}`);
      console.log(`           ${SOLUK}${b.aciklama}${R}`);
      if (b.kanit) console.log(`           ${SOLUK}kanıt: "${b.kanit.slice(0, 90).replace(/\n/g, ' ')}…"${R}`);
    }
  }
}

async function main() {
  const arg = process.argv[2];
  const hedef = arg ? resolve(arg) : join(process.cwd(), 'test-verisi', 'raporlar');

  const dosyalar = statSync(hedef).isDirectory()
    ? readdirSync(hedef).filter((d) => d.toLowerCase().endsWith('.pdf')).map((d) => join(hedef, d))
    : [hedef];

  if (!dosyalar.length) {
    console.log('PDF bulunamadı. Önce: npx tsx scripts/ornek-rapor-uret.ts');
    return;
  }

  const ozet: Array<{ ad: string; durum: Seviye; kodlar: string[]; ms: number }> = [];

  for (const yol of dosyalar) {
    const veri = new Uint8Array(readFileSync(yol));
    const ad = yol.split(/[\\/]/).pop()!;
    const sonuc = await raporuAnalizEt(veri);
    yazdir(ad, sonuc);
    ozet.push({
      ad,
      durum: sonuc.genelDurum,
      kodlar: sonuc.kontroller.flatMap((k) => k.bulgular.map((b) => b.kod)),
      ms: sonuc.istatistik.sureMs,
    });
  }

  console.log(`\n${KALIN}${'═'.repeat(78)}\nÖZET${R}\n`);
  for (const o of ozet) {
    console.log(`  ${ROZET[o.durum]} ${o.ad.padEnd(30)} ${SOLUK}${o.ms}ms${R}  ${o.kodlar.join(', ') || '—'}`);
  }
  const toplamMs = ozet.reduce((t, o) => t + o.ms, 0);
  console.log(`\n  ${ozet.length} rapor · ${toplamMs} ms · ortalama ${Math.round(toplamMs / ozet.length)} ms/rapor · $0 API maliyeti\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
