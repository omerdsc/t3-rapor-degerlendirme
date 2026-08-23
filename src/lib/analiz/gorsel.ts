/**
 * Rapordaki şekilleri çıkarır ve modele gönderilebilir hâle getirir.
 *
 * NEDEN GEREKLİ
 * Yarışmacılar akış şemasını, sistem mimarisini ve test grafiklerini metin
 * olarak yazmıyor — çiziyor ve görsel olarak ekliyor. Yalnızca metne bakan
 * bir değerlendirme, "Akış Şeması" bölümünde beş kelime görüp "içerik
 * yetersiz" der. Bu yanlış: içerik orada, sadece resim hâlinde.
 *
 * Gerçek örnekte tam bu oldu: rapor akış şemasını çizmiş, sistem şekli
 * göremediği için puanı kırmıştı.
 *
 * MALİYET DENGESİ
 * Ham PDF'i modele vermek 29.792 token ediyordu (bkz. ai/degerlendirme.ts).
 * Şekilleri ayrı ayrı çıkarıp küçültmek çok daha ucuz: uzun kenarı 1100 px'e
 * indirilen bir diyagram ≈ 1.100 token. Altı şekil ≈ 6.600 token ≈ $0.03.
 *
 * Süs görselleri (logo, madde imi, çizgi) elenir; yoksa hem para hem
 * modelin dikkati boşa gider.
 */

import { extractImages, getDocumentProxy } from 'unpdf';
import { deflateSync } from 'node:zlib';
import type { Belge } from './tipler';
import { anahtar } from './normalize';

/** Bu boyutun altındaki görseller şekil değil, süstür. */
const ASGARI_EN = 200;
const ASGARI_BOY = 140;
/** Modele gönderilecek azami uzun kenar (px). Token maliyetini bu belirler. */
const AZAMI_KENAR = 1100;
/** Bir raporda modele gönderilecek azami şekil sayısı. */
export const AZAMI_SEKIL = 6;

export interface CikarilanSekil {
  sayfa: number;
  sira: number;
  en: number;
  boy: number;
  /** PNG, base64 (data: öneki olmadan). */
  png: string;
  /** Şeklin hangi bölüme ait olduğu — sayfa aralığından çözülür. */
  bolum?: string;
  /** Metinde bu şekle karşılık gelen başlık, ör. "Şekil 1: Sistemin Akışı". */
  altYazi?: string;
}

// ------------------------------------------------------------ PNG kodlama

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(b: Buffer): number {
  let c = -1;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function parca(tur: string, veri: Buffer): Buffer {
  const uzunluk = Buffer.alloc(4);
  uzunluk.writeUInt32BE(veri.length);
  const govde = Buffer.concat([Buffer.from(tur, 'latin1'), veri]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(govde));
  return Buffer.concat([uzunluk, govde, crc]);
}

/** RGB tamponunu PNG'ye çevirir. Bağımlılık eklememek için minimal kodlayıcı. */
function pngKodla(rgb: Uint8Array, en: number, boy: number): Buffer {
  const satirBoyu = en * 3 + 1;
  const ham = Buffer.alloc(satirBoyu * boy);
  for (let y = 0; y < boy; y++) {
    ham[y * satirBoyu] = 0; // filtre: none
    ham.set(rgb.subarray(y * en * 3, (y + 1) * en * 3), y * satirBoyu + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(en, 0);
  ihdr.writeUInt32BE(boy, 4);
  ihdr[8] = 8; // bit derinliği
  ihdr[9] = 2; // truecolor
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    parca('IHDR', ihdr),
    parca('IDAT', deflateSync(ham, { level: 6 })),
    parca('IEND', Buffer.alloc(0)),
  ]);
}

/** Kutu filtresiyle küçültüp RGB'ye çevirir. Alfa kanalı beyaz zemine düşer. */
function kucultRGB(
  veri: Uint8ClampedArray | Uint8Array,
  en: number,
  boy: number,
  kanal: number,
  hedefEn: number,
  hedefBoy: number,
): Uint8Array {
  const cikti = new Uint8Array(hedefEn * hedefBoy * 3);

  for (let hy = 0; hy < hedefBoy; hy++) {
    const y0 = Math.floor((hy * boy) / hedefBoy);
    const y1 = Math.max(y0 + 1, Math.floor(((hy + 1) * boy) / hedefBoy));

    for (let hx = 0; hx < hedefEn; hx++) {
      const x0 = Math.floor((hx * en) / hedefEn);
      const x1 = Math.max(x0 + 1, Math.floor(((hx + 1) * en) / hedefEn));

      let r = 0, g = 0, b = 0, sayi = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * en + x) * kanal;
          if (kanal === 1) {
            r += veri[i]; g += veri[i]; b += veri[i];
          } else {
            const alfa = kanal === 4 ? veri[i + 3] / 255 : 1;
            // Şeffaf bölge beyaz kabul edilir; diyagramlar beyaz zeminde okunur.
            r += veri[i] * alfa + 255 * (1 - alfa);
            g += veri[i + 1] * alfa + 255 * (1 - alfa);
            b += veri[i + 2] * alfa + 255 * (1 - alfa);
          }
          sayi++;
        }
      }
      const j = (hy * hedefEn + hx) * 3;
      cikti[j] = Math.round(r / sayi);
      cikti[j + 1] = Math.round(g / sayi);
      cikti[j + 2] = Math.round(b / sayi);
    }
  }
  return cikti;
}

/** Görsel bilgi taşıyor mu — tek renk zemin ve boş çerçeveler elenir. */
function bilgiTasiyorMu(rgb: Uint8Array): boolean {
  let toplam = 0;
  const n = rgb.length / 3;
  for (let i = 0; i < rgb.length; i += 3) {
    toplam += (rgb[i] + rgb[i + 1] + rgb[i + 2]) / 3;
  }
  const ortalama = toplam / n;

  let sapmaToplam = 0;
  for (let i = 0; i < rgb.length; i += 3) {
    sapmaToplam += Math.abs((rgb[i] + rgb[i + 1] + rgb[i + 2]) / 3 - ortalama);
  }
  // Ortalama mutlak sapma düşükse görsel neredeyse tek renktir.
  return sapmaToplam / n > 6;
}

// ------------------------------------------------- bölüm ve altyazı eşleme

/** Her bölümün başladığı sayfa. */
export function bolumBaslangiclari(belge: Belge): Array<{ ad: string; sayfa: number }> {
  return belge.bolumler.map((b) => ({ ad: b.baslik.sade, sayfa: b.baslik.sayfa }));
}

/**
 * Bir şekil, başlığı ondan HEMEN ÖNCE gelen bölüme aittir.
 *
 * Sayfa aralığı kesişimiyle arama yapmak yanlış sonuç veriyordu: "Algoritmalar"
 * s.8'de, "Akış Şeması" s.9'da başlıyorsa, s.9'daki şekil ilk eşleşen aralığa
 * (Algoritmalar) düşüyordu. Oysa akış şeması Akış Şeması bölümüne ait.
 * Doğrusu: sayfası şekilden küçük veya eşit olan SON bölüm.
 */
function sekilBolumu(
  baslangiclar: Array<{ ad: string; sayfa: number }>,
  sayfa: number,
): string | undefined {
  let sonuc: string | undefined;
  for (const b of baslangiclar) {
    if (b.sayfa <= sayfa) sonuc = b.ad;
    else break;
  }
  return sonuc;
}

/** Ön sayfalar: kapak, içindekiler, listeler. Buradaki görseller logodur. */
const ON_SAYFA_BASLIKLARI = /^(icindekiler|sekil listesi|tablo listesi|kisaltmalar)$/;

/** Sayfadaki "Şekil 3: ..." biçimli altyazıyı bulur. */
function altYaziBul(belge: Belge, sayfa: number): string | undefined {
  const aday = belge.satirlar.find(
    (s) => s.sayfa === sayfa && /^(Şekil|Tablo|Grafik)\s+\d/i.test(s.metin.trim()),
  );
  return aday?.metin.trim().slice(0, 120);
}

// ------------------------------------------------------------- ana akış

/**
 * Raporun şekillerini çıkarır, küçültür ve bölümlerle eşleştirir.
 * Belge yalnızca bir kez açılır — pdf.js tamponu devraldığı için ikinci
 * geçiş DataCloneError verir.
 */
export async function sekilleriCikar(
  veri: Uint8Array,
  belge: Belge,
  azami = AZAMI_SEKIL,
): Promise<CikarilanSekil[]> {
  let pdf;
  try {
    pdf = await getDocumentProxy(new Uint8Array(veri));
  } catch {
    return [];
  }

  const baslangiclar = bolumBaslangiclari(belge);

  // Numaralı ilk bölümden önceki sayfalar ön sayfadır (kapak, içindekiler).
  // Oradaki görseller logo ve kurum amblemi; modele göndermek para israfı.
  const ilkIcerikSayfasi = belge.bolumler.find((b) => b.baslik.numara !== null)?.baslik.sayfa ?? 1;

  const sekiller: CikarilanSekil[] = [];

  for (let no = 1; no <= pdf.numPages; no++) {
    let hamlar;
    try {
      hamlar = await extractImages(pdf, no);
    } catch {
      continue;
    }

    if (no < ilkIcerikSayfasi) continue;

    let sira = 0;
    for (const ham of hamlar) {
      sira++;
      const { width: en, height: boy, data, channels } = ham as {
        width: number; height: number; data: Uint8ClampedArray; channels: number;
      };
      if (!en || !boy || !data?.length) continue;
      if (en < ASGARI_EN || boy < ASGARI_BOY) continue;

      const oran = Math.min(1, AZAMI_KENAR / Math.max(en, boy));
      const hedefEn = Math.max(1, Math.round(en * oran));
      const hedefBoy = Math.max(1, Math.round(boy * oran));

      const rgb = kucultRGB(data, en, boy, channels, hedefEn, hedefBoy);
      if (!bilgiTasiyorMu(rgb)) continue;

      const bolum = sekilBolumu(baslangiclar, no);

      sekiller.push({
        sayfa: no,
        sira,
        en: hedefEn,
        boy: hedefBoy,
        png: pngKodla(rgb, hedefEn, hedefBoy).toString('base64'),
        bolum,
        altYazi: altYaziBul(belge, no),
      });
    }
  }

  // Büyük şekiller bilgi bakımından daha zengin; bütçe sınırlıysa onlar kalsın.
  return sekiller.sort((a, b) => b.en * b.boy - a.en * a.boy).slice(0, azami);
}

/**
 * Hangi bölümlerde gerçek şekil var — deterministik "içerik yetersiz"
 * kontrolü bunu kullanır.
 *
 * Boyut süzgeci şart: rapordaki 24 gömülü görselin çoğu logo, madde imi ve
 * çizgidir. Süzülmezse her bölüm "şekilli" görünür ve kontrol işe yaramaz.
 */
export function sekilliBolumler(belge: Belge): Set<string> {
  const baslangiclar = bolumBaslangiclari(belge);
  const onSayfalar = new Set(
    belge.bolumler
      .filter((b) => ON_SAYFA_BASLIKLARI.test(anahtar(b.baslik.sade)))
      .map((b) => b.baslik.sade),
  );

  // Kapak ve ön sayfalardaki görseller logo; içerik bölümlerinden önce başlar.
  const ilkIcerikSayfasi =
    belge.bolumler.find((b) => b.baslik.numara !== null)?.baslik.sayfa ?? 1;

  const sonuc = new Set<string>();
  for (const g of belge.gorseller) {
    if (g.sayfa < ilkIcerikSayfasi) continue;
    if (g.genislik < ASGARI_EN || g.yukseklik < ASGARI_BOY) continue;
    const ad = sekilBolumu(baslangiclar, g.sayfa);
    if (ad && !onSayfalar.has(ad)) sonuc.add(ad);
  }
  return sonuc;
}
