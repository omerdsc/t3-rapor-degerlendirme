/**
 * Şartname takviminden aşama durumu.
 *
 * Yanlış çözümlenirse koordinasyon "hangi aşamadayız" sorusunu yanlış
 * yanıtlar. Tarihler gerçek TEKNOFEST takviminden alındı.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asamaTakvimi } from './takvim';

const TARIHLER = [
  { etiket: 'Teknik Şartnamenin İlanı', tarih: '2026-02-16' },
  { etiket: 'Ön Tasarım Raporu Son Teslim Tarihi', tarih: '2026-04-22' },
  { etiket: 'Ön Tasarım Raporu Sonuçlarının İlanı', tarih: '2026-05-15' },
  { etiket: 'Kritik Tasarım Raporu Son Teslim Tarihi', tarih: '2026-09-10' },
];

const gun = (s: string) => new Date(`${s}T12:00:00Z`);

test('teslim öncesi — teslim sürüyor', () => {
  const t = asamaTakvimi(TARIHLER, 'ÖTR', gun('2026-04-01'));
  assert.equal(t?.durum, 'gelecek');
  assert.equal(t?.kalanGun, 21);
});

test('teslim geçti, sonuç ilan edilmedi — değerlendirme aşaması', () => {
  const t = asamaTakvimi(TARIHLER, 'ÖTR', gun('2026-05-02'));
  assert.equal(t?.durum, 'degerlendirmede');
});

test('sonuç da ilan edildi — tamamlandı', () => {
  const t = asamaTakvimi(TARIHLER, 'ÖTR', gun('2026-08-23'));
  assert.equal(t?.durum, 'tamamlandi');
});

test('sonuç satırı teslim sanılmıyor', () => {
  // Aynı aşamanın iki satırı var; "Sonuçlarının İlanı" teslim değildir.
  const t = asamaTakvimi(TARIHLER, 'ÖTR', gun('2026-04-01'));
  assert.equal(t?.teslim, '2026-04-22');
  assert.equal(t?.sonucIlani, '2026-05-15');
});

test('takvimde olmayan aşama için null dönüyor', () => {
  assert.equal(asamaTakvimi(TARIHLER, 'DTR', gun('2026-08-23')), null);
});

test('aşama verilmezse null', () => {
  assert.equal(asamaTakvimi(TARIHLER, undefined, gun('2026-08-23')), null);
});

test('Türkçe büyük harfli etiket eşleşiyor', () => {
  // /ÖTR/i deseni Türkçe'de güvenilir değil; anahtar() üzerinden eşleşmeli.
  const t = asamaTakvimi(
    [{ etiket: 'ÖN TASARIM RAPORU SON TESLİM TARİHİ', tarih: '2026-04-22' }],
    'ÖTR',
    gun('2026-04-01'),
  );
  assert.equal(t?.teslim, '2026-04-22');
});

test('tarih aralığında bitiş tarihi esas alınıyor', () => {
  const t = asamaTakvimi(
    [{ etiket: 'Ön Tasarım Raporu Son Teslim', tarih: '2026-04-15 → 2026-04-22' }],
    'ÖTR',
    gun('2026-04-01'),
  );
  assert.equal(t?.teslim, '2026-04-22');
});
