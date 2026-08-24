import Link from 'next/link';
import { hakemYukleri } from '@/lib/db/hakem-depo';
import { panoOzeti, yarismalariListele } from '@/lib/depo/depo';

export const dynamic = 'force-dynamic';

/**
 * Giriş — üç portalın kapısı.
 *
 * ── NEDEN ÜÇ AYRI PORTAL ────────────────────────────────────────────────
 * Önce her şey tek kenar çubuğunun altındaydı: koordinasyon ekranları,
 * hakem paneli bağlantısı ve yarışmacı portalı aynı menüde. Çalışıyordu
 * ama yanlış bir şey söylüyordu — üç ayrı İZLEYİCİ aynı uygulamanın
 * kullanıcısı gibi görünüyordu.
 *
 * Gerçek kurulumda bunlar ayrı adreslerdir: koordinasyon kurum içi ağda,
 * hakem kendi bağlantısıyla, yarışmacı başvuru sistemi üzerinden girer.
 * Rol ayrımı menüyle değil ERİŞİMLE yapılır.
 *
 * Tek uygulamada ayrı alan adı kurulamadığı için ayrım adres önekiyle
 * yapıldı — `/koordinasyon`, `/hakem/<kod>`, `/sonuc`. Her portalın kendi
 * düzeni, kendi başlığı var ve aralarında gezinme bağlantısı YOK: hakem
 * koordinasyon panosunu göremez, koordinasyon yarışmacı ekranına
 * düşmez.
 *
 * Bu sayfa yalnızca bir kapı; canlı kurulumda üç ayrı adres olacağı için
 * yerini alan adları alır.
 */
export default function GirisSayfasi() {
  const yarismalar = yarismalariListele();
  const ozet = panoOzeti();
  const hakemler = hakemYukleri();

  const aktifHakem = hakemler.filter((h) => h.hakem.aktif).length;
  const bekleyenIs = hakemler.reduce((t, h) => t + (h.atanan - h.tamamlanan), 0);

  const kapilar = [
    {
      yol: '/koordinasyon',
      ad: 'Koordinasyon',
      rol: 'Yarışmalar Koordinatörlüğü',
      aciklama:
        'Yarışmaları kurar, değerlendirme ölçütlerini onaylar, raporları ' +
        'hakemlere dağıtır, sonuçları izler ve dışa aktarır.',
      sayilar: [
        `${yarismalar.length} yarışma`,
        `${ozet.toplam} rapor`,
        `${aktifHakem} aktif hakem`,
      ],
      birincil: true,
    },
    {
      yol: null,
      ad: 'Hakem Paneli',
      rol: 'Değerlendirici',
      aciklama:
        'Hakem kendi bağlantısıyla girer ve YALNIZCA kendisine atanmış ' +
        'raporları görür. Takım adları rumuzlu; puanlama kör yapılır.',
      sayilar: [
        `${aktifHakem} hakemin kendi paneli`,
        bekleyenIs ? `${bekleyenIs} değerlendirme bekliyor` : 'bekleyen iş yok',
      ],
      not: 'Bağlantı koordinasyon tarafından iletilir — /hakem/<erişim kodu>',
    },
    {
      yol: '/sonuc',
      ad: 'Yarışmacı Portalı',
      rol: 'Başvuru sahibi',
      aciklama:
        'Yarışmacı başvuru numarasıyla girer ve kendi sonucunu görür. ' +
        'Hakem değerlendirmeyi tamamlamadan açılmaz; yapay zekâ puanı ' +
        'yarışmacıya hiç gösterilmez.',
      sayilar: [`${ozet.tamamlanan} sonuç yayımlandı`],
    },
  ];

  return (
    <div className="min-h-dvh bg-zemin">
      <header className="bg-lacivert px-6 py-10">
        <div className="mx-auto max-w-4xl">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex size-[38px] items-center justify-center rounded-xl bg-kirmizi">
              <svg viewBox="0 0 24 24" className="size-[21px] stroke-white" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </span>
            <div>
              <h1 className="text-[22px] leading-tight font-extrabold tracking-tight text-white">
                4. GÖZ
              </h1>
              <p className="text-[10px] font-semibold tracking-wider text-metin-2">
                YAPAY ZEKÂ DESTEKLİ DEĞERLENDİRME SİSTEMİ
              </p>
            </div>
          </div>
          <p className="max-w-2xl text-[13px] leading-relaxed font-medium text-white/85">
            TEKNOFEST Yarışmalar Koordinatörlüğü için hakem karar destek
            sistemi. Yapay zekâ nihai karar verici değildir; puanı hakem
            verir.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <p className="mb-4 text-[12px] font-medium text-metin-2">
          Üç ayrı portal, üç ayrı erişim. Canlı kurulumda her biri kendi
          adresinde çalışır; aralarında gezinme bağlantısı bulunmaz.
        </p>

        <div className="flex flex-col gap-3">
          {kapilar.map((k) => {
            const govde = (
              <>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-[16px] font-extrabold tracking-tight">{k.ad}</h2>
                  <span className="rounded bg-zemin px-2 py-0.5 text-[9.5px] font-bold tracking-wide text-metin-2">
                    {k.rol.toLocaleUpperCase('tr')}
                  </span>
                  {k.yol && (
                    <span className="ml-auto text-[12.5px] font-bold text-kirmizi">
                      Gir →
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed font-medium text-metin-2">
                  {k.aciklama}
                </p>
                <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
                  {k.sayilar.map((s) => (
                    <span key={s} className="text-[11px] font-semibold text-metin">
                      {s}
                    </span>
                  ))}
                </div>
                {k.not && (
                  <p className="mt-2 rounded-md bg-zemin px-2.5 py-1.5 text-[10.5px] font-medium text-metin-2">
                    {k.not}
                  </p>
                )}
              </>
            );

            return k.yol ? (
              <Link
                key={k.ad}
                href={k.yol}
                className={`rounded-xl border bg-white px-5 py-4 transition-colors hover:bg-zemin/60 ${
                  k.birincil ? 'border-kirmizi/40' : 'border-cizgi'
                }`}
              >
                {govde}
              </Link>
            ) : (
              <div
                key={k.ad}
                className="rounded-xl border border-dashed border-metin-3/40 bg-white px-5 py-4"
              >
                {govde}
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-[11px] leading-relaxed font-medium text-metin-3">
          Bu sayfa yalnızca geliştirme kolaylığı için var: tek uygulamada üç
          portalı ayrı alan adına koymak mümkün olmadığı için ayrım adres
          önekiyle yapıldı. Kurumsal kurulumda bu kapı kalkar, yerini üç
          ayrı adres ve kurum kimlik doğrulaması alır.
        </p>
      </main>
    </div>
  );
}
