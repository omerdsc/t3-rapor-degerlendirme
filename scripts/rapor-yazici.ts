/**
 * Sentetik rapor PDF'i yazma altyapısı.
 *
 * İki test seti bunu paylaşır:
 *   · ornek-rapor-uret.ts → yapısal kontrol fixture'ları (MVP 1-2-3)
 *   · korpus-uret.ts      → benzerlik korpusu (MVP 5)
 *
 * pHash yalnızca gömülü raster görselleri görebildiği için şekiller vektör
 * çizim değil, gerçek PNG olarak gömülür. Bağımlılık eklememek adına PNG
 * kodlayıcı burada minimal biçimde yazılmıştır.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const FONT_YOLU = 'C:/Windows/Fonts/arial.ttf';
const FONT_KALIN_YOLU = 'C:/Windows/Fonts/arialbd.ttf';

const SAYFA = { g: 595, y: 842, kenar: 60 };
const GOVDE_PUNTO = 10.5;
const BASLIK_PUNTO = 14;
const SATIR_ARALIGI = 15;

export interface Bolum {
  baslik: string;
  paragraflar: string[];
}

export type DiyagramVaryanti = 'A' | 'B' | 'C' | 'D';

export interface RaporTanimi {
  dosya: string;
  aciklama: string;
  takim: string;
  /** Aynı takımın devam projesini kopyadan ayırmak için. */
  takimId: string;
  proje: string;
  yil: number;
  kategori: string;
  bolumler: Bolum[];
  /** Şekil olarak gömülecek diyagram. Aynı varyant = görsel kopya. */
  gorsel?: DiyagramVaryanti;
  /** Metin katmanını kasıtlı olarak boşalt — taranmış PDF taklidi. */
  taranmis?: boolean;
}

// ------------------------------------------------------------ PNG kodlayıcı

const CRC_TABLO = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLO[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function pngParcasi(tur: string, veri: Buffer): Buffer {
  const uzunluk = Buffer.alloc(4);
  uzunluk.writeUInt32BE(veri.length);
  const govde = Buffer.concat([Buffer.from(tur, 'latin1'), veri]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(govde));
  return Buffer.concat([uzunluk, govde, crc]);
}

function pngKodla(rgbVeri: Uint8Array, en: number, boy: number): Buffer {
  const satirBoyu = en * 3 + 1;
  const ham = Buffer.alloc(satirBoyu * boy);
  for (let y = 0; y < boy; y++) {
    ham[y * satirBoyu] = 0; // filtre: none
    ham.set(rgbVeri.subarray(y * en * 3, (y + 1) * en * 3), y * satirBoyu + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(en, 0);
  ihdr.writeUInt32BE(boy, 4);
  ihdr[8] = 8; // bit derinliği
  ihdr[9] = 2; // renk tipi: truecolor
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngParcasi('IHDR', ihdr),
    pngParcasi('IDAT', deflateSync(ham, { level: 9 })),
    pngParcasi('IEND', Buffer.alloc(0)),
  ]);
}

/** Basit yazılım rasterleştirici — blok diyagram çizmeye yetiyor. */
class Tuval {
  readonly veri: Uint8Array;
  constructor(readonly en: number, readonly boy: number) {
    this.veri = new Uint8Array(en * boy * 3).fill(255);
  }
  private nokta(x: number, y: number, gri: number) {
    if (x < 0 || y < 0 || x >= this.en || y >= this.boy) return;
    const i = (y * this.en + x) * 3;
    this.veri[i] = gri;
    this.veri[i + 1] = gri;
    this.veri[i + 2] = gri;
  }
  dikdortgen(x: number, y: number, w: number, h: number, gri: number, dolu = false) {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const kenarda = i < 2 || j < 2 || i >= w - 2 || j >= h - 2;
        if (dolu || kenarda) this.nokta(x + i, y + j, gri);
      }
    }
  }
  yatayCizgi(x: number, y: number, uzunluk: number, gri: number) {
    for (let i = 0; i < uzunluk; i++) {
      this.nokta(x + i, y, gri);
      this.nokta(x + i, y + 1, gri);
    }
  }
  dikeyCizgi(x: number, y: number, uzunluk: number, gri: number) {
    for (let i = 0; i < uzunluk; i++) {
      this.nokta(x, y + i, gri);
      this.nokta(x + 1, y + i, gri);
    }
  }
}

/** Dört ayrı blok diyagram. Aynı varyant iki raporda = görsel kopya. */
export function diyagram(varyant: DiyagramVaryanti): Buffer {
  const t = new Tuval(480, 200);
  switch (varyant) {
    case 'A': // yatay üç aşamalı boru hattı
      t.dikdortgen(20, 70, 110, 60, 70);
      t.yatayCizgi(130, 100, 40, 120);
      t.dikdortgen(170, 55, 130, 90, 70);
      t.yatayCizgi(300, 100, 40, 120);
      t.dikdortgen(340, 70, 110, 60, 70);
      t.dikdortgen(190, 80, 90, 18, 150, true);
      t.dikdortgen(190, 108, 60, 12, 190, true);
      break;
    case 'B': // dikey katmanlı mimari
      t.dikdortgen(140, 15, 200, 45, 70);
      t.dikdortgen(60, 80, 150, 50, 70);
      t.dikdortgen(270, 80, 150, 50, 70);
      t.dikdortgen(140, 150, 200, 40, 70);
      t.yatayCizgi(60, 70, 360, 120);
      t.dikdortgen(90, 95, 90, 14, 160, true);
      t.dikdortgen(300, 95, 90, 14, 160, true);
      break;
    case 'C': // yıldız topoloji
      t.dikdortgen(190, 80, 100, 45, 70);
      t.dikdortgen(30, 20, 80, 35, 70);
      t.dikdortgen(370, 20, 80, 35, 70);
      t.dikdortgen(30, 150, 80, 35, 70);
      t.dikdortgen(370, 150, 80, 35, 70);
      t.dikeyCizgi(70, 55, 25, 120);
      t.dikeyCizgi(410, 55, 25, 120);
      t.dikeyCizgi(70, 125, 25, 120);
      t.dikeyCizgi(410, 125, 25, 120);
      t.yatayCizgi(110, 102, 80, 120);
      t.yatayCizgi(290, 102, 80, 120);
      break;
    case 'D': // geri beslemeli döngü
      t.dikdortgen(40, 60, 120, 55, 70);
      t.dikdortgen(200, 60, 120, 55, 70);
      t.dikdortgen(360, 60, 90, 55, 70);
      t.yatayCizgi(160, 87, 40, 120);
      t.yatayCizgi(320, 87, 40, 120);
      t.dikeyCizgi(405, 115, 45, 120);
      t.yatayCizgi(100, 160, 305, 120);
      t.dikeyCizgi(100, 115, 45, 120);
      t.dikdortgen(220, 75, 80, 16, 155, true);
      break;
  }
  return pngKodla(t.veri, t.en, t.boy);
}

// ------------------------------------------------------------- metin dizimi

function satirlaraBol(metin: string, font: PDFFont, punto: number, genislik: number): string[] {
  const kelimeler = metin.split(/\s+/);
  const satirlar: string[] = [];
  let aktif = '';

  for (const kelime of kelimeler) {
    const aday = aktif ? `${aktif} ${kelime}` : kelime;
    if (font.widthOfTextAtSize(aday, punto) > genislik && aktif) {
      satirlar.push(aktif);
      aktif = kelime;
    } else {
      aktif = aday;
    }
  }
  if (aktif) satirlar.push(aktif);
  return satirlar;
}

class Yazici {
  private sayfa!: PDFPage;
  private y = 0;
  private sayfaNo = 0;

  constructor(
    private belge: PDFDocument,
    private normal: PDFFont,
    private kalin: PDFFont,
    private ustBilgi: string,
    private resim?: PDFImage,
  ) {
    this.yeniSayfa();
  }

  private yeniSayfa() {
    this.sayfa = this.belge.addPage([SAYFA.g, SAYFA.y]);
    this.sayfaNo++;

    // Her sayfada tekrar eden üst/alt bilgi — header-footer ayıklamasını test eder.
    this.sayfa.drawText(this.ustBilgi, {
      x: SAYFA.kenar, y: SAYFA.y - 34, size: 8,
      font: this.normal, color: rgb(0.45, 0.45, 0.45),
    });
    this.sayfa.drawText(`Sayfa ${this.sayfaNo}`, {
      x: SAYFA.g - SAYFA.kenar - 40, y: 32, size: 8,
      font: this.normal, color: rgb(0.45, 0.45, 0.45),
    });

    this.y = SAYFA.y - 68;
  }

  private yerAc(gerekli: number) {
    if (this.y - gerekli < 62) this.yeniSayfa();
  }

  baslik(metin: string) {
    this.yerAc(SATIR_ARALIGI * 2.4);
    this.y -= SATIR_ARALIGI * 0.9;
    this.sayfa.drawText(metin, {
      x: SAYFA.kenar, y: this.y, size: BASLIK_PUNTO,
      font: this.kalin, color: rgb(0.08, 0.12, 0.18),
    });
    this.y -= SATIR_ARALIGI * 1.35;
  }

  paragraf(metin: string) {
    const genislik = SAYFA.g - SAYFA.kenar * 2;
    for (const satir of satirlaraBol(metin, this.normal, GOVDE_PUNTO, genislik)) {
      this.yerAc(SATIR_ARALIGI);
      this.sayfa.drawText(satir, {
        x: SAYFA.kenar, y: this.y, size: GOVDE_PUNTO,
        font: this.normal, color: rgb(0.15, 0.19, 0.25),
      });
      this.y -= SATIR_ARALIGI;
    }
    this.y -= SATIR_ARALIGI * 0.45;
  }

  /** Şekli çizer. Gömülü raster görsel varsa onu kullanır — pHash bunu görür. */
  sekil(yukseklik = 100) {
    this.yerAc(yukseklik + SATIR_ARALIGI);
    const genislik = SAYFA.g - SAYFA.kenar * 2;

    if (this.resim) {
      const oran = Math.min(genislik / this.resim.width, yukseklik / this.resim.height);
      const g = this.resim.width * oran;
      const b = this.resim.height * oran;
      this.sayfa.drawImage(this.resim, {
        x: SAYFA.kenar + (genislik - g) / 2, y: this.y - b, width: g, height: b,
      });
    } else {
      this.sayfa.drawRectangle({
        x: SAYFA.kenar, y: this.y - yukseklik, width: genislik, height: yukseklik,
        borderColor: rgb(0.72, 0.75, 0.79), borderWidth: 1,
      });
    }
    this.y -= yukseklik + SATIR_ARALIGI * 0.8;
  }
}

// ------------------------------------------------------------------- üretim

let fontOnbellek: { normal: Buffer; kalin: Buffer } | null = null;

function fontlar() {
  if (!fontOnbellek) {
    fontOnbellek = {
      normal: readFileSync(FONT_YOLU),
      kalin: readFileSync(FONT_KALIN_YOLU),
    };
  }
  return fontOnbellek;
}

/** Raporu üretir, diske yazar ve bayt boyutunu döner. */
export async function raporYaz(tanim: RaporTanimi, ciktiKlasoru: string): Promise<number> {
  const belge = await PDFDocument.create();
  belge.registerFontkit(fontkit);

  const { normal: normalBayt, kalin: kalinBayt } = fontlar();
  const normal = await belge.embedFont(normalBayt, { subset: true });
  const kalin = await belge.embedFont(kalinBayt, { subset: true });

  const ustBilgi = `TEKNOFEST ${tanim.yil} | ${tanim.takim} | ${tanim.proje}`;

  if (tanim.taranmis) {
    // Metin katmanı neredeyse boş: taranmış belge taklidi.
    for (let i = 0; i < 6; i++) {
      const sayfa = belge.addPage([SAYFA.g, SAYFA.y]);
      sayfa.drawRectangle({
        x: 50, y: 90, width: SAYFA.g - 100, height: SAYFA.y - 180,
        color: rgb(0.96, 0.96, 0.96),
      });
      if (i === 0) {
        sayfa.drawText('TARANMIS', {
          x: 60, y: 60, size: 8, font: normal, color: rgb(0.6, 0.6, 0.6),
        });
      }
    }
  } else {
    const resim = tanim.gorsel ? await belge.embedPng(diyagram(tanim.gorsel)) : undefined;
    const yazici = new Yazici(belge, normal, kalin, ustBilgi, resim);

    for (const bolum of tanim.bolumler) {
      yazici.baslik(bolum.baslik);
      for (const p of bolum.paragraflar) {
        yazici.paragraf(p);
        if (/^(Şekil|Tablo)\s+\d/.test(p)) yazici.sekil();
      }
    }
  }

  const bayt = await belge.save();
  writeFileSync(join(ciktiKlasoru, tanim.dosya), bayt);
  return bayt.length;
}
