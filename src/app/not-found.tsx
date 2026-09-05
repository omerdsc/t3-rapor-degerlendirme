import Link from 'next/link';

/**
 * 404 — bulunamayan sayfa.
 *
 * Next'in varsayılan 404'ü İngilizce ve biçimsiz: ürünün geri kalanıyla
 * hiç ilgisi olmayan bir ekran. Erişilemeyen bir kaynağa gidildiğinde de
 * (başka takımın başvurusu gibi) bu sayfa gösteriliyor — o yüzden metin
 * "yok" değil "bulunamadı" diyor: kaynağın var olup olmadığını
 * sızdırmıyor.
 */
export default function Bulunamadi() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-zemin px-6">
      <span className="mb-5 flex size-[52px] items-center justify-center rounded-2xl bg-kirmizi">
        <svg viewBox="0 0 24 24" className="size-7 stroke-white" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </span>

      <h1 className="text-[22px] leading-tight font-extrabold tracking-tight">
        Sayfa bulunamadı
      </h1>
      <p className="mt-2 max-w-sm text-center text-[13px] leading-relaxed font-medium text-metin-2">
        Aradığınız sayfa taşınmış, silinmiş ya da erişim yetkiniz olmayabilir.
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-2.5">
        <Link
          href="/"
          className="rounded-lg bg-kirmizi px-5 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-kirmizi-koyu"
        >
          Portal seçimine dön
        </Link>
        <Link
          href="/yarismaci"
          className="rounded-lg border border-cizgi bg-white px-5 py-2.5 text-[13px] font-bold text-metin-2 transition-colors hover:bg-white/60"
        >
          Yarışmacı portalı
        </Link>
      </div>
    </div>
  );
}
