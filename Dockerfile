# TPRDS — üretim imajı
#
# ── TASARIM KARARLARI ────────────────────────────────────────────────────
# · Üç aşama: bağımlılıklar / derleme / çalıştırma. Son imaj derleyiciyi,
#   kaynak kodu ve geliştirme bağımlılıklarını TAŞIMIYOR.
# · `next.config.ts` içindeki `output: 'standalone'` sayesinde çalışma
#   aşamasına node_modules'ün tamamı değil, yalnızca gereken parçası
#   giriyor.
# · Veri imajın İÇİNDE DEĞİL: `/veri` dışarıdan bağlanıyor. Kapsayıcı
#   silinip yeniden kurulduğunda veritabanı ve yüklenen belgeler yerinde
#   kalıyor. İmaja veri koymak, her güncellemede o veriyi silmek demektir.
#
# ── NİYE ALPINE ──────────────────────────────────────────────────────────
# Bütün bağımlılıklar saf JavaScript (unpdf, pdf-lib, fflate) ve SQLite
# Node'un kendi içinde geliyor — derlenecek yerel eklenti yok. Tek istisna
# Tailwind'in yerel motoru; o da derleme aşamasında, kapsayıcının kendi
# mimarisi için kuruluyor.
#
# ── NODE SÜRÜMÜ ──────────────────────────────────────────────────────────
# `node:sqlite` Node 22.14'ten itibaren bayraksız çalışıyor. Daha eski bir
# 22 sürümü sessizce değil, GÜRÜLTÜLÜ başarısız olur (modül bulunamaz).

FROM node:22-alpine AS bagimliliklar
WORKDIR /uygulama
COPY package.json package-lock.json ./
# `npm ci` kilit dosyasına birebir uyuyor: derleme makinesinde ne
# sınandıysa sunucuda o çalışıyor.
RUN npm ci


FROM node:22-alpine AS derleme
WORKDIR /uygulama
COPY --from=bagimliliklar /uygulama/node_modules ./node_modules
COPY . .
# Derleme sırasında veri okunmuyor; sayfaların hepsi istek anında
# üretiliyor (`ƒ Dynamic`). Yine de boş bir dizin gerekiyor ki yol
# hesabı hata vermesin.
RUN mkdir -p veri && npm run build


FROM node:22-alpine AS calisma
WORKDIR /uygulama

ENV NODE_ENV=production
# Standalone sunucu varsayılan olarak yalnızca localhost dinliyor;
# kapsayıcı dışından erişim için bütün arayüzlere bağlanması gerekiyor.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
# Kalıcı diskin bağlanacağı yer. Uygulamanın TEK yazdığı dizin burası.
ENV TPRDS_VERI_DIZINI=/veri
ENV TPRDS_ONBELLEK_DIZINI=/veri/.onbellek

# Kök kullanıcı olarak çalıştırmıyoruz: kapsayıcıda bir açık bulunursa
# saldırganın eline kök yetkisi geçmesin.
RUN addgroup -g 1001 -S tprds && adduser -u 1001 -S tprds -G tprds

COPY --from=derleme --chown=tprds:tprds /uygulama/.next/standalone ./
COPY --from=derleme --chown=tprds:tprds /uygulama/.next/static ./.next/static
COPY --from=derleme --chown=tprds:tprds /uygulama/public ./public

# Disk bağlanmazsa uygulama yine de açılsın; veri kalıcı olmaz ama
# "dizin yok" diye çökmez.
RUN mkdir -p /veri && chown -R tprds:tprds /veri

USER tprds
EXPOSE 3000

# Sağlık yoklaması: sunucu gerçekten sayfa sunuyor mu.
#
# Yalnızca "süreç yaşıyor mu" diye bakmak yetmiyor: anahtarsız üretim
# kurulumunda açılış denetimi (src/instrumentation.ts) hata fırlatıyor ama
# süreç AYAKTA KALIYOR ve her isteğe 500 dönüyor. Süreci yoklayan bir
# kontrol bunu sağlıklı sayardı. Sayfa isteyen kontrol saymıyor.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/giris || exit 1

CMD ["node", "server.js"]
