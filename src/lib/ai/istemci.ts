/**
 * Claude istemcisi — maliyet takibi, önbellek ve bütçe koruması.
 *
 * Projenin tek ücretli parçası burası. Üç koruma katmanı var:
 *
 *   1. YANIT ÖNBELLEĞİ  — aynı rapor + aynı istem ikinci kez API'ye gitmez.
 *      Arayüz geliştirirken aynı değerlendirmeyi yüzlerce kez görüyoruz;
 *      bu katman olmasa bütçe ilk günde biterdi.
 *   2. PROMPT CACHE     — rapor bir kez cache'lenir, sonraki kriter geçişleri
 *      taban girdi fiyatının onda birine okur.
 *   3. BÜTÇE TAVANI     — tanımlı tavan aşılırsa istemci çağrı yapmayı
 *      reddeder. Kaza eseri harcama olmaz.
 *
 * Her çağrının token kullanımı ve maliyeti kaydedilir; yönetim panosunda
 * "rapor başına $X" olarak görünür.
 */

import Anthropic from '@anthropic-ai/sdk';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Fiyatlar USD / milyon token (Claude Opus 5). */
const FIYAT = {
  girdi: 5,
  cikti: 25,
  /** Cache yazma primi: 5 dakikalık TTL için 1.25×. */
  cacheYazmaCarpani: 1.25,
  /** Cache okuma: taban girdi fiyatının 0.1'i. */
  cacheOkumaCarpani: 0.1,
} as const;

export const MODEL = 'claude-opus-5';

export interface Kullanim {
  girdiToken: number;
  ciktiToken: number;
  cacheYazma: number;
  cacheOkuma: number;
  maliyet: number;
  onbellektenMi: boolean;
}

export interface IstemciSecenekleri {
  apiAnahtari?: string;
  /** Toplam harcama tavanı (USD). Aşılırsa çağrı reddedilir. */
  toplamTavan?: number;
  /** Yanıt önbelleği. Dışarıdan verilirse oturumlar arası paylaşılabilir. */
  onbellek?: Map<string, unknown>;
  /** Önbelleği tamamen atla — ölçüm koşuları için. */
  onbellegiAtla?: boolean;
  /**
   * Önbelleği diske yazacak klasör. Belirtilirse yanıtlar süreçler arası
   * korunur — betiği ikinci kez çalıştırmak para harcamaz. Geliştirme
   * sırasında bütçenin en büyük koruması budur.
   */
  diskOnbellegi?: string;
}

/** Kalıcı önbellek: her yanıt ayrı dosya, anahtar dosya adı. */
class DiskOnbellek {
  constructor(private readonly klasor: string) {
    mkdirSync(klasor, { recursive: true });
  }
  private yol(anahtar: string) {
    return join(this.klasor, `${anahtar.slice(0, 32)}.json`);
  }
  oku(anahtar: string): unknown | undefined {
    const y = this.yol(anahtar);
    if (!existsSync(y)) return undefined;
    try {
      return JSON.parse(readFileSync(y, 'utf-8'));
    } catch {
      return undefined;
    }
  }
  yaz(anahtar: string, deger: unknown): void {
    try {
      writeFileSync(this.yol(anahtar), JSON.stringify(deger), 'utf-8');
    } catch {
      // Disk yazılamazsa bellek önbelleği yine çalışır.
    }
  }
}

export class ButceAsimiHatasi extends Error {
  constructor(harcanan: number, tavan: number) {
    super(
      `Bütçe tavanı aşıldı: $${harcanan.toFixed(2)} / $${tavan.toFixed(2)}. ` +
        'Çağrı yapılmadı.',
    );
    this.name = 'ButceAsimiHatasi';
  }
}

export class ClaudeIstemcisi {
  private readonly istemci: Anthropic;
  private readonly onbellek: Map<string, unknown>;
  private readonly disk: DiskOnbellek | null;
  private readonly toplamTavan: number;
  private readonly onbellegiAtla: boolean;

  private harcanan = 0;
  private cagriSayisi = 0;
  private onbellekIsabeti = 0;

  constructor(secenekler: IstemciSecenekleri = {}) {
    // Anahtar verilmezse SDK ortamdan okur (ANTHROPIC_API_KEY).
    this.istemci = secenekler.apiAnahtari
      ? new Anthropic({ apiKey: secenekler.apiAnahtari })
      : new Anthropic();
    this.onbellek = secenekler.onbellek ?? new Map();
    this.disk = secenekler.diskOnbellegi ? new DiskOnbellek(secenekler.diskOnbellegi) : null;
    this.toplamTavan = secenekler.toplamTavan ?? Number(process.env.TOPLAM_TAVAN ?? 8);
    this.onbellegiAtla = secenekler.onbellegiAtla ?? false;
  }

  get maliyet(): number {
    return this.harcanan;
  }
  get istatistik() {
    return {
      maliyet: this.harcanan,
      cagriSayisi: this.cagriSayisi,
      onbellekIsabeti: this.onbellekIsabeti,
      kalanButce: Math.max(0, this.toplamTavan - this.harcanan),
    };
  }

  /**
   * Bir istek gövdesini önbellek anahtarına çevirir. Model, sistem istemi ve
   * mesajların tamamı anahtara girer; birinin değişmesi yeni çağrı demektir.
   */
  private anahtar(gövde: unknown): string {
    return createHash('sha256').update(JSON.stringify(gövde)).digest('hex');
  }

  private onbellektenAl(anahtar: string): unknown | undefined {
    if (this.onbellegiAtla) return undefined;
    if (this.onbellek.has(anahtar)) return this.onbellek.get(anahtar);
    const diskten = this.disk?.oku(anahtar);
    if (diskten !== undefined) this.onbellek.set(anahtar, diskten);
    return diskten;
  }

  private onbellegeYaz(anahtar: string, deger: unknown): void {
    this.onbellek.set(anahtar, deger);
    this.disk?.yaz(anahtar, deger);
  }

  private maliyetHesapla(u: Anthropic.Usage): number {
    const girdi = u.input_tokens ?? 0;
    const cikti = u.output_tokens ?? 0;
    const yazma = u.cache_creation_input_tokens ?? 0;
    const okuma = u.cache_read_input_tokens ?? 0;
    return (
      (girdi * FIYAT.girdi +
        yazma * FIYAT.girdi * FIYAT.cacheYazmaCarpani +
        okuma * FIYAT.girdi * FIYAT.cacheOkumaCarpani +
        cikti * FIYAT.cikti) /
      1_000_000
    );
  }

  /** Ham mesaj çağrısı. Önbellek ve bütçe kontrolü buradan geçer. */
  async cagir(
    gövde: Anthropic.MessageCreateParamsNonStreaming,
  ): Promise<{ yanit: Anthropic.Message; kullanim: Kullanim }> {
    const anah = this.anahtar(gövde);

    const saklanan = this.onbellektenAl(anah);
    if (saklanan !== undefined) {
      this.onbellekIsabeti++;
      const yanit = saklanan as Anthropic.Message;
      return {
        yanit,
        kullanim: {
          girdiToken: 0, ciktiToken: 0, cacheYazma: 0, cacheOkuma: 0,
          maliyet: 0, onbellektenMi: true,
        },
      };
    }

    if (this.harcanan >= this.toplamTavan) {
      throw new ButceAsimiHatasi(this.harcanan, this.toplamTavan);
    }

    const yanit = await this.istemci.messages.create(gövde);
    const maliyet = this.maliyetHesapla(yanit.usage);

    this.harcanan += maliyet;
    this.cagriSayisi++;
    this.onbellegeYaz(anah, yanit);

    return {
      yanit,
      kullanim: {
        girdiToken: yanit.usage.input_tokens ?? 0,
        ciktiToken: yanit.usage.output_tokens ?? 0,
        cacheYazma: yanit.usage.cache_creation_input_tokens ?? 0,
        cacheOkuma: yanit.usage.cache_read_input_tokens ?? 0,
        maliyet,
        onbellektenMi: false,
      },
    };
  }

  /**
   * Yapılandırılmış çıktı çağrısı. `parse()` şemaya göre doğrular; model
   * uymayan çıktı verirse SDK yeniden dener.
   */
  async cagirYapilandirilmis<T>(
    gövde: Parameters<Anthropic['messages']['parse']>[0],
  ): Promise<{ veri: T | null; kullanim: Kullanim }> {
    const anah = this.anahtar(gövde);

    const saklanan = this.onbellektenAl(anah);
    if (saklanan !== undefined) {
      this.onbellekIsabeti++;
      return {
        veri: saklanan as T,
        kullanim: {
          girdiToken: 0, ciktiToken: 0, cacheYazma: 0, cacheOkuma: 0,
          maliyet: 0, onbellektenMi: true,
        },
      };
    }

    if (this.harcanan >= this.toplamTavan) {
      throw new ButceAsimiHatasi(this.harcanan, this.toplamTavan);
    }

    const yanit = await this.istemci.messages.parse(gövde);
    const maliyet = this.maliyetHesapla(yanit.usage);

    this.harcanan += maliyet;
    this.cagriSayisi++;

    const veri = (yanit.parsed_output ?? null) as T | null;
    if (veri !== null) this.onbellegeYaz(anah, veri);

    return {
      veri,
      kullanim: {
        girdiToken: yanit.usage.input_tokens ?? 0,
        ciktiToken: yanit.usage.output_tokens ?? 0,
        cacheYazma: yanit.usage.cache_creation_input_tokens ?? 0,
        cacheOkuma: yanit.usage.cache_read_input_tokens ?? 0,
        maliyet,
        onbellektenMi: false,
      },
    };
  }
}

/** Birden çok kullanımı toplar. */
export function kullanimTopla(kullanimlar: Kullanim[]): Kullanim {
  return kullanimlar.reduce<Kullanim>(
    (t, k) => ({
      girdiToken: t.girdiToken + k.girdiToken,
      ciktiToken: t.ciktiToken + k.ciktiToken,
      cacheYazma: t.cacheYazma + k.cacheYazma,
      cacheOkuma: t.cacheOkuma + k.cacheOkuma,
      maliyet: t.maliyet + k.maliyet,
      onbellektenMi: t.onbellektenMi && k.onbellektenMi,
    }),
    { girdiToken: 0, ciktiToken: 0, cacheYazma: 0, cacheOkuma: 0, maliyet: 0, onbellektenMi: true },
  );
}
