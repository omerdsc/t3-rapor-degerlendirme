import assert from 'node:assert/strict';
import test from 'node:test';
import {
  epostaGecerli, epostaNormal, parolaDogrula, parolaOzetle, parolaSorunu,
} from './parola';

test('özet doğrulanıyor, yanlış parola reddediliyor', async () => {
  const o = await parolaOzetle('cok-guclu-parola');
  assert.ok(await parolaDogrula('cok-guclu-parola', o));
  assert.equal(await parolaDogrula('cok-guclu-parolb', o), false);
  assert.equal(await parolaDogrula('', o), false);
});

test('aynı parola her seferinde farklı özet üretiyor — tuz rastgele', async () => {
  const a = await parolaOzetle('ayni-parola');
  const b = await parolaOzetle('ayni-parola');
  assert.notEqual(a, b);
  // İkisi de doğrulanmalı: farklı tuz, aynı parola.
  assert.ok(await parolaDogrula('ayni-parola', a));
  assert.ok(await parolaDogrula('ayni-parola', b));
});

test('Türkçe karakterli parola çalışıyor', async () => {
  const o = await parolaOzetle('şifreÇğüöİı123');
  assert.ok(await parolaDogrula('şifreÇğüöİı123', o));
});

test('bozuk özet hata fırlatmıyor, false dönüyor', async () => {
  for (const bozuk of ['', 'abc', 'scrypt$', 'scrypt$16384$$', 'md5$1$a$b', 'scrypt$99$a$b']) {
    assert.equal(await parolaDogrula('x', bozuk), false, `bozuk: ${bozuk}`);
  }
});

test('parola uzunluk kuralı', () => {
  assert.match(parolaSorunu('kisa') ?? '', /8 karakter/);
  assert.equal(parolaSorunu('tamolarak8'), null);
  assert.match(parolaSorunu('        ') ?? '', /boşluk/);
});

test('E-POSTA TÜRKÇE YEREL AYAR TUZAĞI — I harfi ı olmamalı', () => {
  /*
   * Bu testin var olma sebebi: `toLowerCase()` Türkçe yerel ayarda
   * `I` → `ı` yapıyor. Kayıtta bir biçim, girişte başka biçim üretilseydi
   * kullanıcı bir daha asla giriş yapamazdı.
   */
  assert.equal(epostaNormal('ALI@OKUL.EDU.TR'), 'ali@okul.edu.tr');
  assert.equal(epostaNormal('  Ismail@X.COM '), 'ismail@x.com');
  // Sonuçta 'ı' hiç geçmemeli.
  assert.ok(!epostaNormal('ILHAN@X.COM').includes('ı'));
});

test('e-posta biçim denetimi', () => {
  assert.ok(epostaGecerli('ali@okul.edu.tr'));
  assert.ok(epostaGecerli('a.b+c@x.co'));
  assert.equal(epostaGecerli('aliokul.edu.tr'), false);
  assert.equal(epostaGecerli('ali@okul'), false);
  assert.equal(epostaGecerli('ali @okul.com'), false);
  assert.equal(epostaGecerli(''), false);
});
