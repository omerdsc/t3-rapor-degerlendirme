import BasvuruYonetimi from '@/components/basvuru-yonetimi';
import SecimKutusu from '@/components/secim-kutusu';
import { basvuruDurumlari } from '@/lib/db/basvuru-depo';
import { yarismalariListele } from '@/lib/depo/depo';

export const dynamic = 'force-dynamic';

/**
 * Başvuru kayıtları — koordinasyonun rapor toplama ekranı.
 *
 * ── BU EKRAN NEYİ DEĞİŞTİRDİ ────────────────────────────────────────────
 * Koordinasyon her raporu tek tek yüklüyordu. 60 yarışma ve 90
 * değerlendirme birimi düşünüldüğünde bu, sistem ne kadar hızlı olursa
 * olsun aşılamayan bir darboğaz: darboğaz makinede değil, dosyaları
 * yükleyen insanda.
 *
 * Artık raporu yarışmacı kendisi yüklüyor. Koordinasyonun işi bir kez
 * kayıt listesini aktarmak ve kimin yüklediğini izlemek. "Raporlar"
 * ekranındaki yükleyici duruyor — kaydı olmayan raporlar için (arşivden
 * aktarım, e-postayla gelen belge) hâlâ gerekiyor.
 */
export default async function BasvurularSayfasi({
  searchParams,
}: PageProps<'/koordinasyon/basvurular'>) {
  const p = await searchParams;
  const yarismalar = yarismalariListele();

  /*
   * Başvurular yarışma başına TEK sorguda sayılıyor. Her yarışma için
   * ayrı sorgu atmak, katalogdaki 60 yarışmada 60 tablo taraması demekti
   * — açılır listedeki sayaçlar için ödenecek bedel değil.
   */
  const tumBasvurular = basvuruDurumlari();
  const sayac = new Map<string, number>();
  for (const b of tumBasvurular) {
    sayac.set(b.yarismaId, (sayac.get(b.yarismaId) ?? 0) + 1);
  }

  /*
   * Varsayılan: BAŞVURUSU OLAN ilk yarışma. Boş bir yarışmayla açmak,
   * kullanıcıya sistemin çalışmadığını düşündürür — hakemler ekranında
   * aynı karar aynı sebeple verilmişti.
   */
  const secili =
    (p.yarisma as string | undefined)
    ?? yarismalar.find((y) => (sayac.get(y.id) ?? 0) > 0)?.id
    ?? yarismalar[0]?.id;

  const yarisma = yarismalar.find((y) => y.id === secili);
  const kategoriId = p.kategori as string | undefined;

  const basvurular = yarisma ? basvuruDurumlari(yarisma.id, kategoriId) : [];

  return (
    <>
      <header className="mb-5">
        <h1 className="text-[19px] leading-tight font-extrabold tracking-tight">
          Başvurular
        </h1>
        <p className="mt-1 text-[12px] leading-relaxed font-medium text-metin-2">
          Kayıt listesini aktarın, her başvuruya erişim kodu üretilsin.
          Yarışmacı bu kodla girip raporunu kendisi yükler.
        </p>
      </header>

      {yarismalar.length === 0 ? (
        <p className="rounded-xl border border-dashed border-metin-3/40 bg-white px-5 py-6 text-center text-[12.5px] font-medium text-metin-2">
          Önce bir yarışma kurmanız gerekiyor.
        </p>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap gap-3">
            <SecimKutusu
              etiket="Yarışma"
              secili={secili}
              secenekler={[...yarismalar]
                .map((y) => ({ y, n: sayac.get(y.id) ?? 0 }))
                .sort((a, b) => b.n - a.n || a.y.ad.localeCompare(b.y.ad, 'tr'))
                .map(({ y, n }) => ({
                  deger: y.id,
                  etiket: y.ad,
                  ek: n ? `${n} başvuru` : undefined,
                  grup: n ? 'Başvurusu olanlar' : 'Başvuru yok',
                  adres: `/koordinasyon/basvurular?yarisma=${y.id}`,
                }))}
            />
            {yarisma && yarisma.kategoriler.length > 1 && (
              <SecimKutusu
                etiket="Kategori"
                secili={kategoriId ?? 'tumu'}
                secenekler={[
                  {
                    deger: 'tumu',
                    etiket: 'Tüm kategoriler',
                    ek: `${sayac.get(yarisma.id) ?? 0} başvuru`,
                    adres: `/koordinasyon/basvurular?yarisma=${yarisma.id}`,
                  },
                  ...yarisma.kategoriler.map((k) => ({
                    deger: k.id,
                    etiket: k.ad,
                    adres: `/koordinasyon/basvurular?yarisma=${yarisma.id}&kategori=${k.id}`,
                  })),
                ]}
              />
            )}
          </div>

          {yarisma && (
            <BasvuruYonetimi
              yarismaId={yarisma.id}
              yarismaAdi={yarisma.ad}
              kategoriler={yarisma.kategoriler.map((k) => ({
                id: k.id,
                ad: k.ad,
                asama: k.asama,
              }))}
              basvurular={basvurular}
            />
          )}
        </>
      )}
    </>
  );
}
