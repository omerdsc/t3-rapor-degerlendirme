/**
 * Şablon uygunluğu (MVP 1-2) ve başlık/içerik kontrolü (MVP 3).
 *
 * Buradaki iki tespit, ekip üyesinin başvuru deneyiminden çıktı:
 *  - Yarışmacı hazır şablona yapıştırırken başlık stili bozuluyor → başlık
 *    eşleştirmesi fuzzy olmak zorunda.
 *  - Şablonun kendi yönerge metni ("Bu bölümde ... anlatınız") silinmeden
 *    bırakılıyor → bölüm dolu görünüyor ama aslında boş.
 * bkz. docs/gercek-dunya-sorunlari.md · A1, A3, A4
 */

import type { Belge, Bolum, Bulgu, KontrolSonucu, Sablon, SablonBaslik } from './tipler';
import { anahtar, benzerlik, kelimeler } from './normalize';
import { sekilliBolumler } from './gorsel';

/** Başlık eşleşmiş sayılması için gereken en düşük benzerlik. */
const ESLESME_ESIGI = 0.72;
/** Yönerge metni kalıntısı sayılması için gereken benzerlik. */
const YONERGE_ESIGI = 0.8;

const PLACEHOLDER_DESENLERI = [
  /\[\s*[^\]]{2,40}\s*\]/g,          // [Takım Adı]
  /<[^>]{2,40}>/g,                    // <proje adı>
  /\bXX+\b/g,                         // XXX
  /\.{4,}/g,                          // ......
  /\blorem ipsum\b/gi,
  /\bör(?:nek)?\s*:/gi,
];

export interface BaslikEslesme {
  beklenen: SablonBaslik;
  bulunan: Bolum | null;
  benzerlikOrani: number;
  /** Bölüm gövdesi yalnızca şablon yönergesinden ibaret. */
  yonergeKalintisi: boolean;
  yetersizIcerik: boolean;
}

/**
 * Bir bölümün ALT BAŞLIKLARIYLA birlikte kelime sayısı.
 *
 * Üst başlığın kendi gövdesi boş olabilir; içerik alt başlıklarındadır.
 * Gerçek örnek — Maden raporu:
 *
 *   2. SORUNUN TANIMI VE ÇÖZÜM ÖNERİSİ     0 kelime
 *     2.1 Problemin Tanımı               224 kelime
 *     2.2 Çözüm Önerisi                  238 kelime
 *     2.3 Sistem Mimarisi                 31 kelime
 *
 * Yalnızca kendi gövdesine bakan kontrol bu bölümü "içeriği yetersiz" diye
 * işaretliyordu; oysa bölüm 493 kelime taşıyor.
 */
function etkinKelimeSayisi(belge: Belge, bolum: Bolum): number {
  const numara = bolum.baslik.numara;
  if (!numara) return bolum.kelimeSayisi;

  const onEk = `${numara}.`;
  const altToplam = belge.bolumler
    .filter((b) => b.baslik.numara?.startsWith(onEk))
    .reduce((t, b) => t + b.kelimeSayisi, 0);

  return bolum.kelimeSayisi + altToplam;
}

/** Beklenen her başlığı belgede arar. */
export function baslikEslestir(belge: Belge, sablon: Sablon): BaslikEslesme[] {
  const kullanildi = new Set<Bolum>();

  return sablon.basliklar.map((beklenen) => {
    let enIyi: Bolum | null = null;
    let enIyiOran = 0;

    for (const bolum of belge.bolumler) {
      if (kullanildi.has(bolum)) continue;

      let oran = benzerlik(bolum.baslik.sade, beklenen.ad);
      // Numara tutuyorsa güven artar — stil bozulsa da numara kalır. Ama tek
      // başına eşleştirmez: bölüm silinip numaralar kaydığında "9. Riskler"
      // beklentisi belgedeki "9. Kaynakça" bölümünü tüketirdi.
      if (beklenen.numara && bolum.baslik.numara === beklenen.numara) {
        oran = Math.min(1, oran + 0.25);
      }
      // Eşit benzerlikte dolu bölüm kazanır. İçindekiler satırı gerçek
      // bölümle aynı adı taşır ama gövdesi boştur; gerçek bölüm seçilmeli.
      const daha =
        oran > enIyiOran + 0.02 ||
        (Math.abs(oran - enIyiOran) <= 0.02 && bolum.kelimeSayisi > (enIyi?.kelimeSayisi ?? -1));
      if (daha) {
        enIyiOran = Math.max(oran, enIyiOran);
        enIyi = bolum;
      }
    }

    if (!enIyi || enIyiOran < ESLESME_ESIGI) {
      return {
        beklenen, bulunan: null, benzerlikOrani: enIyiOran,
        yonergeKalintisi: false, yetersizIcerik: false,
      };
    }

    kullanildi.add(enIyi);
    const yonerge = yonergeKalintisiVarMi(enIyi, beklenen);
    const asgari = beklenen.asgariKelime ?? 25;

    return {
      beklenen,
      bulunan: enIyi,
      benzerlikOrani: enIyiOran,
      yonergeKalintisi: yonerge,
      // Alt başlıklar dâhil: üst başlığın gövdesi boş olsa da içerik altta olabilir.
      yetersizIcerik: etkinKelimeSayisi(belge, enIyi) < asgari,
    };
  });
}

/**
 * Bölüm gövdesi şablonun yönerge metniyle mi dolu?
 * Yönergenin dışında kayda değer içerik kalmıyorsa bölüm doldurulmamıştır.
 */
function yonergeKalintisiVarMi(bolum: Bolum, beklenen: SablonBaslik): boolean {
  const yonergeler = beklenen.yonergeMetni ?? [];
  if (!yonergeler.length) return false;

  const govdeSatirlari = bolum.govde.split('\n').map((s) => s.trim()).filter(Boolean);
  if (!govdeSatirlari.length) return false;

  let yonergeKelime = 0;
  for (const satir of govdeSatirlari) {
    const eslesti = yonergeler.some((y) => benzerlik(satir, y) >= YONERGE_ESIGI);
    if (eslesti) yonergeKelime += kelimeler(satir).length;
  }

  if (yonergeKelime === 0) return false;
  const ozgun = bolum.kelimeSayisi - yonergeKelime;
  return ozgun < 20;
}

/** Şablon sürümünü başlık imzasına göre seçer (MVP 1-2). */
export function sablonSec(belge: Belge, adaylar: Sablon[]): { sablon: Sablon; skor: number } {
  let enIyi = { sablon: adaylar[0], skor: 0 };

  for (const aday of adaylar) {
    const zorunlular = aday.basliklar.filter((b) => b.zorunlu);
    if (!zorunlular.length) continue;

    const bulunan = zorunlular.filter((beklenen) =>
      belge.bolumler.some((b) => benzerlik(b.baslik.sade, beklenen.ad) >= ESLESME_ESIGI),
    ).length;

    const skor = bulunan / zorunlular.length;
    if (skor > enIyi.skor) enIyi = { sablon: aday, skor };
  }
  return enIyi;
}

export function sablonKontrolu(
  belge: Belge,
  guncel: Sablon,
  eskiSurumler: Sablon[] = [],
): KontrolSonucu {
  const bulgular: Bulgu[] = [];

  if (belge.taranmisMi) {
    bulgular.push({
      kod: 'PDF_TARANMIS',
      seviye: 'hata',
      baslik: 'Rapor taranmış görüntü olarak yüklenmiş',
      aciklama:
        'PDF metin katmanı yok denecek kadar az. Şablon uygunluğu metinden doğrulanamıyor; ' +
        'rapor görsel analiz yoluna alındı.',
    });
  }

  const secim = sablonSec(belge, [guncel, ...eskiSurumler]);
  if (secim.sablon.kod !== guncel.kod && secim.skor > 0.5) {
    bulgular.push({
      kod: 'SABLON_ESKI',
      seviye: 'uyari',
      baslik: `Eski şablon kullanılmış (${secim.sablon.yil})`,
      aciklama:
        `Rapor ${secim.sablon.ad} imzasıyla %${Math.round(secim.skor * 100)} örtüşüyor. ` +
        `Güncel şablon: ${guncel.ad}.`,
    });
  } else if (secim.skor < 0.5) {
    bulgular.push({
      kod: 'SABLON_UYUMSUZ',
      seviye: 'hata',
      baslik: 'Şablon imzası tanınmadı',
      aciklama:
        `Zorunlu başlıkların yalnızca %${Math.round(secim.skor * 100)}'i bulunabildi. ` +
        'Rapor güncel şablonla hazırlanmamış olabilir.',
    });
  }

  if (guncel.azamiSayfa && belge.sayfaSayisi > guncel.azamiSayfa) {
    bulgular.push({
      kod: 'SAYFA_ASIMI',
      seviye: 'uyari',
      baslik: `Sayfa sınırı aşılmış (${belge.sayfaSayisi}/${guncel.azamiSayfa})`,
      aciklama: 'Şartnamede belirtilen azami sayfa sayısı aşılmış.',
    });
  }
  if (guncel.asgariSayfa && belge.sayfaSayisi < guncel.asgariSayfa) {
    bulgular.push({
      kod: 'SAYFA_YETERSIZ',
      seviye: 'uyari',
      baslik: `Rapor beklenenden kısa (${belge.sayfaSayisi}/${guncel.asgariSayfa})`,
      aciklama: 'Şartnamede belirtilen asgari sayfa sayısına ulaşılmamış.',
    });
  }

  const placeholderlar = placeholderBul(belge.metin);
  if (placeholderlar.length) {
    bulgular.push({
      kod: 'PLACEHOLDER_KALINTISI',
      seviye: 'uyari',
      baslik: `${placeholderlar.length} yer tutucu doldurulmamış`,
      aciklama: 'Şablondan gelen yer tutucular raporda kalmış.',
      kanit: placeholderlar.slice(0, 4).join(' · '),
    });
  }

  const durum = bulgular.some((b) => b.seviye === 'hata')
    ? 'hata'
    : bulgular.some((b) => b.seviye === 'uyari')
      ? 'uyari'
      : 'temiz';

  return {
    kod: 'sablon',
    ad: 'Şablon',
    durum,
    ozet:
      secim.sablon.kod === guncel.kod
        ? `${guncel.yil} sürümü · %${Math.round(secim.skor * 100)}`
        : `${secim.sablon.yil} sürümü`,
    bulgular,
    veri: {
      secilenSablon: secim.sablon.kod,
      uyumSkoru: secim.skor,
      sayfaSayisi: belge.sayfaSayisi,
      taranmisMi: belge.taranmisMi,
    },
  };
}

/**
 * Raporun şablona uyum özeti — AI değerlendirmesine bilgi olarak geçer.
 *
 * Şablona uymayan rapor, sistemin en çok işe yarayacağı rapordur; modelin
 * "beklenen başlık yok, o hâlde içerik de yok" diye yanılmasını engeller.
 */
export function sablonUyumu(
  belge: Belge,
  sablon: Sablon,
): { eksikBolumler: string[]; fazlaBolumler: string[]; sablonSkoru: number } {
  const eslesmeler = baslikEslestir(belge, sablon);

  const eksik = eslesmeler
    .filter((e) => e.beklenen.raporda !== false && !e.bulunan)
    .map((e) => e.beklenen.ad);

  const eslesenBolumler = new Set(
    eslesmeler.map((e) => e.bulunan?.baslik.sade).filter(Boolean) as string[],
  );

  // Şablonda karşılığı olmayan, gövdesi dolu başlıklar.
  const fazla = belge.bolumler
    .filter((b) => !eslesenBolumler.has(b.baslik.sade) && b.kelimeSayisi >= 30)
    .map((b) => b.baslik.sade)
    .slice(0, 8);

  const beklenen = eslesmeler.filter((e) => e.beklenen.raporda !== false);
  const skor = beklenen.length
    ? beklenen.filter((e) => e.bulunan).length / beklenen.length
    : 0;

  return { eksikBolumler: eksik, fazlaBolumler: fazla, sablonSkoru: skor };
}

/** Zorunlu başlıklar ve bölüm içerikleri (MVP 3). */
export function baslikKontrolu(belge: Belge, sablon: Sablon): KontrolSonucu {
  const eslesmeler = baslikEslestir(belge, sablon);
  const bulgular: Bulgu[] = [];

  // Şekil içeren bölümü kelime sayısıyla yargılamak yanlış: yarışmacı akış
  // şemasını çizip görsel olarak eklemiş olabilir. İçerik orada, sadece
  // metin değil.
  const sekilli = sekilliBolumler(belge);

  // raporda:false olan başlıklar (ör. "GENEL RAPOR DÜZENİ") bölüm olarak
  // beklenmez; şablon onları yalnızca puanlama ölçütü olarak tanımlar.
  const eksikler = eslesmeler.filter(
    (e) => e.beklenen.zorunlu && e.beklenen.raporda !== false && !e.bulunan,
  );
  for (const e of eksikler) {
    bulgular.push({
      kod: 'BASLIK_EKSIK',
      seviye: 'hata',
      baslik: `Zorunlu bölüm yok: ${e.beklenen.ad}`,
      aciklama:
        e.benzerlikOrani > 0.5
          ? `En yakın başlık %${Math.round(e.benzerlikOrani * 100)} benzerlikte kaldı — başlık değiştirilmiş olabilir.`
          : 'Bu başlıkla eşleşen bir bölüm bulunamadı.',
    });
  }

  for (const e of eslesmeler) {
    if (!e.bulunan) continue;

    if (e.yonergeKalintisi) {
      bulgular.push({
        kod: 'BOLUM_DOLDURULMAMIS',
        seviye: 'hata',
        baslik: `"${e.beklenen.ad}" doldurulmamış`,
        aciklama:
          'Bölümde şablonun yönerge metni duruyor, yarışmacının kendi içeriği yok denecek kadar az.',
        sayfa: e.bulunan.baslik.sayfa,
        kanit: e.bulunan.govde.slice(0, 140),
      });
    } else if (e.yetersizIcerik) {
      const sekilVar = sekilli.has(e.bulunan.baslik.sade);
      const etkin = etkinKelimeSayisi(belge, e.bulunan);
      bulgular.push({
        kod: sekilVar ? 'BOLUM_GORSEL_AGIRLIKLI' : 'BOLUM_YETERSIZ',
        seviye: sekilVar ? 'bilgi' : 'uyari',
        baslik: sekilVar
          ? `"${e.beklenen.ad}" içeriği görsel ağırlıklı`
          : `"${e.beklenen.ad}" içeriği yetersiz`,
        aciklama: sekilVar
          ? `Bölümde ${etkin} kelime metin var ancak şekil de bulunuyor. ` +
            'İçerik görselde olabilir; yapay zekâ değerlendirmesi şekli okuyacak.'
          : `Bölümde alt başlıklar dâhil yalnızca ${etkin} kelime var ` +
            `(beklenen asgari ${e.beklenen.asgariKelime ?? 25}).`,
        sayfa: e.bulunan.baslik.sayfa,
      });
    }
  }

  // Şablon "bu başlık raporda olmasın" diyorsa ve rapor onu yazmışsa bulgu.
  for (const e of eslesmeler) {
    if (e.beklenen.raporda !== false || !e.bulunan) continue;
    if (e.bulunan.kelimeSayisi < 15) continue;
    bulgular.push({
      kod: 'FAZLA_BOLUM',
      seviye: 'uyari',
      baslik: `"${e.beklenen.ad}" raporda yer almamalıydı`,
      aciklama:
        'Şablon bu başlığı yalnızca değerlendirme ölçütü olarak tanımlıyor; ' +
        'yarışmacının rapora eklememesi gerekiyordu.',
      sayfa: e.bulunan.baslik.sayfa,
    });
  }

  const sekilBulgusu = sekilTutarliligi(belge);
  if (sekilBulgusu) bulgular.push(sekilBulgusu);

  const zorunlu = eslesmeler.filter((e) => e.beklenen.zorunlu && e.beklenen.raporda !== false);
  const bulunanSayisi = zorunlu.filter((e) => e.bulunan).length;
  const bosSayisi = eslesmeler.filter((e) => e.yonergeKalintisi).length;

  const durum = bulgular.some((b) => b.seviye === 'hata')
    ? 'hata'
    : bulgular.some((b) => b.seviye === 'uyari')
      ? 'uyari'
      : 'temiz';

  return {
    kod: 'basliklar',
    ad: 'Başlıklar',
    durum,
    ozet:
      `${bulunanSayisi}/${zorunlu.length}` + (bosSayisi ? ` · ${bosSayisi} boş` : ''),
    bulgular,
    veri: {
      zorunluSayisi: zorunlu.length,
      bulunanSayisi,
      doldurulmamisSayisi: bosSayisi,
      eksikler: eksikler.map((e) => e.beklenen.ad),
    },
  };
}

/** Metinde "Şekil 4" deniyor ama Şekil 4 başlığı yoksa tutarsızlık vardır. */
function sekilTutarliligi(belge: Belge): Bulgu | null {
  const tanimli = new Set<string>();
  for (const m of belge.metin.matchAll(/^\s*(Şekil|Tablo|Grafik)\s+(\d+(?:\.\d+)?)\s*[.:—-]/gim)) {
    tanimli.add(`${m[1].toLocaleLowerCase('tr')} ${m[2]}`);
  }

  const atifYapilan = new Set<string>();
  for (const m of belge.metin.matchAll(/\b(Şekil|Tablo|Grafik)\s+(\d+(?:\.\d+)?)\b/g)) {
    atifYapilan.add(`${m[1].toLocaleLowerCase('tr')} ${m[2]}`);
  }

  const eksik = [...atifYapilan].filter((k) => !tanimli.has(k));
  if (eksik.length < 2) return null;

  return {
    kod: 'SEKIL_TUTARSIZ',
    seviye: 'uyari',
    baslik: `${eksik.length} şekil/tablo atfının karşılığı yok`,
    aciklama:
      `Metinde ${eksik.slice(0, 5).join(', ')} referansları geçiyor ancak bu numaralarla ` +
      'başlıklandırılmış bir şekil/tablo bulunamadı.',
  };
}

function placeholderBul(metin: string): string[] {
  const bulunan = new Set<string>();
  for (const desen of PLACEHOLDER_DESENLERI) {
    for (const m of metin.matchAll(desen)) {
      const parca = m[0].trim();
      // Numaralı atıflar ([1], [12]) yer tutucu değildir.
      if (/^\[\s*\d[\d\s,–-]*\]$/.test(parca)) continue;
      if (anahtar(parca).length < 2) continue;
      bulunan.add(parca);
      if (bulunan.size > 20) return [...bulunan];
    }
  }
  return [...bulunan];
}
