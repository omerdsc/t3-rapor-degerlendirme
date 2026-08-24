import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dagit } from './dagitim';

const r = (id: string, mevcut: string[] = []) => ({ raporId: id, mevcut });
const h = (id: string, yuk = 0) => ({ id, yuk });

test('boş yüklerde eşit dağıtım', () => {
  const s = dagit([r('r1'), r('r2'), r('r3'), r('r4')], [h('a'), h('b')], 1);
  assert.equal(s.ciftler.length, 4);
  assert.equal(s.yeniYuk.get('a'), 2);
  assert.equal(s.yeniYuk.get('b'), 2);
});

test('MEVCUT YÜK sayılıyor — dengeleyici asıl iş bu', () => {
  /*
   * Eski round-robin bu durumda a ve b'ye ikişer verirdi ve a 12'den
   * 14'e çıkardı. Doğru davranış: hepsi b'ye gitmeli, çünkü b boş.
   */
  const s = dagit([r('r1'), r('r2'), r('r3'), r('r4')], [h('a', 12), h('b', 0)], 1);
  assert.equal(s.yeniYuk.get('b'), 4);
  assert.equal(s.yeniYuk.get('a'), 0);
});

test('dağıtım sonrası yükler birbirine yakınsıyor', () => {
  /*
   * Başlangıç 5/2/0 = 7 iş, üstüne 9 yeni = 16. Üçe tam bölünmediği için
   * kusursuz eşitlik imkânsız; ulaşılabilecek en iyi dağılım 6/5/5.
   * Ölçüt bu yüzden "fark sıfır" değil, "fark en çok 1".
   */
  const baslangic = { a: 5, b: 2, c: 0 };
  const s = dagit(
    Array.from({ length: 9 }, (_, i) => r(`r${i}`)),
    [h('a', baslangic.a), h('b', baslangic.b), h('c', baslangic.c)],
    1,
  );
  const son = (['a', 'b', 'c'] as const).map((k) => baslangic[k] + s.yeniYuk.get(k)!);
  assert.equal(son.reduce((x, y) => x + y, 0), 16, 'tüm işler dağıtılmalı');
  assert.ok(
    Math.max(...son) - Math.min(...son) <= 1,
    `yükler en çok 1 fark etmeli, çıkan: ${son}`,
  );
});

test('en yüklü hakem, dengelenene kadar hiç iş almıyor', () => {
  // a=10, b=0: ilk 10 rapor tamamen b'ye gitmeli.
  const s = dagit(
    Array.from({ length: 10 }, (_, i) => r(`r${i}`)),
    [h('a', 10), h('b', 0)],
    1,
  );
  assert.equal(s.yeniYuk.get('b'), 10);
  assert.equal(s.yeniYuk.get('a'), 0);
});

test('rapor başına iki hakem: ikisi de farklı olmalı', () => {
  const s = dagit([r('r1')], [h('a'), h('b'), h('c')], 2);
  const atananlar = s.ciftler.map((c) => c.hakemId);
  assert.equal(atananlar.length, 2);
  assert.equal(new Set(atananlar).size, 2, 'aynı hakem iki kez atanamaz');
});

test('rapor başına hakem, hakem sayısını aşamaz', () => {
  const s = dagit([r('r1')], [h('a'), h('b')], 5);
  assert.equal(s.ciftler.length, 2);
});

test('zaten atanmış hakem tekrar atanmıyor', () => {
  const s = dagit([r('r1', ['a'])], [h('a'), h('b')], 1);
  assert.deepEqual(s.ciftler, [{ raporId: 'r1', hakemId: 'b' }]);
});

test('tüm seçilenler zaten atanmışsa rapor atlanıyor', () => {
  const s = dagit([r('r1', ['a', 'b'])], [h('a'), h('b')], 1);
  assert.equal(s.ciftler.length, 0);
  assert.deepEqual(s.atlanan, ['r1']);
});

test('hakem seçilmemişse hiçbir şey atanmıyor', () => {
  const s = dagit([r('r1'), r('r2')], [], 1);
  assert.equal(s.ciftler.length, 0);
  assert.deepEqual(s.atlanan, ['r1', 'r2']);
});

test('aynı girdi aynı sonucu veriyor — önizleme sunucudan sapamaz', () => {
  const girdi = () =>
    dagit(
      [r('r1'), r('r2'), r('r3')],
      [h('a', 1), h('b', 1), h('c', 3)],
      2,
    );
  assert.deepEqual(girdi().ciftler, girdi().ciftler);
});

test('çağıranın hakem dizisi değişmiyor', () => {
  const hakemler = [h('a', 3), h('b', 0)];
  dagit([r('r1'), r('r2')], hakemler, 1);
  assert.deepEqual(hakemler, [{ id: 'a', yuk: 3 }, { id: 'b', yuk: 0 }]);
});
