/**
 * Rapor kapağındaki kimlik alanlarını okur.
 *
 * NEDEN
 * TEKNOFEST şablonları kapak sayfasında kimlik alanları istiyor:
 *
 *     Takım Adı:    …
 *     Takım ID:     …
 *     Başvuru ID:   …
 *
 * Koordinasyon bu bilgileri raporun içinden görmek istiyor ve bunlarla arama
 * yapıyor. Yükleme formunda da aynı alanlar var; ikisinin ÇELİŞMESİ tek
 * başına değerli bir bulgu: yanlış dosya yüklenmiş, kopyala-yapıştır sırasında
 * eski takımın künyesi kalmış ya da yarışmacı başkasının şablonunu
 * doldurmuş olabilir.
 *
 * ── HER RAPORDA BULUNMAZ, VE BU BEKLENEN ────────────────────────────────
 * Ölçüm: elimizdeki iki gerçek raporda da çıkarım tam sonuç vermiyor.
 * Havacılıkta YZ raporunun kapağında metin katmanında yalnızca dört öğe var
 * ("HAVACILIKTA YAPAY ZEKA", "YARIŞMASI ÖN TASARIM", "Takım", "Takım") —
 * değerler ya tabloda ya görselde kalmış. Maden raporunun kapağında kimlik
 * alanı hiç yok; takım bilgisi "6. Proje Takımı" bölümünde.
 *
 * Bu yüzden çıkarım YARDIMCI bir sinyal olarak tasarlandı: bulduğunu
 * gösterir, bulamadığını "okunamadı" der. Bulunamaması rapor hakkında
 * olumsuz bir yargı DEĞİLDİR ve hiçbir kritere puan olarak yansımaz —
 * yansısa, kapağını farklı biçimlendiren yarışmacı cezalandırılırdı.
 */

import { anahtar, onar } from './normalize';
import type { Belge } from './tipler';

export interface RaporKimligi {
  takimAdi?: string;
  takimId?: string;
  basvuruId?: string;
  projeAdi?: string;
  seviye?: string;
  /** Hangi alanlar okunabildi — arayüzde "okunamadı" demek için. */
  bulunan: string[];
  /** Kapak sayfasında kaç metin öğesi vardı; teşhis için. */
  kapakOgeSayisi: number;
}

/**
 * Alan etiketleri.
 *
 * Aranan biçimler yarışmadan yarışmaya değişiyor: "Takım ID", "Takım Kodu",
 * "Takım No" hepsi kullanılıyor. Karşılaştırma anahtar() üzerinden yapıldığı
 * için liste aksansız yazılıyor — /Takım/i deseni "TAKIM" ile eşleşmez
 * (JS'te I → i, ı değil).
 */
const ALANLAR: Array<{ anah: keyof RaporKimligi; adlar: string[] }> = [
  { anah: 'takimAdi', adlar: ['takim adi', 'takim ismi', 'takim adı'] },
  { anah: 'takimId', adlar: ['takim id', 'takim kodu', 'takim no', 'takim numarasi'] },
  {
    anah: 'basvuruId',
    adlar: ['basvuru id', 'basvuru no', 'basvuru numarasi', 'basvuru kodu'],
  },
  { anah: 'projeAdi', adlar: ['proje adi', 'proje basligi', 'proje ismi'] },
  { anah: 'seviye', adlar: ['takim seviyesi', 'seviye', 'katilim seviyesi'] },
];

/** Kapak alanı değeri olamayacak kadar uzun/kısa metinleri eler. */
function degerGecerliMi(d: string): boolean {
  const t = d.trim();
  if (t.length < 2 || t.length > 90) return false;
  // Yalnızca noktalama kalmışsa alan boş bırakılmış demektir.
  return /\p{L}|\p{N}/u.test(t);
}

/**
 * "Etiket: değer" biçimini ayırır.
 *
 * İki durum var ve ikisi de gerçek raporlarda görülüyor:
 *   aynı satırda  →  "Takım Adı: Anadolu Takımı"
 *   ayrı satırda  →  "Takım Adı:"  /  "Anadolu Takımı"   (tablo hücreleri)
 *
 * İkincisi es geçilirse tablo kullanan şablonlarda hiçbir şey bulunamaz.
 */
export function kimlikCikar(belge: Belge, azamiSayfa = 3): RaporKimligi {
  const sonuc: RaporKimligi = {
    bulunan: [],
    kapakOgeSayisi: belge.sayfalar?.[0]?.ogeler.length ?? 0,
  };

  const satirlar = belge.satirlar
    .filter((s) => s.sayfa <= azamiSayfa && !s.yinelenen)
    .map((s) => onar(s.metin).trim())
    .filter(Boolean);

  for (const [i, satir] of satirlar.entries()) {
    const ikiNokta = satir.indexOf(':');
    if (ikiNokta < 0) continue;

    const etiketHam = satir.slice(0, ikiNokta);
    // Etiket satırın SONUNDA olabilir: "… ÖN TASARIM RAPORU Takım Adı:".
    // Bu yüzden son üç sözcüğe bakılıyor.
    const etiket = anahtar(etiketHam.split(/\s+/).slice(-3).join(' '));
    const alan = ALANLAR.find((a) => a.adlar.some((ad) => etiket.endsWith(ad)));
    if (!alan || sonuc[alan.anah]) continue;

    let deger = satir.slice(ikiNokta + 1).trim();

    // Aynı satırda değer yoksa bir sonraki satıra bakılıyor — ama o satır
    // başka bir alan etiketiyse değer olarak alınmaz.
    if (!degerGecerliMi(deger)) {
      const sonraki = satirlar[i + 1] ?? '';
      const sonrakiEtiket = anahtar(sonraki.split(':')[0] ?? '');
      const baskaAlan = ALANLAR.some((a) =>
        a.adlar.some((ad) => sonrakiEtiket.endsWith(ad)),
      );
      deger = baskaAlan ? '' : sonraki.trim();
    }

    // Şablonun bıraktığı yer tutucular değer sayılmaz.
    if (/^[.…_\-\s]+$/.test(deger) || /^\{.*\}$/.test(deger)) continue;
    if (!degerGecerliMi(deger)) continue;

    (sonuc[alan.anah] as string) = deger.slice(0, 90);
    sonuc.bulunan.push(alan.anah);
  }

  return sonuc;
}

/**
 * Kapaktan okunanla yüklemede girileni karşılaştırır.
 *
 * KARŞILAŞTIRMA GEVŞEK. "Takım Anadolu" ile "ANADOLU TAKIMI" aynı takımdır;
 * büyük/küçük harf, aksan ve sözcük sırası farkı uyuşmazlık sayılmaz.
 * Katı karşılaştırma her raporda yanlış alarm üretir ve uyarı anlamını
 * yitirir.
 */
export interface KimlikUyusmazligi {
  alan: string;
  raporda: string;
  girilen: string;
}

function benzerMi(a: string, b: string): boolean {
  const x = anahtar(a);
  const y = anahtar(b);
  if (!x || !y) return true;
  if (x === y || x.includes(y) || y.includes(x)) return true;
  // Sözcük kümesi örtüşmesi: "takim anadolu" ↔ "anadolu takimi".
  const kx = new Set(x.split(' ').filter((w) => w.length > 2));
  const ky = new Set(y.split(' ').filter((w) => w.length > 2));
  if (!kx.size || !ky.size) return false;
  let ortak = 0;
  for (const w of kx) if (ky.has(w)) ortak++;
  return ortak / Math.min(kx.size, ky.size) >= 0.6;
}

export function kimlikKarsilastir(
  kimlik: RaporKimligi,
  girilen: { takim?: string; takimId?: string; basvuruNo?: string; proje?: string },
): KimlikUyusmazligi[] {
  const uyusmazlik: KimlikUyusmazligi[] = [];

  const cift: Array<[string, string | undefined, string | undefined]> = [
    ['Takım adı', kimlik.takimAdi, girilen.takim],
    ['Takım ID', kimlik.takimId, girilen.takimId],
    ['Başvuru numarası', kimlik.basvuruId, girilen.basvuruNo],
    ['Proje adı', kimlik.projeAdi, girilen.proje],
  ];

  for (const [alan, raporda, girilenDeger] of cift) {
    // Biri eksikse karşılaştırma yapılmaz: eksiklik uyuşmazlık değildir.
    if (!raporda || !girilenDeger) continue;
    if (girilenDeger === 'Belirtilmemiş') continue;
    if (!benzerMi(raporda, girilenDeger)) {
      uyusmazlik.push({ alan, raporda, girilen: girilenDeger });
    }
  }

  return uyusmazlik;
}
