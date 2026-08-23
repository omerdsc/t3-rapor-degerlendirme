/**
 * Benzerlik korpusu üretici (MVP 5 test seti).
 *
 * Yapısal kontrol fixture'larından (scripts/ornek-rapor-uret.ts) ayrı bir set:
 * orada bütün raporlar aynı temel metinden türer, bu benzerlik testini
 * anlamsız kılar. Burada her rapor GERÇEKTEN farklı bir anlatı taşır ve
 * yalnızca kasıtlı kopyalar örtüşür.
 *
 * Beklenen sonuç:
 *   K01 ↔ K03  görsel kopya   (aynı şekil, tamamen farklı metin)
 *   K01 ↔ K04  metin kopyası  (Çözüm + Yöntem birebir)
 *   K01 ↔ K05  devam projesi  (aynı takım — intihal değil)
 *   K02        hiçbiriyle eşleşmemeli (yanlış pozitif kontrolü)
 *
 *   npx tsx scripts/korpus-uret.ts
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { raporYaz, diyagram, type Bolum, type RaporTanimi } from './rapor-yazici';

const CIKTI = join(process.cwd(), 'test-verisi', 'korpus');

// ═══════════════════════════════════════════════════ ANLATI 1 · OT ROBOTU

const ROBOT: Bolum[] = [
  {
    baslik: '1. Proje Özeti',
    paragraflar: [
      'Bu proje, sıra arası yabancı ot mücadelesinde kimyasal kullanımını azaltmayı ' +
        'hedefleyen otonom bir tarla robotunu konu almaktadır. Sistem, tek kameradan ' +
        'alınan görüntü üzerinde çalışan hafif bir segmentasyon modeli ile bitki ve ' +
        'yabancı otu ayırt etmektedir [1].',
      'Ceylanpınar\'da iki dekarlık pamuk parselinde yapılan denemelerde tespit ' +
        'doğruluğu %89 ölçülmüştür. Prototip 38 saat saha çalışmasında hiç ürün ' +
        'zararı vermemiştir.',
    ],
  },
  {
    baslik: '2. Problem Durumunun Tanımlanması',
    paragraflar: [
      'Pamuk üretiminde yabancı ot mücadelesi ağırlıklı olarak herbisitlerle ' +
        'yapılmaktadır. Bu yöntem hem maliyetli hem de toprak sağlığı açısından ' +
        'sürdürülebilir değildir [2].',
      'Mekanik çapalama alternatif olmakla birlikte, dar sıra aralıklarında operatör ' +
        'hatası nedeniyle ürün zararı riski taşımaktadır. Ticari otonom çözümlerin ' +
        'maliyeti küçük işletmeler için erişilebilir değildir [3].',
    ],
  },
  {
    baslik: '3. Çözüm',
    paragraflar: [
      'Geliştirdiğimiz sistem, traktör arkasına bağlanan bir aparat üzerinde çalışır. ' +
        'Kamera görüntüsü gömülü kart üzerinde işlenir ve segmentasyon çıktısına göre ' +
        'çapalama bıçakları servo motorlarla konumlandırılır.',
      'Şekil 3.1: Sistem mimarisi ve veri akışı',
      'Çapalama ünitesinin konumlandırılmasında iki eksenli bir mekanizma ' +
        'kullanılmış olup, konum hatası artı eksi dört milimetre mertebesinde ' +
        'ölçülmüştür. Bu değer dar sıra aralıklarında kabul edilebilir sınırdadır.',
    ],
  },
  {
    baslik: '4. Yöntem',
    paragraflar: [
      'Veri seti, 2025 vejetasyon döneminde farklı gün saatlerinde çekilen 4.200 ' +
        'görüntüden oluşmaktadır. Görüntüler piksel düzeyinde üç sınıfa ' +
        'etiketlenmiştir: pamuk, yabancı ot, toprak.',
      'Model olarak hafif omurgalı bir kodlayıcı-kod çözücü ağ tercih edilmiştir. ' +
        'Tercihin gerekçesi, gömülü donanımda çıkarım süresini elli milisaniye ' +
        'altında tutma gerekliliğidir [4]. Doğrulama kümesinde mIoU 0,74 elde edilmiştir.',
      'Etiketleme sürecinde iki bağımsız etiketleyici çalışmış, anlaşmazlıkta üçüncü ' +
        'uzmana başvurulmuştur. Etiketleyiciler arası uyum 0,86 olarak ölçülmüştür.',
    ],
  },
  {
    baslik: '5. Yenilikçi (İnovatif) Yönü',
    paragraflar: [
      'Literatürdeki benzer çalışmaların çoğu sıra tespiti için ayrı bir lazer tarayıcı ' +
        'kullanmaktadır [5]. Bizim yaklaşımımızda sıra bilgisi doğrudan kamera ' +
        'görüntüsünden çıkarılmakta, donanım maliyeti yaklaşık %40 azalmaktadır.',
      'Bu tercihin sınırlılığı vardır: yoğun toz koşullarında doğruluk %72\'ye ' +
        'düşmektedir. Sınırlılık risk bölümünde ele alınmıştır.',
    ],
  },
  {
    baslik: '6. Uygulanabilirlik',
    paragraflar: [
      'Prototip maliyeti otuz sekiz bin dört yüz lira olarak gerçekleşmiştir. Seri ' +
        'üretimde bu rakamın önemli ölçüde düşeceği öngörülmektedir. Bölgedeki bir ' +
        'tarım işletmesiyle pilot uygulama görüşmesi yapılmıştır.',
    ],
  },
  {
    baslik: '7. Riskler',
    paragraflar: [
      'Toz koşullarında doğruluk kaybı en önemli teknik risktir. Karşı önlem olarak ' +
        'kameraya basınçlı hava temizleme ünitesi eklenmesi planlanmaktadır [6].',
      'İkinci risk gömülü donanım tedarik süresidir; alternatif kart konfigürasyonu ' +
        'değerlendirilmiştir.',
    ],
  },
  {
    baslik: '8. Kaynakça',
    paragraflar: [
      '[1] Yılmaz, A., Demir, K. (2024). Otonom tarla robotlarında görüntü tabanlı ' +
        'yabancı ot tespiti. Tarım Makinaları Bilimi Dergisi, 20(2), 45-58.',
      '[2] Kaya, M. (2023). Herbisit kullanımının toprak mikrobiyotasına etkileri. ' +
        'Toprak Bilimi Dergisi, 11(1), 12-24.',
      '[3] Öztürk, S. (2022). Precision weeding systems: a cost-benefit analysis. ' +
        'Computers and Electronics in Agriculture, 195, 106-118.',
      '[4] Howard, A. et al. (2019). Searching for efficient architectures. ICCV, 1314-1324.',
      '[5] Şahin, E. (2023). Lazer tabanlı sıra takip sistemleri. Otomasyon, 8(3), 77-90.',
      '[6] Doğan, H. (2024). Tarım makinalarında sensör koruma. Ankara: Ziraat Yayınları.',
    ],
  },
];

// ═══════════════════════════════════════════════════ ANLATI 2 · SERA İKLİMİ

const SERA: Bolum[] = [
  {
    baslik: '1. Proje Özeti',
    paragraflar: [
      'Örtü altı yetiştiricilikte iklim yönetimi büyük ölçüde üreticinin ' +
        'deneyimine bırakılmıştır. Çalışmamız, cam serada sıcaklık, bağıl nem ve ' +
        'karbondioksit düzeyini birlikte dengeleyen bir denetim birimi önermektedir [1].',
      'Antalya Kumluca\'da 1.200 metrekarelik bir domates serasında altı ay boyunca ' +
        'karşılaştırmalı ölçüm yapılmıştır. Enerji tüketimi %19 azalırken meyve ' +
        'tutum oranı korunmuştur.',
    ],
  },
  {
    baslik: '2. Problem Durumunun Tanımlanması',
    paragraflar: [
      'Seralarda havalandırma kapakları çoğunlukla yalnızca sıcaklığa bakılarak ' +
        'açılmaktadır. Bağıl nem yükseldiğinde mantari hastalık riski artar; nem ' +
        'düştüğünde bitki su stresine girer [2].',
      'Tek değişkene bakan denetim, ısıtma ve havalandırmanın birbirini iptal ettiği ' +
        'salınımlara yol açar. Bu salınım hem enerji israfına hem verim kaybına neden olur.',
    ],
  },
  {
    baslik: '3. Çözüm',
    paragraflar: [
      'Önerdiğimiz denetleyici, üç değişkeni tek bir maliyet fonksiyonunda birleştirir. ' +
        'Karar her beş dakikada bir yenilenir; ısıtma, havalandırma ve sisleme ' +
        'aktüatörleri eşzamanlı sürülür.',
      'Şekil 3.1: Denetim döngüsü ve aktüatör hiyerarşisi',
      'Aktüatörler arasında öncelik sırası tanımlanmıştır. Enerji maliyeti yüksek ' +
        'olan ısıtma yalnızca pasif yöntemler yetersiz kaldığında devreye girer.',
    ],
  },
  {
    baslik: '4. Yöntem',
    paragraflar: [
      'Sera dokuz ölçüm noktasına bölünmüş, her noktaya sıcaklık ve nem sensörü ' +
        'yerleştirilmiştir. Karbondioksit ölçümü merkezi tek noktadan yapılmaktadır.',
      'Denetleyici parametreleri, ilk ayda toplanan veriyle çevrimdışı olarak ' +
        'ayarlanmıştır [3]. Karşılaştırma grubu olarak klasik eşik tabanlı denetim ' +
        'kullanan komşu sera seçilmiştir.',
      'Ölçümler saatlik kaydedilmiş, günlük ortalamalar üzerinden karşılaştırma ' +
        'yapılmıştır. İstatistiksel anlamlılık eşleştirilmiş test ile sınanmıştır.',
    ],
  },
  {
    baslik: '5. Yenilikçi (İnovatif) Yönü',
    paragraflar: [
      'Piyasadaki sera otomasyonları genellikle her aktüatörü bağımsız denetler [4]. ' +
        'Bizim yaklaşımımızda aktüatörler ortak bir hedef fonksiyonunu paylaşır, ' +
        'bu da salınımı ortadan kaldırır.',
      'İkinci özgün yön, denetleyicinin sera geometrisinden bağımsız çalışmasıdır. ' +
        'Kurulumda yalnızca sensör konumları tanımlanır.',
    ],
  },
  {
    baslik: '6. Uygulanabilirlik',
    paragraflar: [
      'Donanım maliyeti mevcut otomasyon sistemlerinin altındadır; sensörler standart ' +
        'endüstriyel bileşenlerdir. Yazılım, hâlihazırda kurulu panolara yüklenebilir ' +
        'biçimde tasarlanmıştır.',
    ],
  },
  {
    baslik: '7. Riskler',
    paragraflar: [
      'Sensör arızası hatalı karara yol açabilir. Bu riske karşı komşu noktalarla ' +
        'tutarlılık denetimi eklenmiş, aykırı ölçüm veren sensör devre dışı ' +
        'bırakılmaktadır [5].',
      'İkinci risk elektrik kesintisidir; kesinti hâlinde sistem güvenli konuma geçer.',
    ],
  },
  {
    baslik: '8. Kaynakça',
    paragraflar: [
      '[1] Arslan, B. (2023). Örtü altı üretimde iklim denetimi. Sera Teknolojileri, 7(2), 88-101.',
      '[2] van Dijk, P. (2022). Humidity management in greenhouse tomato. Acta Horticulturae, 1337, 55-64.',
      '[3] Korkmaz, F. (2024). Model tabanlı denetleyici parametre ayarı. Otomatik Kontrol, 12(1), 20-34.',
      '[4] Yıldırım, G. (2021). Sera otomasyon sistemleri karşılaştırması. Tarım Bilimleri, 27(4), 410-423.',
      '[5] Nakamura, H. (2023). Sensor fault detection in agricultural IoT. Sensors, 23(9), 4412.',
    ],
  },
];

// ═══════════════════════════════════════════════════ ANLATI 3 · İLAÇLAMA DRONU

const DRON: Bolum[] = [
  {
    baslik: '1. Proje Özeti',
    paragraflar: [
      'Bağ ve bahçe alanlarında ilaçlama hâlen sırt pülverizatörü ile yapılmakta, ' +
        'uygulayıcı kimyasala doğrudan maruz kalmaktadır. Projemiz eğimli arazilerde ' +
        'çalışabilen hafif bir ilaçlama dronu geliştirmeyi amaçlar [1].',
      'Platform, dört rotorlu bir gövde üzerine yerleştirilen sekiz litrelik tank ve ' +
        'değişken debili meme sistemiyle donatılmıştır.',
    ],
  },
  {
    baslik: '2. Problem Durumunun Tanımlanması',
    paragraflar: [
      'Bağcılığın önemli bölümü eğimli arazilerde yapılmaktadır. Bu alanlarda ' +
        'traktörle ilaçlama mümkün olmadığından işlem el ile yürütülür; uygulayıcı ' +
        'sağlığı ciddi risk altındadır [2].',
      'Mevcut ticari ilaçlama dronları düz ova koşulları için tasarlanmıştır. Eğim ' +
        'değişimine uyum sağlayan irtifa denetimi bulunmadığından ilaç dağılımı ' +
        'homojen olmamaktadır.',
    ],
  },
  {
    baslik: '3. Çözüm',
    paragraflar: [
      'Geliştirdiğimiz platform, altına yerleştirilen mesafe sensörü ile bitki ' +
        'örtüsüne olan yüksekliği sabit tutar. Meme debisi uçuş hızına bağlı olarak ' +
        'ayarlanır; birim alana düşen ilaç miktarı sabit kalır.',
      'Şekil 3.1: Uçuş denetimi ve ilaçlama mimarisi',
      'Uçuş denetim kartı ile ilaçlama denetleyicisi ayrı işlemciler üzerinde çalışır. ' +
        'Bu ayrım, ilaçlama biriminde oluşabilecek arızanın uçuş güvenliğini ' +
        'etkilememesini sağlar.',
    ],
  },
  {
    baslik: '4. Yöntem',
    paragraflar: [
      'Saha denemeleri üç farklı eğim sınıfında yürütülmüştür. Her denemede su ' +
        'duyarlı kâğıtlarla damla dağılımı ölçülmüş, kaplama oranı ve damla ' +
        'yoğunluğu kaydedilmiştir [3].',
      'Sabit irtifa denetimi açıkken kaplama tekdüzeliği %31 iyileşmiş, ilaç tüketimi ' +
        '%18 azalmıştır. Ölçümler üç tekrarlı yapılmıştır.',
    ],
  },
  {
    baslik: '5. Yenilikçi (İnovatif) Yönü',
    paragraflar: [
      'Literatürdeki ilaçlama dronlarının çoğu sabit irtifa varsayımıyla çalışır [4]. ' +
        'Eklediğimiz mesafe geri beslemesi, eğim değişiminde bile kaplama ' +
        'tekdüzeliğini korur.',
      'İkinci özgün yön, ilaçlama ve uçuş denetleyicilerinin fiziksel olarak ' +
        'ayrılmasıdır; bu ayrım sertifikasyon süreçlerini kolaylaştırmaktadır.',
    ],
  },
  {
    baslik: '6. Uygulanabilirlik',
    paragraflar: [
      'Platform, mevcut ticari dron gövdeleri üzerine monte edilebilecek bir modül ' +
        'olarak tasarlanmıştır. Bu yaklaşım ilk yatırım maliyetini belirgin biçimde ' +
        'düşürmektedir.',
    ],
  },
  {
    baslik: '7. Riskler',
    paragraflar: [
      'Rüzgâr, damla sürüklenmesine yol açarak komşu parselleri etkileyebilir. ' +
        'Sistem, ölçülen rüzgâr hızı eşiği aştığında uygulamayı durdurur [5].',
      'İkinci risk yasal düzenlemedir; havacılık mevzuatı uçuş irtifası ve pilot ' +
        'belgesi konusunda kısıt getirmektedir.',
    ],
  },
  {
    baslik: '8. Kaynakça',
    paragraflar: [
      '[1] Aksoy, T. (2024). Eğimli arazilerde insansız hava aracı ile ilaçlama. Bahçe Bitkileri, 15(1), 33-47.',
      '[2] Çelik, N., Aslan, R. (2023). Damla dağılım tekdüzeliğinin ölçülmesi. Tarım Makinaları, 19(4), 210-222.',
      '[3] Wang, L. et al. (2022). UAV spraying in sloped vineyards. Precision Agriculture, 23(6), 2201-2219.',
      '[4] Tarım ve Orman Bakanlığı (2024). Bitki Koruma Ürünleri Uygulama Rehberi. Ankara.',
      '[5] Kılıç, M. (2023). İnsansız hava araçlarında yük dengeleme. Havacılık Teknolojileri, 9(2), 55-68.',
    ],
  },
];

// ═══════════════════════════════════════════════════ ANLATI 4 · NEM AĞI

const NEM: Bolum[] = [
  {
    baslik: '1. Proje Özeti',
    paragraflar: [
      'Sulama kararları çoğu işletmede takvime göre verilmektedir. Çalışmamız, ' +
        'düşük maliyetli toprak nem sensörlerinden oluşan bir ağ ile sulama zamanını ' +
        'bitkinin gerçek ihtiyacına göre belirlemeyi hedefler [1].',
      'Konya Çumra\'da mısır parselinde yürütülen denemede su tüketimi %23 azalmış, ' +
        'verimde anlamlı bir düşüş gözlenmemiştir.',
    ],
  },
  {
    baslik: '2. Problem Durumunun Tanımlanması',
    paragraflar: [
      'Takvime dayalı sulama, yağış ve sıcaklık değişimlerini dikkate almaz. Fazla ' +
        'su hem pompalama maliyeti hem besin elementi yıkanması anlamına gelir [2].',
      'Ticari nem izleme sistemleri parsel başına yüksek maliyet getirdiğinden küçük ' +
        'işletmelerde yaygınlaşmamıştır.',
    ],
  },
  {
    baslik: '3. Çözüm',
    paragraflar: [
      'Her düğüm, iki derinlikte kapasitif nem ölçümü yapar ve düşük güçlü telsiz ' +
        'bağlantısıyla toplayıcı birime veri gönderir. Düğümler güneş paneliyle ' +
        'kendi kendine yeter.',
      'Şekil 3.1: Düğüm mimarisi ve haberleşme topolojisi',
      'Toplayıcı birim, ölçümleri bitki su tüketimi modeliyle birleştirerek sulama ' +
        'önerisi üretir. Öneri, üreticiye kısa mesajla iletilir.',
    ],
  },
  {
    baslik: '4. Yöntem',
    paragraflar: [
      'Kapasitif sensörler laboratuvarda gravimetrik yöntemle kalibre edilmiştir. ' +
        'Kalibrasyon eğrisi üç farklı toprak bünyesi için ayrı çıkarılmıştır [3].',
      'Saha denemesinde parsel ikiye bölünmüş; bir yarısı takvime göre, diğer yarısı ' +
        'sistem önerisine göre sulanmıştır. Su sayacı ile tüketim ölçülmüştür.',
    ],
  },
  {
    baslik: '5. Yenilikçi (İnovatif) Yönü',
    paragraflar: [
      'Benzer sistemler genellikle tek derinlikte ölçüm yapar [4]. İki derinlikli ' +
        'ölçüm, kök bölgesindeki su hareketini görünür kılarak aşırı sulamayı ' +
        'erken uyarır.',
      'Düğüm maliyeti, piyasadaki muadillerinin belirgin altındadır; bu da parsel ' +
        'başına daha yoğun ölçüm ağı kurulmasına imkân verir.',
    ],
  },
  {
    baslik: '6. Uygulanabilirlik',
    paragraflar: [
      'Sistem, sulama birlikleri aracılığıyla hizmet modeliyle yaygınlaştırılabilir. ' +
        'Üreticinin cihaz satın almasına gerek kalmaz.',
    ],
  },
  {
    baslik: '7. Riskler',
    paragraflar: [
      'Tarla işlemleri sırasında düğümlerin fiziksel zarar görmesi başlıca risktir. ' +
        'Düğümler sürüm derinliğinin altına yerleştirilebilecek biçimde tasarlanmıştır [5].',
      'İkinci risk telsiz kapsama alanıdır; engebeli arazide yineleyici düğüm gerekmektedir.',
    ],
  },
  {
    baslik: '8. Kaynakça',
    paragraflar: [
      '[1] Erdoğan, S. (2023). Toprak nemine dayalı sulama yönetimi. Sulama Araştırmaları, 14(2), 101-115.',
      '[2] Bilgin, A. (2022). Aşırı sulamanın besin elementi kaybına etkisi. Toprak Su, 9(1), 44-56.',
      '[3] Topp, G. C. (2021). Calibration of capacitance soil moisture sensors. Vadose Zone Journal, 20(3).',
      '[4] Karaca, İ. (2024). Kablosuz sensör ağlarıyla tarla izleme. Elektrik Mühendisliği, 18(3), 200-214.',
      '[5] Şeker, D. (2023). Saha donanımlarında dayanıklılık tasarımı. Makine Tasarımı, 6(4), 77-90.',
    ],
  },
];

// ═══════════════════════════════════════════════════════════ korpus tanımı

/** K04, K01'in Çözüm ve Yöntem bölümlerini birebir devralır. */
function metinKopyasi(): Bolum[] {
  return NEM.map((b) => {
    if (b.baslik.includes('Çözüm')) return ROBOT[2];
    if (b.baslik.includes('Yöntem')) return ROBOT[3];
    return b;
  });
}

const KORPUS: RaporTanimi[] = [
  {
    dosya: 'K01-ot-robotu.pdf',
    aciklama: 'Referans rapor',
    takim: 'Takım Anadolu', takimId: 'anadolu', kategori: 'tarim',
    proje: 'Otonom Yabancı Ot Temizleme Robotu', yil: 2026,
    gorsel: 'A', bolumler: ROBOT,
  },
  {
    dosya: 'K02-sera-iklim.pdf',
    aciklama: 'Bağımsız rapor — hiçbir eşleşme beklenmiyor (yanlış pozitif kontrolü)',
    takim: 'Takım Harran', takimId: 'harran', kategori: 'tarim',
    proje: 'Sera İklim Denetim Sistemi', yil: 2026,
    gorsel: 'B', bolumler: SERA,
  },
  {
    dosya: 'K03-ilaclama-dronu.pdf',
    aciklama: 'K01 ile AYNI ŞEKİL, tamamen farklı metin → BENZERLIK_GORSEL',
    takim: 'Takım Zap', takimId: 'zap', kategori: 'tarim',
    proje: 'Bağ ve Bahçe İlaçlama Dronu', yil: 2026,
    gorsel: 'A', bolumler: DRON,
  },
  {
    dosya: 'K04-nem-agi.pdf',
    aciklama: 'K01\'in Çözüm + Yöntem bölümleri birebir → BENZERLIK_METIN',
    takim: 'Takım Botan', takimId: 'botan', kategori: 'tarim',
    proje: 'Toprak Nem Sensör Ağı', yil: 2026,
    gorsel: 'C', bolumler: metinKopyasi(),
  },
  {
    dosya: 'K05-ot-robotu-faz2.pdf',
    aciklama: 'K01 ile aynı takım → BENZERLIK_DEVAM_PROJESI (intihal değil)',
    takim: 'Takım Anadolu', takimId: 'anadolu', kategori: 'tarim',
    proje: 'Otonom Yabancı Ot Temizleme Robotu — Faz 2', yil: 2026,
    gorsel: 'D', bolumler: ROBOT,
  },
];

async function main() {
  mkdirSync(CIKTI, { recursive: true });
  console.log(`Benzerlik korpusu üretiliyor → ${CIKTI}\n`);

  for (const tanim of KORPUS) {
    const boyut = await raporYaz(tanim, CIKTI);
    console.log(
      `  ${tanim.dosya.padEnd(26)} ${(boyut / 1024).toFixed(0).padStart(4)} KB  ` +
        `şekil ${tanim.gorsel}  ${tanim.aciklama}`,
    );
  }

  writeFileSync(
    join(CIKTI, 'manifest.json'),
    JSON.stringify(
      KORPUS.map((t) => ({
        dosya: t.dosya, takim: t.takim, takimId: t.takimId,
        proje: t.proje, kategori: t.kategori, yil: t.yil,
        gorsel: t.gorsel ?? null, aciklama: t.aciklama,
      })),
      null,
      2,
    ),
    'utf-8',
  );

  console.log(`\n${KORPUS.length} rapor + manifest.json üretildi.`);
  void diyagram;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
