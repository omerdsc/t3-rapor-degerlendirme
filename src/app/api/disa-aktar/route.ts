/**
 * Değerlendirme sonuçlarını CSV olarak indirir.
 *
 *   /api/disa-aktar?yarisma=<id>              → yarışmanın tüm kategorileri
 *   /api/disa-aktar?yarisma=<id>&kategori=<id> → tek kategori
 *   &maskeli=1                                 → kimlikleri rumuzla
 *
 * MALİYET: $0.
 *
 * KİMLİKLER VARSAYILAN OLARAK AÇIK — ekranlardakinin tersine.
 * Ekranda maskeleme hakem yanlılığını azaltmak için; dışa aktarma ise
 * koordinasyonun kendi kaydı ve sonuç listesi orada gerçek künyeyle
 * anlamlı. Yine de `maskeli=1` ile rumuzlu sürüm alınabiliyor: hakem
 * kalibrasyonu paylaşılırken kimlik gerekmez.
 */

import {
  kategoriCsv, dosyaAdiUret, type RaporHakemVerisi,
} from '@/lib/depo/disa-aktar';
import { raporlariListele, yarismaGetir } from '@/lib/depo/depo';
import {
  nihaiOzet, raporunDegerlendirmeleri, raporunHakemleri,
} from '@/lib/db/hakem-depo';

export async function GET(istek: Request) {
  const q = new URL(istek.url).searchParams;
  const yarismaId = q.get('yarisma');
  const kategoriId = q.get('kategori');
  const maskele = q.get('maskeli') === '1';

  if (!yarismaId) {
    return Response.json({ hata: 'Yarışma seçilmedi.' }, { status: 400 });
  }
  const yarisma = yarismaGetir(yarismaId);
  if (!yarisma) return Response.json({ hata: 'Yarışma bulunamadı.' }, { status: 404 });

  const kategoriler = kategoriId
    ? yarisma.kategoriler.filter((k) => k.id === kategoriId)
    : yarisma.kategoriler;

  if (!kategoriler.length) {
    return Response.json({ hata: 'Kategori bulunamadı.' }, { status: 404 });
  }

  /*
   * Her kategorinin ÖLÇÜTLERİ FARKLI, dolayısıyla sütunları da farklı.
   * Hepsini tek tabloya sıkıştırmak ya sütunları kaybettirir ya da yüzlerce
   * boş sütun üretir. Bunun yerine kategoriler alt alta, her biri kendi
   * başlık satırıyla yazılıyor — Excel'de okunabilir, ayrıştırılabilir.
   */
  const parcalar: string[] = [];
  let toplamRapor = 0;

  for (const k of kategoriler) {
    const raporlar = raporlariListele(yarisma.id, k.id);
    toplamRapor += raporlar.length;

    /*
     * Hakem verisi burada toplanıyor, CSV üreticisinde değil: üretici saf
     * bir dönüştürücü kalıyor ve birim testle sınanabiliyor.
     */
    const hakemVerisi = new Map<string, RaporHakemVerisi>();
    for (const r of raporlar) {
      const atananlar = raporunHakemleri(r.id);
      const degerlendirmeler = raporunDegerlendirmeleri(r.id);
      const ozet = nihaiOzet(r.id);
      hakemVerisi.set(r.id, {
        atanan: atananlar.length,
        nihaiPuan: ozet.puan,
        sapma: ozet.sapma,
        degerlendirmeler: degerlendirmeler.map((d) => ({
          hakemAdi: atananlar.find((h) => h.id === d.hakemId)?.ad ?? '?',
          toplam: d.toplam,
          aciklama: d.aciklama,
          tamamlandi: d.durum === 'tamamlandi',
          puanlar: d.puanlar,
        })),
      });
    }
    if (kategoriler.length > 1) {
      parcalar.push(`﻿${k.ad.replace(/;/g, ',')} — ${raporlar.length} rapor`);
    }
    parcalar.push(kategoriCsv(yarisma, k, raporlar, hakemVerisi, { maskele }));
  }

  const govde = parcalar.join('\n');
  const dosyaAdi = dosyaAdiUret(
    yarisma.ad,
    kategoriler.length === 1 ? kategoriler[0].ad : '',
  );

  return new Response(govde, {
    headers: {
      // charset=utf-8 + gövdedeki BOM: Excel'in Türkçe karakterleri
      // bozmaması için ikisi birden gerekiyor.
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${dosyaAdi}"`,
      'x-rapor-sayisi': String(toplamRapor),
    },
  });
}
