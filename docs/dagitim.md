# Canlıya Alma — DigitalOcean

Hedef: `https://tprds.duckdns.org` gibi bir adreste, hep açık.
Yeni hesaba verilen **$200 / 60 gün** kredi yarışma süresini karşılıyor.

## Neden bulut sunucu, neden sunucusuz değil

Sistem dosya tabanlı SQLite kullanıyor ve yüklenen belgeleri diske yazıyor —
**kalıcı disk** şart. Vercel/Netlify gibi sunucusuz platformlarda her istekte
disk sıfırlanır ve veritabanı kaybolur.

## Sağlayıcı seçimi — iki kez değişti

| Sağlayıcı | Neden bırakıldı |
|---|---|
| Oracle (ücretsiz) | Ücretsiz ARM makineler Frankfurt'un üç availability domain'inde de dolu (`Out of capacity`). Kapasite gün içinde açılıp kapanıyor; teslim tarihi olan iş için kullanılamaz. |
| Hetzner (€3.79/ay) | Hesap doğrulaması için kartla **$25 peşin bakiye** istedi. Ücretsiz belge doğrulaması var ama insan onayı saatler sürüyor. |
| **DigitalOcean** | Kart doğrulaması ~$1 geçici bloke. Yeni hesaba $200/60 gün kredi. Anında kurulum. |

**Kapsayıcı düzeni üç sağlayıcıda da aynı** — `Dockerfile`, `docker-compose.yml`,
`Caddyfile` ve `scripts/sunucu-kur.sh` hiç değişmedi. Bağımlılık Ubuntu'ya,
sağlayıcıya değil. Değişen tek şey sunucunun nereden alındığı.

---

## 0 · Yerelde hazırlık (~10 dk)

```bash
npm run build           # üretim derlemesi
npm run dagitim:veri    # TEMİZ veri kümesi -> dagitim/veri
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
| İnsanlık Yararına · Lise | K01-K05 | Kopya tespiti: K01/K03 görsel kopya (1.00), K01/K04 metin kopyası (0.96), K02 temiz |
| Sıfır Atık | 01-07 | Şablon uyumu, eksik kaynakça, karşılıksız atıf, eski şablon, taranmış belge |

> Ayrı kategoriler zorunlu: 01-07 fixture'ları aynı temel metinden türüyor.
> Aynı havuza konsalar 66 çiftin 35'i işaretlenir ve kopya tespiti aşırı
> hassas görünür. Ölçüldü.

`npm run paket` arşivi üretip **içini okuyor**: gerçek veri dizini,
`ornek_rapor`, `.env` dosyaları ve beklenmedik konumda bir PDF bulunursa
paket siliniyor.

## 1 · SSH anahtarı

```bash
ssh-keygen -t ed25519 -C "tprds-sunucu" -f ~/.ssh/tprds -N ""
cat ~/.ssh/tprds.pub          # panele yapıştırılacak ACIK anahtar
```

## 2 · Droplet aç (~8 dk)

[digitalocean.com](https://www.digitalocean.com) -> Sign up (GitHub/Google ile
olur) -> kart ekle. Kayıt sonrası **Billing -> Credits** sayfasında $200
kredinin göründüğünü teyit edin; görünmüyorsa makine boyutunu ona göre seçin.

**Create -> Droplets**

| Alan | Seçim |
|---|---|
| Region | **Frankfurt** (Türkiye'ye en yakın) |
| Image | Ubuntu **24.04 (LTS) x64** |
| Droplet type | Basic -> Regular (SSD) |
| Size | **$24/ay** · 4 GB / 2 vCPU / 80 GB — kredi varsa<br>**$12/ay** · 2 GB / 1 vCPU / 50 GB — kredi yoksa |
| Authentication | **SSH Key** -> New SSH Key -> `~/.ssh/tprds.pub` içeriğini yapıştır |
| Hostname | `tprds` |

**Create Droplet** -> ~45 saniye -> IPv4 adresi listede.

> **Boyut neden önemli:** kapsayıcı sunucuda derleniyor ve Next derlemesi
> tepe noktada ~1.5 GB bellek istiyor. 1 GB'lık ($6) makinede derleme
> `Killed` ile düşer. `sunucu-kur.sh` 2 GB takas alanı açarak 2 GB'lık
> makineyi de çalışır hale getiriyor, ama 4 GB rahat olan.

## 3 · Alan adı (~3 dk, ücretsiz)

[duckdns.org](https://duckdns.org) -> giriş -> alt alan adı ekle (`tprds`) ->
**current ip** kutusuna droplet'in IPv4'ünü yaz -> *update ip*.

HTTPS sertifikası IP'ye değil isme veriliyor; bu adım olmadan site https
açılmaz.

## 4 · Paketi gönder ve kur (~7 dk)

```bash
scp -i ~/.ssh/tprds ~/tprds-sunucu.tgz root@DROPLET-IP:~/

ssh -i ~/.ssh/tprds root@DROPLET-IP
mkdir -p ~/tprds && tar -xzf ~/tprds-sunucu.tgz -C ~/tprds && cd ~/tprds
bash scripts/sunucu-kur.sh tprds.duckdns.org
```

DigitalOcean'da kullanıcı adı **`root`**.

Betik sırayla: Docker'ı kurar, takas alanı açar, güvenlik duvarını denetler
(DigitalOcean'da engelleyen kural yok, dokunmuyor), panel parolasını üretir,
uygulamayı derleyip başlatır. Sonunda adresi ve parolayı ekrana yazar —
**parolayı kaydedin**. Yarıda kalırsa baştan çalıştırılabilir; yapılmış
adımları atlıyor.

İlk derleme ~5 dakika. Sertifikayı Caddy kendisi alıyor.

> **Anahtarsız açılmıyor.** Üretimde `KOORDINASYON_ANAHTARI` yoksa uygulama
> her isteğe 500 dönüyor — giriş sayfası dahil hiçbir ekran açılmıyor.
> Bilinçli bir karar: anahtarsız panele erişen herkes bütün veriyi dışa
> aktarabilir ve ücretli yapay zekâ çağrısı başlatabilir. Betik parolayı
> kendisi üretiyor, bu yüzden normalde bu duruma düşülmüyor.

> **Kredi bitmeden sil.** 60 gün sonunda kredi düşerse ücretlendirme başlar.
> Droplet'i silmek ödemeyi durdurur; silmeden önce yedek alın (aşağıda).

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
scp -i ~/.ssh/tprds ~/tprds-sunucu.tgz root@DROPLET-IP:~/

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

## Sunucuyu tamamen kaldırma

Yarışma bittiğinde ya da kredi tükenmeden önce. Sıra önemli: **önce veri,
sonra makine.**

```bash
ssh -i ~/.ssh/tprds root@DROPLET-IP

# 1 — Yedek istiyorsanız ÖNCE alın (yoksa bu adımı atlayın)
cd ~/tprds && tar -czf ~/yedek-$(date +%F).tgz dagitim/veri
#    ve yerelden indirin:  scp -i ~/.ssh/tprds root@DROPLET-IP:~/yedek-*.tgz .

# 2 — Kapsayıcıları, ağı ve adlandırılmış hacimleri sil
cd ~/tprds && docker compose down -v

# 3 — Veri dizinini sil.  BU ADIM ATLANAMAZ.
#     `down -v` yalnızca adlandırılmış hacimleri (caddy_veri,
#     caddy_yapilandirma) siler. Yarışmacı belgeleri ve veritabanı
#     `./dagitim/veri` BIND MOUNT'unda, yani sunucunun diskinde duruyor;
#     Docker ona dokunmaz.
rm -rf ~/tprds ~/tprds-sunucu.tgz

# 4 — İmajlar ve kalan katmanlar
docker system prune -a --volumes -f

# 5 — Doğrulama: üçü de boş dönmeli
docker ps -a ; docker volume ls ; ls ~/tprds 2>/dev/null || echo "temiz"
```

Sonra **droplet'i silin** — ücretlendirmeyi durduran adım budur:
DigitalOcean paneli → *Droplets* → makine → *Destroy* → **Destroy this
Droplet**. Kapatmak (*Power off*) yetmiyor; kapalı droplet de
ücretlendiriliyor.

Son olarak alt alan adını bırakın: [duckdns.org](https://duckdns.org) →
`tprds` satırı → *delete*. Bırakılmazsa adı başkası alamaz ve IP'si artık
size ait olmayan bir makineye işaret eder.

> Disk imajını (snapshot) aldıysanız onu da silin — droplet gitse bile
> snapshot ayrıca ücretlendirilir ve veriyi içinde taşır:
> *Images → Snapshots → Destroy*.

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
| `Permission denied (publickey)` | `-i ~/.ssh/tprds` atlanmış, ya da kullanıcı adı `ubuntu` yazılmış — DigitalOcean'da `root`. |
| Sertifika alınamıyor | DuckDNS kaydı sunucunun IP'sini göstermiyor, ya da 80 kapalı (Let's Encrypt doğrulaması 80'i kullanıyor). |
| `disk I/O error` | Veri dizini SQLite'ın WAL modunu desteklemiyor (ağ diski, Windows bind-mount). Yerel diske taşıyın. |
