/**
 * Profil görüntüleme, güncelleme ve parola değiştirme.
 */

import { onar } from '@/lib/analiz/normalize';
import { parolaDegistir, profilGuncelle, girisDogrula } from '@/lib/db/yarismaci-depo';
import { parolaSorunu } from '@/lib/yetki/parola';
import { cerezYaz, guvenliMi, oturumSahibi } from '@/lib/yetki/yarismaci';
import { oturumAc } from '@/lib/db/yarismaci-depo';

export async function GET(request: Request) {
  const y = oturumSahibi(request);
  if (!y) return Response.json({ hata: 'Oturum bulunamadı.' }, { status: 401 });
  return Response.json({ yarismaci: y });
}

export async function PATCH(request: Request) {
  const y = oturumSahibi(request);
  if (!y) return Response.json({ hata: 'Oturum bulunamadı.' }, { status: 401 });

  let g: {
    adSoyad?: string;
    telefon?: string;
    kurum?: string;
    sehir?: string;
    mevcutParola?: string;
    yeniParola?: string;
  };
  try {
    g = await request.json();
  } catch {
    return Response.json({ hata: 'İstek okunamadı.' }, { status: 400 });
  }

  // ------------------------------------------------- PAROLA DEĞİŞTİRME
  if (g.yeniParola) {
    /*
     * MEVCUT PAROLA SORULUYOR.
     *
     * Açık kalmış bir oturumu ele geçiren biri, mevcut parolayı bilmeden
     * parolayı değiştirip hesabı tamamen devralabilirdi. Oturum sahibi
     * olmak, parolayı değiştirmeye yetmiyor.
     */
    if (!g.mevcutParola) {
      return Response.json({ hata: 'Mevcut parolanızı girin.' }, { status: 400 });
    }
    if (!(await girisDogrula(y.eposta, g.mevcutParola))) {
      return Response.json({ hata: 'Mevcut parolanız hatalı.' }, { status: 401 });
    }
    const sorun = parolaSorunu(g.yeniParola);
    if (sorun) return Response.json({ hata: sorun }, { status: 400 });

    await parolaDegistir(y.id, g.yeniParola);
    /*
     * `parolaDegistir` bütün oturumları düşürüyor — kendi oturumumuz
     * dahil. Yeni bir oturum açılıp çerez yenileniyor: parolasını
     * değiştiren kullanıcının anında dışarı atılması, doğru davranışın
     * cezalandırılması olurdu.
     */
    const belirtec = oturumAc(y.id);
    return Response.json(
      { guncellendi: true },
      { headers: { 'Set-Cookie': cerezYaz(belirtec, guvenliMi(request)) } },
    );
  }

  // ------------------------------------------------- PROFİL GÜNCELLEME
  const adSoyad = g.adSoyad !== undefined ? onar(g.adSoyad).trim() : undefined;
  if (adSoyad !== undefined && adSoyad.length < 3) {
    return Response.json({ hata: 'Ad soyad gerekli.' }, { status: 400 });
  }

  const n = profilGuncelle(y.id, {
    adSoyad,
    telefon: g.telefon !== undefined ? g.telefon.trim() : undefined,
    kurum: g.kurum !== undefined ? onar(g.kurum).trim() : undefined,
    sehir: g.sehir !== undefined ? onar(g.sehir).trim() : undefined,
  });
  return Response.json({ yarismaci: n });
}
