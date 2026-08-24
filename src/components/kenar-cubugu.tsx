'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/*
 * KOORDİNASYON MENÜSÜ.
 *
 * Menüde YALNIZCA koordinasyonun işleri var. Hakem paneli ve yarışmacı
 * portalı buradan erişilemiyor — ayrı izleyicilere ait ayrı portallar ve
 * aralarında gezinme bağlantısı olması rol ayrımını görsel bir süse
 * indirirdi. Hakem kendi bağlantısıyla, yarışmacı başvuru numarasıyla
 * girer.
 *
 * Her madde bir İŞ:
 *   Panel          → şimdi ne yapmalıyım
 *   Raporlar       → rapor değerlendir
 *   Kopya Kontrolü → kategoriyi kopyaya karşı tara
 *   Hakemler       → kayıt ve rapor atama
 *   Yarışmalar     → yarışma kur, ölçütleri onayla, şablonu güncelle
 */
const MENU = [
  { yol: '/koordinasyon', ad: 'Panel', ipucu: 'Bekleyen işler ve özet' },
  { yol: '/koordinasyon/raporlar', ad: 'Raporlar', ipucu: 'Rapor değerlendir' },
  { yol: '/koordinasyon/benzerlik', ad: 'Kopya Kontrolü', ipucu: 'Raporlar arası örtüşme' },
  { yol: '/koordinasyon/hakemler', ad: 'Hakemler', ipucu: 'Kayıt ve rapor atama' },
  { yol: '/koordinasyon/yarismalar', ad: 'Yarışmalar', ipucu: 'Kurulum ve ölçütler' },
];

export default function KenarCubugu() {
  const yol = usePathname();

  return (
    <aside className="flex w-[248px] shrink-0 flex-col bg-lacivert">
      <Link
        href="/koordinasyon"
        className="flex items-center gap-3 border-b border-lacivert-3 px-5 py-5"
      >
        <span className="flex size-[34px] items-center justify-center rounded-lg bg-kirmizi">
          <svg viewBox="0 0 24 24" className="size-[19px] stroke-white" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </span>
        <span>
          <span className="block text-[15px] leading-tight font-extrabold tracking-tight text-white">
            4. GÖZ
          </span>
          <span className="mt-0.5 block text-[8.5px] font-semibold tracking-wider text-metin-2">
            DEĞERLENDİRME SİSTEMİ
          </span>
        </span>
      </Link>

      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        {MENU.map((m) => {
          // Panel maddesi yalnızca tam eşleşmede aktif; yoksa bütün
          // /koordinasyon/* adreslerinde Panel de aktif görünürdü.
          const aktif =
            m.yol === '/koordinasyon' ? yol === '/koordinasyon' : yol.startsWith(m.yol);
          return (
            <Link
              key={m.yol}
              href={m.yol}
              className={`rounded-lg px-2.5 py-2.5 transition-colors ${
                aktif ? 'bg-kirmizi' : 'hover:bg-lacivert-2'
              }`}
            >
              <span className={`block text-[13px] ${aktif ? 'font-semibold text-white' : 'font-medium text-metin-2'}`}>
                {m.ad}
              </span>
              <span className={`mt-0.5 block text-[9.5px] font-medium ${aktif ? 'text-white/70' : 'text-metin-2/60'}`}>
                {m.ipucu}
              </span>
            </Link>
          );
        })}

      </nav>

      <div className="border-t border-lacivert-3 p-3.5">
        <p className="mb-2.5 text-[10px] leading-relaxed font-medium text-metin-2/70">
          Yapay zekâ nihai karar verici değildir. Kontrol, analiz ve ön
          değerlendirme sunar; kararı hakem verir.
        </p>
        {/* Portal seçimine dönüş — canlı kurulumda bu bağlantı olmaz,
            koordinasyon kendi adresinden girer. */}
        <Link
          href="/"
          className="block text-[10px] font-semibold text-metin-2/60 hover:text-metin-2"
        >
          ← Portal seçimi
        </Link>
      </div>
    </aside>
  );
}
