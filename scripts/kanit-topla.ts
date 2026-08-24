/**
 * Şartname zorunluluklarının karşılandığına dair ÖLÇÜLMÜŞ kanıt toplar.
 *
 * İddia değil ölçüm: her satır depodan ya da çalışan koddan okunuyor.
 * Çıktısı `docs/kanit.md` içine gömülüyor ve jüriye sunulan izlenebilirlik
 * tablosunun kaynağı bu.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  parmakiziSayisi, raporlariListele, yarismalariListele,
} from '../src/lib/depo/depo';
import { profilleriOku } from '../src/lib/analiz/terim-depo';

const KALIN = '\x1b[1m', R = '\x1b[0m', SOLUK = '\x1b[2m';

function say(yol: string): number {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), yol), 'utf-8')).yarismalar?.length ?? 0;
  } catch {
    return 0;
  }
}

const y = yarismalariListele();
const raporlar = y.flatMap((x) => raporlariListele(x.id));
const kategoriler = y.flatMap((x) => x.kategoriler);

// Hangi kontrol kodları gerçekten üretilmiş?
const kontrolKodlari = new Map<string, number>();
const bulguKodlari = new Map<string, number>();
for (const r of raporlar) {
  for (const k of r.kontroller) {
    kontrolKodlari.set(k.kod, (kontrolKodlari.get(k.kod) ?? 0) + 1);
    for (const b of k.bulgular) {
      bulguKodlari.set(b.kod, (bulguKodlari.get(b.kod) ?? 0) + 1);
    }
  }
}

const dv = raporlar.filter((r) => r.kaynakDogrulamasi);
const dogrulanan = dv.reduce((t, r) => t + (r.kaynakDogrulamasi?.dogrulanan ?? 0), 0);
const indekssiz = dv.reduce((t, r) => t + (r.kaynakDogrulamasi?.indekslenemez ?? 0), 0);

const ai = raporlar.filter((r) => r.aiDegerlendirme);
const maliyet = ai.reduce((t, r) => t + (r.aiDegerlendirme?.kullanim.maliyet ?? 0), 0);
const tamam = raporlar.filter((r) => r.durum === 'tamamlandi');
const sapmalar = tamam
  .filter((r) => r.aiDegerlendirme && r.hakemToplam !== undefined)
  .map((r) => Math.abs(r.hakemToplam! - r.aiDegerlendirme!.aiToplam));

console.log(`${KALIN}KAPSAM${R}`);
console.log(`  katalogdaki yarışma          ${say('veri/katalog.json')}`);
console.log(`  kurulu yarışma               ${y.length}`);
console.log(`  kategori                     ${kategoriler.length}`);
console.log(`  şartnamesi bağlı             ${kategoriler.filter((k) => k.sartname).length}`);
console.log(`  teknik şartnameli            ${kategoriler.filter((k) => k.sartname?.teknikMi).length}`);
console.log(`  yapay zekâ özeti hazır       ${kategoriler.filter((k) => k.sartname?.ozet).length}`);
console.log(`  yönetici onaylı              ${kategoriler.filter((k) => k.duzenlendi).length}`);
console.log(`  terim profili                ${profilleriOku().length}`);

console.log(`\n${KALIN}RAPORLAR${R}`);
console.log(`  yüklenmiş                    ${raporlar.length}`);
/*
 * Parmak izleri AYRI TABLODA.
 *
 * Rapor başına ~40 KB olduğu için `rapor` tablosundan ayrıldı ve
 * `raporlariListele()` bunları getirmiyor — liste ekranlarına gereksiz
 * yük olurdu. Bu satır `r.parmakizi` okumaya devam ettiği için sayı
 * yanlış (0) çıkıyordu; kanıt tablosu olduğu iddia edilen yerde yanlış
 * sayı, hiç sayı olmamasından kötü.
 */
console.log(`  parmak izi çıkarılmış        ${parmakiziSayisi()}`);
console.log(`  kaynak doğrulaması yapılmış  ${dv.length}`);
console.log(`  yapay zekâ değerlendirmesi   ${ai.length}`);
console.log(`  hakem tamamladı              ${tamam.length}`);

console.log(`\n${KALIN}ÇALIŞAN KONTROLLER${R} ${SOLUK}(rapor kaydından okundu)${R}`);
for (const [kod, n] of [...kontrolKodlari].sort()) {
  console.log(`  ${kod.padEnd(14)} ${n} raporda`);
}

console.log(`\n${KALIN}ÜRETİLMİŞ BULGU KODLARI${R}`);
for (const [kod, n] of [...bulguKodlari].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${kod.padEnd(28)} ${n}`);
}

console.log(`\n${KALIN}KAYNAK DOĞRULAMA${R}`);
console.log(`  akademik indekste doğrulandı ${dogrulanan}`);
console.log(`  indekslenemez (web/blog vb.) ${indekssiz}`);

console.log(`\n${KALIN}MALİYET${R}`);
console.log(`  yapay zekâ ile değerlendirme $${maliyet.toFixed(4)} / ${ai.length} rapor`);
console.log(`  rapor başına                 $${ai.length ? (maliyet / ai.length).toFixed(4) : '0'}`);
console.log(`  yapay zekâsız kontroller     $0`);

if (sapmalar.length) {
  const ort = sapmalar.reduce((a, b) => a + b, 0) / sapmalar.length;
  console.log(`\n${KALIN}HAKEM–YAPAY ZEKÂ FARKI${R}`);
  console.log(`  ölçülen değerlendirme        ${sapmalar.length}`);
  console.log(`  ortalama fark                ${ort.toFixed(1)} puan`);
  console.log(`  ±5 puan içinde               ${sapmalar.filter((s) => s <= 5).length}/${sapmalar.length}`);
}

console.log(`\n${KALIN}TEST VERİSİ${R}`);
for (const [ad, yol] of [
  ['yapısal fikstür', 'test-verisi/raporlar/manifest.json'],
  ['benzerlik korpusu', 'test-verisi/korpus/manifest.json'],
] as const) {
  if (!existsSync(yol)) continue;
  const m = JSON.parse(readFileSync(yol, 'utf-8'));
  const n = Array.isArray(m) ? m.length : (m.takimlar ?? m.raporlar ?? []).length;
  console.log(`  ${ad.padEnd(28)} ${n} rapor`);
}
