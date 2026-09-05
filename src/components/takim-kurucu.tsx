'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Takım kurma ve mevcut takıma katılma.
 *
 * ── İKİSİ YAN YANA ──────────────────────────────────────────────────────
 * Bir takımın yalnızca bir kişisi takımı kuruyor; geri kalan herkes
 * katılıyor. İkisi ayrı yerlerde olsaydı, üyelerin çoğu "takım kur"
 * düğmesini görüp ikinci bir takım açardı — sonra da kaptanın raporunu
 * neden göremediğini sorardı.
 */
export default function TakimKurucu() {
  const yonlendir = useRouter();
  const [acik, setAcik] = useState<'kur' | 'katil' | null>(null);
  const [ad, setAd] = useState('');
  const [kurum, setKurum] = useState('');
  const [sehir, setSehir] = useState('');
  const [danisman, setDanisman] = useState('');
  const [kod, setKod] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);

  async function gonder() {
    setHata(null);
    setCalisiyor(true);
    try {
      const yanit = await fetch('/api/yarismaci/takim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          acik === 'katil'
            ? { islem: 'katil', katilimKodu: kod }
            : { ad, kurum, sehir, danisman },
        ),
      });
      const veri = await yanit.json();
      if (!yanit.ok) {
        setHata(veri.hata ?? 'İşlem tamamlanamadı.');
        return;
      }
      setAcik(null);
      setAd(''); setKurum(''); setSehir(''); setDanisman(''); setKod('');
      yonlendir.refresh();
    } catch {
      setHata('Sunucuya ulaşılamadı.');
    } finally {
      setCalisiyor(false);
    }
  }

  const girdi =
    'w-full rounded-lg border border-cizgi bg-white px-3 py-2 text-[12.5px] font-semibold outline-none focus:border-metin-3';
  const etiket = 'mb-1 block text-[10.5px] font-bold tracking-wide text-metin-2';

  if (!acik) {
    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setAcik('kur')}
          className="dugme bg-lacivert px-4 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-lacivert-2"
        >
          Yeni takım kur
        </button>
        <button
          type="button"
          onClick={() => setAcik('katil')}
          className="dugme border border-cizgi bg-white px-4 py-2 text-[12.5px] font-bold text-metin-2 transition-colors hover:bg-zemin"
        >
          Katılım koduyla takıma katıl
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-cizgi bg-white px-5 py-4">
      <h3 className="mb-3 text-[13px] font-extrabold tracking-tight">
        {acik === 'kur' ? 'Yeni takım kur' : 'Takıma katıl'}
      </h3>

      {acik === 'kur' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className={etiket}>TAKIM ADI</span>
            <input value={ad} onChange={(e) => setAd(e.target.value)} className={girdi} autoFocus />
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
            <span className={etiket}>DANIŞMAN (İSTEĞE BAĞLI)</span>
            <input value={danisman} onChange={(e) => setDanisman(e.target.value)} className={girdi} />
          </label>
        </div>
      ) : (
        <label className="block">
          <span className={etiket}>KATILIM KODU</span>
          <input
            value={kod}
            onChange={(e) => setKod(e.target.value)}
            placeholder="XXXX-XXXX"
            spellCheck={false}
            autoComplete="off"
            autoFocus
            className={`${girdi} font-mono tracking-widest uppercase`}
          />
          <span className="mt-1.5 block text-[10.5px] leading-relaxed font-medium text-metin-3">
            Kodu takım kaptanınız paylaşır. Tire yazmanız gerekmiyor.
          </span>
        </label>
      )}

      {hata && (
        <p role="alert" className="mt-3 rounded-lg bg-kirmizi-zemin px-3 py-2 text-[12px] font-semibold text-kirmizi-koyu">
          {hata}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={gonder}
          disabled={calisiyor || (acik === 'kur' ? ad.trim().length < 2 : kod.trim().length < 4)}
          className="dugme bg-kirmizi px-4 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-kirmizi-koyu"
        >
          {calisiyor ? 'Gönderiliyor…' : acik === 'kur' ? 'Takımı kur' : 'Katıl'}
        </button>
        <button
          type="button"
          onClick={() => { setAcik(null); setHata(null); }}
          className="dugme border border-cizgi px-4 py-2 text-[12.5px] font-bold text-metin-2 transition-colors hover:bg-zemin"
        >
          Vazgeç
        </button>
      </div>
    </div>
  );
}
