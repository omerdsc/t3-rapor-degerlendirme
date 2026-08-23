/**
 * Algısal hash (pHash) — görsel kopya tespiti.
 *
 * Metni farklı yazıp aynı şekli kullanmak, sahada en sık görülen kopya
 * biçimidir ve metin benzerliğiyle yakalanamaz. pHash görüntünün düşük
 * frekanslı yapısını 64 bite indirir; yeniden boyutlandırma, sıkıştırma ve
 * hafif renk değişimi hash'i bozmaz, gerçek içerik değişimi bozar.
 *
 * Model yok, bağımlılık yok — saf kod, $0.
 */

/** DCT giriş boyutu. 32×32, 8×8 düşük frekans bandı için yeterli çözünürlük. */
const N = 32;
/** Hash'e giren düşük frekans bloğu. */
const K = 8;

/** cos((2x+1)·u·π / 2N) tablosu — her görsel için yeniden hesaplanmaz. */
const KOSINUS = (() => {
  const t = new Float64Array(N * N);
  for (let x = 0; x < N; x++) {
    for (let u = 0; u < N; u++) {
      t[x * N + u] = Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N));
    }
  }
  return t;
})();

export interface HamGorsel {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
  /** 1 = gri, 3 = RGB, 4 = RGBA. */
  channels: number;
}

/** Görüntüyü N×N gri ölçekli diziye indirger (kutu filtresi). */
function kucult(g: HamGorsel): Float64Array {
  const { data, width, height, channels } = g;
  const cikti = new Float64Array(N * N);

  for (let by = 0; by < N; by++) {
    const y0 = Math.floor((by * height) / N);
    const y1 = Math.max(y0 + 1, Math.floor(((by + 1) * height) / N));

    for (let bx = 0; bx < N; bx++) {
      const x0 = Math.floor((bx * width) / N);
      const x1 = Math.max(x0 + 1, Math.floor(((bx + 1) * width) / N));

      let toplam = 0;
      let sayi = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * width + x) * channels;
          if (channels === 1) {
            toplam += data[i];
          } else {
            // Rec. 601 parlaklık; alfa kanalı yok sayılır.
            toplam += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          }
          sayi++;
        }
      }
      cikti[by * N + bx] = sayi ? toplam / sayi : 0;
    }
  }
  return cikti;
}

/** Ayrılabilir 2B DCT-II: önce satırlar, sonra sütunlar. */
function dct2(giris: Float64Array): Float64Array {
  const ara = new Float64Array(N * N);
  for (let y = 0; y < N; y++) {
    for (let u = 0; u < N; u++) {
      let s = 0;
      for (let x = 0; x < N; x++) s += giris[y * N + x] * KOSINUS[x * N + u];
      ara[y * N + u] = s;
    }
  }

  const cikti = new Float64Array(N * N);
  for (let u = 0; u < N; u++) {
    for (let v = 0; v < N; v++) {
      let s = 0;
      for (let y = 0; y < N; y++) s += ara[y * N + u] * KOSINUS[y * N + v];
      cikti[v * N + u] = s;
    }
  }
  return cikti;
}

/** Yarım baytın (0–15) içindeki 1 biti sayısı. */
const NIBBLE_BIT = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

/**
 * 64 bitlik algısal hash, 16 haneli onaltılık dizge.
 * BigInt kullanılmaz: hash doğrudan onaltılık olarak kurulur, karşılaştırma
 * da yarım bayt düzeyinde yapılır — hem taşınabilir hem hızlı.
 */
export function gorselHash(g: HamGorsel): string | null {
  if (!g.width || !g.height || !g.data?.length) return null;
  // Çok küçük görseller (ikon, çizgi, madde imi) gürültü üretir.
  if (g.width < 48 || g.height < 48) return null;

  const katsayilar = dct2(kucult(g));

  // DC bileşeni (ortalama parlaklık) hariç tutulur; kontrast değişimine
  // duyarsız kalmak için.
  const bant: number[] = [];
  for (let v = 0; v < K; v++) {
    for (let u = 0; u < K; u++) {
      if (u === 0 && v === 0) continue;
      bant.push(katsayilar[v * N + u]);
    }
  }

  const sirali = [...bant].sort((a, b) => a - b);
  const ortanca = sirali[Math.floor(sirali.length / 2)];

  let hex = '';
  for (let n = 0; n < 16; n++) {
    let nibble = 0;
    for (let b = 0; b < 4; b++) {
      const i = n * 4 + b;
      const deger = i < bant.length ? bant[i] : ortanca;
      nibble = (nibble << 1) | (deger > ortanca ? 1 : 0);
    }
    hex += nibble.toString(16);
  }
  return hex;
}

/** İki hash arasındaki farklı bit sayısı (0–64). */
export function hammingMesafe(a: string, b: string): number {
  let n = 0;
  for (let i = 0; i < 16; i++) {
    n += NIBBLE_BIT[(parseInt(a[i], 16) ^ parseInt(b[i], 16)) & 15];
  }
  return n;
}

/** 0–1 arası görsel benzerlik. */
export function gorselBenzerlik(a: string, b: string): number {
  return 1 - hammingMesafe(a, b) / 64;
}

/**
 * Bilgi taşımayan görseller (düz zemin, tek renk çerçeve) neredeyse aynı
 * hash'i üretir ve her raporu birbirine benzetir. Bit dağılımı çok dengesiz
 * olanları eleriz.
 */
export function anlamliMi(hash: string): boolean {
  let birler = 0;
  for (let i = 0; i < 16; i++) birler += NIBBLE_BIT[parseInt(hash[i], 16) & 15];
  return birler >= 16 && birler <= 48;
}
