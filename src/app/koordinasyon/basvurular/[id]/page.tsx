import Link from 'next/link';
import { notFound } from 'next/navigation';
import BasvuruYazismasi from '@/components/basvuru-yazismasi';
import { tarihYaz } from '@/lib/analiz/takvim';
import { teslimPenceresi } from '@/lib/analiz/teslim-penceresi';
import { basvuruGetir } from '@/lib/db/basvuru-depo';
import { ASAMA_ETIKETI, basvuruAsamasi } from '@/lib/db/basvuru-durum';
import { basvurununMesajlari, okunduIsaretle } from '@/lib/db/basvuru-mesaji';
import { takimGetir, takimUyeleri } from '@/lib/db/yarismaci-depo';
import { kategoriEtiketi } from '@/lib/gorunum/kategori-etiketi';
import { kategoriGetir, yarismaGetir } from '@/lib/depo/depo';

export const dynamic = 'force-dynamic';

/**
 * Tek bir başvurunun koordinasyon görünümü.
 *
 * Buraya panodaki "cevap bekleyen soru" bildiriminden geliniyor. Yazışma
 * ekranın merkezinde ama tek başına yeterli değil: koordinasyonun cevap
 * yazabilmesi için başvurunun hangi aşamada olduğunu ve teslim durumunu
 * görmesi gerekiyor — yoksa yarışmacının sorusunu bağlamsız okur.
 */
export default async function KoordinasyonBasvuruSayfasi({
  params,
}: PageProps<'/koordinasyon/basvurular/[id]'>) {
  const { id } = await params;
  const basvuru = basvuruGetir(id);
  if (!basvuru) notFound();

  const yarisma = yarismaGetir(basvuru.yarismaId);
  const kategori = kategoriGetir(basvuru.yarismaId, basvuru.kategoriId);
  /*
   * Kategori metni tek yerden. Boş dönerse satır hiç çizilmiyor:
   * kategori adı yarışma adının aynısıysa ayrı bir satır olarak
   * yazılması aynı cümleyi iki kez göstermek olurdu.
   */
  const kategoriMetni = kategori
    ? (() => {
        const m = kategoriEtiketi(kategori.ad, kategori.asama, yarisma?.ad);
        return m === yarisma?.ad ? '' : m;
      })()
    : '';
  const durum = basvuruAsamasi(basvuru.id);
  const pencere = teslimPenceresi(kategori?.sartname?.kurallar.tarihler, kategori?.asama);

  const takim = basvuru.takimKaydiId ? takimGetir(basvuru.takimKaydiId) : null;
  const uyeler = takim ? takimUyeleri(takim.id) : [];

  // Sayfayı açmak yarışmacının sorularını okumak demek.
  okunduIsaretle(basvuru.id, 'koordinasyon');
  const mesajlar = basvurununMesajlari(basvuru.id);

  return (
    <>
      <Link
        href="/koordinasyon/basvurular"
        className="mb-4 inline-block text-[12px] font-bold text-metin-2 hover:text-metin"
      >
        ← Başvurulara dön
      </Link>

      <div className="rounded-xl border border-cizgi bg-white px-5 py-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-[19px] leading-tight font-extrabold tracking-tight">
            {basvuru.proje || basvuru.takim}
          </h1>
          <span className="rounded bg-zemin px-2 py-0.5 font-mono text-[11px] font-bold text-metin-2">
            {basvuru.basvuruNo}
          </span>
          <span className="ml-auto rounded bg-zemin px-2.5 py-1 text-[11px] font-bold">
            {ASAMA_ETIKETI[durum.asama]}
          </span>
        </div>

        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[12px] font-medium">
          <dt className="text-metin-2">Takım</dt>
          <dd className="font-semibold">{basvuru.takim}</dd>
          <dt className="text-metin-2">Yarışma</dt>
          <dd className="font-semibold">{yarisma?.ad ?? '—'}</dd>
          {/* Kategori adı yarışmayla aynıysa satır tekrarlanmıyor. */}
          {kategoriMetni && (
            <>
              <dt className="text-metin-2">Kategori</dt>
              <dd className="font-semibold">{kategoriMetni}</dd>
            </>
          )}
          <dt className="text-metin-2">Erişim kodu</dt>
          <dd className="font-mono font-bold">{basvuru.kod}</dd>
          {pencere.teslim && (
            <>
              <dt className="text-metin-2">Son teslim</dt>
              <dd className="font-semibold">
                {tarihYaz(pencere.teslim)}
                {!pencere.acik && <span className="ml-1.5 text-kirmizi">· süre doldu</span>}
              </dd>
            </>
          )}
          {durum.raporId && (
            <>
              <dt className="text-metin-2">Rapor</dt>
              <dd className="font-semibold">
                <Link
                  href={`/koordinasyon/rapor/${durum.raporId}`}
                  className="text-kirmizi hover:underline"
                >
                  {durum.raporAdi}
                </Link>
                {durum.yuklendi
                  && ` · ${new Date(durum.yuklendi).toLocaleString('tr')}`}
              </dd>
            </>
          )}
        </dl>
      </div>

      {/* ---- takım üyeleri (hesapla açılmış başvurularda) */}
      {takim && uyeler.length > 0 && (
        <div className="mt-4 rounded-xl border border-cizgi bg-white px-5 py-4">
          <h2 className="mb-2.5 text-[13px] font-extrabold tracking-tight">
            Takım üyeleri
          </h2>
          <ul className="flex flex-col gap-1.5">
            {uyeler.map((u) => (
              <li key={u.id} className="flex flex-wrap items-baseline gap-x-2.5 text-[12px]">
                <span className="font-bold">{u.adSoyad}</span>
                {u.rol === 'kaptan' && (
                  <span className="rounded bg-kirmizi-zemin px-1.5 py-0.5 text-[9.5px] font-bold text-kirmizi-koyu">
                    KAPTAN
                  </span>
                )}
                <span className="font-medium text-metin-2">{u.eposta}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4">
        <BasvuruYazismasi
          basvuruId={basvuru.id}
          mesajlar={mesajlar}
          benimRolum="koordinasyon"
        />
      </div>
    </>
  );
}
