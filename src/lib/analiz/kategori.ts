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

/** Bu oranın altında kalan en iyi eşleşme "belirsiz" sayılır. */
const BELIRSIZLIK_ESIGI = 0.3;
/** Beyan edilen kategori, en iyi kategoriden bu kadar geride kalırsa uyarılır. */
const SAPMA_ESIGI = 0.15;

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
  const bulgular: Bulgu[] = [];

  if (enIyi.oran < BELIRSIZLIK_ESIGI) {
    bulgular.push({
      kod: 'KATEGORI_BELIRSIZ',
      seviye: 'bilgi',
      baslik: 'Kategori güvenle belirlenemedi',
      aciklama:
        `En yakın kategori "${enIyi.kategori.ad}" (%${Math.round(enIyi.oran * 100)}). ` +
        'Rapor birden çok alana yayılıyor olabilir; kategori uygunluğunu hakem değerlendirmeli.',
    });
  }

  const beyan = beyanEdilenKod
    ? skorlar.find((s) => s.kategori.kod === beyanEdilenKod)
    : undefined;

  if (beyan && beyan.kategori.kod !== enIyi.kategori.kod) {
    const fark = enIyi.oran - beyan.oran;
    if (fark >= SAPMA_ESIGI) {
      bulgular.push({
        kod: 'KATEGORI_UYUMSUZ',
        seviye: 'uyari',
        baslik: `İçerik "${enIyi.kategori.ad}" kategorisine daha yakın`,
        aciklama:
          `Başvuru "${beyan.kategori.ad}" kategorisine yapılmış (%${Math.round(beyan.oran * 100)}), ` +
          `ancak içerik "${enIyi.kategori.ad}" ile %${Math.round(enIyi.oran * 100)} örtüşüyor. ` +
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
