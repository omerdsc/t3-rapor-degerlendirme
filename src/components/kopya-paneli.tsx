'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import KopyaSorusturmasi from './kopya-sorusturmasi';
import {
  AGIRLIK_ETIKETI, AGIRLIK_RENGI, kopyaYorumu,
} from '@/lib/gorunum/kopya-yorumu';

interface RaporBasligi {
  id: string;
  takim: string;
  raporKodu: string;
  basvuruNo: string;
  proje: string;
  kategoriAdi: string;
  yuklendi: string;
}

interface Cift {
  aId: string;
  bId: string;
  a: RaporBasligi | null;
  b: RaporBasligi | null;
  metinOrani: number;
  kapsama: number;
  gorselOrani: number;
  ayniTakim: boolean;
  cumleEslesmeleri: Array<{
    a: { metin: string; sayfa: number };
    b: { metin: string; sayfa: number };
    oran: number;
  }>;
  gorselEslesmeleri: Array<{
    a: { sayfa: number; sira: number };
    b: { sayfa: number; sira: number };
    oran: number;
  }>;
}

interface Sonuc {
  isaretliler: Cift[];
  toplamCift: number;
  raporSayisi: number;
  parmakizsiz: number;
  maskeli: boolean;
}

/** Çiftin bir yüzü — iki kez çiziliyor, tek yerde tanımlı. */
function RaporYuzu({ r }: { r: RaporBasligi | null }) {
  return (
    <div className="bg-white px-5 py-3.5">
      <p className="truncate text-[12.5px] font-bold">{r?.proje ?? '—'}</p>
      <p className="mt-0.5 text-[11px] font-medium text-metin-2">
        {r?.takim} · {r?.raporKodu}
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 font-mono text-[10.5px] font-bold text-metin-3">
        <span>{r?.basvuruNo}</span>
        <span>{r ? new Date(r.yuklendi).toLocaleDateString('tr') : ''}</span>
      </p>
      {r && (
        <a
          href={`/koordinasyon/rapor/${r.id}`}
          className="mt-1.5 inline-block text-[11.5px] font-bold text-kirmizi hover:underline"
        >
          Raporu aç →
        </a>
      )}
    </div>
  );
}

/**
 * Kopya kontrolü paneli — ÇİFT ODAKLI.
 *
 * ── ÖNCEKİ TASARIMIN SORUNU ─────────────────────────────────────────────
 * Ekran üç sayı gösteriyordu: metin %62, kapsama %78, görsel %100. Üçü de
 * doğruydu ve üçü de bakanın sorusunu cevaplamıyordu. Koordinasyonun
 * sorduğu şey "Jaccard oranı kaç" değil — "bu iki rapor aynı mı, neyi
 * kopyalamışlar, ne kadarı ortak".
 *
 * Panel artık ÇİFT gösteriyor: iki rapor yan yana, aralarında ne olduğu
 * bir cümleyle yazılı, altında ölçüler ve istenirse kanıtın kendisi —
 * eşleşen cümleler karşılıklı, eşleşen görsellerin sayfa numaraları.
 *
 * ── KANIT NİYE KAPALI BAŞLIYOR ──────────────────────────────────────────
 * Bir çiftte 40 eşleşen cümle olabiliyor. Hepsi açık gelseydi üç çift
 * ekranı taşırdı ve hangi çiftin hangisi olduğu kaybolurdu. Hüküm ve
 * ölçüler her zaman görünür; kanıt isteyene açılıyor.
 */
export default function KopyaPaneli({
  yarismaId,
  kategoriId,
}: {
  yarismaId: string;
  kategoriId?: string;
}) {
  const [durum, setDurum] = useState<{
    veri?: Sonuc;
    yukleniyor: boolean;
    hata?: string;
  }>({ yukleniyor: false });
  const [acikCift, setAcikCift] = useState<string | null>(null);

  const tara = useCallback(async () => {
    setDurum({ yukleniyor: true });
    try {
      const q = new URLSearchParams({ yarisma: yarismaId });
      if (kategoriId) q.set('kategori', kategoriId);
      const y = await fetch(`/api/benzerlik?${q}`);
      const v = await y.json();
      if (!y.ok) {
        setDurum({ yukleniyor: false, hata: v.hata ?? 'Tarama yapılamadı.' });
        return;
      }
      setDurum({ yukleniyor: false, veri: v });
    } catch {
      setDurum({ yukleniyor: false, hata: 'Sunucuya ulaşılamadı.' });
    }
  }, [yarismaId, kategoriId]);

  /*
   * TARAMA SEKME AÇILIR AÇILMAZ KOŞUYOR.
   *
   * Önce "Taramayı başlat" düğmesi bekliyordu ve sekmeyi açan kişi boş
   * bir ekran görüyordu. Ama "kopya şüphesi" sekmesine tıklamak zaten
   * "kopya şüphesi olanları göster" demek — kullanıcıdan aynı niyeti
   * ikinci kez, bir düğmeyle bildirmesini istemek gereksiz bir adım.
   *
   * Tarama ücretsiz ve yerel; otomatik koşmasının bedeli yok. Düğme
   * kalıyor ama artık "yeniden tara" — yeni rapor geldiğinde elle
   * tazelemek için.
   */
  const kosuldu = useRef<string>('');
  useEffect(() => {
    const kapsam = `${yarismaId}|${kategoriId ?? ''}`;
    if (kosuldu.current === kapsam) return;
    kosuldu.current = kapsam;
    void tara();
  }, [yarismaId, kategoriId, tara]);

  const yuzde = (x: number) => `%${Math.round(x * 100)}`;

  return (
    <div className="mb-4">
      {/* ------------------------------------------------- tarama şeridi */}
      <div className="kart flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] font-extrabold tracking-tight">Kopya kontrolü</h2>
          <p className="mt-0.5 text-[11.5px] leading-relaxed font-medium text-metin-2">
            {durum.veri
              ? `${durum.veri.raporSayisi} rapor · ${durum.veri.toplamCift} çift karşılaştırıldı`
              : 'Aynı kategorideki raporlar metin ve şekil örtüşmesine karşı karşılaştırılır.'}
            {' '}Karşılaştırma bilgisayarda yapılıyor; yapay zekâ kullanılmıyor.
          </p>
        </div>
        {durum.veri?.maskeli && (
          <span className="rounded-md bg-mor-zemin px-2 py-1 text-[10px] font-bold tracking-wide text-mor-koyu">
            KİMLİK MASKELİ
          </span>
        )}
        <button
          type="button"
          onClick={tara}
          disabled={durum.yukleniyor}
          className="dugme border border-cizgi bg-white px-4 py-2 text-[12.5px] text-metin hover:bg-zemin"
        >
          {durum.yukleniyor ? 'Taranıyor…' : durum.veri ? 'Yeniden tara' : 'Taramayı başlat'}
        </button>
      </div>

      {durum.hata && (
        <p role="alert" className="mt-3 rounded-lg bg-kirmizi-zemin px-4 py-2.5 text-[12px] font-semibold text-kirmizi-koyu">
          {durum.hata}
        </p>
      )}

      {durum.veri && durum.veri.parmakizsiz > 0 && (
        /*
          İZSİZ RAPOR SESSİZ BİR KÖR NOKTA.
          Metni okunamayan (taranmış/fotoğraf PDF) rapor karşılaştırmaya
          hiç girmiyor. Söylenmezse "kopya yok" sanılır; oysa o rapor
          için kontrol hiç yapılmadı.
        */
        <p className="mt-3 rounded-lg bg-amber-zemin px-4 py-2.5 text-[11.5px] leading-relaxed font-semibold text-amber-koyu">
          {durum.veri.parmakizsiz} rapor taramaya girmedi — metni okunamadı
          (taranmış fotoğraf PDF ya da bozuk dosya). Bu raporlarda kopya
          kontrolü <strong className="font-extrabold">yapılmadı</strong>;
          elle incelenmeleri gerekiyor.
        </p>
      )}

      {durum.yukleniyor && !durum.veri && (
        <p className="mt-3 rounded-xl border border-cizgi bg-white px-5 py-6 text-center text-[12.5px] font-medium text-metin-2">
          Raporlar karşılaştırılıyor…
        </p>
      )}

      {/* --------------------------------------------------- çift listesi */}
      {durum.veri && (
        durum.veri.isaretliler.length === 0 ? (
          <p className="mt-3 rounded-xl border border-yesil/25 bg-yesil-zemin px-5 py-6 text-center text-[12.5px] font-semibold text-yesil-koyu">
            {durum.veri.toplamCift === 0
              ? 'Karşılaştırma için en az iki çözümlenmiş rapor gerekiyor.'
              : `${durum.veri.toplamCift} çift karşılaştırıldı, olağandışı örtüşme bulunamadı.`}
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {durum.veri.isaretliler.map((c, i) => {
              const anahtar = `${c.aId}-${c.bId}`;
              const y = kopyaYorumu({
                metinOrani: c.metinOrani,
                kapsama: c.kapsama,
                gorselOrani: c.gorselOrani,
                cumleSayisi: c.cumleEslesmeleri.length,
                gorselSayisi: c.gorselEslesmeleri.length,
                ayniTakim: c.ayniTakim,
              });
              const acik = acikCift === anahtar;

              return (
                <article
                  key={anahtar}
                  style={{ '--sira': i } as React.CSSProperties}
                  className={`kart belir overflow-hidden ${
                    y.agirlik === 'agir' ? 'border-kirmizi/35' : ''
                  }`}
                >
                  {/* ---- hüküm */}
                  <div className="border-b border-cizgi px-5 py-3.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className={`rounded-md px-2 py-0.5 text-[9.5px] font-bold tracking-wide ${AGIRLIK_RENGI[y.agirlik]}`}>
                        {AGIRLIK_ETIKETI[y.agirlik]}
                      </span>
                      <h3 className="text-[14px] font-extrabold tracking-tight">
                        {y.baslik}
                      </h3>
                    </div>
                    <p className="mt-1.5 text-[12px] leading-relaxed font-medium text-metin-2">
                      {y.aciklama}
                    </p>
                  </div>

                  {/* ---- iki rapor yan yana */}
                  {/*
                    A ↔ B — bağ işareti İKİ KARTIN ARASINDA.
                    Izgara sırası DOM sırasıdır: işaret sona yazılırsa
                    üçüncü hücreye düşüyor ve iki kart "aynı çiftin iki
                    yarısı" değil, iki ayrı rapor kartı gibi okunuyordu.
                  */}
                  <div className="grid gap-px bg-cizgi sm:grid-cols-[1fr_auto_1fr]">
                    <RaporYuzu r={c.a} />
                    <div className="flex items-center justify-center bg-white px-3 py-1 sm:px-3">
                      <span className="text-[16px] font-extrabold text-metin-3">↔</span>
                    </div>
                    <RaporYuzu r={c.b} />
                  </div>

                  {/* ---- ölçüler */}
                  <div className="grid grid-cols-3 gap-px border-t border-cizgi bg-cizgi">
                    {[
                      { ad: 'CÜMLE ÖRTÜŞMESİ', n: yuzde(c.metinOrani), alt: `${c.cumleEslesmeleri.length} cümle eşleşti` },
                      { ad: 'KAPSAMA', n: yuzde(c.kapsama), alt: 'küçük raporun oranı' },
                      {
                        ad: 'GÖRSEL',
                        n: c.gorselEslesmeleri.length ? `${c.gorselEslesmeleri.length}` : '—',
                        alt: c.gorselEslesmeleri.length
                          ? `en güçlüsü ${yuzde(c.gorselOrani)}`
                          : 'eşleşme yok',
                      },
                    ].map((o) => (
                      <div key={o.ad} className="bg-white px-4 py-2.5">
                        <p className="text-[16px] leading-none font-extrabold tabular-nums">
                          {o.n}
                        </p>
                        <p className="mt-1 text-[9.5px] font-bold tracking-wide text-metin-2">
                          {o.ad}
                        </p>
                        <p className="mt-0.5 text-[10px] font-medium text-metin-3">{o.alt}</p>
                      </div>
                    ))}
                  </div>

                  {/* ---- kanıt */}
                  {(c.cumleEslesmeleri.length > 0 || c.gorselEslesmeleri.length > 0) && (
                    <div className="border-t border-cizgi">
                      <button
                        type="button"
                        onClick={() => setAcikCift(acik ? null : anahtar)}
                        aria-expanded={acik}
                        className="flex w-full items-center gap-2 px-5 py-2.5 text-left text-[12px] font-bold text-kirmizi transition-colors hover:bg-zemin"
                      >
                        {acik ? 'Kanıtı gizle' : 'Kanıtı göster'}
                        <span className="text-[10px]">{acik ? '▲' : '▼'}</span>
                        <span className="ml-auto text-[11px] font-medium text-metin-3">
                          {c.cumleEslesmeleri.length} cümle
                          {c.gorselEslesmeleri.length
                            ? ` · ${c.gorselEslesmeleri.length} görsel`
                            : ''}
                        </span>
                      </button>

                      {acik && (
                        <div className="border-t border-cizgi bg-zemin/50 px-5 py-4">
                          {/*
                            SORUŞTURMA EN ÜSTTE.
                            Altındaki cümle ve görsel listeleri HAM KANIT;
                            soruşturma o kanıtın ne anlama geldiğini
                            söylüyor. Kanıtın altına konsaydı koordinasyon
                            önce sekiz cümleyi kendi okuyup yorumlamaya
                            çalışır, sonra ajanın yorumunu bulurdu.
                          */}
                          <KopyaSorusturmasi aId={c.aId} bId={c.bId} />

                          {c.cumleEslesmeleri.length > 0 && (
                            <>
                              <h4 className="mb-2 text-[10px] font-bold tracking-wide text-metin-2">
                                EŞLEŞEN CÜMLELER
                              </h4>
                              <ul className="mb-4 flex flex-col gap-2">
                                {c.cumleEslesmeleri.slice(0, 8).map((e, n) => (
                                  <li
                                    key={n}
                                    className="grid gap-px overflow-hidden rounded-lg bg-cizgi sm:grid-cols-2"
                                  >
                                    {[e.a, e.b].map((s, m) => (
                                      <div key={m} className="bg-white px-3 py-2">
                                        <p className="mb-1 text-[9.5px] font-bold tracking-wide text-metin-3">
                                          {m === 0 ? c.a?.raporKodu : c.b?.raporKodu}
                                          {s.sayfa ? ` · s.${s.sayfa}` : ''}
                                        </p>
                                        <p className="text-[11.5px] leading-relaxed font-medium">
                                          {s.metin}
                                        </p>
                                      </div>
                                    ))}
                                  </li>
                                ))}
                              </ul>
                              {c.cumleEslesmeleri.length > 8 && (
                                <p className="mb-4 text-[11px] font-medium text-metin-3">
                                  +{c.cumleEslesmeleri.length - 8} cümle daha
                                </p>
                              )}
                            </>
                          )}

                          {c.gorselEslesmeleri.length > 0 && (
                            <>
                              <h4 className="mb-2 text-[10px] font-bold tracking-wide text-metin-2">
                                EŞLEŞEN GÖRSELLER
                              </h4>
                              {/*
                                Görselin KENDİSİ gösterilmiyor, yeri
                                gösteriliyor. Rapor PDF'i yarışmacının
                                belgesi; sayfalarını kırpıp ekranda
                                yayınlamak yerine hakemi raporun o
                                sayfasına yönlendirmek doğru.
                              */}
                              <ul className="flex flex-wrap gap-2">
                                {c.gorselEslesmeleri.slice(0, 10).map((g, n) => (
                                  <li
                                    key={n}
                                    className="rounded-lg border border-cizgi bg-white px-3 py-1.5 font-mono text-[11px] font-semibold"
                                  >
                                    s.{g.a.sayfa} #{g.a.sira}
                                    <span className="mx-1.5 text-metin-3">↔</span>
                                    s.{g.b.sayfa} #{g.b.sira}
                                    <span className="ml-1.5 font-sans font-bold text-kirmizi">
                                      {yuzde(g.oran)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
