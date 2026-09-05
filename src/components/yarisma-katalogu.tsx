'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { kategoriEtiketi } from '@/lib/gorunum/kategori-etiketi';

export interface KatalogKategorisi {
  id: string;
  ad: string;
  asama?: string;
  acik: boolean;
  teslim?: string;
  kalanGun?: number;
  /** Bu kategoriye başvurmuş takımın adı — varsa. */
  basvuranTakim?: string;
  basvuruId?: string;
}

export interface KatalogYarismasi {
  id: string;
  ad: string;
  yil: number;
  kategoriler: KatalogKategorisi[];
}

/** "22.04.2026" — sunucu ve tarayıcı aynı metni üretmeli. */
function tarih(iso?: string): string {
  if (!iso) return '';
  const [y, a, g] = iso.split('-');
  return g && a && y ? `${g}.${a}.${y}` : iso;
}

/**
 * Türkçe arama için normalleştirme.
 *
 * ── NİYE ELLE, NİYE toLowerCase() DEĞİL ─────────────────────────────────
 * `toLowerCase()` Türkçe yerel ayarda `I` → `ı` yapıyor; "İHA" arayan
 * kullanıcı "iha" yazdığında eşleşme kaçıyor. Aksanlar da düşürülüyor:
 * "ruzgar" yazan "Rüzgâr"ı bulabilmeli — arama kutusunda kimse şapkalı
 * a yazmıyor.
 */
function ara(m: string): string {
  const harf: Record<string, string> = {
    ç: 'c', ğ: 'g', ı: 'i', İ: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u',
  };
  return [...m.toLocaleLowerCase('en')]
    .map((h) => harf[h] ?? harf[h.toLocaleLowerCase('tr')] ?? h)
    .join('');
}

/**
 * Yarışma kataloğu — yarışmacının başvuracağı yeri BULDUĞU ekran.
 *
 * ── NİYE AYRI SAYFA, NİYE AÇILIR LİSTE DEĞİL ────────────────────────────
 * Başvuru önce panonun dibindeki bir düğmenin arkasında, 43 satırlık bir
 * `<select>` içindeydi. İki sorun: yarışmacı başvurunun NEREDEN
 * yapıldığını bulamıyordu, bulduğunda da hangi yarışmaya başvurduğunu
 * adından başka hiçbir şeyle bilmiyordu — kategori, aşama, son teslim
 * tarihi hiçbiri görünmüyordu.
 *
 * Katalog bir SEÇİM ekranı: aranıyor, karşılaştırılıyor, tarihi
 * görülerek seçiliyor. Açılır liste seçim yaptırmaz, onaylatır.
 */
export default function YarismaKatalogu({
  yarismalar,
  takimlar,
}: {
  yarismalar: KatalogYarismasi[];
  /** Yalnızca KAPTAN olunan takımlar: başvuruyu kaptan açıyor. */
  takimlar: Array<{ id: string; ad: string }>;
}) {
  const yonlendir = useRouter();
  const [sorgu, setSorgu] = useState('');
  const [secilen, setSecilen] = useState<{ y: KatalogYarismasi; k: KatalogKategorisi } | null>(null);
  const [takimId, setTakimId] = useState(takimlar[0]?.id ?? '');
  const [proje, setProje] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);

  const suzulmus = useMemo(() => {
    const q = ara(sorgu.trim());
    if (!q) return yarismalar;
    return yarismalar.filter(
      (y) => ara(y.ad).includes(q) || y.kategoriler.some((k) => ara(k.ad).includes(q)),
    );
  }, [sorgu, yarismalar]);

  async function basvur() {
    if (!secilen || !takimId) return;
    setHata(null);
    setCalisiyor(true);
    try {
      const y = await fetch('/api/yarismaci/basvuru', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          takimId, yarismaId: secilen.y.id, kategoriId: secilen.k.id, proje,
        }),
      });
      const v = await y.json();
      if (!y.ok) {
        setHata(v.hata ?? 'Başvuru yapılamadı.');
        return;
      }
      // Başvuru sonrası doğrudan başvurunun kendi sayfasına: sıradaki iş
      // rapor yüklemek ve o orada.
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

  return (
    <>
      {/* ------------------------------------------------------- arama */}
      <div className="relative mb-5">
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 stroke-metin-3"
          fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          value={sorgu}
          onChange={(e) => setSorgu(e.target.value)}
          placeholder="Yarışma veya kategori ara…"
          className="kart w-full py-3 pr-4 pl-10 text-[13px] font-semibold outline-none focus:border-metin-3"
        />
      </div>

      {suzulmus.length === 0 ? (
        <p className="kart px-5 py-8 text-center text-[12.5px] font-medium text-metin-2">
          &ldquo;{sorgu}&rdquo; ile eşleşen açık yarışma bulunamadı.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {suzulmus.map((y, i) => (
            <div
              key={y.id}
              style={{ '--sira': i } as React.CSSProperties}
              className="kart belir overflow-hidden"
            >
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 border-b border-cizgi px-5 py-3.5">
                <h3 className="text-[14px] font-extrabold tracking-tight">{y.ad}</h3>
                <span className="rounded bg-zemin px-1.5 py-0.5 text-[10px] font-bold text-metin-2">
                  {y.yil}
                </span>
                <span className="ml-auto text-[11px] font-semibold text-metin-3">
                  {y.kategoriler.length} kategori
                </span>
              </div>

              <ul>
                {y.kategoriler.map((k) => (
                  <li
                    key={k.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-cizgi/60 px-5 py-3 last:border-0"
                  >
                    <div className="min-w-0 flex-1">
                      {/* Etiket tek yerden: adın içinde zaten geçen aşama
                          ikinci kez yazılmıyor, yarışma adı öneki atılıyor. */}
                      <p className="truncate text-[12.5px] font-bold">
                        {kategoriEtiketi(k.ad, k.asama, y.ad)}
                      </p>
                      {k.teslim && (
                        <p
                          className={`mt-0.5 text-[11px] font-semibold ${
                            !k.acik
                              ? 'text-metin-3'
                              : k.kalanGun !== undefined && k.kalanGun <= 7
                                ? 'text-kirmizi'
                                : 'text-metin-2'
                          }`}
                        >
                          Son teslim {tarih(k.teslim)}
                          {k.acik && k.kalanGun !== undefined
                            && (k.kalanGun > 0 ? ` · ${k.kalanGun} gün kaldı` : ' · bugün son gün')}
                        </p>
                      )}
                    </div>

                    {k.basvuruId ? (
                      <a
                        href={`/yarismaci/basvuru/${k.basvuruId}`}
                        className="shrink-0 rounded-md bg-yesil-zemin px-2.5 py-1.5 text-[11px] font-bold text-yesil-koyu transition-colors hover:bg-yesil/20"
                      >
                        {k.basvuranTakim} ile başvuruldu →
                      </a>
                    ) : !k.acik ? (
                      <span className="shrink-0 rounded-md bg-zemin px-2.5 py-1.5 text-[11px] font-bold text-metin-3">
                        Süre doldu
                      </span>
                    ) : takimlar.length === 0 ? (
                      <span className="shrink-0 text-[11px] font-semibold text-metin-3">
                        Başvuru için takım gerekli
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setSecilen({ y, k });
                          setProje('');
                          setHata(null);
                        }}
                        className="dugme shrink-0 bg-kirmizi px-3.5 py-1.5 text-[11.5px] text-white hover:bg-kirmizi-koyu"
                      >
                        Başvur
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* --------------------------------------------------- başvuru kutusu */}
      {secilen && (
        <>
          {/*
            Örtü tıklanınca kapanıyor ama Kaçış tuşu da çalışıyor: kutuyu
            klavyeyle açan kullanıcı fareye uzanmak zorunda kalmasın.
          */}
          <div
            className="fixed inset-0 z-40 bg-lacivert/45 backdrop-blur-[2px]"
            onClick={() => setSecilen(null)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Yarışma başvurusu"
            onKeyDown={(e) => e.key === 'Escape' && setSecilen(null)}
            className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-md -translate-y-1/2 rounded-2xl border border-cizgi bg-white p-5 shadow-2xl"
          >
            <p className="text-[10.5px] font-bold tracking-wide text-metin-2">
              YARIŞMA BAŞVURUSU
            </p>
            <h3 className="mt-1 text-[15px] leading-tight font-extrabold tracking-tight">
              {secilen.y.ad}
            </h3>
            <p className="mt-0.5 text-[12px] font-semibold text-metin-2">
              {kategoriEtiketi(secilen.k.ad, secilen.k.asama, secilen.y.ad)}
              {secilen.k.teslim && ` · son teslim ${tarih(secilen.k.teslim)}`}
            </p>

            <label className="mt-4 block">
              <span className={etiket}>TAKIM</span>
              <select value={takimId} onChange={(e) => setTakimId(e.target.value)} className={girdi}>
                {takimlar.map((t) => (
                  <option key={t.id} value={t.id}>{t.ad}</option>
                ))}
              </select>
            </label>

            <label className="mt-3 block">
              <span className={etiket}>PROJE ADI</span>
              <input
                value={proje}
                onChange={(e) => setProje(e.target.value)}
                placeholder="Projenizin adı"
                autoFocus
                className={girdi}
              />
            </label>

            {hata && (
              <p role="alert" className="mt-3 rounded-lg bg-kirmizi-zemin px-3 py-2 text-[12px] font-semibold text-kirmizi-koyu">
                {hata}
              </p>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={basvur}
                disabled={calisiyor || !takimId}
                className="dugme flex-1 bg-kirmizi px-4 py-2.5 text-[12.5px] text-white hover:bg-kirmizi-koyu"
              >
                {calisiyor ? 'Gönderiliyor…' : 'Başvuruyu tamamla'}
              </button>
              <button
                type="button"
                onClick={() => setSecilen(null)}
                className="dugme border border-cizgi px-4 py-2.5 text-[12.5px] text-metin-2 hover:bg-zemin"
              >
                Vazgeç
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
