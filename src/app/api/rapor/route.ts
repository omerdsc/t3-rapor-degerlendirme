/**
 * Rapor listeleme — KOORDİNASYON kapısı.
 *
 * ── YÜKLEME UCU KAPATILDI ───────────────────────────────────────────────
 * Bu uçta bir POST vardı ve koordinasyon raporları buradan yüklüyordu.
 * Kaldırıldı: rapor artık YALNIZCA yarışmacının kendi portalından
 * geliyor (`/api/yarismaci/rapor`).
 *
 * Sebep ölçekte: 60 yarışma, 90 değerlendirme birimi ve binlerce rapor,
 * tek bir ekibin dosya trafiğinden geçemiyor. Darboğaz makinede değil,
 * dosyaları yükleyen insanda; sistem ne kadar hızlanırsa hızlansın o
 * darboğaz aşılmıyor.
 *
 * ── NİYE YALNIZCA ARAYÜZDEN KALDIRMAK YETMEDİ ───────────────────────────
 * Yükleyici bileşenini silmek düğmeyi ortadan kaldırır ama ucu açık
 * bırakır: `curl` ile ya da eski bir sekmeden gönderilen istek çalışmaya
 * devam ederdi. Arayüzde olmayan ama sunucuda duran bir yol, kuralı
 * kural olmaktan çıkarıp görsel bir tercihe indirir.
 *
 * Rapor kimliğinin doğruluğu da buna bağlı: yarışmacı yüklediğinde
 * raporun arkasında doğrulanmış bir başvuru kaydı oluyor ve kapaktan
 * okunan kimlikle karşılaştırılabiliyor. Koordinasyon yüklemesinde o bağ
 * hiç kurulmuyordu.
 */

import { kapi } from '@/lib/yetki/koordinasyon';
import { raporlariListele } from '@/lib/depo/depo';

export async function GET(request: Request) {
  const yetkisiz = kapi(request);
  if (yetkisiz) return yetkisiz;

  const q = new URL(request.url).searchParams;
  return Response.json({
    raporlar: raporlariListele(q.get('yarisma') ?? undefined, q.get('kategori') ?? undefined),
  });
}

/**
 * Eski istemciler ve yer imleri için açık bir cevap.
 *
 * 404 dönseydi "uç taşındı mı, yoksa sunucu mu bozuk" belirsiz kalırdı.
 * 405 + yeni adres, isteği göndereni doğru yere yönlendiriyor.
 */
export async function POST() {
  return Response.json(
    {
      hata:
        'Rapor yükleme koordinasyondan kaldırıldı. Raporu yarışmacı kendi '
        + 'portalından yüklüyor.',
      uc: '/api/yarismaci/rapor',
    },
    { status: 405, headers: { Allow: 'GET' } },
  );
}
