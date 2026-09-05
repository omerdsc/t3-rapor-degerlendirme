'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

/**
 * Rapor arama kutusu.
 *
 * NEDEN ADRES SATIRINA YAZIYOR
 * Arama sunucuda yapılıyor: ekranda maskeli görünen gerçek takım adları ve
 * numaralar istemciye hiç inmiyor. Terim adrese yazıldığı için sonuç
 * paylaşılabilir ve yenilendiğinde kaybolmuyor.
 *
 * Enter'a basılmadan istek atılmıyor — her harfte sunucuya gitmek 43
 * yarışmalık bir depoda gereksiz yük.
 */
export default function RaporArama({
  temelAdres,
  baslangic,
  ipucu,
}: {
  /** Arama terimi eklenecek adres, ör. "/raporlar?yarisma=…&durum=tumu". */
  temelAdres: string;
  baslangic?: string;
  ipucu?: string;
}) {
  const yonlendir = useRouter();
  const [terim, setTerim] = useState(baslangic ?? '');
  // Elle tutulan bayrak yerine useTransition: gezinme bitince kendiliğinden
  // sıfırlanıyor. Elle tutulduğunda sıfırlamayı unutmak düğmeyi kalıcı
  // olarak devre dışı bırakıyordu.
  const [bekliyor, gecisBaslat] = useTransition();

  function ara(deger: string) {
    const ayirac = temelAdres.includes('?') ? '&' : '?';
    const t = deger.trim();
    const adres = t
      ? `${temelAdres}${ayirac}ara=${encodeURIComponent(t)}`
      : temelAdres;
    gecisBaslat(() => yonlendir.push(adres));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        ara(terim);
      }}
      className="flex min-w-0 items-end gap-2"
    >
      <label className="min-w-0 flex-1">
        <span className="mb-1 block text-[10px] font-bold tracking-wide text-metin-3">
          ARA
        </span>
        <input
          value={terim}
          onChange={(e) => setTerim(e.target.value)}
          placeholder={ipucu ?? 'Takım adı, takım ID veya başvuru numarası…'}
          className="w-full rounded-lg border border-cizgi bg-white px-3 py-2 text-[12.5px] font-medium outline-none transition-colors hover:border-metin-3 focus:border-metin-3"
        />
      </label>
      <button
        type="submit"
        disabled={bekliyor}
        className="dugme bg-lacivert px-3.5 py-2 text-[12px] font-bold text-white transition-colors hover:bg-lacivert-2 disabled:opacity-60"
      >
        Ara
      </button>
      {baslangic && (
        <button
          type="button"
          onClick={() => {
            setTerim('');
            ara('');
          }}
          className="dugme border border-cizgi px-3 py-2 text-[12px] font-bold text-metin-2 transition-colors hover:bg-zemin"
        >
          Temizle
        </button>
      )}
    </form>
  );
}
