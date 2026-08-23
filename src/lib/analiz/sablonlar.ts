/**
 * TEKNOFEST rapor şablonu tanımları.
 *
 * ⚠️ Buradaki başlıklar TEKNOFEST Proje Detay Raporu'nun genel yapısına göre
 * yazıldı; resmî şablon dosyası elimize geçtiğinde `yonergeMetni` alanları
 * şablonun birebir kendi cümleleriyle doldurulmalı. "Doldurulmamış bölüm"
 * tespitinin isabeti tamamen bu metinlerin doğruluğuna bağlı.
 */

import type { Sablon } from './tipler';

/**
 * `asgariKelime` bilinçli olarak tanımlanmadı. Deterministik katman yalnızca
 * "bölüm doldurulmuş mu" sorusunu yanıtlar (varsayılan yapısal taban: 25
 * kelime). "İçerik yeterince derin mi" değerlendirmesi rubrik bazlı AI
 * kriter analizinin işidir — burada uydurma bir eşikle rapor işaretlemek,
 * hakemi yanlış yönlendirir. Şartname bölüm başına kelime sınırı
 * getiriyorsa buraya eklenmelidir.
 */

export const TEKNOFEST_2026: Sablon = {
  kod: 'teknofest-pdr-2026',
  ad: 'TEKNOFEST 2026 Proje Detay Raporu',
  yil: 2026,
  beklenenDil: 'tr',
  // Sayfa sınırı şartnameden gelmeli. Elimizde resmî şartname olmadığı için
  // tanımsız bırakıldı — uydurma bir sınırla rapor işaretlemek yanlış olur.
  asgariSayfa: undefined,
  azamiSayfa: undefined,
  kaynakca: {
    zorunlu: true,
    adlar: ['Kaynakça', 'Kaynaklar', 'Referanslar', 'References'],
    asgariKaynak: 5,
    atifBekleniyor: true,
  },
  basliklar: [
    {
      numara: '1', ad: 'Proje Özeti', zorunlu: true,
      yonergeMetni: [
        'Bu bölümde projenizin amacını, kapsamını ve beklenen çıktılarını özetleyiniz.',
        'Proje özeti en fazla 300 kelime olmalıdır.',
      ],
    },
    {
      numara: '2', ad: 'Problem Durumunun Tanımlanması', zorunlu: true,
      yonergeMetni: [
        'Çözmeyi hedeflediğiniz problemi, problemin kaynağını ve etkilerini açıklayınız.',
      ],
    },
    {
      numara: '3', ad: 'Çözüm', zorunlu: true,
      yonergeMetni: ['Problemi nasıl çözdüğünüzü ve çözümünüzün işleyişini anlatınız.'],
    },
    {
      numara: '4', ad: 'Yöntem', zorunlu: true,
      yonergeMetni: [
        'Projede kullandığınız yöntem ve teknikleri, tekrarlanabilir olacak biçimde açıklayınız.',
      ],
    },
    {
      numara: '5', ad: 'Yenilikçi (İnovatif) Yönü', zorunlu: true,
      yonergeMetni: [
        'Projenizin mevcut çözümlerden farkını ve özgün yönlerini açıklayınız.',
      ],
    },
    {
      numara: '6', ad: 'Uygulanabilirlik', zorunlu: true,
      yonergeMetni: ['Projenin ticarileşme ve yaygınlaşma potansiyelini değerlendiriniz.'],
    },
    {
      numara: '7', ad: 'Tahmini Maliyet ve Proje Zaman Planlaması', zorunlu: true,
      yonergeMetni: [
        'Maliyet kalemlerini ve iş-zaman çizelgesini tablo hâlinde veriniz.',
      ],
    },
    {
      numara: '8', ad: 'Proje Fikrinin Hedef Kitlesi', zorunlu: true,
      yonergeMetni: ['Projenizden kimlerin, nasıl faydalanacağını belirtiniz.'],
    },
    {
      numara: '9', ad: 'Riskler', zorunlu: true,
      yonergeMetni: [
        'Projenin karşılaşabileceği riskleri ve bu risklere karşı aldığınız önlemleri yazınız.',
      ],
    },
    {
      numara: '10', ad: 'Kaynakça', zorunlu: true,
      yonergeMetni: ['Yararlandığınız kaynakları akademik künye biçiminde listeleyiniz.'],
    },
  ],
};

/** Eski sürüm tespiti için. 2025'te "Riskler" bölümü zorunlu değildi. */
export const TEKNOFEST_2025: Sablon = {
  ...TEKNOFEST_2026,
  kod: 'teknofest-pdr-2025',
  ad: 'TEKNOFEST 2025 Proje Detay Raporu',
  yil: 2025,
  basliklar: TEKNOFEST_2026.basliklar
    .filter((b) => b.ad !== 'Riskler')
    .map((b, i) => ({ ...b, numara: String(i + 1) })),
};

export const SABLONLAR = [TEKNOFEST_2026, TEKNOFEST_2025];
export const GUNCEL_SABLON = TEKNOFEST_2026;
export const ESKI_SABLONLAR = [TEKNOFEST_2025];
