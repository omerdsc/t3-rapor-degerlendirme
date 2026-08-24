# PRD Karşılığı — Problem 4

Bu belge **PRD'nin kendi yapısını izler**: her sayfa, o sayfadaki her madde
ve maddenin nerede karşılandığı. Yan yana okunabilsin diye başlıklar
PRD'deki sırayla.

Tablodaki sayılar iddia değil, çalışan koddan okunuyor:
`npm run kanit` · `npm run db:kontrol` · `npm run duman` · `npm run hacim`

Ölçüm: 2026-08-24 · SQLite · üç ayrı portal · 101 birim testi

---

## Sayfa 01 · Kapsam

> "Rapor kontrolünden kriter bazlı analize ve yarışmacı geri bildirimine
> kadar değerlendirme sürecini **tek yapıda** destekleyen sistem."

| Aşama | Nerede | Maliyet |
|---|---|---|
| Rapor kontrolü | `src/lib/analiz/` — 6 kontrol ailesi | **$0** |
| Kriter bazlı analiz | `src/lib/ai/degerlendirme.ts` | $0,131/rapor |
| Yarışmacı geri bildirimi | `/sonuc` — hakem onaylı | $0 |

**"Tek yapı"** üç ayrı araç değil, uçtan uca akan tek sistem: rapor
yüklenir → kontroller anında koşar → koordinasyon ön değerlendirmeyi
başlatır → hakemlere dağıtılır → hakem puanlar ve geri bildirimi onaylar →
yarışmacı görür. Aradaki hiçbir adım elle veri taşımayı gerektirmiyor.

---

## Sayfa 02 · Problem, amaç ve sonuç

### SEBEP — altı kontrol adımı

PRD altı kontrolü tek tek sayıyor. Altısı da çalışıyor ve ölçülmüş:

| PRD'nin saydığı | Nerede | Ölçülmüş kanıt |
|---|---|---|
| rapor dili | `analiz/dil.ts` | 7/7 rapor · `DIL_BOLUM_SAPMASI` ×2 |
| şablon | `analiz/sablon.ts` | 7/7 rapor · `SABLON_ESKI` ×5 |
| başlık-içerik | `analiz/sablon.ts`, `kaynakca.ts` | `BASLIK_EKSIK` ×25 · `BOLUM_YETERSIZ` ×5 |
| kategori | `analiz/kategori.ts` | 7/7 rapor · 70 gerçek şartname terim profili |
| benzerlik | `analiz/benzerlik.ts`, `phash.ts` | 6 raporda parmak izi · metin ×5, görsel ×3, devam projesi ×2 |
| kriter bazlı değerlendirme | `ai/degerlendirme.ts` | **6 rapor** · rapor başına $0,131 |

### Üç acı noktası

**"Uzman hakem zamanı temel kontrollere ayrılıyor."**
Altı kontrol $0 maliyetle ve saniyeler içinde koşuyor; hakem paneli
açıldığında 25 başlık bulgusu, 5 şablon hatası ve 5 benzerlik işareti
zaten önünde. Hakem aramıyor, okuyor.

**"Farklı kontrollerin tek akışta izlenmesi zorlaşıyor."**
Rapor sayfası tek ekranda: nihai puan (başlıkta) → hakem değerlendirmeleri
→ altı otomatik kontrol şeridi → bulgular → yapay zekâ önerisi → rapor
belgesi → yazışma. Panoda ise akış oranı: **%82, 9/11 değerlendirme
tamamlandı** biçiminde.

**"Yarışmacıya gelişim odaklı geri bildirim sınırlı kalıyor."**
`/sonuc` dört bölüm gösteriyor: kriter bazlı puan, güçlü yönler, gelişime
açık alanlar, ölçüt bazında öneriler. Tamamı **hakem onayından geçmiş** —
aşağıda.

### AMAÇ ve SONUÇ

| PRD'nin vaadi | Karşılığı |
|---|---|
| "bütünleşik karar destek sistemi" | Üç portal, tek veri; koordinasyon puan girmiyor |
| "daha hızlı ön kontrol" | 6 kontrol $0 ve saniyeler; 3000 raporda liste 179 ms |
| **"daha standart değerlendirme"** | Hakemler arası ayrışma ölçülüyor ve uyarı olarak gösteriliyor: 70,2 (fark 30) · 65,5 (21) · 71,8 (20) |
| "azaltılmış operasyonel iş yükü" | Toplu dengeli atama (6000 atama 0,90 sn), toplu ön değerlendirme, tek ekranda akış oranı |
| **"nihai karar uzman hakemde kalır"** | Koordinasyon portalında puanlama formu YOK. Puanı yalnızca hakem giriyor |
| "yarışmacıya nitelikli geri bildirim" | Üç bölüm, hepsi hakem onaylı; onaysız model metni yayımlanmıyor |

### "Yüksek hacim" — ölçülmüş

PRD'nin başlığı bu. `npm run hacim` yazıldı ve **dört gerçek performans
hatası** buldu (hepsi düzeltildi). Üretim derlemesinde, 3000 rapor:

| Ekran | Süre | Boyut |
|---|---|---|
| Rapor listesi | **179 ms** | 417 KB |
| Hakemler ve atama | **205 ms** | 147 KB |
| Pano | **331 ms** | 30 KB |
| 6000 atama yazma | **0,90 sn** | — |
| Dağıtım dengesi | hakem başına 1499–1502 (fark 3) | — |

Ölçümün bulduğu hatalar: rapor listesi 1000 raporda **24 saniye** sürüyordu
(8,7 MB HTML, 6003 SVG) → sayfalama; açılır listeler her yarışma için ayrı
sorgu atıyordu (44 tam tablo taraması) → tek `GROUP BY`; atama ekranı rapor
başına iki sorgu yapıyordu (3000 raporda 6000 sorgu) → toplu sorgu; toplu
atama 6000 kayıt için **15,5 saniye** sürüyordu → tek işlemde yazma.

Ücretli katman hacimle doğrusal: rapor başına **$0,131** (6 rapor üzerinde
ölçüldü). `TOPLAM_TAVAN` bir sistem sınırı değil bütçe ayarı; aşılınca
sistem çağrıyı **reddediyor**, sessizce harcamaya devam etmiyor.

---

## Sayfa 03 · Kullanıcı rolleri

> "Yapay zekâ nihai karar verici değildir; kontrol, analiz ve ön
> değerlendirme sunan destek katmanı olarak çalışmalıdır."

Bu kural mimarinin çekirdeği ve **kodda uygulanıyor**: koordinasyon
portalında puanlama formu yok (eskiden vardı, kaldırıldı); hakem puanı
girilmeden rapor tamamlanamıyor; yapay zekâ çıktısı her yerde
"ÖNERİ · PUAN DEĞİL" etiketiyle gösteriliyor.

| PRD rolü | PRD'nin tanımı | Ekran | Durum |
|---|---|---|---|
| **01 Yarışma Yöneticisi** | şablon, kategori ve kriterleri tanımlar; süreci takip eder | `/koordinasyon/yarismalar` + pano | ✓ |
| **02 Hakem / Değerlendirici** | AI analizini inceler, uzman değerlendirmesini yapar, nihai kararı verir | `/hakem/<kod>` | ✓ |
| **03 Yarışmacı** | güçlü yönler, geliştirilmesi gereken alanlar ve önerileri görüntüler | `/sonuc` | ✓ |
| **04 Değerlendirme Yöneticisi** | analiz durumlarını, **tamamlanma oranlarını** ve akışı izler; operasyonel aksiyonları yönetir | `/koordinasyon` + `/koordinasyon/hakemler` | ✓ |

### Rol 01 ile Rol 04 niye tek portalda

PRD ikisini ayrı rol sayıyor. Bizde ayrı **ekranlar**, ortak **erişim**.
Gerekçe: AKIŞ 01 ağır işi (rapor yükleme, AI başlatma) rol 01'e veriyor,
rol 04 ise izliyor ve operasyon yürütüyor — ikisi de Yarışmalar
Koordinatörlüğü'nün işi. İki ayrı anahtar kurmak, aynı ekibin iki üyesine
birbirinden gizli ekranlar vermek olurdu. Kurumsal kurulumda kurum kimlik
sistemi (SSO) bağlandığında rol ayrımı oradan gelir; değişecek tek yer
`src/lib/yetki/koordinasyon.ts`.

### Rol 03'ün üç maddesi

| PRD'nin istediği | Bölüm | Kaynak |
|---|---|---|
| güçlü yönler | "Güçlü Yönleriniz" | hakem onaylı |
| geliştirilmesi gereken alanlar | "Gelişime Açık Alanlar" | hakem onaylı |
| öneriler | "Gelecek Yıl İçin Öneriler" | hakem onaylı, ölçüt bazında, "+N puana kadar" hakemin puanından |

---

## Sayfa 04 · MVP — altı zorunlu madde

> "Bir madde eksikse ekip sonraki değerlendirme aşamasına geçemez."

| # | Madde | Durum | Kanıt |
|---|---|---|---|
| 1 | Rapor dili otomatik tespit edilir | ✓ | `npm run kanit` · 7/7 |
| 2 | **Güncel** şablonun kullanıldığı kontrol edilir | ✓ | `SABLON_ESKI` ×5 · yerinde şablon güncelleme |
| 3 | Zorunlu başlıklar ve beklenen içerik analiz edilir | ✓ | `BASLIK_EKSIK` ×25, `BOLUM_YETERSIZ` ×5 |
| 4 | Kategori uyumu analiz edilir | ✓ | TF-IDF · 70 şartname terim profili |
| 5 | Yüksek benzerlik **inceleme için işaretlenir** | ✓ | 3 kurgu vakanın üçü de yakalandı |
| 6 | AI kriter değerlendirmesi **ve geri bildirim** | ✓ | aşağıda |

### Madde 06 ayrıntılı

> "Rapor kriterlere göre analiz edilerek hakeme **'AI 4. göz'** sunulur;
> sonuçlardan **güçlü/zayıf yönler** ve **gelişim önerileri** üretilir."

Projenin adı bu maddeden geliyor: **4. Göz**.

| Parça | Nerede görünüyor |
|---|---|
| Kriter bazında analiz | Hakem paneli: ölçüt başına puan önerisi, gerekçe, rapordan alıntı, güven etiketi |
| "hakeme sunulur" | Hakem paneli + koordinasyon rapor sayfası |
| güçlü yönler | Hakem paneli (düzenlenebilir) → yarışmacı |
| zayıf/gelişime açık yönler | Hakem paneli (düzenlenebilir) → yarışmacı |
| gelişim önerileri | Hakem paneli, ölçüt bazında → yarışmacı |

**Bu madde bir kez yarımdı ve düzeltildi.** Model üç metni de üretiyordu
ama: "gelişime açık alanlar" hiçbir ekrana basılmıyordu (prop olarak
geliyor, JSX'te sıfır kullanım), "güçlü yönler" yalnızca yarışmacıda vardı
(madde "hakeme sunulur" diyor), ve "+N puana kadar" yapay zekânın
puanından hesaplandığı için 9 ölçütün 7'sinde yanlış sayı gösteriyordu.

---

## Sayfa 05 · Üç temel akış

> "Üç temel akış, rapor analizinden nihai değerlendirmeye kadar MVP
> bütünlüğünü test eder."

Üçü de yürünebilir. `npm run demo` demo verisini tamamlıyor ve her akış
için açılabilir adres yazdırıyor.

### AKIŞ 01 · Yarışma Yöneticisi

`Yarışmayı tanımlar → güncel şablon ve kriterleri ekler → raporları
sisteme aktarır → AI analiz sürecini başlatır`

| Adım | Ekran |
|---|---|
| Yarışmayı tanımlar | `/koordinasyon/yarismalar` — 60 yarışmalık TEKNOFEST kataloğundan seç ve **Kur** |
| Güncel şablon ve kriterleri ekler | Şablon indirilir, çözümlenir, ölçütler çıkarılır (74/81 kategoride otomatik); yönetici onaylar veya kendi ölçütünü ekler |
| Raporları sisteme aktarır | `/koordinasyon/raporlar` — çoklu dosya yükleme, kontroller anında koşar |
| **AI analiz sürecini başlatır** | Yüklemenin hemen ardında toplu başlatma: maliyet önden söylenir, sırayla işlenir, durdurulabilir |

### AKIŞ 02 · Hakem / Değerlendirici

`Raporu açar → kontrol ve analiz sonuçlarını inceler → AI kriter
değerlendirmesini görür → nihai değerlendirmeyi tamamlar`

Hakem `/hakem/<kod>` ile giriyor ve **yalnızca kendisine atanmış**
raporları görüyor. Erişim denetimi iki katmanda (sayfa + API); atanmamış
rapora erişim 404, API'ye puan gönderimi 403. Takım adları rumuzlu —
puanlama kör.

PRD'nin akışında atama adımı geçmiyor; hakem "raporu açar". Atama sistemi
bizim eklememiz ve rol 04'ün "operasyonel aksiyonları yönetir" maddesine
oturuyor. Çok hakemli değerlendirmeyi mümkün kılan da bu.

### AKIŞ 03 · Yarışmacı

`Değerlendirme tamamlanır → sonucunu görüntüler → güçlü ve gelişime açık
yönlerini inceler → önerileri görür`

Sayfa **yalnızca hakem tamamladıysa** açılıyor. Bir başvuru numarasına
birden çok rapor bağlıysa (takım iki yarışmaya katıldıysa) hepsi
listeleniyor.

Sızıntı denetimi betikle yapılıyor (`npm run denetim`) ve aranan değerler
veritabanından okunuyor: gerçek hakem adları, gerçek erişim kodları,
modelin ürettiği metinler. **5 tamamlanmış raporun hepsinde temiz** —
yapay zekâ puanı, güven etiketleri, şartname ihlalleri, maliyet, hakem
kimliği ve onaylanmamış model metni sayfada yok.

---

## Yarışmacıya giden her cümle hakem onayından geçiyor

Bu, PRD'nin iki maddesini birden karşılayan tasarım kararı: madde 06
"güçlü/zayıf yönler ve gelişim önerileri üretilir" diyor, sayfa 03
"yapay zekâ nihai karar verici değildir" diyor.

Eskiden bu üç metin **doğrudan model çıktısından** yarışmacı ekranına
basılıyordu — kimse okumadan, kimse onaylamadan. Puanı hakemden alıp metni
modelden almak tutarsızdı: yarışmacı için geri bildirim de bir karardır ve
sahibi olmalı.

Şimdi hakem panelinde üç bölüm yapay zekâ önerisiyle **dolu** geliyor;
hakem düzeltiyor, siliyor, ekliyor ve tamamlayınca onaylamış oluyor.
Onaylanmamış hiçbir cümle yayımlanmıyor — doğrulandı: TF-2026-004181'in
9 yapay zekâ önerisi var, hakem onaylamadan hiçbiri sayfada görünmüyordu.

Geri bildirim boş bırakılabiliyor ama tamamlarken onay isteniyor: "farkında
olmadan boş gönderdim" durumu kalmasın. Zorunlu alan yapmak, anlamsız
metin doldurulmasına yol açardı.

---

## PRD'de istenmeyen ama eklediklerimiz

| Ek | Neden değerli |
|---|---|
| **TEKNOFEST kataloğu** — 60 yarışma, 260 belge otomatik çekiliyor | Koordinasyon her yarışmayı elle kurmuyor; sistem kurulur kurulmaz tüm yarışmalar hazır |
| **Kaynak doğrulama** (Crossref + OpenAlex) | Yapay zekâ ile yazılan raporlar var olmayan kaynak uydurabiliyor. 3 kaynak akademik indekste doğrulandı, 9'u indekslenemez çıktı |
| **Teknik şartname desteği** | Puanlama ağırlıkları genel şartnamede değil teknik şartnamede olabiliyor. 4 yarışmada bulundu ve okundu |
| **Kimlik maskeleme + kör puanlama** | Hakem takım adını görmüyor; yanlılık azalıyor, kişisel veri ekrana düşmüyor. Arama gerçek veriyle **sunucuda** çalışıyor |
| **Rapor kapağından kimlik okuma** | Kapak künyesi başvuruyla çelişirse yakalanıyor — yanlış dosya yüklenmiş olabilir |
| **Yerinde şablon güncelleme** | TEKNOFEST şablonu yıl içinde değişebiliyor. Güncelleme hakem puanlarını, yüklenmiş raporları ve elle eklenen ölçütleri **koruyor** |
| **Şekil okuma** | Akış şemasını görsel çizen rapor cezalandırılmıyor; şekiller modele ayrıca veriliyor |
| **Çok hakemli değerlendirme + ayrışma ölçümü** | Puanlar ayrı kayıtta, nihai puan ortalama, hakemler arası fark uyarı olarak bildiriliyor. PRD'nin "daha standart değerlendirme" maddesinin ölçülebilir karşılığı |
| **Erişim denetimi** | Ortak anahtar + HttpOnly çerez; 18 API rotasında rota-içi denetim, üstüne perimetre. Rapor belgesi ucu iki kapılı: koordinasyon anahtarı **ya da** atanmış hakem kodu |
| **Türetilmiş değerde tek yazıcı** | Nihai puan tek fonksiyondan yazılıyor; hesap veritabanından bağımsız ve test kapsamında. Kural, listede 75,5 / detayda 71,8 gösteren gerçek bir hatadan sonra konuldu |
| **Ölçüm ve denetim betikleri** | `hacim` (performans), `db:kontrol` (11 tutarlılık sorgusu), `denetim` (sızıntı), `duman` (31 vaka), `kanit` (kanıt tablosu) — hepsi tek komut |
| **Denetim izi** | Puanı kimin verdiği, ne zaman tamamladığı kayıtlı. Tamamlanan değerlendirme değiştirilemiyor; değerlendirmesi olan hakem silinmiyor, pasife alınıyor |

---

## Doğrulama komutları

```bash
npm test                 # 101 birim testi
npm run db:kontrol       # 11 veri tutarlılığı sorgusu
npm run duman            # 31 uçtan uca vaka (sunucu çalışırken)
npm run denetim          # yarışmacı sayfası sızıntı denetimi
npm run hacim -- 3000    # performans ölçümü
npm run kanit            # kanıt tablosu — bu belgedeki sayıların kaynağı
npm run demo             # üç akışı yürünebilir hâle getir
```

---

## Bilinen sınırlar

Gizlenmiyor; sistem bunları kullanıcıya da söylüyor.

- **Canlıya alınmadı.** Veri SQLite'ta; kalıcı diskli sunucuda çalışır,
  sunucusuz ortamda (Vercel gibi) dosya kalıcı olmaz.
- **Kimlik doğrulama kullanıcı bazlı değil.** Koordinasyon ortak
  anahtarla, hakem kendi koduyla giriyor. Kim ne yaptı ayırt edilemiyor —
  değerlendirmeler hariç, onlar hakem kaydına bağlı.
- **Kaba kuvvete karşı hız sınırlama yok.** Tek koruma anahtar uzunluğu.
- **`KOORDINASYON_ANAHTARI` tanımlı değilse panel açık.** Bilinçli:
  eksikliği gizlemek yerine her ekranda uyarı gösteriliyor.
- **46 kategoride ölçüt ağırlıkları eşit dağıtılmış taslak.** Gerçek
  ağırlıklar şartnamede olabilir; uyarı veriliyor.
- **3 şablon PDF** olduğu için çözümlenemiyor; elle yükleme gerekiyor.
- **Kapaktan künye okuma her raporda tutmuyor** — alanlar tabloya ya da
  görsele gömülü olabilir. Okunamadığında kusur sayılmıyor.
- **Hakem–model farkı ölçülüyor ama örneklem küçük ve kısmen sentetik.**
  6 rapor değerlendirildi, 5'inde hakem puanıyla karşılaştırılabildi:
  ortalama fark **28,6 puan**, 1/5 değerlendirme ±5 puan içinde.

  Bu sayı sistemin kendi kendini ölçtüğünün kanıtı, ama bir kalibrasyon
  çalışması DEĞİL: karşılaştırılan hakem puanlarının bir kısmı test için
  girilmiş sentetik puanlar. Gerçek kalibrasyon, gerçek hakemlerin gerçek
  raporlara verdiği puanlarla yapılmalı. Mekanizma hazır — panoda
  görünüyor ve `npm run kanit` ile raporlanıyor; eksik olan veri.
