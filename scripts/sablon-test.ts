/** İki gerçek TEKNOFEST şablonunu çıkarıp karşılaştırır. */
import { readFileSync } from 'node:fs';
import { sablonCikar, rubrikCikar } from '../src/lib/analiz/sablon-cikar';

const KALIN = '\x1b[1m', R = '\x1b[0m', SOLUK = '\x1b[2m', YESIL = '\x1b[32m', SARI = '\x1b[33m';

function goster(yol: string, kod: string, ad: string) {
  const c = sablonCikar(new Uint8Array(readFileSync(yol)), kod, ad, 2026);
  const rubrik = rubrikCikar(c);

  console.log(`\n${KALIN}${'═'.repeat(76)}\n${ad}${R}\n`);
  console.log(`${KALIN}BAŞLIKLAR (${c.sablon.basliklar.length})${R}`);
  for (const b of c.sablon.basliklar) {
    const puan = b.puan ? `${String(b.puan).padStart(3)} p` : '  — ';
    const bayrak = b.raporda === false ? ` ${SARI}[raporda olmamalı]${R}` : '';
    const kelime = b.asgariKelime ? ` ${SOLUK}(${b.asgariKelime}-${b.azamiKelime} kelime)${R}` : '';
    console.log(`  ${puan}  ${b.ad.slice(0, 46).padEnd(48)} ${SOLUK}${(b.yonergeMetni?.length ?? 0)} yönerge${R}${bayrak}${kelime}`);
  }

  console.log(`\n${KALIN}KURALLAR${R}`);
  const k = c.kurallar;
  console.log(`  sayfa: ${k.asgariSayfa ?? '—'} – ${k.azamiSayfa ?? '—'}`);
  console.log(`  yazı tipi: ${k.yaziTipi ?? '—'} ${k.govdePunto ?? '?'}pt · başlık ${k.baslikPunto ?? '?'}pt`);
  console.log(`  atıf biçimi: ${k.atifBicimi ?? '—'}`);
  console.log(`  eleyici hüküm: ${k.eleyiciMi ? `${SARI}VAR — şablona uymayan rapor değerlendirilmiyor${R}` : 'yok'}`);
  console.log(`  ${k.ham.length} kural cümlesi ayıklandı`);

  console.log(`\n${KALIN}KAYNAKÇA BÖLÜMÜ${R}`);
  console.log(`  ad: ${c.sablon.kaynakca?.adlar[0] ?? 'BULUNAMADI'}`);
  if (c.ornekKaynaklar.length) {
    console.log(`  ${SOLUK}şablonun örnek künyeleri (raporda kalırsa bulgu):${R}`);
    c.ornekKaynaklar.forEach((x) => console.log(`    · ${x.slice(0, 66)}`));
  }

  console.log(`\n${KALIN}ÇIKARILAN RUBRİK — MVP 6${R}   ${YESIL}toplam ${rubrik.toplamPuan} puan${R}`);
  for (const kr of rubrik.kriterler) {
    console.log(`  ${String(kr.puan).padStart(3)} p  ${kr.ad.slice(0, 44).padEnd(46)} ${SOLUK}${kr.olcut.length} ölçüt cümlesi${R}`);
  }

  if (c.uyarilar.length) {
    console.log(`\n${SARI}UYARILAR${R}`);
    c.uyarilar.forEach((u) => console.log(`  ⚠ ${u}`));
  }
}

goster('../ornek_rapor/2026_HYZ_OTR_Sablon_TR_RKgye (4).docx', 'hyz-otr-2026', 'Havacılıkta Yapay Zeka · Ön Tasarım Raporu');
goster('../ornek_rapor/maden teknolojileri/Maden_Teknolojileri_Yarısması_2026_ODR_Sablonu_2_RflR2_m6Pf5.docx', 'maden-odr-2026', 'Maden Teknolojileri · Ön Değerlendirme Raporu');
