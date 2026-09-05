/**
 * Kopya bulgusunu insan diline çevirir. SAF, test kapsamında.
 *
 * ── NİYE VAR ────────────────────────────────────────────────────────────
 * Ekran şu sayıları gösteriyordu: metin %62, kapsama %78, görsel %100.
 * Üçü de doğru ve üçü de bakanın sorusunu cevaplamıyor. Koordinasyonun
 * sorduğu şey "Jaccard oranı kaç" değil:
 *
 *     Bu iki rapor aynı mı? Neyi kopyalamışlar — metni mi, şekilleri mi?
 *     Ne kadarı ortak?
 *
 * Bu modül metrikleri o cümleye çeviriyor. Sayılar KAYBOLMUYOR — cümlenin
 * altında dayanak olarak duruyorlar; ama önce cümle geliyor.
 *
 * ── SİSTEM KARAR VERMİYOR ───────────────────────────────────────────────
 * Hiçbir yorum "intihal" demiyor. En ağır ifade "büyük ölçüde aynı" ve o
 * da gözlemin kendisi. Kararı hakem veriyor; bu modülün işi kanıtı
 * okunur kılmak.
 */

export type KopyaAgirligi = 'agir' | 'orta' | 'hafif' | 'ayniTakim';

export interface KopyaOlcumu {
  /** MinHash ile tahmin edilen Jaccard örtüşmesi (0-1). */
  metinOrani: number;
  /** Küçük belgenin ne kadarı ötekinde bulunuyor (0-1). */
  kapsama: number;
  /** En güçlü görsel eşleşmesi (0-1); yoksa 0. */
  gorselOrani: number;
  cumleSayisi: number;
  gorselSayisi: number;
  /** Aynı takımın başka bir raporu — kopya değil, devam projesi olabilir. */
  ayniTakim: boolean;
}

export interface KopyaYorumu {
  agirlik: KopyaAgirligi;
  /** Tek cümlelik hüküm — kartın başlığı. */
  baslik: string;
  /** İki cümlelik açıklama — ne görüldüğü ve ne anlama gelebileceği. */
  aciklama: string;
}

const yuzde = (x: number) => Math.round(x * 100);

export function kopyaYorumu(o: KopyaOlcumu): KopyaYorumu {
  const m = yuzde(o.metinOrani);
  const k = yuzde(o.kapsama);
  const g = yuzde(o.gorselOrani);

  /*
   * AYNI TAKIM HER ŞEYDEN ÖNCE GELİYOR.
   *
   * Aynı takımın iki raporu arasındaki yüksek örtüşme beklenen bir şey:
   * ön tasarım raporu ile detaylı tasarım raporu aynı projeyi anlatıyor.
   * Bunu kopya olarak sunmak, hakemi olmayan bir sorunu incelemeye
   * yönlendirir ve gerçek bulguların arasında gürültü yaratır.
   */
  if (o.ayniTakim) {
    return {
      agirlik: 'ayniTakim',
      baslik: 'Aynı takımın iki raporu',
      aciklama:
        `Metnin %${k}'i ortak. Aynı takıma ait olduğu için bu beklenen bir `
        + 'durum olabilir — devam projesi ya da aynı projenin ileri aşaması. '
        + 'Yine de farklı bir yarışmaya aynı raporun sunulup sunulmadığı '
        + 'kontrol edilmeli.',
    };
  }

  // Hem metin hem şekil yüksek: iki belge büyük ölçüde aynı.
  if (o.kapsama >= 0.8 && o.gorselSayisi >= 2) {
    return {
      agirlik: 'agir',
      baslik: 'İki rapor büyük ölçüde aynı',
      aciklama:
        `Küçük raporun %${k}'i büyüğünde birebir bulunuyor ve ${o.gorselSayisi} `
        + `görsel eşleşiyor (en güçlüsü %${g}). Bu düzeyde örtüşme ortak bir `
        + 'kaynaktan türetilmiş iki belgeyi işaret ediyor.',
    };
  }

  /*
   * ŞEKİL KOPYASI AYRI BİR SINIF.
   *
   * Metin yeniden yazılmış ama şekiller aynı — klasik metin karşılaştırma
   * araçlarının kaçırdığı durum ve bu sistemin ayırt edici tarafı.
   * Metin oranı düşükken görsel eşleşmesi varsa bunu ayrıca söylüyoruz;
   * yoksa "düşük benzerlik" diye geçilip kaybolur.
   */
  if (o.gorselSayisi >= 2 && o.metinOrani < 0.35) {
    return {
      agirlik: 'agir',
      baslik: 'Aynı görseller kullanılmış, metin farklı',
      aciklama:
        `${o.gorselSayisi} görsel eşleşiyor (en güçlüsü %${g}) ama metin `
        + `örtüşmesi yalnızca %${m}. Şekiller ortak, anlatım yeniden `
        + 'yazılmış olabilir.',
    };
  }

  if (o.kapsama >= 0.55) {
    return {
      agirlik: 'agir',
      baslik: 'Metnin büyük kısmı ortak',
      aciklama:
        `Küçük raporun %${k}'i ötekinde de geçiyor; ${o.cumleSayisi} cümle `
        + 'birebir eşleşti. Şablon metni, başlıklar ve kaynakça '
        + 'karşılaştırma dışında tutuldu.',
    };
  }

  if (o.gorselSayisi >= 1) {
    return {
      agirlik: 'orta',
      baslik: 'Ortak görsel var',
      aciklama:
        `${o.gorselSayisi} görsel eşleşiyor (en güçlüsü %${g}). Metin `
        + `örtüşmesi %${m}. Aynı kaynaktan alınmış bir şema ya da grafik `
        + 'olabilir.',
    };
  }

  return {
    agirlik: 'hafif',
    baslik: 'Olağandışı metin benzerliği',
    aciklama:
      `${o.cumleSayisi} cümle eşleşiyor; metin örtüşmesi %${m}. Bu kategorinin `
      + 'kendi ortalamasının belirgin üstünde — ortak terminoloji tek başına '
      + 'bu düzeyi açıklamıyor.',
  };
}

/** Rozet rengi — ağırlığa göre. */
export const AGIRLIK_RENGI: Record<KopyaAgirligi, string> = {
  agir: 'bg-kirmizi text-white',
  orta: 'bg-amber-zemin text-amber-koyu',
  hafif: 'bg-zemin text-metin-2',
  ayniTakim: 'bg-mavi-zemin text-mavi-koyu',
};

export const AGIRLIK_ETIKETI: Record<KopyaAgirligi, string> = {
  agir: 'YÜKSEK ÖRTÜŞME',
  orta: 'İNCELENMELİ',
  hafif: 'DÜŞÜK',
  ayniTakim: 'AYNI TAKIM',
};
