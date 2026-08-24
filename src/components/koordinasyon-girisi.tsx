'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** Anahtar formu — girişten sonra kullanıcı gitmek istediği yere döner. */
export default function KoordinasyonGirisi({ devam }: { devam: string }) {
  const yonlendir = useRouter();
  const [anahtar, setAnahtar] = useState('');
  const [calisiyor, setCalisiyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  async function gir() {
    setCalisiyor(true);
    setHata(null);
    try {
      const y = await fetch('/api/koordinasyon-giris', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ anahtar }),
      });
      if (!y.ok) {
        const d = await y.json();
        setHata(d.hata ?? 'Giriş başarısız.');
      } else {
        // `replace`: geri tuşu giriş sayfasına dönmesin.
        yonlendir.replace(devam);
      }
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Ağ hatası.');
    } finally {
      setCalisiyor(false);
    }
  }

  return (
    <div className="w-full">
      <label className="block">
        <span className="mb-1.5 block text-[10px] font-bold tracking-wide text-metin-3">
          KOORDİNASYON ANAHTARI
        </span>
        <input
          type="password"
          value={anahtar}
          onChange={(e) => setAnahtar(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && anahtar && gir()}
          autoComplete="current-password"
          autoFocus
          className="w-full rounded-lg border border-cizgi bg-white px-3.5 py-2.5 text-[13px] font-semibold outline-none focus:border-metin-3"
        />
      </label>

      {hata && (
        <p className="mt-2.5 rounded-md bg-kirmizi-zemin px-3 py-2 text-[11.5px] font-semibold text-kirmizi-koyu">
          {hata}
        </p>
      )}

      <button
        type="button"
        disabled={!anahtar || calisiyor}
        onClick={gir}
        className="mt-3 w-full cursor-pointer rounded-lg bg-kirmizi px-4 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-kirmizi-koyu disabled:opacity-50"
      >
        {calisiyor ? 'Giriliyor…' : 'Koordinasyon paneline gir'}
      </button>
    </div>
  );
}
