import Link from 'next/link';
import BarajRozeti from '@/components/baraj-rozeti';
import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import AsamaCizelgesi from '@/components/asama-cizelgesi';
import BasvuruYazismasi from '@/components/basvuru-yazismasi';
import BasvuruYukleyici from '@/components/basvuru-yukleyici';
import YarismaciBasligi from '@/components/yarismaci-basligi';
import { tarihYaz } from '@/lib/analiz/takvim';
import { teslimPenceresi } from '@/lib/analiz/teslim-penceresi';
import { basvuruGetir } from '@/lib/db/basvuru-depo';
import { basvurununMesajlari, okunduIsaretle } from '@/lib/db/basvuru-mesaji';
import {
  ASAMA_ACIKLAMASI, ASAMA_ETIKETI, basvuruAsamasi,
} from '@/lib/db/basvuru-durum';
import {
  nihaiAciklamalar, nihaiGeriBildirim, nihaiKriterPuanlari, nihaiOzet,
} from '@/lib/db/hakem-depo';
import { takimUyeleri } from '@/lib/db/yarismaci-depo';
import { kategoriEtiketi } from '@/lib/gorunum/kategori-etiketi';
import { kategoriGetir, yarismaGetir } from '@/lib/depo/depo';
import { oturumSahibi } from '@/lib/yetki/yarismaci';

export const dynamic = 'force-dynamic';

/**
 * Başvuru ayrıntısı — durum, teslim ve sonuç tek sayfada.
 *
 * ── SONUÇ NİYE BURADA, AYRI SAYFADA DEĞİL ───────────────────────────────
 * Yarışmacı bu sayfaya "ne durumdayım" diye geliyor ve sonuç bu sorunun
 * son cevabı. Ayrı bir sayfaya taşınsaydı, süreç bitince yarışmacının
 * izlediği ekran aniden boşalır ve sonucu başka yerde araması gerekirdi.
 *
 * ── AI PUANI BURAYA HİÇ GİRMİYOR ────────────────────────────────────────
 * Gösterilen her sayı hakemin verdiği puandır. Model ön değerlendirme
 * üretiyor ama o yalnızca hakem panelinde duruyor.
 */
export default async function BasvuruSayfasi({ params }: PageProps<'/yarismaci/basvuru/[id]'>) {
  const istek = new Request('http://y', { headers: await headers() });
  const yarismaci = oturumSahibi(istek);
  if (!yarismaci) redirect('/yarismaci/giris');

  const { id } = await params;
  const basvuru = basvuruGetir(id);
  if (!basvuru) notFound();

  // Erişim takım üyeliğinden; sahiplikten değil.
  const uye = basvuru.takimKaydiId
    ? takimUyeleri(basvuru.takimKaydiId).some((u) => u.yarismaciId === yarismaci.id)
    : basvuru.yarismaciId === yarismaci.id;
  if (!uye) notFound();

  const yarisma = yarismaGetir(basvuru.yarismaId);
  const kategori = kategoriGetir(basvuru.yarismaId, basvuru.kategoriId);
  /*
   * Kategori metni tek yerden. Boş dönerse satır hiç çizilmiyor:
   * kategori adı yarışma adının aynısıysa ayrı bir satır olarak
   * yazılması aynı cümleyi iki kez göstermek olurdu.
   */
  const kategoriMetni = kategori
    ? (() => {
        const m = kategoriEtiketi(kategori.ad, kategori.asama, yarisma?.ad);
        return m === yarisma?.ad ? '' : m;
      })()
    : '';
  const durum = basvuruAsamasi(basvuru.id);
  const pencere = teslimPenceresi(kategori?.sartname?.kurallar.tarihler, kategori?.asama);

  const sonuclandi = durum.asama === 'sonuclandi' && durum.raporId;
  const ozet = sonuclandi ? nihaiOzet(durum.raporId!) : null;
  const kriterler = sonuclandi ? nihaiKriterPuanlari(durum.raporId!) : null;
  const geri = sonuclandi ? nihaiGeriBildirim(durum.raporId!) : null;
  const aciklamalar = sonuclandi ? nihaiAciklamalar(durum.raporId!) : [];

  /*
   * Sayfayı açmak koordinasyonun cevaplarını OKUMAK demek. Ayrı bir
   * "okundu" düğmesi koymak, kullanıcıdan zaten yaptığı bir şeyi
   * ayrıca bildirmesini istemek olurdu.
   */
  okunduIsaretle(basvuru.id, 'yarismaci');
  const mesajlar = basvurununMesajlari(basvuru.id);

  return (
    <div className="min-h-dvh bg-zemin">
      <YarismaciBasligi adSoyad={yarismaci.adSoyad} />

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <Link
          href="/yarismaci"
          className="mb-4 inline-block text-[12px] font-bold text-metin-2 hover:text-metin"
        >
          ← Panoya dön
        </Link>

        {/* ------------------------------------------------ künye */}
        <div className="rounded-xl border border-cizgi bg-white px-5 py-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-[19px] leading-tight font-extrabold tracking-tight">
              {basvuru.proje || basvuru.takim}
            </h1>
            <span className="rounded bg-zemin px-2 py-0.5 font-mono text-[11px] font-bold text-metin-2">
              {basvuru.basvuruNo}
            </span>
          </div>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[12px] font-medium">
            <dt className="text-metin-2">Takım</dt>
            <dd className="font-semibold">{basvuru.takim}</dd>
            <dt className="text-metin-2">Yarışma</dt>
            <dd className="font-semibold">{yarisma?.ad ?? '—'}</dd>
            {/*
              KATEGORİ SATIRI YARIŞMA ADIYLA AYNIYSA GİZLİ.
              Tek kategorili yarışmalarda ikisi harfi harfine aynı ve
              art arda iki kez yazılan aynı cümle, okuyanı "bir şey mi
              kaçırdım" diye geri döndürüyor.
            */}
            {kategoriMetni && (
              <>
                <dt className="text-metin-2">Kategori</dt>
                <dd className="font-semibold">{kategoriMetni}</dd>
              </>
            )}
          </dl>
        </div>

        {/* ------------------------------------------------ durum */}
        <section className="mt-5 rounded-xl border border-cizgi bg-white px-5 py-4">
          <h2 className="mb-3 text-[13px] font-extrabold tracking-tight">
            Başvuru durumu
          </h2>
          <AsamaCizelgesi asama={durum.asama} />
          <p className="mt-3 text-[13px] font-bold">{ASAMA_ETIKETI[durum.asama]}</p>
          <p className="mt-1 text-[12px] leading-relaxed font-medium text-metin-2">
            {ASAMA_ACIKLAMASI[durum.asama]}
          </p>
          {durum.asama === 'degerlendirmede' && (
            <p className="mt-2 text-[11.5px] font-semibold text-metin-2">
              {durum.tamamlayan}/{durum.hakemSayisi} hakem değerlendirmesini tamamladı.
            </p>
          )}
        </section>

        {/* ------------------------------------------------ teslim */}
        <section className="mt-5">
          <h2 className="mb-2.5 text-[13px] font-extrabold tracking-tight">
            Proje raporu
          </h2>

          {durum.raporId && (
            <div className="mb-3 rounded-xl border border-cizgi bg-white px-5 py-4">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[12px] font-medium">
                <dt className="text-metin-2">Dosya</dt>
                <dd className="font-semibold">{durum.raporAdi}</dd>
                <dt className="text-metin-2">Yüklenme</dt>
                <dd className="font-semibold">
                  {durum.yuklendi ? new Date(durum.yuklendi).toLocaleString('tr') : '—'}
                </dd>
              </dl>
            </div>
          )}

          {pencere.teslim && (
            <p
              className={`mb-3 rounded-lg px-4 py-2.5 text-[12px] font-semibold ${
                pencere.acik ? 'bg-amber-zemin text-amber-koyu' : 'bg-zemin text-metin-2'
              }`}
            >
              {pencere.acik ? (
                <>
                  Son teslim tarihi {tarihYaz(pencere.teslim)}
                  {pencere.kalanGun !== undefined
                    && (pencere.kalanGun > 0
                      ? ` — ${pencere.kalanGun} gün kaldı.`
                      : ' — bugün son gün.')}
                </>
              ) : (
                <>Teslim süresi {tarihYaz(pencere.teslim)} tarihinde doldu.</>
              )}
            </p>
          )}

          {pencere.acik ? (
            <BasvuruYukleyici
              basvuruId={basvuru.id}
              kilitli={durum.kilitli}
              mevcutDosya={durum.raporAdi}
            />
          ) : (
            !durum.raporId && (
              <div className="rounded-xl border border-cizgi bg-white px-5 py-4">
                <p className="text-[13px] font-bold">Rapor teslim edilmedi</p>
                <p className="mt-1 text-[12px] leading-relaxed font-medium text-metin-2">
                  Bu kategoriye rapor yükleme süresi kapandı. Durumunuzla ilgili
                  yarışma koordinasyonuyla iletişime geçebilirsiniz.
                </p>
              </div>
            )
          )}
        </section>

        {/* ------------------------------------------------ sonuç */}
        {sonuclandi && ozet && (
          <section className="mt-7">
            <h2 className="mb-2.5 text-[13px] font-extrabold tracking-tight">
              Değerlendirme sonucunuz
            </h2>

            <div className="rounded-xl border border-cizgi bg-white px-5 py-5">
              <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
                <div>
                  <p className="text-[10.5px] font-bold tracking-wide text-metin-2">
                    TOPLAM PUAN
                  </p>
                  <p className="text-[34px] leading-none font-extrabold tracking-tight">
                    {(durum.nihaiPuan ?? 0).toFixed(1)}
                    {/*
                      TOPLAM KATEGORİDEN OKUNUYOR, SABİT DEĞİL.
                      Burada "/ 100" yazılıydı ama her kategorinin rubrik
                      toplamı 100 değil; 85 üzerinden puanlanan bir kategoride
                      yarışmacı kendi puanını olduğundan düşük sanıyordu.
                    */}
                    <span className="ml-1 text-[15px] font-bold text-metin-3">
                      / {kategori?.rubrik.toplamPuan ?? 100}
                    </span>
                  </p>
                </div>
                <p className="text-[11.5px] font-semibold text-metin-2">
                  {ozet.toplamlar.length} hakem değerlendirdi
                  {ozet.toplamlar.length > 1 ? ' · puan ortalamadır' : ''}
                </p>
              </div>

              {/*
                BARAJ SONUCU PUANIN HEMEN ALTINDA.
                Yarışmacının ilk sorusu "geçtim mi"; ölçüt kırılımı ikinci
                soru. Alta konsaydı cevap on ölçüt satırının arkasında
                kalırdı.
              */}
              <BarajRozeti
                girdi={{
                  baraj: kategori?.rubrik.barajPuani,
                  puan: durum.nihaiPuan,
                  /*
                   * Atanmış bütün hakemler bitirdi mi — `sonuclandi`
                   * bayrağına güvenilmiyor, sayılar karşılaştırılıyor.
                   */
                  tamamlandi: ozet.atanan > 0 && ozet.tamamlanan >= ozet.atanan,
                }}
              />

              {/*
                Ölçüt listesi KATEGORİNİN RUBRİĞİNDEN, puanlar hakem
                kayıtlarından. Ters kurulsaydı — yalnızca puanı olan
                ölçütler listelenseydi — hiç puan almamış bir ölçüt
                ekrandan tamamen kaybolur ve yarışmacı neyi kaçırdığını
                göremezdi.
              */}
              {kategori && kriterler && kategori.rubrik.kriterler.length > 0 && (
                <div className="mt-5 flex flex-col gap-2.5">
                  {kategori.rubrik.kriterler.map((k) => {
                    const alinan = kriterler.get(k.kod)?.puan ?? 0;
                    const oran = k.puan ? (alinan / k.puan) * 100 : 0;
                    return (
                      <div key={k.kod}>
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-[12px] font-semibold">{k.ad}</span>
                          <span className="shrink-0 font-mono text-[11.5px] font-bold tabular-nums">
                            {alinan} / {k.puan}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zemin">
                          <div
                            className={`h-full rounded-full ${
                              oran >= 70 ? 'bg-yesil' : oran >= 45 ? 'bg-amber' : 'bg-kirmizi'
                            }`}
                            style={{ width: `${Math.max(2, Math.min(100, oran))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ---- gelişim geri bildirimi */}
            {geri && (geri.gucluYonler.length > 0 || geri.gelisimAlanlari.length > 0) && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {geri.gucluYonler.length > 0 && (
                  <div className="rounded-xl border border-yesil/25 bg-yesil-zemin px-5 py-4">
                    <h3 className="mb-2 text-[11px] font-bold tracking-wide text-yesil-koyu">
                      GÜÇLÜ YÖNLER
                    </h3>
                    <ul className="flex flex-col gap-1.5">
                      {geri.gucluYonler.map((g, i) => (
                        <li key={i} className="text-[12px] leading-relaxed font-medium">
                          {g}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {geri.gelisimAlanlari.length > 0 && (
                  <div className="rounded-xl border border-amber/25 bg-amber-zemin px-5 py-4">
                    <h3 className="mb-2 text-[11px] font-bold tracking-wide text-amber-koyu">
                      GELİŞİME AÇIK ALANLAR
                    </h3>
                    <ul className="flex flex-col gap-1.5">
                      {geri.gelisimAlanlari.map((g, i) => (
                        <li key={i} className="text-[12px] leading-relaxed font-medium">
                          {g}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {aciklamalar.length > 0 && (
              <div className="mt-4 rounded-xl border border-cizgi bg-white px-5 py-4">
                <h3 className="mb-2 text-[11px] font-bold tracking-wide text-metin-2">
                  HAKEM DEĞERLENDİRMESİ
                </h3>
                {aciklamalar.map((a, i) => (
                  <p key={i} className="mb-2 text-[12px] leading-relaxed font-medium last:mb-0">
                    {a}
                  </p>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ---------------------------------------------- yazışma */}
        <section className="mt-7">
          <BasvuruYazismasi
            basvuruId={basvuru.id}
            mesajlar={mesajlar}
            benimRolum="yarismaci"
          />
        </section>
      </main>
    </div>
  );
}
