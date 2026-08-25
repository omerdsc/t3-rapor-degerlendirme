/**
 * Kapsayıcı imajını YERELDE derleyip taşınabilir hale getirir.
 *
 * ── NİYE VAR ────────────────────────────────────────────────────────────
 * Normal akışta imaj sunucuda derleniyor: kaynak gönderiliyor,
 * `docker compose up --build` çalışıyor. Bu, 2 GB ve üstü makinelerde
 * doğru yol — güncelleme küçük bir kaynak paketi göndermek demek.
 *
 * Ama ucuz sunucular 512 MB - 1 GB bellekle geliyor. Next derlemesi tepe
 * noktada ~1.5 GB istiyor ve o makinelerde derleme "Killed" ile düşüyor.
 * Hata mesajı bellekten hiç bahsetmediği için sebebi de anlaşılmıyor.
 *
 * Bu betik işi tersine çeviriyor: derleme burada yapılıyor, sunucuya
 * yalnızca ÇALIŞMAYA HAZIR imaj gidiyor. Ölçüldü: çalışma anında bellek
 * kullanımı 61-66 MB, yani 512 MB'lık bir makineye bile rahat sığıyor.
 *
 * ── MİMARİ ──────────────────────────────────────────────────────────────
 * `--platform linux/amd64` zorunlu. Bu makine x86 ve hedef sunucular da
 * x86. Platform yazılmazsa Docker yerel mimariyi kullanır; ARM bir
 * makinede derlenen imaj x86 sunucuda "exec format error" ile açılmaz —
 * hem de kapsayıcı başlatılana kadar anlaşılmaz.
 *
 * Kullanım:  npm run paket:imaj
 */

import { spawnSync } from 'node:child_process';
import { createReadStream, createWriteStream, existsSync, rmSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';

const KOK = process.cwd();
const ETIKET = 'tprds:latest';
const CIKTI = join(homedir(), 'tprds-imaj.tgz');
const PLATFORM = 'linux/amd64';

const YESIL = '\x1b[32m', KIRMIZI = '\x1b[31m', SOLUK = '\x1b[2m', R = '\x1b[0m';

function calistir(komut: string, argv: string[], aciklama: string): void {
  console.log(`${SOLUK}  ${aciklama}…${R}`);
  const s = spawnSync(komut, argv, { cwd: KOK, stdio: 'inherit', shell: true });
  if (s.status !== 0) throw new Error(`${aciklama} başarısız (çıkış ${s.status})`);
}

async function main(): Promise<void> {
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
   * KABUK BORUSU KULLANILMIYOR — ölçülmüş bir hatanın sonucu.
   *
   * Önce `bash -c "docker save … | gzip > C:\Users\…"` çalıştırılıyordu.
   * Windows yolu kabuk içinde bozuldu, docker komutu geçersiz oldu ve
   * yardım metnini yazdırdı. Yönlendirme yine de BOŞ bir dosya
   * yarattığından `existsSync` geçti ve betik "✓ 0 MB" diyerek BAŞARILI
   * göründü. Sessiz başarısızlık, sunucuda "imaj yüklendi" yazıp sonra
   * kapsayıcının hiç açılmamasına yol açardı.
   *
   * Şimdi iki adım da doğrudan: docker dosyayı kendisi yazıyor (`-o`,
   * boru yok), sıkıştırma Node içinde. Kabuk alıntılama kuralları hiç
   * devreye girmiyor. Üstüne boyut denetimi var — burada durmak,
   * sunucuda aramaktan iyi.
   */
  const hamYol = CIKTI.replace(/\.tgz$/, '.tar');
  if (existsSync(hamYol)) rmSync(hamYol);
  calistir('docker', ['save', '-o', hamYol, ETIKET], 'kaydediliyor');

  if (!existsSync(hamYol) || statSync(hamYol).size < 1024 * 1024) {
    throw new Error('docker save boş çıktı üretti — imaj gerçekten var mı?');
  }

  /*
   * Sıkıştırma seviyesi 1: imajın çoğu zaten sıkışmış katmanlardan
   * oluşuyor, yüksek seviyeler dakikalar ekleyip birkaç MB kazandırıyor.
   */
  console.log(`${SOLUK}  sıkıştırılıyor…${R}`);
  await pipeline(
    createReadStream(hamYol),
    createGzip({ level: 1 }),
    createWriteStream(CIKTI),
  );
  rmSync(hamYol);

  if (!existsSync(CIKTI) || statSync(CIKTI).size < 10 * 1024 * 1024) {
    throw new Error('Paket beklenenden küçük — üretim başarısız.');
  }

  const mb = statSync(CIKTI).size / 1024 / 1024;
  console.log(`\n  ${YESIL}✓${R} ${CIKTI}  (${mb.toFixed(0)} MB)\n`);
  console.log('  Sunucuya göndermek için (kaynak paketiyle BİRLİKTE):');
  console.log('    scp -i ~/.ssh/tprds ~/tprds-sunucu.tgz ~/tprds-imaj.tgz root@<IP>:~/\n');
  console.log(`  ${SOLUK}Kurulum betiği ~/tprds-imaj.tgz dosyasını kendiliğinden`);
  console.log(`  bulup yüklüyor; sunucuda derleme yapılmıyor.${R}\n`);
}

main().catch((e) => {
  console.error(`\n  ${KIRMIZI}${e instanceof Error ? e.message : e}${R}\n`);
  process.exitCode = 1;
});
