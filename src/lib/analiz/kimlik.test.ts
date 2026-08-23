/**
 * Rapor kapağından künye okuma ve başvuruyla karşılaştırma.
 *
 * Biçimler uydurma değil: HYZ ve Robolig şablonlarının kapağından alındı.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kimlikCikar, kimlikKarsilastir } from './kimlik';
import type { Belge, Satir } from './tipler';

function belge(satirlar: string[]): Belge {
  return {
    metin: satirlar.join('\n'),
    sayfaSayisi: 1,
    kelimeSayisi: satirlar.join(' ').split(/\s+/).length,
    satirlar: satirlar.map(
      (metin, i): Satir => ({
        metin, sayfa: 1, x: 60, y: 700 - i * 20,
        punto: 12, kalinMi: false, yinelenen: false,
      }),
    ),
    basliklar: [],
    bolumler: [],
    gorseller: [],
    sayfalar: [{ sayfa: 1, ogeler: [], gorseller: [] }],
  } as unknown as Belge;
}

test('aynı satırda "Etiket: değer" okunuyor', () => {
  const k = kimlikCikar(belge([
    'Takım Adı: Anadolu Kartalları',
    'Takım ID: TKM-4471',
    'Başvuru ID: TF-2026-004181',
  ]));
  assert.equal(k.takimAdi, 'Anadolu Kartalları');
  assert.equal(k.takimId, 'TKM-4471');
  assert.equal(k.basvuruId, 'TF-2026-004181');
});

test('tablo hücrelerinde ayrı satırda okunuyor', () => {
  const k = kimlikCikar(belge([
    'Takım Adı:', 'Boğaziçi Otonom',
    'Takım ID:', 'TKM-9902',
  ]));
  assert.equal(k.takimAdi, 'Boğaziçi Otonom');
  assert.equal(k.takimId, 'TKM-9902');
});

test('etiket satır sonundayken de bulunuyor', () => {
  const k = kimlikCikar(belge([
    'ROBOLİG YARIŞMASI ÖN DEĞERLENDİRME RAPORU Takım Adı: Ege Robotik',
  ]));
  assert.equal(k.takimAdi, 'Ege Robotik');
});

test('boş bırakılmış ve yer tutuculu alanlar okunmuyor', () => {
  const k = kimlikCikar(belge([
    'Takım Adı: ......................',
    'Takım ID: {takım kimliğinizi yazın}',
    'Başvuru ID:',
  ]));
  assert.equal(k.bulunan.length, 0, 'yer tutucu değer sayıldı');
});

test('bir alanın değeri sonraki ETİKET olarak alınmıyor', () => {
  const k = kimlikCikar(belge(['Takım Adı:', 'Takım ID: TKM-1']));
  assert.equal(k.takimAdi, undefined, 'sonraki etiket değer sanıldı');
  assert.equal(k.takimId, 'TKM-1');
});

test('karşılaştırma harf ve sıra farkını uyuşmazlık saymıyor', () => {
  const k = kimlikCikar(belge(['Takım Adı: Anadolu Kartalları']));
  const u = kimlikKarsilastir(k, { takim: 'KARTALLARI ANADOLU' });
  assert.equal(u.length, 0, 'yanlış alarm üretildi');
});

test('gerçekten farklı takım yakalanıyor', () => {
  const k = kimlikCikar(belge([
    'Takım Adı: Anadolu Kartalları',
    'Takım ID: TKM-4471',
  ]));
  const u = kimlikKarsilastir(k, { takim: 'Boğaziçi Otonom', takimId: 'TKM-9902' });
  assert.equal(u.length, 2);
});

test('girilmemiş alan uyuşmazlık üretmiyor', () => {
  const k = kimlikCikar(belge(['Takım Adı: Anadolu Kartalları']));
  assert.equal(kimlikKarsilastir(k, { takim: 'Belirtilmemiş' }).length, 0);
  assert.equal(kimlikKarsilastir(k, {}).length, 0);
});
