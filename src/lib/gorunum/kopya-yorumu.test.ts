import assert from 'node:assert/strict';
import test from 'node:test';
import { kopyaYorumu, type KopyaOlcumu } from './kopya-yorumu';

const temel: KopyaOlcumu = {
  metinOrani: 0.2, kapsama: 0.25, gorselOrani: 0,
  cumleSayisi: 3, gorselSayisi: 0, ayniTakim: false,
};

test('AYNI TAKIM her şeyden önce geliyor', () => {
  /*
   * Aynı takımın ÖTR ve DTR raporu arasında yüksek örtüşme beklenen bir
   * şey. Kopya olarak sunulsaydı hakem olmayan bir sorunu incelerdi ve
   * gerçek bulgular gürültünün içinde kaybolurdu.
   */
  const y = kopyaYorumu({
    ...temel, metinOrani: 0.95, kapsama: 0.98, gorselOrani: 1,
    cumleSayisi: 40, gorselSayisi: 8, ayniTakim: true,
  });
  assert.equal(y.agirlik, 'ayniTakim');
  assert.match(y.baslik, /Aynı takım/);
  assert.match(y.aciklama, /devam projesi/);
});

test('yüksek metin + görsel → iki rapor büyük ölçüde aynı', () => {
  const y = kopyaYorumu({
    ...temel, metinOrani: 0.88, kapsama: 0.92, gorselOrani: 1,
    cumleSayisi: 30, gorselSayisi: 5,
  });
  assert.equal(y.agirlik, 'agir');
  assert.match(y.baslik, /büyük ölçüde aynı/);
  assert.match(y.aciklama, /%92/);
});

test('ŞEKİL KOPYASI ayrı sınıf — metin düşük, görsel yüksek', () => {
  /*
   * Klasik metin karşılaştırma araçlarının kaçırdığı durum ve sistemin
   * ayırt edici tarafı. "Düşük benzerlik" diye geçilseydi kaybolurdu.
   */
  const y = kopyaYorumu({
    ...temel, metinOrani: 0.12, kapsama: 0.15, gorselOrani: 0.97,
    cumleSayisi: 1, gorselSayisi: 6,
  });
  assert.equal(y.agirlik, 'agir');
  assert.match(y.baslik, /görseller kullanılmış/);
  assert.match(y.aciklama, /6 görsel/);
});

test('yalnızca metin ortak', () => {
  const y = kopyaYorumu({
    ...temel, metinOrani: 0.6, kapsama: 0.7, cumleSayisi: 18,
  });
  assert.equal(y.agirlik, 'agir');
  assert.match(y.baslik, /Metnin büyük kısmı/);
  assert.match(y.aciklama, /18 cümle/);
});

test('tek görsel eşleşmesi → incelenmeli', () => {
  const y = kopyaYorumu({ ...temel, gorselOrani: 0.9, gorselSayisi: 1 });
  assert.equal(y.agirlik, 'orta');
  assert.match(y.baslik, /Ortak görsel/);
});

test('düşük ama olağandışı benzerlik', () => {
  const y = kopyaYorumu({ ...temel, metinOrani: 0.3, kapsama: 0.35, cumleSayisi: 5 });
  assert.equal(y.agirlik, 'hafif');
  assert.match(y.baslik, /Olağandışı/);
});

test('hiçbir yorum "intihal" demiyor — karar hakemin', () => {
  const durumlar: KopyaOlcumu[] = [
    { ...temel, ayniTakim: true },
    { ...temel, metinOrani: 0.9, kapsama: 0.95, gorselSayisi: 4, gorselOrani: 1 },
    { ...temel, metinOrani: 0.1, gorselSayisi: 5, gorselOrani: 0.95 },
    { ...temel, kapsama: 0.6 },
    { ...temel, gorselSayisi: 1, gorselOrani: 0.8 },
    temel,
  ];
  for (const d of durumlar) {
    const y = kopyaYorumu(d);
    const metin = `${y.baslik} ${y.aciklama}`.toLocaleLowerCase('tr');
    assert.ok(!metin.includes('intihal'), `"intihal" geçmemeli: ${y.baslik}`);
    assert.ok(!metin.includes('kopyalamış'), `hüküm vermemeli: ${y.baslik}`);
  }
});

test('yüzdeler tam sayıya yuvarlanıyor', () => {
  const y = kopyaYorumu({ ...temel, kapsama: 0.6666, cumleSayisi: 9 });
  assert.match(y.aciklama, /%67/);
  assert.ok(!/%66\.\d/.test(y.aciklama));
});
