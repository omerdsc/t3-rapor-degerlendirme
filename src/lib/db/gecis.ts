/**
 * JSON dosya deposundan SQLite'a geçiş.
 *
 * ── İLKELER ─────────────────────────────────────────────────────────────
 * 1. JSON DOSYALARI SİLİNMEZ. Geçiş sonrası olduğu gibi kalıyor. Bir şey
 *    ters giderse geri dönülebilir; çalışan bir sistemin verisini geri
 *    dönüşsüz taşımak kabul edilemez.
 * 2. YENİDEN ÇALIŞTIRILABİLİR. Aynı geçiş ikinci kez koşturulduğunda
 *    yinelenen kayıt üretmiyor; var olan satırlar güncelleniyor.
 * 3. ESKİ PUANLAR KAYBOLMUYOR. Eski modelde puanlar raporun üzerindeydi ve
 *    hakem kimliği yoktu. Bu puanlar "arşiv hakemi" adına bir değerlendirme
 *    satırına taşınıyor — silmek, tamamlanmış bir değerlendirmeyi yok
 *    saymak olurdu.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { baglanti, jsonYaz, sayi } from './baglanti';
import type { Rapor, Yarisma } from '../depo/tipler';

const YARISMA_DIZINI = () => join(process.cwd(), 'veri', 'yarismalar');
const RAPOR_DIZINI = () => join(process.cwd(), 'veri', 'raporlar');

export interface GecisSonucu {
  yarisma: number;
  kategori: number;
  rapor: number
  parmakizi: number;
  mesaj: number;
  arsivDegerlendirmesi: number;
  atlanan: string[];
}

function dosyalariOku<T>(dizin: string): T[] {
  if (!existsSync(dizin)) return [];
  const sonuc: T[] = [];
  for (const ad of readdirSync(dizin)) {
    if (!ad.endsWith('.json')) continue;
    try {
      sonuc.push(JSON.parse(readFileSync(join(dizin, ad), 'utf-8')) as T);
    } catch {
      // Bozuk dosya geçişi düşürmesin; sonuçta atlanan olarak bildirilir.
    }
  }
  return sonuc;
}

/**
 * Eski puanları taşımak için kullanılan hakem kaydı.
 *
 * Eski modelde puanı kimin verdiği bilinmiyordu (`hakemAdi` alanı sonradan
 * eklendi). Bu puanları atmak yerine, kaynağı açıkça belirtilmiş bir
 * hakem kaydına bağlıyoruz — geçmiş veri sahte bir kimliğe yazılmıyor,
 * "arşiv" olduğu görünüyor.
 */
const ARSIV_KOD = 'arsiv';

function arsivHakemi(db: ReturnType<typeof baglanti>, ad: string): string {
  const mevcut = db
    .prepare('SELECT id FROM hakem WHERE kod = ?')
    .get(ARSIV_KOD) as { id: string } | undefined;
  if (mevcut) return mevcut.id;

  const id = randomUUID();
  db.prepare(
    `INSERT INTO hakem (id, ad, kod, uzmanlik, aktif, sistem, olusturuldu, notlar)
     VALUES (?, ?, ?, '[]', 0, 1, ?, ?)`,
  ).run(
    id,
    ad,
    ARSIV_KOD,
    new Date().toISOString(),
    'SQLite geçişinden önce girilmiş puanların taşındığı kayıt. ' +
      'Sistem kaydı: panele giremez, rapor atanamaz. Sahip olduğu eski ' +
      'değerlendirmeler kayıtta kalıyor — bir puanın sahibi silinemez.',
  );
  return id;
}

export function gecisYap(): GecisSonucu {
  const db = baglanti();
  const sonuc: GecisSonucu = {
    yarisma: 0, kategori: 0, rapor: 0, parmakizi: 0,
    mesaj: 0, arsivDegerlendirmesi: 0, atlanan: [],
  };

  const yarismalar = dosyalariOku<Yarisma>(YARISMA_DIZINI());
  const raporlar = dosyalariOku<Rapor>(RAPOR_DIZINI());

  const yarismaYaz = db.prepare(
    `INSERT INTO yarisma (id, ad, yil, katalog_slug, olusturuldu, icerik_kategorileri)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       ad = excluded.ad, yil = excluded.yil,
       katalog_slug = excluded.katalog_slug,
       icerik_kategorileri = excluded.icerik_kategorileri`,
  );

  const kategoriYaz = db.prepare(
    `INSERT INTO kategori (id, yarisma_id, ad, asama, sablon_dosyasi, olusturuldu,
       duzenlendi, sablon, kurallar, rubrik, ornek_kaynaklar, uyarilar, sartname)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       ad = excluded.ad, asama = excluded.asama,
       sablon_dosyasi = excluded.sablon_dosyasi,
       duzenlendi = excluded.duzenlendi, sablon = excluded.sablon,
       kurallar = excluded.kurallar, rubrik = excluded.rubrik,
       ornek_kaynaklar = excluded.ornek_kaynaklar,
       uyarilar = excluded.uyarilar, sartname = excluded.sartname`,
  );

  const raporYaz = db.prepare(
    `INSERT INTO rapor (id, yarisma_id, kategori_id, basvuru_no, dosya_adi,
       takim, takim_id, proje, icerik_kategori_kodu, yuklendi, durum,
       genel_durum, kontroller, istatistik, kaynak_dogrulamasi,
       ai_degerlendirme, rapor_kimligi, kimlik_uyusmazligi, dosya_yolu,
       nihai_puan, nihai_not, tamamlandi)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       durum = excluded.durum, genel_durum = excluded.genel_durum,
       kontroller = excluded.kontroller,
       kaynak_dogrulamasi = excluded.kaynak_dogrulamasi,
       ai_degerlendirme = excluded.ai_degerlendirme,
       nihai_puan = excluded.nihai_puan, nihai_not = excluded.nihai_not,
       tamamlandi = excluded.tamamlandi`,
  );

  const parmakiziYaz = db.prepare(
    `INSERT INTO parmakizi (rapor_id, veri) VALUES (?, ?)
     ON CONFLICT(rapor_id) DO UPDATE SET veri = excluded.veri`,
  );

  const mesajYaz = db.prepare(
    `INSERT INTO mesaj (id, rapor_id, yazar, rol, metin, tarih, otomatik)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO NOTHING`,
  );

  const degYaz = db.prepare(
    `INSERT INTO degerlendirme (id, rapor_id, hakem_id, puanlar, toplam,
       aciklama, durum, guncellendi, tamamlandi)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(rapor_id, hakem_id) DO UPDATE SET
       puanlar = excluded.puanlar, toplam = excluded.toplam,
       aciklama = excluded.aciklama, durum = excluded.durum,
       tamamlandi = excluded.tamamlandi`,
  );

  const atamaYaz = db.prepare(
    `INSERT INTO atama (id, rapor_id, hakem_id, atandi, atayan)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(rapor_id, hakem_id) DO NOTHING`,
  );

  // Tek işlemde: yarım kalmış geçiş, tutarsız veriden iyidir.
  db.exec('BEGIN');
  try {
    for (const y of yarismalar) {
      yarismaYaz.run(
        y.id, y.ad, y.yil, y.katalogSlug ?? null, y.olusturuldu,
        JSON.stringify(y.icerikKategorileri ?? []),
      );
      sonuc.yarisma++;

      for (const k of y.kategoriler) {
        kategoriYaz.run(
          k.id, y.id, k.ad, k.asama ?? null, k.sablonDosyasi, k.olusturuldu,
          sayi(k.duzenlendi), JSON.stringify(k.sablon), JSON.stringify(k.kurallar),
          JSON.stringify(k.rubrik), JSON.stringify(k.ornekKaynaklar ?? []),
          JSON.stringify(k.uyarilar ?? []), jsonYaz(k.sartname),
        );
        sonuc.kategori++;
      }
    }

    for (const r of raporlar) {
      // Yarışması ya da kategorisi olmayan rapor yabancı anahtarı bozar.
      const yarisma = yarismalar.find((y) => y.id === r.yarismaId);
      const kategori = yarisma?.kategoriler.find((k) => k.id === r.kategoriId);
      if (!kategori) {
        sonuc.atlanan.push(`${r.basvuruNo}: kategorisi bulunamadı`);
        continue;
      }

      raporYaz.run(
        r.id, r.yarismaId, r.kategoriId, r.basvuruNo, r.dosyaAdi,
        r.takim, r.takimId, r.proje, r.icerikKategoriKodu ?? null,
        r.yuklendi, r.durum, r.genelDurum,
        JSON.stringify(r.kontroller ?? []), JSON.stringify(r.istatistik),
        jsonYaz(r.kaynakDogrulamasi), jsonYaz(r.aiDegerlendirme),
        jsonYaz(r.raporKimligi), jsonYaz(r.kimlikUyusmazligi),
        r.dosyaYolu ?? null,
        r.hakemToplam ?? null, r.hakemNotu ?? null, r.tamamlandi ?? null,
      );
      sonuc.rapor++;

      if (r.parmakizi) {
        parmakiziYaz.run(r.id, JSON.stringify(r.parmakizi));
        sonuc.parmakizi++;
      }

      for (const m of r.mesajlar ?? []) {
        mesajYaz.run(
          m.id ?? randomUUID(), r.id, m.yazar, m.rol, m.metin,
          m.tarih ?? new Date().toISOString(), sayi(m.otomatikMi),
        );
        sonuc.mesaj++;
      }

      /*
       * ESKİ PUANLAR ARŞİV HAKEMİNE TAŞINIYOR.
       *
       * Silmek, tamamlanmış bir insan değerlendirmesini yok saymak olurdu.
       * Uydurma bir hakem kaydına yazmak da yanlış — kayıt "arşiv" olarak
       * işaretli ve panele giriş için kullanılamıyor.
       */
      if (r.hakemPuanlari?.length) {
        const hakemId = arsivHakemi(db, r.hakemAdi || 'Arşiv (geçiş öncesi)');
        atamaYaz.run(randomUUID(), r.id, hakemId, r.yuklendi, 'geçiş');
        degYaz.run(
          randomUUID(), r.id, hakemId, JSON.stringify(r.hakemPuanlari),
          r.hakemToplam ?? null, r.hakemNotu ?? null,
          r.durum === 'tamamlandi' ? 'tamamlandi' : 'taslak',
          new Date().toISOString(), r.tamamlandi ?? null,
        );
        sonuc.arsivDegerlendirmesi++;
      }
    }

    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  return sonuc;
}
