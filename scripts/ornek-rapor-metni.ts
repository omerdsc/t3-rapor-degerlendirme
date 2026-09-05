import type { PdfSayfasi } from './ornek-pdf';

/**
 * Örnek raporların GÖVDESİ.
 *
 * ── NİYE AYRI DOSYA ─────────────────────────────────────────────────────
 * Önce tek bir şablon vardı ve her raporda aynı üç paragraf yazıyordu.
 * Paragraflar da kendini ilan ediyordu: "Bu belge TPRDS tanıtım verisi
 * olarak üretilmiştir. Gerçek bir yarışma raporu değildir."
 *
 * Model bunu DOĞRU okudu ve her ölçüte 0–1 verdi: "özet projeye ait değil,
 * belge tanıtım amaçlı". Yani ön değerlendirme ekranı çalışıyordu ama
 * gösterdiği tek şey belgenin boş olduğuydu. Puanlama ekranını boş veriyle
 * tanıtmakla, dolu görünüp içi boş bir belgeyle tanıtmak arasında fark yok —
 * ikisi de ekranı yanlış tanıtıyor.
 *
 * Buradaki metinler bu yüzden gerçek bir öğrenci raporunun taşıdığı şeyi
 * taşıyor: ölçülebilir bir problem, sayılarla yöntem, tarihli iş planı,
 * belirsizliğiyle birlikte bulgu ve sınırlarını söyleyen bir tartışma.
 * Rubriğin on ölçütünün her biri belgede karşılığını buluyor.
 *
 * ── TAKIMLAR HAYALİ, KAYNAKLAR GERÇEK ───────────────────────────────────
 * Projeler ve takımlar uydurma; gerçek yarışmacı belgeleri örnek takımlara
 * iliştirilmiyor. Ama KAYNAKÇA gerçek: sistem kaynakları Crossref ve
 * OpenAlex üzerinden doğruluyor, uydurma bir künye "kaynak doğrulanamadı"
 * uyarısı üretirdi. Tanıtımda görülecek son şey, kendi ürettiğimiz verinin
 * kendi kontrolümüzü düşürmesidir.
 */

export interface RaporIcerigi {
  ozet: string;
  amac: string;
  giris: string;
  yontem: string[];
  isZaman: string[];
  bulgular: string[];
  sonuc: string;
  oneriler: string[];
  kaynaklar: string[];
  ekler: string[];
}

export const ICERIKLER: Record<string, RaporIcerigi> = {
  'Rüzgâr Türbini Verim Optimizasyonu': {
    ozet:
      'Bu çalışma, 3 kW sınıfı yatay eksenli küçük rüzgâr türbinlerinde kanat '
      + 'hücum açısının değişken rüzgâr hızlarında ayarlanmasını ele almaktadır. '
      + 'Sabit açılı kanatlar 4-7 m/s aralığında tasarım noktasının dışında '
      + 'çalışmakta ve güç katsayısı düşmektedir. Geliştirilen pasif eğim '
      + 'mekanizmasıyla aynı rüzgâr rejiminde üretilen enerjinin artırılması '
      + 'hedeflenmiştir. Rüzgâr tüneli ve saha ölçümlerinde referans türbine '
      + 'göre üretimde yüzde 11,4 artış ölçülmüştür.',
    amac:
      'Projenin amacı, düşük rüzgâr hızlarının baskın olduğu iç bölgelerde '
      + 'küçük ölçekli türbinlerin kapasite faktörünü artırmaktır. Ölçülebilir '
      + 'hedef, 4-7 m/s aralığında güç katsayısını referans kanada göre en az '
      + 'yüzde 8 yükseltmek ve bunu 200 saatlik kesintisiz saha çalışmasıyla '
      + 'doğrulamaktır. İkincil hedef, mekanizmanın ek eyleyici ve harici güç '
      + 'gerektirmeden çalışmasıdır.',
    giris:
      'Türkiye\'nin iç bölgelerinde ortalama rüzgâr hızı çoğu noktada 5 m/s '
      + 'civarındadır; oysa ticari küçük türbinlerin çoğu 9-11 m/s tasarım '
      + 'noktasına göre optimize edilmiştir. Bu uyumsuzluk, kurulu gücün büyük '
      + 'bölümünün yılın çoğunda kullanılamaması demektir. Literatürde aktif '
      + 'eğim denetimi bilinen bir çözümdür; ancak eyleyici, redüktör ve sürücü '
      + 'maliyeti küçük türbinlerde toplam maliyetin üçte birini bulmaktadır. Bu '
      + 'çalışma, merkezkaç kuvvetiyle çalışan yaylı bir eğim mekanizmasının aynı '
      + 'kazancın önemli bölümünü maliyetsiz sağlayıp sağlayamayacağını '
      + 'sorgulamaktadır.',
    yontem: [
      'Kanat profili olarak SG6043 seçilmiştir; düşük Reynolds sayılarındaki '
      + 'performansı nedeniyle tercih edilmiştir. Kanat üç kesitte burulmalı '
      + 'tasarlanmış ve PA12 malzemeden SLS yöntemiyle üretilmiştir.',
      'Pasif eğim mekanizması, göbeğe yerleştirilen iki kalibre yay ve karşı '
      + 'ağırlıktan oluşmaktadır. Yay sabiti, 4 m/s ile 12 m/s arasında hücum '
      + 'açısının 4 derece değişmesini verecek biçimde hesaplanmıştır.',
      'Ölçüm düzeneği: 0,6 x 0,6 m kesitli açık çevrimli rüzgâr tüneli, '
      + 'torkmetre (artı eksi 0,1 Nm), optik takometre ve sıcak telli '
      + 'anemometre. Her rüzgâr hızında 60 saniyelik kayıt alınmış, beş tekrar '
      + 'yapılmıştır.',
      'Saha ölçümü Eskişehir\'de 12 m direk üzerinde 200 saat sürmüştür. '
      + 'Referans türbin 8 m uzaklıkta, aynı yükseklikte eş zamanlı '
      + 'çalıştırılmıştır. Veriler 1 Hz\'de kaydedilmiştir.',
      'Belirsizlik analizi GUM yaklaşımıyla yapılmış; güç katsayısı için '
      + 'birleşik standart belirsizlik yüzde 3,2 (k=2) hesaplanmıştır.',
    ],
    isZaman: [
      'Eylul 2025      Literatur taramasi, profil secimi',
      'Ekim 2025       Kanat tasarimi ve CFD dogrulamasi',
      'Kasim 2025      Uretim (SLS), mekanizma montaji',
      'Aralik 2025     Ruzgar tuneli olcumleri, bes tekrar',
      'Ocak-Subat 2026 Saha kurulumu, 200 saat kayit',
      'Mart 2026       Veri analizi, belirsizlik hesabi',
      'Nisan 2026      Rapor yazimi ve sunum hazirligi',
    ],
    bulgular: [
      'Rüzgâr tünelinde referans kanat 5 m/s hızda güç katsayısı 0,29 '
      + 'verirken, eğimli kanat 0,33 ölçülmüştür (yüzde 13,8 artış, '
      + 'belirsizlik artı eksi yüzde 3,2).',
      '9 m/s üzerinde iki kanat arasındaki fark yüzde 2\'nin altına '
      + 'inmektedir; beklendiği gibi kazanç düşük hız bölgesinde '
      + 'yoğunlaşmaktadır.',
      '200 saatlik saha kaydında toplam üretim referans türbinde 41,6 kWh, '
      + 'eğimli türbinde 46,4 kWh olmuştur (yüzde 11,4 artış).',
      'Mekanizmada 200 saat sonunda ölçülebilir aşınma gözlenmemiş, yay '
      + 'sabitindeki değişim yüzde 1\'in altında kalmıştır.',
      'Beklenmeyen bulgu: 13 m/s üzerindeki ani rüzgâr darbelerinde eğim '
      + 'mekanizması aşırı hız korumasına katkı sağlamış, rotor devri '
      + 'referansa göre yüzde 6 düşük kalmıştır.',
    ],
    sonuc:
      'Sonuçlar, pasif eğim mekanizmasının düşük rüzgâr rejiminde anlamlı bir '
      + 'kazanç sağladığını göstermektedir; ölçülen yüzde 11,4 artış, hedeflenen '
      + 'yüzde 8 eşiğinin üzerindedir. Kazancın büyük bölümü 4-7 m/s aralığından '
      + 'gelmekte, yüksek hızlarda mekanizma etkisiz kalmaktadır. Çalışmanın '
      + 'başlıca sınırı, saha ölçümünün tek bir mevsimde ve tek bir sahada '
      + 'yapılmış olmasıdır; türbülans yoğunluğu farklı bir sahada sonucun '
      + 'tekrarlanacağı iddia edilememektedir. İkinci sınır, yay '
      + 'karakteristiğinin sıcaklıkla değişiminin ölçülmemiş olmasıdır.',
    oneriler: [
      'Ölçümün en az üç mevsim ve iki farklı türbülans sınıfında '
      + 'tekrarlanması.',
      'Yay sabitinin eksi 10 ile artı 40 derece arasında karakterize '
      + 'edilmesi.',
      'Aşırı hız korumasına katkının ayrı bir deney düzeneğinde '
      + 'nicelenmesi.',
    ],
    kaynaklar: [
      'Betz, A. (1920). Das Maximum der theoretisch moeglichen Ausnutzung des '
      + 'Windes durch Windmotoren. Zeitschrift fuer das gesamte Turbinenwesen.',
      'IEC 61400-12-1:2017. Wind energy generation systems - Part 12-1: Power '
      + 'performance measurements of electricity producing wind turbines.',
      'JCGM 100:2008. Evaluation of measurement data - Guide to the expression '
      + 'of uncertainty in measurement (GUM).',
      'Selig, M. S. & McGranahan, B. D. (2004). Wind tunnel aerodynamic tests '
      + 'of six airfoils for use on small wind turbines. NREL/SR-500-34515.',
    ],
    ekler: [
      'Ek A - Kanat kesit koordinatlari (3 kesit, 61 nokta)',
      'Ek B - Ruzgar tuneli ham veri tablosu (5 tekrar x 9 hiz)',
      'Ek C - Saha olcum duzenegi yerlesim semasi',
      'Ek D - Belirsizlik butcesi tablosu',
    ],
  },

  'Otonom Depo Robotu': {
    ozet:
      'Bu çalışma, orta ölçekli depolarda raf arası taşıma işini yapan, '
      + 'altyapı değişikliği gerektirmeyen bir otonom robot platformunu '
      + 'sunmaktadır. Yaygın çözümler zemine yapıştırılan bant ya da etiketlere '
      + 'dayanmakta, bu da depo yerleşimi her değiştiğinde yeniden işaretleme '
      + 'maliyeti doğurmaktadır. Geliştirilen platform, iki boyutlu lazer '
      + 'tarayıcı ile tekerlek odometrisini birleştiren bir konumlandırma '
      + 'katmanı kullanmaktadır. 240 görevlik testte görev başarım oranı yüzde '
      + '97,1 ve ortalama konum hatası 4,2 cm ölçülmüştür.',
    amac:
      'Amaç, zemine hiçbir işaret koymadan raf arası taşımayı güvenilir biçimde '
      + 'yapan bir robot geliştirmektir. Ölçülebilir hedefler: görev başarım '
      + 'oranının yüzde 95 üzerinde olması, hedef noktaya konumlanma hatasının '
      + '5 cm altında kalması ve insanla paylaşılan koridorda çarpışmasız '
      + 'çalışma. Maliyet hedefi, ticari muadillerinin beşte biridir.',
    giris:
      'Depo içi taşıma, elektronik ticaretin büyümesiyle birlikte iş gücünün '
      + 'önemli bölümünü tüketen bir işe dönüşmüştür. Otonom taşıma robotları bu '
      + 'yükü azaltmakta, ancak kurulum maliyetinin büyük kısmı robotun '
      + 'kendisinden değil, deponun robota uygun hâle getirilmesinden '
      + 'gelmektedir. Zemin bandı ya da etiket tabanlı sistemlerde her yerleşim '
      + 'değişikliği yeniden işaretleme demektir. Eşzamanlı konumlandırma ve '
      + 'haritalama bu bağımlılığı ortadan kaldırma potansiyeli taşımaktadır; bu '
      + 'çalışma söz konusu potansiyelin düşük maliyetli donanımla ne ölçüde '
      + 'gerçekleştirilebildiğini incelemektedir.',
    yontem: [
      'Platform, 40 kg taşıma kapasiteli diferansiyel sürüşlü bir şasi '
      + 'üzerine kurulmuştur. Tahrik, iki adet 24 V redüktörlü fırçasız motor '
      + 've tur başına 1024 darbe üreten enkoderlerle sağlanmaktadır.',
      'Algılama katmanı: 12 m menzilli, 10 Hz tarama hızlı lazer tarayıcı, '
      + 'dokuz eksenli ataletsel ölçüm birimi ve önde üç adet kızılötesi '
      + 'uçurum sensörü.',
      'Yazılım ROS 2 Humble üzerinde çalışmaktadır. Haritalama için '
      + 'slam_toolbox, konumlandırma için uyarlamalı Monte Carlo '
      + 'konumlandırma, yol planlama için Nav2 yığını kullanılmıştır.',
      'Test protokolü: 18 x 24 m gerçek bir depo alanında, 12 farklı '
      + 'başlangıç-hedef çifti, her biri 20 kez tekrarlanmıştır (240 görev). '
      + 'Görevlerin üçte birinde koridorda yürüyen bir kişi bulunmuştur.',
      'Konum hatası, hedef noktaya yerleştirilen referans işaretine göre '
      + 'toplam istasyonla ölçülmüştür (ölçüm belirsizliği artı eksi 0,5 cm).',
    ],
    isZaman: [
      'Eylul 2025      Gereksinim analizi, depo saha ziyareti',
      'Ekim 2025       Sasi tasarimi ve imalati',
      'Kasim 2025      Guc ve tahrik sistemi entegrasyonu',
      'Aralik 2025     ROS 2 yazilim katmani, haritalama kurulumu',
      'Ocak 2026       Kapali alan testleri, parametre ayari',
      'Subat 2026      240 gorevlik saha testi',
      'Mart 2026       Veri analizi ve rapor yazimi',
    ],
    bulgular: [
      '240 görevin 233 tanesi başarıyla tamamlanmıştır (yüzde 97,1). '
      + 'Başarısız 7 görevin 5 tanesi aynı koridorda, cam yüzeyli bir bölmenin '
      + 'lazer tarayıcı tarafından görülememesinden kaynaklanmıştır.',
      'Ortalama konum hatası 4,2 cm, standart sapma 1,8 cm, en kötü durum '
      + '9,1 cm ölçülmüştür. Hedeflenen 5 cm eşiği ortalamada sağlanmaktadır.',
      'İnsan bulunan görevlerde ortalama tamamlama süresi yüzde 18 uzamış, '
      + 'ancak çarpışma yaşanmamıştır.',
      'Ortalama enerji tüketimi görev başına 8,4 Wh olup, tek şarjla yaklaşık '
      + '95 görev tamamlanabilmektedir.',
      'Malzeme maliyeti 21.400 TL olarak gerçekleşmiş, hedeflenen bütçe '
      + 'içinde kalınmıştır.',
    ],
    sonuc:
      'Sonuçlar, zemin işareti olmadan raf arası taşımanın düşük maliyetli '
      + 'donanımla mümkün olduğunu göstermektedir. Hedeflenen yüzde 95 başarım '
      + 'eşiği aşılmış, konum hatası ortalamada hedefin altında kalmıştır. En '
      + 'belirgin zayıflık, lazer tarayıcının saydam yüzeyleri görememesidir; '
      + 'başarısızlıkların çoğu tek bir bu nedene bağlanmaktadır. Çalışmanın '
      + 'sınırı, testin tek bir depoda ve sabit aydınlatma koşullarında yapılmış '
      + 'olmasıdır. Ayrıca 40 kg üzeri yüklerde fren mesafesi ölçülmemiştir.',
    oneriler: [
      'Saydam yüzey sorunu için ultrasonik sensör katmanı eklenmesi ve aynı '
      + 'koridorda ölçümün yinelenmesi.',
      'Testin en az üç farklı depo yerleşiminde tekrarlanması.',
      'Tam yükte fren mesafesi ve devrilme sınırının ölçülmesi.',
      'Çoklu robot durumunda koridor paylaşımının incelenmesi.',
    ],
    kaynaklar: [
      'Macenski, S., Foote, T., Gerkey, B., Lalancette, C. & Woodall, W. '
      + '(2022). Robot Operating System 2: Design, architecture, and uses in '
      + 'the wild. Science Robotics, 7(66).',
      'Macenski, S. & Jambrecic, I. (2021). SLAM Toolbox: SLAM for the '
      + 'dynamic world. Journal of Open Source Software, 6(61), 2783.',
      'Fox, D., Burgard, W. & Thrun, S. (1999). Monte Carlo localization for '
      + 'mobile robots. Proceedings of IEEE ICRA.',
      'ISO 3691-4:2020. Industrial trucks - Safety requirements and '
      + 'verification - Part 4: Driverless industrial trucks.',
      /*
       * BU KÜNYE KASTEN UYDURMA.
       *
       * Böyle bir dergi ve böyle bir makale yok. Örnek veride bilerek
       * duruyor: kaynakça denetim ajanının çözdüğü problem tam olarak
       * budur ve bir tespit yeteneği, tespit edilecek bir şey olmadan
       * gösterilemez. Öteki dört künye gerçek ve doğrulanabilir; ekranda
       * ikisinin yan yana durması, ajanın ayrımı gerçekten yaptığını
       * gösteriyor — hepsine "şüpheli" diyen bir sistem de bütün uydurma
       * künyeleri yakalardı.
       *
       * Künye gerçeğe benziyor: yazar adları Türkçe, yıl güncel, cilt ve
       * sayfa aralığı yerinde. Biçime bakan hiçbir kontrol bunu
       * ayıklayamaz; ayıklayan şey, yayının GERÇEKTEN VAR OLUP
       * OLMADIĞINI araştırmak.
       */
      'Karaca, M., Yildirim, S. & Öztürk, B. (2024). Marker-free indoor '
      + 'localization for warehouse robots using adaptive scan matching. '
      + 'International Journal of Warehouse Automation, 9(2), 114-131.',
    ],
    ekler: [
      'Ek A - Sasi teknik resmi ve olculer',
      'Ek B - 240 gorevlik test kaydi ozet tablosu',
      'Ek C - Depo yerlesim plani ve test noktalari',
      'Ek D - Malzeme listesi ve birim maliyetler',
    ],
  },

  'Tarımsal İHA Sürü Kontrolü': {
    ozet:
      'Bu çalışma, tarımsal ilaçlamada tek bir insansız hava aracı yerine '
      + 'birbiriyle eşgüdümlü çalışan üç araçlık bir sürünün kullanılmasını '
      + 'incelemektedir. Tek araçla ilaçlamada tarla büyüdükçe batarya '
      + 'değişimleri toplam sürenin belirleyicisi hâline gelmektedir. '
      + 'Geliştirilen dağıtık görev paylaşım algoritması, tarlayı uçuş sırasında '
      + 'yeniden bölerek araçlardan biri devre dışı kaldığında görevin sürmesini '
      + 'sağlamaktadır. 14 hektarlık alanda yapılan ölçümde toplam ilaçlama '
      + 'süresi tek araca göre yüzde 58 kısalmıştır.',
    amac:
      'Amaç, orta ölçekli tarlalarda ilaçlama süresini kısaltan ve araç '
      + 'arızasına dayanıklı bir sürü denetim yöntemi geliştirmektir. Ölçülebilir '
      + 'hedefler: üç araçla toplam sürenin tek araca göre en az yüzde 50 '
      + 'kısalması, kaplama örtüşmesinin yüzde 10 altında kalması ve bir araç '
      + 'devre dışı kaldığında görevin insan müdahalesi olmadan tamamlanması.',
    giris:
      'Tarımsal ilaçlamada insansız hava araçları, sırt pompasına göre hem süreyi '
      + 'hem de operatörün kimyasala maruziyetini azaltmaktadır. Ancak tek araçlı '
      + 'çalışmada uçuş süresi bataryayla sınırlıdır ve 10 hektarın üzerindeki '
      + 'tarlalarda batarya değişimi toplam sürenin yarısından fazlasını '
      + 'tüketebilmektedir. Çoklu araç kullanımı bu sorunu doğrudan ele almakta, '
      + 'ancak görev paylaşımı merkezî bir sunucuya bağlandığında haberleşme '
      + 'kesintisi bütün sürüyü durdurmaktadır. Bu çalışma, araçlar arası '
      + 'doğrudan haberleşmeye dayanan dağıtık bir paylaşım yönteminin saha '
      + 'koşullarında ne ölçüde çalıştığını sınamaktadır.',
    yontem: [
      'Her araç altı rotorlu, 10 L tank kapasiteli ve 16.000 mAh bataryalıdır. '
      + 'Uçuş denetleyicisi olarak Pixhawk 6C, yer bağlantısı için 915 MHz '
      + 'telemetri modülü kullanılmıştır.',
      'Görev paylaşımı, Voronoi bölütlemesine dayanan dağıtık bir algoritma '
      + 'ile yapılmaktadır. Her araç kendi bölgesinin sınırını komşularından '
      + 'aldığı konum bilgisiyle 2 Hz\'de yeniden hesaplamaktadır.',
      'Araç devre dışı kaldığında bölgesi, komşu araçların kalan batarya '
      + 'oranına göre ağırlıklandırılarak paylaştırılmaktadır. Merkezî sunucu '
      + 'bulunmamaktadır.',
      'Kaplama ölçümü: tarlaya 5 m aralıklı ızgarada 120 adet suya duyarlı '
      + 'kâğıt yerleştirilmiş, uçuş sonrası görüntü işleme ile damla '
      + 'yoğunluğu hesaplanmıştır.',
      'Testler 14 hektarlık mısır tarlasında, rüzgâr hızı 3 m/s altındayken '
      + 'yapılmıştır. Her senaryo dört kez tekrarlanmıştır.',
    ],
    isZaman: [
      'Eylul 2025      Literatur taramasi, algoritma secimi',
      'Ekim 2025       Benzetim ortaminda algoritma gelistirme',
      'Kasim 2025      Arac montaji ve tekil ucus testleri',
      'Aralik 2025     Haberlesme katmani ve suru testleri',
      'Ocak 2026       Kontrollu alanda ariza senaryolari',
      'Subat 2026      14 hektarlik tarla olcumleri',
      'Mart 2026       Kaplama analizi ve rapor yazimi',
    ],
    bulgular: [
      'Tek araçla 14 hektar 3 saat 42 dakikada tamamlanmış; üç araçlı sürüde '
      + 'süre 1 saat 33 dakikaya inmiştir (yüzde 58 kısalma).',
      'Ortalama kaplama örtüşmesi yüzde 7,3 ölçülmüştür; hedeflenen yüzde 10 '
      + 'eşiğinin altındadır.',
      'Suya duyarlı kâğıt ölçümünde ortalama damla yoğunluğu santimetrekare '
      + 'başına 32 damla, değişkenlik katsayısı yüzde 14 bulunmuştur.',
      'Araç devre dışı bırakma senaryosunun dört tekrarının dördünde de görev '
      + 'insan müdahalesi olmadan tamamlanmıştır. Yeniden paylaşım ortalama '
      + '2,8 saniyede bitmiştir.',
      'Haberleşme menzili tarla koşullarında 480 m ölçülmüş, bu değer 14 '
      + 'hektarlık alan için yeterli kalmıştır.',
    ],
    sonuc:
      'Bulgular, dağıtık görev paylaşımının hem süreyi kısalttığını hem de araç '
      + 'arızasına karşı dayanıklılık sağladığını göstermektedir. Hedeflenen üç '
      + 'ölçütün üçü de karşılanmıştır. Çalışmanın en önemli sınırı, testlerin '
      + 'düşük rüzgârlı günlerde yapılmış olmasıdır; 5 m/s üzerindeki rüzgârda '
      + 'sürüklenmenin kaplama değişkenliğini nasıl etkilediği ölçülmemiştir. '
      + 'İkinci sınır, üç aracın ötesinde ölçeklenmenin sınanmamış olmasıdır; '
      + 'haberleşme yükünün araç sayısıyla nasıl arttığı yalnızca benzetimde '
      + 'incelenmiştir.',
    oneriler: [
      'Ölçümlerin 5-8 m/s rüzgâr aralığında tekrarlanması ve sürüklenme '
      + 'modelinin doğrulanması.',
      'Sürü boyutunun altı ve dokuz araca çıkarılarak haberleşme yükünün '
      + 'sahada ölçülmesi.',
      'Tank seviyesinin görev paylaşımına girdi olarak eklenmesi.',
      'Farklı ürün ve bitki boyu koşullarında kaplama ölçümünün yinelenmesi.',
    ],
    kaynaklar: [
      'Reynolds, C. W. (1987). Flocks, herds and schools: A distributed '
      + 'behavioral model. ACM SIGGRAPH Computer Graphics, 21(4), 25-34.',
      'Vasarhelyi, G., Viragh, C., Somorjai, G., Nepusz, T., Eiben, A. E. & '
      + 'Vicsek, T. (2018). Optimized flocking of autonomous drones in '
      + 'confined environments. Science Robotics, 3(20).',
      'Cortes, J., Martinez, S., Karatas, T. & Bullo, F. (2004). Coverage '
      + 'control for mobile sensing networks. IEEE Transactions on Robotics '
      + 'and Automation, 20(2), 243-255.',
      'ISO 16119-1:2013. Agricultural and forestry machinery - Environmental '
      + 'requirements for sprayers - Part 1: General.',
    ],
    ekler: [
      'Ek A - Algoritma sozde kodu ve akis semasi',
      'Ek B - Suya duyarli kagit olcum izgarasi ve sonuclari',
      'Ek C - Ariza senaryosu ucus izleri (4 tekrar)',
      'Ek D - Arac teknik ozellikleri tablosu',
    ],
  },
};

/** Proje adı eşleşmezse kullanılan gövde. */
const YEDEK: RaporIcerigi = ICERIKLER['Otonom Depo Robotu'];

/**
 * İçeriği rubriğin bölüm sırasına göre sayfalara çevirir.
 *
 * Bölüm başlıkları rubrikteki ölçüt adlarıyla AYNI: hakem panelinde
 * "Yöntem" ölçütüne puan verirken belgede de "4. YÖNTEM" başlığını arıyor.
 * Başlıklar tutmazsa hem hakem hem de şablon uyum kontrolü bölümü
 * bulamıyor.
 */
export function raporSayfalari(
  proje: string,
  takim: string,
  basvuruNo: string,
): PdfSayfasi[] {
  const i = ICERIKLER[proje] ?? YEDEK;
  return [
    {
      baslik: proje,
      satirlar: [
        `Takim: ${takim}`,
        `Basvuru No: ${basvuruNo}`,
        'TEKNOFEST 2026 - Detayli Tasarim Raporu',
        '',
        '1. OZET',
        i.ozet,
        '',
        '2. AMAC',
        i.amac,
        '',
        '3. GIRIS',
        i.giris,
      ],
    },
    {
      baslik: `${proje} - Yontem ve Is Plani`,
      satirlar: [
        '4. YONTEM',
        ...i.yontem,
        '',
        '5. PROJE IS-ZAMAN CIZELGESI',
        ...i.isZaman,
      ],
    },
    {
      baslik: `${proje} - Bulgular ve Sonuc`,
      satirlar: [
        '6. BULGULAR',
        ...i.bulgular,
        '',
        '7. SONUC VE TARTISMA',
        i.sonuc,
        '',
        '8. ONERILER',
        ...i.oneriler,
      ],
    },
    {
      baslik: `${proje} - Kaynakca ve Ekler`,
      satirlar: [
        '9. KAYNAKLAR',
        ...i.kaynaklar,
        '',
        '10. EKLER',
        ...i.ekler,
      ],
    },
  ];
}
