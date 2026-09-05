import Link from 'next/link';
import SezonSecici from '@/components/sezon-secici';
import { akisOzeti } from '@/lib/db/hakem-depo';
import { cevapBekleyenBasvuruSorulari } from '@/lib/db/basvuru-mesaji';
import { basvuruDurumlari } from '@/lib/db/basvuru-depo';
import {
  cevapBekleyenYazismalar, panoOzeti, raporlariListele, sezonlar,
  yarismalariListele,
} from '@/lib/depo/depo';
import { teslimPenceresi } from '@/lib/analiz/teslim-penceresi';
import { tarihYaz } from '@/lib/analiz/takvim';
import { kategoriEtiketi } from '@/lib/gorunum/kategori-etiketi';

export const dynamic = 'force-dynamic';

/**
 * Koordinasyon panosu.
 *
 * ── ÖNCEKİ TASARIMIN SORUNU ─────────────────────────────────────────────
 * "Yapılacak işler" beş kırmızı-amber blok hâlinde diziliyordu ve hepsi
 * aynı aciliyette görünüyordu. İçlerinde "76 kategori ölçütleri
 * onaylanmadı" gibi KURULUM işleri, "2 hakem cevap bekliyor" gibi
 * BEKLEYEN İNSAN işleriyle yan yanaydı. Sonuç: hiçbiri öne çıkmıyordu ve
 * her şey acil görünen bir ekran, hiçbir şeyin acil olmadığı bir ekranla
 * aynı şeyi söylüyor.
 *
 * Ayrıca sağ sütunda uzun bir gri metin bloğu vardı — kimsenin okumadığı
 * bir deneme yazısı. Kaldırıldı; taşıdığı tek sayı üstteki ölçütlere
 * girdi.
 *
 * ── YENİ DÜZEN ──────────────────────────────────────────────────────────
 *   1. Sezon süzgeci — hangi yılın işine bakıyoruz
 *   2. Beş ölçüt — sistemin durumu tek bakışta
 *   3. Değerlendirme akışı — nerede kaldık
 *   4. Bekleyen işler — YALNIZCA birinin beklediği işler
 *   5. Kurulum — yapılması gereken ama kimseyi bekletmeyen işler, sakin
 *   6. Son raporlar
 */

interface Is {
  baslik: string;
  aciklama: string;
  sayi: number;
  yol: string;
  eylem: string;
}

export default async function PanoSayfasi({
  searchParams,
}: PageProps<'/koordinasyon'>) {
  const p = await searchParams;
  const mevcutSezonlar = sezonlar();

  /*
   * VARSAYILAN SEZON EN YENİSİ, "tümü" DEĞİL.
   *
   * Koordinasyonun işi bu yılın işi; arşiv istisna. Varsayılan "tümü"
   * olsaydı her sayaç geçen yılların birikimini de sayardı ve "6 rapor
   * bekliyor" hangi yıla ait olduğu belirsiz bir sayı olurdu.
   */
  const sezonParam = p.sezon as string | undefined;
  const sezon =
    sezonParam === 'tumu'
      ? undefined
      : sezonParam
        ? Number(sezonParam)
        : mevcutSezonlar[0];

  const adres = (s?: number) => `/koordinasyon?sezon=${s ?? 'tumu'}`;

  const yarismalar = yarismalariListele().filter(
    (y) => sezon === undefined || y.yil === sezon,
  );
  const ozet = panoOzeti(undefined, undefined, sezon);
  const akis = akisOzeti(undefined, undefined, sezon);
  const raporlar = raporlariListele(undefined, undefined, sezon);

  // Sorular da sezona bağlı: arşiv sezonunda bu yılın soruları görünmemeli.
  const bekleyenSorular = cevapBekleyenYazismalar(undefined, undefined, sezon);
  const yarismaciSorulari = cevapBekleyenBasvuruSorulari(sezon);

  const basvurular = basvuruDurumlari().filter((b) =>
    yarismalar.some((y) => y.id === b.yarismaId),
  );
  const raporsuzBasvuru = basvurular.filter((b) => !b.raporId).length;

  const kritikli = raporlar.filter((r) =>
    r.kontroller.some((k) => k.durum === 'hata'),
  ).length;
  /*
   * KOPYA KARTI SOMUT OLMALI.
   *
   * Önce yalnızca "5 rapor işaretli" yazıyordu ve tıklayınca rapor
   * listesine gidiyordu. Bakan kişi ne bulunduğunu, kimin kiminle
   * eşleştiğini ve niye işaretlendiğini hiç öğrenemiyordu — "kopya var"
   * diyen ama neyi kastettiğini söylemeyen bir kutu.
   *
   * Artık bulgunun BAŞLIĞI gösteriliyor: hangi rapor, kaç görsel/cümle
   * eşleşti. Rakam değil cümle; okunduğunda anlaşılıyor.
   */
  const kopyaBulgulari = raporlar
    .map((r) => {
      const k = r.kontroller.find((x) => x.kod === 'benzerlik' && x.durum !== 'temiz');
      if (!k) return null;
      return {
        raporId: r.id,
        yarismaId: r.yarismaId,
        kategoriId: r.kategoriId,
        proje: r.proje,
        // İlk bulgu en güçlü eşleşme; kartta bir satır yeterli.
        baslik: k.bulgular?.[0]?.baslik ?? k.ozet,
        agir: k.durum === 'hata',
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  const kopyaSupheli = kopyaBulgulari.length;

  const onaysizKategori = yarismalar.reduce(
    (t, y) => t + y.kategoriler.filter((k) => !k.duzenlendi).length,
    0,
  );
  const sartnamesizKategori = yarismalar.reduce(
    (t, y) => t + y.kategoriler.filter((k) => !k.sartname).length,
    0,
  );

  /*
   * YARIŞMA BAZINDA DEĞERLENDİRME — AKIŞ KARTININ İÇİNDE.
   *
   * Burada önce "hakem yükü" vardı: hangi hakemin kaç raporu var. Yanlış
   * yerdeydi — o bir OPERASYON bilgisi ve atama ekranına ait. Panonun
   * cevapladığı soru kişiler değil, süreç: hangi yarışma bitti, hangisi
   * devam ediyor.
   *
   * Panonun ALTINDA "kategori teslim durumu" var: rapor GELDİ Mİ. Burası
   * onun devamı: gelen rapor DEĞERLENDİRİLDİ Mİ. İkisi birlikte sürecin
   * iki yarısını kapatıyor ve birbirini tekrarlamıyor.
   */
  const yarismaIlerlemesi = yarismalar
    .map((y) => {
      const kendi = raporlar.filter((r) => r.yarismaId === y.id);
      if (!kendi.length) return null;
      const biten = kendi.filter((r) => r.durum === 'tamamlandi').length;
      return {
        id: y.id,
        ad: y.ad,
        toplam: kendi.length,
        biten,
        tamam: biten === kendi.length,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    /*
     * BİTMEYENLER ÖNCE. Tamamlanmış yarışma bir başarı kaydı; bitmeyen
     * bir iş. Pano işleri öne alır.
     */
    .sort((a, b) => {
      if (a.tamam !== b.tamam) return a.tamam ? 1 : -1;
      return b.toplam - b.biten - (a.toplam - a.biten);
    })
    .slice(0, 5);
  const bitenYarisma = yarismaIlerlemesi.filter((y) => y.tamam).length;

  const puanlar = raporlar
    .map((r) => r.hakemToplam)
    .filter((x): x is number => typeof x === 'number');
  const ortalama = puanlar.length
    ? Math.round((puanlar.reduce((t, x) => t + x, 0) / puanlar.length) * 10) / 10
    : null;

  /*
   * BEKLEYEN İŞLER: yalnızca BİRİNİN BEKLEDİĞİ işler.
   *
   * Ölçüt şu: bu satır bir insanı bekletiyor mu? Hakemin sorusu, bekleyen
   * bir kişi. Atanmamış rapor, bekleyen bir yarışmacı. Onaysız ölçüt
   * kimseyi bekletmiyor — o kurulum, aşağıda.
   */
  const isler: Is[] = ([
    ...(bekleyenSorular.length
      ? [{
          baslik: 'Hakem sorusu cevap bekliyor',
          aciklama:
            bekleyenSorular.length === 1
              ? `${bekleyenSorular[0].basvuruNo} raporunda ${bekleyenSorular[0].hakemAdi} soru sordu.`
              : 'Hakemler rapor üzerinden soru sordu; yanıtlanmayı bekliyor.',
          sayi: bekleyenSorular.length,
          yol: `/koordinasyon/rapor/${bekleyenSorular[0].raporId}`
            + (bekleyenSorular[0].hakemId
              ? `?hakem=${encodeURIComponent(bekleyenSorular[0].hakemId)}`
              : '')
            + '#yazisma',
          eylem: bekleyenSorular.length === 1 ? 'Yanıtla' : 'İlkini aç',
        }]
      : []),
    ...(yarismaciSorulari.length
      ? [{
          baslik: 'Yarışmacı sorusu cevap bekliyor',
          aciklama:
            yarismaciSorulari.length === 1
              ? `${yarismaciSorulari[0].takim} başvurusu hakkında soru sordu.`
              : 'Yarışmacılar başvuruları hakkında soru sordu.',
          sayi: yarismaciSorulari.length,
          yol: `/koordinasyon/basvurular/${yarismaciSorulari[0].basvuruId}`,
          eylem: yarismaciSorulari.length === 1 ? 'Yanıtla' : 'İlkini aç',
        }]
      : []),
    {
      baslik: 'Rapor hakeme atanmadı',
      aciklama: 'Teslim edilmiş ama henüz kimseye dağıtılmamış rapor var.',
      sayi: akis.atanmamis,
      yol: '/koordinasyon/hakemler',
      eylem: 'Dağıt',
    },
    {
      baslik: 'Değerlendirme gecikti',
      aciklama: 'Son tarihi geçmiş ve hâlâ tamamlanmamış değerlendirme var.',
      sayi: akis.geciken,
      yol: '/koordinasyon/hakemler',
      eylem: 'Hakemlere git',
    },
    {
      baslik: 'Kritik bulgulu rapor',
      aciklama: 'Eksik bölüm, kaynakça sorunu ya da kopya şüphesi var.',
      sayi: kritikli,
      yol: `/koordinasyon/raporlar?durum=manuel&sezon=${sezon ?? 'tumu'}`,
      eylem: 'İncele',
    },
  ] satisfies Is[]).filter((i) => i.sayi > 0);

  const kurulumIsleri: Is[] = ([
    {
      baslik: 'Kategori ölçütleri onaylanmadı',
      aciklama: 'Ölçütler şablondan otomatik çıkarıldı; onay bekliyor.',
      sayi: onaysizKategori,
      yol: '/koordinasyon/yarismalar',
      eylem: 'Onayla',
    },
    {
      baslik: 'Kategoride şartname eksik',
      aciklama: 'Şartname olmadan eleyici kurallar bilinmiyor.',
      sayi: sartnamesizKategori,
      yol: '/koordinasyon/yarismalar',
      eylem: 'Yükle',
    },
  ] satisfies Is[]).filter((i) => i.sayi > 0);

  const olcutler: Array<{ n: string; ad: string; yol?: string; vurgu?: string }> = [
    { n: String(basvurular.length), ad: 'BAŞVURU', yol: '/koordinasyon/basvurular' },
    { n: String(ozet.toplam), ad: 'TESLİM EDİLEN RAPOR', yol: `/koordinasyon/raporlar?sezon=${sezon ?? 'tumu'}` },
    {
      n: String(raporsuzBasvuru), ad: 'RAPOR BEKLENİYOR',
      yol: '/koordinasyon/basvurular',
      vurgu: raporsuzBasvuru > 0 ? 'text-amber-koyu' : undefined,
    },
    { n: String(ozet.tamamlanan), ad: 'SONUÇLANDI', vurgu: 'text-yesil-koyu' },
    { n: ortalama === null ? '—' : ortalama.toFixed(1), ad: 'ORTALAMA PUAN' },
  ];

  /*
   * YAKLAŞAN TESLİM TARİHLERİ — "SON RAPORLAR"IN YERİNE.
   *
   * Panonun altında son yüklenen altı rapor listeleniyordu. Kaldırıldı:
   * "en son ne geldi" sorusunu cevaplıyordu ama koordinasyonun panoda
   * sorduğu soru bu değil. Kronolojik sıra öncelik sırası değil — en son
   * gelen rapor en acil rapor değil. Bekleyen raporlar zaten yukarıda
   * sayılıyor, tam liste de Raporlar sayfasında süzgeçleriyle duruyor.
   *
   * Panonun asıl eksiği ZAMAN BOYUTUYDU: hangi kategori ne zaman
   * kapanıyor ve kaç takım hâlâ rapor yüklemedi. Bu, teslim günü
   * geldiğinde öğrenilecek bir şey değil — önceden görülmesi gereken bir
   * risk. Koordinasyon bu listeye bakıp hatırlatma yapabiliyor.
   */
  const bugun = new Date();
  const teslimDurumu = yarismalar
    .flatMap((y) =>
      y.kategoriler.map((k) => {
        /*
         * YALNIZCA BAŞVURUSU OLAN KATEGORİLER.
         * 90 kategorinin çoğunda hiç başvuru yok; hepsini listelemek
         * bu bölümü 90 satırlık bir katalog dökümüne çevirirdi.
         */
        const kb = basvurular.filter((b) => b.kategoriId === k.id);
        if (!kb.length) return null;

        const pen = teslimPenceresi(k.sartname?.kurallar.tarihler, k.asama, bugun);
        return {
          id: k.id,
          yarismaId: y.id,
          yarismaAdi: y.ad,
          etiket: kategoriEtiketi(k.ad, k.asama, y.ad),
          acik: pen.acik,
          teslim: pen.teslim,
          kalanGun: pen.kalanGun,
          bekleyen: kb.filter((b) => !b.raporId).length,
          toplam: kb.length,
        };
      }),
    )
    .filter((x): x is NonNullable<typeof x> => x !== null)
    /*
     * SIRA: RİSKE GÖRE.
     *
     * Süresi dolmuş ve hâlâ eksik raporu olan kategori en üstte — orada
     * yapılabilecek bir şey kalmadı ama koordinasyonun bilmesi gereken
     * ilk şey o. Sonra kapanmaya en yakın olanlar. Tarihi bilinmeyenler
     * en sonda: sıralanacak bir şeyleri yok.
     */
    .sort((a, b) => {
      const risk = (x: typeof a) => (!x.acik && x.bekleyen > 0 ? 0 : x.acik ? 1 : 2);
      const fa = risk(a);
      const fb = risk(b);
      if (fa !== fb) return fa - fb;
      return (a.kalanGun ?? 9999) - (b.kalanGun ?? 9999);
    })
    .slice(0, 6);

  return (
    <>
      {/* ------------------------------------------------------ başlık */}
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] leading-tight font-extrabold tracking-tight">
            Değerlendirme Panosu
          </h1>
          <p className="mt-1 text-[12px] font-medium text-metin-2">
            {sezon ? `${sezon} sezonu` : 'Bütün sezonlar'} · {yarismalar.length} yarışma
          </p>
        </div>
        <SezonSecici sezonlar={mevcutSezonlar} secili={sezon} adres={adres} />
      </header>

      {/* ------------------------------------------------------ ölçütler */}
      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {olcutler.map((o, i) => {
          const govde = (
            <>
              <p className={`text-[24px] leading-none font-extrabold tabular-nums ${o.vurgu ?? ''}`}>
                {o.n}
              </p>
              <p className="mt-1.5 text-[9.5px] leading-tight font-bold tracking-wide text-metin-2">
                {o.ad}
              </p>
            </>
          );
          return o.yol ? (
            <Link
              key={o.ad}
              href={o.yol}
              style={{ '--sira': i } as React.CSSProperties}
              className="kart kart-etkilesimli belir px-4 py-3.5"
            >
              {govde}
            </Link>
          ) : (
            <div
              key={o.ad}
              style={{ '--sira': i } as React.CSSProperties}
              className="kart belir px-4 py-3.5"
            >
              {govde}
            </div>
          );
        })}
      </div>

      {/* ------------------------------------------------ akış + kopya */}
      <div className="mb-5 grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        {akis.rapor > 0 ? (
          <section className="kart px-5 py-4">
            <div className="mb-3 flex flex-wrap items-baseline gap-3">
              <h2 className="text-[14px] font-extrabold tracking-tight">
                Değerlendirme akışı
              </h2>
              <span className="text-[11.5px] font-medium text-metin-2">
                {akis.bitenDegerlendirme}/{akis.beklenenDegerlendirme} değerlendirme bitti
              </span>
              <span className="ml-auto text-[22px] leading-none font-extrabold text-lacivert">
                %{akis.yuzde}
              </span>
            </div>

            <div className="mb-3 h-2 overflow-hidden rounded-full bg-zemin">
              <div
                className="h-full rounded-full bg-yesil transition-[width] duration-500"
                style={{ width: `${akis.yuzde}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {([
                ['Tamamlandı', akis.tamamlanmis, 'text-yesil-koyu'],
                ['Sürüyor', akis.suren, 'text-mavi-koyu'],
                ['Atanmadı', akis.atanmamis, 'text-kirmizi'],
                ['Gecikti', akis.geciken, 'text-amber-koyu'],
              ] as Array<[string, number, string]>).map(([ad, n, renk]) => (
                <div key={ad} className="rounded-lg bg-zemin px-3 py-2.5">
                  <div className={`text-[18px] leading-none font-extrabold tabular-nums ${n > 0 ? renk : 'text-metin-3'}`}>
                    {n}
                  </div>
                  <div className="mt-1 text-[10px] font-bold tracking-wide text-metin-2">
                    {ad.toLocaleUpperCase('tr')}
                  </div>
                </div>
              ))}
            </div>

            {/* ---- yarışma bazında */}
            {yarismaIlerlemesi.length > 0 && (
              <div className="mt-4 border-t border-cizgi pt-3.5">
                <div className="mb-2.5 flex flex-wrap items-baseline gap-x-3">
                  <h3 className="text-[12px] font-extrabold tracking-tight">
                    Yarışma bazında
                  </h3>
                  {bitenYarisma > 0 && (
                    <span className="text-[11px] font-semibold text-yesil-koyu">
                      {bitenYarisma} yarışma tamamlandı
                    </span>
                  )}
                  <Link
                    href={`/koordinasyon/raporlar?sezon=${sezon ?? 'tumu'}`}
                    className="ml-auto text-[11.5px] font-bold text-kirmizi hover:underline"
                  >
                    Raporlara git →
                  </Link>
                </div>

                <ul className="flex flex-col gap-2">
                  {yarismaIlerlemesi.map((y) => (
                    <li key={y.id} className="flex items-center gap-3">
                      <span className="w-[42%] min-w-0 shrink-0 truncate text-[11.5px] font-semibold">
                        {y.ad}
                      </span>

                      {/* Ray sabit, dolgu soldan: uzunluklar karşılaştırılabilsin. */}
                      <span className="relative h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-zemin">
                        <span
                          className={`absolute inset-y-0 left-0 rounded-full ${
                            y.tamam ? 'bg-yesil' : 'bg-mavi'
                          }`}
                          style={{ width: `${(y.biten / y.toplam) * 100}%` }}
                        />
                      </span>

                      <span className="shrink-0 font-mono text-[11px] font-bold tabular-nums">
                        {y.biten}/{y.toplam}
                      </span>
                      <span className="w-[74px] shrink-0 text-right">
                        {y.tamam ? (
                          <span className="rounded bg-yesil-zemin px-1.5 py-0.5 text-[9.5px] font-bold text-yesil-koyu">
                            TAMAMLANDI
                          </span>
                        ) : (
                          <span className="rounded bg-mavi-zemin px-1.5 py-0.5 text-[9.5px] font-bold text-mavi-koyu">
                            SÜRÜYOR
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        ) : (
          <section className="kart flex items-center justify-center px-5 py-8 text-center">
            <p className="text-[12.5px] font-medium text-metin-2">
              Bu sezonda henüz rapor teslim edilmedi.
            </p>
          </section>
        )}

        {/*
          KOPYA KONTROLÜ PANODA.
          Ayrı bir menü maddesiydi ve koordinasyon oraya ancak aklına
          gelirse gidiyordu — yani kopya şüphesini görmek için kopya
          şüphesi olduğunu tahmin etmesi gerekiyordu. Sayı buraya taşındı;
          ayrıntı rapor listesinin kendi sekmesinde.
        */}
        <section
          className={`kart px-5 py-4 ${
            kopyaSupheli > 0 ? 'border-kirmizi/30' : ''
          }`}
        >
          <div className="flex items-baseline gap-2">
            <h2 className="text-[14px] font-extrabold tracking-tight">Kopya kontrolü</h2>
            <span
              className={`ml-auto text-[20px] leading-none font-extrabold tabular-nums ${
                kopyaSupheli > 0 ? 'text-kirmizi' : 'text-yesil-koyu'
              }`}
            >
              {kopyaSupheli}
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed font-medium text-metin-2">
            Aynı kategorideki raporlar metin ve şekil örtüşmesine karşı
            karşılaştırıldı.
          </p>

          {kopyaSupheli === 0 ? (
            <p className="mt-3 rounded-lg bg-yesil-zemin px-3 py-2.5 text-[11.5px] font-semibold text-yesil-koyu">
              Bu sezonda örtüşme saptanmadı.
            </p>
          ) : (
            <>
              <ul className="mt-3 flex flex-col gap-1.5">
                {kopyaBulgulari.slice(0, 3).map((b) => (
                  <li key={b.raporId}>
                    <Link
                      href={`/koordinasyon/rapor/${b.raporId}`}
                      className="block rounded-lg bg-kirmizi-zemin px-3 py-2 transition-colors hover:bg-kirmizi/15"
                    >
                      <span className="block truncate text-[11.5px] font-bold text-kirmizi-koyu">
                        {b.proje}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] font-medium text-kirmizi-koyu/80">
                        {b.baslik}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {kopyaSupheli > 3 && (
                <p className="mt-2 text-[11px] font-medium text-metin-3">
                  +{kopyaSupheli - 3} rapor daha
                </p>
              )}
              {/*
                BAĞLANTI YARIŞMAYI TAŞIYOR.
                Taşımadığında rapor listesi VARSAYILAN yarışmayla açılıyordu
                ve işaretli rapor başka bir yarışmadaysa sekme boş
                görünüyordu: "kopya var" diyen bir kart, tıklanınca "kopya
                yok" gösteren bir liste açıyordu.
              */}
              <Link
                href={
                  `/koordinasyon/raporlar?durum=kopya&sezon=${sezon ?? 'tumu'}`
                  + `&yarisma=${kopyaBulgulari[0].yarismaId}`
                  + `&kategori=${kopyaBulgulari[0].kategoriId}`
                }
                className="mt-3 inline-block text-[12px] font-bold text-kirmizi hover:underline"
              >
                Kopya kontrolünü aç →
              </Link>
              <p className="mt-2.5 text-[10.5px] leading-relaxed font-medium text-metin-3">
                Sistem &ldquo;bu intihaldir&rdquo; demiyor; kanıtı gösterip
                kararı hakeme bırakıyor.
              </p>
            </>
          )}
        </section>
      </div>

      {/* -------------------------------------------------- bekleyen iş */}
      <section className="mb-5">
        <h2 className="mb-2.5 text-[15px] font-extrabold tracking-tight">
          Bekleyen işler
        </h2>

        {!isler.length ? (
          <p className="rounded-xl border border-yesil/25 bg-yesil-zemin px-5 py-6 text-center text-[12.5px] font-semibold text-yesil-koyu">
            Bekleyen iş yok. Cevaplanmamış soru, dağıtılmamış rapor ve
            geciken değerlendirme bulunmuyor.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {isler.map((i, n) => (
              <Link
                key={i.baslik}
                href={i.yol}
                style={{ '--sira': n } as React.CSSProperties}
                className="kart kart-etkilesimli belir flex items-center gap-4 border-l-[3px] border-l-kirmizi px-5 py-3.5"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-kirmizi text-[13px] font-extrabold text-white tabular-nums">
                  {i.sayi}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-extrabold tracking-tight">
                    {i.baslik}
                  </span>
                  <span className="mt-0.5 block text-[11.5px] font-medium text-metin-2">
                    {i.aciklama}
                  </span>
                </span>
                <span className="shrink-0 text-[12px] font-bold text-kirmizi">
                  {i.eylem} →
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ---------------------------------------------------- kurulum */}
      {kurulumIsleri.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-1 text-[13px] font-extrabold tracking-tight text-metin-2">
            Kurulum
          </h2>
          {/*
            Kurulum işleri KİMSEYİ BEKLETMİYOR ve bu yüzden sakin.
            Bekleyen işlerle aynı kırmızılıkta gösterildiğinde her şey acil
            görünüyordu; her şeyin acil olduğu bir ekran, hiçbir şeyin acil
            olmadığı bir ekranla aynı şeyi söyler.
          */}
          <p className="mb-2.5 text-[11px] font-medium text-metin-3">
            Yapılması gereken ama kimseyi bekletmeyen işler.
          </p>
          <div className="flex flex-col gap-2">
            {kurulumIsleri.map((i) => (
              <Link
                key={i.baslik}
                href={i.yol}
                className="kart kart-etkilesimli flex items-center gap-3.5 px-5 py-3"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-zemin text-[12px] font-extrabold text-metin-2 tabular-nums">
                  {i.sayi}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-bold">{i.baslik}</span>
                  <span className="mt-0.5 block text-[11px] font-medium text-metin-3">
                    {i.aciklama}
                  </span>
                </span>
                <span className="shrink-0 text-[11.5px] font-bold text-metin-2">
                  {i.eylem} →
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* --------------------------------------------- teslim durumu */}
      {teslimDurumu.length > 0 && (
        <section className="kart overflow-hidden">
          <div className="flex flex-wrap items-baseline gap-x-3 border-b border-cizgi px-5 py-3.5">
            <h2 className="text-[14px] font-extrabold tracking-tight">
              Kategori teslim durumu
            </h2>
            <span className="text-[11px] font-medium text-metin-3">
              Kaç takım rapor yükledi · son teslim şartname takviminden
            </span>
          </div>
          <ul>
            {teslimDurumu.map((k) => {
              const oran = k.toplam ? ((k.toplam - k.bekleyen) / k.toplam) * 100 : 0;
              return (
                <li
                  key={k.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-cizgi/60 px-5 py-3 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-bold">{k.etiket}</p>
                    <p className="mt-0.5 truncate text-[11px] font-medium text-metin-2">
                      {k.yarismaAdi}
                    </p>
                  </div>

                  {/*
                    ORAN ÇUBUĞU: "5/7 yükledi" bir sayı, çubuk bir durum.
                    Altı kategoriye tek bakışta hangisinin geride kaldığı
                    çubuklardan okunuyor; sayıları tek tek karşılaştırmak
                    gerekmiyor.
                  */}
                  <div className="w-full sm:w-40">
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="text-[11px] font-bold tabular-nums">
                        {k.toplam - k.bekleyen}/{k.toplam}
                      </span>
                      <span className="text-[10px] font-semibold text-metin-3">
                        rapor geldi
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-zemin">
                      <div
                        className={`h-full rounded-full ${
                          oran === 100 ? 'bg-yesil' : k.acik ? 'bg-amber' : 'bg-kirmizi'
                        }`}
                        style={{ width: `${Math.max(3, oran)}%` }}
                      />
                    </div>
                  </div>

                  <div className="shrink-0 text-right sm:w-28">
                    {!k.teslim ? (
                      <p className="text-[11px] font-semibold text-metin-3">
                        Tarih yok
                      </p>
                    ) : k.acik ? (
                      <>
                        <p
                          className={`text-[13px] leading-none font-extrabold tabular-nums ${
                            (k.kalanGun ?? 99) <= 7 ? 'text-kirmizi' : 'text-metin'
                          }`}
                        >
                          {k.kalanGun && k.kalanGun > 0 ? `${k.kalanGun} gün` : 'Bugün'}
                        </p>
                        <p className="mt-1 font-mono text-[10px] font-semibold text-metin-3">
                          {tarihYaz(k.teslim)}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-[11px] leading-none font-extrabold text-metin-3">
                          SÜRE DOLDU
                        </p>
                        <p className="mt-1 font-mono text-[10px] font-semibold text-metin-3">
                          {tarihYaz(k.teslim)}
                        </p>
                      </>
                    )}
                  </div>

                  {k.bekleyen > 0 && (
                    <Link
                      href={`/koordinasyon/basvurular?yarisma=${k.yarismaId}&kategori=${k.id}`}
                      className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors ${
                        k.acik
                          ? 'bg-amber-zemin text-amber-koyu hover:bg-amber/20'
                          : 'bg-kirmizi-zemin text-kirmizi-koyu hover:bg-kirmizi/15'
                      }`}
                    >
                      {k.bekleyen} eksik →
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
