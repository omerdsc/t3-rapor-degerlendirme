/**
 * Kapsayıcı imajını YERELDE derleyip taşınabilir hale getirir.
 *
 * ── NİYE VAR ────────────────────────────────────────────────────────────
 * Normal akışta imaj sunucuda derleniyor: kaynak gönderiliyor,
 * `docker compose up --build` çalışıyor. Bu, 2 GB ve üstü makinelerde
 * doğru yol — güncelleme küçük bir kaynak paketi göndermek demek.
 *
 * Ama ücretsiz sunucuların çoğu 1 GB. Next derlemesi tepe noktada ~1.5 GB
 * bellek istiyor ve o makinede derleme "Killed" ile düşüyor. Hata mesajı
 * bellekten hiç bahsetmediği için sebebi de anlaşılmıyor.
 *
 * Bu betik işi tersine çeviriyor: derleme burada yapılıyor, sunucuya
 * yalnızca ÇALIŞMAYA HAZIR imaj gidiyor. Sunucunun tek işi onu yüklemek.
 * Çalışma anında bellek ihtiyacı ~150 MB — 1 GB'a rahat sığıyor.
 *
 * ── MİMARİ ──────────────────────────────────────────────────────────────
 * `--platform linux/amd64` zorunlu. Bu makine x86 ve hedef ücretsiz
 * sunucular (Oracle E2.1.Micro, çoğu VPS) da x86. Platform yazılmazsa
 * Docker yerel mimariyi kullanır ve ARM bir makinede derlenen imaj x86
 * sunucuda "exec format error" ile açılmaz — hem de kapsayıcı
 * başlatılana kadar anlaşılmaz.
 *
 * Kullanım:  npm run paket:imaj
 */

import { spawnSync } from 'node:child_process';
import { existsSync, rmSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const KOK = process.cwd();
const ETIKET = 'tprds:latest';
const CIKTI = join(homedir(), 'tprds-imaj.tgz');
const PLATFORM = 'linux/amd64';

const YESIL = '\x1b[32m', KIRMIZI = '\x1b[31m', SOLUK = '\x1b[2m', R = '\x1b[0m';

function calistir(komut: string, argv: string[], aciklama: string): void {
  console.log(`${SOLUK}  ${aciklama}…${R}`);
  const s = spawnSync(komut, argv, { cwd: KOK, stdio: 'inherit', shell: true });
  if (s.status !== 0) throw new Error(`${aciklama} başarısız`);
}

function main(): void {
  const d = spawnSync('docker', ['version', '--format', '{{.Server.Version}}'], {
    encoding: 'utf-8', shell: true,
  });
  if (d.status !== 0) {
    console.error(`\n  ${KIRMIZI}Docker çalışmıyor.${R} Docker Desktop'ı açın.\n`);
    process.exitCode = 1;
    return;
  }

  console.log('\nİMAJ PAKETLENİYOR');
  console.log(`  platform : ${PLATFORM}`);
  console.log(`  etiket   : ${ETIKET}\n`);

  calistir('docker', ['build', '--platform', PLATFORM, '-t', ETIKET, '.'], 'derleniyor');

  if (existsSync(CIKTI)) rmSync(CIKTI);

  /*
   * `gzip -1` bilinçli: en hızlı sıkıştırma. İmajın çoğu zaten sıkışmış
   * katmanlardan oluşuyor, daha yüksek seviyeler dakikalar ekleyip
   * birkaç MB kazandırıyor.
   */
  calistir('bash', ['-c', `docker save ${ETIKET} | gzip -1 > "${CIKTI}"`], 'kaydediliyor');

  if (!existsSync(CIKTI)) throw new Error('Çıktı üretilmedi.');

  const mb = statSync(CIKTI).size / 1024 / 1024;
  console.log(`\n  ${YESIL}✓${R} ${CIKTI}  (${mb.toFixed(0)} MB)\n`);
  console.log('  Sunucuya göndermek için (kaynak paketiyle BİRLİKTE):');
  console.log(`    scp -i ~/.ssh/tprds ~/tprds-sunucu.tgz ~/tprds-imaj.tgz kullanici@<IP>:~/\n`);
  console.log(`  ${SOLUK}Kurulum betiği ~/tprds-imaj.tgz dosyasını kendiliğinden`);
  console.log(`  bulup yüklüyor; sunucuda derleme yapılmıyor.${R}\n`);
}

try {
  main();
} catch (e) {
  console.error(`\n  ${KIRMIZI}${e instanceof Error ? e.message : e}${R}\n`);
  process.exitCode = 1;
}
