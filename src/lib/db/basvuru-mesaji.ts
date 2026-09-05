/**
 * Yarışmacı ↔ koordinasyon yazışması.
 *
 * ── NİYE VAR ────────────────────────────────────────────────────────────
 * Sistem yarışmacıya birçok yerde "koordinasyonla iletişime geçin"
 * diyordu: teslim süresi dolduğunda, rapor kilitlendiğinde, kategori
 * bulunamadığında. Ama iletişim kuracak hiçbir yol yoktu. Kullanıcıyı
 * olmayan bir kapıya yönlendiren metin, hatanın kendisinden kötüdür —
 * çünkü çözüm varmış gibi görünür.
 *
 * ── HAKEM YAZIŞMASINDAN TAMAMEN AYRI ────────────────────────────────────
 * Hakem–koordinasyon yazışması kör puanlamayı korumak için yarışmacıdan
 * gizli. İki yazışmayı tek tabloda tutup kanal süzgeciyle ayırmak,
 * süzgeçte yapılacak tek bir hatayı hakem notlarının yarışmacıya sızması
 * hâline getirirdi. Ayrı tablo bu hatayı imkânsız kılıyor.
 */

import { baglanti } from './baglanti';
import { kimlik } from '@/lib/depo/depo';

export type YazarRolu = 'yarismaci' | 'koordinasyon';

export interface BasvuruMesaji {
  id: string;
  basvuruId: string;
  yazarRol: YazarRolu;
  yazarAdi: string;
  metin: string;
  tarih: string;
  okundu: boolean;
}

/** Mesaj uzunluk sınırı — sohbet değil, bir soru sorma kanalı. */
export const AZAMI_UZUNLUK = 2000;

function coz(s: Record<string, unknown>): BasvuruMesaji {
  return {
    id: s.id as string,
    basvuruId: s.basvuru_id as string,
    yazarRol: s.yazar_rol as YazarRolu,
    yazarAdi: s.yazar_adi as string,
    metin: s.metin as string,
    tarih: s.tarih as string,
    okundu: s.okundu === 1,
  };
}

export function mesajEkle(g: {
  basvuruId: string;
  yazarRol: YazarRolu;
  yazarAdi: string;
  yarismaciId?: string;
  metin: string;
}): BasvuruMesaji {
  const id = kimlik();
  const db = baglanti();

  db.exec('BEGIN');
  try {
    db.prepare(
      `INSERT INTO basvuru_mesaji
         (id, basvuru_id, yazar_rol, yarismaci_id, yazar_adi, metin, tarih, okundu)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
    ).run(
      id, g.basvuruId, g.yazarRol, g.yarismaciId ?? null, g.yazarAdi,
      g.metin.trim().slice(0, AZAMI_UZUNLUK), new Date().toISOString(),
    );

    /*
     * YAZMAK OKUMAKTIR.
     *
     * Cevap yazan taraf karşının mesajlarını görmüş demektir; onları
     * okunmamış bırakmak, koordinasyon panosunda cevaplanmış soruların
     * bekliyor görünmesine yol açardı — sayaç güvenilirliğini yitirirdi.
     */
    db.prepare(
      'UPDATE basvuru_mesaji SET okundu = 1 WHERE basvuru_id = ? AND yazar_rol != ?',
    ).run(g.basvuruId, g.yazarRol);

    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return mesajGetir(id)!;
}

export function mesajGetir(id: string): BasvuruMesaji | null {
  const s = baglanti().prepare('SELECT * FROM basvuru_mesaji WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  return s ? coz(s) : null;
}

export function basvurununMesajlari(basvuruId: string): BasvuruMesaji[] {
  return (
    baglanti()
      .prepare('SELECT * FROM basvuru_mesaji WHERE basvuru_id = ? ORDER BY tarih')
      .all(basvuruId) as Array<Record<string, unknown>>
  ).map(coz);
}

/** Bir tarafın mesajlarını okundu işaretler. */
export function okunduIsaretle(basvuruId: string, okuyanRol: YazarRolu): void {
  baglanti()
    .prepare('UPDATE basvuru_mesaji SET okundu = 1 WHERE basvuru_id = ? AND yazar_rol != ?')
    .run(basvuruId, okuyanRol);
}

export interface BekleyenSoru {
  basvuruId: string;
  basvuruNo: string;
  takim: string;
  sonMesaj: string;
  tarih: string;
  adet: number;
}

/**
 * Koordinasyonun cevap bekleyen soruları.
 *
 * Kenar çubuğundaki bildirim bunu okuyor: yarışmacının sorusu bir
 * ekranın derinliğinde beklemesin. Yalnızca YARIŞMACININ yazdığı ve
 * okunmamış mesajlar sayılıyor.
 *
 * `sezon` verilirse yalnızca o yılın yarışmalarındaki sorular sayılıyor:
 * arşiv sezonuna geçen koordinasyon, bu yılın cevapsız sorularını orada
 * görmemeli.
 */
export function cevapBekleyenBasvuruSorulari(sezon?: number): BekleyenSoru[] {
  return (
    baglanti()
      .prepare(
        `SELECT m.basvuru_id, b.basvuru_no, b.takim,
                COUNT(*) AS adet,
                MAX(m.tarih) AS tarih,
                (SELECT metin FROM basvuru_mesaji x
                  WHERE x.basvuru_id = m.basvuru_id AND x.yazar_rol = 'yarismaci'
                  ORDER BY x.tarih DESC LIMIT 1) AS son_mesaj
           FROM basvuru_mesaji m
           JOIN basvuru b ON b.id = m.basvuru_id
           JOIN yarisma y ON y.id = b.yarisma_id
          WHERE m.yazar_rol = 'yarismaci' AND m.okundu = 0
            AND (? IS NULL OR y.yil = ?)
          GROUP BY m.basvuru_id
          ORDER BY tarih DESC`,
      )
      .all(sezon ?? null, sezon ?? null) as Array<Record<string, unknown>>
  ).map((s) => ({
    basvuruId: s.basvuru_id as string,
    basvuruNo: s.basvuru_no as string,
    takim: s.takim as string,
    sonMesaj: (s.son_mesaj as string) ?? '',
    tarih: s.tarih as string,
    adet: Number(s.adet),
  }));
}

/** Yarışmacının okumadığı koordinasyon cevabı var mı. */
export function okunmamisCevapSayisi(basvuruId: string): number {
  const s = baglanti()
    .prepare(
      `SELECT COUNT(*) AS n FROM basvuru_mesaji
        WHERE basvuru_id = ? AND yazar_rol = 'koordinasyon' AND okundu = 0`,
    )
    .get(basvuruId) as { n: number };
  return Number(s.n);
}
