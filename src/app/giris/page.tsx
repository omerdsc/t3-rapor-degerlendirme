import Link from 'next/link';
import { redirect } from 'next/navigation';
import KoordinasyonGirisi from '@/components/koordinasyon-girisi';
import { yetkiKurulu } from '@/lib/yetki/koordinasyon';

export const dynamic = 'force-dynamic';

/**
 * Koordinasyon girişi — `/giris`.
 *
 * ── NİYE `/koordinasyon/giris` DEĞİL ────────────────────────────────────
 * Orada olsa `koordinasyon/layout.tsx` bu sayfayı da sarardı ve henüz
 * yetkisi olmayan kullanıcıya panelin bütün menüsünü gösterirdi. Giriş
 * ekranı korunan alanın İÇİNDE olamaz.
 */
export default async function GirisSayfasi({ searchParams }: PageProps<'/giris'>) {
  // Anahtar kurulu değilse giriş diye bir şey yok; kullanıcıyı panele al.
  if (!yetkiKurulu()) redirect('/koordinasyon');

  const p = await searchParams;
  const ham = (p.devam as string | undefined) ?? '/koordinasyon';
  /*
   * AÇIK YÖNLENDİRME KORUMASI.
   * `devam` parametresi kullanıcıdan geliyor; `//kotu.site` ya da
   * `https://kotu.site` gibi bir değer girişten sonra kullanıcıyı başka
   * bir siteye atardı. Yalnızca kendi kökümüzden başlayan yollar kabul.
   */
  const devam = /^\/(?!\/)/.test(ham) ? ham : '/koordinasyon';

  return (
    <div className="flex min-h-dvh items-center justify-center bg-zemin px-6">
      <div className="w-full max-w-sm">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex size-[38px] items-center justify-center rounded-xl bg-kirmizi">
            <svg viewBox="0 0 24 24" className="size-[21px] stroke-white" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </span>
          <div>
            <h1 className="text-[18px] leading-tight font-extrabold tracking-tight">
              Koordinasyon Paneli
            </h1>
            <p className="text-[11px] font-semibold tracking-wide text-metin-2">
              YARIŞMALAR KOORDİNATÖRLÜĞÜ
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-cizgi bg-white px-5 py-5">
          <KoordinasyonGirisi devam={devam} />
        </div>

        <p className="mt-4 text-[10.5px] leading-relaxed font-medium text-metin-3">
          Anahtar koordinasyon ekibinin ortak parolası ve{' '}
          <code className="font-mono">KOORDINASYON_ANAHTARI</code> ortam
          değişkeninden okunuyor. Kurumsal kurulumda bunun yerini kurum
          kimlik doğrulaması (SSO) alır. Hakem ve yarışmacı portalları bu
          anahtarı istemiyor — onlar kendi erişimleriyle giriyor.
        </p>

        <Link
          href="/"
          className="mt-3 inline-block text-[11px] font-bold text-metin-2 hover:text-metin"
        >
          ← Portal seçimi
        </Link>
      </div>
    </div>
  );
}
