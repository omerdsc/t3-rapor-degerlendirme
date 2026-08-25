# Canlıya Alma — Oracle Cloud (ücretsiz)

Hedef: `https://tprds.duckdns.org` gibi bir adreste, hep açık, ücretsiz.

**Neden Oracle?** Sistem dosya tabanlı SQLite kullanıyor ve yüklenen
belgeleri diske yazıyor — **kalıcı disk** şart. Bu yüzden Vercel/Netlify
gibi sunucusuz platformlar çalışmaz (her istekte disk sıfırlanır).
Oracle'ın "Always Free" katmanı kalıcı olarak ücretsiz: 4 çekirdek ARM,
24 GB RAM, 200 GB disk. Kart doğrulaması ister, ücret çekmez.

---

## 0 · Yerelde hazırlık (~10 dk)

```bash
npm run build           # üretim derlemesi
npm run dagitim:veri    # TEMİZ veri kümesi → dagitim/veri
npm run dagitim:demo    # sentetik raporları yükle
```

`dagitim:veri` çalışan veritabanını kopyalayıp **kişiye bağlı her şeyi
siliyor**: raporlar, parmak izleri, atamalar, değerlendirmeler,
yazışmalar, hakemler ve yüklenmiş belgelerin kendisi. Geriye kamuya açık
yapılandırma kalıyor — 43 yarışma, 80 kategori, şablonlar, rubrikler.
Betik sonunda "Yarışmacı belgesi ve kişi kaydı YOK" doğrulamasını
yapıyor; bu satırı görmeden devam etmeyin.

`dagitim:demo` projenin kendi sentetik üreticilerinden 12 rapor yükler,
**iki ayrı kategoriye**:

| Kategori | Set | Ne gösteriyor |
|---|---|---|
| İnsanlık Yararına · Lise | K01–K05 | Kopya tespiti: K01↔K03 görsel kopya (1.00), K01↔K04 metin kopyası (0.96), K02 temiz |
| Sıfır Atık | 01–07 | Şablon uyumu, eksik kaynakça, karşılıksız atıf, eski şablon, taranmış belge |

> Ayrı kategoriler zorunlu: 01–07 fixture'ları aynı temel metinden
> türüyor. Aynı havuza konsalar 66 çiftin 35'i işaretlenir ve kopya
> tespiti aşırı hassas görünür. Ölçüldü.

---

## 1 · Sunucu aç (~20 dk)

1. [cloud.oracle.com](https://cloud.oracle.com) → ücretsiz hesap.
   Bölge olarak **Frankfurt** veya **Amsterdam** seçin (Türkiye'ye yakın).
2. **Compute → Instances → Create Instance**
   - Image: **Ubuntu 24.04**
   - Shape: **Ampere · VM.Standard.A1.Flex** → 2 OCPU / 12 GB
     *(Always Free sınırı 4 OCPU/24 GB; yarısını almak kapasite bulma
     ihtimalini artırıyor)*
   - SSH anahtarınızı yükleyin, public IP açık kalsın.
3. **Kapasite hatası alırsanız** ("Out of host capacity") başka bir
   bölge deneyin veya birkaç saat sonra tekrarlayın — ARM makineler
   ücretsiz katmanda sık doluyor.
4. **Networking → VCN → Security List** → ingress kuralı ekleyin:
   `0.0.0.0/0` için TCP **80** ve **443**.

## 2 · Alan adı (~5 dk, ücretsiz)

[duckdns.org](https://duckdns.org) → GitHub ile giriş → alt alan adı
oluşturun (`tprds`) → sunucunun public IP'sini yazın.
Sonuç: `tprds.duckdns.org`.

## 3 · Sunucuyu kur

```bash
ssh ubuntu@<SUNUCU-IP>

# Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu && exit     # çıkıp tekrar girin
ssh ubuntu@<SUNUCU-IP>

# Oracle imajı iptables'ı kilitli getiriyor; 80/443 açılmalı
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

> Bu adım atlanırsa site dışarıdan açılmaz ve sebebi hiçbir günlükte
> görünmez — Oracle'ın Ubuntu imajındaki varsayılan güvenlik duvarı
> yalnızca 22'yi açık bırakıyor.

## 4 · Projeyi kopyala

Yerelden (yeni terminal):

```bash
cd ~/OneDrive/Desktop/T3/dorduncu-goz
tar --exclude=node_modules --exclude=.next --exclude=veri \
    --exclude=.git --exclude='.env*' -czf /tmp/tprds.tgz .
scp /tmp/tprds.tgz ubuntu@<SUNUCU-IP>:~/
```

Sunucuda:

```bash
mkdir -p ~/tprds && tar -xzf ~/tprds.tgz -C ~/tprds && cd ~/tprds
cp .env.sunucu.ornek .env.sunucu
nano .env.sunucu        # aşağıya bakın
```

`.env.sunucu` içinde **en az** şu ikisi:

```
TPRDS_ALAN_ADI=tprds.duckdns.org
KOORDINASYON_ANAHTARI=<openssl rand -base64 32 çıktısı>
```

> **Anahtarsız açılmıyor.** Üretimde `KOORDINASYON_ANAHTARI` yoksa
> uygulama her isteğe 500 dönüyor. Bilinçli bir karar: anahtarsız panele
> erişen herkes bütün veriyi dışa aktarabilir ve ücretli yapay zekâ
> çağrısı başlatabilir.

## 5 · Başlat

```bash
docker compose up -d --build     # ilk derleme ~5 dk (ARM)
docker compose logs -f tprds
```

Caddy sertifikayı kendisi alıyor. `https://tprds.duckdns.org` açılmalı.

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
# yerelde: yeni tar, scp
# sunucuda:
cd ~/tprds && tar -xzf ~/tprds.tgz && docker compose up -d --build
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
| Site dışarıdan açılmıyor | Adım 3'teki iptables kuralları veya Oracle Security List eksik. |
| Sertifika alınamıyor | DuckDNS kaydı sunucunun IP'sini göstermiyor, ya da 80 kapalı (Let's Encrypt doğrulaması 80'i kullanıyor). |
| `disk I/O error` | Veri dizini SQLite'ın WAL modunu desteklemiyor (ağ diski, Windows bind-mount). Yerel diske taşıyın. |
