/**
 * Kategori uygunluğu (MVP 4).
 *
 * Yarışmacı başvurusunu yanlış kategoriye yapmış olabilir; hakem bunu
 * görmelidir. Sınıflandırma TF-IDF ile yapılır — dil modeli çağrılmaz,
 * maliyet sıfırdır.
 *
 * IDF'in işlevi kritik: "sistem", "proje", "yazılım" gibi her kategoride
 * geçen terimler otomatik olarak değersizleşir, ayırt edici terimler öne
 * çıkar. Elle ağırlık vermek gerekmez.
 *
 * Güven düşük kaldığında karar verilmez; hakeme "belirsiz" olarak sunulur.
 * İleride bu durumda Claude'a tek bir küçük sınıflandırma çağrısı
 * yapılabilir (~$0,01/rapor).
 */

import type { Belge, Bulgu, KontrolSonucu } from './tipler';
import { anahtar } from './normalize';

export interface Kategori {
  kod: string;
  ad: string;
  /** Kategoriyi ayırt eden terimler. Çok kelimeli ifade olabilir. */
  terimler: string[];
}

export interface KategoriSkoru {
  kategori: Kategori;
  /** Ham TF-IDF puanı. */
  puan: number;
  /** Tüm kategorilere göre normalize edilmiş oran (0–1). */
  oran: number;
  /** Bu kategoriden belgede geçen terimler. */
  eslesenTerimler: string[];
}

/*
 * KARARLAR ORANA DEĞİL ÜSTÜNLÜĞE BAKIYOR.
 *
 * İlk sürüm normalize edilmiş orana bakıyordu: "en iyi eşleşme %30'un
 * altındaysa belirsiz". Bu ölçeğe bağımlı ve karşılaştırma kümesi
 * büyüdüğünde bozuluyor — 4 kategoriyle çalışırken doğruydu, gerçek
 * şartnamelerden 70 profil çıkarılınca hiçbir eşleşme %30'a ulaşamaz
 * oldu (pay 70'e bölünüyor) ve HER rapor "belirsiz" damgası yedi.
 *
 * Doğru ölçüt ORAN DEĞİL ÜSTÜNLÜK: en iyi eşleşme, ikinciden belirgin
 * biçimde önde mi? Bu ölçütün kategori sayısıyla ilgisi yok; 4 kategoride
 * de 70 kategoride de aynı anlama gelir.
 */

/** En iyi eşleşme ikinciden bu kat kadar önde değilse karar verilmez. */
const USTUNLUK_KATI = 1.4;
/** Hiçbir terim eşleşmediyse karşılaştırma anlamsızdır. */
const ASGARI_ESLESEN_TERIM = 3;
/**
 * Beyan edilen kategori, en iyiden bu kat kadar geride kalırsa uyarılır.
 * Üstünlük eşiğinden yüksek: yanlış kategori suçlaması güçlü kanıt ister.
 */
const SAPMA_KATI = 2;

/** Terimi belgede kaç kez geçtiğini sayar. Çok kelimeli ifadeleri de bulur. */
function terimSikligi(belgeAnahtari: string, terim: string): number {
  const t = anahtar(terim);
  if (!t) return 0;
  let sayi = 0;
  let i = belgeAnahtari.indexOf(t);
  while (i !== -1) {
    // Kelime sınırı denetimi — "tarim" araması "tarimsal" içinde saymasın.
    const oncekiOk = i === 0 || belgeAnahtari[i - 1] === ' ';
    const sonrakiOk =
      i + t.length === belgeAnahtari.length || belgeAnahtari[i + t.length] === ' ';
    if (oncekiOk && sonrakiOk) sayi++;
    i = belgeAnahtari.indexOf(t, i + 1);
  }
  return sayi;
}

/**
 * Terimlerin ters belge frekansı. Burada "belge" = kategori tanımı;
 * birden çok kategoride geçen terim düşük ağırlık alır.
 */
function idfTablosu(kategoriler: Kategori[]): Map<string, number> {
  const gecis = new Map<string, number>();
  for (const k of kategoriler) {
    for (const t of new Set(k.terimler.map(anahtar))) {
      gecis.set(t, (gecis.get(t) ?? 0) + 1);
    }
  }
  const idf = new Map<string, number>();
  const N = kategoriler.length;
  for (const [terim, df] of gecis) idf.set(terim, Math.log((N + 1) / (df + 0.5)));
  return idf;
}

export function kategoriPuanla(belge: Belge, kategoriler: Kategori[]): KategoriSkoru[] {
  const metin = anahtar(belge.metin);
  const idf = idfTablosu(kategoriler);
  // Uzun rapor her terimden daha çok içerir; uzunluğa göre normalize edilir.
  const uzunlukKatsayisi = Math.max(1, metin.split(' ').length / 1000);

  const skorlar = kategoriler.map((kategori) => {
    let puan = 0;
    const eslesen: string[] = [];

    for (const terim of kategori.terimler) {
      const sayi = terimSikligi(metin, terim);
      if (!sayi) continue;
      eslesen.push(terim);
      // Sublineer tf: bir terimin yüzlerce kez geçmesi orantısız baskın olmasın.
      puan += (1 + Math.log(sayi)) * (idf.get(anahtar(terim)) ?? 1);
    }

    return {
      kategori,
      puan: puan / uzunlukKatsayisi,
      oran: 0,
      eslesenTerimler: eslesen.slice(0, 8),
    };
  });

  const toplam = skorlar.reduce((t, s) => t + s.puan, 0);
  for (const s of skorlar) s.oran = toplam > 0 ? s.puan / toplam : 0;

  return skorlar.sort((a, b) => b.puan - a.puan);
}

export function kategoriKontrolu(
  belge: Belge,
  kategoriler: Kategori[],
  beyanEdilenKod?: string,
): KontrolSonucu {
  if (!kategoriler.length) {
    return {
      kod: 'kategori', ad: 'Kategori', durum: 'temiz',
      ozet: 'Kategori tanımlı değil', bulgular: [],
    };
  }

  const skorlar = kategoriPuanla(belge, kategoriler);
  const enIyi = skorlar[0];
  const ikinci = skorlar[1];
  const bulgular: Bulgu[] = [];

  // İkinci yoksa karşılaştıracak bir şey de yok; üstünlük sonsuz sayılır.
  const ustunluk = ikinci?.puan ? enIyi.puan / ikinci.puan : Infinity;
  const belirsiz =
    enIyi.eslesenTerimler.length < ASGARI_ESLESEN_TERIM || ustunluk < USTUNLUK_KATI;

  if (belirsiz) {
    bulgular.push({
      kod: 'KATEGORI_BELIRSIZ',
      seviye: 'bilgi',
      baslik: 'İçerik hangi yarışmaya ait, güvenle söylenemedi',
      aciklama:
        `En yakın eşleşme "${enIyi.kategori.ad}"` +
        (ikinci ? `, ikinci "${ikinci.kategori.ad}"` : '') +
        ` — aradaki fark karar vermeye yetmiyor (${ustunluk === Infinity ? '—' : `${ustunluk.toFixed(1)}×`}). ` +
        'Rapor birden çok alana yayılıyor ya da genel bir dil kullanıyor olabilir; ' +
        'bu tek başına bir kusur değildir.',
    });
  }

  const beyan = beyanEdilenKod
    ? skorlar.find((s) => s.kategori.kod === beyanEdilenKod)
    : undefined;

  if (beyan && beyan.kategori.kod !== enIyi.kategori.kod && !belirsiz) {
    // Kat cinsinden: beyan edilen kategori sıfır puan aldıysa fark sonsuz.
    const kat = beyan.puan ? enIyi.puan / beyan.puan : Infinity;
    if (kat >= SAPMA_KATI) {
      bulgular.push({
        kod: 'KATEGORI_UYUMSUZ',
        seviye: 'uyari',
        baslik: `İçerik "${enIyi.kategori.ad}" kategorisine daha yakın`,
        aciklama:
          `Rapor "${beyan.kategori.ad}" kategorisine yüklenmiş ama içeriği ` +
          `"${enIyi.kategori.ad}" şartnamesine ${kat === Infinity ? 'çok' : `${kat.toFixed(1)}×`} ` +
          'daha yakın. Yanlış kategoriye başvuru olabilir; hakem doğrulamalı. ' +
          `Belirleyici terimler: ${enIyi.eslesenTerimler.slice(0, 5).join(', ')}.`,
      });
    }
  }

  const durum = bulgular.some((b) => b.seviye === 'uyari') ? 'uyari'
    : bulgular.length ? 'bilgi' : 'temiz';

  const gosterilen = beyan ?? enIyi;

  return {
    kod: 'kategori',
    ad: 'Kategori',
    durum,
    ozet: `${gosterilen.kategori.ad} · %${Math.round(gosterilen.oran * 100)}`,
    bulgular,
    veri: {
      beyanEdilen: beyan?.kategori.kod ?? null,
      enIyi: enIyi.kategori.kod,
      siralama: skorlar.slice(0, 4).map((s) => ({
        kod: s.kategori.kod,
        ad: s.kategori.ad,
        oran: Math.round(s.oran * 1000) / 1000,
      })),
    },
  };
}
