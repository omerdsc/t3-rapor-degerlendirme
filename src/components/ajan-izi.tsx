'use client';

import { useState } from 'react';
import type { Adim } from '@/lib/ai/ajan';

/**
 * Ajanın adım izi — iki ajan da bunu kullanıyor.
 *
 * ── NİYE VAR ────────────────────────────────────────────────────────────
 * Bir ajanın kararı ancak NASIL vardığı görülebilirse denetlenebilir.
 * "Bu künye uydurma şüphesi taşıyor" ya da "bu iki rapor birbirine bağlı"
 * cümlesi tek başına kara kutu: hakem katılmıyorsa nereye bakacağını,
 * katılıyorsa neye güvendiğini bilmiyor.
 *
 * İz aynı zamanda ajanı tek çağrıdan ayıran şeyi gösteriyor: adım sayısı
 * ve sırası her çalıştırmada değişiyor. Gizlenseydi geriye "yapay zekâ
 * bir şey söyledi" kalırdı ve bu, ürünün iddiasını doğrulanamaz yapardı.
 *
 * ── NİYE KAPALI BAŞLIYOR ────────────────────────────────────────────────
 * Karar okunacak şey, iz kontrol edilecek şey. Her zaman açık olsaydı
 * kararın üstünü teknik bir döküm örterdi.
 */
export default function AjanIzi({ adimlar }: { adimlar: Adim[] }) {
  const [acik, setAcik] = useState(false);
  if (!adimlar.length) return null;

  return (
    <div className="mt-3 border-t border-cizgi pt-2.5">
      <button
        type="button"
        onClick={() => setAcik((a) => !a)}
        className="cursor-pointer text-[11.5px] font-bold text-mavi-koyu hover:underline"
      >
        {acik ? '▾' : '▸'} Ajan bu karara nasıl vardı? ({adimlar.length} adım)
      </button>

      {acik && (
        <ol className="mt-2 flex flex-col gap-1">
          {adimlar.map((a) => (
            <li
              key={a.sira}
              className="flex items-baseline gap-2.5 rounded-md bg-white/70 px-3 py-1.5"
            >
              <span className="w-4 shrink-0 text-right font-mono text-[10px] font-bold text-metin-3 tabular-nums">
                {a.sira}
              </span>
              <span
                className={`min-w-0 flex-1 text-[11px] leading-relaxed font-medium ${
                  a.hataMi ? 'text-amber-koyu' : 'text-metin'
                }`}
              >
                {a.ozet}
              </span>
              <span className="shrink-0 font-mono text-[10px] text-metin-3 tabular-nums">
                {a.ms}ms
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
