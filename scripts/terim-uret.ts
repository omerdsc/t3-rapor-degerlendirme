/**
 * Her yarışmanın terim profilini kendi şartnamesinden çıkarır ve kaydeder.
 *
 * Elle yazılmış `kategoriler.ts` listelerinin yerini alıyor: kaynak artık
 * gerçek şartnameler. Maliyet $0 — indirme ve frekans sayımı.
 *
 *   npx tsx scripts/terim-uret.ts          → şartnamesi olan tüm yarışmalar
 *   npx tsx scripts/terim-uret.ts <slug>   → tek yarışma
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bicimTespitEt, docxOku } from '../src/lib/analiz/belge-docx';
import { pdfOku } from '../src/lib/analiz/pdf';
import { belgeKur } from '../src/lib/analiz/yapi';
import { profilCikar } from '../src/lib/analiz/terim-cikar';
import { yarismalariListele } from '../src/lib/depo/depo';
import { ozetiMetneCevir } from '../src/lib/ai/sartname-ozeti';

const KALIN = '\x1b[1m', R = '\x1b[0m', SOLUK = '\x1b[2m';
const YESIL = '\x1b[32m', AMBER = '\x1b[33m';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

interface Profil {
  yarismaId: string;
  yarismaAdi: string;
  kategoriId: string;
  kategoriAdi: string;
  kaynak: string;
  terimler: string[];
}

async function metniAl(url: string): Promise<string> {
  const yanit = await fetch(url, { headers: { 'user-agent': UA } });
  if (!yanit.ok) throw new Error(`kaynak ${yanit.status}`);
  const veri = new Uint8Array(await yanit.arrayBuffer());
  const bicim = bicimTespitEt(veri);

  if (bicim === 'docx') {
    const o = docxOku(veri);
    if (!o.tamam) throw new Error(o.hata);
    return o.belge.metin;
  }
  if (bicim === 'pdf') {
    const o = await pdfOku(veri);
    if (!o.tamam) throw new Error(o.hata);
    return belgeKur(o.belge).metin;
  }
  throw new Error('biçim tanınmadı');
}

async function main() {
  const secilen = process.argv.slice(2);
  const profiller: Profil[] = [];
  const atlanan: string[] = [];
  // Aynı şartname birden çok kategoride kullanılıyor; iki kez indirilmesin.
  const onbellek = new Map<string, string>();

  for (const y of yarismalariListele()) {
    if (secilen.length && !secilen.includes(y.katalogSlug ?? '')) continue;

    for (const k of y.kategoriler) {
      const s = k.sartname;
      if (!s?.kaynakUrl) {
        atlanan.push(`${y.ad} · ${k.ad}: şartname kaynağı yok`);
        continue;
      }

      try {
        let metin = onbellek.get(s.kaynakUrl);
        if (metin === undefined) {
          metin = await metniAl(s.kaynakUrl);
          onbellek.set(s.kaynakUrl, metin);
        }

        const terimler = profilCikar(metin, ozetiMetneCevir(s.ozet));
        if (terimler.length < 10) {
          atlanan.push(`${y.ad} · ${k.ad}: yalnızca ${terimler.length} terim çıktı`);
          continue;
        }

        profiller.push({
          yarismaId: y.id,
          yarismaAdi: y.ad,
          kategoriId: k.id,
          kategoriAdi: k.ad,
          kaynak: s.dosyaAdi,
          terimler,
        });
        console.log(
          `${YESIL}●${R} ${`${y.ad} · ${k.ad}`.slice(0, 56).padEnd(56)} ` +
            `${SOLUK}${terimler.length} terim · ${terimler.slice(0, 6).join(', ')}…${R}`,
        );
      } catch (e) {
        atlanan.push(`${y.ad} · ${k.ad}: ${e instanceof Error ? e.message : 'hata'}`);
      }
    }
  }

  const yol = join(process.cwd(), 'veri', 'terim-profilleri.json');
  writeFileSync(yol, JSON.stringify(profiller, null, 2), 'utf-8');

  console.log(`\n${KALIN}SONUÇ${R}`);
  console.log(`  profil çıkarılan  ${profiller.length}`);
  console.log(`  atlanan           ${atlanan.length}`);
  console.log(`  farklı şartname   ${onbellek.size}`);

  if (atlanan.length) {
    console.log(`\n${AMBER}ATLANANLAR${R}`);
    for (const a of atlanan.slice(0, 12)) console.log(`  ⚠ ${a}`);
    if (atlanan.length > 12) console.log(`  … +${atlanan.length - 12}`);
  }
  console.log(`\n${SOLUK}yazıldı: ${yol}${R}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
