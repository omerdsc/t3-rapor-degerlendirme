/*
 * Var olan bir raporun PDF'ini YERİNDE yeniler.
 *
 * Tohumlamayı baştan koşturmak rapor kimliklerini değiştirir; bu da
 * hakem atamalarını, yapay zekâ ön değerlendirmesini (parası ödenmiş) ve
 * kaynakça denetimini çöpe atardı. Dosya aynı kimlikle üstüne yazılıyor.
 */
import { dosyaKaydet, raporGetir, raporlariListele, yarismalariListele } from '@/lib/depo/depo';
import { pdfUret } from './ornek-pdf';
import { raporSayfalari } from './ornek-rapor-metni';

const ARANAN = process.argv[2] ?? 'otonom_depo';

for (const y of yarismalariListele()) {
  for (const r of raporlariListele(y.id)) {
    const t = raporGetir(r.id);
    if (!t?.dosyaAdi?.includes(ARANAN)) continue;
    const sayfalar = raporSayfalari(t.proje ?? '', t.takim ?? '', t.basvuruNo ?? '');
    dosyaKaydet(t.id, pdfUret(sayfalar));
    console.log(`${t.dosyaAdi} yenilendi (${sayfalar.length} sayfa) · ${t.id}`);
  }
}
