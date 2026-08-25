import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bekleyenSoruTarihi, cevapBekliyorMu, type YazismaMesaji } from './yazisma-durum';

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
