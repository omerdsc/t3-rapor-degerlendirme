/** Şartname AI özetini üretir. Kurulumda BİR KEZ çalışacak çağrının testi. */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pdfOku } from '../src/lib/analiz/pdf';
import { belgeKur } from '../src/lib/analiz/yapi';
import { sartnameCozumle } from '../src/lib/analiz/sartname';
import { sartnameOzetle } from '../src/lib/ai/sartname-ozeti';
import { ClaudeIstemcisi } from '../src/lib/ai/istemci';

const KALIN = '\x1b[1m', R = '\x1b[0m', SOLUK = '\x1b[2m', KIRMIZI = '\x1b[31m';

function ortamYukle() {
  if (!existsSync('.env.local')) return;
  for (const s of readFileSync('.env.local', 'utf-8').split('\n')) {
    const m = s.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m && m[2].trim() && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

async function main() {
  ortamYukle();
  const [yol, ad] = [process.argv[2], process.argv[3] ?? 'Yarışma'];

  const okuma = await pdfOku(new Uint8Array(readFileSync(yol)));
  if (!okuma.tamam) return console.log('HATA:', okuma.hata);
  const c = sartnameCozumle(belgeKur(okuma.belge));

  console.log(`${SOLUK}${c.sayfaSayisi} sayfa · ${c.kelimeSayisi} kelime · özetleniyor…${R}\n`);

  const istemci = new ClaudeIstemcisi({
    toplamTavan: Number(process.env.TOPLAM_TAVAN ?? 8),
    diskOnbellegi: join(process.cwd(), '.onbellek'),
  });
  const { ozet, kullanim } = await sartnameOzetle(c.metin, ad, { istemci });
  if (!ozet) return console.log(`${KIRMIZI}Özet üretilemedi.${R}`);

  const yaz = (baslik: string, liste: string[]) => {
    if (!liste.length) return;
    console.log(`${KALIN}${baslik}${R}`);
    liste.forEach((x) => console.log(`  · ${x}`));
    console.log();
  };

  // Alan adlarindan baslik uretiliyor: sema degisince betik kirilmasin.
  const BASLIK: Record<string, string> = {
    yarismaninAmaci: 'YARIŞMANIN AMACI',
    teknikBeklentiler: 'TEKNİK BEKLENTİLER',
    katiKisitlar: 'KATI KISITLAR — UYULMAZSA TASARIM GEÇERSİZ',
    eleyiciDurumlar: 'ELEYİCİ DURUMLAR',
    hakemNotlari: 'HAKEM NOTLARI',
  };
  for (const [alan, liste] of Object.entries(ozet)) {
    if (Array.isArray(liste)) yaz(BASLIK[alan] ?? alan.toLocaleUpperCase('tr'), liste as string[]);
  }

  console.log(`${SOLUK}maliyet $${kullanim.maliyet.toFixed(4)} ${kullanim.onbellektenMi ? '(önbellekten)' : '(tek seferlik)'}${R}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
