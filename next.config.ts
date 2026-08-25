import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * KAPSAYICI İÇİN TEK KLASÖRLÜK ÇIKTI.
   *
   * `standalone`, çalışmak için gereken node_modules parçalarını çıktının
   * içine kopyalıyor. Kapsayıcı imajına bütün node_modules'ü koymak
   * yerine yalnızca bunu koyuyoruz: imaj ~1 GB yerine ~200 MB oluyor ve
   * kurulum adımı üretim sunucusunda hiç çalışmıyor.
   *
   * Not: `veri/` ve `public/` bu çıktıya GİRMİYOR — ikisi de elle
   * kopyalanıyor (Dockerfile) ya da diskten bağlanıyor.
   */
  output: 'standalone',

  /*
   * ÇALIŞMA ZAMANI VERİSİ İZLEYİCİYE GİRMESİN.
   *
   * Ölçüldü: `output: 'standalone'` açıldığında Next'in dosya izleyicisi
   * `veri/` klasörünün TAMAMINI çıktıya kopyaladı — canlı veritabanı ve
   * gerçek yarışmacı PDF'leri dahil (50 MB'lık çıktının 16 MB'ı veriydi).
   *
   * Sebebi anlaşılır: `depo.ts` dosya yollarını çalışma zamanında
   * hesaplıyor (`join(veriDizini(), 'dosyalar', id + '.pdf')`), izleyici
   * bunu statik olarak çözemiyor ve emniyetli tarafta kalıp klasörü
   * bütünüyle alıyor. Bu davranış kütüphaneler için doğru; VERİ için
   * felaket — çıktı kopyalanabilir bir nesne ve içindeki her şey onunla
   * birlikte gider.
   *
   * `.dockerignore` da bunu engelliyor ama tek satırlık bir savunma
   * yeterli değil: `.next/standalone` klasörünü elle kopyalayan biri
   * belgeleri yanında taşır. Kaynağında kesiliyor.
   *
   * `veri/` ve `.onbellek/` ÇALIŞMA ZAMANINDA dışarıdan bağlanıyor;
   * derleme çıktısında hiç bulunmamaları gerekiyor.
   */
  outputFileTracingExcludes: {
    '*': [
      './veri/**/*',
      './.onbellek/**/*',
      './ornek_rapor/**/*',
      './test-verisi/**/*',
    ],
  },

  // pdf.js kendi worker/eval kurgusuyla geliyor; bundle'a girerse bozuluyor.
  // Sunucu tarafında Node tarafından doğrudan yüklensin.
  serverExternalPackages: ["unpdf"],

  /*
   * ESKİ ADRESLER — koordinasyon ekranları /koordinasyon altına taşındı.
   *
   * Üç portal ayrıldığında (koordinasyon / hakem / yarışmacı) adres önekleri
   * değişti. Kayıtlı bağlantılar ve tarayıcı geçmişi kırılmasın diye eski
   * yollar yönlendiriliyor.
   *
   * Kalıcı (308) değil GEÇİCİ (307) yönlendirme: kalıcı yönlendirme
   * tarayıcıda önbelleğe alınıyor ve yol yapısı bir daha değişirse
   * kullanıcının önbelleğini temizlemesi gerekir. Proje hâlâ gelişiyor.
   */
  async redirects() {
    const eskiler = [
      'raporlar',
      'benzerlik',
      'hakemler',
      'yarismalar',
      'katalog',
      'kurulum',
    ];
    return [
      ...eskiler.map((y) => ({
        source: `/${y}`,
        destination: `/koordinasyon/${y}`,
        permanent: false,
      })),
      ...eskiler.map((y) => ({
        source: `/${y}/:yol*`,
        destination: `/koordinasyon/${y}/:yol*`,
        permanent: false,
      })),
      { source: '/rapor/:id', destination: '/koordinasyon/rapor/:id', permanent: false },
    ];
  },
};

export default nextConfig;
