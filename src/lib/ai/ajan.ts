import type Anthropic from '@anthropic-ai/sdk';
import {
  ButceAsimiHatasi, kullanimTopla, MODEL, type Kullanim,
} from './istemci';

/**
 * Ajan çalışma zamanı — modelin alet seçtiği döngü.
 *
 * ── TEK ÇAĞRIDAN FARKI ──────────────────────────────────────────────────
 * Sistemin geri kalanı tek çağrı kullanıyor: istem gider, yapılandırılmış
 * cevap gelir. Bu doğru seçim, çünkü oralarda ADIMLARIN SIRASI ÖNCEDEN
 * BELLİ — rapor okunur, rubriğe göre puanlanır, biter.
 *
 * Ajan yalnızca sıranın önceden bilinmediği yerde anlamlı. Bir künyeyi
 * doğrularken kaç adım gerekeceği künyeye bağlı: DOI varsa tek sorgu
 * yeter, yoksa başlıkla aranır, o da tutmazsa başlık sadeleştirilip
 * yeniden aranır, hâlâ yoksa bunun bir standart mı yoksa uydurma mı
 * olduğuna karar vermek gerekir. Bu yolu önceden kodlamak, olası bütün
 * künye biçimlerini önceden bilmek demekti.
 *
 * ── BÜTÇE DÖNGÜNÜN İÇİNDE KORUNUYOR ─────────────────────────────────────
 * Her tur `istemci.cagir()` üzerinden geçiyor; tavan kontrolü ve maliyet
 * sayacı orada. SDK'nın kendi `toolRunner`'ı kullanılsaydı döngü
 * kütüphanenin içinde koşardı ve tavan yalnızca döngü BİTTİKTEN sonra
 * bakılabilirdi — on beş turluk bir kaçak, sınır aşıldıktan çok sonra
 * fark edilirdi. Sekiz dolarlık bir tavanda bunun bedeli gerçek.
 *
 * Bütçe döngünün ortasında biterse iş yarıda kalıyor ama ELDEKİ İZ
 * dönüyor: yarım bir soruşturma, hiç soruşturma olmamasından iyidir ve
 * ekranda "bütçe bitti" diye görünmesi sessiz bir başarısızlıktan iyidir.
 *
 * ── TUR SINIRI ──────────────────────────────────────────────────────────
 * Kararsız bir model aynı aleti tekrar tekrar çağırabiliyor. Sınır olmasa
 * bu döngü ancak bütçe bitince durur. Sınır, bütçeden ÖNCE devreye giren
 * ucuz koruma.
 *
 * ── KARAR NİYE ALETLE BİLDİRİLİYOR ──────────────────────────────────────
 * Ajan işini bitirdiğinde serbest metin yazsaydı onu ayrıştırmak
 * gerekirdi ve ayrıştırma her zaman bir gün bozulur. Bunun yerine bir
 * bitiş aleti veriliyor: şeması sonucun şeması. Model onu çağırdığında
 * döngü duruyor ve `input` doğrudan sonuç oluyor.
 */

/**
 * Ajanın istemciden ihtiyacı olan TEK ŞEY.
 *
 * `ClaudeIstemcisi` sınıfının tamamına bağlanmak yerine bu dar yüze
 * bağlanıyor: döngü, önbellek ve bütçe mekanizmasının nasıl çalıştığını
 * bilmek zorunda değil. Yan faydası asıl fayda: döngü mantığı — tur
 * sınırı, bütçe kesintisi, alet hatasından toparlanma — sahte bir
 * istemciyle, TEK KURUŞ HARCAMADAN sınanabiliyor. Gerçek çağrıyla
 * sınanabilen bir döngü, pratikte hiç sınanmayan bir döngüdür.
 */
export interface AjanIstemcisi {
  cagir(
    govde: Anthropic.MessageCreateParamsNonStreaming,
  ): Promise<{ yanit: Anthropic.Message; kullanim: Kullanim }>;
}

export interface AletSonucu {
  /** Modele dönecek içerik. */
  icerik: unknown;
  /** İz satırı — kullanıcı bunu okuyacak. */
  ozet: string;
  /** Alet çalışamadıysa true; model başka bir yol denemeli. */
  hataMi?: boolean;
}

export interface Alet {
  ad: string;
  aciklama: string;
  /** JSON Şeması. Zod eklemiyoruz: tek özellik için bağımlılık olmaz. */
  sema: Anthropic.Tool.InputSchema;
  calistir(girdi: Record<string, unknown>): Promise<AletSonucu>;
}

export interface Adim {
  sira: number;
  alet: string;
  girdi: Record<string, unknown>;
  ozet: string;
  hataMi: boolean;
  ms: number;
}

export type AjanDurumu = 'tamam' | 'tur_siniri' | 'butce' | 'hata';

export interface AjanSonucu<T> {
  karar: T | null;
  adimlar: Adim[];
  kullanim: Kullanim;
  durum: AjanDurumu;
  turSayisi: number;
  hata?: string;
}

export interface AjanSecenekleri {
  istemci: AjanIstemcisi;
  sistem: string;
  gorev: string;
  aletler: Alet[];
  bitirAleti: { ad: string; aciklama: string; sema: Anthropic.Tool.InputSchema };
  enFazlaTur?: number;
  turBasinaToken?: number;
}

/*
 * Alet çıktısı modele token olarak gidiyor ve her turda BİRİKİYOR: onuncu
 * turda ilk dokuz turun çıktısı hâlâ istemin içinde. Sınırsız bırakılırsa
 * uzun bir belge tek başına bütçeyi tüketir.
 */
const ALET_CIKTI_SINIRI = 6000;

function kirp(deger: unknown): string {
  const metin = typeof deger === 'string' ? deger : JSON.stringify(deger);
  if (metin.length <= ALET_CIKTI_SINIRI) return metin;
  return `${metin.slice(0, ALET_CIKTI_SINIRI)}\n…[${metin.length - ALET_CIKTI_SINIRI} karakter kırpıldı]`;
}

export async function ajaniCalistir<T>(
  s: AjanSecenekleri,
): Promise<AjanSonucu<T>> {
  const enFazlaTur = s.enFazlaTur ?? 14;
  const adimlar: Adim[] = [];
  const kullanimlar: Kullanim[] = [];

  const aletHaritasi = new Map(s.aletler.map((a) => [a.ad, a]));

  const aletTanimlari: Anthropic.Tool[] = [
    ...s.aletler.map((a) => ({
      name: a.ad,
      description: a.aciklama,
      input_schema: a.sema,
    })),
    {
      name: s.bitirAleti.ad,
      description: s.bitirAleti.aciklama,
      input_schema: s.bitirAleti.sema,
    },
  ];

  const mesajlar: Anthropic.MessageParam[] = [
    { role: 'user', content: s.gorev },
  ];

  let durtuldu = false;

  for (let tur = 1; tur <= enFazlaTur; tur++) {
    let yanit: Anthropic.Message;
    try {
      const cagri = await s.istemci.cagir({
        model: MODEL,
        max_tokens: s.turBasinaToken ?? 2000,
        /*
         * Sistem istemi ve alet tanımları HER TURDA yeniden gönderiliyor.
         * `cache_control` ile bu sabit önek sunucuda önbelleğe alınıyor;
         * ikinci turdan itibaren aynı token'lar onda bir fiyatına
         * okunuyor. On dört turluk bir döngüde fark küçük değil.
         */
        system: [{ type: 'text', text: s.sistem, cache_control: { type: 'ephemeral' } }],
        tools: aletTanimlari,
        messages: mesajlar,
      });
      yanit = cagri.yanit;
      kullanimlar.push(cagri.kullanim);
    } catch (e) {
      if (e instanceof ButceAsimiHatasi) {
        return {
          karar: null, adimlar, kullanim: kullanimTopla(kullanimlar),
          durum: 'butce', turSayisi: tur - 1, hata: e.message,
        };
      }
      return {
        karar: null, adimlar, kullanim: kullanimTopla(kullanimlar),
        durum: 'hata', turSayisi: tur - 1,
        hata: e instanceof Error ? e.message : String(e),
      };
    }

    const cagrilar = yanit.content.filter(
      (p): p is Anthropic.ToolUseBlock => p.type === 'tool_use',
    );

    if (!cagrilar.length) {
      /*
       * Model alet çağırmadan konuştu. Bir kez dürtülüyor: bazen
       * gerçekten bitirmiş ama bitiş aletini çağırmayı atlamış oluyor.
       * İkinci kez olursa döngü kapanıyor — sonsuza kadar dürtmek,
       * konuşmayı uzatarak para harcamaktan başka bir şey yapmaz.
       */
      if (durtuldu) {
        return {
          karar: null, adimlar, kullanim: kullanimTopla(kullanimlar),
          durum: 'hata', turSayisi: tur,
          hata: 'Ajan kararını bildirmeden durdu.',
        };
      }
      durtuldu = true;
      mesajlar.push(
        { role: 'assistant', content: yanit.content },
        {
          role: 'user',
          content:
            `Kararını ${s.bitirAleti.ad} aletiyle bildir. Elindeki bilgi `
            + 'yetersizse de bildir; emin olmadığın yeri gerekçende söyle.',
        },
      );
      continue;
    }

    // Bitiş aleti çağrıldıysa döngü burada kapanıyor.
    const bitis = cagrilar.find((c) => c.name === s.bitirAleti.ad);
    if (bitis) {
      return {
        karar: bitis.input as T,
        adimlar,
        kullanim: kullanimTopla(kullanimlar),
        durum: 'tamam',
        turSayisi: tur,
      };
    }

    const sonuclar: Anthropic.ToolResultBlockParam[] = [];
    for (const c of cagrilar) {
      const alet = aletHaritasi.get(c.name);
      const girdi = (c.input ?? {}) as Record<string, unknown>;
      const t0 = Date.now();

      if (!alet) {
        sonuclar.push({
          type: 'tool_result', tool_use_id: c.id, is_error: true,
          content: `Böyle bir alet yok: ${c.name}`,
        });
        continue;
      }

      let sonuc: AletSonucu;
      try {
        sonuc = await alet.calistir(girdi);
      } catch (e) {
        /*
         * ALET HATASI FIRLATILMIYOR, MODELE DÖNÜYOR.
         * Ağ hatası alan bir ajan başka bir kaynağa geçebilmeli. Hatayı
         * yukarı fırlatmak, kurtarılabilir bir durumu soruşturmanın
         * sonuna çevirirdi.
         */
        sonuc = {
          icerik: `Alet hatası: ${e instanceof Error ? e.message : String(e)}`,
          ozet: `${alet.ad} çalışmadı`,
          hataMi: true,
        };
      }

      adimlar.push({
        sira: adimlar.length + 1,
        alet: alet.ad,
        girdi,
        ozet: sonuc.ozet,
        hataMi: !!sonuc.hataMi,
        ms: Date.now() - t0,
      });

      sonuclar.push({
        type: 'tool_result',
        tool_use_id: c.id,
        is_error: sonuc.hataMi,
        content: kirp(sonuc.icerik),
      });
    }

    mesajlar.push(
      { role: 'assistant', content: yanit.content },
      { role: 'user', content: sonuclar },
    );
  }

  return {
    karar: null,
    adimlar,
    kullanim: kullanimTopla(kullanimlar),
    durum: 'tur_siniri',
    turSayisi: enFazlaTur,
  };
}
