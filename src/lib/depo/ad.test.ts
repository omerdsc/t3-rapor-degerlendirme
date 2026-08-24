import assert from 'node:assert/strict';
import { test } from 'node:test';
import { kisaAd } from './ad';

test('unvanlar ayıklanıp soyad kalıyor', () => {
  assert.equal(kisaAd('Prof. Dr. Ayşe Demir'), 'Demir');
  assert.equal(kisaAd('Dr. Mehmet Kaya'), 'Kaya');
  assert.equal(kisaAd('Arş. Gör. Elif Şahin'), 'Şahin');
});

test('parantezli ek son kelime sayılmıyor — gerçek hata buydu', () => {
  // "son kelimeyi al" yaklaşımı bu ad için "öncesi)" üretiyordu.
  assert.equal(kisaAd('Arşiv (geçiş öncesi)'), 'Arşiv');
  assert.notEqual(kisaAd('Arşiv (geçiş öncesi)'), 'öncesi)');
});

test('unvansız ad olduğu gibi kalıyor', () => {
  assert.equal(kisaAd('Zeynep Yılmaz'), 'Yılmaz');
  assert.equal(kisaAd('Ahmet'), 'Ahmet');
});

test('Türkçe küçültme unvan eşleşmesini bozmuyor', () => {
  // "DOÇ." büyük harfli geldiğinde de unvan sayılmalı.
  assert.equal(kisaAd('DOÇ. DR. FATMA ÖZ'), 'ÖZ');
  // "Öğr. Gör." — Ö/ğ içeren unvanlar.
  assert.equal(kisaAd('Öğr. Gör. Can Ünal'), 'Ünal');
});

test('yalnızca unvandan oluşan ad boş dönmüyor', () => {
  // Kayıt hatası olabilir; çipin boş kalması kullanıcıya hiçbir şey söylemez.
  assert.equal(kisaAd('Dr.'), 'Dr.');
  assert.notEqual(kisaAd('Dr.'), '');
});

test('uzun soyad kırpılıyor ve kırpıldığı belli oluyor', () => {
  const s = kisaAd('Ali Abdurrahmanoğulları', 14);
  assert.equal(s.length, 14);
  assert.ok(s.endsWith('…'), 'kırpma işareti olmalı');
});

test('boş ve boşluklu girdi çökertmiyor', () => {
  assert.equal(kisaAd(''), '');
  assert.equal(kisaAd('   '), '');
});
