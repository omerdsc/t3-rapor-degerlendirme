import assert from 'node:assert/strict';
import test from 'node:test';
import { yayginlikOlc } from './cumle-yayginlik';
import type { Parmakizi } from './benzerlik';

function p(raporId: string, cumleler: string[]): Parmakizi {
  return {
    raporId,
    imza: new Int32Array(),
    shingleSayisi: 0,
    cumleler: cumleler.map((metin, i) => ({ metin, sayfa: 1 + i, shingleler: new Set<number>() })),
    gorseller: [],
  };
}

const KALIP = 'Bu bölümde projenin amacı ve kapsamı açıklanmaktadır.';
const OZGUN = 'Rüzgâr tünelinde referans kanat 5 m/s hızda 0,29 güç katsayısı verdi.';

const KORPUS: Parmakizi[] = [
  p('r1', [KALIP, OZGUN]),
  p('r2', [KALIP, OZGUN]),
  p('r3', [KALIP, 'Tamamen başka bir cümle.']),
  p('r4', [KALIP, 'Yine başka bir cümle.']),
  p('r5', ['İlgisiz.', 'Bambaşka.']),
];

test('ŞABLON KALIBI ile GERÇEK KOPYA ayrılıyor', () => {
  /*
   * İkisi de "iki raporda ortak" görünüyor. Ayıran tek şey, kalıbın
   * korpusun geri kalanında da bulunması. Benzerlik oranı bu farkı
   * göremiyor; yaygınlık görüyor.
   */
  const [kalip, ozgun] = yayginlikOlc([KALIP, OZGUN], KORPUS);
  assert.equal(kalip.raporSayisi, 4, 'kalıp dört raporda');
  assert.equal(ozgun.raporSayisi, 2, 'özgün cümle yalnızca çiftte');
});

test('Türkçe normalleştirme: noktalama ve büyük harf farkı aynı cümleyi bölmüyor', () => {
  const [y] = yayginlikOlc(['BU BÖLÜMDE PROJENİN AMACI VE KAPSAMI AÇIKLANMAKTADIR'], KORPUS);
  assert.equal(y.raporSayisi, 4, 'büyük harfli hâli aynı cümle sayılmalı');
});

test('rapor içinde tekrarlanan cümle raporu iki kez saydırmıyor', () => {
  const korpus = [p('r1', [OZGUN, OZGUN, OZGUN])];
  const [y] = yayginlikOlc([OZGUN], korpus);
  assert.equal(y.raporSayisi, 1);
});

test('hiç geçmeyen cümle sıfır dönüyor, hata değil', () => {
  const [y] = yayginlikOlc(['Korpusta olmayan bir cümle.'], KORPUS);
  assert.equal(y.raporSayisi, 0);
  assert.deepEqual(y.raporlar, []);
});

test('aynı cümle iki kez sorulursa tek sonuç dönüyor', () => {
  const s = yayginlikOlc([OZGUN, OZGUN], KORPUS);
  assert.equal(s.length, 1);
});

test('rapor listesi sekizle sınırlı — istem şişmesin', () => {
  const genis = Array.from({ length: 20 }, (_, i) => p(`r${i}`, [KALIP]));
  const [y] = yayginlikOlc([KALIP], genis);
  assert.equal(y.raporSayisi, 20);
  assert.equal(y.raporlar.length, 8);
});

test('boş korpusta çökme yok', () => {
  const [y] = yayginlikOlc([OZGUN], []);
  assert.equal(y.raporSayisi, 0);
});
