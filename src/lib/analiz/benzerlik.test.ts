/**
 * Kopya tespiti.
 *
 * Buradaki en önemli test kapsama oranı: projenin en belirleyici teknik
 * kararı. İki bölümü kopyalanmış bir raporda Jaccard eşiğin altında kalıyor
 * ama kapsama yakalıyor — ölçüt seçimi sonucu doğrudan değiştiriyor.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ciftKarsilastir, cumlelereBol, parmakiziCikar } from './benzerlik';
import type { Belge, Satir } from './tipler';

function belge(paragraflar: string[]): Belge {
  const satirlar = paragraflar.flatMap((p) => p.split('\n'));
  return {
    metin: paragraflar.join('\n\n'),
    sayfaSayisi: 1,
    kelimeSayisi: satirlar.join(' ').split(/\s+/).length,
    satirlar: satirlar.map(
      (metin, i): Satir => ({
        metin, sayfa: 1, x: 60, y: 700 - i * 14,
        punto: 11, kalinMi: false, yinelenen: false,
      }),
    ),
    basliklar: [],
    bolumler: [],
    gorseller: [],
    sayfalar: [{ sayfa: 1, ogeler: [], gorseller: [] }],
  } as unknown as Belge;
}

/** Uzun ve birbirinden bağımsız metin blokları. */
const A_OZGUN = [
  'Sıra arası yabancı ot mücadelesinde kimyasal kullanımını azaltmak için otonom bir robot geliştirdik.',
  'Robot traktör arkasına bağlanan bir aparat üzerinde çalışmakta ve kamera görüntüsünü gömülü kartta işlemektedir.',
  'Segmentasyon çıktısı mekanik çapa ünitesine komut olarak iletilmekte ve ot kökten alınmaktadır.',
];
const B_OZGUN = [
  'Sera içi iklim koşullarını dengelemek amacıyla dağıtık sensör ağı ve merkezi karar birimi tasarlandı.',
  'Sıcaklık ve nem verisi kablosuz düğümlerden toplanarak bulut yerine yerel sunucuda değerlendirilmektedir.',
  'Havalandırma ve gölgeleme aktüatörleri kural tabanlı bir denetleyici tarafından sürülmektedir.',
];

test('ilgisiz iki rapor düşük örtüşme veriyor', () => {
  const a = parmakiziCikar(belge(A_OZGUN), { raporId: 'a' });
  const b = parmakiziCikar(belge(B_OZGUN), { raporId: 'b' });
  const c = ciftKarsilastir(a, b);
  assert.ok(c.kapsama < 0.2, `beklenmedik örtüşme: ${c.kapsama}`);
});

test('birebir aynı rapor tam örtüşüyor', () => {
  const a = parmakiziCikar(belge(A_OZGUN), { raporId: 'a' });
  const b = parmakiziCikar(belge(A_OZGUN), { raporId: 'b' });
  const c = ciftKarsilastir(a, b);
  assert.ok(c.kapsama > 0.9, `aynı metin ${c.kapsama} verdi`);
});

test('KISMİ KOPYA: kapsama yakalıyor, Jaccard kaçırıyor', () => {
  /*
   * Projenin belirleyici kararı. Kısa belge, uzun belgenin bir bölümünü
   * kopyalamış. Jaccard birleşime böldüğü için oranı seyreltiyor;
   * kapsama küçük belgeye böldüğü için gerçeği gösteriyor.
   */
  const uzun = parmakiziCikar(
    belge([...A_OZGUN, ...B_OZGUN, ...A_OZGUN.map((s) => `${s} Ek açıklama.`)]),
    { raporId: 'uzun' },
  );
  const kisa = parmakiziCikar(belge(A_OZGUN), { raporId: 'kisa' });
  const c = ciftKarsilastir(uzun, kisa);

  assert.ok(
    c.kapsama > c.metinOrani,
    `kapsama (${c.kapsama.toFixed(2)}) Jaccard'dan (${c.metinOrani.toFixed(2)}) büyük olmalı`,
  );
  assert.ok(c.kapsama > 0.5, `kısmi kopya kaçtı: kapsama ${c.kapsama.toFixed(2)}`);
});

test('aynı takım işaretleniyor — devam projesi intihal değil', () => {
  const a = parmakiziCikar(belge(A_OZGUN), { raporId: 'a', takimId: 'ege' });
  const b = parmakiziCikar(belge(A_OZGUN), { raporId: 'b', takimId: 'ege' });
  assert.equal(ciftKarsilastir(a, b).ayniTakim, true);
});

test('farklı takım devam projesi sayılmıyor', () => {
  const a = parmakiziCikar(belge(A_OZGUN), { raporId: 'a', takimId: 'ege' });
  const b = parmakiziCikar(belge(A_OZGUN), { raporId: 'b', takimId: 'boun' });
  assert.equal(ciftKarsilastir(a, b).ayniTakim, false);
});

test('cümle bölme kısaltmada bölmüyor', () => {
  const c = cumlelereBol(
    'Dr. Ahmet Yılmaz tarafından yürütülen çalışmada saha verisi toplandı. ' +
      'Elde edilen sonuçlar önerilen yöntemin uygulanabilir olduğunu göstermektedir.',
  );
  assert.equal(c.length, 2, `yanlış bölme: ${JSON.stringify(c)}`);
  assert.ok(c[0].startsWith('Dr.'), 'kısaltmada bölündü');
});

test('eşleşen cümleler sayfa numarasıyla dönüyor', () => {
  const a = parmakiziCikar(belge(A_OZGUN), { raporId: 'a' });
  const b = parmakiziCikar(belge(A_OZGUN), { raporId: 'b' });
  const c = ciftKarsilastir(a, b);
  assert.ok(c.cumleEslesmeleri.length > 0, 'cümle eşleşmesi yok');
  assert.ok(c.cumleEslesmeleri[0].a.metin.length > 10);
});
