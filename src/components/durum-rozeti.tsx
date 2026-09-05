import { ASAMA_ETIKETI, type BasvuruAsamasi } from '@/lib/db/basvuru-durum';

/**
 * Başvuru aşaması rozeti.
 *
 * ── NİYE RENK, NİYE SADECE METİN ────────────────────────────────────────
 * Kart ızgarasında altı başvuru yan yana duruyor ve yarışmacının sorduğu
 * şey "hangisi bitti". Aynı renkte altı etiket bu soruyu okumadan
 * cevaplamıyor; renk cevaplıyor.
 *
 * Renk TEK BAŞINA taşımıyor ama: etiket metni de duruyor. Renk körlüğü
 * olan kullanıcı için renk hiç yokmuş gibi çalışıyor.
 */
const RENK: Record<BasvuruAsamasi, string> = {
  basvuruldu: 'bg-zemin text-metin-2',
  rapor_yuklendi: 'bg-mavi-zemin text-mavi-koyu',
  degerlendirmede: 'bg-amber-zemin text-amber-koyu',
  sonuclandi: 'bg-yesil-zemin text-yesil-koyu',
};

export default function DurumRozeti({ asama }: { asama: BasvuruAsamasi }) {
  return (
    <span
      className={`shrink-0 rounded-md px-2 py-0.5 text-[9.5px] font-bold tracking-wide ${RENK[asama]}`}
    >
      {ASAMA_ETIKETI[asama].toLocaleUpperCase('tr')}
    </span>
  );
}
