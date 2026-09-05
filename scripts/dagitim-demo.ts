/**
 * Dağıtım demosu — temiz veri kümesine SENTETİK demo verisini yükler.
 *
 * `npm run dagitim:veri` yapılandırmayı bırakıp kişiye bağlı her şeyi
 * siliyor; geriye rapor içermeyen bir sistem kalıyor. Bu betik onu
 * jürinin gezebileceği hâle getiriyor — gerçek hiçbir belge kullanmadan.
 *
 * ── ÖNCEKİ SÜRÜM NİYE ÇALIŞMIYORDU ──────────────────────────────────────
 * Eski betik raporları `/api/rapor` ucundan yüklüyordu ve bunun için bir
 * üretim sunucusu ayağa kaldırıp HTTP üzerinden konuşuyordu. Rapor yükleme
 * yarışmacıya geçince o uç 405 döndürmeye başladı: dağıtım demosu sessizce
 * sıfır rapor üretir hâle gelmişti. Canlıya alınan sistem boş görünürdü.
 *
 * ── ŞİMDİ NASIL ─────────────────────────────────────────────────────────
 * Sunucu ayağa kaldırılmıyor; projenin kendi tohumlayıcıları hedef veri
 * dizinine karşı çalıştırılıyor:
 *
 *   ornek-veri.ts --boruhatti   yarışmacı hesapları, takımlar, başvurular,
 *                               hakemler, atamalar, değerlendirmeler ve
 *                               raporlar. `--boruhatti` raporu GERÇEK alma
 *                               hattından geçiriyor: şablon uyumu, başlık
 *                               denetimi, kaynak doğrulama, parmak izi.
 *   ornek-kopya.ts              kopya tespitinin doğru çalıştığını gösteren
 *                               çift: ortak cümleler + aynı görseller.
 *
 * ── NİYE TOHUMLAYICILARI YENİDEN YAZMIYORUZ ─────────────────────────────
 * Demo verisini ayrı yazmak, iki ayrı gerçeklik üretmek demekti: yerelde
 * gördüğümüzle canlıda görünen şey zamanla ayrışırdı. Aynı üreticiyi
 * farklı bir veri dizinine yöneltmek, canlının yerelin aynısı olmasını
 * garanti ediyor.
 *
 * Kullanım (önce `npm run dagitim:veri`):
 *   npm run dagitim:demo
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const KOK = process.cwd();
const HEDEF = resolve(
  process.argv.includes('--hedef')
    ? process.argv[process.argv.indexOf('--hedef') + 1]
    : join(KOK, 'dagitim', 'veri'),
);

const YESIL = '\x1b[32m';
const KIRMIZI = '\x1b[31m';
const SOLUK = '\x1b[2m';
const R = '\x1b[0m';

/*
 * Tohumlayıcılar AYRI SÜREÇTE koşuyor.
 *
 * Veri dizini `TPRDS_VERI_DIZINI` ile seçiliyor ve bu değişken veritabanı
 * modülü ilk kez içe aktarılırken okunuyor. Aynı süreçte çağrılsalardı
 * değişkeni sonradan değiştirmenin bir etkisi olmazdı ve tohumlama
 * geliştirme veritabanına yazardı — canlıya alınacak veri yerine.
 */
function tohumla(betik: string, ek: string[] = []): boolean {
  const s = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['tsx', betik, ...ek],
    {
      cwd: KOK,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: {
        ...process.env,
        TPRDS_VERI_DIZINI: HEDEF,
        TPRDS_ONBELLEK_DIZINI: join(HEDEF, '.onbellek'),
      },
    },
  );
  return s.status === 0;
}

function main() {
  if (!existsSync(HEDEF)) {
    console.error(
      `${KIRMIZI}Hedef veri dizini yok: ${HEDEF}${R}\n`
      + '  Önce `npm run dagitim:veri` çalıştırın.',
    );
    process.exit(1);
  }

  console.log(`${SOLUK}hedef: ${HEDEF}${R}\n`);

  const adimlar: Array<[string, string, string[]]> = [
    ['Yarışmacılar, takımlar, başvurular ve raporlar',
     'scripts/ornek-veri.ts', ['--boruhatti']],
    ['Kopya tespiti gösterim çifti', 'scripts/ornek-kopya.ts', []],
  ];

  for (const [ad, betik, ek] of adimlar) {
    console.log(`\n${SOLUK}── ${ad}${R}`);
    if (!tohumla(betik, ek)) {
      console.error(`\n${KIRMIZI}✗ ${betik} başarısız — dağıtım verisi eksik.${R}`);
      process.exit(1);
    }
  }

  console.log(`\n${YESIL}✓ Demo verisi hazır.${R}`);
  console.log(`${SOLUK}  Sırada: npm run paket${R}`);
}

main();
