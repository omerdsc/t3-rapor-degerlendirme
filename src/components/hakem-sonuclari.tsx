'use client';

import { useState } from 'react';
import type { RubrikKriteri } from '@/lib/analiz/sablon-cikar';

/**
 * Hakem değerlendirmelerinin koordinasyona dönüşü.
 *
 * ── NEDEN YAN YANA ──────────────────────────────────────────────────────
 * İki hakemin puanını ayrı ayrı göstermek yetmez; koordinasyonun sorusu
 * "aynı şeyi mi gördüler?". Ölçüt bazında yan yana konduğunda hangi
 * ölçütte ayrıştıkları tek bakışta görünüyor — nihai puanı tartışmak
 * gerektiğinde konuşulacak yer orası.
 *
 * ── SAPMA UYARISI ───────────────────────────────────────────────────────
 * Ortalama tek başına yanıltıcı: 80 ve 60 ile 71 ve 69 aynı ortalamayı
 * verir ama biri mutabakat öteki anlaşmazlık. Bu yüzden hakemler arası
 * fark ayrıca hesaplanıp eşiği geçtiğinde uyarı gösteriliyor.
 */

export interface HakemSonucu {
  hakemId: string;
  hakemAdi: string;
  kurum?: string;
  durum: 'taslak' | 'tamamlandi' | 'baslanmadi';
  toplam?: number;
  aciklama?: string;
  tamamlandi?: string;
  puanlar: Record<string, { puan: number; not?: string }>;
}

/** Bu farkın üstündeki ayrışma koordinasyonun bakması gereken bir sinyal. */
const SAPMA_ESIGI = 10;

export default function HakemSonuclari({
  olcutler,
  toplamPuan,
  sonuclar,
  nihaiPuan,
  aiToplam,
}: {
  olcutler: RubrikKriteri[];
  toplamPuan: number;
  sonuclar: HakemSonucu[];
  nihaiPuan?: number;
  aiToplam?: number;
}) {
  const [acik, setAcik] = useState(false);

  const bitmis = sonuclar.filter((s) => s.durum === 'tamamlandi');
  const bekleyen = sonuclar.filter((s) => s.durum !== 'tamamlandi');
  const puanlar = bitmis.map((s) => s.toplam ?? 0);
  const sapma = puanlar.length > 1 ? Math.max(...puanlar) - Math.min(...puanlar) : 0;

  if (!sonuclar.length) {
    return (
      <div className="mb-4 rounded-xl bg-amber-zemin px-4 py-3">
        <p className="text-[11.5px] leading-relaxed font-medium text-amber-koyu">
          <strong className="font-bold">Bu rapora hakem atanmamış.</strong>{' '}
          Değerlendirme başlaması için Hakemler ekranından atama yapmalısınız.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-cizgi bg-white">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-cizgi px-4 py-3">
        <h2 className="text-[13px] font-bold">Hakem değerlendirmeleri</h2>
        <span className="text-[11.5px] font-medium text-metin-2">
          {bitmis.length}/{sonuclar.length} tamamlandı
        </span>

        {sapma > SAPMA_ESIGI && (
          <span
            className="rounded bg-amber-zemin px-2 py-0.5 text-[9.5px] font-bold tracking-wide text-amber-koyu"
            title="Hakemler arası fark yüksek; nihai puan tartışılmalı"
          >
            {Math.round(sapma * 10) / 10} PUAN AYRIŞMA
          </span>
        )}

        <div className="ml-auto flex items-center gap-4">
          {aiToplam !== undefined && (
            <span className="text-[11px] font-medium text-metin-2">
              yapay zekâ önerisi {aiToplam}
            </span>
          )}
          {nihaiPuan !== undefined && (
            <div className="text-right">
              <div className="text-[9.5px] font-bold tracking-wide text-metin-2">
                NİHAİ (ORTALAMA)
              </div>
              <div className="text-[18px] leading-tight font-extrabold text-yesil-koyu">
                {nihaiPuan}
                <span className="text-[12px] font-semibold text-metin-2">
                  /{toplamPuan}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hakem başına toplam — ilk bakışta görünen şey */}
      <div className="flex flex-col gap-1.5 px-4 py-3">
        {sonuclar.map((s) => (
          <div
            key={s.hakemId}
            className={`flex flex-wrap items-center gap-2.5 rounded-lg px-3 py-2 ${
              s.durum === 'tamamlandi' ? 'bg-zemin/60' : 'bg-amber-zemin/50'
            }`}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-bold">
                {s.hakemAdi}
              </span>
              {s.kurum && (
                <span className="block text-[10.5px] font-medium text-metin-2">
                  {s.kurum}
                </span>
              )}
            </span>

            <span
              className={`w-[104px] shrink-0 rounded px-2 py-0.5 text-center text-[9.5px] font-bold tracking-wide ${
                s.durum === 'tamamlandi'
                  ? 'bg-yesil-zemin text-yesil-koyu'
                  : s.durum === 'taslak'
                    ? 'bg-mavi-zemin text-mavi-koyu'
                    : 'bg-zemin text-metin-2'
              }`}
            >
              {s.durum === 'tamamlandi'
                ? 'TAMAMLANDI'
                : s.durum === 'taslak'
                  ? 'TASLAK'
                  : 'BAŞLANMADI'}
            </span>

            <span className="w-16 shrink-0 text-right text-[15px] font-extrabold">
              {s.toplam !== undefined ? s.toplam : '—'}
            </span>

            {s.tamamlandi && (
              <span className="w-[76px] shrink-0 text-right text-[10.5px] font-medium text-metin-2">
                {new Date(s.tamamlandi).toLocaleDateString('tr')}
              </span>
            )}
          </div>
        ))}
      </div>

      {!!bekleyen.length && (
        <p className="border-t border-cizgi bg-amber-zemin/40 px-4 py-2 text-[11px] leading-relaxed font-medium text-amber-koyu">
          {bekleyen.length} hakem henüz bitirmedi; nihai puan yalnızca
          tamamlanan {bitmis.length} değerlendirmenin ortalaması. Rapor,
          bütün hakemler bitirmeden &ldquo;tamamlandı&rdquo; sayılmıyor.
        </p>
      )}

      {bitmis.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => setAcik((a) => !a)}
            className="w-full cursor-pointer border-t border-cizgi px-4 py-2 text-left text-[11.5px] font-bold text-kirmizi transition-colors hover:bg-zemin/60"
          >
            {acik ? 'Ölçüt karşılaştırmasını kapat' : 'Ölçüt bazında karşılaştır →'}
          </button>

          {acik && (
            <div className="overflow-x-auto border-t border-cizgi px-4 py-3">
              <table className="w-full min-w-[520px] text-[11.5px]">
                <thead>
                  <tr className="text-left text-[9.5px] font-bold tracking-wide text-metin-3">
                    <th className="pb-1.5">ÖLÇÜT</th>
                    {bitmis.map((s) => (
                      <th key={s.hakemId} className="pb-1.5 text-center">
                        {s.hakemAdi.split(' ').slice(-1)[0].toLocaleUpperCase('tr')}
                      </th>
                    ))}
                    <th className="pb-1.5 text-center">FARK</th>
                  </tr>
                </thead>
                <tbody>
                  {olcutler.map((o) => {
                    const degerler = bitmis.map((s) => s.puanlar[o.kod]?.puan);
                    const gecerli = degerler.filter(
                      (d): d is number => d !== undefined,
                    );
                    const fark =
                      gecerli.length > 1
                        ? Math.round((Math.max(...gecerli) - Math.min(...gecerli)) * 10) / 10
                        : 0;
                    // Ölçütün yarısından fazla ayrışma dikkat çekmeli.
                    const dikkat = fark > o.puan * 0.3;

                    return (
                      <tr
                        key={o.kod}
                        className={`border-t border-cizgi ${dikkat ? 'bg-amber-zemin/40' : ''}`}
                      >
                        <td className="py-1.5 font-medium">
                          {o.ad}
                          <span className="ml-1 text-metin-3">/{o.puan}</span>
                        </td>
                        {degerler.map((d, i) => (
                          <td key={i} className="py-1.5 text-center font-bold">
                            {d ?? '—'}
                          </td>
                        ))}
                        <td
                          className={`py-1.5 text-center font-bold ${
                            dikkat ? 'text-amber-koyu' : 'text-metin-3'
                          }`}
                        >
                          {fark || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <p className="mt-2 text-[10.5px] leading-relaxed font-medium text-metin-2">
                Sarı satırlar, hakemlerin ölçüt puanının %30&apos;undan fazla
                ayrıştığı yerler. Ortalama tek başına yanıltıcıdır: 80 ile 60
                da, 71 ile 69 da aynı ortalamayı verir — biri anlaşmazlık,
                öteki mutabakat.
              </p>
            </div>
          )}
        </>
      )}

      {bitmis.some((s) => s.aciklama) && (
        <div className="border-t border-cizgi px-4 py-3">
          <h3 className="mb-1.5 text-[10px] font-bold tracking-wide text-metin-3">
            HAKEM NOTLARI
          </h3>
          <div className="flex flex-col gap-2">
            {bitmis
              .filter((s) => s.aciklama)
              .map((s) => (
                <div key={s.hakemId} className="rounded-lg bg-zemin/60 px-3 py-2">
                  <p className="text-[10.5px] font-bold text-metin-2">{s.hakemAdi}</p>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed">{s.aciklama}</p>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
