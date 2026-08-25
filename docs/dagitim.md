# Canlıya Alma — Hetzner Cloud

Hedef: `https://tprds.duckdns.org` gibi bir adreste, hep açık.
Aylık **€3.79** (saatlik ücretleniyor; sunucu silinince ödeme durur).

## Neden bulut sunucu, neden sunucusuz değil

Sistem dosya tabanlı SQLite kullanıyor ve yüklenen belgeleri diske yazıyor —
**kalıcı disk** şart. Vercel/Netlify gibi sunucusuz platformlarda her istekte
disk sıfırlanır ve veritabanı kaybolur.

## Neden Hetzner, neden Oracle değil

İlk hedef Oracle'ın kalıcı ücretsiz katmanıydı ve teknik olarak uygundu.
Pratikte olmadı: ücretsiz ARM makineler Frankfurt'un üç availability
domain'inde de dolu çıktı (`Out of capacity for shape VM.Standard.A1.Flex`).
Kapasite gün içinde açılıp kapanıyor, yani ne zaman kurulacağı belirsiz.

Hetzner'e geçiş ayrıca iki adımı tamamen kaldırdı:

| | Oracle | Hetzner |
|---|---|---|
| Sanal ağ (VCN + subnet + internet gateway) | 4 ekran, elle | yok |
| Güvenlik duvarı (iptables + Security List) | elle, atlanırsa site sessizce açılmıyor | gerek yok |
| Kapasite beklemesi | saatler | yok |
| Kurulum adımı | 5 | 4 |

Kapsayıcı düzeni ikisinde de aynı — Dockerfile, compose, Caddy ve kurulum
betiği değişmedi. Değişen tek şey sunucunun nereden alındığı.

---

## 0 · Yerelde hazırlık (~10 dk)

```bash
npm run build           # üretim derlemesi
npm run dagitim:veri    # TEMİZ veri kümesi → dagitim/veri
npm run dagitim:demo    # sentetik raporları yükle
npm run paket           # ~/tprds-sunucu.tgz + sızıntı denetimi
```

`dagitim:veri` çalışan veritabanını kopyalayıp **kişiye bağlı her şeyi
siliyor**: raporlar, parmak izleri, atamalar, değerlendirmeler, yazışmalar,
hakemler ve yüklenmiş belgelerin kendisi. Geriye kamuya açık yapılandırma
kalıyor — 43 yarışma, 80 kategori, şablonlar, rubrikler. Betik sonunda
"Yarışmacı belgesi ve kişi kaydı YOK" doğrulamasını yapıyor; bu satırı
görmeden devam etmeyin.

`dagitim:demo` projenin kendi sentetik üreticilerinden 12 rapor yükler,
**iki ayrı kategoriye**:

| Kategori | Set | Ne gösteriyor |
|---|---|---|
| İnsanlık Yararına · Lise | K01–K05 | Kopya tespiti: K01↔K03 görsel kopya (1.00), K01↔K04 metin kopyası (0.96), K02 temiz |
| Sıfır Atık | 01–07 | Şablon uyumu, eksik kaynakça, karşılıksız atıf, eski şablon, taranmış belge |

> Ayrı kategoriler zorunlu: 01–07 fixture'ları aynı temel metinden türüyor.
> Aynı havuza konsalar 66 çiftin 35'i işaretlenir ve kopya tespiti aşırı
> hassas görünür. Ölçüldü.

`npm run paket` arşivi üretip **içini okuyor**: gerçek veri dizini,
`ornek_rapor`, `.env` dosyaları ve beklenmedik konumda bir PDF bulunursa
paket siliniyor. `--exclude` listesi bugün doğru; denetim onun yarın yanlış
yazılmasına karşı.

## 1 · SSH anahtarı

```bash
ssh-keygen -t ed25519 -C "tprds-sunucu" -f ~/.ssh/tprds -N ""
cat ~/.ssh/tprds.pub          # Hetzner'e yapıştırılacak AÇIK anahtar
```

## 2 · Sunucu aç (~10 dk)

[console.hetzner.cloud](https://console.hetzner.cloud) → **New project**
(`TPRDS`) → **Add Server**

| Alan | Seçim |
|---|---|
| Location | Falkenstein / Nuremberg |
| Image | Ubuntu **24.04** |
| Type | Shared vCPU → x86 → **CX22** (2 vCPU · 4 GB · 40 GB) |
| Networking | varsayılan (Public IPv4 açık) |
| SSH keys | `~/.ssh/tprds.pub` içeriğini yapıştır |
| Name | `tprds` |

**Create & Buy now** → ~30 saniye → IPv4 adresi listede.

> 4 GB RAM bilinçli seçim: kapsayıcı sunucuda derleniyor. 1 GB'lık bir
> makinede Next derlemesi bellek yetmezliğinden düşer; o durumda imajı
> yerelde derleyip `docker save`/`load` ile taşımak gerekir.

## 3 · Alan adı (~3 dk, ücretsiz)

[duckdns.org](https://duckdns.org) → giriş → alt alan adı ekle (`tprds`) →
**current ip** kutusuna sunucunun IPv4'ünü yaz → *update ip*.

HTTPS sertifikası IP'ye değil isme veriliyor; bu adım olmadan site https
açılmaz.

## 4 · Paketi gönder ve kur

```bash
scp -i ~/.ssh/tprds ~/tprds-sunucu.tgz root@SUNUCU-IP:~/

ssh -i ~/.ssh/tprds root@SUNUCU-IP
mkdir -p ~/tprds && tar -xzf ~/tprds-sunucu.tgz -C ~/tprds && cd ~/tprds
bash scripts/sunucu-kur.sh tprds.duckdns.org
```

Hetzner'de kullanıcı adı **`root`** (Oracle'da `ubuntu`).

Betik sırayla: Docker'ı kurar, güvenlik duvarını (varsa) açar, panel
parolasını üretir, uygulamayı derleyip başlatır. Sonunda adresi ve parolayı
ekrana yazar — **parolayı kaydedin**. Yarıda kalırsa baştan çalıştırılabilir;
yapılmış adımları atlıyor.

İlk derleme ~5 dakika. Sertifikayı Caddy kendisi alıyor.

> **Anahtarsız açılmıyor.** Üretimde `KOORDINASYON_ANAHTARI` yoksa uygulama
> her isteğe 500 dönüyor — giriş sayfası dahil hiçbir ekran açılmıyor.
> Bilinçli bir karar: anahtarsız panele erişen herkes bütün veriyi dışa
> aktarabilir ve ücretli yapay zekâ çağrısı başlatabilir. Betik parolayı
> kendisi üretiyor, bu yüzden normalde bu duruma düşülmüyor.

---

## Erişim

| Portal | Adres | Giriş |
|---|---|---|
| Koordinasyon | `/koordinasyon` | `.env.sunucu`'daki anahtar |
| Hakem | `/hakem/<KOD>` | Koordinasyon → Hakemler ekranından kopyalanır |
| Yarışmacı | `/sonuc` | Başvuru numarası |

---

## Güncelleme

```bash
# yerelde
npm run paket
scp -i ~/.ssh/tprds ~/tprds-sunucu.tgz root@SUNUCU-IP:~/

# sunucuda
cd ~/tprds && tar -xzf ~/tprds-sunucu.tgz && docker compose up -d --build
```

`dagitim/veri` klasörü **yerinde kalır** — kapsayıcı yeniden kurulsa da
veritabanı ve yüklenen belgeler kaybolmaz.

## Yedek

```bash
cd ~/tprds && tar -czf ~/yedek-$(date +%F).tgz dagitim/veri
```

---

## Bilinen sınırlar

| Sınır | Durum |
|---|---|
| **Hız sınırlama yok** | Koordinasyon anahtarına kaba kuvvet denenebilir. Tek koruma anahtar uzunluğu — en az 24 karakter kullanın. |
| **Kullanıcı hesabı yok** | Koordinasyon ortak anahtarla giriyor. Kurumsal kurulumda yerini SSO alır; değişecek tek dosya `src/lib/yetki/koordinasyon.ts`. |
| **Tek sunucu** | Yatay ölçekleme yok. SQLite tek yazıcı; ölçülen kapasite 3000 rapor / 6000 atama, liste 179 ms. |
| **Windows'ta bind-mount** | Docker Desktop üzerinde `dagitim/veri` doğrudan bağlanırsa SQLite "disk I/O error" verir (WAL, Windows dosya sistemi köprüsünde çalışmıyor). Linux sunucuda sorun yok; Windows'ta denemek için adlandırılmış birim kullanın. |
| **Yapay zekâ isteğe bağlı** | `ANTHROPIC_API_KEY` yoksa MVP 6 kapalı; deterministik kontrollerin hepsi çalışır. Tavanlar `.env.sunucu`'da — açık adreste düşük tutun. |

## Sorun giderme

| Belirti | Sebep |
|---|---|
| Her sayfa 500 | `KOORDINASYON_ANAHTARI` boş. `docker compose logs tprds` açıkça söylüyor. |
| `Permission denied (publickey)` | `-i ~/.ssh/tprds` atlanmış, ya da kullanıcı adı `ubuntu` yazılmış — Hetzner'de `root`. |
| Sertifika alınamıyor | DuckDNS kaydı sunucunun IP'sini göstermiyor, ya da 80 kapalı (Let's Encrypt doğrulaması 80'i kullanıyor). |
| `disk I/O error` | Veri dizini SQLite'ın WAL modunu desteklemiyor (ağ diski, Windows bind-mount). Yerel diske taşıyın. |
