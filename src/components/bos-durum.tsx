import type { ReactNode } from 'react';

/**
 * Boş durum kartı.
 *
 * ── NİYE "NASIL BAŞLARIM" LİSTESİ DEĞİL ─────────────────────────────────
 * Önce numaralı bir yönlendirme listesi vardı: "1. Takım kurun 2. Yarışmaya
 * başvurun 3. Rapor yükleyin". Kaldırıldı. Arayüzün kendini adım adım
 * anlatması gerekiyorsa arayüz anlaşılmıyor demektir; talimat, tasarımın
 * yerine geçmez.
 *
 * Yerine geçen şey: boş alanın kendisi ne olduğunu söylüyor ve TEK bir
 * eylem sunuyor. Kullanıcı listeyi okumuyor, düğmeye basıyor.
 */
export default function BosDurum({
  baslik,
  metin,
  ikon,
  children,
}: {
  baslik: string;
  metin: string;
  ikon: ReactNode;
  /**
   * İsteğe bağlı ek içerik. Eylem düğmeleri BURADA DEĞİL, kartın altında:
   * form açıldığında kart-içinde-kart oluşuyor ve iki çerçeve iç içe
   * geçiyordu.
   */
  children?: ReactNode;
}) {
  return (
    <div className="kart belir flex flex-col items-center px-6 py-10 text-center">
      <span className="mb-4 flex size-12 items-center justify-center rounded-xl bg-zemin">
        {ikon}
      </span>
      <p className="text-[14px] font-extrabold tracking-tight">{baslik}</p>
      <p className="mt-1.5 max-w-sm text-[12.5px] leading-relaxed font-medium text-metin-2">
        {metin}
      </p>
      {children && <div className="mt-4 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}
