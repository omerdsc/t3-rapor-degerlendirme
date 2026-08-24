'use client';

import { useEffect, useState } from 'react';

/**
 * MVP 5 ekranı — kopya/benzerlik taraması.
 *
 * TASARIM KARARI: ORAN YETMEZ, KANIT GEREKİR
 * "%38 benzer" bir hakem için karar verilebilir bilgi değil. Hakem hangi
 * cümlelerin örtüştüğünü, hangi sayfalarda olduğunu görmeli ve kendi
 * kararını vermeli. Bu yüzden ekranın merkezinde oran değil EŞLEŞEN
 * CÜMLE ÇİFTLERİ var; oran yalnızca sıralama ölçütü.
 *
 * AYNI TAKIM AYRI GÖSTERİLİYOR
 * Bir takımın geçen yılki raporuyla bu yılki raporu doğal olarak benzerdir —
 * devam projesi. Bunu intihalle aynı listede kırmızı göstermek hakemi
 * yanlış yönlendirir; ayrı ve nötr işaretleniyor.
 */

interface RaporBasligi {
  id: string;
  takim: string;
  raporKodu: string;
  basvuruNo: string;
  proje: string;
  kategoriAdi: string;
}

interface CumleEslesmesi {
  a: { metin: string; sayfa: number };
  b: { metin: string; sayfa: number };
  oran: number;
}

interface GorselEslesmesi {
  a: { sayfa: number; sira: number };
  b: { sayfa: number; sira: number };
  oran: number;
  hammingMesafesi: number;
}

interface Cift {
  aId: string;
  bId: string;
  metinOrani: number;
  kapsama: number;
  gorselOrani: number;
  ayniTakim: boolean;
  cumleEslesmeleri: CumleEslesmesi[];
  gorselEslesmeleri: GorselEslesmesi[];
  a: RaporBasligi | null;
  b: RaporBasligi | null;
}

interface Yanit {
  isaretliler: Cift[];
  tabanlar: Record<string, { taban: number; esik: number; ciftSayisi: number }>;
  toplamCift: number;
  raporSayisi: number;
  parmakizsiz: number;
  maskeli: boolean;
  not?: string;
  hata?: string;
}

const yuzde = (x: number) => `%${Math.round(x * 100)}`;

export default function BenzerlikTarayici({
  yarismaId,
  kategoriId,
}: {
  yarismaId: string;
  kategoriId?: string;
}) {
  /*
   * ── DURUM NEDEN TEK PARÇA ───────────────────────────────────────────────
   * Önce üç ayrı durum vardı: `veri`, `yukleniyor`, `hata`. Etki her
   * çalıştığında `setYukleniyor(true)` çağırıyordu ve bu iki soruna yol
   * açıyordu:
   *
   * 1. Bayat yanıt. Kullanıcı kategoriyi hızlı değiştirdiğinde önceki
   *    isteğin geç dönen yanıtı yenisini ezebiliyordu — ekranda yanlış
   *    kategorinin benzerlik sonuçları kalıyordu.
   * 2. Etki gövdesinde eşzamanlı setState — basamaklı render.
   *
   * Çözüm: sonucu, AİT OLDUĞU İSTEĞİN KİMLİĞİYLE birlikte tutmak.
   * "Yükleniyor" artık ayrı bir durum değil, TÜRETİLEN bir değer: elimizdeki
   * sonucun kimliği istediğimizle uyuşmuyorsa yükleniyoruz. Bayat yanıt
   * kendiliğinden imkânsız — kimliği uyuşmayan yanıt hiç yazılmıyor.
   */
  const [acik, setAcik] = useState<string | null>(null);
  const kimlik = `${yarismaId}|${kategoriId ?? ''}`;
  const [sonuc, setSonuc] = useState<{
    kimlik: string;
    veri?: Yanit;
    hata?: string;
  } | null>(null);
  /** Elle yeniden taramada sayaç artıyor; kimlik değişince etki tekrar koşuyor. */
  const [tazeleme, setTazeleme] = useState(0);

  const yukleniyor = sonuc?.kimlik !== `${kimlik}|${tazeleme}`;
  const veri = sonuc?.veri ?? null;
  const hata = sonuc?.hata ?? null;

  useEffect(() => {
    const bu = `${kimlik}|${tazeleme}`;
    let iptal = false;
    (async () => {
      try {
        const q = new URLSearchParams({ yarisma: yarismaId });
        if (kategoriId) q.set('kategori', kategoriId);
        const yanit = await fetch(`/api/benzerlik?${q}`);
        const d: Yanit = await yanit.json();
        if (iptal) return;
        setSonuc(
          yanit.ok
            ? { kimlik: bu, veri: d }
            : { kimlik: bu, hata: d.hata ?? 'Tarama başarısız.' },
        );
      } catch (e) {
        if (!iptal) {
          setSonuc({
            kimlik: bu,
            hata: e instanceof Error ? e.message : 'Ağ hatası.',
          });
        }
      }
    })();
    return () => {
      iptal = true;
    };
  }, [yarismaId, kategoriId, kimlik, tazeleme]);

  if (yukleniyor) {
    return (
      <p className="rounded-xl border border-cizgi bg-white px-5 py-8 text-center text-[12.5px] font-medium text-metin-2">
        Raporlar karşılaştırılıyor…
      </p>
    );
  }

  if (hata) {
    return (
      <p className="rounded-xl border border-kirmizi/25 bg-kirmizi-zemin px-5 py-6 text-center text-[12.5px] font-semibold text-kirmizi-koyu">
        {hata}
      </p>
    );
  }

  if (!veri) return null;

  const gercek = veri.isaretliler.filter((c) => !c.ayniTakim);
  const devam = veri.isaretliler.filter((c) => c.ayniTakim);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2.5 rounded-xl border border-cizgi bg-white px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-bold">
            {veri.raporSayisi} rapor · {veri.toplamCift} çift karşılaştırıldı
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-metin-2">
            Bu tarama ücretsiz — yapay zekâ kullanılmıyor, hesap bilgisayarda
            yapılıyor.
          </p>
        </div>
        {veri.maskeli && (
          <span
            className="rounded bg-mor-zemin px-2 py-0.5 text-[9px] font-bold tracking-wide text-mor-koyu"
            title="Takım adları rumuzlanmıştır; hakem yanlılığını azaltır ve kişisel veri ekrana düşmez."
          >
            KİMLİK MASKELİ
          </span>
        )}
        <button
          type="button"
          onClick={() => setTazeleme((t) => t + 1)}
          className="cursor-pointer rounded-lg border border-cizgi px-3 py-1.5 text-[12px] font-bold transition-colors hover:bg-zemin"
        >
          Yeniden tara
        </button>
      </div>

      {/* Taramaya girmeyen raporlar sessizce düşmemeli: "0 kopya" demek,
          12 raporun hiç bakılmadığını gizlerse yanıltıcı olur. */}
      {veri.parmakizsiz > 0 && (
        <p className="mb-3 rounded-lg bg-amber-zemin px-3.5 py-2.5 text-[11.5px] leading-relaxed font-medium text-amber-koyu">
          <strong className="font-bold">{veri.parmakizsiz} rapor taramaya girmedi.</strong>{' '}
          Metni okunamadı — taranmış (fotoğraf) PDF ya da bozuk dosya olabilir.
          Bu raporlarda kopya kontrolü <strong className="font-bold">yapılmadı</strong>;
          elle incelenmeleri gerekiyor.
        </p>
      )}

      {veri.not && (
        <p className="mb-3 rounded-lg bg-zemin px-3.5 py-2.5 text-[11.5px] font-medium text-metin-2">
          {veri.not}
        </p>
      )}

      {Object.keys(veri.tabanlar).length > 0 && (
        <details className="mb-3 rounded-lg border border-cizgi bg-white px-3.5 py-2.5">
          <summary className="cursor-pointer text-[11.5px] font-bold">
            &ldquo;Olağandışı benzer&rdquo; kararı nasıl veriliyor?
          </summary>
          <p className="mt-1.5 mb-2 text-[11px] leading-relaxed font-medium text-metin-2">
            Aynı kategorideki raporlar zaten birbirine benzer — ortak terimler
            kullanıyorlar. Bu yüzden sabit bir sınır yok. Sistem önce o
            kategorinin <strong className="font-bold">olağan benzerlik
            düzeyini</strong> hesaplıyor, sonra bunun belirgin üstüne çıkan
            çiftleri işaretliyor. Aşağıdaki tablo her kategorinin olağan
            düzeyini ve işaretleme sınırını gösteriyor.
          </p>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-left text-metin-3">
                <th className="pb-1 font-bold">Kategori</th>
                <th className="pb-1 font-bold">Olağan düzey</th>
                <th className="pb-1 font-bold">İşaretleme sınırı</th>
                <th className="pb-1 font-bold">Karşılaştırma</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(veri.tabanlar).map(([kod, t]) => (
                <tr key={kod} className="border-t border-cizgi">
                  <td className="py-1 font-medium">{kod.slice(0, 8)}</td>
                  <td className="py-1 font-semibold">{yuzde(t.taban)}</td>
                  <td className="py-1 font-semibold">{yuzde(t.esik)}</td>
                  <td className="py-1 text-metin-2">{t.ciftSayisi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {!veri.isaretliler.length ? (
        <p className="rounded-xl border border-yesil/25 bg-yesil-zemin px-5 py-8 text-center text-[12.5px] font-semibold text-yesil-koyu">
          Eşiği geçen benzerlik bulunmadı.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {[...gercek, ...devam].map((c) => {
            const anahtar = `${c.aId}|${c.bId}`;
            const genis = acik === anahtar;
            const guc = Math.max(c.kapsama, c.metinOrani);

            return (
              <article
                key={anahtar}
                className={`overflow-hidden rounded-[10px] border bg-white ${
                  c.ayniTakim
                    ? 'border-cizgi'
                    : guc >= 0.35 || c.gorselEslesmeleri.length
                      ? 'border-kirmizi/40'
                      : 'border-amber/40'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setAcik(genis ? null : anahtar)}
                  className="flex w-full cursor-pointer flex-wrap items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-zemin/60"
                >
                  <span
                    className={`w-[120px] shrink-0 rounded px-2 py-0.5 text-center text-[9px] font-bold tracking-wide ${
                      c.ayniTakim
                        ? 'bg-mavi-zemin text-mavi-koyu'
                        : guc >= 0.35 || c.gorselEslesmeleri.length
                          ? 'bg-kirmizi-zemin text-kirmizi-koyu'
                          : 'bg-amber-zemin text-amber-koyu'
                    }`}
                  >
                    {c.ayniTakim
                      ? 'DEVAM PROJESİ'
                      : c.gorselEslesmeleri.length
                        ? 'GÖRSEL KOPYA'
                        : guc >= 0.35
                          ? 'YÜKSEK ÖRTÜŞME'
                          : 'İNCELENMELİ'}
                  </span>

                  <span className="min-w-0 flex-1">
                    {/* Rapor kodu şart: aynı takımın iki raporu aynı rumuzu
                        alır ve kodsuz iki farklı çift ayırt edilemez. */}
                    <span className="block truncate text-[12.5px] font-bold">
                      {c.a?.takim ?? '—'}{' '}
                      <span className="font-semibold text-metin-2">{c.a?.raporKodu}</span>
                      {' ↔ '}
                      {c.b?.takim ?? '—'}{' '}
                      <span className="font-semibold text-metin-2">{c.b?.raporKodu}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] font-medium text-metin-2">
                      {c.a?.proje} · {c.b?.proje}
                    </span>
                  </span>

                  <span className="flex shrink-0 items-center gap-3 text-[11px] font-semibold">
                    <span title="Kısa olan raporun ne kadarı öteki raporda da geçiyor">
                      örtüşme <strong className="text-[13px]">{yuzde(c.kapsama)}</strong>
                    </span>
                    <span
                      className="text-metin-2"
                      title="İki raporun ortak metninin, toplam metinlerine oranı"
                    >
                      genel {yuzde(c.metinOrani)}
                    </span>
                    {c.gorselEslesmeleri.length > 0 && (
                      <span className="text-kirmizi-koyu">
                        {c.gorselEslesmeleri.length} görsel
                      </span>
                    )}
                    <span className="text-metin-3">
                      {c.cumleEslesmeleri.length} cümle
                    </span>
                  </span>
                </button>

                {genis && (
                  <div className="border-t border-cizgi bg-zemin/40 px-4 py-3">
                    {c.ayniTakim && (
                      <p className="mb-2.5 rounded-md bg-mavi-zemin px-3 py-2 text-[11px] leading-relaxed font-medium text-mavi-koyu">
                        Bu iki rapor <strong className="font-bold">aynı takıma</strong> ait.
                        Örtüşme beklenir — devam projesi olabilir. İntihal olarak
                        değerlendirilmemelidir.
                      </p>
                    )}

                    {c.gorselEslesmeleri.length > 0 && (
                      <div className="mb-3">
                        <h4 className="mb-1.5 text-[10px] font-bold tracking-wide text-kirmizi-koyu">
                          EŞLEŞEN GÖRSELLER
                        </h4>
                        <ul className="flex flex-col gap-1">
                          {c.gorselEslesmeleri.slice(0, 6).map((g, i) => (
                            <li
                              key={i}
                              className="rounded-md bg-white px-2.5 py-1.5 text-[11px] font-medium"
                            >
                              s.{g.a.sayfa} / {g.a.sira}. görsel ↔ s.{g.b.sayfa} /{' '}
                              {g.b.sira}. görsel —{' '}
                              <strong className="font-bold">{yuzde(g.oran)}</strong>{' '}
                              <span className="text-metin-3">benzer</span>
                            </li>
                          ))}
                        </ul>
                        {c.kapsama < 0.2 && (
                          <p className="mt-1.5 text-[10.5px] leading-relaxed font-medium text-kirmizi-koyu">
                            Metin örtüşmesi düşük ama şekiller eşleşiyor — şekil
                            kopyalanıp metin yeniden yazılmış olabilir.
                          </p>
                        )}
                      </div>
                    )}

                    {c.cumleEslesmeleri.length > 0 ? (
                      <>
                        <h4 className="mb-1.5 text-[10px] font-bold tracking-wide text-metin-3">
                          EŞLEŞEN CÜMLELER ({c.cumleEslesmeleri.length})
                        </h4>
                        <div className="flex flex-col gap-1.5">
                          {c.cumleEslesmeleri.slice(0, 12).map((e, i) => (
                            <div
                              key={i}
                              className="grid gap-1.5 rounded-md bg-white px-2.5 py-2 md:grid-cols-2"
                            >
                              <div>
                                <p className="mb-0.5 text-[9px] font-bold tracking-wide text-metin-3">
                                  {c.a?.takim} {c.a?.raporKodu} · s.{e.a.sayfa || '?'}
                                </p>
                                <p className="text-[11px] leading-relaxed">{e.a.metin}</p>
                              </div>
                              <div className="border-t border-cizgi pt-1.5 md:border-t-0 md:border-l md:pt-0 md:pl-2.5">
                                <p className="mb-0.5 text-[9px] font-bold tracking-wide text-metin-3">
                                  {c.b?.takim} {c.b?.raporKodu} · s.{e.b.sayfa || '?'} ·{' '}
                                  <span className="text-kirmizi-koyu">{yuzde(e.oran)}</span>
                                </p>
                                <p className="text-[11px] leading-relaxed">{e.b.metin}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        {c.cumleEslesmeleri.length > 12 && (
                          <p className="mt-1.5 text-[10.5px] font-medium text-metin-2">
                            İlk 12 eşleşme gösteriliyor; toplam{' '}
                            {c.cumleEslesmeleri.length}.
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-[11.5px] font-medium text-metin-2">
                        Cümle düzeyinde eşleşme yok. Örtüşme dağınık — ortak
                        terminoloji ya da yeniden ifade edilmiş metin olabilir.
                      </p>
                    )}

                    <p className="mt-2.5 text-[10.5px] leading-relaxed font-medium text-metin-2">
                      Karşılaştırmadan önce şablonun kendi metni, bölüm
                      başlıkları, sayfa üst/alt bilgisi ve kaynakça çıkarıldı.
                      Yani iki raporun aynı şablonu kullanması benzerlik
                      sayılmıyor.
                    </p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
