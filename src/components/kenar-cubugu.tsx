'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/*
 * MENÜ SADELEŞTİRİLDİ.
 *
 * Önce beş madde vardı ve ikisi ("Yarışma Yönetimi", "TEKNOFEST Kataloğu")
 * aynı şeyin iki hâliydi. Rol etiketleri de ("Hakem", "Yarışma Yöneticisi")
 * yardımcı olmuyordu: tek kişi hepsini kullanıyor ve etiket menüyü
 * kalabalıklaştırıyordu. Artık dört madde ve her biri bir İŞ:
 *
 *   Panel        → şimdi ne yapmalıyım
 *   Raporlar     → rapor değerlendir
 *   Kopya Kontrolü → kategoriyi kopyaya karşı tara
 *   Yarışmalar   → yarışma kur, ölçütleri onayla, şablonu güncelle
 */
const MENU = [
  { yol: '/', ad: 'Panel', ipucu: 'Bekleyen işler ve özet' },
  { yol: '/raporlar', ad: 'Raporlar', ipucu: 'Rapor değerlendir' },
  { yol: '/benzerlik', ad: 'Kopya Kontrolü', ipucu: 'Raporlar arası örtüşme' },
  { yol: '/hakemler', ad: 'Hakemler', ipucu: 'Kayıt ve rapor atama' },
  { yol: '/yarismalar', ad: 'Yarışmalar', ipucu: 'Kurulum ve ölçütler' },
];

export default function KenarCubugu() {
  const yol = usePathname();

  return (
    <aside className="flex w-[248px] shrink-0 flex-col bg-lacivert">
      <Link href="/" className="flex items-center gap-3 border-b border-lacivert-3 px-5 py-5">
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
          const aktif = m.yol === '/' ? yol === '/' : yol.startsWith(m.yol);
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

        <Link
          href="/sonuc"
          className="mt-3 rounded-lg border border-dashed border-lacivert-3 px-2.5 py-2.5 hover:bg-lacivert-2"
        >
          <span className="block text-[13px] font-medium text-metin-2">Yarışmacı Portalı</span>
          <span className="mt-0.5 block text-[9.5px] font-medium text-metin-2/60">
            Yarışmacı · ayrı görünüm
          </span>
        </Link>
      </nav>

      <div className="border-t border-lacivert-3 p-3.5">
        <p className="text-[10px] leading-relaxed font-medium text-metin-2/70">
          Yapay zekâ nihai karar verici değildir. Kontrol, analiz ve ön
          değerlendirme sunar; kararı hakem verir.
        </p>
      </div>
    </aside>
  );
}
