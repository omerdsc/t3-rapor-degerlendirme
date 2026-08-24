/**
 * SQLite bağlantısı ve şema.
 *
 * ── NEDEN SQLITE, NEDEN node:sqlite ─────────────────────────────────────
 * Önceki depo JSON dosyalarına yazıyordu. Bu, tek kullanıcılı yerel bir
 * kurulumda çalışıyor ama şu üçünü karşılamıyor:
 *
 *   · Eşzamanlı yazma — üç hakem aynı anda puan girdiğinde dosya tabanlı
 *     kuyruk sıraya alıyor ama çakışmayı yönetemiyor.
 *   · Sorgu — "bu hakemin atanmış ama bitirmediği raporlar" gibi bir soru
 *     bütün dosyaları okumadan yanıtlanamıyor.
 *   · Bütünlük — atama ile değerlendirme arasındaki ilişki dosyada
 *     doğrulanamıyor; yabancı anahtar diye bir şey yok.
 *
 * `node:sqlite` seçildi çünkü Node 22'de GÖMÜLÜ: kurulum yok, derleme yok,
 * bağımlılık yok. `better-sqlite3` yerel derleme gerektiriyor ve Windows'ta
 * kurulum kırılganlığı riski var; bir creathon teslimini kurulum hatasına
 * bağlamak istemedik.
 *
 * API'si dar (exec / prepare / run / get / all) ve bu modülün arkasında
 * duruyor — deneysel işaretini taşıdığı için gerekirse tek dosya
 * değiştirilerek başka bir sürücüye geçilebilir.
 *
 * ── JSON SÜTUNLAR BİLİNÇLİ ──────────────────────────────────────────────
 * Analiz çıktıları (kontroller, parmak izi, yapay zekâ değerlendirmesi)
 * derin iç içe yapılar ve HER ZAMAN bütün olarak okunup yazılıyor; hiçbir
 * sorgu içlerine bakmıyor. Bunları normalleştirmek onlarca tablo üretir ve
 * hiçbir kazanç sağlamaz. Sorgulanan alanlar (durum, tarih, kimlikler)
 * gerçek sütun; sorgulanmayan yapılar JSON.
 */

import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const VERI_DIZINI = () => join(process.cwd(), 'veri');

/**
 * Veritabanı dosyası.
 *
 * ── ESKİ AD DA AÇILIYOR ─────────────────────────────────────────────────
 * Proje adı değişti (4. Göz → TPRDS) ve dosya adı da değişti. Ama var olan
 * kurulumlarda veri `dorduncu-goz.db` içinde: yeni adı sabitleyip bırakmak,
 * çalışan bir sistemin BÜTÜN VERİSİNİ görünmez yapardı — dosya duruyor,
 * uygulama boş bir veritabanı açıyor ve "hiç rapor yok" diyor.
 *
 * Bu yüzden yeni ad yoksa ve eski ad varsa eski dosya kullanılıyor. Ad
 * değişikliği veri kaybına dönüşmüyor; taşımak isteyen dosyayı elle
 * yeniden adlandırabilir.
 */
const YENI_AD = 'tprds.db';
const ESKI_AD = 'dorduncu-goz.db';

const DB_YOLU = () => {
  const yeni = join(VERI_DIZINI(), YENI_AD);
  const eski = join(VERI_DIZINI(), ESKI_AD);
  return !existsSync(yeni) && existsSync(eski) ? eski : yeni;
};

/**
 * Şema.
 *
 * Sürüm numarası `sema_surumu` tablosunda tutuluyor; ileride alan
 * eklenirse geçiş yazılabilsin.
 */
const SEMA = `
CREATE TABLE IF NOT EXISTS sema_surumu (surum INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS yarisma (
  id            TEXT PRIMARY KEY,
  ad            TEXT NOT NULL,
  yil           INTEGER NOT NULL,
  katalog_slug  TEXT,
  olusturuldu   TEXT NOT NULL,
  icerik_kategorileri TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS kategori (
  id             TEXT PRIMARY KEY,
  yarisma_id     TEXT NOT NULL REFERENCES yarisma(id) ON DELETE CASCADE,
  ad             TEXT NOT NULL,
  asama          TEXT,
  sablon_dosyasi TEXT NOT NULL,
  olusturuldu    TEXT NOT NULL,
  duzenlendi     INTEGER NOT NULL DEFAULT 0,
  sablon         TEXT NOT NULL,
  kurallar       TEXT NOT NULL,
  rubrik         TEXT NOT NULL,
  ornek_kaynaklar TEXT NOT NULL DEFAULT '[]',
  uyarilar       TEXT NOT NULL DEFAULT '[]',
  sartname       TEXT
);
CREATE INDEX IF NOT EXISTS ix_kategori_yarisma ON kategori(yarisma_id);

CREATE TABLE IF NOT EXISTS rapor (
  id            TEXT PRIMARY KEY,
  yarisma_id    TEXT NOT NULL REFERENCES yarisma(id) ON DELETE CASCADE,
  kategori_id   TEXT NOT NULL REFERENCES kategori(id) ON DELETE CASCADE,
  basvuru_no    TEXT NOT NULL,
  dosya_adi     TEXT NOT NULL,
  takim         TEXT NOT NULL,
  takim_id      TEXT NOT NULL,
  proje         TEXT NOT NULL,
  icerik_kategori_kodu TEXT,
  yuklendi      TEXT NOT NULL,
  durum         TEXT NOT NULL,
  genel_durum   TEXT NOT NULL,
  kontroller    TEXT NOT NULL DEFAULT '[]',
  istatistik    TEXT NOT NULL,
  kaynak_dogrulamasi TEXT,
  ai_degerlendirme   TEXT,
  rapor_kimligi      TEXT,
  kimlik_uyusmazligi TEXT,
  dosya_yolu    TEXT,
  -- Koordinasyonun nihai kararı: hakem değerlendirmelerinden türetilir
  -- ama elle de belirlenebilir (itiraz sonucu gibi).
  nihai_puan    REAL,
  nihai_not     TEXT,
  tamamlandi    TEXT
);
CREATE INDEX IF NOT EXISTS ix_rapor_yarisma  ON rapor(yarisma_id);
CREATE INDEX IF NOT EXISTS ix_rapor_kategori ON rapor(kategori_id);
CREATE INDEX IF NOT EXISTS ix_rapor_durum    ON rapor(durum);
CREATE INDEX IF NOT EXISTS ix_rapor_basvuru  ON rapor(basvuru_no);

/*
 * Parmak izi AYRI TABLODA.
 *
 * Rapor başına ~40 KB ve yalnızca kopya taramasında gerekiyor. Aynı
 * tabloda tutulsa her rapor listesi sorgusu bu yükü taşırdı.
 */
CREATE TABLE IF NOT EXISTS parmakizi (
  rapor_id TEXT PRIMARY KEY REFERENCES rapor(id) ON DELETE CASCADE,
  veri     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hakem (
  id          TEXT PRIMARY KEY,
  ad          TEXT NOT NULL,
  eposta      TEXT,
  kurum       TEXT,
  -- Hakemin panele erişim kodu. Kimlik doğrulama yerine geçen geçici
  -- çözüm: hakem kendi kodu ile /hakem/<kod> adresinden giriyor.
  kod         TEXT NOT NULL UNIQUE,
  uzmanlik    TEXT NOT NULL DEFAULT '[]',
  aktif       INTEGER NOT NULL DEFAULT 1,
  -- SİSTEM KAYDI MI. 1 ise bu satır bir insanı temsil etmiyor: arşiv
  -- kaydı gibi, veri taşımak için var olan sahte hakem. Panele hiç
  -- giremez ve rapor atanamaz. aktif=0 bunun yerine geçmiyor:
  -- pasife alınmış GERÇEK hakem kendi bitmiş işini görebilmeli.
  sistem      INTEGER NOT NULL DEFAULT 0,
  olusturuldu TEXT NOT NULL,
  notlar      TEXT
);
CREATE INDEX IF NOT EXISTS ix_hakem_kod ON hakem(kod);

/*
 * ATAMA: hangi hakem hangi raporu değerlendirecek.
 *
 * Bir rapora birden çok hakem atanabiliyor (TEKNOFEST'te olağan) ve bir
 * hakem birden çok rapor alıyor. Çift atamayı engellemek için (rapor,
 * hakem) çifti tekil.
 */
CREATE TABLE IF NOT EXISTS atama (
  id         TEXT PRIMARY KEY,
  rapor_id   TEXT NOT NULL REFERENCES rapor(id) ON DELETE CASCADE,
  hakem_id   TEXT NOT NULL REFERENCES hakem(id) ON DELETE CASCADE,
  atandi     TEXT NOT NULL,
  atayan     TEXT,
  son_tarih  TEXT,
  UNIQUE (rapor_id, hakem_id)
);
CREATE INDEX IF NOT EXISTS ix_atama_hakem ON atama(hakem_id);
CREATE INDEX IF NOT EXISTS ix_atama_rapor ON atama(rapor_id);

/*
 * DEĞERLENDİRME: hakem başına puanlama.
 *
 * Eski yapıda rapor tek bir puan seti taşıyordu; üç hakem atandığında
 * birbirinin üstüne yazardı. Artık her hakemin kendi değerlendirmesi ayrı
 * satır — nihai puan bunlardan türetiliyor ve sapma ölçülebiliyor.
 */
CREATE TABLE IF NOT EXISTS degerlendirme (
  id          TEXT PRIMARY KEY,
  rapor_id    TEXT NOT NULL REFERENCES rapor(id) ON DELETE CASCADE,
  hakem_id    TEXT NOT NULL REFERENCES hakem(id) ON DELETE CASCADE,
  puanlar     TEXT NOT NULL DEFAULT '[]',
  toplam      REAL,
  aciklama    TEXT,
  durum       TEXT NOT NULL DEFAULT 'taslak',
  -- HAKEMİN ONAYLADIĞI GERİ BİLDİRİM (JSON).
  -- Yarışmacıya giden güçlü yönler / gelişim alanları / öneriler burada.
  -- Model bunları ÜRETİYOR ama yarışmacıya giden sürüm hakemin gözden
  -- geçirip onayladığı sürüm: PRD "hakeme sunulur; sonuçlardan ...
  -- üretilir" diyor, yani hakem arada. Boşsa yarışmacı geri bildirim
  -- görmüyor — onaysız model metni yayımlanmıyor.
  geri_bildirim TEXT,
  guncellendi TEXT NOT NULL,
  tamamlandi  TEXT,
  UNIQUE (rapor_id, hakem_id)
);
CREATE INDEX IF NOT EXISTS ix_deg_rapor ON degerlendirme(rapor_id);
CREATE INDEX IF NOT EXISTS ix_deg_hakem ON degerlendirme(hakem_id);
CREATE INDEX IF NOT EXISTS ix_deg_durum ON degerlendirme(durum);

CREATE TABLE IF NOT EXISTS mesaj (
  id       TEXT PRIMARY KEY,
  rapor_id TEXT NOT NULL REFERENCES rapor(id) ON DELETE CASCADE,
  yazar    TEXT NOT NULL,
  rol      TEXT NOT NULL,
  metin    TEXT NOT NULL,
  tarih    TEXT NOT NULL,
  otomatik INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_mesaj_rapor ON mesaj(rapor_id);
`;

let db: DatabaseSync | null = null;

/**
 * Bağlantıyı döndürür; ilk çağrıda şemayı kurar.
 *
 * Next geliştirme kipinde modülleri yeniden yüklüyor. Bağlantı global
 * nesnede saklanmasa her sıcak yenilemede yeni bir bağlantı açılır ve
 * dosya kilidi çakışması yaşanır.
 */
export function baglanti(): DatabaseSync {
  if (db) return db;

  const g = globalThis as { __tprdsDb?: DatabaseSync };
  if (g.__tprdsDb) {
    db = g.__tprdsDb;
    return db;
  }

  if (!existsSync(VERI_DIZINI())) mkdirSync(VERI_DIZINI(), { recursive: true });

  const yeni = new DatabaseSync(DB_YOLU());

  /*
   * WAL kipi: okuma ve yazma birbirini kilitlemiyor. Üç hakem aynı anda
   * puan girerken koordinasyon panosunun donmaması için gerekli.
   *
   * foreign_keys SQLite'ta VARSAYILAN OLARAK KAPALI — açılmazsa yabancı
   * anahtarlar yalnızca belge süsü olur, silinen yarışmanın raporları
   * ortada kalır.
   */
  yeni.exec('PRAGMA journal_mode = WAL');
  yeni.exec('PRAGMA foreign_keys = ON');
  yeni.exec('PRAGMA busy_timeout = 5000');
  yeni.exec(SEMA);

  semayiYukselt(yeni);

  db = yeni;
  g.__tprdsDb = yeni;
  return yeni;
}

/** Şemanın ulaştığı en son sürüm. Alan eklendikçe artıyor. */
const SON_SURUM = 3;

/**
 * Şema sürüm yükseltmeleri.
 *
 * `CREATE TABLE IF NOT EXISTS` yalnızca YENİ veritabanını kurar; var olan
 * tabloya alan eklemez. Sürüm alanı en baştan vardı ama kullanılmıyordu —
 * ilk alan eklemesi gerektiğinde bu ortaya çıktı: yeni kurulumda `sistem`
 * sütunu oluşuyor, mevcut veritabanında oluşmuyordu.
 *
 * Yükseltmeler biriktirilerek uygulanıyor ve her biri kendi sürümünü
 * yazıyor; yarıda kesilen bir yükseltme bir sonraki açılışta kaldığı
 * yerden devam ediyor.
 */
function semayiYukselt(yeni: DatabaseSync): void {
  const s = yeni.prepare('SELECT surum FROM sema_surumu').get() as
    | { surum: number }
    | undefined;

  if (!s) {
    // Yeni veritabanı: SEMA zaten son hâli kurdu.
    yeni.prepare('INSERT INTO sema_surumu (surum) VALUES (?)').run(SON_SURUM);
    return;
  }

  let surum = s.surum;

  if (surum < 2) {
    /*
     * `hakem.sistem` alanı. Arşiv kaydı (eski puanların taşındığı sahte
     * hakem) panele girebiliyordu — kod aramasının büyük/küçük harfe
     * duyarlı olması onu KAZA ile engelliyordu, kural olarak değil.
     * Arama düzeltilince kaza da ortadan kalktı ve gerçek boşluk göründü.
     */
    const sutunlar = yeni.prepare('PRAGMA table_info(hakem)').all() as Array<{
      name: string;
    }>;
    if (!sutunlar.some((c) => c.name === 'sistem')) {
      yeni.exec('ALTER TABLE hakem ADD COLUMN sistem INTEGER NOT NULL DEFAULT 0');
    }
    // Arşiv kaydı koddan tanınıyor: geçişte sabit bu kodla yazılıyor.
    yeni.exec("UPDATE hakem SET sistem = 1, aktif = 0 WHERE kod = 'arsiv'");
    surum = 2;
    yeni.prepare('UPDATE sema_surumu SET surum = ?').run(surum);
  }

  if (surum < 3) {
    /*
     * `degerlendirme.geri_bildirim` alanı. Yarışmacıya giden metinler
     * eskiden doğrudan model çıktısından okunuyordu — hakem onayı yoktu ve
     * PRD'nin madde 06 sırası ("hakeme sunulur; sonuçlardan ... üretilir")
     * hakemin arada olmasını istiyor.
     */
    const sutunlar = yeni.prepare('PRAGMA table_info(degerlendirme)').all() as Array<{
      name: string;
    }>;
    if (!sutunlar.some((c) => c.name === 'geri_bildirim')) {
      yeni.exec('ALTER TABLE degerlendirme ADD COLUMN geri_bildirim TEXT');
    }
    surum = 3;
    yeni.prepare('UPDATE sema_surumu SET surum = ?').run(surum);
  }
}

/** JSON sütunu okur; bozuksa varsayılana döner. */
export function jsonOku<T>(ham: unknown, varsayilan: T): T {
  if (typeof ham !== 'string' || !ham) return varsayilan;
  try {
    return JSON.parse(ham) as T;
  } catch {
    return varsayilan;
  }
}

/** JSON sütununa yazar; undefined ise NULL. */
export function jsonYaz(deger: unknown): string | null {
  return deger === undefined || deger === null ? null : JSON.stringify(deger);
}

/** SQLite boolean tutmuyor; 0/1 dönüşümü tek yerde. */
export const bool = (v: unknown): boolean => v === 1 || v === true;
export const sayi = (v: boolean | undefined): number => (v ? 1 : 0);
