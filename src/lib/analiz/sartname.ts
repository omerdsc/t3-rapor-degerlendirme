/**
 * Şartname çözümleyici.
 *
 * Şablon "raporu nasıl yazacaksın" der; ŞARTNAME "yarışma nedir, kim
 * katılabilir, ne değerlendirilir, ne diskalifiye eder" der. İkisi ayrı
 * belgedir ve ikisi de gerekli:
 *
 *   ŞABLON   → bölüm başlıkları, yönerge metinleri, rubrik ağırlıkları,
 *              sayfa/font kuralları
 *   ŞARTNAME → değerlendirme aşamaları, takım kuralları, katılımcı seviyeleri,
 *              diskalifiye şartları, teknik gereksinimler, tarihler
 *
 * MALİYET TASARIMI
 * Şartname 20–50 sayfa olabilir. Her rapor değerlendirmesinde tamamını modele
 * göndermek rapor başına ~$0.15 ekstra demek. Bunun yerine KURULUMDA BİR KEZ
 * özetlenir ve özet her raporda bedava kullanılır.
 *
 * Ölçülen gerçek maliyet (22 sayfa, 4.119 kelime): $0.19 — tek seferlik.
 * 100 rapor için $15 yerine $0.19; rapor başına $0.002.
 *
 * Deterministik olarak çıkarılabilen her şey (sayfa sınırı, takım sayısı,
 * tarihler, aşamalar, eleyici hükümler) modelsiz çıkarılır — $0.
 */

import type { Belge } from './tipler';
import { anahtar, onar } from './normalize';

export interface SartnameKurallari {
  /** Rapor sayfa sınırı — şablonda yoksa şartnamede olabilir. */
  asgariSayfa?: number;
  azamiSayfa?: number;
  /** Takımdaki azami öğrenci sayısı. */
  azamiUye?: number;
  /** Danışman zorunlu mu? */
  danismanZorunlu?: boolean;
  /** Bulunan tarihler: "Son başvuru: 14 Ağustos 2026" gibi. */
  tarihler: Array<{ etiket: string; tarih: string }>;
  /** Değerlendirme aşamaları, takvim bölümünden sırayla. */
  asamalar: string[];
  /** Diskalifiye/eleme hükümleri — tam cümleler. */
  eleyiciHukumler: string[];
  /**
   * Katılımcı seviyeleri (Lise / Üniversite / Mezun).
   *
   * DİKKAT: Şartnamede "kategori" kelimesi TEKNİK ALAN değil KATILIMCI
   * SEVİYESİ anlamına geliyor ("Mezun kategorisi lise ve üniversite
   * mezunlarını kapsar"). Teknik alan zaten yarışmanın kendisidir
   * (Havacılıkta YZ, Maden Teknolojileri). Bu ayrım karıştırılırsa
   * kategori uyumu kontrolü anlamsız çalışır.
   */
  katilimciSeviyeleri: string[];
}

export interface SartnameCozumu {
  /** Şartnamenin düz metni — AI özeti bundan üretilir. */
  metin: string;
  sayfaSayisi: number;
  kelimeSayisi: number;
  kurallar: SartnameKurallari;
  /** Başlık listesi — yöneticiye neyin bulunduğunu göstermek için. */
  basliklar: string[];
  uyarilar: string[];
}

// -------------------------------------------------------------- desenler

/**
 * Tarih deseni: TEKNOFEST şartnamelerinde tarih ÖNCE, etiket SONRA geliyor.
 *
 *     16.02.2026 Teknik Şartnamenin İlanı
 *     22.04.2026- 17:00 Ön Tasarım Raporu Son Teslim Tarihi
 *     15-20.06.2026 Takımlarla Soru-Cevap Toplantısı
 *
 * İlk tasarımda "Etiket: 14 Ağustos 2026" biçimi varsayılmıştı; gerçek
 * belgelerde böyle bir satır yok.
 */
const TARIH_DESENI =
  // (?<![\d.]) — aralık başı, önceki bir sayının kuyruğu olmasın:
  // "…2026 15.05.2026" metninde "26" aralık başı sanılıyordu.
  /(?<![\d.])(?:(\d{1,2})\s*[-–]\s*)?(\d{1,2})[./](\d{1,2})[./](\d{4})\s*[-–]?\s*(?:\d{1,2}[:.]\d{2})?\s*([A-ZÇĞİÖŞÜ][^\n]{6,90})/g;

/** "en fazla 6 öğrenciden", "en çok 5 üye" */
const UYE_DESENI = /en\s+(?:fazla|çok)\s+(\d{1,2})\s*(?:öğrenci|üye|kişi|takım\s+üyesi)/i;

/**
 * Eleyici hüküm: CÜMLE BAŞINDAN yakalanır.
 * Tembel eşleşme cümlenin başını kesiyordu ("...yapılacak olan hiçbir başvuru
 * kabul edilmeyecektir" gibi yarım cümleler çıkıyordu).
 */
const ELEYICI_DESENI =
  /(?:^|[.!?]\s+)([A-ZÇĞİÖŞÜ][^.!?\n]{15,260}?(?:değerlendirilmeyecek|diskalifiye|elenir|kabul\s+edilmeyecek|geçersiz\s+sayıl|başvurusu\s+iptal)[^.!?\n]{0,140}[.!?])/g;

/**
 * Katılımcı seviyesi: "Mezun kategorisi", "Lise kategorisi".
 * Metin anahtar()'a çevrildikten sonra arandığı için liste aksansızdır.
 */
const SEVIYE_ANAHTARLARI = ['lise', 'universite', 'ortaokul', 'mezun', 'profesyonel', 'serbest'];

/**
 * Takvim bölümü — aşamalar buranın alt başlıklarıdır.
 *
 * Regex'in `i` bayrağı Türkçe'de yetmiyor: JS "YARIŞMA"yı "yarişma" yapar
 * (I → i), desendeki "yarışma" ise ı taşır; eşleşme tutmaz. Bu yüzden
 * karşılaştırma anahtar() üzerinden yapılıyor — aksan ve i/ı ayrımını
 * kaldıran normalleştirici.
 */
const TAKVIM_ANAHTARLARI = ['yarisma takvimi', 'degerlendirme takvimi', 'onemli tarihler'];

function takvimBolumuMu(baslik: string): boolean {
  const a = anahtar(baslik);
  return TAKVIM_ANAHTARLARI.some((t) => a.includes(t));
}

// ------------------------------------------------------------ çözümleme

export function sartnameCozumle(belge: Belge): SartnameCozumu {
  const metin = onar(belge.metin);
  const uyarilar: string[] = [];

  const kurallar: SartnameKurallari = {
    tarihler: [],
    asamalar: [],
    eleyiciHukumler: [],
    katilimciSeviyeleri: [],
  };

  // ---- sayfa sınırı
  const aralik = metin.match(
    /en\s+az\s+(\d{1,3})\s*sayfa.{0,30}?en\s+fazla\s+(\d{1,3})\s*sayfa/i,
  );
  if (aralik) {
    kurallar.asgariSayfa = Number(aralik[1]);
    kurallar.azamiSayfa = Number(aralik[2]);
  } else {
    const azami =
      metin.match(/en\s+fazla\s+(\d{1,3})\s*sayfa/i) ??
      metin.match(/(\d{1,3})\s*sayfayı\s+geçmemelidir/i);
    if (azami) kurallar.azamiSayfa = Number(azami[1]);
  }

  // ---- takım kuralları
  const uye = metin.match(UYE_DESENI);
  if (uye) kurallar.azamiUye = Number(uye[1]);
  if (/danışman\s+(?:zorunlu|bulunmak\s+zorunda|olmalı)/i.test(metin)) {
    kurallar.danismanZorunlu = true;
  }

  // ---- tarihler
  const gorulen = new Set<string>();
  for (const m of metin.matchAll(TARIH_DESENI)) {
    const [, aralikBas, gun, ay, yil, etiketHam] = m;
    const g = Number(gun);
    const a = Number(ay);
    if (a < 1 || a > 12 || g < 1 || g > 31) continue;

    const etiket = etiketHam
      .replace(/\.{2,}.*$/, '')                  // içindekiler nokta dolgusu
      .replace(/\s*\d{1,2}[./]\d{1,2}[./]\d{4}.*$/, '') // peşine gelen tarih
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 90);
    if (etiket.length < 6 || gorulen.has(etiket)) continue;
    gorulen.add(etiket);

    const tarih = `${yil}-${String(a).padStart(2, '0')}-${String(g).padStart(2, '0')}`;
    kurallar.tarihler.push({
      etiket,
      // "15-20.06.2026" gibi aralıklarda bitiş tarihi esas alınır.
      tarih: aralikBas ? `${yil}-${String(a).padStart(2, '0')}-${aralikBas.padStart(2, '0')} → ${tarih}` : tarih,
    });
    if (kurallar.tarihler.length >= 20) break;
  }

  // ---- aşamalar: takvim bölümünün ALT BAŞLIKLARI
  // Regex'le fiil aramak "Final / final / final aşaması" gibi tekrarlar
  // üretiyordu. Şartname aşamaları zaten numaralı alt başlık olarak yazıyor.
  const takvimIndeksi = belge.bolumler.findIndex((b) => takvimBolumuMu(b.baslik.sade));
  if (takvimIndeksi >= 0) {
    const ustNumara = belge.bolumler[takvimIndeksi].baslik.numara;
    kurallar.asamalar = belge.bolumler
      .filter((b) => ustNumara && b.baslik.numara?.startsWith(`${ustNumara}.`))
      .map((b) => b.baslik.sade)
      .slice(0, 15);
  }

  // ---- eleyici hükümler
  const hukumler = new Set<string>();
  for (const m of metin.matchAll(ELEYICI_DESENI)) {
    hukumler.add(m[1].replace(/\s+/g, ' ').trim());
    if (hukumler.size >= 12) break;
  }
  kurallar.eleyiciHukumler = [...hukumler];

  // ---- katılımcı seviyeleri
  const anahtarMetin = anahtar(metin);
  kurallar.katilimciSeviyeleri = SEVIYE_ANAHTARLARI.filter((sv) =>
    anahtarMetin.includes(`${sv} kategori`),
  );

  // ---- uyarılar
  if (!kurallar.azamiSayfa) uyarilar.push('Şartnameden sayfa sınırı çıkarılamadı.');
  if (!kurallar.tarihler.length) uyarilar.push('Şartnameden tarih çıkarılamadı.');
  if (!kurallar.asamalar.length) {
    uyarilar.push('Şartnameden değerlendirme aşamaları çıkarılamadı.');
  }
  if (belge.kelimeSayisi < 300) {
    uyarilar.push('Şartname metni beklenenden kısa; taranmış veya eksik olabilir.');
  }

  return {
    metin,
    sayfaSayisi: belge.sayfaSayisi,
    kelimeSayisi: belge.kelimeSayisi,
    kurallar,
    basliklar: belge.bolumler.map((b) => b.baslik.sade).slice(0, 40),
    uyarilar,
  };
}

/**
 * Şablon ve şartname kurallarını birleştirir.
 *
 * Çakışma kuralı: ŞARTNAME ÜSTÜNDÜR. Şablon bir yardımcı belge, şartname
 * bağlayıcı metin. Şablondaki sayfa sınırıyla şartnamedeki farklıysa
 * şartnamedeki geçerlidir ve yöneticiye bildirilir.
 */
export function kurallariBirlestir(
  sablonAsgari: number | undefined,
  sablonAzami: number | undefined,
  sartname: SartnameKurallari | undefined,
): { asgariSayfa?: number; azamiSayfa?: number; catisma: string[] } {
  const catisma: string[] = [];
  if (!sartname) return { asgariSayfa: sablonAsgari, azamiSayfa: sablonAzami, catisma };

  if (
    sartname.azamiSayfa !== undefined &&
    sablonAzami !== undefined &&
    sartname.azamiSayfa !== sablonAzami
  ) {
    catisma.push(
      `Azami sayfa sayısı çakışıyor: şablon ${sablonAzami}, şartname ` +
        `${sartname.azamiSayfa}. Şartname esas alındı.`,
    );
  }

  return {
    asgariSayfa: sartname.asgariSayfa ?? sablonAsgari,
    azamiSayfa: sartname.azamiSayfa ?? sablonAzami,
    catisma,
  };
}
