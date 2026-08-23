/**
 * Şablon çıkarıcı — AKIŞ 01'in kalbi.
 *
 * Yarışma Yöneticisi şablon dosyasını yükler, sistem geri kalanını kendisi
 * çıkarır. Elle şablon tanımlanmaz.
 *
 * TEKNOFEST her yarışma için ayrı şablon hazırlıyor ve kurallar da şablonun
 * içinde oluyor. İki gerçek örnek karşılaştırıldığında yapının ne kadar
 * değiştiği görülüyor:
 *
 *   Havacılıkta YZ · Ön Tasarım Raporu     Maden Teknolojileri · Ön Değ. Raporu
 *   ─────────────────────────────────     ──────────────────────────────────
 *   TAKIM ŞEMASI                          PROJE ÖZETİ (18)
 *   PROJE MEVCUT DURUM DEĞ. (10)          SORUNUN TANIMI VE ÇÖZÜM (35)
 *   ALGORİTMALAR VE SİSTEM MİM. (30)      YENİLİKÇİLİK / YERLİLEŞTİRME (15)
 *     Veri Setleri (10)                   UYGULANABİLİRLİK (15)
 *     Algoritmalar (15)                   HAZIRLANIŞ SÜRECİ (10)
 *     Akış Şeması (5)                     PROJE TAKIMI (2)
 *   ÖZGÜNLÜK (10) · TAKVİM (10)           KAYNAKLAR (3)
 *   SONUÇLAR (30) · KAYNAKÇA (5)          RAPOR DÜZENİ (2)
 *
 * Bölüm adları, ağırlıklar, sayfa sınırları, hatta kaynakça bölümünün adı
 * bile farklı. Bu yüzden motorda hiçbir şey sabit değil.
 *
 * İki kazanç:
 *   1. Yönerge metinleri → "doldurulmamış bölüm" tespitinin dayanağı
 *   2. Başlıktaki "(N Puan)" → MVP 6'nın rubriği. Rubriği sormaya gerek yok,
 *      şablonun kendisi söylüyor.
 */

import { unzipSync, strFromU8 } from 'fflate';
import type { Sablon, SablonBaslik } from './tipler';
import { anahtar } from './normalize';

export interface DocxParagraf {
  stil: string;
  metin: string;
  /**
   * Kalın çalıştırma oranı (0–1).
   *
   * Bazı şablonlarda hiç başlık STİLİ yok; başlıklar yalnızca kalın
   * yazılmış. Stil bilgisi olmadığında tek sinyal budur.
   */
  kalinOran: number;
  /** Yarım punto (w:sz). 24 = 12pt. Başlıklar gövdeden büyüktür. */
  punto?: number;
  /**
   * Paragraf bir tablo hücresinde mi?
   *
   * Tablo hücreleri sık sık kalın olur ("NİSAN", "MAYIS" gibi takvim
   * başlıkları). Kalınlığı başlık sinyali sayacaksak tabloları dışlamak
   * zorunlu — yoksa iş-zaman çizelgesinin 8 ayı 8 rapor bölümü olur.
   */
  tabloIcinde: boolean;
}

export interface SablonKurallari {
  /** Ham kural cümleleri — arayüzde olduğu gibi gösterilir. */
  ham: string[];
  asgariSayfa?: number;
  azamiSayfa?: number;
  yaziTipi?: string;
  govdePunto?: number;
  baslikPunto?: number;
  /** Şartname metin içi atıf biçimini belirtiyor mu? */
  atifBicimi?: 'koseli-parantez' | 'yazar-yil';
  /** "Şablona uymayan raporlar değerlendirilmez" gibi eleyici hüküm var mı? */
  eleyiciMi: boolean;
}

export interface SablonCikarimi {
  sablon: Sablon;
  kurallar: SablonKurallari;
  /** Şablonun kendi örnek kaynak künyeleri — raporda kalırsa bulgudur. */
  ornekKaynaklar: string[];
  toplamPuan: number;
  /** Çıkarım sırasında karar verilemeyen noktalar — yöneticiye sorulur. */
  uyarilar: string[];
}

// ------------------------------------------------------------ docx okuma

const BASLIK_STILI = /^(Balk\d*|Balık\d*|Heading\d*|Numaras[ıi]zBal[ıi]k|Title)$/i;
const GOVDE_STILI = /^(GvdeMetni|BodyText|NormalWeb)$/i;
const KAYNAK_STILI = /^(Kaynaka|Kaynakça|Bibliography)$/i;

/** DOCX'i açıp paragrafları stil adlarıyla birlikte döndürür. */
export function docxParagraflari(veri: Uint8Array): DocxParagraf[] {
  const arsiv = unzipSync(veri, { filter: (f) => f.name === 'word/document.xml' });
  const xmlBayt = arsiv['word/document.xml'];
  if (!xmlBayt) throw new Error('Geçerli bir .docx değil: word/document.xml bulunamadı.');

  const xml = strFromU8(xmlBayt);
  const paragraflar: DocxParagraf[] = [];

  /*
   * TABLO ARALIKLARI
   *
   * Paragrafın tablo içinde olup olmadığını bilmek gerekiyor ama düz metin
   * eşleştirmesiyle iç içe yapıyı izlemek kırılgan. Bunun yerine tablo
   * açılış/kapanış konumları önceden toplanıp paragrafın konumu bu
   * aralıklarla karşılaştırılıyor.
   */
  const tabloAraliklari: Array<[number, number]> = [];
  {
    const yigin: number[] = [];
    for (const m of xml.matchAll(/<(\/?)w:tbl[\s>]/g)) {
      if (m[1] === '/') {
        const bas = yigin.pop();
        if (bas !== undefined) tabloAraliklari.push([bas, m.index ?? 0]);
      } else {
        yigin.push(m.index ?? 0);
      }
    }
  }
  const tablodaMi = (konum: number) =>
    tabloAraliklari.some(([b, s]) => konum > b && konum < s);

  for (const eslesme of xml.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g)) {
    const govde = eslesme[1];
    const stil = govde.match(/<w:pStyle w:val="([^"]+)"/)?.[1] ?? '';

    // Yalnızca gerçek metin düğümleri; alan kodları ve biçim etiketleri değil.
    let metin = '';
    for (const t of govde.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)) metin += t[1];

    metin = metin
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
    if (!metin) continue;

    // Kalınlık: rPr blokları sayılıyor. <w:b/> ve <w:b w:val="1"/> kalın,
    // <w:b w:val="0"/> değil — ikisini ayırmazsak her paragraf kalın sanılır.
    const rprler = [...govde.matchAll(/<w:rPr>([\s\S]*?)<\/w:rPr>/g)].map((m) => m[1]);
    const kalinSayisi = rprler.filter((r) =>
      /<w:b\s*\/>|<w:b\s[^>]*w:val="(?:1|true|on)"/.test(r),
    ).length;

    const puntolar = [...govde.matchAll(/<w:sz w:val="(\d+)"/g)].map((m) => Number(m[1]));

    paragraflar.push({
      stil,
      metin,
      kalinOran: rprler.length ? kalinSayisi / rprler.length : 0,
      punto: puntolar.length ? Math.max(...puntolar) : undefined,
      tabloIcinde: tablodaMi(eslesme.index ?? 0),
    });
  }
  return paragraflar;
}

/**
 * Stil bilgisi olmayan şablonlarda başlık tespiti.
 *
 * 60 yarışmalık katalog taramasında 15 şablondan hiç başlık çıkmadı. Nedeni
 * tek: o .docx dosyalarında `w:pStyle` HİÇ YOK. Başlıklar Word'ün başlık
 * stilleriyle değil, elle kalın yapılarak biçimlendirilmiş:
 *
 *   [kalın]  Özet
 *   [ince]   Özetin tamamı 150-250 kelime arasında olmalıdır…
 *   [kalın]  Amaç
 *   [ince]   Bu bölümde doğrudan projenin amacına…
 *
 * Bu desen okunabilir. Ama kalınlık tek başına yetmez, üç tuzak var:
 *
 *   ":" ile bitenler   → form alanı ("Proje Adı (Başlığı):"), bölüm değil
 *   tablo hücreleri    → iş-zaman çizelgesinin ayları ("NİSAN", "MAYIS")
 *   uzun kalın cümle   → vurgulanmış paragraf, başlık değil
 */
function bicimdenBaslikMi(p: DocxParagraf): boolean {
  if (p.tabloIcinde) return false;
  if (p.kalinOran < 0.8) return false;
  if (p.metin.length < 3 || p.metin.length > 80) return false;
  if (p.metin.endsWith(':')) return false;
  // Cümle işareti taşıyan metin başlık değil; başlık noktalamayla bitmez.
  if (/[.!?]\s/.test(p.metin)) return false;
  return /\p{L}{2}/u.test(p.metin);
}

// --------------------------------------------------------- kural ayıklama

const KURAL_BASLANGICI = /RAPOR\s+(TASLAKLARI|ŞABLONU)\s+İLE\s+İLGİLİ\s+NOT/i;

function kurallariCikar(paragraflar: DocxParagraf[]): SablonKurallari {
  const basIndeks = paragraflar.findIndex((p) => KURAL_BASLANGICI.test(p.metin));
  const ham = (basIndeks >= 0 ? paragraflar.slice(basIndeks + 1) : [])
    .map((p) => p.metin.replace(/^[•·\-–\s]+/, '').trim())
    .filter((m) => m.length > 15);

  const hepsi = ham.join(' \n ');
  const kurallar: SablonKurallari = { ham, eleyiciMi: false };

  // "en az 6 sayfa en fazla 15 sayfa"
  const aralik = hepsi.match(/en\s+az\s+(\d{1,3})\s*sayfa.{0,20}?en\s+fazla\s+(\d{1,3})\s*sayfa/i);
  if (aralik) {
    kurallar.asgariSayfa = Number(aralik[1]);
    kurallar.azamiSayfa = Number(aralik[2]);
  } else {
    // "en fazla 10 sayfa olacaktır" · "10 sayfayı geçmemelidir"
    const azami =
      hepsi.match(/en\s+fazla\s+(\d{1,3})\s*sayfa/i) ??
      hepsi.match(/(\d{1,3})\s*sayfayı\s+geçmemelidir/i);
    if (azami) kurallar.azamiSayfa = Number(azami[1]);
    const asgari = hepsi.match(/en\s+az\s+(\d{1,3})\s*sayfa/i);
    if (asgari) kurallar.asgariSayfa = Number(asgari[1]);
  }

  const font = hepsi.match(/Yazı\s*tipi\s*:\s*([A-Za-zÀ-ɏ ]+?)\s*,/i);
  if (font) kurallar.yaziTipi = font[1].trim();

  const govdePunto = hepsi.match(/Punto\s*:\s*(\d{1,2})/i);
  if (govdePunto) kurallar.govdePunto = Number(govdePunto[1]);

  const baslikPunto = hepsi.match(/Başlık\s+Punto\s*:\s*(\d{1,2})/i);
  if (baslikPunto) kurallar.baslikPunto = Number(baslikPunto[1]);

  if (/köşeli\s+parantez/i.test(hepsi)) kurallar.atifBicimi = 'koseli-parantez';

  // "Rapor şablonuna uymayan raporlar değerlendirilmeyecektir"
  kurallar.eleyiciMi =
    /değerlendirilmeyecek|kabul\s+edilmeyecek|diskalifiye/i.test(hepsi);

  return kurallar;
}

// -------------------------------------------------------- başlık ayıklama

const PUAN_DESENI = /\(\s*(\d{1,3})\s*puan\s*\)/i;
/**
 * Şablon bu başlığın raporda görünmemesini istiyor — açık ifade.
 */
const RAPORDA_OLMAMALI = /bu\s+başlık\s+raporunuzda\s+yer\s+almamalı|raporlarda\s+yer\s+verilmeyecektir/i;

/**
 * Yönerge, YARIŞMACININ ne yazacağını değil DEĞERLENDİRİCİNİN ne yapacağını
 * anlatıyorsa, o başlık bir puanlama kriteridir; raporda bir bölüm olarak
 * beklenmez.
 *
 * Gerçek örnek — HYZ şablonu, "GENEL RAPOR DÜZENİ (5 PUAN)":
 *   "Raporun genel düzeni, takım şeması, tablolar ve yazım kuralları
 *    bu başlık altında İNCELENECEKTİR."
 *
 * Yarışmacı böyle bir bölüm yazmaz; hakem raporun bütününe bakarak puanlar.
 * Bu ayrım yapılmazsa sistem her raporda "Zorunlu bölüm yok: GENEL RAPOR
 * DÜZENİ" diye yanlış bulgu üretir.
 */
const DEGERLENDIRICI_YONERGESI =
  // Sonda  YOK: Türkçe fiil ek alıyor ("incelenecek" → "incelenecektir").
  /(incelenecek|değerlendirilecek|esas\s+al[ıi]r|puanlanacak|dikkate\s+alınacak|bu\s+başlık\s+altında)/i;
/** "Proje özeti 150-250 kelime arasında olmalıdır" */
const KELIME_ARALIGI = /(\d{2,4})\s*[-–]\s*(\d{2,4})\s*kelime/i;

/** Ön sayfa listeleri — içerik bölümü değil, ayrı ele alınır. */
const ON_SAYFALAR = ['icindekiler', 'sekil listesi', 'tablo listesi', 'kisaltmalar'];

function baslikTemizle(ham: string): { ad: string; puan?: number } {
  const puanEs = ham.match(PUAN_DESENI);
  const ad = ham.replace(PUAN_DESENI, '').replace(/\s+/g, ' ').trim();
  return { ad, puan: puanEs ? Number(puanEs[1]) : undefined };
}

/**
 * Üst başlık tespiti.
 *
 * "ALGORİTMALAR VE SİSTEM MİMARİSİ (30 PUAN)" başlığının altında
 * "Veri Setleri (10)", "Algoritmalar (15)", "Akış Şeması (5)" var —
 * toplamı tam 30. Üst başlık puanı alt başlıkların toplamıdır, ikisi birden
 * sayılırsa rubrik 100 yerine 130 çıkar. Word stilleri hiyerarşi vermediği
 * için (ikisi de Balk1) başka sinyal gerekiyor.
 *
 * Puan toplamı TEK BAŞINA yetmez: Maden şablonunda "Uygulanabilirlik (15)"
 * başlığını izleyen üç başlık da tesadüfen 15 ediyor (10+2+3). Ayırt edici
 * sinyal, gerçek üst başlığın KENDİ yönerge metninin olmamasıdır — o bir
 * kapsayıcıdır, doldurulacak bir bölüm değil.
 */
function gruplariIsaretle(basliklar: SablonBaslik[], uyarilar: string[]): void {
  for (let i = 0; i < basliklar.length; i++) {
    const ust = basliklar[i];
    if (!ust.puan) continue;
    // Kendi içeriği olan başlık kapsayıcı değildir.
    if ((ust.yonergeMetni?.length ?? 0) > 0) continue;

    let toplam = 0;
    for (let j = i + 1; j < basliklar.length; j++) {
      const alt = basliklar[j];
      if (!alt.puan) break;
      toplam += alt.puan;
      if (toplam === ust.puan && j > i + 1) {
        ust.grupMu = true;
        uyarilar.push(
          `"${ust.ad}" üst başlık olarak işaretlendi: ${ust.puan} puanı ` +
            `alt başlıklarına dağıtılmış (${j - i} alt başlık).`,
        );
        i = j;
        break;
      }
      if (toplam > ust.puan) break;
    }
  }
}

/**
 * Şablon dosyasından tam Sablon nesnesi çıkarır.
 *
 * @param kod    Yarışma kodu, ör. "hyz-otr-2026"
 * @param ad     Görünen ad
 * @param yil    Şablon yılı
 */
export function sablonCikar(
  veri: Uint8Array,
  kod: string,
  ad: string,
  yil: number,
): SablonCikarimi {
  const paragraflar = docxParagraflari(veri);
  const kurallar = kurallariCikar(paragraflar);
  const uyarilar: string[] = [];

  // Kural bloğu başladıktan sonrası şablon gövdesi değildir.
  const kuralIndeksi = paragraflar.findIndex((p) => KURAL_BASLANGICI.test(p.metin));
  const govde = kuralIndeksi >= 0 ? paragraflar.slice(0, kuralIndeksi) : paragraflar;

  const basliklar: SablonBaslik[] = [];
  const ornekKaynaklar: string[] = [];
  let aktif: SablonBaslik | null = null;
  let icindekilerdeMi = false;

  /*
   * STİL VAR MI?
   *
   * Varsa yalnızca stil kullanılır — en güvenilir sinyal ve biçim tabanlı
   * tahminle karıştırmak yanlış başlık üretir (kalın vurgulanmış bir cümle
   * bölüm sanılır). Stil hiç yoksa biçime düşülür.
   */
  const stilliBaslikVar = govde.some((p) => BASLIK_STILI.test(p.stil));
  if (!stilliBaslikVar) {
    uyarilar.push(
      'Şablonda Word başlık stili yok; başlıklar kalın biçimlendirmeden ' +
        'tahmin edildi. Bölüm listesini onaylamadan önce gözden geçirin.',
    );
  }

  for (const p of govde) {
    const baslikMi = stilliBaslikVar
      ? BASLIK_STILI.test(p.stil)
      : bicimdenBaslikMi(p);

    if (baslikMi) {
      const { ad: baslikAdi, puan } = baslikTemizle(p.metin);
      const a = anahtar(baslikAdi);

      // İçindekiler bloğu: kendi satırları başlık değil, içerik listesidir.
      icindekilerdeMi = a === 'icindekiler';

      if (ON_SAYFALAR.includes(a)) {
        aktif = null;
        continue;
      }

      /*
       * ADI BOŞ, PUANI VAR
       *
       * Liseler Arası İHA şablonunda puan bazen kendi paragrafında duruyor:
       *
       *   [kalın] Elektrik ve Elektronik Donanım ile Güç Sistemleri
       *   [kalın] (15 puan)
       *
       * İkinci paragraf ayrı bir başlık sanılıyor, adı boş kalıyor ve 15 puan
       * adsız bir kritere yazılıyor; gerçek başlık ise puansız kalıyor.
       * Doğrusu puanı bir önceki başlığa vermek.
       */
      if (!baslikAdi && puan !== undefined) {
        const onceki = basliklar[basliklar.length - 1];
        if (onceki && onceki.puan === undefined) onceki.puan = puan;
        continue;
      }
      if (!baslikAdi) continue;

      aktif = {
        ad: baslikAdi,
        zorunlu: true,
        puan,
        yonergeMetni: [],
      };
      basliklar.push(aktif);
      continue;
    }

    if (icindekilerdeMi) continue;

    if (KAYNAK_STILI.test(p.stil)) {
      // Şablonun örnek künyeleri; raporda kalırsa yarışmacı silmemiş demektir.
      if (p.metin.length > 12) ornekKaynaklar.push(p.metin);
      continue;
    }

    if (!aktif) continue;

    // Gövde metni ve madde işaretli açıklamalar birlikte yönergeyi oluşturur.
    if (GOVDE_STILI.test(p.stil) || !p.stil) {
      if (RAPORDA_OLMAMALI.test(p.metin)) {
        aktif.zorunlu = false;
        aktif.raporda = false;
        continue;
      }
      // Yönerge değerlendiriciye hitap ediyorsa bölüm beklenmez, kriter kalır.
      if (DEGERLENDIRICI_YONERGESI.test(p.metin)) {
        aktif.zorunlu = false;
        aktif.raporda = false;
      }
      const kelime = p.metin.match(KELIME_ARALIGI);
      if (kelime) {
        aktif.asgariKelime = Number(kelime[1]);
        aktif.azamiKelime = Number(kelime[2]);
      }
      if (p.metin.length > 25) aktif.yonergeMetni!.push(p.metin);
    }
  }

  /*
   * KAPAK BAŞLIK BLOĞU
   *
   * Stil bilgisi olmayan şablonlarda kapak sayfası da kalın yazılıyor ve
   * her satırı bölüm sanılıyor. Liseler Arası İHA'da 13 tane çıktı:
   *
   *   LİSELER ARASI
   *   İNSANSIZ HAVA ARAÇLARI YARIŞMASI
   *   SABİT KANAT VE DÖNER KANAT
   *   KATEGORİLERİ
   *   PROJE SUNUM RAPORU
   *   ŞABLONU
   *
   * Biçim olarak gerçek başlıktan ayırt edilemezler; ayırt eden ŞU: kapak
   * satırının ne puanı ne de altında yönerge metni var — arkasından hemen
   * başka bir başlık geliyor. Gerçek bir bölüm ya puan taşır ya açıklama.
   *
   * Yalnızca BAŞTAKİ blok atılıyor. Ortada aynı desende bir başlık varsa
   * (puansız, gövdesiz) bu bir grup başlığı olabilir; onu atmak bilgi
   * kaybettirir.
   */
  if (!stilliBaslikVar) {
    let kes = 0;
    while (
      kes < basliklar.length &&
      basliklar[kes].puan === undefined &&
      !basliklar[kes].yonergeMetni?.length
    ) {
      kes++;
    }
    /*
     * İKİ KORUMA — İLK SÜRÜM GERÇEK BÖLÜMLERİ SİLİYORDU
     *
     * Bazı şablonlar iskelet halinde: başlıklar var, puan yok, yönerge yok.
     * Böyle bir şablonda "puanı ve gövdesi olana kadar at" kuralı bütün
     * bölümleri siliyor ve geriye 1 başlık kalıyordu (4 yarışmada oldu).
     *
     *   kes >= 2                      → tek satır kapak bloğu sayılmaz
     *   geriye en az 3 bölüm kalmalı  → "kapak" belgenin tamamı olamaz
     */
    if (kes >= 2 && basliklar.length - kes >= 3) {
      const atilan = basliklar.splice(0, kes);
      uyarilar.push(
        `Kapak bloğu sayıldığı için ${atilan.length} açılış satırı bölüm ` +
          `listesinden çıkarıldı (${atilan[0].ad.slice(0, 30)}…).`,
      );
    }
  }

  gruplariIsaretle(basliklar, uyarilar);

  const toplamPuan = basliklar.reduce((t, b) => (b.grupMu ? t : t + (b.puan ?? 0)), 0);
  if (toplamPuan > 100) {
    uyarilar.push(
      `Rubrik toplamı ${toplamPuan} puan. Ağırlıklar yöneticiye doğrulatılmalı.`,
    );
  }
  if (!basliklar.some((b) => b.puan !== undefined)) {
    uyarilar.push('Şablon başlıklarında puan bilgisi bulunamadı; rubrik elle tanımlanmalı.');
  }
  if (!kurallar.azamiSayfa) {
    uyarilar.push('Sayfa sınırı kurallardan çıkarılamadı.');
  }

  // Kaynakça bölümünün adı yarışmadan yarışmaya değişiyor ("Kaynakça",
  // "Kaynaklar"); şablonda hangisi geçiyorsa o kullanılır.
  const kaynakcaBaslik = basliklar.find((b) =>
    /^(kaynakca|kaynaklar|referanslar|references)/.test(anahtar(b.ad)),
  );

  const sablon: Sablon = {
    kod,
    ad,
    yil,
    beklenenDil: 'tr',
    asgariSayfa: kurallar.asgariSayfa,
    azamiSayfa: kurallar.azamiSayfa,
    basliklar,
    kaynakca: kaynakcaBaslik
      ? {
          zorunlu: true,
          adlar: [kaynakcaBaslik.ad, 'Kaynakça', 'Kaynaklar', 'References'],
          asgariKaynak: 3,
          atifBekleniyor: kurallar.atifBicimi === 'koseli-parantez' || true,
        }
      : undefined,
  };

  return { sablon, kurallar, ornekKaynaklar, toplamPuan, uyarilar };
}

// ------------------------------------------------------------- rubrik

export interface RubrikKriteri {
  kod: string;
  ad: string;
  puan: number;
  /**
   * Raporda ayrı bir bölüm olarak beklenmiyor (ör. "Rapor Düzeni ve Şablona
   * Uyum"). Hakem yine puanlar, ama raporun bütününe bakarak.
   */
  bolumBekleniyor: boolean;
  /**
   * Değerlendirme ölçütü. Şablonun o bölüm için yazdığı yönerge metni,
   * hakemin neye baktığının birebir tanımıdır — rubriği uydurmaya gerek yok.
   */
  olcut: string[];
  /** Rapordaki karşılık bölüm adı. */
  bolumAdi: string;
}

export interface Rubrik {
  kriterler: RubrikKriteri[];
  toplamPuan: number;
}

/** Şablondan MVP 6'nın rubriğini üretir. */
export function rubrikCikar(cikarim: SablonCikarimi): Rubrik {
  const kriterler: RubrikKriteri[] = [];

  for (const b of cikarim.sablon.basliklar) {
    // Grup başlığı rubriğe girmez; puanı alt başlıklarında zaten var.
    if (!b.puan || b.grupMu) continue;
    kriterler.push({
      kod: anahtar(b.ad).replace(/\s+/g, '-').slice(0, 40),
      ad: b.ad,
      puan: b.puan,
      bolumBekleniyor: b.raporda !== false,
      olcut: b.yonergeMetni ?? [],
      bolumAdi: b.ad,
    });
  }

  /*
   * PUANSIZ ŞABLON — EŞİT AĞIRLIKLI TASLAK
   *
   * 60 yarışmalık katalog taramasında ortaya çıktı: TEKNOFEST şablonlarının
   * çoğu bölüm başlıklarını veriyor ama PUAN AĞIRLIĞI VERMİYOR. Ağırlık
   * şartnamede ya da teknik şartnamede duruyor; şablon yalnızca "raporu şu
   * bölümlerle yaz" diyor. 81 kategorinin 37'si böyle.
   *
   * Bu durumda boş rubrik döndürmek en kötü seçenek: yönetici 11 kriteri
   * elle yazmak zorunda kalır ve sistem o kategoride hiç çalışmaz. Onun
   * yerine bölüm başlıklarından EŞİT AĞIRLIKLI bir taslak üretilir.
   *
   * Ağırlıklar UYDURMA DEĞİL, AÇIKÇA EŞİTTİR — ve bu bir uyarıyla
   * bildirilir. Yönetici şartnamedeki gerçek ağırlıkları girer. Uydurma
   * ağırlık ile eşit ağırlık arasındaki fark şudur: eşit ağırlık yanlış
   * olduğunu kendisi söyler.
   */
  if (!kriterler.length) {
    const adaylar = cikarim.sablon.basliklar.filter(
      (b) => !b.grupMu && b.raporda !== false,
    );
    if (adaylar.length >= 3) {
      // 100 puan eşit bölünür; kalan artık ilk kritere eklenir ki toplam
      // tam 100 olsun (33+33+33 = 99 gibi bir toplam hakemi şaşırtır).
      const pay = Math.floor(100 / adaylar.length);
      const artik = 100 - pay * adaylar.length;
      for (const [i, b] of adaylar.entries()) {
        kriterler.push({
          kod: anahtar(b.ad).replace(/\s+/g, '-').slice(0, 40),
          ad: b.ad,
          puan: pay + (i === 0 ? artik : 0),
          bolumBekleniyor: true,
          olcut: b.yonergeMetni ?? [],
          bolumAdi: b.ad,
        });
      }
      cikarim.uyarilar.push(
        `Şablonda puan ağırlığı yok; ${adaylar.length} bölüm için EŞİT ağırlık ` +
          'atandı (toplam 100). Gerçek ağırlıklar şartnamede olabilir — ' +
          'onaylamadan önce düzeltin.',
      );
    }
  }

  return { kriterler, toplamPuan: kriterler.reduce((t, k) => t + k.puan, 0) };
}
