/**
 * AKIŞ 01 — Yarışma Yöneticisi: yarışmayı ve kategorilerini tanımlar.
 *
 * Hiyerarşi: YARIŞMA → KATEGORİ → ŞABLON
 * Her kategori kendi şablonundan çıkarılır. Aynı yarışmanın iki kategorisi
 * tamamen farklı yapıda olabilir; TEKNOFEST şablonları böyle.
 *
 * POST  · yeni yarışma + ilk kategori (şablon dosyasıyla)
 * PATCH · var olan yarışmaya yeni kategori ekle
 * GET   · listele
 */

import { sablonCikar, rubrikCikar } from '@/lib/analiz/sablon-cikar';
import { KATEGORILER } from '@/lib/analiz/kategoriler';
import { onar } from '@/lib/analiz/normalize';
import {
  kategoriEkle,
  kimlik,
  yarismaGetir,
  yarismaKaydet,
  yarismalariListele,
} from '@/lib/depo/depo';
import type { Yarisma, YarismaKategorisi } from '@/lib/depo/tipler';

export const maxDuration = 60;

export async function GET() {
  return Response.json({ yarismalar: yarismalariListele() });
}

/** Bozuk kodlamayla gelen metni onarır — Türkçe karakter kaybolmasın. */
function metin(form: FormData, ad: string): string | undefined {
  const d = form.get(ad);
  if (typeof d !== 'string') return undefined;
  const t = onar(d).trim();
  return t || undefined;
}

/** Şablon dosyasından kategori üretir. */
async function kategoriKur(dosya: File, ad: string, yil: number) {
  const veri = new Uint8Array(await dosya.arrayBuffer());

  // .docx bir ZIP arşividir; ilk iki bayt "PK".
  if (!(veri[0] === 0x50 && veri[1] === 0x4b)) {
    throw new Error('Şablon Word (.docx) dosyası olmalıdır.');
  }

  const id = kimlik();
  const cikarim = sablonCikar(veri, `kategori-${id.slice(0, 8)}`, ad, yil);

  const kategori: YarismaKategorisi = {
    id,
    ad,
    sablonDosyasi: dosya.name,
    olusturuldu: new Date().toISOString(),
    duzenlendi: false,
    sablon: cikarim.sablon,
    kurallar: cikarim.kurallar,
    rubrik: rubrikCikar(cikarim),
    ornekKaynaklar: cikarim.ornekKaynaklar,
    uyarilar: cikarim.uyarilar,
  };
  return kategori;
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ hata: 'İstek okunamadı.' }, { status: 400 });
  }

  const dosya = form.get('sablon');
  if (!(dosya instanceof File) || dosya.size === 0) {
    return Response.json({ hata: 'Şablon dosyası bulunamadı.' }, { status: 400 });
  }

  const yil = Number(form.get('yil') ?? new Date().getFullYear());
  const kategoriAdi = metin(form, 'kategoriAdi') || dosya.name.replace(/\.docx$/i, '');
  const yarismaAdi = metin(form, 'ad') || kategoriAdi;

  try {
    const kategori = await kategoriKur(dosya, kategoriAdi, yil);

    const yarisma: Yarisma = {
      id: kimlik(),
      ad: yarismaAdi,
      yil,
      olusturuldu: new Date().toISOString(),
      kategoriler: [kategori],
      icerikKategorileri: KATEGORILER,
    };

    await yarismaKaydet(yarisma);
    return Response.json({ yarisma }, { status: 201 });
  } catch (e) {
    const mesaj = e instanceof Error ? e.message : String(e);
    return Response.json({ hata: `Şablon çözümlenemedi: ${mesaj}` }, { status: 422 });
  }
}

/** Var olan yarışmaya yeni kategori (ve şablonunu) ekler. */
export async function PATCH(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ hata: 'İstek okunamadı.' }, { status: 400 });
  }

  const yarismaId = metin(form, 'yarismaId');
  if (!yarismaId) return Response.json({ hata: 'Yarışma seçilmedi.' }, { status: 400 });

  const yarisma = yarismaGetir(yarismaId);
  if (!yarisma) return Response.json({ hata: 'Yarışma bulunamadı.' }, { status: 404 });

  const dosya = form.get('sablon');
  if (!(dosya instanceof File) || dosya.size === 0) {
    return Response.json({ hata: 'Şablon dosyası bulunamadı.' }, { status: 400 });
  }

  const kategoriAdi = metin(form, 'kategoriAdi') || dosya.name.replace(/\.docx$/i, '');

  try {
    const kategori = await kategoriKur(dosya, kategoriAdi, yarisma.yil);
    const guncel = await kategoriEkle(yarismaId, kategori);
    return Response.json({ yarisma: guncel, kategori }, { status: 201 });
  } catch (e) {
    const mesaj = e instanceof Error ? e.message : String(e);
    return Response.json({ hata: `Şablon çözümlenemedi: ${mesaj}` }, { status: 422 });
  }
}
