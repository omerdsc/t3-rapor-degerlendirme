/**
 * Rapor üzerindeki yazışma — hakem ile koordinasyon arasında.
 *
 * Hakem ve koordinasyon arasındaki her not değerlendirme metnine yazılamaz;
 * kimi şey rapora girmemesi gereken bir soru, hatırlatma veya karardır.
 * Bu iz kaydı yarışmacıya GÖSTERİLMEZ.
 *
 * ── KİMLİK YAZILMIYOR, DOĞRULANIYOR ─────────────────────────────────────
 * Önceki sürümde gönderen kendi adını ve kendi ROLÜNÜ yazıyordu: bir metin
 * kutusuna "Prof. Dr. X" yazıp rol olarak "hakem" seçen herkes hakem gibi
 * görünüyordu. Bir denetim izinde bunun değeri sıfırdır.
 *
 * Artık kimlik kimlik doğrulamadan geliyor:
 *   · Hakem  → erişim kodu (`kod`), rapora ATANMIŞ olması şart.
 *              Yazar adı hakem kaydından okunuyor, istemciden değil.
 *   · Koordinasyon → koordinasyon anahtarı. Ortak hesap olduğu için
 *              yazan kişinin adı isteğe bağlı; rol sabit.
 *
 * ── HAKEM HANGİ RAPORU KASTETTİĞİNİ YAZMIYOR ────────────────────────────
 * Mesaj zaten bir rapora bağlı: hakem o raporun sayfasından yazıyor ve
 * koordinasyon mesajı o raporun bağlamında görüyor. "Hangi rapor
 * hakkında?" sorusu hiç doğmuyor.
 */

import { kapi } from '@/lib/yetki/koordinasyon';
import { hakeminRaporlari, hakemKodIle } from '@/lib/db/hakem-depo';
import { mesajEkle, mesajlariGetir, raporGetir } from '@/lib/depo/depo';
import { onar } from '@/lib/analiz/normalize';
import type { Mesaj } from '@/lib/depo/tipler';

interface Gonderen {
  yazar: string;
  rol: Mesaj['rol'];
}

/**
 * İsteği gönderen kim?
 *
 * `null` dönerse yetkisiz. Hakem yolu koordinasyon anahtarı gerektirmiyor
 * — hakemin anahtarı yok, kendi kodu var.
 */
function gonderenKim(istek: Request, raporId: string, kod?: string): Gonderen | null {
  if (kod) {
    const hakem = hakemKodIle(kod);
    if (!hakem || !hakem.aktif) return null;
    // Atanmamış hakem o raporun yazışmasına giremez.
    if (!hakeminRaporlari(hakem.id).includes(raporId)) return null;
    return { yazar: hakem.ad, rol: 'hakem' };
  }
  // Kod yoksa koordinasyon yolu: anahtar denetlenecek.
  return kapi(istek) ? null : { yazar: 'Koordinasyon', rol: 'koordinasyon' };
}

export async function GET(istek: Request, ctx: RouteContext<'/api/rapor/[id]/mesaj'>) {
  const { id } = await ctx.params;
  const kod = new URL(istek.url).searchParams.get('kod') ?? undefined;

  if (!gonderenKim(istek, id, kod)) {
    return Response.json({ hata: 'Bu yazışmaya erişiminiz yok.' }, { status: 403 });
  }
  if (!raporGetir(id)) {
    return Response.json({ hata: 'Rapor bulunamadı.' }, { status: 404 });
  }
  return Response.json({ mesajlar: mesajlariGetir(id) });
}

export async function POST(istek: Request, ctx: RouteContext<'/api/rapor/[id]/mesaj'>) {
  const { id } = await ctx.params;

  let g: { metin?: string; yazar?: string; kod?: string };
  try {
    g = await istek.json();
  } catch {
    return Response.json({ hata: 'Geçersiz istek gövdesi.' }, { status: 400 });
  }

  /*
   * Yetki önce, doğrulama sonra: reddedilen istek raporun var olup
   * olmadığını bile öğrenmemeli.
   */
  const gonderen = gonderenKim(istek, id, g.kod);
  if (!gonderen) {
    return Response.json({ hata: 'Bu yazışmaya erişiminiz yok.' }, { status: 403 });
  }
  if (!raporGetir(id)) {
    return Response.json({ hata: 'Rapor bulunamadı.' }, { status: 404 });
  }

  const metin = onar(g.metin ?? '').trim();
  if (metin.length < 2) {
    return Response.json({ hata: 'Mesaj boş olamaz.' }, { status: 422 });
  }

  /*
   * Koordinasyon ORTAK hesap: kim yazdıysa adını girebiliyor, girmezse
   * "Koordinasyon" kalıyor. Hakemde böyle bir seçenek yok — adı kaydından
   * geliyor ve değiştirilemez.
   */
  const yazar =
    gonderen.rol === 'koordinasyon' && g.yazar?.trim()
      ? `Koordinasyon · ${onar(g.yazar).trim().slice(0, 60)}`
      : gonderen.yazar;

  await mesajEkle(id, {
    metin: metin.slice(0, 4000),
    yazar,
    rol: gonderen.rol,
  });

  return Response.json({ mesajlar: mesajlariGetir(id) }, { status: 201 });
}
