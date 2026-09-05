import Link from 'next/link';

/**
 * Sezon süzgeci — koordinasyon panelinin üst düzey kapsamı.
 *
 * ── NİYE VAR ────────────────────────────────────────────────────────────
 * Sistem yıldan yıla birikiyor: 2025'in raporları 2026'da da duruyor ve
 * durmalı — itiraz, arşiv ve karşılaştırma için gerekli. Ama koordinasyon
 * bu yılın işini yaparken geçen yılın raporlarını listede görüyordu ve
 * "6 rapor bekliyor" sayacı hangi yıla ait olduğu belirsiz bir sayıydı.
 *
 * ── NİYE BAĞLANTI, NİYE AÇILIR LİSTE DEĞİL ──────────────────────────────
 * İki üç sezon var ve hepsi tek bakışta görünüyor; açılır liste seçenek
 * sayısı yüksekken doğru kalıp, burada gereksiz bir tıklama katmanı
 * olurdu. Adres çubuğunda kaldığı için sezon paylaşılabilir de: "2025'in
 * raporlarına bak" derken bağlantı gönderiliyor.
 */
export default function SezonSecici({
  sezonlar,
  secili,
  adres,
}: {
  sezonlar: number[];
  /** Seçili sezon; `undefined` = tümü. */
  secili?: number;
  /** Sezon parametresini alan adres üreticisi. */
  adres: (sezon?: number) => string;
}) {
  // Tek sezon varsa süzgeç bir şey süzmüyor; yer kaplamasın.
  if (sezonlar.length < 2) return null;

  const secenekler: Array<{ etiket: string; deger?: number }> = [
    ...sezonlar.map((y) => ({ etiket: String(y), deger: y })),
    { etiket: 'Tümü', deger: undefined },
  ];

  return (
    <div className="flex items-center gap-1.5">
      <span className="mr-0.5 text-[10.5px] font-bold tracking-wide text-metin-3">
        SEZON
      </span>
      {secenekler.map((s) => {
        const aktif = s.deger === secili;
        return (
          <Link
            key={s.etiket}
            href={adres(s.deger)}
            aria-current={aktif ? 'true' : undefined}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-bold transition-colors ${
              aktif
                ? 'bg-lacivert text-white'
                : 'border border-cizgi bg-white text-metin-2 hover:bg-zemin'
            }`}
          >
            {s.etiket}
          </Link>
        );
      })}
    </div>
  );
}
