/**
 * Örnek veri için en küçük geçerli PDF üreticisi.
 *
 * ── NİYE VAR ────────────────────────────────────────────────────────────
 * Tohum betiği rapor KAYDI yazıyordu ama dosya yazmıyordu. Sonuç: hakem
 * panelinde "belgeyi görüntüleyemiyorum" durumu — üründe olmaması gereken
 * bir hâl. Rapor kaydı ancak yarışmacı bir dosya yüklediği için var
 * oluyor; dosyasız rapor gerçek akışta oluşmuyor. Tanıtım verisinin
 * ürünü olmayan bir duruma sokması, ekranı yanlış tanıtmak demek.
 *
 * ── NİYE GERÇEK RAPORLAR KULLANILMIYOR ──────────────────────────────────
 * `veri/dosyalar/` içinde gerçek yarışmacı belgeleri var. Onları örnek
 * takımlara iliştirmek, gerçek bir takımın belgesini uydurma bir takıma
 * mal etmek olurdu. Örnek veri sentetik olmalı.
 *
 * ── NİYE KÜTÜPHANE YOK ──────────────────────────────────────────────────
 * Tanıtım için tek sayfalık düz metin yetiyor; bunun için bağımlılık
 * eklemek, üretim paketine yalnızca tohum betiğinin ihtiyacı olan bir
 * yük koymak olurdu. PDF'in kendisi elle kuruluyor — çapraz başvuru
 * tablosundaki bayt konumları hesaplanarak yazılıyor, çünkü yanlış
 * konum tarayıcının dosyayı hiç açmaması demek.
 */

/** PDF metin dizesi için kaçış: ters bölü ve parantezler. */
function kacir(m: string): string {
  return m.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/**
 * Latin-1'e sığmayan karakterleri sadeleştirir.
 *
 * Gömülü yazı tipi olmadan PDF'in standart fontu (Helvetica) WinAnsi
 * kodlaması kullanıyor ve Türkçe'nin ş/ğ/ı harfleri orada yok. Yazı tipi
 * gömmek bu betiğin işi değil; harfler sadeleştiriliyor ve belge
 * okunabilir kalıyor.
 */
function sadelestir(m: string): string {
  /*
   * WinAnsi (cp1252) Türkçe'nin ÇOĞUNU zaten taşıyor: ç ö ü â î û
   * hepsi 0xC0-0xFF aralığında ve latin1 baytlarıyla birebir aynı yere
   * düşüyor. Önceki sürüm bunları da sadeleştiriyordu ve belge gereksiz
   * yere "Ruzgar Turbini" gibi okunuyordu.
   *
   * Kodlamada gerçekten olmayan dört harf var: ş ğ ı İ. Yalnızca onlar
   * değişiyor. Yazı tipi gömmek bu betiğin işi değil.
   */
  const harf: Record<string, string> = {
    ğ: 'g', Ğ: 'G', ı: 'i', İ: 'I', ş: 's', Ş: 'S',
    '—': '-', '–': '-', '’': "'", '“': '"', '”': '"',
  };
  return [...m].map((h) => harf[h] ?? h).join('');
}

export interface PdfSayfasi {
  baslik: string;
  satirlar: string[];
}

/**
 * Verilen sayfalardan tek parça PDF üretir.
 *
 * Nesne düzeni: 1 Catalog · 2 Pages · 3 Font · sonra her sayfa için bir
 * Page ve bir içerik akışı.
 */
export function pdfUret(sayfalar: PdfSayfasi[]): Uint8Array {
  const nesneler: string[] = [];
  const sayfaKimlikleri: number[] = [];

  // 1, 2, 3 sabit; sayfalar 4'ten başlıyor.
  const ilkSayfa = 4;
  sayfalar.forEach((s, i) => sayfaKimlikleri.push(ilkSayfa + i * 2));

  nesneler[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  nesneler[2] =
    `<< /Type /Pages /Kids [${sayfaKimlikleri.map((k) => `${k} 0 R`).join(' ')}]`
    + ` /Count ${sayfalar.length} >>`;
  nesneler[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';

  sayfalar.forEach((s, i) => {
    const sayfaNo = ilkSayfa + i * 2;
    const akisNo = sayfaNo + 1;

    const parcalar: string[] = ['BT', '/F1 15 Tf', '1 0 0 1 62 760 Tm', '19 TL'];
    parcalar.push(`(${kacir(sadelestir(s.baslik))}) Tj`, 'T*', 'T*');
    parcalar.push('/F1 10.5 Tf', '15 TL');
    for (const satir of s.satirlar) {
      /*
       * Uzun satırlar elle bölünüyor: PDF'te otomatik sarma yok, taşan
       * metin sayfanın dışına çıkıp görünmez oluyor.
       */
      const kelimeler = sadelestir(satir).split(/\s+/);
      let biriken = '';
      for (const k of kelimeler) {
        if ((biriken + ' ' + k).trim().length > 86) {
          parcalar.push(`(${kacir(biriken)}) Tj`, 'T*');
          biriken = k;
        } else {
          biriken = (biriken + ' ' + k).trim();
        }
      }
      if (biriken) parcalar.push(`(${kacir(biriken)}) Tj`, 'T*');
      parcalar.push('T*');
    }
    parcalar.push('ET');

    const akis = parcalar.join('\n');
    nesneler[sayfaNo] =
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842]'
      + ` /Resources << /Font << /F1 3 0 R >> >> /Contents ${akisNo} 0 R >>`;
    nesneler[akisNo] = `<< /Length ${Buffer.byteLength(akis, 'latin1')} >>\nstream\n${akis}\nendstream`;
  });

  /*
   * ÇAPRAZ BAŞVURU TABLOSU BAYT KONUMU İSTİYOR.
   * Konumlar yazarken biriktiriliyor; sonradan hesaplamak, araya giren
   * her karakterde kayma riski demek.
   */
  let govde = '%PDF-1.4\n';
  const konumlar: number[] = [];
  for (let i = 1; i < nesneler.length; i++) {
    if (!nesneler[i]) continue;
    konumlar[i] = Buffer.byteLength(govde, 'latin1');
    govde += `${i} 0 obj\n${nesneler[i]}\nendobj\n`;
  }

  const xrefKonumu = Buffer.byteLength(govde, 'latin1');
  const adet = nesneler.length;
  let xref = `xref\n0 ${adet}\n0000000000 65535 f \n`;
  for (let i = 1; i < adet; i++) {
    xref += konumlar[i] !== undefined
      ? `${String(konumlar[i]).padStart(10, '0')} 00000 n \n`
      : '0000000000 65535 f \n';
  }

  govde +=
    xref
    + `trailer\n<< /Size ${adet} /Root 1 0 R >>\nstartxref\n${xrefKonumu}\n%%EOF\n`;

  return new Uint8Array(Buffer.from(govde, 'latin1'));
}
