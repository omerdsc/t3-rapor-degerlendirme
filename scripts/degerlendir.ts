/**
 * MVP 6 uçtan uca: şablon → rubrik → rapor → AI değerlendirmesi.
 *
 *   npx tsx scripts/degerlendir.ts <sablon.docx> <rapor.pdf> [--efor xhigh]
 *
 * Rubrik şablondan çıkarılır; elle kriter tanımlanmaz.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pdfOku } from '../src/lib/analiz/pdf';
import { belgeKur } from '../src/lib/analiz/yapi';
import { sekilleriCikar } from '../src/lib/analiz/gorsel';
import { sablonUyumu } from '../src/lib/analiz/sablon';
import { sablonCikar, rubrikCikar } from '../src/lib/analiz/sablon-cikar';
import { raporuDegerlendir } from '../src/lib/ai/degerlendirme';
import { ClaudeIstemcisi, ButceAsimiHatasi } from '../src/lib/ai/istemci';

const R = '\x1b[0m', KALIN = '\x1b[1m', SOLUK = '\x1b[2m';
const YESIL = '\x1b[32m', SARI = '\x1b[33m', KIRMIZI = '\x1b[31m', MAVI = '\x1b[36m';

const GUVEN_ROZET = {
  yuksek: `${YESIL}YÜKSEK${R}`,
  orta: `${MAVI} ORTA ${R}`,
  dusuk: `${SARI} DÜŞÜK${R}`,
} as const;

/** .env.local'i okur — tsx dotenv yüklemiyor. */
function ortamYukle() {
  if (!existsSync('.env.local')) return;
  for (const satir of readFileSync('.env.local', 'utf-8').split('\n')) {
    const m = satir.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const deger = m[2].trim().replace(/^["']|["']$/g, '');
    if (deger && !process.env[m[1]]) process.env[m[1]] = deger;
  }
}

async function main() {
  ortamYukle();

  const [sablonYolu, raporYolu] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const eforArg = process.argv.find((a) => a.startsWith('--efor='));
  const efor = (eforArg?.split('=')[1] ?? 'medium') as 'low' | 'medium' | 'high' | 'xhigh' | 'max';

  if (!sablonYolu || !raporYolu) {
    console.log('Kullanım: npx tsx scripts/degerlendir.ts <sablon.docx> <rapor.pdf> [--efor=xhigh]');
    return;
  }

  const anahtar = process.env.ANTHROPIC_API_KEY;
  if (!anahtar || anahtar.startsWith('buraya-')) {
    console.log(`${KIRMIZI}ANTHROPIC_API_KEY tanımlı değil.${R}`);
    console.log(`${SOLUK}.env.local dosyasındaki anahtarı doldurup kaydedin.${R}`);
    return;
  }

  // ---------------- rubrik şablondan
  const cikarim = sablonCikar(
    new Uint8Array(readFileSync(sablonYolu)),
    'yarisma',
    sablonYolu.split(/[\\/]/).pop() ?? 'Şablon',
    2026,
  );
  const rubrik = rubrikCikar(cikarim);

  console.log(`${KALIN}RUBRİK${R}  ${SOLUK}şablondan çıkarıldı · ${rubrik.toplamPuan} puan${R}`);
  rubrik.kriterler.forEach((k) =>
    console.log(`  ${String(k.puan).padStart(3)} p  ${k.ad.slice(0, 50)}`),
  );

  // ---------------- değerlendirme
  console.log(`\n${KALIN}DEĞERLENDİRME${R}  ${SOLUK}efor: ${efor} · ${rubrik.kriterler.length} kriter${R}\n`);

  // Rapor kendi ayrıştırıcımızla okunur; PDF modele hiç gitmez.
  const okuma = await pdfOku(new Uint8Array(readFileSync(raporYolu)));
  if (!okuma.tamam) { console.log(`${KIRMIZI}${okuma.hata}${R}`); return; }
  const belge = belgeKur(okuma.belge);

  // Şekiller ayrıca çıkarılır: yarışmacı akış şemasını çizip görsel olarak
  // eklemiş olabiliyor, yalnızca metne bakmak haksız puan kırıyor.
  const sekiller = await sekilleriCikar(new Uint8Array(readFileSync(raporYolu)), belge);
  console.log(
    `${SOLUK}rapor: ${belge.sayfaSayisi} sayfa · ${belge.kelimeSayisi} kelime · ` +
      `${belge.bolumler.length} bölüm · ${sekiller.length} şekil modele gidiyor${R}`,
  );
  sekiller.forEach((x) =>
    console.log(`${SOLUK}   şekil s.${x.sayfa} · ${x.bolum ?? '—'} · ${x.altYazi ?? ''}${R}`),
  );
  console.log();

  const istemci = new ClaudeIstemcisi({
    toplamTavan: Number(process.env.TOPLAM_TAVAN ?? 8),
    // Disk önbelleği: aynı rapor ikinci kez çalıştırılırsa para harcanmaz.
    diskOnbellegi: join(process.cwd(), '.onbellek'),
  });

  let sonuc;
  try {
    const uyum = sablonUyumu(belge, cikarim.sablon);
    if (uyum.eksikBolumler.length) {
      console.log(`${SARI}şablon uyumu %${Math.round(uyum.sablonSkoru * 100)} · eksik: ${uyum.eksikBolumler.join(', ')}${R}
`);
    }
    sonuc = await raporuDegerlendir(belge, rubrik, { istemci, efor, sekiller, uyum });
  } catch (e) {
    if (e instanceof ButceAsimiHatasi) {
      console.log(`${KIRMIZI}${e.message}${R}`);
      return;
    }
    throw e;
  }

  for (const k of sonuc.kriterler) {
    const oran = k.azamiPuan ? k.aiPuan / k.azamiPuan : 0;
    const renk = oran >= 0.7 ? YESIL : oran >= 0.4 ? SARI : KIRMIZI;
    console.log(
      `${KALIN}${k.ad}${R}\n` +
        `  ${renk}${k.aiPuan}${R}/${k.azamiPuan}  güven: ${GUVEN_ROZET[k.guven]}` +
        (k.hakemIncelemesiGerekli ? `  ${SARI}⚠ HAKEM İNCELESİN${R}` : ''),
    );
    console.log(`  ${SOLUK}${k.gerekce}${R}`);
    if (k.kanitlar.length) {
      const kn = k.kanitlar[0];
      console.log(`  ${SOLUK}kanıt${kn.sayfa ? ` (s.${kn.sayfa})` : ''}: "${kn.alinti.slice(0, 96)}…"${R}`);
      if (k.kanitlar.length > 1) console.log(`  ${SOLUK}+${k.kanitlar.length - 1} kanıt daha${R}`);
    }
    if (k.oneri) console.log(`  ${MAVI}öneri:${R} ${SOLUK}${k.oneri.slice(0, 110)}${R}`);
    console.log();
  }

  console.log(`${KALIN}${'─'.repeat(70)}${R}`);
  console.log(`${KALIN}AI ÖNERİSİ: ${sonuc.aiToplam}/${sonuc.azamiToplam}${R}`);
  if (sonuc.incelemeGereken) {
    console.log(`${SARI}${sonuc.incelemeGereken} kriterde hakem incelemesi isteniyor${R}`);
  }

  if (sonuc.genelGucluYonler.length) {
    console.log(`\n${KALIN}Güçlü yönler${R}`);
    sonuc.genelGucluYonler.forEach((x) => console.log(`  ${YESIL}+${R} ${x}`));
  }
  if (sonuc.genelGelisimAlanlari.length) {
    console.log(`\n${KALIN}Gelişime açık${R}`);
    sonuc.genelGelisimAlanlari.forEach((x) => console.log(`  ${SARI}−${R} ${x}`));
  }

  const u = sonuc.kullanim;
  console.log(`\n${KALIN}MALİYET${R}`);
  console.log(
    `  girdi ${u.girdiToken.toLocaleString('tr')} · çıktı ${u.ciktiToken.toLocaleString('tr')} · ` +
      `cache yazma ${u.cacheYazma.toLocaleString('tr')} · cache okuma ${u.cacheOkuma.toLocaleString('tr')}`,
  );
  console.log(`  ${KALIN}$${u.maliyet.toFixed(4)}${R} / rapor · ${(sonuc.sureMs / 1000).toFixed(1)} sn`);
  const i = istemci.istatistik;
  console.log(`  ${SOLUK}${i.cagriSayisi} çağrı · ${i.onbellekIsabeti} önbellek isabeti · kalan bütçe $${i.kalanButce.toFixed(2)}${R}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
