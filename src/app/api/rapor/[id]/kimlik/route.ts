/**
 * Raporun gerçek kimlik bilgileri — İSTEK ÜZERİNE.
 *
 * NEDEN AYRI BİR UÇ VAR
 * Kimlik paneli bu bilgileri sayfa yüküyle birlikte alsaydı, gerçek takım
 * adı ve başvuru numarası panel KAPALI olsa bile sayfa kaynağında düz metin
 * olarak duracaktı. Daha önce tam bu hatayı yapıp düzeltmiştik: ekranda
 * maskelemek, veri istemciye inmişse maskeleme değildir.
 *
 * Bu yüzden panel açıldığında buradan çekiliyor. Sonuç: gerçek künye ancak
 * bilinçli bir tıklamayla ve yalnızca o an istemciye iniyor. Hakem
 * puanlarken açmak zorunda değil; koordinasyon gerektiğinde açıyor.
 */

import { raporGetir } from '@/lib/depo/depo';

export async function GET(_istek: Request, ctx: RouteContext<'/api/rapor/[id]/kimlik'>) {
  const { id } = await ctx.params;

  const rapor = raporGetir(id);
  if (!rapor) return Response.json({ hata: 'Rapor bulunamadı.' }, { status: 404 });

  return Response.json({
    basvuru: {
      basvuruNo: rapor.basvuruNo,
      takim: rapor.takim,
      takimId: rapor.takimId,
      proje: rapor.proje,
    },
    // Kapaktan okunanlar; alan bulunamadıysa undefined kalır.
    kimlik: rapor.raporKimligi ?? null,
    uyusmazlik: rapor.kimlikUyusmazligi ?? [],
  });
}
