import Link from 'next/link';

/**
 * Geçersiz erişim kodu.
 *
 * Çıplak 404 yerine bunu gösteriyoruz: hakem kodu yanlış yazdığında ne
 * yapması gerektiğini bilmeli. "Bu kod yok" demiyoruz bilerek — kod
 * deneyerek geçerli kod bulmayı kolaylaştırmamak için, mesaj her
 * durumda aynı.
 */
export default function KodBulunamadi() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-zemin px-6">
      <div className="w-full max-w-md rounded-xl border border-cizgi bg-white px-6 py-7 text-center">
        <span className="mx-auto mb-3 flex size-11 items-center justify-center rounded-xl bg-amber-zemin">
          <svg viewBox="0 0 24 24" className="size-6 stroke-amber-koyu" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v4M12 17h.01" />
            <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </svg>
        </span>
        <h1 className="text-[17px] font-extrabold tracking-tight">
          Bu bağlantı bir hakem paneli açmıyor
        </h1>
        <p className="mt-2 text-[12.5px] leading-relaxed font-medium text-metin-2">
          Erişim kodu hatalı olabilir. Kodu koordinasyondan aldığınız
          bağlantıdan kopyalayıp yeniden deneyin; sorun sürerse
          Yarışmalar Koordinatörlüğü ile iletişime geçin.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-lg bg-lacivert px-4 py-2.5 text-[12.5px] font-bold text-white transition-colors hover:bg-lacivert-2"
        >
          Giriş sayfasına dön
        </Link>
      </div>
    </div>
  );
}
