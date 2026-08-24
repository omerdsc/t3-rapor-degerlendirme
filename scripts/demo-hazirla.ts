/**
 * Demo hazırlığı — PRD'nin üç akışını yürünebilir hâle getirir.
 *
 * ── NİYE GEREKLİ ────────────────────────────────────────────────────────
 * PRD sayfa 05 üç akış tanımlıyor ve "MVP bütünlüğünü test eder" diyor:
 * jüri bu üçünü sırayla yürüyecek. Ama boş bir kurulumda AKIŞ 02 kırık
 * görünür — hakem panelinde atanmış rapor yoksa ekran boş açılır ve
 * "çalışmıyor" diye okunur. AKIŞ 03 de öyle: onaylı geri bildirim yoksa
 * yarışmacı yalnızca puan görür.
 *
 * Bu betik demo verisini TAMAMLIYOR, uydurmuyor:
 *   · Hakem yoksa üç hakem açıyor
 *   · Atanmamış raporları dağıtıyor (bir kısmı bekleyen kalıyor — akışın
 *     "sürüyor" durumu da görünmeli)
 *   · Tamamlanmış ama geri bildirimi onaylanmamış değerlendirmelere,
 *     yapay zekânın ürettiği metinleri hakem onayı olarak yazıyor
 *
 * Son madde arayüzde hakemin yaptığı şeyin AYNISI: panel yapay zekâ
 * önerisini dolu getiriyor, hakem uygun bulup tamamlıyor. Uydurma metin
 * üretilmiyor.
 *
 * Kullanım: npm run demo
 */

import { randomUUID } from 'node:crypto';
import { baglanti } from '@/lib/db/baglanti';
import { dagit } from '@/lib/db/dagitim';
import {
  akisOzeti, atamalariYaz, degerlendirmeKaydet, hakemEkle, hakemYukleri,
  raporlarinHakemDurumu, raporunDegerlendirmeleri,
} from '@/lib/db/hakem-depo';
import { kategoriGetir, raporGetir, raporlariListele } from '@/lib/depo/depo';

const VARSAYILAN_HAKEMLER = [
  { ad: 'Prof. Dr. Ayşe Demir', kurum: 'İTÜ Uçak ve Uzay Bilimleri', uzmanlik: ['Havacılık'] },
  { ad: 'Dr. Mehmet Kaya', kurum: 'ODTÜ Bilgisayar Mühendisliği', uzmanlik: ['Yazılım'] },
  { ad: 'Dr. Burak Şen', kurum: 'Hacettepe Endüstri Mühendisliği', uzmanlik: ['İSG'] },
];

function hakemleriKur(): number {
  const mevcut = hakemYukleri().filter((y) => y.hakem.aktif && !y.hakem.sistem);
  if (mevcut.length >= 3) return 0;

  let eklenen = 0;
  for (const h of VARSAYILAN_HAKEMLER) {
    if (mevcut.some((m) => m.hakem.ad === h.ad)) continue;
    hakemEkle(h);
    eklenen++;
  }
  return eklenen;
}

function atamalariTamamla(): number {
  const hakemler = hakemYukleri()
    .filter((y) => y.hakem.aktif && !y.hakem.sistem)
    .map((y) => ({ id: y.hakem.id, yuk: y.atanan }));
  if (!hakemler.length) return 0;

  const raporlar = raporlariListele();
  const durum = raporlarinHakemDurumu(raporlar.map((r) => r.id));
  const atanmamis = raporlar.filter((r) => !durum.has(r.id));
  if (!atanmamis.length) return 0;

  /*
   * Rapor başına 2 hakem: çok hakemli değerlendirme ve hakemler arası
   * ayrışma ölçümü demoda görünsün. Tek hakemle sapma her zaman 0 çıkar
   * ve o özellik anlatılamaz.
   */
  const sonuc = dagit(
    atanmamis.map((r) => ({ raporId: r.id, mevcut: [] })),
    hakemler,
    Math.min(2, hakemler.length),
  );
  return atamalariYaz(sonuc.ciftler, 'demo-hazirlik');
}

function geriBildirimleriOnayla(): { rapor: number; degerlendirme: number } {
  let raporSayisi = 0;
  let degSayisi = 0;

  for (const rapor of raporlariListele()) {
    if (!rapor.aiDegerlendirme) continue;
    const ai = rapor.aiDegerlendirme;
    const kategori = kategoriGetir(rapor.yarismaId, rapor.kategoriId);
    if (!kategori) continue;

    const eksikler = raporunDegerlendirmeleri(rapor.id).filter(
      (d) => d.durum === 'tamamlandi' && !d.geriBildirim,
    );
    if (!eksikler.length) continue;

    raporSayisi++;
    for (const d of eksikler) {
      /*
       * Tamamlanmış değerlendirme değiştirilemiyor (`degerlendirmeKaydet`
       * bunu reddediyor) — bilinçli bir kural. Demo hazırlığı için
       * geri bildirim alanını DOĞRUDAN yazıyoruz; bu betik bir bakım
       * aracı, uygulama akışı değil. Puanlara dokunulmuyor.
       */
      baglanti()
        .prepare('UPDATE degerlendirme SET geri_bildirim = ? WHERE id = ?')
        .run(
          JSON.stringify({
            gucluYonler: ai.genelGucluYonler,
            gelisimAlanlari: ai.genelGelisimAlanlari,
            oneriler: ai.kriterler
              .filter((k) => k.oneri)
              .map((k) => ({ kriterKodu: k.kod, metin: k.oneri! })),
          }),
          d.id,
        );
      degSayisi++;
    }
  }
  return { rapor: raporSayisi, degerlendirme: degSayisi };
}

function main() {
  console.log('\nDEMO HAZIRLIĞI\n');

  const yeniHakem = hakemleriKur();
  console.log(`  hakem kaydı        ${yeniHakem ? `+${yeniHakem} eklendi` : 'yeterli'}`);

  const yeniAtama = atamalariTamamla();
  console.log(`  atama              ${yeniAtama ? `+${yeniAtama} yapıldı` : 'eksik yok'}`);

  const gb = geriBildirimleriOnayla();
  console.log(
    `  geri bildirim      ${
      gb.degerlendirme
        ? `${gb.degerlendirme} değerlendirme onaylandı (${gb.rapor} rapor)`
        : 'eksik yok'
    }`,
  );

  const akis = akisOzeti();
  console.log('\nDURUM\n');
  console.log(`  rapor              ${akis.rapor}`);
  console.log(`  tamamlanmış        ${akis.tamamlanmis}`);
  console.log(`  sürüyor            ${akis.suren}`);
  console.log(`  atanmamış          ${akis.atanmamis}`);
  console.log(`  ilerleme           %${akis.yuzde} (${akis.bitenDegerlendirme}/${akis.beklenenDegerlendirme})`);

  /* Demo yolu: her akış için gerçek, açılabilir adres. */
  const hakemler = hakemYukleri().filter((y) => y.hakem.aktif && !y.hakem.sistem);
  const bekleyenHakem = hakemler.find((h) => h.atanan > h.tamamlanan) ?? hakemler[0];

  const sonucluRapor = raporlariListele().find((r) => {
    const d = raporunDegerlendirmeleri(r.id);
    return d.some((x) => x.durum === 'tamamlandi' && x.geriBildirim);
  });

  const raporluYarisma = raporlariListele()[0];

  console.log('\nDEMO YOLU · PRD sayfa 05\n');
  console.log('  AKIŞ 01 · Yarışma Yöneticisi');
  console.log('    /koordinasyon/yarismalar        yarışma kur, ölçütleri onayla');
  if (raporluYarisma) {
    console.log(`    /koordinasyon/raporlar?yarisma=${raporluYarisma.yarismaId}`);
    console.log('                                    rapor yükle, toplu AI başlat');
  }
  console.log('\n  AKIŞ 02 · Hakem');
  if (bekleyenHakem) {
    console.log(`    /hakem/${bekleyenHakem.hakem.kod}                 ${bekleyenHakem.hakem.ad}`);
    console.log(`                                    ${bekleyenHakem.atanan - bekleyenHakem.tamamlanan} bekleyen değerlendirme`);
  } else {
    console.log('    (hakem yok — betiği yeniden çalıştırın)');
  }
  console.log('\n  AKIŞ 03 · Yarışmacı');
  if (sonucluRapor) {
    console.log(`    /sonuc?basvuru=${sonucluRapor.basvuruNo}`);
    console.log('                                    puan + güçlü/gelişim + öneriler');
  } else {
    console.log('    (onaylı geri bildirimli rapor yok)');
  }
  console.log('\n  Koordinasyon panosu: /koordinasyon');
  console.log('  Hacim kanıtı:        npm run hacim -- 1000 kalsin\n');
}

main();
