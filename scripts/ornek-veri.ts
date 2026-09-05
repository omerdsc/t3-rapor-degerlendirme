/**
 * Örnek veri — her tipten kullanıcı, her aşamada başvuru, iki sezon.
 *
 * ── NİYE VAR ────────────────────────────────────────────────────────────
 * Boş bir sistem tanıtılamıyor. Panel açıldığında her liste boş, her
 * ekran "henüz kayıt yok" diyor ve ürünün ne yaptığı görülmüyor. Bu betik
 * sistemi GEZİLEBİLİR hâle getiriyor.
 *
 * ── NİYE HER AŞAMADAN ───────────────────────────────────────────────────
 * Tek aşamalı veri, ekranların yarısını ölü gösteriyor: durum çizelgesi
 * hep aynı noktada, "değerlendirmede" sayacı hep sıfır, sonuç ekranı hiç
 * açılmıyor. Aşağıdaki kayıtlar dört aşamanın DÖRDÜNÜ de dolduruyor:
 * rapor bekleyen, teslim edilmiş, değerlendirmede ve sonuçlanmış.
 *
 * ── NİYE İKİ SEZON ──────────────────────────────────────────────────────
 * Sistem yıldan yıla birikiyor ve koordinasyonun sezon süzgecine ihtiyacı
 * var. Süzgecin çalıştığını göstermek için süzülecek bir arşiv gerekiyor;
 * tek sezonluk veride süzgeç hep aynı listeyi döndürür.
 *
 * ── ÜRETİMDE ÇALIŞTIRILMAZ ──────────────────────────────────────────────
 * Ayrı bir betik ve hiçbir uygulama kodundan çağrılmıyor. `--temizle` ile
 * açtığı her şeyi geri alıyor.
 *
 * Kullanım:
 *   npm run ornek                → örnek veriyi kurar
 *   npm run ornek -- --temizle   → yalnızca bu betiğin açtıklarını siler
 */

import { baglanti } from '@/lib/db/baglanti';
import {
  basvuruEkle, basvurulariListele, basvuruSil, basvurununRaporId,
} from '@/lib/db/basvuru-depo';
import { mesajEkle } from '@/lib/db/basvuru-mesaji';
import {
  atamalariYaz, degerlendirmeKaydet, hakemEkle, hakemleriListele,
} from '@/lib/db/hakem-depo';
import {
  takimKur, takimaKatil, yarismaciKaydet, yarismacininTakimlari,
} from '@/lib/db/yarismaci-depo';
import { dosyaKaydet, kimlik, raporSil, yarismalariListele } from '@/lib/depo/depo';
import { dosyaOku } from '@/lib/depo/depo';
import { pdfUret } from './ornek-pdf';
import { raporSayfalari } from './ornek-rapor-metni';
import type { Rapor } from '@/lib/depo/tipler';

/** Örnek hesapların ortak parolası — tanıtımda yazılabilsin diye basit. */
const PAROLA = 'ornek1234';

/*
 * Örnek kayıtlar bu işaretlerden tanınıyor. Silme ADA göre değil bunlara
 * göre yapılıyor: gerçek bir kullanıcının adı örnek bir adla çakışabilir,
 * bu işaretler çakışmaz.
 */
const ALAN = '@ornek.tprds';
const HAKEM_NOTU = 'ornek-veri';
const ARSIV_SLUG = 'ornek-arsiv-2025';

// ─────────────────────────────────────────────────────────── kişiler

interface Kisi {
  ad: string;
  kurum: string;
  sehir: string;
  telefon?: string;
}

/** Farklı seviye ve şehirlerden: lise, üniversite, mezun. */
const KISILER: Kisi[] = [
  { ad: 'Elif Yıldırım', kurum: 'Kadıköy Anadolu Lisesi', sehir: 'İstanbul', telefon: '0532 000 00 01' },
  { ad: 'Mert Aydın', kurum: 'Kadıköy Anadolu Lisesi', sehir: 'İstanbul' },
  { ad: 'Zeynep Kara', kurum: 'Kadıköy Anadolu Lisesi', sehir: 'İstanbul' },
  { ad: 'Burak Şahin', kurum: 'Orta Doğu Teknik Üniversitesi', sehir: 'Ankara', telefon: '0533 000 00 02' },
  { ad: 'Ayça Demirtaş', kurum: 'Orta Doğu Teknik Üniversitesi', sehir: 'Ankara' },
  { ad: 'Kerem Öztürk', kurum: 'Ege Üniversitesi', sehir: 'İzmir' },
  { ad: 'Selin Arslan', kurum: 'Ege Üniversitesi', sehir: 'İzmir' },
  { ad: 'Hakan Doğan', kurum: 'Mezun · Bağımsız', sehir: 'Bursa' },
  { ad: 'Nur Balcı', kurum: 'Gaziantep Fen Lisesi', sehir: 'Gaziantep' },
  { ad: 'Emre Çelik', kurum: 'Karadeniz Teknik Üniversitesi', sehir: 'Trabzon' },
];

/** Farklı uzmanlık ve kurumlardan hakemler. */
const HAKEMLER = [
  { ad: 'Prof. Dr. Selim Öz', kurum: 'İTÜ Havacılık', uzmanlik: ['Havacılık', 'Yapay Zeka'] },
  { ad: 'Doç. Dr. Pınar Ak', kurum: 'ODTÜ Elektrik-Elektronik', uzmanlik: ['Gömülü Sistemler', 'Çip Tasarım'] },
  { ad: 'Dr. Murat Tekin', kurum: 'TÜBİTAK', uzmanlik: ['Enerji', 'Çevre'] },
  { ad: 'Öğr. Gör. Deniz Ulu', kurum: 'Ege Üniversitesi', uzmanlik: ['Robotik'] },
];

interface TakimTanimi {
  ad: string;
  kaptan: number;
  uyeler: number[];
  danisman?: string;
}

const TAKIMLAR: TakimTanimi[] = [
  { ad: 'Boğaziçi Enerji', kaptan: 0, uyeler: [1, 2], danisman: 'Ayşe Korkmaz' },
  { ad: 'Anadolu Robotik', kaptan: 3, uyeler: [4], danisman: 'Dr. Selim Öz' },
  { ad: 'Ege Otonom', kaptan: 5, uyeler: [6, 7] },
  { ad: 'Fırat Havacılık', kaptan: 8, uyeler: [9] },
];

/**
 * Başvurular — her biri farklı bir AŞAMADA bitiyor.
 * `asama` betiğin nereye kadar ilerleyeceğini söylüyor.
 */
const BASVURULAR: Array<{
  takim: number;
  proje: string;
  asama: 'basvuruldu' | 'rapor' | 'degerlendirmede' | 'sonuclandi';
  soru?: string;
}> = [
  {
    takim: 0, proje: 'Rüzgâr Türbini Verim Optimizasyonu', asama: 'rapor',
    soru: 'Merhaba, raporumuzda ek olarak sunmak istediğimiz test videosu var.\n'
      + 'Bunu rapora bağlantı olarak eklememiz uygun mudur?',
  },
  { takim: 1, proje: 'Otonom Depo Robotu', asama: 'degerlendirmede' },
  { takim: 2, proje: 'Tarımsal İHA Sürü Kontrolü', asama: 'sonuclandi' },
  { takim: 3, proje: 'Katı Yakıtlı Roket Kurtarma Sistemi', asama: 'basvuruldu' },
];

// ───────────────────────────────────────────────────────── yardımcı

/** "Elif Yıldırım" → "elif.yildirim@ornek.tprds" */
function epostaUret(ad: string): string {
  const harf: Record<string, string> = {
    ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u',
    Ç: 'c', Ğ: 'g', İ: 'i', Ö: 'o', Ş: 's', Ü: 'u',
  };
  const sade = [...ad.toLocaleLowerCase('tr')]
    .map((h) => harf[h] ?? h)
    .join('')
    .replace(/[^a-z\s]/g, '')
    .trim()
    .replace(/\s+/g, '.');
  return sade + ALAN;
}

/**
 * Örnek rapor kaydı — SENTETİK AMA GERÇEK BİR PDF İLE.
 *
 * `raporuAl()` boru hattı gerçek bir belge ve ~10 saniye kaynak
 * doğrulaması istiyor; tanıtım verisi için ikisi de gereksiz, kayıt
 * doğrudan yazılıyor.
 *
 * Ama dosya YAZILIYOR. Önce yazılmıyordu ve hakem paneli "belgeyi
 * görüntüleyemiyorum" durumuna düşüyordu — üründe olmaması gereken bir
 * hâl: rapor kaydı ancak yarışmacı bir dosya yüklediği için var oluyor,
 * dosyasız rapor gerçek akışta oluşmuyor. Tanıtım verisinin ürünü
 * olmayan bir duruma sokması, ekranı yanlış tanıtmak demek.
 *
 * PDF sentetik: gerçek yarışmacı belgeleri örnek takımlara
 * iliştirilmiyor.
 */
function ornekRapor(g: {
  yarismaId: string;
  kategoriId: string;
  basvuruId: string;
  basvuruNo: string;
  takim: string;
  proje: string;
  gunOnce: number;
}): Rapor {
  const t = new Date(Date.now() - g.gunOnce * 86400_000).toISOString();
  const id = kimlik();

  const sayfalar = raporSayfalari(g.proje, g.takim, g.basvuruNo);
  const pdf = pdfUret(sayfalar);

  /*
   * İSTATİSTİK BELGEDEN TURETILIYOR, UYDURULMUYOR.
   *
   * Eskiden sabit sayılar yazılıyordu: "18 sayfa, 5.400+ kelime, 9 görsel".
   * Üretilen PDF ise iki sayfaydı ve hiç görsel taşımıyordu. Hakem panelinin
   * başlığında "18 sayfa · 5.659 kelime" yazıyor, altındaki belgede iki
   * sayfa görünüyordu — ekranın kendi kendini yalanlaması. Görsel sayısı
   * özellikle önemli: kopya kontrolü görsel imzaları üzerinden çalışıyor ve
   * olmayan dokuz görsel, olmayan bir bulguyu mümkün gösterirdi.
   */
  const satirlar = sayfalar.flatMap((x) => x.satirlar);
  const kelimeSayisi = satirlar.reduce(
    (t, r) => t + (r.trim() ? r.trim().split(/\s+/).length : 0),
    0,
  );

  return {
    id,
    yarismaId: g.yarismaId,
    kategoriId: g.kategoriId,
    basvuruId: g.basvuruId,
    basvuruNo: g.basvuruNo,
    dosyaAdi: `${g.proje.toLocaleLowerCase('tr').replace(/[^\p{L}\d]+/gu, '_')}.pdf`,
    takim: g.takim,
    takimId: g.basvuruNo.slice(-5),
    proje: g.proje,
    yuklendi: t,
    durum: 'hakem_bekliyor',
    kontroller: [],
    genelDurum: 'uyari',
    istatistik: {
      sayfaSayisi: sayfalar.length,
      kelimeSayisi,
      // Üretilen PDF metin belgesi; gömmüş görseli yok.
      gorselSayisi: 0,
      baslikSayisi: satirlar.filter((r) => /^\d+\.\s/.test(r)).length,
      taranmisMi: false,
      sureMs: 820,
    },
    dosyaYolu: dosyaKaydet(id, pdf),
  };
}

/*
 * BORU HATTI KİPİ — `--boruhatti`.
 *
 * Varsayılan kip rapor kaydını doğrudan yazıyor: yerelde geliştirirken
 * her tohumlamada rapor başına ~10 saniyelik kaynak doğrulamasını
 * beklemek işi durdururdu.
 *
 * DAĞITIMDA bu doğru seçim değil. Doğrudan yazılan raporun otomatik
 * kontrolleri boş kalıyor ve jüri "Otomatik ön kontroller" şeridini boş
 * görüyor — altı MVP maddesinden biri ekranda hiç görünmüyor. Bu kip
 * raporu gerçek boru hattından (`raporuAl`) geçiriyor: şablon uyumu,
 * başlık denetimi, künye okuma, kaynak doğrulama, parmak izi ve
 * benzerlik tazeleme — hepsi gerçekte nasıl çalışıyorsa öyle.
 */
const BORU_HATTI = process.argv.includes('--boruhatti');

// ─────────────────────────────────────────────────────────────── kur

async function kur() {
  const db = baglanti();
  const { raporKaydet } = await import('@/lib/depo/depo');

  const yarismalar = yarismalariListele().filter((y) => y.kategoriler.length > 0);
  if (yarismalar.length < 4) {
    console.log('En az dört kategorili yarışma gerekiyor; katalog kurulu mu?');
    return;
  }

  // ---------------------------------------------------------- hesaplar
  const hesaplar: Array<Kisi & { id: string; eposta: string }> = [];
  for (const k of KISILER) {
    const eposta = epostaUret(k.ad);
    const varMi = db.prepare('SELECT id FROM yarismaci WHERE eposta = ?').get(eposta) as
      | { id: string } | undefined;
    if (varMi) {
      hesaplar.push({ ...k, id: varMi.id, eposta });
      continue;
    }
    const y = await yarismaciKaydet({
      eposta, parola: PAROLA, adSoyad: k.ad,
      kurum: k.kurum, sehir: k.sehir, telefon: k.telefon,
    });
    hesaplar.push({ ...k, id: y.id, eposta });
  }
  console.log(`${hesaplar.length} yarışmacı hesabı`);

  // ------------------------------------------------------------ hakem
  const mevcutHakem = hakemleriListele();
  const hakemler = HAKEMLER.map((h) => {
    const v = mevcutHakem.find((x) => x.ad === h.ad);
    if (v) return v;
    return hakemEkle({ ...h, eposta: epostaUret(h.ad), notlar: HAKEM_NOTU });
  });
  console.log(`${hakemler.length} hakem  (${hakemler.map((h) => h.kod).join(', ')})`);

  // ---------------------------------------------------------- takımlar
  const takimlar = TAKIMLAR.map((t) => {
    const kaptan = hesaplar[t.kaptan];
    const v = yarismacininTakimlari(kaptan.id).find((x) => x.ad === t.ad);
    if (v) return v;
    const takim = takimKur({
      ad: t.ad, kaptanId: kaptan.id,
      kurum: kaptan.kurum, sehir: kaptan.sehir, danisman: t.danisman,
    });
    for (const u of t.uyeler) takimaKatil(takim.id, hesaplar[u].id);
    return takim;
  });
  console.log(`${takimlar.length} takım  (${takimlar.map((t) => t.katilimKodu).join(', ')})`);

  // -------------------------------------------------------- başvurular
  for (let i = 0; i < BASVURULAR.length; i++) {
    const b = BASVURULAR[i];
    const takim = takimlar[b.takim];
    const yarisma = yarismalar[i % yarismalar.length];
    const kategori = yarisma.kategoriler[0];
    const kaptanId = hesaplar[TAKIMLAR[b.takim].kaptan].id;

    const mevcut = basvurulariListele(yarisma.id, kategori.id)
      .find((x) => x.takimKaydiId === takim.id);
    if (mevcut) {
      console.log(`  başvuru zaten var: ${mevcut.basvuruNo}`);
      continue;
    }

    const basvuru = basvuruEkle(
      {
        yarismaId: yarisma.id, kategoriId: kategori.id,
        takim: takim.ad, takimId: takim.katilimKodu, proje: b.proje,
        takimKaydiId: takim.id, yarismaciId: kaptanId,
        eposta: hesaplar[TAKIMLAR[b.takim].kaptan].eposta,
      },
      yarisma.yil,
    );

    if (b.soru) {
      mesajEkle({
        basvuruId: basvuru.id, yazarRol: 'yarismaci',
        yazarAdi: hesaplar[TAKIMLAR[b.takim].kaptan].ad,
        yarismaciId: kaptanId, metin: b.soru,
      });
    }

    if (b.asama === 'basvuruldu') {
      console.log(`  ${basvuru.basvuruNo}  ${b.proje.slice(0, 34).padEnd(36)} rapor bekleniyor`);
      continue;
    }

    // ---- rapor
    const taslak = ornekRapor({
      yarismaId: yarisma.id, kategoriId: kategori.id,
      basvuruId: basvuru.id, basvuruNo: basvuru.basvuruNo,
      takim: takim.ad, proje: b.proje, gunOnce: 3 + i * 4,
    });

    let rapor = taslak;
    if (BORU_HATTI) {
      const { raporuAl } = await import('@/lib/analiz/rapor-alma');
      const bayt = dosyaOku(taslak.id);
      const sonuc = await raporuAl({
        veri: new Uint8Array(bayt!),
        dosyaAdi: taslak.dosyaAdi,
        yarisma,
        kategori,
        beyan: { takim: takim.ad, proje: b.proje, basvuruNo: basvuru.basvuruNo },
        basvuruId: basvuru.id,
      });
      rapor = sonuc.rapor;
    } else {
      await raporKaydet(taslak);
    }

    if (b.asama === 'rapor') {
      console.log(`  ${basvuru.basvuruNo}  ${b.proje.slice(0, 34).padEnd(36)} rapor teslim edildi`);
      continue;
    }

    // ---- hakem ataması
    const atananlar = hakemler.slice(0, b.asama === 'sonuclandi' ? 3 : 2);
    atamalariYaz(
      atananlar.map((h) => ({ raporId: rapor.id, hakemId: h.id })),
      'Örnek veri',
    );

    if (b.asama === 'degerlendirmede') {
      /*
       * Biri bitirmiş, öteki sürüyor: "2/3 hakem tamamladı" satırının
       * gerçek bir karşılığı olsun. Hepsi bitmiş olsaydı aşama
       * "sonuçlandı"ya kayardı ve ara durum hiç görünmezdi.
       */
      puanla(rapor, kategori, atananlar[0].id, 74);
      console.log(`  ${basvuru.basvuruNo}  ${b.proje.slice(0, 34).padEnd(36)} değerlendirmede (1/${atananlar.length})`);
      continue;
    }

    // ---- sonuçlandı: hepsi puanladı
    const puanlar = [78, 71, 83];
    atananlar.forEach((h, n) => puanla(rapor, kategori, h.id, puanlar[n] ?? 75));
    console.log(`  ${basvuru.basvuruNo}  ${b.proje.slice(0, 34).padEnd(36)} sonuçlandı`);
  }

  arsivSezonu();

  console.log('\nYARIŞMACI HESAPLARI (parola hepsinde aynı):');
  for (const h of hesaplar) {
    console.log(`  ${h.eposta.padEnd(34)} ${PAROLA}   ${h.kurum}`);
  }
  console.log('\nHAKEM ERİŞİM KODLARI:');
  for (const h of hakemler) console.log(`  ${h.kod}   ${h.ad} · ${h.kurum ?? ''}`);
}

/** Bir hakemin puanlamasını yazar — rubrikteki her ölçüte orantılı puan. */
function puanla(
  rapor: Rapor,
  kategori: { rubrik: { kriterler: Array<{ kod: string; ad: string; puan: number }> } },
  hakemId: string,
  hedefToplam: number,
) {
  const kriterler = kategori.rubrik.kriterler;
  if (!kriterler.length) return;
  const azami = kriterler.reduce((t, k) => t + k.puan, 0) || 100;
  const oran = hedefToplam / azami;

  degerlendirmeKaydet({
    raporId: rapor.id,
    hakemId,
    puanlar: kriterler.map((k) => ({
      kriterKodu: k.kod,
      puan: Math.round(k.puan * oran * 10) / 10,
      not: undefined,
    })),
    aciklama:
      'Rapor bütünlüklü ve yöntem bölümü açık yazılmış. Deneysel doğrulama '
      + 'bölümü güçlendirilebilir.',
    geriBildirim: {
      gucluYonler: [
        'Problem tanımı somut ve ölçülebilir bir ihtiyaca dayanıyor.',
        'Yöntem bölümü adım adım izlenebilir; tekrarlanabilirlik yüksek.',
      ],
      gelisimAlanlari: [
        'Deneysel sonuçlar tek koşulda ölçülmüş; farklı koşullarda tekrar önerilir.',
        'Kaynakçada güncel çalışmalara daha fazla yer verilebilir.',
      ],
      // Ölçüt bazında öneri: ilk iki ölçüte somut bir cümle.
      oneriler: kriterler.slice(0, 2).map((k) => ({
        kriterKodu: k.kod,
        metin: `${k.ad} bölümünde ölçüm koşulları ayrıca belirtilebilir.`,
      })),
    },
    tamamla: true,
  });
}

/**
 * Arşiv sezonu — geçen yılın kapanmış bir yarışması.
 *
 * Sezon süzgecinin süzecek bir şeyi olması için gerekiyor. Tek sezonluk
 * veride süzgeç her zaman aynı listeyi döndürür ve çalışıp çalışmadığı
 * anlaşılmaz.
 *
 * Bu sezonun BAŞVURU KAYDI YOK, yalnızca raporları var: sistem devralınan
 * bir arşivi de taşıyabilmeli ve o raporlar "ARŞİV" olarak işaretli
 * görünmeli.
 */
function arsivSezonu() {
  const db = baglanti();
  const varMi = db.prepare('SELECT id FROM yarisma WHERE katalog_slug = ?').get(ARSIV_SLUG) as
    | { id: string } | undefined;
  if (varMi) {
    console.log('  arşiv sezonu zaten var');
    return;
  }

  const kaynak = yarismalariListele().find((y) => y.kategoriler.length > 0);
  if (!kaynak) return;
  const kaynakKategori = kaynak.kategoriler[0];

  const yid = kimlik();
  const kid = kimlik();
  const simdi = new Date().toISOString();

  db.exec('BEGIN');
  try {
    db.prepare(
      `INSERT INTO yarisma (id, ad, yil, katalog_slug, olusturuldu, icerik_kategorileri)
       VALUES (?, ?, 2025, ?, ?, '[]')`,
    ).run(yid, `${kaynak.ad} (2025)`, ARSIV_SLUG, simdi);

    // Kategori kaynaktan kopyalanıyor: şablon ve rubrik gerçek olsun,
    // arşiv raporları da gerçek ölçütlerle listelensin.
    const k = db
      .prepare('SELECT * FROM kategori WHERE id = ?')
      .get(kaynakKategori.id) as Record<string, string | number>;
    db.prepare(
      `INSERT INTO kategori (id, yarisma_id, ad, asama, sablon_dosyasi, olusturuldu,
         duzenlendi, sablon, kurallar, rubrik, ornek_kaynaklar, uyarilar, sartname)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      kid, yid, k.ad, k.asama, k.sablon_dosyasi, simdi, k.duzenlendi,
      k.sablon, k.kurallar, k.rubrik, k.ornek_kaynaklar, k.uyarilar, k.sartname,
    );

    const projeler = [
      'Güneş İzleyici Panel Sistemi',
      'Akıllı Sera İklim Kontrolü',
      'Su Altı Görüntüleme Aracı',
    ];
    for (let i = 0; i < projeler.length; i++) {
      const t = new Date(Date.UTC(2025, 4, 12 + i)).toISOString();
      db.prepare(
        `INSERT INTO rapor (id, yarisma_id, kategori_id, basvuru_no, dosya_adi,
           takim, takim_id, proje, yuklendi, durum, genel_durum, kontroller,
           istatistik, nihai_puan, tamamlandi)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'tamamlandi', 'temiz', '[]', ?, ?, ?)`,
      ).run(
        kimlik(), yid, kid, `TF-2025-${String(10230 + i)}`,
        `${projeler[i].toLocaleLowerCase('tr').replace(/[^\p{L}\d]+/gu, '_')}.pdf`,
        `Arşiv Takım ${i + 1}`, `ARS0${i + 1}`, projeler[i], t,
        JSON.stringify({
          sayfaSayisi: 22, kelimeSayisi: 6100, gorselSayisi: 11,
          baslikSayisi: 15, taranmisMi: false, sureMs: 0,
        }),
        [81.5, 66.0, 74.5][i], t,
      );
    }
    db.exec('COMMIT');
    console.log(`  arşiv sezonu 2025 kuruldu (${projeler.length} rapor)`);
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

// ──────────────────────────────────────────────────────────── temizle

function temizle() {
  const db = baglanti();

  // Arşiv sezonu — CASCADE kategorileri ve raporları da götürüyor.
  const arsiv = db.prepare('SELECT id FROM yarisma WHERE katalog_slug = ?').get(ARSIV_SLUG) as
    | { id: string } | undefined;
  if (arsiv) {
    db.prepare('DELETE FROM yarisma WHERE id = ?').run(arsiv.id);
    console.log('arşiv sezonu silindi');
  }

  const hesaplar = db
    .prepare('SELECT id, eposta FROM yarismaci WHERE eposta LIKE ?')
    .all(`%${ALAN}`) as Array<{ id: string; eposta: string }>;
  const kimlikler = new Set(hesaplar.map((h) => h.id));

  // Önce başvurular ve raporları: başvuru silinmeden takım silinemiyor.
  for (const b of basvurulariListele()) {
    if (!b.yarismaciId || !kimlikler.has(b.yarismaciId)) continue;
    const r = basvurununRaporId(b.id);
    if (r) raporSil(r);
    basvuruSil(b.id);
    console.log('başvuru silindi:', b.basvuruNo);
  }

  for (const h of hesaplar) {
    // Takımlar kaptanın hesabına CASCADE ile bağlı.
    db.prepare('DELETE FROM yarismaci WHERE id = ?').run(h.id);
  }
  console.log(`${hesaplar.length} hesap silindi`);

  const hs = db.prepare('DELETE FROM hakem WHERE notlar = ?').run(HAKEM_NOTU);
  console.log(`${hs.changes} hakem silindi`);
}

/*
 * Üst düzey `await` YOK: tsx betikleri CommonJS'e derliyor ve orada
 * desteklenmiyor ("Top-level await is currently not supported").
 */
async function calistir() {
  if (process.argv.includes('--temizle')) temizle();
  else await kur();
}

calistir().catch((e) => {
  console.error(e);
  process.exit(1);
});

