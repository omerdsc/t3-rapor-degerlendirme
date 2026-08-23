/**
 * PDF metin katmanının koordinatlarıyla birlikte çıkarılması.
 *
 * Sadece düz metin yetmiyor: sayfa başlığı/altlığı ayıklamak, okuma sırasını
 * düzeltmek ve başlıkları punto farkından tanımak için her metin parçasının
 * konumu gerekiyor.
 *
 * Belge YALNIZCA BİR KEZ açılır. pdf.js kendisine verilen tamponu devralıp
 * ayırıyor (detach); aynı Uint8Array ikinci kez geçilirse DataCloneError
 * alınır. Bu yüzden hem açılabilirlik kontrolü hem görsel sayımı tek geçişte
 * yapılır.
 */

import { extractImages, getDocumentProxy } from 'unpdf';
import type { GorselIzi, HamBelge, HamSayfa, MetinOgesi } from './tipler';
import { onar } from './normalize';
import { gorselHash, type HamGorsel } from './phash';

/** Sayfa başına bu eşiğin altında karakter varsa belge taranmış sayılır. */
const TARANMIS_ESIGI = 200;

interface PdfTextItem {
  str?: string;
  transform?: number[];
  width?: number;
  fontName?: string;
}

export type PdfSonucu =
  | { tamam: true; belge: HamBelge }
  | { tamam: false; hata: string };

export async function pdfOku(veri: Uint8Array): Promise<PdfSonucu> {
  let pdf;
  try {
    // Kopya geçiyoruz: çağıranın tamponu kullanılabilir kalsın.
    pdf = await getDocumentProxy(new Uint8Array(veri));
  } catch (e) {
    return { tamam: false, hata: acilmaHatasi(e) };
  }

  if (pdf.numPages < 1) return { tamam: false, hata: 'Belge hiç sayfa içermiyor.' };

  const sayfalar: HamSayfa[] = [];
  const gorseller: GorselIzi[] = [];

  for (let no = 1; no <= pdf.numPages; no++) {
    const sayfa = await pdf.getPage(no);
    const gorunum = sayfa.getViewport({ scale: 1 });
    const icerik = await sayfa.getTextContent();

    const ogeler: MetinOgesi[] = [];
    for (const ham of icerik.items as PdfTextItem[]) {
      const metin = ham.str ?? '';
      if (!metin.trim()) continue;
      const t = ham.transform ?? [1, 0, 0, 1, 0, 0];
      ogeler.push({
        metin,
        x: t[4],
        y: t[5],
        genislik: ham.width ?? 0,
        // Ölçek matrisinden gerçek punto; d bileşeni dönmüş metinde yanıltır.
        puntoBoyutu: Math.round(Math.hypot(t[2], t[3]) * 10) / 10,
        fontAdi: ham.fontName ?? '',
      });
    }

    gorseller.push(...(await sayfaGorselleri(pdf, no)));
    sayfalar.push({ no, genislik: gorunum.width, yukseklik: gorunum.height, ogeler });
  }

  const toplamKarakter = sayfalar.reduce(
    (t, s) => t + s.ogeler.reduce((a, o) => a + o.metin.length, 0),
    0,
  );

  return {
    tamam: true,
    belge: {
      sayfalar,
      sayfaSayisi: pdf.numPages,
      taranmisMi: toplamKarakter / pdf.numPages < TARANMIS_ESIGI,
      gorselSayisi: gorseller.length,
      gorseller,
    },
  };
}

function acilmaHatasi(e: unknown): string {
  const mesaj = e instanceof Error ? e.message : String(e);
  if (/password/i.test(mesaj)) return 'PDF parola korumalı; metin çıkarılamıyor.';
  if (/invalid|corrupt|structure/i.test(mesaj)) return 'PDF yapısı bozuk; belge ayrıştırılamadı.';
  return `PDF okunamadı: ${mesaj}`;
}

/**
 * Sayfadaki görselleri çıkarır ve her birinin algısal hash'ini hesaplar.
 * Piksel verisi hash alındıktan sonra atılır — bellekte tutulmaz.
 *
 * Açık belge nesnesi geçilir; ham tampon ikinci kez verilirse pdf.js onu
 * devralmış olduğu için DataCloneError alınır.
 */
async function sayfaGorselleri(
  pdf: Parameters<typeof extractImages>[0],
  sayfaNo: number,
): Promise<GorselIzi[]> {
  let ham: Awaited<ReturnType<typeof extractImages>>;
  try {
    ham = await extractImages(pdf, sayfaNo);
  } catch {
    // Desteklenmeyen renk uzayı veya bozuk akış analizi durdurmamalı.
    return [];
  }

  return ham.map((g, i) => ({
    sayfa: sayfaNo,
    sira: i + 1,
    genislik: g.width,
    yukseklik: g.height,
    hash: gorselHash(g as unknown as HamGorsel),
  }));
}

/** Ham metin parçalarından onarılmış düz metin — hızlı kontroller için. */
export function duzMetin(sayfa: HamSayfa): string {
  return onar(sayfa.ogeler.map((o) => o.metin).join(' '));
}
