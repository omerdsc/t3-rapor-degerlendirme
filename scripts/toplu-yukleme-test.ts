/**
 * Toplu yükleme sınaması — form alanı DOLDURULMADAN.
 *
 * Koordinasyonun gerçek kullanımı bu: 100 PDF sürükle, bırak, bekle.
 * Kimlik bilgisi elle girilmiyor; rapor kapağından okunması gerekiyor.
 * Okunamazsa raporlar birbirinden ayırt edilemez hale gelir.
 */
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { raporYaz, type RaporTanimi } from './rapor-yazici';

const SUNUCU = 'http://localhost:3000';
const YESIL = '\x1b[32m', KIRMIZI = '\x1b[31m', R = '\x1b[0m', SOLUK = '\x1b[2m';

const TAKIMLAR = [
  ['Ege Robotik', 'TKM-5501', 'TF-2026-559001', 'Otonom Depo Robotu'],
  ['Boğaziçi Otonom', 'TKM-9902', 'TF-2026-771300', 'Liman Yük Taşıma Sistemi'],
  ['Karadeniz Yazılım', 'TKM-3310', 'TF-2026-330014', 'Dere Taşkın Erken Uyarı'],
];

function tanim(ad: string, tid: string, bid: string, proje: string): RaporTanimi {
  return {
    dosya: `toplu-${tid.toLowerCase()}.pdf`,
    aciklama: 'toplu yükleme sınaması',
    takim: ad,
    takimId: tid,
    proje,
    yil: 2026,
    kategori: 'tarim',
    bolumler: [
      {
        baslik: 'RAPOR KÜNYESİ',
        paragraflar: [
          `Takım Adı: ${ad}`,
          `Takım ID: ${tid}`,
          `Başvuru ID: ${bid}`,
          `Proje Adı: ${proje}`,
        ],
      },
      {
        baslik: '1. Proje Özeti',
        paragraflar: [
          `${proje} kapsamında geliştirilen sistem, sahadan toplanan veriyi ` +
            'gömülü bir kart üzerinde işleyerek karar üretir. Bu rapor toplu ' +
            'yükleme akışını sınamak için üretilmiştir.',
        ],
      },
    ],
  };
}

async function main() {
  const [yarismaId, kategoriId] = process.argv.slice(2);
  if (!yarismaId || !kategoriId) {
    console.log('kullanım: toplu-yukleme-test.ts <yarismaId> <kategoriId>');
    return;
  }

  const klasor = mkdtempSync(join(tmpdir(), 'toplu-'));
  const yollar: string[] = [];
  for (const [ad, tid, bid, proje] of TAKIMLAR) {
    const t = tanim(ad, tid, bid, proje);
    await raporYaz(t, klasor);
    yollar.push(join(klasor, t.dosya));
  }

  console.log(`${yollar.length} rapor yükleniyor — form alanı GÖNDERİLMİYOR\n`);

  for (const yol of yollar) {
    const govde = new FormData();
    govde.append('yarismaId', yarismaId);
    govde.append('kategoriId', kategoriId);
    // Kimlik alanları BİLEREK boş: arayüzdeki toplu yükleme de göndermiyor.
    govde.append(
      'dosya',
      new Blob([new Uint8Array(readFileSync(yol))], { type: 'application/pdf' }),
      yol.split(/[\\/]/).pop(),
    );

    const yanit = await fetch(`${SUNUCU}/api/rapor`, { method: 'POST', body: govde });
    const veri = await yanit.json();
    if (!yanit.ok) {
      console.log(`${KIRMIZI}✕${R} ${veri.hata}`);
      continue;
    }
    const r = veri.rapor;
    const okundu = r.raporKimligi?.bulunan?.length ?? 0;
    const yerTutucu = r.takim === 'Belirtilmemiş';
    console.log(
      `${yerTutucu ? KIRMIZI + '✕' : YESIL + '●'}${R} ` +
        `${r.basvuruNo.padEnd(16)} ${r.takim.slice(0, 22).padEnd(22)} ` +
        `${SOLUK}${r.takimId.padEnd(10)} · kapaktan ${okundu} alan${R}`,
    );
  }

  console.log(
    `\n${SOLUK}Beklenen: hiçbir satırda "Belirtilmemiş" olmamalı — ` +
      `kimlik kapaktan okunmalı.${R}`,
  );
}

main().catch((e) => {
  console.error('HATA:', e instanceof Error ? e.message : e);
  process.exit(1);
});
