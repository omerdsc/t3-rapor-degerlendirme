import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import YarismaciBasligi from '@/components/yarismaci-basligi';
import YarismaciGirisFormu from '@/components/yarismaci-giris-formu';
import { oturumSahibi } from '@/lib/yetki/yarismaci';

export const dynamic = 'force-dynamic';

export default async function YarismaciGirisSayfasi({
  searchParams,
}: PageProps<'/yarismaci/giris'>) {
  const istek = new Request('http://y', { headers: await headers() });
  if (oturumSahibi(istek)) redirect('/yarismaci');

  const p = await searchParams;
  const ilkSekme = p.sekme === 'kayit' ? 'kayit' : 'giris';

  return (
    <div className="min-h-dvh bg-zemin">
      <YarismaciBasligi />

      <main className="mx-auto max-w-md px-6 py-10">
        <h1 className="mb-1.5 text-[21px] leading-tight font-extrabold tracking-tight">
          Yarışmacı Portalı
        </h1>
        <p className="mb-6 text-[12.5px] leading-relaxed font-medium text-metin-2">
          Takımınızı kurun, yarışmaya başvurun, proje raporunuzu yükleyin ve
          değerlendirme sürecini adım adım izleyin.
        </p>

        <YarismaciGirisFormu ilkSekme={ilkSekme} />
      </main>
    </div>
  );
}
