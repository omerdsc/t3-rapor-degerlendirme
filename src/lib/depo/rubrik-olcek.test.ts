import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Ölçekleme MATEMATİĞİ — depoya dokunmadan.
 *
 * `rubrigiOlcekle` veritabanı yazıyor; buradaki testler onun içindeki
 * hesabın aynısını sınıyor. Hesabı ayrı tutmanın sebebi şu: bir jüri
 * demosunda "ölçekle" düğmesine basılacak ve toplam 100 çıkmazsa bunu
 * herkes görecek. Yuvarlama artığı en sık yapılan hatadır.
 */
function olcekle(puanlar: number[], hedef = 100): number[] {
  const toplam = puanlar.reduce((t, x) => t + x, 0);
  if (!puanlar.length || toplam <= 0) return puanlar;
  const oran = hedef / toplam;
  const yeni = puanlar.map((x) => Math.round(x * oran * 10) / 10);
  const artik = Math.round((hedef - yeni.reduce((t, x) => t + x, 0)) * 10) / 10;
  if (artik !== 0) {
    let enBuyuk = 0;
    for (let i = 1; i < yeni.length; i++) if (yeni[i] > yeni[enBuyuk]) enBuyuk = i;
    yeni[enBuyuk] = Math.round((yeni[enBuyuk] + artik) * 10) / 10;
  }
  return yeni;
}

const toplam = (x: number[]) => Math.round(x.reduce((t, n) => t + n, 0) * 10) / 10;

test('toplam TAM 100 oluyor — yuvarlama artığı bırakmıyor', () => {
  for (const durum of [
    [10, 10, 10, 10, 10, 10, 10, 10, 10, 10],   // 100, zaten tam
    [15, 15, 15, 15, 20, 20, 20],               // 120
    [7, 7, 7, 7, 7, 7, 7],                      // 49
    [33, 33, 33],                               // 99 — klasik yuvarlama tuzağı
    [1, 1, 1],                                  // 3
    [50, 30, 21],                               // 101
  ]) {
    assert.equal(toplam(olcekle(durum)), 100, `toplam tutmadı: ${durum}`);
  }
});

test('AĞIRLIK ORANLARI KORUNUYOR — büyük ölçüt büyük kalıyor', () => {
  /*
   * Ölçeklemenin bütün amacı bu: yarışmanın kendi ağırlıklandırması
   * bozulmamalı. Bozulsaydı "Yöntem 30 puan" diyen bir şartname
   * sessizce başka bir şey söyler hâle gelirdi.
   */
  const once = [30, 20, 10, 60];
  const sonra = olcekle(once);
  const sira = (x: number[]) => [...x.keys()].sort((a, b) => x[b] - x[a]);
  assert.deepEqual(sira(sonra), sira(once));
  // 60/120 = yarısı; ölçekten sonra da yarısı olmalı
  assert.equal(sonra[3], 50);
});

test('artık EN BÜYÜK ölçüte veriliyor — oransal sapma en küçük orada', () => {
  const sonra = olcekle([33, 33, 33]);
  assert.equal(toplam(sonra), 100);
  // 33.3 x3 = 99.9; kalan 0.1 en büyüğe gidiyor (hepsi eşitse ilkine)
  assert.deepEqual(sonra, [33.4, 33.3, 33.3]);
});

test('boş ya da sıfır toplamlı rubrikte çökme yok', () => {
  assert.deepEqual(olcekle([]), []);
  assert.deepEqual(olcekle([0, 0]), [0, 0]);
});

test('100 dışında bir hedefe de ölçekleniyor', () => {
  assert.equal(toplam(olcekle([10, 20, 30], 60)), 60);
});
