import assert from 'node:assert/strict';
import { test } from 'node:test';
import { kodEsler, kodNormal, kodUret } from './kod';

test('kod görünen biçimde üretiliyor: XXXX-XXXX', () => {
  const k = kodUret(() => 0);
  assert.match(k, /^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  assert.equal(k.length, 9);
});

test('karışabilecek karakterler üretilmiyor', () => {
  // 200 kod üretip 0/O/1/I/l geçmediğini doğrula.
  let i = 0;
  for (let n = 0; n < 200; n++) {
    const k = kodUret(() => ((i = (i * 37 + 11) % 101), i / 101));
    assert.doesNotMatch(k, /[0O1Il]/, `karışabilir karakter: ${k}`);
  }
});

test('TİRE ATILAN KOD DA EŞLEŞİYOR — asıl hata buydu', () => {
  /*
   * Giriş kutusu "harf ve rakam dışını at" diyerek tireyi de atıyordu.
   * Kodu doğru yazan hakem 404 alıyordu.
   */
  assert.ok(kodEsler('7KSNNTBD', '7KSN-NTBD'));
});

test('küçük harf, boşluk ve fazladan tire eşleşmeyi bozmuyor', () => {
  for (const girdi of [
    '7ksn-ntbd', '7KSN NTBD', ' 7KSN-NTBD ', '7ksn ntbd', '7-K-S-N-N-T-B-D',
  ]) {
    assert.ok(kodEsler(girdi, '7KSN-NTBD'), `eşleşmeli: ${girdi}`);
  }
});

test('yanlış kod eşleşmiyor', () => {
  assert.equal(kodEsler('7KSN-NTBE', '7KSN-NTBD'), false);
  assert.equal(kodEsler('7KSN', '7KSN-NTBD'), false);
});

test('boş girdi hiçbir şeyle eşleşmiyor', () => {
  // Aksi halde normalleştirme sonrası boş dize, boş kayıtla eşleşebilirdi.
  assert.equal(kodEsler('', '7KSN-NTBD'), false);
  assert.equal(kodEsler('---', '7KSN-NTBD'), false);
  assert.equal(kodEsler('', ''), false);
});

test('normalleştirme Türkçe yerel ayardan etkilenmiyor', () => {
  // Alfabede Türkçe harf yok ama girdi kullanıcıdan geliyor: 'i' harfi
  // Türkçe toUpperCase ile 'İ' olur ve A-Z süzgecine takılıp DÜŞERDİ.
  assert.equal(kodNormal('ki'), 'KI');
  assert.equal(kodNormal('KI'), 'KI');
});
