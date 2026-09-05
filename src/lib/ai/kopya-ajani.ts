import { ciftKarsilastir, type CiftSonucu, type Parmakizi } from '@/lib/analiz/benzerlik';
import { yayginlikOlc } from '@/lib/analiz/cumle-yayginlik';
import { ajaniCalistir, type AjanSonucu, type Alet } from './ajan';
import type { AjanIstemcisi } from './ajan';

/**
 * Kopya soruşturma ajanı.
 *
 * ── ÇÖZDÜĞÜ SORUN ───────────────────────────────────────────────────────
 * Benzerlik taraması iki rapor arasında sayı üretiyor: metin oranı 0,62 ·
 * kapsama 0,81 · 3 ortak görsel. `kopya-yorumu.ts` bu sayıları sabit
 * kurallarla cümleye çeviriyor — bir iş akışı, ajan değil, ve doğru
 * seçimdi: eşiğe bakıp etiket basmak için model gerekmez.
 *
 * Ama etiket, hakemin sorusunu cevaplamıyor. Hakemin sorusu şu: BU İKİSİ
 * BİRBİRİNDEN Mİ KOPYALADI? Sayılar bunu söyleyemez, çünkü aynı sayılar
 * dört ayrı durumdan çıkabiliyor:
 *
 *   · Gerçekten kopya — ortak cümleler başka hiçbir raporda yok
 *   · Şablon kalıbı   — ortak cümleler on iki raporda daha var
 *   · Devam projesi   — aynı takımın geçen yılki raporu
 *   · Ortak kaynak    — ikisi de aynı standardın tanımını alıntılamış
 *
 * Ayrımı yapmak için ORTAK CÜMLELERE BAKMAK gerekiyor, orana değil. Kaç
 * cümleye bakılacağı da baştan belli değil: ilk üç cümle kalıp çıkarsa
 * soruşturma orada biter, özgün çıkarsa derinleşir.
 *
 * ── YAYGINLIK ALETİ İŞİN BELKEMİĞİ ──────────────────────────────────────
 * `cumle_yayginligi`, bir cümlenin korpusta kaç raporda geçtiğini
 * söylüyor. Şablon kalıbını kalıp yapan şey zaten çok yerde geçmesi;
 * ajan bunu sorarak yanlış-pozitifi kendi eliyle eliyor. Bu aleti
 * vermeseydik ajan yalnızca "bu cümleler bana kalıp gibi geldi" diyebilir,
 * kanıt gösteremezdi.
 *
 * ── HÜKÜM YOK ───────────────────────────────────────────────────────────
 * Ajanın en ağır kararı "kopya şüphesi güçlü". "İntihal" kelimesi
 * kullanılmıyor ve kullanılmaması gerekiyor: intihal bir disiplin
 * kararıdır, bir ölçüm sonucu değil.
 */

export type KopyaKarari =
  /** Ortak metin başka raporlarda yok; iki rapor birbirine bağlı. */
  | 'kopya_suphesi_guclu'
  /** Ortak metin var ama açıklanabilir; hakem baksın. */
  | 'incelenmeli'
  /** Aynı takımın önceki/paralel başvurusu. */
  | 'devam_projesi'
  /** Ortak metin şablon ya da şartname kalıbı. */
  | 'sablon_kalibi'
  /** Örtüşme anlamlı bir bağ göstermiyor. */
  | 'zayif_iz';

export interface KopyaKararDetayi {
  karar: KopyaKarari;
  guven: 'yuksek' | 'orta' | 'dusuk';
  baslik: string;
  gerekce: string;
  kanit: string[];
  hakemeNot: string;
}

const SISTEM = `Sen TEKNOFEST proje raporlarında kopya şüphelerini soruşturan bir denetçisin.

DURUM: Otomatik tarama iki rapor arasında yüksek örtüşme buldu ve çifti
işaretledi. Senin işin, bu örtüşmenin NE ANLAMA GELDİĞİNİ araştırmak.

AYNI SAYILAR DÖRT AYRI DURUMDAN ÇIKABİLİR:
1. Gerçek kopya — ortak cümleler başka hiçbir raporda yok
2. Şablon kalıbı — ortak cümleler korpusta onlarca raporda var; ikisi de
   aynı şartnameden almış, birbirinden değil
3. Devam projesi — aynı takımın önceki yıl raporu; örtüşme beklenen şey
4. Ortak kaynak — ikisi de aynı standardın ya da tanımın alıntısını
   yapmış

ALETLERİN:
- ortak_cumleler: örtüşen cümle çiftlerini getirir (sayfa numaralarıyla)
- cumle_yayginligi: bir cümlenin korpusta KAÇ RAPORDA geçtiğini söyler
- gorsel_eslesmeleri: eşleşen görselleri sayfa/sıra ve Hamming mesafesiyle
- rapor_baglami: iki raporun takım, yıl, kategori ve başvuru bilgisi

YÖNTEM:
1. Önce rapor_baglami çağır. Aynı takımsa iş büyük ölçüde bitmiştir:
   devam_projesi. Yine de ortak cümlelere bir bak.
2. ortak_cumleler ile en güçlü eşleşmelerden birkaçını al.
3. AYIRT EDİCİ ADIM: aldığın cümlelerin yayginligini sor. Korpusun
   büyük kısmında geçen cümleler kalıptır ve kanıt değildir. Yalnızca
   O İKİ RAPORDA geçen cümleler kopya kanıtıdır.
4. Görsel eşleşmesi varsa ona da bak: genel bir akış şeması ile projeye
   özgü bir fotoğraf aynı ağırlıkta değildir. Hamming mesafesi 0-2 ise
   görsel neredeyse birebir aynıdır.
5. Kararını ver ve KANIT olarak somut cümleleri göster.

SINIRLAR:
- "intihal" deme. İntihal bir disiplin kararıdır, ölçüm sonucu değil.
- Kanıt olarak yalnızca aletlerden geleni kullan.
- Cimri ol: 4-8 alet çağrısı yeter. Bütçe gerçek.
- Bitirdiğinde karari_bildir aletini çağır.`;

const BITIR = {
  ad: 'karari_bildir',
  aciklama: 'Soruşturmayı bitir ve kararını kanıtıyla bildir.',
  sema: {
    type: 'object' as const,
    properties: {
      karar: {
        type: 'string',
        enum: [
          'kopya_suphesi_guclu', 'incelenmeli', 'devam_projesi',
          'sablon_kalibi', 'zayif_iz',
        ],
      },
      guven: { type: 'string', enum: ['yuksek', 'orta', 'dusuk'] },
      baslik: {
        type: 'string',
        description: 'Tek cümlelik sonuç. Hakem listede bunu görecek.',
      },
      gerekce: {
        type: 'string',
        description: 'İki-dört cümle. Neden bu karara vardığın.',
      },
      kanit: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Somut kanıt satırları. Örnek: "«…» cümlesi yalnızca bu iki '
          + 'raporda geçiyor (yaygınlık 2/15)". Alet çıktısına '
          + 'dayanmayan hiçbir şey kanıt değildir.',
      },
      hakemeNot: {
        type: 'string',
        description: 'Hakemin ne yapması gerektiği — bir cümle.',
      },
    },
    required: ['karar', 'guven', 'baslik', 'gerekce', 'kanit', 'hakemeNot'],
  },
};

export interface KopyaBaglami {
  a: { raporId: string; proje: string; takim: string; yil?: number; kategori: string; basvuruNo?: string };
  b: { raporId: string; proje: string; takim: string; yil?: number; kategori: string; basvuruNo?: string };
}

function aletleriKur(
  cift: CiftSonucu,
  korpus: Parmakizi[],
  baglam: KopyaBaglami,
): Alet[] {
  return [
    {
      ad: 'rapor_baglami',
      aciklama: 'İki raporun takım, yıl, kategori ve başvuru bilgisi.',
      sema: { type: 'object', properties: {} },
      async calistir() {
        return {
          icerik: { ...baglam, ayniTakim: cift.ayniTakim },
          ozet: `bağlam alındı · ${cift.ayniTakim ? 'AYNI TAKIM' : 'farklı takımlar'}`,
        };
      },
    },
    {
      ad: 'ortak_cumleler',
      aciklama:
        'Örtüşen cümle çiftlerini oranına göre sıralı getirir. '
        + '`adet` en fazla 12 olabilir.',
      sema: {
        type: 'object',
        properties: {
          adet: { type: 'integer', description: 'Kaç çift (varsayılan 6, en fazla 12)' },
        },
      },
      async calistir(g) {
        const adet = Math.min(Number(g.adet ?? 6) || 6, 12);
        const liste = [...cift.cumleEslesmeleri]
          .sort((x, y) => y.oran - x.oran)
          .slice(0, adet)
          .map((e) => ({
            oran: Number(e.oran.toFixed(2)),
            a: { sayfa: e.a.sayfa, metin: e.a.metin.slice(0, 300) },
            b: { sayfa: e.b.sayfa, metin: e.b.metin.slice(0, 300) },
          }));
        return {
          icerik: liste.length ? liste : { eslesme: 0 },
          ozet: `ortak cümleler → ${liste.length} çift (toplam ${cift.cumleEslesmeleri.length})`,
        };
      },
    },
    {
      ad: 'cumle_yayginligi',
      aciklama:
        'Verilen cümlelerin korpusta KAÇ RAPORDA geçtiğini ölçer. '
        + 'Yüksek sayı kalıp metin demektir ve kopya kanıtı değildir; '
        + 'yalnızca bu iki raporda geçen cümle kanıttır.',
      sema: {
        type: 'object',
        properties: {
          cumleler: {
            type: 'array',
            items: { type: 'string' },
            description: 'En fazla 8 cümle',
          },
        },
        required: ['cumleler'],
      },
      async calistir(g) {
        const cumleler = (Array.isArray(g.cumleler) ? g.cumleler : [])
          .map(String)
          .slice(0, 8);
        const sonuc = yayginlikOlc(cumleler, korpus).map((y) => ({
          cumle: y.cumle.slice(0, 120),
          raporSayisi: y.raporSayisi,
          korpusBoyu: korpus.length,
        }));
        const enYuksek = Math.max(0, ...sonuc.map((x) => x.raporSayisi));
        return {
          icerik: sonuc,
          ozet:
            `yaygınlık → ${cumleler.length} cümle · korpus ${korpus.length} rapor`
            + ` · en yaygın ${enYuksek} raporda`,
        };
      },
    },
    {
      ad: 'gorsel_eslesmeleri',
      aciklama:
        'Eşleşen görselleri sayfa/sıra ve Hamming mesafesiyle getirir. '
        + 'Mesafe 0-2 ise görsel neredeyse birebir aynıdır.',
      sema: { type: 'object', properties: {} },
      async calistir() {
        const liste = cift.gorselEslesmeleri.map((e) => ({
          a: e.a, b: e.b,
          hamming: e.hammingMesafesi,
          oran: Number(e.oran.toFixed(2)),
        }));
        return {
          icerik: liste.length ? liste : { eslesme: 0 },
          ozet: `görsel eşleşmesi → ${liste.length} çift`,
        };
      },
    },
  ];
}

export async function kopyayiSorustur(
  istemci: AjanIstemcisi,
  a: Parmakizi,
  b: Parmakizi,
  korpus: Parmakizi[],
  baglam: KopyaBaglami,
): Promise<AjanSonucu<KopyaKararDetayi>> {
  const cift = ciftKarsilastir(a, b, true);

  /*
   * ÖLÇÜMLER GÖREV METNİNDE, ALET DEĞİL.
   * Bunlar zaten hesaplanmış üç sayı; ajanın onları öğrenmek için bir tur
   * harcaması boşuna bir tur olurdu. Alet, ajanın SEÇEREK isteyeceği
   * ayrıntılar için.
   */
  const gorev =
    `İşaretli çift:\n`
    + `  A · ${baglam.a.proje} (${baglam.a.takim})\n`
    + `  B · ${baglam.b.proje} (${baglam.b.takim})\n\n`
    + `Otomatik tarama ölçümleri:\n`
    + `  metin örtüşmesi : ${(cift.metinOrani * 100).toFixed(0)}%\n`
    + `  kapsama         : ${(cift.kapsama * 100).toFixed(0)}%\n`
    + `  görsel eşleşmesi: ${cift.gorselEslesmeleri.length} çift`
    + `${cift.gorselOrani ? ` (en güçlü ${(cift.gorselOrani * 100).toFixed(0)}%)` : ''}\n`
    + `  ortak cümle     : ${cift.cumleEslesmeleri.length}\n`
    + `  korpus          : ${korpus.length} rapor\n\n`
    + `Bu örtüşmenin ne anlama geldiğini soruştur.`;

  const sonuc = await ajaniCalistir<KopyaKararDetayi>({
    istemci,
    sistem: SISTEM,
    gorev,
    aletler: aletleriKur(cift, korpus, baglam),
    bitirAleti: BITIR,
    enFazlaTur: 10,
    turBasinaToken: 2500,
  });

  return { ...sonuc, karar: sonuc.karar ? kararNormal(sonuc.karar) : null };
}

/**
 * Modelin döndürdüğü kararı beklenen şekle oturtur.
 *
 * Şema `kanit` alanını dizi olarak tanımlıyor ama model bunu bazen tek
 * bir dize olarak döndürüyor. Kontrol edilmeden ekrana verildiğinde
 * `kanit.map(...)` dizeyi KARAKTER KARAKTER geziyor ve hakem, kanıt
 * listesi yerine alt alta dizilmiş harfler görüyor — ilk gerçek
 * çalıştırmada tam olarak bu oldu.
 *
 * Şemaya güvenip normalleştirmemek, modelin her zaman sözünü tutacağını
 * varsaymak demek. İki satırlık koruma, bozuk bir ekrandan ucuz.
 */
function kararNormal(k: KopyaKararDetayi): KopyaKararDetayi {
  const ham = k.kanit as unknown;
  const kanit = Array.isArray(ham)
    ? ham.map(String).filter((x) => x.trim())
    : typeof ham === 'string' && ham.trim()
      /* Tek dize geldiyse satırlara bölünüyor; çoğu zaman zaten liste. */
      ? ham
          .split(/\r?\n/)
          .map((x) => x.replace(/^[-•*]\s*/, '').trim())
          .filter(Boolean)
      : [];
  return { ...k, kanit };
}
