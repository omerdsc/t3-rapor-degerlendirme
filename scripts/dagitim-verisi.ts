/**
 * Dağıtım verisi hazırlama — canlıya çıkacak TEMİZ veri kümesi.
 *
 * ── ÇÖZDÜĞÜ SORUN ───────────────────────────────────────────────────────
 * Geliştirme veritabanı GERÇEK yarışmacı raporları taşıyor. Bunları açık
 * bir adrese koymak veri koruma sorunudur ve maskeleme yetmez: maskeleme
 * ekranda çalışıyor, indirilen PDF'in içinde değil.
 *
 * Ama veritabanının tamamı hassas değil. İçindeki 43 yarışma ve 80
 * kategori teknofest.org taramasından geliyor — kamuya açık bilgi ve
 * projenin en pahalı yapılandırması (yeniden üretmek 60 sayfalık bir
 * tarama demek). Şablonlar, rubrikler, terim profilleri de öyle.
 *
 * Bu betik ikisini AYIRIYOR: yapılandırma kalıyor, kişiye bağlı her şey
 * gidiyor.
 *
 * ── NE SİLİNİYOR ────────────────────────────────────────────────────────
 *   rapor          · yarışmacı belgeleri ve künyeleri
 *   parmakizi      · rapor içeriğinden türetilmiş imzalar
 *   atama          · hangi hakem hangi rapora
 *   degerlendirme  · puanlar ve geri bildirimler
 *   mesaj          · yazışmalar
 *   hakem          · adlar, kurumlar, erişim kodları
 *   veri/dosyalar  · yüklenmiş PDF/DOCX'lerin kendisi
 *
 * ── NE KALIYOR ──────────────────────────────────────────────────────────
 *   yarisma, kategori   · şablon, rubrik, ölçütler
 *   katalog.json        · TEKNOFEST yarışma kataloğu
 *   terim-profilleri    · içerik uygunluğu karşılaştırma kümesi
 *   veri/yarismalar     · şablon çözümleme kayıtları
 *
 * ── NİYE KOPYA ÜZERİNDE ─────────────────────────────────────────────────
 * Çalışan veritabanına dokunulmuyor. Betik önce kopyalıyor, sonra kopyayı
 * temizliyor; yanlış bir çalıştırma geliştirme verisini yok edemez.
 *
 * Kullanım:
 *   npm run dagitim:veri              → dagitim/veri/ hazırlanır
 *   npm run dagitim:veri -- --hedef X → başka bir dizine
 */

import { DatabaseSync } from 'node:sqlite';
import {
  cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

const KOK = process.cwd();
const KAYNAK_DIZIN = join(KOK, 'veri');

function hedefDizin(): string {
  const i = process.argv.indexOf('--hedef');
  const ham = i >= 0 ? process.argv[i + 1] : join(KOK, 'dagitim', 'veri');
  return resolve(ham);
}

/** Kaynak veritabanı — yeni ad yoksa eski ad (baglanti.ts ile aynı kural). */
function kaynakDb(): string {
  const yeni = join(KAYNAK_DIZIN, 'tprds.db');
  const eski = join(KAYNAK_DIZIN, 'dorduncu-goz.db');
  if (existsSync(yeni)) return yeni;
  if (existsSync(eski)) return eski;
  throw new Error(`Kaynak veritabanı bulunamadı: ${KAYNAK_DIZIN}`);
}

function boyut(yol: string): string {
  const b = statSync(yol).size;
  return b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;
}

function main(): void {
  const hedef = hedefDizin();

  /*
   * EN ÖNEMLİ KONTROL. Hedef, çalışan veri dizini olamaz — olsaydı bu
   * betik "temizlik" adı altında bütün geliştirme verisini silerdi.
   */
  if (resolve(hedef) === resolve(KAYNAK_DIZIN)) {
    console.error('\n  Hedef, çalışan veri dizininin kendisi. Bu betik onu SİLERDİ.');
    console.error('  Başka bir dizin verin: --hedef dagitim/veri\n');
    process.exitCode = 1;
    return;
  }

  const kaynak = kaynakDb();
  console.log(`\nDAĞITIM VERİSİ\n  kaynak : ${kaynak} (${boyut(kaynak)})`);
  console.log(`  hedef  : ${hedef}`);

  /*
   * WAL noktalaması. SQLite yazmaları önce -wal dosyasına gidiyor;
   * ana dosyayı olduğu gibi kopyalamak SON yazmaları kaybetmek demek.
   * Kopyalamadan önce her şey ana dosyaya yazdırılıyor.
   */
  const kk = new DatabaseSync(kaynak, { readOnly: false });
  kk.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  kk.close();

  if (existsSync(hedef)) rmSync(hedef, { recursive: true });
  mkdirSync(hedef, { recursive: true });

  const hedefDb = join(hedef, 'tprds.db');
  cpSync(kaynak, hedefDb);

  // ── Kişiye bağlı her şey siliniyor ─────────────────────────────────
  const db = new DatabaseSync(hedefDb);
  db.exec('PRAGMA foreign_keys = ON');

  const once: Record<string, number> = {};
  const TABLOLAR = ['rapor', 'parmakizi', 'atama', 'degerlendirme', 'mesaj', 'hakem'];
  for (const t of TABLOLAR) {
    once[t] = (db.prepare(`SELECT COUNT(*) n FROM ${t}`).get() as { n: number }).n;
  }

  /*
   * Sıra önemli: rapor silinince ona bağlı satırlar zaten gidiyor
   * (ON DELETE CASCADE). Yine de hepsi tek tek siliniyor — yabancı
   * anahtarın kapalı olduğu bir veritabanında sessizce yetim satır
   * kalmasın. `foreign_keys` varsayılan olarak KAPALI geliyor ve bu
   * projede bir kez bunun bedeli ödendi.
   */
  db.exec('DELETE FROM mesaj');
  db.exec('DELETE FROM degerlendirme');
  db.exec('DELETE FROM atama');
  db.exec('DELETE FROM parmakizi');
  db.exec('DELETE FROM rapor');
  db.exec('DELETE FROM hakem');
  db.exec('VACUUM');

  const kalan: Record<string, number> = {};
  for (const t of [...TABLOLAR, 'yarisma', 'kategori']) {
    kalan[t] = (db.prepare(`SELECT COUNT(*) n FROM ${t}`).get() as { n: number }).n;
  }
  db.close();

  console.log('\n  SİLİNDİ');
  for (const t of TABLOLAR) {
    console.log(`    ${String(once[t]).padStart(5)} → ${kalan[t]}   ${t}`);
  }
  console.log('\n  KALDI (yapılandırma — kamuya açık)');
  console.log(`    ${String(kalan.yarisma).padStart(5)}       yarisma`);
  console.log(`    ${String(kalan.kategori).padStart(5)}       kategori`);

  // ── Yapılandırma dosyaları ─────────────────────────────────────────
  const KOPYALANACAK = ['katalog.json', 'katalog-dogrulama.json', 'terim-profilleri.json'];
  for (const ad of KOPYALANACAK) {
    const k = join(KAYNAK_DIZIN, ad);
    if (existsSync(k)) {
      cpSync(k, join(hedef, ad));
      console.log(`    kopyalandı  ${ad}`);
    }
  }

  const yarismaDizin = join(KAYNAK_DIZIN, 'yarismalar');
  if (existsSync(yarismaDizin)) {
    cpSync(yarismaDizin, join(hedef, 'yarismalar'), { recursive: true });
    const n = readdirSync(join(hedef, 'yarismalar')).length;
    console.log(`    kopyalandı  yarismalar/ (${n} dosya)`);
  }

  /*
   * `dosyalar/` KOPYALANMIYOR — yüklenmiş yarışmacı belgeleri orada.
   * Boş olarak oluşturuluyor ki uygulama ilk yüklemede dizin arayıp
   * bulamasın diye bir sorun yaşamasın.
   */
  mkdirSync(join(hedef, 'dosyalar'), { recursive: true });

  // ── Sağlama: hedefte gerçekten belge kalmadı mı ────────────────────
  const kacBelge = existsSync(join(hedef, 'dosyalar'))
    ? readdirSync(join(hedef, 'dosyalar')).length
    : 0;
  const dogru = kalan.rapor === 0 && kalan.hakem === 0 && kacBelge === 0;

  console.log(`\n  hedef veritabanı: ${boyut(hedefDb)}`);
  console.log(
    dogru
      ? '  ✓ Yarışmacı belgesi ve kişi kaydı YOK.\n'
      : '  ✗ TEMİZ DEĞİL — canlıya çıkarmayın.\n',
  );
  if (!dogru) process.exitCode = 1;

  console.log('  Sonraki adım: sunucuyu bu dizinle çalıştırıp sentetik');
  console.log('  raporları yükleyin —  npm run dagitim:demo\n');
}

main();
