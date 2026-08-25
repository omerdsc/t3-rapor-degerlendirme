import Link from 'next/link';
import PortalDonus from '@/components/portal-donus';
import { notFound } from 'next/navigation';
import { hakeminIsleri, hakemKodIle } from '@/lib/db/hakem-depo';

export const dynamic = 'force-dynamic';

/**
 * Hakem paneli — `/hakem/<kod>`.
 *
 * ── PANEL AYRI, ÇÜNKÜ ERİŞİM AYRI ───────────────────────────────────────
 * Hakem koordinasyon panosunu görmüyor: ne öteki yarışmaları, ne öteki
 * hakemlerin işlerini, ne kendisine atanmamış raporları. Rol ayrımı
 * menüyle değil VERİYLE yapılıyor — bu sayfa yalnızca `hakeminIsleri()`
 * çağırıyor ve o sorgu atama tablosuna bağlı.
 *
 * ── KOD NEDEN YETERLİ (ŞİMDİLİK) ────────────────────────────────────────
 * Kimlik doğrulama sistemi yok. Kod hem kimlik hem yetki: bağlantıyı bilen
 * o hakem adına iş görür. Sınırı açıkça yazılı ve tek bir yerde toplandığı
 * için kurum kimlik sistemine bağlanması kolay. Bir creathon MVP'sinde
 * oturum altyapısı kurmak yerine, rol ayrımının VERİ tarafını doğru
 * kurmayı seçtik — asıl mesele orası.
 */
export default async function HakemPaneli({ params }: PageProps<'/hakem/[kod]'>) {
  const { kod } = await params;
  const hakem = hakemKodIle(kod);
  if (!hakem) notFound();

  const isler = hakeminIsleri(hakem.id);
  const bekleyen = isler.filter((i) => i.durum !== 'tamamlandi');
  const bitmis = isler.filter((i) => i.durum === 'tamamlandi');

  return (
    <div className="min-h-dvh bg-zemin">
      <header className="bg-lacivert px-6 py-5">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
          <span className="flex size-[34px] items-center justify-center rounded-lg bg-kirmizi">
            <svg viewBox="0 0 24 24" className="size-[19px] stroke-white" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-[17px] font-extrabold tracking-tight text-white">
              {hakem.ad}
            </h1>
            <p className="mt-0.5 text-[11.5px] font-medium text-metin-2">
              Hakem paneli
              {hakem.kurum && ` · ${hakem.kurum}`}
              {' · '}
              {bekleyen.length} bekleyen, {bitmis.length} tamamlanan
            </p>
          </div>
          {!hakem.aktif && (
            <span className="rounded-lg bg-amber-zemin px-3 py-1.5 text-[11px] font-bold text-amber-koyu">
              HESABINIZ PASİF
            </span>
          )}
          <PortalDonus />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-6">
        <div className="mb-5 rounded-xl border border-mavi/25 bg-mavi-zemin px-4 py-3">
          <p className="text-[11.5px] leading-relaxed font-medium text-mavi-koyu">
            <strong className="font-bold">Puanı siz veriyorsunuz.</strong>{' '}
            Sistem raporu önceden inceleyip bulguları ve bir puan önerisi
            sunuyor; öneriyi kabul etmek zorunda değilsiniz. Takım adları
            rumuzlanmıştır — değerlendirme kör yapılır. Tamamladığınız bir
            değerlendirme değiştirilemez.
          </p>
        </div>

        {!isler.length ? (
          <p className="rounded-xl border border-dashed border-metin-3/40 bg-white px-5 py-12 text-center text-[12.5px] font-medium text-metin-2">
            Size henüz rapor atanmadı. Koordinasyon atama yaptığında burada
            görünecek.
          </p>
        ) : (
          <>
            {!!bekleyen.length && (
              <section className="mb-6">
                <h2 className="mb-2.5 text-[15px] font-bold">
                  Değerlendirmeniz bekleniyor ({bekleyen.length})
                </h2>
                <div className="flex flex-col gap-2">
                  {bekleyen.map((i) => (
                    <IsSatiri key={i.raporId} is={i} kod={kod} />
                  ))}
                </div>
              </section>
            )}

            {!!bitmis.length && (
              <section>
                <h2 className="mb-2.5 text-[15px] font-bold">
                  Tamamladığınız ({bitmis.length})
                </h2>
                <div className="flex flex-col gap-2">
                  {bitmis.map((i) => (
                    <IsSatiri key={i.raporId} is={i} kod={kod} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function IsSatiri({
  is,
  kod,
}: {
  is: Awaited<ReturnType<typeof hakeminIsleri>>[number];
  kod: string;
}) {
  const bitti = is.durum === 'tamamlandi';
  const gecikti =
    !bitti && is.sonTarih ? new Date(is.sonTarih) < new Date() : false;

  return (
    <Link
      href={`/hakem/${kod}/${is.raporId}`}
      className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border bg-white px-4 py-3 transition-colors hover:bg-zemin/60 ${
        gecikti ? 'border-kirmizi/40' : 'border-cizgi'
      }`}
    >
      <span
        className={`size-2 shrink-0 rounded-full ${
          bitti ? 'bg-yesil' : gecikti ? 'bg-kirmizi' : 'bg-amber'
        }`}
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-bold">{is.basvuruNo}</span>
          <span className="text-[11px] font-medium text-metin-2">
            {is.takimRumuzu}
          </span>
          {is.kritikBulgu && (
            <span className="rounded bg-kirmizi-zemin px-1.5 py-0.5 text-[9px] font-bold text-kirmizi-koyu">
              KRİTİK BULGU
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-[11.5px] font-medium text-metin-2">
          {is.proje} · {is.yarismaAdi}
          {is.kategoriAdi !== is.yarismaAdi && ` · ${is.kategoriAdi}`}
        </p>
      </div>

      {is.sonTarih && (
        <span
          className={`shrink-0 text-[11px] font-bold ${
            gecikti ? 'text-kirmizi-koyu' : 'text-metin-2'
          }`}
        >
          {gecikti ? 'gecikti · ' : 'son '}
          {new Date(is.sonTarih).toLocaleDateString('tr')}
        </span>
      )}

      <span className="w-[104px] shrink-0 text-right text-[11px] font-medium text-metin-2">
        {is.ilerleme.girilen}/{is.ilerleme.toplam} ölçüt
      </span>

      <span
        className={`w-[104px] shrink-0 rounded px-2 py-0.5 text-center text-[9.5px] font-bold tracking-wide ${
          bitti
            ? 'bg-yesil-zemin text-yesil-koyu'
            : is.durum === 'taslak'
              ? 'bg-mavi-zemin text-mavi-koyu'
              : 'bg-amber-zemin text-amber-koyu'
        }`}
      >
        {bitti ? 'TAMAMLANDI' : is.durum === 'taslak' ? 'TASLAK VAR' : 'BAŞLANMADI'}
      </span>
    </Link>
  );
}
