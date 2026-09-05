/**
 * Başvuru kayıtları — KOORDİNASYON kapısı.
 *
 * Yarışmacının kendi ucu `/api/basvuru/giris` ve `/api/basvuru/rapor`.
 * Bu uç yalnızca koordinasyonun kayıt listesini yönettiği yer: liste
 * aktarma, kod görüntüleme, pasife alma.
 */

import {
  basvuruDurumlari, basvuruEkle, basvuruGuncelle, basvuruSil,
  basvurulariTopluEkle, type BasvuruGirdisi,
} from '@/lib/db/basvuru-depo';
import { listeCozumle } from '@/lib/db/basvuru-aktar';
import { onar } from '@/lib/analiz/normalize';
import { kategoriGetir, yarismaGetir } from '@/lib/depo/depo';
import { kapi } from '@/lib/yetki/koordinasyon';

export async function GET(request: Request) {
  const yetkisiz = kapi(request);
  if (yetkisiz) return yetkisiz;

  const q = new URL(request.url).searchParams;
  return Response.json({
    basvurular: basvuruDurumlari(
      q.get('yarisma') ?? undefined,
      q.get('kategori') ?? undefined,
    ),
  });
}

interface Govde {
  yarismaId?: string;
  kategoriId?: string;
  /** Yapıştırılan liste — toplu aktarım. */
  liste?: string;
  /** Tek kayıt. */
  takim?: string;
  basvuruNo?: string;
  takimId?: string;
  proje?: string;
  eposta?: string;
}

export async function POST(request: Request) {
  const yetkisiz = kapi(request);
  if (yetkisiz) return yetkisiz;

  let g: Govde;
  try {
    g = (await request.json()) as Govde;
  } catch {
    return Response.json({ hata: 'İstek okunamadı.' }, { status: 400 });
  }

  if (!g.yarismaId) return Response.json({ hata: 'Yarışma seçilmedi.' }, { status: 400 });
  const yarisma = yarismaGetir(g.yarismaId);
  if (!yarisma) return Response.json({ hata: 'Yarışma bulunamadı.' }, { status: 404 });

  /*
   * KATEGORİ ZORUNLU. Başvuru bir kategoriye açılıyor çünkü şablon,
   * rubrik ve teslim tarihi kategoriye bağlı. Kategorisi olmayan bir
   * başvuru, yarışmacı rapor yüklemek istediğinde hangi şablonla
   * denetleneceği bilinmeyen bir kayıt olurdu.
   */
  if (!g.kategoriId) return Response.json({ hata: 'Kategori seçilmedi.' }, { status: 400 });
  const kategori = kategoriGetir(g.yarismaId, g.kategoriId);
  if (!kategori) return Response.json({ hata: 'Kategori bulunamadı.' }, { status: 404 });

  // TOPLU AKTARIM
  if (typeof g.liste === 'string' && g.liste.trim()) {
    /*
     * `onar()` BURADA ÇAĞRILMIYOR — ayrıştırıcı her alana kendisi
     * uyguluyor. Satırın tamamına uygulanırsa sekmeler tek boşluğa
     * düşüyor ve sütun yapısı yok oluyor.
     */
    const { satirlar, hatali } = listeCozumle(g.liste);
    if (!satirlar.length) {
      return Response.json(
        { hata: 'Listede okunabilir satır bulunamadı.', hatali },
        { status: 422 },
      );
    }
    const girdiler: BasvuruGirdisi[] = satirlar.map((s) => ({
      basvuruNo: s.basvuruNo,
      yarismaId: g.yarismaId!,
      kategoriId: g.kategoriId!,
      takim: s.takim,
      takimId: s.takimId,
      proje: s.proje,
      eposta: s.eposta,
    }));
    const { eklenen, atlanan } = basvurulariTopluEkle(girdiler, yarisma.yil);
    return Response.json({ eklenen, atlanan, hatali }, { status: 201 });
  }

  // TEK KAYIT
  const takim = onar(g.takim ?? '').trim();
  if (!takim) return Response.json({ hata: 'Takım adı gerekli.' }, { status: 400 });

  const b = basvuruEkle(
    {
      basvuruNo: g.basvuruNo?.trim(),
      yarismaId: g.yarismaId,
      kategoriId: g.kategoriId,
      takim,
      takimId: onar(g.takimId ?? '').trim() || undefined,
      proje: onar(g.proje ?? '').trim() || undefined,
      eposta: g.eposta?.trim() || undefined,
    },
    yarisma.yil,
  );
  return Response.json({ basvuru: b }, { status: 201 });
}

export async function PATCH(request: Request) {
  const yetkisiz = kapi(request);
  if (yetkisiz) return yetkisiz;

  let g: { id?: string; aktif?: boolean; takim?: string; proje?: string; eposta?: string };
  try {
    g = await request.json();
  } catch {
    return Response.json({ hata: 'İstek okunamadı.' }, { status: 400 });
  }
  if (!g.id) return Response.json({ hata: 'Başvuru belirtilmedi.' }, { status: 400 });

  const b = basvuruGuncelle(g.id, {
    aktif: g.aktif,
    takim: g.takim ? onar(g.takim).trim() : undefined,
    proje: g.proje !== undefined ? onar(g.proje).trim() : undefined,
    eposta: g.eposta !== undefined ? g.eposta.trim() : undefined,
  });
  if (!b) return Response.json({ hata: 'Başvuru bulunamadı.' }, { status: 404 });
  return Response.json({ basvuru: b });
}

export async function DELETE(request: Request) {
  const yetkisiz = kapi(request);
  if (yetkisiz) return yetkisiz;

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return Response.json({ hata: 'Başvuru belirtilmedi.' }, { status: 400 });

  const sonuc = basvuruSil(id);
  if (sonuc === 'yok') return Response.json({ hata: 'Başvuru bulunamadı.' }, { status: 404 });
  if (sonuc === 'raporu_var') {
    /*
     * 409: istek geçerli ama kaydın durumu buna izin vermiyor. Teslim
     * alınmış bir başvuruyu silmek raporu sahipsiz bırakırdı — "kim
     * teslim etti" sorusunun cevabı kaybolur.
     */
    return Response.json(
      {
        hata: 'Bu başvurunun yüklenmiş raporu var. Silmek yerine pasife alın.',
      },
      { status: 409 },
    );
  }
  return Response.json({ silindi: true });
}
