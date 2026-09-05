/**
 * Yarışmacı kaydı, girişi ve çıkışı.
 *
 * Kimlik doğrulamanın dışında olan tek uç: kilidi açan kapının kilitli
 * olması olmaz.
 */

import { epostaGecerli, epostaNormal, parolaSorunu } from '@/lib/yetki/parola';
import { cerezSil, cerezYaz, guvenliMi } from '@/lib/yetki/yarismaci';
import {
  epostaKayitli, girisDogrula, oturumAc, oturumKapat, yarismaciKaydet,
} from '@/lib/db/yarismaci-depo';
import { YARISMACI_COKKI } from '@/lib/yetki/yarismaci';

/**
 * Başarısız giriş gecikmesi.
 *
 * Parola doğrulaması zaten scrypt yüzünden ~60 ms sürüyor; bu ek gecikme
 * otomatik denemeyi daha da pahalı kılıyor. Sabit süre: sebebe göre
 * değişseydi, süre farkı "bu e-posta kayıtlı mı" sorusunu cevaplardı.
 */
const BASARISIZ_GECIKME_MS = 500;

interface Govde {
  islem?: 'kayit' | 'giris';
  eposta?: string;
  parola?: string;
  adSoyad?: string;
  telefon?: string;
  kurum?: string;
  sehir?: string;
}

export async function POST(request: Request) {
  let g: Govde;
  try {
    g = (await request.json()) as Govde;
  } catch {
    return Response.json({ hata: 'İstek okunamadı.' }, { status: 400 });
  }

  const eposta = (g.eposta ?? '').trim();
  const parola = g.parola ?? '';

  if (!eposta || !parola) {
    return Response.json({ hata: 'E-posta ve parola gerekli.' }, { status: 400 });
  }
  if (!epostaGecerli(eposta)) {
    return Response.json({ hata: 'Geçerli bir e-posta adresi girin.' }, { status: 400 });
  }

  // ---------------------------------------------------------- KAYIT
  if (g.islem === 'kayit') {
    const adSoyad = (g.adSoyad ?? '').trim();
    if (adSoyad.length < 3) {
      return Response.json({ hata: 'Ad soyad gerekli.' }, { status: 400 });
    }
    const sorun = parolaSorunu(parola);
    if (sorun) return Response.json({ hata: sorun }, { status: 400 });

    /*
     * "Bu e-posta zaten kayıtlı" AÇIKÇA söyleniyor.
     *
     * Kayıt akışında bunu gizlemek mümkün değil: kullanıcı zaten kayıt
     * olmaya çalışıyor ve hesabı varsa bunu bilmesi gerekiyor. Belirsiz
     * bir hata, kendi hesabı olduğunu unutmuş kullanıcıyı çıkmaza sokar.
     */
    if (epostaKayitli(eposta)) {
      return Response.json(
        { hata: 'Bu e-posta adresi zaten kayıtlı. Giriş yapmayı deneyin.' },
        { status: 409 },
      );
    }

    const y = await yarismaciKaydet({
      eposta, parola, adSoyad,
      telefon: g.telefon, kurum: g.kurum, sehir: g.sehir,
    });
    const belirtec = oturumAc(y.id);
    return Response.json(
      { yarismaci: { adSoyad: y.adSoyad, eposta: y.eposta } },
      { status: 201, headers: { 'Set-Cookie': cerezYaz(belirtec, guvenliMi(request)) } },
    );
  }

  // ---------------------------------------------------------- GİRİŞ
  const y = await girisDogrula(eposta, parola);
  if (!y) {
    await new Promise((c) => setTimeout(c, BASARISIZ_GECIKME_MS));
    /*
     * Tek mesaj: "e-posta bulunamadı" ile "parola yanlış" ayrı ayrı
     * söylenseydi, kimin kayıtlı olduğu deneyerek öğrenilebilirdi.
     */
    return Response.json({ hata: 'E-posta veya parola hatalı.' }, { status: 401 });
  }

  const belirtec = oturumAc(y.id);
  return Response.json(
    { yarismaci: { adSoyad: y.adSoyad, eposta: y.eposta } },
    { headers: { 'Set-Cookie': cerezYaz(belirtec, guvenliMi(request)) } },
  );
}

export async function DELETE(request: Request) {
  const cerezler = request.headers.get('cookie') ?? '';
  for (const parca of cerezler.split(';')) {
    const [ad, ...deger] = parca.trim().split('=');
    if (ad === YARISMACI_COKKI) {
      // Oturum tablodan da siliniyor: yalnızca çerezi silmek, belirteci
      // bir yerden kopyalamış birinin girişini sürdürmesine izin verirdi.
      oturumKapat(decodeURIComponent(deger.join('=')));
    }
  }
  return Response.json({ cikis: true }, { headers: { 'Set-Cookie': cerezSil() } });
}

/** E-posta müsait mi — kayıt formu yazarken sorup anında geri bildirim veriyor. */
export async function GET(request: Request) {
  const e = new URL(request.url).searchParams.get('eposta') ?? '';
  if (!epostaGecerli(e)) return Response.json({ uygun: false, sebep: 'bicim' });
  return Response.json({ uygun: !epostaKayitli(epostaNormal(e)) });
}
