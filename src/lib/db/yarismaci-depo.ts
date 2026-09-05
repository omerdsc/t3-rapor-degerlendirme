/**
 * Yarışmacı hesabı, takım ve oturum deposu.
 *
 * ── PAROLA ÖZETİ HİÇBİR OKUMA FONKSİYONUNDAN ÇIKMIYOR ───────────────────
 * `Yarismaci` tipinde `parolaOzeti` alanı YOK. Özet yalnızca doğrulama
 * yapan tek fonksiyonun içinde okunuyor. Tipe konsaydı bir gün bir
 * uç nokta `Response.json({ yarismaci })` yazar ve özet ağa çıkardı.
 */

import { randomBytes } from 'node:crypto';
import { baglanti } from './baglanti';
import { kodNormal, kodUret } from './kod';
import { parolaDogrula, parolaOzetle, epostaNormal } from '@/lib/yetki/parola';
import { kimlik } from '@/lib/depo/depo';

export interface Yarismaci {
  id: string;
  eposta: string;
  adSoyad: string;
  telefon?: string;
  kurum?: string;
  sehir?: string;
  aktif: boolean;
  olusturuldu: string;
  sonGiris?: string;
}

export interface Takim {
  id: string;
  ad: string;
  katilimKodu: string;
  kurum?: string;
  sehir?: string;
  danisman?: string;
  kaptanId: string;
  olusturuldu: string;
}

export interface TakimUyesi {
  id: string;
  takimId: string;
  yarismaciId: string;
  adSoyad: string;
  eposta: string;
  kurum?: string;
  rol: 'kaptan' | 'uye';
  katildi: string;
}

/** Oturum ömrü — 30 gün. Yarışmacı sezon boyunca birkaç kez giriyor. */
export const OTURUM_GUN = 30;

// ---------------------------------------------------------------- hesap

function yarismaciCoz(s: Record<string, unknown>): Yarismaci {
  return {
    id: s.id as string,
    eposta: s.eposta as string,
    adSoyad: s.ad_soyad as string,
    telefon: (s.telefon as string) ?? undefined,
    kurum: (s.kurum as string) ?? undefined,
    sehir: (s.sehir as string) ?? undefined,
    aktif: s.aktif === 1,
    olusturuldu: s.olusturuldu as string,
    sonGiris: (s.son_giris as string) ?? undefined,
  };
}

/** E-posta zaten kayıtlı mı. */
export function epostaKayitli(eposta: string): boolean {
  return Boolean(
    baglanti().prepare('SELECT 1 FROM yarismaci WHERE eposta = ?').get(epostaNormal(eposta)),
  );
}

export async function yarismaciKaydet(g: {
  eposta: string;
  parola: string;
  adSoyad: string;
  telefon?: string;
  kurum?: string;
  sehir?: string;
}): Promise<Yarismaci> {
  const id = kimlik();
  baglanti()
    .prepare(
      `INSERT INTO yarismaci
         (id, eposta, parola_ozeti, ad_soyad, telefon, kurum, sehir, aktif, olusturuldu)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    )
    .run(
      id, epostaNormal(g.eposta), await parolaOzetle(g.parola), g.adSoyad.trim(),
      g.telefon?.trim() || null, g.kurum?.trim() || null, g.sehir?.trim() || null,
      new Date().toISOString(),
    );
  return yarismaciGetir(id)!;
}

export function yarismaciGetir(id: string): Yarismaci | null {
  const s = baglanti().prepare('SELECT * FROM yarismaci WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  return s ? yarismaciCoz(s) : null;
}

/**
 * E-posta + parola doğrulama.
 *
 * ── HESAP YOKSA DA scrypt KOŞUYOR ───────────────────────────────────────
 * Kayıtlı olmayan e-posta anında `null` dönseydi, yanıt süresi "bu adres
 * kayıtlı mı" sorusunu cevaplardı: kayıtlı adreste ~60 ms, kayıtsızda
 * ~0 ms. Kayıtsız adreste de sahte bir özete karşı doğrulama yapılıyor.
 */
export async function girisDogrula(
  eposta: string,
  parola: string,
): Promise<Yarismaci | null> {
  const s = baglanti()
    .prepare('SELECT * FROM yarismaci WHERE eposta = ?')
    .get(epostaNormal(eposta)) as Record<string, unknown> | undefined;

  const ozet = (s?.parola_ozeti as string)
    // Gerçek bir özetle aynı maliyette sahte değer: yalnızca zamanı
    // eşitlemek için, hiçbir parola bununla eşleşmiyor.
    ?? 'scrypt$16384$AAAAAAAAAAAAAAAAAAAAAA==$'
      + Buffer.alloc(64).toString('base64');

  const dogru = await parolaDogrula(parola, ozet);
  if (!s || !dogru) return null;
  if (s.aktif !== 1) return null;

  baglanti()
    .prepare('UPDATE yarismaci SET son_giris = ? WHERE id = ?')
    .run(new Date().toISOString(), s.id as string);
  return yarismaciCoz(s);
}

export function profilGuncelle(
  id: string,
  d: Partial<Pick<Yarismaci, 'adSoyad' | 'telefon' | 'kurum' | 'sehir'>>,
): Yarismaci | null {
  const y = yarismaciGetir(id);
  if (!y) return null;
  const n = { ...y, ...d };
  baglanti()
    .prepare('UPDATE yarismaci SET ad_soyad = ?, telefon = ?, kurum = ?, sehir = ? WHERE id = ?')
    .run(n.adSoyad.trim(), n.telefon ?? null, n.kurum ?? null, n.sehir ?? null, id);
  return yarismaciGetir(id);
}

/**
 * Parola değiştirir ve BÜTÜN OTURUMLARI DÜŞÜRÜR.
 *
 * Parola değiştirmenin sebebi çoğu zaman "başkası biliyor olabilir".
 * Açık oturumlar ayakta kalsaydı, parolayı değiştirmek o kişiyi
 * dışarı atmazdı — yani işlem amacını hiç yerine getirmezdi.
 */
export async function parolaDegistir(id: string, yeni: string): Promise<boolean> {
  const y = yarismaciGetir(id);
  if (!y) return false;
  baglanti()
    .prepare('UPDATE yarismaci SET parola_ozeti = ? WHERE id = ?')
    .run(await parolaOzetle(yeni), id);
  baglanti().prepare('DELETE FROM oturum WHERE yarismaci_id = ?').run(id);
  return true;
}

// --------------------------------------------------------------- oturum

export function oturumAc(yarismaciId: string): string {
  const belirtec = randomBytes(32).toString('base64url');
  const simdi = new Date();
  const bitis = new Date(simdi.getTime() + OTURUM_GUN * 24 * 3600 * 1000);
  baglanti()
    .prepare(
      'INSERT INTO oturum (belirtec, yarismaci_id, olusturuldu, son_kullanma) VALUES (?, ?, ?, ?)',
    )
    .run(belirtec, yarismaciId, simdi.toISOString(), bitis.toISOString());
  return belirtec;
}

/**
 * Belirteçten yarışmacıyı çözer.
 *
 * Süresi geçmiş oturum burada SİLİNİYOR, yalnızca reddedilmiyor: temizlik
 * için ayrı bir zamanlanmış iş kurmak, tek kullanıcılı bir kurulumda
 * taşınması gereksiz bir yük olurdu.
 */
export function oturumYarismacisi(belirtec: string): Yarismaci | null {
  if (!belirtec) return null;
  const s = baglanti()
    .prepare('SELECT yarismaci_id, son_kullanma FROM oturum WHERE belirtec = ?')
    .get(belirtec) as { yarismaci_id: string; son_kullanma: string } | undefined;
  if (!s) return null;

  if (new Date(s.son_kullanma) < new Date()) {
    baglanti().prepare('DELETE FROM oturum WHERE belirtec = ?').run(belirtec);
    return null;
  }
  const y = yarismaciGetir(s.yarismaci_id);
  return y?.aktif ? y : null;
}

export function oturumKapat(belirtec: string): void {
  baglanti().prepare('DELETE FROM oturum WHERE belirtec = ?').run(belirtec);
}

// ---------------------------------------------------------------- takım

function takimCoz(s: Record<string, unknown>): Takim {
  return {
    id: s.id as string,
    ad: s.ad as string,
    katilimKodu: s.katilim_kodu as string,
    kurum: (s.kurum as string) ?? undefined,
    sehir: (s.sehir as string) ?? undefined,
    danisman: (s.danisman as string) ?? undefined,
    kaptanId: s.kaptan_id as string,
    olusturuldu: s.olusturuldu as string,
  };
}

function benzersizKatilimKodu(): string {
  const db = baglanti();
  for (let i = 0; i < 12; i++) {
    const k = kodUret();
    const varMi = db
      .prepare(
        `SELECT 1 FROM takim   WHERE UPPER(REPLACE(katilim_kodu, '-', '')) = ?
          UNION ALL
         SELECT 1 FROM basvuru WHERE UPPER(REPLACE(kod, '-', '')) = ?
          UNION ALL
         SELECT 1 FROM hakem   WHERE UPPER(REPLACE(kod, '-', '')) = ?`,
      )
      .get(kodNormal(k), kodNormal(k), kodNormal(k));
    if (!varMi) return k;
  }
  throw new Error('Takım katılım kodu üretilemedi.');
}

/**
 * Takım kurar ve kurucuyu KAPTAN olarak üyeliğe yazar.
 *
 * Kaptanlık iki yerde: `takim.kaptan_id` (kim yönetiyor) ve üyelik satırı
 * (takımda kimler var). İkincisi olmasaydı kaptan üye listesinde
 * görünmezdi — takımın kendi kurucusunu içermemesi tuhaf bir durum.
 */
export function takimKur(g: {
  ad: string;
  kaptanId: string;
  kurum?: string;
  sehir?: string;
  danisman?: string;
}): Takim {
  const db = baglanti();
  const id = kimlik();
  const simdi = new Date().toISOString();

  db.exec('BEGIN');
  try {
    db.prepare(
      `INSERT INTO takim (id, ad, katilim_kodu, kurum, sehir, danisman, kaptan_id, olusturuldu)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id, g.ad.trim(), benzersizKatilimKodu(), g.kurum?.trim() || null,
      g.sehir?.trim() || null, g.danisman?.trim() || null, g.kaptanId, simdi,
    );
    db.prepare(
      `INSERT INTO takim_uyesi (id, takim_id, yarismaci_id, rol, katildi)
       VALUES (?, ?, ?, 'kaptan', ?)`,
    ).run(kimlik(), id, g.kaptanId, simdi);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return takimGetir(id)!;
}

export function takimGetir(id: string): Takim | null {
  const s = baglanti().prepare('SELECT * FROM takim WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  return s ? takimCoz(s) : null;
}

export function takimKatilimKoduIle(kod: string): Takim | null {
  const aranan = kodNormal(kod);
  if (!aranan) return null;
  const s = baglanti()
    .prepare(
      `SELECT * FROM takim WHERE UPPER(REPLACE(REPLACE(katilim_kodu, '-', ''), ' ', '')) = ?`,
    )
    .get(aranan) as Record<string, unknown> | undefined;
  return s ? takimCoz(s) : null;
}

/** Yarışmacının ÜYESİ olduğu takımlar — kurduğu değil, katıldığı da dahil. */
export function yarismacininTakimlari(yarismaciId: string): Array<Takim & { rol: string; uyeSayisi: number }> {
  return (
    baglanti()
      .prepare(
        `SELECT t.*, u.rol,
                (SELECT COUNT(*) FROM takim_uyesi x WHERE x.takim_id = t.id) AS uye_sayisi
           FROM takim_uyesi u
           JOIN takim t ON t.id = u.takim_id
          WHERE u.yarismaci_id = ?
          ORDER BY t.olusturuldu DESC`,
      )
      .all(yarismaciId) as Array<Record<string, unknown>>
  ).map((s) => ({
    ...takimCoz(s),
    rol: s.rol as string,
    uyeSayisi: Number(s.uye_sayisi),
  }));
}

export function takimUyeleri(takimId: string): TakimUyesi[] {
  return (
    baglanti()
      .prepare(
        `SELECT u.*, y.ad_soyad, y.eposta, y.kurum
           FROM takim_uyesi u
           JOIN yarismaci y ON y.id = u.yarismaci_id
          WHERE u.takim_id = ?
          ORDER BY (u.rol = 'kaptan') DESC, u.katildi`,
      )
      .all(takimId) as Array<Record<string, unknown>>
  ).map((s) => ({
    id: s.id as string,
    takimId: s.takim_id as string,
    yarismaciId: s.yarismaci_id as string,
    adSoyad: s.ad_soyad as string,
    eposta: s.eposta as string,
    kurum: (s.kurum as string) ?? undefined,
    rol: s.rol as 'kaptan' | 'uye',
    katildi: s.katildi as string,
  }));
}

export function takimaKatil(
  takimId: string,
  yarismaciId: string,
): 'katildi' | 'zaten_uye' {
  const varMi = baglanti()
    .prepare('SELECT 1 FROM takim_uyesi WHERE takim_id = ? AND yarismaci_id = ?')
    .get(takimId, yarismaciId);
  if (varMi) return 'zaten_uye';

  baglanti()
    .prepare(
      `INSERT INTO takim_uyesi (id, takim_id, yarismaci_id, rol, katildi)
       VALUES (?, ?, ?, 'uye', ?)`,
    )
    .run(kimlik(), takimId, yarismaciId, new Date().toISOString());
  return 'katildi';
}

/**
 * Üyeyi çıkarır.
 *
 * KAPTAN ÇIKARILAMAZ: takımın sahibi o ve çıkarılırsa takım sahipsiz
 * kalır — başvuruları kimin yöneteceği belirsizleşir. Kaptan takımı
 * bırakmak istiyorsa önce kaptanlığı devretmeli (henüz yok) ya da takımı
 * silmeli.
 */
export function uyeyiCikar(
  takimId: string,
  yarismaciId: string,
): 'cikarildi' | 'kaptan' | 'yok' {
  const t = takimGetir(takimId);
  if (!t) return 'yok';
  if (t.kaptanId === yarismaciId) return 'kaptan';

  const s = baglanti()
    .prepare('DELETE FROM takim_uyesi WHERE takim_id = ? AND yarismaci_id = ?')
    .run(takimId, yarismaciId);
  return s.changes ? 'cikarildi' : 'yok';
}

export function takimGuncelle(
  id: string,
  d: Partial<Pick<Takim, 'ad' | 'kurum' | 'sehir' | 'danisman'>>,
): Takim | null {
  const t = takimGetir(id);
  if (!t) return null;
  const n = { ...t, ...d };
  baglanti()
    .prepare('UPDATE takim SET ad = ?, kurum = ?, sehir = ?, danisman = ? WHERE id = ?')
    .run(n.ad.trim(), n.kurum ?? null, n.sehir ?? null, n.danisman ?? null, id);
  return takimGetir(id);
}

/** Takımın başvurusu var mı — silmeden önce sorulan soru. */
export function takiminBasvuruSayisi(takimId: string): number {
  const s = baglanti()
    .prepare('SELECT COUNT(*) AS n FROM basvuru WHERE takim_kaydi_id = ?')
    .get(takimId) as { n: number };
  return Number(s.n);
}

export function takimSil(id: string): 'silindi' | 'basvurusu_var' | 'yok' {
  if (!takimGetir(id)) return 'yok';
  if (takiminBasvuruSayisi(id)) return 'basvurusu_var';
  baglanti().prepare('DELETE FROM takim WHERE id = ?').run(id);
  return 'silindi';
}
