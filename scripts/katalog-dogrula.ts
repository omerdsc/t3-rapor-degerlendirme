/**
 * Katalogdaki her şablonu indirip çözümlemeyi DENER.
 *
 * Amaç: "aktarılabilir" iddiasını sınamak. Katalog bir şablonun VAR olduğunu
 * söylüyor; bu betik o şablondan gerçekten rubrik çıkıp çıkmadığını söyler.
 * İkisi aynı şey değil — .doc biçimi, taranmış PDF, tabloya gömülü başlıklar
 * çözümlemeyi düşürebilir.
 *
 * Maliyet: $0. Yalnızca indirme ve yerel ayrıştırma.
 *
 *   npx tsx scripts/katalog-dogrula.ts          → şablonlu tüm yarışmalar
 *   npx tsx scripts/katalog-dogrula.ts roket-yarismasi
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { rubrikCikar, sablonCikar } from '../src/lib/analiz/sablon-cikar';
import { aktarimPlaniKur, belgeIndir } from '../src/lib/katalog/aktar';
import type { Katalog } from '../src/lib/katalog/tipler';

const KALIN = '\x1b[1m', R = '\x1b[0m', SOLUK = '\x1b[2m';
const YESIL = '\x1b[32m', AMBER = '\x1b[33m', KIRMIZI = '\x1b[31m';

interface Satir {
  yarisma: string;
  kategori: string;
  dosya: string;
  uzanti: string;
  durum: 'tamam' | 'zayif' | 'hata';
  toplamPuan?: number;
  kriterSayisi?: number;
  bolumSayisi?: number;
  neden?: string;
}

async function main() {
  const katalog = JSON.parse(
    readFileSync(join(process.cwd(), 'veri', 'katalog.json'), 'utf-8'),
  ) as Katalog;

  const secilen = process.argv.slice(2);
  const hedefler = katalog.yarismalar.filter(
    (y) => y.sablonVar && (!secilen.length || secilen.includes(y.slug)),
  );

  const satirlar: Satir[] = [];
  const yil = new Date().getFullYear();

  for (const y of hedefler) {
    const plan = aktarimPlaniKur(y, yil);
    console.log(`\n${KALIN}${y.ad}${R} ${SOLUK}${plan.kategoriler.length} kategori${R}`);

    for (const kat of plan.kategoriler) {
      const satir: Satir = {
        yarisma: y.ad,
        kategori: kat.ad,
        dosya: kat.sablon.dosyaAdi,
        uzanti: kat.sablon.uzanti,
        durum: 'hata',
      };

      try {
        const veri = await belgeIndir(kat.sablon);
        if (!(veri[0] === 0x50 && veri[1] === 0x4b)) {
          satir.neden = `.docx değil (.${kat.sablon.uzanti})`;
        } else {
          const cikarim = sablonCikar(veri, 'test', kat.ad, yil);
          const rubrik = rubrikCikar(cikarim);
          satir.toplamPuan = rubrik.toplamPuan;
          satir.kriterSayisi = rubrik.kriterler.length;
          satir.bolumSayisi = cikarim.sablon.basliklar.length;

          // "Tamam" ölçütü: puanlanabilir kriter çıkmış olması. Puan
          // toplamı 100 olmak zorunda değil — bazı şartnameler ağırlığı
          // teknik şartnameye bırakıyor.
          satir.durum = rubrik.kriterler.length >= 3 ? 'tamam' : 'zayif';
          if (satir.durum === 'zayif') {
            satir.neden = `yalnızca ${rubrik.kriterler.length} kriter çıktı`;
          }
        }
      } catch (e) {
        satir.neden = e instanceof Error ? e.message.slice(0, 70) : 'hata';
      }

      const isaret =
        satir.durum === 'tamam' ? `${YESIL}●${R}`
        : satir.durum === 'zayif' ? `${AMBER}○${R}`
        : `${KIRMIZI}✕${R}`;
      const bilgi =
        satir.durum === 'hata'
          ? `${KIRMIZI}${satir.neden}${R}`
          : `${satir.kriterSayisi} kriter · ${satir.toplamPuan} puan · ${satir.bolumSayisi} başlık` +
            (satir.neden ? ` ${AMBER}(${satir.neden})${R}` : '');
      console.log(`  ${isaret} ${kat.ad.slice(0, 44).padEnd(44)} ${SOLUK}${bilgi}${R}`);
      satirlar.push(satir);
    }

    for (const a of plan.atlanan) {
      console.log(`  ${SOLUK}· ${a.etiket.slice(0, 44).padEnd(44)} ${a.neden}${R}`);
    }
  }

  const t = satirlar.filter((s) => s.durum === 'tamam').length;
  const z = satirlar.filter((s) => s.durum === 'zayif').length;
  const h = satirlar.filter((s) => s.durum === 'hata').length;

  console.log(`\n${KALIN}SONUÇ${R}`);
  console.log(`  ${YESIL}●${R} rubrik çıktı        ${t}`);
  console.log(`  ${AMBER}○${R} zayıf (az kriter)   ${z}`);
  console.log(`  ${KIRMIZI}✕${R} çözümlenemedi       ${h}`);
  console.log(`  ${SOLUK}toplam ${satirlar.length} kategori / ${hedefler.length} yarışma${R}`);

  if (h) {
    console.log(`\n${KIRMIZI}ÇÖZÜMLENEMEYENLER${R}`);
    for (const s of satirlar.filter((x) => x.durum === 'hata')) {
      console.log(`  ${s.yarisma.slice(0, 40).padEnd(40)} ${s.kategori.slice(0, 26).padEnd(26)} ${s.neden}`);
    }
  }

  const yol = join(process.cwd(), 'veri', 'katalog-dogrulama.json');
  writeFileSync(yol, JSON.stringify(satirlar, null, 2), 'utf-8');
  console.log(`\n${SOLUK}ayrıntı: ${yol}${R}`);
}

main().catch((e) => {
  console.error(`${KIRMIZI}${e instanceof Error ? e.message : e}${R}`);
  process.exit(1);
});
