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
import { veriDizini } from '@/lib/yol';

const VERI_DIZINI = veriDizini;

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

/*
 * YARIŞMACI HESABI.
 *
 * ── NİYE HESAP, NİYE SADECE KOD DEĞİL ───────────────────────────────────
 * Erişim kodu tek bir başvuruya bağlıydı ve o başvuruyu koordinasyon
 * açıyordu. Yarışmacının kendi takımını kurması, takımına üye eklemesi ve
 * birden çok yarışmaya başvurması gerekiyor — bunların hiçbiri tek bir
 * başvuruya asılamaz. Profil de bir kişiye ait, bir başvuruya değil:
 * aynı kişi iki takımda olabilir.
 *
 * ── PAROLA ÖZETİ ────────────────────────────────────────────────────────
 * scrypt, rastgele tuzla. Parola hiçbir yerde açık saklanmıyor ve
 * 'parola_ozeti' alanı hiçbir sorguda dışarı çıkmıyor.
 */
CREATE TABLE IF NOT EXISTS yarismaci (
  id            TEXT PRIMARY KEY,
  -- Küçük harfe indirgenmiş biçimde saklanıyor: aynı e-posta iki kez
  -- kayıt olamasın diye tekillik bu alanda.
  eposta        TEXT NOT NULL UNIQUE,
  parola_ozeti  TEXT NOT NULL,
  ad_soyad      TEXT NOT NULL,
  telefon       TEXT,
  kurum         TEXT,
  sehir         TEXT,
  aktif         INTEGER NOT NULL DEFAULT 1,
  olusturuldu   TEXT NOT NULL,
  son_giris     TEXT
);

/*
 * OTURUM.
 *
 * İmzalı çerez yerine tabloda tutuluyor. Sebep: imzalama bir sunucu
 * sırrı gerektiriyor ve sır tanımlı değilse ya her yeniden başlatmada
 * oturumlar düşer ya da sabit bir sır koda gömülür. Tablodaki oturum
 * ayrıca İPTAL EDİLEBİLİR — parola değişince ya da hesap kapanınca açık
 * oturumlar tek sorguyla düşüyor.
 */
CREATE TABLE IF NOT EXISTS oturum (
  belirtec      TEXT PRIMARY KEY,
  yarismaci_id  TEXT NOT NULL REFERENCES yarismaci(id) ON DELETE CASCADE,
  olusturuldu   TEXT NOT NULL,
  son_kullanma  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_oturum_yarismaci ON oturum(yarismaci_id);

/*
 * TAKIM.
 *
 * ── NİYE BAŞVURUDAN AYRI ────────────────────────────────────────────────
 * Bir takım birden çok yarışmaya başvurabiliyor ve başvurular yıldan yıla
 * değişirken takım aynı kalıyor. Takımı başvurunun içine gömmek, aynı
 * takımın her başvuruda yeniden kurulması demekti.
 *
 * 'katilim_kodu' üyeleri davet etmek için: kaptan kodu paylaşıyor, üye
 * kendi hesabıyla girip takıma katılıyor. Böylece üye listesi elle
 * yazılmış adlardan değil, gerçek hesaplardan oluşuyor.
 */
CREATE TABLE IF NOT EXISTS takim (
  id            TEXT PRIMARY KEY,
  ad            TEXT NOT NULL,
  katilim_kodu  TEXT NOT NULL UNIQUE,
  kurum         TEXT,
  sehir         TEXT,
  danisman      TEXT,
  kaptan_id     TEXT NOT NULL REFERENCES yarismaci(id) ON DELETE CASCADE,
  olusturuldu   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_takim_kaptan ON takim(kaptan_id);

CREATE TABLE IF NOT EXISTS takim_uyesi (
  id            TEXT PRIMARY KEY,
  takim_id      TEXT NOT NULL REFERENCES takim(id) ON DELETE CASCADE,
  yarismaci_id  TEXT NOT NULL REFERENCES yarismaci(id) ON DELETE CASCADE,
  rol           TEXT NOT NULL DEFAULT 'uye',
  katildi       TEXT NOT NULL,
  -- Aynı kişi aynı takıma iki kez katılamaz.
  UNIQUE (takim_id, yarismaci_id)
);
CREATE INDEX IF NOT EXISTS ix_uye_takim     ON takim_uyesi(takim_id);
CREATE INDEX IF NOT EXISTS ix_uye_yarismaci ON takim_uyesi(yarismaci_id);

/*
 * BAŞVURU: yarışmacının kimliği ve panele giriş hakkı.
 *
 * ── NİYE AYRI TABLO, NİYE rapor'un İÇİNDE DEĞİL ─────────────────────────
 * Başvuru rapordan ÖNCE var oluyor ve rapor olmadan da var kalıyor. Kayıt
 * listesi yarışma açılınca içeri aktarılıyor; rapor haftalar sonra
 * yükleniyor, hiç yüklenmeyebiliyor da. Kimliği rapora gömmek "raporunu
 * henüz yüklememiş başvuru" diye bir şeyi imkânsız kılardı — oysa
 * koordinasyonun en çok bakacağı liste tam olarak o.
 *
 * ── NİYE ERİŞİM KODU ────────────────────────────────────────────────────
 * Yarışmacı artık raporunu KENDİSİ yüklüyor; yükleme bir yazma işlemi.
 * Başvuru numarası tek başına yeterli değil: numaralar sıralı ve tahmin
 * edilebilir, biri başkasının numarasına sahte rapor yükleyebilirdi.
 * Kod hakem kodlarıyla aynı üreticiden geliyor (kod.ts) — karışabilecek
 * harfler alfabede yok, çünkü bu kod da elle yazılıyor.
 */
CREATE TABLE IF NOT EXISTS basvuru (
  id            TEXT PRIMARY KEY,
  basvuru_no    TEXT NOT NULL UNIQUE,
  kod           TEXT NOT NULL UNIQUE,
  yarisma_id    TEXT NOT NULL REFERENCES yarisma(id) ON DELETE CASCADE,
  kategori_id   TEXT NOT NULL REFERENCES kategori(id) ON DELETE CASCADE,
  takim         TEXT NOT NULL,
  takim_id      TEXT,
  proje         TEXT,
  eposta        TEXT,
  /*
   * Başvuruyu yapan takım ve kişi. İKİSİ DE BOŞ OLABİLİR: koordinasyonun
   * listeden açtığı ön kayıtlı başvurularda henüz bir hesap yok. Yarışmacı
   * kayıt olup başvurusunu üstlendiğinde doluyor.
   *
   * 'takim_id' metin alanı (TEKNOFEST takım kimliği) İLE KARIŞMASIN diye
   * ad 'takim_kaydi_id': biri yarışmacının beyan ettiği kod, öteki bu
   * sistemdeki takım kaydı.
   */
  takim_kaydi_id TEXT REFERENCES takim(id) ON DELETE SET NULL,
  yarismaci_id   TEXT REFERENCES yarismaci(id) ON DELETE SET NULL,
  -- Pasif başvuru panele giremez ve rapor yükleyemez. Silmek yerine
  -- pasife almak: yüklenmiş raporu olan bir başvuruyu silmek raporu da
  -- götürürdü.
  aktif         INTEGER NOT NULL DEFAULT 1,
  olusturuldu   TEXT NOT NULL,
  notlar        TEXT
);
CREATE INDEX IF NOT EXISTS ix_basvuru_kod      ON basvuru(kod);
CREATE INDEX IF NOT EXISTS ix_basvuru_kategori ON basvuru(kategori_id);

CREATE TABLE IF NOT EXISTS rapor (
  id            TEXT PRIMARY KEY,
  yarisma_id    TEXT NOT NULL REFERENCES yarisma(id) ON DELETE CASCADE,
  kategori_id   TEXT NOT NULL REFERENCES kategori(id) ON DELETE CASCADE,
  basvuru_no    TEXT NOT NULL,
  /*
   * Hangi başvuru kaydından geldiği. BOŞ OLABİLİR: koordinasyonun
   * doğrudan yüklediği raporlarda başvuru kaydı yok ve bu meşru bir
   * durum — sistem yarışma ortasında devralınabilir, elde yalnızca
   * dosyalar olabilir. basvuru_no metni her hâlde dolu; bu alan yalnızca
   * "yarışmacı kendisi yükledi" bağını kuruyor.
   */
  basvuru_id    TEXT REFERENCES basvuru(id) ON DELETE SET NULL,
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
  -- Yazan hakemse kimliği. Görünen ad (yazar) kimlik değil; kim yazdı
  -- sorusunu ada göre çözmek isim değişince kopar.
  hakem_id TEXT REFERENCES hakem(id) ON DELETE SET NULL,
  -- HANGİ KANAL — kimin OKUYABİLECEĞİNİ belirliyor, kimin yazdığını değil.
  --   'koordinasyon' → yazan hakem + koordinasyon. Öteki hakemler GÖREMEZ.
  --   'kurul'        → rapora atanmış BÜTÜN hakemler + koordinasyon.
  -- İkisi ayrı eksen: rol yazarı, kanal okuyucuyu söylüyor.
  kanal    TEXT NOT NULL DEFAULT 'koordinasyon',
  metin    TEXT NOT NULL,
  tarih    TEXT NOT NULL,
  otomatik INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_mesaj_rapor ON mesaj(rapor_id);

/*
 * KAYNAKÇA DENETİMİ — ajanın çıktısı.
 *
 * Rapor tablosuna bir sütun olarak değil, AYRI TABLO olarak duruyor:
 * kayıt yalnızca kararı değil ADIM İZİNİ de taşıyor ve iz, kararın
 * kendisinden büyük. Rapor satırı her listelemede okunuyor; oraya
 * konsaydı hiç kimsenin bakmadığı bir iz, her rapor listesinde diskten
 * okunurdu.
 *
 * İz niye saklanıyor: ajanın kararı ancak NASIL vardığı görülebilirse
 * denetlenebilir. "Bu künye uydurma şüphesi" cümlesi tek başına bir
 * hakem için kara kutu; hangi indekste ne arandığı görününce hakem
 * katılmadığında nereye bakacağını biliyor.
 */
CREATE TABLE IF NOT EXISTS kaynakca_denetimi (
  rapor_id   TEXT PRIMARY KEY REFERENCES rapor(id) ON DELETE CASCADE,
  durum      TEXT NOT NULL,
  -- Ajanın kararı (bulgular + özet), JSON.
  karar      TEXT,
  -- Adım izi, JSON dizi.
  adimlar    TEXT NOT NULL,
  tur        INTEGER NOT NULL,
  maliyet    REAL NOT NULL,
  hata       TEXT,
  olusturuldu TEXT NOT NULL
);

/*
 * KOPYA SORUŞTURMASI — ikinci ajanın çıktısı.
 *
 * Anahtar ÇİFT: soruşturulan şey tek bir rapor değil, iki rapor
 * arasındaki bağ. Kimlikler SİRALI saklanıyor (küçük olan önce), yoksa
 * aynı çift iki ayrı satır olurdu ve ikinci soruşturma birincisini
 * bulamazdı.
 */
CREATE TABLE IF NOT EXISTS kopya_sorusturmasi (
  a_id        TEXT NOT NULL REFERENCES rapor(id) ON DELETE CASCADE,
  b_id        TEXT NOT NULL REFERENCES rapor(id) ON DELETE CASCADE,
  durum       TEXT NOT NULL,
  karar       TEXT,
  adimlar     TEXT NOT NULL,
  tur         INTEGER NOT NULL,
  maliyet     REAL NOT NULL,
  hata        TEXT,
  olusturuldu TEXT NOT NULL,
  PRIMARY KEY (a_id, b_id)
);

/*
 * BAŞVURU YAZIŞMASI — yarışmacı ↔ koordinasyon.
 *
 * ── NİYE 'mesaj' TABLOSUNU KULLANMIYOR ──────────────────────────────────
 * 'mesaj' rapora bağlı (rapor_id NOT NULL) ve hakem–koordinasyon
 * yazışması için kurulmuş. Yarışmacının yazmaya en çok ihtiyaç duyduğu
 * an ise raporun HENÜZ OLMADIĞI an: "yükleyemiyorum", "yanlış kategoriye
 * başvurdum", "süre doldu ama mazeretim var". O tabloya bağlanmak, bu
 * mesajların hiçbirini mümkün kılmazdı.
 *
 * Ayrıca izleyicileri farklı: hakem yazışması kör puanlamayı korumak için
 * yarışmacıdan gizli. İki yazışmayı tek tabloda tutmak, kanal süzgecinde
 * yapılacak tek bir hatayı hakem notlarının yarışmacıya sızması hâline
 * getirirdi. Ayrı tablo bu hatayı imkânsız kılıyor.
 */
CREATE TABLE IF NOT EXISTS basvuru_mesaji (
  id           TEXT PRIMARY KEY,
  basvuru_id   TEXT NOT NULL REFERENCES basvuru(id) ON DELETE CASCADE,
  -- 'yarismaci' | 'koordinasyon'
  yazar_rol    TEXT NOT NULL,
  yarismaci_id TEXT REFERENCES yarismaci(id) ON DELETE SET NULL,
  yazar_adi    TEXT NOT NULL,
  metin        TEXT NOT NULL,
  tarih        TEXT NOT NULL,
  -- Karşı taraf okudu mu. Koordinasyon panosundaki bekleyen sayacı bunu
  -- kullanıyor: cevapsız soru görünmez kalmasın.
  okundu       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_bmesaj_basvuru ON basvuru_mesaji(basvuru_id);
CREATE INDEX IF NOT EXISTS ix_bmesaj_okundu  ON basvuru_mesaji(okundu);
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
  gecisSonrasiIndeksler(yeni);

  db = yeni;
  g.__tprdsDb = yeni;
  return yeni;
}

/**
 * SONRADAN EKLENEN SÜTUNLARIN İNDEKSLERİ — geçişten SONRA kuruluyor.
 *
 * ── NİYE SEMA'NIN İÇİNDE DEĞİL ──────────────────────────────────────────
 * `SEMA` her açılışta ve geçişlerden ÖNCE koşuyor. Bir indeks orada
 * tanımlandığında, dayandığı sütunun o anda var olması gerekiyor. Yeni
 * kurulumda var — `CREATE TABLE` onu az önce oluşturdu. MEVCUT
 * veritabanında yok: `CREATE TABLE IF NOT EXISTS` var olan tabloya
 * dokunmuyor ve sütunu ekleyen `ALTER TABLE` henüz koşmadı.
 *
 * Bu tam olarak yaşandı: `ix_rapor_basvuru_id` SEMA'ya yazıldı ve
 * uygulama var olan her veritabanında "no such column: basvuru_id" ile
 * açılmayı reddetti. Hata geçişte değil, geçişten önceki adımdaydı —
 * yani geçiş kodu ne kadar doğru yazılırsa yazılsın çalışma fırsatı
 * bulamıyordu.
 *
 * Sonradan eklenen bir sütuna indeks gerekiyorsa yeri BURASI: iki yol da
 * (yeni kurulum ve yükseltilmiş veritabanı) buraya vardığında sütun
 * kesinlikle var.
 */
function gecisSonrasiIndeksler(yeni: DatabaseSync): void {
  yeni.exec('CREATE INDEX IF NOT EXISTS ix_rapor_basvuru_id ON rapor(basvuru_id)');
  yeni.exec('CREATE INDEX IF NOT EXISTS ix_basvuru_takim ON basvuru(takim_kaydi_id)');
  yeni.exec('CREATE INDEX IF NOT EXISTS ix_basvuru_yarismaci ON basvuru(yarismaci_id)');
}

/** Şemanın ulaştığı en son sürüm. Alan eklendikçe artıyor. */
const SON_SURUM = 10;

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

  if (surum < 4) {
    /*
     * `mesaj.kanal` ve `mesaj.hakem_id`.
     *
     * Ortak değerlendirilen raporlarda hakemler birbirlerinin
     * koordinasyona yazdığı mesajları GÖRÜYORDU — yazışma rapor bazlıydı
     * ve herkese açıktı. Bu, çok hakemli değerlendirmenin dayandığı
     * bağımsızlığı bozuyor: B hakemi, A'nın "bu rapor zayıf" notunu
     * puanlamadan önce okuyabiliyordu.
     *
     * Kanal ayrımı bunu çözüyor ve hakemler arası tartışmaya da ayrı bir
     * yer açıyor — ama o kanal herkes puanlamayı bitirene kadar kapalı.
     */
    const sutunlar = yeni.prepare('PRAGMA table_info(mesaj)').all() as Array<{
      name: string;
    }>;
    if (!sutunlar.some((c) => c.name === 'kanal')) {
      yeni.exec("ALTER TABLE mesaj ADD COLUMN kanal TEXT NOT NULL DEFAULT 'koordinasyon'");
    }
    if (!sutunlar.some((c) => c.name === 'hakem_id')) {
      // Var olan tabloya REFERENCES eklenemiyor; kimlik alanı yalın metin
      // olarak ekleniyor ve uygulama tarafında doldurulup okunuyor.
      yeni.exec('ALTER TABLE mesaj ADD COLUMN hakem_id TEXT');
    }
    surum = 4;
    yeni.prepare('UPDATE sema_surumu SET surum = ?').run(surum);
  }

  if (surum < 5) {
    /*
     * v4 ÖNCESİ HAKEM MESAJLARINA KİMLİK YAZILIYOR.
     *
     * v4 alanı ekledi ama ESKİ satırları boş bıraktı. Yazışma hakem
     * başına ayrı bir sohbete dönüşünce bu geçmiş kayıtlar sahipsiz
     * kaldı: koordinasyon "kime cevap veriyorum" diye baktığında eski
     * sorular hiçbir muhataba düşmüyordu.
     *
     * Kimlik uydurulmuyor, KURTARILIYOR: eski satırda yazarın adı
     * hakem kaydından harfi harfine kopyalanmıştı. Ad tek bir hakemle
     * eşleşiyorsa kimlik odur; iki hakem aynı adı taşıyorsa satır
     * olduğu gibi bırakılıyor — yanlış kimlik, boş kimlikten kötüdür.
     *
     * Koordinasyonun eski yanıtları bilerek boş kalıyor: o dönemde
     * yanıtlar zaten rapora atanmış herkese açıktı, yani gerçekten
     * duyuruydular. Geçmişi bugünün kuralına göre yeniden yazmıyoruz.
     */
    yeni.exec(
      "UPDATE mesaj SET hakem_id = ("
      + '  SELECT h.id FROM hakem h WHERE h.ad = mesaj.yazar'
      + ') '
      + "WHERE rol = 'hakem' AND hakem_id IS NULL AND ("
      + '  SELECT COUNT(*) FROM hakem h WHERE h.ad = mesaj.yazar'
      + ') = 1',
    );
    surum = 5;
    yeni.prepare('UPDATE sema_surumu SET surum = ?').run(surum);
  }

  if (surum < 6) {
    /*
     * BAŞVURU TABLOSU ve `rapor.basvuru_id`.
     *
     * Yarışmacı artık raporunu kendisi yüklüyor. Koordinasyonun her
     * raporu tek tek yüklemesi ölçeklenmiyordu: 90 değerlendirme birimi
     * ve binlerce rapor, tek bir ekipin dosya trafiğine bağlıydı.
     *
     * VAR OLAN RAPORLAR OLDUĞU GİBİ KALIYOR. Onlara başvuru kaydı
     * UYDURULMUYOR: koordinasyonun yüklediği bir raporun arkasında
     * gerçekten bir başvuru kaydı yok ve varmış gibi göstermek, "bu
     * raporu kim teslim etti" sorusuna yanlış cevap verirdi. Alan boş
     * kalıyor; boş olması doğru bilgidir.
     *
     * `CREATE TABLE IF NOT EXISTS` mevcut veritabanında da çalışıyor:
     * SEMA her açılışta koşuyor, tablo orada oluşuyor. Burada yalnızca
     * eski `rapor` tablosuna eksik sütun ekleniyor.
     */
    const sutunlar = yeni.prepare('PRAGMA table_info(rapor)').all() as Array<{
      name: string;
    }>;
    if (!sutunlar.some((c) => c.name === 'basvuru_id')) {
      // Var olan tabloya REFERENCES eklenemiyor (SQLite kısıtı); alan
      // yalın metin olarak ekleniyor. Yeni kurulumlarda SEMA gerçek
      // yabancı anahtarı kuruyor.
      yeni.exec('ALTER TABLE rapor ADD COLUMN basvuru_id TEXT');
    }
    // İndeks burada DEĞİL: `gecisSonrasiIndeksler()` kuruyor. Sebebi
    // orada yazıyor — yeni kurulum bu bloğa hiç uğramıyor.
    surum = 6;
    yeni.prepare('UPDATE sema_surumu SET surum = ?').run(surum);
  }

  if (surum < 7) {
    /*
     * YARIŞMACI HESABI, TAKIM, ÜYELİK, OTURUM.
     *
     * Yarışmacı portalı tek başvuruya bağlı bir koddan gerçek bir hesaba
     * geçti: kayıt olunuyor, profil dolduruluyor, takım kuruluyor, üye
     * ekleniyor ve yarışmaya başvuruluyor. Yeni tablolar SEMA'da; burada
     * yalnızca var olan `basvuru` tablosuna eksik sütunlar ekleniyor.
     *
     * ÖNCEDEN AÇILMIŞ BAŞVURULAR SAHİPSİZ KALIYOR ve bu doğru: onları
     * koordinasyon listeden açtı, arkalarında bir hesap YOK. Yarışmacı
     * kayıt olup başvurusunu üstlendiğinde alanlar doluyor. Var olmayan
     * bir sahiplik uydurmak, "bu başvuruyu kim yaptı" sorusuna yanlış
     * cevap verirdi.
     */
    const sutunlar = yeni.prepare('PRAGMA table_info(basvuru)').all() as Array<{
      name: string;
    }>;
    if (!sutunlar.some((c) => c.name === 'takim_kaydi_id')) {
      yeni.exec('ALTER TABLE basvuru ADD COLUMN takim_kaydi_id TEXT');
    }
    if (!sutunlar.some((c) => c.name === 'yarismaci_id')) {
      yeni.exec('ALTER TABLE basvuru ADD COLUMN yarismaci_id TEXT');
    }
    surum = 7;
    yeni.prepare('UPDATE sema_surumu SET surum = ?').run(surum);
  }

  if (surum < 8) {
    /*
     * BAŞVURU YAZIŞMASI.
     *
     * Sistem yarışmacıya birçok yerde "koordinasyonla iletişime geçin"
     * diyordu ama iletişim kuracak hiçbir yol yoktu — kullanıcıyı
     * olmayan bir kapıya yönlendiren bir metin. Tablo SEMA'da kuruluyor;
     * burada yapılacak bir alan eklemesi yok, sürüm yalnızca ilerliyor.
     */
    surum = 8;
    yeni.prepare('UPDATE sema_surumu SET surum = ?').run(surum);
  }

  if (surum < 9) {
    /*
     * KAYNAKÇA DENETİM AJANI.
     *
     * Tablo SEMA'da kuruluyor (CREATE TABLE IF NOT EXISTS), burada
     * yapılacak bir alan eklemesi yok; sürüm yalnızca ilerliyor ki
     * mevcut veritabanı da tabloyu almış sayılsın.
     */
    surum = 9;
    yeni.prepare('UPDATE sema_surumu SET surum = ?').run(surum);
  }

  if (surum < 10) {
    /* Kopya soruşturma ajanı — tablo SEMA'da; sürüm ilerliyor. */
    surum = 10;
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
