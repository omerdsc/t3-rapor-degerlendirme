# Şartname Karşılığı — Problem 4

Bu belge, problem tanımındaki her zorunluluğun nerede karşılandığını ve
karşılandığına dair **ölçülmüş kanıtı** gösterir. Tablodaki sayılar iddia
değil, `scripts/kanit-topla.ts` çıktısıdır — depodan ve çalışan koddan
okunur, elle yazılmaz.

Ölçüm tarihi: 2026-08-24 · Veri: SQLite · Üç ayrı portal

---

## 1 · Zorunlu maddeler

| # | Zorunluluk | Nerede | Ölçülmüş kanıt |
|---|---|---|---|
| 1 | **Dil uygunluğu** — rapor beklenen dilde mi | `src/lib/analiz/dil.ts` | 9/9 raporda çalıştı · `DIL_BOLUM_SAPMASI` 4 kez üretildi |
| 2 | **Şablon uygunluğu** — yarışmanın şablonuna uyuyor mu | `src/lib/analiz/sablon.ts`, `sablon-cikar.ts` | 9/9 rapor · `SABLON_ESKI` 5 kez · 74 şablondan rubrik çıkarıldı |
| 3 | **Başlık ve içerik kontrolü** — bölümler var mı, dolu mu | `sablon.ts`, `kaynakca.ts` | 9/9 rapor · `BASLIK_EKSIK` 25, `BOLUM_YETERSIZ` 5 |
| 4 | **Kategori uygunluğu** — doğru yarışmaya mı başvurulmuş | `kategori.ts`, `terim-cikar.ts` | 9/9 rapor · 70 gerçek şartname profiline karşı |
| 5 | **Benzerlik analizi** — kopya/intihal taraması | `benzerlik.ts`, `phash.ts` | 7 raporda parmak izi · `BENZERLIK_METIN` 6, `BENZERLIK_GORSEL` 4 |
| 6 | **Yapay zekâ ile kriter değerlendirmesi** | `src/lib/ai/degerlendirme.ts` | 3 rapor değerlendirildi · rapor başına **$0,18** |

**1–5 arası maddelerin hiçbiri dil modeli çağırmaz.** PDF ayrıştırma, Türkçe
metin onarımı, şablon eşleştirme, kaynakça analizi, kaynak doğrulama, TF-IDF
içerik eşleştirme, MinHash metin benzerliği ve algısal görsel karşılaştırma
saf koddur. **İşletme maliyeti $0.** Ücret yalnızca 6. maddede ve şartname
özetinde.

---

## 2 · Kullanıcı rolleri

| Rol | Ne yapar | Ekran |
|---|---|---|
| **Yarışma Yöneticisi** | Yarışmayı kurar, şablon/şartname yükler, ölçütleri onaylar veya kendi ölçütünü ekler | `/koordinasyon/yarismalar` |
| **Değerlendirme Yöneticisi (Koordinasyon)** | Hakem kaydeder, raporları dağıtır, iş yükünü ve sonuçları izler, kopya taraması yapar | `/koordinasyon`, `/koordinasyon/hakemler`, `/koordinasyon/benzerlik` |
| **Hakem** | Kendi panelinden yalnızca atanmış raporları açar, bulguları ve öneriyi inceler, **puanı kendisi verir** | `/hakem/<kod>` |
| **Yarışmacı** | Hakem tamamladıktan sonra kendi sonucunu ve geri bildirimini görür | `/sonuc` |

Roller ayrı **portallarla** ayrılmıştır ve ayrım veri tarafında uygulanır:

- Hakem paneli yalnızca `hakeminIsleri()` çağırıyor; o sorgu atama tablosuna
  bağlı. Atanmamış rapora hem sayfa (404) hem API (403) kapalı.
- Hakem, takım adlarını rumuzla görüyor; öteki hakemlerin puanı ve nihai
  puan görünmüyor (yakınsama/anchoring önlemi).
- Yarışmacı portalında yapay zekâ puanı, güven etiketleri ve
  `aiDegerlendirme` alanı hiç bulunmuyor — HTML kaynağında da yok.
- Portallar arasında gezinme bağlantısı yok.

Eksik olan yalnızca **kimlik doğrulama**: hakem erişim kodu vekil çözüm,
koordinasyon portalı korumasız (bkz. §6).

---

## 3 · Üç temel akış

### AKIŞ 01 · Yarışma kurulumu
`/koordinasyon/yarismalar` → yarışma seç → **Kur** (ücretsiz) → şablon ve şartname
indirilir, çözümlenir, değerlendirme ölçütleri çıkarılır → yönetici ölçütleri
gözden geçirip **onaylar**.

Ölçüm: 60 yarışma katalogda, **43'ü kurulu**, 80 kategori, 70'inde şartname
bağlı. 74 şablondan rubrik çıkarıldı.

### AKIŞ 02 · Rapor değerlendirme
`/koordinasyon/raporlar` → rapor yükle (çoklu dosya; kimlik rapor kapağından
okunuyor) → otomatik kontroller anında koşar →
`/koordinasyon/hakemler` → raporlar hakemlere dağıtılır →
`/hakem/<kod>` → hakem kendi panelinden açar, bulguları ve öneriyi inceler,
**puanı kendisi verir** → sonuç koordinasyon panelinde birikir.

Bir rapora birden çok hakem atanabilir; **puanlar birbirini ezmez**. Nihai
puan tamamlanmış değerlendirmelerin ortalaması, hakemler arası ayrışma
ayrıca hesaplanıp uyarı olarak gösteriliyor. Rapor, atanmış bütün hakemler
bitirmeden "tamamlandı" sayılmıyor.

Ölçüm: 6 kontrol ailesi çalıştı; iki hakemin aynı rapora verdiği 85,2 ve
55,2 puan ayrı ayrı korundu, nihai puan 70,2 ve 30 puan ayrışma
işaretlendi.

### AKIŞ 03 · Yarışmacıya geri bildirim
`/sonuc` → başvuru numarası → **yalnızca hakem tamamladıysa** açılır.

Sızıntı denetimi: yapay zekâ puanı, güven etiketleri ve `aiDegerlendirme`
alanının hiçbiri yarışmacı sayfasında görünmüyor — HTML kaynağında da yok.
Hakemin ayrıldığı kriterlerde yapay zekâ gerekçesi **gösterilmez**, hakemin
kendi notu gösterilir (çelişkili geri bildirim engellendi).

---

## 4 · Şartnamede istenmeyen ama eklediklerimiz

| Ek | Neden değerli |
|---|---|
| **TEKNOFEST kataloğu** — 60 yarışma, 260 belge otomatik çekiliyor | Koordinasyon her yarışmayı elle kurmuyor; sistem kurulur kurulmaz tüm yarışmalar hazır |
| **Kaynak doğrulama** (Crossref + OpenAlex) | Yapay zekâ ile yazılan raporlar var olmayan kaynak uydurabiliyor. 6 kaynak akademik indekste doğrulandı, 18'i indekslenemez çıktı |
| **Teknik şartname desteği** | Puanlama ağırlıkları genel şartnamede değil teknik şartnamede. 4 yarışmada bulundu ve okundu |
| **Kimlik maskeleme + kör puanlama** | Hakem takım adını görmez; yanlılık azalır, kişisel veri ekrana düşmez. Arama gerçek veriyle sunucuda çalışır |
| **Rapor kapağından kimlik okuma** | Kapak künyesi başvuruyla çelişirse yakalanır — yanlış dosya yüklenmiş olabilir |
| **Yerinde şablon güncelleme** | TEKNOFEST şablonu yıl içinde değiştirebiliyor. Güncelleme hakem puanlarını, yüklenmiş raporları ve elle eklenen ölçütleri **korur** |
| **Şekil okuma** | Akış şemasını görsel olarak çizen raporlar cezalandırılmıyor; şekiller modele ayrıca veriliyor |
| **Takvim eşlemesi** | Şartname takviminden hangi aşamada olunduğu çözülüyor |
| **İki katmanlı maliyet koruması** | Disk önbelleği + bütçe tavanı; aynı rapor ikinci kez ücretlendirilmiyor |
| **Kendi kendini ölçme** | Sistem, yapay zekâ önerisi ile hakem puanı arasındaki farkı ölçüp panoda gösteriyor |
| **Çok hakemli değerlendirme** | Bir rapora birden çok hakem atanabiliyor; puanlar ayrı kayıtta, nihai puan ortalama, hakemler arası ayrışma uyarı olarak bildiriliyor |
| **Ayrı hakem portalı** | Hakem yalnızca kendisine atanmış raporları görüyor; erişim denetimi hem sayfada hem API'de |
| **Toplu ve dengeli atama** | "Atanmamış 40 raporu şu 5 hakeme dağıt" tek tıklama; her hakeme yakın sayıda rapor düşüyor |
| **Denetim izi** | Puanı kimin verdiği, ne zaman tamamladığı kayıtlı. Tamamlanan değerlendirme değiştirilemiyor; değerlendirmesi olan hakem silinmiyor, pasife alınıyor |

---

## 5 · Doğrulama

| Ne | Nasıl |
|---|---|
| Yapısal kontroller | 7 sentetik fikstür (`test-verisi/raporlar/`) — her biri belirli bir kusuru taşıyor |
| Benzerlik | 5 raporluk korpus (`test-verisi/korpus/`) — 3 kurgu vaka: görsel kopya, kısmi metin kopyası, devam projesi. **Üçü de yakalandı** |
| Kimlik çıkarımı | 4 şablon biçimi + kasıtlı uyuşmazlık senaryosu (`scripts/kimlik-test.ts`, `kimlik-uctan-uca.ts`) |
| Katalog | 81 kategorinin şablonu indirilip çözümlendi (`scripts/katalog-dogrula.ts`) — 74 başarılı |
| Gerçek belgeler | 2 gerçek TEKNOFEST raporu, 2 gerçek şablon, 3 gerçek şartname |

Kısmi kopya vakası önemli: **Jaccard %16** ile eşiğin altında kalıyor,
**kapsama oranı %31** ile yakalanıyor. Ölçüt seçiminin sonucu doğrudan
değiştirdiği bir durum.

---

## 6 · Bilinçli sınırlar

Bunlar gizlenmiyor; sistem her birini kullanıcıya da söylüyor.

| Sınır | Neden böyle |
|---|---|
| **Canlıya alınmadı** | Veri SQLite'ta (`node:sqlite`, sıfır bağımlılık); kalıcı diskli bir sunucuda sorunsuz çalışır ama sunucusuz ortamda dosya kalıcı olmaz |
| **Kimlik doğrulama yok** | Hakem erişim kodu hem kimlik hem yetki: kodu bilen o hakem adına iş görür. Koordinasyon portalı korumasız — canlıda kurum ağı ya da oturum arkasına alınmalı. Tek yerde toplandığı için bağlaması kolay |
| **46 kategoride ağırlıklar eşit dağıtılmış** | Şablon puan vermemiş; gerçek ağırlık şartnamede. Sistem bunu **uyarıyla** bildiriyor, sessizce uydurmuyor |
| **3 şablon PDF** | Şablon çıkarıcı Word stil bilgisine dayanıyor. Bu kategoriler "elle yüklenmeli" olarak işaretli |
| **Kapaktan kimlik her raporda okunmuyor** | Elimizdeki iki gerçek raporda alanlar tabloya/görsele gömülü. Okunamadığında "okunamadı" denir, kusur sayılmaz |
| **Hakem–yapay zekâ farkı 2 ölçümle hesaplandı** | Anlamlı kalibrasyon için daha çok tamamlanmış değerlendirme gerekiyor |

---

## 7 · Tasarımın temel ilkesi

> Yapay zekâ nihai karar verici değildir.

Bu bir slogan değil, kodda uygulanan bir kısıt:

- Hakem puanı girmeden rapor **tamamlanamaz**; yapay zekâ puanı yalnızca öneri.
- Yapay zekâ emin değilse `hakemIncelemesiGerekli` işaretler ve güveni düşürür.
- Şartnamenin katı kısıtlarına aykırılık **kriter puanını düşürmez**, ayrı bir
  uyarı olarak bildirilir — puanı düşürmek ihlali gizlerdi.
- Dil ve yazım kalitesi teknik kriterlerin puanını etkilemez; imkânları
  kısıtlı okullardan gelen takımlar cezalandırılmasın.
- Çıkarılan her ölçüt **taslaktır** ve yönetici onaylamadan "onaylı"
  görünmez.
