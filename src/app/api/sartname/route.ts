/**
 * Şartname yükleme.
 *
 * Şablondan ayrı bir belge ve kategoriye bağlanır. İki aşama:
 *   1. Deterministik çıkarım — sayfa sınırı, takım kuralları, tarihler,
 *      aşamalar, eleyici hükümler, kategori adları. Modelsiz, $0.
 *   2. Tek seferlik AI özeti — hakemin puanlarken bilmesi gerekenler.
 *      Kurulumda bir kez, sonra her raporda bedava kullanılır.
 *
 * İkinci aşama isteğe bağlı (`ozetle=1`); bütçe koruması için varsayılan
 * kapalı.
 */

import { join } from 'node:path';
import { pdfOku } from '@/lib/analiz/pdf';
import { belgeKur } from '@/lib/analiz/yapi';
import { bicimTespitEt, docxOku } from '@/lib/analiz/belge-docx';
import { sartnameCozumle, kurallariBirlestir } from '@/lib/analiz/sartname';
import { sartnameOzetle } from '@/lib/ai/sartname-ozeti';
import { ClaudeIstemcisi, ButceAsimiHatasi } from '@/lib/ai/istemci';
import { kategoriGetir, sartnameKaydet, yarismaGetir } from '@/lib/depo/depo';

export const maxDuration = 300;
const AZAMI_BOYUT = 30 * 1024 * 1024;

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ hata: 'İstek okunamadı.' }, { status: 400 });
  }

  const yarismaId = form.get('yarismaId') as string | null;
  const kategoriId = form.get('kategoriId') as string | null;
  if (!yarismaId || !kategoriId) {
    return Response.json({ hata: 'Yarışma ve kategori gerekli.' }, { status: 400 });
  }

  const yarisma = yarismaGetir(yarismaId);
  const kategori = kategoriGetir(yarismaId, kategoriId);
  if (!yarisma || !kategori) {
    return Response.json({ hata: 'Kategori bulunamadı.' }, { status: 404 });
  }

  const dosya = form.get('sartname');
  if (!(dosya instanceof File) || dosya.size === 0) {
    return Response.json({ hata: 'Şartname dosyası bulunamadı.' }, { status: 400 });
  }
  if (dosya.size > AZAMI_BOYUT) {
    return Response.json({ hata: 'Dosya 30 MB sınırını aşıyor.' }, { status: 413 });
  }

  const veri = new Uint8Array(await dosya.arrayBuffer());
  const bicim = bicimTespitEt(veri);

  let belge;
  if (bicim === 'docx') {
    const okuma = docxOku(veri);
    if (!okuma.tamam) return Response.json({ hata: okuma.hata }, { status: 422 });
    belge = okuma.belge;
  } else if (bicim === 'pdf') {
    const okuma = await pdfOku(veri);
    if (!okuma.tamam) return Response.json({ hata: okuma.hata }, { status: 422 });
    belge = belgeKur(okuma.belge);
  } else {
    return Response.json(
      { hata: 'Şartname PDF veya Word (.docx) olmalıdır.' },
      { status: 415 },
    );
  }

  const cozum = sartnameCozumle(belge);
  const birlesik = kurallariBirlestir(
    kategori.sablon.asgariSayfa,
    kategori.sablon.azamiSayfa,
    cozum.kurallar,
  );

  // İkinci aşama: tek seferlik AI özeti. Bütçe koruması için istek üzerine.
  let ozet;
  let maliyet = 0;
  if (form.get('ozetle') === '1') {
    try {
      const istemci = new ClaudeIstemcisi({
        toplamTavan: Number(process.env.TOPLAM_TAVAN ?? 8),
        diskOnbellegi: join(process.cwd(), '.onbellek'),
      });
      const sonuc = await sartnameOzetle(cozum.metin, `${yarisma.ad} · ${kategori.ad}`, {
        istemci,
      });
      ozet = sonuc.ozet ?? undefined;
      maliyet = sonuc.kullanim.maliyet;
    } catch (e) {
      if (e instanceof ButceAsimiHatasi) {
        return Response.json({ hata: e.message }, { status: 402 });
      }
      // Özet başarısız olsa da deterministik çıkarım kaydedilir.
      cozum.uyarilar.push('AI özeti üretilemedi; deterministik kurallar kaydedildi.');
    }
  }

  const guncel = await sartnameKaydet(yarismaId, kategoriId, {
    dosyaAdi: dosya.name,
    yuklendi: new Date().toISOString(),
    sayfaSayisi: cozum.sayfaSayisi,
    kelimeSayisi: cozum.kelimeSayisi,
    kurallar: cozum.kurallar,
    ozet,
    catismalar: birlesik.catisma,
    uyarilar: cozum.uyarilar,
  });

  return Response.json({ kategori: guncel, maliyet }, { status: 201 });
}

/**
 * Kayıtlı şartnameden AI özeti üretir — dosya yüklemeden.
 *
 * NEDEN AYRI BİR UÇ
 * Katalogdan aktarım şartnameyi indirip çözümlüyor ama AI özetini bilerek
 * üretmiyor (ücretli adım). Sonuç: yönetici katalogdan gelen bir kategoride
 * özet isteyince dosyayı ELLE yeniden yüklemek zorunda kalıyordu — oysa
 * dosya zaten teknofest.org'da ve kaynağı kayıtlı.
 *
 * Metin depoda saklanmıyor (30 sayfalık şartnameyi her kategori kaydına
 * gömmek dosyayı şişirir), bu yüzden kaynaktan yeniden indirilip
 * çözümleniyor. İndirme ücretsiz; ücretli olan yalnızca özet çağrısı.
 */
export async function PATCH(request: Request) {
  let govde: { yarismaId?: string; kategoriId?: string };
  try {
    govde = await request.json();
  } catch {
    return Response.json({ hata: 'İstek okunamadı.' }, { status: 400 });
  }
  const { yarismaId, kategoriId } = govde;
  if (!yarismaId || !kategoriId) {
    return Response.json({ hata: 'Yarışma ve kategori gerekli.' }, { status: 400 });
  }

  const yarisma = yarismaGetir(yarismaId);
  const kategori = kategoriGetir(yarismaId, kategoriId);
  if (!yarisma || !kategori) {
    return Response.json({ hata: 'Kategori bulunamadı.' }, { status: 404 });
  }

  const mevcut = kategori.sartname;
  if (!mevcut) {
    return Response.json({ hata: 'Bu kategoride şartname yok.' }, { status: 422 });
  }
  if (mevcut.ozet) {
    // Özet zaten var: ikinci çağrı bedava değil, engelleniyor.
    return Response.json({ kategori, maliyet: 0, zatenVar: true });
  }
  if (!mevcut.kaynakUrl) {
    return Response.json(
      { hata: 'Şartnamenin kaynağı kayıtlı değil; dosyayı yükleyerek özetleyin.' },
      { status: 422 },
    );
  }

  let veri: Uint8Array;
  try {
    const yanit = await fetch(mevcut.kaynakUrl, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
    });
    if (!yanit.ok) throw new Error(`kaynak ${yanit.status}`);
    veri = new Uint8Array(await yanit.arrayBuffer());
  } catch (e) {
    return Response.json(
      { hata: `Şartname kaynaktan indirilemedi: ${e instanceof Error ? e.message : 'hata'}` },
      { status: 502 },
    );
  }

  const bicim = bicimTespitEt(veri);
  let belge;
  if (bicim === 'docx') {
    const okuma = docxOku(veri);
    if (!okuma.tamam) return Response.json({ hata: okuma.hata }, { status: 422 });
    belge = okuma.belge;
  } else if (bicim === 'pdf') {
    const okuma = await pdfOku(veri);
    if (!okuma.tamam) return Response.json({ hata: okuma.hata }, { status: 422 });
    belge = belgeKur(okuma.belge);
  } else {
    return Response.json({ hata: 'Şartname biçimi tanınmadı.' }, { status: 415 });
  }

  const cozum = sartnameCozumle(belge);

  try {
    const istemci = new ClaudeIstemcisi({
      toplamTavan: Number(process.env.TOPLAM_TAVAN ?? 8),
      diskOnbellegi: join(process.cwd(), '.onbellek'),
    });
    const sonuc = await sartnameOzetle(
      cozum.metin,
      `${yarisma.ad} · ${kategori.ad}`,
      { istemci },
    );
    if (!sonuc.ozet) {
      return Response.json({ hata: 'Özet üretilemedi.' }, { status: 502 });
    }

    // Deterministik kurallar KORUNUYOR: yalnızca özet ekleniyor. Yeniden
    // çözümleme kuralları da tazeler ama yöneticinin gördüğü değerler
    // değişmesin — özet istemek kural değiştirmek değildir.
    const guncel = await sartnameKaydet(yarismaId, kategoriId, {
      ...mevcut,
      ozet: sonuc.ozet,
    });
    return Response.json({ kategori: guncel, maliyet: sonuc.kullanim.maliyet });
  } catch (e) {
    if (e instanceof ButceAsimiHatasi) {
      return Response.json({ hata: e.message }, { status: 402 });
    }
    return Response.json(
      { hata: e instanceof Error ? e.message : 'Özet başarısız.' },
      { status: 500 },
    );
  }
}
