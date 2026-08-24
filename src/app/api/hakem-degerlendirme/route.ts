/**
 * Hakemin kendi değerlendirmesini kaydetmesi.
 *
 * POST · taslak kaydet ya da tamamla
 *
 * ── KİMLİK KODLA ────────────────────────────────────────────────────────
 * Hakem kendi erişim kodunu gönderiyor; sunucu koddan hakemi bulup atamayı
 * doğruluyor. Oturum yönetimi yok, dolayısıyla kod hem kimlik hem yetki.
 * Sınırı açık: kodu bilen o hakem adına puan girebilir. Kurum kimlik
 * sistemine bağlanana kadar geçerli bir vekil çözüm ve tek bir yerde
 * (`hakemKodIle`) toplanmış olduğu için değiştirmesi kolay.
 *
 * Atama denetimi burada da yapılıyor (depo katmanında da var): kodu doğru
 * olan hakem, kendisine ATANMAMIŞ bir rapora puan giremez.
 */

import { degerlendirmeKaydet, hakemKodIle, nihaiOzet } from '@/lib/db/hakem-depo';
import { kategoriGetir, mesajEkle, raporGetir, raporGuncelle } from '@/lib/depo/depo';

export async function POST(istek: Request) {
  let g: {
    kod?: string;
    raporId?: string;
    puanlar?: Array<{ kriterKodu: string; puan: number; not?: string }>;
    aciklama?: string;
    tamamla?: boolean;
  };
  try {
    g = await istek.json();
  } catch {
    return Response.json({ hata: 'İstek okunamadı.' }, { status: 400 });
  }

  if (!g.kod || !g.raporId) {
    return Response.json({ hata: 'Erişim kodu ve rapor gerekli.' }, { status: 400 });
  }

  const hakem = hakemKodIle(g.kod);
  if (!hakem) return Response.json({ hata: 'Erişim kodu geçersiz.' }, { status: 403 });
  if (!hakem.aktif) {
    return Response.json({ hata: 'Hesabınız pasif durumda.' }, { status: 403 });
  }

  const rapor = raporGetir(g.raporId);
  if (!rapor) return Response.json({ hata: 'Rapor bulunamadı.' }, { status: 404 });

  const kategori = kategoriGetir(rapor.yarismaId, rapor.kategoriId);
  if (!kategori) return Response.json({ hata: 'Kategori bulunamadı.' }, { status: 404 });

  const olcutler = new Map(kategori.rubrik.kriterler.map((k) => [k.kod, k]));

  /*
   * Puanlar sunucuda sınırlandırılıyor: istemciye güvenilmez. Ölçütün
   * azamisini aşan puan kırpılıyor, tanınmayan ölçüt atılıyor.
   */
  const temiz = (g.puanlar ?? [])
    .filter((p) => olcutler.has(p.kriterKodu))
    .map((p) => ({
      kriterKodu: p.kriterKodu,
      puan: Math.max(0, Math.min(olcutler.get(p.kriterKodu)!.puan, Number(p.puan) || 0)),
      not: p.not?.slice(0, 2000),
    }));

  const tamamla = g.tamamla === true;

  // Tamamlamak için BÜTÜN ölçütler puanlanmış olmalı.
  if (tamamla) {
    const eksik = kategori.rubrik.kriterler.filter(
      (k) => !temiz.some((p) => p.kriterKodu === k.kod),
    );
    if (eksik.length) {
      return Response.json(
        {
          hata: `${eksik.length} ölçüt puanlanmadı: ${eksik.map((k) => k.ad).join(', ')}`,
          eksik: eksik.map((k) => k.kod),
        },
        { status: 422 },
      );
    }
  }

  const { sonuc, hata } = degerlendirmeKaydet({
    raporId: rapor.id,
    hakemId: hakem.id,
    puanlar: temiz,
    aciklama: g.aciklama?.slice(0, 4000),
    tamamla,
  });
  if (hata || !sonuc) return Response.json({ hata }, { status: 422 });

  /*
   * NİHAİ PUAN HER TAMAMLAMADA YENİDEN TÜRETİLİYOR.
   *
   * Rapor "tamamlandı" sayılmak için ATANMIŞ BÜTÜN hakemlerin bitirmesi
   * gerekiyor. Bir hakem bitirdi diye raporu kapatmak, ikinci hakemin
   * değerlendirmesini anlamsız kılardı — ve yarışmacı portalı eksik
   * bilgiyle açılırdı.
   */
  const ozet = nihaiOzet(rapor.id);
  const hepsiBitti = ozet.atanan > 0 && ozet.tamamlanan >= ozet.atanan;

  await raporGuncelle(rapor.id, {
    hakemToplam: ozet.puan,
    durum: hepsiBitti ? 'tamamlandi' : rapor.durum,
    tamamlandi: hepsiBitti ? new Date().toISOString() : rapor.tamamlandi,
  });

  if (tamamla) {
    await mesajEkle(rapor.id, {
      yazar: 'Sistem',
      rol: 'sistem',
      metin:
        `${hakem.ad} değerlendirmesini tamamladı: ` +
        `${sonuc.toplam}/${kategori.rubrik.toplamPuan} puan. ` +
        (hepsiBitti
          ? `Bütün hakemler bitirdi — nihai puan ${ozet.puan}.`
          : `${ozet.atanan - ozet.tamamlanan} hakem bekleniyor.`),
      otomatikMi: true,
    });
  }

  return Response.json({
    degerlendirme: sonuc,
    ozet,
    raporTamamlandi: hepsiBitti,
  });
}
