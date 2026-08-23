/**
 * Ham metin parçalarından belge yapısı kurar: satırlar, sayfa başlığı/altlığı
 * ayıklama, başlık tespiti, bölümlere ayırma.
 *
 * Sayfa başlığı/altlığı ayıklaması kritik: her sayfada tekrar eden
 * "TEKNOFEST 2026 | Takım Adı | Sayfa 4" satırı metinde bırakılırsa bütün
 * raporlar birbirine benzer çıkar ve benzerlik analizi değersizleşir.
 * bkz. docs/gercek-dunya-sorunlari.md · B2, B3
 */

import type { Baslik, Belge, Bolum, HamBelge, HamSayfa, Satir } from './tipler';
import { anahtar, baslikSeviyesi, kelimeler, numarayiAyir, onar } from './normalize';

/** Bir satır bu oranda sayfada tekrar ediyorsa başlık/altlıktır. */
const YINELEME_ORANI = 0.6;
/** Başlık/altlık yalnızca sayfanın üst/alt bu diliminde aranır. */
const KENAR_DILIMI = 0.12;

/** Aynı y hizasındaki parçaları birleştirip satır kurar. */
export function satirlariKur(sayfa: HamSayfa): Satir[] {
  if (!sayfa.ogeler.length) return [];

  const sirali = [...sayfa.ogeler].sort((a, b) => b.y - a.y || a.x - b.x);
  const gruplar: (typeof sirali)[] = [];

  for (const oge of sirali) {
    const son = gruplar[gruplar.length - 1];
    const tolerans = Math.max(2, oge.puntoBoyutu * 0.5);
    if (son && Math.abs(son[0].y - oge.y) <= tolerans) son.push(oge);
    else gruplar.push([oge]);
  }

  return gruplar.map((grup) => {
    const sirasiyla = [...grup].sort((a, b) => a.x - b.x);
    let metin = '';
    let oncekiSon = -Infinity;

    for (const oge of sirasiyla) {
      // Parçalar arasında görünür boşluk varsa boşluk koy; yoksa bitiştir.
      const bosluk = oge.x - oncekiSon;
      if (metin && bosluk > oge.puntoBoyutu * 0.18) metin += ' ';
      metin += oge.metin;
      oncekiSon = oge.x + oge.genislik;
    }

    return {
      metin: onar(metin),
      sayfa: sayfa.no,
      y: sirasiyla[0].y,
      x: Math.min(...sirasiyla.map((o) => o.x)),
      punto: Math.max(...sirasiyla.map((o) => o.puntoBoyutu)),
      kalinMi: sirasiyla.some((o) => /bold|black|heavy|semib/i.test(o.fontAdi)),
      yinelenen: false,
    };
  }).filter((s) => s.metin.length > 0);
}

/**
 * Sayfa başlığı/altlığı adaylarını bulur.
 * Sayfa numarası her sayfada değiştiği için karşılaştırmadan önce
 * rakamlar maskelenir — yoksa hiçbiri tekrar etmiş görünmez.
 */
export function yinelenenleriBul(sayfaSatirlari: Satir[][]): Set<string> {
  const sayfaSayisi = sayfaSatirlari.length;
  if (sayfaSayisi < 3) return new Set();

  const sayac = new Map<string, Set<number>>();

  for (const satirlar of sayfaSatirlari) {
    if (!satirlar.length) continue;
    const ust = Math.max(...satirlar.map((s) => s.y));
    const alt = Math.min(...satirlar.map((s) => s.y));
    const aralik = ust - alt || 1;

    for (const satir of satirlar) {
      const oranUst = (ust - satir.y) / aralik;
      const kenarda = oranUst <= KENAR_DILIMI || oranUst >= 1 - KENAR_DILIMI;
      if (!kenarda) continue;

      const maske = anahtar(satir.metin).replace(/\d+/g, '#');
      if (maske.length < 2) continue;
      if (!sayac.has(maske)) sayac.set(maske, new Set());
      sayac.get(maske)!.add(satir.sayfa);
    }
  }

  const esik = Math.max(3, Math.ceil(sayfaSayisi * YINELEME_ORANI));
  const sonuc = new Set<string>();
  for (const [maske, sayfalar] of sayac) {
    if (sayfalar.size >= esik) sonuc.add(maske);
  }
  return sonuc;
}

/** Gövde metninin baskın puntosu — başlık eşiği buna göre belirlenir. */
function govdePuntosu(satirlar: Satir[]): number {
  const agirlik = new Map<number, number>();
  for (const s of satirlar) {
    const p = Math.round(s.punto * 2) / 2;
    agirlik.set(p, (agirlik.get(p) ?? 0) + s.metin.length);
  }
  let enCok = 12;
  let enYuksek = 0;
  for (const [punto, ag] of agirlik) {
    if (ag > enYuksek) {
      enYuksek = ag;
      enCok = punto;
    }
  }
  return enCok;
}

/**
 * Başlık tespiti üç sinyali birlikte kullanır: numaralandırma, punto/kalınlık
 * ve satır uzunluğu. Tek sinyale güvenilmez — şablona kopyala-yapıştır
 * sırasında başlık stili sıklıkla düz metne dönüşüyor.
 * bkz. docs/gercek-dunya-sorunlari.md · A3
 */
function baslikMi(satir: Satir, govde: number): boolean {
  const metin = satir.metin.trim();
  if (metin.length < 3 || metin.length > 120) return false;
  if (/[.;,]$/.test(metin) && !/^\d/.test(metin)) return false;
  // İçindekiler satırı: "2. Sorunun Tanımı ......... 3". Başlık değil.
  if (/\.{4,}/.test(metin)) return false;
  // Tarih satırı: "10.04.2026 Tamamlandı" — takvim tablosunun satırı.
  if (/^\d{1,2}[.\/]\d{1,2}[.\/]\d{4}/.test(metin)) return false;

  const { numara, sade } = numarayiAyir(metin);
  if (!sade || sade.length < 3) return false;

  const numarali = numara !== null && /^\d/.test(numara);
  const iri = satir.punto >= govde * 1.12;
  const vurgulu = satir.kalinMi && satir.punto >= govde;
  const buyukHarf = sade === sade.toLocaleUpperCase('tr') && sade.length <= 70;

  // Numaralı satır tek başına yeterli; numarasızsa görsel vurgu şart.
  if (numarali && (iri || vurgulu || buyukHarf || metin.length <= 80)) return true;
  return (iri || vurgulu) && buyukHarf;
}

/** Ham belgeyi yapılandırılmış belgeye dönüştürür. */
export function belgeKur(ham: HamBelge): Belge {
  const sayfaSatirlari = ham.sayfalar.map(satirlariKur);
  const yinelenenMaskeler = yinelenenleriBul(sayfaSatirlari);

  const satirlar: Satir[] = [];
  const yinelenenOrnekler = new Set<string>();

  for (const sayfa of sayfaSatirlari) {
    for (const satir of sayfa) {
      const maske = anahtar(satir.metin).replace(/\d+/g, '#');
      if (yinelenenMaskeler.has(maske)) {
        satir.yinelenen = true;
        yinelenenOrnekler.add(satir.metin);
      }
      satirlar.push(satir);
    }
  }

  const govdeSatirlari = satirlar.filter((s) => !s.yinelenen);
  const govde = govdePuntosu(govdeSatirlari);

  const basliklar: Baslik[] = [];
  govdeSatirlari.forEach((satir, i) => {
    if (!baslikMi(satir, govde)) return;
    const { numara, sade } = numarayiAyir(satir.metin);
    basliklar.push({
      metin: satir.metin,
      numara,
      sade,
      sayfa: satir.sayfa,
      satirIndeksi: i,
      seviye: baslikSeviyesi(numara),
    });
  });

  const bolumler = bolumlereAyir(govdeSatirlari, basliklar);
  const metin = govdeSatirlari.map((s) => s.metin).join('\n');

  return {
    sayfalar: ham.sayfalar,
    satirlar,
    metin,
    basliklar,
    bolumler,
    yinelenenSatirlar: [...yinelenenOrnekler],
    sayfaSayisi: ham.sayfaSayisi,
    taranmisMi: ham.taranmisMi,
    gorselSayisi: ham.gorselSayisi,
    gorseller: ham.gorseller,
    kelimeSayisi: kelimeler(metin).length,
  };
}

/** İki başlık arasındaki metni o bölümün gövdesi sayar. */
function bolumlereAyir(satirlar: Satir[], basliklar: Baslik[]): Bolum[] {
  return basliklar.map((baslik, i) => {
    const bas = baslik.satirIndeksi + 1;
    const son = i + 1 < basliklar.length ? basliklar[i + 1].satirIndeksi : satirlar.length;
    const govde = satirlar.slice(bas, son).map((s) => s.metin).join('\n').trim();
    return { baslik, govde, kelimeSayisi: kelimeler(govde).length };
  });
}
