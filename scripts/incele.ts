/** Tek bir PDF'in ayrıştırma sonucunu ham hâlde döker — motor kalibrasyonu için. */
import { readFileSync } from 'node:fs';
import { pdfOku } from '../src/lib/analiz/pdf';
import { belgeKur } from '../src/lib/analiz/yapi';
import { kaynakcayiCozumle } from '../src/lib/analiz/kaynakca';
import { diliTespitEt } from '../src/lib/analiz/dil';
import { bozulmaOrani } from '../src/lib/analiz/normalize';

async function main() {
  const yol = process.argv[2];
  const okuma = await pdfOku(new Uint8Array(readFileSync(yol)));
  if (!okuma.tamam) { console.log('HATA:', okuma.hata); return; }
  const b = belgeKur(okuma.belge);

  console.log('═══ İSTATİSTİK ═══');
  console.log(` ${b.sayfaSayisi} sayfa · ${b.kelimeSayisi} kelime · ${b.gorselSayisi} görsel`);
  console.log(` taranmış: ${b.taranmisMi} · metin bozulma: ${bozulmaOrani(b.metin).toFixed(2)}`);
  console.log(` dil: ${JSON.stringify(diliTespitEt(b.metin))}`);

  console.log('\n═══ ELENEN YİNELENEN SATIRLAR (header/footer) ═══');
  b.yinelenenSatirlar.slice(0, 8).forEach((s) => console.log('  ·', s.slice(0, 90)));

  console.log(`\n═══ TESPİT EDİLEN BAŞLIKLAR (${b.basliklar.length}) ═══`);
  b.bolumler.forEach((x) =>
    console.log(`  s.${String(x.baslik.sayfa).padStart(2)} [${(x.baslik.numara ?? '-').padStart(5)}] ${x.baslik.sade.slice(0, 60).padEnd(62)} ${x.kelimeSayisi} kl`),
  );

  const k = kaynakcayiCozumle(b);
  console.log('\n═══ KAYNAKÇA ═══');
  console.log(` bölüm: ${k.bolumBaslik ?? 'YOK'} (s.${k.sayfa})`);
  console.log(` ${k.kaynaklar.length} kaynak · ${k.atiflar.length} atıf`);
  k.kaynaklar.slice(0, 14).forEach((x) =>
    console.log(`  [${x.numara ?? '?'}] yıl:${x.yil ?? '----'} doi:${x.doiVarMi ? 'E' : 'H'} url:${x.baglantiVarMi ? 'E' : 'H'}  ${x.ham.slice(0, 74)}`),
  );
  console.log(' karşılıksız atıflar:', k.karsiliksizAtiflar);
  console.log(' atıfsız kaynaklar:', k.atifsizKaynaklar);
}
main().catch((e) => { console.error(e); process.exit(1); });
