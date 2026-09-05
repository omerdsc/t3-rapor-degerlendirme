'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Ön kayıtlı başvuruyu üstlenme.
 *
 * ── NİYE VAR ────────────────────────────────────────────────────────────
 * Koordinasyon kayıt listesini yarışma açılışında içeri aktarabiliyor ve
 * o başvuruların arkasında henüz bir hesap yok. Yarışmacı kayıt olduktan
 * sonra elindeki numara ve kodla kendi kaydını üstleniyor.
 *
 * Bu olmasaydı iki ayrı dünya oluşurdu: koordinasyonun açtığı başvurular
 * ve yarışmacının açtığı başvurular — aynı yarışmada, birbirini görmeyen.
 *
 * ── NİYE KATALOGDAN AYRI ────────────────────────────────────────────────
 * Katalog YENİ başvuru içindir; burası VAR OLAN bir başvuruyu sahiplenmek.
 * İkisi aynı yerde dursaydı, yarışmacıların çoğu ihtiyacı olmayan bir
 * numara/kod alanıyla karşılaşırdı.
 */
export default function BasvuruUstlen({
  takimlar,
}: {
  /** Yalnızca KAPTAN olunan takımlar: başvuru takıma kaptan bağlıyor. */
  takimlar: Array<{ id: string; ad: string }>;
}) {
  const yonlendir = useRouter();
  const [acik, setAcik] = useState(false);
  const [takimId, setTakimId] = useState(takimlar[0]?.id ?? '');
  const [basvuruNo, setBasvuruNo] = useState('');
  const [kod, setKod] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);

  // Kaptan olunan takım yoksa üstlenilecek bir yer de yok.
  if (takimlar.length === 0) return null;

  async function gonder() {
    setHata(null);
    setCalisiyor(true);
    try {
      const y = await fetch('/api/yarismaci/basvuru', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ islem: 'ustlen', takimId, basvuruNo, kod }),
      });
      const v = await y.json();
      if (!y.ok) {
        setHata(v.hata ?? 'Başvuru üstlenilemedi.');
        return;
      }
      setAcik(false);
      setBasvuruNo('');
      setKod('');
      yonlendir.push(`/yarismaci/basvuru/${v.basvuru.id}`);
      yonlendir.refresh();
    } catch {
      setHata('Sunucuya ulaşılamadı.');
    } finally {
      setCalisiyor(false);
    }
  }

  const girdi =
    'w-full rounded-lg border border-cizgi bg-white px-3 py-2 text-[12.5px] font-semibold outline-none transition-colors focus:border-metin-3';
  const etiket = 'mb-1 block text-[10.5px] font-bold tracking-wide text-metin-2';

  if (!acik) {
    return (
      <button
        type="button"
        onClick={() => setAcik(true)}
        className="dugme border border-cizgi bg-white px-4 py-2 text-[12.5px] text-metin-2 hover:bg-zemin"
      >
        Mevcut başvurumu üstlen
      </button>
    );
  }

  return (
    <div className="kart w-full px-5 py-4">
      <h3 className="mb-1 text-[13px] font-extrabold tracking-tight">
        Mevcut başvurumu üstlen
      </h3>
      <p className="mb-3 text-[11.5px] leading-relaxed font-medium text-metin-2">
        Başvurunuz yarışma koordinasyonu tarafından açıldıysa numara ve kod
        size iletilmiştir.
      </p>

      <label className="mb-3 block">
        <span className={etiket}>TAKIM</span>
        <select value={takimId} onChange={(e) => setTakimId(e.target.value)} className={girdi}>
          {takimlar.map((t) => (
            <option key={t.id} value={t.id}>{t.ad}</option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={etiket}>BAŞVURU NUMARANIZ</span>
          <input
            value={basvuruNo}
            onChange={(e) => setBasvuruNo(e.target.value)}
            placeholder="TF-2026-04871"
            spellCheck={false}
            autoFocus
            className={`${girdi} font-mono`}
          />
        </label>
        <label className="block">
          <span className={etiket}>ERİŞİM KODUNUZ</span>
          <input
            value={kod}
            onChange={(e) => setKod(e.target.value)}
            placeholder="XXXX-XXXX"
            spellCheck={false}
            className={`${girdi} font-mono tracking-widest uppercase`}
          />
        </label>
      </div>

      {hata && (
        <p role="alert" className="mt-3 rounded-lg bg-kirmizi-zemin px-3 py-2 text-[12px] font-semibold text-kirmizi-koyu">
          {hata}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={gonder}
          disabled={calisiyor || !takimId || !basvuruNo.trim() || !kod.trim()}
          className="dugme bg-kirmizi px-4 py-2 text-[12.5px] text-white hover:bg-kirmizi-koyu"
        >
          {calisiyor ? 'Gönderiliyor…' : 'Üstlen'}
        </button>
        <button
          type="button"
          onClick={() => { setAcik(false); setHata(null); }}
          className="dugme border border-cizgi px-4 py-2 text-[12.5px] text-metin-2 hover:bg-zemin"
        >
          Vazgeç
        </button>
      </div>
    </div>
  );
}
