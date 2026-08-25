import Link from 'next/link';
import { DurumRozeti } from '@/components/rozet';
import { birlesikListe } from '@/lib/katalog/birlesik';
import { akisOzeti } from '@/lib/db/hakem-depo';
import { maliyetGorunur } from '@/lib/gorunum/maliyet';
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
  /*
   * Değerlendirme akışı oranları.
   *
   * PRD sayfa 03 bu rolü "tamamlanma ORANLARINI izler" diye tanımlıyor.
   * Pano mutlak sayı gösteriyordu; 500 raporluk bir döngüde "3 bekliyor"
   * tek başına hiçbir şey söylemiyor.
   */
  const akis = akisOzeti();

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
          Değerlendirme Panosu
        </h1>
        <p className="mt-1 text-[12.5px] font-medium text-white/85">
          {bugun} · {yarismalar.length} kurulu yarışma · {ozet.toplam} rapor
        </p>
      </div>

      {/*
        DEĞERLENDİRME AKIŞI — oranlar.
        Yapılacak işlerin ÜSTÜNDE: "neredeyiz" sorusu "ne yapmalıyım"
        sorusundan önce gelir. Rapor yoksa gösterilmiyor; boş bir ilerleme
        çubuğu bilgi değil gürültüdür.
      */}
      {akis.rapor > 0 && (
        <section className="mb-5 rounded-xl border border-cizgi bg-white px-5 py-4">
          <div className="mb-3 flex flex-wrap items-baseline gap-3">
            <h2 className="text-[15px] font-bold">Değerlendirme akışı</h2>
            <span className="text-[11.5px] font-medium text-metin-2">
              {akis.bitenDegerlendirme}/{akis.beklenenDegerlendirme} hakem
              değerlendirmesi tamamlandı
            </span>
            <span className="ml-auto text-[22px] leading-none font-extrabold text-lacivert">
              %{akis.yuzde}
            </span>
          </div>

          <div className="mb-3 h-[9px] overflow-hidden rounded-full bg-zemin">
            <div
              className="h-full rounded-full bg-yesil transition-[width] duration-500"
              style={{ width: `${akis.yuzde}%` }}
            />
          </div>

          {/*
            Dört durum, biri eyleme çağırıyor. Atanmamış rapor
            koordinasyonun işi; geciken değerlendirme de öyle.
          */}
          <div className="grid gap-2.5 sm:grid-cols-4">
            {([
              ['Tamamlandı', akis.tamamlanmis, 'text-yesil-koyu', null],
              ['Sürüyor', akis.suren, 'text-mavi-koyu', null],
              ['Atanmadı', akis.atanmamis, 'text-kirmizi', akis.atanmamis > 0 ? '/koordinasyon/hakemler' : null],
              ['Gecikti', akis.geciken, 'text-amber-koyu', akis.geciken > 0 ? '/koordinasyon/hakemler' : null],
            ] as Array<[string, number, string, string | null]>).map(
              ([ad, n, renk, yol]) => {
                const govde = (
                  <>
                    <div className={`text-[19px] leading-none font-extrabold ${n > 0 ? renk : 'text-metin-3'}`}>
                      {n}
                    </div>
                    <div className="mt-1 text-[10.5px] font-bold tracking-wide text-metin-2">
                      {ad.toLocaleUpperCase('tr')}
                    </div>
                  </>
                );
                return yol ? (
                  <Link
                    key={ad}
                    href={yol}
                    className="rounded-lg bg-zemin px-3 py-2.5 transition-colors hover:bg-cizgi"
                  >
                    {govde}
                  </Link>
                ) : (
                  <div key={ad} className="rounded-lg bg-zemin px-3 py-2.5">
                    {govde}
                  </div>
                );
              },
            )}
          </div>

          {akis.geciken > 0 && (
            <p className="mt-2.5 rounded-md bg-amber-zemin px-3 py-2 text-[11px] leading-relaxed font-semibold text-amber-koyu">
              {akis.geciken} değerlendirmenin son tarihi geçti ve hâlâ
              tamamlanmadı. Hakemler ekranından kimin geciktiğini görüp
              iletişime geçebilirsiniz.
            </p>
          )}
        </section>
      )}

      {/* YAPILACAK İŞLER — kullanıcının ikinci sorusu: ne yapmalıyım. */}
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

        {/*
          ── YAPAY ZEKÂ KATMANI ──────────────────────────────────────────
          Burada "Maliyet" ve "Yapay zekâ ne kadar tutuyor?" diye iki ayrı
          kart vardı. İkincisi koordinasyona hiçbir EYLEM söylemiyordu ve
          birleştirildi.

          Tutarlar `MALIYET_GOSTER` anahtarına bağlı ve varsayılan KAPALI.
          Rakam gizlense de kartın kendisi duruyor: hangi katmanın ücretli
          olduğu ve modelin hakemle ne kadar örtüştüğü, para konuşulmasa da
          koordinasyonun bilmesi gereken şeyler.
        */}
        <div className="flex flex-col gap-4">
          <section className="rounded-xl bg-lacivert px-5 py-4">
            <h2 className="mb-3 text-[14px] font-bold text-white">
              Yapay zekâ ön değerlendirmesi
            </h2>

            {maliyetGorunur() ? (
              <>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[26px] leading-none font-extrabold text-white">
                    ${ozet.toplamMaliyet.toFixed(2)}
                  </span>
                  <span className="text-[12px] font-semibold text-metin-2">
                    toplam harcandı
                  </span>
                </div>
                <p className="mt-1 text-[11px] font-medium text-metin-2">
                  {ozet.degerlendirilenRapor} rapor · rapor başına $
                  {(ozet.raporBasinaMaliyet ?? 0).toFixed(3)}
                  {ozet.onbellektenGelen > 0 && (
                    <>
                      {' · '}
                      <strong className="font-bold text-white">
                        {ozet.onbellektenGelen} tanesi önbellekten geldi
                      </strong>
                    </>
                  )}
                </p>
              </>
            ) : (
              <>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[26px] leading-none font-extrabold text-white">
                    {ozet.degerlendirilenRapor}
                  </span>
                  <span className="text-[12px] font-semibold text-metin-2">
                    rapor değerlendirildi
                  </span>
                </div>
                {ozet.onbellektenGelen > 0 && (
                  <p className="mt-1 text-[11px] font-medium text-metin-2">
                    <strong className="font-bold text-white">
                      {ozet.onbellektenGelen} tanesi önbellekten geldi
                    </strong>{' '}
                    — yeniden hesaplanmadı
                  </p>
                )}
              </>
            )}

            {/*
              Hakem–model farkı: "modelin önerisi hakemin kararına ne kadar
              yakın" sorusu. Ücret gizlense de bu ölçüm duruyor — sistemin
              kendi güvenilirliğini izlediğini gösteren tek sayı bu.
            */}
            {ozet.ortalamaSapma !== null && (
              <div className="mt-3 border-t border-lacivert-3 pt-3">
                <p className="text-[11px] font-medium text-metin-2">
                  Model önerisi ile hakem kararı arasındaki fark:{' '}
                  <strong className="font-bold text-white">
                    ortalama ±{ozet.ortalamaSapma} puan
                  </strong>
                  , %{ozet.uyumOrani}&apos;si ±5 puan içinde.
                </p>
                <p className="mt-1.5 text-[10px] leading-relaxed font-medium text-metin-3">
                  Bu bir kalibrasyon çalışması değil, kendi kendini ölçme.
                  Gerçek hakem puanları biriktikçe sayı anlam kazanacak.
                </p>
              </div>
            )}

            <p className="mt-3 border-t border-lacivert-3 pt-3 text-[10.5px] leading-relaxed font-medium text-metin-2">
              Dil, şablon, başlık, kaynakça, kaynak doğrulama, kategori ve
              kopya kontrolü{' '}
              <strong className="font-bold text-white">model kullanmıyor</strong>
              {' '}— saf kod, saniyeler içinde. Yapay zekâ yalnızca ölçüt
              bazlı ön değerlendirme ve şartname özeti için devreye giriyor.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
