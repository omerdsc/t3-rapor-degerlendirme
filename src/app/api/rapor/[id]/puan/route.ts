/**
 * AKIŞ 02 son adımı — hakem nihai değerlendirmeyi tamamlar.
 *
 * Rapor ancak burada "tamamlandi" durumuna geçer; yarışmacı ekranı da ancak
 * o zaman açılır (AKIŞ 03).
 */

import { kategoriGetir, mesajEkle, raporGetir, raporGuncelle } from '@/lib/depo/depo';
import type { HakemPuani } from '@/lib/depo/tipler';

export async function POST(request: Request, ctx: RouteContext<'/api/rapor/[id]/puan'>) {
  const { id } = await ctx.params;

  const rapor = raporGetir(id);
  if (!rapor) return Response.json({ hata: 'Rapor bulunamadı.' }, { status: 404 });

  const kategori = kategoriGetir(rapor.yarismaId, rapor.kategoriId);
  if (!kategori) return Response.json({ hata: 'Kategori bulunamadı.' }, { status: 404 });

  let gövde: {
    puanlar?: HakemPuani[];
    not?: string;
    tamamla?: boolean;
    hakemAdi?: string;
  };
  try {
    gövde = await request.json();
  } catch {
    return Response.json({ hata: 'Geçersiz istek gövdesi.' }, { status: 400 });
  }

  const puanlar = gövde.puanlar ?? [];
  const kriterler = new Map(kategori.rubrik.kriterler.map((k) => [k.kod, k]));

  // Puanlar kriterin azamisini aşamaz; istemciye güvenilmez.
  const temiz: HakemPuani[] = [];
  for (const p of puanlar) {
    const k = kriterler.get(p.kriterKodu);
    if (!k) continue;
    temiz.push({
      kriterKodu: p.kriterKodu,
      puan: Math.max(0, Math.min(k.puan, Number(p.puan) || 0)),
      not: p.not?.slice(0, 2000),
    });
  }

  const tamamla = gövde.tamamla === true;
  const hakemAdi = gövde.hakemAdi?.trim().slice(0, 80) || undefined;

  /*
   * TAMAMLAMA HAKEM ADI OLMADAN YAPILAMAZ.
   *
   * Puanı kimin verdiği kayıtlı değilse itiraz süreci yürütülemez. Taslak
   * kaydetmek serbest — çalışma yarım kalabilir; ama "tamamlandı" demek
   * sorumluluk üstlenmektir ve imzasız olamaz.
   */
  if (tamamla && !hakemAdi) {
    return Response.json(
      { hata: 'Değerlendirmeyi tamamlamak için hakem adı gerekli.' },
      { status: 422 },
    );
  }

  if (tamamla) {
    const eksik = kategori.rubrik.kriterler.filter(
      (k) => !temiz.some((p) => p.kriterKodu === k.kod),
    );
    if (eksik.length) {
      return Response.json(
        {
          hata: `${eksik.length} kriter puanlanmamış: ${eksik.map((k) => k.ad).join(', ')}`,
          eksik: eksik.map((k) => k.kod),
        },
        { status: 422 },
      );
    }
  }

  // Tamamlama bir olaydır; yazışma akışına otomatik kayıt düşülür ki
  // koordinasyon kimin ne zaman bitirdiğini rapora bakmadan görebilsin.
  if (tamamla) {
    await mesajEkle(id, {
      yazar: 'Sistem',
      rol: 'sistem',
      metin:
        `Nihai değerlendirme tamamlandı — ${hakemAdi}. ` +
        `Toplam ${temiz.reduce((t, p) => t + p.puan, 0)}/${kategori.rubrik.toplamPuan} puan.`,
      otomatikMi: true,
    });
  }

  const guncel = await raporGuncelle(id, {
    hakemPuanlari: temiz,
    hakemToplam: temiz.reduce((t, p) => t + p.puan, 0),
    hakemNotu: gövde.not?.slice(0, 4000),
    durum: tamamla ? 'tamamlandi' : rapor.durum,
    tamamlandi: tamamla ? new Date().toISOString() : rapor.tamamlandi,
    // Taslak kaydında da tutuluyor: yarım kalan işin sahibi belli olsun.
    hakemAdi: hakemAdi ?? rapor.hakemAdi,
  });

  return Response.json({ rapor: guncel });
}
