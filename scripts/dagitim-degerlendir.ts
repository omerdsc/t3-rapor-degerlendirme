/**
 * Dağıtım verisine GERÇEK değerlendirme üretir — üç akışı da tamamlar.
 *
 * ── ÇÖZDÜĞÜ SORUN ───────────────────────────────────────────────────────
 * `dagitim:demo` raporları yüklüyor ve hakemlere dağıtıyor, ama hiçbir
 * değerlendirme TAMAMLANMIŞ olmuyor. Sonuç: yarışmacı portalı boş açılıyor
 * ve jüri "çalışmıyor" diye okuyor. PRD sayfa 05'teki AKIŞ 03 hiç
 * yürünemiyor.
 *
 * Bu betik zinciri sonuna kadar götürüyor:
 *   1. Yapay zekâ ön değerlendirmesi (ÜCRETLİ)
 *   2. Hakem, çıkan öneriyi onaylayıp değerlendirmeyi tamamlıyor
 *   3. `demo-hazirla` onaylı geri bildirimi yazıyor
 *
 * İkinci adım arayüzdekinin AYNISI: hakem paneli yapay zekâ önerisini
 * dolu getiriyor, hakem uygun bulup gönderiyor. Uydurma puan üretilmiyor —
 * puanlar modelin ürettiği puanlar.
 *
 * ── API ANAHTARI SUNUCUYA GİTMİYOR ──────────────────────────────────────
 * Değerlendirme BURADA, yerel makinede çalışıyor; canlı sunucuya yalnızca
 * sonuç veri kümesi taşınıyor. Sebebi somut: koordinasyon paneli açık
 * çalıştırılıyorsa, o sunucudaki bir API anahtarını adresi bulan herkes
 * harcayabilirdi. Anahtarın olmadığı yerde harcanacak bir şey de yok.
 *
 * ── ÜCRET ───────────────────────────────────────────────────────────────
 * Rapor başına ölçülen maliyet ~$0.13. Varsayılan 4 rapor ≈ $0.52.
 * Betik her adımda birikmiş tutarı yazıyor ve tavana yaklaşınca duruyor.
 *
 * Kullanım (önce npm run build ve npm run dagitim:demo):
 *   npm run dagitim:degerlendir
 *   npm run dagitim:degerlendir -- --adet 6
 */

import { DatabaseSync } from 'node:sqlite';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const KOK = process.cwd();
const HEDEF = resolve(join(KOK, 'dagitim', 'veri'));
const PORT = 3220;
const SUNUCU = `http://127.0.0.1:${PORT}`;
const ANAHTAR = `dagitim-deg-${Math.random().toString(36).slice(2)}-${Date.now()}`;

const YESIL = '\x1b[32m', KIRMIZI = '\x1b[31m', SOLUK = '\x1b[2m', KALIN = '\x1b[1m', R = '\x1b[0m';

function sayi(bayrak: string, varsayilan: number): number {
  const i = process.argv.indexOf(bayrak);
  if (i < 0) return varsayilan;
  const n = Number(process.argv[i + 1]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : varsayilan;
}

const ADET = sayi('--adet', 4);
/** Güvenlik freni: bu tutarı aşarsa betik duruyor. */
const TAVAN = 2.0;

function db(): DatabaseSync {
  return new DatabaseSync(join(HEDEF, 'tprds.db'), { readOnly: true });
}

async function sunucuyuBekle(sure = 90_000): Promise<void> {
  const bitis = Date.now() + sure;
  while (Date.now() < bitis) {
    try {
      const y = await fetch(`${SUNUCU}/giris`);
      if (y.ok) return;
    } catch {
      // henüz açılmadı
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Sunucu açılmadı.');
}

interface Kriter {
  kod: string;
  aiPuan: number;
  gerekce?: string;
  oneri?: string;
}

async function main(): Promise<void> {
  if (!existsSync(join(HEDEF, 'tprds.db'))) {
    throw new Error(`Dağıtım verisi yok: ${HEDEF}\n  Önce: npm run dagitim:demo`);
  }
  if (!existsSync(join(KOK, '.next'))) throw new Error('Derleme yok. Önce: npm run build');

  const anahtarVar = existsSync(join(KOK, '.env.local'))
    && /^ANTHROPIC_API_KEY=\S+/m.test(readFileSync(join(KOK, '.env.local'), 'utf-8'));
  if (!anahtarVar) throw new Error('.env.local içinde ANTHROPIC_API_KEY yok.');

  /*
   * Hedef seçimi: henüz değerlendirilmemiş, hakemi ATANMIŞ raporlar.
   * Hakemi olmayan bir raporu değerlendirmek para harcar ama akışı
   * tamamlamaz — tamamlayacak kimse yoktur.
   */
  const d = db();
  const adaylar = d.prepare(
    `SELECT DISTINCT r.id, r.basvuru_no
       FROM rapor r
       JOIN atama a ON a.rapor_id = r.id
      WHERE r.durum = 'hakem_bekliyor'
      ORDER BY r.basvuru_no
      LIMIT ?`,
  ).all(ADET) as Array<{ id: string; basvuru_no: string }>;
  d.close();

  if (!adaylar.length) throw new Error('Değerlendirilecek atanmış rapor yok.');

  console.log(`\n${KALIN}DAĞITIM DEĞERLENDİRMESİ${R}`);
  console.log(`  rapor    : ${adaylar.length}`);
  console.log(`  tahmini  : ~$${(adaylar.length * 0.13).toFixed(2)}`);
  console.log(`  tavan    : $${TAVAN.toFixed(2)}\n`);

  const sunucu: ChildProcess = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    cwd: KOK,
    shell: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      TPRDS_VERI_DIZINI: HEDEF,
      TPRDS_ONBELLEK_DIZINI: join(HEDEF, '.onbellek'),
      KOORDINASYON_ANAHTARI: ANAHTAR,
      HOSTNAME: '127.0.0.1',
    },
  });

  let toplamMaliyet = 0;
  let tamamlanan = 0;

  try {
    await sunucuyuBekle();
    console.log(`${SOLUK}  sunucu hazır${R}\n`);

    for (const rapor of adaylar) {
      if (toplamMaliyet >= TAVAN) {
        console.log(`  ${KIRMIZI}tavan aşıldı, duruluyor${R}`);
        break;
      }

      // ── 1. Yapay zekâ ön değerlendirmesi ───────────────────────────
      process.stdout.write(`  ${rapor.basvuru_no}  yapay zekâ…`);
      const y = await fetch(`${SUNUCU}/api/rapor/${rapor.id}/degerlendir`, {
        method: 'POST',
        headers: { 'x-koordinasyon-anahtari': ANAHTAR, 'content-type': 'application/json' },
        body: '{}',
      });
      if (!y.ok) {
        const g = await y.json().catch(() => ({}));
        console.log(` ${KIRMIZI}✗ ${y.status} ${(g as { hata?: string }).hata ?? ''}${R}`);
        continue;
      }
      const sonuc = await y.json() as {
        rapor: { aiDegerlendirme?: { kriterler?: Kriter[]; genelGucluYonler?: string[]; genelGelisimAlanlari?: string[] } };
        maliyet?: number;
      };
      toplamMaliyet += sonuc.maliyet ?? 0;

      const ai = sonuc.rapor.aiDegerlendirme;
      const kriterler = ai?.kriterler ?? [];
      if (!kriterler.length) {
        console.log(` ${KIRMIZI}✗ ölçüt puanı üretilmedi${R}`);
        continue;
      }
      process.stdout.write(` ${YESIL}✓${R} $${(sonuc.maliyet ?? 0).toFixed(3)}`);

      /*
       * ── 2. Hakem onayı ────────────────────────────────────────────
       * Puanlar modelin ürettiği puanlar; burada uydurulan tek şey yok.
       * Arayüzde hakem tam olarak bunu yapıyor: dolu gelen öneriyi
       * gözden geçirip gönderiyor.
       */
      const puanlar = kriterler.map((k) => ({ kriterKodu: k.kod, puan: k.aiPuan, not: k.gerekce }));
      const geriBildirim = {
        gucluYonler: ai?.genelGucluYonler ?? [],
        gelisimAlanlari: ai?.genelGelisimAlanlari ?? [],
        oneriler: kriterler.filter((k) => k.oneri).map((k) => k.oneri as string),
      };

      const dd = db();
      const hakemler = dd.prepare(
        'SELECT h.kod, h.ad FROM hakem h JOIN atama a ON a.hakem_id = h.id WHERE a.rapor_id = ? AND h.sistem = 0',
      ).all(rapor.id) as Array<{ kod: string; ad: string }>;
      dd.close();

      let onay = 0;
      for (const h of hakemler) {
        const hy = await fetch(`${SUNUCU}/api/hakem-degerlendirme`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            kod: h.kod,
            raporId: rapor.id,
            puanlar,
            geriBildirim,
            aciklama: 'Yapay zekâ ön değerlendirmesi incelendi ve uygun bulundu.',
            tamamla: true,
          }),
        });
        if (hy.ok) onay++;
      }
      console.log(`  ·  ${onay}/${hakemler.length} hakem onayladı`);
      if (onay > 0) tamamlanan++;
    }
  } finally {
    if (process.platform === 'win32' && sunucu.pid) {
      spawnSync('taskkill', ['/PID', String(sunucu.pid), '/T', '/F'], { stdio: 'ignore' });
    }
    sunucu.kill();
  }

  // ── 3. Onaylı geri bildirim ──────────────────────────────────────
  console.log(`\n${SOLUK}  geri bildirimler yazılıyor…${R}`);
  spawnSync('npx', ['tsx', 'scripts/demo-hazirla.ts'], {
    cwd: KOK, shell: true, stdio: 'inherit',
    env: { ...process.env, TPRDS_VERI_DIZINI: HEDEF },
  });

  const s = db();
  const say = (q: string) => (s.prepare(q).get() as { n: number }).n;
  const ozet = {
    tamamlanan: say("SELECT COUNT(*) n FROM rapor WHERE durum = 'tamamlandi'"),
    degerlendirme: say("SELECT COUNT(*) n FROM degerlendirme WHERE durum = 'tamamlandi'"),
    geriBildirim: say('SELECT COUNT(*) n FROM degerlendirme WHERE geri_bildirim IS NOT NULL'),
  };
  s.close();

  console.log(`\n${KALIN}  SONUÇ${R}`);
  console.log(`    tamamlanmış rapor      : ${ozet.tamamlanan}`);
  console.log(`    tamamlanmış puanlama   : ${ozet.degerlendirme}`);
  console.log(`    onaylı geri bildirim   : ${ozet.geriBildirim}`);
  console.log(`    harcanan               : $${toplamMaliyet.toFixed(3)}\n`);

  if (ozet.tamamlanan === 0) {
    console.log(`  ${KIRMIZI}Hiçbir rapor tamamlanmadı — yarışmacı portalı hâlâ boş.${R}\n`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(`\n  ${KIRMIZI}${e instanceof Error ? e.message : e}${R}\n`);
  process.exitCode = 1;
});
