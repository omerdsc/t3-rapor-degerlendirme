/**
 * kimlikCikar() sınaması — gerçek şablonlarda görülen dört biçim.
 *
 * Elimizdeki iki gerçek raporun kapağında etiketli alan METİN KATMANINDA
 * yok (tabloya/görsele gömülü), bu yüzden mantık sentetik satırlarla
 * sınanıyor. Biçimler uydurma değil: HYZ ve Robolig şablonlarının
 * kapağından alındı ("Takım Adı:", "Takım ID:", "Başvuru ID:").
 */
import { kimlikCikar, kimlikKarsilastir } from '../src/lib/analiz/kimlik';
import type { Belge, Satir } from '../src/lib/analiz/tipler';

function belgeKur(satirlar: string[]): Belge {
  return {
    metin: satirlar.join('\n'),
    sayfaSayisi: 1,
    kelimeSayisi: satirlar.join(' ').split(/\s+/).length,
    satirlar: satirlar.map(
      (metin, i): Satir => ({
        metin,
        sayfa: 1,
        x: 60,
        y: 700 - i * 20,
        punto: 12,
        kalinMi: false,
        yinelenen: false,
      }),
    ),
    basliklar: [],
    bolumler: [],
    gorseller: [],
    sayfalar: [{ sayfa: 1, ogeler: [], gorseller: [] }],
  } as unknown as Belge;
}

const DURUMLAR: Array<[string, string[]]> = [
  [
    'aynı satırda',
    [
      'HAVACILIKTA YAPAY ZEKA YARIŞMASI ÖN TASARIM RAPORU',
      'Takım Adı: Anadolu Kartalları',
      'Takım ID: TKM-4471',
      'Başvuru ID: TF-2026-004181',
    ],
  ],
  [
    'ayrı satırda (tablo hücreleri)',
    [
      'ÖN TASARIM RAPORU',
      'Takım Adı:',
      'Boğaziçi Otonom',
      'Takım ID:',
      'TKM-9902',
      'Başvuru ID:',
      'TF-2026-007713',
    ],
  ],
  [
    'etiket satır sonunda',
    [
      'ROBOLİG YARIŞMASI ÖN DEĞERLENDİRME RAPORU Takım Adı: Ege Robotik',
      'Takım Seviyesi: Lise',
      'Proje Adı: Otonom Depo Robotu',
    ],
  ],
  [
    'boş bırakılmış alanlar',
    [
      'Takım Adı: ......................',
      'Takım ID: {takım kimliğinizi yazın}',
      'Başvuru ID:',
      'Proje Adı:',
    ],
  ],
];

for (const [ad, satirlar] of DURUMLAR) {
  const k = kimlikCikar(belgeKur(satirlar));
  console.log(`\n[${ad}]`);
  console.log(`  bulunan : ${k.bulunan.join(', ') || '(yok)'}`);
  console.log(`  takımAdı: ${k.takimAdi ?? '—'}`);
  console.log(`  takımID : ${k.takimId ?? '—'}`);
  console.log(`  başvuru : ${k.basvuruId ?? '—'}`);
  console.log(`  proje   : ${k.projeAdi ?? '—'}`);
  if (k.seviye) console.log(`  seviye  : ${k.seviye}`);
}

console.log('\n=== UYUŞMAZLIK KARŞILAŞTIRMASI ===');
const k = kimlikCikar(
  belgeKur([
    'Takım Adı: Anadolu Kartalları',
    'Takım ID: TKM-4471',
    'Başvuru ID: TF-2026-004181',
  ]),
);
const testler: Array<[string, Parameters<typeof kimlikKarsilastir>[1]]> = [
  [
    'birebir aynı',
    { takim: 'Anadolu Kartalları', takimId: 'TKM-4471', basvuruNo: 'TF-2026-004181' },
  ],
  [
    'harf/sıra farkı',
    { takim: 'KARTALLARI ANADOLU', takimId: 'tkm-4471', basvuruNo: 'TF-2026-004181' },
  ],
  [
    'başka takım',
    { takim: 'Boğaziçi Otonom', takimId: 'TKM-9902', basvuruNo: 'TF-2026-007713' },
  ],
  ['girilmemiş', { takim: 'Belirtilmemiş', takimId: undefined, basvuruNo: undefined }],
];
for (const [ad, girilen] of testler) {
  const u = kimlikKarsilastir(k, girilen);
  console.log(
    `  ${ad.padEnd(18)} → ${
      u.length ? `${u.map((x) => x.alan).join(', ')} uyuşmuyor` : 'uyumlu'
    }`,
  );
}
