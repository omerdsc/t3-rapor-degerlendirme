/**
 * Başvuru listesi ayrıştırıcı — SAF, test kapsamında.
 *
 * ── NİYE AYRI VE TESTLİ ─────────────────────────────────────────────────
 * Koordinasyonun bu sistemle tek toplu teması bu: kayıt listesini
 * yapıştırıp 300 başvuruyu bir kerede açıyor. Yanlış ayrıştırılan bir
 * sütun, 300 yarışmacının yanlış kategoriye düşmesi ya da proje adının
 * takım adı sanılması demek. Ayrıştırma mantığını rota içine gömmek onu
 * test edilemez yapardı.
 *
 * ── AYIRICI SIRASI: SEKME → NOKTALI VİRGÜL → VİRGÜL ─────────────────────
 * Liste neredeyse her zaman Excel'den yapıştırılıyor ve Excel sekme
 * veriyor. Virgül EN SONA bırakıldı çünkü Türkçe proje adlarında virgül
 * yaygın: "Sıfır Atık, Sıfır İsraf" tek bir alan, iki alan değil. Satırda
 * sekme ya da noktalı virgül varsa virgüle hiç bakılmıyor.
 *
 * ── ONARIM ALAN BAŞINA, SATIR BÜTÜNÜNE DEĞİL ────────────────────────────
 * Türkçe metin onarımı (`onar`) sondaki adımda `[ \t]+` dizilerini tek
 * boşluğa indiriyor — belge metni için doğru, sütunlu liste için yıkıcı.
 * Bir kez satırın tamamına uygulandı ve sonuç şu oldu: sekmeler yok oldu,
 * satır tek alana düştü, ayırıcı seçimi virgüle kaydı ve "Sıfır Atık,
 * Sıfır İsraf" ikiye bölündü. Onarım artık satır AYRIŞTIRILDIKTAN sonra
 * her alana ayrı ayrı uygulanıyor: mojibake düzeliyor, sütunlar duruyor.
 */

import { onar } from '@/lib/analiz/normalize';

export interface AktarimSatiri {
  basvuruNo?: string;
  takim: string;
  takimId?: string;
  proje?: string;
  eposta?: string;
}

export interface AktarimSonucu {
  satirlar: AktarimSatiri[];
  /** Ayrıştırılamayan satırlar — koordinasyona olduğu gibi gösteriliyor. */
  hatali: Array<{ satir: number; metin: string; sebep: string }>;
}

/** Başlık satırında geçen sütun adları. */
const BASLIK_IZI = /basvuru|takim|proje|eposta|e-posta|mail/i;

/**
 * Başvuru numarası gibi mi görünüyor.
 *
 * Numaranın ilk sütunda olması ZORUNLU DEĞİL: bazı listeler takım adıyla
 * başlıyor ve numara hiç yok (numarayı sistem üretecek). İlk alanın
 * numara mı yoksa takım adı mı olduğu buradan ayırt ediliyor.
 */
function numaraGibi(x: string): boolean {
  // TF-2026-04871, 2026-04871, 04871 — harf+rakam+tire, boşluk yok.
  return /^[A-Za-z]{0,4}[-]?\d{2,}[-\d]*$/.test(x.trim()) && !x.includes(' ');
}

function ayirici(satir: string): string {
  if (satir.includes('\t')) return '\t';
  if (satir.includes(';')) return ';';
  return ',';
}

/**
 * Yapıştırılan metni satırlara çevirir.
 *
 * Beklenen sütun düzeni:
 *   başvuru no | takım adı | takım id | proje adı | e-posta
 *
 * Başvuru numarası olmayan listeler de kabul ediliyor — ilk alan numara
 * gibi görünmüyorsa takım adı sayılıyor ve numarayı sistem üretiyor.
 * Yarışmacının elindeki numarayı sisteme yazdırmak, olmayan bir numarayı
 * uydurmaktan iyidir ama ikisi de meşru kurulum.
 */
export function listeCozumle(metin: string): AktarimSonucu {
  const satirlar: AktarimSatiri[] = [];
  const hatali: AktarimSonucu['hatali'] = [];

  const hamSatirlar = metin.split(/\r?\n/);

  for (let i = 0; i < hamSatirlar.length; i++) {
    const ham = hamSatirlar[i].trim();
    if (!ham) continue;

    // Başlık satırı: içinde sütun adları geçiyor ve rakam yok.
    if (i === 0 && BASLIK_IZI.test(ham) && !/\d{3}/.test(ham)) continue;

    /*
     * ÖNCE BÖL, SONRA ONAR. Ters sıra sekmeleri yok eder — bkz. dosya
     * başındaki not. `onar` her alanda ayrıca `trim()` de yapıyor.
     */
    const parcalar = ham
      .split(ayirici(ham))
      .map((x) => onar(x.trim().replace(/^"|"$/g, '')));

    let basvuruNo: string | undefined;
    let kalan = parcalar;
    if (parcalar.length > 1 && numaraGibi(parcalar[0])) {
      basvuruNo = parcalar[0];
      kalan = parcalar.slice(1);
    } else if (parcalar.length === 1 && numaraGibi(parcalar[0])) {
      // Yalnızca numara var, takım adı yok. Takım adı zorunlu: numarayı
      // tek başına kabul etmek "Belirtilmemiş" takımlar üretirdi ve
      // koordinasyon hangi kaydın kime ait olduğunu bilemezdi.
      hatali.push({ satir: i + 1, metin: ham, sebep: 'Takım adı yok' });
      continue;
    }

    const takim = kalan[0]?.trim();
    if (!takim) {
      hatali.push({ satir: i + 1, metin: ham, sebep: 'Takım adı okunamadı' });
      continue;
    }

    /*
     * Takım kimliği ile proje adı karışabiliyor: bazı listelerde takım
     * kimliği sütunu yok ve üçüncü alan doğrudan proje adı. Kimlik kısa
     * ve boşluksuz, proje adı uzun ve boşluklu — ayrım buradan.
     */
    let takimId: string | undefined;
    let proje: string | undefined;
    const ucuncu = kalan[1]?.trim();
    const dorduncu = kalan[2]?.trim();

    if (ucuncu && !ucuncu.includes(' ') && ucuncu.length <= 16) {
      takimId = ucuncu;
      proje = dorduncu || undefined;
    } else {
      proje = ucuncu || undefined;
      takimId = undefined;
    }

    // E-posta hangi sütunda olursa olsun, @ işaretinden bulunuyor.
    const eposta = parcalar.find((x) => x.includes('@') && x.includes('.'));
    // Proje adı yerine e-posta yakalandıysa geri al.
    if (proje && proje === eposta) proje = undefined;

    satirlar.push({ basvuruNo, takim, takimId, proje, eposta });
  }

  return { satirlar, hatali };
}
