'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

/**
 * Rapor–hakem atama paneli.
 *
 * ── TOPLU ATAMA MERKEZDE ────────────────────────────────────────────────
 * Bir kategoride 100 rapor ve 5 hakem varsa tek tek atamak 100 tıklama
 * demek; koordinasyon bunu yapmaz ve özellik ölü kalır. Bu yüzden asıl
 * eylem "seçili raporları seçili hakemlere dengeli dağıt".
 *
 * Tek tek atama da mümkün: uzmanlık gerektiren bir rapor belirli bir
 * hakeme verilmek istenebilir.
 */

export interface AtamaSatiri {
  raporId: string;
  basvuruNo: string;
  takimRumuzu: string;
  proje: string;
  kategoriAdi: string;
  atananlar: Array<{ id: string; ad: string; tamamladi: boolean }>;
  kritikBulgu: boolean;
}

export interface HakemSecenegi {
  id: string;
  ad: string;
  kurum?: string;
  atanan: number;
  uzmanlik: string[];
}

export default function AtamaPaneli({
  yarismaId,
  kategoriId,
  satirlar,
  hakemler,
}: {
  yarismaId: string;
  kategoriId?: string;
  satirlar: AtamaSatiri[];
  hakemler: HakemSecenegi[];
}) {
  const yonlendir = useRouter();
  const [secili, setSecili] = useState<Set<string>>(new Set());
  const [seciliHakem, setSeciliHakem] = useState<Set<string>>(new Set());
  const [basinaHakem, setBasinaHakem] = useState(1);
  const [sonTarih, setSonTarih] = useState('');
  const [calisiyor, setCalisiyor] = useState(false);
  const [mesaj, setMesaj] = useState<{ metin: string; hata?: boolean } | null>(null);

  const atanmamis = useMemo(
    () => satirlar.filter((s) => !s.atananlar.length),
    [satirlar],
  );

  function raporSec(id: string) {
    setSecili((o) => {
      const y = new Set(o);
      if (y.has(id)) y.delete(id);
      else y.add(id);
      return y;
    });
  }

  function hakemSec(id: string) {
    setSeciliHakem((o) => {
      const y = new Set(o);
      if (y.has(id)) y.delete(id);
      else y.add(id);
      return y;
    });
  }

  async function ata(raporIdler: string[]) {
    if (!seciliHakem.size) {
      setMesaj({ metin: 'En az bir hakem seçin.', hata: true });
      return;
    }
    setCalisiyor(true);
    setMesaj(null);
    try {
      const y = await fetch('/api/atama', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          raporIdler,
          hakemIdler: [...seciliHakem],
          yarismaId,
          kategoriId,
          atayan: 'koordinasyon',
          sonTarih: sonTarih || undefined,
          raporBasinaHakem: basinaHakem,
        }),
      });
      const d = await y.json();
      if (!y.ok) setMesaj({ metin: d.hata ?? 'Atama başarısız.', hata: true });
      else {
        setMesaj({
          metin:
            `${d.yapilan} atama yapıldı` +
            (d.atlanan?.length ? ` · ${d.atlanan.length} atlandı` : ''),
        });
        setSecili(new Set());
        yonlendir.refresh();
      }
    } catch (e) {
      setMesaj({ metin: e instanceof Error ? e.message : 'Ağ hatası.', hata: true });
    } finally {
      setCalisiyor(false);
    }
  }

  async function kaldir(raporId: string, hakemId: string) {
    setCalisiyor(true);
    setMesaj(null);
    try {
      const y = await fetch('/api/atama', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ raporId, hakemId }),
      });
      const d = await y.json();
      setMesaj({
        metin: d.kaldirildi ? 'Atama kaldırıldı.' : (d.neden ?? 'Kaldırılamadı.'),
        hata: !d.kaldirildi,
      });
      yonlendir.refresh();
    } finally {
      setCalisiyor(false);
    }
  }

  if (!hakemler.length) {
    return (
      <p className="rounded-xl bg-amber-zemin px-4 py-3 text-[12px] font-semibold text-amber-koyu">
        Atama yapabilmek için önce hakem kaydı gerekiyor.
      </p>
    );
  }

  return (
    <div>
      {/* HAKEM SEÇİMİ — yük bilgisi yanında, dengeli dağıtım için */}
      <div className="mb-3 rounded-xl border border-cizgi bg-white px-4 py-3.5">
        <h3 className="mb-2 text-[12.5px] font-bold">
          1 · Hakemleri seçin
          <span className="ml-2 font-medium text-metin-2">
            {seciliHakem.size} seçili
          </span>
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {hakemler.map((h) => {
            const s = seciliHakem.has(h.id);
            return (
              <button
                key={h.id}
                type="button"
                onClick={() => hakemSec(h.id)}
                title={[h.kurum, ...h.uzmanlik].filter(Boolean).join(' · ')}
                className={`cursor-pointer rounded-lg px-3 py-1.5 text-[12px] font-bold transition-colors ${
                  s
                    ? 'bg-lacivert text-white'
                    : 'border border-cizgi text-metin-2 hover:bg-zemin'
                }`}
              >
                {h.ad}
                <span className={`ml-1.5 ${s ? 'text-white/60' : 'text-metin-3'}`}>
                  {h.atanan}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-cizgi pt-3">
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold tracking-wide text-metin-3">
              RAPOR BAŞINA HAKEM
            </span>
            <select
              value={basinaHakem}
              onChange={(e) => setBasinaHakem(Number(e.target.value))}
              className="cursor-pointer rounded-lg border border-cizgi px-3 py-1.5 text-[12.5px] font-semibold outline-none"
            >
              {[1, 2, 3].map((n) => (
                <option key={n} value={n} disabled={n > seciliHakem.size}>
                  {n} hakem
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold tracking-wide text-metin-3">
              SON TARİH (isteğe bağlı)
            </span>
            <input
              type="date"
              value={sonTarih}
              onChange={(e) => setSonTarih(e.target.value)}
              className="rounded-lg border border-cizgi px-3 py-1.5 text-[12.5px] font-medium outline-none"
            />
          </label>

          <div className="ml-auto flex flex-wrap gap-2">
            <button
              type="button"
              disabled={calisiyor || !seciliHakem.size || !atanmamis.length}
              onClick={() => ata(atanmamis.map((s) => s.raporId))}
              className="cursor-pointer rounded-lg bg-kirmizi px-3.5 py-2 text-[12px] font-bold text-white transition-colors hover:bg-kirmizi-koyu disabled:opacity-50"
            >
              Atanmamış {atanmamis.length} raporu dağıt
            </button>
            <button
              type="button"
              disabled={calisiyor || !seciliHakem.size || !secili.size}
              onClick={() => ata([...secili])}
              className="cursor-pointer rounded-lg border border-lacivert px-3.5 py-2 text-[12px] font-bold text-lacivert transition-colors hover:bg-zemin disabled:opacity-50"
            >
              Seçili {secili.size} raporu ata
            </button>
          </div>
        </div>
      </div>

      {mesaj && (
        <p
          className={`mb-3 rounded-lg px-3.5 py-2.5 text-[12px] font-semibold ${
            mesaj.hata
              ? 'bg-amber-zemin text-amber-koyu'
              : 'bg-yesil-zemin text-yesil-koyu'
          }`}
        >
          {mesaj.metin}
        </p>
      )}

      <div className="mb-2 flex flex-wrap items-center gap-2.5">
        <h3 className="text-[12.5px] font-bold">2 · Raporlar</h3>
        <button
          type="button"
          onClick={() =>
            setSecili(
              secili.size === satirlar.length
                ? new Set()
                : new Set(satirlar.map((s) => s.raporId)),
            )
          }
          className="cursor-pointer text-[11.5px] font-bold text-kirmizi"
        >
          {secili.size === satirlar.length ? 'Seçimi kaldır' : 'Tümünü seç'}
        </button>
        <span className="text-[11px] font-medium text-metin-2">
          {satirlar.length - atanmamis.length}/{satirlar.length} rapor atanmış
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-cizgi bg-white">
        {satirlar.map((s) => (
          <div
            key={s.raporId}
            className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-cizgi px-4 py-2.5 last:border-b-0"
          >
            <input
              type="checkbox"
              checked={secili.has(s.raporId)}
              onChange={() => raporSec(s.raporId)}
              className="size-3.5 cursor-pointer accent-kirmizi"
            />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12.5px] font-bold">{s.basvuruNo}</span>
                <span className="text-[11px] font-medium text-metin-2">
                  {s.takimRumuzu}
                </span>
                {s.kritikBulgu && (
                  <span
                    className="rounded bg-kirmizi-zemin px-1.5 py-0.5 text-[9px] font-bold text-kirmizi-koyu"
                    title="Otomatik kontrollerde kritik bulgu var"
                  >
                    KRİTİK BULGU
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-[11px] font-medium text-metin-2">
                {s.proje}
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap gap-1.5">
              {s.atananlar.length ? (
                s.atananlar.map((a) => (
                  <span
                    key={a.id}
                    className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10.5px] font-bold ${
                      a.tamamladi
                        ? 'bg-yesil-zemin text-yesil-koyu'
                        : 'bg-amber-zemin text-amber-koyu'
                    }`}
                  >
                    {a.ad.split(' ').slice(-1)[0]}
                    {a.tamamladi ? ' ✓' : ''}
                    {!a.tamamladi && (
                      <button
                        type="button"
                        disabled={calisiyor}
                        onClick={() => kaldir(s.raporId, a.id)}
                        title="Atamayı kaldır"
                        className="cursor-pointer text-amber-koyu/70 hover:text-kirmizi"
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))
              ) : (
                <span className="rounded bg-zemin px-2 py-0.5 text-[10.5px] font-bold text-metin-3">
                  ATANMADI
                </span>
              )}
            </div>
          </div>
        ))}

        {!satirlar.length && (
          <p className="px-5 py-8 text-center text-[12.5px] font-medium text-metin-2">
            Bu seçimde rapor yok.
          </p>
        )}
      </div>
    </div>
  );
}
