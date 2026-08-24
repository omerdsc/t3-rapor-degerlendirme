# 4. GÖZ — Yapay Zekâ Destekli Değerlendirme Sistemi

T3 Vakfı Bursiyer Yapay Zekâ Creathonu · **Problem 4**
TEKNOFEST Yarışmalar Koordinatörlüğü için hakem karar destek sistemi.

> **Yapay zekâ nihai karar verici değildir.** Sistem hakeme kontrol, analiz
> ve ön değerlendirme sunar; puanı hakem verir. Bu bir slogan değil, kodda
> uygulanan bir kısıt — hakem puanı girilmeden rapor tamamlanamaz.

---

## Ne yapıyor

TEKNOFEST'e her yıl on binlerce proje raporu geliyor. Her yarışmanın kendi
şablonu, kendi şartnamesi, kendi puanlama ölçütleri var. Hakem bir raporu
açtığında önce mekanik soruların cevabını arıyor: şablona uymuş mu, bölümler
tam mı, kaynakça gerçek mi, başka bir rapordan kopya mı?

4. Göz bu soruları hakem açmadan yanıtlıyor ve **kanıtıyla** sunuyor.

```
rapor yüklenir
  │
  ├─ otomatik kontroller  ($0, saniyeler)     → dil, şablon, başlık,
  │                                              kaynakça, kaynak doğrulama,
  │                                              içerik uygunluğu, kopya
  │
  ├─ KOORDİNASYON ön değerlendirmeyi başlatır → ölçüt bazında puan ÖNERİSİ,
  │  ($0,18 · isteğe bağlı)                      alıntı ve gerekçeyle
  │                                              — puan değil, öneri
  ├─ KOORDİNASYON raporu hakemlere atar       → en az yüklü hakem önce
  │                                              (bir rapora 1–3 hakem)
  ├─ HAKEM kendi panelinde puanlar            → takım adı rumuzlu,
  │                                              kör puanlama
  └─ nihai puan = tamamlanmış hakem
     değerlendirmelerinin ORTALAMASI          → hakemler arası fark
       └─ YARIŞMACI sonucunu görür               ayrıca bildiriliyor
```

**Puanı kim verir:** hakem. Koordinasyon ön değerlendirmeyi başlatır (ücretli
adım, bütçe kararı onun) ve sonuçları izler — puan girmez. Ekranlarda da
böyle: koordinasyon portalında puanlama formu yok.

---

## Üç portal, üç ayrı erişim

Rol ayrımı menüyle değil **erişimle** yapılıyor. Her portalın kendi düzeni
var ve aralarında gezinme bağlantısı yok.

| Portal | Adres | Kim girer | Ne görür |
|---|---|---|---|
| **Koordinasyon** | `/koordinasyon` | Yarışmalar Koordinatörlüğü | Yarışma kurulumu, hakem kaydı, atama, sonuçlar, kopya taraması. **Puan girmez** |
| **Hakem** | `/hakem/<kod>` | Değerlendirici | **Yalnızca kendisine atanmış** raporlar. Takım adları rumuzlu; öteki hakemlerin puanı ve nihai puan görünmez |
| **Yarışmacı** | `/sonuc` | Başvuru sahibi | Yalnızca kendi sonucu, hakem tamamladıysa. Yapay zekâ puanı hiç gösterilmez |

Kökteki `/` yalnızca geliştirme kolaylığı: tek uygulamada üç portalı ayrı
alan adına koymak mümkün olmadığı için ayrım adres önekiyle yapıldı.
Kurumsal kurulumda o kapı kalkar, yerini üç ayrı adres ve kurum kimlik
doğrulaması alır.

### Erişim denetimi

| Portal | Nasıl giriyor | Neyi koruyor |
|---|---|---|
| Koordinasyon | `KOORDINASYON_ANAHTARI` — ortak anahtar, HttpOnly çerez | Bütün koordinasyon ekranları ve 17 API rotası |
| Hakem | Kendi erişim kodu (`/hakem/<kod>`) | Yalnızca kendisine atanmış raporlar |
| Yarışmacı | Başvuru numarası | Yalnızca kendi sonucu, hakem tamamladıysa |

Denetim **iki katmanda**: `proxy.ts` perimetre olarak yetkisiz kullanıcıyı
giriş sayfasına yönlendiriyor, ama gerçek karar her rotanın içinde
(`kapi()`). Next belgeleri bunu açıkça uyarıyor — matcher değişikliği veya
bir rotanın taşınması proxy kapsamını sessizce kaldırabilir.

Hakem tarafında da aynı çift katman: atanmamış hakem adres satırına rapor
kimliği yazarsa 404 alır, API'ye puan gönderirse 403 alır. Yetki denetimi
her doğrulamadan ÖNCE — reddedilen istek bile bilgi sızdırmasın diye.
Rapor belgesi ucu (`/api/rapor/<id>/dosya`) iki kapılı: koordinasyon
anahtarı **ya da** `?kod=` ile atanmış hakem. Buradan inen dosyalar gerçek
yarışmacı belgeleri; ekranda kimlik maskelemek, belgenin kendisi
korunmuyorsa anlamsız kalır.

**Anahtar tanımlı değilse sistem açık çalışıyor** ve her koordinasyon
ekranında kapatılamayan bir uyarı şeridi bunu söylüyor. Kapalı kurmak,
anahtarı bilmeyenin projeyi hiç çalıştıramaması olurdu; eksikliği gizlemek
yerine göstermek tercih edildi.

Hakem panele iki yoldan girer: giriş sayfasındaki kod kutusundan, ya da
koordinasyonun ilettiği `/hakem/<kod>` bağlantısından. Koordinasyon hakem
listesindeki **Aç ↗** ile o panelin hakem tarafından nasıl göründüğünü
kontrol edebilir.

---

## Kurulum

```bash
npm install
cp .env.ornek .env.local        # ANTHROPIC_API_KEY (yalnızca AI adımı için)
                                # KOORDINASYON_ANAHTARI (boşsa panel açık kalır)
npm run dev                     # http://localhost:3000
```

Yarışma listesini teknofest.org'dan çekmek için:

```bash
npm run katalog                 # 60 yarışma, 260 belge — ücretsiz
```

Sonra arayüzden **Yarışmalar → Kur** deyin. Şablon ve şartname indirilir,
değerlendirme ölçütleri çıkarılır.

---

## Ölçülmüş durum

| | |
|---|---|
| Katalogdaki yarışma | **60** |
| Kurulu yarışma / kategori | **43 / 80** |
| Şartnamesi bağlı kategori | **70** |
| Şartnameden çıkarılan terim profili | **70** |
| Şablondan rubrik çıkarılan kategori | **74 / 81** |
| Rapor başına yapay zekâ maliyeti | **$0,18** |
| Otomatik kontrollerin maliyeti | **$0** |
| Birim testi | **101** |
| Uçtan uca vaka | **31** |
| 3000 raporda liste ekranı | **179 ms** |
| 6000 atama yazma | **0,90 sn** |

Kanıt için: `npx tsx scripts/kanit-topla.ts` — bu tablonun kaynağı odur,
elle yazılmaz.

PRD'nin madde madde karşılığı — PRD'nin kendi yapısıyla, yan yana
okunabilsin diye: **[docs/prd-karsiligi.md](docs/prd-karsiligi.md)**

---

## Mimari kararlar

### Ücretli ile ücretsiz katman kesin ayrı
Dil tespiti, şablon eşleştirme, başlık kontrolü, kaynakça analizi, kaynak
doğrulama, içerik uygunluğu ve kopya taraması **saf kod**. Dil modeli
yalnızca ölçüt bazlı ön değerlendirmede ve şartname özetinde çalışıyor.

Bu ayrım tasarımı belirledi: 60 yarışmalık katalog aktarımı da, 80 kategorinin
kurulumu da, kopya taraması da $0 olduğu için sınırsız çalıştırılabiliyor.

### Maliyet iki katmanla korunuyor
Disk önbelleği aynı raporu ikinci kez ücretlendirmiyor; bütçe tavanı aşılırsa
istek atılmıyor. Şartname özeti kategori başına bir kez üretilip kalıcı
saklanıyor — aynı şartnameyi paylaşan kategorilere ücretsiz kopyalanıyor.

### Türkçe metin onarımı zorunlu
Gerçek PDF'lerde font kodlaması yüzünden "ş→þ", "İ→Ý" gibi bozulmalar
oluyor. Onarılmazsa hiçbir başlık eşleşmiyor ve bütün raporlar birbirine
benzer çıkıyor. `normalize.ts` mojibake, ayrık aksan ve ligatürleri
düzeltiyor; karşılaştırmalar i/ı ayrımını kaldıran `anahtar()` üzerinden
yapılıyor.

> JS regex Türkçe'de sessizce başarısız oluyor: `/kategori/i` deseni
> "KATEGORİSİ" ile eşleşmez, `\bYarışması\b` hiç eşleşmez. Bu tuzağa dört
> kez düşüldü; ayrıntısı `docs/gercek-dunya-sorunlari.md` §F7.

### Kimlik maskeleme ve kör puanlama
Hakem ekranında takım adı rumuzla görünüyor (`Takım 8EM8 · R-WKT4`). İki
gerekçe: kişisel veri ekranda tutulmuyor ve hakem "geçen yıl finale kalan
ekip" bilgisinden etkilenmiyor. Arama gerçek veriyle **sunucuda** çalışıyor;
gerçek adlar istemciye hiç inmiyor.

### Türetilmiş değerin tek yazıcısı olur
Nihai puan türetilmiş bir değer: tamamlanmış hakem değerlendirmelerinin
ortalaması. Rapor listeleri bunu her satır için hesaplayamayacağı (200 rapor
= 200 ek sorgu) için kolonda önbelleklenmiş halde duruyor. Önbellek bir kez
ayrıştı ve **aynı rapor listede 75,5, detay sayfasında 71,8 puan gösterdi** —
kolona eski koordinasyon formu yazıyordu, hakem puanı kaydedilince kolon hiç
güncellenmiyordu.

Kural artık tek: `nihai_puan` kolonuna yalnızca `nihaiPuaniYaz()` yazar ve
değerlendirme durumunu değiştiren her işlemin sonunda çağrılır. Hesabın
kendisi `nihai-hesap.ts` içinde, veritabanından bağımsız ve test kapsamında.
`npm run db:onar` kolonu kayıtlardan yeniden yazar.

Aynı ilke dağıtımda da: `dagitim.ts` hem sunucunun atama yaptığı hem
arayüzün önizleme gösterdiği tek fonksiyon. İki kopya olsaydı kullanıcının
basmadan önce gördüğü sayı sunucunun yaptığından sapardı.

### Yarışmacıya giden her cümle hakem onayından geçiyor
Güçlü yönler, gelişime açık alanlar ve öneriler yapay zekâ tarafından
üretiliyor ama **doğrudan yayımlanmıyor**. Hakem panelinde üçü de dolu
geliyor; hakem düzeltiyor, siliyor, ekliyor ve tamamlayınca onaylamış
oluyor. Onaylanmamış hiçbir cümle yarışmacıya gitmiyor.

Eskiden bu metinler model çıktısından doğrudan basılıyordu. Puanı hakemden
alıp metni modelden almak tutarsızdı: yarışmacı için geri bildirim de bir
karardır ve sahibi olmalı. PRD'nin madde 06 sırası da bunu istiyor —
"hakeme sunulur; sonuçlardan ... üretilir".

`npm run denetim` bu kuralı ölçüyor: modelin ürettiği metinler sayfada
aranıp hakem onaylılarıyla karşılaştırılıyor.

### Ölçülmeyen iddia, iddia değildir
"Hacimde çalışıyor", "yapay zekâ puanı yarışmacıya gitmiyor", "dağıtım
dengeli" — hepsi bir zamanlar yalnızca belgede yazan cümlelerdi ve üçü de
kısmen yanlıştı. Her biri artık bir komut: `hacim`, `denetim`, `duman`,
`db:kontrol`. Ölçüm bu projede **sekiz gerçek hata** buldu; hiçbiri tip
denetiminden ya da birim testlerinden geçmiyordu.

### Çıkarım taslaktır, insan onaylar
Şablondan çıkarılan her ölçüt "onaylanmadı" olarak işaretli. Yönetici
gözden geçirip onaylıyor, düzeltiyor ya da kendi ölçütünü ekliyor. Şablon
güncellemesi onayı sıfırlıyor — yeni ölçütler görülmedi çünkü.

---

## Öne çıkan çözümler

**Kopya tespitinde Jaccard yetmiyor.** İki bölümü kopyalanmış bir raporda
Jaccard %16 çıkıyor ve eşiğin altında kalıyor; kapsama oranı (`kesişim /
küçük belge`) %31 veriyor ve yakalıyor. Test korpusundaki kısmi kopya bu
farkla tespit edildi.

**Sabit benzerlik eşiği çalışmıyor.** Aynı kategorideki raporlar zaten ortak
terminoloji taşıyor. Her kategorinin kendi taban benzerliği ölçülüp eşik
buna göre belirleniyor.

**Aynı takımın devam projesi intihal değil.** Takım kimliği eşleşen çiftler
ayrı ve nötr işaretleniyor.

**Şekiller okunuyor.** Akış şemasını görsel olarak çizen rapor
cezalandırılmıyor; şekiller ayıklanıp modele ayrıca veriliyor. Örnek raporda
"Akış Şeması" ölçütü 2/5'ten 5/5'e çıktı.

**Uydurma kaynak tespiti.** Kaynak başlıkları Crossref ve OpenAlex'te
aranıyor. Yerel yayınların bulunamaması sahtelik sayılmıyor — güveni
düşürülüp not ediliyor.

**Puan ağırlığı olmayan şablonlar.** 81 kategorinin 37'sinde şablon ağırlık
vermiyor. Eşit ağırlıklı taslak üretilip **uyarıyla** bildiriliyor; uydurma
ağırlıkla eşit ağırlık arasındaki fark, eşit ağırlığın yanlış olduğunu
kendisinin söylemesi.

---

## Yapı

```
src/lib/analiz/     ücretsiz katman
  normalize.ts        Türkçe metin onarımı — her şeyin temeli
  pdf.ts, belge-docx.ts  PDF ve Word ayrıştırma
  yapi.ts             satır birleştirme, başlık tespiti
  dil.ts              dil tespiti
  sablon.ts           şablon ve bölüm uygunluğu
  sablon-cikar.ts     şablondan ölçüt çıkarımı
  kaynakca.ts         kaynakça derinliği
  kaynak-dogrula.ts   Crossref + OpenAlex doğrulaması
  kategori.ts         içerik uygunluğu (TF-IDF)
  terim-cikar.ts      şartnameden terim profili
  benzerlik.ts        MinHash + kapsama + cümle eşleştirme
  phash.ts            algısal görsel karşılaştırma
  kimlik.ts           rapor kapağından künye okuma
  sartname.ts         şartname çözümleme
  takvim.ts           aşama–tarih eşlemesi

src/lib/ai/         ücretli katman
  istemci.ts          önbellek + bütçe tavanı
  degerlendirme.ts    ölçüt bazlı ön değerlendirme
  sartname-ozeti.ts   şartname özeti (kategori başına bir kez)

src/lib/katalog/    teknofest.org kataloğu

src/lib/db/         SQLite + hakem/atama/değerlendirme
  baglanti.ts         bağlantı, şema, WAL, yabancı anahtarlar
  hakem-depo.ts       sorgular — hesap YOK, yalnızca veri erişimi
  nihai-hesap.ts      puan ortalamaları · SAF, test kapsamında
  dagitim.ts          rapor–hakem dağıtımı · SAF, sunucu ve arayüz aynısını çağırır
  gecis.ts            JSON → SQLite göçü

src/lib/depo/       veri katmanı, maskeleme, arama, dışa aktarma

src/app/
  page.tsx          portal seçimi (geliştirme kolaylığı)
  koordinasyon/     Panel · Raporlar · Kopya Kontrolü · Hakemler · Yarışmalar
  hakem/[kod]/      hakemin kendi paneli — yalnızca atanmış raporlar
  sonuc/            yarışmacı portalı
```

---

## Doğrulama

```bash
npm test                 # 101 birim testi, ~0,8 sn
npm run duman            # 31 uçtan uca vaka — bütün ekranlar ve yetki sınırları
npm run db:kontrol       # 11 veri tutarlılığı sorgusu
npm run denetim          # yarışmacı sayfası sızıntı denetimi
npm run hacim -- 3000    # performans ölçümü
npm run demo             # üç PRD akışını yürünebilir hâle getir
npm run db:onar          # nihai puan kolonunu kayıtlardan yeniden yaz
npx tsx scripts/kanit-topla.ts          # ölçülmüş durum tablosu
npx tsx scripts/ornek-rapor-uret.ts     # 7 sentetik fikstür (her biri bir kusur)
npx tsx scripts/analiz-et.ts            # hepsini analiz et
npx tsx scripts/korpus-uret.ts          # 5 raporluk benzerlik korpusu
npx tsx scripts/korpus-tara.ts          # kopya taraması
npx tsx scripts/kimlik-test.ts          # kapak künyesi çıkarımı
npm run katalog:dogrula                 # 81 şablonu indirip çözümle
```

Test korpusundaki üç kurgu vaka — görsel kopya, kısmi metin kopyası, aynı
takımın devam projesi — üçü de doğru sınıflandırıldı.

### Ölçüm, iddia etmekten daha çok hata buluyor

Bu projede tip denetimi, birim testleri ve derleme temiz geçerken **ekranı
gerçekte kırık** olan durumlar çıktı. Bu yüzden her iddianın bir komutu
var. Bulunanlar:

1. **Bölümleri ayrıştırılamayan rapor kopya taramasından sessizce
   düşüyordu.** `ozgunMetin()` yalnızca tanınan bölümler üzerinden
   çalışıyordu; başlıkları okunamayan raporda parmak izi boş kalıyor, ama
   "parmak izi var" sayıldığı için uyarı da verilmiyordu. Şablona uymayan
   rapor tam da kontrole en çok ihtiyaç duyulan rapor olabilir. Artık tam
   metne düşülüyor.

2. **cp1254 metin onarımı hiç çalışmıyordu.** Koruma koşulu ç/ö/ü'yü
   "belge düzgün okunmuş" kanıtı sayıyordu; oysa bu harfler iki kod
   sayfasında aynı bayta düşüyor ve bozulmadan geçiyor. "Ýçindekiler" hem
   bozuk Ý hem sağlam ç taşıdığı için onarım devreye girmiyordu.

3. **Nihai puan iki ekranda farklı görünüyordu.** Yukarıda anlatılan
   önbellek ayrışması; ölçülerek bulundu, `nihai-hesap.ts` testleriyle
   kilitlendi.

4. **Yarışmacı portalı her kriteri 0 gösteriyordu.** Tek hakemli modelden
   çok hakemli modele geçişte `rapor.hakemPuanlari` alanı boş kaldı; toplam
   puan doğru, kriter kırılımı tamamen sıfırdı. Kırılım da hakem
   kayıtlarından türetiliyor artık.

5. **Hakem paneline girilemiyordu.** Giriş kutusu koddaki tireyi atıyordu
   (`7KSN-NTBD` → `7KSNNTBD`), sunucu tam eşitlik arıyordu: kodunu DOĞRU
   yazan hakem 404 alıyordu. Normalleştirme tek yerde toplandı, 7 test.

6. **Arşiv kaydı panele girebiliyordu.** Aramayı düzeltmek, kaza ile
   kapanmış bir kapıyı açtı: giriş "kim giriş yapabilir" sorusunu hiç
   sormuyordu. `hakem.sistem` alanı eklendi (şema sürüm 2).

7. **Rapor listesi 1000 raporda 24 saniye sürüyordu.** Sorgu 56 ms, ama
   HTML 8,7 MB ve 6003 SVG. `npm run hacim` bunu ve üç N+1 sorununu
   yakaladı. 3000 raporda liste artık **179 ms**.

8. **Onaylanmamış model metni yarışmacıya gidiyordu.** `npm run denetim`
   yakaladı. Sızıntı denetiminin kendisi de kırıktı: alan ADLARINI arıyordu,
   ama sunucu bileşeninde hesaplanan değerlerin adları sayfaya düşmüyor.
   Artık modelin ürettiği metinler doğrudan aranıp hakem onaylılarıyla
   karşılaştırılıyor.

---

## Bilinen sınırlar

Sistem bunları kullanıcıya da söylüyor; gizlenmiyor.

- **Canlıya alınmadı.** Veri SQLite'ta; kalıcı diskli bir sunucuda çalışır
  ama sunucusuz (Vercel gibi) ortamda dosya kalıcı olmaz.
- **Kimlik doğrulama kullanıcı bazlı değil.** Koordinasyon ekibin ORTAK
  anahtarıyla giriyor, hakem kendi erişim koduyla. İkisi de "kimlik" değil
  "paylaşılan sır": kim ne yaptı ayırt edilemiyor (değerlendirmeler hariç —
  onlar hakem kaydına bağlı). Kurum kimlik sistemine (SSO) bağlanacak yer
  tek: `src/lib/yetki/koordinasyon.ts` ve `hakemKodIle`.
- **Kaba kuvvete karşı hız sınırlama yok.** Anahtar denemesi sınırsız; tek
  koruma anahtarın uzunluğu.
- **`KOORDINASYON_ANAHTARI` tanımlı değilse panel açık.** Bilinçli:
  eksikliği gizlemek yerine her ekranda uyarı gösteriliyor.
- **46 kategoride ağırlıklar eşit dağıtılmış taslak.** Gerçek ağırlıklar
  şartnamede olabilir; uyarı veriliyor.
- **3 şablon PDF** olduğu için çözümlenemiyor; elle yükleme gerekiyor.
- **Kapaktan künye okuma her raporda tutmuyor** — alanlar tabloya ya da
  görsele gömülü olabilir. Okunamadığında kusur sayılmıyor.
