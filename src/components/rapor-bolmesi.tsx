'use client';

import { useEffect, useState } from 'react';

/**
 * Hakem panelindeki rapor bölmesi.
 *
 * ── ÇÖZDÜĞÜ SORUN ───────────────────────────────────────────────────────
 * Belge `<iframe src="...#view=FitH">` ile gömülüydü ve tarayıcı kendi PDF
 * görüntüleyicisini BÜTÜN TAKIMIYLA açıyordu: solda küçük resim şeridi,
 * üstte zoom/döndür/indir/yazdır düğmeleri, altta yazı tipi kutusu. Ekranın
 * yarısı genişliğinde bir bölmede bunların hepsi sığmayınca geriye A4
 * sayfası için avuç içi kadar yer kalıyor ve rapor OKUNMUYORDU. İki ayrı
 * kaydırma çubuğu ve iki pencere görüntüsü de oradan geliyordu.
 *
 * ── NİYE ARAÇ ÇUBUĞU KAPALI ─────────────────────────────────────────────
 * Görüntüleyicinin metin ve çizim araçları belgeyi DÜZENLETİYORDU: hakem
 * yanlışlıkla raporun üstüne yazabiliyor, kaydedip indirebiliyordu.
 * Değerlendirilen belgenin hakem elinde değişebilir olması, kaydın kendisini
 * tartışmalı hâle getirir. Gömülü görünümde araçlar kapalı.
 *
 * ── OKUMA KİPİ ──────────────────────────────────────────────────────────
 * Yarım ekranda okunmayan rapor için "Tam ekran" var: belge bütün pencereyi
 * kaplıyor ve ORADA araç çubuğu açık — yakınlaştırma, arama ve yazdırma
 * gerçekten yer olan yerde veriliyor. Hakem okur, kapatır, puanlamaya döner;
 * form arkada olduğu gibi duruyor.
 */
export default function RaporBolmesi({
  raporId,
  kod,
  dosyaAdi,
}: {
  raporId: string;
  kod: string;
  dosyaAdi: string;
}) {
  const [tamEkran, setTamEkran] = useState(false);
  const adres = `/api/rapor/${raporId}/dosya?kod=${encodeURIComponent(kod)}`;

  /*
   * Gömülü görünüm: araç çubuğu, küçük resim şeridi ve kaydırma çubuğu
   * kapalı, sayfa genişliğe oturuyor. Tam ekranda tam tersi — orada yer
   * var ve araçlar işe yarıyor.
   */
  const gomulu = `${adres}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`;
  const buyuk = `${adres}#view=FitH`;

  /*
   * ESC ile kapanıyor ve açıkken sayfa kaydırması kilitli: arkadaki uzun
   * puanlama formu tam ekranın altında kaymaya devam etseydi hakem
   * kapattığında bambaşka bir yerde bulurdu kendini.
   */
  useEffect(() => {
    if (!tamEkran) return;
    const kapat = (o: KeyboardEvent) => {
      if (o.key === 'Escape') setTamEkran(false);
    };
    const eski = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', kapat);
    return () => {
      document.body.style.overflow = eski;
      window.removeEventListener('keydown', kapat);
    };
  }, [tamEkran]);

  return (
    <>
      <section className="overflow-hidden rounded-xl border border-cizgi bg-white lg:sticky lg:top-4">
        <div className="flex items-center gap-2 border-b border-cizgi px-4 py-2.5">
          <h2 className="shrink-0 text-[12.5px] font-bold">Rapor</h2>
          <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-metin-3">
            {dosyaAdi}
          </span>
          <button
            type="button"
            onClick={() => setTamEkran(true)}
            className="dugme shrink-0 border border-cizgi px-2.5 py-1 text-[11.5px] font-bold text-metin hover:bg-zemin"
          >
            Tam ekran
          </button>
          <a
            href={adres}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-[11.5px] font-bold text-kirmizi hover:text-kirmizi-koyu"
          >
            Yeni sekmede aç →
          </a>
        </div>
        <iframe
          src={gomulu}
          title="Rapor"
          className="h-[calc(100vh-190px)] min-h-[420px] w-full"
        />
      </section>

      {tamEkran && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-lacivert/70 p-3 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Rapor — tam ekran"
        >
          <div className="mx-auto flex min-h-0 w-full max-w-[1100px] flex-1 flex-col overflow-hidden rounded-xl bg-white">
            <div className="flex items-center gap-2 border-b border-cizgi px-4 py-2.5">
              <h2 className="shrink-0 text-[12.5px] font-bold">Rapor</h2>
              <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-metin-3">
                {dosyaAdi}
              </span>
              <button
                type="button"
                onClick={() => setTamEkran(false)}
                className="dugme shrink-0 bg-lacivert px-3.5 py-1.5 text-[12px] font-bold text-white hover:bg-lacivert-2"
              >
                Kapat (ESC)
              </button>
            </div>
            <iframe src={buyuk} title="Rapor — tam ekran" className="min-h-0 flex-1 w-full" />
          </div>
        </div>
      )}
    </>
  );
}
