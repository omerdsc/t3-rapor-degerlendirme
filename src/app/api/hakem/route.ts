/**
 * Hakem kaydı.
 *
 * POST   · hakem ekle (erişim kodu otomatik üretilir)
 * PATCH  · hakem güncelle / pasife al
 * DELETE · hakem sil — değerlendirmesi varsa pasife alınır
 * GET    · hakem listesi ve iş yükleri
 */

import { kapi } from '@/lib/yetki/koordinasyon';
import {
  hakemEkle, hakemGuncelle, hakemleriListele, hakemSil, hakemYukleri,
} from '@/lib/db/hakem-depo';
import { onar } from '@/lib/analiz/normalize';

/** Form metni bozuk kodlamayla gelebilir; Türkçe adlar bozulmasın. */
function metin(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = onar(v).trim();
  return t || undefined;
}

export async function GET(istek: Request) {
  const yetkisiz = kapi(istek);
  if (yetkisiz) return yetkisiz;

  return Response.json({ yukler: hakemYukleri(), hakemler: hakemleriListele() });
}

export async function POST(istek: Request) {
  const yetkisiz = kapi(istek);
  if (yetkisiz) return yetkisiz;

  let g: { ad?: string; eposta?: string; kurum?: string; uzmanlik?: string[]; notlar?: string };
  try {
    g = await istek.json();
  } catch {
    return Response.json({ hata: 'İstek okunamadı.' }, { status: 400 });
  }

  const ad = metin(g.ad);
  if (!ad || ad.length < 3) {
    return Response.json({ hata: 'Hakem adı en az 3 karakter olmalı.' }, { status: 400 });
  }

  const hakem = hakemEkle({
    ad,
    eposta: metin(g.eposta),
    kurum: metin(g.kurum),
    uzmanlik: (g.uzmanlik ?? []).map((u) => onar(u).trim()).filter(Boolean),
    notlar: metin(g.notlar),
  });

  return Response.json({ hakem }, { status: 201 });
}

export async function PATCH(istek: Request) {
  const yetkisiz = kapi(istek);
  if (yetkisiz) return yetkisiz;

  let g: {
    id?: string; ad?: string; eposta?: string; kurum?: string;
    uzmanlik?: string[]; aktif?: boolean; notlar?: string;
  };
  try {
    g = await istek.json();
  } catch {
    return Response.json({ hata: 'İstek okunamadı.' }, { status: 400 });
  }
  if (!g.id) return Response.json({ hata: 'Hakem seçilmedi.' }, { status: 400 });

  const hakem = hakemGuncelle(g.id, {
    ...(g.ad !== undefined ? { ad: metin(g.ad) ?? '' } : {}),
    ...(g.eposta !== undefined ? { eposta: metin(g.eposta) } : {}),
    ...(g.kurum !== undefined ? { kurum: metin(g.kurum) } : {}),
    ...(g.uzmanlik !== undefined ? { uzmanlik: g.uzmanlik } : {}),
    ...(g.aktif !== undefined ? { aktif: g.aktif } : {}),
    ...(g.notlar !== undefined ? { notlar: metin(g.notlar) } : {}),
  });
  if (!hakem) return Response.json({ hata: 'Hakem bulunamadı.' }, { status: 404 });
  return Response.json({ hakem });
}

export async function DELETE(istek: Request) {
  const yetkisiz = kapi(istek);
  if (yetkisiz) return yetkisiz;

  let g: { id?: string };
  try {
    g = await istek.json();
  } catch {
    return Response.json({ hata: 'İstek okunamadı.' }, { status: 400 });
  }
  if (!g.id) return Response.json({ hata: 'Hakem seçilmedi.' }, { status: 400 });

  const sonuc = hakemSil(g.id);
  return Response.json(sonuc);
}
