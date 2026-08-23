/**
 * Kaynakça analizi.
 *
 * Hakemlerin ilk baktığı yerlerden biri: kaynakça gerçekten var mı, yoksa
 * başlık atılıp geçilmiş mi. "Başlık mevcut" demek yetmiyor — üç şeyi ayrı
 * ayrı ölçüyoruz:
 *   1. Bölüm dolu mu, ayrıştırılabilir kaynak var mı?
 *   2. Kaynaklar nitelikli mi (yazar, yıl, künye) yoksa çıplak bağlantı mı?
 *   3. Metindeki atıflarla liste tutuyor mu?
 *
 * Üçüncüsü sonradan eklenmiş kaynakçayı yakalar: liste dolu ama metinde tek
 * atıf yoksa kaynakça iş görmüyordur.
 */

import type { Belge, Bolum, Bulgu, KaynakcaKurali, KontrolSonucu } from './tipler';
import { VARSAYILAN_KAYNAKCA } from './tipler';
import { anahtar, kelimeler, onar } from './normalize';

/** Bu kelime sayısının altındaki kaynakça bölümü boş sayılır. */
const BOS_ESIGI = 12;

export interface Kaynak {
  /** Numaralı listede kaynağın numarası. */
  numara: number | null;
  ham: string;
  yil: number | null;
  /** İlk yazarın soyadı — yazar-yıl atıflarını eşlemek için. */
  soyad: string | null;
  baglantiVarMi: boolean;
  doiVarMi: boolean;
  /** Yalnızca bir URL'den ibaret, künye yok. */
  ciplakBaglanti: boolean;
}

export interface Atif {
  tur: 'numarali' | 'yazar-yil';
  ham: string;
  numaralar: number[];
  soyad: string | null;
  yil: number | null;
}

export interface KaynakcaAnalizi {
  bolumVarMi: boolean;
  bolumBaslik: string | null;
  sayfa: number | null;
  kaynaklar: Kaynak[];
  atiflar: Atif[];
  /** Metinde atıf yapılmış ama listede karşılığı olmayan numaralar. */
  karsiliksizAtiflar: number[];
  /** Listede olup metinde hiç atıf almayan kaynaklar. */
  atifsizKaynaklar: number[];
  niteliksizSayisi: number;
}

/**
 * Kaynakça bölümünü, yarışmanın kabul ettiği adlara göre arar.
 *
 * İlk eşleşeni almak YANLIŞ: raporun içindekiler sayfasında da "7. Kaynaklar"
 * satırı var ve o gövdesi boş olduğu için kaynakça "boş" görünüyordu. Aynı
 * adı taşıyan bölümlerden EN DOLU olanı seçiyoruz.
 */
function bolumuBul(belge: Belge, kural: KaynakcaKurali): Bolum | null {
  const adlar = kural.adlar.map(anahtar);
  let enIyi: Bolum | null = null;

  for (const bolum of belge.bolumler) {
    const a = anahtar(bolum.baslik.sade);
    if (!adlar.some((k) => a === k || a.startsWith(k))) continue;
    if (!enIyi || bolum.kelimeSayisi > enIyi.kelimeSayisi) enIyi = bolum;
  }
  return enIyi;
}

/**
 * Kaynak künyelerini ayrıştırır. Numaralı liste ("[1]", "1.") varsa ona göre
 * böler; yoksa satır bazlı çalışır ve devam satırlarını önceki kaynağa ekler.
 */
export function kaynaklariAyristir(govde: string): Kaynak[] {
  const satirlar = govde.split('\n').map((s) => onar(s)).filter(Boolean);
  if (!satirlar.length) return [];

  const numaraDeseni = /^\[?(\d{1,3})[\].)]\s+(.+)$/;
  const numaraliMi = satirlar.filter((s) => numaraDeseni.test(s)).length >= 2;

  const hamKayitlar: Array<{ numara: number | null; metin: string }> = [];

  for (const satir of satirlar) {
    const m = numaraliMi ? satir.match(numaraDeseni) : null;
    if (m) {
      hamKayitlar.push({ numara: Number(m[1]), metin: m[2] });
      continue;
    }
    // Devam satırı: küçük harfle başlıyor ya da numaralı modda işaretsiz.
    const son = hamKayitlar[hamKayitlar.length - 1];
    const devamMi = son && (numaraliMi || /^[a-zçğıöşü(]/.test(satir));
    if (devamMi) son.metin += ' ' + satir;
    else hamKayitlar.push({ numara: null, metin: satir });
  }

  return hamKayitlar
    .filter((k) => kelimeler(k.metin).length >= 3)
    .map((k) => kunyeCozumle(k.numara, k.metin));
}

function kunyeCozumle(numara: number | null, ham: string): Kaynak {
  const yilEs = ham.match(/\b(19|20)\d{2}\b/);
  const baglanti = /(https?:\/\/|www\.)/i.test(ham);
  const doi = /\b10\.\d{4,}\/\S+/.test(ham) || /doi\s*:/i.test(ham);

  // İlk yazarın soyadı: künyenin başındaki büyük harfle başlayan sözcük.
  const soyadEs = ham.match(/^["“]?([A-ZÇĞİÖŞÜ][a-zçğıöşü]{1,})[,.\s]/);

  // Künye bilgisi olmayan, yalnızca bağlantıdan ibaret kayıt.
  const baglantisiz = ham.replace(/(https?:\/\/|www\.)\S+/gi, '').trim();
  const ciplak = baglanti && kelimeler(baglantisiz).length < 4;

  return {
    numara,
    ham,
    yil: yilEs ? Number(yilEs[0]) : null,
    soyad: soyadEs ? soyadEs[1] : null,
    baglantiVarMi: baglanti,
    doiVarMi: doi,
    ciplakBaglanti: ciplak,
  };
}

/** Gövde metnindeki atıfları bulur. Kaynakça bölümü hariç tutulmalıdır. */
export function atiflariBul(metin: string): Atif[] {
  const atiflar: Atif[] = [];

  // [1] · [1,2] · [1-3] · [1, 2-4]
  for (const m of metin.matchAll(/\[(\d{1,3}(?:\s*[-–,]\s*\d{1,3})*)\]/g)) {
    const numaralar = new Set<number>();
    for (const parca of m[1].split(',')) {
      const aralik = parca.match(/(\d{1,3})\s*[-–]\s*(\d{1,3})/);
      if (aralik) {
        const [bas, son] = [Number(aralik[1]), Number(aralik[2])];
        if (son - bas < 100) for (let i = bas; i <= son; i++) numaralar.add(i);
      } else {
        const tek = parca.match(/\d{1,3}/);
        if (tek) numaralar.add(Number(tek[0]));
      }
    }
    atiflar.push({ tur: 'numarali', ham: m[0], numaralar: [...numaralar], soyad: null, yil: null });
  }

  // (Yılmaz, 2023) · (Yılmaz ve ark., 2023) · (Yılmaz & Demir, 2021)
  for (const m of metin.matchAll(
    /\(([A-ZÇĞİÖŞÜ][a-zçğıöşü]+)(?:[^()]{0,40}?)[,;]?\s*((?:19|20)\d{2})\)/g,
  )) {
    atiflar.push({ tur: 'yazar-yil', ham: m[0], numaralar: [], soyad: m[1], yil: Number(m[2]) });
  }

  // Yılmaz (2023)
  for (const m of metin.matchAll(/\b([A-ZÇĞİÖŞÜ][a-zçğıöşü]+)\s*\(((?:19|20)\d{2})\)/g)) {
    atiflar.push({ tur: 'yazar-yil', ham: m[0], numaralar: [], soyad: m[1], yil: Number(m[2]) });
  }

  return atiflar;
}

export function kaynakcayiCozumle(
  belge: Belge,
  kural: KaynakcaKurali = VARSAYILAN_KAYNAKCA,
): KaynakcaAnalizi {
  const bolum = bolumuBul(belge, kural);

  if (!bolum) {
    return {
      bolumVarMi: false, bolumBaslik: null, sayfa: null,
      kaynaklar: [], atiflar: atiflariBul(belge.metin),
      karsiliksizAtiflar: [], atifsizKaynaklar: [], niteliksizSayisi: 0,
    };
  }

  const kaynaklar = kaynaklariAyristir(bolum.govde);

  // Atıflar yalnızca kaynakça dışındaki metinde aranır; aksi hâlde listenin
  // kendi numaraları atıf sanılır.
  const govdeDisi = belge.metin.replace(bolum.govde, ' ');
  const atiflar = atiflariBul(govdeDisi);

  const listeNumaralari = new Set(
    kaynaklar.map((k, i) => k.numara ?? i + 1),
  );
  const atifYapilan = new Set<number>();
  for (const a of atiflar) for (const n of a.numaralar) atifYapilan.add(n);

  const karsiliksiz = [...atifYapilan].filter((n) => !listeNumaralari.has(n)).sort((a, b) => a - b);

  // Yazar-yıl stilinde numara eşlemesi anlamsız; atıfsızlık yalnızca
  // numaralı stilde ve metinde numaralı atıf varken ölçülür.
  const numaraliStil = atiflar.some((a) => a.tur === 'numarali');
  const atifsiz = numaraliStil
    ? [...listeNumaralari].filter((n) => !atifYapilan.has(n)).sort((a, b) => a - b)
    : [];

  return {
    bolumVarMi: true,
    bolumBaslik: bolum.baslik.metin,
    sayfa: bolum.baslik.sayfa,
    kaynaklar,
    atiflar,
    karsiliksizAtiflar: karsiliksiz,
    atifsizKaynaklar: atifsiz,
    niteliksizSayisi: kaynaklar.filter((k) => k.ciplakBaglanti || (!k.yil && !k.doiVarMi)).length,
  };
}

/** Kaynakça kontrolünü hakeme sunulacak bulgulara çevirir. */
export function kaynakcaKontrolu(
  belge: Belge,
  kural: KaynakcaKurali = VARSAYILAN_KAYNAKCA,
): KontrolSonucu {
  const a = kaynakcayiCozumle(belge, kural);
  const bulgular: Bulgu[] = [];

  // Yarışma kaynakça istemiyorsa kontrol hiç çalıştırılmaz.
  if (!kural.zorunlu && !a.bolumVarMi) {
    return {
      kod: 'kaynakca', ad: 'Kaynakça', durum: 'temiz',
      ozet: 'Bu yarışmada beklenmiyor', bulgular: [],
    };
  }

  if (!a.bolumVarMi) {
    bulgular.push({
      kod: 'KAYNAKCA_YOK',
      seviye: 'hata',
      baslik: 'Kaynakça bölümü bulunamadı',
      aciklama:
        'Raporda "Kaynakça", "Kaynaklar" veya "References" başlıklı bir bölüm tespit edilemedi.',
    });
    return sonucKur(a, bulgular);
  }

  const bolum = belge.bolumler.find((b) => b.baslik.metin === a.bolumBaslik);
  const govdeKelime = bolum?.kelimeSayisi ?? 0;

  if (govdeKelime < BOS_ESIGI || a.kaynaklar.length === 0) {
    bulgular.push({
      kod: 'KAYNAKCA_BOS',
      seviye: 'hata',
      baslik: 'Kaynakça başlığı var, içerik yok',
      aciklama: `Bölüm mevcut ancak ayrıştırılabilir kaynak künyesi bulunamadı (${govdeKelime} kelime).`,
      sayfa: a.sayfa ?? undefined,
      kanit: bolum?.govde.slice(0, 160) || undefined,
    });
    return sonucKur(a, bulgular);
  }

  if (a.kaynaklar.length < kural.asgariKaynak) {
    bulgular.push({
      kod: 'KAYNAKCA_AZ',
      seviye: 'uyari',
      baslik: `Yalnızca ${a.kaynaklar.length} kaynak`,
      aciklama: `Bu yarışmada asgari ${kural.asgariKaynak} kaynak bekleniyor. Literatür taramasının yeterliliği hakemce değerlendirilmeli.`,
      sayfa: a.sayfa ?? undefined,
    });
  }

  if (kural.atifBekleniyor && a.atiflar.length === 0) {
    bulgular.push({
      kod: 'ATIF_YOK',
      seviye: 'uyari',
      baslik: 'Metin içinde hiç atıf yok',
      aciklama:
        `Kaynakçada ${a.kaynaklar.length} kaynak listelenmiş ancak rapor gövdesinde bunlara ` +
        'yapılmış tek bir atıf bulunamadı. Kaynakça metinle ilişkilendirilmemiş.',
      sayfa: a.sayfa ?? undefined,
    });
  }

  if (a.karsiliksizAtiflar.length) {
    bulgular.push({
      kod: 'ATIF_KARSILIKSIZ',
      seviye: 'hata',
      baslik: `${a.karsiliksizAtiflar.length} atfın listede karşılığı yok`,
      aciklama:
        `Metinde ${a.karsiliksizAtiflar.map((n) => `[${n}]`).join(', ')} atfı yapılmış ancak ` +
        `kaynakçada ${a.kaynaklar.length} kayıt var.`,
    });
  }

  if (kural.atifBekleniyor && a.atifsizKaynaklar.length > Math.max(2, a.kaynaklar.length * 0.4)) {
    bulgular.push({
      kod: 'KAYNAK_ATIFSIZ',
      seviye: 'uyari',
      baslik: `${a.atifsizKaynaklar.length} kaynağa metinde atıf yapılmamış`,
      aciklama:
        `${a.atifsizKaynaklar.map((n) => `[${n}]`).join(', ')} numaralı kaynaklar listede yer alıyor ` +
        'ancak metinde kullanılmamış.',
      sayfa: a.sayfa ?? undefined,
    });
  }

  if (a.niteliksizSayisi > a.kaynaklar.length * 0.5) {
    bulgular.push({
      kod: 'KAYNAK_NITELIKSIZ',
      seviye: 'uyari',
      baslik: `${a.niteliksizSayisi} kaynakta künye bilgisi eksik`,
      aciklama:
        'Kaynakların yarısından fazlası yıl bilgisi taşımıyor veya yalnızca bir bağlantıdan ibaret. ' +
        'Akademik künye biçimi beklenir.',
      sayfa: a.sayfa ?? undefined,
    });
  }

  return sonucKur(a, bulgular);
}

function sonucKur(a: KaynakcaAnalizi, bulgular: Bulgu[]): KontrolSonucu {
  const durum = bulgular.some((b) => b.seviye === 'hata')
    ? 'hata'
    : bulgular.some((b) => b.seviye === 'uyari')
      ? 'uyari'
      : 'temiz';

  const ozet = !a.bolumVarMi
    ? 'Bölüm yok'
    : a.kaynaklar.length === 0
      ? 'Başlık var, içerik yok'
      : `${a.kaynaklar.length} kaynak · ${a.atiflar.length} atıf`;

  return {
    kod: 'kaynakca',
    ad: 'Kaynakça',
    durum,
    ozet,
    bulgular,
    veri: {
      kaynakSayisi: a.kaynaklar.length,
      atifSayisi: a.atiflar.length,
      karsiliksizAtiflar: a.karsiliksizAtiflar,
      atifsizKaynaklar: a.atifsizKaynaklar,
      niteliksizSayisi: a.niteliksizSayisi,
      sayfa: a.sayfa,
    },
  };
}
