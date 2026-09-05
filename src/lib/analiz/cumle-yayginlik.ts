import { anahtar } from './normalize';
import type { Parmakizi } from './benzerlik';

/**
 * Bir cümle korpusta kaç raporda geçiyor?
 *
 * ── NİYE GEREKLİ ────────────────────────────────────────────────────────
 * Benzerlik taraması iki rapor arasında ortak cümleler buluyor ve bir oran
 * veriyor. Ama o oran tek başına iki bambaşka durumu ayıramıyor:
 *
 *   · İki rapor aynı cümleleri paylaşıyor ve o cümleler BAŞKA HİÇBİR
 *     raporda yok  →  gerçek kopya
 *   · İki rapor aynı cümleleri paylaşıyor ama o cümleler on iki raporda
 *     daha var  →  şablon kalıbı; ikisi de aynı şartnameden kopyalamış,
 *     birbirinden değil
 *
 * İkincisi benzerlik taramasının klasik yanlış-pozitifi. Şablon metni
 * parmak izi çıkarılırken ayıklanıyor (`ozgunMetin`), ama yalnızca şablon
 * ÇÖZÜMLENEBİLDİYSE — PDF şablonlar çözümlenemiyor ve o zaman kalıp
 * metin izlere sızıyor.
 *
 * Yaygınlık bunu şablona hiç bakmadan çözüyor: kalıbı kalıp yapan şey
 * zaten çok yerde geçmesidir.
 *
 * ── NİYE AYRI DOSYA VE DETERMİNİSTİK ────────────────────────────────────
 * Bu bir ajan aleti ama kendisi model kullanmıyor. Sayılabilir bir şeyi
 * modele saydırmak hem pahalı hem güvenilmez olurdu; ajanın işi sayıyı
 * ÜRETMEK değil, sayıya bakıp karar vermek.
 */

export interface Yayginlik {
  cumle: string;
  /** Cümlenin geçtiği rapor sayısı (sorgulanan çift dâhil). */
  raporSayisi: number;
  /** Hangi raporlarda — en fazla 8 kimlik. */
  raporlar: string[];
}

/**
 * Cümleyi karşılaştırma anahtarına çevirir.
 *
 * `anahtar()` Türkçe'ye duyarlı normalleştirme yapıyor: küçük harfe
 * indirirken I/İ tuzağına düşmüyor, noktalama ve fazla boşluğu atıyor.
 * Ham dize karşılaştırması yapılsaydı tek bir virgül farkı aynı cümleyi
 * iki ayrı cümle gösterirdi.
 */
function ck(cumle: string): string {
  return anahtar(cumle);
}

/**
 * Verilen cümlelerin korpustaki yaygınlığını ölçer.
 *
 * Korpus tek geçişte taranıyor: her rapor için cümle anahtarları bir kez
 * çıkarılıp kümeye konuyor. Cümle başına ayrı tarama yapılsaydı 20
 * cümle × 15 rapor × 120 cümle = 36.000 karşılaştırma olurdu; böyle
 * 15 × 120 = 1.800.
 */
export function yayginlikOlc(
  cumleler: string[],
  korpus: Parmakizi[],
): Yayginlik[] {
  const aranan = new Map<string, string>();
  for (const c of cumleler) {
    const k = ck(c);
    if (k && !aranan.has(k)) aranan.set(k, c);
  }

  const sayac = new Map<string, string[]>();
  for (const k of aranan.keys()) sayac.set(k, []);

  for (const p of korpus) {
    /*
     * Rapor içinde tekrarlanan cümle raporu iki kez saydırmamalı: bir
     * raporun kendi içinde bir cümleyi üç kez yazması, o cümleyi yaygın
     * yapmaz.
     */
    const gorulen = new Set<string>();
    for (const c of p.cumleler) {
      const k = ck(c.metin);
      if (gorulen.has(k) || !sayac.has(k)) continue;
      gorulen.add(k);
      sayac.get(k)!.push(p.raporId);
    }
  }

  return [...aranan.entries()].map(([k, cumle]) => {
    const r = sayac.get(k) ?? [];
    return { cumle, raporSayisi: r.length, raporlar: r.slice(0, 8) };
  });
}
