/**
 * CSV dışa aktarma.
 *
 * Bozulma sessiz olur: Excel dosyayı açar ama Türkçe karakterler kırılmış
 * ya da bütün satır tek hücreye girmiş olur. Bu testler o iki tuzağı ve
 * kaçış kurallarını koruyor.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dosyaAdiUret, kategoriCsv } from './disa-aktar';
import type { Rapor, Yarisma, YarismaKategorisi } from './tipler';

const kategori = {
  id: 'kat-1',
  ad: 'Test Kategorisi',
  sablonDosyasi: 'sablon.docx',
  olusturuldu: '2026-01-01',
  duzenlendi: true,
  sablon: { basliklar: [] },
  kurallar: {},
  rubrik: {
    kriterler: [
      { kod: 'ozet', ad: 'Proje Özeti', puan: 20, bolumBekleniyor: true, olcut: [] },
      { kod: 'yontem', ad: 'Yöntem', puan: 30, bolumBekleniyor: true, olcut: [] },
    ],
    toplamPuan: 50,
  },
  ornekKaynaklar: [],
  uyarilar: [],
} as unknown as YarismaKategorisi;

const yarisma = { id: 'y1', ad: 'Test Yarışması', yil: 2026 } as unknown as Yarisma;

function rapor(ek: Partial<Rapor> = {}): Rapor {
  return {
    id: 'r1',
    yarismaId: 'y1',
    kategoriId: 'kat-1',
    basvuruNo: 'TF-2026-001',
    dosyaAdi: 'rapor.pdf',
    takim: 'Ege Robotik',
    takimId: 'TKM-1',
    proje: 'Otonom Robot',
    yuklendi: '2026-01-02',
    durum: 'tamamlandi',
    kontroller: [],
    genelDurum: 'temiz',
    istatistik: {
      sayfaSayisi: 10, kelimeSayisi: 2000, gorselSayisi: 3,
      baslikSayisi: 7, taranmisMi: false, sureMs: 100,
    },
    ...ek,
  } as unknown as Rapor;
}

test('BOM ile başlıyor — Excel Türkçe karakterleri bozmasın', () => {
  const csv = kategoriCsv(yarisma, kategori, [rapor()]);
  assert.ok(csv.startsWith('﻿'), 'BOM yok');
});

test('ayıraç noktalı virgül — Türkçe Excel yereli', () => {
  const csv = kategoriCsv(yarisma, kategori, [rapor()]);
  const baslik = csv.split('\n')[0];
  assert.ok(baslik.includes(';'), 'noktalı virgül yok');
  assert.ok(baslik.split(';').length > 10, 'sütunlar ayrılmamış');
});

test('her ölçüt için ayrı sütun açılıyor', () => {
  const csv = kategoriCsv(yarisma, kategori, [rapor()]);
  const baslik = csv.split('\n')[0];
  assert.ok(baslik.includes('Proje Özeti (20)'));
  assert.ok(baslik.includes('Yöntem (30)'));
});

test('noktalı virgül içeren metin tırnaklanıyor', () => {
  const csv = kategoriCsv(yarisma, kategori, [
    rapor({ hakemNotu: 'İyi; ancak eksik' }),
  ]);
  assert.ok(csv.includes('"İyi; ancak eksik"'), 'kaçış yapılmadı');
});

test('tırnak içeren metin ikiye katlanıyor', () => {
  const csv = kategoriCsv(yarisma, kategori, [
    rapor({ hakemNotu: 'Rapor "iyi" düzeyde' }),
  ]);
  assert.ok(csv.includes('""iyi""'), 'tırnak kaçışı yapılmadı');
});

test('satır sonu hücreyi bölmüyor', () => {
  const csv = kategoriCsv(yarisma, kategori, [
    rapor({ hakemNotu: 'Birinci satır\nİkinci satır' }),
  ]);
  // Başlık + 1 veri satırı + son satır sonu = 3 parça
  assert.equal(csv.trim().split('\n').length, 2, 'not satırı böldü');
});

test('puanlanmamış ölçüt BOŞ kalıyor, sıfır yazılmıyor', () => {
  const csv = kategoriCsv(yarisma, kategori, [
    rapor({ hakemPuanlari: [{ kriterKodu: 'ozet', puan: 15 }] }),
  ]);
  const alanlar = csv.trim().split('\n')[1].split(';');
  // Ölçüt sütunları: 8. ve 9. (0'dan sayarak 7 ve 8)
  assert.equal(alanlar[7], '15');
  assert.equal(alanlar[8], '', 'puanlanmamış ölçüte 0 yazıldı');
});

test('maskeli aktarımda gerçek ad geçmiyor', () => {
  const csv = kategoriCsv(yarisma, kategori, [rapor()], { maskele: true });
  assert.ok(!csv.includes('Ege Robotik'), 'gerçek takım adı sızdı');
  assert.ok(!csv.includes('TF-2026-001'), 'gerçek başvuru numarası sızdı');
});

test('dosya adı Türkçe karakter ve boşluk içermiyor', () => {
  const ad = dosyaAdiUret('Havacılıkta Yapay Zekâ Yarışması', 'Lise · ÖDR');
  assert.ok(/^[a-z0-9-]+\.csv$/.test(ad), `güvensiz dosya adı: ${ad}`);
  assert.ok(ad.includes('havacilikta'));
});
