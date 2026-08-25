/**
 * Kalıcı verinin nerede durduğu — TEK yer.
 *
 * ── NİYE TOPLANDI ───────────────────────────────────────────────────────
 * Yol hesabı yedi ayrı dosyada `join(process.cwd(), 'veri', …)` olarak
 * tekrarlanıyordu. Geliştirme makinesinde bu doğru: proje klasörünün
 * içinde çalışılıyor. Sunucuda değil — orada veri, uygulamadan AYRI bir
 * diske bağlanıyor ve uygulama güncellenirken yerinde kalması gerekiyor.
 *
 * Yedi yerde tekrarlanan bir varsayım, altısını düzeltip birini unutmaya
 * davetiyedir: unutulan yer veriyi kapsayıcının silinecek katmanına
 * yazar ve kayıp, ancak yeniden başlatıldığında görülür.
 *
 * ── NİYE ORTAM DEĞİŞKENİ ────────────────────────────────────────────────
 * `TPRDS_VERI_DIZINI` tanımlıysa veri oraya yazılıyor. Tanımlı değilse
 * eski davranış aynen sürüyor (`<proje>/veri`) — var olan kurulumlar ve
 * bütün betikler hiçbir değişiklik olmadan çalışmaya devam ediyor.
 */

import { join } from 'node:path';

/** Veritabanı, yüklenen belgeler ve JSON kayıtları. Kalıcı olmalı. */
export function veriDizini(): string {
  const ozel = (process.env.TPRDS_VERI_DIZINI ?? '').trim();
  return ozel || join(process.cwd(), 'veri');
}

/**
 * Yapay zekâ yanıt önbelleği.
 *
 * Kaybı veri kaybı değil, YALNIZCA para kaybı: önbellek boşalırsa aynı
 * rapor için model yeniden çağrılır ve ücret ikinci kez ödenir. Bu yüzden
 * kalıcı diskte durması iyi ama zorunlu değil; ayrı bir değişkenle
 * ayarlanabiliyor ki dar bir diskte veriden önce bu feda edilebilsin.
 */
export function onbellekDizini(): string {
  const ozel = (process.env.TPRDS_ONBELLEK_DIZINI ?? '').trim();
  return ozel || join(process.cwd(), '.onbellek');
}
