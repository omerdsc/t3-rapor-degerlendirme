/**
 * Katalogdan depoya aktarım.
 *
 * NEDEN HEPSİ BİRDEN AKTARILMIYOR
 * Katalogda 60 yarışma ve 260 belge var. Hepsini indirip çözümlemek teknik
 * olarak mümkün ama iki nedenle yanlış:
 *
 *   1. AI özeti rapor başına değil KATEGORİ başına $0.19. 60 yarışmanın
 *      şartnamesini özetlemek ~$11 eder; kalan bütçenin tamamından fazla.
 *      Oysa koordinasyon bir seferde bir yarışmayla çalışıyor.
 *   2. Şablon çözümlemesi bir TASLAK üretir ve yöneticinin onaylaması
 *      gerekir. 60 yarışmanın taslağını kimse gözden geçirmez; onaysız
 *      rubrikler sessizce yanlış puanlama üretir.
 *
 * Bu yüzden katalog bir VİTRİNDİR: hepsi görünür, aktarılan çözümlenir.
 * Aktarım ücretsizdir; AI özeti ayrı ve isteğe bağlı bir adımdır.
 */

import { anahtar } from '../analiz/normalize';
import type { KatalogBelgesi, KatalogYarismasi } from './tipler';

/** Aktarım için hazırlanmış tek kategori. */
export interface AktarimKategorisi {
  ad: string;
  /** Bu kategorinin şablonu. Yoksa kategori aktarılamaz. */
  sablon: KatalogBelgesi;
  /** Kategoriye özel şartname; yoksa yarışma genelindeki kullanılır. */
  sartname?: KatalogBelgesi;
  teknikSartname?: KatalogBelgesi;
  /** Şablon hangi rapor aşaması için. */
  asama?: string;
  seviye?: string;
}

export interface AktarimPlani {
  yarismaAdi: string;
  yil: number;
  slug: string;
  kategoriler: AktarimKategorisi[];
  /** Aktarılamayan belgeler ve nedeni — sessizce düşürmemek için. */
  atlanan: Array<{ etiket: string; neden: string }>;
}

/**
 * Aynı ada düşen şablonları ayırır.
 *
 * ÇAKIŞMA GERÇEK BİR VERİ KAYBIYDI. Robotaksi'de "Hazır Araç" kategorisinin
 * İKİ şablonu var: Kritik Tasarım Raporu ve Teknik Yeterlilik Formu. İkisi de
 * "Hazır Araç" adını alıyordu; katalog doğrulamasında aynı ad iki kez
 * listelendi, biri 100 puanlık rubrik üretti öteki hiç. Depoda ikisi ayrı
 * kayıt olsa bile yönetici hangisinin hangisi olduğunu ayırt edemezdi.
 *
 * Ad çakışan grupta ayırt edici olarak sırayla şunlar denenir:
 *   1. rapor aşaması (KTR / ÖDR / …)
 *   2. etiketlerin ORTAK OLMAYAN sözcükleri ("Kritik Tasarım" / "Teknik
 *      Yeterlilik Formu") — kategori türetimindeki yöntemin aynısı
 *   3. sıra numarası — son çare, hiç olmazsa üst üste binmez
 */
const AYIRT_GURULTU = new Set([
  'sablon', 'sablonu', 'rapor', 'raporu', 'teknofest', 'yarismasi', 'yarisma',
  'kategori', 'kategorisi', 'proje', 'seviyesi',
]);

function adlariAyristir(kategoriler: AktarimKategorisi[]): void {
  const gruplar = new Map<string, AktarimKategorisi[]>();
  for (const k of kategoriler) {
    const dizi = gruplar.get(k.ad) ?? [];
    dizi.push(k);
    gruplar.set(k.ad, dizi);
  }

  for (const [ad, grup] of gruplar) {
    if (grup.length < 2) continue;

    const tokenler = grup.map((k) =>
      onarsizBol(k.sablon.etiket),
    );
    const sayim = new Map<string, number>();
    for (const t of tokenler) {
      for (const x of new Set(t.map(anahtar))) sayim.set(x, (sayim.get(x) ?? 0) + 1);
    }

    for (const [i, k] of grup.entries()) {
      const ayirt = tokenler[i]
        .filter((token) => {
          const a = anahtar(token);
          if (!a || AYIRT_GURULTU.has(a) || /^\d{4}$/.test(a)) return false;
          return sayim.get(a) !== grup.length;
        })
        .slice(0, 4)
        .join(' ')
        .trim();

      const etiket = k.asama ?? (ayirt.length >= 3 ? ayirt : `${i + 1}`);
      k.ad = `${ad} · ${etiket}`.slice(0, 120);
    }
  }
}

const onarsizBol = (s: string) =>
  s.split(/[\s/,()]+/).map((t) => t.trim()).filter(Boolean);

/** Etiketten yılı okur; bulamazsa içinde bulunduğumuz yıla düşer. */
function yilCikar(y: KatalogYarismasi, varsayilan: number): number {
  for (const b of y.belgeler) {
    const m = b.etiket.match(/\b(20\d{2})\b/);
    if (m) return Number(m[1]);
  }
  return varsayilan;
}

/**
 * Bir yarışmayı aktarıma hazırlar.
 *
 * KATEGORİ EŞLEME KURALLARI
 * - Şablonu olan her kategori aktarılır. Şablonsuz kategori (yalnızca
 *   şartnamede geçen) aktarılmaz: değerlendirilecek rubrik çıkmaz.
 * - `tumKategoriler` işaretli şablon, kategorisi kendi şablonu olmayan
 *   kategorilere yedek olarak verilir.
 * - Kategorisiz şablon (yarışmanın tek şablonu) tek kategori üretir.
 * - Bir kategoride birden çok aşamanın şablonu varsa (ÖTR + DTR) her aşama
 *   AYRI kategori olur: rubrikleri farklıdır, aynı rafa konamaz.
 */
export function aktarimPlaniKur(
  y: KatalogYarismasi,
  simdikiYil: number,
  /** Yalnızca bu kategoriler aktarılsın; boşsa hepsi. */
  secilenler: string[] = [],
): AktarimPlani {
  const atlanan: Array<{ etiket: string; neden: string }> = [];
  const sablonlar = y.belgeler.filter((b) => b.tur === 'sablon');

  const genelSartname = y.belgeler.find((b) => b.tur === 'sartname' && !b.kategori);
  const genelTeknik = y.belgeler.find((b) => b.tur === 'teknik_sartname' && !b.kategori);
  const tumKategoriSablonu = sablonlar.find((b) => b.tumKategoriler);

  const kategoriler: AktarimKategorisi[] = [];

  for (const sablon of sablonlar) {
    if (sablon.tumKategoriler) continue; // aşağıda yedek olarak kullanılıyor

    /*
     * ADLANDIRMA — HER ŞABLON AYRI GİRDİ OLMAK ZORUNDA
     *
     * Bir şablonun kimliği üç kaynaktan gelir:
     *   kategori    → gerçek kategori ("Analog Tasarım", "Lise")
     *   ayirtEdici  → kategori değil ama kardeşinden ayıran şey ("KTR","TYF")
     *   yarışma adı → tek şablonlu yarışmalar
     *
     * ayirtEdici atlanırsa Elektronik Harp'ın KTR ve TYF şablonları aynı ada
     * düşer; ikisi tek girdiye çöker ve biri kaybolur. Rubrikleri farklı
     * olduğu için bu sessiz bir yanlış puanlama kaynağıdır.
     */
    const kategoriAdi = sablon.kategori ?? sablon.ayirtEdici ?? y.ad;
    // Aynı kategoride iki aşama varsa ad aşamayla ayrılır: "Lise · ÖDR".
    const ad = sablon.asama && y.asamalar.length > 1 && !sablon.ayirtEdici
      ? `${kategoriAdi} · ${sablon.asama}`
      : kategoriAdi;

    kategoriler.push({
      ad,
      sablon,
      // Kategoriye özel şartname varsa o kazanır; yoksa yarışma geneli.
      sartname:
        y.belgeler.find(
          (b) => b.tur === 'sartname' && b.kategori && b.kategori === sablon.kategori,
        ) ?? genelSartname,
      teknikSartname:
        y.belgeler.find(
          (b) => b.tur === 'teknik_sartname' && b.kategori && b.kategori === sablon.kategori,
        ) ?? genelTeknik,
      asama: sablon.asama,
      seviye: sablon.seviye,
    });
  }

  // "Tüm Kategoriler" şablonu: yalnızca hiç kategori çıkmadıysa tek başına
  // kategori olur. Aksi halde zaten her kategorinin kendi şablonu var.
  if (tumKategoriSablonu) {
    if (!kategoriler.length) {
      kategoriler.push({
        ad: y.ad,
        sablon: tumKategoriSablonu,
        sartname: genelSartname,
        teknikSartname: genelTeknik,
        asama: tumKategoriSablonu.asama,
      });
    } else {
      atlanan.push({
        etiket: tumKategoriSablonu.etiket,
        neden: 'tüm kategoriler için; kategorilerin kendi şablonu var',
      });
    }
  }

  /*
   * SIRA ÖNEMLİ: ad ayrıştırması SEÇİM SÜZGECİNDEN ÖNCE çalışmalı.
   *
   * Arayüz kategori adlarını plandan okuyup geri gönderiyor; o adlar
   * ayrıştırılmış adlar ("Hazır Araç · KTR"). Süzgeci önce uygularsak
   * ayrıştırılmamış ada ("Hazır Araç") bakar, hiçbir seçim eşleşmez ve
   * kullanıcı "aktar" dediğinde sessizce hiçbir şey aktarılmaz.
   */
  adlariAyristir(kategoriler);

  if (secilenler.length) {
    for (let i = kategoriler.length - 1; i >= 0; i--) {
      if (!secilenler.includes(kategoriler[i].ad)) {
        atlanan.push({ etiket: kategoriler[i].sablon.etiket, neden: 'seçilmedi' });
        kategoriler.splice(i, 1);
      }
    }
  }

  for (const kat of y.kategoriler) {
    if (!kategoriler.some((k) => k.ad === kat || k.ad.startsWith(`${kat} ·`))) {
      atlanan.push({ etiket: kat, neden: 'kategorinin rapor şablonu yayımlanmamış' });
    }
  }

  return {
    yarismaAdi: y.ad,
    yil: yilCikar(y, simdikiYil),
    slug: y.slug,
    kategoriler,
    atlanan,
  };
}

/** CDN'den belgeyi indirir. */
export async function belgeIndir(belge: KatalogBelgesi): Promise<Uint8Array> {
  const yanit = await fetch(belge.url, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    },
  });
  if (!yanit.ok) throw new Error(`${belge.dosyaAdi}: ${yanit.status}`);
  return new Uint8Array(await yanit.arrayBuffer());
}
