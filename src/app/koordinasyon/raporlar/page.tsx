import Link from 'next/link';
import RaporYukleyici from '@/components/rapor-yukleyici';
import TopluDegerlendirme from '@/components/toplu-degerlendirme';
import SecimKutusu from '@/components/secim-kutusu';
import { DurumRozeti, KontrolNoktasi } from '@/components/rozet';
import DisaAktarDugmesi from '@/components/disa-aktar-dugmesi';
import RaporArama from '@/components/rapor-arama';
import { raporlarinHakemDurumu } from '@/lib/db/hakem-depo';
import { raporlariAra } from '@/lib/depo/arama';
import {
  raporSayilari, raporlariListele, yarismalariListele,
} from '@/lib/depo/depo';
import { raporuMaskele } from '@/lib/depo/maskele';
import type { Rapor } from '@/lib/depo/tipler';

export const dynamic = 'force-dynamic';

const SUTUNLAR = ['BAŞVURU', 'PROJE / TAKIM', 'ÖN KONTROLLER', '4. GÖZ', 'HAKEM DURUMU', 'DURUM', ''];

/** Hakemin işi bitti mi bitmedi mi — listenin ayrıldığı temel eksen. */
type Suzgec = 'bekleyen' | 'tamamlanan' | 'manuel' | 'tumu';

const SUZGEC_ETIKET: Record<Suzgec, string> = {
  bekleyen: 'Değerlendirilmedi',
  tamamlanan: 'Değerlendirildi',
  manuel: 'Manuel inceleme',
  tumu: 'Tümü',
};

function suzgecleyi(raporlar: Rapor[], s: Suzgec): Rapor[] {
  if (s === 'bekleyen') return raporlar.filter((r) => r.durum === 'hakem_bekliyor' || r.durum === 'yuklendi');
  if (s === 'tamamlanan') return raporlar.filter((r) => r.durum === 'tamamlandi');
  if (s === 'manuel') return raporlar.filter((r) => r.durum === 'manuel_inceleme');
  return raporlar;
}

export default async function RaporlarSayfasi({ searchParams }: PageProps<'/koordinasyon/raporlar'>) {
  const p = await searchParams;
  const yarismalar = yarismalariListele();
  // Açılır listelerdeki rapor sayıları TEK sorgudan; yarışma başına
  // ayrı sorgu atmak 44 tam tablo taraması demekti.
  const sayac = raporSayilari();
  /*
   * VARSAYILAN SEÇİM: raporu OLAN ilk yarışma.
   *
   * Önce `yarismalar[0]` seçiliyordu. Katalogdan 43 yarışma kurulduktan sonra
   * bu, alfabetik olarak ilk gelen ve büyük olasılıkla hiç raporu olmayan bir
   * yarışma demek — kullanıcı Raporlar ekranını açtığında boş liste görüyor
   * ve sistemin çalışmadığını sanıyor.
   */
  const secili =
    (p.yarisma as string | undefined) ??
    yarismalar.find((y) => (sayac.yarismaya.get(y.id) ?? 0) > 0)?.id ??
    yarismalar[0]?.id;
  const yarisma = yarismalar.find((y) => y.id === secili);

  // Şablon ve rubrik kategoriye bağlı; yükleme de kategori seçilerek yapılır.
  const kategoriId = (p.kategori as string | undefined) ?? yarisma?.kategoriler[0]?.id;
  const kategori = yarisma?.kategoriler.find((k) => k.id === kategoriId);
  const tumRaporlar = yarisma ? raporlariListele(yarisma.id, kategori?.id) : [];

  const suzgec = ((p.durum as string | undefined) ?? 'bekleyen') as Suzgec;
  const aramaTerimi = (p.ara as string | undefined) ?? '';

  /*
   * ARAMA SÜZGEÇTEN ÖNCE UYGULANIYOR.
   *
   * Aksi halde "bekleyen" sekmesinde arayan kullanıcı, aradığı rapor
   * tamamlanmışsa hiçbir şey bulamaz ve raporun var olmadığını sanır.
   * Arama yapıldığında durum sekmesi göz ardı edilip BÜTÜN raporlar
   * taranıyor; sekme sayaçları da arama sonucuna göre güncelleniyor.
   */
  const aranmis = aramaTerimi ? raporlariAra(tumRaporlar, aramaTerimi) : tumRaporlar;
  const suzulmus = aramaTerimi ? aranmis : suzgecleyi(tumRaporlar, suzgec);

  /*
   * SAYFALAMA — ÖLÇÜLEREK EKLENDİ.
   *
   * `npm run hacim -- 1000` bu ekranı ölçtü: veritabanı sorgusu 56 ms,
   * ama sayfanın tarayıcıya inmesi 24 SANİYE ve HTML 8,7 MB. Sebep
   * veritabanı değil, 1000 satırın çizilmesiydi — satır başına altı rozet,
   * toplam 6003 SVG. PRD'nin başlık problemi "yüksek hacim" olduğu için
   * bu, kabul edilebilir bir yavaşlık değil.
   *
   * Sayfa boyutu 50: bir ekranda rahat kaydırılan, tarayıcıyı zorlamayan
   * ve koordinatörün "kaçıncı sayfadayım" takibini kaybetmeyeceği aralık.
   */
  const SAYFA_BOYU = 50;
  const sayfaSayisi = Math.max(1, Math.ceil(suzulmus.length / SAYFA_BOYU));
  const sayfa = Math.min(
    Math.max(1, Number(p.sayfa) || 1),
    sayfaSayisi,
  );
  const raporlar = suzulmus.slice((sayfa - 1) * SAYFA_BOYU, sayfa * SAYFA_BOYU);

  /**
   * Sayfa bağlantısı — bütün süzgeçleri koruyor.
   *
   * Süzgeci düşüren bir sayfalama, kullanıcıyı 2. sayfada bambaşka bir
   * listeye götürür ve en sinir bozucu hata sınıfıdır.
   */
  const sayfaAdresi = (n: number) => {
    const q = new URLSearchParams();
    if (yarisma) q.set('yarisma', yarisma.id);
    if (kategori) q.set('kategori', kategori.id);
    if (aramaTerimi) q.set('ara', aramaTerimi);
    else q.set('durum', suzgec);
    if (n > 1) q.set('sayfa', String(n));
    return `/koordinasyon/raporlar?${q}`;
  };

  /*
   * Hakem durumu TEK sorguda, satır satır değil.
   *
   * Bu kolon eskiden yalnızca `r.hakemToplam` gösteriyordu; hakem atanmış
   * ve çalışıyor olan bir rapor da "—" görünüyordu. Koordinasyonun listeye
   * bakıp cevaplaması gereken soru şu: bu rapor atandı mı, atandıysa
   * kaçı bitirdi. Puan zaten tamamlanınca yazılıyor.
   */
  const hakemDurumu = raporlarinHakemDurumu(raporlar.map((r) => r.id));

  const sayilar: Record<Suzgec, number> = {
    bekleyen: suzgecleyi(aranmis, 'bekleyen').length,
    tamamlanan: suzgecleyi(aranmis, 'tamamlanan').length,
    manuel: suzgecleyi(aranmis, 'manuel').length,
    tumu: aranmis.length,
  };

  if (!yarismalar.length) {
    return (
      <>
        <h1 className="text-[22px] font-extrabold tracking-tight">Raporlar</h1>
        <p className="mt-5 rounded-xl border border-dashed border-metin-3/40 bg-white px-5 py-8 text-center text-[12.5px] font-medium text-metin-2">
          Önce bir yarışma kurmalısınız.{' '}
          <Link href="/koordinasyon/yarismalar" className="font-bold text-kirmizi hover:text-kirmizi-koyu">
            Yarışmalar →
          </Link>
        </p>
      </>
    );
  }

  const bagAdresi = (d: Suzgec) =>
    `/raporlar?yarisma=${secili}&kategori=${kategori?.id ?? ''}&durum=${d}`;

  return (
    <>
      <header className="mb-4">
        <h1 className="text-[22px] font-extrabold tracking-tight">Raporlar</h1>
        <p className="mt-1.5 text-[12.5px] font-medium text-metin-2">
          Raporu aç → bulguları incele → puanla ve tamamla
        </p>
      </header>

      {/*
        SEÇİM AÇILIR LİSTEYE ALINDI.

        Önce yarışmalar yatay çip listesiydi. 43 yarışma kurulduktan sonra
        ekranın yarısını kaplıyordu ve aradığını bulmak imkânsızdı. Çip
        listesi az seçenek için doğru kalıp; sayı büyüdüğünde açılır liste
        gerekiyor.

        Raporu OLAN yarışmalar üstte, sayaçlarıyla birlikte: kullanıcı boş
        yarışmaları elemek için tek tek denemek zorunda kalmasın.
      */}
      <div className="mb-4 grid gap-3 rounded-xl border border-cizgi bg-white px-4 py-3 sm:grid-cols-2">
        <SecimKutusu
          etiket="Yarışma"
          secili={secili}
          /*
            SIRALAMA VE GRUPLAMA
            Raporu olan yarışmalar önce geliyor; 43 yarışmanın 41'i boş ve
            kullanıcının işi neredeyse her zaman raporu olanlarla.
          */
          secenekler={[...yarismalar]
            .map((y) => ({ y, n: sayac.yarismaya.get(y.id) ?? 0 }))
            .sort((a, b) => b.n - a.n || a.y.ad.localeCompare(b.y.ad, 'tr'))
            .map(({ y, n }) => ({
              deger: y.id,
              etiket: y.ad,
              ek: n ? `${n} rapor` : undefined,
              grup: n ? 'Raporu olanlar' : 'Rapor yüklenmemiş',
              adres: `/koordinasyon/raporlar?yarisma=${y.id}&durum=${suzgec}`,
            }))}
        />

        {yarisma && (
          <SecimKutusu
            etiket="Kategori"
            secili={kategori?.id}
            secenekler={yarisma.kategoriler.map((k) => {
              const n = sayac.kategoriye.get(k.id) ?? 0;
              return {
                deger: k.id,
                etiket: k.ad,
                ek: n ? `${n} rapor` : `${k.rubrik.kriterler.length} ölçüt`,
                adres: `/koordinasyon/raporlar?yarisma=${yarisma.id}&kategori=${k.id}&durum=${suzgec}`,
              };
            })}
          />
        )}
        {/* Arama kutusu seçim kutularının yanında: aynı iş, aynı yer. */}
        {yarisma && (
          <div className="sm:col-span-2">
            <RaporArama
              temelAdres={`/koordinasyon/raporlar?yarisma=${yarisma.id}${
                kategori ? `&kategori=${kategori.id}` : ''
              }&durum=${suzgec}`}
              baslangic={aramaTerimi || undefined}
            />
          </div>
        )}
      </div>

      {/* Sonuçları dışa aktarma: koordinasyonun sıralama listesi, üst birim
          raporu ve itiraz dosyası buradan çıkıyor. */}
      {yarisma && tumRaporlar.length > 0 && (
        <div className="mb-3">
          <DisaAktarDugmesi
            yarismaId={yarisma.id}
            kategoriId={kategori?.id}
            raporSayisi={tumRaporlar.length}
          />
        </div>
      )}

      {aramaTerimi && (
        <p className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-mavi-zemin px-3.5 py-2.5 text-[11.5px] font-semibold text-mavi-koyu">
          &ldquo;{aramaTerimi}&rdquo; için {aranmis.length} rapor bulundu
          <span className="font-medium text-mavi-koyu/75">
            · başvuru numarası, takım adı, takım ID, proje adı ve rapor
            kapağından okunan bilgiler tarandı
          </span>
        </p>
      )}

      {yarisma && kategori && !aramaTerimi && (
        <RaporYukleyici
          yarismaId={yarisma.id}
          kategoriId={kategori.id}
          kategoriAdi={kategori.ad}
          icerikKategorileri={yarisma.icerikKategorileri}
        />
      )}

      {/*
        TOPLU ÖN DEĞERLENDİRME — yüklemenin hemen ARDINDA.
        PRD AKIŞ 01'in sırası bu: "raporları sisteme aktarır → AI analiz
        sürecini başlatır." Ekranda da aynı sırada duruyor ki kullanıcı
        yüklemeden sonra ne yapacağını aramak zorunda kalmasın.
      */}
      {yarisma && !aramaTerimi && (
        <TopluDegerlendirme yarismaId={yarisma.id} kategoriId={kategori?.id} />
      )}

      {/* Değerlendirildi / değerlendirilmedi ayrımı */}
      <nav className="mt-5 flex flex-wrap gap-1.5 border-b border-cizgi">
        {(['bekleyen', 'tamamlanan', 'manuel', 'tumu'] as Suzgec[]).map((d) => {
          const aktif = d === suzgec;
          const renk =
            d === 'bekleyen'
              ? 'text-amber-koyu'
              : d === 'tamamlanan'
                ? 'text-yesil-koyu'
                : d === 'manuel'
                  ? 'text-kirmizi-koyu'
                  : 'text-metin-2';
          return (
            <Link
              key={d}
              href={bagAdresi(d)}
              className={`-mb-px flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2.5 text-[12.5px] font-bold transition-colors ${
                aktif ? 'border-kirmizi bg-white text-metin' : 'border-transparent text-metin-2 hover:bg-white/60'
              }`}
            >
              {SUZGEC_ETIKET[d]}
              <span className={`rounded-full bg-zemin px-1.5 py-px text-[10.5px] font-extrabold ${aktif ? renk : 'text-metin-3'}`}>
                {sayilar[d]}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="overflow-x-auto rounded-b-xl border border-t-0 border-cizgi bg-white">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-cizgi">
              {SUTUNLAR.map((b, i) => (
                <th key={i} className="px-4 py-3 text-left text-[10px] font-bold tracking-wide text-metin-3">
                  {b}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!raporlar.length && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-[12.5px] font-medium text-metin-2">
                  {tumRaporlar.length === 0
                    ? 'Bu yarışmada henüz rapor yok. Yukarıdan yükleyin.'
                    : `"${SUZGEC_ETIKET[suzgec]}" grubunda rapor yok.`}
                </td>
              </tr>
            )}

            {raporlar.map((r) => {
              const degerlendirildi = r.durum === 'tamamlandi';
              return (
                <tr
                  key={r.id}
                  className={`border-t border-cizgi/70 ${degerlendirildi ? 'bg-yesil-zemin/25' : ''}`}
                >
                  <td
                    className={`px-4 py-3 ${
                      degerlendirildi
                        ? 'border-l-[3px] border-yesil'
                        : r.genelDurum === 'hata'
                          ? 'border-l-[3px] border-kirmizi'
                          : 'border-l-[3px] border-transparent'
                    }`}
                  >
                    <div className="text-[12.5px] font-bold">
                      {raporuMaskele(r).basvuruNo}
                    </div>
                    <div className="mt-0.5 text-[10.5px] font-medium text-metin-3">
                      {new Date(r.yuklendi).toLocaleDateString('tr')}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="max-w-[280px] truncate text-[12.5px] font-semibold">{r.proje}</div>
                    <div className="mt-0.5 text-[11px] font-medium text-metin-2">
                      {raporuMaskele(r).takim}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      {r.kontroller.map((k) => (
                        <KontrolNoktasi key={k.kod} seviye={k.durum} baslik={`${k.ad}: ${k.ozet}`} />
                      ))}
                    </div>
                    <div className="mt-1.5 max-w-[190px] truncate text-[10px] font-semibold text-metin-2">
                      {r.kontroller
                        .filter((k) => k.durum !== 'temiz')
                        .map((k) => k.ad)
                        .join(' · ') || 'Tüm kontroller temiz'}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    {r.aiDegerlendirme ? (
                      <>
                        <span className="text-[15px] font-extrabold">{r.aiDegerlendirme.aiToplam}</span>
                        <span className="text-[11px] font-semibold text-metin-3">
                          /{r.aiDegerlendirme.azamiToplam}
                        </span>
                        {r.aiDegerlendirme.incelemeGereken > 0 && (
                          <div className="mt-0.5 text-[10px] font-bold text-amber-koyu">
                            {r.aiDegerlendirme.incelemeGereken} kriter incelensin
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-[11px] font-semibold text-metin-3">çalıştırılmadı</span>
                    )}
                  </td>

                  {/*
                    HAKEM SÜTUNU — dört ayrı durum, dördü de ayırt edilebilir:
                    (1) bitti + puan, (2) çalışılıyor, (3) atandı ama
                    başlanmadı, (4) hiç atanmadı. Dördüncüsü eyleme çağırıyor:
                    atanmamış rapor koordinasyonun işidir.
                  */}
                  <td className="px-4 py-3">
                    {(() => {
                      const h = hakemDurumu.get(r.id);
                      if (!h?.atanan) {
                        return (
                          <Link
                            href={`/koordinasyon/hakemler?yarisma=${yarisma!.id}`}
                            className="text-[11px] font-bold text-kirmizi hover:text-kirmizi-koyu"
                          >
                            Hakem ata →
                          </Link>
                        );
                      }
                      if (h.tamamlanan === h.atanan && r.hakemToplam !== undefined) {
                        return (
                          <div>
                            <div className="flex items-center gap-1.5">
                              <svg viewBox="0 0 24 24" className="size-4 shrink-0 stroke-yesil" fill="none" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                                <path d="m20 6-11 11-5-5" />
                              </svg>
                              <span className="text-[15px] font-extrabold text-yesil-koyu">
                                {r.hakemToplam}
                              </span>
                            </div>
                            <div className="text-[10px] font-semibold text-metin-2">
                              {h.atanan > 1 ? `${h.atanan} hakem ortalaması` : '1 hakem'}
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div>
                          <span className="text-[12px] font-bold text-amber-koyu">
                            {h.tamamlanan}/{h.atanan} bitti
                          </span>
                          <div className="text-[10px] font-semibold text-metin-2">
                            {h.taslak
                              ? `${h.taslak} taslak sürüyor`
                              : 'hakem başlamadı'}
                          </div>
                        </div>
                      );
                    })()}
                  </td>

                  <td className="px-4 py-3">
                    <DurumRozeti durum={r.durum} />
                  </td>

                  {/*
                    DÜĞME "DEĞERLENDİR" DEMİYOR.
                    Koordinasyon puan girmiyor — puanı hakem veriyor. Eski
                    etiket kullanıcıyı puanlama beklediği bir ekrana
                    gönderiyordu ve orada puanlama olmadığı için tutarsız
                    duruyordu. Yaptığı iş inceleme: kontroller, ön
                    değerlendirme, hakem sonuçları, yazışma.
                  */}
                  <td className="px-4 py-3">
                    <Link
                      href={`/koordinasyon/rapor/${r.id}`}
                      className={`rounded-lg px-3 py-1.5 text-[11.5px] font-bold transition-colors ${
                        degerlendirildi
                          ? 'border border-cizgi bg-white text-metin-2 hover:bg-zemin'
                          : 'bg-kirmizi text-white hover:bg-kirmizi-koyu'
                      }`}
                    >
                      İncele
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/*
        SAYFALAMA ÇUBUĞU — yalnızca birden çok sayfa varsa.
        Tek sayfada gösterilmesi gereksiz gürültü olurdu.
      */}
      {sayfaSayisi > 1 && (
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <span className="text-[11.5px] font-medium text-metin-2">
            {(sayfa - 1) * SAYFA_BOYU + 1}–
            {Math.min(sayfa * SAYFA_BOYU, suzulmus.length)} /{' '}
            <strong className="font-bold text-metin">{suzulmus.length}</strong> rapor
          </span>

          <div className="ml-auto flex items-center gap-1.5">
            <Link
              href={sayfaAdresi(Math.max(1, sayfa - 1))}
              aria-disabled={sayfa === 1}
              className={`rounded-lg border border-cizgi px-3 py-1.5 text-[11.5px] font-bold transition-colors ${
                sayfa === 1
                  ? 'pointer-events-none opacity-40'
                  : 'hover:bg-zemin'
              }`}
            >
              ← Önceki
            </Link>

            {/*
              Sayfa numaraları: ilk, son ve geçerli sayfanın çevresi.
              1000 raporda 20 sayfa var; hepsini basmak çubuğu taşırır.
            */}
            {Array.from({ length: sayfaSayisi }, (_, i) => i + 1)
              .filter(
                (n) =>
                  n === 1 ||
                  n === sayfaSayisi ||
                  Math.abs(n - sayfa) <= 1,
              )
              .map((n, i, dizi) => (
                <span key={n} className="flex items-center gap-1.5">
                  {/* Atlanan sayfa aralığı varsa üç nokta koy. */}
                  {i > 0 && n - dizi[i - 1] > 1 && (
                    <span className="text-[11px] font-bold text-metin-3">…</span>
                  )}
                  <Link
                    href={sayfaAdresi(n)}
                    className={`rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold transition-colors ${
                      n === sayfa
                        ? 'bg-kirmizi text-white'
                        : 'border border-cizgi hover:bg-zemin'
                    }`}
                  >
                    {n}
                  </Link>
                </span>
              ))}

            <Link
              href={sayfaAdresi(Math.min(sayfaSayisi, sayfa + 1))}
              aria-disabled={sayfa === sayfaSayisi}
              className={`rounded-lg border border-cizgi px-3 py-1.5 text-[11.5px] font-bold transition-colors ${
                sayfa === sayfaSayisi
                  ? 'pointer-events-none opacity-40'
                  : 'hover:bg-zemin'
              }`}
            >
              Sonraki →
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
