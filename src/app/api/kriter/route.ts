/**
 * Yöneticinin elle tanımladığı kriterler.
 *
 * Şablonlar her zaman eksiksiz olmuyor; koordinasyon sonradan bir ölçüt
 * getirebiliyor ("etik beyan var mı", "video bağlantısı çalışıyor mu").
 * Rubrik bu yüzden kapalı bir liste değil.
 *
 * POST   · kriter ekle
 * DELETE · kriter kaldır
 * PATCH  · kategoriyi onayla / onayı geri al
 */

import { kapi } from '@/lib/yetki/koordinasyon';
import { kategoriOnayla, kriterEkle, kriterSil } from '@/lib/depo/depo';
import { onar, anahtar } from '@/lib/analiz/normalize';

interface Govde {
  yarismaId?: string;
  kategoriId?: string;
  onayli?: boolean;
  ad?: string;
  puan?: number;
  olcut?: string[];
  kod?: string;
}

export async function POST(request: Request) {
  const yetkisiz = kapi(request);
  if (yetkisiz) return yetkisiz;

  let g: Govde;
  try {
    g = await request.json();
  } catch {
    return Response.json({ hata: 'Geçersiz istek gövdesi.' }, { status: 400 });
  }

  const { yarismaId, kategoriId } = g;
  if (!yarismaId || !kategoriId) {
    return Response.json({ hata: 'Yarışma ve kategori gerekli.' }, { status: 400 });
  }

  const ad = onar(g.ad ?? '').trim();
  const puan = Number(g.puan);

  if (ad.length < 3) {
    return Response.json({ hata: 'Kriter adı en az 3 karakter olmalı.' }, { status: 422 });
  }
  if (!Number.isFinite(puan) || puan <= 0 || puan > 100) {
    return Response.json({ hata: 'Puan 1–100 arasında olmalı.' }, { status: 422 });
  }

  // Ölçüt cümleleri AI'a "bu kriterde neye bakılacak" olarak gider.
  const olcut = (g.olcut ?? [])
    .map((o) => onar(o).trim())
    .filter((o) => o.length > 10)
    .slice(0, 8);

  const kategori = await kriterEkle(yarismaId, kategoriId, {
    kod: anahtar(ad).replace(/\s+/g, '-').slice(0, 40) || `kriter-${Date.now()}`,
    ad,
    puan,
    bolumBekleniyor: false,
    olcut,
    bolumAdi: ad,
  });

  if (!kategori) return Response.json({ hata: 'Kategori bulunamadı.' }, { status: 404 });
  return Response.json({ kategori }, { status: 201 });
}

export async function DELETE(request: Request) {
  const yetkisiz = kapi(request);
  if (yetkisiz) return yetkisiz;

  let g: Govde;
  try {
    g = await request.json();
  } catch {
    return Response.json({ hata: 'Geçersiz istek gövdesi.' }, { status: 400 });
  }
  if (!g.yarismaId || !g.kategoriId || !g.kod) {
    return Response.json({ hata: 'Yarışma, kategori ve kriter kodu gerekli.' }, { status: 400 });
  }

  const kategori = await kriterSil(g.yarismaId, g.kategoriId, g.kod);
  if (!kategori) return Response.json({ hata: 'Kategori bulunamadı.' }, { status: 404 });
  return Response.json({ kategori });
}

/**
 * Kategoriyi onaylar. Rubriği değiştirmez.
 *
 * Onay yalnızca "bu taslağı gözden geçirdim" beyanıdır; puanlama davranışını
 * etkilemez ama arayüzde onaysız kategoriler ayırt edilebilir kalır —
 * değerlendirme öncesi hangi kategorilerin incelenmediği görülebilsin.
 */
export async function PATCH(request: Request) {
  const yetkisiz = kapi(request);
  if (yetkisiz) return yetkisiz;

  let g: Govde;
  try {
    g = await request.json();
  } catch {
    return Response.json({ hata: 'Geçersiz istek gövdesi.' }, { status: 400 });
  }
  if (!g.yarismaId || !g.kategoriId) {
    return Response.json({ hata: 'Yarışma ve kategori gerekli.' }, { status: 400 });
  }

  const kategori = await kategoriOnayla(g.yarismaId, g.kategoriId, g.onayli !== false);
  if (!kategori) return Response.json({ hata: 'Kategori bulunamadı.' }, { status: 404 });
  return Response.json({ kategori });
}
