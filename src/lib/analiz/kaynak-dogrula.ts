/**
 * Kaynak doğrulama — uydurma kaynakça tespiti.
 *
 * Raporlar giderek yapay zekâ ile yazılıyor ve model kaynakça "uyduruyor":
 * künye biçimsel olarak kusursuz görünür — yazar var, yıl var, dergi var,
 * sayfa aralığı var — ama öyle bir yayın yoktur. Biçime bakan hiçbir kontrol
 * bunu yakalayamaz.
 *
 * Üç kanal, hepsi ücretsiz:
 *   1. ÇEVRİMDIŞI SEZGİ  — künyenin kendisiyle çelişkileri (gelecek tarih,
 *      atıf yapılamaz kaynak türü, kaynakçanın tamamında DOI olmaması)
 *   2. DOI ÇÖZÜMLEME     — DOI varsa Crossref'te gerçekten var mı
 *   3. BAŞLIK ARAMASI    — OpenAlex ve Crossref'te başlık + yazar + yıl
 *
 * TASARIM İLKESİ: "bulunamadı" ile "sahte" aynı şey DEĞİLDİR.
 * DergiPark'taki yerel bir Türkçe dergi, kurumsal rapor veya veri seti
 * akademik indekslerde bulunmaz. Sistem bunları ayrı sınıflandırır ve
 * hiçbir künye için "sahte" demez — kanıtı hakemin önüne koyar.
 */

import type { Kaynak } from './kaynakca';
import { anahtar, benzerlik } from './normalize';

export type Dogrulama =
  /** İndekste bulundu, künye tutuyor. */
  | 'dogrulandi'
  /** Bulundu ama künye tutmuyor (yıl, yazar veya başlık sapıyor). */
  | 'kismen'
  /** Akademik indekslerde karşılığı yok. */
  | 'bulunamadi'
  /** Zaten indekslenemeyecek bir kaynak türü (web, veri seti, kurumsal rapor). */
  | 'indekslenemez'
  /** Ağ erişimi yok veya sorgu yapılamadı. */
  | 'atlandi';

export interface KaynakDogrulamasi {
  numara: number | null;
  ham: string;
  /** Künyeden ayrıştırılan başlık. */
  baslik: string | null;
  ilkYazar: string | null;
  yil: number | null;
  sonuc: Dogrulama;
  /** 0–1; sonucun ne kadar güvenilir olduğu. */
  guven: number;
  /** Bulunan kayıt — hakem karşılaştırabilsin diye. */
  eslesme?: { indeks: string; baslik: string; yil?: number; doi?: string; yazar?: string };
  /** Şüphe gerekçeleri. */
  bayraklar: string[];
}

export interface DogrulamaOzeti {
  kayitlar: KaynakDogrulamasi[];
  dogrulanan: number;
  bulunamayan: number;
  kismen: number;
  indekslenemez: number;
  /** Kaynakçanın tamamına dair sezgisel uyarılar. */
  genelBayraklar: string[];
  agKullanildi: boolean;
}

export interface DogrulamaSecenekleri {
  /** Ağ sorgusu yapılsın mı. Kapalıysa yalnızca çevrimdışı sezgiler çalışır. */
  agKullan?: boolean;
  /** Crossref ve OpenAlex "polite pool" için iletişim adresi ister. */
  iletisim?: string;
  /** Sorgu başına zaman aşımı (ms). */
  zamanAsimi?: number;
  /** Aynı künye tekrar sorgulanmasın. */
  onbellek?: Map<string, KaynakDogrulamasi['eslesme'] | null>;
}

// ------------------------------------------------------- künye ayrıştırma

/**
 * Başlığı künyeden çıkarır. TEKNOFEST şablonları IEEE benzeri biçim
 * kullanıyor: yazarlar, «Başlık», Yayın yeri, yıl.
 */
export function baslikCikar(ham: string): string | null {
  // «Başlık» · "Başlık" · “Başlık”
  const tirnak = ham.match(/[«"“]([^»"”]{10,300})[»"”]/);
  if (tirnak) return tirnak[1].replace(/[,.;]\s*$/, '').trim();

  // Yazar listesinden sonraki en uzun virgül parçası.
  const parcalar = ham.split(/,\s*/).map((p) => p.trim()).filter(Boolean);
  const adaylar = parcalar.filter(
    (p) => p.split(/\s+/).length >= 4 && !/^\(?\d{4}\)?$/.test(p) && !/^pp?\.\s/.test(p),
  );
  if (!adaylar.length) return null;
  return adaylar.reduce((a, b) => (b.length > a.length ? b : a)).replace(/[.;]$/, '').trim();
}

/** İlk yazarın soyadı. "F. C. Akyon, S. O. Altinuc" → "Akyon" */
export function ilkYazarCikar(ham: string): string | null {
  const bas = ham.split(/[«"“]/)[0];
  // "A. B. Soyad" veya "Soyad, A."
  const kisaltmali = bas.match(/(?:[A-ZÇĞİÖŞÜ]\.\s*){1,3}([A-ZÇĞİÖŞÜ][a-zçğıöşü]{2,})/);
  if (kisaltmali) return kisaltmali[1];
  const soyadOnce = bas.match(/^([A-ZÇĞİÖŞÜ][a-zçğıöşü]{2,}),\s*[A-ZÇĞİÖŞÜ]\./);
  if (soyadOnce) return soyadOnce[1];
  // Kurumsal yazar: "OpenCV Team", "TEKNOFEST", "Empa Electronics"
  const kurum = bas.match(/^([A-ZÇĞİÖŞÜ][\wÇĞİÖŞÜçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜ][\wÇĞİÖŞÜçğıöşü]+)?)/);
  return kurum ? kurum[1] : null;
}

/** DOI'yi künyeden söker. */
export function doiCikar(ham: string): string | null {
  const m = ham.match(/\b(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)/i);
  return m ? m[1].replace(/[.,;]$/, '') : null;
}

// ------------------------------------------------- çevrimdışı sezgiler

/** Akademik indekste bulunması beklenmeyen kaynak türleri. */
const INDEKSLENEMEZ = [
  /wikipedia/i, /github\.com/i, /kaggle/i, /medium\.com/i, /stackoverflow/i,
  /\bblog\b/i, /documentation|dokümantasyon|docs\b/i, /tutorial/i,
  /roboflow/i, /ultralytics/i, /pytorch\.org|tensorflow\.org|opencv\.org/i,
  /teknofest/i, /\bveri seti\b|\bdataset\b/i, /şartname|kılavuz/i,
  /\bTÜİK\b|\bTUIK\b|bakanlığı|genel müdürlüğü/i,
];

function indekslenemezMi(ham: string): boolean {
  return INDEKSLENEMEZ.some((d) => d.test(ham));
}

/**
 * Akademik ama uluslararası indekslerde bulunmayabilecek yayın yerleri.
 * DergiPark'taki Türkçe dergiler, üniversite teknik raporları, ulusal
 * sempozyum bildirileri Crossref/OpenAlex'te çoğu zaman yoktur.
 * Bunlarda "bulunamadı" sonucu zayıf kanıttır — hakem uyarılmalı.
 */
const YEREL_YAYIN = [
  /dergipark/i, /tr\s*dizin/i, /ulakbim/i,
  /üniversitesi|university|institute of technology|enstitüsü/i,
  /sempozyum|kurultay|kongresi/i,
  /teknik rapor|technical report|tech\.?\s*rep/i,
];

function yerelYayinMi(ham: string): boolean {
  return YEREL_YAYIN.some((d) => d.test(ham));
}

function cevrimdisiBayraklar(k: Kaynak, ham: string, yil: number | null): string[] {
  const bayraklar: string[] = [];
  const buYil = new Date().getFullYear();

  if (yil && yil > buYil) {
    bayraklar.push(`Gelecek tarihli: ${yil}`);
  }
  if (/wikipedia/i.test(ham) && yil && yil >= buYil) {
    bayraklar.push('Wikipedia atfına yayın yılı verilmiş — Wikipedia sürekli değişir, tarihli yayın değildir');
  }
  if (/wikipedia/i.test(ham) && !/erişim|accessed/i.test(ham)) {
    bayraklar.push('Web kaynağında erişim tarihi belirtilmemiş');
  }
  if (k.ciplakBaglanti) {
    bayraklar.push('Yalnızca bağlantıdan ibaret, künye bilgisi yok');
  }
  if (!yil && !k.doiVarMi && !k.baglantiVarMi) {
    bayraklar.push('Yıl, DOI ve bağlantı yok — doğrulanabilir hiçbir tanımlayıcı taşımıyor');
  }
  return bayraklar;
}

/** Kaynakçanın bütününe dair desenler. */
function genelBayraklar(kaynaklar: Kaynak[], kayitlar: KaynakDogrulamasi[]): string[] {
  const bayraklar: string[] = [];
  if (kaynaklar.length < 3) return bayraklar;

  const doiliSayisi = kaynaklar.filter((k) => k.doiVarMi).length;
  const akademikSayisi = kayitlar.filter((k) => k.sonuc !== 'indekslenemez').length;
  if (doiliSayisi === 0 && akademikSayisi >= 4) {
    bayraklar.push(
      `${akademikSayisi} akademik kaynağın hiçbirinde DOI yok. Kaynaklar ikinci elden ` +
        'aktarılmış veya doğrudan görülmemiş olabilir.',
    );
  }

  const yillar = kaynaklar.map((k) => k.yil).filter((y): y is number => !!y);
  if (yillar.length >= 5) {
    const buYil = new Date().getFullYear();
    const sonUcYil = yillar.filter((y) => y >= buYil - 3).length;
    if (sonUcYil === yillar.length) {
      bayraklar.push(
        'Tüm kaynaklar son üç yıla ait. Alanın temel çalışmalarına atıf yapılmamış.',
      );
    }
  }

  // Yalnızca güçlü kanıtlar sayılır; yerel yayın kaynaklı "bulunamadı" değil.
  const bulunamayan = kayitlar.filter((k) => k.sonuc === 'bulunamadi' && k.guven >= 0.5).length;
  if (bulunamayan >= 2 && bulunamayan / Math.max(akademikSayisi, 1) >= 0.4) {
    bayraklar.push(
      `Akademik kaynakların %${Math.round((bulunamayan / akademikSayisi) * 100)}'i ` +
        'indekslerde bulunamadı. Kaynakça yapay zekâ tarafından üretilmiş olabilir.',
    );
  }

  return bayraklar;
}

// ------------------------------------------------------------ ağ sorguları

interface IndeksKaydi {
  indeks: string;
  baslik: string;
  yil?: number;
  doi?: string;
  yazar?: string;
}

async function getir(url: string, iletisim: string, zamanAsimi: number): Promise<unknown | null> {
  const kontrol = new AbortController();
  const zamanlayici = setTimeout(() => kontrol.abort(), zamanAsimi);
  try {
    const yanit = await fetch(url, {
      signal: kontrol.signal,
      headers: {
        // Crossref ve OpenAlex "polite pool" için iletişim bilgisi ister;
        // karşılığında daha yüksek hız sınırı verirler.
        'User-Agent': `4.Goz-DegerlendirmeSistemi/0.1 (mailto:${iletisim})`,
        Accept: 'application/json',
      },
    });
    if (!yanit.ok) return null;
    return await yanit.json();
  } catch {
    return null;
  } finally {
    clearTimeout(zamanlayici);
  }
}

async function crossrefDoi(doi: string, iletisim: string, ms: number): Promise<IndeksKaydi | null> {
  const veri = (await getir(
    `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
    iletisim, ms,
  )) as { message?: Record<string, unknown> } | null;
  const m = veri?.message;
  if (!m) return null;
  return {
    indeks: 'crossref/doi',
    baslik: (m.title as string[] | undefined)?.[0] ?? '',
    yil: ((m['published-print'] ?? m['published-online']) as { 'date-parts'?: number[][] } | undefined)
      ?.['date-parts']?.[0]?.[0],
    doi: m.DOI as string | undefined,
    yazar: (m.author as Array<{ family?: string }> | undefined)?.[0]?.family,
  };
}

async function openalexBaslik(baslik: string, iletisim: string, ms: number): Promise<IndeksKaydi | null> {
  const veri = (await getir(
    `https://api.openalex.org/works?search=${encodeURIComponent(baslik)}&per-page=3&mailto=${encodeURIComponent(iletisim)}`,
    iletisim, ms,
  )) as { results?: Array<Record<string, unknown>> } | null;

  const sonuclar = veri?.results ?? [];
  if (!sonuclar.length) return null;

  // En iyi başlık benzerliğine sahip kaydı seç.
  let enIyi: IndeksKaydi | null = null;
  let enIyiOran = 0;
  for (const r of sonuclar) {
    const bulunanBaslik = (r.display_name as string) ?? '';
    const oran = benzerlik(baslik, bulunanBaslik);
    if (oran > enIyiOran) {
      enIyiOran = oran;
      enIyi = {
        indeks: 'openalex',
        baslik: bulunanBaslik,
        yil: r.publication_year as number | undefined,
        doi: ((r.doi as string) ?? '').replace('https://doi.org/', '') || undefined,
        yazar: (
          r.authorships as Array<{ author?: { display_name?: string } }> | undefined
        )?.[0]?.author?.display_name?.split(' ').pop(),
      };
    }
  }
  return enIyiOran >= 0.55 ? enIyi : null;
}

async function crossrefBaslik(baslik: string, iletisim: string, ms: number): Promise<IndeksKaydi | null> {
  const veri = (await getir(
    `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(baslik)}&rows=3&select=title,author,DOI,issued`,
    iletisim, ms,
  )) as { message?: { items?: Array<Record<string, unknown>> } } | null;

  const ogeler = veri?.message?.items ?? [];
  let enIyi: IndeksKaydi | null = null;
  let enIyiOran = 0;
  for (const r of ogeler) {
    const bulunanBaslik = (r.title as string[] | undefined)?.[0] ?? '';
    const oran = benzerlik(baslik, bulunanBaslik);
    if (oran > enIyiOran) {
      enIyiOran = oran;
      enIyi = {
        indeks: 'crossref',
        baslik: bulunanBaslik,
        yil: (r.issued as { 'date-parts'?: number[][] } | undefined)?.['date-parts']?.[0]?.[0],
        doi: r.DOI as string | undefined,
        yazar: (r.author as Array<{ family?: string }> | undefined)?.[0]?.family,
      };
    }
  }
  return enIyiOran >= 0.55 ? enIyi : null;
}

// ------------------------------------------------------------- ana akış

export async function kaynaklariDogrula(
  kaynaklar: Kaynak[],
  secenekler: DogrulamaSecenekleri = {},
): Promise<DogrulamaOzeti> {
  const agKullan = secenekler.agKullan ?? false;
  const iletisim = secenekler.iletisim ?? 'destek@example.org';
  const ms = secenekler.zamanAsimi ?? 8000;
  const onbellek = secenekler.onbellek ?? new Map();

  const kayitlar: KaynakDogrulamasi[] = [];

  for (const k of kaynaklar) {
    const baslik = baslikCikar(k.ham);
    const ilkYazar = ilkYazarCikar(k.ham);
    const doi = doiCikar(k.ham);
    const bayraklar = cevrimdisiBayraklar(k, k.ham, k.yil);

    const kayit: KaynakDogrulamasi = {
      numara: k.numara,
      ham: k.ham,
      baslik,
      ilkYazar,
      yil: k.yil,
      sonuc: 'atlandi',
      guven: 0,
      bayraklar,
    };

    if (indekslenemezMi(k.ham)) {
      kayit.sonuc = 'indekslenemez';
      kayit.guven = 0.9;
      kayitlar.push(kayit);
      continue;
    }

    if (!agKullan) {
      kayit.sonuc = 'atlandi';
      kayitlar.push(kayit);
      continue;
    }

    const anah = anahtar(doi ?? baslik ?? k.ham).slice(0, 120);
    let eslesme: IndeksKaydi | null | undefined = onbellek.get(anah) as IndeksKaydi | null | undefined;

    if (eslesme === undefined) {
      eslesme = doi ? await crossrefDoi(doi, iletisim, ms) : null;
      if (!eslesme && baslik) eslesme = await openalexBaslik(baslik, iletisim, ms);
      if (!eslesme && baslik) eslesme = await crossrefBaslik(baslik, iletisim, ms);
      onbellek.set(anah, eslesme);
    }

    if (!eslesme) {
      kayit.sonuc = 'bulunamadi';
      if (yerelYayinMi(k.ham)) {
        // Yerel yayın: bulunamaması olağan. Bulguyu zayıf kanıt olarak sun.
        kayit.guven = 0.25;
        kayit.bayraklar.push(
          'Yayın yeri ulusal/kurumsal görünüyor; uluslararası indekslerde ' +
            'bulunmaması olağandır. Sahtelik göstergesi değildir.',
        );
      } else {
        kayit.guven = baslik ? 0.7 : 0.3;
      }
      if (!baslik) kayit.bayraklar.push('Künyeden başlık ayrıştırılamadı; arama sınırlı kaldı');
      kayitlar.push(kayit);
      continue;
    }

    kayit.eslesme = eslesme;
    const baslikOrani = baslik ? benzerlik(baslik, eslesme.baslik) : 0;
    const yilFarki = k.yil && eslesme.yil ? Math.abs(k.yil - eslesme.yil) : 0;
    const yazarTutuyor =
      !ilkYazar || !eslesme.yazar || benzerlik(ilkYazar, eslesme.yazar) >= 0.7;

    if (baslikOrani >= 0.8 && yilFarki <= 1 && yazarTutuyor) {
      kayit.sonuc = 'dogrulandi';
      kayit.guven = Math.min(1, baslikOrani);
    } else {
      kayit.sonuc = 'kismen';
      kayit.guven = baslikOrani;
      if (yilFarki > 1) {
        kayit.bayraklar.push(`Yıl tutmuyor: künyede ${k.yil}, kayıtta ${eslesme.yil}`);
      }
      if (!yazarTutuyor) {
        kayit.bayraklar.push(
          `Yazar tutmuyor: künyede "${ilkYazar}", kayıtta "${eslesme.yazar}"`,
        );
      }
      if (baslikOrani < 0.8) {
        kayit.bayraklar.push(`Başlık kısmen eşleşiyor (%${Math.round(baslikOrani * 100)})`);
      }
    }

    kayitlar.push(kayit);
  }

  return {
    kayitlar,
    dogrulanan: kayitlar.filter((k) => k.sonuc === 'dogrulandi').length,
    bulunamayan: kayitlar.filter((k) => k.sonuc === 'bulunamadi').length,
    kismen: kayitlar.filter((k) => k.sonuc === 'kismen').length,
    indekslenemez: kayitlar.filter((k) => k.sonuc === 'indekslenemez').length,
    genelBayraklar: genelBayraklar(kaynaklar, kayitlar),
    agKullanildi: agKullan,
  };
}
