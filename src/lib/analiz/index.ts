/**
 * Deterministik analiz boru hattı — MVP 1, 2, 3.
 *
 * Bu katmanda hiçbir dil modeli çağrılmaz: PDF ayrıştırma, dil tespiti,
 * şablon/başlık kontrolü ve kaynakça analizinin tamamı saf kod. İşletme
 * maliyeti sıfır. Yapay zekâ yalnızca kriter değerlendirmesinde (MVP 6)
 * devreye girer.
 */

import type { Belge, Bulgu, KontrolSonucu, Sablon, Seviye } from './tipler';
import { pdfOku } from './pdf';
import { belgeKur } from './yapi';
import { bicimTespitEt, docxOku } from './belge-docx';
import { dilKontrolu } from './dil';
import { baslikKontrolu, sablonKontrolu } from './sablon';
import { kaynakcaKontrolu, kaynakcayiCozumle } from './kaynakca';
import { kaynaklariDogrula, type DogrulamaOzeti } from './kaynak-dogrula';
import { kategoriKontrolu, type Kategori } from './kategori';
import { ESKI_SABLONLAR, GUNCEL_SABLON } from './sablonlar';
import { KATEGORILER } from './kategoriler';
import { bozulmaOrani } from './normalize';

export interface AnalizSecenekleri {
  sablon?: Sablon;
  eskiSablonlar?: Sablon[];
  /** Yarışmanın kategori listesi. Boş verilirse kategori kontrolü atlanır. */
  kategoriler?: Kategori[];
  /** Yarışmacının başvuruda beyan ettiği kategori kodu. */
  beyanEdilenKategori?: string;
  /**
   * Kaynakları akademik indekslerde doğrula. Ağ erişimi gerektirir; yalnızca
   * kaynak BAŞLIKLARI sorgulanır, raporun içeriği hiçbir yere gönderilmez.
   */
  kaynakDogrula?: boolean;
  /** Crossref/OpenAlex polite pool için iletişim adresi. */
  dogrulamaIletisim?: string;
}

export interface AnalizSonucu {
  basarili: boolean;
  hata?: string;
  belge?: Belge;
  kontroller: KontrolSonucu[];
  /** Ağ doğrulaması yapıldıysa kaynak kaynak sonuçlar. */
  kaynakDogrulamasi?: DogrulamaOzeti;
  /** Tüm kontrollerin en kötü durumu. */
  genelDurum: Seviye;
  /** Hakemin doğrudan görmesi gereken bulgular. */
  kritikBulgular: Bulgu[];
  istatistik: {
    sayfaSayisi: number;
    kelimeSayisi: number;
    gorselSayisi: number;
    baslikSayisi: number;
    taranmisMi: boolean;
    metinBozulmaOrani: number;
    yinelenenSatirSayisi: number;
    sureMs: number;
  };
}

export async function raporuAnalizEt(
  veri: Uint8Array,
  secenekler: AnalizSecenekleri = {},
): Promise<AnalizSonucu> {
  const baslangic = Date.now();
  const sablon = secenekler.sablon ?? GUNCEL_SABLON;
  const eskiler = secenekler.eskiSablonlar ?? ESKI_SABLONLAR;
  const kategoriler = secenekler.kategoriler ?? KATEGORILER;

  // Biçim uzantıdan değil içerikten belirlenir; yanlış uzantılı dosya sık.
  const bicim = bicimTespitEt(veri);
  let belge;

  if (bicim === 'docx') {
    const okuma = docxOku(veri);
    if (!okuma.tamam) return okumaHatasi(okuma.hata, 'DOCX_ACILAMADI', baslangic);
    belge = okuma.belge;
  } else if (bicim === 'pdf') {
    const okuma = await pdfOku(veri);
    if (!okuma.tamam) return okumaHatasi(okuma.hata, 'PDF_ACILAMADI', baslangic);
    belge = belgeKur(okuma.belge);
  } else {
    return okumaHatasi(
      'Dosya biçimi tanınmadı. Rapor PDF veya Word (.docx) olmalıdır.',
      'BICIM_TANINMADI',
      baslangic,
    );
  }

  const kontroller: KontrolSonucu[] = [
    dilKontrolu(belge, sablon.beklenenDil),
    sablonKontrolu(belge, sablon, eskiler),
    baslikKontrolu(belge, sablon),
    kaynakcaKontrolu(belge, sablon.kaynakca),
    kategoriKontrolu(belge, kategoriler, secenekler.beyanEdilenKategori),
  ];

  // Kaynak doğrulama ayrı aşama: ağ gerektirir, bu yüzden isteğe bağlı.
  let kaynakDogrulamasi: DogrulamaOzeti | undefined;
  if (secenekler.kaynakDogrula) {
    const cozum = kaynakcayiCozumle(belge, sablon.kaynakca);
    kaynakDogrulamasi = await kaynaklariDogrula(cozum.kaynaklar, {
      agKullan: true,
      iletisim: secenekler.dogrulamaIletisim,
    });
    const kaynakcaKontrol = kontroller.find((k) => k.kod === 'kaynakca');
    if (kaynakcaKontrol) dogrulamaBulgulariEkle(kaynakcaKontrol, kaynakDogrulamasi);
  }

  const tumBulgular = kontroller.flatMap((k) => k.bulgular);

  return {
    basarili: true,
    belge,
    kontroller,
    kaynakDogrulamasi,
    genelDurum: enKotu(kontroller.map((k) => k.durum)),
    kritikBulgular: tumBulgular.filter((b) => b.seviye === 'hata'),
    istatistik: {
      sayfaSayisi: belge.sayfaSayisi,
      kelimeSayisi: belge.kelimeSayisi,
      gorselSayisi: belge.gorselSayisi,
      baslikSayisi: belge.basliklar.length,
      taranmisMi: belge.taranmisMi,
      metinBozulmaOrani: Math.round(bozulmaOrani(belge.metin) * 100) / 100,
      yinelenenSatirSayisi: belge.yinelenenSatirlar.length,
      sureMs: Date.now() - baslangic,
    },
  };
}

/** Doğrulama sonuçlarını kaynakça kontrolüne bulgu olarak işler. */
function dogrulamaBulgulariEkle(kontrol: KontrolSonucu, ozet: DogrulamaOzeti): void {
  const guclu = ozet.kayitlar.filter((k) => k.sonuc === 'bulunamadi' && k.guven >= 0.5);
  if (guclu.length) {
    kontrol.bulgular.push({
      kod: 'KAYNAK_DOGRULANAMADI',
      seviye: guclu.length >= 3 ? 'hata' : 'uyari',
      baslik: `${guclu.length} kaynak akademik indekslerde bulunamadı`,
      aciklama:
        `${guclu.map((k) => `[${k.numara}]`).join(', ')} numaralı künyeler Crossref ve ` +
        'OpenAlex indekslerinde bulunamadı. Bu tek başına sahtelik kanıtı değildir; ' +
        'hakem doğrulamalıdır.',
    });
  }

  for (const k of ozet.kayitlar.filter((x) => x.sonuc === 'kismen')) {
    kontrol.bulgular.push({
      kod: 'KAYNAK_KUNYE_SAPMASI',
      seviye: 'uyari',
      baslik: `[${k.numara}] künyesi kayıtla tutmuyor`,
      aciklama: k.bayraklar.join(' · '),
      kanit: k.eslesme ? `İndeks kaydı: ${k.eslesme.baslik} (${k.eslesme.yil ?? '?'})` : undefined,
    });
  }

  for (const k of ozet.kayitlar) {
    for (const b of k.bayraklar) {
      if (!/Gelecek tarihli|Wikipedia atfına/.test(b)) continue;
      kontrol.bulgular.push({
        kod: 'KAYNAK_TUTARSIZ',
        seviye: 'uyari',
        baslik: `[${k.numara}] künyesinde tutarsızlık`,
        aciklama: b,
      });
    }
  }

  for (const b of ozet.genelBayraklar) {
    kontrol.bulgular.push({
      kod: 'KAYNAKCA_DESEN',
      seviye: 'uyari',
      baslik: 'Kaynakçanın bütününe dair uyarı',
      aciklama: b,
    });
  }

  if (kontrol.bulgular.some((b) => b.seviye === 'hata')) kontrol.durum = 'hata';
  else if (kontrol.bulgular.some((b) => b.seviye === 'uyari')) kontrol.durum = 'uyari';

  kontrol.ozet += ` · ${ozet.dogrulanan} doğrulandı`;
}

function okumaHatasi(hata: string, kod: string, baslangic: number): AnalizSonucu {
  return {
    basarili: false,
    hata,
    kontroller: [],
    genelDurum: 'hata',
    kritikBulgular: [{ kod, seviye: 'hata', baslik: 'Rapor okunamadı', aciklama: hata }],
    istatistik: bosIstatistik(Date.now() - baslangic),
  };
}

const SIRA: Record<Seviye, number> = { temiz: 0, bilgi: 1, uyari: 2, hata: 3 };

function enKotu(seviyeler: Seviye[]): Seviye {
  return seviyeler.reduce<Seviye>((en, s) => (SIRA[s] > SIRA[en] ? s : en), 'temiz');
}

function bosIstatistik(sureMs: number): AnalizSonucu['istatistik'] {
  return {
    sayfaSayisi: 0, kelimeSayisi: 0, gorselSayisi: 0, baslikSayisi: 0,
    taranmisMi: false, metinBozulmaOrani: 0, yinelenenSatirSayisi: 0, sureMs,
  };
}

export * from './tipler';
export { GUNCEL_SABLON, ESKI_SABLONLAR, SABLONLAR } from './sablonlar';
export { KATEGORILER } from './kategoriler';
export { sablonCikar, rubrikCikar, docxParagraflari } from './sablon-cikar';
export type { SablonCikarimi, SablonKurallari, Rubrik, RubrikKriteri } from './sablon-cikar';
export { bicimTespitEt, docxOku, type BelgeBicimi } from './belge-docx';
export {
  kaynaklariDogrula, baslikCikar, ilkYazarCikar,
  type Dogrulama, type DogrulamaOzeti, type KaynakDogrulamasi,
} from './kaynak-dogrula';
export type { Kategori } from './kategori';
export {
  parmakiziCikar, korpusTara, ciftKarsilastir, benzerlikKontrolu, ozgunMetin,
  type Parmakizi, type KorpusSonucu, type CiftSonucu,
} from './benzerlik';
