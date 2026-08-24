import AtamaPaneli, { type AtamaSatiri, type HakemSecenegi } from '@/components/atama-paneli';
import HakemYonetimi from '@/components/hakem-yonetimi';
import SecimKutusu from '@/components/secim-kutusu';
import { hakemYukleri, raporunDegerlendirmeleri, raporunHakemleri } from '@/lib/db/hakem-depo';
import { raporlariListele, yarismalariListele } from '@/lib/depo/depo';
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
}: PageProps<'/hakemler'>) {
  const p = await searchParams;
  const yukler = hakemYukleri();
  const yarismalar = yarismalariListele();

  // Varsayılan: raporu OLAN ilk yarışma. Boş bir yarışmada atama ekranı
  // anlamsız görünür ve kullanıcı sistemin çalışmadığını sanır.
  const secili =
    (p.yarisma as string | undefined) ??
    yarismalar.find((y) => raporlariListele(y.id).length > 0)?.id ??
    yarismalar[0]?.id;
  const yarisma = yarismalar.find((y) => y.id === secili);
  const kategoriId = p.kategori as string | undefined;

  const raporlar = yarisma ? raporlariListele(yarisma.id, kategoriId) : [];

  const satirlar: AtamaSatiri[] = raporlar.map((r) => {
    const atananlar = raporunHakemleri(r.id);
    const degerlendirmeler = raporunDegerlendirmeleri(r.id);
    const kategori = yarisma?.kategoriler.find((k) => k.id === r.kategoriId);
    return {
      raporId: r.id,
      basvuruNo: r.basvuruNo,
      // Koordinasyon da rumuz görüyor: atama kararı takım adına göre
      // verilmemeli. Gerçek künye rapor sayfasından açılabiliyor.
      takimRumuzu: `${takimRumuzu(r.takimId)} · ${raporRumuzu(r.id)}`,
      proje: r.proje,
      kategoriAdi: kategori?.ad ?? '—',
      atananlar: atananlar.map((h) => ({
        id: h.id,
        ad: h.ad,
        tamamladi: degerlendirmeler.some(
          (d) => d.hakemId === h.id && d.durum === 'tamamlandi',
        ),
      })),
      kritikBulgu: r.kontroller.some((k) => k.durum === 'hata'),
    };
  });

  const hakemler: HakemSecenegi[] = yukler
    .filter((y) => y.hakem.aktif)
    .map((y) => ({
      id: y.hakem.id,
      ad: y.hakem.ad,
      kurum: y.hakem.kurum,
      atanan: y.atanan,
      uzmanlik: y.hakem.uzmanlik,
    }));

  const atanmamis = satirlar.filter((s) => !s.atananlar.length).length;
  const bekleyen = satirlar.filter(
    (s) => s.atananlar.length && s.atananlar.some((a) => !a.tamamladi),
  ).length;

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

      <div className="mb-5 flex items-start gap-3 rounded-xl border border-mavi/25 bg-mavi-zemin px-4 py-3">
        <svg viewBox="0 0 24 24" className="mt-px size-4 shrink-0 stroke-mavi" fill="none" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
        <p className="text-[11.5px] leading-relaxed font-medium text-mavi-koyu">
          <strong className="font-bold">Her hakem kendi panelini görür.</strong>{' '}
          Hakeme verdiğiniz bağlantı yalnızca ona atanmış raporları açar;
          takım adları rumuzlu olduğu için puanlama kör kalır. Bir rapora
          birden çok hakem atanabilir —{' '}
          <strong className="font-bold">
            puanları birbirini ezmez, nihai puan ortalamadır
          </strong>{' '}
          ve hakemler arası fark ayrıca gösterilir.
        </p>
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
                  .map((y) => ({ y, n: raporlariListele(y.id).length }))
                  .sort((a, b) => b.n - a.n || a.y.ad.localeCompare(b.y.ad, 'tr'))
                  .map(({ y, n }) => ({
                    deger: y.id,
                    etiket: y.ad,
                    ek: n ? `${n} rapor` : undefined,
                    grup: n ? 'Raporu olanlar' : 'Rapor yüklenmemiş',
                    adres: `/hakemler?yarisma=${y.id}`,
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
                      ek: `${raporlariListele(yarisma.id).length} rapor`,
                      adres: `/hakemler?yarisma=${yarisma.id}`,
                    },
                    ...yarisma.kategoriler.map((k) => ({
                      deger: k.id,
                      etiket: k.ad,
                      ek: `${raporlariListele(yarisma.id, k.id).length} rapor`,
                      adres: `/hakemler?yarisma=${yarisma.id}&kategori=${k.id}`,
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
                hakemler={hakemler}
              />
            )}
          </>
        )}
      </section>
    </>
  );
}
