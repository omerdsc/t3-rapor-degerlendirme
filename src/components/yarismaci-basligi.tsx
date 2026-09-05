'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';

/**
 * Yarışmacı portalının üst şeridi.
 *
 * ── NİYE GEZİNME VAR ────────────────────────────────────────────────────
 * Portal tek sayfaydı ve başvuru, panonun dibindeki bir düğmenin
 * arkasında duruyordu: yarışmacı başvurunun NEREDEN yapıldığını
 * bulamıyordu. Gezinme çubuğu "Yarışmalar"ı her ekranda görünür kılıyor —
 * bir işlevi bulmak için sayfayı sonuna kadar kaydırmak gerekiyorsa o
 * işlev yok sayılır.
 *
 * ── ÇIKIŞ NİYE BURADA ───────────────────────────────────────────────────
 * Rapor okul laboratuvarındaki ortak bir bilgisayardan yüklenebiliyor ve
 * oturum 30 gün açık kalıyor; bir sonraki kullanıcı önceki takımın
 * hesabına düşmemeli.
 */
const MENU = [
  { yol: '/yarismaci', ad: 'Panom' },
  { yol: '/yarismaci/yarismalar', ad: 'Yarışmalar' },
];

export default function YarismaciBasligi({ adSoyad }: { adSoyad?: string }) {
  const yonlendir = useRouter();
  const yol = usePathname();
  const [gidiyor, basla] = useTransition();

  async function cik() {
    await fetch('/api/yarismaci/giris', { method: 'DELETE' });
    basla(() => {
      yonlendir.push('/yarismaci/giris');
      yonlendir.refresh();
    });
  }

  return (
    <header className="bg-lacivert">
      <div className="mx-auto flex h-[60px] max-w-5xl items-center gap-4 px-4 sm:gap-7 sm:px-6">
        <Link
          href={adSoyad ? '/yarismaci' : '/yarismaci/giris'}
          className="flex shrink-0 items-center gap-3"
        >
          <span className="flex size-[31px] items-center justify-center rounded-lg bg-kirmizi">
            <svg viewBox="0 0 24 24" className="size-[17px] stroke-white" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </span>
          <span className="hidden sm:block">
            <span className="block text-[14px] leading-tight font-extrabold tracking-tight text-white">
              TPRDS
            </span>
            <span className="block text-[8px] font-semibold tracking-wider text-metin-2">
              YARIŞMACI PORTALI
            </span>
          </span>
        </Link>

        {adSoyad && (
          <>
            <nav className="flex min-w-0 items-center gap-1">
              {MENU.map((m) => {
                // Panom yalnızca TAM eşleşmede aktif; yoksa /yarismaci/*
                // adreslerinin hepsinde aktif görünürdü.
                const aktif =
                  m.yol === '/yarismaci' ? yol === '/yarismaci' : yol.startsWith(m.yol);
                return (
                  <Link
                    key={m.yol}
                    href={m.yol}
                    className={`rounded-lg px-3 py-1.5 text-[12.5px] font-bold transition-colors ${
                      aktif ? 'bg-white/10 text-white' : 'text-white/55 hover:text-white'
                    }`}
                  >
                    {m.ad}
                  </Link>
                );
              })}
            </nav>

            <span className="ml-auto hidden text-[11.5px] font-semibold text-white/60 lg:block">
              {adSoyad}
            </span>
            <button
              type="button"
              onClick={cik}
              disabled={gidiyor}
              className="dugme ml-auto shrink-0 border border-white/15 px-3 py-1.5 text-[11px] text-white/75 hover:bg-white/10 lg:ml-0"
            >
              {gidiyor ? 'Çıkılıyor…' : 'Çıkış'}
            </button>
          </>
        )}
      </div>
    </header>
  );
}
