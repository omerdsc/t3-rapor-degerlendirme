'use client';

import Link from 'next/link';
import { useState } from 'react';

/**
 * Hakem mesajı bildirimi — koordinasyon kenar çubuğunda.
 *
 * ── NİYE KENAR ÇUBUĞUNDA ────────────────────────────────────────────────
 * Bekleyen soru önce yalnızca PANODA görünüyordu. Koordinasyon raporlar ya
 * da hakemler ekranında çalışıyorsa hiçbir şey görmüyordu — bildirimi
 * görmek için panoya dönmesi gerekiyordu, yani bildirimin varlığını
 * bilmesi gerekiyordu.
 *
 * Bildirim kullanıcıyı BULMALI. Kenar çubuğu her koordinasyon ekranında
 * duruyor; bildirim de orada.
 *
 * ── NİYE AÇILIR LİSTE, NİYE TEK BAĞLANTI DEĞİL ──────────────────────────
 * Birden çok soru varsa "ilkini aç" demek kalanları görünmez yapar.
 * Liste, hangi hakemin hangi rapor için sorduğunu tek bakışta gösteriyor.
 */

export interface BekleyenSoru {
  raporId: string;
  basvuruNo: string;
  proje: string;
  hakemAdi: string;
  tarih: string;
  /** v4 öncesi kayıtlarda boş olabilir. */
  hakemId?: string;
}

function neZaman(iso: string): string {
  const dk = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (dk < 60) return `${Math.max(1, dk)} dk`;
  if (dk < 1440) return `${Math.floor(dk / 60)} saat`;
  return `${Math.floor(dk / 1440)} gün`;
}

export default function Bildirim({ sorular }: { sorular: BekleyenSoru[] }) {
  const [acik, setAcik] = useState(false);

  if (!sorular.length) return null;

  return (
    <div className="relative px-3 pb-1">
      <button
        type="button"
        onClick={() => setAcik((a) => !a)}
        aria-expanded={acik}
        className="flex w-full items-center gap-2.5 rounded-lg bg-kirmizi px-2.5 py-2 text-left transition-colors hover:bg-kirmizi-koyu"
      >
        <svg viewBox="0 0 24 24" className="size-4 shrink-0 stroke-white" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-bold text-white">
            {sorular.length} hakem mesajı
          </span>
          <span className="mt-0.5 block text-[9.5px] font-medium text-white/75">
            cevap bekliyor
          </span>
        </span>
        <span className="text-[10px] text-white/70">{acik ? '▲' : '▼'}</span>
      </button>

      {acik && (
        <ul className="mt-1 flex flex-col gap-0.5 rounded-lg bg-lacivert-2 p-1.5">
          {sorular.slice(0, 8).map((s) => (
            /*
             * Anahtar rapor + hakem: aynı raporda İKİ hakem birden cevap
             * bekliyor olabilir ve bunlar ayrı iki satır.
             *
             * Bağlantı hangi hakem olduğunu da taşıyor — yazışma o hakem
             * seçili açılıyor. Taşımasa koordinasyon doğru sohbeti elle
             * araması gerekirdi; bildirimin işi tam olarak bunu
             * gereksiz kılmak.
             */
            <li key={`${s.raporId}-${s.hakemId ?? ''}`}>
              <Link
                href={
                  `/koordinasyon/rapor/${s.raporId}`
                  + (s.hakemId ? `?hakem=${encodeURIComponent(s.hakemId)}` : '')
                  + '#yazisma'
                }
                onClick={() => setAcik(false)}
                className="block rounded-md px-2 py-1.5 transition-colors hover:bg-lacivert-3"
              >
                <span className="flex items-baseline gap-1.5">
                  <span className="min-w-0 flex-1 truncate font-mono text-[10.5px] font-bold text-white">
                    {s.basvuruNo}
                  </span>
                  <span className="shrink-0 text-[9px] font-medium text-metin-2">
                    {neZaman(s.tarih)}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-[10px] font-medium text-metin-2">
                  {s.hakemAdi}
                </span>
              </Link>
            </li>
          ))}
          {sorular.length > 8 && (
            <li className="px-2 py-1 text-[9.5px] font-medium text-metin-2">
              +{sorular.length - 8} tane daha
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
