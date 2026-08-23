'use client';

import { useState } from 'react';
import type { Mesaj } from '@/lib/depo/tipler';

/**
 * Rapor üzerindeki yazışma.
 *
 * Hakem ve koordinasyon arasındaki her not değerlendirme metnine yazılamaz:
 * "bu takımın geçen yıl raporuyla karşılaştırılsın mı", "şablon sürümünü
 * teyit et", "bu bulguyu ben açtım" gibi şeyler rapora değil sürece aittir.
 *
 * Bu yazışma YARIŞMACIYA GÖSTERİLMEZ.
 */

const ROL_ETIKET: Record<Mesaj['rol'], string> = {
  hakem: 'Hakem',
  koordinasyon: 'Koordinasyon',
  yarisma_yoneticisi: 'Yarışma Yöneticisi',
  sistem: 'Sistem',
};

const ROL_SINIF: Record<Mesaj['rol'], string> = {
  hakem: 'bg-kirmizi-zemin text-kirmizi-koyu',
  koordinasyon: 'bg-mavi-zemin text-mavi-koyu',
  yarisma_yoneticisi: 'bg-amber-zemin text-amber-koyu',
  sistem: 'bg-zemin text-metin-2',
};

export default function Yazisma({
  raporId,
  baslangic,
}: {
  raporId: string;
  baslangic: Mesaj[];
}) {
  const [mesajlar, setMesajlar] = useState<Mesaj[]>(baslangic);
  const [metin, setMetin] = useState('');
  const [yazar, setYazar] = useState('');
  const [rol, setRol] = useState<Mesaj['rol']>('hakem');
  const [calisiyor, setCalisiyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  async function gonder() {
    setCalisiyor(true);
    setHata(null);
    try {
      const yanit = await fetch(`/api/rapor/${raporId}/mesaj`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metin, yazar, rol }),
      });
      const veri = await yanit.json();
      if (!yanit.ok) setHata(veri.hata ?? 'Mesaj gönderilemedi.');
      else {
        setMesajlar(veri.mesajlar ?? []);
        setMetin('');
      }
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Ağ hatası.');
    } finally {
      setCalisiyor(false);
    }
  }

  return (
    <section className="mt-4 rounded-xl border border-cizgi bg-white">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-cizgi px-5 py-3.5">
        <span className="h-4 w-[3px] rounded-sm bg-kirmizi" />
        <h2 className="text-[14px] font-bold">Hakem–Koordinasyon Yazışması</h2>
        <span className="rounded bg-zemin px-2 py-0.5 text-[10px] font-bold text-metin-2">
          {mesajlar.length} mesaj
        </span>
        <span className="ml-auto text-[10.5px] font-semibold text-metin-2">
          Yarışmacıya gösterilmez
        </span>
      </div>

      <div className="flex flex-col gap-2.5 px-5 py-4">
        {!mesajlar.length && (
          <p className="text-[12px] font-medium text-metin-2">
            Henüz mesaj yok. Değerlendirmeyle ilgili bir soru, hatırlatma veya
            karar buraya yazılabilir — rapora yazmaya gerek kalmaz.
          </p>
        )}

        {mesajlar.map((m) => (
          <article
            key={m.id}
            className={`rounded-[10px] px-3.5 py-2.5 ${
              m.rol === 'sistem' ? 'bg-zemin/60' : 'border border-cizgi'
            }`}
          >
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wide ${ROL_SINIF[m.rol]}`}>
                {ROL_ETIKET[m.rol]}
              </span>
              <span className="text-[11.5px] font-bold">{m.yazar}</span>
              <span className="ml-auto text-[10.5px] font-medium text-metin-3">
                {new Date(m.tarih).toLocaleString('tr', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <p className="text-[12px] leading-relaxed whitespace-pre-line">{m.metin}</p>
          </article>
        ))}
      </div>

      <div className="flex flex-col gap-2 border-t border-cizgi bg-zemin/40 px-5 py-3.5">
        <div className="flex flex-wrap gap-2">
          <input
            value={yazar}
            onChange={(e) => setYazar(e.target.value)}
            placeholder="Adınız"
            className="w-[150px] rounded-lg border border-cizgi bg-white px-3 py-2 text-[12px] font-medium"
          />
          <select
            value={rol}
            onChange={(e) => setRol(e.target.value as Mesaj['rol'])}
            className="rounded-lg border border-cizgi bg-white px-3 py-2 text-[12px] font-semibold"
          >
            <option value="hakem">Hakem</option>
            <option value="koordinasyon">Koordinasyon</option>
            <option value="yarisma_yoneticisi">Yarışma Yöneticisi</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <textarea
            value={metin}
            onChange={(e) => setMetin(e.target.value)}
            rows={2}
            placeholder="Mesaj yaz…"
            className="min-w-[240px] flex-1 rounded-lg border border-cizgi bg-white px-3 py-2 text-[12px]"
          />
          <button
            type="button"
            disabled={calisiyor || metin.trim().length < 2}
            onClick={gonder}
            className="self-end rounded-lg bg-kirmizi px-4 py-2.5 text-[12.5px] font-bold text-white transition-colors hover:bg-kirmizi-koyu disabled:opacity-50"
          >
            {calisiyor ? 'Gönderiliyor…' : 'Gönder'}
          </button>
        </div>
        {hata && <p className="text-[11.5px] font-semibold text-kirmizi-koyu">{hata}</p>}
      </div>
    </section>
  );
}
