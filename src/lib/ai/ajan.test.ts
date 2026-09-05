import assert from 'node:assert/strict';
import test from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';
import { ajaniCalistir, type AjanIstemcisi, type Alet } from './ajan';
import { ButceAsimiHatasi, type Kullanim } from './istemci';

/*
 * Bu dosyanın tamamı SAHTE istemciyle koşuyor: ağa çıkmıyor, para
 * harcamıyor. Ajan döngüsünün asıl riskleri — sonsuz döngü, bütçe
 * kaçağı, alet hatasında çökme — ancak böyle sınanabilir; gerçek çağrı
 * gerektiren bir sınama, pratikte hiç koşmayan bir sınamadır.
 */

const BOS_KULLANIM: Kullanim = {
  girdiToken: 10, ciktiToken: 5, cacheYazma: 0, cacheOkuma: 0,
  maliyet: 0.001, onbellektenMi: false,
};

function yanit(icerik: Anthropic.ContentBlock[]): Anthropic.Message {
  return {
    id: 'msg_x', type: 'message', role: 'assistant', model: 'test',
    content: icerik, stop_reason: 'tool_use', stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 5 } as Anthropic.Usage,
  } as Anthropic.Message;
}

function aletCagrisi(ad: string, girdi: unknown, id = 'tu_1'): Anthropic.ContentBlock {
  return { type: 'tool_use', id, name: ad, input: girdi } as Anthropic.ContentBlock;
}

function metin(m: string): Anthropic.ContentBlock {
  return { type: 'text', text: m, citations: null } as Anthropic.ContentBlock;
}

/** Sırayla verilen yanıtları döndüren sahte istemci. */
function sahte(yanitlar: Anthropic.Message[]): AjanIstemcisi & { govdeler: unknown[] } {
  const govdeler: unknown[] = [];
  let i = 0;
  return {
    govdeler,
    async cagir(govde) {
      govdeler.push(govde);
      const y = yanitlar[Math.min(i, yanitlar.length - 1)];
      i++;
      return { yanit: y, kullanim: BOS_KULLANIM };
    },
  };
}

const BITIR = {
  ad: 'bitir',
  aciklama: 'Kararı bildir',
  sema: { type: 'object' as const, properties: { sonuc: { type: 'string' } } },
};

function alet(ad: string, calistir: Alet['calistir']): Alet {
  return { ad, aciklama: ad, sema: { type: 'object', properties: {} }, calistir };
}

const TEMEL = { sistem: 'sistem', gorev: 'görev', bitirAleti: BITIR };

test('bitiş aleti çağrılınca döngü duruyor ve karar dönüyor', async () => {
  const s = await ajaniCalistir<{ sonuc: string }>({
    ...TEMEL,
    istemci: sahte([yanit([aletCagrisi('bitir', { sonuc: 'tamam' })])]),
    aletler: [],
  });
  assert.equal(s.durum, 'tamam');
  assert.deepEqual(s.karar, { sonuc: 'tamam' });
  assert.equal(s.turSayisi, 1);
});

test('alet çalışıyor, izde görünüyor ve sonucu modele dönüyor', async () => {
  let cagrildi: unknown = null;
  const istemci = sahte([
    yanit([aletCagrisi('ara', { q: 'betz' })]),
    yanit([aletCagrisi('bitir', { sonuc: 'bitti' })]),
  ]);
  const s = await ajaniCalistir({
    ...TEMEL,
    istemci,
    aletler: [
      alet('ara', async (g) => {
        cagrildi = g;
        return { icerik: { bulundu: 3 }, ozet: 'Crossref → 3 sonuç' };
      }),
    ],
  });

  assert.equal(s.durum, 'tamam');
  assert.deepEqual(cagrildi, { q: 'betz' });
  assert.equal(s.adimlar.length, 1);
  assert.equal(s.adimlar[0].alet, 'ara');
  assert.equal(s.adimlar[0].ozet, 'Crossref → 3 sonuç');
  assert.equal(s.adimlar[0].hataMi, false);

  // İkinci çağrının mesajlarında alet sonucu var mı?
  const ikinci = istemci.govdeler[1] as Anthropic.MessageCreateParamsNonStreaming;
  const son = ikinci.messages.at(-1)!;
  assert.equal(son.role, 'user');
  assert.match(JSON.stringify(son.content), /bulundu/);
});

test('ALET HATASI DÖNGÜYÜ ÖLDÜRMÜYOR — modele dönüp başka yol denenebiliyor', async () => {
  /*
   * Ağ hatası alan bir ajan başka bir indekse geçebilmeli. Hatayı yukarı
   * fırlatmak, kurtarılabilir bir durumu soruşturmanın sonu yapardı.
   */
  const istemci = sahte([
    yanit([aletCagrisi('patlak', {})]),
    yanit([aletCagrisi('bitir', { sonuc: 'yine de karar verdim' })]),
  ]);
  const s = await ajaniCalistir({
    ...TEMEL,
    istemci,
    aletler: [
      alet('patlak', async () => {
        throw new Error('ağ gitti');
      }),
    ],
  });

  assert.equal(s.durum, 'tamam');
  assert.equal(s.adimlar[0].hataMi, true);
  assert.match(s.adimlar[0].ozet, /çalışmadı/);
  const ikinci = istemci.govdeler[1] as Anthropic.MessageCreateParamsNonStreaming;
  assert.match(JSON.stringify(ikinci.messages.at(-1)!.content), /ağ gitti/);
});

test('TUR SINIRI: aynı aleti tekrarlayan model sonsuza kadar koşmuyor', async () => {
  const s = await ajaniCalistir({
    ...TEMEL,
    istemci: sahte([yanit([aletCagrisi('ara', {})])]),
    aletler: [alet('ara', async () => ({ icerik: 'yine aynı', ozet: 'arandı' }))],
    enFazlaTur: 4,
  });
  assert.equal(s.durum, 'tur_siniri');
  assert.equal(s.turSayisi, 4);
  assert.equal(s.adimlar.length, 4);
  assert.equal(s.karar, null);
});

test('BÜTÇE BİTİNCE İZ YİNE DÖNÜYOR — yarım soruşturma, sessiz kayıp değil', async () => {
  let cagri = 0;
  const istemci: AjanIstemcisi = {
    async cagir() {
      cagri++;
      if (cagri === 1) {
        return { yanit: yanit([aletCagrisi('ara', {})]), kullanim: BOS_KULLANIM };
      }
      throw new ButceAsimiHatasi(8.02, 8);
    },
  };
  const s = await ajaniCalistir({
    ...TEMEL,
    istemci,
    aletler: [alet('ara', async () => ({ icerik: 'x', ozet: 'Crossref → 1 sonuç' }))],
  });

  assert.equal(s.durum, 'butce');
  assert.equal(s.karar, null);
  assert.equal(s.adimlar.length, 1, 'yapılan iş kaybolmamalı');
  assert.match(s.hata ?? '', /Bütçe/);
});

test('alet çağırmadan konuşan model bir kez dürtülüyor, ikincide bırakılıyor', async () => {
  const istemci = sahte([yanit([metin('Sanırım hepsi gerçek.')])]);
  const s = await ajaniCalistir({ ...TEMEL, istemci, aletler: [] });

  assert.equal(s.durum, 'hata');
  assert.match(s.hata ?? '', /bildirmeden durdu/);
  // Tam olarak bir kez dürtülmüş olmalı: 2 çağrı, fazlası değil.
  assert.equal(istemci.govdeler.length, 2);
  const ikinci = istemci.govdeler[1] as Anthropic.MessageCreateParamsNonStreaming;
  assert.match(String(ikinci.messages.at(-1)!.content), /bitir aletiyle bildir/);
});

test('dürtülen model bitiş aletini çağırırsa iş tamamlanıyor', async () => {
  const s = await ajaniCalistir<{ sonuc: string }>({
    ...TEMEL,
    istemci: sahte([
      yanit([metin('Bitirdim.')]),
      yanit([aletCagrisi('bitir', { sonuc: 'peki' })]),
    ]),
    aletler: [],
  });
  assert.equal(s.durum, 'tamam');
  assert.deepEqual(s.karar, { sonuc: 'peki' });
});

test('UZUN ALET ÇIKTISI KIRPILIYOR — tek belge bütçeyi yiyemez', async () => {
  const istemci = sahte([
    yanit([aletCagrisi('devasa', {})]),
    yanit([aletCagrisi('bitir', { sonuc: 'ok' })]),
  ]);
  await ajaniCalistir({
    ...TEMEL,
    istemci,
    aletler: [
      alet('devasa', async () => ({ icerik: 'x'.repeat(50_000), ozet: 'çok uzun' })),
    ],
  });
  const ikinci = istemci.govdeler[1] as Anthropic.MessageCreateParamsNonStreaming;
  const govde = JSON.stringify(ikinci.messages.at(-1)!.content);
  assert.ok(govde.length < 12_000, `kırpılmamış: ${govde.length}`);
  assert.match(govde, /karakter kırpıldı/);
});

test('paralel alet çağrıları tek turda işleniyor', async () => {
  const s = await ajaniCalistir({
    ...TEMEL,
    istemci: sahte([
      yanit([
        aletCagrisi('a', { n: 1 }, 'tu_1'),
        aletCagrisi('b', { n: 2 }, 'tu_2'),
      ]),
      yanit([aletCagrisi('bitir', { sonuc: 'ok' })]),
    ]),
    aletler: [
      alet('a', async () => ({ icerik: 1, ozet: 'a çalıştı' })),
      alet('b', async () => ({ icerik: 2, ozet: 'b çalıştı' })),
    ],
  });
  assert.equal(s.adimlar.length, 2);
  assert.deepEqual(s.adimlar.map((a) => a.alet), ['a', 'b']);
  assert.equal(s.turSayisi, 2, 'iki alet tek turda işlenmeliydi');
});

test('tanınmayan alet adı hata olarak dönüyor, çökme yok', async () => {
  const s = await ajaniCalistir({
    ...TEMEL,
    istemci: sahte([
      yanit([aletCagrisi('olmayan', {})]),
      yanit([aletCagrisi('bitir', { sonuc: 'ok' })]),
    ]),
    aletler: [],
  });
  assert.equal(s.durum, 'tamam');
  assert.equal(s.adimlar.length, 0, 'olmayan alet ize yazılmamalı');
});

test('maliyet turlar boyunca toplanıyor', async () => {
  const s = await ajaniCalistir({
    ...TEMEL,
    istemci: sahte([
      yanit([aletCagrisi('ara', {})]),
      yanit([aletCagrisi('ara', {})]),
      yanit([aletCagrisi('bitir', { sonuc: 'ok' })]),
    ]),
    aletler: [alet('ara', async () => ({ icerik: 'x', ozet: 'arandı' }))],
  });
  assert.equal(s.turSayisi, 3);
  assert.ok(s.kullanim.maliyet > 0.002, `maliyet toplanmadı: ${s.kullanim.maliyet}`);
});
