/**
 * Koordinasyonun gelen kutusu — liste, konuşma ve yanıt.
 *
 * Çekmece bu uçtan besleniyor: konuşmayı okumak ve yanıtlamak için sayfa
 * değiştirmek gerekmiyor.
 */

import { onar } from '@/lib/analiz/normalize';
import {
  konusmaMesajlari, konusmalar, type KonusmaMesaji,
} from '@/lib/db/gelen-kutusu';
import { mesajEkle as basvuruMesajiEkle, okunduIsaretle } from '@/lib/db/basvuru-mesaji';
import { mesajEkle as raporMesajiEkle } from '@/lib/depo/depo';
import { kapi } from '@/lib/yetki/koordinasyon';

const AZAMI_UZUNLUK = 2000;

export async function GET(request: Request) {
  const yetkisiz = kapi(request);
  if (yetkisiz) return yetkisiz;

  const anahtar = new URL(request.url).searchParams.get('konusma');
  if (!anahtar) return Response.json({ konusmalar: konusmalar() });

  /*
   * Konuşmayı AÇMAK okumaktır. Ayrı bir "okundu" düğmesi koymak,
   * kullanıcıdan zaten yaptığı bir şeyi ayrıca bildirmesini istemek olur.
   */
  const [tur, id] = anahtar.split(':');
  if (tur === 'yarismaci') okunduIsaretle(id, 'koordinasyon');

  const mesajlar: KonusmaMesaji[] = konusmaMesajlari(anahtar);
  return Response.json({ mesajlar });
}

export async function POST(request: Request) {
  const yetkisiz = kapi(request);
  if (yetkisiz) return yetkisiz;

  let g: { konusma?: string; metin?: string };
  try {
    g = await request.json();
  } catch {
    return Response.json({ hata: 'İstek okunamadı.' }, { status: 400 });
  }

  const anahtar = (g.konusma ?? '').trim();
  const metin = onar(g.metin ?? '').trim();
  if (!anahtar) return Response.json({ hata: 'Konuşma belirtilmedi.' }, { status: 400 });
  if (!metin) return Response.json({ hata: 'Mesaj boş olamaz.' }, { status: 400 });
  if (metin.length > AZAMI_UZUNLUK) {
    return Response.json(
      { hata: `Mesaj en fazla ${AZAMI_UZUNLUK} karakter olabilir.` },
      { status: 400 },
    );
  }

  const [tur, a, b] = anahtar.split(':');

  if (tur === 'hakem') {
    /*
     * Yanıt HAKEM KİMLİĞİYLE yazılıyor. Kimliksiz yazılsaydı çok hakemli
     * bir raporda cevap hangi sohbete ait olduğu belirsiz kalır ve
     * ötekinin bekleyen sorusu cevaplanmış görünürdü.
     */
    await raporMesajiEkle(a, {
      yazar: 'Yarışma Koordinasyonu',
      rol: 'koordinasyon',
      hakemId: b || undefined,
      kanal: 'koordinasyon',
      metin,
    });
    return Response.json({ mesajlar: konusmaMesajlari(anahtar) }, { status: 201 });
  }

  if (tur === 'yarismaci') {
    basvuruMesajiEkle({
      basvuruId: a,
      yazarRol: 'koordinasyon',
      yazarAdi: 'Yarışma Koordinasyonu',
      metin,
    });
    return Response.json({ mesajlar: konusmaMesajlari(anahtar) }, { status: 201 });
  }

  return Response.json({ hata: 'Konuşma bulunamadı.' }, { status: 404 });
}
