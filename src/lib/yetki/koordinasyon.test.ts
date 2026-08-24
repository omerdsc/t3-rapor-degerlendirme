import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COKKI, anahtarDogru, istekYetkili, kapi, yetkiKurulu } from './koordinasyon';

/** Testler ortam değişkenini değiştiriyor; her testte kendi değerini kuruyor. */
function anahtar(deger?: string) {
  if (deger === undefined) delete process.env.KOORDINASYON_ANAHTARI;
  else process.env.KOORDINASYON_ANAHTARI = deger;
}

const istek = (baslik?: Record<string, string>) =>
  new Request('http://x/api/atama', { headers: baslik });

test('anahtar tanımlı değilse sistem AÇIK ve bunu söylüyor', () => {
  anahtar(undefined);
  assert.equal(yetkiKurulu(), false);
  assert.equal(istekYetkili(istek()), true, 'açık kurulumda istek geçmeli');
  assert.equal(kapi(istek()), null);
});

test('boş ya da boşluklu anahtar kurulu sayılmıyor', () => {
  // Aksi halde `KOORDINASYON_ANAHTARI=` yazan biri kapıyı kilitli sanır.
  anahtar('');
  assert.equal(yetkiKurulu(), false);
  anahtar('   ');
  assert.equal(yetkiKurulu(), false);
});

test('anahtar kuruluysa anahtarsız istek reddediliyor', () => {
  anahtar('gizli-parola');
  assert.equal(yetkiKurulu(), true);
  assert.equal(istekYetkili(istek()), false);
  assert.equal(kapi(istek())?.status, 401);
});

test('doğru başlık geçiyor, yanlış başlık geçmiyor', () => {
  anahtar('gizli-parola');
  assert.equal(istekYetkili(istek({ 'x-koordinasyon-anahtari': 'gizli-parola' })), true);
  assert.equal(istekYetkili(istek({ 'x-koordinasyon-anahtari': 'yanlis' })), false);
});

test('çerezle de geçiyor', () => {
  anahtar('gizli-parola');
  assert.equal(
    istekYetkili(istek({ cookie: `${COKKI}=gizli-parola` })),
    true,
  );
});

test('başka çerezlerin arasındaki doğru çerez bulunuyor', () => {
  anahtar('gizli-parola');
  assert.equal(
    istekYetkili(istek({ cookie: `tema=koyu; ${COKKI}=gizli-parola; dil=tr` })),
    true,
  );
});

test('URL kodlanmış çerez değeri çözülüyor', () => {
  // Çerez değerinde ; ve boşluk olamaz; anahtar bunları içerirse kodlanır.
  anahtar('gizli parola;2026');
  assert.equal(
    istekYetkili(istek({ cookie: `${COKKI}=${encodeURIComponent('gizli parola;2026')}` })),
    true,
  );
});

test('eşit değerde başlayan ama kısa/uzun anahtar geçmiyor', () => {
  anahtar('gizli-parola');
  assert.equal(anahtarDogru('gizli'), false, 'ön ek geçmemeli');
  assert.equal(anahtarDogru('gizli-parolaX'), false, 'uzatma geçmemeli');
  assert.equal(anahtarDogru(''), false);
});

test('anahtar kurulu değilken hiçbir değer doğru sayılmıyor', () => {
  // `anahtarDogru('')` açık kurulumda true dönerse çerez denetimi
  // yanlışlıkla herkesi geçirir.
  anahtar(undefined);
  assert.equal(anahtarDogru(''), false);
  assert.equal(anahtarDogru('herhangi'), false);
});

test('Türkçe karakterli anahtar çalışıyor', () => {
  anahtar('şifreÖzelİğ');
  assert.equal(anahtarDogru('şifreÖzelİğ'), true);
  assert.equal(anahtarDogru('sifreOzelIg'), false);
});
