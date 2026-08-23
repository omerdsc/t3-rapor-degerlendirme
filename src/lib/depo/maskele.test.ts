/**
 * Kimlik maskeleme.
 *
 * Buradaki testler bir GİZLİLİK güvencesini koruyor: maskeli çıktı gerçek
 * adın hiçbir parçasını taşımamalı. İlk sürüm kimliğin son dört karakterini
 * alıyordu ve "anadolu" → "Takım DOLU" üretiyordu; gerçek adın bir parçası
 * maske değildir.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  basvuruRumuzu, metindeMaskele, raporRumuzu, raporuMaskele, takimRumuzu,
} from './maskele';

test('rumuz gerçek adın hiçbir parçasını taşımıyor', () => {
  for (const ad of ['anadolu', 'botan', 'zap', 'harran', 'TKM-5501']) {
    const rumuz = takimRumuzu(ad).replace('Takım ', '');
    const a = ad.toUpperCase();
    // Rumuzun hiçbir 3-harfli parçası gerçek adda geçmemeli.
    for (let i = 0; i + 3 <= rumuz.length; i++) {
      assert.ok(
        !a.includes(rumuz.slice(i, i + 3)),
        `"${ad}" → "${rumuz}" gerçek adın parçasını sızdırıyor`,
      );
    }
  }
});

test('rumuz kararlı — aynı girdi her zaman aynı çıktı', () => {
  assert.equal(takimRumuzu('anadolu'), takimRumuzu('anadolu'));
  assert.equal(raporRumuzu('abc-123'), raporRumuzu('abc-123'));
});

test('farklı takımlar farklı rumuz alıyor', () => {
  const rumuzlar = ['anadolu', 'botan', 'zap', 'harran', 'ege', 'bogazici']
    .map(takimRumuzu);
  assert.equal(new Set(rumuzlar).size, rumuzlar.length, 'rumuz çakışması');
});

test('başvuru numarası ad sızdırmıyor', () => {
  // "TF-ZAP" gibi numaralar takım kısaltması taşıyabiliyor; son üç hane
  // alınsaydı doğrudan adı verirdi.
  assert.ok(!basvuruRumuzu('TF-ZAP').includes('ZAP'));
});

test('aynı takımın iki raporu farklı rapor koduyla ayrılıyor', () => {
  const a = raporuMaskele(
    { id: 'rapor-1', takim: 'Anadolu', takimId: 'anadolu', basvuruNo: 'TF-1' },
    true,
  );
  const b = raporuMaskele(
    { id: 'rapor-2', takim: 'Anadolu', takimId: 'anadolu', basvuruNo: 'TF-2' },
    true,
  );
  assert.equal(a.takim, b.takim, 'aynı takım aynı rumuzu almalı');
  assert.notEqual(a.raporKodu, b.raporKodu, 'raporlar ayırt edilemiyor');
});

test('maskeleme kapalıyken gerçek değerler dönüyor', () => {
  const m = raporuMaskele(
    { id: 'r1', takim: 'Anadolu', takimId: 'anadolu', basvuruNo: 'TF-9' },
    false,
  );
  assert.equal(m.takim, 'Anadolu');
  assert.equal(m.basvuruNo, 'TF-9');
  assert.equal(m.maskeli, false);
});

test('metin içindeki takım adı da maskeleniyor', () => {
  const metin = 'Anadolu Takımı olarak bu projede sıra takibi geliştirdik.';
  const sonuc = metindeMaskele(metin, [{ ad: 'Anadolu', rumuz: 'Takım 8EM8' }]);
  assert.ok(!sonuc.includes('Anadolu'), 'gövdedeki ad sızdı');
  assert.ok(sonuc.includes('Takım 8EM8'));
});

test('çok kısa ad metinde maskelenmiyor — okunmaz hale getirirdi', () => {
  const metin = 'Bu bir deneme metnidir.';
  assert.equal(metindeMaskele(metin, [{ ad: 'bu', rumuz: 'X' }]), metin);
});
