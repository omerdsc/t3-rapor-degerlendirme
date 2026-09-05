import AtamaPaneli, { type AtamaSatiri, type HakemSecenegi } from '@/components/atama-paneli';
import HakemYonetimi from '@/components/hakem-yonetimi';
import SecimKutusu from '@/components/secim-kutusu';
import { hakemYukleri, raporlarinHakemleri } from '@/lib/db/hakem-depo';
import {
  raporSayilari, raporlariListele, yarismalariListele,
} from '@/lib/depo/depo';
import { raporRumuzu, takimRumuzu } from '@/lib/depo/maskele';

export const dynamic = 'force-dynamic';

/**
 * Hakem yönetimi ve atama — koordinasyonun ekranı.
 *
 * İki iş bir ekranda: hakem kaydı ve rapor dağıtımı. Ayrı ekranlara
 * bölünse koordinasyon atama yaparken kimin ne kadar yüklü olduğunu
 * görmeden karar verirdi.
 */
export default async function HakemlerSayfasi({
  searchParams,
}: PageProps<'/koordinasyon/hakemler'>) {
  const p = await searchParams;
  const yukler = hakemYukleri();
  const yarismalar = yarismalariListele();
  // Açılır listelerdeki rapor sayıları TEK sorgudan; yarışma başına
  // ayrı sorgu atmak 44 tam tablo taraması demekti.
  const sayac = raporSayilari();

  // Varsayılan: raporu OLAN ilk yarışma. Boş bir yarışmada atama ekranı
  // anlamsız görünür ve kullanıcı sistemin çalışmadığını sanır.
  const secili =
    (p.yarisma as string | undefined) ??
    yarismalar.find((y) => (sayac.yarismaya.get(y.id) ?? 0) > 0)?.id ??
    yarismalar[0]?.id;
  const yarisma = yarismalar.find((y) => y.id === secili);
  const kategoriId = p.kategori as string | undefined;

  const raporlar = yarisma ? raporlariListele(yarisma.id, kategoriId) : [];

  /*
   * Atanmış hakemler TEK sorguda.
   *
   * Eskiden her satır için `raporunHakemleri()` ve
   * `raporunDegerlendirmeleri()` çağrılıyordu: 3000 raporda 6000 sorgu.
   * `npm run hacim -- 3000` bunu ölçtü — sayfa 650 ms sürüyordu.
   */
  const atamaHaritasi = raporlarinHakemleri(raporlar.map((r) => r.id));

  /*
   * SAYFA PANOSU — bu ekranın kendi soruları.
   * "Kaç hakemim var, iş nasıl dağılmış, kim geride kalıyor."
   */
  const gercekHakemler = yukler.filter((y) => !y.hakem.sistem);
  const aktifHakem = gercekHakemler.filter((y) => y.hakem.aktif).length;
  const toplamAtama = gercekHakemler.reduce((t, y) => t + y.atanan, 0);
  const bitenAtama = gercekHakemler.reduce((t, y) => t + y.tamamlanan, 0);
  const bekleyenAtama = toplamAtama - bitenAtama;

  const olcutler: Array<{ n: number; ad: string; vurgu?: string }> = [
    { n: aktifHakem, ad: 'AKTİF HAKEM' },
    { n: toplamAtama, ad: 'TOPLAM ATAMA' },
    { n: bitenAtama, ad: 'TAMAMLANDI', vurgu: 'text-yesil-koyu' },
    {
      n: bekleyenAtama, ad: 'BEKLİYOR',
      vurgu: bekleyenAtama > 0 ? 'text-amber-koyu' : undefined,
    },
  ];

  /*
   * SAYAÇLAR TÜM KAPSAMDAN, SATIRLAR KIRPILMIŞ.
   *
   * Atama panelinin işi toplu dağıtım; kullanıcının 3000 satırı görmesi
   * gerekmiyor ve hepsini istemciye prop olarak göndermek sayfayı 1,5 MB
   * yapıyordu (`npm run hacim -- 3000` ölçtü). Kapsam sayıları buradan
   * gidiyor, kapsamın kendisi atama sırasında sunucuda hesaplanıyor.
   */
  const GORUNUR_SATIR = 60;
  const toplamRapor = raporlar.length;
  const toplamAtanmamis = raporlar.filter(
    (r) => !(atamaHaritasi.get(r.id)?.length),
  ).length;

  /*
   * Atanmamışlar listenin BAŞINA alınıyor: panelin varsayılan kapsamı
   * "atanmamış raporlar" ve kullanıcı kırpılmış listede tam olarak onları
   * görmek istiyor. Atanmışları öne koymak, iş bekleyen raporları
   * görünmez yapardı.
   */
  const siralanmis = [
    ...raporlar.filter((r) => !(atamaHaritasi.get(r.id)?.length)),
    ...raporlar.filter((r) => atamaHaritasi.get(r.id)?.length),
  ].slice(0, GORUNUR_SATIR);

  const satirlar: AtamaSatiri[] = siralanmis.map((r) => {
    const kategori = yarisma?.kategoriler.find((k) => k.id === r.kategoriId);
    return {
      raporId: r.id,
      basvuruNo: r.basvuruNo,
      // Koordinasyon da rumuz görüyor: atama kararı takım adına göre
      // verilmemeli. Gerçek künye rapor sayfasından açılabiliyor.
      takimRumuzu: `${takimRumuzu(r.takimId)} · ${raporRumuzu(r.id)}`,
      proje: r.proje,
      kategoriAdi: kategori?.ad ?? '—',
      atananlar: atamaHaritasi.get(r.id) ?? [],
      kritikBulgu: r.kontroller.some((k) => k.durum === 'hata'),
    };
  });

  /*
   * Atama seçenekleri: aktif VE gerçek kişi olanlar.
   * Arşiv kaydı (sistem) listede görünüyor — eski puanların sahibi olarak
   * kayıtta kalması gerekiyor — ama ona rapor atanamaz.
   */
  const hakemler: HakemSecenegi[] = yukler
    .filter((y) => y.hakem.aktif && !y.hakem.sistem)
    .map((y) => ({
      id: y.hakem.id,
      ad: y.hakem.ad,
      kurum: y.hakem.kurum,
      atanan: y.atanan,
      uzmanlik: y.hakem.uzmanlik,
    }));

  // Şerit sayaçları tüm kapsamdan; kırpılmış listeden değil.
  const atanmamis = toplamAtanmamis;
  const bekleyen = raporlar.filter((r) => {
    const a = atamaHaritasi.get(r.id) ?? [];
    return a.length > 0 && a.some((x) => !x.tamamladi);
  }).length;

  return (
    <>
      <header className="mb-4">
        <h1 className="text-[22px] font-extrabold tracking-tight">
          Hakemler ve Atama
        </h1>
        <p className="mt-1.5 text-[12.5px] font-medium text-metin-2">
          Hakem kaydı → rapor dağıtımı → sonuçların panele dönüşü
        </p>
      </header>

      {/*
        AÇIKLAMA KUTUSU YERİNE PANO.

        Burada "Her hakem kendi panelini görür… puanları birbirini ezmez…"
        diye bir paragraf duruyordu. Sistemin nasıl çalıştığını
        anlatıyordu; kullanıcının bu ekranda sorduğu soru o değil:
        kaç hakemim var, iş nasıl dağılmış, kim geride kalıyor.
      */}
      <div className="mb-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {olcutler.map((o, i) => (
          <div
            key={o.ad}
            style={{ '--sira': i } as React.CSSProperties}
            className="kart belir px-4 py-3.5"
          >
            <p className={`text-[24px] leading-none font-extrabold tabular-nums ${o.vurgu ?? ''}`}>
              {o.n}
            </p>
            <p className="mt-1.5 text-[9.5px] leading-tight font-bold tracking-wide text-metin-2">
              {o.ad}
            </p>
          </div>
        ))}
      </div>

      <section className="mb-6">
        <HakemYonetimi yukler={yukler} />
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2.5">
          <h2 className="text-[15px] font-bold">Rapor atama</h2>
          {!!satirlar.length && (
            <span className="text-[11.5px] font-medium text-metin-2">
              {atanmamis} atanmamış · {bekleyen} değerlendirme bekliyor
            </span>
          )}
        </div>

        {!yarismalar.length ? (
          <p className="rounded-xl border border-dashed border-metin-3/40 bg-white px-5 py-8 text-center text-[12.5px] font-medium text-metin-2">
            Henüz yarışma kurulmadı.
          </p>
        ) : (
          <>
            <div className="mb-3 grid gap-3 rounded-xl border border-cizgi bg-white px-4 py-3 sm:grid-cols-2">
              <SecimKutusu
                etiket="Yarışma"
                secili={secili}
                secenekler={[...yarismalar]
                  .map((y) => ({ y, n: sayac.yarismaya.get(y.id) ?? 0 }))
                  .sort((a, b) => b.n - a.n || a.y.ad.localeCompare(b.y.ad, 'tr'))
                  .map(({ y, n }) => ({
                    deger: y.id,
                    etiket: y.ad,
                    ek: n ? `${n} rapor` : undefined,
                    grup: n ? 'Raporu olanlar' : 'Rapor yüklenmemiş',
                    adres: `/koordinasyon/hakemler?yarisma=${y.id}`,
                  }))}
              />
              {yarisma && (
                <SecimKutusu
                  etiket="Kategori"
                  secili={kategoriId ?? 'tumu'}
                  secenekler={[
                    {
                      deger: 'tumu',
                      etiket: 'Tüm kategoriler',
                      ek: `${sayac.yarismaya.get(yarisma.id) ?? 0} rapor`,
                      adres: `/koordinasyon/hakemler?yarisma=${yarisma.id}`,
                    },
                    ...yarisma.kategoriler.map((k) => ({
                      deger: k.id,
                      etiket: k.ad,
                      ek: `${sayac.kategoriye.get(k.id) ?? 0} rapor`,
                      adres: `/koordinasyon/hakemler?yarisma=${yarisma.id}&kategori=${k.id}`,
                    })),
                  ]}
                />
              )}
            </div>

            {yarisma && (
              <AtamaPaneli
                yarismaId={yarisma.id}
                kategoriId={kategoriId}
                satirlar={satirlar}
                toplamRapor={toplamRapor}
                toplamAtanmamis={toplamAtanmamis}
                hakemler={hakemler}
              />
            )}
          </>
        )}
      </section>
    </>
  );
}
