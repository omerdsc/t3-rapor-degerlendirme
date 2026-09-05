import assert from 'node:assert/strict';
import test from 'node:test';
import { teslimPenceresi } from './teslim-penceresi';

const TAKVIM = [
  { etiket: 'Ön Tasarım Raporu Son Teslim Tarihi', tarih: '2026-04-22' },
  { etiket: 'Ön Tasarım Raporu Sonuçlarının İlanı', tarih: '2026-05-15' },
];

test('teslimden önce açık', () => {
  const p = teslimPenceresi(TAKVIM, 'ÖTR', new Date('2026-04-10T09:00:00Z'));
  assert.equal(p.acik, true);
  assert.equal(p.teslim, '2026-04-22');
  assert.equal(p.kalanGun, 12);
});

test('SON GÜN AÇIK — kapanma ertesi gün', () => {
  /*
   * Bu testin var olma sebebi: "son teslim 22 Nisan" o günün sonuna kadar
   * demek. `kalanGun === 0` günü kapalı sayılsaydı, yarışmacı tam
   * tarihinde yükleme yapamaz ve sistem şartnameye aykırı davranırdı.
   */
  const p = teslimPenceresi(TAKVIM, 'ÖTR', new Date('2026-04-22T23:00:00Z'));
  assert.equal(p.acik, true);
  assert.equal(p.kalanGun, 0);
});

test('teslimden sonra kapalı', () => {
  const p = teslimPenceresi(TAKVIM, 'ÖTR', new Date('2026-04-23T09:00:00Z'));
  assert.equal(p.acik, false);
  assert.match(p.sebep ?? '', /son teslim/i);
  assert.equal(p.teslim, '2026-04-22');
});

test('takvim yoksa açık — bilinmeyen tarih geçmiş sayılmaz', () => {
  assert.equal(teslimPenceresi(undefined, 'ÖTR').acik, true);
  assert.equal(teslimPenceresi([], 'ÖTR').acik, true);
});

test('aşama bilinmiyorsa açık', () => {
  assert.equal(teslimPenceresi(TAKVIM, undefined).acik, true);
});

test('takvimde o aşamanın satırı yoksa açık', () => {
  const p = teslimPenceresi(TAKVIM, 'KTR', new Date('2026-04-23T09:00:00Z'));
  assert.equal(p.acik, true);
});

test('yalnızca sonuç ilanı varsa yükleme engellenmiyor', () => {
  /*
   * Teslim satırı okunamamış, elde yalnızca sonuç tarihi var. Sonuç
   * tarihini teslim sanıp pencereyi ona göre kapatmak, yarışmacıya
   * gerçekte olmayan bir süre tanır ya da hakkı olan süreyi alır.
   */
  const yalnizSonuc = [{ etiket: 'Ön Tasarım Raporu Sonuçlarının İlanı', tarih: '2026-05-15' }];
  const p = teslimPenceresi(yalnizSonuc, 'ÖTR', new Date('2026-06-01T09:00:00Z'));
  assert.equal(p.acik, true);
});
