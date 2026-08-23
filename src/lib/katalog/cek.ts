/**
 * teknofest.org yarışma kataloğunu çeker.
 *
 * SAYFA YAPISI (2026-08 itibarıyla gözlemlenen)
 *   /tr/yarismalar/                      → 60 yarışmanın slug listesi
 *   /tr/yarismalar/<slug>/               → yarışma detayı
 *   cdn.teknofest.org/media/upload/...   → şablon / şartname dosyaları
 *
 * BELGE TOPLAMA — İKİ YOLLU, BİLEREK
 * İlk sürüm yalnızca `<a href=...>ETİKET</a>` kalıbını arıyordu. Çalıştı ama
 * eksik: "Tarım Teknolojileri" sayfasında şartname bağlantısı bu kalıba
 * uymuyor ve dosya sessizce kayboluyordu. Kayıp bir şartname, o yarışmanın
 * bütün değerlendirmesini sakatlar.
 *
 * Bu yüzden önce SAYFADAKİ TÜM CDN BELGE URL'LERİ toplanıyor; etiket
 * bulunabilirse sınıflandırmada kullanılıyor, bulunamazsa dosya adına
 * düşülüyor. Dosya adı da bilgi taşıyor:
 *   2026_HAVACILIKTA_YAPAY_ZEKA_TEKNIK_SARTNAME_TR_v1_...pdf
 */

import type {
  BelgeTuru, Katalog, KatalogBelgesi, KatalogYarismasi, RaporAsamasi,
} from './tipler';
import { anahtar, onar } from '../analiz/normalize';

const KOK = 'https://www.teknofest.org';
const LISTE = `${KOK}/tr/yarismalar/`;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** İstekler arası bekleme. Siteyi yormamak için; 60 sayfa ~90 saniye. */
const BEKLEME_MS = 1200;

const BELGE_UZANTILARI = /\.(pdf|docx|doc|xlsx|zip)$/i;

// ----------------------------------------------------------- sınıflandırma

/**
 * Aşama kısaltmaları.
 *
 * Sıra ÖNEMLİ: "ÖDR" ile "ÖTR" ayrı raporlardır ve bazı etiketlerde ikisi de
 * uzun yazılıyor ("Ön Değerlendirme Raporu" / "Ön Tasarım Raporu"). Uzun
 * biçimler önce denenir; kısaltma araması "otr" gibi bir dizgeyi başka
 * kelimenin içinde yakalayabilir.
 */
const ASAMA_DESENLERI: Array<[RaporAsamasi, RegExp[]]> = [
  ['ÖDR', [/on degerlendirme raporu/, /\bodr\b/]],
  ['ÖTR', [/on tasarim raporu/, /\botr\b/]],
  ['PDR', [/proje detay raporu/, /\bpdr\b/]],
  ['DTR', [/detayli tasarim raporu/, /\bdtr\b/]],
  ['KTR', [/kritik tasarim raporu/, /\bktr\b/]],
  ['ÖNR', [/proje oneri raporu/, /oneri raporu/, /\bonr\b/, /\bpor\b/]],
];

const SEVIYE_DESENLERI: Array<[string, RegExp]> = [
  ['Lise', /\blise\b/],
  ['Üniversite', /\buniversite\b/],
  ['Ortaokul', /\bortaokul\b/],
  ['İlkokul', /\bilkokul\b/],
  ['Yıldızlar', /\byildizlar\b/],
  ['Mezun', /\bmezun\b/],
];

/**
 * Şartname eki — hiçbir koşulda rapor şablonu değildir.
 *
 * "Attachment - 12 Checklist Template (2026)" içinde "Template" geçiyor ve
 * bu yüzden şablon sayılıyordu. Oysa bir kontrol listesi; rubrik çıkarıcıya
 * verilirse kontrol maddelerini rapor bölümü sanar.
 */
const EK_ISARETI = /attachment|\bek[\s-]?\d|checklist|kontrol listesi/;

/**
 * Rapor değil, talimat.
 *
 * "Ön Değerlendirme Sunumu (Simülasyon) Videosu Yönergesi ve Şablonu"
 * içinde "Şablonu" geçiyor ama bu bir VİDEO yönergesi; rubrik çıkarıcıya
 * verilirse video kurallarını rapor bölümü sanar.
 *
 * Sonda `\b` YOK: Türkçe ek alıyor — "yönerge" → "yönergesi",
 * "video" → "videosu". Bu tuzağa şablon çıkarıcıda da düşmüştük.
 */
const TALIMAT_ISARETI = /yonerge|video|sunum|poster|afis/;

/**
 * "Rapor" geçen ama şablon olmayan .docx'ler.
 *
 * Roket Yarışması'nın 30'dan fazla eki var ve çoğu .docx: dilekçe,
 * taahhütname, teslim tutanağı, talep formu. Yalnızca ADI ŞABLON DEMEYEN
 * belgeler için uygulanır — "Teknik Yeterlilik Formu Şablonu" gerçek bir
 * şablondur ve "formu" kelimesi yüzünden dışlanmamalı.
 */
const SABLON_DEGIL =
  /\b(form|formu|dilekce|taahhut|muvafakat|tutanak|tutanagi|kilavuz|yonerge|talimat)\b/;

/**
 * Türkçe büyük harf için arama biçimi.
 *
 * JS'te /kategori/i deseni "KATEGORİSİ" ile EŞLEŞMEZ: İ (U+0130) küçük harfe
 * çevrilince "i" + birleşik nokta olur, "i" değil. Bu yüzden İ ve I önce
 * TEK KARAKTERE eşlenir, sonra küçültülür — böylece dizge UZUNLUĞU KORUNUR
 * ve bulunan konum özgün metinde de geçerli kalır. Uzunluk korunmazsa
 * `slice(0, i)` yanlış yerden keser.
 */
function aramaIcin(s: string): string {
  return s.replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase();
}

/**
 * Belge türü.
 *
 * SIRA KRİTİK: "TEKNIK SARTNAME" dizgesi "sartname" içerir. Teknik önce
 * denenmezse bütün teknik şartnameler genel şartname sayılır — puanlama
 * detayını taşıyan belge yanlış rafa konur.
 *
 * ŞABLON İKİ YOLDAN TANINIR
 *   1. Etikette "şablon" / "template" geçiyorsa — açık durum.
 *   2. Etiketinde "rapor" geçen bir .docx ise. TEKNOFEST bazı yarışmalarda
 *      şablonu "şablon" demeden yayımlıyor: "Proje Sunuş Raporu Lise
 *      Seviyesi", "KAVRAMSAL TASARIM FİNAL DEĞERLENDİRME RAPORU". Bunlar
 *      doldurulacak Word belgeleridir; kaçırılırsa o kategori
 *      değerlendirilemez. Şartnameler PDF yayımlandığı için .docx koşulu
 *      şartnameyi yanlışlıkla şablon yapmaz (61 şartnamenin hepsi PDF).
 */
function turBelirle(a: string, uzanti: string): BelgeTuru {
  if (/teknik sartname/.test(a)) return 'teknik_sartname';
  if (EK_ISARETI.test(a) || TALIMAT_ISARETI.test(a)) return 'diger';
  if (/sablon|template/.test(a)) return 'sablon';
  if (/sartname/.test(a)) return 'sartname';
  if ((uzanti === 'docx' || uzanti === 'doc') && /\brapor/.test(a) && !SABLON_DEGIL.test(a)) {
    return 'sablon';
  }
  return 'diger';
}

function asamaBelirle(a: string): RaporAsamasi | undefined {
  for (const [asama, desenler] of ASAMA_DESENLERI) {
    if (desenler.some((d) => d.test(a))) return asama;
  }
  return undefined;
}

function seviyeBelirle(a: string): string | undefined {
  for (const [ad, desen] of SEVIYE_DESENLERI) if (desen.test(a)) return ad;
  return undefined;
}

/**
 * Etiketten kategori adını çıkarır.
 *
 * GERÇEK ETİKETLER — kategori adı önce de sonra da gelebiliyor, uzunluğu
 * bir ile on iki sözcük arasında değişiyor:
 *
 *   "2026 Hazır Araç Kategorisi Kritik Tasarım Raporu Şablonu (KTR)"
 *   "2026 Roket Yarışması A6-Özgün Hibrit Yakıt Motorlu Roket Kategorisi …"
 *   "2026 Roket Yarışması A4 - Uluslararası Kategori Atışa Hazırlık Raporu …"
 *   "… Proje Ön Değerlendirme Raporu Şablonu Üniversite ve Üzeri Seviyesi
 *    Fikir/Proje Kategorisi"
 *   "2026 HGY Kurallar Kitapçığı Bölüm 2- Performans Kategorisi Teknik …"
 *
 * Bu yüzden SÖZCÜK SAYMAK ÇALIŞMIYOR. İlk sürüm "kategoriden önceki son üç
 * sözcük" alıyordu; sonucu Roket'te A6 ile A7'nin AYNI kategoriye çökmesiydi
 * (ikisinin de son üç sözcüğü "Yakıt Motorlu Roket"). İki ayrı kategori tek
 * kategori sayılınca bir kategorinin şablonu tamamen kaybolur.
 *
 * DOĞRU KURAL: "Kategori" öncesindeki metni, SON BELGE-TÜRÜ SÖZCÜĞÜNDEN kes.
 * Kalan kısım kategori adıdır. Belge-türü sözcükleri yarışma adını, yılı ve
 * rapor/şablon nitelemelerini kapsar; kategori adı bunların hiçbiri değildir.
 *
 * `\b` KULLANILMIYOR: JS'te `ı` ve `ş` sözcük karakteri sayılmaz, bu yüzden
 * /\bYarışması\b/ hiç eşleşmez. Etiketler ayrıca tutarsız yazılıyor
 * ("Yarısması", "Sartnamesi"); desen bu yüzden aksansız biçimleri de içerir.
 */
const BELGE_SOZCUGU = new RegExp(
  [
    'yarışması', 'yarismasi', 'yarısması', 'yarışmaları', 'yarislari', 'yarışları',
    'TEKNOFEST', 'şablonu', 'sablonu', 'şablon', 'raporu', 'rapor',
    'şartnamesi', 'sartnamesi', 'şartname', 'sartname', 'formu', 'kitapçığı',
    'kitapcigi', 'bölüm', 'bolum', '\\d{4}',
  ].join('|'),
  'gi',
);

/** "Tüm Kategoriler" — tek bir kategori değil, hepsi için geçerli. */
const TUM_KATEGORILER = /tum kategori/;

function kategoriAdiCikar(etiket: string): string | undefined {
  const duz = onar(etiket);
  // "Kategorisi" kadar "Kategori" de var: "A4 - Uluslararası Kategori".
  // Arama aramaIcin() üzerinde; "UYGULAMA KATEGORİSİ" gibi büyük harfli
  // etiketler aksi halde hiç bulunmaz.
  const i = aramaIcin(duz).search(/kategori/);
  if (i < 0) return undefined;
  if (TUM_KATEGORILER.test(anahtar(duz))) return undefined;

  let on = duz.slice(0, i);

  let kesim = 0;
  for (const m of on.matchAll(BELGE_SOZCUGU)) {
    kesim = (m.index ?? 0) + m[0].length;
  }
  on = on.slice(kesim);

  // Baştaki ayıraç ve sıra numarasını at: "- Tanımlı Problem", "2- Performans",
  // "/ Katılım Bankacılığı".
  const ad = on
    .replace(/^[\s\-–—/,:.]+/, '')
    .replace(/^\d+[\s\-–—.)]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90);

  // En az bir harf aranıyor, iki ARDIŞIK harf değil: "A2-A3" geçerli bir
  // kategori adıdır ve ardışık iki harf içermez. İlk sürümde bu yüzden
  // Roket'in A2-A3 kategorisi tümden kayboluyordu.
  return ad.length >= 2 && /\p{L}/u.test(ad) ? ad : undefined;
}

/** Belge tüm kategoriler için mi yayımlanmış? */
function tumKategorilerMi(etiket: string): boolean {
  return TUM_KATEGORILER.test(anahtar(onar(etiket)));
}

/**
 * Kategori adı olamayacak sözcükler.
 *
 * "ALT KATEGORİLER SİSTEM GELİŞTİRME…" etiketinde "Kategoriler"den önce
 * yalnızca "ALT" var; bunu kategori adı yapmak anlamsız. Bu tür etiketler
 * türetim yoluna düşsün.
 */
const KATEGORI_OLAMAZ = new Set(['alt', 'tum', 'ana', 'genel', 'ust', 've', 'ile']);

/**
 * Etiketlerde kategori adına ait olmayan sözcükler.
 * Türetimde ortak sözcük olmasalar da atılırlar.
 */
const GURULTU = new Set([
  'kategori', 'kategorisi', 'kategoriler', 'kategorileri', 'seviyesi', 'seviye',
  'sablon', 'sablonu', 'rapor', 'raporu', 'teknofest', 'yarismasi', 'yarisma',
]);

const bolTokenlere = (s: string) =>
  onar(s).split(/[\s/,]+/).map((t) => t.trim()).filter(Boolean);

/**
 * İşareti olmayan kardeş şablonlardan kategori adı türetir.
 *
 * SORUN: Bazı yarışmalar şablonlarını kategori sözcüğü kullanmadan
 * yayımlıyor. Nükleer Enerji'de dört şablon var:
 *
 *   "KAVRAMSAL TASARIM FİNAL DEĞERLENDİRME RAPORU"
 *   "DETAY TASARIM FİNAL DEĞERLENDİRME RAPORU"
 *   ...
 *
 * Bunlar dört ayrı kategoridir ama hiçbirinde "Kategori" yazmıyor. Hepsini
 * kategorisiz bırakmak dört şablonu tek kategoriye yığar; biri kalır, üçü
 * kaybolur.
 *
 * ÇÖZÜM: Kardeş etiketlerin ORTAK sözcükleri kategoriyi ayırt etmez —
 * ayırt eden, geriye kalandır. "FİNAL DEĞERLENDİRME RAPORU" hepsinde var;
 * "KAVRAMSAL TASARIM" yalnızca birinde. Kalan, kategori adıdır.
 *
 * Tek belge kalırsa türetim yapılmaz: karşılaştıracak kardeş yoktur ve
 * belge muhtemelen yarışmanın tamamı içindir.
 */
function kategorileriTuret(belgeler: KatalogBelgesi[], kategoriSayilir: boolean): void {
  const adaylar = belgeler.filter(
    (b) => b.tur === 'sablon' && !b.kategori && !b.tumKategoriler,
  );
  if (adaylar.length < 2) return;

  const tokenler = adaylar.map((b) => bolTokenlere(b.etiket));
  const sayim = new Map<string, number>();
  for (const t of tokenler) {
    for (const k of new Set(t.map(anahtar))) sayim.set(k, (sayim.get(k) ?? 0) + 1);
  }

  for (const [i, belge] of adaylar.entries()) {
    const ayirt = tokenler[i].filter((token) => {
      const k = anahtar(token);
      if (!k || GURULTU.has(k)) return false;
      // Yıl her etikette var; sayı olduğu için ortak sayımına da girer.
      if (/^\d{4}$/.test(k)) return false;
      return sayim.get(k) !== adaylar.length;
    });

    const ad = ayirt.join(' ').replace(/\s+/g, ' ').trim().slice(0, 90);
    if (ad.length >= 3 && /\p{L}{2}/u.test(ad)) {
      belge.ayirtEdici = ad;
      if (kategoriSayilir) {
        belge.kategori = ad;
        belge.kategoriKaynagi = 'turetildi';
      }
    }
  }
}

/**
 * Ham çıkarımlardan kategoriyi karara bağlar.
 *
 * SIRA: etiketteki açık kategori → katılımcı seviyesi → türetim.
 *
 * Seviye ikinci sırada, çünkü bir yarışmada "Lise" ve "Üniversite" ayrı
 * şablonlarla yayımlanıyorsa bunlar gerçekten AYRI KATEGORİDİR — Sağlıkta
 * Yapay Zeka'da dört şablon var ve ikisi lise, ikisi üniversite için.
 * Seviyeyi kategori saymazsak dördü tek kategoriye yığılır.
 */
function kategoriyiCoz(belgeler: KatalogBelgesi[]): void {
  for (const b of belgeler) {
    const etiketten = b.kategoriAdi;
    if (etiketten && !KATEGORI_OLAMAZ.has(anahtar(etiketten))) {
      b.kategori = etiketten;
      b.kategoriKaynagi = 'etiket';
    } else if (b.seviye) {
      b.kategori = b.seviye;
      b.kategoriKaynagi = 'seviye';
    }
  }

  /*
   * TÜRETİLEN AD KATEGORİ Mİ, RAPOR AŞAMASI MI?
   *
   * Türetim iki farklı şeyi aynı biçimde buluyor:
   *
   *   Nükleer Enerji  → "KAVRAMSAL TASARIM", "DETAY TASARIM"   → KATEGORİ
   *   Elektronik Harp → "KTR", "TYF"                            → RAPOR TÜRÜ
   *   Robolig         → "ÖDR", "PDR"                            → RAPOR TÜRÜ
   *
   * Etiketlerden hangisi olduğu anlaşılmıyor: "Detay Tasarım" hem bir
   * kategori adı hem bir rapor aşaması olabilir ve ikisi de gerçekten
   * kullanılıyor.
   *
   * AYIRT EDİCİ SİNYAL: yarışmanın şablonlarından en az biri AÇIKÇA
   * "… Kategorisi" diyorsa, o yarışma kategorilere bölünmüş demektir ve
   * işaretsiz kardeşleri de kategoridir. Nükleer'de "UYGULAMA KATEGORİSİ"
   * var, Roket'te "A1 - Lise Kategorisi" var; Elektronik Harp ile
   * Robolig'de hiç yok.
   *
   * Kanıt ŞABLONDA olmak zorunda değil: Liseler Arası İHA'da kategoriler
   * ("Sabit-Döner Kanat", "Serbest Görev") şartname etiketinde açıkça
   * yazıyor, şablon etiketlerinde yazmıyor. Şartname de o yarışmanın
   * kategorilere bölündüğüne dair geçerli kanıttır.
   *
   * Bu ayrımı yapmazsak "Elektronik Harp'ta 2 kategori var" denir — yanlış
   * bilgi. Yaptığımızda her iki şablon da ayrı ayrı aktarılabilir kalır;
   * yalnızca kategori diye adlandırılmaz.
   */
  const acikKategoriVar = belgeler.some((b) => b.kategoriKaynagi === 'etiket');
  kategorileriTuret(belgeler, acikKategoriVar);
}

// --------------------------------------------------------------- getirme

async function sayfaGetir(url: string): Promise<string> {
  const yanit = await fetch(url, {
    headers: { 'user-agent': UA, 'accept-language': 'tr,en;q=0.8' },
    redirect: 'follow',
  });
  if (!yanit.ok) throw new Error(`${yanit.status} ${url}`);
  return yanit.text();
}

const bekle = (ms: number) => new Promise((c) => setTimeout(c, ms));

// ------------------------------------------------------------- ayrıştırma

/** Liste sayfasından slug'ları çıkarır. */
export function sluglariAyikla(html: string): string[] {
  const kume = new Set<string>();
  for (const m of html.matchAll(/href="\/tr\/yarismalar\/([a-z0-9-]+)\/?"/g)) {
    kume.add(m[1]);
  }
  // Liste sayfasının kendi yardımcı bağlantıları yarışma değil.
  for (const yasak of ['nasil-basvurulur', 'finalist-takimlar', 'sikca-sorulan-sorular']) {
    kume.delete(yasak);
  }
  return [...kume].sort();
}

/** Detay sayfasından yarışma adını çıkarır. */
/**
 * Sayfa başlığındaki site kuyruğunu atar: "… Yarışması | TEKNOFEST".
 *
 * Yalnızca AYIRAÇTAN SONRA gelen TEKNOFEST atılıyor. "TEKNOFEST Robolig
 * Yarışması" adının başındaki TEKNOFEST yarışma adının parçasıdır; koşulsuz
 * silmek onu bozardı.
 */
function siteKuyrugunuAt(ad: string): string {
  return ad.replace(/\s*[|–—]\s*TEKNOFEST\s*$/i, '').trim();
}

function adCikar(html: string, slug: string): string {
  const h1 = html.match(/<h1[^>]*>([\s\S]{3,200}?)<\/h1>/i);
  if (h1) {
    const ad = siteKuyrugunuAt(
      onar(h1[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()),
    );
    if (ad.length >= 5) return ad;
  }
  const baslik = html.match(/<title[^>]*>([\s\S]{3,200}?)<\/title>/i);
  if (baslik) {
    const ad = siteKuyrugunuAt(onar(baslik[1].replace(/\s+/g, ' ').trim()));
    if (ad.length >= 5) return ad;
  }
  // Son çare: slug'ı okunur hale getir.
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toLocaleUpperCase('tr'));
}

/**
 * Sayfadaki belge URL'lerini ve varsa bağlantı etiketlerini toplar.
 *
 * İki geçiş: önce `<a>` içindekiler (etiketli), sonra sayfada serbest geçen
 * CDN URL'leri (etiketsiz). Etiketli olan kazanır.
 */
export function belgeleriAyikla(html: string): KatalogBelgesi[] {
  const etiketler = new Map<string, string>();
  const bagDeseni =
    /<a[^>]*href="(https:\/\/cdn\.teknofest\.org\/[^"]+)"[^>]*>([\s\S]{0,500}?)<\/a>/gi;
  for (const m of html.matchAll(bagDeseni)) {
    const etiket = onar(m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    if (etiket) etiketler.set(m[1], etiket);
  }

  const urller = new Set<string>();
  for (const m of html.matchAll(/https:\/\/cdn\.teknofest\.org\/[^\s"'<>\\)]+/g)) {
    urller.add(m[0]);
  }

  const belgeler: KatalogBelgesi[] = [];
  for (const url of urller) {
    if (!BELGE_UZANTILARI.test(url)) continue;

    let dosyaAdi = url.split('/').pop() ?? url;
    try {
      dosyaAdi = decodeURIComponent(dosyaAdi);
    } catch {
      // Bozuk yüzde kodu — ham hali kalsın, sınıflandırma yine çalışır.
    }

    const etiket = etiketler.get(url) ?? dosyaAdi.replace(/_/g, ' ').replace(/\.\w+$/, '');
    // Etiket ve dosya adı BİRLİKTE aranıyor: biri eksik kalırsa öteki taşır.
    const a = anahtar(`${etiket} ${dosyaAdi.replace(/[_-]/g, ' ')}`);
    const uzanti = (dosyaAdi.match(/\.(\w+)$/)?.[1] ?? '').toLowerCase();

    belgeler.push({
      url,
      etiket,
      dosyaAdi,
      tur: turBelirle(a, uzanti),
      asama: asamaBelirle(a),
      kategoriAdi: kategoriAdiCikar(etiket),
      tumKategoriler: tumKategorilerMi(etiket) || undefined,
      seviye: seviyeBelirle(a),
      uzanti,
    });
  }

  // Kategori kararı BÜTÜN belge kümesine bakarak veriliyor: türetim
  // kardeş etiketlerin karşılaştırmasına dayanıyor, tek belgeye bakarak
  // yapılamaz.
  kategoriyiCoz(belgeler);

  // Şablon → şartname → teknik şartname → diğer sırası, sonra ada göre.
  const sira: Record<BelgeTuru, number> = {
    sablon: 0, sartname: 1, teknik_sartname: 2, diger: 3,
  };
  return belgeler.sort(
    (x, y) => sira[x.tur] - sira[y.tur] || x.etiket.localeCompare(y.etiket, 'tr'),
  );
}

/** Bir yarışma sayfasını çözümler. */
export function yarismaCozumle(slug: string, html: string): KatalogYarismasi {
  const ad = adCikar(html, slug);
  const belgeler = belgeleriAyikla(html);
  const isineYarar = belgeler.filter((b) => b.tur !== 'diger');

  const kategoriler = [
    ...new Set(isineYarar.map((b) => b.kategori).filter((k): k is string => !!k)),
  ].sort((x, y) => x.localeCompare(y, 'tr'));

  const asamalar = [
    ...new Set(
      isineYarar
        .filter((b) => b.tur === 'sablon')
        .map((b) => b.asama)
        .filter((a): a is RaporAsamasi => !!a),
    ),
  ];

  return {
    slug,
    ad,
    url: `${KOK}/tr/yarismalar/${slug}/`,
    // Seviye yarışma ADINDA olabilir: "…Yarışması Lise Seviyesi" ayrı yarışma.
    adSeviyesi: seviyeBelirle(anahtar(ad)),
    belgeler,
    kategoriler,
    asamalar,
    sablonVar: isineYarar.some((b) => b.tur === 'sablon'),
    sartnameVar: isineYarar.some((b) => b.tur === 'sartname'),
    teknikSartnameVar: isineYarar.some((b) => b.tur === 'teknik_sartname'),
  };
}

// ----------------------------------------------------------------- akış

export interface CekimSecenekleri {
  /** Yalnızca bu slug'lar çekilsin — test için. */
  yalnizca?: string[];
  /** Her yarışma çözümlendiğinde çağrılır; ilerleme göstermek için. */
  ilerleme?: (bitti: number, toplam: number, yarisma: KatalogYarismasi) => void;
  beklemeMs?: number;
}

export async function katalogCek(secenekler: CekimSecenekleri = {}): Promise<Katalog> {
  const uyarilar: string[] = [];
  const bekleme = secenekler.beklemeMs ?? BEKLEME_MS;

  const listeHtml = await sayfaGetir(LISTE);
  let sluglar = sluglariAyikla(listeHtml);
  if (!sluglar.length) throw new Error('Liste sayfasından yarışma çıkarılamadı.');
  if (secenekler.yalnizca?.length) {
    sluglar = sluglar.filter((s) => secenekler.yalnizca!.includes(s));
  }

  const yarismalar: KatalogYarismasi[] = [];
  for (const [i, slug] of sluglar.entries()) {
    try {
      const html = await sayfaGetir(`${KOK}/tr/yarismalar/${slug}/`);
      const y = yarismaCozumle(slug, html);
      yarismalar.push(y);
      secenekler.ilerleme?.(i + 1, sluglar.length, y);
    } catch (e) {
      // Tek sayfanın hatası bütün çekimi düşürmesin; eksik olan bildirilir.
      uyarilar.push(`${slug}: ${e instanceof Error ? e.message : 'çekilemedi'}`);
    }
    if (i < sluglar.length - 1) await bekle(bekleme);
  }

  for (const y of yarismalar) {
    if (!y.sablonVar) uyarilar.push(`${y.slug}: rapor şablonu bulunamadı.`);
    else if (!y.sartnameVar && !y.teknikSartnameVar) {
      uyarilar.push(`${y.slug}: şablon var ama şartname bulunamadı.`);
    }
  }

  return {
    cekildi: new Date().toISOString(),
    kaynak: LISTE,
    yarismalar: yarismalar.sort((x, y) => x.ad.localeCompare(y.ad, 'tr')),
    uyarilar,
  };
}
