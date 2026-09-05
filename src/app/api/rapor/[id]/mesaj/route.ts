/**
 * Rapor üzerindeki yazışma — İKİ KANAL.
 *
 *   koordinasyon · Yazan hakem ile koordinasyon arasında. Öteki hakemler
 *                  GÖRMEZ. "Şablon sürümü doğru mu" gibi sorular buraya.
 *   kurul        · Rapora atanmış bütün hakemler + koordinasyon.
 *                  Hakemlerin birbiriyle konuştuğu yer.
 *
 * Bu yazışmaların hiçbiri yarışmacıya gösterilmiyor.
 *
 * ── KİMLİK YAZILMIYOR, DOĞRULANIYOR ─────────────────────────────────────
 * Önceki sürümde gönderen kendi adını ve kendi ROLÜNÜ yazıyordu: bir metin
 * kutusuna isim yazan herkes hakem gibi görünüyordu. Bir denetim izinde
 * bunun değeri sıfırdır. Artık kimlik doğrulamadan geliyor.
 *
 * ── KURUL KANALI NİYE KİLİTLİ BAŞLIYOR ──────────────────────────────────
 * Atanmış hakemlerin hepsi puanlamayı bitirene kadar kapalı — akademik
 * hakemlikteki kuralın aynısı: önce bağımsız değerlendirme, sonra
 * tartışma. Erken açık olsa ilk yazan ötekini etkiler ve ölçtüğümüz
 * "hakemler arası ayrışma" anlamını yitirir; o sayının bilgi değeri, iki
 * kişinin BİRBİRİNDEN HABERSİZ aynı rapora bakmış olmasından geliyor.
 */

import { kapi } from '@/lib/yetki/koordinasyon';
import {
  hakemKodIle, raporunDegerlendirmeleri, raporunHakemleri,
} from '@/lib/db/hakem-depo';
import { hakeminGorebilecekleri, kurulAcikMi, type Kanal } from '@/lib/db/yazisma-kanal';
import { hakemGozuyle } from '@/lib/gorunum/hakem-takma-ad';
import { mesajEkle, mesajlariGetir, raporGetir } from '@/lib/depo/depo';
import { onar } from '@/lib/analiz/normalize';
import type { Mesaj } from '@/lib/depo/tipler';

interface Gonderen {
  yazar: string;
  rol: Mesaj['rol'];
  /** Hakemse kimliği; koordinasyonsa yok. */
  hakemId?: string;
}

/** Rapora atanmış hakemler ve değerlendirmeyi bitirip bitirmedikleri. */
function atananDurumu(raporId: string) {
  const degerlendirmeler = raporunDegerlendirmeleri(raporId);
  return raporunHakemleri(raporId).map((h) => ({
    id: h.id,
    ad: h.ad,
    tamamladi: degerlendirmeler.some(
      (d) => d.hakemId === h.id && d.durum === 'tamamlandi',
    ),
  }));
}

/**
 * İsteği gönderen kim? `null` dönerse yetkisiz.
 *
 * Hakem yolu koordinasyon anahtarı gerektirmiyor — hakemin anahtarı yok,
 * kendi kodu var.
 */
function gonderenKim(istek: Request, raporId: string, kod?: string): Gonderen | null {
  if (kod) {
    const hakem = hakemKodIle(kod);
    if (!hakem || !hakem.aktif) return null;
    // Atanmamış hakem o raporun yazışmasına hiç giremez.
    if (!raporunHakemleri(raporId).some((h) => h.id === hakem.id)) return null;
    return { yazar: hakem.ad, rol: 'hakem', hakemId: hakem.id };
  }
  return kapi(istek) ? null : { yazar: 'Koordinasyon', rol: 'koordinasyon' };
}

/**
 * Yanıta girecek mesaj listesi — kim soruyorsa ona göre.
 *
 * İki süzgeç üst üste: önce HANGİ mesajları göreceği (`hakeminGorebilecekleri`),
 * sonra o mesajlarda KİMİ göreceği (`hakemGozüyle`). İkincisi olmadan kurul
 * kanalında hakem, öteki hakemin gerçek adını okuyordu — KVKK'nın veri
 * minimizasyonu ilkesine aykırı ve kör değerlendirmeyi de bozan bir sap.
 *
 * Koordinasyon iki süzgecin de dışında: atamayı o yapıyor, itiraz hâlinde
 * kaydı o tutuyor.
 */
function gorunenMesajlar(
  hepsi: Mesaj[],
  gonderen: Gonderen,
  atananlar: Array<{ id: string; ad: string; tamamladi: boolean }>,
  kurulAcik: boolean,
): Mesaj[] {
  if (gonderen.rol === 'koordinasyon') return hepsi;
  return hakemGozuyle(
    hakeminGorebilecekleri(
      hepsi.map((m) => ({ ...m, kanal: m.kanal ?? 'koordinasyon' })),
      gonderen.hakemId!,
      kurulAcik,
    ),
    atananlar,
    gonderen.hakemId!,
  );
}

/** Kanal adı doğrula; tanınmayan değer varsayılana düşüyor. */
function kanalCoz(ham: unknown): Kanal {
  return ham === 'kurul' ? 'kurul' : 'koordinasyon';
}

export async function GET(istek: Request, ctx: RouteContext<'/api/rapor/[id]/mesaj'>) {
  const { id } = await ctx.params;
  const kod = new URL(istek.url).searchParams.get('kod') ?? undefined;

  const gonderen = gonderenKim(istek, id, kod);
  if (!gonderen) {
    return Response.json({ hata: 'Bu yazışmaya erişiminiz yok.' }, { status: 403 });
  }
  if (!raporGetir(id)) {
    return Response.json({ hata: 'Rapor bulunamadı.' }, { status: 404 });
  }

  const atananlar = atananDurumu(id);
  const kurulAcik = kurulAcikMi(atananlar);
  const hepsi = mesajlariGetir(id);

  /*
   * Koordinasyon HER ŞEYİ görüyor ve görmesi gerekiyor — aracılık eden
   * taraf o. Hakem yalnızca kendi yazışmasını ve (açıksa) kurulu görüyor.
   */
  const mesajlar = gorunenMesajlar(hepsi, gonderen, atananlar, kurulAcik);

  return Response.json({
    mesajlar,
    kurul: {
      acik: kurulAcik,
      hakemSayisi: atananlar.length,
      bitiren: atananlar.filter((h) => h.tamamladi).length,
    },
    /*
     * Atanmış hakem listesi YALNIZCA koordinasyona gidiyor: alıcı seçimi
     * için gerekli. Hakeme gönderilse öteki hakemlerin kim olduğunu
     * öğrenirdi — kör puanlamada bunun bilinmesine gerek yok.
     */
    ...(gonderen.rol === 'koordinasyon'
      ? {
          hakemler: raporunHakemleri(id).map((h) => ({
            id: h.id,
            ad: h.ad,
          })),
        }
      : {}),
  });
}

export async function POST(istek: Request, ctx: RouteContext<'/api/rapor/[id]/mesaj'>) {
  const { id } = await ctx.params;

  let g: {
    metin?: string;
    yazar?: string;
    kod?: string;
    kanal?: string;
    /** Koordinasyon kime yazıyor — boşsa bütün hakemlere duyuru. */
    alici?: string;
  };
  try {
    g = await istek.json();
  } catch {
    return Response.json({ hata: 'Geçersiz istek gövdesi.' }, { status: 400 });
  }

  // Yetki önce, doğrulama sonra: reddedilen istek hiçbir şey öğrenmemeli.
  const gonderen = gonderenKim(istek, id, g.kod);
  if (!gonderen) {
    return Response.json({ hata: 'Bu yazışmaya erişiminiz yok.' }, { status: 403 });
  }
  if (!raporGetir(id)) {
    return Response.json({ hata: 'Rapor bulunamadı.' }, { status: 404 });
  }

  const kanal = kanalCoz(g.kanal);
  const atananlar = atananDurumu(id);
  const kurulAcik = kurulAcikMi(atananlar);

  /*
   * KİLİT SUNUCUDA. Arayüz kutuyu gizliyor ama karar burada veriliyor:
   * gizlenmiş bir kutu, kapatılmış bir kapı değildir.
   */
  if (kanal === 'kurul' && !kurulAcik) {
    return Response.json(
      {
        hata:
          atananlar.length < 2
            ? 'Bu rapora tek hakem atanmış; kurul yazışması yok.'
            : 'Kurul yazışması, atanmış bütün hakemler değerlendirmesini '
              + 'tamamladıktan sonra açılıyor.',
      },
      { status: 409 },
    );
  }

  const metin = onar(g.metin ?? '').trim();
  if (metin.length < 2) {
    return Response.json({ hata: 'Mesaj boş olamaz.' }, { status: 422 });
  }

  /*
   * Koordinasyon ORTAK hesap: kim yazdıysa adını girebiliyor. Hakemde
   * böyle bir seçenek yok — adı kaydından geliyor ve değiştirilemez.
   */
  const yazar =
    gonderen.rol === 'koordinasyon' && g.yazar?.trim()
      ? `Koordinasyon · ${onar(g.yazar).trim().slice(0, 60)}`
      : gonderen.yazar;

  /*
   * KOORDİNASYON KİME YAZIYOR.
   *
   * Hakem yazdığında `hakemId` yazanın kendisi — yazışma ona ait.
   * Koordinasyon yazdığında ise `hakemId` ALICIYI gösteriyor: iki hakemli
   * bir raporda "A'ya cevap" ile "B'ye cevap" ayrı yazışmalar ve
   * birbirini görmemeli. Alıcı verilmezse mesaj kimliksiz kalıyor ve
   * bütün hakemlere açık bir duyuru sayılıyor.
   *
   * Alıcı doğrulanıyor: koordinasyon yalnızca o rapora ATANMIŞ bir
   * hakeme yazabilir. Uydurma kimlik, kimsenin göremeyeceği bir mesaj
   * üretirdi — sessiz kayıp.
   */
  let hedefHakem = gonderen.hakemId;
  if (gonderen.rol === 'koordinasyon' && g.alici) {
    if (!atananlar.some((h) => h.id === g.alici)) {
      return Response.json(
        { hata: 'Seçilen hakem bu rapora atanmamış.' },
        { status: 422 },
      );
    }
    hedefHakem = g.alici;
  }

  await mesajEkle(id, {
    metin: metin.slice(0, 4000),
    yazar,
    rol: gonderen.rol,
    hakemId: hedefHakem,
    kanal,
  });

  const hepsi = mesajlariGetir(id);
  const mesajlar = gorunenMesajlar(hepsi, gonderen, atananlar, kurulAcik);

  return Response.json(
    {
      mesajlar,
      kurul: {
        acik: kurulAcik,
        hakemSayisi: atananlar.length,
        bitiren: atananlar.filter((h) => h.tamamladi).length,
      },
    },
    { status: 201 },
  );
}
