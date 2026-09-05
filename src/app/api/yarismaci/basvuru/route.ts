/**
 * Yarışmaya başvurma — yarışmacının kendi ucu.
 *
 * ── BAŞVURU TAKIMA AİT, KİŞİYE DEĞİL ────────────────────────────────────
 * Rapor bir takımın işi ve takım üyeleri değişebiliyor. Başvuru kişiye
 * bağlansaydı, kaptan takımdan ayrıldığında başvuru onunla giderdi.
 * `yarismaci_id` yalnızca "kim açtı" bilgisi; erişim takım üyeliğinden
 * geliyor.
 */

import { onar } from '@/lib/analiz/normalize';
import { teslimPenceresi } from '@/lib/analiz/teslim-penceresi';
import {
  basvuruEkle, basvuruNumaraKodIle, basvuruSahiplendir,
  takiminKategoriBasvurusu, yarismacininBasvurulari,
} from '@/lib/db/basvuru-depo';
import { basvuruAsamasi } from '@/lib/db/basvuru-durum';
import { takimGetir, takimUyeleri } from '@/lib/db/yarismaci-depo';
import { kategoriGetir, yarismaGetir } from '@/lib/depo/depo';
import { oturumSahibi } from '@/lib/yetki/yarismaci';

export async function GET(request: Request) {
  const y = oturumSahibi(request);
  if (!y) return Response.json({ hata: 'Oturum bulunamadı.' }, { status: 401 });

  const basvurular = yarismacininBasvurulari(y.id).map((b) => {
    const yarisma = yarismaGetir(b.yarismaId);
    const kategori = kategoriGetir(b.yarismaId, b.kategoriId);
    return {
      ...b,
      // Erişim kodu HESAP AKIŞINDA GEREKSİZ ve gösterilmiyor: yarışmacı
      // zaten oturum açmış durumda. Kod yalnızca ön kayıtlı başvuruları
      // üstlenmek için var.
      kod: undefined,
      yarismaAdi: yarisma?.ad,
      kategoriAdi: kategori?.ad,
      asama: basvuruAsamasi(b.id),
      pencere: teslimPenceresi(kategori?.sartname?.kurallar.tarihler, kategori?.asama),
    };
  });
  return Response.json({ basvurular });
}

export async function POST(request: Request) {
  const y = oturumSahibi(request);
  if (!y) return Response.json({ hata: 'Oturum bulunamadı.' }, { status: 401 });

  let g: {
    islem?: 'ustlen';
    takimId?: string;
    yarismaId?: string;
    kategoriId?: string;
    proje?: string;
    basvuruNo?: string;
    kod?: string;
  };
  try {
    g = await request.json();
  } catch {
    return Response.json({ hata: 'İstek okunamadı.' }, { status: 400 });
  }

  /*
   * ── ÖN KAYITLI BAŞVURUYU ÜSTLENME ─────────────────────────────────────
   *
   * Koordinasyon kayıt listesini yarışma açılışında içeri aktarıyor ve o
   * başvuruların arkasında henüz bir hesap yok. Yarışmacı kayıt olduktan
   * sonra elindeki başvuru numarası + erişim koduyla kendi kaydını
   * üstleniyor; başvuru takımına bağlanıyor.
   *
   * Bu olmasaydı iki ayrı dünya oluşurdu: koordinasyonun açtığı
   * başvurular ve yarışmacının açtığı başvurular — aynı yarışmada,
   * birbirini görmeyen.
   */
  if (g.islem === 'ustlen') {
    const no = (g.basvuruNo ?? '').trim();
    const kod = (g.kod ?? '').trim();
    if (!no || !kod) {
      return Response.json(
        { hata: 'Başvuru numarası ve erişim kodu gerekli.' },
        { status: 400 },
      );
    }
    if (!g.takimId) {
      return Response.json({ hata: 'Başvuruyu bağlayacağınız takımı seçin.' }, { status: 400 });
    }
    const takim = takimGetir(g.takimId);
    if (!takim || takim.kaptanId !== y.id) {
      return Response.json(
        { hata: 'Başvuruyu yalnızca kaptanı olduğunuz bir takıma bağlayabilirsiniz.' },
        { status: 403 },
      );
    }

    const b = basvuruNumaraKodIle(no, kod);
    if (!b) {
      // Tek mesaj: numara mı kod mu yanlış söylenmiyor.
      return Response.json(
        { hata: 'Başvuru numarası veya erişim kodu hatalı.' },
        { status: 404 },
      );
    }
    if (b.takimKaydiId) {
      return Response.json(
        { hata: 'Bu başvuru zaten bir takıma bağlanmış.' },
        { status: 409 },
      );
    }

    const guncel = basvuruSahiplendir(b.id, takim.id, y.id, takim.ad);
    return Response.json({ basvuru: guncel }, { status: 200 });
  }

  if (!g.takimId) return Response.json({ hata: 'Takım seçilmedi.' }, { status: 400 });
  const takim = takimGetir(g.takimId);
  if (!takim) return Response.json({ hata: 'Takım bulunamadı.' }, { status: 404 });

  /*
   * BAŞVURUYU YALNIZCA KAPTAN AÇABİLİR.
   *
   * Her üye başvurabilseydi aynı takım aynı kategoriye birden çok kez
   * başvurmaya çalışır ve hangi raporun geçerli olduğu belirsizleşirdi.
   * Yarışmaya girme kararı takımın tek bir sesi olmalı.
   */
  if (takim.kaptanId !== y.id) {
    const uye = takimUyeleri(takim.id).some((u) => u.yarismaciId === y.id);
    return Response.json(
      {
        hata: uye
          ? 'Yarışma başvurusunu yalnızca takım kaptanı yapabilir.'
          : 'Takım bulunamadı.',
      },
      { status: uye ? 403 : 404 },
    );
  }

  if (!g.yarismaId) return Response.json({ hata: 'Yarışma seçilmedi.' }, { status: 400 });
  const yarisma = yarismaGetir(g.yarismaId);
  if (!yarisma) return Response.json({ hata: 'Yarışma bulunamadı.' }, { status: 404 });

  if (!g.kategoriId) return Response.json({ hata: 'Kategori seçilmedi.' }, { status: 400 });
  const kategori = kategoriGetir(g.yarismaId, g.kategoriId);
  if (!kategori) return Response.json({ hata: 'Kategori bulunamadı.' }, { status: 404 });

  // Aynı takım aynı kategoriye iki kez başvuramaz.
  const mevcut = takiminKategoriBasvurusu(takim.id, kategori.id);
  if (mevcut) {
    return Response.json(
      { hata: 'Bu takım bu kategoriye zaten başvurmuş.', basvuru: { id: mevcut.id } },
      { status: 409 },
    );
  }

  /*
   * TESLİM SÜRESİ GEÇMİŞSE BAŞVURU AÇILMIYOR.
   *
   * Açılabilseydi yarışmacı başvuru yapıp rapor yükleyemeyeceğini ancak
   * yükleme ekranında öğrenirdi — boşuna umut veren bir akış.
   */
  const pencere = teslimPenceresi(kategori.sartname?.kurallar.tarihler, kategori.asama);
  if (!pencere.acik) {
    return Response.json(
      { hata: 'Bu kategorinin başvuru ve teslim süresi doldu.', teslim: pencere.teslim },
      { status: 403 },
    );
  }

  const b = basvuruEkle(
    {
      yarismaId: yarisma.id,
      kategoriId: kategori.id,
      takim: takim.ad,
      takimId: takim.katilimKodu,
      proje: onar(g.proje ?? '').trim() || undefined,
      eposta: y.eposta,
      takimKaydiId: takim.id,
      yarismaciId: y.id,
    },
    yarisma.yil,
  );
  return Response.json({ basvuru: b }, { status: 201 });
}
