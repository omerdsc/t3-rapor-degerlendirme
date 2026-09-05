/**
 * Başvuru kayıtları — yarışmacının kimliği ve panele giriş hakkı.
 *
 * ── NİYE VAR ────────────────────────────────────────────────────────────
 * Raporları koordinasyon tek tek yüklüyordu. 90 değerlendirme birimi ve
 * binlerce rapor düşünüldüğünde bu bir darboğaz: dosya trafiğinin tamamı
 * tek bir ekipten geçiyor ve ekip büyüdükçe değil, rapor sayısı arttıkça
 * yavaşlıyor. Artık raporu yarışmacı yüklüyor; koordinasyonun işi N dosya
 * yüklemekten bir kez başvuru listesi aktarmaya iniyor.
 *
 * ── GİRİŞ NİYE İKİ ALANLI ───────────────────────────────────────────────
 * Hakem paneline tek bir kodla giriliyor ve bu orada yeterli: hakem
 * yalnızca okuyor ve puanlıyor, kodu da koordinasyon elle veriyor.
 * Yarışmacı ise DOSYA YÜKLÜYOR ve başvuru numaraları tahmin edilebilir
 * (TF-2026-04871'in yanında 04872 var). Numara tek başına kimlik olsaydı
 * başkasının numarasına sahte rapor yüklenebilirdi. Numara + kod ikilisi
 * bunu kapatıyor: numara kimin olduğunu, kod o kişi olduğunu söylüyor.
 */

import { baglanti } from './baglanti';
import { kodNormal, kodUret } from './kod';
import { kimlik } from '@/lib/depo/depo';

export interface Basvuru {
  id: string;
  basvuruNo: string;
  kod: string;
  yarismaId: string;
  kategoriId: string;
  takim: string;
  takimId?: string;
  proje?: string;
  eposta?: string;
  aktif: boolean;
  olusturuldu: string;
  notlar?: string;
  /** Bu sistemdeki takım kaydı. Ön kayıtlı başvurularda boş. */
  takimKaydiId?: string;
  /** Başvuruyu yapan hesap. Ön kayıtlı başvurularda boş. */
  yarismaciId?: string;
}

type Satir = {
  id: string;
  basvuru_no: string;
  kod: string;
  yarisma_id: string;
  kategori_id: string;
  takim: string;
  takim_id: string | null;
  proje: string | null;
  eposta: string | null;
  aktif: number;
  olusturuldu: string;
  notlar: string | null;
  takim_kaydi_id: string | null;
  yarismaci_id: string | null;
};

function coz(s: Satir): Basvuru {
  return {
    id: s.id,
    basvuruNo: s.basvuru_no,
    kod: s.kod,
    yarismaId: s.yarisma_id,
    kategoriId: s.kategori_id,
    takim: s.takim,
    takimId: s.takim_id ?? undefined,
    proje: s.proje ?? undefined,
    eposta: s.eposta ?? undefined,
    aktif: s.aktif === 1,
    olusturuldu: s.olusturuldu,
    notlar: s.notlar ?? undefined,
    takimKaydiId: s.takim_kaydi_id ?? undefined,
    yarismaciId: s.yarismaci_id ?? undefined,
  };
}

/**
 * Çakışmayan kod üretir.
 *
 * Alfabe 31 karakter, 8 hane → ~8.5×10^11 olasılık. Çakışma pratikte
 * görülmez ama `kod` sütunu UNIQUE: çakışma olursa INSERT patlar ve
 * kaydın kaybolmasına yol açardı. Denemek ucuz, patlamak pahalı.
 */
function benzersizKod(): string {
  const db = baglanti();
  for (let deneme = 0; deneme < 12; deneme++) {
    const k = kodUret();
    const varMi = db
      .prepare(
        `SELECT 1 FROM basvuru WHERE UPPER(REPLACE(kod, '-', '')) = ?
          UNION ALL
         SELECT 1 FROM hakem   WHERE UPPER(REPLACE(kod, '-', '')) = ?`,
      )
      .get(kodNormal(k), kodNormal(k));
    if (!varMi) return k;
  }
  throw new Error('Başvuru kodu üretilemedi.');
}

export interface BasvuruGirdisi {
  basvuruNo?: string;
  yarismaId: string;
  kategoriId: string;
  takim: string;
  takimId?: string;
  proje?: string;
  eposta?: string;
  notlar?: string;
  takimKaydiId?: string;
  yarismaciId?: string;
}

/**
 * Başvuru numarası üretici.
 *
 * Yarışmacı numarasını TEKNOFEST kayıt sisteminden alıyor ve içeri
 * aktarılan listede zaten yazıyor. Numara verilmediğinde üretiliyor:
 * elle tek başvuru eklerken koordinasyonun numara uydurmasını beklemek
 * gereksiz. Biçim `TF-<yıl>-<5 hane>`; yıl yarışmadan geliyor.
 */
function basvuruNoUret(yil: number): string {
  const db = baglanti();
  for (let deneme = 0; deneme < 40; deneme++) {
    const n = String(Math.floor(Math.random() * 100000)).padStart(5, '0');
    const aday = `TF-${yil}-${n}`;
    const varMi = db.prepare('SELECT 1 FROM basvuru WHERE basvuru_no = ?').get(aday);
    if (!varMi) return aday;
  }
  throw new Error('Başvuru numarası üretilemedi.');
}

export function basvuruEkle(g: BasvuruGirdisi, yil: number): Basvuru {
  const id = kimlik();
  const no = g.basvuruNo?.trim() || basvuruNoUret(yil);
  baglanti()
    .prepare(
      `INSERT INTO basvuru
         (id, basvuru_no, kod, yarisma_id, kategori_id, takim, takim_id,
          proje, eposta, aktif, olusturuldu, notlar,
          takim_kaydi_id, yarismaci_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
    )
    .run(
      id, no, benzersizKod(), g.yarismaId, g.kategoriId, g.takim.trim(),
      g.takimId?.trim() || null, g.proje?.trim() || null, g.eposta?.trim() || null,
      new Date().toISOString(), g.notlar?.trim() || null,
      g.takimKaydiId ?? null, g.yarismaciId ?? null,
    );
  return basvuruGetir(id)!;
}

/**
 * Toplu ekleme — listenin tamamı tek işlemde.
 *
 * Koordinasyon 300 satırlık bir kayıt listesini bir kerede yapıştırıyor.
 * Satır satır INSERT, her biri ayrı işlem demek: 300 disk senkronizasyonu.
 * Tek işlemde yazmak bunu tek senkronizasyona indiriyor.
 *
 * ZATEN KAYITLI NUMARA ATLANIYOR, HATA DEĞİL. Aynı liste iki kez
 * yapıştırılabilir; ikinci yapıştırmanın bütün işlemi geri alması
 * (ve koordinasyonun hangi satırın çakıştığını aramak zorunda kalması)
 * yardımcı olmazdı. Atlanan satırlar sonuçta ayrıca sayılıyor.
 */
export function basvurulariTopluEkle(
  girdiler: BasvuruGirdisi[],
  yil: number,
): { eklenen: Basvuru[]; atlanan: string[] } {
  const db = baglanti();
  const eklenen: Basvuru[] = [];
  const atlanan: string[] = [];

  db.exec('BEGIN');
  try {
    for (const g of girdiler) {
      const no = g.basvuruNo?.trim();
      if (no) {
        const varMi = db.prepare('SELECT 1 FROM basvuru WHERE basvuru_no = ?').get(no);
        if (varMi) {
          atlanan.push(no);
          continue;
        }
      }
      eklenen.push(basvuruEkle(g, yil));
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return { eklenen, atlanan };
}

export function basvuruGetir(id: string): Basvuru | null {
  const s = baglanti().prepare('SELECT * FROM basvuru WHERE id = ?').get(id) as
    | Satir
    | undefined;
  return s ? coz(s) : null;
}

export function basvuruNoIle(basvuruNo: string): Basvuru | null {
  const s = baglanti()
    .prepare('SELECT * FROM basvuru WHERE basvuru_no = ?')
    .get(basvuruNo.trim()) as Satir | undefined;
  return s ? coz(s) : null;
}

/**
 * Koda göre başvuru — biçim farkları göz ardı edilerek.
 *
 * Hakem kodlarındaki dersin aynısı: kod e-postadan elle yazılıyor,
 * panodan yapıştırılıyor, küçük harfle giriliyor. Tam eşitlik aramak
 * kodunu doğru bilen yarışmacıya "geçersiz kod" dedirtir.
 */
export function basvuruKodIle(kod: string): Basvuru | null {
  const aranan = kodNormal(kod);
  if (!aranan) return null;
  const s = baglanti()
    .prepare(
      `SELECT * FROM basvuru
        WHERE UPPER(REPLACE(REPLACE(kod, '-', ''), ' ', '')) = ?`,
    )
    .get(aranan) as Satir | undefined;
  return s ? coz(s) : null;
}

export function basvurulariListele(
  yarismaId?: string,
  kategoriId?: string,
): Basvuru[] {
  const kosul: string[] = [];
  const arg: string[] = [];
  if (yarismaId) {
    kosul.push('yarisma_id = ?');
    arg.push(yarismaId);
  }
  if (kategoriId) {
    kosul.push('kategori_id = ?');
    arg.push(kategoriId);
  }
  const sql =
    'SELECT * FROM basvuru'
    + (kosul.length ? ` WHERE ${kosul.join(' AND ')}` : '')
    + ' ORDER BY olusturuldu DESC, basvuru_no';
  return (baglanti().prepare(sql).all(...arg) as Satir[]).map(coz);
}

/**
 * Başvuru ve yüklediği raporun durumu — koordinasyon listesi için.
 *
 * "Kim henüz yüklemedi" sorusu bu listenin var olma sebebi. Rapor
 * tablosuyla SOL BİRLEŞİM: raporu olmayan başvuru da satırda kalmalı,
 * çünkü aranan tam olarak o.
 */
export interface BasvuruDurumu extends Basvuru {
  raporId?: string;
  raporDurumu?: string;
  yuklendi?: string;
}

export function basvuruDurumlari(
  yarismaId?: string,
  kategoriId?: string,
): BasvuruDurumu[] {
  const kosul: string[] = [];
  const arg: string[] = [];
  if (yarismaId) {
    kosul.push('b.yarisma_id = ?');
    arg.push(yarismaId);
  }
  if (kategoriId) {
    kosul.push('b.kategori_id = ?');
    arg.push(kategoriId);
  }
  const sql =
    `SELECT b.*, r.id AS rapor_id, r.durum AS rapor_durumu, r.yuklendi AS r_yuklendi
       FROM basvuru b
       LEFT JOIN rapor r ON r.basvuru_id = b.id`
    + (kosul.length ? ` WHERE ${kosul.join(' AND ')}` : '')
    + ' ORDER BY (r.id IS NULL) DESC, b.basvuru_no';

  return (
    baglanti().prepare(sql).all(...arg) as Array<
      Satir & { rapor_id: string | null; rapor_durumu: string | null; r_yuklendi: string | null }
    >
  ).map((s) => ({
    ...coz(s),
    raporId: s.rapor_id ?? undefined,
    raporDurumu: s.rapor_durumu ?? undefined,
    yuklendi: s.r_yuklendi ?? undefined,
  }));
}

/**
 * Yarışmacının görebileceği başvurular.
 *
 * ── ÖLÇÜT ÜYELİK, SAHİPLİK DEĞİL ────────────────────────────────────────
 * Yalnızca `yarismaci_id` eşleşmesi arasaydık, takıma sonradan katılan
 * üye takımının başvurusunu göremezdi — oysa takım bir bütün ve rapor
 * ortak. Başvuruyu KİM AÇTIĞI ayrı bir bilgi; kimin GÖREBİLECEĞİ takım
 * üyeliğinden geliyor.
 */
export function yarismacininBasvurulari(yarismaciId: string): Basvuru[] {
  return (
    baglanti()
      .prepare(
        `SELECT DISTINCT b.* FROM basvuru b
           LEFT JOIN takim_uyesi u ON u.takim_id = b.takim_kaydi_id
          WHERE b.yarismaci_id = ? OR u.yarismaci_id = ?
          ORDER BY b.olusturuldu DESC`,
      )
      .all(yarismaciId, yarismaciId) as Satir[]
  ).map(coz);
}

/**
 * Numara + erişim kodu ikilisiyle başvuru — üstlenme akışı için.
 *
 * İKİSİ DE ARANIYOR. Yalnızca kod aransaydı sızan tek bir kod yeterdi;
 * yalnızca numara aransaydı hiçbir doğrulama olmazdı. Kod tarafında
 * biçim farkları göz ardı ediliyor (e-postadan elle yazılıyor), numara
 * tarafında edilmiyor — numara belgede tam olarak bu biçimde yazıyor.
 */
export function basvuruNumaraKodIle(basvuruNo: string, kod: string): Basvuru | null {
  const b = basvuruKodIle(kod);
  if (!b || !b.aktif) return null;
  const a = b.basvuruNo.trim().toLocaleUpperCase('tr');
  const v = basvuruNo.trim().toLocaleUpperCase('tr');
  return a === v ? b : null;
}

/**
 * Ön kayıtlı başvuruyu bir takıma ve hesaba bağlar.
 *
 * Takım adı da güncelleniyor: koordinasyonun listesinde yazan ad ile
 * yarışmacının kurduğu takımın adı farklı olabilir ve bundan sonra
 * geçerli olan, yarışmacının kendi beyanı. Başvuru numarası DEĞİŞMİYOR —
 * o TEKNOFEST kaydından geliyor ve dış dünyanın bildiği kimlik o.
 */
export function basvuruSahiplendir(
  basvuruId: string,
  takimKaydiId: string,
  yarismaciId: string,
  takimAdi: string,
): Basvuru | null {
  baglanti()
    .prepare(
      'UPDATE basvuru SET takim_kaydi_id = ?, yarismaci_id = ?, takim = ? WHERE id = ?',
    )
    .run(takimKaydiId, yarismaciId, takimAdi.trim(), basvuruId);
  return basvuruGetir(basvuruId);
}

/** Bu takım bu kategoriye zaten başvurmuş mu — çift başvuruyu engeller. */
export function takiminKategoriBasvurusu(
  takimKaydiId: string,
  kategoriId: string,
): Basvuru | null {
  const s = baglanti()
    .prepare('SELECT * FROM basvuru WHERE takim_kaydi_id = ? AND kategori_id = ?')
    .get(takimKaydiId, kategoriId) as Satir | undefined;
  return s ? coz(s) : null;
}

/** Başvuruya bağlı rapor — yarışmacı paneli bunu gösteriyor. */
export function basvurununRaporId(basvuruId: string): string | null {
  const s = baglanti()
    .prepare('SELECT id FROM rapor WHERE basvuru_id = ? ORDER BY yuklendi DESC LIMIT 1')
    .get(basvuruId) as { id: string } | undefined;
  return s?.id ?? null;
}

export function basvuruGuncelle(
  id: string,
  degisiklik: Partial<Pick<Basvuru, 'takim' | 'takimId' | 'proje' | 'eposta' | 'aktif' | 'notlar'>>,
): Basvuru | null {
  const b = basvuruGetir(id);
  if (!b) return null;
  const y = { ...b, ...degisiklik };
  baglanti()
    .prepare(
      `UPDATE basvuru SET takim = ?, takim_id = ?, proje = ?, eposta = ?,
         aktif = ?, notlar = ? WHERE id = ?`,
    )
    .run(
      y.takim, y.takimId ?? null, y.proje ?? null, y.eposta ?? null,
      y.aktif ? 1 : 0, y.notlar ?? null, id,
    );
  return basvuruGetir(id);
}

/**
 * Başvuruyu siler — YALNIZCA raporu yoksa.
 *
 * Raporu olan başvuruyu silmek, `ON DELETE SET NULL` sayesinde raporu
 * götürmez ama raporu SAHİPSİZ bırakır: kim teslim etti sorusunun cevabı
 * kaybolur. Yanlış eklenen kaydı silmek meşru, teslim almış kaydı silmek
 * kayıt tutmamak demek. Bu durumda pasife alınıyor.
 */
export function basvuruSil(id: string): 'silindi' | 'raporu_var' | 'yok' {
  const b = basvuruGetir(id);
  if (!b) return 'yok';
  if (basvurununRaporId(id)) return 'raporu_var';
  baglanti().prepare('DELETE FROM basvuru WHERE id = ?').run(id);
  return 'silindi';
}
