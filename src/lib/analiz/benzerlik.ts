/**
 * Başvurular arası benzerlik analizi (MVP 5).
 *
 * İki bağımsız kanal:
 *   1. METİN — cümle bazlı shingle + MinHash. Kopyalanmış paragrafı bulur.
 *   2. GÖRSEL — pHash. Metni farklı yazıp aynı şekli kullananı bulur;
 *      metin kanalının asla yakalayamayacağı en yaygın kopya biçimi budur.
 *
 * Modülün değerini belirleyen şey, neyi benzerlik SAYMADIĞIDIR:
 *   · Şablon yönerge metni  → tüm raporlarda aynı
 *   · Zorunlu başlıklar     → tüm raporlarda aynı
 *   · Sayfa başlığı/altlığı → yapi.ts'te zaten elendi
 *   · Kaynakça              → aynı makaleye atıf yapmak kopya değildir
 *   · Kategori taban düzeyi → aynı alandaki raporlar doğal olarak benzer
 *
 * Bunlar çıkarılmazsa her rapor çifti yüksek benzerlik verir ve modül
 * tamamen değersizleşir. bkz. docs/gercek-dunya-sorunlari.md · D1–D5
 *
 * Model yok, embedding yok — saf kod, $0.
 */

import type { Belge, Bulgu, KontrolSonucu, Sablon } from './tipler';
import { anahtar, benzerlik as metinBenzerligi } from './normalize';
import { anlamliMi, gorselBenzerlik, hammingMesafe } from './phash';

/** Shingle uzunluğu (kelime). 4, Türkçe için kopya/rastlantı dengesi iyi. */
const SHINGLE = 4;
/** MinHash imza uzunluğu. 128 permütasyon ≈ ±%4 Jaccard hatası. */
const IMZA = 128;
/** Bu kelime sayısının altındaki cümleler karşılaştırmaya girmez. */
const ASGARI_CUMLE = 8;
/** İki cümle bu Jaccard üstündeyse "eşleşen paragraf" sayılır. */
const CUMLE_ESIGI = 0.55;
/** Görsel eşleşmesi için azami Hamming mesafesi (64 bit üzerinden). */
const GORSEL_MESAFE = 6;
/** Kategori tabanı hesaplanamadığında kullanılan mutlak kapsama eşiği. */
const MUTLAK_ESIK = 0.22;
/** Bu kadar cümle birebir örtüşüyorsa, oran düşük olsa da işaretlenir. */
const CUMLE_SAYISI_ESIGI = 3;

// ------------------------------------------------------------------ karma

/** FNV-1a 32 bit — hızlı, bağımlılıksız, shingle karması için yeterli. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** MinHash permütasyon katsayıları — sabit tohum, sonuçlar tekrarlanabilir. */
const PERM = (() => {
  const a = new Uint32Array(IMZA);
  const b = new Uint32Array(IMZA);
  let s = 0x9e3779b9;
  for (let i = 0; i < IMZA; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    a[i] = s | 1; // tek sayı olmalı
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    b[i] = s;
  }
  return { a, b };
})();

function imzaHesapla(shingleler: Set<number>): Int32Array {
  const imza = new Int32Array(IMZA).fill(0x7fffffff);
  for (const h of shingleler) {
    for (let i = 0; i < IMZA; i++) {
      const v = (Math.imul(h, PERM.a[i]) + PERM.b[i]) >>> 1;
      if (v < imza[i]) imza[i] = v;
    }
  }
  return imza;
}

/** İmzalardan Jaccard tahmini. */
function imzaJaccard(a: Int32Array, b: Int32Array): number {
  let esit = 0;
  for (let i = 0; i < IMZA; i++) if (a[i] === b[i]) esit++;
  return esit / IMZA;
}

/**
 * Kapsama oranı: kesişim / küçük belgenin boyutu.
 *
 * Jaccard, kısmi kopyayı seyreltir. Bir rapor diğerinin yalnızca iki
 * bölümünü kopyaladıysa — sahada en sık görülen durum — Jaccard düşük
 * kalır ve kopya kaçar. Kapsama "küçük belgenin ne kadarı öbüründe var"
 * sorusunu sorar; kısmi intihali doğru ölçen metrik budur.
 *
 * J = |A∩B| / |A∪B| olduğundan |A∩B| = J·(|A|+|B|) / (1+J).
 */
function kapsamaOrani(jaccard: number, boyA: number, boyB: number): number {
  const kucuk = Math.min(boyA, boyB);
  if (!kucuk) return 0;
  const kesisim = (jaccard * (boyA + boyB)) / (1 + jaccard);
  return Math.min(1, kesisim / kucuk);
}

function kumeJaccard(a: Set<number>, b: Set<number>): number {
  if (!a.size || !b.size) return 0;
  const [kucuk, buyuk] = a.size <= b.size ? [a, b] : [b, a];
  let kesisim = 0;
  for (const x of kucuk) if (buyuk.has(x)) kesisim++;
  return kesisim / (a.size + b.size - kesisim);
}

// ------------------------------------------------------------ metin hazırlığı

/** Türkçe cümle bölme. Ondalık sayı ve "Şekil 3.1" gibi kalıpları bölmez. */
export function cumlelereBol(metin: string): string[] {
  return metin
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-ZÇĞİÖŞÜ])/)
    .map((c) => c.trim())
    .filter((c) => c.length > 20);
}

function shinglele(cumle: string): Set<number> {
  const k = anahtar(cumle).split(' ').filter(Boolean);
  const set = new Set<number>();
  for (let i = 0; i + SHINGLE <= k.length; i++) {
    set.add(fnv1a(k.slice(i, i + SHINGLE).join(' ')));
  }
  return set;
}

/**
 * Karşılaştırmaya girecek özgün metni ayıklar: şablon yönergesi, başlıklar
 * ve kaynakça çıkarılır. Bu adım atlanırsa modül işe yaramaz.
 */
export function ozgunMetin(belge: Belge, sablon?: Sablon): string {
  const kaynakcaAdlari = (sablon?.kaynakca?.adlar ?? ['Kaynakça', 'Kaynaklar', 'References'])
    .map(anahtar);

  const yonergeler: string[] = [];
  for (const b of sablon?.basliklar ?? []) yonergeler.push(...(b.yonergeMetni ?? []));

  const parcalar: string[] = [];
  for (const bolum of belge.bolumler) {
    const ad = anahtar(bolum.baslik.sade);
    if (kaynakcaAdlari.some((k) => ad === k || ad.startsWith(k))) continue;

    for (const satir of bolum.govde.split('\n')) {
      const s = satir.trim();
      if (s.length < 12) continue;
      // Şablonun kendi cümlesi — her raporda aynı, kopya değil.
      if (yonergeler.some((y) => metinBenzerligi(s, y) >= 0.8)) continue;
      parcalar.push(s);
    }
  }
  return parcalar.join('\n');
}

// -------------------------------------------------------------- parmak izi

export interface CumleIzi {
  metin: string;
  sayfa: number;
  shingleler: Set<number>;
}

export interface Parmakizi {
  raporId: string;
  takimId?: string;
  kategoriKodu?: string;
  yil?: number;
  imza: Int32Array;
  shingleSayisi: number;
  cumleler: CumleIzi[];
  gorseller: Array<{ sayfa: number; sira: number; hash: string }>;
}

export interface ParmakiziMeta {
  raporId: string;
  takimId?: string;
  kategoriKodu?: string;
  yil?: number;
}

export function parmakiziCikar(
  belge: Belge,
  meta: ParmakiziMeta,
  sablon?: Sablon,
): Parmakizi {
  const metin = ozgunMetin(belge, sablon);

  // Cümlenin hangi sayfada olduğunu satır eşlemesinden çıkarıyoruz.
  const sayfaHaritasi = new Map<string, number>();
  for (const satir of belge.satirlar) {
    if (!satir.yinelenen) sayfaHaritasi.set(anahtar(satir.metin).slice(0, 40), satir.sayfa);
  }

  const cumleler: CumleIzi[] = [];
  const tumShingleler = new Set<number>();

  for (const cumle of cumlelereBol(metin)) {
    const sh = shinglele(cumle);
    for (const h of sh) tumShingleler.add(h);
    if (anahtar(cumle).split(' ').length < ASGARI_CUMLE) continue;
    cumleler.push({
      metin: cumle,
      sayfa: sayfaHaritasi.get(anahtar(cumle).slice(0, 40)) ?? 0,
      shingleler: sh,
    });
  }

  return {
    raporId: meta.raporId,
    takimId: meta.takimId,
    kategoriKodu: meta.kategoriKodu,
    yil: meta.yil,
    imza: imzaHesapla(tumShingleler),
    shingleSayisi: tumShingleler.size,
    cumleler,
    gorseller: belge.gorseller
      .filter((g): g is typeof g & { hash: string } => !!g.hash && anlamliMi(g.hash))
      .map((g) => ({ sayfa: g.sayfa, sira: g.sira, hash: g.hash })),
  };
}

// ------------------------------------------------------------ karşılaştırma

export interface CumleEslesmesi {
  a: { metin: string; sayfa: number };
  b: { metin: string; sayfa: number };
  oran: number;
}

export interface GorselEslesmesi {
  a: { sayfa: number; sira: number };
  b: { sayfa: number; sira: number };
  oran: number;
  hammingMesafesi: number;
}

export interface CiftSonucu {
  aId: string;
  bId: string;
  /** MinHash ile tahmin edilen Jaccard örtüşmesi. */
  metinOrani: number;
  /** Küçük belgenin ne kadarı diğerinde bulunuyor — kısmi kopyanın ölçüsü. */
  kapsama: number;
  /** En güçlü görsel eşleşmesi; yoksa 0. */
  gorselOrani: number;
  cumleEslesmeleri: CumleEslesmesi[];
  gorselEslesmeleri: GorselEslesmesi[];
  /** Aynı takımın önceki başvurusu — kopya değil, devam projesi. */
  ayniTakim: boolean;
}

export function ciftKarsilastir(a: Parmakizi, b: Parmakizi, detay = true): CiftSonucu {
  const metinOrani = imzaJaccard(a.imza, b.imza);
  const kapsama = kapsamaOrani(metinOrani, a.shingleSayisi, b.shingleSayisi);

  const gorselEslesmeleri: GorselEslesmesi[] = [];
  for (const ga of a.gorseller) {
    for (const gb of b.gorseller) {
      const mesafe = hammingMesafe(ga.hash, gb.hash);
      if (mesafe <= GORSEL_MESAFE) {
        gorselEslesmeleri.push({
          a: { sayfa: ga.sayfa, sira: ga.sira },
          b: { sayfa: gb.sayfa, sira: gb.sira },
          oran: gorselBenzerlik(ga.hash, gb.hash),
          hammingMesafesi: mesafe,
        });
      }
    }
  }
  gorselEslesmeleri.sort((x, y) => y.oran - x.oran);

  const cumleEslesmeleri: CumleEslesmesi[] = [];
  // Cümle düzeyi karşılaştırma pahalı; yalnızca çift zaten işaretlendiğinde.
  if (detay) {
    for (const ca of a.cumleler) {
      for (const cb of b.cumleler) {
        const oran = kumeJaccard(ca.shingleler, cb.shingleler);
        if (oran >= CUMLE_ESIGI) {
          cumleEslesmeleri.push({
            a: { metin: ca.metin, sayfa: ca.sayfa },
            b: { metin: cb.metin, sayfa: cb.sayfa },
            oran,
          });
        }
      }
    }
    cumleEslesmeleri.sort((x, y) => y.oran - x.oran);
  }

  return {
    aId: a.raporId,
    bId: b.raporId,
    metinOrani,
    kapsama,
    gorselOrani: gorselEslesmeleri[0]?.oran ?? 0,
    cumleEslesmeleri: cumleEslesmeleri.slice(0, 20),
    gorselEslesmeleri: gorselEslesmeleri.slice(0, 10),
    ayniTakim: !!a.takimId && a.takimId === b.takimId,
  };
}

// ------------------------------------------------------------ korpus taraması

export interface KorpusSonucu {
  /** İşaretlenmiş çiftler, güçlüden zayıfa. */
  isaretliler: CiftSonucu[];
  /** Kategori bazında hesaplanan doğal benzerlik tabanı. */
  tabanlar: Record<string, { taban: number; esik: number; ciftSayisi: number }>;
  toplamCift: number;
}

/** Ortanca — aykırı değerlerden etkilenmez. */
function ortanca(v: number[]): number {
  if (!v.length) return 0;
  const s = [...v].sort((a, b) => a - b);
  const o = Math.floor(s.length / 2);
  return s.length % 2 ? s[o] : (s[o - 1] + s[o]) / 2;
}

/**
 * Korpusu tarar ve doğal benzerlik tabanının belirgin üstündeki çiftleri
 * işaretler.
 *
 * Sabit bir eşik kullanmıyoruz: aynı kategorideki raporlar zaten ortak
 * terminoloji taşır. Her kategorinin kendi tabanı hesaplanır, eşik
 * taban + 3×MAD olarak belirlenir. Böylece "tarım kategorisindeki tüm
 * raporlar birbirine benziyor" gürültüsü elenir.
 */
export function korpusTara(parmakizleri: Parmakizi[]): KorpusSonucu {
  const n = parmakizleri.length;
  const kaba: Array<{ i: number; j: number; oran: number; gorsel: number }> = [];

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = parmakizleri[i];
      const b = parmakizleri[j];
      const jaccard = imzaJaccard(a.imza, b.imza);
      const oran = kapsamaOrani(jaccard, a.shingleSayisi, b.shingleSayisi);

      let gorsel = 0;
      for (const ga of a.gorseller) {
        for (const gb of b.gorseller) {
          const m = hammingMesafe(ga.hash, gb.hash);
          if (m <= GORSEL_MESAFE) gorsel = Math.max(gorsel, gorselBenzerlik(ga.hash, gb.hash));
        }
      }
      kaba.push({ i, j, oran, gorsel });
    }
  }

  // Kategori bazlı taban ve eşik.
  const kategoriOranlari = new Map<string, number[]>();
  for (const c of kaba) {
    const ka = parmakizleri[c.i].kategoriKodu ?? '_';
    const kb = parmakizleri[c.j].kategoriKodu ?? '_';
    if (ka !== kb) continue;
    if (!kategoriOranlari.has(ka)) kategoriOranlari.set(ka, []);
    kategoriOranlari.get(ka)!.push(c.oran);
  }

  const tabanlar: KorpusSonucu['tabanlar'] = {};
  for (const [kod, oranlar] of kategoriOranlari) {
    const taban = ortanca(oranlar);
    const mad = ortanca(oranlar.map((o) => Math.abs(o - taban)));
    tabanlar[kod] = {
      taban: Math.round(taban * 1000) / 1000,
      // MAD sıfıra çok yakınsa eşik anlamsız derecede düşer; taban koyuyoruz.
      esik: Math.max(MUTLAK_ESIK, taban + Math.max(3 * mad, 0.08)),
      ciftSayisi: oranlar.length,
    };
  }

  const isaretliler: CiftSonucu[] = [];
  for (const c of kaba) {
    const ka = parmakizleri[c.i].kategoriKodu ?? '_';
    const kb = parmakizleri[c.j].kategoriKodu ?? '_';
    const esik = ka === kb ? (tabanlar[ka]?.esik ?? MUTLAK_ESIK) : MUTLAK_ESIK;

    // Görsel eşleşmesi tek başına yeterlidir — metin tamamen farklı olabilir.
    // Kapsama eşiğin altında kalsa bile cümle düzeyinde bakılır: eşiğin hemen
    // altındaki çiftlerde birkaç birebir paragraf gizli olabilir.
    if (c.oran < esik * 0.6 && c.gorsel === 0) continue;

    const sonuc = ciftKarsilastir(parmakizleri[c.i], parmakizleri[c.j]);
    const yeterli =
      c.gorsel > 0 ||
      sonuc.kapsama >= esik ||
      sonuc.cumleEslesmeleri.length >= CUMLE_SAYISI_ESIGI;
    if (yeterli) isaretliler.push(sonuc);
  }

  isaretliler.sort(
    (a, b) => Math.max(b.gorselOrani, b.kapsama) - Math.max(a.gorselOrani, a.kapsama),
  );

  return { isaretliler, tabanlar, toplamCift: kaba.length };
}

// ------------------------------------------------------------ hakem çıktısı

/** Bir raporun benzerlik bulgularını kontrol sonucuna çevirir. */
/**
 * Bulgu başlıklarında raporu nasıl adlandıracağımızı çözer.
 *
 * Varsayılan ham kimliktir ("a3f1c9d2-…") ve hakem için okunmaz. Çağıran
 * taraf maskeli takım rumuzunu ("Takım A3F1") verebilir; kimlik ile rumuz
 * arasındaki eşlemeyi bu modül bilmemeli — depo katmanının işi.
 */
export type AdCozucu = (raporId: string) => string;

export function benzerlikKontrolu(
  raporId: string,
  korpus: KorpusSonucu,
  adCoz: AdCozucu = (id) => id,
): KontrolSonucu {
  const ilgili = korpus.isaretliler.filter((c) => c.aId === raporId || c.bId === raporId);
  const bulgular: Bulgu[] = [];

  for (const c of ilgili) {
    const digeri = adCoz(c.aId === raporId ? c.bId : c.aId);

    if (c.ayniTakim) {
      bulgular.push({
        kod: 'BENZERLIK_DEVAM_PROJESI',
        seviye: 'bilgi',
        baslik: `${digeri} ile aynı takıma ait`,
        aciklama:
          `Metin örtüşmesi %${Math.round(c.kapsama * 100)}. Aynı takımın önceki başvurusu — ` +
          'devam projesi olabilir, intihal olarak değerlendirilmemelidir.',
      });
      continue;
    }

    if (c.gorselEslesmeleri.length) {
      const g = c.gorselEslesmeleri[0];
      bulgular.push({
        kod: 'BENZERLIK_GORSEL',
        seviye: 'hata',
        baslik: `${digeri} ile ${c.gorselEslesmeleri.length} görsel eşleşiyor`,
        aciklama:
          `En güçlü eşleşme %${Math.round(g.oran * 100)} (s.${g.a.sayfa}, ${g.a.sira}. görsel ↔ ` +
          `s.${g.b.sayfa}, ${g.b.sira}. görsel). Metin örtüşmesi yalnızca ` +
          `%${Math.round(c.kapsama * 100)} — şekil kopyalanmış, metin yeniden yazılmış olabilir.`,
        sayfa: g.a.sayfa,
      });
    }

    if (c.cumleEslesmeleri.length >= 3) {
      const e = c.cumleEslesmeleri[0];
      bulgular.push({
        kod: 'BENZERLIK_METIN',
        seviye: c.kapsama >= 0.35 ? 'hata' : 'uyari',
        baslik: `${digeri} ile ${c.cumleEslesmeleri.length} cümle örtüşüyor`,
        aciklama:
          `Bu raporun %${Math.round(c.kapsama * 100)}'i diğerinde de bulunuyor ` +
          `(Jaccard %${Math.round(c.metinOrani * 100)}). Şablon metni, başlıklar ve ` +
          'kaynakça karşılaştırma dışı tutuldu.',
        sayfa: e.a.sayfa || undefined,
        kanit: e.a.metin.slice(0, 160),
      });
    }
  }

  const durum = bulgular.some((b) => b.seviye === 'hata') ? 'hata'
    : bulgular.some((b) => b.seviye === 'uyari') ? 'uyari'
      : bulgular.length ? 'bilgi' : 'temiz';

  const gercekEslesme = ilgili.filter((c) => !c.ayniTakim).length;

  return {
    kod: 'benzerlik',
    ad: 'Benzerlik',
    durum,
    ozet: gercekEslesme ? `${gercekEslesme} eşleşme` : 'Temiz',
    bulgular,
    veri: { eslesmeSayisi: gercekEslesme, karsilastirilanCift: korpus.toplamCift },
  };
}
