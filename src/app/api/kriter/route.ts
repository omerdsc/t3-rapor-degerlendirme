/**
 * Yöneticinin elle tanımladığı kriterler.
 *
 * Şablonlar her zaman eksiksiz olmuyor; koordinasyon sonradan bir ölçüt
 * getirebiliyor ("etik beyan var mı", "video bağlantısı çalışıyor mu").
 * Rubrik bu yüzden kapalı bir liste değil.
 *
 * POST   · kriter ekle
 * DELETE · kriter kaldır
 * PATCH  · kategoriyi onayla · baraj puanı · rubriği 100'e ölçekle
 */

import { kapi } from '@/lib/yetki/koordinasyon';
import {
  barajPuaniAyarla, kategoriGetir, kategoriOnayla, kriterEkle, kriterSil,
  rubrigiOlcekle,
} from '@/lib/depo/depo';
import { onar, anahtar } from '@/lib/analiz/normalize';

interface Govde {
  yarismaId?: string;
  kategoriId?: string;
  onayli?: boolean;
  ad?: string;
  puan?: number;
  olcut?: string[];
  kod?: string;
  /** Baraj puanı; `null` barajı kaldırır, `undefined` dokunmaz. */
  barajPuani?: number | null;
  /** true ise rubrik 100 puana ölçeklenir. */
  olcekle?: boolean;
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

  if (g.olcekle) {
    const guncel = await rubrigiOlcekle(g.yarismaId, g.kategoriId);
    if (!guncel) return Response.json({ hata: 'Kategori bulunamadı.' }, { status: 404 });
    return Response.json({ kategori: guncel });
  }

  /*
   * BARAJ AYRI BİR İSTEK, ONAYLA BİRLİKTE DEĞİL.
   *
   * Baraj girmek rubriği onaylamak değildir. Aynı istekte ikisi de
   * yapılsaydı, eşiği yazan koordinasyon farkında olmadan çıkarım
   * taslağını da onaylamış olurdu.
   */
  if (g.barajPuani !== undefined) {
    const kategori = kategoriGetir(g.yarismaId, g.kategoriId);
    if (!kategori) return Response.json({ hata: 'Kategori bulunamadı.' }, { status: 404 });

    if (g.barajPuani !== null) {
      const p = Number(g.barajPuani);
      if (!Number.isFinite(p) || p <= 0) {
        return Response.json({ hata: 'Baraj puanı pozitif bir sayı olmalı.' }, { status: 422 });
      }
      /*
       * TOPLAMDAN BÜYÜK BARAJ KİMSENİN GEÇEMEYECEĞİ BİR EŞİKTİR.
       * Sessizce kabul edilseydi bütün kategori elenir ve sebebi
       * aylar sonra anlaşılırdı.
       */
      if (p > kategori.rubrik.toplamPuan) {
        return Response.json(
          {
            hata:
              `Baraj, kategorinin toplam puanından (${kategori.rubrik.toplamPuan}) `
              + 'büyük olamaz; kimse geçemezdi.',
          },
          { status: 422 },
        );
      }
      const guncel = await barajPuaniAyarla(g.yarismaId, g.kategoriId, p);
      return Response.json({ kategori: guncel });
    }

    const guncel = await barajPuaniAyarla(g.yarismaId, g.kategoriId, null);
    return Response.json({ kategori: guncel });
  }

  const kategori = await kategoriOnayla(g.yarismaId, g.kategoriId, g.onayli !== false);
  if (!kategori) return Response.json({ hata: 'Kategori bulunamadı.' }, { status: 404 });
  return Response.json({ kategori });
}
