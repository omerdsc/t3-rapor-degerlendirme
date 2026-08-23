/**
 * Türkçe metin onarımı ve normalleştirme.
 *
 * Bu modül her şeyin temeli: onar() bozuk okursa hiçbir başlık eşleşmez,
 * anahtar() yanlış eşlerse bütün karşılaştırmalar bozulur. Buradaki
 * vakaların hepsi gerçek belgelerde karşılaşılmış durumlar.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anahtar, onar } from './normalize';

test('mojibake onarılıyor — gerçek PDF font kodlaması', () => {
  // "Ýçindekiler" gibi bozulmalar gerçek raporlarda görüldü.
  assert.equal(onar('Ýçindekiler'), 'İçindekiler');
  assert.equal(onar('Ýþ Planý'), 'İş Planı');
});

test('cp1254 onarımı KOŞULLU — düzgün Türkçe varsa dokunmuyor', () => {
  /*
   * þ, ð, ý İzlandaca'da gerçek harfler. Belgede düzgün ş/ğ/ı varsa
   * doğru okunmuş demektir; künyedeki "Þórsson" bozulmamalı.
   */
  const turkce = 'Şahin, A. ve Þórsson, B. (2024). Bir çalışma.';
  assert.ok(onar(turkce).includes('Þórsson'), 'İzlandaca künye bozuldu');
  assert.ok(onar(turkce).includes('Şahin'), 'düzgün Türkçe bozuldu');
});

test('cp1254 onarımı bozuk belgede çalışıyor', () => {
  // Düzgün ş/ğ/ı yok, cp1254 izi var → yanlış kod sayfası kesin.
  assert.equal(onar('Ýþ Planý ve Baþlýk'), 'İş Planı ve Başlık');
});

test('ç/ö/ü onarımı engellemiyor — iki kod sayfasında aynı bayt', () => {
  /*
   * Bu vaka bir hatayı yakaladı: ilk koruma ç/ö/ü'yü de "düzgün Türkçe"
   * sayıyordu. Oysa bu harfler cp1254 ile cp1252'de aynı bayta düşüyor
   * ve yanlış çözümlemede bozulmadan geçiyorlar. "Ýçindekiler" hem bozuk
   * Ý hem sağlam ç taşıdığı için onarım hiç çalışmıyordu.
   */
  assert.equal(onar('Ýçindekiler'), 'İçindekiler');
});

test('ayrık aksan birleştiriliyor (NFC)', () => {
  // u + birleşik umlaut → ü. Bazı PDF üreticileri böyle yazıyor.
  const ayrik = 'Büÿuk';
  assert.notEqual(ayrik.length, onar(ayrik).length, 'birleştirme olmadı');
});

test('anahtar() i/ı ayrımını kaldırıyor', () => {
  // JS toLowerCase Türkçe I/ı ayrımını yanlış yapıyor; anahtar() düzeltir.
  assert.equal(anahtar('KATEGORİSİ'), anahtar('kategorisi'));
  assert.equal(anahtar('YARIŞMASI'), anahtar('yarışması'));
  assert.equal(anahtar('Takım'), anahtar('TAKIM'));
});

test('anahtar() aksanı düşürüyor ama sözcüğü korumuyor değil', () => {
  assert.equal(anahtar('Şartname'), 'sartname');
  assert.equal(anahtar('Öğrenci'), 'ogrenci');
  assert.equal(anahtar('Çevre ve Enerji'), 'cevre ve enerji');
});

test('anahtar() noktalamayı boşluğa çeviriyor', () => {
  assert.equal(anahtar('3.2. Algoritmalar'), '3 2 algoritmalar');
  assert.equal(anahtar('Kaynakça / References'), 'kaynakca references');
});

test('boş ve bozuk girdi çökmüyor', () => {
  assert.equal(anahtar(''), '');
  assert.equal(anahtar('   '), '');
  assert.equal(onar(''), '');
});
