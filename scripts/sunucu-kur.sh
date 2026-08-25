#!/usr/bin/env bash
#
# TPRDS — sunucu kurulumu, TEK KOMUT.
#
# Ubuntu 24.04 (Oracle Cloud Always Free / ARM veya x86) üzerinde
# çalışır. Docker'ı kurar, güvenlik duvarını açar, ortam dosyasını
# hazırlar ve uygulamayı ayağa kaldırır.
#
# Kullanım (sunucuda, proje klasörünün içinde):
#   bash scripts/sunucu-kur.sh tprds.duckdns.org
#
# Betik ADIM ADIM ilerliyor ve her adımda ne yaptığını söylüyor.
# Yarıda kalırsa baştan çalıştırılabilir — yapılmış adımları atlıyor.

set -euo pipefail

ALAN_ADI="${1:-}"
YESIL='\033[32m'; SARI='\033[33m'; KIRMIZI='\033[31m'; KALIN='\033[1m'; R='\033[0m'

adim() { echo -e "\n${KALIN}▸ $1${R}"; }
tamam() { echo -e "  ${YESIL}✓${R} $1"; }
uyari() { echo -e "  ${SARI}!${R} $1"; }
hata()  { echo -e "\n  ${KIRMIZI}✗ $1${R}\n"; exit 1; }

if [ -z "$ALAN_ADI" ]; then
  hata "Alan adı verilmedi.
  Kullanım:  bash scripts/sunucu-kur.sh tprds.duckdns.org"
fi

if [ ! -f docker-compose.yml ]; then
  hata "Proje klasöründe değilsiniz (docker-compose.yml bulunamadı).
  Önce:  cd ~/tprds"
fi

echo -e "\n${KALIN}TPRDS SUNUCU KURULUMU${R}"
echo   "  alan adı : $ALAN_ADI"
echo   "  klasör   : $(pwd)"

# ── 1. Docker ────────────────────────────────────────────────────────
adim "1/5 · Docker"
if command -v docker > /dev/null 2>&1; then
  tamam "zaten kurulu ($(docker --version | cut -d' ' -f3 | tr -d ,))"
else
  echo "  kuruluyor, ~2 dakika…"
  curl -fsSL https://get.docker.com | sudo sh > /dev/null 2>&1
  sudo usermod -aG docker "$USER"
  tamam "kuruldu"
  uyari "Docker grubuna eklendiniz. Bu betik bittikten sonra bir kez"
  uyari "çıkıp tekrar bağlanın (exit, sonra ssh) — yoksa docker komutları"
  uyari "her seferinde sudo ister."
fi

# ── 2. Güvenlik duvarı ───────────────────────────────────────────────
#
# Oracle'ın Ubuntu imajı iptables'ı kilitli getiriyor: yalnızca 22 açık.
# Bu adım atlanırsa site dışarıdan hiç açılmaz ve sebebi HİÇBİR günlükte
# görünmez — kapsayıcılar sağlıklı, Caddy çalışıyor, sayfa gelmiyor.
adim "2/5 · Güvenlik duvarı (80 ve 443)"
for port in 80 443; do
  if sudo iptables -C INPUT -m state --state NEW -p tcp --dport "$port" -j ACCEPT 2>/dev/null; then
    tamam "$port zaten açık"
  else
    sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport "$port" -j ACCEPT
    tamam "$port açıldı"
  fi
done
if command -v netfilter-persistent > /dev/null 2>&1; then
  sudo netfilter-persistent save > /dev/null 2>&1
  tamam "kurallar kalıcı yapıldı"
else
  sudo apt-get update -qq && sudo apt-get install -y -qq iptables-persistent > /dev/null 2>&1 || true
  sudo netfilter-persistent save > /dev/null 2>&1 || uyari "kurallar kalıcı yapılamadı; yeniden başlatmada tekrarlayın"
fi

# ── 3. Ortam dosyası ─────────────────────────────────────────────────
adim "3/5 · Ayarlar"
if [ -f .env.sunucu ] && grep -q '^KOORDINASYON_ANAHTARI=.\+' .env.sunucu; then
  tamam ".env.sunucu zaten hazır"
  ANAHTAR=$(grep '^KOORDINASYON_ANAHTARI=' .env.sunucu | cut -d= -f2-)
else
  [ -f .env.sunucu ] || cp .env.sunucu.ornek .env.sunucu
  # Panel parolası burada üretiliyor — ekranda bir kez gösterilip
  # dosyaya yazılıyor. Elle uydurulan parolalar kısa oluyor ve bu
  # kurulumda hız sınırlama yok; uzunluk tek koruma.
  ANAHTAR=$(openssl rand -base64 32 | tr -d '\n/+=' | cut -c1-32)
  sed -i "s|^TPRDS_ALAN_ADI=.*|TPRDS_ALAN_ADI=$ALAN_ADI|" .env.sunucu
  sed -i "s|^KOORDINASYON_ANAHTARI=.*|KOORDINASYON_ANAHTARI=$ANAHTAR|" .env.sunucu
  tamam "ayarlar yazıldı, panel parolası üretildi"
fi

# ── 4. Veri ──────────────────────────────────────────────────────────
adim "4/5 · Veri"
if [ -f dagitim/veri/tprds.db ]; then
  RAPOR=$(sudo docker run --rm -v "$(pwd)/dagitim/veri:/v:ro" alpine sh -c \
    "apk add --no-cache sqlite >/dev/null 2>&1 && sqlite3 /v/tprds.db 'SELECT COUNT(*) FROM rapor'" 2>/dev/null || echo "?")
  tamam "veri kümesi yerinde ($RAPOR rapor)"
else
  hata "dagitim/veri/tprds.db yok.
  Bu klasörü yerel bilgisayarınızdan kopyalamanız gerekiyor."
fi

# ── 5. Başlat ────────────────────────────────────────────────────────
adim "5/5 · Uygulama"
echo "  derleniyor ve başlatılıyor, ilk seferde ~5 dakika…"
sudo docker compose up -d --build

echo -e "\n  başlaması bekleniyor…"
for i in $(seq 1 60); do
  if sudo docker compose ps tprds 2>/dev/null | grep -q healthy; then
    tamam "uygulama sağlıklı"
    break
  fi
  [ "$i" = 60 ] && uyari "sağlık yoklaması geçmedi — günlüklere bakın: sudo docker compose logs tprds"
  sleep 5
done

echo -e "\n${KALIN}════════════════════════════════════════════════${R}"
echo -e "${KALIN}  KURULUM BİTTİ${R}"
echo -e "${KALIN}════════════════════════════════════════════════${R}\n"
echo -e "  Adres          : ${KALIN}https://$ALAN_ADI${R}"
echo -e "  Panel parolası : ${KALIN}$ANAHTAR${R}"
echo
echo   "  Bu parolayı bir yere kaydedin. Yeniden görmek için:"
echo   "    grep KOORDINASYON_ANAHTARI ~/tprds/.env.sunucu"
echo
echo   "  Sertifika ilk açılışta alınıyor; adres 1-2 dakika içinde"
echo   "  https olarak açılır. Açılmazsa:"
echo   "    sudo docker compose logs caddy"
echo
