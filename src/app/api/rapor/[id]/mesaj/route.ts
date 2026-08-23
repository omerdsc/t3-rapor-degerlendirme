/**
 * Rapor üzerindeki yazışma.
 *
 * Hakem ve koordinasyon arasındaki her not değerlendirme metnine yazılamaz;
 * kimi şey rapora girmemesi gereken bir soru, hatırlatma veya karardır.
 * Bu iz kaydı yarışmacıya GÖSTERİLMEZ.
 */

import { mesajEkle, raporGetir } from '@/lib/depo/depo';
import { onar } from '@/lib/analiz/normalize';
import type { Mesaj } from '@/lib/depo/tipler';

const ROLLER: Mesaj['rol'][] = ['hakem', 'koordinasyon', 'yarisma_yoneticisi'];

export async function GET(_request: Request, ctx: RouteContext<'/api/rapor/[id]/mesaj'>) {
  const { id } = await ctx.params;
  const rapor = raporGetir(id);
  if (!rapor) return Response.json({ hata: 'Rapor bulunamadı.' }, { status: 404 });
  return Response.json({ mesajlar: rapor.mesajlar ?? [] });
}

export async function POST(request: Request, ctx: RouteContext<'/api/rapor/[id]/mesaj'>) {
  const { id } = await ctx.params;
  if (!raporGetir(id)) return Response.json({ hata: 'Rapor bulunamadı.' }, { status: 404 });

  let g: { metin?: string; yazar?: string; rol?: string };
  try {
    g = await request.json();
  } catch {
    return Response.json({ hata: 'Geçersiz istek gövdesi.' }, { status: 400 });
  }

  const metin = onar(g.metin ?? '').trim();
  if (metin.length < 2) {
    return Response.json({ hata: 'Mesaj boş olamaz.' }, { status: 422 });
  }

  const rol = (ROLLER as string[]).includes(g.rol ?? '') ? (g.rol as Mesaj['rol']) : 'hakem';

  const rapor = await mesajEkle(id, {
    metin: metin.slice(0, 4000),
    yazar: onar(g.yazar ?? '').trim().slice(0, 80) || 'Bilinmeyen',
    rol,
  });

  return Response.json({ mesajlar: rapor?.mesajlar ?? [] }, { status: 201 });
}
