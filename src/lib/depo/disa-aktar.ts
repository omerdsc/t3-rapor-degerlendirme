/**
 * Değerlendirme sonuçlarını CSV olarak dışa aktarır.
 *
 * NEDEN GEREKLİ
 * Koordinasyon sonuçları sistemin dışına taşımak zorunda: sıralama listesi
 * hazırlamak, üst birime rapor vermek, itiraz sürecinde kanıt sunmak.
 * Sonuç üretemeyen bir değerlendirme sistemi yarım kalır — hakem puanladı
 * ama puan sistemin içinde hapis.
 *
 * NEDEN CSV, XLSX DEĞİL
 * CSV bağımlılık gerektirmiyor ve Excel'de doğrudan açılıyor. XLSX için bir
 * kütüphane eklemek, tek kazanımı biçimlendirme olan bir bağımlılık demek.
 *
 * ── EXCEL VE TÜRKÇE ─────────────────────────────────────────────────────
 * İki ayrı tuzak var ve ikisi de sessizce bozuyor:
 *
 *   1. BOM olmadan UTF-8 CSV'yi Excel Windows'ta ANSI sanıyor;
 *      "Takım Anadolu" → "TakÄ±m Anadolu" olarak açılıyor.
 *   2. Türkçe Excel yerelinde sütun ayıracı virgül değil NOKTALI VİRGÜL.
 *      Virgül kullanılırsa bütün satır tek hücreye giriyor.
 *
 * Bu yüzden BOM ekleniyor ve ayıraç noktalı virgül.
 */

import { raporuMaskele } from './maskele';
import type { Rapor, Yarisma, YarismaKategorisi } from './tipler';

/** CSV hücresini kaçırır. */
function hucre(deger: string | number | undefined | null): string {
  if (deger === undefined || deger === null) return '';
  const m = String(deger).replace(/\r?\n/g, ' ').trim();
  // Ayıraç, tırnak ya da satır sonu içeren değer tırnaklanır.
  return /[";]/.test(m) ? `"${m.replace(/"/g, '""')}"` : m;
}

function satir(hucreler: Array<string | number | undefined | null>): string {
  return hucreler.map(hucre).join(';');
}

export interface AktarimSecenekleri {
  /** Kimlikler maskeli mi çıksın? Varsayılan: hayır — dışa aktarma
   *  koordinasyonun kendi kaydı, orada gerçek künye gerekiyor. */
  maskele?: boolean;
}

/**
 * Bir kategorinin bütün raporlarını CSV'ye çevirir.
 *
 * Sütunlar sabit değil: her ölçüt için AYRI bir sütun açılıyor. Sabit
 * sütunlu bir çıktı, 9 ölçütlü rubrikte hangi puanın neye ait olduğunu
 * gizlerdi ve itiraz sürecinde işe yaramazdı.
 */
export function kategoriCsv(
  yarisma: Yarisma,
  kategori: YarismaKategorisi,
  raporlar: Rapor[],
  secenekler: AktarimSecenekleri = {},
): string {
  const olcutler = kategori.rubrik.kriterler;

  const baslik = [
    'Başvuru No',
    'Takım',
    'Takım ID',
    'Proje',
    'Durum',
    'Sayfa',
    'Kelime',
    ...olcutler.map((o) => `${o.ad} (${o.puan})`),
    'Hakem Toplam',
    'Azami Puan',
    'Yapay Zekâ Önerisi',
    'Fark',
    'Değerlendiren Hakem',
    'Hakem Notu',
    'Otomatik Bulgular',
    'Kaynak Doğrulama',
    'Benzerlik',
    'Tamamlanma',
  ];

  const satirlar = raporlar.map((r) => {
    const m = secenekler.maskele ? raporuMaskele(r, true) : null;
    const puanlar = new Map(r.hakemPuanlari?.map((p) => [p.kriterKodu, p.puan]) ?? []);
    const ai = r.aiDegerlendirme;

    const kritik = r.kontroller
      .flatMap((k) => k.bulgular.filter((b) => b.seviye === 'hata'))
      .map((b) => b.kod);

    const kd = r.kaynakDogrulamasi;
    const benzerlik = r.kontroller.find((k) => k.kod === 'benzerlik');

    return satir([
      m ? m.basvuruNo : r.basvuruNo,
      m ? m.takim : r.takim,
      m ? m.raporKodu : r.takimId,
      r.proje,
      r.durum,
      r.istatistik.sayfaSayisi,
      r.istatistik.kelimeSayisi,
      // Puanlanmamış ölçüt boş kalıyor; 0 yazmak "sıfır verildi" demek olurdu.
      ...olcutler.map((o) => puanlar.get(o.kod) ?? ''),
      r.hakemToplam ?? '',
      kategori.rubrik.toplamPuan,
      ai?.aiToplam ?? '',
      ai && r.hakemToplam !== undefined
        ? Number((r.hakemToplam - ai.aiToplam).toFixed(1))
        : '',
      r.hakemAdi ?? '',
      r.hakemNotu ?? '',
      kritik.length ? kritik.join(', ') : '',
      kd ? `${kd.dogrulanan} doğrulandı / ${kd.indekslenemez} indekslenemez` : '',
      benzerlik?.ozet ?? '',
      r.tamamlandi ? r.tamamlandi.slice(0, 10) : '',
    ]);
  });

  /*
   * BOM (﻿) Excel'in UTF-8'i tanıması için. Olmadan Türkçe karakterler
   * Windows Excel'de bozuk açılıyor — dosya doğru, okuyucu yanlış varsayıyor.
   */
  return `﻿${satir(baslik)}\n${satirlar.join('\n')}\n`;
}

/** Dosya adı — Türkçe karakterler ve boşluklar indirilebilir hale getirilir. */
export function dosyaAdiUret(yarismaAdi: string, kategoriAdi: string): string {
  const sadelestir = (s: string) =>
    s
      .replace(/[ğĞ]/g, 'g').replace(/[üÜ]/g, 'u').replace(/[şŞ]/g, 's')
      .replace(/[ıİ]/g, 'i').replace(/[öÖ]/g, 'o').replace(/[çÇ]/g, 'c')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 40);

  const tarih = new Date().toISOString().slice(0, 10);
  const kategoriEki =
    kategoriAdi && kategoriAdi !== yarismaAdi ? `-${sadelestir(kategoriAdi)}` : '';
  return `${sadelestir(yarismaAdi)}${kategoriEki}-${tarih}.csv`;
}
