/**
 * Atama → hakem puanlaması → sonuçların panele dönüşü.
 *
 * HTTP üzerinden, gerçek akışın kendisi. Sınanan davranışlar:
 *   · iki hakem aynı rapora atanabiliyor
 *   · her hakem kendi kodu ile YALNIZCA kendi işini görüyor
 *   · atanmamış rapora puan girilemiyor
 *   · iki puan birbirini EZMİYOR; nihai puan ortalama
 *   · bütün hakemler bitmeden rapor "tamamlandı" olmuyor
 */
const SUNUCU = 'http://localhost:3000';
const R = '\x1b[0m', KALIN = '\x1b[1m', YESIL = '\x1b[32m', KIRMIZI = '\x1b[31m';
const ok = (m: string) => console.log(`  ${YESIL}✓${R} ${m}`);
const hata = (m: string) => console.log(`  ${KIRMIZI}✕${R} ${m}`);

async function jget(yol: string) {
  const y = await fetch(`${SUNUCU}${yol}`);
  return { durum: y.status, veri: await y.json() };
}
async function jpost(yol: string, govde: unknown, yontem = 'POST') {
  const y = await fetch(`${SUNUCU}${yol}`, {
    method: yontem,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(govde),
  });
  return { durum: y.status, veri: await y.json() };
}

async function main() {
  // Değerlendirilmemiş bir rapor bul.
  const { veri: yv } = await jget('/api/yarisma');
  let hedef: { raporId: string; yarismaId: string; kategoriId: string; basvuruNo: string } | null = null;

  for (const y of yv.yarismalar) {
    const { veri } = await jget(`/api/rapor?yarisma=${y.id}`);
    for (const r of veri.raporlar ?? []) {
      if (r.durum !== 'tamamlandi') {
        hedef = { raporId: r.id, yarismaId: y.id, kategoriId: r.kategoriId, basvuruNo: r.basvuruNo };
        break;
      }
    }
    if (hedef) break;
  }
  if (!hedef) { console.log('değerlendirilmemiş rapor yok'); return; }
  console.log(`hedef rapor: ${hedef.basvuruNo}\n`);

  console.log(`${KALIN}1 · HAKEM KAYDI${R}`);
  const h1 = (await jpost('/api/hakem', { ad: 'Doç. Dr. Selin Aydın', kurum: 'YTÜ', uzmanlik: ['Maden'] })).veri.hakem;
  const h2 = (await jpost('/api/hakem', { ad: 'Dr. Burak Şen', kurum: 'Hacettepe', uzmanlik: ['İSG'] })).veri.hakem;
  ok(`${h1.ad} → ${h1.kod}`);
  ok(`${h2.ad} → ${h2.kod}`);

  console.log(`\n${KALIN}2 · ATAMA${R}`);
  const at = await jpost('/api/atama', {
    raporIdler: [hedef.raporId], hakemIdler: [h1.id, h2.id],
    yarismaId: hedef.yarismaId, atayan: 'koordinasyon', raporBasinaHakem: 2,
  });
  ok(`${at.veri.yapilan} atama yapıldı`);

  console.log(`\n${KALIN}3 · ATANMAMIŞ RAPORA PUAN GİRİLEMEZ${R}`);
  const h3 = (await jpost('/api/hakem', { ad: 'Atanmamış Hakem' })).veri.hakem;
  const red = await jpost('/api/hakem-degerlendirme', {
    kod: h3.kod, raporId: hedef.raporId, puanlar: [], tamamla: false,
  });
  red.durum >= 400 ? ok(`reddedildi: ${red.veri.hata}`) : hata('atanmamış hakem puan girdi');

  console.log(`\n${KALIN}4 · ÖLÇÜTLER${R}`);
  const { veri: kv } = await jget(`/api/yarisma`);
  const kategori = kv.yarismalar
    .find((y: { id: string }) => y.id === hedef!.yarismaId)
    ?.kategoriler.find((k: { id: string }) => k.id === hedef!.kategoriId);
  const olcutler: Array<{ kod: string; puan: number; ad: string }> = kategori.rubrik.kriterler;
  ok(`${olcutler.length} ölçüt · toplam ${kategori.rubrik.toplamPuan} puan`);

  console.log(`\n${KALIN}5 · BİRİNCİ HAKEM PUANLIYOR${R}`);
  const p1 = await jpost('/api/hakem-degerlendirme', {
    kod: h1.kod, raporId: hedef.raporId, tamamla: true,
    aciklama: 'Rapor teknik olarak yeterli; sonuç bölümü zayıf.',
    puanlar: olcutler.map((o) => ({ kriterKodu: o.kod, puan: Math.round(o.puan * 0.85 * 10) / 10 })),
  });
  ok(`toplam ${p1.veri.degerlendirme.toplam} · rapor tamamlandı mı: ${p1.veri.raporTamamlandi}`);
  p1.veri.raporTamamlandi === false
    ? ok('İKİNCİ HAKEM BEKLENİYOR — rapor kapatılmadı')
    : hata('tek hakemle rapor kapandı');

  console.log(`\n${KALIN}6 · İKİNCİ HAKEM FARKLI PUANLIYOR${R}`);
  const p2 = await jpost('/api/hakem-degerlendirme', {
    kod: h2.kod, raporId: hedef.raporId, tamamla: true,
    aciklama: 'İSG bölümünde eksikler var.',
    puanlar: olcutler.map((o) => ({ kriterKodu: o.kod, puan: Math.round(o.puan * 0.55 * 10) / 10 })),
  });
  ok(`toplam ${p2.veri.degerlendirme.toplam} · rapor tamamlandı mı: ${p2.veri.raporTamamlandi}`);

  const o = p2.veri.ozet;
  console.log(`\n${KALIN}7 · SONUÇ PANELE DÖNDÜ${R}`);
  console.log(`     nihai puan : ${o.puan}`);
  console.log(`     ayrışma    : ${o.sapma} puan`);
  for (const t of o.toplamlar) console.log(`     ${t.hakemAdi}: ${t.toplam}`);
  o.toplamlar.length === 2
    ? ok('İKİ PUAN DA KORUNDU — eski modelde biri diğerini eziyordu')
    : hata(`beklenen 2 puan, gelen ${o.toplamlar.length}`);
  o.puan === Math.round(((p1.veri.degerlendirme.toplam + p2.veri.degerlendirme.toplam) / 2) * 10) / 10
    ? ok('nihai puan iki değerlendirmenin ortalaması')
    : hata('ortalama yanlış');

  console.log(`\n${KALIN}8 · HAKEM YALNIZCA KENDİ İŞİNİ GÖRÜYOR${R}`);
  for (const h of [h1, h2]) {
    const s = await fetch(`${SUNUCU}/hakem/${h.kod}`);
    const html = await s.text();
    const kendi = html.includes(hedef.basvuruNo);
    const sizinti = ['Gerçek Takım', 'Anadolu'].some((a) => html.includes(a));
    console.log(`     ${h.ad}: kendi raporu ${kendi ? 'var' : 'YOK'} · gerçek ad sızıntısı ${sizinti ? 'VAR' : 'yok'}`);
  }
  const yabanci = await fetch(`${SUNUCU}/hakem/${h3.kod}/${hedef.raporId}`);
  yabanci.status === 404
    ? ok('atanmamış hakem rapor sayfasını açamıyor (404)')
    : hata(`atanmamış hakem sayfayı açtı: ${yabanci.status}`);

  console.log(`\n${KALIN}9 · TAMAMLANAN DEĞİŞTİRİLEMEZ${R}`);
  const tekrar = await jpost('/api/hakem-degerlendirme', {
    kod: h1.kod, raporId: hedef.raporId, puanlar: [], tamamla: false,
  });
  tekrar.durum >= 400 ? ok(`reddedildi: ${tekrar.veri.hata}`) : hata('tamamlanmış kayıt değişti');

  console.log(`\ntemizlik için: ${h3.id}`);
}

main().catch((e) => { console.error('HATA:', e); process.exit(1); });
