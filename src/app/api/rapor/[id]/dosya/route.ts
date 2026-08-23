/** Hakem panelinde raporu gömülü göstermek için PDF'i sunar. */

import { dosyaOku, raporGetir } from '@/lib/depo/depo';

export async function GET(_request: Request, ctx: RouteContext<'/api/rapor/[id]/dosya'>) {
  const { id } = await ctx.params;
  if (!raporGetir(id)) return new Response('Bulunamadı', { status: 404 });

  const bayt = dosyaOku(id);
  if (!bayt) return new Response('Dosya yok', { status: 404 });

  return new Response(new Uint8Array(bayt), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${id}.pdf"`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
