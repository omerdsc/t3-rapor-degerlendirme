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
  ├─ otomatik kontroller  ($0, saniyeler)     → dil, şablon, başlık,
  │                                              kaynakça, kaynak doğrulama,
  │                                              içerik uygunluğu, kopya
  ├─ yapay zekâ ön değerlendirmesi ($0,18)    → ölçüt bazında puan önerisi,
  │  (isteğe bağlı, hakem başlatır)              alıntı ve gerekçeyle
  └─ hakem puanlar ve imzalar                 → nihai karar
       └─ yarışmacı sonucu görür
```

---

## Kurulum

```bash
npm install
cp .env.ornek .env.local        # ANTHROPIC_API_KEY girin (yalnızca AI adımı için)
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

Kanıt için: `npx tsx scripts/kanit-topla.ts` — bu tablonun kaynağı odur,
elle yazılmaz.

Zorunlulukların madde madde karşılığı:
**[docs/gereksinim-karsiligi.md](docs/gereksinim-karsiligi.md)**

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
src/lib/depo/       dosya tabanlı veri katmanı, maskeleme, arama, dışa aktarma
src/app/            Panel · Raporlar · Kopya Kontrolü · Yarışmalar · Yarışmacı portalı
```

---

## Doğrulama

```bash
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

---

## Bilinen sınırlar

Sistem bunları kullanıcıya da söylüyor; gizlenmiyor.

- **Canlıya alınmadı.** Depo dosya sistemine yazıyor; sunucusuz ortamda
  kalıcı değil. Veritabanı katmanı gerekiyor.
- **Yetkilendirme yok.** Roller ekranla ayrılmış, hesapla değil. Hakem adı
  beyan usulü alınıyor.
- **46 kategoride ağırlıklar eşit dağıtılmış taslak.** Gerçek ağırlıklar
  şartnamede olabilir; uyarı veriliyor.
- **3 şablon PDF** olduğu için çözümlenemiyor; elle yükleme gerekiyor.
- **Kapaktan künye okuma her raporda tutmuyor** — alanlar tabloya ya da
  görsele gömülü olabilir. Okunamadığında kusur sayılmıyor.
