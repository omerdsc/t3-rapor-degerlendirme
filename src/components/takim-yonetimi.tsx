'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Takim, TakimUyesi } from '@/lib/db/yarismaci-depo';

/**
 * Takım künyesi, katılım kodu ve üye listesi.
 *
 * ── ÜYE DAVETİ KODLA, E-POSTAYLA DEĞİL ──────────────────────────────────
 * Kaptanın üyeyi e-postayla davet etmesi, sistemin e-posta gönderebilmesini
 * gerektirir — kurulacak, izlenecek ve teslim edilemediğinde sessizce
 * başarısız olacak bir yüzey daha. Katılım kodu bunu ortadan kaldırıyor:
 * kaptan kodu zaten kullandığı kanaldan (grup sohbeti, sınıf) paylaşıyor,
 * üye kendi hesabıyla girip katılıyor. Üye listesi böylece elle yazılmış
 * adlardan değil, gerçek hesaplardan oluşuyor.
 */
export default function TakimYonetimi({
  takim,
  uyeler,
  kaptanMi,
  benimId,
}: {
  takim: Takim;
  uyeler: TakimUyesi[];
  kaptanMi: boolean;
  benimId: string;
}) {
  const yonlendir = useRouter();
  const [duzenle, setDuzenle] = useState(false);
  const [ad, setAd] = useState(takim.ad);
  const [kurum, setKurum] = useState(takim.kurum ?? '');
  const [sehir, setSehir] = useState(takim.sehir ?? '');
  const [danisman, setDanisman] = useState(takim.danisman ?? '');
  const [hata, setHata] = useState<string | null>(null);
  const [kopyalandi, setKopyalandi] = useState(false);
  const [calisiyor, setCalisiyor] = useState(false);

  async function kaydet() {
    setHata(null);
    setCalisiyor(true);
    try {
      const y = await fetch('/api/yarismaci/takim', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: takim.id, ad, kurum, sehir, danisman }),
      });
      const v = await y.json();
      if (!y.ok) { setHata(v.hata ?? 'Kaydedilemedi.'); return; }
      setDuzenle(false);
      yonlendir.refresh();
    } catch {
      setHata('Sunucuya ulaşılamadı.');
    } finally {
      setCalisiyor(false);
    }
  }

  async function uyeCikar(uyeId: string, kendisi: boolean) {
    setHata(null);
    const y = await fetch(
      `/api/yarismaci/takim?takim=${takim.id}&uye=${uyeId}`,
      { method: 'DELETE' },
    );
    if (!y.ok) {
      setHata((await y.json()).hata ?? 'Çıkarılamadı.');
      return;
    }
    if (kendisi) yonlendir.push('/yarismaci');
    yonlendir.refresh();
  }

  async function takimiSil() {
    setHata(null);
    const y = await fetch(`/api/yarismaci/takim?takim=${takim.id}`, { method: 'DELETE' });
    if (!y.ok) {
      setHata((await y.json()).hata ?? 'Silinemedi.');
      return;
    }
    yonlendir.push('/yarismaci');
    yonlendir.refresh();
  }

  const girdi =
    'w-full rounded-lg border border-cizgi bg-white px-3 py-2 text-[12.5px] font-semibold outline-none focus:border-metin-3';
  const etiket = 'mb-1 block text-[10.5px] font-bold tracking-wide text-metin-2';

  return (
    <>
      {/* ---------------------------------------------------- künye */}
      <div className="rounded-xl border border-cizgi bg-white px-5 py-4">
        {duzenle ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className={etiket}>TAKIM ADI</span>
              <input value={ad} onChange={(e) => setAd(e.target.value)} className={girdi} />
            </label>
            <label className="block">
              <span className={etiket}>OKUL / KURUM</span>
              <input value={kurum} onChange={(e) => setKurum(e.target.value)} className={girdi} />
            </label>
            <label className="block">
              <span className={etiket}>ŞEHİR</span>
              <input value={sehir} onChange={(e) => setSehir(e.target.value)} className={girdi} />
            </label>
            <label className="block sm:col-span-2">
              <span className={etiket}>DANIŞMAN</span>
              <input value={danisman} onChange={(e) => setDanisman(e.target.value)} className={girdi} />
            </label>
          </div>
        ) : (
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-[19px] leading-tight font-extrabold tracking-tight">
                {takim.ad}
              </h1>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] font-semibold text-metin-2">
                {takim.kurum && <span>{takim.kurum}</span>}
                {takim.sehir && <span>{takim.sehir}</span>}
                {takim.danisman && <span>Danışman: {takim.danisman}</span>}
                <span>{uyeler.length} üye</span>
              </div>
            </div>
            {kaptanMi && (
              <button
                type="button"
                onClick={() => setDuzenle(true)}
                className="shrink-0 dugme border border-cizgi px-3 py-1.5 text-[11px] font-bold text-metin-2 transition-colors hover:bg-zemin"
              >
                Düzenle
              </button>
            )}
          </div>
        )}

        {duzenle && (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={kaydet}
              disabled={calisiyor || ad.trim().length < 2}
              className="dugme bg-kirmizi px-4 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-kirmizi-koyu"
            >
              {calisiyor ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            <button
              type="button"
              onClick={() => { setDuzenle(false); setAd(takim.ad); setHata(null); }}
              className="dugme border border-cizgi px-4 py-2 text-[12.5px] font-bold text-metin-2 transition-colors hover:bg-zemin"
            >
              Vazgeç
            </button>
          </div>
        )}
      </div>

      {/* ---------------------------------------------- katılım kodu */}
      {kaptanMi && (
        <div className="mt-4 rounded-xl border border-cizgi bg-white px-5 py-4">
          <h2 className="text-[13px] font-extrabold tracking-tight">Takıma üye ekleyin</h2>
          <p className="mt-1 mb-3 text-[11.5px] leading-relaxed font-medium text-metin-2">
            Aşağıdaki katılım kodunu takım arkadaşlarınızla paylaşın. Kendi
            hesaplarıyla giriş yapıp bu kodla takıma katılabilirler.
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="rounded-lg bg-lacivert px-4 py-2.5 font-mono text-[16px] font-bold tracking-[0.2em] text-white">
              {takim.katilimKodu}
            </span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(takim.katilimKodu);
                setKopyalandi(true);
                setTimeout(() => setKopyalandi(false), 2000);
              }}
              className="dugme border border-cizgi px-4 py-2.5 text-[12.5px] font-bold text-metin-2 transition-colors hover:bg-zemin"
            >
              {kopyalandi ? 'Kopyalandı' : 'Kodu kopyala'}
            </button>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- üyeler */}
      <div className="mt-4 rounded-xl border border-cizgi bg-white">
        <h2 className="border-b border-cizgi px-5 py-3.5 text-[13px] font-extrabold tracking-tight">
          Üyeler
        </h2>
        <ul>
          {uyeler.map((u) => {
            const benim = u.yarismaciId === benimId;
            return (
              <li
                key={u.id}
                className="flex items-center gap-3 border-b border-cizgi/60 px-5 py-3 last:border-0"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zemin text-[11px] font-extrabold text-metin-2">
                  {u.adSoyad.split(/\s+/).slice(0, 2).map((p) => p[0]?.toLocaleUpperCase('tr')).join('')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-bold">
                    {u.adSoyad}
                    {benim && <span className="ml-1.5 font-medium text-metin-3">(siz)</span>}
                  </p>
                  <p className="truncate text-[11px] font-medium text-metin-2">
                    {u.eposta}{u.kurum ? ` · ${u.kurum}` : ''}
                  </p>
                </div>
                {u.rol === 'kaptan' && (
                  <span className="shrink-0 rounded bg-kirmizi-zemin px-2 py-0.5 text-[9.5px] font-bold tracking-wide text-kirmizi-koyu">
                    KAPTAN
                  </span>
                )}
                {u.rol !== 'kaptan' && (kaptanMi || benim) && (
                  <button
                    type="button"
                    onClick={() => uyeCikar(u.yarismaciId, benim)}
                    className="shrink-0 cursor-pointer text-[11px] font-bold text-kirmizi hover:text-kirmizi-koyu"
                  >
                    {benim ? 'Ayrıl' : 'Çıkar'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {hata && (
        <p role="alert" className="mt-3 rounded-lg bg-kirmizi-zemin px-3.5 py-2.5 text-[12px] font-semibold text-kirmizi-koyu">
          {hata}
        </p>
      )}

      {kaptanMi && (
        <button
          type="button"
          onClick={takimiSil}
          className="mt-5 cursor-pointer text-[11.5px] font-bold text-metin-3 hover:text-kirmizi"
        >
          Takımı sil
        </button>
      )}
    </>
  );
}
