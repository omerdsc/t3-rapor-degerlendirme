import { ASAMA_ETIKETI, ASAMA_SIRASI, type BasvuruAsamasi } from '@/lib/db/basvuru-durum';

/**
 * Başvurunun hangi aşamada olduğunu gösteren çizelge.
 *
 * ── NİYE DÖRT NOKTA, NİYE YÜZDE ─────────────────────────────────────────
 * Yüzdelik bir çubuk "%50 tamamlandı" der ama yarışmacının sorduğu soru
 * bu değil: "raporum ulaştı mı, değerlendiriliyor mu, bitti mi". Adı olan
 * dört durak bu soruyu doğrudan cevaplıyor; yüzde cevaplamıyor.
 */
export default function AsamaCizelgesi({
  asama,
  kucuk = false,
}: {
  asama: BasvuruAsamasi;
  kucuk?: boolean;
}) {
  const suAn = ASAMA_SIRASI.indexOf(asama);

  return (
    <ol className="flex items-center gap-1.5">
      {ASAMA_SIRASI.map((a, i) => {
        const gecildi = i < suAn;
        const aktif = i === suAn;
        return (
          <li key={a} className="flex min-w-0 flex-1 items-center gap-1.5">
            <span
              aria-hidden
              className={`size-2.5 shrink-0 rounded-full ${
                gecildi ? 'bg-yesil' : aktif ? 'bg-kirmizi' : 'bg-cizgi'
              }`}
            />
            {/*
              ETİKETLER TELEFONDA GİZLİ.
              390 piksellik ekranda dört etiket sığmıyor ve hepsi
              "Rapor beklen…", "Değerlendir…" diye kırpılıyordu — kırpılmış
              etiket, etiket değildir. Kartın rozetinde aşamanın adı zaten
              tam yazıyor; burada noktalar yeterli.
            */}
            {!kucuk && (
              <span
                className={`hidden truncate text-[10.5px] font-bold sm:inline ${
                  aktif ? 'text-kirmizi' : gecildi ? 'text-yesil-koyu' : 'text-metin-3'
                }`}
              >
                {ASAMA_ETIKETI[a]}
              </span>
            )}
            {i < ASAMA_SIRASI.length - 1 && (
              <span
                aria-hidden
                className={`h-px min-w-3 flex-1 ${gecildi ? 'bg-yesil' : 'bg-cizgi'}`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
