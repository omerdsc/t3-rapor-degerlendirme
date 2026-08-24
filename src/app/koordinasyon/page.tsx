import Link from 'next/link';
import { DurumRozeti } from '@/components/rozet';
import { birlesikListe } from '@/lib/katalog/birlesik';
import { panoOzeti, raporlariListele, yarismalariListele } from '@/lib/depo/depo';
import { raporuMaskele } from '@/lib/depo/maskele';

export const dynamic = 'force-dynamic';

/**
 * Panel.
 *
 * ÖNCEKİ TASARIMIN SORUNU
 * Dört sayı kartı, son raporlar, kalibrasyon ve maliyet vardı — hepsi
 * doğruydu ama hiçbiri "şimdi ne yapmalıyım" sorusunu yanıtlamıyordu.
 * Kullanıcı ekranı okuyup kendi çıkarımını yapmak zorundaydı.
 *
 * Artık ekranın en üstünde YAPILACAK İŞLER var: her satır bir eylem ve
 * gideceği yer. Sayılar ve maliyet aşağıda, bilgi olarak kalıyor.
 */

interface Is {
  baslik: string;
  aciklama: string;
  sayi: number;
  yol: string;
  eylem: string;
  aciliyet: 'yuksek' | 'orta' | 'dusuk';
}

const ACILIYET: Record<Is['aciliyet'], { kenar: string; cip: string }> = {
  yuksek: { kenar: 'border-l-kirmizi', cip: 'bg-kirmizi text-white' },
  orta: { kenar: 'border-l-amber', cip: 'bg-amber-zemin text-amber-koyu' },
  dusuk: { kenar: 'border-l-mavi', cip: 'bg-mavi-zemin text-mavi-koyu' },
};

export default function PanoSayfasi() {
  const yarismalar = yarismalariListele();
  const ozet = panoOzeti();
  const tumRaporlar = raporlariListele();
  const sonRaporlar = tumRaporlar.slice(0, 5);
  const birlesik = birlesikListe((id) => raporlariListele(id).length);

  const onaysizKategori = yarismalar.reduce(
    (t, y) => t + y.kategoriler.filter((k) => !k.duzenlendi).length,
    0,
  );
  const sartnamesizKategori = yarismalar.reduce(
    (t, y) => t + y.kategoriler.filter((k) => !k.sartname).length,
    0,
  );
  const kurulmayan = birlesik.filter((y) => y.durum === 'kurulabilir').length;
  const kritikli = tumRaporlar.filter((r) =>
    r.kontroller.some((k) => k.durum === 'hata'),
  ).length;

  const isler: Is[] = ([
    {
      baslik: 'Rapor değerlendirilmeyi bekliyor',
      aciklama: 'Otomatik kontroller bitti; hakem puanı bekleniyor.',
      sayi: ozet.bekleyen,
      yol: '/raporlar?durum=bekleyen',
      eylem: 'Raporlara git',
      aciliyet: 'yuksek',
    },
    {
      baslik: 'Kritik bulgulu rapor',
      aciklama: 'Eksik bölüm, kaynakça sorunu ya da kopya şüphesi var.',
      sayi: kritikli,
      yol: '/koordinasyon/raporlar',
      eylem: 'İncele',
      aciliyet: 'yuksek',
    },
    {
      baslik: 'Kategori ölçütleri onaylanmadı',
      aciklama:
        'Ölçütler şablondan otomatik çıkarıldı. Onaylanmadan yapılan ' +
        'puanlamanın doğruluğu garanti değil.',
      sayi: onaysizKategori,
      yol: '/koordinasyon/yarismalar',
      eylem: 'Yarışmalara git',
      aciliyet: 'orta',
    },
    {
      baslik: 'Kategoride şartname eksik',
      aciklama: 'Şartname olmadan eleyici kurallar ve teknik beklentiler bilinmiyor.',
      sayi: sartnamesizKategori,
      yol: '/koordinasyon/yarismalar',
      eylem: 'Tamamla',
      aciliyet: 'orta',
    },
    {
      baslik: 'Kurulmamış yarışma',
      aciklama: 'Şablonu yayımlanmış ama sisteme alınmamış. Kurmak ücretsiz.',
      sayi: kurulmayan,
      yol: '/koordinasyon/yarismalar',
      eylem: 'Kur',
      aciliyet: 'dusuk',
    },
  ] satisfies Is[]).filter((i) => i.sayi > 0);

  const bugun = new Date().toLocaleDateString('tr', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <>
      <div className="mb-5 rounded-[14px] bg-gradient-to-r from-[#C41B22] via-kirmizi to-[#E23A41] px-6 py-5">
        <h1 className="text-[23px] font-extrabold tracking-tight text-white">
          4. Göz — Değerlendirme Panosu
        </h1>
        <p className="mt-1 text-[12.5px] font-medium text-white/85">
          {bugun} · {yarismalar.length} kurulu yarışma · {ozet.toplam} rapor
        </p>
      </div>

      {/* YAPILACAK İŞLER — ekranın en üstü, çünkü kullanıcının sorusu bu. */}
      <section className="mb-5">
        <h2 className="mb-2.5 text-[15px] font-bold">Yapılacak işler</h2>

        {!isler.length ? (
          <p className="rounded-xl border border-yesil/25 bg-yesil-zemin px-5 py-6 text-center text-[12.5px] font-semibold text-yesil-koyu">
            Bekleyen iş yok. Bütün kategoriler onaylı ve değerlendirme
            kuyruğu boş.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {isler.map((i) => {
              const b = ACILIYET[i.aciliyet];
              return (
                <Link
                  key={i.baslik}
                  href={i.yol}
                  className={`flex flex-wrap items-center gap-3 rounded-xl border border-cizgi border-l-[3px] bg-white px-4 py-3 transition-colors hover:bg-zemin/60 ${b.kenar}`}
                >
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-[14px] font-extrabold ${b.cip}`}
                  >
                    {i.sayi}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-bold">{i.baslik}</span>
                    <span className="mt-0.5 block text-[11px] leading-relaxed font-medium text-metin-2">
                      {i.aciklama}
                    </span>
                  </span>
                  <span className="shrink-0 text-[12px] font-bold text-kirmizi">
                    {i.eylem} →
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <section className="rounded-xl border border-cizgi bg-white">
          <div className="flex items-center gap-2.5 border-b border-cizgi px-5 py-3.5">
            <span className="h-4 w-[3px] rounded-sm bg-kirmizi" />
            <h2 className="text-[14px] font-bold">Son raporlar</h2>
            <Link
              href="/koordinasyon/raporlar"
              className="ml-auto text-[12px] font-bold text-kirmizi hover:text-kirmizi-koyu"
            >
              Tümü →
            </Link>
          </div>

          {!sonRaporlar.length ? (
            <p className="px-5 py-10 text-center text-[12.5px] leading-relaxed font-medium text-metin-2">
              Henüz rapor yüklenmedi.
              <br />
              <Link href="/koordinasyon/yarismalar" className="font-bold text-kirmizi">
                Bir yarışma kurup raporlarını aktarın →
              </Link>
            </p>
          ) : (
            <ul className="flex flex-col">
              {sonRaporlar.map((r) => {
                const m = raporuMaskele(r);
                return (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center gap-3 border-t border-cizgi/70 px-5 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-semibold">{r.proje}</div>
                      <div className="mt-0.5 text-[11px] font-medium text-metin-2">
                        {m.takim} · {m.raporKodu}
                      </div>
                    </div>
                    {r.hakemToplam !== undefined ? (
                      <span className="text-[13px] font-extrabold text-yesil-koyu">
                        {r.hakemToplam}
                      </span>
                    ) : r.aiDegerlendirme ? (
                      <span
                        className="text-[11.5px] font-semibold text-metin-2"
                        title="Yapay zekâ önerisi — hakem puanı değil"
                      >
                        öneri {r.aiDegerlendirme.aiToplam}
                      </span>
                    ) : null}
                    <DurumRozeti durum={r.durum} />
                    <Link
                      href={`/koordinasyon/rapor/${r.id}`}
                      className="text-[11.5px] font-bold text-kirmizi hover:text-kirmizi-koyu"
                    >
                      Aç
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-4">
          <section className="rounded-xl border border-cizgi bg-white px-5 py-4">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="h-4 w-[3px] rounded-sm bg-kirmizi" />
              <h2 className="text-[14px] font-bold">Yapay zekâ ne kadar tutuyor?</h2>
            </div>

            {ozet.ortalamaSapma === null ? (
              <p className="text-[11.5px] leading-relaxed font-medium text-metin-2">
                Hakem puanları girildikçe sistem, kendi önerisiyle hakem
                arasındaki farkı ölçüp burada gösterecek. Kendi
                güvenilirliğini kendisi izliyor.
              </p>
            ) : (
              <div className="flex items-end gap-6">
                <div>
                  <div className="text-[26px] leading-none font-extrabold text-yesil-koyu">
                    ±{ozet.ortalamaSapma}
                  </div>
                  <div className="mt-1.5 text-[10.5px] font-semibold text-metin-2">
                    ortalama fark
                  </div>
                </div>
                <div>
                  <div className="text-[26px] leading-none font-extrabold">
                    %{ozet.uyumOrani}
                  </div>
                  <div className="mt-1.5 text-[10.5px] font-semibold text-metin-2">
                    ±5 puan içinde
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-xl bg-lacivert px-5 py-4">
            <h2 className="mb-3 text-[14px] font-bold text-white">Maliyet</h2>

            <div className="flex items-baseline gap-1.5">
              <span className="text-[26px] leading-none font-extrabold text-white">
                ${ozet.toplamMaliyet.toFixed(2)}
              </span>
              <span className="text-[12px] font-semibold text-metin-2">
                toplam harcandı
              </span>
            </div>
            <p className="mt-1 text-[11px] font-medium text-metin-2">
              Rapor başına ${(ozet.raporBasinaMaliyet ?? 0).toFixed(3)}
            </p>

            <p className="mt-3 border-t border-lacivert-3 pt-3 text-[10.5px] leading-relaxed font-medium text-metin-2">
              Dil, şablon, başlık, kaynakça, kaynak doğrulama, kategori ve
              kopya kontrolü model kullanmıyor —{' '}
              <strong className="font-bold text-white">bu kalemler $0.</strong>{' '}
              Ücret yalnızca yapay zekâ ön değerlendirmesi ve şartname özeti
              için.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
