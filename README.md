# 4. GÖZ — Yapay Zekâ Destekli Değerlendirme Sistemi

T3 Vakfı Bursiyer Yapay Zekâ Creathonu · **Problem 4**
TEKNOFEST Yarışmalar Koordinatörlüğü için hakem karar destek sistemi.

> Yapay zekâ nihai karar verici değildir. Sistem, hakeme kontrol, analiz ve
> ön değerlendirme sunan bir **destek katmanı** olarak çalışır.

---

## Çalıştırma

```bash
npm install
npm run dev              # http://localhost:3000
```

Test setleri ve komut satırı analizi:

```bash
# Yapısal kontroller (MVP 1-2-3)
npx tsx scripts/ornek-rapor-uret.ts    # 7 sentetik rapor
npx tsx scripts/analiz-et.ts           # hepsini analiz eder
npx tsx scripts/analiz-et.ts yol.pdf   # tek dosya

# Benzerlik (MVP 5)
npx tsx scripts/korpus-uret.ts         # 5 raporluk benzerlik korpusu
npx tsx scripts/korpus-tara.ts         # çiftler arası tarama
```

---

## Durum

| MVP maddesi | Durum | Nerede |
|---|---|---|
| 1-2 · Dil ve şablon uygunluğu | ✅ | `src/lib/analiz/dil.ts`, `sablon.ts` |
| 3 · Başlık ve içerik kontrolü | ✅ | `src/lib/analiz/sablon.ts`, `kaynakca.ts` |
| 4 · Kategori uygunluğu | ✅ | `src/lib/analiz/kategori.ts` |
| 5 · Benzerlik analizi | ✅ | `src/lib/analiz/benzerlik.ts`, `phash.ts` |
| 6 · AI kriter değerlendirmesi | ⏳ | — |

**MVP 1-2-3-4-5'in tamamı hiçbir dil modeli çağırmaz.** PDF ayrıştırma, Türkçe
metin onarımı, şablon eşleştirme, kaynakça analizi, TF-IDF kategori
sınıflandırma, MinHash metin benzerliği ve pHash görsel benzerliğin hepsi saf
koddur; işletme maliyeti sıfırdır. Model yalnızca kriter değerlendirmesinde
(MVP 6) devreye girecek — tek ücretli kalem orası.

Ortalama süre: **~100 ms/rapor** (yapısal), **~130 ms/rapor** (parmak izi dâhil).

---

## Mimari kararlar

**Şablon koda gömülü değildir.** `Sablon` bir veri tipidir; motor hiçbir yerde
"Proje Özeti" veya "Kaynakça" diye bir başlık bilmez. Farklı yarışma = farklı
`Sablon` nesnesi, kod değişikliği yok. Kaynakça beklentisi bile şablona
bağlıdır — bazı yarışmalar kaynakça istemez.

**Deterministik katman "var mı" sorusunu yanıtlar, "yeterli mi" sorusunu
değil.** Bölümün doldurulup doldurulmadığı yapısal olarak ölçülür; içeriğin
derinliği rubrik bazlı AI değerlendirmesinin işidir. Uydurma eşiklerle rapor
işaretlemek hakemi yanlış yönlendirir — bu yüzden şartnameden gelmeyen sayfa
ve kelime sınırları tanımsız bırakılmıştır.

**Türkçe metin onarımı zorunludur.** Gerçek raporlarda font encoding yüzünden
`ş → s¸`, `ı → ` gibi bozulmalar yaygındır. Başlık eşleştirmesi bu yüzden
aksan duyarsız ve fuzzy çalışır. bkz. `docs/gercek-dunya-sorunlari.md`

**Sayfa başlığı/altlığı ayıklanır.** Her sayfada tekrar eden
`TEKNOFEST 2026 | Takım Adı | Sayfa 4` satırı metinde bırakılırsa bütün
raporlar birbirine benzer çıkar ve benzerlik analizi (MVP 5) değersizleşir.

---

## Yapı

```
src/lib/analiz/
  tipler.ts       ortak tipler, Sablon tanımı
  normalize.ts    Türkçe onarım, ligatür, fuzzy eşleştirme
  pdf.ts          koordinatlı metin + görsel çıkarma (tek geçiş)
  yapi.ts         satır kurma, header/footer ayıklama, başlık tespiti
  dil.ts          dil tespiti (MVP 1)
  sablon.ts       şablon + başlık kontrolü (MVP 1-2-3)
  kaynakca.ts     kaynakça derin analizi
  kategori.ts     TF-IDF kategori uyumu (MVP 4)
  benzerlik.ts    MinHash + kapsama + cümle eşleştirme (MVP 5)
  phash.ts        algısal hash — görsel kopya tespiti
  sablonlar.ts    TEKNOFEST şablon tanımları
  kategoriler.ts  yarışma kategorileri
  index.ts        boru hattı

src/app/api/analiz/route.ts    POST: PDF → analiz sonucu
src/components/analiz-paneli.tsx

scripts/rapor-yazici.ts        ortak PDF üretim altyapısı (PNG kodlayıcı dâhil)
scripts/ornek-rapor-uret.ts    yapısal fixture'lar
scripts/analiz-et.ts           CLI tek rapor analizi
scripts/korpus-uret.ts         benzerlik korpusu
scripts/korpus-tara.ts         CLI korpus taraması
docs/gercek-dunya-sorunlari.md dayanıklılık gereksinimleri
design/                        arayüz tasarımı (6 ekran)
```

---

## Benzerlik analizi

İki bağımsız kanal çalışır:

| Kanal | Yöntem | Ne yakalar |
|---|---|---|
| Metin | Cümle shingle + MinHash + **kapsama oranı** | Kopyalanmış paragraf |
| Görsel | pHash (32×32 DCT → 64 bit) | Aynı şekil, farklı metin |

**Kapsama oranı, Jaccard yerine kullanılır.** Bir rapor diğerinin yalnızca iki
bölümünü kopyaladığında Jaccard seyrelir ve kopya kaçar. Kapsama "küçük
belgenin ne kadarı öbüründe var" sorusunu sorar. Test korpusunda K01↔K04
çiftinde Jaccard %16 (eşiğin altında), kapsama %30 → yakalandı.

**Karşılaştırma öncesi çıkarılanlar:** şablon yönerge metni, zorunlu başlıklar,
sayfa başlığı/altlığı, kaynakça. Çıkarılmazsa bütün raporlar birbirine benzer
çıkar ve modül değersizleşir.

**Kategori tabanı.** Sabit eşik kullanılmaz; her kategorinin doğal benzerlik
tabanı (ortanca) hesaplanır, eşik `taban + 3×MAD` olur. Aynı alandaki
raporların ortak terminolojisi böylece gürültü üretmez.

**Aynı takım = devam projesi.** Takım kimliği eşleşen çiftler intihal değil,
`BENZERLIK_DEVAM_PROJESI` olarak etiketlenir.

### Korpus test sonuçları

| Çift | Beklenen | Sonuç |
|---|---|---|
| K01 ↔ K03 | Görsel kopya (aynı şekil, farklı metin) | ✅ görsel %100, kapsama %0 |
| K01 ↔ K04 | Metin kopyası (2 bölüm birebir) | ✅ kapsama %30, 8 cümle |
| K01 ↔ K05 | Devam projesi (aynı takım) | ✅ intihal olarak işaretlenmedi |
| K02 | Hiçbir eşleşme | ✅ temiz |

---

## Kaynakça kontrolü

Hakemlerin ilk baktığı yerlerden biri. "Başlık var" demek yetmez; üç şey ayrı
ayrı ölçülür:

| Kod | Ne yakalar |
|---|---|
| `KAYNAKCA_YOK` | Bölüm hiç yok |
| `KAYNAKCA_BOS` | Başlık var, ayrıştırılabilir künye yok |
| `KAYNAKCA_AZ` | Şablonun beklediği asgari kaynak sayısının altında |
| `ATIF_YOK` | Liste dolu ama metinde tek atıf yok — sonradan eklenmiş kaynakça |
| `ATIF_KARSILIKSIZ` | Metinde `[7]` var, listede 5 kaynak |
| `KAYNAK_ATIFSIZ` | Listede var, metinde hiç kullanılmamış |
| `KAYNAK_NITELIKSIZ` | Yıl/künye yok, çıplak bağlantı |

---

## Test korpusu

`test-verisi/raporlar/` altındaki 7 sentetik rapor aynı zamanda regresyon
test setidir. Her biri belirli bir bozulmayı taşır; `01-temiz.pdf` **sıfır
bulgu** vermelidir (yanlış pozitif kontrolü).

## Eksik girdiler

- **Resmî TEKNOFEST rapor şablonu** — `sablonlar.ts` içindeki `yonergeMetni`
  alanları şablonun birebir kendi cümleleriyle doldurulmalı. "Doldurulmamış
  bölüm" tespitinin isabeti buna bağlı.
- **Şartname** — sayfa sınırı, dil beklentisi, zorunlu bölümler.
- **Değerlendirme kriterleri ve rubrik** — MVP 6 için.
