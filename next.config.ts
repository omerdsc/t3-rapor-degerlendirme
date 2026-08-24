import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
