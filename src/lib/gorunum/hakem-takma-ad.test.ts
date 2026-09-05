import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hakemGozuyle, maskeliYazar, metinMaskele, takmaAdlar, type Yazarli,
} from './hakem-takma-ad';

const A = 'hakem-a';
const B = 'hakem-b';

test('atama sırası takma adı belirliyor ve kararlı', () => {
  const bir = takmaAdlar([A, B]);
  const iki = takmaAdlar([A, B]);
  assert.equal(bir.get(A), 'Hakem A');
  assert.equal(bir.get(B), 'Hakem B');
  assert.deepEqual([...bir], [...iki]);
});

test('hakem kendini "Siz" olarak görüyor — takma adıyla birlikte', () => {
  /*
   * Kendi etiketini bilmezse kurulda "Hakem B'nin dediği" cevabının
   * kendisine mi geldiğini anlayamaz.
   */
  const adlar = takmaAdlar([A, B]);
  const m: Yazarli = { yazar: 'Doç. Dr. Pınar Ak', rol: 'hakem', hakemId: B };
  assert.equal(maskeliYazar(m, adlar, B), 'Siz (Hakem B)');
});

test('ÖTEKİ HAKEMİN GERÇEK ADI HİÇBİR ÇIKTIDA GEÇMİYOR', () => {
  const gercek = 'Doç. Dr. Pınar Ak';
  const mesajlar: Yazarli[] = [
    { yazar: gercek, rol: 'hakem', hakemId: A },
    { yazar: 'Koordinasyon', rol: 'koordinasyon' },
    { yazar: 'Sistem', rol: 'sistem' },
  ];
  const gorunen = hakemGozuyle(
    mesajlar,
    [{ id: A, ad: gercek }, { id: B, ad: 'Prof. Dr. Selim Öz' }],
    B,
  );
  const hepsi = gorunen.map((m) => m.yazar).join(' | ');
  assert.ok(!hepsi.includes('Pınar'), `gerçek ad sızdı: ${hepsi}`);
  assert.equal(gorunen[0].yazar, 'Hakem A');
});

test('koordinasyon ve sistem imzaları değişmiyor — kurum, kişi değil', () => {
  const adlar = takmaAdlar([A]);
  assert.equal(
    maskeliYazar({ yazar: 'Koordinasyon · Elif', rol: 'koordinasyon' }, adlar, A),
    'Koordinasyon · Elif',
  );
  assert.equal(maskeliYazar({ yazar: 'Sistem', rol: 'sistem' }, adlar, A), 'Sistem');
});

test('tanınmayan hakem kimliği gerçek ada DÜŞMÜYOR', () => {
  /*
   * Eşlemede olmayan bir kimlik gelirse (atama silinmiş, veri eski)
   * yedek davranış gerçek adı göstermek OLMAMALI — sızıntı tam da
   * böyle yerlerden çıkar.
   */
  const adlar = takmaAdlar([A]);
  const m: Yazarli = { yazar: 'Prof. Dr. Kaya Demir', rol: 'hakem', hakemId: 'silinmis' };
  assert.equal(maskeliYazar(m, adlar, A), 'Hakem');
  assert.equal(maskeliYazar({ yazar: 'Prof. Dr. Kaya Demir', rol: 'hakem' }, adlar, A), 'Hakem');
});

test('etiketlerde I yok — Türkçe büyük I "ı" okunur', () => {
  const idler = Array.from({ length: 22 }, (_, i) => `h${i}`);
  const adlar = [...takmaAdlar(idler).values()];
  assert.ok(!adlar.includes('Hakem I'), 'I harfi etiket olmamalı');
  assert.ok(!adlar.some((a) => /Hakem [QWX]$/.test(a)), 'Q/W/X Türk alfabesinde yok');
  assert.equal(new Set(adlar).size, 22, 'etiketler benzersiz olmalı');
});

test('22 hakemden sonra etiketler çakışmıyor', () => {
  const idler = Array.from({ length: 50 }, (_, i) => `h${i}`);
  const adlar = [...takmaAdlar(idler).values()];
  assert.equal(new Set(adlar).size, 50);
  assert.equal(adlar[22], 'Hakem A2');
});

test('aynı hakem iki kez atanmışsa tek etiket alıyor', () => {
  const adlar = takmaAdlar([A, A, B]);
  assert.equal(adlar.size, 2);
  assert.equal(adlar.get(B), 'Hakem B');
});

test('sistem mesajının METİNDEKİ ad da maskeleniyor', () => {
  /*
   * Sistem mesajları kanal süzgecinden muaf; ad metnin içinde kalırsa
   * yazar alanını maskelemenin bir değeri kalmıyor.
   */
  const hakemler = [
    { id: A, ad: 'Dr. Elif Şahin' },
    { id: B, ad: 'Prof. Dr. Selim Öz' },
  ];
  const m = metinMaskele(
    'Nihai değerlendirme tamamlandı — Dr. Elif Şahin. Toplam 75.5/100 puan.',
    hakemler,
    B,
  );
  assert.ok(!m.includes('Elif'), `ad sızdı: ${m}`);
  assert.match(m, /Hakem A/);
});

test('hakemin KENDİ adı metinde kalıyor', () => {
  const hakemler = [{ id: A, ad: 'Dr. Elif Şahin' }];
  assert.match(
    metinMaskele('Dr. Elif Şahin değerlendirmeyi tamamladı.', hakemler, A),
    /Dr\. Elif Şahin/,
  );
});

test('uzun ad ÖNCE maskeleniyor — yarım maskeleme olmuyor', () => {
  const hakemler = [
    { id: A, ad: 'Elif Şahin' },
    { id: B, ad: 'Dr. Elif Şahin' },
  ];
  const m = metinMaskele('Dr. Elif Şahin raporu inceledi.', hakemler, 'baska');
  assert.ok(!m.includes('Elif'), `yarım maskelendi: ${m}`);
});
