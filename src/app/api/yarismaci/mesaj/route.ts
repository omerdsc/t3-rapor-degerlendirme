/**
 * Başvuru yazışması — yarışmacı ve koordinasyon aynı uçtan yazıyor.
 *
 * ── İKİ ROL TEK UÇTA ────────────────────────────────────────────────────
 * Aynı satırlara yazıp aynı satırları okuyorlar; ayıran tek şey KİMİN
 * yazdığı. İki ayrı uç yazılsaydı, bir tarafa eklenen bir kural (uzunluk
 * sınırı, okundu işareti) ötekinde eksik kalırdı.
 *
 * Rol istemciden GELMİYOR, oturumdan çözülüyor: yarışmacı oturumu varsa
 * yarışmacı, koordinasyon yetkisi varsa koordinasyon. Gövdeden okunsaydı
 * herkes koordinasyon adına yazabilirdi.
 */

import { onar } from '@/lib/analiz/normalize';
import { basvuruGetir } from '@/lib/db/basvuru-depo';
import {
  AZAMI_UZUNLUK, basvurununMesajlari, mesajEkle, okunduIsaretle,
} from '@/lib/db/basvuru-mesaji';
import { takimUyeleri } from '@/lib/db/yarismaci-depo';
import { istekYetkili } from '@/lib/yetki/koordinasyon';
import { oturumSahibi } from '@/lib/yetki/yarismaci';

/**
 * İsteği yazan taraf kim — oturumdan çözülüyor, gövdeden değil.
 *
 * ── YARIŞMACI OTURUMU KOORDİNASYONA DÜŞMEZ ──────────────────────────────
 * Bu ölçülmüş bir açıktı. İlk sürüm önce üyeliği deniyor, tutmazsa
 * `istekYetkili()` ile koordinasyona düşüyordu. `istekYetkili()` ise
 * koordinasyon anahtarı KURULU DEĞİLKEN herkese `true` döndürüyor — açık
 * kurulumun bilinen davranışı. Sonuç: oturum açmış herhangi bir
 * yarışmacı, ÜYESİ OLMADIĞI bir başvurunun yazışmasını okuyabiliyor ve
 * oraya "Yarışma Koordinasyonu" adıyla yazabiliyordu.
 *
 * Kural artık şu: istek bir yarışmacı oturumu taşıyorsa aktör
 * YARIŞMACIDIR. Üye değilse erişimi yoktur — koordinasyona düşmez.
 * Koordinasyon yolu yalnızca yarışmacı oturumu OLMAYAN isteklere açık.
 */
function taraf(istek: Request, basvuruId: string) {
  const y = oturumSahibi(istek);
  if (y) {
    const b = basvuruGetir(basvuruId);
    if (!b) return null;
    const uye = b.takimKaydiId
      ? takimUyeleri(b.takimKaydiId).some((u) => u.yarismaciId === y.id)
      : b.yarismaciId === y.id;
    return uye ? { rol: 'yarismaci' as const, ad: y.adSoyad, id: y.id } : null;
  }
  if (istekYetkili(istek)) {
    return { rol: 'koordinasyon' as const, ad: 'Yarışma Koordinasyonu', id: undefined };
  }
  return null;
}

export async function GET(request: Request) {
  const basvuruId = new URL(request.url).searchParams.get('basvuru');
  if (!basvuruId) return Response.json({ hata: 'Başvuru belirtilmedi.' }, { status: 400 });

  const t = taraf(request, basvuruId);
  if (!t) return Response.json({ hata: 'Başvuru bulunamadı.' }, { status: 404 });

  // Okuyan taraf karşının mesajlarını görmüş sayılıyor.
  okunduIsaretle(basvuruId, t.rol);
  return Response.json({ mesajlar: basvurununMesajlari(basvuruId), rol: t.rol });
}

export async function POST(request: Request) {
  const basvuruId = new URL(request.url).searchParams.get('basvuru');
  if (!basvuruId) return Response.json({ hata: 'Başvuru belirtilmedi.' }, { status: 400 });

  const t = taraf(request, basvuruId);
  if (!t) return Response.json({ hata: 'Başvuru bulunamadı.' }, { status: 404 });

  let g: { metin?: string };
  try {
    g = await request.json();
  } catch {
    return Response.json({ hata: 'İstek okunamadı.' }, { status: 400 });
  }

  const metin = onar(g.metin ?? '').trim();
  if (!metin) return Response.json({ hata: 'Mesaj boş olamaz.' }, { status: 400 });
  if (metin.length > AZAMI_UZUNLUK) {
    return Response.json(
      { hata: `Mesaj en fazla ${AZAMI_UZUNLUK} karakter olabilir.` },
      { status: 400 },
    );
  }

  mesajEkle({
    basvuruId,
    yazarRol: t.rol,
    yazarAdi: t.ad,
    yarismaciId: t.id,
    metin,
  });
  return Response.json({ mesajlar: basvurununMesajlari(basvuruId) }, { status: 201 });
}
