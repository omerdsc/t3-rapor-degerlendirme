import assert from 'node:assert/strict';
import test from 'node:test';
import { barajDurumu } from './baraj';

test('baraj tanımlı değilse durum yok', () => {
  assert.equal(barajDurumu({ puan: 40, tamamlandi: true }).durum, 'yok');
  assert.equal(barajDurumu({ baraj: null, puan: 40, tamamlandi: true }).durum, 'yok');
  assert.equal(barajDurumu({ baraj: 0, puan: 40, tamamlandi: true }).durum, 'yok');
});

test('DEĞERLENDİRME BİTMEDEN HÜKÜM YOK — en kritik kural', () => {
  /*
   * İki hakemden biri bitirmişken nihai puan tek kişinin puanıdır ve
   * ikinci hakem geldiğinde değişir. O ara değere bakıp "elendin"
   * demek, sonradan geçen yarışmacıya bir süre yanlış bilgi göstermek
   * olurdu.
   */
  const s = barajDurumu({ baraj: 70, puan: 41, tamamlandi: false });
  assert.equal(s.durum, 'beklemede');
  assert.equal(s.puan, undefined, 'bitmemiş puan dışarı verilmemeli');
  assert.equal(s.baraj, 70, 'eşik yine de gösterilebilir');
});

test('puan henüz yoksa beklemede', () => {
  assert.equal(barajDurumu({ baraj: 70, tamamlandi: true }).durum, 'beklemede');
  assert.equal(barajDurumu({ baraj: 70, puan: null, tamamlandi: true }).durum, 'beklemede');
});

test('barajın üstü geçer', () => {
  const s = barajDurumu({ baraj: 70, puan: 74.5, tamamlandi: true });
  assert.equal(s.durum, 'gecti');
  assert.equal(s.eksik, 0);
});

test('EŞİTLİK GEÇER — baraj "en az şu kadar" demektir', () => {
  assert.equal(barajDurumu({ baraj: 70, puan: 70, tamamlandi: true }).durum, 'gecti');
});

test('barajın altı geçemez ve eksik puan hesaplanır', () => {
  const s = barajDurumu({ baraj: 70, puan: 61.3, tamamlandi: true });
  assert.equal(s.durum, 'gecemedi');
  assert.equal(s.eksik, 8.7);
});

test('YUVARLAMA EKRANLA TUTARLI — 69,96 ekranda 70,0 görünür ve geçer', () => {
  /*
   * Ham değerle karşılaştırılsaydı yarışmacı ekranda "70,0" görüp
   * "70 barajını geçemediniz" cümlesini okurdu.
   */
  const s = barajDurumu({ baraj: 70, puan: 69.96, tamamlandi: true });
  assert.equal(s.puan, 70);
  assert.equal(s.durum, 'gecti');
});

test('69,94 ekranda 69,9 görünür ve geçemez — yuvarlama iki yönlü', () => {
  const s = barajDurumu({ baraj: 70, puan: 69.94, tamamlandi: true });
  assert.equal(s.puan, 69.9);
  assert.equal(s.durum, 'gecemedi');
  assert.equal(s.eksik, 0.1);
});

test('eksik puan ondalık artığı taşımıyor', () => {
  const s = barajDurumu({ baraj: 60, puan: 55.1, tamamlandi: true });
  assert.equal(s.eksik, 4.9, 'kayan nokta artığı olmamalı');
});
