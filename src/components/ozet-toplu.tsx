'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

/**
 * Şartname özetlerini toplu hazırlama.
 *
 * TASARIM KARARI: MALİYET ÖNCE, ONAY SONRA
 * Bu ekrandaki tek düğme para harcıyor ve tutar küçük değil. Bu yüzden
 * önce kaç belge özetleneceği ve tahmini tutar gösteriliyor; kullanıcı
 * onaylamadan hiçbir çağrı yapılmıyor. Çalışırken harcanan tutar canlı
 * görünüyor ve durdurulabiliyor — bütçesi sert sınırlı bir sistemde
 * "başlat ve bekle" kabul edilebilir değil.
 *
 * ÖZETLER ZORUNLU DEĞİL
 * Özet olmadan da değerlendirme yapılabiliyor; kategoride ilk rapor
 * değerlendirildiğinde özet kendiliğinden üretiliyor. Bu düğme yalnızca
 * "hepsi şimdiden hazır olsun" isteyenler için.
 */

interface Hedef {
  yarismaId: string;
  kategoriId: string;
  etiket: string;
}

interface Durum {
  hedefler: Hedef[];
  farkliBelge: number;
  ayniBelgeyiPaylasan: number;
  ozetiHazirKategori: number;
  /*
   * Tutar YALNIZCA `MALIYET_GOSTER` açıkken geliyor. Kapalıyken alan hiç
   * gönderilmiyor — bu yüzden isteğe bağlı. Ekranda "gizlenmiş" ama
   * sayfa kaynağında duran bir rakam, gizlenmiş sayılmaz.
   */
  maliyetGoster?: boolean;
  tahminiMaliyet?: number;
}

export default function OzetToplu() {
  const yonlendir = useRouter();
  const [durum, setDurum] = useState<Durum | null>(null);
  const [acik, setAcik] = useState(false);
  const [calisiyor, setCalisiyor] = useState(false);
  const [dur, setDur] = useState(false);
  const [ilerleme, setIlerleme] = useState<{
    bitti: number;
    harcanan: number;
    kopyalanan: number;
    hata: string[];
  } | null>(null);

  const yukle = useCallback(async () => {
    try {
      const y = await fetch('/api/ozet-toplu');
      setDurum(await y.json());
    } catch {
      setDurum(null);
    }
  }, []);

  /*
   * İlk yükleme etki içinde, ama iptal bayrağıyla.
   *
   * `void yukle()` yazmak yeterliydi ve çalışıyordu; ancak bileşen yanıt
   * dönmeden sökülürse sökülmüş bileşene setState çağrılıyordu. Bayrak
   * bunu keser. React'in `set-state-in-effect` kuralı da bu haliyle
   * memnun — kural, etkinin dışarıdan gelen veriyi beklediğini
   * görebiliyor.
   */
  useEffect(() => {
    let iptal = false;
    (async () => {
      try {
        const y = await fetch('/api/ozet-toplu');
        const d = await y.json();
        if (!iptal) setDurum(d);
      } catch {
        if (!iptal) setDurum(null);
      }
    })();
    return () => {
      iptal = true;
    };
  }, []);

  async function basla() {
    if (!durum) return;
    setCalisiyor(true);
    setDur(false);
    let harcanan = 0;
    let kopyalanan = 0;
    const hata: string[] = [];

    for (const [i, h] of durum.hedefler.entries()) {
      if (dur) break;
      try {
        const y = await fetch('/api/ozet-toplu', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ yarismaId: h.yarismaId, kategoriId: h.kategoriId }),
        });
        const d = await y.json();
        if (!y.ok) {
          hata.push(`${h.etiket}: ${d.hata ?? 'başarısız'}`);
          // Bütçe aşıldıysa devam etmek anlamsız.
          if (y.status === 402) {
            setIlerleme({ bitti: i + 1, harcanan, kopyalanan, hata });
            break;
          }
        } else {
          harcanan += d.maliyet ?? 0;
          kopyalanan += d.kopyalanan ?? 0;
        }
      } catch (e) {
        hata.push(`${h.etiket}: ${e instanceof Error ? e.message : 'ağ hatası'}`);
      }
      setIlerleme({ bitti: i + 1, harcanan, kopyalanan, hata: [...hata] });
    }

    setCalisiyor(false);
    await yukle();
    yonlendir.refresh();
  }

  if (!durum) return null;

  if (!durum.farkliBelge) {
    return (
      <p className="rounded-xl border border-yesil/25 bg-yesil-zemin px-4 py-3 text-[11.5px] font-semibold text-yesil-koyu">
        Bütün şartname özetleri hazır ({durum.ozetiHazirKategori} kategori).
        Yapay zekâ her değerlendirmede bunları okuyor.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-cizgi bg-white px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] font-bold">Şartname özetleri</h2>
          <p className="mt-0.5 text-[11.5px] leading-relaxed font-medium text-metin-2">
            {durum.ozetiHazirKategori > 0 && `${durum.ozetiHazirKategori} kategoride hazır. `}
            {durum.farkliBelge} şartname için özet yok. Özet olmadan da
            değerlendirme yapılır — o kategoride ilk raporda kendiliğinden
            üretilir. Hepsini şimdiden hazırlamak istersen{' '}
            <strong className="font-bold text-metin">
              {durum.farkliBelge} çağrı
            </strong>{' '}
            yapılır
            {durum.maliyetGoster && durum.tahminiMaliyet !== undefined
              ? `, tahmini tutar $${durum.tahminiMaliyet.toFixed(2)}`
              : ''}
            .
          </p>
        </div>
        <button
          type="button"
          disabled={calisiyor}
          onClick={() => setAcik((a) => !a)}
          className="shrink-0 cursor-pointer rounded-lg border border-cizgi px-3 py-1.5 text-[12px] font-bold transition-colors hover:bg-zemin disabled:opacity-50"
        >
          {acik ? 'Kapat' : 'Hepsini hazırla…'}
        </button>
      </div>

      {acik && (
        <div className="mt-3 border-t border-cizgi pt-3">
          <p className="mb-2.5 text-[11.5px] leading-relaxed font-medium text-metin-2">
            <strong className="font-bold text-metin">{durum.farkliBelge} çağrı</strong>{' '}
            yapılacak
            {durum.maliyetGoster && durum.tahminiMaliyet !== undefined
              ? `, tahmini tutar $${durum.tahminiMaliyet.toFixed(2)}`
              : ''}
            .
            {durum.ayniBelgeyiPaylasan > 0 && (
              <>
                {' '}
                {durum.ayniBelgeyiPaylasan} kategori aynı şartnameyi paylaşıyor;
                onlar için ayrıca ödeme yapılmayacak — üretilen özet
                kopyalanacak.
              </>
            )}{' '}
            İşlem sırayla yürüyor ve ortada durdurulabilir.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={calisiyor}
              onClick={basla}
              className="cursor-pointer rounded-lg bg-kirmizi px-3.5 py-2 text-[12px] font-bold text-white transition-colors hover:bg-kirmizi-koyu disabled:opacity-50"
            >
              {calisiyor
                ? 'Hazırlanıyor…'
                : durum.maliyetGoster && durum.tahminiMaliyet !== undefined
                  ? `Başlat (~$${durum.tahminiMaliyet.toFixed(2)})`
                  : `Başlat (${durum.farkliBelge} çağrı)`}
            </button>
            {calisiyor && (
              <button
                type="button"
                onClick={() => setDur(true)}
                className="cursor-pointer rounded-lg border border-cizgi px-3 py-2 text-[12px] font-bold transition-colors hover:bg-zemin"
              >
                Durdur
              </button>
            )}
          </div>

          {ilerleme && (
            <div className="mt-3">
              <div className="mb-1.5 flex flex-wrap items-baseline gap-2 text-[11.5px]">
                <span className="font-bold">
                  {ilerleme.bitti}/{durum.hedefler.length}
                </span>
                <span className="font-medium text-metin-2">
                  harcanan ${ilerleme.harcanan.toFixed(4)}
                  {ilerleme.kopyalanan > 0 &&
                    ` · ${ilerleme.kopyalanan} kategoriye ücretsiz kopyalandı`}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-zemin">
                <div
                  className="h-full rounded-full bg-kirmizi transition-[width]"
                  style={{
                    width: `${Math.round((ilerleme.bitti / durum.hedefler.length) * 100)}%`,
                  }}
                />
              </div>
              {!!ilerleme.hata.length && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-[11px] font-bold text-kirmizi-koyu">
                    {ilerleme.hata.length} şartname özetlenemedi
                  </summary>
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {ilerleme.hata.map((h, i) => (
                      <li key={i} className="text-[10.5px] leading-relaxed text-metin-2">
                        • {h}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
