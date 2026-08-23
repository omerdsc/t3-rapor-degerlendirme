/**
 * Şartname özetleyici — kurulumda BİR KEZ çalışır.
 *
 * MALİYET GEREKÇESİ
 * Şartname 20–50 sayfa olabilir. Her rapor değerlendirmesinde tamamını modele
 * göndermek rapor başına ~$0.15 ekstra demek:
 *
 *     100 rapor × $0.15                        = $15.00
 *     kurulumda bir kez özet + 100 rapor × $0  =  $0.15  (ölçülen)
 *
 * Özet kategoriye kaydedilir, her değerlendirmede yeniden kullanılır.
 *
 * ── ÖZET NEDEN DAR TUTULUYOR ────────────────────────────────────────────
 * İlk sürüm şartnamedeki her teknik ayrıntıyı çıkarıyordu: sınıf ID'leri,
 * JSON alan adları, oturum süreleri, ödül kategorileri. Bunlar doğru bilgi
 * ama RAPORDAN PUANLANAMAZ — hakem raporu okuyor, sistemi çalıştırmıyor.
 * Rubriğe girmeyen her madde modelin dikkatini dağıtır ve token yakar.
 *
 * Ölçüt şu: bir madde ancak "rapora bakarak bunun karşılandığını söyleyebilir
 * miyim?" sorusuna evet cevabı veriyorsa özete girer.
 */

import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema';
import { ClaudeIstemcisi, MODEL, type Kullanim } from './istemci';

export interface SartnameOzeti {
  /** Yarışmanın teknik hedefi — en fazla 4 madde. */
  yarismaninAmaci: string[];
  /**
   * Rapordan değerlendirilebilecek beklentiler — en fazla 6 madde.
   * Çalışma zamanı ayrıntıları (protokol, format, süre) buraya girmez.
   */
  teknikBeklentiler: string[];
  /**
   * Tasarımı geçersiz kılan katı kısıtlar. En değerli alan:
   * "çözüm çevrim dışı çalışmak zorunda, bulut tabanlı tasarım kural ihlali"
   * gibi bir kısıt, raporun mimarisini doğrudan geçersiz kılabilir.
   */
  katiKisitlar: string[];
  /** Raporu doğrudan eleyen durumlar — en fazla 6 madde. */
  eleyiciDurumlar: string[];
  /** Hakemin puanlarken bilmesi gerekenler — en fazla 5 madde. */
  hakemNotlari: string[];
}

const SEMA = {
  type: 'object',
  properties: {
    yarismaninAmaci: {
      type: 'array',
      items: { type: 'string' },
      description: 'Yarışmanın teknik hedefi, en fazla 4 kısa madde',
    },
    teknikBeklentiler: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Rapora bakarak karşılandığı söylenebilecek beklentiler, en fazla 6 madde',
    },
    katiKisitlar: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Uyulmadığında tasarımı geçersiz kılan kısıtlar, en fazla 5 madde',
    },
    eleyiciDurumlar: {
      type: 'array',
      items: { type: 'string' },
      description: 'Raporu/başvuruyu eleyen durumlar, en fazla 6 madde',
    },
    hakemNotlari: {
      type: 'array',
      items: { type: 'string' },
      description: 'Puanlarken bilinmesi gerekenler, en fazla 5 madde',
    },
  },
  required: [
    'yarismaninAmaci', 'teknikBeklentiler', 'katiKisitlar',
    'eleyiciDurumlar', 'hakemNotlari',
  ],
  additionalProperties: false,
} as const;

const SISTEM = `Sen bir yarışma şartnamesini, PROJE RAPORLARINI puanlayacak
hakemler için özetliyorsun.

TEK ÖLÇÜT: Bir madde ancak şu soruya "evet" cevabı veriyorsa özete girer —
"Rapora bakarak bunun karşılandığını söyleyebilir miyim?"

Özete GİRER:
- Yarışmanın teknik olarak ne istediği
- Raporda aranacak yaklaşım ve yetenekler
- Tasarımı geçersiz kılan katı kısıtlar (ör. "çözüm çevrim dışı çalışmalı")
- Raporu veya başvuruyu eleyen durumlar
- Puanlamayı etkileyen eşikler ve kurallar

Özete GİRMEZ — bunlar doğru bilgi olsa da rapordan puanlanamaz:
- Veri formatı ayrıntıları (JSON alan adları, sınıf ID değerleri, etiket kodları)
- Oturum/yarışma günü işleyişi (süreler, bağlantı, sunucu protokolü)
- Ödüller, ödül kategorileri, mansiyon
- Başvuru tarihleri ve usulü, iletişim, ulaşım, konaklama
- Sunum/beden dili gibi rapor dışı değerlendirme kalemleri

Az ve keskin yaz. Her listede belirtilen üst sınırı aşma; emin olmadığın
maddeyi hiç yazma. Şartnamede olmayanı ekleme; bilgi yoksa listeyi boş bırak.
Türkçe, tek cümlelik maddeler.`;

export interface OzetSecenekleri {
  istemci?: ClaudeIstemcisi;
  /** Uzun şartnamede metnin kaç karakteri gönderilsin. */
  azamiKarakter?: number;
}

export async function sartnameOzetle(
  sartnameMetni: string,
  yarismaAdi: string,
  secenekler: OzetSecenekleri = {},
): Promise<{ ozet: SartnameOzeti | null; kullanim: Kullanim }> {
  const istemci = secenekler.istemci ?? new ClaudeIstemcisi();
  const azami = secenekler.azamiKarakter ?? 60_000;

  const metin =
    sartnameMetni.length <= azami
      ? sartnameMetni
      : `${sartnameMetni.slice(0, azami)}\n[…şartname kısaltıldı]`;

  const { veri, kullanim } = await istemci.cagirYapilandirilmis<SartnameOzeti>({
    model: MODEL,
    // Dar özet; çıktı sınırı da dar tutuluyor.
    max_tokens: 4000,
    system: SISTEM,
    thinking: { type: 'adaptive' },
    // Tek seferlik çağrı; kaliteden kısmaya gerek yok.
    output_config: { effort: 'high', format: jsonSchemaOutputFormat(SEMA) },
    messages: [
      {
        role: 'user',
        content:
          `# Yarışma\n${yarismaAdi}\n\n# Şartname\n\n${metin}\n\n` +
          '# Görev\nBu şartnameyi, proje raporlarını puanlayacak hakemler için ' +
          'özetle. Yalnızca rapora bakarak değerlendirilebilecek maddeleri yaz.',
      },
    ],
  });

  return { ozet: veri, kullanim };
}

/** Özeti değerlendirme isteminde kullanılacak metne çevirir. */
export function ozetiMetneCevir(ozet: SartnameOzeti | undefined): string {
  if (!ozet) return '';

  const bolum = (baslik: string, satirlar: string[]) =>
    satirlar.length ? `\n### ${baslik}\n${satirlar.map((s) => `- ${s}`).join('\n')}` : '';

  const govde = [
    bolum('Yarışmanın amacı', ozet.yarismaninAmaci),
    bolum('Teknik beklentiler', ozet.teknikBeklentiler),
    // Katı kısıtlar önce gelir: bir raporun mimarisini geçersiz kılabilirler.
    bolum('Katı kısıtlar — uyulmazsa tasarım geçersiz', ozet.katiKisitlar),
    bolum('Eleyici durumlar', ozet.eleyiciDurumlar),
    bolum('Hakem için notlar', ozet.hakemNotlari),
  ].join('');

  return govde ? `\n# Şartname özeti\n${govde}` : '';
}
