import assert from 'node:assert/strict';
import test from 'node:test';
import { kategoriEtiketi, yarismaKategoriEtiketi } from './kategori-etiketi';

/*
 * Üç tekrar biçiminin üçü de canlı ekranda görüldü; testler o çıktıların
 * kendisini tutuyor.
 */

test('kategori adı yarışma adının aynısı — aşama kalır', () => {
  assert.equal(
    kategoriEtiketi('Havacılıkta Yapay Zeka Yarışması', 'ÖTR', 'Havacılıkta Yapay Zeka Yarışması'),
    'ÖTR',
  );
});

test('kategori adı yarışma adının aynısı ve aşama yok — ad kalır', () => {
  assert.equal(kategoriEtiketi('Sıfır Atık', undefined, 'Sıfır Atık'), 'Sıfır Atık');
});

test('AŞAMA ZATEN ADIN İÇİNDE — ikinci kez eklenmiyor', () => {
  // Ekranda görülen: "Analog Tasarım · ÖTR · ÖTR"
  assert.equal(kategoriEtiketi('Analog Tasarım · ÖTR', 'ÖTR'), 'Analog Tasarım · ÖTR');
  assert.equal(kategoriEtiketi('Mikrodenetleyici Tasarım · DTR', 'DTR'), 'Mikrodenetleyici Tasarım · DTR');
  assert.equal(kategoriEtiketi('ÖTR Aşaması', 'ÖTR'), 'ÖTR Aşaması');
  assert.equal(kategoriEtiketi('Tasarım (KTR)', 'KTR'), 'Tasarım (KTR)');
});

test('aşama adın içinde DEĞİLSE ekleniyor', () => {
  assert.equal(kategoriEtiketi('Analog Tasarım', 'ÖTR'), 'Analog Tasarım · ÖTR');
});

test('kısaltma sözcük ortasında geçiyorsa eşleşme sayılmıyor', () => {
  /*
   * Sınır denetimi olmasaydı "PÖTRAL" içindeki "ÖTR", aşamanın zaten
   * yazıldığı sanılır ve gerçek aşama hiç gösterilmezdi.
   */
  assert.equal(kategoriEtiketi('PÖTRAL Sistemler', 'ÖTR'), 'PÖTRAL Sistemler · ÖTR');
});

test('kategori adı yarışma adıyla BAŞLIYORSA önek atılıyor', () => {
  // Ekranda görülen: "FPV Drone İzleme (Tracking) Yarışması · ÖTR · ÖTR"
  assert.equal(
    kategoriEtiketi(
      'FPV Drone İzleme (Tracking) Yarışması ÖTR',
      'ÖTR',
      'FPV Drone İzleme (Tracking) Yarışması',
    ),
    'ÖTR',
  );
});

test('büyük/küçük harf ve fazla boşluk farkı göz ardı ediliyor', () => {
  assert.equal(kategoriEtiketi('  sıfır  atık ', 'ÖTR', 'Sıfır Atık'), 'ÖTR');
});

test('alt satır etiketi — kategori bilgi taşımıyorsa yalnızca yarışma', () => {
  assert.equal(
    yarismaKategoriEtiketi('Sıfır Atık Yarışması', 'Sıfır Atık Yarışması'),
    'Sıfır Atık Yarışması',
  );
});

test('alt satır etiketi — kategori ayrıysa birleştiriliyor', () => {
  assert.equal(
    yarismaKategoriEtiketi('Çip Tasarım Yarışması', 'Analog Tasarım', 'DTR'),
    'Çip Tasarım Yarışması · Analog Tasarım · DTR',
  );
});

test('alt satır etiketi — kategori yoksa yalnızca yarışma', () => {
  assert.equal(yarismaKategoriEtiketi('Roket Yarışması'), 'Roket Yarışması');
});
