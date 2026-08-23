/**
 * MVP 6 — AI kriter değerlendirmesi ve geri bildirim.
 *
 * "AI 4. göz": hakeme kriter bazlı ön değerlendirme sunar. Nihai puanı ve
 * kararı hakem verir; buradaki her şey ÖNERİDİR.
 *
 * ── PDF NEDEN GÖNDERİLMİYOR ────────────────────────────────────────────
 * İlk tasarımda ham PDF modele veriliyor ve Claude'un citations özelliği
 * sayfa referansı için kullanılıyordu. Ölçüm bunu çürüttü:
 *
 *     13 sayfalık örnek rapor = 29.792 token
 *     bunun büyük bölümü 24 gömülü görselden geliyor
 *     rapor başına maliyet ≈ $0.85
 *
 * Oysa metni ve her satırın hangi sayfada olduğunu KENDİ ayrıştırıcımız
 * zaten çıkarıyor (pdf.ts + yapi.ts). Aynı işi modele ikinci kez yaptırıp
 * para ödemenin anlamı yok. Bölüm metnini gönderiyoruz, sayfa referansını
 * kendi satır indeksimizden çözüyoruz:
 *
 *     aynı rapor, metin olarak ≈ 3.000 token
 *     rapor başına maliyet ≈ $0.15   (5–6 kat ucuz)
 *
 * ── ŞEKİLLER YİNE DE GÖNDERİLİR ────────────────────────────────────────
 * PDF'in tamamı değil, ŞEKİLLER gönderilir. Yarışmacılar akış şemasını ve
 * sistem mimarisini çizip görsel olarak ekliyor; yalnızca metne bakan bir
 * değerlendirme "Akış Şeması" bölümünde beş kelime görüp haksız yere puan
 * kırıyor. Gerçek örnekte tam bu oldu.
 *
 * Şekiller ayrı ayrı çıkarılıp uzun kenarı 1100 px'e indiriliyor: altı şekil
 * ≈ 6.600 token ≈ $0.03. Ham PDF ise 29.792 token ediyordu — aradaki fark
 * neredeyse tamamen sayfa arka planı ve süs görselleriydi.
 * bkz. analiz/gorsel.ts
 *
 * ── RUBRİK ŞABLONDAN GELİR ─────────────────────────────────────────────
 * Kriterler ve ağırlıklar uydurulmaz; TEKNOFEST şablonundaki "(N Puan)"
 * başlıkları ve bölüm yönergeleri kullanılır. bkz. sablon-cikar.ts
 */

import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema';
import type { Belge } from '../analiz/tipler';
import type { CikarilanSekil } from '../analiz/gorsel';
import type { Rubrik } from '../analiz/sablon-cikar';
import { anahtar, benzerlik } from '../analiz/normalize';
import { ClaudeIstemcisi, MODEL, kullanimTopla, type Kullanim } from './istemci';
import { ozetiMetneCevir, type SartnameOzeti } from './sartname-ozeti';

export type Guven = 'yuksek' | 'orta' | 'dusuk';

/**
 * Raporun şablona ne kadar uyduğu. Modele bilgi olarak verilir: uymayan
 * raporda "başlık yok" demek yerine içeriği her yerde aramasını sağlar.
 */
export interface SablonUyumu {
  eksikBolumler: string[];
  fazlaBolumler: string[];
  /** 0–1; şablon imzasıyla örtüşme. */
  sablonSkoru?: number;
}

export interface Kanit {
  alinti: string;
  /** Alıntının bulunduğu sayfa — kendi satır indeksimizden çözülür. */
  sayfa?: number;
}

export interface KriterDegerlendirmesi {
  kod: string;
  ad: string;
  azamiPuan: number;
  /** AI'ın önerdiği puan. Hakem değiştirebilir. */
  aiPuan: number;
  guven: Guven;
  gerekce: string;
  gucluYonler: string[];
  gelisimAlanlari: string[];
  /** Yarışmacıya gösterilecek somut öneri. */
  oneri: string;
  kanitlar: Kanit[];
  /**
   * Güven düşükse sistem puana güvenilmemesini söyler. Bir değerlendirme
   * sisteminin en değerli davranışı, bilmediğini bilmesidir.
   */
  hakemIncelemesiGerekli: boolean;
}

/**
 * Şartnamenin katı kısıtlarından birinin ihlali.
 *
 * Bu bir KRİTER PUANI DEĞİL. "Çözüm çevrim dışı çalışmalı" diyen bir
 * şartnamede buluta dayalı mimari öneren rapor, teknik kriterlerden tam puan
 * alabilir ama yarışmaya uygun değildir. İki şeyi karıştırmak hakemi yanıltır:
 * puanı düşürmek ihlali gizler, ihlali yazmamak ise raporu hatalı onaylatır.
 * Bu yüzden ihlal ayrı raporlanır ve puanlamaya karışmaz.
 */
export interface SartnameIhlali {
  /** İhlal edilen kısıt, şartname özetindeki haliyle. */
  kisit: string;
  /** Raporun hangi ifadesi bu kısıtla çelişiyor. */
  kanit: Kanit;
  guven: Guven;
}

export interface Degerlendirme {
  kriterler: KriterDegerlendirmesi[];
  aiToplam: number;
  azamiToplam: number;
  genelGucluYonler: string[];
  genelGelisimAlanlari: string[];
  /** Katı kısıt ihlalleri — puanlamadan bağımsız, hakemin görmesi gereken. */
  sartnameIhlalleri: SartnameIhlali[];
  kullanim: Kullanim;
  sureMs: number;
  incelemeGereken: number;
}

// --------------------------------------------------------------- istem

const SISTEM = `Sen TEKNOFEST proje raporlarını değerlendiren bir hakem yardımcısısın.

Nihai kararı sen vermiyorsun. Uzman hakeme ön inceleme sunuyorsun; puanı o
verecek. Bu yüzden:

- Her yargını rapordan BİREBİR alıntıyla destekle. Alıntıyı değiştirme.
- Raporda olmayanı varmış gibi anlatma. Bulamadıysan "bulunamadı" de.
- Emin değilsen puan uydurma: güveni "dusuk" yap, hakemIncelemesiGerekli=true
  ver ve gerekçede neden emin olmadığını yaz.
- Uzunluk kalite değildir. Uzun bölüm otomatik yüksek puan almaz.
- Dil ve yazım kalitesi teknik kriterlerin puanını ETKİLEMEZ. İmkânları
  kısıtlı okullardan gelen takımları cezalandırmak değerlendirmeyi bozar.
  Anlatım kalitesi yalnızca kendi kriteri varsa orada puanlanır.
- Türkçe, teknik ve yalın yaz. Gerekçeler kısa olsun: en fazla üç cümle.

ŞABLONA UYMAYAN RAPORLAR
Her yarışmanın şablonu farklıdır ve yarışmacılar şablona her zaman uymaz:
başlıkları değiştirir, siler, kendi düzenini kurar, şekilleri beklenmeyen
yerlere koyar. Bu yüzden:

- Beklenen başlığı bulamazsan içeriği raporun BÜTÜNÜNDE ara. Başlık yok diye
  içerik de yok sayma; başka bir bölümün içine yazılmış olabilir.
- İçeriği başka bir yerde bulursan kriteri ona göre puanla ve gerekçede
  "içerik X bölümü altında bulundu" diye belirt.
- Gerçekten hiçbir yerde yoksa o zaman yok de.
- Şablona uymama, ayrı bir "rapor düzeni" kriteri varsa ORADA puanlanır;
  içerik kriterlerinin puanını düşürmek için kullanılmaz.

ŞEKİLLER
Rapora şekiller eklenmiş olabilir; sana ayrı ayrı, sayfa numarası ve varsa
altyazısıyla verilir. Bir bölümün metni kısa olsa da içeriği şekilde olabilir
— şekli gördüysen ona göre değerlendir, "metin yok" diye puan kırma. Şeklin
bölüm bilgisi tahmindir; gerçekte hangi kritere ait olduğuna altyazısına ve
içeriğine bakarak sen karar ver. Şekil okunamıyorsa (çözünürlük düşük,
etiketler görünmüyor) bunu açıkça yaz ve güveni düşür.

ŞARTNAME
Sana yarışma şartnamesinin özeti verilebilir. Şablon "raporu nasıl yaz" der,
şartname "yarışma ne istiyor, ne eler" der. Özeti şöyle kullan:

- Teknik beklentiler, özgünlük ve uygulanabilirlik kriterlerinin ÖLÇÜTÜDÜR.
  Raporun anlattığı çözüm bu beklentileri karşılıyor mu, buna göre puanla.
- KATI KISITLAR farklıdır: bunlar puan konusu değil, uygunluk konusudur.
  Raporun önerdiği tasarım bir katı kısıtla çelişiyorsa bunu sartnameIhlalleri
  altında bildir — kriter puanını bu yüzden DÜŞÜRME. Puanı düşürmek ihlali
  gizler; hakem düşük puanı zayıf içerik sanar, uygunsuzluğu göremez.
- İhlali yalnızca raporun kendi ifadesi kısıtla açıkça çelişiyorsa yaz ve
  çelişen ifadeyi birebir alıntıla. Rapor konuyu hiç anmıyorsa bu ihlal
  değildir; olsa olsa eksikliktir ve ilgili kriterde belirtilir.
- Eleyici durumların çoğu (teslim tarihi, başvuru usulü) rapordan görülemez.
  Yalnızca rapordan görülebilen bir eleyici durum varsa yaz.`;

const SEMA = {
  type: 'object',
  properties: {
    kriterler: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kod: { type: 'string', description: 'Verilen kriter kodu, birebir' },
          puan: { type: 'number', description: 'Önerilen puan, azamiyi aşamaz' },
          guven: { type: 'string', enum: ['yuksek', 'orta', 'dusuk'] },
          gerekce: { type: 'string', description: 'En fazla üç cümle' },
          alintilar: {
            type: 'array',
            description: 'Rapordan birebir alıntılar; en fazla iki tane, kısa tut',
            items: { type: 'string' },
          },
          gucluYonler: { type: 'array', items: { type: 'string' } },
          gelisimAlanlari: { type: 'array', items: { type: 'string' } },
          oneri: { type: 'string', description: 'Tek somut iyileştirme önerisi' },
          hakemIncelemesiGerekli: { type: 'boolean' },
        },
        required: [
          'kod', 'puan', 'guven', 'gerekce', 'alintilar',
          'gucluYonler', 'gelisimAlanlari', 'oneri', 'hakemIncelemesiGerekli',
        ],
        additionalProperties: false,
      },
    },
    genelGucluYonler: { type: 'array', items: { type: 'string' } },
    genelGelisimAlanlari: { type: 'array', items: { type: 'string' } },
    sartnameIhlalleri: {
      type: 'array',
      description:
        'Raporun tasarımı bir KATI KISITLA açıkça çelişiyorsa. Şüphe varsa boş bırak.',
      items: {
        type: 'object',
        properties: {
          kisit: { type: 'string', description: 'İhlal edilen kısıt' },
          alinti: { type: 'string', description: 'Rapordan birebir çelişen ifade' },
          guven: { type: 'string', enum: ['yuksek', 'orta', 'dusuk'] },
        },
        required: ['kisit', 'alinti', 'guven'],
        additionalProperties: false,
      },
    },
  },
  required: [
    'kriterler', 'genelGucluYonler', 'genelGelisimAlanlari', 'sartnameIhlalleri',
  ],
  additionalProperties: false,
} as const;

interface Cikti {
  kriterler: Array<{
    kod: string;
    puan: number;
    guven: Guven;
    gerekce: string;
    alintilar: string[];
    gucluYonler: string[];
    gelisimAlanlari: string[];
    oneri: string;
    hakemIncelemesiGerekli: boolean;
  }>;
  genelGucluYonler: string[];
  genelGelisimAlanlari: string[];
  sartnameIhlalleri: Array<{ kisit: string; alinti: string; guven: Guven }>;
}

// ------------------------------------------------------ metin hazırlığı

/**
 * Rapor gövdesini derler.
 *
 * ŞABLONA UYMAYAN RAPOR EN ÇOK YARDIMA İHTİYAÇ DUYAN RAPORDUR.
 * Bölüm başlıkları tanınamadıysa (yarışmacı şablonu değiştirmiş, başlıkları
 * silmiş, kendi düzenini kurmuş) bölüm listesi boş kalır. Bu durumda modele
 * hiçbir şey göndermemek en kötü sonuç: sistem tam da hatalı raporda kör
 * kalır. Bu yüzden bölüm yapısı zayıfsa raporun DÜZ METNİNE düşülür.
 */
function raporMetni(belge: Belge, azamiKarakter = 45_000): string {
  const doluBolumler = belge.bolumler.filter((b) => b.govde.trim().length > 40);

  // Gövdenin en az yarısı bölümlere dağılmış mı? Değilse yapı güvenilmez.
  const bolumKelimeleri = doluBolumler.reduce((t, b) => t + b.kelimeSayisi, 0);
  const yapiGuvenilir =
    doluBolumler.length >= 3 && bolumKelimeleri >= belge.kelimeSayisi * 0.5;

  const tam = yapiGuvenilir
    ? doluBolumler.map((b) => `## ${b.baslik.metin}\n${b.govde.trim()}`).join('\n\n')
    : `[Bölüm yapısı güvenilir biçimde ayrıştırılamadı — raporun tam metni]\n\n${belge.metin}`;

  return tam.length <= azamiKarakter ? tam : `${tam.slice(0, azamiKarakter)}\n[…rapor kısaltıldı]`;
}

/**
 * Şablon uyum durumunu modele anlatır.
 *
 * Rapor şablona uymuyorsa model bunu bilmeli: beklenen başlığı arayıp
 * bulamayınca "yok" demek yerine, içeriğin başka bir başlık altında ya da
 * hiç başlıksız yazılmış olabileceğini hesaba katmalı.
 */
function uyumMetni(uyum?: SablonUyumu): string {
  if (!uyum) return '';

  const satirlar: string[] = ['\n# Şablon uyum durumu'];

  if (uyum.eksikBolumler.length) {
    satirlar.push(
      `Şablonun beklediği şu bölümler başlık olarak BULUNAMADI: ` +
        `${uyum.eksikBolumler.join(', ')}.`,
      'Bu, içeriğin raporda hiç olmadığı anlamına GELMEZ. Yarışmacı şablonu ' +
        'değiştirmiş, başlığı farklı adlandırmış veya içeriği başka bir bölümün ' +
        'içine yazmış olabilir. İlgili kriteri değerlendirirken içeriği raporun ' +
        'BÜTÜNÜNDE ara; gerçekten yoksa o zaman yok de.',
    );
  }

  if (uyum.fazlaBolumler.length) {
    satirlar.push(
      `Şablonda olmayan şu başlıklar raporda var: ${uyum.fazlaBolumler.join(', ')}. ` +
        'Bunların içeriği beklenen kriterlerden birine karşılık gelebilir.',
    );
  }

  if (uyum.sablonSkoru !== undefined) {
    satirlar.push(
      `Şablon örtüşme oranı: %${Math.round(uyum.sablonSkoru * 100)}.` +
        (uyum.sablonSkoru < 0.6
          ? ' Bu düşük bir oran; rapor büyük ölçüde kendi düzeninde yazılmış. ' +
            'Başlıklara değil içeriğe bak.'
          : ''),
    );
  }

  return satirlar.length > 1 ? satirlar.join('\n') : '';
}

/**
 * Modelin verdiği alıntıyı belgede bulup sayfa numarasını çözer.
 * Claude'un citations özelliğine para ödemeye gerek yok — satır → sayfa
 * eşlemesi zaten elimizde.
 */
function sayfaCoz(belge: Belge, alinti: string): number | undefined {
  const hedef = anahtar(alinti).slice(0, 60);
  if (hedef.length < 12) return undefined;

  let enIyiSayfa: number | undefined;
  let enIyiOran = 0;

  for (const satir of belge.satirlar) {
    if (satir.yinelenen || !satir.sayfa) continue;
    const s = anahtar(satir.metin);
    if (!s) continue;

    // Önce doğrudan içerme; olmazsa bulanık karşılaştırma.
    if (s.includes(hedef)) return satir.sayfa;
    const oran = benzerlik(hedef, s.slice(0, 60));
    if (oran > enIyiOran) {
      enIyiOran = oran;
      enIyiSayfa = satir.sayfa;
    }
  }
  return enIyiOran >= 0.6 ? enIyiSayfa : undefined;
}

function rubrikMetni(rubrik: Rubrik): string {
  return rubrik.kriterler
    .map((k) => {
      const olcut = k.olcut.length
        ? k.olcut.map((o) => `   - ${o}`).join('\n')
        : '   - (Şablon ayrıntılı ölçüt vermemiş; başlığın gerektirdiği içeriği ara.)';
      return `### ${k.ad}\nkod: ${k.kod}   azami: ${k.puan} puan\nŞablonun bu bölümden beklediği:\n${olcut}`;
    })
    .join('\n\n');
}

// ------------------------------------------------------------ ana akış

export interface DegerlendirmeSecenekleri {
  istemci?: ClaudeIstemcisi;
  /** Rapordan çıkarılmış şekiller. Verilirse model çizimleri de görür. */
  sekiller?: CikarilanSekil[];
  /** Şablon uyum durumu — uymayan raporda modelin körlüğünü engeller. */
  uyum?: SablonUyumu;
  /**
   * Şartname özeti. Kurulumda bir kez üretilir, her raporda bedava kullanılır.
   * Şablon "raporu nasıl yaz" der; şartname "yarışma ne istiyor" der —
   * özgünlük ve uygulanabilirlik gibi kriterler ancak bununla doğru puanlanır.
   */
  sartnameOzeti?: SartnameOzeti;
  /** Düşünme derinliği. Düşük efor çıktı token'ını, dolayısıyla maliyeti düşürür. */
  efor?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  /** Çıktı üst sınırı. Kriter sayısı arttıkça yükseltilmeli. */
  azamiCikti?: number;
}

export async function raporuDegerlendir(
  belge: Belge,
  rubrik: Rubrik,
  secenekler: DegerlendirmeSecenekleri = {},
): Promise<Degerlendirme> {
  const baslangic = Date.now();
  const istemci = secenekler.istemci ?? new ClaudeIstemcisi();
  const efor = secenekler.efor ?? 'medium';
  const sekiller = secenekler.sekiller ?? [];

  // Kriter başına ~700 token çıktı + düşünme payı.
  const azamiCikti = secenekler.azamiCikti ?? Math.min(32_000, 3_000 + rubrik.kriterler.length * 1_200);

  // Metin ve şekiller tek mesajda. Şekiller nereye ait olduğu söylenerek
  // veriliyor; yoksa model hangi bölümü değerlendirdiğini bilemez.
  type Blok =
    | { type: 'text'; text: string }
    | { type: 'image'; source: { type: 'base64'; media_type: 'image/png'; data: string } };

  const icerik: Blok[] = [
    {
      type: 'text',
      text:
        `# Değerlendirme kriterleri\n\n${rubrikMetni(rubrik)}\n\n` +
        `# Rapor metni\n\n${raporMetni(belge)}`,
    },
  ];

  if (sekiller.length) {
    icerik.push({
      type: 'text',
      text:
        `\n# Rapordaki şekiller (${sekiller.length})\n` +
        'Aşağıdaki görseller raporun kendi şekilleridir. Her birinin hangi ' +
        'sayfada ve hangi bölümde olduğu belirtilmiştir.',
    });

    for (const s of sekiller) {
      icerik.push({
        type: 'text',
        text:
          `\n## Şekil — s.${s.sayfa}` +
          (s.bolum ? ` · bölüm: ${s.bolum}` : '') +
          (s.altYazi ? `\naltyazı: ${s.altYazi}` : ''),
      });
      icerik.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: s.png },
      });
    }
  }

  icerik.push({
    type: 'text',
    text:
      '\n# Görev\n' +
      'Her kriter için puan öner. Kriterleri yukarıdaki sırayla ve ' +
      'birbirinden bağımsız değerlendir — bir kriterdeki eksiklik ' +
      'diğerinin puanını etkilemesin.\n' +
      'Alıntıları rapordan birebir kopyala; kısaltma veya düzeltme yapma. ' +
      'Bir bölümün içeriği şekilde ise alıntı yerine şekli tarif et ve ' +
      'hangi sayfadaki şekil olduğunu belirt.',
  });

  const { veri, kullanim } = await istemci.cagirYapilandirilmis<Cikti>({
    model: MODEL,
    max_tokens: azamiCikti,
    system: SISTEM,
    thinking: { type: 'adaptive' },
    output_config: { effort: efor, format: jsonSchemaOutputFormat(SEMA) },
    messages: [{ role: 'user', content: icerik }],
  });

  const kriterler: KriterDegerlendirmesi[] = rubrik.kriterler.map((k) => {
    const p = veri?.kriterler.find((x) => x.kod === k.kod);

    if (!p) {
      // Model bu kriteri döndürmediyse puan uydurmuyoruz.
      return {
        kod: k.kod, ad: k.ad, azamiPuan: k.puan,
        aiPuan: 0, guven: 'dusuk',
        gerekce: 'Bu kriter için değerlendirme üretilemedi.',
        gucluYonler: [], gelisimAlanlari: [], oneri: '', kanitlar: [],
        hakemIncelemesiGerekli: true,
      };
    }

    return {
      kod: k.kod,
      ad: k.ad,
      azamiPuan: k.puan,
      aiPuan: Math.max(0, Math.min(k.puan, p.puan)),
      guven: p.guven,
      gerekce: p.gerekce,
      gucluYonler: p.gucluYonler,
      gelisimAlanlari: p.gelisimAlanlari,
      oneri: p.oneri,
      kanitlar: p.alintilar.slice(0, 3).map((a) => ({
        alinti: a.replace(/\s+/g, ' ').trim().slice(0, 300),
        sayfa: sayfaCoz(belge, a),
      })),
      hakemIncelemesiGerekli: p.hakemIncelemesiGerekli || p.guven === 'dusuk',
    };
  });

  return {
    kriterler,
    aiToplam: kriterler.reduce((t, k) => t + k.aiPuan, 0),
    azamiToplam: rubrik.toplamPuan,
    genelGucluYonler: veri?.genelGucluYonler ?? [],
    genelGelisimAlanlari: veri?.genelGelisimAlanlari ?? [],
    // Sayfa numarası kendi satır dizinimizden çözülür; modelin verdiğine güvenilmez.
    sartnameIhlalleri: (veri?.sartnameIhlalleri ?? []).map((i) => ({
      kisit: i.kisit,
      guven: i.guven,
      kanit: {
        alinti: i.alinti.replace(/\s+/g, ' ').trim().slice(0, 300),
        sayfa: sayfaCoz(belge, i.alinti),
      },
    })),
    kullanim: kullanimTopla([kullanim]),
    sureMs: Date.now() - baslangic,
    incelemeGereken: kriterler.filter((k) => k.hakemIncelemesiGerekli).length,
  };
}
