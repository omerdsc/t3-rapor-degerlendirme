/**
 * Örnek kopya çifti — kopya kontrolünün gösterilebilmesi için.
 *
 * ── NİYE AYRI BETİK ─────────────────────────────────────────────────────
 * `ornek-veri.ts` raporları hızlı kurmak için parmak izi ÜRETMİYOR: gerçek
 * bir PDF ayrıştırması gerekiyor ve tanıtım verisi için o maliyet
 * gereksiz. Ama kopya kontrolü tam olarak parmak izleri üzerinden
 * çalışıyor; izsiz raporlar arasında tarama "karşılaştırılacak çift yok"
 * diyor ve ekran çalışmıyormuş gibi görünüyor.
 *
 * Bu betik iki raporu ELDE kurgulanmış metin ve görsel imzalarıyla
 * yazıyor: biri ötekinin cümlelerinin çoğunu ve görsellerinin tamamını
 * paylaşıyor. Kopya kontrolü böylece gerçek bir bulgu üretiyor.
 *
 * ── VERİ UYDURULMUYOR, KURGULANIYOR ─────────────────────────────────────
 * Parmak izi gerçek üreticiden (`parmakiziCikar`) geçiyor; yalnızca girdi
 * metni elle yazılmış. Yani hesap gerçek, kaynak sentetik. Uydurulmuş bir
 * parmak izi yazsaydık ekran çalışıyor görünür ama motorun kendisi hiç
 * denenmemiş olurdu.
 *
 * Kullanım:
 *   npx tsx scripts/ornek-kopya.ts
 *   npx tsx scripts/ornek-kopya.ts -- --temizle
 */

import { parmakiziCikar } from '@/lib/analiz/benzerlik';
import { parmakiziSakla } from '@/lib/analiz/parmakizi-depo';
import { benzerlikTazele } from '@/lib/analiz/benzerlik-tazele';
import type { Belge, Satir } from '@/lib/analiz/tipler';
import { baglanti } from '@/lib/db/baglanti';
import { basvuruEkle, basvurulariListele, basvuruSil } from '@/lib/db/basvuru-depo';
import {
  kimlik, raporKaydet, raporSil, raporlariListele, yarismalariListele,
} from '@/lib/depo/depo';
import type { Rapor } from '@/lib/depo/tipler';

const ISARET = 'ornek-kopya';

/** İki raporun PAYLAŞTIĞI gövde — kopyanın kendisi. */
const ORTAK = [
  'Projemizin amacı tarımsal sulamada su tüketimini toprak nem verisine dayalı olarak azaltmaktır.',
  'Sistem, toprağa yerleştirilen kapasitif nem sensörlerinden dakikada bir ölçüm almaktadır.',
  'Ölçüm verileri düşük güç tüketimli bir mikrodenetleyici üzerinden kablosuz olarak merkeze iletilir.',
  'Merkezî birim gelen verileri eşik değerlerle karşılaştırarak vana açma kararını üretmektedir.',
  'Saha denemelerinde sekiz haftalık ölçüm süresince su tüketiminde belirgin bir azalma gözlenmiştir.',
  'Sistemin enerji ihtiyacı güneş paneli ve şarj edilebilir batarya ile karşılanmaktadır.',
  'Kalibrasyon işlemi her sezon başında referans toprak örnekleriyle tekrarlanmalıdır.',
  'Elde edilen sonuçlar yöntemin küçük ölçekli işletmelerde uygulanabilir olduğunu göstermektedir.',
];

/** Yalnızca birinci raporda geçen cümleler. */
const A_OZGUN = [
  'Bu çalışma Ege bölgesindeki bağ alanlarında yürütülmüştür.',
  'Donanım maliyeti piyasadaki hazır çözümlerin altında tutulmuştur.',
];

/** Yalnızca ikinci raporda geçen cümleler. */
const B_OZGUN = [
  'Çalışma Konya ovasında tahıl üretimi yapan bir işletmede tekrarlanmıştır.',
  'Vana kontrol devresi için ayrıca bir röle kartı tasarlanmıştır.',
];

/**
 * Elle kurgulanmış belge.
 *
 * `parmakiziCikar` bölüm yapısı yoksa tam metne düşüyor (kendi kodunda
 * açıklanmış bir davranış); burada bölüm veriyoruz ki gerçek yol
 * denensin. Satırlar sayfa numarasını taşıyor: eşleşen cümlelerin hangi
 * sayfada olduğu kanıt ekranında yazacak.
 */
function belgeKur(cumleler: string[], gorselHashleri: string[]): Belge {
  const satirlar: Satir[] = cumleler.map((m, i) => ({
    metin: m,
    sayfa: Math.floor(i / 3) + 2,
    y: 100 + i * 20,
    x: 60,
    punto: 11,
    kalinMi: false,
    yinelenen: false,
  }));

  const govde = cumleler.join('\n');

  return {
    sayfalar: [],
    satirlar,
    metin: govde,
    basliklar: [],
    bolumler: [
      {
        baslik: {
          metin: 'YÖNTEM', numara: null, sade: 'YÖNTEM',
          sayfa: 2, satirIndeksi: 0, seviye: 1,
        },
        govde,
        kelimeSayisi: govde.split(/\s+/).length,
      },
    ],
    yinelenenSatirlar: [],
    sayfaSayisi: Math.ceil(cumleler.length / 3) + 1,
    taranmisMi: false,
    gorselSayisi: gorselHashleri.length,
    gorseller: gorselHashleri.map((h, i) => ({
      sayfa: i + 3,
      sira: 1,
      genislik: 720,
      yukseklik: 480,
      hash: h,
    })),
    kelimeSayisi: govde.split(/\s+/).length,
  };
}

/*
 * AYNI GÖRSEL HASH'LERİ. pHash aynı görselden aynı imzayı üretiyor;
 * iki raporda birebir aynı değerleri kullanmak "aynı şekli koymuşlar"
 * durumunun ta kendisi.
 */
const GORSELLER = ['f0e1c3a58d2b4790', 'a13c7e90b6d24f85', 'cc9012ab34de5f67'];

function raporKur(g: {
  yarismaId: string;
  kategoriId: string;
  basvuruId: string;
  basvuruNo: string;
  takim: string;
  takimId: string;
  proje: string;
  cumleler: string[];
  gunOnce: number;
  yil: number;
}): Rapor {
  const id = kimlik();
  const belge = belgeKur(g.cumleler, GORSELLER);
  return {
    id,
    yarismaId: g.yarismaId,
    kategoriId: g.kategoriId,
    basvuruId: g.basvuruId,
    basvuruNo: g.basvuruNo,
    dosyaAdi: `${g.proje.toLocaleLowerCase('tr').replace(/[^\p{L}\d]+/gu, '_')}.pdf`,
    takim: g.takim,
    takimId: g.takimId,
    proje: g.proje,
    yuklendi: new Date(Date.now() - g.gunOnce * 86400_000).toISOString(),
    durum: 'hakem_bekliyor',
    kontroller: [],
    genelDurum: 'uyari',
    istatistik: {
      sayfaSayisi: belge.sayfaSayisi,
      kelimeSayisi: belge.kelimeSayisi,
      gorselSayisi: belge.gorselSayisi,
      baslikSayisi: 1,
      taranmisMi: false,
      sureMs: 0,
    },
    parmakizi: parmakiziSakla(
      parmakiziCikar(belge, {
        raporId: id,
        takimId: g.takimId,
        kategoriKodu: g.kategoriId,
        yil: g.yil,
      }),
    ),
  };
}

async function kur() {
  const yarisma = yarismalariListele().find((y) => y.kategoriler.length > 0 && y.yil >= 2026);
  if (!yarisma) {
    console.log('Kategorili bir 2026 yarışması bulunamadı.');
    return;
  }
  const kategori = yarisma.kategoriler[0];

  const varsa = basvurulariListele().filter((b) => b.notlar === ISARET);
  if (varsa.length) {
    console.log('Örnek kopya çifti zaten var.');
    return;
  }

  const takimlar = [
    { ad: 'Takım Meriç', kod: 'MER11', proje: 'Toprak Nemine Göre Akıllı Sulama' },
    { ad: 'Takım Seyhan', kod: 'SEY04', proje: 'Sensör Tabanlı Damla Sulama' },
  ];
  const cumleler = [
    [...ORTAK, ...A_OZGUN],
    [...ORTAK, ...B_OZGUN],
  ];

  for (let i = 0; i < 2; i++) {
    const t = takimlar[i];
    const basvuru = basvuruEkle(
      {
        yarismaId: yarisma.id, kategoriId: kategori.id,
        takim: t.ad, takimId: t.kod, proje: t.proje, notlar: ISARET,
      },
      yarisma.yil,
    );
    const rapor = raporKur({
      yarismaId: yarisma.id, kategoriId: kategori.id,
      basvuruId: basvuru.id, basvuruNo: basvuru.basvuruNo,
      takim: t.ad, takimId: t.kod, proje: t.proje,
      cumleler: cumleler[i], gunOnce: 6 - i * 2, yil: yarisma.yil,
    });
    await raporKaydet(rapor);
    console.log(`  ${basvuru.basvuruNo}  ${t.ad}  ${t.proje}`);
  }

  /*
   * TARAMA HEMEN KOŞUYOR. Kayıt yeterli değil: kopya bulgusu raporun
   * `kontroller` alanına tazeleme sırasında yazılıyor ve pano ile
   * "kopya şüphesi" sekmesi o alanı okuyor.
   */
  const sonuc = await benzerlikTazele(yarisma.id, kategori.id);
  console.log(
    `\n  tarama: ${sonuc.taranan} rapor · ${sonuc.isaretliCift} işaretli çift`
    + ` · ${sonuc.parmakizsiz} izsiz · ${sonuc.guncellenen} kayıt güncellendi`,
  );
  console.log(`  yarışma: ${yarisma.ad}`);
  console.log(`  kategori: ${kategori.ad}`);
}

function temizle() {
  const db = baglanti();
  const basvurular = basvurulariListele().filter((b) => b.notlar === ISARET);
  for (const b of basvurular) {
    for (const r of raporlariListele().filter((x) => x.basvuruId === b.id)) {
      raporSil(r.id);
    }
    basvuruSil(b.id);
    console.log('silindi:', b.basvuruNo);
  }
  void db;
}

async function calistir() {
  if (process.argv.includes('--temizle')) temizle();
  else await kur();
}

calistir().catch((e) => {
  console.error(e);
  process.exit(1);
});
