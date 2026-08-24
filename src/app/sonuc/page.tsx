import Link from 'next/link';
import { kategoriGetir, raporBasvuruNoIle, yarismaGetir } from '@/lib/depo/depo';

export const dynamic = 'force-dynamic';

/**
 * AKIŞ 03 — Yarışmacı.
 *
 * Brif net: "Değerlendirme tamamlanır → sonucunu görüntüler". Yarışmacı,
 * hakem nihai kararı vermeden hiçbir şey göremez. AI'ın ön puanı bu ekrana
 * HİÇBİR ZAMAN girmez; yalnızca hakemin kararı gösterilir.
 */
export default async function SonucSayfasi({ searchParams }: PageProps<'/sonuc'>) {
  const p = await searchParams;
  const basvuruNo = (p.basvuru as string | undefined)?.trim();
  const rapor = basvuruNo ? raporBasvuruNoIle(basvuruNo) : null;
  const yarisma = rapor ? yarismaGetir(rapor.yarismaId) : null;
  const kategori = rapor ? kategoriGetir(rapor.yarismaId, rapor.kategoriId) : null;

  return (
    <div className="min-h-screen">
      <header className="flex h-[60px] items-center gap-11 bg-lacivert px-10">
        <Link href="/sonuc" className="flex items-center gap-3">
          <span className="flex size-[31px] items-center justify-center rounded-lg bg-kirmizi">
            <svg viewBox="0 0 24 24" className="size-[17px] stroke-white" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </span>
          <span>
            <span className="block text-[14px] leading-tight font-extrabold tracking-tight text-white">
              4. GÖZ
            </span>
            <span className="block text-[8px] font-semibold tracking-wider text-metin-2">
              YARIŞMACI PORTALI
            </span>
          </span>
        </Link>
        {/*
          KOORDİNASYON PANELİNE BAĞLANTI YOK — bilinçli.
          Bu portalın izleyicisi yarışmacı. Hakem paneline ya da
          koordinasyon panosuna açılan bir bağlantı, ayrı portal olmanın
          anlamını ortadan kaldırırdı. Canlı kurulumda bu portal ayrı bir
          adreste yayınlanır.
        */}
        <span className="ml-auto text-[11px] font-medium text-metin-2">
          Sonucunuzu başvuru numaranızla görüntüleyin
        </span>
      </header>

      <div className="mx-auto max-w-5xl px-10 py-8">
        <form method="get" className="mb-7 flex flex-wrap items-end gap-3">
          <label className="flex-1">
            <span className="mb-1.5 block text-[12px] font-bold">Başvuru numaranız</span>
            <input
              name="basvuru"
              defaultValue={basvuruNo ?? ''}
              placeholder="TF-2026-04871"
              className="w-full rounded-lg border border-cizgi bg-white px-3.5 py-2.5 text-[13px] font-semibold"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-kirmizi px-5 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-kirmizi-koyu"
          >
            Sonucumu göster
          </button>
        </form>

        {basvuruNo && !rapor && (
          <p className="rounded-xl border border-cizgi bg-white px-5 py-8 text-center text-[12.5px] font-medium text-metin-2">
            <strong className="font-bold">{basvuruNo}</strong> numaralı başvuru bulunamadı.
          </p>
        )}

        {rapor && rapor.durum !== 'tamamlandi' && (
          <div className="rounded-xl border border-cizgi bg-white px-5 py-10 text-center">
            <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-amber-zemin">
              <svg viewBox="0 0 24 24" className="size-5 stroke-amber" fill="none" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </div>
            <p className="text-[14px] font-bold">Değerlendirmeniz henüz tamamlanmadı</p>
            <p className="mt-1.5 text-[12px] font-medium text-metin-2">
              Sonuçlar, uzman hakem nihai kararını verdikten sonra burada görünür.
            </p>
          </div>
        )}

        {rapor && yarisma && kategori && rapor.durum === 'tamamlandi' && (
          <>
            <section className="mb-4 flex flex-wrap items-center gap-7 rounded-[14px] border border-cizgi bg-white px-7 py-6">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2.5">
                  <span className="rounded bg-zemin px-2 py-0.5 text-[10.5px] font-bold text-metin-2">
                    {rapor.basvuruNo}
                  </span>
                  <span className="text-[12px] font-medium text-metin-2">
                    {yarisma.ad} · {kategori.ad}
                  </span>
                </div>
                <h1 className="text-[22px] font-extrabold tracking-tight">{rapor.proje}</h1>
                <div className="mt-3 flex flex-wrap items-center gap-2.5">
                  <span className="flex items-center gap-1.5 rounded-md bg-yesil-zemin px-2.5 py-1">
                    <svg viewBox="0 0 24 24" className="size-3.5 stroke-yesil-koyu" fill="none" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round">
                      <path d="m20 6-11 11-5-5" />
                    </svg>
                    <span className="text-[11.5px] font-bold text-yesil-koyu">
                      Değerlendirme tamamlandı
                    </span>
                  </span>
                  <span className="text-[11.5px] font-medium text-metin-2">
                    {rapor.tamamlandi && new Date(rapor.tamamlandi).toLocaleDateString('tr')} ·{' '}
                    {/* Değerlendiren hakem yarışmacıya da bildiriliyor:
                        itiraz hakkı, kararın sahibinin bilinmesini gerektirir. */}
                    {rapor.hakemAdi
                      ? `${rapor.hakemAdi} tarafından değerlendirildi`
                      : 'Uzman hakem tarafından değerlendirildi'}
                  </span>
                </div>
              </div>

              <div className="shrink-0 text-center">
                <div className="text-[10px] font-bold tracking-wide text-metin-3">TOPLAM PUAN</div>
                <div className="mt-0.5 text-[44px] leading-none font-extrabold">
                  {rapor.hakemToplam}
                  <span className="text-[19px] font-semibold text-metin-3">
                    /{kategori.rubrik.toplamPuan}
                  </span>
                </div>
              </div>
            </section>

            <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
              <section className="rounded-xl border border-cizgi bg-white px-6 py-5">
                <div className="mb-4 flex items-center gap-2.5">
                  <span className="h-4 w-[3px] rounded-sm bg-kirmizi" />
                  <h2 className="text-[14.5px] font-bold">Kriter Bazlı Puanınız</h2>
                </div>

                <div className="flex flex-col gap-4">
                  {kategori.rubrik.kriterler.map((k) => {
                    const puan = rapor.hakemPuanlari?.find((x) => x.kriterKodu === k.kod);
                    const ai = rapor.aiDegerlendirme?.kriterler.find((x) => x.kod === k.kod);
                    const oran = k.puan ? ((puan?.puan ?? 0) / k.puan) * 100 : 0;
                    const renk = oran >= 70 ? 'bg-yesil' : oran >= 40 ? 'bg-amber' : 'bg-kirmizi';

                    return (
                      <div key={k.kod}>
                        <div className="mb-1.5 flex items-baseline justify-between gap-3">
                          <span className="text-[12.5px] font-bold">{k.ad}</span>
                          <span className="shrink-0 text-[13px] font-extrabold">
                            {puan?.puan ?? 0}
                            <span className="text-[11px] font-semibold text-metin-3">/{k.puan}</span>
                          </span>
                        </div>
                        <div className="mb-1.5 h-[7px] overflow-hidden rounded-[4px] bg-zemin">
                          <div className={`h-full rounded-[4px] ${renk}`} style={{ width: `${oran}%` }} />
                        </div>
                        {/* Hakemin notu varsa o gösterilir; yoksa hakemin onayladığı gerekçe. */}
                        <p className="text-[11px] leading-relaxed font-medium text-metin-2">
                          {/*
                            GERİ BİLDİRİMİN KAYNAĞI ÖNEMLİ.

                            Hakemin kendi notu varsa o gösterilir. Yoksa AI
                            gerekçesine düşülür — AMA yalnızca hakem AI'ın
                            önerdiği puanı AYNEN kabul ettiyse.

                            Neden: hakem "SONUÇLAR" kriterinde AI'ın önerdiği
                            19 puanı 17'ye çektiğinde, AI'ın 19'u savunan
                            gerekçesini 17 puanın yanında göstermek yarışmacıya
                            çelişki okutur — aldığı puanı savunmayan bir metin.
                            Bu durumda hiçbir şey göstermemek daha dürüst.
                          */}
                          {puan?.not
                            || (ai && puan && ai.aiPuan === puan.puan ? ai.gerekce : null)
                            || 'Bu kriter için ayrıca açıklama girilmemiş.'}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {rapor.hakemNotu && (
                  <div className="mt-5 rounded-lg bg-zemin/70 px-3.5 py-3">
                    <p className="mb-1 text-[11px] font-bold text-metin-2">Hakem notu</p>
                    <p className="text-[11.5px] leading-relaxed">{rapor.hakemNotu}</p>
                  </div>
                )}

                <div className="mt-5 flex items-start gap-2 border-t border-cizgi pt-4">
                  <svg viewBox="0 0 24 24" className="mt-px size-3.5 shrink-0 stroke-metin-3" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4M12 8h.01" />
                  </svg>
                  <p className="text-[10.5px] leading-relaxed font-medium text-metin-2">
                    Puanlarınız uzman hakem tarafından verilmiştir. Yapay zekâ
                    yalnızca hakeme ön inceleme desteği sağlamıştır; puanı
                    belirlememiştir.
                  </p>
                </div>
              </section>

              <div className="flex flex-col gap-4">
                {!!rapor.aiDegerlendirme?.genelGucluYonler.length && (
                  <section className="rounded-xl border border-cizgi bg-white px-5 py-4">
                    <div className="mb-3 flex items-center gap-2.5">
                      <span className="flex size-[26px] items-center justify-center rounded-[7px] bg-yesil-zemin">
                        <svg viewBox="0 0 24 24" className="size-[15px] stroke-yesil" fill="none" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                          <path d="m20 6-11 11-5-5" />
                        </svg>
                      </span>
                      <h2 className="text-[14px] font-bold">Güçlü Yönleriniz</h2>
                    </div>
                    <ul className="flex flex-col gap-2.5">
                      {rapor.aiDegerlendirme.genelGucluYonler.map((g, i) => (
                        <li key={i} className="flex gap-2.5">
                          <span className="w-[5px] shrink-0 rounded-sm bg-yesil" />
                          <span className="text-[11.5px] leading-relaxed font-medium text-metin">
                            {g}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {!!rapor.aiDegerlendirme?.kriterler.some((k) => k.oneri) && (
                  <section className="rounded-xl border border-cizgi bg-white px-5 py-4">
                    <div className="mb-3 flex items-center gap-2.5">
                      <span className="flex size-[26px] items-center justify-center rounded-[7px] bg-amber-zemin">
                        <svg viewBox="0 0 24 24" className="size-[15px] stroke-amber" fill="none" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                        </svg>
                      </span>
                      <h2 className="text-[14px] font-bold">Gelecek Yıl İçin Öneriler</h2>
                    </div>

                    <ol className="flex flex-col gap-2.5">
                      {rapor.aiDegerlendirme.kriterler
                        .filter((k) => k.oneri)
                        // En çok puan kaybedilen kriterden başla.
                        .sort((a, b) => b.azamiPuan - b.aiPuan - (a.azamiPuan - a.aiPuan))
                        .slice(0, 4)
                        .map((k, i) => (
                          <li key={k.kod} className="rounded-lg border border-cizgi px-3.5 py-2.5">
                            <div className="mb-1 flex items-center gap-2.5">
                              <span className="flex size-[19px] shrink-0 items-center justify-center rounded-full bg-lacivert text-[10.5px] font-extrabold text-white">
                                {i + 1}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-[12px] font-bold">
                                {k.ad}
                              </span>
                              <span className="shrink-0 text-[10.5px] font-bold text-yesil-koyu">
                                +{k.azamiPuan - k.aiPuan} puana kadar
                              </span>
                            </div>
                            <p className="pl-[29px] text-[11px] leading-relaxed font-medium text-metin-2">
                              {k.oneri}
                            </p>
                          </li>
                        ))}
                    </ol>
                  </section>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
