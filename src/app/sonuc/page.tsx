import Link from 'next/link';
import PortalDonus from '@/components/portal-donus';
import {
  kategoriGetir, raporlariBasvuruNoIle, yarismaGetir,
} from '@/lib/depo/depo';
import {
  nihaiAciklamalar, nihaiGeriBildirim, nihaiKriterPuanlari, nihaiOzet,
} from '@/lib/db/hakem-depo';

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

  /*
   * BİR BAŞVURU NUMARASINA BİRDEN ÇOK RAPOR BAĞLI OLABİLİR.
   *
   * Eskiden ilk eşleşme gösteriliyordu ve yarışmacı hangisini göreceği
   * tablo sırasına kalıyordu — rastgele. Bir takım iki yarışmaya
   * katıldığında da yalnızca birini görebiliyordu. Şimdi hepsi listeleniyor
   * ve `?rapor=` ile seçiliyor.
   */
  const raporlar = basvuruNo ? raporlariBasvuruNoIle(basvuruNo) : [];
  const seciliId = p.rapor as string | undefined;
  const rapor =
    raporlar.find((r) => r.id === seciliId) ??
    // Varsayılan: tamamlanmış ilk rapor. Yarışmacının aradığı şey sonuç;
    // henüz değerlendirilmemiş bir raporu öne koymak "sonuç yok" ekranı
    // gösterip elindeki sonucu saklamak olurdu.
    raporlar.find((r) => r.durum === 'tamamlandi') ??
    raporlar[0] ??
    null;
  const yarisma = rapor ? yarismaGetir(rapor.yarismaId) : null;
  const kategori = rapor ? kategoriGetir(rapor.yarismaId, rapor.kategoriId) : null;

  /*
   * PUANLAR HAKEM KAYITLARINDAN TÜRETİLİYOR.
   *
   * Eskiden bu ekran `rapor.hakemPuanlari` alanını okuyordu — tek hakemli
   * modelin kalıntısı. Çok hakemli modele geçince o alan boş kaldı ve
   * yarışmacı, toplamı doğru ama her kriteri 0 gösteren bir sonuç
   * görüyordu. Artık kırılım da toplam da hakem kayıtlarından geliyor.
   */
  const ozet = rapor ? nihaiOzet(rapor.id) : null;
  const kriterPuanlari = rapor ? nihaiKriterPuanlari(rapor.id) : null;
  const aciklamalar = rapor ? nihaiAciklamalar(rapor.id) : [];

  /*
   * GERİ BİLDİRİM HAKEM ONAYINDAN GELİYOR, MODELDEN DEĞİL.
   *
   * Eskiden bu ekran `rapor.aiDegerlendirme.genelGucluYonler` ve
   * `kriterler[].oneri` alanlarını doğrudan basıyordu: ham model çıktısı,
   * kimse okumadan yarışmacıya. Puanı hakemden alıp metni modelden almak
   * tutarsızdı. Artık hakem panelde bu metinleri düzeltip onaylıyor;
   * onaylanmamış hiçbir cümle buraya gelmiyor.
   */
  const geriBildirim = rapor
    ? nihaiGeriBildirim(rapor.id)
    : { gucluYonler: [], gelisimAlanlari: [], oneriler: new Map<string, string[]>() };

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
              TPRDS
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
        <PortalDonus />
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

        {/*
          Birden çok rapor varsa seçici. Tek raporda gösterilmiyor:
          seçeneği olmayan bir seçici gürültüdür.
        */}
        {raporlar.length > 1 && rapor && (
          <div className="mb-5 rounded-xl border border-cizgi bg-white px-4 py-3">
            <p className="mb-2 text-[11px] font-bold tracking-wide text-metin-2">
              BU BAŞVURU NUMARASINA {raporlar.length} RAPOR BAĞLI
            </p>
            <div className="flex flex-wrap gap-2">
              {raporlar.map((r) => {
                const y = yarismaGetir(r.yarismaId);
                const secili = r.id === rapor.id;
                return (
                  <Link
                    key={r.id}
                    href={`/sonuc?basvuru=${encodeURIComponent(basvuruNo!)}&rapor=${r.id}`}
                    className={`rounded-lg border px-3 py-2 text-[11.5px] font-semibold transition-colors ${
                      secili
                        ? 'border-kirmizi bg-kirmizi-zemin text-kirmizi-koyu'
                        : 'border-cizgi hover:bg-zemin'
                    }`}
                  >
                    {r.proje}
                    <span className="ml-1.5 font-medium text-metin-2">
                      · {y?.ad ?? '—'}
                      {r.durum === 'tamamlandi' ? '' : ' · değerlendirilmedi'}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

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
                    {/*
                      KAÇ HAKEM DEĞERLENDİRDİ — ama HANGİ hakemler DEĞİL.
                      Yarışmacının bilmesi gereken, kararın kaç bağımsız
                      değerlendirmeye dayandığı; hakem kimliği itiraz
                      sürecinde kurul üzerinden açılır, sonuç ekranında
                      yayımlanmaz.
                    */}
                    {(ozet?.tamamlanan ?? 0) > 1
                      ? `${ozet!.tamamlanan} bağımsız hakem değerlendirdi — puanınız ortalamadır`
                      : 'Uzman hakem tarafından değerlendirildi'}
                  </span>
                </div>
              </div>

              <div className="shrink-0 text-center">
                <div className="text-[10px] font-bold tracking-wide text-metin-3">TOPLAM PUAN</div>
                <div className="mt-0.5 text-[44px] leading-none font-extrabold">
                  {ozet?.puan?.toFixed(1) ?? rapor.hakemToplam}
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
                    const puan = kriterPuanlari?.get(k.kod);
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
                        {/*
                          YALNIZCA HAKEMİN YAZDIĞI NOT.

                          Burada bir zamanlar yapay zekâ gerekçesine geri
                          düşülüyordu — "hakem AI'ın puanını aynen kabul
                          ettiyse" koşuluyla. İki sebeple kaldırıldı:

                          1. O metin hakem onayından GEÇMEMİŞ model
                             çıktısıydı. Sızıntı denetimi (`npm run denetim`)
                             bunu yakaladı: TF-ANADOLU-2 sayfasında
                             onaylanmamış bir gerekçe duruyordu.
                          2. Çok hakemli modelde kriter puanı artık
                             ORTALAMA. "AI puanı = hakem puanı" eşitliği
                             mutabakat değil, tesadüf.

                          Hakem not yazmadıysa hiçbir şey uydurmuyoruz.
                          Gelişim önerileri ayrı bölümde ve onaylı.
                        */}
                        <p className="text-[11px] leading-relaxed font-medium text-metin-2">
                          {puan?.notlar.length
                            ? puan.notlar.join(' — ')
                            : 'Bu ölçüt için ayrıca not girilmemiş.'}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {!!aciklamalar.length && (
                  <div className="mt-5 rounded-lg bg-zemin/70 px-3.5 py-3">
                    <p className="mb-1 text-[11px] font-bold text-metin-2">
                      {aciklamalar.length > 1
                        ? 'Hakem kurulunun genel değerlendirmesi'
                        : 'Hakem notu'}
                    </p>
                    {aciklamalar.map((a, i) => (
                      <p
                        key={i}
                        className="text-[11.5px] leading-relaxed not-first:mt-2"
                      >
                        {a}
                      </p>
                    ))}
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
                {!!geriBildirim.gucluYonler.length && (
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
                      {geriBildirim.gucluYonler.map((g, i) => (
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

                {/*
                  GELİŞİME AÇIK ALANLAR — PRD'de üç ayrı yerde isteniyor
                  (rol tanımı, MVP madde 06, AKIŞ 03) ve eskiden hiçbir
                  ekranda yoktu: model üretiyordu, hiç basılmıyordu.
                */}
                {!!geriBildirim.gelisimAlanlari.length && (
                  <section className="rounded-xl border border-cizgi bg-white px-5 py-4">
                    <div className="mb-3 flex items-center gap-2.5">
                      <span className="flex size-[26px] items-center justify-center rounded-[7px] bg-amber-zemin">
                        <svg viewBox="0 0 24 24" className="size-[15px] stroke-amber" fill="none" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
                          <circle cx="12" cy="12" r="4" />
                        </svg>
                      </span>
                      <h2 className="text-[14px] font-bold">Gelişime Açık Alanlar</h2>
                    </div>
                    <ul className="flex flex-col gap-2.5">
                      {geriBildirim.gelisimAlanlari.map((g, i) => (
                        <li key={i} className="flex gap-2.5">
                          <span className="w-[5px] shrink-0 rounded-sm bg-amber" />
                          <span className="text-[11.5px] leading-relaxed font-medium text-metin">
                            {g}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {geriBildirim.oneriler.size > 0 && (
                  <section className="rounded-xl border border-cizgi bg-white px-5 py-4">
                    <div className="mb-3 flex items-center gap-2.5">
                      <span className="flex size-[26px] items-center justify-center rounded-[7px] bg-mavi-zemin">
                        <svg viewBox="0 0 24 24" className="size-[15px] stroke-mavi" fill="none" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                        </svg>
                      </span>
                      <h2 className="text-[14px] font-bold">Gelecek Yıl İçin Öneriler</h2>
                    </div>

                    {/*
                      "+N puana kadar" HAKEMİN PUANINDAN hesaplanıyor.
                      Eskiden yapay zekânın önerdiği puandan hesaplanıyordu
                      ve 9 ölçütün 7'sinde yanlış sayı gösteriyordu — hemen
                      yukarıdaki kriter tablosuyla çelişiyordu.
                    */}
                    <ol className="flex flex-col gap-2.5">
                      {kategori.rubrik.kriterler
                        .filter((k) => geriBildirim.oneriler.has(k.kod))
                        .map((k) => ({
                          olcut: k,
                          kayip: Math.round(
                            (k.puan - (kriterPuanlari?.get(k.kod)?.puan ?? 0)) * 10,
                          ) / 10,
                          metinler: geriBildirim.oneriler.get(k.kod)!,
                        }))
                        // En çok puan kaybedilen ölçütten başla: yarışmacı
                        // en değerli iyileştirmeyi ilk okusun.
                        .sort((a, b) => b.kayip - a.kayip)
                        .map((x, i) => (
                          <li
                            key={x.olcut.kod}
                            className="rounded-lg border border-cizgi px-3.5 py-2.5"
                          >
                            <div className="mb-1 flex items-center gap-2.5">
                              <span className="flex size-[19px] shrink-0 items-center justify-center rounded-full bg-lacivert text-[10.5px] font-extrabold text-white">
                                {i + 1}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-[12px] font-bold">
                                {x.olcut.ad}
                              </span>
                              {x.kayip > 0 && (
                                <span className="shrink-0 text-[10.5px] font-bold text-yesil-koyu">
                                  +{x.kayip} puana kadar
                                </span>
                              )}
                            </div>
                            {x.metinler.map((m, n) => (
                              <p
                                key={n}
                                className="pl-[29px] text-[11px] leading-relaxed font-medium text-metin-2 not-first:mt-1.5"
                              >
                                {m}
                              </p>
                            ))}
                          </li>
                        ))}
                    </ol>
                  </section>
                )}

                {/*
                  Hiç onaylı geri bildirim yoksa sessiz kalmıyoruz:
                  yarışmacı "sistem bozuk mu" diye düşünmesin.
                */}
                {!geriBildirim.gucluYonler.length &&
                  !geriBildirim.gelisimAlanlari.length &&
                  geriBildirim.oneriler.size === 0 && (
                    <section className="rounded-xl border border-dashed border-metin-3/40 bg-white px-5 py-6 text-center">
                      <p className="text-[12px] leading-relaxed font-medium text-metin-2">
                        Bu değerlendirme için ayrıca yazılı geri bildirim
                        girilmemiş. Puan kırılımınız yukarıda; sorularınız
                        için Yarışmalar Koordinatörlüğü ile iletişime
                        geçebilirsiniz.
                      </p>
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
