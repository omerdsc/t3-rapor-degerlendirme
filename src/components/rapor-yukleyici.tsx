'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import type { Kategori } from '@/lib/analiz/kategori';

interface Kayit {
  ad: string;
  durum: 'bekliyor' | 'tamam' | 'hata';
  mesaj?: string;
}

export default function RaporYukleyici({
  yarismaId,
  kategoriId,
  kategoriAdi,
  icerikKategorileri,
}: {
  yarismaId: string;
  /** Yarışma kategorisi — şablon ve rubrik buradan gelir. */
  kategoriId: string;
  kategoriAdi: string;
  /** İçerik sınıflandırması için alan tanımları (MVP 4). */
  icerikKategorileri: Kategori[];
}) {
  const yonlendir = useRouter();
  const girdiRef = useRef<HTMLInputElement>(null);
  const [kayitlar, setKayitlar] = useState<Kayit[]>([]);
  const [icerikKategori, setIcerikKategori] = useState('');
  const [suruklenIyor, setSuruklenIyor] = useState(false);

  async function gonder(dosyalar: FileList | File[]) {
    const liste = Array.from(dosyalar).filter((d) => d.size > 0);
    if (!liste.length) return;

    setKayitlar(liste.map((d) => ({ ad: d.name, durum: 'bekliyor' })));

    // Sıralı işliyoruz: paralel PDF ayrıştırma tek makinede belleği zorluyor.
    for (let i = 0; i < liste.length; i++) {
      const gövde = new FormData();
      gövde.append('dosya', liste[i]);
      gövde.append('yarismaId', yarismaId);
      gövde.append('kategoriId', kategoriId);
      if (icerikKategori) gövde.append('icerikKategori', icerikKategori);

      try {
        const yanit = await fetch('/api/rapor', { method: 'POST', body: gövde });
        const veri = await yanit.json();
        setKayitlar((ö) => {
          const y = [...ö];
          y[i] = yanit.ok
            ? { ad: liste[i].name, durum: 'tamam' }
            : { ad: liste[i].name, durum: 'hata', mesaj: veri.hata };
          return y;
        });
      } catch (e) {
        setKayitlar((ö) => {
          const y = [...ö];
          y[i] = { ad: liste[i].name, durum: 'hata', mesaj: e instanceof Error ? e.message : 'Ağ hatası' };
          return y;
        });
      }
    }
    yonlendir.refresh();
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setSuruklenIyor(true);
        }}
        onDragLeave={() => setSuruklenIyor(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSuruklenIyor(false);
          void gonder(e.dataTransfer.files);
        }}
        className={`flex flex-wrap items-center gap-4 rounded-xl border-[1.5px] border-dashed bg-white px-5 py-5 transition-colors ${
          suruklenIyor ? 'border-kirmizi bg-kirmizi-zemin/40' : 'border-metin-3/50'
        }`}
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-zemin">
          <svg viewBox="0 0 24 24" className="size-[18px] stroke-metin-2" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <path d="m17 8-5-5-5 5M12 3v12" />
          </svg>
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold">
            Raporları buraya sürükleyin
            <span className="ml-1.5 font-semibold text-metin-2">→ {kategoriAdi}</span>
          </p>
          <p className="mt-0.5 text-[11.5px] font-medium text-metin-2">
            PDF veya Word · en fazla 25 MB · bu kategorinin şablonuyla denetlenir
          </p>
        </div>

        {icerikKategorileri.length > 0 && (
          <select
            value={icerikKategori}
            onChange={(e) => setIcerikKategori(e.target.value)}
            title="Yarışmacının beyan ettiği içerik alanı — kategori uyumu kontrolü bunu kullanır"
            className="rounded-lg border border-cizgi bg-white px-3 py-2 text-[12px] font-semibold"
          >
            <option value="">İçerik alanı beyanı yok</option>
            {icerikKategorileri.map((k) => (
              <option key={k.kod} value={k.kod}>
                {k.ad}
              </option>
            ))}
          </select>
        )}

        <input
          ref={girdiRef}
          type="file"
          accept=".pdf,.docx,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void gonder(e.target.files);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => girdiRef.current?.click()}
          className="shrink-0 cursor-pointer rounded-lg bg-kirmizi px-4 py-2.5 text-[12.5px] font-bold text-white transition-colors hover:bg-kirmizi-koyu"
        >
          Dosya seç
        </button>
      </div>

      {kayitlar.length > 0 && (
        <ul className="mt-2.5 flex flex-col gap-1">
          {kayitlar.map((k, i) => (
            <li
              key={`${k.ad}-${i}`}
              className="flex items-center gap-2.5 rounded-lg border border-cizgi bg-white px-3.5 py-2 text-[11.5px]"
            >
              {k.durum === 'bekliyor' && (
                <span className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-cizgi border-t-kirmizi" />
              )}
              {k.durum === 'tamam' && (
                <svg viewBox="0 0 24 24" className="size-3.5 shrink-0 stroke-yesil" fill="none" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round">
                  <path d="m20 6-11 11-5-5" />
                </svg>
              )}
              {k.durum === 'hata' && (
                <svg viewBox="0 0 24 24" className="size-3.5 shrink-0 stroke-kirmizi" fill="none" strokeWidth={3} strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              )}
              <span className="truncate font-semibold">{k.ad}</span>
              {k.mesaj && <span className="text-kirmizi-koyu">{k.mesaj}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
