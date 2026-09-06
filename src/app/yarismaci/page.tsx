import Link from 'next/link';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import AsamaCizelgesi from '@/components/asama-cizelgesi';
import BosDurum from '@/components/bos-durum';
import DurumRozeti from '@/components/durum-rozeti';
import ProfilKarti from '@/components/profil-karti';
import TakimKurucu from '@/components/takim-kurucu';
import YarismaciBasligi from '@/components/yarismaci-basligi';
import { tarihYaz } from '@/lib/analiz/takvim';
import { teslimPenceresi } from '@/lib/analiz/teslim-penceresi';
import { yarismacininBasvurulari } from '@/lib/db/basvuru-depo';
import { basvuruAsamasi } from '@/lib/db/basvuru-durum';
import { okunmamisCevapSayisi } from '@/lib/db/basvuru-mesaji';
import { yarismaKategoriEtiketi } from '@/lib/gorunum/kategori-etiketi';
import { yarismacininTakimlari } from '@/lib/db/yarismaci-depo';
import { kategoriGetir, yarismaGetir } from '@/lib/depo/depo';
import { oturumSahibi } from '@/lib/yetki/yarismaci';

export const dynamic = 'force-dynamic';

/**
 * Yarışmacı panosu.
 *
 * ── DÜZEN: ANA SÜTUN + YAN SÜTUN ────────────────────────────────────────
 * Başvurular ve takımlar önce eşit genişlikte, alt alta duruyordu ve
 * ölçüldüğünde şu çıktı: tek takımlı bir kullanıcıda sayfanın üçte ikisi
 * boş kalıyor, tek kart yarım ızgarada asılı duruyordu.
 *
 * İkisi eşit değil zaten. Yarışmacı buraya BAŞVURUSU için geliyor; takım
 * bir kez kurulup unutulan bir kayıt. Ana sütun–yan sütun ayrımı bu
 * gerçeği yansıtıyor ve tek kayıtlı bir hesapta bile sayfa dolu duruyor.
 */
export default async function YarismaciPanosu() {
  const istek = new Request('http://y', { headers: await headers() });
  const yarismaci = oturumSahibi(istek);
  if (!yarismaci) redirect('/yarismaci/giris');

  const takimlar = yarismacininTakimlari(yarismaci.id);
  const kaptanOlduklari = takimlar.filter((t) => t.rol === 'kaptan');

  const basvurular = yarismacininBasvurulari(yarismaci.id).map((b) => {
    const yarisma = yarismaGetir(b.yarismaId);
    const kategori = kategoriGetir(b.yarismaId, b.kategoriId);
    const yarismaAdi = yarisma?.ad ?? '—';
    return {
      basvuru: b,
      yarismaAdi,
      // Etiket tek yerden; tekrar ayıklama kuralları orada.
      altBilgi: yarismaKategoriEtiketi(yarismaAdi, kategori?.ad, kategori?.asama),
      asama: basvuruAsamasi(b.id),
      pencere: teslimPenceresi(kategori?.sartname?.kurallar.tarihler, kategori?.asama),
      okunmamis: okunmamisCevapSayisi(b.id),
    };
  });


  const kaptanTakimlari = kaptanOlduklari.map((t) => ({ id: t.id, ad: t.ad }));
  const baslikSinifi = 'mb-3 flex items-baseline justify-between gap-3';

  return (
    <div className="min-h-dvh bg-zemin">
      <YarismaciBasligi adSoyad={yarismaci.adSoyad} />

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <ProfilKarti
          yarismaci={yarismaci}
          takimSayisi={takimlar.length}
          basvuruSayisi={basvurular.length}
          sonuclanan={basvurular.filter((b) => b.asama.asama === 'sonuclandi').length}
        />

        <div className="mt-7 grid gap-7 lg:grid-cols-[1.55fr_1fr] lg:gap-6">
          {/* ============================================== BAŞVURULAR */}
          <section>
            <div className={baslikSinifi}>
              <h2 className="text-[15px] font-extrabold tracking-tight">Başvurularım</h2>
              {basvurular.length > 0 && (
                <span className="text-[11.5px] font-semibold text-metin-2">
                  {basvurular.length} başvuru
                </span>
              )}
            </div>

            {basvurular.length === 0 ? (
              <BosDurum
                baslik="Henüz bir yarışmaya başvurmadınız"
                metin={
                  kaptanTakimlari.length === 0
                    ? 'Yarışma başvurusunu takım kaptanı yapar. Başvurabilmek için önce takımınızı kurun.'
                    : 'Yarışmalara göz atıp takımınızla katılmak istediğiniz kategoriyi seçin.'
                }
                ikon={
                  <svg viewBox="0 0 24 24" className="size-6 stroke-metin-3" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                  </svg>
                }
              />
            ) : (
              <div className="flex flex-col gap-3">
                {basvurular.map(({ basvuru, altBilgi, asama, pencere, okunmamis }, i) => (
                  <Link
                    key={basvuru.id}
                    href={`/yarismaci/basvuru/${basvuru.id}`}
                    style={{ '--sira': i } as React.CSSProperties}
                    className="kart kart-etkilesimli belir block px-5 py-4"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-[14.5px] font-extrabold tracking-tight">
                          {basvuru.proje || altBilgi}
                        </h3>
                        <p className="mt-0.5 truncate text-[11.5px] font-medium text-metin-2">
                          {altBilgi}
                        </p>
                      </div>
                      <DurumRozeti asama={asama.asama} />
                    </div>

                    <div className="mt-3.5">
                      <AsamaCizelgesi asama={asama.asama} />
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-cizgi pt-2.5">
                      <span className="font-mono text-[10.5px] font-bold text-metin-3">
                        {basvuru.basvuruNo}
                      </span>

                      {asama.asama === 'sonuclandi' && asama.nihaiPuan !== undefined && (
                        <span className="text-[12px] font-extrabold text-yesil-koyu">
                          {asama.nihaiPuan.toFixed(1)} puan
                        </span>
                      )}
                      {asama.asama === 'degerlendirmede' && (
                        <span className="text-[11px] font-semibold text-metin-2">
                          {asama.tamamlayan}/{asama.hakemSayisi} hakem tamamladı
                        </span>
                      )}
                      {asama.asama === 'basvuruldu' && pencere.acik
                        && pencere.kalanGun !== undefined && (
                        <span
                          className={`text-[11px] font-bold ${
                            pencere.kalanGun <= 7 ? 'text-kirmizi' : 'text-amber-koyu'
                          }`}
                        >
                          {pencere.kalanGun > 0
                            ? `Rapor için ${pencere.kalanGun} gün kaldı`
                            : 'Rapor için bugün son gün'}
                        </span>
                      )}
                      {asama.asama === 'rapor_yuklendi' && pencere.teslim && (
                        <span className="text-[11px] font-semibold text-metin-2">
                          Son teslim {tarihYaz(pencere.teslim)}
                        </span>
                      )}

                      {/* Cevap gelmişse yarışmacı bunu panoda görmeli;
                          başvuruyu açmadan öğrenemezse bildirim işe yaramaz. */}
                      {okunmamis > 0 && (
                        <span className="rounded-md bg-kirmizi px-2 py-0.5 text-[9.5px] font-bold tracking-wide text-white">
                          {okunmamis} YENİ YANIT
                        </span>
                      )}

                      <span className="ml-auto text-[11.5px] font-bold text-kirmizi">Aç →</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/*
              Başvuru buradan DEĞİL, katalogdan yapılıyor. Burada duran
              açılır listeli form yarışmacıya hangi yarışmaya başvurduğunu
              adından başka hiçbir şeyle göstermiyordu — tarih yok,
              kategori yok, arama yok.
            */}
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/yarismaci/yarismalar"
                className="dugme bg-lacivert px-4 py-2 text-[12.5px] text-white hover:bg-lacivert-2"
              >
                Yarışmalara göz at
              </Link>
              {/*
                "Mevcut başvurumu üstlen" ŞİMDİLİK GİZLİ.

                Düğme, koordinasyonun toplu içeri aktardığı sahipsiz bir
                başvuruyu numara + erişim koduyla hesaba bağlamak içindi.
                Ön kayıt listesi henüz kullanılmıyor; kullanılmayan bir
                akış için yarışmacıya numara/kod soran bir düğme
                göstermek, portalın ilk ekranını gereksiz karmaşık
                yapıyor.

                Bileşen ve `islem: 'ustlen'` ucu duruyor — ön kayıtla
                açılan bir yarışma olduğunda tek satırla geri gelir:
                  <BasvuruUstlen takimlar={kaptanTakimlari} />
              */}
            </div>
          </section>

          {/* ================================================= TAKIMLAR */}
          <section>
            <div className={baslikSinifi}>
              <h2 className="text-[15px] font-extrabold tracking-tight">Takımlarım</h2>
              {takimlar.length > 0 && (
                <span className="text-[11.5px] font-semibold text-metin-2">
                  {takimlar.length} takım
                </span>
              )}
            </div>

            {takimlar.length === 0 ? (
              <BosDurum
                baslik="Takımınız yok"
                metin="Takımınızı kurun ya da kaptanınızın paylaştığı katılım koduyla katılın."
                ikon={
                  <svg viewBox="0 0 24 24" className="size-6 stroke-metin-3" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                }
              />
            ) : (
              <div className="flex flex-col gap-3">
                {takimlar.map((t, i) => (
                  <Link
                    key={t.id}
                    href={`/yarismaci/takim/${t.id}`}
                    style={{ '--sira': i } as React.CSSProperties}
                    className="kart kart-etkilesimli belir block px-5 py-4"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-lacivert text-[12px] font-extrabold text-white">
                        {t.ad.split(/\s+/).slice(0, 2).map((p) => p[0]?.toLocaleUpperCase('tr')).join('')}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-[13.5px] font-extrabold tracking-tight">
                          {t.ad}
                        </h3>
                        <p className="mt-0.5 truncate text-[11px] font-medium text-metin-2">
                          {t.kurum ?? 'Kurum belirtilmemiş'}
                        </p>
                      </div>
                      {t.rol === 'kaptan' && (
                        <span className="shrink-0 rounded-md bg-kirmizi-zemin px-2 py-0.5 text-[9.5px] font-bold tracking-wide text-kirmizi-koyu">
                          KAPTAN
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-cizgi pt-2.5">
                      <span className="text-[11.5px] font-semibold text-metin-2">
                        {t.uyeSayisi} üye
                      </span>
                      <span className="text-[11.5px] font-bold text-kirmizi">Aç →</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            <div className="mt-3">
              <TakimKurucu />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
