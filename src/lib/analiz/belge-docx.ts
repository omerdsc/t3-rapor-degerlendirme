/**
 * DOCX rapor okuyucu.
 *
 * Yarışmacı her zaman PDF yüklemiyor; Word dosyası da gelebiliyor, şablon
 * PDF olarak da paylaşılabiliyor. Motor girdi biçimine bağımlı olmamalı:
 * hangi biçim gelirse gelsin aynı `Belge` nesnesi üretilir, tüm kontroller
 * değişmeden çalışır.
 *
 * PDF'e göre bir avantaj, bir dezavantaj var:
 *   + Başlıklar stil bilgisinden kesin okunur — punto tahminine gerek yok.
 *   − Sayfa kavramı yoktur; sayfa numarası veren bulgular yaklaşık kalır.
 */

import { unzipSync, strFromU8 } from 'fflate';
import type { Baslik, Belge, Bolum, Satir } from './tipler';
import { anahtar, baslikSeviyesi, kelimeler, numarayiAyir, onar } from './normalize';
import { docxParagraflari } from './sablon-cikar';

/** Word'ün başlık stilleri — Türkçe ve İngilizce arayüzden gelen adlar. */
const BASLIK_STILI = /^(Balk\d*|Balık\d*|Heading\d*|Numaras[ıi]zBal[ıi]k|Title)$/i;

/** Sayfa sonu belirteci — kabaca sayfa saymak için. */
const SAYFA_SONU = /<w:br[^>]*w:type="page"|<w:lastRenderedPageBreak/g;

export type DocxSonucu =
  | { tamam: true; belge: Belge }
  | { tamam: false; hata: string };

export function docxOku(veri: Uint8Array): DocxSonucu {
  let paragraflar;
  try {
    paragraflar = docxParagraflari(veri);
  } catch (e) {
    return { tamam: false, hata: e instanceof Error ? e.message : 'DOCX okunamadı.' };
  }
  if (!paragraflar.length) return { tamam: false, hata: 'Belgede metin bulunamadı.' };

  const sayfaSayisi = sayfalariSay(veri);
  const gorselSayisi = gorselleriSay(veri);

  const satirlar: Satir[] = [];
  const basliklar: Baslik[] = [];

  paragraflar.forEach((p, i) => {
    const metin = onar(p.metin);
    if (!metin) return;

    const baslikMi = BASLIK_STILI.test(p.stil);
    satirlar.push({
      metin,
      // DOCX'te sayfa yok; bulgular bölüm adıyla konumlanır.
      sayfa: 0,
      y: -i,
      x: 0,
      punto: baslikMi ? 14 : 12,
      kalinMi: baslikMi,
      yinelenen: false,
    });

    if (baslikMi) {
      const { numara, sade } = numarayiAyir(metin);
      basliklar.push({
        metin,
        numara,
        sade,
        sayfa: 0,
        satirIndeksi: satirlar.length - 1,
        seviye: baslikSeviyesi(numara),
      });
    }
  });

  const bolumler = bolumlereAyir(satirlar, basliklar);
  const metin = satirlar.map((s) => s.metin).join('\n');

  return {
    tamam: true,
    belge: {
      sayfalar: [],
      satirlar,
      metin,
      basliklar,
      bolumler,
      yinelenenSatirlar: [],
      sayfaSayisi,
      taranmisMi: false,
      gorselSayisi,
      // Görsel karşılaştırması PDF yolunda yapılır; DOCX'te gömülü resimlerin
      // çözülmesi ayrı bir kod çözücü gerektiriyor.
      gorseller: [],
      kelimeSayisi: kelimeler(metin).length,
    },
  };
}

function bolumlereAyir(satirlar: Satir[], basliklar: Baslik[]): Bolum[] {
  return basliklar.map((baslik, i) => {
    const bas = baslik.satirIndeksi + 1;
    const son = i + 1 < basliklar.length ? basliklar[i + 1].satirIndeksi : satirlar.length;
    const govde = satirlar.slice(bas, son).map((s) => s.metin).join('\n').trim();
    return { baslik, govde, kelimeSayisi: kelimeler(govde).length };
  });
}

/** Word sayfa sonlarını sayar. Kesin değil ama sayfa sınırı kontrolü için yeterli. */
function sayfalariSay(veri: Uint8Array): number {
  try {
    const arsiv = unzipSync(veri, { filter: (f) => f.name === 'word/document.xml' });
    const xml = strFromU8(arsiv['word/document.xml']);
    return (xml.match(SAYFA_SONU) ?? []).length + 1;
  } catch {
    return 0;
  }
}

function gorselleriSay(veri: Uint8Array): number {
  try {
    const arsiv = unzipSync(veri, { filter: (f) => f.name.startsWith('word/media/') });
    return Object.keys(arsiv).length;
  } catch {
    return 0;
  }
}

// -------------------------------------------------------------- biçim seçimi

export type BelgeBicimi = 'pdf' | 'docx' | 'bilinmiyor';

/** Uzantıya değil içeriğe bakar — yanlış uzantılı dosya sık geliyor. */
export function bicimTespitEt(veri: Uint8Array): BelgeBicimi {
  if (veri.length < 4) return 'bilinmiyor';
  // %PDF
  if (veri[0] === 0x25 && veri[1] === 0x50 && veri[2] === 0x44 && veri[3] === 0x46) return 'pdf';
  // PK.. — ZIP; docx, xlsx, pptx hepsi ZIP. İçeriğe bakarak ayırıyoruz.
  if (veri[0] === 0x50 && veri[1] === 0x4b) {
    try {
      const arsiv = unzipSync(veri, { filter: (f) => f.name === 'word/document.xml' });
      if (arsiv['word/document.xml']) return 'docx';
    } catch {
      return 'bilinmiyor';
    }
  }
  return 'bilinmiyor';
}
