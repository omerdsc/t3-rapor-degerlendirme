import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import YarismaKatalogu, {
  type KatalogYarismasi,
} from '@/components/yarisma-katalogu';
import YarismaciBasligi from '@/components/yarismaci-basligi';
import { teslimPenceresi } from '@/lib/analiz/teslim-penceresi';
import { yarismacininBasvurulari } from '@/lib/db/basvuru-depo';
import { yarismacininTakimlari } from '@/lib/db/yarismaci-depo';
import { yarismalariListele } from '@/lib/depo/depo';
import { oturumSahibi } from '@/lib/yetki/yarismaci';

export const dynamic = 'force-dynamic';

/**
 * Yarışma kataloğu — yarışmacının başvuracağı yeri bulduğu ekran.
 *
 * ── NİYE VAR ────────────────────────────────────────────────────────────
 * Başvuru, panonun dibindeki bir düğmenin arkasındaki 43 satırlık bir
 * açılır listeydi. Yarışmacı ne başvurunun nereden yapıldığını
 * bulabiliyordu ne de hangi yarışmaya başvurduğunu adından başka bir
 * şeyle görebiliyordu — kategori, aşama ve son teslim tarihi seçim
 * anında görünmüyordu.
 *
 * ── BİR TAKIM BİRDEN ÇOK YARIŞMAYA BAŞVURABİLİR ─────────────────────────
 * Kısıt yalnızca AYNI KATEGORİYE ikinci kez başvurmak. Katalog bunu
 * görünür kılıyor: başvurulmuş kategori "… ile başvuruldu" olarak
 * işaretli ve başvuruya bağlantı veriyor, geri kalan her kategori açık.
 */
export default async function YarismaciYarismalarSayfasi() {
  const istek = new Request('http://y', { headers: await headers() });
  const yarismaci = oturumSahibi(istek);
  if (!yarismaci) redirect('/yarismaci/giris');

  const takimlar = yarismacininTakimlari(yarismaci.id);
  const kaptanTakimlari = takimlar
    .filter((t) => t.rol === 'kaptan')
    .map((t) => ({ id: t.id, ad: t.ad }));

  /*
   * Yarışmacının takımlarının başvurduğu kategoriler TEK sorguda
   * toplanıyor. Katalog satırı başına ayrı sorgu atmak, 43 yarışma ve
   * yüzlerce kategoride yüzlerce sorgu demekti.
   */
  const basvurulmus = new Map<string, { takim: string; basvuruId: string }>();
  for (const b of yarismacininBasvurulari(yarismaci.id)) {
    basvurulmus.set(b.kategoriId, { takim: b.takim, basvuruId: b.id });
  }

  const bugun = new Date();
  const yarismalar: KatalogYarismasi[] = yarismalariListele()
    .filter((y) => y.kategoriler.length > 0)
    .map((y) => ({
      id: y.id,
      ad: y.ad,
      yil: y.yil,
      kategoriler: y.kategoriler.map((k) => {
        const p = teslimPenceresi(k.sartname?.kurallar.tarihler, k.asama, bugun);
        const b = basvurulmus.get(k.id);
        return {
          id: k.id,
          ad: k.ad,
          asama: k.asama,
          acik: p.acik,
          teslim: p.teslim,
          kalanGun: p.kalanGun,
          basvuranTakim: b?.takim,
          basvuruId: b?.basvuruId,
        };
      }),
    }))
    /*
     * Süresi dolmuş kategoriler LİSTEDE kalıyor ama tamamı kapalı olan
     * yarışma listeden çıkıyor. Ayrım şu: kapalı bir kategoriyi görmek
     * bilgi ("bu aşamayı kaçırdım"), tamamen kapalı bir yarışmayı
     * görmek gürültü. Zaten başvurmuş olduğu yarışma her hâlde kalıyor —
     * kendi başvurusunu katalogda bulamamak kafa karıştırırdı.
     */
    .filter((y) => y.kategoriler.some((k) => k.acik || k.basvuruId))
    .sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));

  return (
    <div className="min-h-dvh bg-zemin">
      <YarismaciBasligi adSoyad={yarismaci.adSoyad} />

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <h1 className="text-[21px] leading-tight font-extrabold tracking-tight">
          Yarışmalar
        </h1>
        <p className="mt-1.5 mb-5 max-w-2xl text-[12.5px] leading-relaxed font-medium text-metin-2">
          Takımınızla katılmak istediğiniz yarışmayı seçin. Bir takım birden
          çok yarışmaya başvurabilir; aynı kategoriye ikinci kez
          başvurulamaz.
        </p>

        {kaptanTakimlari.length === 0 && (
          <p className="mb-5 rounded-xl border border-amber/25 bg-amber-zemin px-4 py-3 text-[12px] leading-relaxed font-semibold text-amber-koyu">
            Yarışma başvurusunu takım kaptanı yapar.{' '}
            {takimlar.length === 0
              ? 'Başvurabilmek için önce panodan takımınızı kurun.'
              : 'Üyesi olduğunuz takımlarda başvuruyu kaptanınız yapacak.'}
          </p>
        )}

        <YarismaKatalogu yarismalar={yarismalar} takimlar={kaptanTakimlari} />
      </main>
    </div>
  );
}
