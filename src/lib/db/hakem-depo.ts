/**
 * Hakem, atama ve hakem başına değerlendirme.
 *
 * ── ÇÖZDÜĞÜ TASARIM HATASI ──────────────────────────────────────────────
 * Eski modelde puanlar raporun üzerindeydi. Bir rapora iki hakem
 * atandığında ikinci puanlama birincinin ÜSTÜNE yazıyordu — sessiz veri
 * kaybı. TEKNOFEST'te bir rapora birden çok hakem bakmak olağan olduğu
 * için bu eksik özellik değil, hata.
 *
 * Artık her hakemin değerlendirmesi kendi satırında ve raporun nihai puanı
 * bunlardan türetiliyor. Hakemler arası sapma da ölçülebiliyor: yüksek
 * sapma, koordinasyonun bakması gereken bir sinyal.
 */

import { randomUUID } from 'node:crypto';
import { baglanti, bool, jsonOku, sayi } from './baglanti';
import type {
  Atama, DegerlendirmeDurumu, Hakem, HakemDegerlendirmesi, HakemIsi, NihaiOzet,
} from './tipler';
import { raporRumuzu, takimRumuzu } from '../depo/maskele';

type Satir = Record<string, unknown>;

/**
 * Hakem erişim kodu.
 *
 * Okunabilir olması gerekiyor: koordinasyon bu kodu e-postayla ya da
 * telefonda iletiyor. Karışan karakterler (0/O, 1/I/l) çıkarıldı — hakem
 * kodu yanlış yazıp "giriş yapamıyorum" demesin.
 */
const KOD_ALFABE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function kodUret(): string {
  let k = '';
  for (let i = 0; i < 8; i++) {
    k += KOD_ALFABE[Math.floor(Math.random() * KOD_ALFABE.length)];
    if (i === 3) k += '-';
  }
  return k;
}

function hakemCoz(s: Satir): Hakem {
  return {
    id: s.id as string,
    ad: s.ad as string,
    eposta: (s.eposta as string) ?? undefined,
    kurum: (s.kurum as string) ?? undefined,
    kod: s.kod as string,
    uzmanlik: jsonOku<string[]>(s.uzmanlik, []),
    aktif: bool(s.aktif),
    olusturuldu: s.olusturuldu as string,
    notlar: (s.notlar as string) ?? undefined,
  };
}

function degCoz(s: Satir): HakemDegerlendirmesi {
  return {
    id: s.id as string,
    raporId: s.rapor_id as string,
    hakemId: s.hakem_id as string,
    puanlar: jsonOku(s.puanlar, []),
    toplam: (s.toplam as number) ?? undefined,
    aciklama: (s.aciklama as string) ?? undefined,
    durum: s.durum as DegerlendirmeDurumu,
    guncellendi: s.guncellendi as string,
    tamamlandi: (s.tamamlandi as string) ?? undefined,
  };
}

// ------------------------------------------------------------------ hakem

export function hakemEkle(girdi: {
  ad: string;
  eposta?: string;
  kurum?: string;
  uzmanlik?: string[];
  notlar?: string;
}): Hakem {
  const db = baglanti();
  const id = randomUUID();

  /*
   * Kod çakışması pratikte imkânsıza yakın (31^8) ama tekil kısıt var;
   * çakışırsa yeniden denemek, hata döndürmekten iyi.
   */
  let kod = kodUret();
  for (let deneme = 0; deneme < 5; deneme++) {
    const varMi = db.prepare('SELECT 1 FROM hakem WHERE kod = ?').get(kod);
    if (!varMi) break;
    kod = kodUret();
  }

  db.prepare(
    `INSERT INTO hakem (id, ad, eposta, kurum, kod, uzmanlik, aktif, olusturuldu, notlar)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
  ).run(
    id, girdi.ad.trim(), girdi.eposta?.trim() || null, girdi.kurum?.trim() || null,
    kod, JSON.stringify(girdi.uzmanlik ?? []), new Date().toISOString(),
    girdi.notlar?.trim() || null,
  );
  return hakemGetir(id)!;
}

export function hakemGetir(id: string): Hakem | null {
  const s = baglanti().prepare('SELECT * FROM hakem WHERE id = ?').get(id) as
    | Satir
    | undefined;
  return s ? hakemCoz(s) : null;
}

export function hakemKodIle(kod: string): Hakem | null {
  // Kod büyük harfle üretiliyor; hakem küçük yazabilir.
  const s = baglanti()
    .prepare('SELECT * FROM hakem WHERE kod = ?')
    .get(kod.trim().toUpperCase()) as Satir | undefined;
  return s ? hakemCoz(s) : null;
}

export function hakemleriListele(yalnizAktif = false): Hakem[] {
  const sql = yalnizAktif
    ? 'SELECT * FROM hakem WHERE aktif = 1 ORDER BY ad'
    : 'SELECT * FROM hakem ORDER BY aktif DESC, ad';
  return (baglanti().prepare(sql).all() as Satir[]).map(hakemCoz);
}

export function hakemGuncelle(
  id: string,
  degisiklik: Partial<Pick<Hakem, 'ad' | 'eposta' | 'kurum' | 'uzmanlik' | 'aktif' | 'notlar'>>,
): Hakem | null {
  const h = hakemGetir(id);
  if (!h) return null;
  const y = { ...h, ...degisiklik };
  baglanti()
    .prepare(
      `UPDATE hakem SET ad = ?, eposta = ?, kurum = ?, uzmanlik = ?, aktif = ?,
         notlar = ? WHERE id = ?`,
    )
    .run(
      y.ad, y.eposta ?? null, y.kurum ?? null, JSON.stringify(y.uzmanlik),
      sayi(y.aktif), y.notlar ?? null, id,
    );
  return hakemGetir(id);
}

/**
 * Hakemi siler.
 *
 * Değerlendirmesi olan hakem SİLİNMİYOR, pasife alınıyor: tamamlanmış bir
 * değerlendirmenin sahibini silmek denetim izini koparır ve itiraz
 * sürecinde "bu puanı kim verdi?" sorusu cevapsız kalır.
 */
export function hakemSil(id: string): { silindi: boolean; neden?: string } {
  const db = baglanti();
  const n = db
    .prepare('SELECT COUNT(*) AS n FROM degerlendirme WHERE hakem_id = ?')
    .get(id) as { n: number };

  if (n.n > 0) {
    hakemGuncelle(id, { aktif: false });
    return {
      silindi: false,
      neden: `${n.n} değerlendirmesi var; silinmedi, pasife alındı. ` +
        'Tamamlanmış değerlendirmenin sahibi kayıtta kalmalı.',
    };
  }
  db.prepare('DELETE FROM hakem WHERE id = ?').run(id);
  return { silindi: true };
}

// ------------------------------------------------------------------ atama

export function atamaYap(
  raporId: string,
  hakemId: string,
  atayan?: string,
  sonTarih?: string,
): Atama | null {
  const db = baglanti();
  // (rapor, hakem) tekil: aynı hakem aynı rapora iki kez atanmıyor.
  db.prepare(
    `INSERT INTO atama (id, rapor_id, hakem_id, atandi, atayan, son_tarih)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(rapor_id, hakem_id) DO UPDATE SET
       son_tarih = excluded.son_tarih, atayan = excluded.atayan`,
  ).run(
    randomUUID(), raporId, hakemId, new Date().toISOString(),
    atayan ?? null, sonTarih ?? null,
  );

  const s = db
    .prepare('SELECT * FROM atama WHERE rapor_id = ? AND hakem_id = ?')
    .get(raporId, hakemId) as Satir | undefined;
  return s
    ? {
        id: s.id as string,
        raporId: s.rapor_id as string,
        hakemId: s.hakem_id as string,
        atandi: s.atandi as string,
        atayan: (s.atayan as string) ?? undefined,
        sonTarih: (s.son_tarih as string) ?? undefined,
      }
    : null;
}

/**
 * Atamayı kaldırır.
 *
 * Hakem o rapora puan girmişse atama kaldırılmıyor: değerlendirme kaydı
 * atamaya bağlı ve atamayı silmek yapılmış işi ortada bırakır. Önce
 * değerlendirmenin ne olacağına karar verilmeli.
 */
export function atamaKaldir(
  raporId: string,
  hakemId: string,
): { kaldirildi: boolean; neden?: string } {
  const db = baglanti();
  const d = db
    .prepare('SELECT durum FROM degerlendirme WHERE rapor_id = ? AND hakem_id = ?')
    .get(raporId, hakemId) as { durum: string } | undefined;

  if (d) {
    return {
      kaldirildi: false,
      neden:
        d.durum === 'tamamlandi'
          ? 'Hakem bu raporu değerlendirmeyi tamamladı; atama kaldırılamaz.'
          : 'Hakem puan girmeye başlamış. Önce taslak değerlendirmesi silinmeli.',
    };
  }
  db.prepare('DELETE FROM atama WHERE rapor_id = ? AND hakem_id = ?').run(raporId, hakemId);
  return { kaldirildi: true };
}

export function raporunHakemleri(raporId: string): Array<Hakem & { atandi: string }> {
  const satirlar = baglanti()
    .prepare(
      `SELECT h.*, a.atandi FROM atama a
       JOIN hakem h ON h.id = a.hakem_id
       WHERE a.rapor_id = ? ORDER BY a.atandi`,
    )
    .all(raporId) as Satir[];
  return satirlar.map((s) => ({ ...hakemCoz(s), atandi: s.atandi as string }));
}

/** Hakemin atanmış rapor kimlikleri. */
export function hakeminRaporlari(hakemId: string): string[] {
  return (
    baglanti()
      .prepare('SELECT rapor_id FROM atama WHERE hakem_id = ? ORDER BY atandi DESC')
      .all(hakemId) as Array<{ rapor_id: string }>
  ).map((s) => s.rapor_id);
}

// ----------------------------------------------------------- değerlendirme

export function degerlendirmeGetir(
  raporId: string,
  hakemId: string,
): HakemDegerlendirmesi | null {
  const s = baglanti()
    .prepare('SELECT * FROM degerlendirme WHERE rapor_id = ? AND hakem_id = ?')
    .get(raporId, hakemId) as Satir | undefined;
  return s ? degCoz(s) : null;
}

export function raporunDegerlendirmeleri(raporId: string): HakemDegerlendirmesi[] {
  return (
    baglanti()
      .prepare('SELECT * FROM degerlendirme WHERE rapor_id = ? ORDER BY guncellendi')
      .all(raporId) as Satir[]
  ).map(degCoz);
}

/**
 * Değerlendirmeyi kaydeder.
 *
 * ATAMA ZORUNLU. Atanmamış hakemin puan girmesi engelliyor — yoksa rol
 * ayrımı ve kör puanlama anlamsız kalır: kodu bilen herkes her rapora
 * puan verebilirdi.
 */
export function degerlendirmeKaydet(girdi: {
  raporId: string;
  hakemId: string;
  puanlar: HakemDegerlendirmesi['puanlar'];
  aciklama?: string;
  tamamla: boolean;
}): { sonuc?: HakemDegerlendirmesi; hata?: string } {
  const db = baglanti();

  const atama = db
    .prepare('SELECT 1 FROM atama WHERE rapor_id = ? AND hakem_id = ?')
    .get(girdi.raporId, girdi.hakemId);
  if (!atama) {
    return { hata: 'Bu rapor size atanmamış; değerlendirme kaydedilemez.' };
  }

  const mevcut = degerlendirmeGetir(girdi.raporId, girdi.hakemId);
  if (mevcut?.durum === 'tamamlandi') {
    return { hata: 'Bu değerlendirmeyi zaten tamamladınız; değiştirilemez.' };
  }

  const toplam = girdi.puanlar.reduce((t, p) => t + p.puan, 0);
  const simdi = new Date().toISOString();

  db.prepare(
    `INSERT INTO degerlendirme (id, rapor_id, hakem_id, puanlar, toplam,
       aciklama, durum, guncellendi, tamamlandi)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(rapor_id, hakem_id) DO UPDATE SET
       puanlar = excluded.puanlar, toplam = excluded.toplam,
       aciklama = excluded.aciklama, durum = excluded.durum,
       guncellendi = excluded.guncellendi, tamamlandi = excluded.tamamlandi`,
  ).run(
    mevcut?.id ?? randomUUID(), girdi.raporId, girdi.hakemId,
    JSON.stringify(girdi.puanlar), toplam, girdi.aciklama ?? null,
    girdi.tamamla ? 'tamamlandi' : 'taslak', simdi,
    girdi.tamamla ? simdi : null,
  );

  return { sonuc: degerlendirmeGetir(girdi.raporId, girdi.hakemId)! };
}

/**
 * Raporun nihai puanını hakem değerlendirmelerinden türetir.
 *
 * Kural: TAMAMLANMIŞ değerlendirmelerin ortalaması. Taslaklar sayılmıyor —
 * yarım kalmış bir puanlamayı nihai puana katmak, hakemi bitirmeden
 * karar vermiş göstermek olurdu.
 */
export function nihaiOzet(raporId: string): NihaiOzet {
  const hepsi = raporunDegerlendirmeleri(raporId);
  const atanan = raporunHakemleri(raporId);
  const bitmis = hepsi.filter((d) => d.durum === 'tamamlandi' && d.toplam !== undefined);

  const toplamlar = bitmis.map((d) => ({
    hakemId: d.hakemId,
    hakemAdi: atanan.find((h) => h.id === d.hakemId)?.ad ?? '—',
    toplam: d.toplam!,
  }));

  if (!toplamlar.length) {
    return { tamamlanan: 0, atanan: atanan.length, toplamlar: [] };
  }

  const puanlar = toplamlar.map((t) => t.toplam);
  const ortalama = puanlar.reduce((a, b) => a + b, 0) / puanlar.length;

  return {
    tamamlanan: bitmis.length,
    atanan: atanan.length,
    puan: Math.round(ortalama * 10) / 10,
    sapma:
      puanlar.length > 1
        ? Math.round((Math.max(...puanlar) - Math.min(...puanlar)) * 10) / 10
        : 0,
    toplamlar,
  };
}

/** Hakemin panelinde gördüğü iş listesi. */
export function hakeminIsleri(hakemId: string): HakemIsi[] {
  const satirlar = baglanti()
    .prepare(
      `SELECT r.id, r.basvuru_no, r.takim_id, r.proje, r.kontroller,
              r.ai_degerlendirme, a.atandi, a.son_tarih,
              y.ad AS yarisma_adi, k.ad AS kategori_adi, k.rubrik,
              d.durum AS deg_durum, d.puanlar AS deg_puanlar
       FROM atama a
       JOIN rapor r    ON r.id = a.rapor_id
       JOIN yarisma y  ON y.id = r.yarisma_id
       JOIN kategori k ON k.id = r.kategori_id
       LEFT JOIN degerlendirme d
              ON d.rapor_id = a.rapor_id AND d.hakem_id = a.hakem_id
       WHERE a.hakem_id = ?
       ORDER BY (d.durum = 'tamamlandi'), a.son_tarih IS NULL, a.son_tarih, a.atandi`,
    )
    .all(hakemId) as Satir[];

  return satirlar.map((s) => {
    const rubrik = jsonOku<{ kriterler: unknown[] }>(s.rubrik, { kriterler: [] });
    const puanlar = jsonOku<unknown[]>(s.deg_puanlar, []);
    const kontroller = jsonOku<Array<{ durum: string }>>(s.kontroller, []);

    return {
      raporId: s.id as string,
      basvuruNo: s.basvuru_no as string,
      // Hakem gerçek takım adını GÖRMÜYOR — kör puanlama.
      takimRumuzu: `${takimRumuzu(s.takim_id as string)} · ${raporRumuzu(s.id as string)}`,
      proje: s.proje as string,
      yarismaAdi: s.yarisma_adi as string,
      kategoriAdi: s.kategori_adi as string,
      atandi: s.atandi as string,
      sonTarih: (s.son_tarih as string) ?? undefined,
      durum: (s.deg_durum as DegerlendirmeDurumu) ?? 'baslanmadi',
      ilerleme: { girilen: puanlar.length, toplam: rubrik.kriterler.length },
      aiHazir: !!s.ai_degerlendirme,
      kritikBulgu: kontroller.some((k) => k.durum === 'hata'),
    };
  });
}

/** Koordinasyon panosu için hakem yükü. */
export interface HakemYuku {
  hakem: Hakem;
  atanan: number;
  tamamlanan: number;
  taslak: number;
}

export function hakemYukleri(): HakemYuku[] {
  const satirlar = baglanti()
    .prepare(
      `SELECT h.*,
         (SELECT COUNT(*) FROM atama a WHERE a.hakem_id = h.id) AS atanan,
         (SELECT COUNT(*) FROM degerlendirme d
           WHERE d.hakem_id = h.id AND d.durum = 'tamamlandi') AS tamamlanan,
         (SELECT COUNT(*) FROM degerlendirme d
           WHERE d.hakem_id = h.id AND d.durum = 'taslak') AS taslak
       FROM hakem h ORDER BY h.aktif DESC, h.ad`,
    )
    .all() as Satir[];

  return satirlar.map((s) => ({
    hakem: hakemCoz(s),
    atanan: s.atanan as number,
    tamamlanan: s.tamamlanan as number,
    taslak: s.taslak as number,
  }));
}
