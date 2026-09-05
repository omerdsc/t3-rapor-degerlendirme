import {
  crossrefAdaylar, crossrefDoiSorgula, openalexAdaylar,
} from '@/lib/analiz/kaynak-dogrula';
import { baslikCikar, doiCikar, ilkYazarCikar } from '@/lib/analiz/kaynak-dogrula';
import type { Kaynak } from '@/lib/analiz/kaynakca';
import { ajaniCalistir, type Alet, type AjanSonucu } from './ajan';
import type { ClaudeIstemcisi } from './istemci';

/**
 * Kaynakça denetim ajanı.
 *
 * ── ÇÖZDÜĞÜ SORUN ───────────────────────────────────────────────────────
 * `kaynaklariDogrula()` sabit bir zincir yürütüyor: DOI varsa Crossref,
 * yoksa OpenAlex başlık, o da yoksa Crossref başlık. Zincir bittiğinde
 * elde "bulunamadi" kalıyor ve bu tek kelime İKİ BAMBAŞKA DURUMU
 * birleştiriyor:
 *
 *   · IEC 61400-12-1 bir standart. Crossref'te yok, olması da beklenmez.
 *     Kaynak gerçek.
 *   · "Yılmaz, A. (2023). Derin ogrenme ile turbin optimizasyonu.
 *     Journal of Renewable Systems, 14(3), 221-238." Böyle bir dergi ve
 *     böyle bir makale yok. Kaynak uydurma.
 *
 * Hakem ekranda ikisini de "doğrulanamadı" olarak görüyor ve ayırt
 * edemiyor. Oysa ilki not düşülecek bir şey bile değil, ikincisi
 * raporun tamamını şüpheli kılıyor.
 *
 * ── NİYE AJAN ───────────────────────────────────────────────────────────
 * Ayrımı yapmak için gereken adım sayısı künyeye bağlı. DOI'si olan bir
 * makale tek sorguda biter. Başlığı bozuk yazılmış bir kaynak, başlık
 * sadeleştirilip yeniden aranmayı ister. Bir standart hiç aranmamalıdır
 * bile — türünden belli. Bu yolu önceden kodlamak, bütün künye
 * biçimlerini önceden bilmek demekti; ajan yolu koşarken kuruyor.
 *
 * ── HÜKÜM VERMİYOR, KANIT GÖSTERİYOR ────────────────────────────────────
 * Ajanın en ağır kararı "uydurma şüphesi" — "uydurma" değil. Bir
 * yarışmacıyı intihalle suçlamak hakemin ve koordinasyonun işi; sistemin
 * işi kanıtı önlerine koymak. Her karar hangi indekste ne arandığını ve
 * ne bulunduğunu taşıyor, böylece hakem katılmadığında nereye bakacağını
 * biliyor.
 */

export type KaynakKarari =
  /** İndekste bulundu, künye tutuyor. */
  | 'dogrulandi'
  /** Bulundu ama künye sapıyor (yıl, yazar ya da başlık tutmuyor). */
  | 'kismen'
  /** Gerçek ama akademik indekslerde aranmaz: standart, kitap, tez, web. */
  | 'indekslenemez'
  /** Bulunamadı; uydurma olduğu söylenemez, doğrulanamadı da denemez. */
  | 'bulunamadi'
  /** İndekslenmiş bir yayın olduğunu iddia ediyor ama izi yok. */
  | 'uydurma_suphesi';

export interface KaynakBulgusu {
  numara: number | null;
  ham: string;
  karar: KaynakKarari;
  guven: 'yuksek' | 'orta' | 'dusuk';
  gerekce: string;
  kanit: string;
}

export interface KaynakcaKarari {
  bulgular: KaynakBulgusu[];
  ozet: string;
}

const SISTEM = `Sen TEKNOFEST proje raporlarını inceleyen bir kaynakça denetçisisin.

GÖREVİN: Sana verilen kaynakça künyelerinin GERÇEKTEN VAR OLUP OLMADIĞINI
araştırmak ve her biri için kanıta dayalı bir karar üretmek.

NİYE ÖNEMLİ: Raporlar giderek yapay zekâ ile yazılıyor ve modeller
kaynakça uyduruyor. Uydurma künye biçimsel olarak kusursuz görünür —
yazar, yıl, dergi, cilt, sayfa aralığı hepsi yerindedir — ama öyle bir
yayın yoktur. Biçime bakan hiçbir kontrol bunu yakalayamaz.

ALETLERİN:
- kunye_coz: künyeyi başlık/yazar/DOI parçalarına ayırır (ücretsiz, ağ yok)
- crossref_doi: bir DOI'yi Crossref'te çözer
- crossref_ara: başlıkla Crossref'te aday arar
- openalex_ara: başlıkla OpenAlex'te aday arar

YÖNTEM:
1. Önce künyenin TÜRÜNÜ belirle. Standart (IEC, ISO, TSE, JCGM), kitap,
   tez, kurumsal rapor, web sayfası ve veri seti akademik indekslerde
   ARANMAZ — bunlar için sorgu harcama, doğrudan "indekslenemez" de.
   Sorgu, indekslenmiş olduğu iddia edilen makale ve bildiriler için.
2. DOI varsa önce onu çöz. Tutuyorsa iş bitti.
3. DOI yoksa başlıkla ara. Aday listesi geliyor; oran alanı örtüşmedir.
   Yüksek oran + yazar/yıl tutuyor => dogrulandi.
   Yüksek oran ama yıl veya yazar sapıyor => kismen.
4. Aday hiç yoksa ya da oranlar düşükse, başlığı sadeleştirip (alt
   başlığı at, çeviriyse özgün dilde dene) BİR KEZ daha ara.
5. Hâlâ iz yoksa karar ver:
   - Künye indekslenmiş bir dergi makalesi olduğunu iddia ediyor ve
     ne başlığın ne yazarın izi var => uydurma_suphesi
   - Yerel/Türkçe dergi, eski yayın ya da indeks kapsamı dışı olabilir
     => bulunamadi
   Kendi bilginle bir yayının varlığından eminsen bunu gerekçede söyle
   ama KANIT olarak sunma; kanıt yalnızca aletlerden gelendir.

SINIRLAR:
- "uydurma" deme, "uydurma_suphesi" de. Hükmü hakem verir.
- Sorgu harcamada cimri ol: her künye için en fazla 2-3 sorgu. Bütçe
  gerçek ve sınırlı.
- Birden çok künyeyi aynı turda araştırabilirsin, paralel alet çağır.
- Bitirdiğinde karari_bildir aletini çağır. Her künye için bir bulgu
  döndür, hiçbirini atlama.`;

/* --------------------------------------------------------------- aletler */

function ozetle(ad: string, girdi: unknown, n: number, ek = ''): string {
  const g = typeof girdi === 'string' ? girdi : JSON.stringify(girdi);
  return `${ad}(${g.slice(0, 60)}) → ${n} sonuç${ek}`;
}

const ALETLER: Alet[] = [
  {
    ad: 'kunye_coz',
    aciklama:
      'Ham künyeyi başlık, ilk yazar ve DOI parçalarına ayırır. Ağ '
      + 'kullanmaz, ücretsizdir; aramadan önce çağırmak isabet oranını '
      + 'yükseltir.',
    sema: {
      type: 'object',
      properties: { ham: { type: 'string', description: 'Ham künye metni' } },
      required: ['ham'],
    },
    async calistir(g) {
      const ham = String(g.ham ?? '');
      const cozum = {
        baslik: baslikCikar(ham),
        yazar: ilkYazarCikar(ham),
        doi: doiCikar(ham),
      };
      return {
        icerik: cozum,
        ozet: `künye çözüldü${cozum.doi ? ' · DOI var' : ''}${
          cozum.baslik ? '' : ' · başlık çıkarılamadı'
        }`,
      };
    },
  },
  {
    ad: 'crossref_doi',
    aciklama:
      'Bir DOI\'yi Crossref\'te çözer. Kayıt dönerse DOI gerçektir ve '
      + 'başlık/yazar/yıl karşılaştırılabilir.',
    sema: {
      type: 'object',
      properties: { doi: { type: 'string', description: '10.xxxx/... biçiminde DOI' } },
      required: ['doi'],
    },
    async calistir(g) {
      const doi = String(g.doi ?? '');
      const k = await crossrefDoiSorgula(doi);
      return {
        icerik: k ?? { bulundu: false },
        ozet: k ? `Crossref DOI ${doi} → "${k.baslik.slice(0, 50)}"` : `Crossref DOI ${doi} → kayıt yok`,
      };
    },
  },
  {
    ad: 'crossref_ara',
    aciklama:
      'Başlıkla Crossref\'te aday arar. En fazla 4 aday döner; her adayın '
      + '"oran" alanı sorgulanan başlıkla örtüşmedir (0-1).',
    sema: {
      type: 'object',
      properties: { baslik: { type: 'string', description: 'Aranacak yayın başlığı' } },
      required: ['baslik'],
    },
    async calistir(g) {
      const b = String(g.baslik ?? '');
      const a = await crossrefAdaylar(b);
      return {
        icerik: a.length ? a : { aday: 0 },
        ozet: ozetle('Crossref', b, a.length, a.length ? ` · en iyi oran ${Math.max(...a.map((x) => x.oran))}` : ''),
      };
    },
  },
  {
    ad: 'openalex_ara',
    aciklama:
      'Başlıkla OpenAlex\'te aday arar. Crossref\'in kapsamadığı yayınları '
      + '(bazı konferanslar, kurum yayınları) taşıyabilir.',
    sema: {
      type: 'object',
      properties: { baslik: { type: 'string', description: 'Aranacak yayın başlığı' } },
      required: ['baslik'],
    },
    async calistir(g) {
      const b = String(g.baslik ?? '');
      const a = await openalexAdaylar(b);
      return {
        icerik: a.length ? a : { aday: 0 },
        ozet: ozetle('OpenAlex', b, a.length, a.length ? ` · en iyi oran ${Math.max(...a.map((x) => x.oran))}` : ''),
      };
    },
  },
];

const BITIR = {
  ad: 'karari_bildir',
  aciklama: 'Bütün künyeler için kararını bildir ve soruşturmayı bitir.',
  sema: {
    type: 'object' as const,
    properties: {
      bulgular: {
        type: 'array',
        description: 'Her künye için bir bulgu. Hiçbir künye atlanmamalı.',
        items: {
          type: 'object',
          properties: {
            numara: { type: ['integer', 'null'], description: 'Kaynakçadaki sıra numarası' },
            ham: { type: 'string', description: 'Künyenin ham metni' },
            karar: {
              type: 'string',
              enum: ['dogrulandi', 'kismen', 'indekslenemez', 'bulunamadi', 'uydurma_suphesi'],
            },
            guven: { type: 'string', enum: ['yuksek', 'orta', 'dusuk'] },
            gerekce: {
              type: 'string',
              description: 'Bir-iki cümle. Hakem bunu okuyup katılıp katılmayacağına karar verecek.',
            },
            kanit: {
              type: 'string',
              description:
                'Hangi alette ne arandı ve ne bulundu. Örnek: '
                + '"Crossref DOI 10.1126/scirobotics.aat3536 → başlık ve yıl tutuyor". '
                + 'Alet çıktısına dayanmayan hiçbir şey kanıt değildir.',
            },
          },
          required: ['numara', 'ham', 'karar', 'guven', 'gerekce', 'kanit'],
        },
      },
      ozet: {
        type: 'string',
        description: 'Kaynakçanın geneli için iki-üç cümle.',
      },
    },
    required: ['bulgular', 'ozet'],
  },
};

/* ----------------------------------------------------------------- çalıştır */

export async function kaynakcayiDenetle(
  istemci: ClaudeIstemcisi,
  kaynaklar: Kaynak[],
  baglam: { proje: string; kategori: string },
): Promise<AjanSonucu<KaynakcaKarari>> {
  const liste = kaynaklar
    .map((k, i) => `${k.numara ?? i + 1}. ${k.ham}`)
    .join('\n');

  const gorev =
    `Proje: ${baglam.proje}\nKategori: ${baglam.kategori}\n\n`
    + `Aşağıdaki ${kaynaklar.length} künyeyi araştır ve her biri için karar ver.\n\n`
    + `${liste}`;

  return ajaniCalistir<KaynakcaKarari>({
    istemci,
    sistem: SISTEM,
    gorev,
    aletler: ALETLER,
    bitirAleti: BITIR,
    /*
     * Künye başına ortalama 1.5 sorgu + kararı yazacak son tur. Yirmi
     * künyelik bir kaynakçada paralel alet çağrısıyla bu sınır rahat
     * yetiyor; yetmezse iz yine dönüyor ve ekranda "tur sınırı" yazıyor.
     */
    enFazlaTur: 16,
    turBasinaToken: 4000,
  });
}
