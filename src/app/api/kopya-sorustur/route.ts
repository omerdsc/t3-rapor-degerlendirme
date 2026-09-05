/**
 * Kopya soruşturma ajanı tetikleyicisi — ÜCRETLİ uç nokta.
 *
 * Kasten çift bazında: bir kategoride otuz işaretli çift olabiliyor ve
 * hepsini otomatik soruşturmak bütçeyi bir kategoride bitirirdi. Hangi
 * çiftin soruşturulmaya değdiğine koordinasyon karar veriyor — zaten
 * ekranda ölçümleri görüyor.
 */

import { kapi } from '@/lib/yetki/koordinasyon';
import { ClaudeIstemcisi, ButceAsimiHatasi } from '@/lib/ai/istemci';
import { kopyayiSorustur } from '@/lib/ai/kopya-ajani';
import { kopyaSorusturmasiKaydet } from '@/lib/db/kopya-sorusturma-depo';
import { parmakiziCoz } from '@/lib/analiz/parmakizi-depo';
import { onbellekDizini } from '@/lib/yol';
import {
  kategoriGetir, parmakizliRaporlar, raporGetir,
} from '@/lib/depo/depo';

export const maxDuration = 300;

export async function POST(istek: Request) {
  const yetkisiz = kapi(istek);
  if (yetkisiz) return yetkisiz;

  let g: { a?: string; b?: string };
  try {
    g = await istek.json();
  } catch {
    return Response.json({ hata: 'Geçersiz istek gövdesi.' }, { status: 400 });
  }
  if (!g.a || !g.b || g.a === g.b) {
    return Response.json({ hata: 'İki farklı rapor kimliği gerekiyor.' }, { status: 400 });
  }

  const ra = raporGetir(g.a);
  const rb = raporGetir(g.b);
  if (!ra || !rb) return Response.json({ hata: 'Rapor bulunamadı.' }, { status: 404 });
  if (!ra.parmakizi || !rb.parmakizi) {
    return Response.json(
      { hata: 'Raporlardan birinin parmak izi yok; soruşturma yapılamaz.' },
      { status: 409 },
    );
  }

  /*
   * KORPUS AYNI KATEGORİDEN.
   *
   * Yaygınlık ölçüsü "bu cümle kaç raporda geçiyor" diyor ve bu sayının
   * anlamı karşılaştırıldığı kümeye bağlı. Bütün yarışmaların bütün
   * raporları alınsaydı, kategoriye özgü bir kalıp cümle "yalnızca iki
   * raporda" görünür ve kopya kanıtı sanılırdı. Kalıbı kalıp yapan şey
   * AYNI ŞARTNAMEYİ paylaşmak.
   */
  const korpus = parmakizliRaporlar(ra.yarismaId, ra.kategoriId)
    .map((x) => x.rapor)
    .filter((r) => r.parmakizi)
    .map((r) => parmakiziCoz(r.parmakizi!));

  const kategori = kategoriGetir(ra.yarismaId, ra.kategoriId);
  const istemci = new ClaudeIstemcisi({ diskOnbellegi: onbellekDizini() });

  try {
    const sonuc = await kopyayiSorustur(
      istemci,
      parmakiziCoz(ra.parmakizi),
      parmakiziCoz(rb.parmakizi),
      korpus,
      {
        a: {
          raporId: ra.id, proje: ra.proje ?? ra.dosyaAdi, takim: ra.takim ?? '—',
          yil: ra.parmakizi.yil, kategori: kategori?.ad ?? '—', basvuruNo: ra.basvuruNo,
        },
        b: {
          raporId: rb.id, proje: rb.proje ?? rb.dosyaAdi, takim: rb.takim ?? '—',
          yil: rb.parmakizi.yil, kategori: kategori?.ad ?? '—', basvuruNo: rb.basvuruNo,
        },
      },
    );

    kopyaSorusturmasiKaydet({
      aId: ra.id, bId: rb.id,
      durum: sonuc.durum, karar: sonuc.karar, adimlar: sonuc.adimlar,
      tur: sonuc.turSayisi, maliyet: sonuc.kullanim.maliyet, hata: sonuc.hata,
    });

    return Response.json({
      durum: sonuc.durum,
      karar: sonuc.karar,
      adimlar: sonuc.adimlar,
      tur: sonuc.turSayisi,
      maliyet: sonuc.kullanim.maliyet,
      korpusBoyu: korpus.length,
      hata: sonuc.hata,
    });
  } catch (e) {
    if (e instanceof ButceAsimiHatasi) {
      return Response.json({ hata: e.message }, { status: 402 });
    }
    return Response.json(
      { hata: `Soruşturma başarısız: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }
}
