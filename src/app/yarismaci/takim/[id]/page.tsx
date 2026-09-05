import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import TakimYonetimi from '@/components/takim-yonetimi';
import YarismaciBasligi from '@/components/yarismaci-basligi';
import { takimGetir, takimUyeleri } from '@/lib/db/yarismaci-depo';
import { oturumSahibi } from '@/lib/yetki/yarismaci';

export const dynamic = 'force-dynamic';

export default async function TakimSayfasi({ params }: PageProps<'/yarismaci/takim/[id]'>) {
  const istek = new Request('http://y', { headers: await headers() });
  const yarismaci = oturumSahibi(istek);
  if (!yarismaci) redirect('/yarismaci/giris');

  const { id } = await params;
  const takim = takimGetir(id);
  if (!takim) notFound();

  const uyeler = takimUyeleri(takim.id);
  /*
   * ÜYE OLMAYAN İÇİN 404, 403 DEĞİL.
   * "Bu takıma erişemezsiniz" demek, o kimlikte bir takım olduğunu
   * doğrulardı; kimlik deneyerek takım varlığı öğrenilebilirdi.
   */
  if (!uyeler.some((u) => u.yarismaciId === yarismaci.id)) notFound();

  const kaptanMi = takim.kaptanId === yarismaci.id;

  return (
    <div className="min-h-dvh bg-zemin">
      <YarismaciBasligi adSoyad={yarismaci.adSoyad} />

      <main className="mx-auto max-w-3xl px-6 py-8">
        <Link
          href="/yarismaci"
          className="mb-4 inline-block text-[12px] font-bold text-metin-2 hover:text-metin"
        >
          ← Panoya dön
        </Link>

        <TakimYonetimi
          takim={takim}
          uyeler={uyeler}
          kaptanMi={kaptanMi}
          benimId={yarismaci.id}
        />
      </main>
    </div>
  );
}
