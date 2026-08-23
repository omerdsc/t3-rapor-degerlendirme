# Gerçek Dünya Sorunları ve Dayanıklılık Gereksinimleri

TEKNOFEST raporları ideal PDF'ler değildir. Bu belge, sistemin karşılaşacağı
gerçek bozulmaları ve her birine verdiğimiz yanıtı tanımlar.

> Kaynak: ekip üyesinin TEKNOFEST başvuru deneyimi + PDF işleme pratiği.
> Her madde bir test vakasına karşılık gelir; `tests/fixtures/` altında
> bozuk örneği bulunmalıdır.

---

## A. Şablon Kaynaklı Bozulmalar

Yarışmacı hazır Word şablonuna içerik yapıştırır. Bu süreç öngörülebilir
biçimde bozulur.

### A1. Yönerge metni silinmemiş — **YÜKSEK DEĞER**

Şablonda `"Bu bölümde projenizin özgün yönlerini açıklayınız."` yazar.
Yarışmacı üstüne yazmak yerine altına yazar veya hiç doldurmaz.

- **Tespit:** Şablonun ham metnini referans alıp rapor metninden çıkar.
  Bir bölümde kalan içerik yalnızca yönerge metniyse → bölüm doldurulmamış.
- **Çıktı:** Hakeme `"3.2 Özgün Yönler — bölüm doldurulmamış, şablon
  yönergesi duruyor"` bulgusu.
- **Neden önemli:** Metin çıkarımı o bölümü "dolu" görür. Sadece şablon
  farkı alan sistem gerçeği görür.

### A2. Placeholder kalıntısı

`[Takım Adı]`, `XXX`, `.....`, `Lorem ipsum`, `<takım logosu>`.
- **Tespit:** Desen listesi + şablondan devralınan placeholder sözlüğü.

### A3. Başlık stili bozulmuş

Yapıştırma sırasında `Heading 2` düz metne dönüşür. Sadece PDF stil
bilgisine bakan başlık tespiti bu raporda çalışmaz.
- **Yanıt:** Başlık tespiti **üç sinyali birlikte** kullanır —
  (1) numaralandırma deseni (`3.2.`, `IV.`), (2) yazı tipi boyutu/kalınlığı,
  (3) şablonun beklenen başlık listesine metin benzerliği.
  Tek sinyale asla güvenme.

### A4. Eski şablon sürümü

Geçen yılın şablonu kullanılmış.
- **Tespit:** Şablon imzası (zorunlu başlık kümesi + sıralaması) ile eşleşme.
  Birden çok yıl şablonu tanımlı tutulur, hangisine uyduğu raporlanır.

---

## B. PDF Teknik Bozulmaları

### B1. Türkçe karakter bozulması — **KRİTİK**

PDF font encoding yüzünden `ı ğ ş İ ö ç ü` bozuk çıkar:
`şablon` → `ablon` / `sablon` / `ﬂablon`. Türkçe PDF'lerde çok yaygın.

- **Yanıt:** Zorunlu normalizasyon katmanı.
  - Unicode NFKC normalizasyonu
  - Ligatür açma (`ﬁ`→`fi`, `ﬂ`→`fl`)
  - Türkçe harf onarım haritası
  - Başlık eşleştirmesi **aksan duyarsız + fuzzy** (Levenshtein eşiği)
- **Asla:** Tam string eşitliğiyle başlık arama. Gerçek raporda çalışmaz.

### B2. Sayfa başlığı/altlığı metne karışıyor — **BENZERLİK İÇİN KRİTİK**

Her sayfada `TEKNOFEST 2026 | Takım Adı | Sayfa 4` tekrar eder.

- **Risk:** Çıkarılmazsa **her rapor birbirine benzer çıkar** ve benzerlik
  modülü tamamen değersizleşir.
- **Yanıt:** Sayfalar arası tekrar eden satırları tespit et ve çıkar
  (aynı metin ≥ %60 sayfada görünüyorsa header/footer'dır).

### B3. Okuma sırası karışık

PDF metin nesneleri görsel sıraya göre değil, çizim sırasına göre saklanır.
İki sütunlu sayfa veya kutu içi metin sırayı bozar.
- **Yanıt:** Koordinat tabanlı yeniden sıralama (y ekseni öncelikli,
  sütun tespiti ile x gruplaması).

### B4. Taranmış / görüntü PDF

Metin katmanı yok veya sayfa sayısına oranla anlamsız derecede küçük.
- **Tespit:** `karakter_sayısı / sayfa_sayısı < 200` → taranmış kabul.
- **Yanıt:** (1) Bunun kendisi bir şablon uygunluk bulgusudur, hakeme
  bildirilir. (2) Rapor yine de değerlendirilir — görsel yola yönlendirilir.

### B5. Korumalı / şifreli PDF

Metin çıkarma engellenmiş.
- **Yanıt:** Açık hata, hakeme "manuel inceleme gerekli" olarak işaretle.
  Sessizce boş sonuç döndürme.

### B6. Tablo parçalanması

Word→PDF dönüşümünde bütçe ve iş-zaman tabloları satır satır dağılır.
- **Yanıt:** Tablo bölgeleri metin yoluyla değil **görsel yolla** okunur.

---

## C. İçerik ve Uygunluk

| # | Sorun | Tespit |
|---|---|---|
| C1 | Yanlış format yüklenmiş (DOCX/ZIP) | MIME + sihirli bayt kontrolü |
| C2 | Sayfa sınırı aşımı / altı | Şartname sınırıyla karşılaştır |
| C3 | Yanlış dil (İngilizce beklenirken Türkçe / tersi) | Dil tespiti + şartname beklentisi |
| C4 | Karışık dil (yarısı TR, yarısı EN) | Bölüm bazlı dil dağılımı |
| C5 | Rapor yarım / bölümler eksik | Zorunlu başlık kapsama oranı |
| C6 | Kaynakça yok veya biçimsiz | Bölüm varlığı + atıf deseni |

---

## D. Benzerlik Analizi Tuzakları

Benzerlik modülünün değerini belirleyen şey, **neyi benzerlik saymadığıdır.**

### D1. Şablon metni benzerliği — **MODÜLÜN EN KRİTİK DETAYI**

Tüm raporlar aynı şablonu kullanır. Ham karşılaştırmada her rapor çifti
baştan yüksek benzerlik verir ve sonuç anlamsızlaşır.

- **Yanıt:** Karşılaştırmadan **önce** şablon metnini, başlıkları,
  header/footer'ı ve kaynakçayı çıkar. Yalnızca yarışmacının yazdığı
  özgün metin karşılaştırılır.

### D2. Ortak teknik terim yoğunluğu

`Arduino`, `görüntü işleme`, `PID kontrolcü`, `YOLOv8` — aynı kategorideki
raporlarda doğal olarak ortak.
- **Yanıt:** Kategori içi taban benzerlik seviyesi hesaplanır; bir çift
  ancak **kendi kategorisinin tabanının belirgin üstündeyse** işaretlenir.

### D3. Aynı takımın önceki yıl raporu

Kopya değil, devam projesidir.
- **Yanıt:** Takım kimliği eşleşiyorsa `"devam projesi"` olarak ayrı
  etiketlenir, intihal olarak işaretlenmez.

### D4. Kaynakça örtüşmesi

Aynı makalelere atıf yapmak normaldir.
- **Yanıt:** Kaynakça bölümü benzerlik hesabının dışında tutulur.

### D5. Görsel kopya — metin farklı, şekil aynı

En sık görülen ve mevcut sistemlerin yakalayamadığı kopya biçimi.
- **Yanıt:** Çıkarılan her şekle perceptual hash (pHash). Metin
  benzerliğinden bağımsız çalışır.

---

## E. Değerlendirme Adaleti

Bir değerlendirme sisteminin en büyük riski hızlı olmaması değil,
**sistematik olarak haksız olmasıdır.**

### E1. Uzunluk yanlılığı

LLM uzun raporu içerikli sanma eğilimindedir.
- **Yanıt:** Rubrik promptunda açık talimat: uzunluk puanlama ölçütü
  değildir. Ölçüm: puan–sayfa sayısı korelasyonu izlenir, yüksekse
  rubrik düzeltilir.

### E2. Dil kalitesi yanlılığı — **JÜRİ KARŞISINDA GÜÇLÜ NOKTA**

Akıcı Türkçe yazılmış içi boş rapor, kötü yazılmış ama teknik olarak güçlü
rapordan yüksek puan alabilir. Bu, imkânları kısıtlı okullardan gelen
takımları sistematik olarak cezalandırır.

- **Yanıt:**
  - Rubrikte teknik içerik ile anlatım kalitesi **ayrı kriterler**
  - Teknik kriterler değerlendirilirken dil kalitesinin ölçüt olmadığı
    açıkça belirtilir
  - Kalibrasyon panelinde bu iki kriter arasındaki korelasyon izlenir

### E3. Sıra etkisi (position bias)

Tek çağrıda çok kriter verilirse ilk kriterlere daha çok dikkat edilir.
- **Yanıt:** Kriterler bağımsız değerlendirilir; rapor cache'lendiği için
  maliyet artışı ihmal edilebilir.

### E4. Aşırı güven

Modelin eksik bilgiyle kesin puan vermesi.
- **Yanıt:** Her kriter için güven seviyesi zorunlu. Düşük güven →
  `"hakem mutlaka incelesin"` olarak yönlendirilir.

---

## Bağlayıcı Sonuç

Bu belgeden çıkan **zorunlu** girdiler:

1. **Gerçek TEKNOFEST rapor şablonu dosyası** — A1, A3, A4 ve D1'in tamamı
   buna bağlı. Şablon olmadan bu özellikler yazılamaz.
2. **Şartname** — sayfa sınırı, dil beklentisi, zorunlu bölümler (C2, C3, C5).
3. **Kategori listesi ve rubrikler** — E2 ve kategori uyumu için.

Sentetik test korpusu üretilirken bu belgedeki **her bozulma tipi**
bilinçli olarak enjekte edilir; korpus aynı zamanda regresyon test setidir.

---

## F. 60 yarışmalık katalog taramasından çıkan bulgular

Bu bölüm varsayıma değil ölçüme dayanıyor: teknofest.org'daki **60 yarışmanın
260 belgesi** çekildi, 81 kategorinin şablonu indirilip çözümlendi
(`scripts/katalog-cek.ts`, `scripts/katalog-dogrula.ts`). Aşağıdaki her madde
gerçek bir şablonda karşılaşılan ve düzeltilen bir durumdur.

### F1 · Şablon çeşitliliği varsayımdan geniş
| Ölçüm | Sonuç |
|---|---|
| Yarışma | 60 |
| Rapor şablonu yayımlanmış | 42 |
| Şartnamesi olan | 46 |
| **Teknik şartnamesi olan** | 4 |
| Çok kategorili yarışma | 11 |
| Aynı yarışmada birden çok rapor türü | 11 |
| Katılımcı seviyesine bölünmüş | 9 |
| Aktarılabilir kategori | 81 |

18 yarışmada şablon henüz yayımlanmamış. Sistem bunu hata değil **durum**
olarak göstermek zorunda: şablonsuz kategori değerlendirilemez ama yarışma
geçersiz de değildir.

### F2 · Puan ağırlığı çoğu şablonda YOK
81 kategorinin **37'sinde** bölüm başlıkları var, puan ağırlığı yok — ağırlık
şartnamede ya da teknik şartnamede duruyor. Boş rubrik döndürmek sistemi o
kategoride tümden çalışmaz kılıyordu. Çözüm: bölümlerden **eşit ağırlıklı**
taslak üretmek ve bunu açıkça uyarıyla bildirmek. Uydurma ağırlıkla eşit
ağırlık arasındaki fark, eşit ağırlığın yanlış olduğunu kendisinin söylemesi.

### F3 · Word başlık stili olmayan şablonlar
15 şablondan hiç başlık çıkmadı. Nedeni tek: o `.docx` dosyalarında
`w:pStyle` **hiç yok**; başlıklar elle kalın yapılmış. Biçim tabanlı yedek
tespit eklendi (kalınlık + uzunluk + tablo dışı + `:` ile bitmeme).
Sonuç: rubrik çıkan kategori sayısı **26 → 74**.

### F4 · Kapak sayfası bölüm sanılıyor
Stil olmayan şablonlarda kapak satırları da kalın: "LİSELER ARASI /
İNSANSIZ HAVA ARAÇLARI YARIŞMASI / … / ŞABLONU" → 14 uydurma bölüm. Ayırt
edici sinyal: kapak satırının ne puanı ne altında yönerge metni var.
İlk sürüm bu kuralı korumasız uyguladığında **gerçek bölümleri sildi**
(4 şablonda) — iki koruma eklendi: en az 2 satır atılmalı ve geriye en az
3 bölüm kalmalı.

### F5 · Kategori adı ile rapor türü karıştırılabiliyor
Türetim iki farklı şeyi aynı biçimde buluyor:

- Nükleer Enerji → "KAVRAMSAL TASARIM", "DETAY TASARIM" → **kategori**
- Elektronik Harp → "KTR", "TYF" → **rapor türü**

Etiketten anlaşılmıyor. Ayırt edici sinyal: yarışmanın belgelerinden en az
biri açıkça "… Kategorisi" diyorsa o yarışma kategorilere bölünmüştür.
Bu ayrım yapılmazsa "Elektronik Harp'ta 2 kategori var" denir — yanlış bilgi.

### F6 · Ad çakışması veri kaybıdır
Robotaksi'de "Hazır Araç" kategorisinin iki şablonu var (KTR ve Teknik
Yeterlilik Formu). İkisi de aynı adı alıyordu; biri 100 puanlık rubrik
üretti, öteki hiç, ve hangisinin hangisi olduğu ayırt edilemiyordu.
Çakışan adlar aşama ya da ayırt edici sözcükle ayrıştırılıyor:
"Hazır Araç · KTR", "Hazır Araç · Teknik Yeterlilik Formu TYF".

### F7 · Türkçe büyük harf regex'i bozar (üçüncü kez)
`/kategori/i` deseni "KATEGORİSİ" ile **eşleşmez**: JS'te İ (U+0130) küçük
harfe çevrilince "i" + birleşik nokta olur. Aynı tuzağa daha önce
`\bYarışması\b` (ı sözcük karakteri değil) ve `incelenecek\b` (Türkçe ek)
ile düşülmüştü. Kalıcı çözüm: karşılaştırmayı `anahtar()` üzerinden yapmak
ya da İ→i, I→ı eşlemesini uzunluk koruyarak önce uygulamak.

### F8 · PDF şablon çözümlenemez
3 kategoride şablon `.pdf` yayımlanmış. Şablon çıkarıcı `w:pStyle`'a
dayandığı için PDF'ten rubrik çıkmıyor; bu kategoriler "elle yüklenmeli"
diye işaretleniyor. Sessizce atlanmıyor.

### F9 · Maliyet katalog ölçeğinde tasarımı belirledi
60 yarışmanın şartnamesini AI ile özetlemek ~$11 eder; kalan bütçenin
tamamından fazla. Bu yüzden aktarım tamamen **deterministik ve ücretsiz**
tutuldu: indirme, ayrıştırma, rubrik çıkarımı, takvim eşlemesi — hepsi $0.
AI özeti kategori başına ayrı ve isteğe bağlı bir adım ($0.19).

---

## G. Benzerlik ekranı ve kimlik maskeleme

### G1 · Parmakizi saklanmak zorunda
`Parmakizi` bellek içi bir yapı: `Int32Array` imza ve cümle başına
`Set<number>`. İkisi de JSON'a **sessizce bozularak** yazılır — Int32Array
`{"0":123,…}` nesnesine, Set `{}` boşluğuna döner; hata vermez. Serileştirme
kabuğu (`parmakizi-depo.ts`) bu yüzden ayrı bir katman.

Alternatif, ekran her açıldığında bütün raporları yeniden ayrıştırmaktı;
100 raporlu kategoride dakikalar sürerdi ve her açılışta yeniden sürerdi.
Parmakizi yükleme anında bir kez çıkarılıyor (~40 KB/rapor).

### G2 · Benzerlik korpusa bağlı, tek rapora değil
Öteki kontroller tek raporun içine bakar ve yüklemede bir kez koşar.
Benzerlik farklı:

1. birinci rapor yüklenir → korpusta tek rapor, bulgu yok
2. ikinci yüklenir → ikincinin bulgusu çıkar
3. **birincinin durumu da değişti** — tazelenmezse birinci rapor sonsuza
   kadar "temiz" kalır ve kopya sessizce kaçar

Bu yüzden her yüklemede kategorinin tamamı tazeleniyor
(`benzerlik-tazele.ts`). Fikstürlerle doğrulandı: ilk yüklenen K01, beşinci
yükleme sonunda bulgusunu taşıyor.

### G3 · Maskeleme yalnızca ekrandaki metni değiştirmekse maskeleme değil
Rapor detay sayfası `Rapor` nesnesinin tamamını bir istemci bileşenine
geçiyordu. Gösterilen metni maskelemek hiçbir şeye yaramadı: gerçek takım
adı, takımId ve başvuru numarası **RSC yüküyle sayfa kaynağında düz metin
olarak** duruyordu. Doğrusu istemciye yalnızca kullanılan alanları
göndermek. Yan kazanç: 40 KB parmakizi de tarayıcıya inmiyordu artık.

### G4 · Kırpma maske değildir
İlk maskeleyici kimliğin son 4 karakterini alıyordu:

    "anadolu" → "Takım DOLU"
    "botan"   → "Takım OTAN"

Gerçek adın bir parçası maske değil. FNV-1a hash'ine geçildi; girdinin
hiçbir harfi çıktıya geçmiyor, aynı girdi her zaman aynı kodu veriyor.
Aynı hata başvuru numarasında da vardı: "TF-ZAP" → "#••ZAP".

### G5 · Takım rumuzu tek başına yetmiyor
Aynı takımın iki raporu (bu yılki ve devam projesi) aynı rumuzu alıyor ve
ekranda iki farklı çift "Takım X ↔ Takım Y" diye görünüyordu — hakem hangi
raporun kastedildiğini ayırt edemiyordu. Rapor düzeyinde ayrı kod eklendi:
`Takım 8EM8 R-WKT4`.

### G6 · Maskeleme kör puanlamayı da sağlıyor
Gerekçe yalnızca kişisel veri değil: hakem takım adını görüyorsa puanlama
kör değildir ve "geçen yıl finale kalan ekip" bilgisi puanı etkiler.
Maskeleme ikisini birden çözüyor. `MASKELEME=kapali` ile kapatılabilir;
yarışmacı portalında hiç uygulanmıyor — kişi kendi adını görmeli.
