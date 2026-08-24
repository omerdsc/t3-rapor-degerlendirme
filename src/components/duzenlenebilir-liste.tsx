'use client';

/**
 * Düzenlenebilir metin listesi — hakemin geri bildirim onayı için.
 *
 * ── NİYE AYRI BİLEŞEN ───────────────────────────────────────────────────
 * "Güçlü yönler" ve "gelişime açık alanlar" aynı davranışı istiyor: model
 * önerisiyle dolu gelen, satır satır düzeltilebilen, silinebilen ve
 * eklenebilen bir liste. İki kez yazılsa biri düzeltilip diğeri
 * unutulurdu.
 *
 * ── SİLİNEN SATIR GERİ GELMİYOR ──────────────────────────────────────────
 * Hakem bir öneriyi sildiyse onu istemiyor demektir. "Modelin önerisini
 * geri yükle" düğmesi var ama ayrı ve açıkça etiketli — kazara basılıp
 * hakemin emeğini silmesin diye onay istiyor.
 */
export default function DuzenlenebilirListe({
  satirlar,
  degistir,
  kilit,
  yerTutucu,
  modelOnerisi,
}: {
  satirlar: string[];
  degistir: (yeni: string[]) => void;
  kilit: boolean;
  yerTutucu: string;
  /** Modelin ürettiği ilk hâl — "geri yükle" için. */
  modelOnerisi?: string[];
}) {
  const bosMu = satirlar.every((s) => !s.trim());

  return (
    <div>
      <div className="flex flex-col gap-1.5">
        {satirlar.map((s, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <span className="mt-2 flex size-[17px] shrink-0 items-center justify-center rounded-full bg-zemin text-[9.5px] font-extrabold text-metin-2">
              {i + 1}
            </span>
            <textarea
              value={s}
              disabled={kilit}
              rows={2}
              onChange={(e) => {
                const y = [...satirlar];
                y[i] = e.target.value;
                degistir(y);
              }}
              placeholder={yerTutucu}
              className="min-w-0 flex-1 resize-y rounded-lg border border-cizgi px-2.5 py-1.5 text-[11.5px] leading-relaxed font-medium outline-none focus:border-metin-3 disabled:bg-zemin"
            />
            {!kilit && (
              <button
                type="button"
                title="Bu satırı sil"
                onClick={() => degistir(satirlar.filter((_, j) => j !== i))}
                className="mt-1.5 shrink-0 cursor-pointer rounded px-1.5 py-1 text-[13px] leading-none font-bold text-metin-3 hover:bg-kirmizi-zemin hover:text-kirmizi"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {!kilit && (
        <div className="mt-2 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => degistir([...satirlar, ''])}
            className="cursor-pointer text-[11px] font-bold text-kirmizi hover:text-kirmizi-koyu"
          >
            + Satır ekle
          </button>
          {!!modelOnerisi?.length && (
            <button
              type="button"
              onClick={() => {
                if (
                  bosMu ||
                  confirm(
                    'Yazdıklarınız silinip yapay zekânın önerisi geri yüklenecek. Devam edilsin mi?',
                  )
                ) {
                  degistir([...modelOnerisi]);
                }
              }}
              className="cursor-pointer text-[11px] font-medium text-metin-2 hover:text-metin"
            >
              Yapay zekâ önerisini geri yükle
            </button>
          )}
          {bosMu && (
            <span className="text-[10.5px] font-medium text-metin-3">
              Boş bırakılırsa yarışmacıya bu bölüm gösterilmez
            </span>
          )}
        </div>
      )}
    </div>
  );
}
