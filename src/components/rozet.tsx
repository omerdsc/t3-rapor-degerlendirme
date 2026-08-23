import type { Seviye } from '@/lib/analiz/tipler';
import type { RaporDurumu } from '@/lib/depo/tipler';
import { DURUM_ETIKET } from '@/lib/depo/tipler';

const SEVIYE_SINIF: Record<Seviye, string> = {
  temiz: 'bg-yesil-zemin text-yesil-koyu',
  bilgi: 'bg-mavi-zemin text-mavi-koyu',
  uyari: 'bg-amber-zemin text-amber-koyu',
  hata: 'bg-kirmizi-zemin text-kirmizi-koyu',
};

const DURUM_SINIF: Record<RaporDurumu, string> = {
  yuklendi: 'bg-zemin text-metin-2',
  analiz_ediliyor: 'bg-mavi-zemin text-mavi-koyu',
  hakem_bekliyor: 'bg-amber-zemin text-amber-koyu',
  tamamlandi: 'bg-yesil-zemin text-yesil-koyu',
  manuel_inceleme: 'bg-kirmizi-zemin text-kirmizi-koyu',
};

export function DurumRozeti({ durum }: { durum: RaporDurumu }) {
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-[9.5px] font-bold tracking-wide uppercase ${DURUM_SINIF[durum]}`}
    >
      {DURUM_ETIKET[durum]}
    </span>
  );
}

/** Kontrol sonucunu tek daire olarak gösterir — listede kontroller yan yana. */
export function KontrolNoktasi({ seviye, baslik }: { seviye: Seviye; baslik: string }) {
  const ikon =
    seviye === 'temiz' ? (
      <svg viewBox="0 0 24 24" className="size-2.5 stroke-yesil" fill="none" strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round">
        <path d="m20 6-11 11-5-5" />
      </svg>
    ) : seviye === 'hata' ? (
      <svg viewBox="0 0 24 24" className="size-2.5 stroke-kirmizi" fill="none" strokeWidth={3.2} strokeLinecap="round">
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    ) : (
      <svg
        viewBox="0 0 24 24"
        className={`size-2.5 ${seviye === 'uyari' ? 'stroke-amber' : 'stroke-mavi'}`}
        fill="none"
        strokeWidth={3.2}
        strokeLinecap="round"
      >
        <path d="M12 7v6M12 16.5v.5" />
      </svg>
    );

  return (
    <span
      title={baslik}
      className={`flex size-[18px] items-center justify-center rounded-full ${SEVIYE_SINIF[seviye].split(' ')[0]}`}
    >
      {ikon}
    </span>
  );
}

export function SeviyeRozeti({ seviye, metin }: { seviye: Seviye; metin: string }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-[9.5px] font-bold tracking-wide ${SEVIYE_SINIF[seviye]}`}>
      {metin}
    </span>
  );
}
