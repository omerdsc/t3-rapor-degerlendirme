/**
 * Sentetik TEKNOFEST raporu üretici.
 *
 * YAPISAL KONTROL fixture'ları (MVP 1-2-3). Her dosya,
 * docs/gercek-dunya-sorunlari.md'deki belirli bir bozulmayı bilinçli olarak
 * taşır; aynı zamanda regresyon test setidir.
 *
 * Benzerlik testi ayrı settedir: scripts/korpus-uret.ts. Buradaki raporlar
 * aynı temel metinden türediği için benzerlik korpusu olarak kullanılamaz.
 *
 * Çalıştırma:  npx tsx scripts/ornek-rapor-uret.ts
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { raporYaz, type Bolum, type RaporTanimi } from './rapor-yazici';

const CIKTI = join(process.cwd(), 'test-verisi', 'raporlar');

// ------------------------------------------------------- ortak metin blokları

const OZET = [
  'Bu proje, sıra arası yabancı ot mücadelesinde kimyasal kullanımını azaltmayı ' +
    'hedefleyen otonom bir tarla robotunu konu almaktadır. Sistem, tek kameradan ' +
    'alınan görüntü üzerinde çalışan hafif bir segmentasyon modeli ile bitki ve ' +
    'yabancı otu ayırt etmekte, mekanik çapalama ünitesini buna göre konumlandırmaktadır.',
  'Ceylanpınar\'da iki dekarlık pamuk parselinde yapılan saha denemelerinde tespit ' +
    'doğruluğu %89 olarak ölçülmüştür [1]. Elde edilen sonuçlar, düşük maliyetli ' +
    'donanımla kabul edilebilir başarı elde edilebileceğini göstermektedir.',
  'Projenin çıktısı, küçük ve orta ölçekli işletmelerin erişebileceği fiyat ' +
    'bandında bir tarla robotu prototipidir. Prototip, 2025 vejetasyon döneminde ' +
    'toplam 38 saat saha çalışması ile denenmiş; bu süre boyunca herhangi bir ürün ' +
    'zararı kaydedilmemiştir. Çalışmanın devamında toz koşullarına dayanıklılık ' +
    've farklı bitki türlerine uyarlanabilirlik hedeflenmektedir.',
];

const PROBLEM = [
  'Türkiye\'de pamuk üretiminde yabancı ot mücadelesi ağırlıklı olarak herbisitlerle ' +
    'yapılmaktadır. Bu yöntem hem maliyetli hem de toprak sağlığı açısından ' +
    'sürdürülebilir değildir [2]. GAP bölgesinde birim alan başına düşen herbisit ' +
    'tüketimi ülke ortalamasının üzerindedir [3].',
  'Mekanik çapalama alternatif bir yöntem olmakla birlikte, sıra aralarının dar ' +
    'olduğu koşullarda operatör hatası nedeniyle ürün zararı riski taşımaktadır. ' +
    'Otonom sistemler bu riski azaltabilir ancak mevcut ticari çözümlerin maliyeti ' +
    'küçük işletmeler için erişilebilir değildir [4].',
  'Bölgede yaptığımız ön görüşmelerde, 50-500 dekar arası üretim yapan on iki ' +
    'işletmenin tamamı yabancı ot mücadelesini en yüksek üç maliyet kaleminden biri ' +
    'olarak tanımlamıştır. İşletmelerin dokuzu mekanik çapalamayı denediğini, ancak ' +
    'nitelikli operatör bulamadığı için herbisite geri döndüğünü belirtmiştir.',
  'Problem üç boyutludur: ekonomik (girdi maliyeti), çevresel (toprak ve su ' +
    'kirliliği) ve operasyonel (nitelikli iş gücü eksikliği). Çözümün bu üç boyutu ' +
    'birlikte ele alması gerekmektedir; yalnızca birine odaklanan yaklaşımlar sahada ' +
    'benimsenmemektedir.',
];

const COZUM = [
  'Geliştirdiğimiz sistem, traktör arkasına bağlanan bir aparat üzerinde çalışır. ' +
    'Kamera görüntüsü Jetson Nano üzerinde işlenir ve segmentasyon çıktısına göre ' +
    'çapalama bıçakları servo motorlarla konumlandırılır.',
  'Sistem mimarisi Şekil 3.1\'de verilmiştir. Ortalama çıkarım süresi 42 ms olarak ' +
    'ölçülmüş, bu değer 4 km/sa ilerleme hızında gerçek zamanlı çalışma için yeterli ' +
    'bulunmuştur [5].',
  'Şekil 3.1: Sistem mimarisi ve veri akışı',
  'Çapalama ünitesinin konumlandırılmasında servo motor tabanlı iki eksenli bir '
    + 'mekanizma kullanılmış olup, konum hatası ±4 mm mertebesinde ölçülmüştür. Bu '
    + 'değer, sıra arası mesafenin dar olduğu koşullarda kabul edilebilir sınırdadır.',
  'Sistem üç bağımsız katmandan oluşur: algılama, karar ve eyleme. Algılama '
    + 'katmanı görüntüyü işler, karar katmanı çapalama noktalarını belirler, eyleme '
    + 'katmanı servo komutlarını üretir. Katmanlar arası iletişim ROS 2 üzerinden '
    + 'sağlanmakta, böylece her katman ayrı ayrı test edilebilmektedir.',
  'Güvenlik açısından iki bağımsız durdurma mekanizması bulunmaktadır: yazılımsal '
    + 'sınır denetimi ve fiziksel acil durdurma butonu. Karar katmanı 200 ms içinde '
    + 'yanıt üretemezse sistem otomatik olarak nötr konuma geçer.',
];

const YONTEM = [
  'Veri seti, 2025 vejetasyon döneminde Ceylanpınar\'da farklı gün saatlerinde ' +
    'çekilen 4.200 görüntüden oluşmaktadır. Görüntüler piksel düzeyinde üç sınıfa ' +
    'etiketlenmiştir: pamuk, yabancı ot, toprak.',
  'Model olarak MobileNetV3 omurgalı hafif bir U-Net tercih edilmiştir. Bu tercihin ' +
    'gerekçesi, gömülü donanımda çıkarım süresini 50 ms altında tutma gerekliliğidir ' +
    '[6]. Eğitim 120 epoch sürmüş, doğrulama kümesinde mIoU 0,74 elde edilmiştir.',
  'Doğrulama testleri üç farklı ışık koşulunda tekrarlanmıştır. Tablo 4.1 ölçüm ' +
    'sonuçlarını özetlemektedir.',
  'Tablo 4.1: Farklı ışık koşullarında tespit başarımı',
  'Etiketleme sürecinde iki bağımsız etiketleyici çalışmış, anlaşmazlık durumunda '
    + 'üçüncü bir uzmana başvurulmuştur. Etiketleyiciler arası uyum Cohen kappa '
    + 'katsayısı ile 0,86 olarak ölçülmüştür.',
  'Veri seti eğitim, doğrulama ve test olarak %70-%15-%15 oranında ayrılmıştır. '
    + 'Ayırma işlemi görüntü düzeyinde değil parsel düzeyinde yapılmıştır; aynı '
    + 'parselden gelen görüntülerin farklı kümelere dağılması sonuçları iyimser '
    + 'gösterirdi.',
  'Saha denemeleri üç farklı tarihte, toplam 38 saat sürmüştür. Her denemede '
    + 'robotun geçtiği hat manuel olarak kontrol edilmiş, atlanan ve yanlışlıkla '
    + 'kesilen bitkiler sayılarak kaydedilmiştir.',
];

const YENILIKCI = [
  'Literatürdeki benzer çalışmaların çoğu sıra tespiti için ayrı bir LIDAR ünitesi ' +
    'kullanmaktadır [7]. Bizim yaklaşımımızda sıra bilgisi doğrudan kamera ' +
    'görüntüsünden çıkarılmakta, böylece donanım maliyeti yaklaşık %40 azalmaktadır.',
  'Bu tercihin bir sınırlılığı vardır: yoğun toz koşullarında tespit doğruluğu ' +
    '%72\'ye kadar düşmektedir. Sınırlılık raporun risk bölümünde ele alınmıştır.',
  'İkinci özgün yön, modelin gömülü donanımda çalışacak biçimde küçültülmesidir. ' +
    'Literatürdeki benzer segmentasyon modelleri masaüstü GPU varsayımıyla ' +
    'tasarlanmıştır; sahada elektrik ve soğutma kısıtları bu varsayımı geçersiz kılar.',
  'Üçüncü olarak sistem, mevcut traktörlere sonradan takılabilecek bir aparat ' +
    'olarak tasarlanmıştır. Yeni araç satın alma gerektirmemesi, benimsenme ' +
    'önündeki en büyük engeli ortadan kaldırmaktadır.',
];

const UYGULANABILIRLIK = [
  'Prototip maliyeti 38.400 TL olarak gerçekleşmiştir. Seri üretimde bu rakamın ' +
    '22.000 TL seviyesine ineceği öngörülmektedir. Ceylanpınar Tarım İşletmesi ile ' +
    'pilot uygulama görüşmesi yapılmıştır.',
  'Ticarileşme yolu iki aşamalıdır. İlk aşamada kooperatiflere hizmet modeli ile '
    + 'satış yapılması, ikinci aşamada doğrudan işletmelere cihaz satışına geçilmesi '
    + 'planlanmaktadır. Hizmet modeli, yüksek ilk yatırım bariyerini aşmak için '
    + 'seçilmiştir.',
  'Bakım ve yedek parça ihtiyacı, standart tarım makinaları servis ağı üzerinden '
    + 'karşılanabilecek bileşenlerle sınırlı tutulmuştur. Özel üretim parça oranı '
    + 'toplam maliyetin yüzde on ikisidir.',
];

const MALIYET = [
  'Proje bütçesi üç ana kalemden oluşmaktadır: donanım (24.600 TL), yazılım ' +
    'geliştirme (9.800 TL) ve saha testleri (4.000 TL). Tedarikçi fiyat teklifleri ' +
    'ekte sunulmuştur. Proje takvimi 9 aya yayılmıştır.',
  'İlk üç ay veri toplama ve etiketleme, sonraki üç ay model geliştirme ve '
    + 'donanım entegrasyonu, son üç ay saha testleri ve iyileştirme olarak '
    + 'planlanmıştır. Kritik yol donanım tedarikinden geçmektedir.',
  'Bütçede öngörülemeyen giderler için %10 pay ayrılmıştır. Döviz kuru '
    + 'dalgalanması ithal bileşenlerde risk oluşturduğundan, tedarik siparişleri '
    + 'projenin ilk ayında verilecektir.',
];

const HEDEF_KITLE = [
  'Birincil hedef kitle, GAP bölgesinde 50-500 dekar arası pamuk üreten aile ' +
    'işletmeleridir. İkincil hedef kitle tarımsal hizmet kooperatifleridir.',
  'Şanlıurfa, Diyarbakır ve Mardin illerinde bu ölçekte yaklaşık 14.000 işletme '
    + 'bulunmaktadır. Bu işletmelerin herbisit harcaması dekar başına ortalama 340 '
    + 'TL düzeyindedir.',
  'Dolaylı fayda sağlayacak kesimler arasında tarım işçileri (kimyasal maruziyetinin '
    + 'azalması) ve bölge halkı (yeraltı suyu kalitesi) yer almaktadır. Projenin '
    + 'çevresel etkisi bu nedenle üretici ölçeğinin ötesindedir.',
];

const RISKLER = [
  'Toz koşullarında doğruluk kaybı en önemli teknik risktir. Karşı önlem olarak ' +
    'kameraya basınçlı hava temizleme ünitesi eklenmesi planlanmaktadır [8].',
  'İkinci risk, gömülü donanım tedarik süresidir. Alternatif kart olarak Raspberry ' +
    'Pi 5 + Hailo hızlandırıcı konfigürasyonu değerlendirilmiştir.',
  'Üçüncü risk, farklı bitki türlerine uyarlanabilirliktir. Model yalnızca pamuk '
    + 'için eğitilmiştir; mısır veya ayçiçeği için yeniden etiketleme gerekecektir. '
    + 'Bu risk, transfer öğrenme ile etiketleme yükünü azaltarak yönetilecektir.',
  'Dördüncü risk yasal düzenlemedir. Otonom tarım araçlarına ilişkin mevzuat '
    + 'henüz netleşmemiştir; sistem bu nedenle operatör gözetiminde çalışacak '
    + 'biçimde tasarlanmıştır.',
];

const KAYNAKLAR_TAM = [
  '[1] Yılmaz, A., Demir, K. (2024). Otonom tarla robotlarında görüntü tabanlı ' +
    'yabancı ot tespiti. Tarım Makinaları Bilimi Dergisi, 20(2), 45-58.',
  '[2] Kaya, M. (2023). Herbisit kullanımının toprak mikrobiyotasına etkileri. ' +
    'Toprak Bilimi ve Bitki Besleme Dergisi, 11(1), 12-24.',
  '[3] GAP Bölge Kalkınma İdaresi (2024). GAP Tarımsal Girdi Raporu 2024. Şanlıurfa.',
  '[4] Öztürk, S., Aydın, B. (2022). Precision weeding systems: a cost-benefit ' +
    'analysis. Computers and Electronics in Agriculture, 195, 106-118.',
  '[5] Howard, A. et al. (2019). Searching for MobileNetV3. ICCV 2019, 1314-1324.',
  '[6] Ronneberger, O., Fischer, P., Brox, T. (2015). U-Net: Convolutional networks ' +
    'for biomedical image segmentation. MICCAI 2015, 234-241.',
  '[7] Şahin, E. (2023). LIDAR tabanlı sıra takip sistemleri. Otomasyon Dergisi, 8(3), 77-90.',
  '[8] Doğan, H. (2024). Tarım makinalarında sensör koruma yöntemleri. Ankara: Ziraat Yayınları.',
];

function temelBolumler(): Bolum[] {
  return [
    { baslik: '1. Proje Özeti', paragraflar: OZET },
    { baslik: '2. Problem Durumunun Tanımlanması', paragraflar: PROBLEM },
    { baslik: '3. Çözüm', paragraflar: COZUM },
    { baslik: '4. Yöntem', paragraflar: YONTEM },
    { baslik: '5. Yenilikçi (İnovatif) Yönü', paragraflar: YENILIKCI },
    { baslik: '6. Uygulanabilirlik', paragraflar: UYGULANABILIRLIK },
    { baslik: '7. Tahmini Maliyet ve Proje Zaman Planlaması', paragraflar: MALIYET },
    { baslik: '8. Proje Fikrinin Hedef Kitlesi', paragraflar: HEDEF_KITLE },
    { baslik: '9. Riskler', paragraflar: RISKLER },
    { baslik: '10. Kaynakça', paragraflar: KAYNAKLAR_TAM },
  ];
}

/** Metinden tüm [n] atıflarını söker — "atıf yok" senaryosu için. */
function atiflariSil(bolumler: Bolum[]): Bolum[] {
  return bolumler.map((b) =>
    b.baslik.includes('Kaynakça')
      ? b
      : { ...b, paragraflar: b.paragraflar.map((p) => p.replace(/\s*\[\d+\]/g, '')) },
  );
}

// ------------------------------------------------------------- rapor tanımları

const TANIMLAR: RaporTanimi[] = [
  {
    dosya: '01-temiz.pdf',
    aciklama: 'Tüm kontroller temiz geçmeli — yanlış pozitif kontrolü',
    takim: 'Takım Anadolu', takimId: 'anadolu', kategori: 'tarim', gorsel: 'A',
    proje: 'Otonom Yabancı Ot Temizleme Robotu', yil: 2026,
    bolumler: temelBolumler(),
  },
  {
    dosya: '02-kaynakca-bos.pdf',
    aciklama: 'A1 + kaynakça: başlık var, içerik yok → KAYNAKCA_BOS',
    takim: 'Takım Harran', takimId: 'harran', kategori: 'tarim', gorsel: 'B',
    proje: 'Sera İklim Kontrol Sistemi', yil: 2026,
    bolumler: temelBolumler().map((b) =>
      b.baslik.includes('Kaynakça')
        ? { ...b, paragraflar: ['Yararlandığınız kaynakları akademik künye biçiminde listeleyiniz.'] }
        : b,
    ),
  },
  {
    dosya: '03-kaynakca-atifsiz.pdf',
    aciklama: 'Kaynakça dolu ama metinde tek atıf yok → ATIF_YOK + KAYNAK_ATIFSIZ',
    takim: 'Takım Dicle', takimId: 'dicle', kategori: 'tarim', gorsel: 'B',
    proje: 'Toprak Nem Sensör Ağı', yil: 2026,
    bolumler: atiflariSil(temelBolumler()),
  },
  {
    dosya: '04-atif-karsiliksiz.pdf',
    aciklama: 'Metinde [7] ve [8] var, listede 5 kaynak → ATIF_KARSILIKSIZ',
    takim: 'Takım Fırat', takimId: 'firat', kategori: 'tarim', gorsel: 'B',
    proje: 'Hasat Sonrası Sınıflandırma Bandı', yil: 2026,
    bolumler: temelBolumler().map((b) =>
      b.baslik.includes('Kaynakça') ? { ...b, paragraflar: KAYNAKLAR_TAM.slice(0, 5) } : b,
    ),
  },
  {
    dosya: '05-bolum-doldurulmamis.pdf',
    aciklama: 'A1: "Yenilikçi Yönü" bölümünde şablon yönergesi duruyor → BOLUM_DOLDURULMAMIS',
    takim: 'Takım Ceylanpınar', takimId: 'ceylanpinar', kategori: 'su', gorsel: 'B',
    proje: 'Damla Sulama Optimizasyonu', yil: 2026,
    bolumler: temelBolumler().map((b) =>
      b.baslik.includes('Yenilikçi')
        ? {
            ...b,
            paragraflar: [
              'Projenizin mevcut çözümlerden farkını ve özgün yönlerini açıklayınız.',
              '[Bu alanı doldurunuz]',
            ],
          }
        : b,
    ),
  },
  {
    dosya: '06-eski-sablon.pdf',
    aciklama: 'A4: 2025 şablonu — Riskler bölümü yok → SABLON_ESKI + BASLIK_EKSIK',
    takim: 'Takım Munzur', takimId: 'munzur', kategori: 'tarim', gorsel: 'B',
    proje: 'Arıcılıkta Kovan İzleme Sistemi', yil: 2025,
    bolumler: temelBolumler()
      .filter((b) => !b.baslik.includes('Riskler'))
      .map((b, i) => ({ ...b, baslik: b.baslik.replace(/^\d+\./, `${i + 1}.`) })),
  },
  {
    dosya: '07-taranmis.pdf',
    aciklama: 'B4: metin katmanı yok → PDF_TARANMIS',
    takim: 'Takım Mezopotamya', takimId: 'mezopotamya', kategori: 'enerji',
    proje: 'Güneş Enerjili Sulama Pompası', yil: 2026,
    bolumler: [], taranmis: true,
  },
];

async function main() {
  mkdirSync(CIKTI, { recursive: true });
  console.log(`Sentetik rapor üretiliyor → ${CIKTI}\n`);
  for (const tanim of TANIMLAR) {
    const boyut = await raporYaz(tanim, CIKTI);
    console.log(`  ${tanim.dosya.padEnd(30)} ${(boyut / 1024).toFixed(0).padStart(4)} KB   ${tanim.aciklama}`);
  }
  // Korpus taraması takım ve kategori bilgisine ihtiyaç duyuyor.
  writeFileSync(
    join(CIKTI, 'manifest.json'),
    JSON.stringify(
      TANIMLAR.map((t) => ({
        dosya: t.dosya,
        takim: t.takim,
        takimId: t.takimId,
        proje: t.proje,
        kategori: t.kategori,
        yil: t.yil,
        gorsel: t.gorsel ?? null,
        aciklama: t.aciklama,
      })),
      null,
      2,
    ),
    'utf-8',
  );

  console.log(`\n${TANIMLAR.length} rapor + manifest.json üretildi.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
