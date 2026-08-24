import Link from 'next/link';
import RaporYukleyici from '@/components/rapor-yukleyici';
import SecimKutusu from '@/components/secim-kutusu';
import { DurumRozeti, KontrolNoktasi } from '@/components/rozet';
import DisaAktarDugmesi from '@/components/disa-aktar-dugmesi';
import RaporArama from '@/components/rapor-arama';
import { raporlariAra } from '@/lib/depo/arama';
import { raporlariListele, yarismalariListele } from '@/lib/depo/depo';
import { raporuMaskele } from '@/lib/depo/maskele';
import type { Rapor } from '@/lib/depo/tipler';

export const dynamic = 'force-dynamic';

const SUTUNLAR = ['BAŞVURU', 'PROJE / TAKIM', 'ÖN KONTROLLER', '4. GÖZ', 'HAKEM PUANI', 'DURUM', ''];

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
    yarismalar.find((y) => raporlariListele(y.id).length > 0)?.id ??
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
  const raporlar = aramaTerimi ? aranmis : suzgecleyi(tumRaporlar, suzgec);

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
            .map((y) => ({ y, n: raporlariListele(y.id).length }))
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
              const n = raporlariListele(yarisma.id, k.id).length;
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

                  {/* Hakem sütunu: değerlendirildi mi, kısmen mi, hiç mi */}
                  <td className="px-4 py-3">
                    {degerlendirildi ? (
                      <div className="flex items-center gap-1.5">
                        <svg viewBox="0 0 24 24" className="size-4 shrink-0 stroke-yesil" fill="none" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                          <path d="m20 6-11 11-5-5" />
                        </svg>
                        <span className="text-[15px] font-extrabold text-yesil-koyu">{r.hakemToplam}</span>
                      </div>
                    ) : r.hakemPuanlari?.length ? (
                      <div>
                        <span className="text-[13px] font-extrabold text-amber-koyu">{r.hakemToplam}</span>
                        <div className="text-[10px] font-bold text-amber-koyu">taslak</div>
                      </div>
                    ) : (
                      <span className="text-[11px] font-semibold text-metin-3">—</span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <DurumRozeti durum={r.durum} />
                  </td>

                  <td className="px-4 py-3">
                    <Link
                      href={`/koordinasyon/rapor/${r.id}`}
                      className={`rounded-lg px-3 py-1.5 text-[11.5px] font-bold transition-colors ${
                        degerlendirildi
                          ? 'border border-cizgi bg-white text-metin-2 hover:bg-zemin'
                          : 'bg-kirmizi text-white hover:bg-kirmizi-koyu'
                      }`}
                    >
                      {degerlendirildi ? 'Görüntüle' : 'Değerlendir'}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
