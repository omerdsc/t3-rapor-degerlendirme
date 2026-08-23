/**
 * Şartname özetlerini toplu hazırlar.
 *
 * GET  · maliyeti önceden söyler, hiçbir şey harcamaz
 * POST · tek bir kategorinin özetini üretir (istemci sırayla çağırır)
 *
 * NEDEN TEK İSTEKTE HEPSİ DEĞİL
 * 37 farklı şartname var; hepsini tek istekte özetlemek dakikalar sürer,
 * rota zaman aşımına düşer ve kullanıcı ne kadar harcandığını göremez.
 * Sırayla gidince her adımdan sonra harcanan tutar görünür ve kullanıcı
 * ortada durdurabilir — bütçesi sert sınırlı bir sistemde bu bir gereklilik.
 *
 * AYNI ŞARTNAME İKİ KEZ ÖZETLENMEZ
 * Bir yarışmanın kategorileri genelde AYNI şartnameyi paylaşıyor. Kategori
 * başına özetlemek aynı belgeyi 10 kez modele göndermek olurdu. Bu yüzden
 * özetlenecek liste şartname KAYNAĞINA göre tekilleştiriliyor; üretilen özet
 * o kaynağı paylaşan bütün kategorilere yazılıyor.
 */

import { join } from 'node:path';
import { ClaudeIstemcisi, ButceAsimiHatasi } from '@/lib/ai/istemci';
import { ozetiHazirla } from '@/lib/ai/ozet-hazirla';
import {
  kategoriGetir, sartnameKaydet, yarismaGetir, yarismalariListele,
} from '@/lib/depo/depo';

export const maxDuration = 300;

/** Özet başına ölçülen maliyet — arayüzde tahmin göstermek için. */
const BIRIM_MALIYET = 0.15;

interface Hedef {
  yarismaId: string;
  yarismaAdi: string;
  kategoriId: string;
  kategoriAdi: string;
  kaynakUrl: string;
}

/**
 * Özeti olmayan, kaynağı bilinen kategorileri kaynak URL'ine göre tekilleştirir.
 */
function hedefleriTopla(): { hedefler: Hedef[]; paylasan: number } {
  const gorulen = new Set<string>();
  const hedefler: Hedef[] = [];
  let paylasan = 0;

  for (const y of yarismalariListele()) {
    for (const k of y.kategoriler) {
      const s = k.sartname;
      if (!s || s.ozet || !s.kaynakUrl) continue;
      if (gorulen.has(s.kaynakUrl)) {
        paylasan++;
        continue;
      }
      gorulen.add(s.kaynakUrl);
      hedefler.push({
        yarismaId: y.id,
        yarismaAdi: y.ad,
        kategoriId: k.id,
        kategoriAdi: k.ad,
        kaynakUrl: s.kaynakUrl,
      });
    }
  }
  return { hedefler, paylasan };
}

export async function GET() {
  const { hedefler, paylasan } = hedefleriTopla();
  const hazir = yarismalariListele().reduce(
    (t, y) => t + y.kategoriler.filter((k) => k.sartname?.ozet).length,
    0,
  );

  return Response.json({
    hedefler: hedefler.map((h) => ({
      yarismaId: h.yarismaId,
      kategoriId: h.kategoriId,
      etiket: `${h.yarismaAdi} · ${h.kategoriAdi}`,
    })),
    farkliBelge: hedefler.length,
    ayniBelgeyiPaylasan: paylasan,
    ozetiHazirKategori: hazir,
    tahminiMaliyet: Number((hedefler.length * BIRIM_MALIYET).toFixed(2)),
    birimMaliyet: BIRIM_MALIYET,
  });
}

export async function POST(request: Request) {
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

  const istemci = new ClaudeIstemcisi({
    toplamTavan: Number(process.env.TOPLAM_TAVAN ?? 8),
    diskOnbellegi: join(process.cwd(), '.onbellek'),
  });

  try {
    const sonuc = await ozetiHazirla(yarisma, kategori, istemci);
    if (!sonuc.ozet) {
      return Response.json(
        { hata: sonuc.atlandi ?? 'Özet üretilemedi.' },
        { status: 422 },
      );
    }

    /*
     * AYNI ŞARTNAMEYİ PAYLAŞAN KATEGORİLERE DE YAZILIYOR.
     *
     * Üretilen özet ücretli. Aynı belgeyi paylaşan öteki kategoriler için
     * ikinci kez ödemek anlamsız; özet oraya da kopyalanıyor.
     */
    const kaynak = kategori.sartname?.kaynakUrl;
    let kopyalanan = 0;
    if (kaynak) {
      for (const y of yarismalariListele()) {
        for (const k of y.kategoriler) {
          if (k.id === kategoriId) continue;
          const s = k.sartname;
          if (!s || s.ozet || s.kaynakUrl !== kaynak) continue;
          await sartnameKaydet(y.id, k.id, { ...s, ozet: sonuc.ozet });
          kopyalanan++;
        }
      }
    }

    return Response.json({
      maliyet: sonuc.maliyet,
      kopyalanan,
      etiket: `${yarisma.ad} · ${kategori.ad}`,
    });
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
