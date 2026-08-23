/**
 * Rapor yükleme ve listeleme.
 *
 * Yükleme sırasında deterministik kontroller hemen koşar (MVP 1-2-3-4);
 * maliyeti sıfır olduğu için beklemeye değer. AI değerlendirmesi (MVP 6)
 * ayrı uç noktada — ücretli olduğu için hakem/yönetici tetikler.
 */

import { raporuAnalizEt } from '@/lib/analiz';
import { onar } from '@/lib/analiz/normalize';
import { bicimTespitEt } from '@/lib/analiz/belge-docx';
import { parmakiziCikar } from '@/lib/analiz/benzerlik';
import { kimlikCikar, kimlikKarsilastir } from '@/lib/analiz/kimlik';
import { parmakiziSakla } from '@/lib/analiz/parmakizi-depo';
import { benzerlikTazele } from '@/lib/analiz/benzerlik-tazele';
import {
  dosyaKaydet, kimlik, kategoriGetir, raporGetir, raporKaydet, raporlariListele,
  yarismaGetir,
} from '@/lib/depo/depo';
import type { Rapor } from '@/lib/depo/tipler';

/*
 * 60 saniye yetmiyor: kaynak doğrulama 15 künye için Crossref ve OpenAlex'e
 * sıralı sorgu atıyor (~10 sn) ve üstüne benzerlik tazelemesi geliyor.
 * Yükleme bir kez olan bir işlem; cömert bir sınır doğru bedel.
 */
export const maxDuration = 180;
const AZAMI_BOYUT = 25 * 1024 * 1024;

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  return Response.json({
    raporlar: raporlariListele(q.get('yarisma') ?? undefined, q.get('kategori') ?? undefined),
  });
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ hata: 'İstek okunamadı.' }, { status: 400 });
  }

  const yarismaId = form.get('yarismaId') as string | null;
  if (!yarismaId) return Response.json({ hata: 'Yarışma seçilmedi.' }, { status: 400 });

  const yarisma = yarismaGetir(yarismaId);
  if (!yarisma) return Response.json({ hata: 'Yarışma bulunamadı.' }, { status: 404 });

  // Şablon ve rubrik KATEGORİYE bağlı; hangi kategoriye yüklendiği zorunlu.
  const kategoriId = form.get('kategoriId') as string | null;
  if (!kategoriId) return Response.json({ hata: 'Kategori seçilmedi.' }, { status: 400 });

  const kategori = kategoriGetir(yarismaId, kategoriId);
  if (!kategori) return Response.json({ hata: 'Kategori bulunamadı.' }, { status: 404 });

  const dosya = form.get('dosya');
  if (!(dosya instanceof File) || dosya.size === 0) {
    return Response.json({ hata: 'Dosya bulunamadı.' }, { status: 400 });
  }
  if (dosya.size > AZAMI_BOYUT) {
    return Response.json({ hata: 'Dosya 25 MB sınırını aşıyor.' }, { status: 413 });
  }

  const veri = new Uint8Array(await dosya.arrayBuffer());
  const bicim = bicimTespitEt(veri);
  if (bicim === 'bilinmiyor') {
    return Response.json(
      { hata: 'Dosya biçimi tanınmadı. Rapor PDF veya Word (.docx) olmalıdır.' },
      { status: 415 },
    );
  }

  const id = kimlik();

  // Gelen metin alanları bozuk kodlamayla gelebilir (yanlış Content-Type,
  // eski istemci, kabuk üzerinden yükleme). onar() mojibake ve ayrık aksanı
  // düzeltir — Türkçe alanlar depoya bozuk yazılmasın.
  const alan = (ad: string): string | undefined => {
    const d = form.get(ad);
    if (typeof d !== 'string') return undefined;
    const t = onar(d).trim();
    return t || undefined;
  };

  /*
   * KAYNAK DOĞRULAMA YÜKLEMEDE AÇIK.
   *
   * Bu, sistemin varlık nedeninin merkezinde: raporlar yapay zekâ ile
   * yazıldığında kaynakça uydurulabiliyor — künye düzgün görünür ama o
   * yayın hiç yoktur. Motor yazılmıştı ama akışa bağlı DEĞİLDİ; yani
   * hakem hiçbir zaman bu bulguyu görmüyordu.
   *
   * Varsayılan neden açık: kapalı olduğunda kaynaklar "atlandı" olarak
   * kalıyor ve bu sessiz bir boşluk. Ölçüm: 15 kaynaklık bir kaynakça
   * ~10 saniye (Crossref + OpenAlex, sıralı). Yükleme bir kez oluyor;
   * on saniye kabul edilebilir bir bedel.
   *
   * GİZLİLİK: dışarıya yalnızca kaynak BAŞLIKLARI gidiyor, raporun
   * içeriği hiçbir yere gönderilmiyor. İletişim adresi ortam
   * değişkeninden okunuyor — kullanıcının kişisel e-postası koda
   * gömülmüyor ve varsayılan olarak dışarıya çıkmıyor.
   */
  const sonuc = await raporuAnalizEt(veri, {
    sablon: kategori.sablon,
    kategoriler: yarisma.icerikKategorileri,
    beyanEdilenKategori: alan('icerikKategori'),
    kaynakDogrula: process.env.KAYNAK_DOGRULA !== 'kapali',
    dogrulamaIletisim: process.env.DOGRULAMA_ILETISIM,
  });

  /*
   * Kapaktan kimlik okuma — ücretsiz, yerel.
   *
   * Her raporda sonuç vermiyor (kapağı tabloya/görsele gömülü raporlarda
   * metin katmanında alan yok). Bulunmaması bir kusur olarak işlenmiyor;
   * yalnızca "okunamadı" denir.
   */
  // Ad `kimlik` DEĞİL: depodaki kimlik() üreticisiyle çakışıyor.
  const kapakKimligi = sonuc.belge ? kimlikCikar(sonuc.belge) : undefined;
  const basvuruNo = alan('basvuruNo') || `TF-${id.slice(0, 8).toUpperCase()}`;
  const takim = alan('takim') || 'Belirtilmemiş';
  const takimId = alan('takimId') || id.slice(0, 8);
  const proje = alan('proje') || dosya.name.replace(/\.(pdf|docx)$/i, '');

  const rapor: Rapor = {
    id,
    yarismaId,
    kategoriId,
    basvuruNo,
    dosyaAdi: dosya.name,
    takim,
    takimId,
    proje,
    raporKimligi: kapakKimligi,
    kimlikUyusmazligi: kapakKimligi
      ? kimlikKarsilastir(kapakKimligi, { takim, takimId, basvuruNo, proje })
      : undefined,
    icerikKategoriKodu: alan('icerikKategori'),
    yuklendi: new Date().toISOString(),
    // Okunamayan veya taranmış rapor doğrudan manuel incelemeye düşer.
    durum: !sonuc.basarili || sonuc.istatistik.taranmisMi ? 'manuel_inceleme' : 'hakem_bekliyor',
    kontroller: sonuc.kontroller,
    genelDurum: sonuc.genelDurum,
    // Doğrulama özeti kaydediliyor: hakem tek tek künyeyi görebilmeli.
    kaynakDogrulamasi: sonuc.kaynakDogrulamasi,
    istatistik: {
      sayfaSayisi: sonuc.istatistik.sayfaSayisi,
      kelimeSayisi: sonuc.istatistik.kelimeSayisi,
      gorselSayisi: sonuc.istatistik.gorselSayisi,
      baslikSayisi: sonuc.istatistik.baslikSayisi,
      taranmisMi: sonuc.istatistik.taranmisMi,
      sureMs: sonuc.istatistik.sureMs,
    },
    dosyaYolu: bicim === 'pdf' ? dosyaKaydet(id, veri) : undefined,
    /*
     * Parmakizi burada, yükleme anında çıkarılıyor.
     *
     * Belge zaten ayrıştırılmış durumda elimizde; ikinci bir maliyeti yok.
     * Kategori kodu olarak YARIŞMA KATEGORİSİ kullanılıyor, beyan edilen
     * içerik alanı değil: benzerlik tabanı aynı şablonu paylaşan raporlar
     * arasında anlamlı, beyan yanlış olabilir.
     */
    parmakizi: sonuc.belge
      ? parmakiziSakla(
          parmakiziCikar(
            sonuc.belge,
            {
              raporId: id,
              takimId,
              kategoriKodu: kategoriId,
              yil: yarisma.yil,
            },
            kategori.sablon,
          ),
        )
      : undefined,
  };

  await raporKaydet(rapor);

  /*
   * BENZERLİK KORPUSA BAĞLI — KATEGORİNİN TAMAMI TAZELENİYOR
   *
   * Yeni rapor yalnızca kendi bulgusunu doğurmuyor; ÖNCEDEN yüklenmiş
   * raporların benzerlik durumunu da değiştiriyor. Tazelemezsek ilk rapor
   * "temiz" olarak kalır ve kopya sessizce kaçar.
   *
   * Maliyeti $0 ve yerel. Hata verse bile yükleme başarılı sayılır:
   * raporu kaybetmek, bir kontrolü geciktirmekten kötüdür.
   */
  let benzerlik: Awaited<ReturnType<typeof benzerlikTazele>> | null = null;
  try {
    benzerlik = await benzerlikTazele(yarismaId, kategoriId);
  } catch {
    benzerlik = null;
  }

  // Tazeleme raporun kaydını değiştirmiş olabilir; güncel hali okunuyor.
  const guncel = raporGetir(rapor.id) ?? rapor;
  return Response.json({ rapor: guncel, benzerlik }, { status: 201 });
}
