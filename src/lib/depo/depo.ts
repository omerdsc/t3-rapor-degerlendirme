/**
 * Veri katmanı — SQLite.
 *
 * ── NEDEN DEĞİŞTİ ───────────────────────────────────────────────────────
 * Önceki sürüm JSON dosyalarına yazıyordu. Üç şey onu yetersiz kıldı:
 *
 *   · Eşzamanlılık — birden çok hakem aynı anda puan girdiğinde dosya
 *     tabanlı yazma kuyruğu sıraya alıyor ama kaybı önlemiyordu.
 *   · Sorgu — "bu hakemin bitirmediği raporlar" sorusu bütün dosyaları
 *     okumadan yanıtlanamıyordu.
 *   · Bütünlük — atama ile değerlendirme arasındaki ilişkiyi doğrulayacak
 *     hiçbir mekanizma yoktu.
 *
 * ── API BİLEREK AYNI ────────────────────────────────────────────────────
 * Fonksiyon imzaları değişmedi: `yarismaGetir`, `raporlariListele`,
 * `raporGuncelle`… hepsi eskisi gibi. Böylece 20'den fazla ekran ve rota
 * dokunulmadan çalışıyor. Değişen yalnızca içerisi.
 *
 * Okumalar senkron, yazmalar Promise döndürüyor — eski API'nin beklentisi
 * buydu ve çağıran taraf `await` ediyor.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { baglanti, bool, jsonOku, jsonYaz, sayi } from '../db/baglanti';
import type { Mesaj, Rapor, RaporDurumu, Yarisma, YarismaKategorisi } from './tipler';
import type { Sablon, Seviye } from '../analiz/tipler';
import type { Rubrik, RubrikKriteri } from '../analiz/sablon-cikar';
import type { SakliParmakizi } from '../analiz/parmakizi-depo';
import { anahtar } from '../analiz/normalize';
import { veriDizini } from '@/lib/yol';

const DOSYA_DIZINI = () => join(veriDizini(), 'dosyalar');

export function kimlik(): string {
  return randomUUID();
}

// ------------------------------------------------------------ satır → nesne

type Satir = Record<string, unknown>;

function kategoriCoz(s: Satir): YarismaKategorisi {
  return {
    id: s.id as string,
    ad: s.ad as string,
    asama: (s.asama as string) ?? undefined,
    sablonDosyasi: s.sablon_dosyasi as string,
    olusturuldu: s.olusturuldu as string,
    duzenlendi: bool(s.duzenlendi),
    sablon: jsonOku<Sablon>(s.sablon, {} as Sablon),
    kurallar: jsonOku(s.kurallar, {} as YarismaKategorisi['kurallar']),
    rubrik: jsonOku<Rubrik>(s.rubrik, { kriterler: [], toplamPuan: 0 }),
    ornekKaynaklar: jsonOku<string[]>(s.ornek_kaynaklar, []),
    uyarilar: jsonOku<string[]>(s.uyarilar, []),
    sartname: s.sartname
      ? jsonOku<NonNullable<YarismaKategorisi['sartname']>>(
          s.sartname,
          undefined as never,
        )
      : undefined,
  };
}

function yarismaCoz(s: Satir, kategoriler: YarismaKategorisi[]): Yarisma {
  return {
    id: s.id as string,
    ad: s.ad as string,
    katalogSlug: (s.katalog_slug as string) ?? undefined,
    yil: s.yil as number,
    olusturuldu: s.olusturuldu as string,
    kategoriler,
    icerikKategorileri: jsonOku(s.icerik_kategorileri, []),
  };
}

function raporCoz(s: Satir, mesajlar: Mesaj[], parmakizi?: SakliParmakizi): Rapor {
  return {
    id: s.id as string,
    yarismaId: s.yarisma_id as string,
    kategoriId: s.kategori_id as string,
    basvuruNo: s.basvuru_no as string,
    dosyaAdi: s.dosya_adi as string,
    takim: s.takim as string,
    takimId: s.takim_id as string,
    proje: s.proje as string,
    icerikKategoriKodu: (s.icerik_kategori_kodu as string) ?? undefined,
    yuklendi: s.yuklendi as string,
    durum: s.durum as RaporDurumu,
    genelDurum: s.genel_durum as Seviye,
    kontroller: jsonOku(s.kontroller, []),
    istatistik: jsonOku(s.istatistik, {} as Rapor['istatistik']),
    kaynakDogrulamasi: s.kaynak_dogrulamasi
      ? jsonOku(s.kaynak_dogrulamasi, undefined as never)
      : undefined,
    aiDegerlendirme: s.ai_degerlendirme
      ? jsonOku(s.ai_degerlendirme, undefined as never)
      : undefined,
    raporKimligi: s.rapor_kimligi
      ? jsonOku(s.rapor_kimligi, undefined as never)
      : undefined,
    kimlikUyusmazligi: s.kimlik_uyusmazligi
      ? jsonOku(s.kimlik_uyusmazligi, undefined as never)
      : undefined,
    parmakizi,
    /*
     * ESKİ ALANLARIN YENİ ANLAMI.
     *
     * `hakemToplam` / `hakemNotu` artık raporun tek puanı değil, hakem
     * değerlendirmelerinden türetilen NİHAİ karar. Alan adları korunuyor
     * ki yarışmacı portalı, CSV ve pano dokunulmadan çalışsın.
     *
     * `hakemPuanlari` artık burada dolmuyor: puanlar hakem başına ayrı
     * tabloda. İhtiyaç duyan ekran `degerlendirmeleriGetir()` çağırıyor.
     */
    hakemToplam: (s.nihai_puan as number) ?? undefined,
    hakemNotu: (s.nihai_not as string) ?? undefined,
    tamamlandi: (s.tamamlandi as string) ?? undefined,
    mesajlar,
    dosyaYolu: (s.dosya_yolu as string) ?? undefined,
  };
}

// ---------------------------------------------------------------- yarışma

export function yarismaKaydet(y: Yarisma): Promise<Yarisma> {
  const db = baglanti();
  db.exec('BEGIN');
  try {
    db.prepare(
      `INSERT INTO yarisma (id, ad, yil, katalog_slug, olusturuldu, icerik_kategorileri)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET ad = excluded.ad, yil = excluded.yil,
         katalog_slug = excluded.katalog_slug,
         icerik_kategorileri = excluded.icerik_kategorileri`,
    ).run(
      y.id, y.ad, y.yil, y.katalogSlug ?? null, y.olusturuldu,
      JSON.stringify(y.icerikKategorileri ?? []),
    );

    const ekle = db.prepare(
      `INSERT INTO kategori (id, yarisma_id, ad, asama, sablon_dosyasi, olusturuldu,
         duzenlendi, sablon, kurallar, rubrik, ornek_kaynaklar, uyarilar, sartname)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET ad = excluded.ad, asama = excluded.asama,
         sablon_dosyasi = excluded.sablon_dosyasi, duzenlendi = excluded.duzenlendi,
         sablon = excluded.sablon, kurallar = excluded.kurallar,
         rubrik = excluded.rubrik, ornek_kaynaklar = excluded.ornek_kaynaklar,
         uyarilar = excluded.uyarilar, sartname = excluded.sartname`,
    );
    for (const k of y.kategoriler) {
      ekle.run(
        k.id, y.id, k.ad, k.asama ?? null, k.sablonDosyasi, k.olusturuldu,
        sayi(k.duzenlendi), JSON.stringify(k.sablon), JSON.stringify(k.kurallar),
        JSON.stringify(k.rubrik), JSON.stringify(k.ornekKaynaklar ?? []),
        JSON.stringify(k.uyarilar ?? []), jsonYaz(k.sartname),
      );
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return Promise.resolve(yarismaGetir(y.id)!);
}

function kategorileriGetir(yarismaId: string): YarismaKategorisi[] {
  return (
    baglanti()
      .prepare('SELECT * FROM kategori WHERE yarisma_id = ? ORDER BY olusturuldu')
      .all(yarismaId) as Satir[]
  ).map(kategoriCoz);
}

export function yarismaGetir(id: string): Yarisma | null {
  const s = baglanti().prepare('SELECT * FROM yarisma WHERE id = ?').get(id) as
    | Satir
    | undefined;
  return s ? yarismaCoz(s, kategorileriGetir(id)) : null;
}

export function yarismalariListele(): Yarisma[] {
  const satirlar = baglanti()
    .prepare('SELECT * FROM yarisma ORDER BY olusturuldu DESC')
    .all() as Satir[];
  return satirlar.map((s) => yarismaCoz(s, kategorileriGetir(s.id as string)));
}

// --------------------------------------------------------------- kategori

export function kategoriEkle(
  yarismaId: string,
  kategori: YarismaKategorisi,
): Promise<Yarisma | null> {
  const y = yarismaGetir(yarismaId);
  if (!y) return Promise.resolve(null);
  return yarismaKaydet({ ...y, kategoriler: [...y.kategoriler, kategori] });
}

export function kategoriGetir(
  yarismaId: string,
  kategoriId: string,
): YarismaKategorisi | null {
  const s = baglanti()
    .prepare('SELECT * FROM kategori WHERE id = ? AND yarisma_id = ?')
    .get(kategoriId, yarismaId) as Satir | undefined;
  return s ? kategoriCoz(s) : null;
}

function kategoriYaz(yarismaId: string, k: YarismaKategorisi): void {
  baglanti()
    .prepare(
      `UPDATE kategori SET ad = ?, asama = ?, sablon_dosyasi = ?, duzenlendi = ?,
         sablon = ?, kurallar = ?, rubrik = ?, ornek_kaynaklar = ?, uyarilar = ?,
         sartname = ?
       WHERE id = ? AND yarisma_id = ?`,
    )
    .run(
      k.ad, k.asama ?? null, k.sablonDosyasi, sayi(k.duzenlendi),
      JSON.stringify(k.sablon), JSON.stringify(k.kurallar), JSON.stringify(k.rubrik),
      JSON.stringify(k.ornekKaynaklar ?? []), JSON.stringify(k.uyarilar ?? []),
      jsonYaz(k.sartname), k.id, yarismaId,
    );
}

/** Yöneticinin elle düzeltmesi — onayı da beraberinde verir. */
export function kategoriGuncelle(
  yarismaId: string,
  kategoriId: string,
  degisiklik: Partial<Pick<YarismaKategorisi, 'ad' | 'sablon' | 'rubrik' | 'kurallar'>>,
): Promise<YarismaKategorisi | null> {
  const k = kategoriGetir(yarismaId, kategoriId);
  if (!k) return Promise.resolve(null);
  const guncel: YarismaKategorisi = { ...k, ...degisiklik, duzenlendi: true };
  kategoriYaz(yarismaId, guncel);
  return Promise.resolve(guncel);
}

/**
 * Şablondan gelen kısmı tazeler ve ONAYI SIFIRLAR.
 *
 * `kategoriGuncelle`'den ayrı: orada insan düzeltti (dolayısıyla onayladı),
 * burada şablon dışarıdan değişti (dolayısıyla onay geçersiz).
 */
export function kategoriSablonuTazele(
  yarismaId: string,
  kategoriId: string,
  degisiklik: Partial<
    Pick<
      YarismaKategorisi,
      'sablonDosyasi' | 'asama' | 'sablon' | 'kurallar' | 'rubrik'
        | 'ornekKaynaklar' | 'uyarilar'
    >
  >,
): Promise<YarismaKategorisi | null> {
  const k = kategoriGetir(yarismaId, kategoriId);
  if (!k) return Promise.resolve(null);
  const guncel: YarismaKategorisi = { ...k, ...degisiklik, duzenlendi: false };
  kategoriYaz(yarismaId, guncel);
  return Promise.resolve(guncel);
}

export function kriterEkle(
  yarismaId: string,
  kategoriId: string,
  kriter: RubrikKriteri,
): Promise<YarismaKategorisi | null> {
  const k = kategoriGetir(yarismaId, kategoriId);
  if (!k) return Promise.resolve(null);
  if (k.rubrik.kriterler.some((x) => x.kod === kriter.kod)) return Promise.resolve(k);
  const kriterler = [...k.rubrik.kriterler, kriter];
  return kategoriGuncelle(yarismaId, kategoriId, {
    rubrik: { kriterler, toplamPuan: kriterler.reduce((t, x) => t + x.puan, 0) },
  });
}

export function kriterSil(
  yarismaId: string,
  kategoriId: string,
  kriterKodu: string,
): Promise<YarismaKategorisi | null> {
  const k = kategoriGetir(yarismaId, kategoriId);
  if (!k) return Promise.resolve(null);
  const kriterler = k.rubrik.kriterler.filter((x) => x.kod !== kriterKodu);
  return kategoriGuncelle(yarismaId, kategoriId, {
    rubrik: { kriterler, toplamPuan: kriterler.reduce((t, x) => t + x.puan, 0) },
  });
}

export function kategoriOnayla(
  yarismaId: string,
  kategoriId: string,
  onayli = true,
): Promise<YarismaKategorisi | null> {
  const k = kategoriGetir(yarismaId, kategoriId);
  if (!k) return Promise.resolve(null);
  const guncel = { ...k, duzenlendi: onayli };
  kategoriYaz(yarismaId, guncel);
  return Promise.resolve(guncel);
}

/** Kategoriye şartname bağlar; şartname sayfa sınırı şablonu ezer. */
export function sartnameKaydet(
  yarismaId: string,
  kategoriId: string,
  sartname: NonNullable<YarismaKategorisi['sartname']>,
): Promise<YarismaKategorisi | null> {
  const k = kategoriGetir(yarismaId, kategoriId);
  if (!k) return Promise.resolve(null);
  const guncel: YarismaKategorisi = {
    ...k,
    sartname,
    sablon: {
      ...k.sablon,
      asgariSayfa: sartname.kurallar.asgariSayfa ?? k.sablon.asgariSayfa,
      azamiSayfa: sartname.kurallar.azamiSayfa ?? k.sablon.azamiSayfa,
    },
  };
  kategoriYaz(yarismaId, guncel);
  return Promise.resolve(guncel);
}

// ------------------------------------------------------------------ rapor

export function mesajlariGetir(raporId: string): Mesaj[] {
  return (
    baglanti()
      .prepare('SELECT * FROM mesaj WHERE rapor_id = ? ORDER BY tarih')
      .all(raporId) as Satir[]
  ).map((m) => ({
    id: m.id as string,
    yazar: m.yazar as string,
    rol: m.rol as Mesaj['rol'],
    hakemId: (m.hakem_id as string) ?? undefined,
    kanal: ((m.kanal as string) ?? 'koordinasyon') as Mesaj['kanal'],
    metin: m.metin as string,
    tarih: m.tarih as string,
    otomatikMi: bool(m.otomatik) || undefined,
  }));
}

function parmakiziGetir(raporId: string): SakliParmakizi | undefined {
  const s = baglanti()
    .prepare('SELECT veri FROM parmakizi WHERE rapor_id = ?')
    .get(raporId) as { veri: string } | undefined;
  return s ? jsonOku<SakliParmakizi>(s.veri, undefined as never) : undefined;
}

export function raporKaydet(r: Rapor): Promise<Rapor> {
  const db = baglanti();
  db.exec('BEGIN');
  try {
    db.prepare(
      `INSERT INTO rapor (id, yarisma_id, kategori_id, basvuru_no, dosya_adi,
         takim, takim_id, proje, icerik_kategori_kodu, yuklendi, durum,
         genel_durum, kontroller, istatistik, kaynak_dogrulamasi,
         ai_degerlendirme, rapor_kimligi, kimlik_uyusmazligi, dosya_yolu,
         nihai_puan, nihai_not, tamamlandi)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         basvuru_no = excluded.basvuru_no, takim = excluded.takim,
         takim_id = excluded.takim_id, proje = excluded.proje,
         durum = excluded.durum, genel_durum = excluded.genel_durum,
         kontroller = excluded.kontroller, istatistik = excluded.istatistik,
         kaynak_dogrulamasi = excluded.kaynak_dogrulamasi,
         ai_degerlendirme = excluded.ai_degerlendirme,
         rapor_kimligi = excluded.rapor_kimligi,
         kimlik_uyusmazligi = excluded.kimlik_uyusmazligi,
         dosya_yolu = excluded.dosya_yolu, nihai_puan = excluded.nihai_puan,
         nihai_not = excluded.nihai_not, tamamlandi = excluded.tamamlandi`,
    ).run(
      r.id, r.yarismaId, r.kategoriId, r.basvuruNo, r.dosyaAdi,
      r.takim, r.takimId, r.proje, r.icerikKategoriKodu ?? null,
      r.yuklendi, r.durum, r.genelDurum,
      JSON.stringify(r.kontroller ?? []), JSON.stringify(r.istatistik),
      jsonYaz(r.kaynakDogrulamasi), jsonYaz(r.aiDegerlendirme),
      jsonYaz(r.raporKimligi), jsonYaz(r.kimlikUyusmazligi),
      r.dosyaYolu ?? null, r.hakemToplam ?? null, r.hakemNotu ?? null,
      r.tamamlandi ?? null,
    );

    if (r.parmakizi) {
      db.prepare(
        `INSERT INTO parmakizi (rapor_id, veri) VALUES (?, ?)
         ON CONFLICT(rapor_id) DO UPDATE SET veri = excluded.veri`,
      ).run(r.id, JSON.stringify(r.parmakizi));
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return Promise.resolve(raporGetir(r.id)!);
}

export function raporGetir(id: string): Rapor | null {
  const s = baglanti().prepare('SELECT * FROM rapor WHERE id = ?').get(id) as
    | Satir
    | undefined;
  return s ? raporCoz(s, mesajlariGetir(id), parmakiziGetir(id)) : null;
}

/**
 * Liste görünümü — parmak izi OKUNMUYOR.
 *
 * Rapor başına ~40 KB ve yalnızca kopya taramasında gerekiyor. Listede
 * okunsa 100 raporluk bir kategori 4 MB gereksiz veri taşırdı.
 */
export function raporlariListele(yarismaId?: string, kategoriId?: string): Rapor[] {
  let sql = 'SELECT * FROM rapor';
  const p: string[] = [];
  if (yarismaId) {
    sql += ' WHERE yarisma_id = ?';
    p.push(yarismaId);
    if (kategoriId) {
      sql += ' AND kategori_id = ?';
      p.push(kategoriId);
    }
  }
  sql += ' ORDER BY yuklendi DESC';

  return (baglanti().prepare(sql).all(...p) as Satir[]).map((s) =>
    raporCoz(s, [], undefined),
  );
}

/**
 * Hakemin sorup koordinasyonun cevaplamadığı yazışmalar — TEK sorguda.
 *
 * ── NİYE VAR: MESAJ ULAŞMIYORDU ─────────────────────────────────────────
 * Yazışma rapor sayfasının en altındaydı ve orada kalıyordu. Hakem bir
 * soru sorduğunda koordinasyonun bunu görmesi için o raporu AÇMASI
 * gerekiyordu — yani soruyu görmek için sorunun varlığını bilmek
 * gerekiyordu. Ulaşmayan mesaj, mesaj değildir.
 *
 * Cevap bekleyen soru artık panoda "yapılacak iş" olarak sayılıyor ve
 * rapor listesinde işaretleniyor.
 *
 * Durum SAKLANMIYOR, türetiliyor: son insan mesajı hakemden geldiyse
 * cevap bekliyor. Kural `yazisma-durum.ts` içinde ve test kapsamında.
 */
export function cevapBekleyenYazismalar(
  yarismaId?: string,
  kategoriId?: string,
): Array<{
  raporId: string;
  basvuruNo: string;
  proje: string;
  tarih: string;
  /** Soruyu soran hakem — koordinasyon kime cevap vereceğini bilsin. */
  hakemAdi: string;
  /** v4 öncesi kayıtlarda boş olabilir; liste anahtarı bu yüzden çift. */
  hakemId?: string;
}> {
  /*
   * Kapsam koşulu parça parça kuruluyor. SQL'i dize yamalarıyla düzeltmek
   * (`.replace(...)`) bir kez denendi ve boşluk/satır sonu farkı yüzünden
   * sessizce tutmadı — koşul baştan doğru kurulmalı.
   */
  /*
   * KURUL MESAJI KOORDİNASYONU BEKLETMİYOR.
   *
   * Kanal ayrımı eklendikten sonra bu sorgu eksik kaldı: hakemin ÖTEKİ
   * HAKEME yazdığı bir kurul mesajı da "koordinasyon cevap vermeli" diye
   * sayılıyordu. Kurul hakemler arası bir konuşma; koordinasyon oraya
   * cevap vermek zorunda değil.
   */
  const kosullar = [
    "m.rol <> 'sistem'",
    'm.otomatik = 0',
    "m.kanal = 'koordinasyon'",
  ];
  const p: string[] = [];
  if (yarismaId) {
    kosullar.unshift('r.yarisma_id = ?');
    p.push(yarismaId);
    if (kategoriId) {
      kosullar.splice(1, 0, 'r.kategori_id = ?');
      p.push(kategoriId);
    }
  }

  /*
   * HAKEM BAŞINA SON İNSAN MESAJI — rapor başına değil.
   *
   * İlk sürüm rapor başına bakıyordu ve çok hakemli raporda yanlış cevap
   * veriyordu: A hakemine yanıt yazılınca B'nin cevapsız sorusu da
   * listeden düşüyordu, çünkü "raporun son mesajı" artık koordinasyondan
   * geliyordu. Koordinasyon kanalı tek sohbet değil — hakem başına ayrı
   * sohbet; bekleyiş de hakem başına.
   *
   * Kimliksiz satırlar (v4 öncesi kayıtlar ve herkese açık duyurular)
   * COALESCE ile tek bir ortak sohbet sayılıyor: eski davranış orada
   * aynen korunuyor.
   *
   * Sistem mesajları ve otomatik kayıtlar dışarıda: "değerlendirme
   * tamamlandı" bir cevap değil.
   */
  const satirlar = baglanti()
    .prepare(
      `SELECT r.id, r.basvuru_no, r.proje, m.rol, m.tarih, m.yazar, m.hakem_id
         FROM rapor r
         JOIN mesaj m ON m.rapor_id = r.id
        WHERE ${kosullar.join(' AND ')}
          AND m.tarih = (
            SELECT MAX(x.tarih) FROM mesaj x
             WHERE x.rapor_id = r.id AND x.rol <> 'sistem'
               AND x.otomatik = 0 AND x.kanal = 'koordinasyon'
               AND COALESCE(x.hakem_id, '') = COALESCE(m.hakem_id, '')
          )`,
    )
    .all(...p) as Array<Record<string, string>>;

  return satirlar
    .filter((s) => s.rol === 'hakem')
    .map((s) => ({
      raporId: s.id,
      basvuruNo: s.basvuru_no,
      proje: s.proje,
      tarih: s.tarih,
      hakemAdi: s.yazar,
      hakemId: s.hakem_id ?? undefined,
    }));
}

/**
 * Yarışma ve kategori başına rapor sayısı — TEK sorguda.
 *
 * ── NİYE VAR: ÖLÇÜLMÜŞ BİR N+1 SORUNU ───────────────────────────────────
 * Yarışma ve kategori açılır listeleri her seçeneğin yanında rapor sayısı
 * gösteriyor ve bunu `raporlariListele(y.id).length` ile alıyordu. 44
 * yarışma = 44 tam tablo taraması, her biri bütün satırları JSON olarak
 * çözerek. `npm run hacim -- 1000` bunu yakaladı: rapor listesi ekranı
 * 1,5 saniye sürüyordu ve süre satır sayısından değil bu sayaçlardan
 * geliyordu.
 *
 * Sayı için satırları ÇÖZMEK gerekmiyor; `COUNT` yeterli.
 */
export function raporSayilari(): {
  yarismaya: Map<string, number>;
  kategoriye: Map<string, number>;
} {
  const satirlar = baglanti()
    .prepare(
      `SELECT yarisma_id, kategori_id, COUNT(*) AS n
         FROM rapor GROUP BY yarisma_id, kategori_id`,
    )
    .all() as Array<{ yarisma_id: string; kategori_id: string; n: number }>;

  const yarismaya = new Map<string, number>();
  const kategoriye = new Map<string, number>();
  for (const s of satirlar) {
    const n = Number(s.n) || 0;
    yarismaya.set(s.yarisma_id, (yarismaya.get(s.yarisma_id) ?? 0) + n);
    kategoriye.set(s.kategori_id, n);
  }
  return { yarismaya, kategoriye };
}

/**
 * Parmak izi çıkarılmış rapor sayısı.
 *
 * Kanıt tablosu için var. Parmak izleri `rapor` tablosundan ayrıldıktan
 * sonra `r.parmakizi` alanı listelerde hep boş kaldı ve kanıt betiği
 * "0 parmak izi" yazmaya başladı — kanıt olduğu söylenen yerde yanlış
 * sayı. Sayım kaynağa, yani tabloya sorulmalı.
 */
export function parmakiziSayisi(): number {
  const s = baglanti()
    .prepare('SELECT COUNT(*) AS n FROM parmakizi')
    .get() as { n: number };
  return Number(s.n) || 0;
}

/** Kopya taraması için: parmak izleri DAHİL. */
export function parmakizliRaporlar(
  yarismaId: string,
  kategoriId?: string,
): Array<{ rapor: Rapor; parmakizi: SakliParmakizi }> {
  const sql = kategoriId
    ? `SELECT r.*, p.veri AS pveri FROM rapor r
       JOIN parmakizi p ON p.rapor_id = r.id
       WHERE r.yarisma_id = ? AND r.kategori_id = ?`
    : `SELECT r.*, p.veri AS pveri FROM rapor r
       JOIN parmakizi p ON p.rapor_id = r.id
       WHERE r.yarisma_id = ?`;
  const p = kategoriId ? [yarismaId, kategoriId] : [yarismaId];

  return (baglanti().prepare(sql).all(...p) as Satir[]).map((s) => {
    const pi = jsonOku<SakliParmakizi>(s.pveri, undefined as never);
    return { rapor: raporCoz(s, [], pi), parmakizi: pi };
  });
}

export function raporGuncelle(
  id: string,
  degisiklik: Partial<Rapor>,
): Promise<Rapor | null> {
  const r = raporGetir(id);
  if (!r) return Promise.resolve(null);
  return raporKaydet({ ...r, ...degisiklik });
}

/**
 * Başvuru numarasına ait BÜTÜN raporlar.
 *
 * ── NİYE ÇOĞUL ──────────────────────────────────────────────────────────
 * Eskiden tek rapor dönüyordu (`.find()` ile ilk eşleşme). Bir başvuru
 * numarasına iki rapor bağlıysa yarışmacı HANGİSİNİ göreceği tablo
 * sırasına kalmıştı — rastgele. Bir takım birden çok yarışmaya
 * katıldığında da yalnızca birini görüyordu.
 *
 * Şimdi hepsi dönüyor ve yarışmacı aralarında seçim yapıyor. Sıra
 * belirlenmiş (yükleme tarihi): aynı girdi her zaman aynı sırayı veriyor.
 *
 * Not: başvuru numarası bu portalın TEK kimlik kanıtı. Numarayı bilen o
 * başvurunun sahibi sayılıyor; dolayısıyla aynı numaraya bağlı raporların
 * tamamını görmesi doğru. Numaranın tekilliği veri girişinin sorumluluğu
 * ve `npm run db:kontrol` yinelenenleri bildiriyor.
 */
export function raporlariBasvuruNoIle(basvuruNo: string): Rapor[] {
  const hedef = anahtar(basvuruNo);
  // Karşılaştırma anahtar() üzerinden: yarışmacı numarayı boşluklu ya da
  // farklı büyük/küçük harfle girebiliyor. SQL LIKE bunu yapamaz.
  const satirlar = baglanti()
    .prepare('SELECT * FROM rapor ORDER BY yuklendi, id')
    .all() as Satir[];
  return satirlar
    .filter((x) => anahtar(x.basvuru_no as string) === hedef)
    .map((s) => raporCoz(s, mesajlariGetir(s.id as string), undefined));
}

/** Tek rapor gerektiren yerler için — ilk eşleşme. */
export function raporBasvuruNoIle(basvuruNo: string): Rapor | null {
  return raporlariBasvuruNoIle(basvuruNo)[0] ?? null;
}

export function mesajEkle(
  raporId: string,
  mesaj: Omit<Mesaj, 'id' | 'tarih'> & { tarih?: string },
): Promise<Rapor | null> {
  baglanti()
    .prepare(
      `INSERT INTO mesaj (id, rapor_id, yazar, rol, hakem_id, kanal,
         metin, tarih, otomatik)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      randomUUID(), raporId, mesaj.yazar, mesaj.rol,
      mesaj.hakemId ?? null, mesaj.kanal ?? 'koordinasyon', mesaj.metin,
      mesaj.tarih ?? new Date().toISOString(), sayi(mesaj.otomatikMi),
    );
  return Promise.resolve(raporGetir(raporId));
}

// ------------------------------------------------------------------ dosya

/**
 * Rapor PDF'i dosya sisteminde kalıyor, veritabanında değil.
 *
 * 25 MB'lık PDF'leri SQLite'a gömmek veritabanını şişirir ve her yedekleme
 * onları taşır. İkili büyük veri için doğru yer dosya sistemi; veritabanı
 * yalnızca yolu tutuyor.
 */
export function dosyaKaydet(raporId: string, veri: Uint8Array): string {
  const dizin = DOSYA_DIZINI();
  if (!existsSync(dizin)) mkdirSync(dizin, { recursive: true });
  const yol = join(dizin, `${raporId}.pdf`);
  writeFileSync(yol, veri);
  return yol;
}

export function dosyaOku(raporId: string): Buffer | null {
  const yol = join(DOSYA_DIZINI(), `${raporId}.pdf`);
  return existsSync(yol) ? readFileSync(yol) : null;
}

// ------------------------------------------------------------------- pano

export interface PanoOzeti {
  toplam: number;
  bekleyen: number;
  analizde: number;
  tamamlanan: number;
  manuelInceleme: number;
  bayrakli: number;
  ortalamaSapma: number | null;
  uyumOrani: number | null;
  toplamMaliyet: number;
  raporBasinaMaliyet: number | null;
  /** Yapay zekâ ön değerlendirmesi yapılmış rapor sayısı. */
  degerlendirilenRapor: number;
  /** Bunların kaçı önbellekten geldi — ücretsiz. */
  onbellektenGelen: number;
}

export function panoOzeti(yarismaId?: string, kategoriId?: string): PanoOzeti {
  const raporlar = raporlariListele(yarismaId, kategoriId);

  const tamamlananlar = raporlar.filter(
    (r) => r.durum === 'tamamlandi' && r.hakemToplam !== undefined && r.aiDegerlendirme,
  );
  const sapmalar = tamamlananlar.map(
    (r) => Math.abs((r.hakemToplam ?? 0) - (r.aiDegerlendirme?.aiToplam ?? 0)),
  );
  /*
   * ── ÖNBELLEK RAPOR BAŞINA MALİYETİ DÜŞÜRÜR, YÜKSELTMEZ ────────────────
   * Burada eskiden `.filter((m) => m > 0)` vardı: maliyeti sıfır olan
   * raporlar paydadan DÜŞÜYORDU. Sonuç ters: önbellekten gelen her rapor
   * ortalamayı yükseltiyordu. Ölçüldü — 6 rapor $0,7857 tuttu, gerçek
   * ortalama $0,131; pano $0,157 gösteriyordu çünkü 5'e bölüyordu.
   *
   * Önbellek bu sistemin maliyet korumasının yarısı; kazancını gizleyen
   * bir sayı, olmayan bir sayıdan kötüdür. Payda artık DEĞERLENDİRİLMİŞ
   * rapor sayısı: sıfır maliyetli rapor da değerlendirilmiştir.
   */
  const degerlendirilenler = raporlar.filter((r) => r.aiDegerlendirme);
  const maliyetler = degerlendirilenler.map(
    (r) => r.aiDegerlendirme?.kullanim.maliyet ?? 0,
  );
  const onbellekten = maliyetler.filter((m) => m === 0).length;

  return {
    toplam: raporlar.length,
    bekleyen: raporlar.filter((r) => r.durum === 'hakem_bekliyor').length,
    analizde: raporlar.filter(
      (r) => r.durum === 'analiz_ediliyor' || r.durum === 'yuklendi',
    ).length,
    tamamlanan: raporlar.filter((r) => r.durum === 'tamamlandi').length,
    manuelInceleme: raporlar.filter((r) => r.durum === 'manuel_inceleme').length,
    bayrakli: raporlar.filter((r) => r.genelDurum === 'hata').length,
    ortalamaSapma: sapmalar.length
      ? Math.round((sapmalar.reduce((a, b) => a + b, 0) / sapmalar.length) * 10) / 10
      : null,
    uyumOrani: sapmalar.length
      ? Math.round((sapmalar.filter((s) => s <= 5).length / sapmalar.length) * 100)
      : null,
    toplamMaliyet: maliyetler.reduce((a, b) => a + b, 0),
    raporBasinaMaliyet: maliyetler.length
      ? maliyetler.reduce((a, b) => a + b, 0) / maliyetler.length
      : null,
    degerlendirilenRapor: degerlendirilenler.length,
    onbellektenGelen: onbellekten,
  };
}
