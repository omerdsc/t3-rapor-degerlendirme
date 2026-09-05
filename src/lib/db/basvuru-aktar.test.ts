import assert from 'node:assert/strict';
import test from 'node:test';
import { listeCozumle } from './basvuru-aktar';

test('Excel yapıştırması — sekme ayırıcı', () => {
  const { satirlar, hatali } = listeCozumle(
    'TF-2026-04871\tTakım Ege\tEGE01\tAkıllı Sulama Sistemi\tege@okul.edu.tr\n'
    + 'TF-2026-04872\tTakım Anadolu\tANA07\tGüneş Takip Düzeneği',
  );
  assert.equal(hatali.length, 0);
  assert.equal(satirlar.length, 2);
  assert.deepEqual(satirlar[0], {
    basvuruNo: 'TF-2026-04871',
    takim: 'Takım Ege',
    takimId: 'EGE01',
    proje: 'Akıllı Sulama Sistemi',
    eposta: 'ege@okul.edu.tr',
  });
  assert.equal(satirlar[1].eposta, undefined);
});

test('SEKMELER KORUNUYOR — onarım alan başına uygulanmalı', () => {
  /*
   * Bu testin var olma sebebi ölçülmüş bir hata: `onar()` satırın
   * tamamına uygulanıyordu ve son adımı `[ \t]+ → ' '` olduğu için
   * sekmeleri siliyordu. Sonuç: satır tek alana düşüyor, ayırıcı seçimi
   * virgüle kayıyor ve başvuru numarası takım adının içinde kalıyordu.
   * Canlıda görülen çıktı buydu:
   *   takim = "TF-2026-04871 Takım Ege EGE01 Akıllı Sulama Sistemi"
   */
  const { satirlar } = listeCozumle(
    'TF-2026-04871\tTakım Ege\tEGE01\tAkıllı Sulama Sistemi',
  );
  assert.equal(satirlar[0].basvuruNo, 'TF-2026-04871');
  assert.equal(satirlar[0].takim, 'Takım Ege');
  assert.equal(satirlar[0].takimId, 'EGE01');
  assert.equal(satirlar[0].proje, 'Akıllı Sulama Sistemi');
});

test('mojibake alan içinde onarılıyor', () => {
  // Onarım kaybolmadı, yalnızca yeri değişti: sütun yapısını bozmadan
  // bozuk Türkçe karakterleri hâlâ düzeltiyor.
  const { satirlar } = listeCozumle('TF-2026-1\tTakÄ±m Ege\tEGE01');
  assert.equal(satirlar[0].takim, 'Takım Ege');
});

test('Türkçe proje adındaki virgül alanı bölmüyor', () => {
  /*
   * Bu testin var olma sebebi: "Sıfır Atık, Sıfır İsraf" gibi adlar
   * yaygın. Virgül önce denenseydi proje adı ikiye bölünür ve ikinci
   * yarısı e-posta sütunu sanılırdı.
   */
  const { satirlar } = listeCozumle('TF-2026-1\tTakım Su\tSU1\tSıfır Atık, Sıfır İsraf');
  assert.equal(satirlar[0].proje, 'Sıfır Atık, Sıfır İsraf');
});

test('noktalı virgül ayırıcı', () => {
  const { satirlar } = listeCozumle('TF-2026-04871;Takım Ege;EGE01;Akıllı Sulama');
  assert.equal(satirlar[0].takim, 'Takım Ege');
  assert.equal(satirlar[0].proje, 'Akıllı Sulama');
});

test('virgül yalnızca sekme ve noktalı virgül yokken', () => {
  const { satirlar } = listeCozumle('TF-2026-04871,Takım Ege,EGE01,Akıllı Sulama');
  assert.equal(satirlar[0].takim, 'Takım Ege');
  assert.equal(satirlar[0].proje, 'Akıllı Sulama');
});

test('başvuru numarasız liste — numarayı sistem üretecek', () => {
  const { satirlar, hatali } = listeCozumle('Takım Ege\tEGE01\tAkıllı Sulama');
  assert.equal(hatali.length, 0);
  assert.equal(satirlar[0].basvuruNo, undefined);
  assert.equal(satirlar[0].takim, 'Takım Ege');
  assert.equal(satirlar[0].takimId, 'EGE01');
});

test('takım kimliği sütunu yoksa üçüncü alan proje adı sayılıyor', () => {
  const { satirlar } = listeCozumle('TF-2026-1\tTakım Ege\tAkıllı Sulama Sistemi');
  assert.equal(satirlar[0].takimId, undefined);
  assert.equal(satirlar[0].proje, 'Akıllı Sulama Sistemi');
});

test('başlık satırı atlanıyor', () => {
  const { satirlar } = listeCozumle(
    'Başvuru No\tTakım Adı\tProje\n'
    + 'TF-2026-04871\tTakım Ege\tAkıllı Sulama',
  );
  assert.equal(satirlar.length, 1);
  assert.equal(satirlar[0].basvuruNo, 'TF-2026-04871');
});

test('yalnızca takım adı yeterli', () => {
  const { satirlar, hatali } = listeCozumle('Takım Ege');
  assert.equal(hatali.length, 0);
  assert.equal(satirlar[0].takim, 'Takım Ege');
});

test('yalnızca numara olan satır hatalı — takım adı zorunlu', () => {
  const { satirlar, hatali } = listeCozumle('TF-2026-04871');
  assert.equal(satirlar.length, 0);
  assert.equal(hatali.length, 1);
  assert.match(hatali[0].sebep, /Takım adı/);
});

test('boş satırlar atlanıyor, satır numarası korunuyor', () => {
  const { satirlar, hatali } = listeCozumle('Takım Ege\n\n\nTF-2026-1\n');
  assert.equal(satirlar.length, 1);
  assert.equal(hatali[0].satir, 4);
});

test('tırnak içine alınmış alanlar temizleniyor', () => {
  const { satirlar } = listeCozumle('"TF-2026-1","Takım Ege","EGE01","Akıllı Sulama"');
  assert.equal(satirlar[0].basvuruNo, 'TF-2026-1');
  assert.equal(satirlar[0].proje, 'Akıllı Sulama');
});

test('e-posta hangi sütunda olursa olsun bulunuyor', () => {
  const { satirlar } = listeCozumle('TF-2026-1\tTakım Ege\tege@okul.edu.tr');
  assert.equal(satirlar[0].eposta, 'ege@okul.edu.tr');
  // E-posta proje adı sanılmamalı.
  assert.equal(satirlar[0].proje, undefined);
});
