/**
 * HACİM ÖLÇÜMÜ — PRD'nin başlık problemine verilen cevap.
 *
 * PRD sayfa 02'nin başlığı "Yüksek rapor hacmi ve çok aşamalı kontroller,
 * değerlendirme sürecini zorlaştırıyor". Elimizdeki kanıt 7 rapordu. Bir
 * sistemin hacimde çalıştığını söylemek için ölçmek gerekiyor.
 *
 * ── İKİ AYRI ŞEY, AYRI ÖLÇÜLÜYOR ────────────────────────────────────────
 * A) ANALİZ HIZI — gerçek PDF gerektiriyor, ayrı betikte ölçülüyor
 *    (`npm run kanit` ve `scripts/analiz-et.ts`). Rapor başına süre
 *    biliniyor; hacimde toplam süre bundan çarpımla çıkıyor.
 * B) ÖLÇEK DAVRANIŞI — kayıt sayısı gerektiriyor, belge gerektirmiyor.
 *    Koordinatörün gerçekten beklediği yer burası: liste ekranı, pano,
 *    arama, atama. Binlerce PDF üretmek bu ölçümü değiştirmez, uzatır.
 *
 * İkisi karıştırılırsa ölçüm yanıltıcı olur; o yüzden çıktı ayrı
 * başlıklar altında ve her kısmın neyi ölçtüğü yazılı.
 *
 * Kullanım:
 *   npm run hacim                → 500 kayıtla ölç, sonra TEMİZLE
 *   npm run hacim -- 2000        → 2000 kayıtla ölç
 *   npm run hacim -- 500 kalsin  → ölç ve kayıtları BIRAK (demo için)
 */

import { randomUUID } from 'node:crypto';
import { baglanti } from '@/lib/db/baglanti';
import { dagit } from '@/lib/db/dagitim';
import { hakemYukleri, raporlarinHakemDurumu } from '@/lib/db/hakem-depo';
import { panoOzeti, raporlariListele, yarismalariListele } from '@/lib/depo/depo';
import { raporlariAra } from '@/lib/depo/arama';

const ADET = Number(process.argv[2]) || 500;
const KALSIN = process.argv.includes('kalsin');

/** Ölçüm yarışması: gerçek veriye karışmasın, tek sorguyla silinebilsin. */
const OLCUM_YARISMA = 'olcum-hacim-yarismasi';
const OLCUM_KATEGORI = 'olcum-hacim-kategorisi';

function sure<T>(is: () => T): { ms: number; sonuc: T } {
  const t = process.hrtime.bigint();
  const sonuc = is();
  return { ms: Number(process.hrtime.bigint() - t) / 1e6, sonuc };
}

function satir(ad: string, ms: number, ek = '') {
  // 200 ms altı "anında" hissediliyor; 1 sn üstü bekleme olarak algılanıyor.
  const isaret = ms < 200 ? '  ' : ms < 1000 ? ' ~' : ' !';
  console.log(`  ${ad.padEnd(44)} ${ms.toFixed(0).padStart(6)} ms${isaret} ${ek}`);
}

function temizle() {
  const db = baglanti();
  db.exec('BEGIN');
  try {
    // Yabancı anahtarlar ON DELETE CASCADE: atama ve değerlendirme de gider.
    db.prepare('DELETE FROM rapor WHERE yarisma_id = ?').run(OLCUM_YARISMA);
    db.prepare('DELETE FROM kategori WHERE yarisma_id = ?').run(OLCUM_YARISMA);
    db.prepare('DELETE FROM yarisma WHERE id = ?').run(OLCUM_YARISMA);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

function kur() {
  const db = baglanti();
  temizle();

  /*
   * Gerçek bir kategorinin rubriğini ödünç alıyoruz. Uydurma ölçütlerle
   * ölçmek, gerçek rubrik boyutunun (8-10 ölçüt) etkisini gizlerdi.
   */
  const kaynak = yarismalariListele()
    .flatMap((y) => y.kategoriler)
    .find((k) => k.rubrik.kriterler.length >= 6);
  if (!kaynak) throw new Error('Rubriği olan kategori yok; önce yarışma kurun.');

  const simdi = new Date().toISOString();
  db.prepare('INSERT INTO yarisma (id, ad, yil, olusturuldu) VALUES (?, ?, ?, ?)')
    .run(OLCUM_YARISMA, 'ÖLÇÜM — Hacim Testi', 2026, simdi);
  db.prepare(
    `INSERT INTO kategori (id, yarisma_id, ad, sablon_dosyasi, olusturuldu,
       sablon, kurallar, rubrik)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    OLCUM_KATEGORI, OLCUM_YARISMA, 'ÖLÇÜM Kategorisi',
    'olcum-sablon.docx', simdi,
    JSON.stringify(kaynak.sablon), JSON.stringify(kaynak.kurallar),
    JSON.stringify(kaynak.rubrik),
  );
  return kaynak.rubrik.kriterler.length;
}

/**
 * Kontrol sonuçları gerçekçi bir dağılımla dolduruluyor.
 *
 * Hepsi boş bırakılsa liste ekranı hiç rozet çizmez ve ölçüm gerçekte
 * yapılan işten hafif çıkar. Oranlar gerçek fikstür setinden alındı:
 * ~%20 şablon hatası, ~%33 başlık uyarısı, ~%14 dil sapması.
 */
function kontrolOrnegi(i: number): string {
  const bulgu = (kod: string, seviye: string) => ({
    kod, baslik: `${kod} bulgusu`, aciklama: 'Ölçüm verisi.', seviye,
  });
  return JSON.stringify([
    { kod: 'dil', ad: 'Dil', durum: i % 7 === 0 ? 'uyari' : 'temiz', ozet: 'Türkçe',
      bulgular: i % 7 === 0 ? [bulgu('DIL_BOLUM_SAPMASI', 'uyari')] : [] },
    { kod: 'sablon', ad: 'Şablon', durum: i % 5 === 0 ? 'hata' : 'temiz', ozet: 'Güncel',
      bulgular: i % 5 === 0 ? [bulgu('SABLON_ESKI', 'hata')] : [] },
    { kod: 'basliklar', ad: 'Başlıklar', durum: i % 3 === 0 ? 'uyari' : 'temiz', ozet: 'Tam',
      bulgular: i % 3 === 0 ? [bulgu('BASLIK_EKSIK', 'uyari')] : [] },
    { kod: 'kategori', ad: 'Kategori', durum: 'temiz', ozet: 'Uygun', bulgular: [] },
    { kod: 'kaynakca', ad: 'Kaynakça', durum: 'temiz', ozet: 'Yeterli', bulgular: [] },
    { kod: 'benzerlik', ad: 'Benzerlik', durum: i % 11 === 0 ? 'uyari' : 'temiz',
      ozet: 'Örtüşme yok', bulgular: [] },
  ]);
}

function raporlariYaz(adet: number): number {
  const db = baglanti();
  const simdi = new Date().toISOString();

  const ekle = db.prepare(
    `INSERT INTO rapor (id, yarisma_id, kategori_id, basvuru_no, dosya_adi,
       takim, takim_id, proje, yuklendi, durum, genel_durum, kontroller,
       istatistik, dosya_yolu, nihai_puan, nihai_not, tamamlandi)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const t = process.hrtime.bigint();
  db.exec('BEGIN');
  try {
    for (let i = 0; i < adet; i++) {
      ekle.run(
        randomUUID(), OLCUM_YARISMA, OLCUM_KATEGORI,
        `OLCUM-${String(i + 1).padStart(5, '0')}`,
        `olcum-${i + 1}.pdf`,
        `Ölçüm Takımı ${i + 1}`, `olcum-takim-${i + 1}`,
        `Ölçüm Projesi ${i + 1} — otonom sistem ve görüntü işleme`,
        simdi, 'hakem_bekliyor',
        i % 5 === 0 ? 'hata' : i % 3 === 0 ? 'uyari' : 'temiz',
        kontrolOrnegi(i),
        JSON.stringify({
          sayfaSayisi: 14 + (i % 9),
          kelimeSayisi: 3800 + i,
          gorselSayisi: 5 + (i % 4),
        }),
        null, null, null, null,
      );
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return Number(process.hrtime.bigint() - t) / 1e6;
}

function main() {
  console.log(`\nHACİM ÖLÇÜMÜ · ${ADET} rapor\n`);
  const olcutSayisi = kur();

  const yazmaMs = raporlariYaz(ADET);
  console.log(`  ${ADET} rapor kaydı yazıldı · ${(yazmaMs / ADET).toFixed(2)} ms/rapor`);
  console.log(`  Rubrik: ${olcutSayisi} ölçüt (gerçek bir kategoriden alındı)\n`);

  console.log('ÖLÇEK DAVRANIŞI — koordinatörün ekranda beklediği süreler\n');

  const liste = sure(() => raporlariListele(OLCUM_YARISMA, OLCUM_KATEGORI));
  satir('Rapor listesi sorgusu', liste.ms, `${liste.sonuc.length} kayıt`);

  const durum = sure(() => raporlarinHakemDurumu(liste.sonuc.map((r) => r.id)));
  satir('Hakem durumu — tek GROUP BY', durum.ms, `${durum.sonuc.size} satır`);

  const pano = sure(() => panoOzeti());
  satir('Pano özeti', pano.ms);

  const arama = sure(() => raporlariAra(liste.sonuc, 'OLCUM-00250'));
  satir('Arama — başvuru numarası', arama.ms, `${arama.sonuc.length} sonuç`);

  const aramaTakim = sure(() => raporlariAra(liste.sonuc, 'Ölçüm Takımı 400'));
  satir('Arama — takım adı (Türkçe)', aramaTakim.ms, `${aramaTakim.sonuc.length} sonuç`);

  const hakemler = hakemYukleri().filter((h) => h.hakem.aktif && !h.hakem.sistem);
  if (!hakemler.length) {
    console.log('  (hakem kaydı yok — atama ölçümü atlandı)');
  } else {
    const dagitim = sure(() =>
      dagit(
        liste.sonuc.map((r) => ({ raporId: r.id, mevcut: [] })),
        hakemler.map((h) => ({ id: h.hakem.id, yuk: h.atanan })),
        2,
      ),
    );
    satir(
      `Dağıtım hesabı — ${hakemler.length} hakem, rapor başına 2`,
      dagitim.ms,
      `${dagitim.sonuc.ciftler.length} atama`,
    );

    const db = baglanti();
    const atamaEkle = db.prepare(
      `INSERT INTO atama (id, rapor_id, hakem_id, atandi, atayan)
       VALUES (?, ?, ?, ?, 'olcum')
       ON CONFLICT(rapor_id, hakem_id) DO NOTHING`,
    );
    const simdi = new Date().toISOString();
    const yazma = sure(() => {
      db.exec('BEGIN');
      for (const c of dagitim.sonuc.ciftler) {
        atamaEkle.run(randomUUID(), c.raporId, c.hakemId, simdi);
      }
      db.exec('COMMIT');
    });
    satir('Atamaların yazılması', yazma.ms,
      `${(yazma.ms / Math.max(1, dagitim.sonuc.ciftler.length)).toFixed(2)} ms/atama`);

    const durum2 = sure(() => raporlarinHakemDurumu(liste.sonuc.map((r) => r.id)));
    satir('Hakem durumu — atamalar yazıldıktan sonra', durum2.ms, `${durum2.sonuc.size} satır`);

    // Dengeyi de doğrula: hacim altında dağıtım hâlâ dengeli mi?
    const yukler = [...dagitim.sonuc.yeniYuk.values()];
    console.log(
      `\n  Dağıtım dengesi: hakem başına ${Math.min(...yukler)}–${Math.max(...yukler)} rapor`
      + ` (fark ${Math.max(...yukler) - Math.min(...yukler)})`,
    );
  }

  /*
   * MALİYET BÖLÜMÜNÜN İFADESİ ÖNEMLİ.
   *
   * İlk hâli her satıra "TOPLAM_TAVAN ($8) aşılır" yazıyordu ve sistem
   * hacimde çalışmıyor gibi görünüyordu. Oysa $8 bir SİSTEM SINIRI değil,
   * bu kurulumun bütçe ayarı — creathon için $9 yüklendiği için konuldu.
   * Kurumsal kurulumda tavan gerçek bütçeye göre ayarlanır, kod değişmez.
   */
  const RAPOR_BASI = 0.167;
  const tavan = Number(process.env.TOPLAM_TAVAN ?? 8);

  console.log('\nÜCRETLİ KATMAN — hacimle doğrusal, tavan yapılandırılabilir\n');
  for (const n of [100, 500, 1000]) {
    console.log(
      `  ${String(n).padStart(4)} rapor × $${RAPOR_BASI} = $${(n * RAPOR_BASI).toFixed(2)}`,
    );
  }
  console.log(
    `\n  Bu kurulumun tavanı TOPLAM_TAVAN=$${tavan} — creathon bütçesi için konuldu`,
  );
  console.log(
    `  ve ~${Math.floor(tavan / RAPOR_BASI)} rapora yetiyor. Tavan aşılırsa sistem çağrıyı REDDEDER;`,
  );
  console.log('  sessizce harcamaya devam etmez. Kurumsal kurulumda tavan gerçek');
  console.log('  bütçeye göre ayarlanır — kod değişmiyor, ortam değişkeni değişiyor.');
  console.log('\n  Altı otomatik kontrol hacimden BAĞIMSIZ olarak $0: dil, şablon,');
  console.log('  başlık-içerik, kategori, benzerlik ve kaynak doğrulama ücretsiz');
  console.log('  katmanda. Ücretli tek adım kriter bazlı ön değerlendirme.');
  console.log('  Aynı rapor ikinci kez istenirse önbellekten gelir, ek maliyet olmaz.');

  if (KALSIN) {
    console.log(`\n${ADET} ölçüm raporu VERİTABANINDA BIRAKILDI.`);
    console.log('Silmek için: npm run hacim:temizle');
  } else {
    temizle();
    console.log(`\nÖlçüm verisi temizlendi. Bırakmak için: npm run hacim -- ${ADET} kalsin`);
  }
}

/**
 * Sunucu çalışıyorsa gerçek sayfa sürelerini de ölç.
 *
 * ── NİYE GEREKLİ: SORGU SÜRESİ YETMİYOR ─────────────────────────────────
 * İlk ölçümde veritabanı sorgusu 56 ms çıkmıştı ama sayfanın tarayıcıya
 * inmesi 24 SANİYE sürüyordu ve HTML 8,7 MB'tı: 1000 satır, 6003 SVG.
 * Yalnızca sorguyu ölçmek "hızlıyız" demeye yeter gibi görünüyordu ve
 * yanıltıcıydı. Sayfalama bu ölçüm yüzünden eklendi.
 *
 * Ölçüm ÜRETİM DERLEMESİNDE anlamlı (`npm run build && npm start`). Dev
 * sunucusu her istekte yeniden derliyor, çıkan sayı ürünü temsil etmiyor.
 */
async function httpOlc() {
  const kok = process.env.DENETIM_KOK ?? 'http://localhost:3000';
  const anahtar = process.env.KOORDINASYON_ANAHTARI ?? '';
  const yollar = [
    ['Rapor listesi (1. sayfa)', `/koordinasyon/raporlar?yarisma=${OLCUM_YARISMA}&durum=tumu`],
    ['Rapor listesi (son sayfalar)', `/koordinasyon/raporlar?yarisma=${OLCUM_YARISMA}&durum=tumu&sayfa=12`],
    ['Hakemler ve atama', `/koordinasyon/hakemler?yarisma=${OLCUM_YARISMA}`],
    ['Pano', '/koordinasyon'],
  ] as const;

  console.log('\nGERÇEK SAYFA SÜRELERİ  (sunucu çalışıyorsa)\n');
  for (const [ad, yol] of yollar) {
    try {
      const bas = { 'x-koordinasyon-anahtari': anahtar };
      // İlk istek ısıtma; ikincisi ölçülüyor.
      await fetch(kok + yol, { headers: bas });
      const t = process.hrtime.bigint();
      const y = await fetch(kok + yol, { headers: bas });
      const govde = await y.text();
      const ms = Number(process.hrtime.bigint() - t) / 1e6;
      satir(ad, ms, `${(govde.length / 1024).toFixed(0)} KB · HTTP ${y.status}`);
    } catch {
      console.log(`  ${ad.padEnd(44)}      — sunucu kapalı`);
      return;
    }
  }
}

if (KALSIN) {
  main();
  void httpOlc();
} else {
  // Temizlik main() içinde; HTTP ölçümü veriyi gerektirdiği için
  // yalnızca `kalsin` ile çalışıyor.
  main();
}
