/**
 * Dağıtım demosu — temiz veri kümesine SENTETİK raporları yükler.
 *
 * `npm run dagitim:veri` yapılandırmayı bırakıp kişiye bağlı her şeyi
 * siliyor; geriye rapor içermeyen bir sistem kalıyor. Bu betik onu
 * jürinin gezebileceği hâle getiriyor — gerçek hiçbir belge kullanmadan.
 *
 * ── RAPORLAR NEREDEN GELİYOR ────────────────────────────────────────────
 * Projenin kendi sentetik üreticilerinden:
 *   scripts/korpus-uret.ts       · benzerlik korpusu (K01…K05)
 *   scripts/ornek-rapor-uret.ts  · yapısal kontrol fixture'ları
 *
 * Korpus özellikle değerli çünkü BEKLENEN sonucu biliniyor: K01↔K03
 * görsel kopya, K01↔K04 metin kopyası, K01↔K05 aynı takımın devam
 * projesi (intihal değil), K02 hiçbiriyle eşleşmemeli. Yani demo yalnızca
 * "ekran doluyor" göstermiyor; kopya tespitinin DOĞRU çalıştığını
 * gösteriyor.
 *
 * ── NİYE GERÇEK SUNUCU ÜZERİNDEN ────────────────────────────────────────
 * Yükleme, kütüphane çağrısı taklit edilerek değil, uygulamanın kendi
 * `/api/rapor` ucundan yapılıyor. Şablon uyumu, künye okuma, kaynak
 * doğrulama, parmak izi çıkarma, benzerlik tazeleme — hepsi gerçekte
 * nasıl çalışıyorsa öyle çalışıyor. Taklit edilen bir yükleme, taklit
 * edilmiş bir demo üretirdi.
 *
 * Kullanım (önce `npm run build` ve `npm run dagitim:veri`):
 *   npm run dagitim:demo
 *   npm run dagitim:demo -- --kategori <id>
 */

import { DatabaseSync } from 'node:sqlite';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const KOK = process.cwd();
const HEDEF = resolve(
  process.argv.includes('--hedef')
    ? process.argv[process.argv.indexOf('--hedef') + 1]
    : join(KOK, 'dagitim', 'veri'),
);
const PORT = 3210;
const SUNUCU = `http://127.0.0.1:${PORT}`;
/* Yalnızca bu betiğin ömrü boyunca yaşayan anahtar; hiçbir yere yazılmıyor. */
const ANAHTAR = `dagitim-demo-${Math.random().toString(36).slice(2)}-${Date.now()}`;

const YESIL = '\x1b[32m', KIRMIZI = '\x1b[31m', SOLUK = '\x1b[2m', R = '\x1b[0m';

function db(): DatabaseSync {
  return new DatabaseSync(join(HEDEF, 'tprds.db'), { readOnly: true });
}

/**
 * İki AYRI set — ve ayrı kalmaları şart.
 *
 * ── ÖLÇÜLDÜ: KARIŞTIRMAK DEMOYU BOZUYOR ─────────────────────────────────
 * İlk denemede ikisi aynı kategoriye yüklendi. Sonuç: 66 çiftin 35'i
 * kopya olarak işaretlendi. Sebep `ornek-rapor-uret.ts`in kendi başlığında
 * zaten yazılı — o fixture'ların hepsi AYNI temel metinden türüyor, her
 * biri tek bir bozulma taşısın diye. Yani işaretlemeler doğruydu; yanlış
 * olan onları benzerlik korpusuyla aynı havuza koymaktı.
 *
 * Benzerlik karşılaştırması kategori bazlı çalıştığı için ayrı
 * kategorilere koymak sorunu kökünden çözüyor:
 *
 *   korpus/    → benzerlik anlatısı. Beklenen sonuç bilinen: K01↔K03
 *                görsel kopya, K01↔K04 metin kopyası, K01↔K05 aynı
 *                takımın devam projesi, K02 hiçbiriyle eşleşmemeli.
 *   raporlar/  → şablon, kaynakça ve taranmış belge kontrolleri.
 *                Kendi aralarında eşleşmeleri DOĞRU — gerçekten
 *                birbirinin kopyalar; ayrı kategoride bu bir kusur değil.
 */
interface RaporSeti {
  ad: string;
  dizin: string;
  uretici: string;
  /** Kategori seçerken aranan yarışma adı kalıbı. */
  yarismaKalibi: RegExp;
  anlatim: string;
}

const SETLER: RaporSeti[] = [
  {
    ad: 'benzerlik korpusu',
    dizin: join(KOK, 'test-verisi', 'korpus'),
    uretici: 'scripts/korpus-uret.ts',
    yarismaKalibi: /İnsanlık Yararına.*Lise/i,
    anlatim: 'K01↔K03 görsel kopya · K01↔K04 metin kopyası · K02 temiz',
  },
  {
    ad: 'yapısal kontroller',
    dizin: join(KOK, 'test-verisi', 'raporlar'),
    uretici: 'scripts/ornek-rapor-uret.ts',
    yarismaKalibi: /Sıfır Atık/i,
    anlatim: 'eksik kaynakça · karşılıksız atıf · eski şablon · taranmış belge',
  },
];

/** Sentetik raporlar üretilmemişse üret; her setin dosyalarını döndür. */
function korpusuHazirla(set: RaporSeti): string[] {
  if (!existsSync(set.dizin) || !readdirSync(set.dizin).some((f) => f.endsWith('.pdf'))) {
    console.log(`${SOLUK}  üretiliyor: ${set.uretici}${R}`);
    const s = spawnSync('npx', ['tsx', set.uretici], { stdio: 'inherit', shell: true });
    if (s.status !== 0) throw new Error(`${set.uretici} başarısız`);
  }
  return readdirSync(set.dizin)
    .filter((f) => f.endsWith('.pdf'))
    .sort()
    .map((f) => join(set.dizin, f));
}

/** Bir sete uygun kategori seç. */
function kategoriSec(kalip: RegExp, kullanilan: Set<string>):
{ yarismaId: string; kategoriId: string; etiket: string } {
  const d = db();
  const satirlar = d.prepare(
    'SELECT k.id, k.ad, k.yarisma_id, y.ad ya FROM kategori k JOIN yarisma y ON y.id = k.yarisma_id',
  ).all() as Array<{ id: string; ad: string; yarisma_id: string; ya: string }>;
  d.close();

  if (!satirlar.length) throw new Error('Hedef veritabanında kategori yok.');

  /*
   * Setin anlatısına yakın bir yarışma aranıyor; bulunamazsa HENÜZ
   * KULLANILMAMIŞ ilk kategoriye düşülüyor. `kullanilan` kümesi kritik:
   * iki set aynı kategoriye düşerse ayırmanın bütün anlamı kaybolur.
   */
  const bos = satirlar.filter((k) => !kullanilan.has(k.id));
  const secilen = bos.find((k) => kalip.test(k.ya)) ?? bos[0];
  if (!secilen) throw new Error('Boşta kategori kalmadı.');
  kullanilan.add(secilen.id);
  return {
    yarismaId: secilen.yarisma_id,
    kategoriId: secilen.id,
    etiket: `${secilen.ya} → ${secilen.ad}`,
  };
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

async function main(): Promise<void> {
  if (!existsSync(join(HEDEF, 'tprds.db'))) {
    console.error(`\n  Hedef veri kümesi yok: ${HEDEF}`);
    console.error('  Önce çalıştırın:  npm run dagitim:veri\n');
    process.exitCode = 1;
    return;
  }
  if (!existsSync(join(KOK, '.next'))) {
    console.error('\n  Derleme yok. Önce:  npm run build\n');
    process.exitCode = 1;
    return;
  }

  const d = db();
  const varOlan = (d.prepare('SELECT COUNT(*) n FROM rapor').get() as { n: number }).n;
  d.close();
  if (varOlan > 0) {
    console.error(`\n  Hedefte zaten ${varOlan} rapor var. Sıfırdan kurmak için:`);
    console.error('    npm run dagitim:veri\n');
    process.exitCode = 1;
    return;
  }

  const kullanilan = new Set<string>();
  const isler = SETLER.map((set) => ({
    set,
    pdfler: korpusuHazirla(set),
    kategori: kategoriSec(set.yarismaKalibi, kullanilan),
  }));
  const toplam = isler.reduce((t, i) => t + i.pdfler.length, 0);

  console.log('\nDAĞITIM DEMOSU');
  console.log(`  hedef : ${HEDEF}`);
  for (const i of isler) {
    console.log(`\n  ${i.set.ad}  (${i.pdfler.length} PDF)`);
    console.log(`    kategori : ${i.kategori.etiket}`);
    console.log(`    ${SOLUK}${i.set.anlatim}${R}`);
  }
  console.log('');

  /*
   * Sunucu, hedef veri dizinine bağlanmış olarak ayağa kaldırılıyor.
   * Anahtar veriliyor: `src/instrumentation.ts` üretimde anahtarsız
   * açılışı reddediyor ve bu betik üretim derlemesini çalıştırıyor.
   */
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

  let yuklenen = 0;
  const basarisiz: string[] = [];
  try {
    await sunucuyuBekle();
    console.log(`${SOLUK}  sunucu hazır (${SUNUCU})${R}`);

    for (const is of isler) {
      console.log(`\n  ${is.set.ad}`);
      for (const yol of is.pdfler) {
        // Windows'ta ayraç ters bölü; iki ayraç da bölünmeli.
        const ad = yol.split(/[\\/]/).pop()!;
        const govde = new FormData();
        govde.append('yarismaId', is.kategori.yarismaId);
        govde.append('kategoriId', is.kategori.kategoriId);
        govde.append(
          'dosya',
          new File([new Uint8Array(readFileSync(yol))], ad, { type: 'application/pdf' }),
        );

        const y = await fetch(`${SUNUCU}/api/rapor`, {
          method: 'POST',
          headers: { 'x-koordinasyon-anahtari': ANAHTAR },
          body: govde,
        });

        if (y.ok) {
          yuklenen++;
          console.log(`    ${YESIL}✓${R} ${ad}`);
        } else {
          const g = await y.json().catch(() => ({}));
          basarisiz.push(`${ad}: ${y.status} ${(g as { hata?: string }).hata ?? ''}`);
          console.log(`    ${KIRMIZI}✗${R} ${ad}  ${SOLUK}${y.status}${R}`);
        }
      }
    }
  } finally {
    /*
     * SIRA ÖNEMLİ — ölçüldü.
     *
     * Önce `sunucu.kill()` çağrılıyordu ve bu, kabuk sürecini öldürüp
     * altındaki `node`u ÖKSÜZ bırakıyordu: taskkill'e sıra geldiğinde
     * artık öldüreceği bir ağaç yoktu. Sonuç, 3210 portunda ayakta kalan
     * ve veritabanı dosyasını kilitleyen bir süreç oldu — bir sonraki
     * `npm run dagitim:veri` EBUSY ile patladı.
     *
     * Ağaç önce, kök sonra.
     */
    // Kabuk üzerinden başlatıldığında torun süreç ayakta kalabiliyor.
    if (process.platform === 'win32' && sunucu.pid) {
      spawnSync('taskkill', ['/PID', String(sunucu.pid), '/T', '/F'], { stdio: 'ignore' });
    }
    sunucu.kill();
  }

  if (basarisiz.length) {
    console.log(`\n  ${KIRMIZI}Yüklenemeyen:${R}`);
    for (const b of basarisiz) console.log(`    ${b}`);
  }

  /*
   * Hakemler, atamalar ve onaylı geri bildirim: var olan demo betiği.
   * Ayrı süreç olarak çalışıyor çünkü veri dizinini ortam değişkeninden
   * okuyor ve bu süreç kendi dizinine bağlı.
   */
  console.log(`\n${SOLUK}  hakemler ve atamalar kuruluyor…${R}`);
  const demo = spawnSync('npx', ['tsx', 'scripts/demo-hazirla.ts'], {
    cwd: KOK,
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, TPRDS_VERI_DIZINI: HEDEF },
  });
  if (demo.status !== 0) console.log(`  ${KIRMIZI}demo-hazirla başarısız${R}`);

  const s = db();
  const say = (t: string) => (s.prepare(`SELECT COUNT(*) n FROM ${t}`).get() as { n: number }).n;
  const ozet = { rapor: say('rapor'), hakem: say('hakem'), atama: say('atama') };
  s.close();

  console.log(`\n  SONUÇ  ${ozet.rapor} rapor · ${ozet.hakem} hakem · ${ozet.atama} atama`);
  console.log(`  ${yuklenen}/${toplam} yükleme başarılı\n`);
  if (basarisiz.length || ozet.rapor === 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(`\n  ${KIRMIZI}${e instanceof Error ? e.message : e}${R}\n`);
  process.exitCode = 1;
});
