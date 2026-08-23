/**
 * Kimlik çıkarımının GERÇEK yükleme akışında koştuğunu doğrular.
 *
 * İki durum sınanıyor:
 *   1. kapak künyesi başvuruyla UYUŞUYOR  → uyarı çıkmamalı
 *   2. kapak künyesi başvuruyla ÇELİŞİYOR → uyuşmazlık bildirilmeli
 *
 * İkincisi gerçek bir vaka: yarışmacı başka bir takımın şablonunu doldurup
 * kendi başvurusuyla yüklemiş olabilir; ya da koordinasyon yanlış dosyayı
 * eşlemiştir. Sistemin bunu görmesi gerekiyor.
 */
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { raporYaz, type RaporTanimi } from './rapor-yazici';

const SUNUCU = 'http://localhost:3000';

/** Kapağa kimlik alanlarını ilk bölümün paragrafları olarak yerleştirir. */
function tanimKur(
  dosya: string,
  takimAdi: string,
  takimId: string,
  basvuruId: string,
): RaporTanimi {
  return {
    dosya,
    aciklama: 'kimlik çıkarımı sınaması',
    takim: takimAdi,
    takimId,
    proje: 'Kimlik Sınama Projesi',
    yil: 2026,
    kategori: 'tarim',
    bolumler: [
      {
        baslik: 'RAPOR KÜNYESİ',
        paragraflar: [
          `Takım Adı: ${takimAdi}`,
          `Takım ID: ${takimId}`,
          `Başvuru ID: ${basvuruId}`,
          'Proje Adı: Kimlik Sınama Projesi',
        ],
      },
      {
        baslik: '1. Proje Özeti',
        paragraflar: [
          'Bu rapor yalnızca kimlik çıkarımını sınamak için üretilmiştir. ' +
            'İçeriği değerlendirme amacı taşımaz ve gerçek bir başvuruyu temsil etmez.',
        ],
      },
    ],
  };
}

async function yukle(
  yol: string,
  yarismaId: string,
  kategoriId: string,
  form: { basvuruNo: string; takim: string; takimId: string; proje: string },
) {
  const govde = new FormData();
  govde.append('yarismaId', yarismaId);
  govde.append('kategoriId', kategoriId);
  govde.append('basvuruNo', form.basvuruNo);
  govde.append('takim', form.takim);
  govde.append('takimId', form.takimId);
  govde.append('proje', form.proje);
  govde.append(
    'dosya',
    new Blob([new Uint8Array(readFileSync(yol))], { type: 'application/pdf' }),
    yol.split(/[\\/]/).pop(),
  );

  const yanit = await fetch(`${SUNUCU}/api/rapor`, { method: 'POST', body: govde });
  const veri = await yanit.json();
  if (!yanit.ok) throw new Error(veri.hata ?? `HTTP ${yanit.status}`);
  return veri.rapor as {
    id: string;
    raporKimligi?: { bulunan: string[]; takimAdi?: string; takimId?: string; basvuruId?: string };
    kimlikUyusmazligi?: Array<{ alan: string; raporda: string; girilen: string }>;
  };
}

async function main() {
  const [yarismaId, kategoriId] = process.argv.slice(2);
  if (!yarismaId || !kategoriId) {
    console.log('kullanım: kimlik-uctan-uca.ts <yarismaId> <kategoriId>');
    return;
  }

  const klasor = mkdtempSync(join(tmpdir(), 'kimlik-'));

  // 1) Uyumlu
  const uyumlu = tanimKur('kimlik-uyumlu.pdf', 'Ege Robotik', 'TKM-5501', 'TF-2026-559001');
  await raporYaz(uyumlu, klasor);
  const a = await yukle(join(klasor, 'kimlik-uyumlu.pdf'), yarismaId, kategoriId, {
    basvuruNo: 'TF-2026-559001',
    takim: 'Ege Robotik',
    takimId: 'TKM-5501',
    proje: 'Kimlik Sınama Projesi',
  });
  console.log('\n[1] kapak ile başvuru UYUŞUYOR');
  console.log(`    okunan alanlar : ${a.raporKimligi?.bulunan.join(', ') || '(yok)'}`);
  console.log(`    kapaktaki takım: ${a.raporKimligi?.takimAdi ?? '—'}`);
  console.log(`    uyuşmazlık     : ${a.kimlikUyusmazligi?.length ?? 0}`);

  // 2) Çelişkili — kapakta başka takım, başvuruda başka takım
  const celiskili = tanimKur('kimlik-celiskili.pdf', 'Boğaziçi Otonom', 'TKM-9902', 'TF-2026-771300');
  await raporYaz(celiskili, klasor);
  const b = await yukle(join(klasor, 'kimlik-celiskili.pdf'), yarismaId, kategoriId, {
    basvuruNo: 'TF-2026-559002',
    takim: 'Ege Robotik',
    takimId: 'TKM-5501',
    proje: 'Kimlik Sınama Projesi',
  });
  console.log('\n[2] kapak ile başvuru ÇELİŞİYOR');
  console.log(`    okunan alanlar : ${b.raporKimligi?.bulunan.join(', ') || '(yok)'}`);
  console.log(`    kapaktaki takım: ${b.raporKimligi?.takimAdi ?? '—'}`);
  console.log(`    uyuşmazlık     : ${b.kimlikUyusmazligi?.length ?? 0}`);
  for (const u of b.kimlikUyusmazligi ?? []) {
    console.log(`      · ${u.alan}: raporda "${u.raporda}" ↔ başvuruda "${u.girilen}"`);
  }

  console.log(`\nrapor kimlikleri: ${a.id} · ${b.id}`);
}

main().catch((e) => {
  console.error('HATA:', e instanceof Error ? e.message : e);
  process.exit(1);
});
