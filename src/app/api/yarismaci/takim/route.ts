/**
 * Takım kurma, güncelleme, katılma ve üye çıkarma.
 *
 * ── YETKİ HER İŞLEMDE AYRI SORULUYOR ────────────────────────────────────
 * Oturum sahibi olmak takımı YÖNETME yetkisi vermiyor. Takım adını
 * değiştirmek ya da üye çıkarmak yalnızca kaptanın işi; üye olmak
 * yalnızca görmeye yetiyor. Bu ayrım her uçta tek tek denetleniyor —
 * "oturum var" ile "bu takımın kaptanı" iki ayrı soru.
 */

import { onar } from '@/lib/analiz/normalize';
import {
  takimGetir, takimGuncelle, takimKatilimKoduIle, takimKur, takimSil,
  takimUyeleri, takimaKatil, uyeyiCikar, yarismacininTakimlari,
} from '@/lib/db/yarismaci-depo';
import { oturumSahibi } from '@/lib/yetki/yarismaci';

/** Oturum sahibi bu takımın üyesi mi / kaptanı mı. */
function yetki(takimId: string, yarismaciId: string): 'kaptan' | 'uye' | 'yok' {
  const t = takimGetir(takimId);
  if (!t) return 'yok';
  if (t.kaptanId === yarismaciId) return 'kaptan';
  return takimUyeleri(takimId).some((u) => u.yarismaciId === yarismaciId) ? 'uye' : 'yok';
}

export async function GET(request: Request) {
  const y = oturumSahibi(request);
  if (!y) return Response.json({ hata: 'Oturum bulunamadı.' }, { status: 401 });

  const id = new URL(request.url).searchParams.get('id');
  if (!id) {
    return Response.json({ takimlar: yarismacininTakimlari(y.id) });
  }

  if (yetki(id, y.id) === 'yok') {
    // 404, 403 DEĞİL: var olan ama erişilemeyen bir takım, kimliği
    // deneyerek takım varlığını öğrenmeye izin verirdi.
    return Response.json({ hata: 'Takım bulunamadı.' }, { status: 404 });
  }
  return Response.json({ takim: takimGetir(id), uyeler: takimUyeleri(id) });
}

interface Govde {
  islem?: 'kur' | 'katil';
  ad?: string;
  kurum?: string;
  sehir?: string;
  danisman?: string;
  katilimKodu?: string;
}

export async function POST(request: Request) {
  const y = oturumSahibi(request);
  if (!y) return Response.json({ hata: 'Oturum bulunamadı.' }, { status: 401 });

  let g: Govde;
  try {
    g = (await request.json()) as Govde;
  } catch {
    return Response.json({ hata: 'İstek okunamadı.' }, { status: 400 });
  }

  // ------------------------------------------------------ TAKIMA KATIL
  if (g.islem === 'katil') {
    const kod = (g.katilimKodu ?? '').trim();
    if (!kod) return Response.json({ hata: 'Katılım kodu gerekli.' }, { status: 400 });

    const t = takimKatilimKoduIle(kod);
    if (!t) return Response.json({ hata: 'Bu katılım koduyla takım bulunamadı.' }, { status: 404 });

    const sonuc = takimaKatil(t.id, y.id);
    if (sonuc === 'zaten_uye') {
      return Response.json({ hata: 'Zaten bu takımın üyesisiniz.', takim: t }, { status: 409 });
    }
    return Response.json({ takim: t }, { status: 201 });
  }

  // ------------------------------------------------------ TAKIM KUR
  const ad = onar(g.ad ?? '').trim();
  if (ad.length < 2) return Response.json({ hata: 'Takım adı gerekli.' }, { status: 400 });
  if (ad.length > 80) return Response.json({ hata: 'Takım adı çok uzun.' }, { status: 400 });

  const t = takimKur({
    ad,
    kaptanId: y.id,
    kurum: onar(g.kurum ?? '').trim() || undefined,
    sehir: onar(g.sehir ?? '').trim() || undefined,
    danisman: onar(g.danisman ?? '').trim() || undefined,
  });
  return Response.json({ takim: t }, { status: 201 });
}

export async function PATCH(request: Request) {
  const y = oturumSahibi(request);
  if (!y) return Response.json({ hata: 'Oturum bulunamadı.' }, { status: 401 });

  let g: { id?: string } & Govde;
  try {
    g = await request.json();
  } catch {
    return Response.json({ hata: 'İstek okunamadı.' }, { status: 400 });
  }
  if (!g.id) return Response.json({ hata: 'Takım belirtilmedi.' }, { status: 400 });

  if (yetki(g.id, y.id) !== 'kaptan') {
    return Response.json(
      { hata: 'Takım bilgilerini yalnızca kaptan değiştirebilir.' },
      { status: 403 },
    );
  }

  const t = takimGuncelle(g.id, {
    ad: g.ad ? onar(g.ad).trim() : undefined,
    kurum: g.kurum !== undefined ? onar(g.kurum).trim() : undefined,
    sehir: g.sehir !== undefined ? onar(g.sehir).trim() : undefined,
    danisman: g.danisman !== undefined ? onar(g.danisman).trim() : undefined,
  });
  return Response.json({ takim: t });
}

/**
 * Üye çıkarma ya da takımdan ayrılma.
 *
 * İki işlem tek uçta çünkü ikisi de aynı satırı siliyor; ayıran şey
 * KİMİN çıkarıldığı. Kendini çıkarmak her üyenin hakkı; başkasını
 * çıkarmak yalnızca kaptanın.
 */
export async function DELETE(request: Request) {
  const y = oturumSahibi(request);
  if (!y) return Response.json({ hata: 'Oturum bulunamadı.' }, { status: 401 });

  const q = new URL(request.url).searchParams;
  const takimId = q.get('takim');
  const uyeId = q.get('uye');
  if (!takimId) return Response.json({ hata: 'Takım belirtilmedi.' }, { status: 400 });

  const rol = yetki(takimId, y.id);
  if (rol === 'yok') return Response.json({ hata: 'Takım bulunamadı.' }, { status: 404 });

  // Takımın tamamını silme
  if (!uyeId) {
    if (rol !== 'kaptan') {
      return Response.json({ hata: 'Takımı yalnızca kaptan silebilir.' }, { status: 403 });
    }
    const sonuc = takimSil(takimId);
    if (sonuc === 'basvurusu_var') {
      return Response.json(
        { hata: 'Bu takımın yarışma başvurusu var. Başvuru varken takım silinemiyor.' },
        { status: 409 },
      );
    }
    return Response.json({ silindi: true });
  }

  // Üye çıkarma
  const kendisi = uyeId === y.id;
  if (!kendisi && rol !== 'kaptan') {
    return Response.json({ hata: 'Üyeyi yalnızca kaptan çıkarabilir.' }, { status: 403 });
  }

  const sonuc = uyeyiCikar(takimId, uyeId);
  if (sonuc === 'kaptan') {
    return Response.json(
      {
        hata: kendisi
          ? 'Kaptan takımdan ayrılamaz. Takımı silebilirsiniz.'
          : 'Kaptan takımdan çıkarılamaz.',
      },
      { status: 409 },
    );
  }
  if (sonuc === 'yok') return Response.json({ hata: 'Üye bulunamadı.' }, { status: 404 });
  return Response.json({ cikarildi: true });
}
