import Link from 'next/link';
import OzetToplu from '@/components/ozet-toplu';
import YarismaListesi from '@/components/yarisma-listesi';
import { birlesikListe, DURUM_METNI, satirlaraCevir } from '@/lib/katalog/birlesik';
import { katalogOku } from '@/lib/katalog/depo';
import { raporlariListele } from '@/lib/depo/depo';

export const dynamic = 'force-dynamic';

/**
 * Hazırlık çubuğu — oran ve eksik sayısı birlikte.
 *
 * Modül düzeyinde tanımlı, sayfa fonksiyonunun İÇİNDE değil: içeride
 * tanımlanan bir bileşen her çizimde yeni bir tip oluyor ve React onu
 * her seferinde baştan bağlıyor.
 */
function Hazirlik({
  ad, olan, toplam, aciklama,
}: { ad: string; olan: number; toplam: number; aciklama: string }) {
  const oran = toplam ? (olan / toplam) * 100 : 0;
  const eksik = toplam - olan;
  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2">
        <span className="text-[12px] font-bold">{ad}</span>
        <span className="font-mono text-[11.5px] font-bold tabular-nums">
          {olan}/{toplam}
        </span>
        {eksik > 0 && (
          <span className="ml-auto text-[11px] font-bold text-amber-koyu">
            {eksik} eksik
          </span>
        )}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-zemin">
        <div
          className={`h-full rounded-full ${oran === 100 ? 'bg-yesil' : 'bg-amber'}`}
          style={{ width: `${Math.max(2, oran)}%` }}
        />
      </div>
      <p className="mt-1.5 text-[10.5px] leading-relaxed font-medium text-metin-3">
        {aciklama}
      </p>
    </div>
  );
}

/**
 * Yarışmalar — kurulum panosu ve liste.
 *
 * ── NİYE PANO ───────────────────────────────────────────────────────────
 * Sayfa doğrudan 62 satırlık bir listeyle açılıyordu ve üstünde
 * "Kurmak ücretsizdir. Şablon ve şartname indirilip çözümlenir…" diye bir
 * açıklama bloğu duruyordu. Blok kullanıcının bir sorusunu cevaplamıyordu
 * — sistemin nasıl çalıştığını anlatıyordu, ki bu bir kullanım kılavuzu
 * işi. Kaldırıldı.
 *
 * Yerine kurulumun DURUMU geldi: kaç yarışma hazır, kaçı onay bekliyor,
 * kategorilerin ne kadarı onaylı ve şartnameli. Koordinasyonun bu sayfada
 * sorduğu soru "sistem nasıl çalışıyor" değil — "sezona hazır mıyım".
 *
 * ── HAZIRLIK ÇUBUKLARI NİYE İKİ TANE ────────────────────────────────────
 * Ölçüt onayı ve şartname birbirinden bağımsız iki eksik: ölçütü onaylı
 * ama şartnamesi olmayan bir kategori değerlendirme yapabiliyor, tersi de
 * olabiliyor. Tek çubukta birleştirmek hangisinin eksik olduğunu
 * gizlerdi.
 */
export default function YarismalarSayfasi() {
  const liste = birlesikListe((id) => raporlariListele(id).length);
  const katalog = katalogOku();

  const hazir = liste.filter((y) => y.durum === 'hazir').length;
  const onayBekleyen = liste.filter((y) => y.durum === 'inceleme_bekliyor').length;
  const kurulmayan = liste.filter((y) => y.durum === 'kurulabilir').length;
  const kurulu = hazir + onayBekleyen;

  const kurulular = liste.filter((y) => y.durum !== 'kurulabilir');
  const toplamKategori = kurulular.reduce((t, y) => t + y.kategoriSayisi, 0);
  const onayliKategori = kurulular.reduce((t, y) => t + y.onayliKategori, 0);
  const sartnameliKategori = kurulular.reduce((t, y) => t + y.sartnameliKategori, 0);
  const toplamRapor = liste.reduce((t, y) => t + y.raporSayisi, 0);

  const cekim = katalog?.cekildi
    ? new Date(katalog.cekildi).toLocaleDateString('tr-TR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      })
    : null;

  const olcutler: Array<{ n: number; ad: string; vurgu?: string; yol?: string }> = [
    { n: hazir, ad: 'HAZIR', vurgu: 'text-yesil-koyu' },
    {
      n: onayBekleyen, ad: 'ONAY BEKLİYOR',
      vurgu: onayBekleyen > 0 ? 'text-amber-koyu' : undefined,
    },
    { n: kurulmayan, ad: 'KURULMADI' },
    { n: toplamRapor, ad: 'TESLİM EDİLEN RAPOR', yol: '/koordinasyon/raporlar' },
  ];

  return (
    <>
      <header className="mb-5">
        <h1 className="text-[22px] leading-tight font-extrabold tracking-tight">
          Yarışmalar
        </h1>
        <p className="mt-1.5 text-[12.5px] font-medium text-metin-2">
          TEKNOFEST kataloğundan {liste.length} yarışma
          {cekim && ` · liste ${cekim} tarihinde çekildi`}
        </p>
      </header>

      {!katalog ? (
        <div className="kart px-5 py-8">
          <p className="mb-3 text-[12.5px] leading-relaxed font-medium text-metin-2">
            Yarışma listesi henüz teknofest.org&apos;dan çekilmemiş. Aşağıdaki
            komut listeyi indirir; sonra bu ekrandan tek tıkla kurulur.
          </p>
          <code className="block rounded-lg bg-lacivert px-4 py-3 text-[12px] font-semibold text-white">
            npm run katalog
          </code>
        </div>
      ) : (
        <>
          {/* ---------------------------------------------------- ölçütler */}
          <div className="mb-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
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

          {/* ------------------------------------------- kurulum hazırlığı */}
          {kurulu > 0 && (
            <div className="mb-4 grid gap-5 rounded-xl border border-cizgi bg-white px-5 py-4 sm:grid-cols-2">
              <Hazirlik
                ad="Ölçütleri onaylı kategori"
                olan={onayliKategori}
                toplam={toplamKategori}
                aciklama="Ölçütler şablondan otomatik çıkarıldı. Onaylanmamış kategoride de puanlama yapılabiliyor ama çıkarımın doğruluğu garanti değil."
              />
              <Hazirlik
                ad="Şartnamesi yüklü kategori"
                olan={sartnameliKategori}
                toplam={toplamKategori}
                aciklama="Şartname eleyici kuralları, teknik beklentileri ve teslim takvimini taşıyor. Son teslim tarihleri buradan okunuyor."
              />
            </div>
          )}

          <div className="mb-4">
            <OzetToplu />
          </div>

          {/* İnce satır modeli: liste yalnızca ad, durum ve sayaç
              gösteriyor. Tam nesneler istemciye inmiyor. */}
          <YarismaListesi liste={satirlaraCevir(liste)} durumMetni={DURUM_METNI} />
        </>
      )}
    </>
  );
}
