'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Yarismaci } from '@/lib/db/yarismaci-depo';

/**
 * Profil künyesi — koyu şerit, sayaçlarla.
 *
 * ── NİYE KOYU ŞERİT ─────────────────────────────────────────────────────
 * Önce beyaz bir kart olarak duruyordu ve altındaki beyaz kartlardan
 * ayırt edilmiyordu: sayfa, aynı tonda kartların üst üste dizilmiş
 * hâliydi ve gözün tutunacağı bir nokta yoktu. Koyu şerit sayfayı
 * çapalıyor — "burası benim sayfam" diyen tek yer.
 *
 * ── NİYE SAYAÇLAR ───────────────────────────────────────────────────────
 * Yarışmacı buraya "durumum ne" diye geliyor. Cevabın özeti listeye
 * inmeden, ilk bakışta görünmeli.
 *
 * ── DÜZENLEME NİYE AYRI SAYFA DEĞİL ─────────────────────────────────────
 * Yılda bir yapılan bir iş. Ayrı sayfa, panoya her girişte görülen bir
 * menü maddesi eklemek demekti.
 */
export default function ProfilKarti({
  yarismaci,
  takimSayisi = 0,
  basvuruSayisi = 0,
  sonuclanan = 0,
}: {
  yarismaci: Yarismaci;
  takimSayisi?: number;
  basvuruSayisi?: number;
  sonuclanan?: number;
}) {
  const yonlendir = useRouter();
  const [duzenle, setDuzenle] = useState(false);
  const [adSoyad, setAdSoyad] = useState(yarismaci.adSoyad);
  const [kurum, setKurum] = useState(yarismaci.kurum ?? '');
  const [sehir, setSehir] = useState(yarismaci.sehir ?? '');
  const [telefon, setTelefon] = useState(yarismaci.telefon ?? '');
  const [hata, setHata] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);

  async function kaydet() {
    setHata(null);
    setCalisiyor(true);
    try {
      const yanit = await fetch('/api/yarismaci/profil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adSoyad, kurum, sehir, telefon }),
      });
      const veri = await yanit.json();
      if (!yanit.ok) {
        setHata(veri.hata ?? 'Kaydedilemedi.');
        return;
      }
      setDuzenle(false);
      yonlendir.refresh();
    } catch {
      setHata('Sunucuya ulaşılamadı.');
    } finally {
      setCalisiyor(false);
    }
  }

  const girdi =
    'w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-[12.5px] font-semibold text-white outline-none transition-colors focus:border-white/40';
  const etiket = 'mb-1 block text-[10px] font-bold tracking-wide text-white/50';

  // Baş harfler — avatar yerine. Görsel yüklemek bu üründe gereksiz bir
  // yüzey; iki harf kimliği yeterince taşıyor.
  const bas = yarismaci.adSoyad
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toLocaleUpperCase('tr'))
    .join('');

  const sayaclar = [
    { n: takimSayisi, ad: 'takım' },
    { n: basvuruSayisi, ad: 'başvuru' },
    { n: sonuclanan, ad: 'sonuçlandı' },
  ];

  return (
    <div className="overflow-hidden rounded-2xl bg-lacivert">
      <div className="relative px-5 py-5 sm:px-7 sm:py-6">
        {/*
          Köşedeki kırmızı parıltı — TEKNOFEST arayüzlerinin işareti.
          Dekoratif ve `aria-hidden`: taşıdığı bilgi yok.
        */}
        <span
          aria-hidden
          className="pointer-events-none absolute -top-16 -right-10 size-52 rounded-full bg-kirmizi/25 blur-3xl"
        />

        <div className="relative flex items-start gap-4">
          <span className="flex size-13 shrink-0 items-center justify-center rounded-xl bg-kirmizi text-[17px] font-extrabold text-white sm:size-14">
            {bas}
          </span>

          <div className="min-w-0 flex-1">
            {duzenle ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className={etiket}>AD SOYAD</span>
                  <input value={adSoyad} onChange={(e) => setAdSoyad(e.target.value)} className={girdi} />
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
                  <span className={etiket}>TELEFON</span>
                  <input value={telefon} onChange={(e) => setTelefon(e.target.value)} className={girdi} />
                </label>
              </div>
            ) : (
              <>
                <h1 className="text-[19px] leading-tight font-extrabold tracking-tight text-white sm:text-[21px]">
                  {yarismaci.adSoyad}
                </h1>
                <p className="mt-1 truncate text-[12px] font-medium text-white/55">
                  {yarismaci.eposta}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] font-semibold text-white/75">
                  {yarismaci.kurum && <span>{yarismaci.kurum}</span>}
                  {yarismaci.sehir && <span>· {yarismaci.sehir}</span>}
                  {yarismaci.telefon && <span>· {yarismaci.telefon}</span>}
                </div>
              </>
            )}
          </div>

          {!duzenle && (
            <button
              type="button"
              onClick={() => setDuzenle(true)}
              className="dugme shrink-0 border border-white/15 px-3 py-1.5 text-[11px] text-white/75 hover:bg-white/10"
            >
              Düzenle
            </button>
          )}
        </div>

        {hata && (
          <p role="alert" className="relative mt-3 rounded-lg bg-kirmizi px-3 py-2 text-[12px] font-semibold text-white">
            {hata}
          </p>
        )}

        {duzenle && (
          <div className="relative mt-3 flex gap-2">
            <button
              type="button"
              onClick={kaydet}
              disabled={calisiyor || adSoyad.trim().length < 3}
              className="dugme bg-kirmizi px-4 py-2 text-[12.5px] text-white hover:bg-kirmizi-koyu"
            >
              {calisiyor ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            <button
              type="button"
              onClick={() => {
                setDuzenle(false);
                setAdSoyad(yarismaci.adSoyad);
                setKurum(yarismaci.kurum ?? '');
                setSehir(yarismaci.sehir ?? '');
                setTelefon(yarismaci.telefon ?? '');
                setHata(null);
              }}
              className="dugme border border-white/15 px-4 py-2 text-[12.5px] text-white/75 hover:bg-white/10"
            >
              Vazgeç
            </button>
          </div>
        )}
      </div>

      {/* ---- sayaç şeridi */}
      {!duzenle && (
        <div className="grid grid-cols-3 border-t border-white/10">
          {sayaclar.map((s, i) => (
            <div
              key={s.ad}
              className={`px-5 py-3 sm:px-7 ${i > 0 ? 'border-l border-white/10' : ''}`}
            >
              <p className="text-[20px] leading-none font-extrabold text-white tabular-nums">
                {s.n}
              </p>
              <p className="mt-1 text-[10.5px] font-semibold tracking-wide text-white/50">
                {s.ad.toLocaleUpperCase('tr')}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
