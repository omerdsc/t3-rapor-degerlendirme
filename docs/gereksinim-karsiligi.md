# Şartname Karşılığı — Problem 4

Bu belge, problem tanımındaki her zorunluluğun nerede karşılandığını ve
karşılandığına dair **ölçülmüş kanıtı** gösterir. Tablodaki sayılar iddia
değil, `scripts/kanit-topla.ts` çıktısıdır — depodan ve çalışan koddan
okunur, elle yazılmaz.

Ölçüm tarihi: 2026-08-24 · Kod: 77 dosya, ~15.000 satır

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
| **Yarışma Yöneticisi** | Yarışmayı kurar, şablon/şartname yükler, değerlendirme ölçütlerini onaylar veya kendi ölçütünü ekler | `/yarismalar`, `/yarismalar/[id]` |
| **Hakem** | Raporu açar, otomatik bulguları ve yapay zekâ önerisini inceler, **nihai puanı kendisi verir** | `/raporlar`, `/rapor/[id]` |
| **Değerlendirme Yöneticisi (Koordinasyon)** | İş yükünü izler, kopya taraması yapar, hakemle yazışır | `/`, `/benzerlik`, rapor içi yazışma |
| *(dolaylı)* **Yarışmacı** | Yalnızca hakem tamamladıktan sonra kendi sonucunu ve geri bildirimini görür | `/sonuc` |

Roller ayrı hesaplarla değil ayrı **ekranlarla** ayrılmıştır; yetkilendirme
canlı kuruluma bırakıldı (bkz. §6).

---

## 3 · Üç temel akış

### AKIŞ 01 · Yarışma kurulumu
`/yarismalar` → yarışma seç → **Kur** (ücretsiz) → şablon ve şartname
indirilir, çözümlenir, değerlendirme ölçütleri çıkarılır → yönetici ölçütleri
gözden geçirip **onaylar**.

Ölçüm: 60 yarışma katalogda, **43'ü kurulu**, 80 kategori, 70'inde şartname
bağlı. 74 şablondan rubrik çıkarıldı.

### AKIŞ 02 · Rapor değerlendirme
`/raporlar` → rapor yükle (çoklu dosya) → otomatik kontroller anında koşar →
hakem raporu açar, bulguları ve yapay zekâ önerisini görür → **puanı hakem
verir** → tamamlanır.

Ölçüm: 9 rapor işlendi, 6 kontrol ailesi çalıştı, 2 rapor hakem tarafından
tamamlandı.

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
| **Canlıya alınmadı** | Depo dosya sistemine yazıyor; sunucusuz ortamda kalıcı değil. Veritabanı katmanı gerekiyor |
| **Yetkilendirme yok** | Roller ekranla ayrılmış, hesapla değil. Kurum kimlik sistemine bağlanması gerekir |
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
