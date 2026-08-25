import Link from 'next/link';

/**
 * Portal seçimine dönüş.
 *
 * ── NİYE ÜÇ PORTALDA DA VAR ─────────────────────────────────────────────
 * Portallar arasında gezinme bağlantısı yok, bilinçli: hakem koordinasyon
 * panosunu görmemeli, koordinasyon yarışmacı ekranına düşmemeli. Ama
 * "geldiğim kapıya dön" bu kuralı bozmuyor — portal seçimi hiçbir yere
 * ERİŞİM VERMİYOR, yalnızca üç kapıyı gösteriyor. Koordinasyon anahtar,
 * hakem kod, yarışmacı başvuru numarası istemeye devam ediyor.
 *
 * Bağlantı olmadığı sürece kullanıcı adres çubuğuna elle yazmak zorunda
 * kalıyordu; bir arayüzde bunun olması eksiklik işaretidir.
 *
 * Canlı kurulumda üç portal ayrı adreste yayınlanacağı için bu kapı da bu
 * bağlantı da kalkar.
 */
export default function PortalDonus({
  koyu = true,
}: {
  /** Koyu zeminli başlıkta mı duruyor — renk buna göre seçiliyor. */
  koyu?: boolean;
}) {
  return (
    <Link
      href="/"
      title="Üç portalın göründüğü sayfaya dön"
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11.5px] font-bold transition-colors ${
        koyu
          ? 'border-lacivert-3 text-metin-2 hover:bg-lacivert-2 hover:text-white'
          : 'border-cizgi text-metin-2 hover:bg-zemin hover:text-metin'
      }`}
    >
      <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
      </svg>
      Portal seçimi
    </Link>
  );
}
