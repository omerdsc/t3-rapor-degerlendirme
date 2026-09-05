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
 * olan hakem, kendisine ATANMAMIŞ bir rapora puan giremez. Denetim
 * sırası önemli — yetki her doğrulamadan ÖNCE, yoksa reddedilen istek
 * bile bilgi sızdırır.
 */

import {
  degerlendirmeKaydet, hakemKodIle, hakeminRaporlari, nihaiOzet,
} from '@/lib/db/hakem-depo';
import { kategoriGetir, mesajEkle, raporGetir, raporGuncelle } from '@/lib/depo/depo';

export async function POST(istek: Request) {
  let g: {
    kod?: string;
    raporId?: string;
    puanlar?: Array<{ kriterKodu: string; puan: number; not?: string }>;
    aciklama?: string;
    geriBildirim?: {
      gucluYonler?: unknown;
      gelisimAlanlari?: unknown;
      oneriler?: unknown;
    };
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

  /*
   * YETKİ, DOĞRULAMADAN ÖNCE.
   *
   * Bu denetim eskiden aşağıdaydı — depo katmanında (`degerlendirmeKaydet`)
   * yapıldığı için veri güvendeydi, ama sıra yanlıştı: atanmamış rapora
   * puan gönderen hakem önce "8 ölçüt puanlanmadı: PROJE ÖZETİ, …" yanıtı
   * alıyordu. Yani kaydetmeyi reddettiğimiz raporun ölçüt listesini
   * öğreniyordu. Rubrikler şartnameden zaten açık, o yüzden sızan bilgi
   * ağır değil; ama yetkisi olmayan istekten hiçbir şey öğrenilmemesi
   * kuralı ucuz ve sıraya bağlı.
   *
   * "Rapor yok" ile "rapor size atanmamış" da tek yanıta indirildi:
   * ikisini ayırmak, hakemin var olan rapor kimliklerini tarayarak
   * öğrenmesine izin verirdi.
   */
  if (!hakeminRaporlari(hakem.id).includes(g.raporId)) {
    return Response.json(
      { hata: 'Bu rapor size atanmamış.' },
      { status: 403 },
    );
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

  /*
   * GERİ BİLDİRİM DE SUNUCUDA TEMİZLENİYOR.
   *
   * Bu metinler yarışmacı ekranına basılacak; istemciden geldiği gibi
   * kabul edilemez. Dize olmayanlar atılıyor, uzunluk sınırlanıyor,
   * madde sayısı sınırlanıyor (bir hakem 500 maddelik liste
   * göndermesin), tanınmayan ölçüt kodları düşüyor.
   */
  const metinListesi = (ham: unknown, azamiMadde: number): string[] =>
    (Array.isArray(ham) ? ham : [])
      .filter((x): x is string => typeof x === 'string')
      .map((x) => x.trim().slice(0, 1000))
      .filter(Boolean)
      .slice(0, azamiMadde);

  const oneriListesi = (ham: unknown) =>
    (Array.isArray(ham) ? ham : [])
      .filter(
        (x): x is { kriterKodu: string; metin: string } =>
          !!x && typeof x.kriterKodu === 'string' && typeof x.metin === 'string',
      )
      .filter((x) => olcutler.has(x.kriterKodu))
      .map((x) => ({ kriterKodu: x.kriterKodu, metin: x.metin.trim().slice(0, 1000) }))
      .filter((x) => x.metin)
      .slice(0, olcutler.size);

  const geriBildirim = {
    gucluYonler: metinListesi(g.geriBildirim?.gucluYonler, 12),
    gelisimAlanlari: metinListesi(g.geriBildirim?.gelisimAlanlari, 12),
    oneriler: oneriListesi(g.geriBildirim?.oneriler),
  };

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
    geriBildirim,
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
    /*
     * SİSTEM MESAJI NE AD NE DE TEK TEK PUAN SÖYLÜYOR.
     *
     * Eskiden "<hakem adı> değerlendirmesini tamamladı: 78/100 puan"
     * yazıyordu ve sistem mesajları kanal süzgecinden muaf — yani bu satırı
     * rapora atanmış BÜTÜN hakemler, kendi puanlarını vermeden önce
     * okuyordu. İki ayrı sızıntı aynı cümlede: hakemin kimliği (KVKK) ve
     * ötekinin puanı. İkincisi kör değerlendirmenin tamamını çözüyordu —
     * "arkadaşım 78 vermiş" bilgisiyle bakılan rapor bağımsız
     * değerlendirilmiş sayılmaz ve hakemler arası ayrışma ölçüsü anlamını
     * yitirir.
     *
     * Kalan bilgi durum bilgisi: kaç hakem kaldı. Kimin ne verdiğini
     * koordinasyon rapor ekranındaki değerlendirme tablosundan görüyor;
     * orası doğru yer, yazışma değil.
     */
    const bekleyen = ozet.atanan - ozet.tamamlanan;
    await mesajEkle(rapor.id, {
      yazar: 'Sistem',
      rol: 'sistem',
      metin: hepsiBitti
        ? (ozet.atanan === 1
            ? `Değerlendirme tamamlandı — puan ${ozet.puan}.`
            : `Atanmış ${ozet.atanan} hakemin hepsi değerlendirmesini `
              + `tamamladı — nihai puan ${ozet.puan}. Kurul yazışması açıldı.`)
        : `Bir hakem değerlendirmesini tamamladı. `
          + `${bekleyen} hakem bekleniyor.`,
      otomatikMi: true,
    });
  }

  return Response.json({
    degerlendirme: sonuc,
    ozet,
    raporTamamlandi: hepsiBitti,
  });
}
