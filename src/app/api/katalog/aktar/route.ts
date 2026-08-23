/**
 * Katalogdan depoya aktarım.
 *
 * Seçilen yarışmanın şablonlarını ve şartnamelerini teknofest.org CDN'inden
 * indirir, çözümler, yarışmayı kategorileriyle kurar.
 *
 * MALİYET: $0. Hiçbir yapay zekâ çağrısı yapılmaz.
 * AI şartname özeti AYRI bir adımdır (`/api/sartname`, kategori başına
 * $0.19) ve yönetici istemedikçe çalışmaz. Aktarımın kendisi bedava
 * olmasa, 60 yarışmalık katalog kullanılamaz hale gelirdi.
 *
 * ÇÖZÜMLEME BAŞARISIZ OLABİLİR — VE OLMASI SORUN DEĞİL
 * TEKNOFEST şablonlarının biçimi tutarsız: bazıları .doc, bazıları taranmış
 * PDF, bazıları tabloya gömülü. Bir kategori çözümlenemezse ATLANIR ve
 * nedeni bildirilir; öteki kategoriler aktarılır. Tek bozuk şablonun bütün
 * aktarımı düşürmesi, kullanılabilir 9 kategoriyi de kaybettirir.
 */

import { rubrikCikar, sablonCikar } from '@/lib/analiz/sablon-cikar';
import { KATEGORILER } from '@/lib/analiz/kategoriler';
import { bicimTespitEt, docxOku } from '@/lib/analiz/belge-docx';
import { pdfOku } from '@/lib/analiz/pdf';
import { belgeKur } from '@/lib/analiz/yapi';
import { kurallariBirlestir, sartnameCozumle } from '@/lib/analiz/sartname';
import { katalogYarismasiGetir } from '@/lib/katalog/depo';
import { aktarimPlaniKur, belgeIndir, type AktarimKategorisi } from '@/lib/katalog/aktar';
import {
  kimlik, sartnameKaydet, yarismaKaydet, yarismalariListele,
} from '@/lib/depo/depo';
import type { Yarisma, YarismaKategorisi } from '@/lib/depo/tipler';
import type { KatalogBelgesi } from '@/lib/katalog/tipler';

/** 10 kategorili Roket'te 20+ dosya indirilebiliyor. */
export const maxDuration = 300;

/** Şartnameyi çözümler; PDF ve .docx kabul eder. */
async function sartnameCoz(belge: KatalogBelgesi) {
  const veri = await belgeIndir(belge);
  const bicim = bicimTespitEt(veri);

  if (bicim === 'docx') {
    const okuma = docxOku(veri);
    if (!okuma.tamam) throw new Error(okuma.hata);
    return sartnameCozumle(okuma.belge);
  }
  if (bicim === 'pdf') {
    const okuma = await pdfOku(veri);
    if (!okuma.tamam) throw new Error(okuma.hata);
    return sartnameCozumle(belgeKur(okuma.belge));
  }
  throw new Error('şartname PDF veya .docx olmalı');
}

/** Bir kategoriyi şablonundan kurar. */
async function kategoriKur(
  hedef: AktarimKategorisi,
  yil: number,
): Promise<YarismaKategorisi> {
  const veri = await belgeIndir(hedef.sablon);

  // .docx bir ZIP arşividir; ilk iki bayt "PK". Şablon çıkarıcı yalnızca
  // .docx okuyor: stil bilgisi (w:pStyle) başlık tespitinin temeli ve PDF'te
  // o bilgi yok.
  if (!(veri[0] === 0x50 && veri[1] === 0x4b)) {
    throw new Error(
      `şablon Word (.docx) değil (.${hedef.sablon.uzanti}) — elle yüklenmeli`,
    );
  }

  const id = kimlik();
  const cikarim = sablonCikar(veri, `kategori-${id.slice(0, 8)}`, hedef.ad, yil);

  return {
    id,
    ad: hedef.ad,
    sablonDosyasi: hedef.sablon.dosyaAdi,
    asama: hedef.asama,
    olusturuldu: new Date().toISOString(),
    duzenlendi: false,
    sablon: cikarim.sablon,
    kurallar: cikarim.kurallar,
    rubrik: rubrikCikar(cikarim),
    ornekKaynaklar: cikarim.ornekKaynaklar,
    uyarilar: cikarim.uyarilar,
  };
}

export async function POST(request: Request) {
  let govde: { slug?: string; kategoriler?: string[]; yenidenAktar?: boolean };
  try {
    govde = await request.json();
  } catch {
    return Response.json({ hata: 'İstek okunamadı.' }, { status: 400 });
  }

  const slug = govde.slug;
  if (!slug) return Response.json({ hata: 'Yarışma seçilmedi.' }, { status: 400 });

  const katalogYarismasi = katalogYarismasiGetir(slug);
  if (!katalogYarismasi) {
    return Response.json({ hata: 'Yarışma katalogda bulunamadı.' }, { status: 404 });
  }

  /*
   * YİNELENEN AKTARIM KORUMASI
   *
   * "Tümünü aktar" düğmesine ikinci kez basmak, 42 yarışmanın ikinci bir
   * kopyasını üretirdi: aynı adla iki kayıt, hangisinin hakem puanlarını
   * taşıdığı belirsiz. Aynı ad ve yıl zaten varsa aktarım yapılmaz ve mevcut
   * kaydın kimliği döndürülür — arayüz "zaten aktarılmış" diyebilir.
   *
   * Yeniden aktarmak isteyen yönetici önce mevcut yarışmayı silmeli; bu
   * bilinçli bir engel, çünkü silme hakem puanlarını da götürür.
   */
  const yil = new Date().getFullYear();
  const plan = aktarimPlaniKur(katalogYarismasi, yil, govde.kategoriler ?? []);

  const mevcut = yarismalariListele().find(
    (y) => y.ad === plan.yarismaAdi && y.yil === plan.yil,
  );
  if (mevcut && !govde.yenidenAktar) {
    return Response.json(
      {
        yarismaId: mevcut.id,
        ad: mevcut.ad,
        kategoriSayisi: mevcut.kategoriler.length,
        zatenVar: true,
        basarisiz: [],
        atlanan: [],
        sartnameUyarilari: [],
      },
      { status: 200 },
    );
  }
  if (!plan.kategoriler.length) {
    return Response.json(
      { hata: 'Bu yarışmada aktarılabilir rapor şablonu yok.' },
      { status: 422 },
    );
  }

  const kuruldu: YarismaKategorisi[] = [];
  const basarisiz: Array<{ ad: string; neden: string }> = [];
  // Şartnameler kategori kurulduktan SONRA bağlanıyor; kategori kurulmazsa
  // şartnameyi indirmek boşa iş olur.
  const sartnameIsleri: Array<{ kategoriId: string; hedef: AktarimKategorisi }> = [];

  for (const hedef of plan.kategoriler) {
    try {
      const kategori = await kategoriKur(hedef, plan.yil);
      kuruldu.push(kategori);
      if (hedef.sartname || hedef.teknikSartname) {
        sartnameIsleri.push({ kategoriId: kategori.id, hedef });
      }
    } catch (e) {
      basarisiz.push({
        ad: hedef.ad,
        neden: e instanceof Error ? e.message : 'çözümlenemedi',
      });
    }
  }

  if (!kuruldu.length) {
    return Response.json(
      { hata: 'Hiçbir kategori çözümlenemedi.', basarisiz },
      { status: 422 },
    );
  }

  const yarisma: Yarisma = {
    id: kimlik(),
    ad: plan.yarismaAdi,
    // Kaynak saklanıyor: gelecek yıl şablonlar değiştiğinde yerinde
    // güncelleme yapılabilsin, silip yeniden kurmak gerekmesin.
    katalogSlug: slug,
    yil: plan.yil,
    olusturuldu: new Date().toISOString(),
    kategoriler: kuruldu,
    icerikKategorileri: KATEGORILER,
  };
  await yarismaKaydet(yarisma);

  // Şartnameleri bağla. Teknik şartname varsa O tercih edilir: genel şartname
  // "puanlandırma sistematiğinin detayları teknik şartnamede açıklanacaktır"
  // diyor, yani değerlendirme için asıl belge teknik olanıdır.
  const sartnameUyarilari: string[] = [];
  for (const is of sartnameIsleri) {
    const belge = is.hedef.teknikSartname ?? is.hedef.sartname;
    if (!belge) continue;
    try {
      const cozum = await sartnameCoz(belge);
      const kategori = kuruldu.find((k) => k.id === is.kategoriId);
      const birlesik = kurallariBirlestir(
        kategori?.sablon.asgariSayfa,
        kategori?.sablon.azamiSayfa,
        cozum.kurallar,
      );
      await sartnameKaydet(yarisma.id, is.kategoriId, {
        dosyaAdi: belge.dosyaAdi,
        yuklendi: new Date().toISOString(),
        sayfaSayisi: cozum.sayfaSayisi,
        kelimeSayisi: cozum.kelimeSayisi,
        kurallar: cozum.kurallar,
        // AI özeti YOK: ücretli adım, yönetici kategori sayfasından başlatır.
        catismalar: birlesik.catisma,
        uyarilar: cozum.uyarilar,
        // Kaynak saklanıyor ki özet sonradan dosya yüklemeden üretilebilsin.
        kaynakUrl: belge.url,
        teknikMi: belge.tur === 'teknik_sartname' ? true : undefined,
      });
    } catch (e) {
      sartnameUyarilari.push(
        `${is.hedef.ad}: şartname çözümlenemedi (${e instanceof Error ? e.message : 'hata'})`,
      );
    }
  }

  return Response.json(
    {
      yarismaId: yarisma.id,
      ad: yarisma.ad,
      kategoriSayisi: kuruldu.length,
      basarisiz,
      atlanan: plan.atlanan,
      sartnameUyarilari,
    },
    { status: 201 },
  );
}
