/**
 * Rapor belgesini sunar — koordinasyon ve hakem panellerinde gömülü PDF.
 *
 * ── İKİ İZLEYİCİ, İKİ KAPI ──────────────────────────────────────────────
 * Bu uç, hem koordinasyonun hem hakemin ihtiyaç duyduğu tek yer. Proxy
 * perimetresine alınamaz: alınsa hakem kendisine ATANMIŞ raporu bile
 * göremezdi. O yüzden denetim burada ve iki yolu var:
 *
 *   1. Koordinasyon anahtarı (çerez ya da başlık)
 *   2. `?kod=<hakem kodu>` — kod geçerli VE rapor o hakeme atanmış
 *
 * ── NİYE ÖNEMLİ ─────────────────────────────────────────────────────────
 * Buradan inen dosyalar GERÇEK yarışmacı belgeleri: isim, okul, iletişim
 * bilgisi, proje içeriği. Denetimsiz bırakıldığında rapor kimliğini bilen
 * (ya da deneyen) herkes bunları indirebiliyordu. Ekranlarda kimlik
 * maskelemek, belgenin kendisi korunmuyorsa anlamsız kalır.
 */

import { hakemKodIle, hakeminRaporlari } from '@/lib/db/hakem-depo';
import { dosyaOku, raporGetir } from '@/lib/depo/depo';
import { istekYetkili } from '@/lib/yetki/koordinasyon';

export async function GET(istek: Request, ctx: RouteContext<'/api/rapor/[id]/dosya'>) {
  const { id } = await ctx.params;

  const kod = new URL(istek.url).searchParams.get('kod');
  let izin = istekYetkili(istek);

  if (!izin && kod) {
    const hakem = hakemKodIle(kod);
    izin = !!hakem && hakeminRaporlari(hakem.id).includes(id);
  }

  /*
   * Yetkisiz istek 403 alıyor ve raporun VAR OLUP OLMADIĞINI öğrenmiyor.
   * Sıra önemli: "rapor yok" ile "yetkiniz yok" ayrılırsa, kimlik deneyen
   * biri hangi rapor kimliklerinin gerçek olduğunu öğrenir.
   */
  if (!izin) return new Response('Yetkisiz', { status: 403 });

  if (!raporGetir(id)) return new Response('Bulunamadı', { status: 404 });

  const bayt = dosyaOku(id);
  if (!bayt) return new Response('Dosya yok', { status: 404 });

  return new Response(new Uint8Array(bayt), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${id}.pdf"`,
      // private: paylaşılan vekil sunucular önbelleğe almasın.
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
