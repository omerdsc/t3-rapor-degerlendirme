import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  kriterOrtalamalari, toplamOrtalamasi, type DegerlendirmeGirdisi,
} from './nihai-hesap';

const d = (
  hakemId: string,
  durum: DegerlendirmeGirdisi['durum'],
  puanlar: Array<[string, number, string?]>,
): DegerlendirmeGirdisi => ({
  hakemId,
  durum,
  toplam: puanlar.reduce((t, [, p]) => t + p, 0),
  puanlar: puanlar.map(([kriterKodu, puan, not]) => ({ kriterKodu, puan, not })),
});

test('hakem yoksa puan yok — sıfır değil', () => {
  const o = toplamOrtalamasi([]);
  assert.equal(o.puan, undefined);
  assert.equal(o.tamamlanan, 0);
});

test('tek hakem: puan onun toplamı, sapma sıfır', () => {
  const o = toplamOrtalamasi([d('h1', 'tamamlandi', [['A', 40], ['B', 35]])]);
  assert.equal(o.puan, 75);
  assert.equal(o.sapma, 0);
  assert.equal(o.tamamlanan, 1);
});

test('üç hakem ortalanıyor ve sapma en büyük–en küçük farkı', () => {
  const o = toplamOrtalamasi([
    d('h1', 'tamamlandi', [['A', 75.5]]),
    d('h2', 'tamamlandi', [['A', 80]]),
    d('h3', 'tamamlandi', [['A', 60]]),
  ]);
  // (75,5 + 80 + 60) / 3 = 71,833… → 71,8
  assert.equal(o.puan, 71.8);
  assert.equal(o.sapma, 20);
  assert.equal(o.tamamlanan, 3);
});

test('TASLAK ortalamaya girmiyor — bitmemiş iş puan değil', () => {
  const o = toplamOrtalamasi([
    d('h1', 'tamamlandi', [['A', 80]]),
    d('h2', 'taslak', [['A', 20]]),
    d('h3', 'baslanmadi', []),
  ]);
  assert.equal(o.puan, 80, 'taslak 20 puan ortalamayı düşürmemeli');
  assert.equal(o.tamamlanan, 1);
});

test('bu, listede 75,5 / detayda 71,8 gösteren hatanın testi', () => {
  /*
   * Gerçek hata: rapor listesi ilk hakemin puanını (75,5) önbellekten
   * okuyordu, detay sayfası üç hakemin ortalamasını (71,8) hesaplıyordu.
   * Tek kaynak artık bu fonksiyon; ikisi ayrışamaz.
   */
  const uc = [
    d('h1', 'tamamlandi', [['A', 75.5]]),
    d('h2', 'tamamlandi', [['A', 80]]),
    d('h3', 'tamamlandi', [['A', 60]]),
  ];
  assert.notEqual(toplamOrtalamasi(uc).puan, 75.5, 'ilk hakemin puanı nihai puan DEĞİL');
  assert.equal(toplamOrtalamasi(uc).puan, 71.8);
});

test('kriter ortalaması kriter bazında alınıyor', () => {
  const m = kriterOrtalamalari([
    d('h1', 'tamamlandi', [['ICERIK', 30], ['SUNUM', 10]]),
    d('h2', 'tamamlandi', [['ICERIK', 20], ['SUNUM', 20]]),
  ]);
  assert.equal(m.get('ICERIK')?.puan, 25);
  assert.equal(m.get('SUNUM')?.puan, 15);
});

test('bir kriteri boş bırakan hakem o kriterin ortalamasını düşürmüyor', () => {
  const m = kriterOrtalamalari([
    d('h1', 'tamamlandi', [['ICERIK', 30], ['SUNUM', 10]]),
    d('h2', 'tamamlandi', [['ICERIK', 20]]), // SUNUM puanlanmamış
  ]);
  assert.equal(m.get('SUNUM')?.puanlayan, 1);
  assert.equal(m.get('SUNUM')?.puan, 10, 'ikiye bölünse 5 çıkardı — haksız düşüş');
  assert.equal(m.get('ICERIK')?.puan, 25);
});

test('kriter notları toplanıyor, boş notlar atılıyor', () => {
  const m = kriterOrtalamalari([
    d('h1', 'tamamlandi', [['ICERIK', 30, 'Kaynakça zayıf.']]),
    d('h2', 'tamamlandi', [['ICERIK', 20, '   ']]),
    d('h3', 'tamamlandi', [['ICERIK', 25, 'Yöntem net.']]),
  ]);
  assert.deepEqual(m.get('ICERIK')?.notlar, ['Kaynakça zayıf.', 'Yöntem net.']);
});

test('taslak notları yarışmacıya gitmiyor', () => {
  const m = kriterOrtalamalari([
    d('h1', 'tamamlandi', [['ICERIK', 30, 'Onaylanmış not.']]),
    d('h2', 'taslak', [['ICERIK', 5, 'Yarım kalmış not.']]),
  ]);
  assert.deepEqual(m.get('ICERIK')?.notlar, ['Onaylanmış not.']);
  assert.equal(m.get('ICERIK')?.puan, 30);
});

// ─────────────────────────── birleşik geri bildirim ───────────────────────

import { birlesikGeriBildirim } from './nihai-hesap';

const gb = (
  hakemId: string,
  durum: DegerlendirmeGirdisi['durum'],
  guclu: string[],
  gelisim: string[],
  oneriler: Array<[string, string]> = [],
): DegerlendirmeGirdisi => ({
  hakemId,
  durum,
  toplam: 50,
  puanlar: [],
  geriBildirim: {
    gucluYonler: guclu,
    gelisimAlanlari: gelisim,
    oneriler: oneriler.map(([kriterKodu, metin]) => ({ kriterKodu, metin })),
  },
});

test('onaylanmamış geri bildirim yarışmacıya gitmiyor', () => {
  // geriBildirim alanı hiç yoksa hiçbir şey yayımlanmamalı.
  const b = birlesikGeriBildirim([
    { hakemId: 'h1', durum: 'tamamlandi', toplam: 50, puanlar: [] },
  ]);
  assert.deepEqual(b.gucluYonler, []);
  assert.deepEqual(b.gelisimAlanlari, []);
  assert.equal(b.oneriler.size, 0);
});

test('TASLAK değerlendirmenin geri bildirimi yayımlanmıyor', () => {
  const b = birlesikGeriBildirim([
    gb('h1', 'taslak', ['Yarım kalmış övgü.'], ['Yarım kalmış eleştiri.']),
  ]);
  assert.deepEqual(b.gucluYonler, []);
  assert.deepEqual(b.gelisimAlanlari, []);
});

test('tamamlanmış değerlendirmenin geri bildirimi yayımlanıyor', () => {
  const b = birlesikGeriBildirim([
    gb('h1', 'tamamlandi', ['Yöntem net.'], ['Maliyet analizi yok.'], [['ICERIK', 'Tabloyu ekleyin.']]),
  ]);
  assert.deepEqual(b.gucluYonler, ['Yöntem net.']);
  assert.deepEqual(b.gelisimAlanlari, ['Maliyet analizi yok.']);
  assert.deepEqual(b.oneriler.get('ICERIK'), ['Tabloyu ekleyin.']);
});

test('iki hakemin aynı cümlesi tekrar gösterilmiyor', () => {
  const b = birlesikGeriBildirim([
    gb('h1', 'tamamlandi', ['Yöntem net.'], []),
    gb('h2', 'tamamlandi', ['  yöntem   NET.  '], []),
  ]);
  assert.equal(b.gucluYonler.length, 1, 'boşluk ve büyük harf farkı tekrar sayılmamalı');
});

test('iki hakemin FARKLI cümleleri ikisi de kalıyor', () => {
  // Birini seçip atmak, hangi hakemin cümlesinin atıldığına sistemin
  // karar vermesi olurdu.
  const b = birlesikGeriBildirim([
    gb('h1', 'tamamlandi', ['Yöntem net.'], []),
    gb('h2', 'tamamlandi', ['Literatür taraması güçlü.'], []),
  ]);
  assert.equal(b.gucluYonler.length, 2);
});

test('boş ve boşluklu cümleler atılıyor', () => {
  const b = birlesikGeriBildirim([
    gb('h1', 'tamamlandi', ['', '   ', 'Gerçek övgü.'], ['\n'], [['A', '  ']]),
  ]);
  assert.deepEqual(b.gucluYonler, ['Gerçek övgü.']);
  assert.deepEqual(b.gelisimAlanlari, []);
  assert.equal(b.oneriler.size, 0, 'boş öneri kriter anahtarı bile oluşturmamalı');
});

test('aynı ölçüte iki hakem öneri yazarsa ikisi de kalıyor', () => {
  const b = birlesikGeriBildirim([
    gb('h1', 'tamamlandi', [], [], [['ICERIK', 'Tablo ekleyin.']]),
    gb('h2', 'tamamlandi', [], [], [['ICERIK', 'Kaynak gösterin.']]),
  ]);
  assert.deepEqual(b.oneriler.get('ICERIK'), ['Tablo ekleyin.', 'Kaynak gösterin.']);
});

test('Türkçe büyük/küçük harf tekleme doğru çalışıyor', () => {
  // "İYİ" ve "iyi" aynı cümle; Türkçe küçültme İ→i yapmalı.
  const b = birlesikGeriBildirim([
    gb('h1', 'tamamlandi', ['İYİ KURGULANMIŞ.'], []),
    gb('h2', 'tamamlandi', ['iyi kurgulanmış.'], []),
  ]);
  assert.equal(b.gucluYonler.length, 1);
});
