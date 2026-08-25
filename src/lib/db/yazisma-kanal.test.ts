import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  hakeminGorebilecekleri, kurulAcikMi, type KanalMesaji,
} from './yazisma-kanal';

const h = (id: string, tamamladi: boolean) => ({ id, tamamladi });
const m = (
  kanal: KanalMesaji['kanal'],
  rol: KanalMesaji['rol'],
  hakemId?: string,
): KanalMesaji => ({ kanal, rol, hakemId });

// ───────────────────────────────────────────── kurul kilidi

test('tek hakemli raporda kurul YOK', () => {
  // Kurul, hakemlerin birbiriyle konuştuğu yer; tek kişi varsa anlamsız.
  assert.equal(kurulAcikMi([h('a', true)]), false);
});

test('hakem atanmamışsa kurul yok', () => {
  assert.equal(kurulAcikMi([]), false);
});

test('biri bitirmediyse kurul KAPALI', () => {
  assert.equal(kurulAcikMi([h('a', true), h('b', false)]), false);
});

test('hepsi bitirince kurul açılıyor', () => {
  assert.equal(kurulAcikMi([h('a', true), h('b', true)]), true);
});

test('üç hakemde de kural aynı', () => {
  assert.equal(kurulAcikMi([h('a', true), h('b', true), h('c', false)]), false);
  assert.equal(kurulAcikMi([h('a', true), h('b', true), h('c', true)]), true);
});

// ───────────────────────────────────────────── görünürlük

test('hakem ÖTEKİ hakemin koordinasyon mesajını göremiyor', () => {
  /*
   * Düzeltilen asıl sızıntı bu: A hakemi, B'nin koordinasyona yazdığı
   * "bu rapor zayıf" notunu puanlamadan önce okuyabiliyordu.
   */
  const hepsi = [
    m('koordinasyon', 'hakem', 'A'),
    m('koordinasyon', 'hakem', 'B'),
  ];
  const gorunen = hakeminGorebilecekleri(hepsi, 'A', false);
  assert.equal(gorunen.length, 1);
  assert.equal(gorunen[0].hakemId, 'A');
});

test('hakem kendi koordinasyon yazışmasını görüyor', () => {
  const hepsi = [m('koordinasyon', 'hakem', 'A')];
  assert.equal(hakeminGorebilecekleri(hepsi, 'A', false).length, 1);
});

test('koordinasyonun O HAKEME yanıtı görünüyor, başkasınınki görünmüyor', () => {
  const hepsi = [
    m('koordinasyon', 'koordinasyon', 'A'),
    m('koordinasyon', 'koordinasyon', 'B'),
  ];
  const gorunen = hakeminGorebilecekleri(hepsi, 'A', false);
  assert.equal(gorunen.length, 1);
  assert.equal(gorunen[0].hakemId, 'A');
});

test('kimliksiz koordinasyon mesajı herkese açık duyuru sayılıyor', () => {
  const hepsi = [m('koordinasyon', 'koordinasyon', undefined)];
  assert.equal(hakeminGorebilecekleri(hepsi, 'A', false).length, 1);
});

test('sistem mesajı herkese görünüyor', () => {
  // "Rapor tamamlandı" gibi kayıtlar ortak bilgi.
  const hepsi = [m('koordinasyon', 'sistem', undefined)];
  assert.equal(hakeminGorebilecekleri(hepsi, 'A', false).length, 1);
});

test('KURUL KAPALIYKEN kurul mesajı okunamıyor', () => {
  const hepsi = [m('kurul', 'hakem', 'B')];
  assert.equal(hakeminGorebilecekleri(hepsi, 'A', false).length, 0);
});

test('kurul açıkken ÖTEKİ hakemin mesajı okunuyor', () => {
  const hepsi = [m('kurul', 'hakem', 'B')];
  const gorunen = hakeminGorebilecekleri(hepsi, 'A', true);
  assert.equal(gorunen.length, 1);
  assert.equal(gorunen[0].hakemId, 'B');
});

test('kurul açılsa bile koordinasyon kanalı özel kalıyor', () => {
  /*
   * Kurulun açılması, B'nin koordinasyonla yaptığı özel yazışmayı
   * A'ya açmıyor. İki kanal ayrı ve öyle kalıyor.
   */
  const hepsi = [
    m('koordinasyon', 'hakem', 'B'),
    m('kurul', 'hakem', 'B'),
  ];
  const gorunen = hakeminGorebilecekleri(hepsi, 'A', true);
  assert.equal(gorunen.length, 1);
  assert.equal(gorunen[0].kanal, 'kurul');
});
