/**
 * Sunucuya gönderilecek paketi hazırlar — ve İÇİNİ DENETLER.
 *
 * ── NİYE DENETİM ────────────────────────────────────────────────────────
 * Bu arşiv projeden çıkıp bir sunucuya, oradan belki bir yedeğe gidiyor.
 * İçine gerçek yarışmacı belgesi ya da bir API anahtarı karışırsa geri
 * dönüşü yok — kopyalanmış bir dosyayı geri alamazsınız.
 *
 * `tar --exclude` listesi doğru yazıldığında sorun yok. Sorun, listenin
 * bir gün yanlış yazılması: sessizce fazladan dosya girer ve kimse fark
 * etmez. Bu yüzden paket üretildikten SONRA içeriği okunuyor ve yasak
 * kalıplardan biri bulunursa paket SİLİNİYOR.
 *
 * Kullanım:  npm run paket
 */

import { spawnSync } from 'node:child_process';
import { existsSync, rmSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const KOK = process.cwd();
const CIKTI = join(homedir(), 'tprds-sunucu.tgz');

const YESIL = '\x1b[32m', KIRMIZI = '\x1b[31m', SOLUK = '\x1b[2m', R = '\x1b[0m';

/** Arşive girmemesi gerekenler. */
const DISLANAN = [
  'node_modules', '.next', './veri', '.git', '.onbellek',
  'test-verisi', 'design', '.env', '.env.local', '.env.sunucu',
];

/**
 * Arşivde bulunması YASAK kalıplar.
 *
 * `./veri/` çalışan veri dizini — gerçek belgeler orada.
 * `ornek_rapor/` gerçek yarışmacı raporlarının ham hâli.
 * `.env` dosyaları API anahtarı ve panel parolası taşıyor.
 */
const YASAK: Array<{ kalip: RegExp; ad: string }> = [
  { kalip: /^\.\/veri\//, ad: 'çalışan veri dizini (gerçek belgeler)' },
  { kalip: /ornek_rapor\//, ad: 'gerçek yarışmacı raporları' },
  { kalip: /\/\.env$|^\.\/\.env$/, ad: '.env (API anahtarı)' },
  { kalip: /\.env\.local$/, ad: '.env.local' },
  { kalip: /\.env\.sunucu$/, ad: '.env.sunucu (panel parolası)' },
  { kalip: /^\.\/\.git\//, ad: 'git geçmişi' },
];

function main(): void {
  if (!existsSync(join(KOK, 'dagitim', 'veri', 'tprds.db'))) {
    console.error(`\n  ${KIRMIZI}Dağıtım verisi yok.${R}`);
    console.error('  Önce:  npm run dagitim:veri && npm run dagitim:demo\n');
    process.exitCode = 1;
    return;
  }

  if (existsSync(CIKTI)) rmSync(CIKTI);

  console.log('\nPAKET HAZIRLANIYOR');
  /*
   * `--force-local` Windows için ZORUNLU: `C:\...` yolunu tar uzak
   * makine adresi sanıyor (`host:path`) ve "Cannot connect to C" diyor.
   * Linux'ta bu bayrağın etkisi yok — iki yerde de aynı komut çalışsın.
   */
  const argv = [
    '--force-local',
    ...DISLANAN.flatMap((d) => [`--exclude=${d}`]),
    '-czf', CIKTI, '.',
  ];
  const t = spawnSync('tar', argv, { cwd: KOK, encoding: 'utf-8' });
  if (t.status !== 0) {
    console.error(`\n  ${KIRMIZI}tar başarısız:${R} ${t.stderr?.slice(0, 300)}\n`);
    process.exitCode = 1;
    return;
  }

  // ── Denetim ────────────────────────────────────────────────────────
  const liste = spawnSync('tar', ['--force-local', '-tzf', CIKTI], { encoding: 'utf-8' });
  const girdiler = (liste.stdout ?? '').split('\n').filter(Boolean);

  const bulgular: string[] = [];
  for (const g of girdiler) {
    for (const y of YASAK) {
      if (y.kalip.test(g)) bulgular.push(`${y.ad}  →  ${g}`);
    }
  }

  const pdfler = girdiler.filter((g) => g.endsWith('.pdf'));
  const disariPdf = pdfler.filter((g) => !g.includes('dagitim/veri/dosyalar/'));

  console.log(`  girdi   : ${girdiler.length}`);
  console.log(`  PDF     : ${pdfler.length} ${SOLUK}(hepsi dagitim/veri/dosyalar altında olmalı)${R}`);
  console.log(`  boyut   : ${(statSync(CIKTI).size / 1024 / 1024).toFixed(1)} MB`);

  if (bulgular.length || disariPdf.length) {
    console.error(`\n  ${KIRMIZI}DENETİM BAŞARISIZ — paket siliniyor.${R}`);
    for (const b of bulgular.slice(0, 10)) console.error(`    ${b}`);
    for (const p of disariPdf.slice(0, 10)) console.error(`    beklenmedik PDF  →  ${p}`);
    rmSync(CIKTI);
    process.exitCode = 1;
    return;
  }

  console.log(`\n  ${YESIL}✓${R} Gerçek belge, anahtar veya çalışan veri YOK.`);
  console.log(`\n  ${CIKTI}\n`);
  console.log('  Sunucuya göndermek için:');
  /*
   * Kullanıcı adı sağlayıcıya göre değişiyor: DigitalOcean ve Hetzner
   * `root`, Oracle `ubuntu`. Yanlış ad "Permission denied (publickey)"
   * veriyor ve hata anahtarı işaret ettiği için sebep yanlış yerde
   * aranıyor — bu yüzden ikisi de yazılı.
   */
  console.log(`    scp -i ~/.ssh/tprds ${CIKTI} root@<SUNUCU-IP>:~/`);
  console.log('    (Oracle kullanıyorsanız root yerine ubuntu)\n');
}

main();
