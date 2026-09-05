'use client';

import { useEffect, useRef } from 'react';

/**
 * Giriş ekranının arka planı — canvas üzerinde yıldız alanı ve radar taraması.
 *
 * ── NİYE CANVAS, NİYE CSS DEĞİL ─────────────────────────────────────────
 * Yüzlerce noktanın her biri ayrı DOM düğümü olsaydı tarayıcı her karede
 * yüzlerce elemanın düzenini yeniden hesaplardı. Canvas'ta hepsi tek bir
 * çizim yüzeyi: düzen hesabı yok, yalnızca piksel.
 *
 * ── NİYE ÜÇ KATMAN ──────────────────────────────────────────────────────
 * Noktalar üç ayrı hızda sürükleniyor. Tek hızda hepsi birlikte kayıyor ve
 * göz bunu "kayan bir doku" olarak okuyor; farklı hızlarda derinlik
 * duygusu doğuyor. Uzak katman daha küçük, daha sönük ve daha yavaş.
 *
 * ── RADAR TARAMASI ──────────────────────────────────────────────────────
 * Havacılık ve uzay yarışmalarının ekranı; radar süpürmesi konunun kendi
 * görsel dilinden geliyor, dekorasyondan değil. Çok sönük çiziliyor:
 * arkada bir hareket hissi bırakıyor ama metnin okunmasına karışmıyor.
 *
 * ── HAREKETİ AZALT AYARI ────────────────────────────────────────────────
 * `prefers-reduced-motion` açıksa döngü hiç başlamıyor — tek kare çizilip
 * bırakılıyor. Vestibüler rahatsızlığı olan bir kullanıcı için sürekli
 * kayan bir arka plan sayfayı kullanılamaz kılabiliyor. Sekme arkaya
 * alındığında da döngü duruyor: görünmeyen bir animasyon için pil
 * harcamanın anlamı yok.
 */

interface Nokta {
  x: number;
  y: number;
  r: number;
  hiz: number;
  parlaklik: number;
  /** Yanıp sönme evresi — hepsi aynı anda parlamasın diye rastgele. */
  evre: number;
}

const KATMANLAR = [
  { adet: 90, r: [0.4, 0.9], hiz: [0.010, 0.022], parlaklik: [0.18, 0.34] },
  { adet: 55, r: [0.8, 1.5], hiz: [0.026, 0.045], parlaklik: [0.32, 0.55] },
  { adet: 22, r: [1.4, 2.3], hiz: [0.050, 0.080], parlaklik: [0.55, 0.85] },
];

function arada(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

export default function YildizAlani() {
  const tuval = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = tuval.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    let g = 0;
    let h = 0;
    let noktalar: Nokta[] = [];

    /*
     * Nokta sayısı EKRAN ALANINA göre ölçekleniyor. Sabit sayı, dar bir
     * telefonda kalabalık, geniş bir masaüstünde seyrek görünürdü.
     */
    function kur() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      g = c!.clientWidth;
      h = c!.clientHeight;
      c!.width = Math.floor(g * dpr);
      c!.height = Math.floor(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const olcek = Math.min(1.6, Math.max(0.45, (g * h) / (1440 * 900)));
      noktalar = KATMANLAR.flatMap((k) =>
        Array.from({ length: Math.round(k.adet * olcek) }, () => ({
          x: Math.random() * g,
          y: Math.random() * h,
          r: arada(k.r[0], k.r[1]),
          hiz: arada(k.hiz[0], k.hiz[1]),
          parlaklik: arada(k.parlaklik[0], k.parlaklik[1]),
          evre: Math.random() * Math.PI * 2,
        })),
      );
    }

    function ciz(t: number) {
      ctx!.clearRect(0, 0, g, h);

      /*
       * RADAR: merkezi sağ üstte, ekranın dışına taşıyor. Tam ortada
       * olsaydı simetrisi metin bloğuyla yarışırdı; köşeden gelen
       * süpürme, kompozisyonun ağırlığını metnin olduğu sol tarafa
       * bırakıyor.
       */
      const mx = g * 0.82;
      const my = h * 0.18;
      const menzil = Math.hypot(g, h) * 0.9;
      const aci = (t * 0.00016) % (Math.PI * 2);

      /*
       * DİKİŞ YOK: konik gradyanda 0 ve 1 durağı aynı çizgide buluşuyor.
       * İlki 0.11, sonuncusu 0 olduğunda arada sert bir kenar kalıyor ve
       * ekranda radar süpürmesi değil, köşeden inen düz kırmızı bir üçgen
       * görünüyordu. İki uç da sıfır; parlaklık hemen süpürme çizgisinden
       * SONRA doruk yapıp uzun bir kuyrukla sönüyor — gerçek bir radar
       * ekranında fosforun sönmesi de böyle.
       */
      const yelpaze = ctx!.createConicGradient(aci, mx, my);
      yelpaze.addColorStop(0, 'rgba(212, 32, 39, 0)');
      yelpaze.addColorStop(0.012, 'rgba(212, 32, 39, 0.10)');
      yelpaze.addColorStop(0.05, 'rgba(212, 32, 39, 0.045)');
      yelpaze.addColorStop(0.16, 'rgba(212, 32, 39, 0.012)');
      yelpaze.addColorStop(0.32, 'rgba(212, 32, 39, 0)');
      yelpaze.addColorStop(1, 'rgba(212, 32, 39, 0)');
      ctx!.fillStyle = yelpaze;
      ctx!.beginPath();
      ctx!.arc(mx, my, menzil, 0, Math.PI * 2);
      ctx!.fill();

      // Radar halkaları — çok sönük, derinliği belli etsin diye.
      ctx!.strokeStyle = 'rgba(148, 163, 184, 0.055)';
      ctx!.lineWidth = 1;
      for (let i = 1; i <= 4; i++) {
        ctx!.beginPath();
        ctx!.arc(mx, my, (menzil / 4.6) * i, 0, Math.PI * 2);
        ctx!.stroke();
      }

      for (const n of noktalar) {
        /*
         * Sürüklenme SOLA ve hafifçe AŞAĞI. Yatay kayma tek başına bir
         * kaydırma bandı gibi okunuyordu; küçük bir dikey bileşen onu
         * "içinde bulunulan bir alan" hâline getiriyor.
         */
        n.x -= n.hiz;
        n.y += n.hiz * 0.22;
        if (n.x < -3) {
          n.x = g + 3;
          n.y = Math.random() * h;
        }
        if (n.y > h + 3) n.y = -3;

        // Yanıp sönme: parlaklığın %25'i kadar, yavaş.
        const p = n.parlaklik * (0.85 + 0.15 * Math.sin(t * 0.0011 + n.evre));
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(226, 234, 246, ${p.toFixed(3)})`;
        ctx!.fill();
      }
    }

    const azalt = window.matchMedia('(prefers-reduced-motion: reduce)');
    let kare = 0;

    function dongu(t: number) {
      ciz(t);
      kare = requestAnimationFrame(dongu);
    }

    function baslat() {
      cancelAnimationFrame(kare);
      if (azalt.matches || document.hidden) {
        // Tek kare: arka plan yine dolu görünüyor, hareket yok.
        ciz(0);
        return;
      }
      kare = requestAnimationFrame(dongu);
    }

    function yenidenBoyutlandir() {
      kur();
      baslat();
    }

    kur();
    baslat();

    window.addEventListener('resize', yenidenBoyutlandir);
    document.addEventListener('visibilitychange', baslat);
    azalt.addEventListener('change', baslat);

    return () => {
      cancelAnimationFrame(kare);
      window.removeEventListener('resize', yenidenBoyutlandir);
      document.removeEventListener('visibilitychange', baslat);
      azalt.removeEventListener('change', baslat);
    };
  }, []);

  return (
    <canvas
      ref={tuval}
      /*
       * Ekran okuyucudan gizli: taşıdığı hiçbir bilgi yok, yalnızca doku.
       * `pointer-events-none` de gerekli — üstündeki kartlara tıklanabilsin.
       */
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 size-full"
    />
  );
}
