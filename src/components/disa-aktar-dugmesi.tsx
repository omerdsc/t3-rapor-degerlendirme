'use client';

import { useState } from 'react';

/**
 * Sonuçları CSV olarak indirir.
 *
 * NEDEN <a download> DEĞİL DE FETCH
 * Basit bir bağlantı da indirir ama hata durumunda kullanıcı boş bir sekme
 * ya da ham JSON hatası görür. Fetch ile indirince hata yakalanıp ekranda
 * söylenebiliyor, ayrıca "indiriliyor" durumu gösterilebiliyor.
 *
 * KİMLİK SEÇENEĞİ
 * Ekranlarda kimlik maskeli ama dışa aktarma koordinasyonun kendi kaydı —
 * sonuç listesi gerçek künyeyle anlamlı. Yine de maskeli sürüm alınabiliyor:
 * hakem kalibrasyonu ya da istatistik paylaşılırken kimlik gerekmiyor.
 */
export default function DisaAktarDugmesi({
  yarismaId,
  kategoriId,
  raporSayisi,
}: {
  yarismaId: string;
  kategoriId?: string;
  raporSayisi: number;
}) {
  const [calisiyor, setCalisiyor] = useState(false);
  const [maskeli, setMaskeli] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  async function indir() {
    setCalisiyor(true);
    setHata(null);
    try {
      const q = new URLSearchParams({ yarisma: yarismaId });
      if (kategoriId) q.set('kategori', kategoriId);
      if (maskeli) q.set('maskeli', '1');

      const yanit = await fetch(`/api/disa-aktar?${q}`);
      if (!yanit.ok) {
        const d = await yanit.json().catch(() => ({}));
        setHata(d.hata ?? 'Dosya oluşturulamadı.');
        return;
      }

      // Dosya adı sunucudan geliyor: tarih ve yarışma adı orada üretiliyor.
      const bilgi = yanit.headers.get('content-disposition') ?? '';
      const ad = /filename="([^"]+)"/.exec(bilgi)?.[1] ?? 'sonuclar.csv';

      const bag = URL.createObjectURL(await yanit.blob());
      const a = document.createElement('a');
      a.href = bag;
      a.download = ad;
      a.click();
      URL.revokeObjectURL(bag);
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Ağ hatası.');
    } finally {
      setCalisiyor(false);
    }
  }

  if (!raporSayisi) return null;

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <button
        type="button"
        disabled={calisiyor}
        onClick={indir}
        className="cursor-pointer rounded-lg border border-cizgi bg-white px-3 py-1.5 text-[12px] font-bold transition-colors hover:bg-zemin disabled:opacity-50"
      >
        {calisiyor ? 'Hazırlanıyor…' : `Sonuçları indir (${raporSayisi} rapor)`}
      </button>

      <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-metin-2">
        <input
          type="checkbox"
          checked={maskeli}
          onChange={(e) => setMaskeli(e.target.checked)}
          className="size-3.5 accent-kirmizi"
        />
        kimlikleri gizle
      </label>

      {hata && (
        <span className="text-[11.5px] font-semibold text-kirmizi-koyu">{hata}</span>
      )}
    </div>
  );
}
