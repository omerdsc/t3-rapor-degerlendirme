import BenzerlikTarayici from '@/components/benzerlik-tarayici';
import SecimKutusu from '@/components/secim-kutusu';
import { raporlariListele, yarismalariListele } from '@/lib/depo/depo';

export const dynamic = 'force-dynamic';

/**
 * MVP 5 ekranı.
 *
 * Tarama KATEGORİ içinde yapılıyor, yarışma genelinde değil: benzerlik
 * tabanı aynı şablonu paylaşan raporlar arasında anlamlı. İki farklı
 * kategorinin raporlarını aynı havuza atmak tabanı bozar ve gerçek kopyayı
 * gürültünün içinde kaybettirir.
 */
export default async function BenzerlikSayfasi({
  searchParams,
}: PageProps<'/benzerlik'>) {
  const p = await searchParams;
  const yarismaId = typeof p.yarisma === 'string' ? p.yarisma : undefined;
  const kategoriId = typeof p.kategori === 'string' ? p.kategori : undefined;

  // Yalnızca raporu olan yarışmalar listeleniyor: 43 yarışmanın 41'i boş ve
  // hepsini göstermek seçimi zorlaştırır.
  const yarismalar = yarismalariListele()
    .map((y) => ({ y, raporlar: raporlariListele(y.id) }))
    .filter((x) => x.raporlar.length > 0);

  const secilen = yarismalar.find((x) => x.y.id === yarismaId);

  return (
    <>
      <header className="mb-5">
        <h1 className="text-[22px] font-extrabold tracking-tight">Benzerlik Taraması</h1>
        <p className="mt-1.5 text-[12.5px] font-medium text-metin-2">
          Aynı kategorideki raporlar birbirine ne kadar benziyor — metin ve şekil
        </p>
      </header>

      <div className="mb-5 flex items-start gap-3 rounded-xl border border-mavi/25 bg-mavi-zemin px-4 py-3">
        <svg viewBox="0 0 24 24" className="mt-px size-4 shrink-0 stroke-mavi" fill="none" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
        <p className="text-[11.5px] leading-relaxed font-medium text-mavi-koyu">
          <strong className="font-bold">Bu ekran karar vermez, kanıt gösterir.</strong>{' '}
          Yüksek örtüşme tek başına intihal değildir: ortak şablon, ortak
          kaynak, aynı takımın devam projesi ya da yaygın terminoloji olabilir.
          Sistem eşleşen cümleleri sayfa numaralarıyla yan yana koyar; kararı
          hakem verir. Şablon metni, başlıklar, üst/alt bilgi ve kaynakça
          karşılaştırmadan önce çıkarılır.
        </p>
      </div>

      {!yarismalar.length ? (
        <p className="rounded-xl border border-dashed border-metin-3/40 bg-white px-5 py-8 text-center text-[12.5px] font-medium text-metin-2">
          Henüz rapor yüklenmiş bir yarışma yok. Karşılaştırma için aynı
          kategoride en az iki rapor gerekir.
        </p>
      ) : (
        <>
          {/*
            Seçim açılır listeyle. Önce yarışmalar tek tek satır olarak
            basılıyordu; raporu olan yarışma sayısı arttıkça bu liste
            ekranı dolduruyor ve seçim yapmak yavaşlıyor.
          */}
          <div className="mb-4 grid gap-3 rounded-xl border border-cizgi bg-white px-4 py-3 sm:grid-cols-2">
            <SecimKutusu
              etiket="Yarışma"
              secili={secilen?.y.id}
              bosEtiket="Yarışma seçin…"
              secenekler={yarismalar.map(({ y, raporlar }) => ({
                deger: y.id,
                etiket: y.ad,
                ek: `${raporlar.length} rapor`,
                adres: `/benzerlik?yarisma=${y.id}`,
              }))}
            />

            {secilen && (
              <SecimKutusu
                etiket="Kategori"
                secili={kategoriId ?? 'tumu'}
                secenekler={[
                  {
                    deger: 'tumu',
                    etiket: 'Tüm kategoriler',
                    ek: `${secilen.raporlar.length} rapor`,
                    adres: `/benzerlik?yarisma=${secilen.y.id}`,
                  },
                  ...secilen.y.kategoriler
                    .filter((k) => raporlariListele(secilen.y.id, k.id).length > 0)
                    .map((k) => ({
                      deger: k.id,
                      etiket: k.ad,
                      ek: `${raporlariListele(secilen.y.id, k.id).length} rapor`,
                      adres: `/benzerlik?yarisma=${secilen.y.id}&kategori=${k.id}`,
                    })),
                ]}
              />
            )}
          </div>

          {secilen ? (
            <BenzerlikTarayici yarismaId={secilen.y.id} kategoriId={kategoriId} />
          ) : (
            <p className="rounded-xl border border-dashed border-metin-3/40 bg-white px-5 py-8 text-center text-[12.5px] font-medium text-metin-2">
              Karşılaştırma yapmak için yukarıdan bir yarışma seçin.
            </p>
          )}
        </>
      )}
    </>
  );
}
