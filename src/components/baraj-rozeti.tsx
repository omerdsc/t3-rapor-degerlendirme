import { barajDurumu, type BarajGirdisi } from '@/lib/gorunum/baraj';

/**
 * Baraj sonucu — yarışmacı ve koordinasyon aynı bileşeni görüyor.
 *
 * ── NİYE TEK BİLEŞEN ────────────────────────────────────────────────────
 * İki taraf aynı gerçeği görmek zorunda. Ayrı ayrı yazılsaydı biri
 * düzeltilip öteki unutulduğunda sistem aynı rapor için iki farklı şey
 * söylerdi — ve bu, itiraz sürecinde savunulamaz bir durumdur.
 *
 * ── DİLİ ────────────────────────────────────────────────────────────────
 * Bu kutu birine elendiğini söyleyebiliyor. "Başarısız" denmiyor:
 * yarışmacı bir eşiğin altında kaldı, başarısız olmadı. Kaç puan eksik
 * kaldığı da yazıyor, çünkü "62 aldın, 70 gerekiyordu" bir sonuç;
 * "geçemedin" bir hüküm. Teselli cümlesi de yok — geri bildirim zaten
 * aynı sayfada duruyor ve asıl işe yarayan o.
 */
export default function BarajRozeti({
  girdi,
  taraf = 'yarismaci',
}: {
  girdi: BarajGirdisi;
  /** Koordinasyon tarafında dil daha kısa ve nesnel. */
  taraf?: 'yarismaci' | 'koordinasyon';
}) {
  const s = barajDurumu(girdi);
  if (s.durum === 'yok') return null;

  if (s.durum === 'beklemede') {
    return (
      <div className="mt-4 rounded-lg border border-cizgi bg-zemin px-4 py-3">
        <p className="text-[12.5px] font-bold text-metin">
          Baraj puanı: {s.baraj}
        </p>
        <p className="mt-1 text-[11.5px] leading-relaxed font-medium text-metin-2">
          {taraf === 'yarismaci'
            ? 'Baraj sonucu, atanmış bütün hakemler değerlendirmesini '
              + 'tamamladıktan sonra açıklanır. Nihai puan hakem '
              + 'puanlarının ortalamasıdır ve son hakem bitene kadar '
              + 'değişebilir.'
            : 'Değerlendirme sürüyor; baraj sonucu bütün hakemler '
              + 'bitirmeden hesaplanmıyor.'}
        </p>
      </div>
    );
  }

  const gecti = s.durum === 'gecti';

  return (
    <div
      className={`mt-4 rounded-lg border px-4 py-3.5 ${
        gecti
          ? 'border-yesil/35 bg-yesil-zemin'
          : 'border-kirmizi/35 bg-kirmizi-zemin'
      }`}
    >
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <p
          className={`text-[14px] font-extrabold tracking-tight ${
            gecti ? 'text-yesil-koyu' : 'text-kirmizi-koyu'
          }`}
        >
          {gecti ? 'Baraj puanı geçildi' : 'Baraj puanının altında kalındı'}
        </p>
        <p className="font-mono text-[12px] font-bold tabular-nums text-metin-2">
          {s.puan} / baraj {s.baraj}
        </p>
      </div>

      <p className="mt-1.5 text-[11.5px] leading-relaxed font-medium text-metin-2">
        {gecti
          ? taraf === 'yarismaci'
            ? 'Projeniz bir sonraki aşamaya geçmeye hak kazandı. Aşama '
              + 'takvimi ve sonraki teslim tarihi yarışma sayfasında '
              + 'duyurulur.'
            : 'Bir sonraki aşamaya geçer.'
          : taraf === 'yarismaci'
            ? `Barajı geçmek için ${s.eksik} puan daha gerekiyordu. `
              + 'Ölçüt kırılımı ve hakem geri bildirimi aşağıda; '
              + 'hangi bölümlerde puan kaybedildiğini oradan '
              + 'görebilirsiniz.'
            : `${s.eksik} puan eksik.`}
      </p>
    </div>
  );
}
