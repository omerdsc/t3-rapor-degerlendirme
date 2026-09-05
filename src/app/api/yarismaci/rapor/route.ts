/**
 * Yarışmacının rapor yüklediği uç — hesap oturumuyla.
 *
 * Boru hattı koordinasyonunkiyle aynı (`raporuAl`): rapor hangi kapıdan
 * girerse girsin aynı altı kontrolden geçiyor. Değerlendirmenin eşitliği
 * buna bağlı.
 */

import { bicimiDenetle, dosyayiOku, raporuAl } from '@/lib/analiz/rapor-alma';
import { teslimPenceresi } from '@/lib/analiz/teslim-penceresi';
import { basvuruGetir } from '@/lib/db/basvuru-depo';
import { basvuruAsamasi } from '@/lib/db/basvuru-durum';
import { takimUyeleri } from '@/lib/db/yarismaci-depo';
import { kategoriGetir, raporSil, yarismaGetir } from '@/lib/depo/depo';
import { oturumSahibi } from '@/lib/yetki/yarismaci';

export const maxDuration = 180;

export async function POST(request: Request) {
  const y = oturumSahibi(request);
  if (!y) return Response.json({ hata: 'Oturum bulunamadı. Giriş yapın.' }, { status: 401 });

  const url = new URL(request.url);
  const basvuruId = url.searchParams.get('basvuru');
  if (!basvuruId) return Response.json({ hata: 'Başvuru belirtilmedi.' }, { status: 400 });

  const basvuru = basvuruGetir(basvuruId);
  if (!basvuru) return Response.json({ hata: 'Başvuru bulunamadı.' }, { status: 404 });

  /*
   * ERİŞİM TAKIM ÜYELİĞİNDEN.
   *
   * Başvuruyu kaptan açtı ama raporu takımın herhangi bir üyesi
   * yükleyebilmeli: son gün kaptan ulaşılamaz olabilir ve rapor takımın
   * ortak işi. Yükleme yetkisini kaptanla sınırlamak, sistemin çözmeye
   * çalıştığı "tek kişiye bağlı darboğaz" sorununu takım ölçeğinde
   * yeniden yaratırdı.
   */
  const uye = basvuru.takimKaydiId
    ? takimUyeleri(basvuru.takimKaydiId).some((u) => u.yarismaciId === y.id)
    : basvuru.yarismaciId === y.id;
  if (!uye) {
    // 404: erişilemeyen bir başvurunun varlığını sızdırmıyoruz.
    return Response.json({ hata: 'Başvuru bulunamadı.' }, { status: 404 });
  }

  const yarisma = yarismaGetir(basvuru.yarismaId);
  const kategori = yarisma ? kategoriGetir(basvuru.yarismaId, basvuru.kategoriId) : null;
  if (!yarisma || !kategori) {
    return Response.json(
      { hata: 'Başvurunuzun bağlı olduğu kategori bulunamadı.' },
      { status: 409 },
    );
  }

  const pencere = teslimPenceresi(kategori.sartname?.kurallar.tarihler, kategori.asama);
  if (!pencere.acik) {
    return Response.json({ hata: pencere.sebep, teslim: pencere.teslim }, { status: 403 });
  }

  const durum = basvuruAsamasi(basvuru.id);
  if (durum.kilitli) {
    return Response.json(
      {
        hata:
          'Raporunuz değerlendirmeye alındı ve artık değiştirilemez. '
          + 'Bir sorun varsa koordinasyonla iletişime geçin.',
      },
      { status: 409 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ hata: 'İstek okunamadı.' }, { status: 400 });
  }

  const okunan = await dosyayiOku(form.get('dosya'));
  if (okunan instanceof Response) return okunan;

  const bicim = bicimiDenetle(okunan.veri);
  if (bicim instanceof Response) return bicim;

  /*
   * Önce sil, sonra kaydet. Ters sıra iki raporlu bir başvuru bırakır ve
   * hakem hangisine bakacağını bilemez. Kaydetme patlarsa yarışmacı
   * yüklemeyi tekrarlar — dosya kendisinde duruyor.
   */
  const eskiVarMi = Boolean(durum.raporId);
  if (durum.raporId) raporSil(durum.raporId);

  const { rapor } = await raporuAl({
    veri: okunan.veri,
    dosyaAdi: okunan.ad,
    yarisma,
    kategori,
    basvuruId: basvuru.id,
    beyan: {
      basvuruNo: basvuru.basvuruNo,
      takim: basvuru.takim,
      takimId: basvuru.takimId,
      proje: basvuru.proje,
    },
  });

  /*
   * Kontrol bulguları yarışmacıya DÖNMÜYOR. Kontroller koştu ve kayıtlı;
   * hakem ve koordinasyon hepsini görüyor. Dönen alanlar teslimin kanıtı.
   */
  return Response.json(
    {
      teslim: {
        basvuruNo: basvuru.basvuruNo,
        dosyaAdi: rapor.dosyaAdi,
        yuklendi: rapor.yuklendi,
        sayfaSayisi: rapor.istatistik.sayfaSayisi,
        yenilendi: eskiVarMi,
      },
    },
    { status: 201 },
  );
}
