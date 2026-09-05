'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Konusma, KonusmaMesaji } from '@/lib/db/gelen-kutusu';

/**
 * Mesajlar çekmecesi — koordinasyonun bütün konuşmaları tek yerde.
 *
 * ── NİYE ÇEKMECE, NİYE SAYFA DEĞİL ──────────────────────────────────────
 * Mesajlar iki ayrı sayfanın dibinde saklıydı ve koordinasyon bir mesajı
 * görmek için hangi raporun mesajı olduğunu önceden bilmek zorundaydı.
 * Ayrı bir "Mesajlar" sayfası açmak bunu çözerdi ama menüye bir madde
 * daha eklerdi — oysa şikâyet zaten menünün kalabalıklığıydı.
 *
 * Çekmece üçünü birden çözüyor: her ekrandan tek tuşla açılıyor, açık
 * olduğu sayfayı terk etmiyor ve menüde yer kaplamıyor. Koordinasyon
 * rapor incelerken gelen soruyu yanıtlayıp kaldığı yerden devam ediyor.
 *
 * ── TUŞ SAĞ ÜSTTE ───────────────────────────────────────────────────────
 * Önce kenar çubuğundaydı ve orada bir MENÜ MADDESİ gibi okunuyordu —
 * oysa bir sayfa değil, bir katman açıyor. Sağ üst köşe, bildirimi
 * beklenen yer: kullanıcı oraya bakmayı zaten biliyor.
 *
 * ── NİYE İKİ SÜTUN ──────────────────────────────────────────────────────
 * Solda konuşma listesi, sağda seçili konuşma. Tek sütunlu olsaydı her
 * yanıttan sonra listeye dönmek gerekirdi; koordinasyon arka arkaya
 * birkaç soruyu cevaplıyor ve aradaki gidiş gelişin bir karşılığı yok.
 */
export default function MesajCekmecesi({ baslangicBekleyen }: { baslangicBekleyen: number }) {
  const [acik, setAcik] = useState(false);
  const [liste, setListe] = useState<Konusma[] | null>(null);
  const [secili, setSecili] = useState<Konusma | null>(null);
  const [mesajlar, setMesajlar] = useState<KonusmaMesaji[]>([]);
  const [metin, setMetin] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);
  const [bekleyen, setBekleyen] = useState(baslangicBekleyen);

  const listeyiCek = useCallback(async () => {
    try {
      const y = await fetch('/api/gelen-kutusu');
      if (!y.ok) return;
      const v = await y.json();
      setListe(v.konusmalar);
      setBekleyen(v.konusmalar.filter((k: Konusma) => k.bekliyor).length);
    } catch {
      setHata('Konuşmalar yüklenemedi.');
    }
  }, []);

  /*
   * Kaçış tuşu kapatıyor. Fareyle açılan bir katmanı klavyeyle
   * kapatamamak, klavyeyle gezen kullanıcıyı içeride bırakır.
   */
  useEffect(() => {
    if (!acik) return;
    const f = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (secili) setSecili(null);
      else setAcik(false);
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [acik, secili]);

  async function konusmaAc(k: Konusma) {
    setSecili(k);
    setMesajlar([]);
    setHata(null);
    try {
      const y = await fetch(`/api/gelen-kutusu?konusma=${encodeURIComponent(k.anahtar)}`);
      const v = await y.json();
      if (!y.ok) {
        setHata(v.hata ?? 'Konuşma açılamadı.');
        return;
      }
      setMesajlar(v.mesajlar);
      // Açılan konuşma okundu sayılıyor; liste tazeleniyor.
      void listeyiCek();
    } catch {
      setHata('Konuşma açılamadı.');
    }
  }

  async function gonder() {
    if (!secili || !metin.trim()) return;
    setHata(null);
    setCalisiyor(true);
    try {
      const y = await fetch('/api/gelen-kutusu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ konusma: secili.anahtar, metin }),
      });
      const v = await y.json();
      if (!y.ok) {
        setHata(v.hata ?? 'Mesaj gönderilemedi.');
        return;
      }
      setMesajlar(v.mesajlar);
      setMetin('');
      void listeyiCek();
    } catch {
      setHata('Sunucuya ulaşılamadı.');
    } finally {
      setCalisiyor(false);
    }
  }

  /*
   * KESİN SAAT, GÖRELİ ZAMAN DEĞİL ("3 sa önce").
   *
   * Göreli etiket `Date.now()` okumayı gerektiriyor ve bu, aynı veriyle
   * her çizimde farklı metin üreten saf olmayan bir çizim demek.
   * Kaçınmak için okunan anı bir duruma almak da gerekiyordu — çözmek
   * istediğinden fazla karmaşıklık.
   *
   * Kesin saat ayrıca koordinasyonun işine daha uygun: "hakem ne zaman
   * sordu" sorusunun cevabı bir kayıt, bir his değil.
   */
  const zaman = (iso: string) =>
    new Date(iso).toLocaleString('tr', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });

  return (
    <>
      {/* --------------------------------------------------- açma tuşu */}
      <button
        type="button"
        onClick={() => {
          setAcik(true);
          // Çekim EFFECT'te değil BURADA: effect içinde durum yazmak,
          // her açılışta zincirleme yeniden çizim tetikliyordu ve listenin
          // ne zaman tazeleneceği "hangi durum değişti" sorusuna
          // bağlanıyordu. Açmak bir eylem; çekim de o eylemin parçası.
          void listeyiCek();
        }}
        aria-label={
          bekleyen > 0 ? `Mesajlar — ${bekleyen} cevap bekliyor` : 'Mesajlar'
        }
        title="Mesajlar"
        className="dugme relative flex size-9 items-center justify-center border border-cizgi bg-white hover:bg-zemin"
      >
        <svg viewBox="0 0 24 24" className="size-[18px] stroke-metin-2" fill="none" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
        </svg>
        {/*
          Sayaç SİMGENİN ÜSTÜNDE. Yanına yazılsaydı simge tek başına
          bir düğme olmaktan çıkar ve üst şeritte yer kaplardı; okunması
          gereken bilgi de zaten "bekleyen var mı" — rakam ikincil.
        */}
        {bekleyen > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex min-w-[18px] items-center justify-center rounded-full bg-kirmizi px-1 py-0.5 text-[9.5px] font-extrabold text-white tabular-nums">
            {bekleyen}
          </span>
        )}
      </button>

      {!acik ? null : (
        <>
          <div
            className="fixed inset-0 z-40 bg-lacivert/45 backdrop-blur-[2px]"
            onClick={() => setAcik(false)}
            aria-hidden
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Mesajlar"
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-4xl flex-col bg-white shadow-2xl"
          >
            <header className="flex items-center gap-3 border-b border-cizgi px-5 py-3.5">
              <h2 className="text-[15px] font-extrabold tracking-tight">Mesajlar</h2>
              {bekleyen > 0 && (
                <span className="rounded-md bg-kirmizi-zemin px-2 py-0.5 text-[10.5px] font-bold text-kirmizi-koyu">
                  {bekleyen} cevap bekliyor
                </span>
              )}
              <button
                type="button"
                onClick={() => setAcik(false)}
                aria-label="Kapat"
                className="dugme ml-auto border border-cizgi px-3 py-1.5 text-[11.5px] text-metin-2 hover:bg-zemin"
              >
                Kapat
              </button>
            </header>

            <div className="flex min-h-0 flex-1">
              {/* ---------------------------------------- konuşma listesi */}
              <ul className="w-[300px] shrink-0 overflow-y-auto border-r border-cizgi">
                {liste === null ? (
                  <li className="px-5 py-6 text-[12px] font-medium text-metin-2">
                    Yükleniyor…
                  </li>
                ) : !liste.length ? (
                  <li className="px-5 py-6 text-[12px] leading-relaxed font-medium text-metin-2">
                    Henüz mesaj yok. Hakemler rapor üzerinden, yarışmacılar
                    başvuruları üzerinden yazdığında burada görünür.
                  </li>
                ) : (
                  liste.map((k) => (
                    <li key={k.anahtar}>
                      <button
                        type="button"
                        onClick={() => konusmaAc(k)}
                        className={`w-full border-b border-cizgi/60 px-4 py-3 text-left transition-colors ${
                          secili?.anahtar === k.anahtar ? 'bg-zemin' : 'hover:bg-zemin/60'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[8.5px] font-bold tracking-wide ${
                              k.tur === 'hakem'
                                ? 'bg-mavi-zemin text-mavi-koyu'
                                : 'bg-mor-zemin text-mor-koyu'
                            }`}
                          >
                            {k.tur === 'hakem' ? 'HAKEM' : 'YARIŞMACI'}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[12px] font-bold">
                            {k.kisi}
                          </span>
                          {k.bekliyor && (
                            <span className="size-2 shrink-0 rounded-full bg-kirmizi" title="Cevap bekliyor" />
                          )}
                          <span className="shrink-0 text-[9.5px] font-medium text-metin-3">
                            {zaman(k.tarih)}
                          </span>
                        </span>
                        <span className="mt-1 block truncate font-mono text-[10px] font-bold text-metin-3">
                          {k.basvuruNo} · {k.proje}
                        </span>
                        <span className="mt-1 block truncate text-[11px] font-medium text-metin-2">
                          {k.sonMesaj}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>

              {/* -------------------------------------------- konuşma */}
              <div className="flex min-w-0 flex-1 flex-col">
                {!secili ? (
                  <div className="flex flex-1 items-center justify-center px-6 text-center">
                    <p className="max-w-xs text-[12.5px] leading-relaxed font-medium text-metin-2">
                      Soldan bir konuşma seçin. Hakem ve yarışmacı
                      yazışmalarının tamamı burada; yanıt yazmak için sayfa
                      değiştirmenize gerek yok.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="border-b border-cizgi px-5 py-3">
                      <p className="text-[13px] font-extrabold tracking-tight">{secili.kisi}</p>
                      <p className="mt-0.5 text-[11px] font-medium text-metin-2">
                        <span className="font-mono font-bold">{secili.basvuruNo}</span>
                        {' · '}{secili.proje}
                        {' · '}
                        <a href={secili.yol} className="font-bold text-kirmizi hover:underline">
                          {secili.tur === 'hakem' ? 'Raporu aç' : 'Başvuruyu aç'} →
                        </a>
                      </p>
                    </div>

                    <ul className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
                      {mesajlar.map((m) => (
                        <li key={m.id} className={`flex ${m.bizim ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[80%] rounded-xl px-3.5 py-2.5 ${
                              m.bizim ? 'bg-lacivert text-white' : 'bg-zemin'
                            }`}
                          >
                            <p className={`mb-0.5 text-[9.5px] font-bold tracking-wide ${m.bizim ? 'text-white/55' : 'text-metin-3'}`}>
                              {m.yazar} · {new Date(m.tarih).toLocaleString('tr')}
                            </p>
                            <p className="text-[12.5px] leading-relaxed font-medium whitespace-pre-line">
                              {m.metin}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>

                    <div className="border-t border-cizgi px-5 py-3.5">
                      {hata && (
                        <p role="alert" className="mb-2 rounded-lg bg-kirmizi-zemin px-3 py-2 text-[12px] font-semibold text-kirmizi-koyu">
                          {hata}
                        </p>
                      )}
                      <textarea
                        value={metin}
                        onChange={(e) => setMetin(e.target.value)}
                        rows={2}
                        maxLength={2000}
                        placeholder="Yanıtınızı yazın…"
                        className="w-full rounded-lg border border-cizgi bg-white px-3 py-2.5 text-[12.5px] leading-relaxed font-medium outline-none transition-colors focus:border-metin-3"
                      />
                      <div className="mt-2 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={gonder}
                          disabled={!metin.trim() || calisiyor}
                          className="dugme bg-kirmizi px-4 py-2 text-[12.5px] text-white hover:bg-kirmizi-koyu"
                        >
                          {calisiyor ? 'Gönderiliyor…' : 'Yanıtla'}
                        </button>
                        <span className="text-[10.5px] font-medium text-metin-3">
                          {metin.length}/2000
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
