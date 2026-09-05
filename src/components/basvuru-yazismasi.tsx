'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { BasvuruMesaji } from '@/lib/db/basvuru-mesaji';

/**
 * Başvuru yazışması — yarışmacı ve koordinasyon aynı bileşeni kullanıyor.
 *
 * ── NİYE AYNI BİLEŞEN ───────────────────────────────────────────────────
 * İki taraf da aynı konuşmayı görüyor; farklı olan yalnızca kimin
 * balonunun sağda durduğu. İki ayrı bileşen yazılsaydı, birine eklenen
 * bir düzeltme ötekinde eksik kalır ve iki taraf aynı yazışmayı farklı
 * görürdü.
 */
export default function BasvuruYazismasi({
  basvuruId,
  mesajlar,
  benimRolum,
}: {
  basvuruId: string;
  mesajlar: BasvuruMesaji[];
  benimRolum: 'yarismaci' | 'koordinasyon';
}) {
  const yonlendir = useRouter();
  const [metin, setMetin] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);

  async function gonder() {
    if (!metin.trim()) return;
    setHata(null);
    setCalisiyor(true);
    try {
      const y = await fetch(
        `/api/yarismaci/mesaj?basvuru=${encodeURIComponent(basvuruId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ metin }),
        },
      );
      if (!y.ok) {
        setHata((await y.json()).hata ?? 'Mesaj gönderilemedi.');
        return;
      }
      setMetin('');
      yonlendir.refresh();
    } catch {
      setHata('Sunucuya ulaşılamadı.');
    } finally {
      setCalisiyor(false);
    }
  }

  return (
    <div className="rounded-xl border border-cizgi bg-white">
      <div className="border-b border-cizgi px-5 py-3.5">
        <h2 className="text-[13px] font-extrabold tracking-tight">
          {benimRolum === 'yarismaci' ? 'Yarışma koordinasyonu' : 'Yarışmacı ile yazışma'}
        </h2>
        <p className="mt-0.5 text-[11px] font-medium text-metin-2">
          {benimRolum === 'yarismaci'
            ? 'Başvurunuzla ilgili sorunuzu buradan iletebilirsiniz.'
            : 'Bu başvuru hakkında yarışmacıyla yazışma.'}
        </p>
      </div>

      {mesajlar.length > 0 && (
        <ul className="flex flex-col gap-3 px-5 py-4">
          {mesajlar.map((m) => {
            const benim = m.yazarRol === benimRolum;
            return (
              <li key={m.id} className={`flex ${benim ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3.5 py-2.5 ${
                    benim ? 'bg-lacivert text-white' : 'bg-zemin'
                  }`}
                >
                  <p
                    className={`mb-0.5 text-[10px] font-bold tracking-wide ${
                      benim ? 'text-white/60' : 'text-metin-3'
                    }`}
                  >
                    {m.yazarAdi} · {new Date(m.tarih).toLocaleString('tr')}
                  </p>
                  {/* whitespace-pre-line: yarışmacının satır sonları korunuyor.
                      Tek satıra ezilen bir mesaj okunmaz hâle gelir. */}
                  <p className="text-[12.5px] leading-relaxed font-medium whitespace-pre-line">
                    {m.metin}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="border-t border-cizgi px-5 py-4">
        <textarea
          value={metin}
          onChange={(e) => setMetin(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder={
            benimRolum === 'yarismaci'
              ? 'Sorunuzu yazın…'
              : 'Yarışmacıya yanıtınızı yazın…'
          }
          className="w-full rounded-lg border border-cizgi bg-white px-3 py-2.5 text-[12.5px] leading-relaxed font-medium outline-none focus:border-metin-3"
        />

        {hata && (
          <p role="alert" className="mt-2 rounded-lg bg-kirmizi-zemin px-3 py-2 text-[12px] font-semibold text-kirmizi-koyu">
            {hata}
          </p>
        )}

        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={gonder}
            disabled={!metin.trim() || calisiyor}
            className="dugme bg-kirmizi px-4 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-kirmizi-koyu"
          >
            {calisiyor ? 'Gönderiliyor…' : 'Gönder'}
          </button>
          <span className="text-[10.5px] font-medium text-metin-3">
            {metin.length}/2000
          </span>
        </div>
      </div>
    </div>
  );
}
