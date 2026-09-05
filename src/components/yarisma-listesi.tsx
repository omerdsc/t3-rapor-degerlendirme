'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { YarismaDurumu, YarismaSatiri } from '@/lib/katalog/birlesik';

/**
 * Tek yarışma listesi.
 *
 * ÖNCEKİ TASARIMIN SORUNU
 * İki ayrı ekran vardı: "TEKNOFEST Kataloğu" ve "Yarışma Yönetimi". İkisi de
 * yarışma listesiydi; aradaki fark verinin katalogdan mı depodan mı geldiğiydi
 * — yani kullanıcının değil sistemin iç meselesi. Kullanıcı hangi ekranda ne
 * yapacağını anlamıyordu.
 *
 * Şimdi tek liste var ve her satır tek bir soruyu yanıtlıyor: bu yarışma
 * değerlendirmeye hazır mı? Her satırda tek bir birincil eylem var.
 */

const DURUM_SIRA: YarismaDurumu[] = [
  'inceleme_bekliyor',
  'hazir',
  'kurulabilir',
  'sablon_bekleniyor',
];

const DURUM_BICIM: Record<YarismaDurumu, { cip: string; nokta: string }> = {
  hazir: { cip: 'bg-yesil-zemin text-yesil-koyu', nokta: 'bg-yesil' },
  inceleme_bekliyor: { cip: 'bg-amber-zemin text-amber-koyu', nokta: 'bg-amber' },
  kurulabilir: { cip: 'bg-mavi-zemin text-mavi-koyu', nokta: 'bg-mavi' },
  sablon_bekleniyor: { cip: 'bg-zemin text-metin-2', nokta: 'bg-metin-3' },
};

const SUZGEC: Array<{ kod: 'tumu' | YarismaDurumu; ad: string }> = [
  { kod: 'tumu', ad: 'Tümü' },
  { kod: 'inceleme_bekliyor', ad: 'Onay bekleyen' },
  { kod: 'hazir', ad: 'Hazır' },
  { kod: 'kurulabilir', ad: 'Kurulmayan' },
  { kod: 'sablon_bekleniyor', ad: 'Şablon bekleyen' },
];

export default function YarismaListesi({
  liste,
  durumMetni,
}: {
  liste: YarismaSatiri[];
  durumMetni: Record<YarismaDurumu, { etiket: string; aciklama: string }>;
}) {
  const yonlendir = useRouter();
  const [suzgec, setSuzgec] = useState<'tumu' | YarismaDurumu>('tumu');
  const [arama, setArama] = useState('');
  const [calisan, setCalisan] = useState<string | null>(null);
  /*
   * `toplu` iki işi birden yapıyordu: ilerlemeyi GÖSTERMEK ve düğmeleri
   * KİLİTLEMEK. Toplu kurulum bitince ilerleme özeti ekranda kalmalı ama
   * kilit kalkmalı; tek durumla ikisi birden yapılınca kurulum bittikten
   * sonra bütün "Kur" düğmeleri sonsuza kadar devre dışı kalıyordu.
   * Bu yüzden kilit ayrı bir durumda tutuluyor.
   */
  const [toplu, setToplu] = useState<{ bitti: number; toplam: number } | null>(null);
  const [topluCalisiyor, setTopluCalisiyor] = useState(false);
  const [mesaj, setMesaj] = useState<{ metin: string; hata?: boolean } | null>(null);

  const gorunen = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase('tr');
    return liste.filter(
      (y) =>
        (suzgec === 'tumu' || y.durum === suzgec) &&
        (!q || y.ad.toLocaleLowerCase('tr').includes(q)),
    );
  }, [liste, suzgec, arama]);

  const sayim = (kod: 'tumu' | YarismaDurumu) =>
    kod === 'tumu' ? liste.length : liste.filter((y) => y.durum === kod).length;

  async function kur(slug: string) {
    setCalisan(slug);
    setMesaj(null);
    try {
      const yanit = await fetch('/api/katalog/aktar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      const d = await yanit.json();
      setMesaj(
        yanit.ok
          ? { metin: d.zatenVar ? 'Bu yarışma zaten kurulu.' : `Kuruldu · ${d.kategoriSayisi} kategori` }
          : { metin: d.hata ?? 'Kurulamadı.', hata: true },
      );
      if (yanit.ok) yonlendir.refresh();
    } catch (e) {
      setMesaj({ metin: e instanceof Error ? e.message : 'Ağ hatası.', hata: true });
    } finally {
      setCalisan(null);
    }
  }

  /** Kurulmamış bütün yarışmaları sırayla kurar. Ücretsiz. */
  async function hepsiniKur() {
    const hedefler = liste.filter((y) => y.durum === 'kurulabilir' && y.slug);
    if (!hedefler.length) return;
    setTopluCalisiyor(true);
    setToplu({ bitti: 0, toplam: hedefler.length });
    setMesaj(null);
    for (const [i, y] of hedefler.entries()) {
      setCalisan(y.slug!);
      try {
        await fetch('/api/katalog/aktar', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ slug: y.slug }),
        });
      } catch {
        // Tek yarışmanın hatası kalanları düşürmesin; sonuç sayımda görünür.
      }
      setToplu({ bitti: i + 1, toplam: hedefler.length });
    }
    setCalisan(null);
    setTopluCalisiyor(false);
    yonlendir.refresh();
  }

  const kurulabilir = liste.filter((y) => y.durum === 'kurulabilir').length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {SUZGEC.map((s) => (
          <button
            key={s.kod}
            type="button"
            onClick={() => setSuzgec(s.kod)}
            className={`cursor-pointer rounded-lg px-3 py-1.5 text-[12px] font-bold transition-colors ${
              suzgec === s.kod
                ? 'bg-lacivert text-white'
                : 'border border-cizgi bg-white text-metin-2 hover:bg-zemin'
            }`}
          >
            {s.ad}
            <span className={`ml-1.5 ${suzgec === s.kod ? 'text-white/60' : 'text-metin-3'}`}>
              {sayim(s.kod)}
            </span>
          </button>
        ))}
        <input
          value={arama}
          onChange={(e) => setArama(e.target.value)}
          placeholder="Yarışma ara…"
          className="ml-auto w-48 rounded-lg border border-cizgi bg-white px-3 py-1.5 text-[12px] font-medium outline-none focus:border-metin-3"
        />
        {kurulabilir > 0 && (
          <button
            type="button"
            disabled={!!calisan || topluCalisiyor}
            onClick={hepsiniKur}
            className="cursor-pointer rounded-lg border border-lacivert bg-white px-3 py-1.5 text-[12px] font-bold text-lacivert transition-colors hover:bg-zemin disabled:opacity-50"
          >
            Kurulmayanların hepsini kur ({kurulabilir})
          </button>
        )}
      </div>

      {toplu && (
        <div className="mb-3 rounded-xl border border-cizgi bg-white px-4 py-3">
          <p className="mb-2 text-[12.5px] font-bold">
            {toplu.bitti === toplu.toplam ? 'Kurulum bitti' : 'Kuruluyor'}{' '}
            <span className="font-medium text-metin-2">
              {toplu.bitti}/{toplu.toplam}
            </span>
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-zemin">
            <div
              className="h-full rounded-full bg-kirmizi transition-[width]"
              style={{ width: `${Math.round((toplu.bitti / toplu.toplam) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {mesaj && (
        <p
          className={`mb-3 rounded-lg px-3.5 py-2.5 text-[12px] font-semibold ${
            mesaj.hata
              ? 'bg-kirmizi-zemin text-kirmizi-koyu'
              : 'bg-yesil-zemin text-yesil-koyu'
          }`}
        >
          {mesaj.metin}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-cizgi bg-white">
        {gorunen.map((y) => {
          const bicim = DURUM_BICIM[y.durum];
          const kurulu = !!y.yarismaId;

          return (
            <div
              key={y.slug ?? y.ad}
              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-cizgi px-4 py-3 last:border-b-0"
            >
              <span className={`size-2 shrink-0 rounded-full ${bicim.nokta}`} />

              <div className="min-w-0 flex-1">
                {kurulu ? (
                  <Link
                    href={`/koordinasyon/yarismalar/${y.yarismaId}`}
                    className="block truncate text-[13.5px] font-bold hover:text-kirmizi"
                  >
                    {y.ad}
                  </Link>
                ) : (
                  <span className="block truncate text-[13.5px] font-bold text-metin-2">
                    {y.ad}
                  </span>
                )}
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] font-medium text-metin-2">
                  {y.kategoriSayisi > 0 && (
                    <span>
                      {y.kategoriSayisi} kategori
                      {kurulu && y.onayliKategori < y.kategoriSayisi && (
                        <span className="text-amber-koyu">
                          {' '}
                          · {y.kategoriSayisi - y.onayliKategori} onaysız
                        </span>
                      )}
                    </span>
                  )}
                  {y.raporSayisi > 0 && <span>· {y.raporSayisi} rapor</span>}
                  {y.teknikSartname && (
                    <span className="text-yesil-koyu">· teknik şartname</span>
                  )}
                  {kurulu && y.sartnameliKategori > 0 && (
                    <span>
                      · {y.ozetliKategori}/{y.sartnameliKategori} özet hazır
                    </span>
                  )}
                </p>
              </div>

              {y.seviyeler.map((s) => (
                <span
                  key={s}
                  className="shrink-0 rounded bg-mor-zemin px-2 py-0.5 text-[9.5px] font-bold tracking-wide text-mor-koyu"
                >
                  {s.toLocaleUpperCase('tr')}
                </span>
              ))}

              <span
                className={`w-[124px] shrink-0 rounded px-2 py-0.5 text-center text-[9.5px] font-bold tracking-wide ${bicim.cip}`}
                title={durumMetni[y.durum].aciklama}
              >
                {durumMetni[y.durum].etiket.toLocaleUpperCase('tr')}
              </span>

              {/* Satır başına TEK birincil eylem: kullanıcı ne yapacağını
                  seçmek zorunda kalmasın. */}
              <div className="w-[112px] shrink-0 text-right">
                {kurulu ? (
                  <Link
                    href={`/koordinasyon/yarismalar/${y.yarismaId}`}
                    className="text-[12px] font-bold text-kirmizi hover:text-kirmizi-koyu"
                  >
                    Aç →
                  </Link>
                ) : y.durum === 'kurulabilir' && y.slug ? (
                  <button
                    type="button"
                    disabled={!!calisan || topluCalisiyor}
                    onClick={() => kur(y.slug!)}
                    className="dugme bg-kirmizi px-3 py-1.5 text-[11.5px] font-bold text-white transition-colors hover:bg-kirmizi-koyu disabled:opacity-50"
                  >
                    {calisan === y.slug ? '…' : 'Kur'}
                  </button>
                ) : (
                  <span className="text-[11px] font-medium text-metin-3">—</span>
                )}
              </div>
            </div>
          );
        })}

        {!gorunen.length && (
          <p className="px-5 py-8 text-center text-[12.5px] font-medium text-metin-2">
            Bu süzgeçle yarışma bulunamadı.
          </p>
        )}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed font-medium text-metin-3">
        Durum sırası: {DURUM_SIRA.map((d) => durumMetni[d].etiket).join(' → ')}.
      </p>
    </div>
  );
}
