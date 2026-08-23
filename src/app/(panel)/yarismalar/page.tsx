import OzetToplu from '@/components/ozet-toplu';
import YarismaListesi from '@/components/yarisma-listesi';
import { birlesikListe, DURUM_METNI, satirlaraCevir } from '@/lib/katalog/birlesik';
import { katalogOku } from '@/lib/katalog/depo';
import { raporlariListele } from '@/lib/depo/depo';

export const dynamic = 'force-dynamic';

/**
 * Yarışmalar — tek liste.
 *
 * Eskiden iki ekran vardı ("TEKNOFEST Kataloğu" ve "Yarışma Yönetimi") ve
 * aradaki fark verinin nereden geldiğiydi: kullanıcının değil sistemin
 * meselesi. Artık tek liste ve her satırda tek durum, tek eylem var.
 */
export default function YarismalarSayfasi() {
  const liste = birlesikListe((id) => raporlariListele(id).length);
  const katalog = katalogOku();

  const hazir = liste.filter((y) => y.durum === 'hazir').length;
  const onayBekleyen = liste.filter((y) => y.durum === 'inceleme_bekliyor').length;
  const cekim = katalog?.cekildi
    ? new Date(katalog.cekildi).toLocaleDateString('tr-TR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      })
    : null;

  return (
    <>
      <header className="mb-4">
        <h1 className="text-[22px] font-extrabold tracking-tight">Yarışmalar</h1>
        <p className="mt-1.5 text-[12.5px] font-medium text-metin-2">
          {liste.length} TEKNOFEST yarışması · {hazir} hazır
          {onayBekleyen > 0 && ` · ${onayBekleyen} onay bekliyor`}
          {cekim && ` · liste ${cekim} tarihinde çekildi`}
        </p>
      </header>

      {!katalog ? (
        <div className="rounded-xl border border-cizgi bg-white px-5 py-8">
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
          {/* Kısa ve eylem odaklı: uzun açıklama bloğu yerine üç cümle. */}
          <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-cizgi bg-white px-4 py-3">
            <p className="text-[11.5px] leading-relaxed font-medium text-metin-2">
              <strong className="font-bold text-metin">Kurmak ücretsizdir.</strong>{' '}
              Şablon ve şartname indirilip çözümlenir, değerlendirme ölçütleri
              çıkarılır. Çıkarım bir taslaktır — açıp onaylamanız gerekir.
            </p>
            <p className="ml-auto shrink-0 text-[11px] font-medium text-metin-3">
              Şablonlar değişirse yarışmayı açıp &ldquo;yenile&rdquo; deyin
            </p>
          </div>

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
