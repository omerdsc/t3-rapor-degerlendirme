'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

/**
 * Şablon yükleyici.
 *
 * `yarismaId` verilirse var olan yarışmaya YENİ KATEGORİ ekler; verilmezse
 * yeni yarışma kurar. Her kategori kendi şablonundan çıkarıldığı için
 * yükleme her iki durumda da aynı işi yapar.
 */
export default function SablonYukleyici({
  yarismaId,
  yarismaAdi,
}: {
  yarismaId?: string;
  yarismaAdi?: string;
}) {
  const yonlendir = useRouter();
  const girdiRef = useRef<HTMLInputElement>(null);
  const [kategoriAdi, setKategoriAdi] = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [suruklenIyor, setSuruklenIyor] = useState(false);

  const kategoriModu = !!yarismaId;

  async function gonder(dosya: File) {
    setYukleniyor(true);
    setHata(null);

    const gövde = new FormData();
    gövde.append('sablon', dosya);
    gövde.append('yil', String(new Date().getFullYear()));
    if (kategoriAdi.trim()) gövde.append('kategoriAdi', kategoriAdi.trim());
    if (yarismaId) gövde.append('yarismaId', yarismaId);

    try {
      const yanit = await fetch('/api/yarisma', {
        method: kategoriModu ? 'PATCH' : 'POST',
        body: gövde,
      });
      const veri = await yanit.json();
      if (!yanit.ok) setHata(veri.hata ?? 'Şablon işlenemedi.');
      else {
        setKategoriAdi('');
        yonlendir.refresh();
      }
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Ağ hatası.');
    } finally {
      setYukleniyor(false);
    }
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
          const d = e.dataTransfer.files[0];
          if (d) void gonder(d);
        }}
        className={`flex flex-wrap items-center gap-4 rounded-xl border-[1.5px] border-dashed bg-white px-5 py-5 transition-colors ${
          suruklenIyor ? 'border-kirmizi bg-kirmizi-zemin/40' : 'border-metin-3/50'
        }`}
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-zemin">
          {yukleniyor ? (
            <span className="size-[18px] animate-spin rounded-full border-2 border-cizgi border-t-kirmizi" />
          ) : (
            <svg viewBox="0 0 24 24" className="size-[18px] stroke-metin-2" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
              <path d="M14 2v5h5M9 13h6M9 17h4" />
            </svg>
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold">
            {yukleniyor
              ? 'Şablon çözümleniyor…'
              : kategoriModu
                ? `"${yarismaAdi}" yarışmasına kategori ekle`
                : 'Yarışma şablonunu buraya sürükleyin'}
          </p>
          <p className="mt-0.5 text-[11.5px] font-medium text-metin-2">
            Word (.docx) · her kategorinin kendi şablonu olur
          </p>
        </div>

        <input
          type="text"
          value={kategoriAdi}
          onChange={(e) => setKategoriAdi(e.target.value)}
          placeholder="Kategori adı (boşsa dosya adı)"
          className="min-w-[190px] rounded-lg border border-cizgi px-3 py-2 text-[12px] font-medium"
        />

        <input
          ref={girdiRef}
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => {
            const d = e.target.files?.[0];
            if (d) void gonder(d);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          disabled={yukleniyor}
          onClick={() => girdiRef.current?.click()}
          className="shrink-0 cursor-pointer rounded-lg bg-kirmizi px-4 py-2.5 text-[12.5px] font-bold text-white transition-colors hover:bg-kirmizi-koyu disabled:opacity-50"
        >
          Şablon seç
        </button>
      </div>

      {hata && (
        <p className="mt-2.5 rounded-lg border border-kirmizi/30 bg-kirmizi-zemin px-3.5 py-2.5 text-[12px] font-semibold text-kirmizi-koyu">
          {hata}
        </p>
      )}
    </div>
  );
}
