/**
 * Parmakizi serileştirme.
 *
 * SORUN
 * `Parmakizi` bellek içi bir yapı: `Int32Array` imza ve cümle başına
 * `Set<number>` shingle kümesi taşıyor. İkisi de JSON'a yazılmaz — `JSON`
 * bir Int32Array'i `{"0":123,...}` nesnesine, bir Set'i `{}` boşluğuna
 * çevirir. Sessizce bozar; hata vermez.
 *
 * NEDEN SAKLIYORUZ
 * Alternatif, benzerlik ekranı açıldığında bütün raporları yeniden
 * ayrıştırmaktı. Bir kategoride 100 rapor varsa bu 100 PDF açmak demek —
 * ekran dakikalarca beklenir ve her açılışta tekrar beklenir. Parmakizi
 * yükleme anında bir kez hesaplanıp saklanıyor; tarama saniyeler sürüyor.
 *
 * BOYUT
 * Ölçüm: 8 sayfalık bir rapor için ~40 KB JSON. Cümle shingle kümeleri
 * yerin çoğunu alıyor ama onlar olmadan EŞLEŞEN CÜMLE gösterilemez —
 * hakeme "%38 benzer" demek yetmez, hangi cümleler diye sorar.
 */

import type { CumleIzi, Parmakizi } from './benzerlik';

/** Diske yazılabilir parmakizi. */
export interface SakliParmakizi {
  raporId: string;
  takimId?: string;
  kategoriKodu?: string;
  yil?: number;
  /** Int32Array yerine düz sayı dizisi. */
  imza: number[];
  shingleSayisi: number;
  cumleler: Array<{ metin: string; sayfa: number; shingleler: number[] }>;
  gorseller: Array<{ sayfa: number; sira: number; hash: string }>;
  /** Biçim sürümü — motor değişirse eski kayıt yeniden hesaplanmalı. */
  surum: 1;
}

export const PARMAKIZI_SURUMU = 1 as const;

export function parmakiziSakla(p: Parmakizi): SakliParmakizi {
  return {
    raporId: p.raporId,
    takimId: p.takimId,
    kategoriKodu: p.kategoriKodu,
    yil: p.yil,
    imza: Array.from(p.imza),
    shingleSayisi: p.shingleSayisi,
    cumleler: p.cumleler.map((c) => ({
      metin: c.metin,
      sayfa: c.sayfa,
      shingleler: Array.from(c.shingleler),
    })),
    gorseller: p.gorseller,
    surum: PARMAKIZI_SURUMU,
  };
}

export function parmakiziCoz(s: SakliParmakizi): Parmakizi {
  const cumleler: CumleIzi[] = s.cumleler.map((c) => ({
    metin: c.metin,
    sayfa: c.sayfa,
    shingleler: new Set(c.shingleler),
  }));
  return {
    raporId: s.raporId,
    takimId: s.takimId,
    kategoriKodu: s.kategoriKodu,
    yil: s.yil,
    imza: Int32Array.from(s.imza),
    shingleSayisi: s.shingleSayisi,
    cumleler,
    gorseller: s.gorseller,
  };
}
