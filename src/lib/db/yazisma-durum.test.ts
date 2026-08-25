import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  bekleyenHakemler, bekleyenSoruTarihi, cevapBekliyorMu, type YazismaMesaji,
} from './yazisma-durum';

const m = (
  rol: YazismaMesaji['rol'],
  tarih: string,
  otomatikMi = false,
): YazismaMesaji => ({ rol, tarih, otomatikMi });

test('boş yazışma cevap beklemiyor', () => {
  assert.equal(cevapBekliyorMu([]), false);
});

test('son mesaj hakemden ise cevap bekliyor', () => {
  assert.equal(cevapBekliyorMu([m('hakem', '2026-08-24T10:00:00Z')]), true);
});

test('koordinasyon cevaplayınca bekleme bitiyor', () => {
  assert.equal(
    cevapBekliyorMu([
      m('hakem', '2026-08-24T10:00:00Z'),
      m('koordinasyon', '2026-08-24T11:00:00Z'),
    ]),
    false,
  );
});

test('cevaptan sonra yeni soru gelirse yeniden bekliyor', () => {
  assert.equal(
    cevapBekliyorMu([
      m('hakem', '2026-08-24T10:00:00Z'),
      m('koordinasyon', '2026-08-24T11:00:00Z'),
      m('hakem', '2026-08-24T12:00:00Z'),
    ]),
    true,
  );
});

test('SİSTEM mesajı cevap sayılmıyor', () => {
  // "Değerlendirme tamamlandı" otomatik kaydı hakemin sorusunu kapatmaz.
  assert.equal(
    cevapBekliyorMu([
      m('hakem', '2026-08-24T10:00:00Z'),
      m('sistem', '2026-08-24T11:00:00Z'),
    ]),
    true,
  );
});

test('otomatik işaretli mesaj da cevap sayılmıyor', () => {
  assert.equal(
    cevapBekliyorMu([
      m('hakem', '2026-08-24T10:00:00Z'),
      m('koordinasyon', '2026-08-24T11:00:00Z', true),
    ]),
    true,
  );
});

test('dizinin sırası bozuksa da tarihe bakılıyor', () => {
  // Veritabanından sırasız gelirse sonuç değişmemeli.
  assert.equal(
    cevapBekliyorMu([
      m('koordinasyon', '2026-08-24T11:00:00Z'),
      m('hakem', '2026-08-24T12:00:00Z'),
    ]),
    true,
  );
  assert.equal(
    cevapBekliyorMu([
      m('hakem', '2026-08-24T12:00:00Z'),
      m('koordinasyon', '2026-08-24T13:00:00Z'),
    ]),
    false,
  );
});

test('yarışma yöneticisinin cevabı da soruyu kapatıyor', () => {
  assert.equal(
    cevapBekliyorMu([
      m('hakem', '2026-08-24T10:00:00Z'),
      m('yarisma_yoneticisi', '2026-08-24T11:00:00Z'),
    ]),
    false,
  );
});

test('bekleme süresi İLK cevapsız sorudan sayılıyor', () => {
  /*
   * Hakem üst üste iki mesaj yazdıysa bekleme, sonuncudan değil
   * koordinasyonun cevaplamadığı ilkinden başlar — yoksa hatırlatma
   * yazmak bekleme süresini sıfırlardı.
   */
  const t = bekleyenSoruTarihi([
    m('hakem', '2026-08-24T08:00:00Z'),
    m('koordinasyon', '2026-08-24T09:00:00Z'),
    m('hakem', '2026-08-24T10:00:00Z'),
    m('hakem', '2026-08-24T14:00:00Z'),
  ]);
  assert.equal(t, '2026-08-24T10:00:00Z');
});

test('bekleyen soru yoksa tarih de yok', () => {
  assert.equal(bekleyenSoruTarihi([m('koordinasyon', '2026-08-24T10:00:00Z')]), null);
  assert.equal(bekleyenSoruTarihi([]), null);
});

// ---------------------------------------------------- hakem başına bekleyiş

/** Kimlikli mesaj kurucusu — hakem başına sohbet sınamaları için. */
const k = (
  rol: YazismaMesaji['rol'],
  tarih: string,
  hakemId?: string,
  kanal: YazismaMesaji['kanal'] = 'koordinasyon',
): YazismaMesaji => ({ rol, tarih, hakemId, kanal });

test('bekleyen hakem yok: boş yazışma', () => {
  assert.deepEqual([...bekleyenHakemler([])], []);
});

test('hakemin sorusu cevapsızsa listede', () => {
  assert.deepEqual(
    [...bekleyenHakemler([k('hakem', '2026-08-25T10:00:00Z', 'A')])],
    ['A'],
  );
});

test('o hakeme verilen cevap sırayı kapatıyor', () => {
  assert.deepEqual(
    [...bekleyenHakemler([
      k('hakem', '2026-08-25T10:00:00Z', 'A'),
      k('koordinasyon', '2026-08-25T11:00:00Z', 'A'),
    ])],
    [],
  );
});

test('BAŞKA hakeme verilen cevap sırayı kapatmıyor', () => {
  /*
   * Rapor düzeyinde bakan eski hesap tam burada yanılıyordu: B'ye yanıt
   * yazılınca raporun son mesajı koordinasyondan geliyor ve A'nın sorusu
   * cevaplanmış sayılıyordu.
   */
  assert.deepEqual(
    [...bekleyenHakemler([
      k('hakem', '2026-08-25T10:00:00Z', 'A'),
      k('hakem', '2026-08-25T10:30:00Z', 'B'),
      k('koordinasyon', '2026-08-25T11:00:00Z', 'B'),
    ])],
    ['A'],
  );
});

test('duyuru (kimliksiz koordinasyon mesajı) hiçbir sırayı kapatmıyor', () => {
  assert.deepEqual(
    [...bekleyenHakemler([
      k('hakem', '2026-08-25T10:00:00Z', 'A'),
      k('koordinasyon', '2026-08-25T11:00:00Z', undefined),
    ])],
    ['A'],
  );
});

test('cevaptan sonra yeniden soran hakem tekrar listede', () => {
  assert.deepEqual(
    [...bekleyenHakemler([
      k('hakem', '2026-08-25T10:00:00Z', 'A'),
      k('koordinasyon', '2026-08-25T11:00:00Z', 'A'),
      k('hakem', '2026-08-25T12:00:00Z', 'A'),
    ])],
    ['A'],
  );
});

test('kurul mesajı koordinasyonu beklemeye sokmuyor', () => {
  assert.deepEqual(
    [...bekleyenHakemler([k('hakem', '2026-08-25T10:00:00Z', 'A', 'kurul')])],
    [],
  );
});

test('sistem ve otomatik kayıtlar sayılmıyor', () => {
  assert.deepEqual(
    [...bekleyenHakemler([
      { rol: 'sistem', tarih: '2026-08-25T10:00:00Z', hakemId: 'A' },
      { rol: 'hakem', tarih: '2026-08-25T11:00:00Z', hakemId: 'A', otomatikMi: true },
    ])],
    [],
  );
});

test('kimliksiz hakem mesajı kimseye atanmıyor', () => {
  // v4 öncesi kayıt: hangi hakem olduğu bilinmiyor, uydurulmuyor.
  assert.deepEqual(
    [...bekleyenHakemler([k('hakem', '2026-08-25T10:00:00Z', undefined)])],
    [],
  );
});

test('karışık sırayla gelen mesajlarda karar tarihe göre', () => {
  // Cevap dizide önce duruyor ama SONRA yazılmış: sıra kapalı olmalı.
  assert.deepEqual(
    [...bekleyenHakemler([
      k('koordinasyon', '2026-08-25T11:00:00Z', 'A'),
      k('hakem', '2026-08-25T10:00:00Z', 'A'),
    ])],
    [],
  );
});
