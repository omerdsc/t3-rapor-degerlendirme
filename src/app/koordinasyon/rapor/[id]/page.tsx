import Link from 'next/link';
import { notFound } from 'next/navigation';
import AiOnDegerlendirme from '@/components/ai-on-degerlendirme';
import KaynakcaDenetimi from '@/components/kaynakca-denetimi';
import BarajRozeti from '@/components/baraj-rozeti';
import { kaynakcaDenetimiGetir } from '@/lib/db/kaynakca-denetim-depo';
import { DurumRozeti, SeviyeRozeti } from '@/components/rozet';
import Yazisma from '@/components/yazisma';
import {
  kategoriGetir, parmakizliRaporlar, raporGetir, yarismaGetir,
} from '@/lib/depo/depo';
import HakemSonuclari, { type HakemSonucu } from '@/components/hakem-sonuclari';
import KimlikPaneli from '@/components/kimlik-paneli';
import {
  nihaiOzet, raporunDegerlendirmeleri, raporunHakemleri,
} from '@/lib/db/hakem-depo';
import { raporuMaskele } from '@/lib/depo/maskele';
import { maliyetGorunur } from '@/lib/gorunum/maliyet';

export const dynamic = 'force-dynamic';

export default async function RaporSayfasi({ params }: PageProps<'/koordinasyon/rapor/[id]'>) {
  const { id } = await params;
  const rapor = raporGetir(id);
  if (!rapor) notFound();

  const yarisma = yarismaGetir(rapor.yarismaId);
  if (!yarisma) notFound();

  // Rubrik ve şablon kategoriden gelir.
  const kategori = kategoriGetir(rapor.yarismaId, rapor.kategoriId);
  if (!kategori) notFound();

  /*
   * Hakem ekranında kimlik maskeli.
   *
   * İki gerekçe: (1) örnek raporlar gerçek yarışmacı belgeleri, kişisel veri
   * sunumda ekrana düşmemeli; (2) takım adını görmek KÖR OLMAYAN puanlama
   * demek — "geçen yıl finale kalan ekip" bilgisi puanı etkiler.
   * MASKELEME=kapali ile kapatılabilir.
   */
  const maske = raporuMaskele(rapor);

  /*
   * Hakem başına sonuçlar. Atanmış ama başlamamış hakem de listede:
   * koordinasyonun görmesi gereken şey "kim geciktiriyor" sorusunun cevabı.
   */
  const atananlar = raporunHakemleri(rapor.id);
  const denetim = kaynakcaDenetimiGetir(rapor.id);
  const degerlendirmeler = raporunDegerlendirmeleri(rapor.id);
  const ozet = nihaiOzet(rapor.id);

  /*
   * Karşılaştırma ekranına bağlantı — AMA yalnızca karşılaştırılacak
   * bir şey varsa.
   *
   * Benzerlik bulgusu yükleme anında üretiliyor; o andan sonra karşı
   * taraftaki rapor silinmiş ya da başka kategoriye taşınmış olabilir.
   * Bulguya bakıp bağlantı koymak, kullanıcıyı boş bir tarama ekranına
   * göndermek olurdu. Kategoride en az iki parmak izi olmalı ki
   * karşılaştırılacak bir ÇİFT bulunsun.
   */
  const karsilastirilabilir =
    parmakizliRaporlar(rapor.yarismaId, rapor.kategoriId).length >= 2;

  const hakemSonuclari: HakemSonucu[] = atananlar.map((h) => {
    const d = degerlendirmeler.find((x) => x.hakemId === h.id);
    const puanlar: HakemSonucu['puanlar'] = {};
    for (const p of d?.puanlar ?? []) {
      puanlar[p.kriterKodu] = { puan: p.puan, not: p.not };
    }
    return {
      hakemId: h.id,
      hakemAdi: h.ad,
      kurum: h.kurum,
      durum: d?.durum ?? 'baslanmadi',
      toplam: d?.toplam,
      aciklama: d?.aciklama,
      tamamlandi: d?.tamamlandi,
      puanlar,
    };
  });

  return (
    <>
      <header className="mb-4">
        <Link
          href={`/koordinasyon/raporlar?yarisma=${yarisma.id}`}
          className="mb-2.5 inline-flex items-center gap-1.5 text-[12px] font-medium text-metin-2 hover:text-metin"
        >
          <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Raporlar
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[19px] font-extrabold tracking-tight">{rapor.proje}</h1>
              <DurumRozeti durum={rapor.durum} />
            </div>
            <p className="mt-1.5 text-[12px] font-medium text-metin-2">
              <strong className="font-mono font-bold text-metin" title="Başvuru numarası — yarışmacıya bunu söyleyin">
                {rapor.basvuruNo}
              </strong>{' · '}
              {maske.takim} · {maske.raporKodu} ·{' '}
              {rapor.istatistik.sayfaSayisi} sayfa ·{' '}
              {rapor.istatistik.kelimeSayisi.toLocaleString('tr')} kelime ·{' '}
              {rapor.istatistik.gorselSayisi} görsel · {yarisma.ad} · {kategori.ad}
            </p>
          </div>

          {/*
            NİHAİ PUAN BAŞLIKTA.
            "Şu an ne puan görüyorum" sorusunun cevabı sayfanın en tepesinde
            olmalı. Aşağıda hakem kırılımı ve yapay zekâ önerisi de var ama
            GEÇERLİ OLAN bu: tamamlanmış hakem değerlendirmelerinin
            ortalaması. Henüz tamamlanmamışsa puan yazmıyor — boş bir sayı
            göstermek "değerlendirildi" izlenimi verir.
          */}
          <div
            className={`shrink-0 rounded-xl border px-4 py-2.5 text-right ${
              ozet.puan === undefined
                ? 'border-cizgi bg-white'
                : 'border-mavi/25 bg-mavi-zemin'
            }`}
          >
            <div className="text-[9.5px] font-bold tracking-wide text-metin-2">
              NİHAİ PUAN
            </div>
            {ozet.puan === undefined ? (
              <>
                <div className="text-[15px] leading-tight font-extrabold text-metin-3">
                  —
                </div>
                <div className="mt-0.5 text-[10px] font-semibold text-metin-2">
                  {atananlar.length
                    ? `${atananlar.length} hakem değerlendiriyor`
                    : 'hakem atanmadı'}
                </div>
              </>
            ) : (
              <>
                <div className="text-[24px] leading-none font-extrabold text-mavi-koyu">
                  {ozet.puan.toFixed(1)}
                  <span className="text-[13px] font-bold">
                    /{kategori.rubrik.toplamPuan}
                  </span>
                </div>
                <div className="mt-1 text-[10px] font-semibold text-metin-2">
                  {ozet.tamamlanan}/{atananlar.length} hakem ortalaması
                  {ozet.sapma !== undefined && ozet.sapma >= 10 && (
                    <span className="text-amber-koyu">
                      {' '}
                      · {ozet.sapma.toFixed(0)} puan fark
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/*
        Kimlik paneli kontrol şeridinin ÜSTÜNDE: "hangi raporu
        değerlendiriyorum" sorusu, "bu rapor nasıl" sorusundan önce gelir.
        Kapalı başlıyor — hakem puanlarken açmak zorunda değil.
      */}
      <KimlikPaneli
        raporId={rapor.id}
        uyusmazlikSayisi={rapor.kimlikUyusmazligi?.length ?? 0}
        kapaktanOkundu={!!rapor.raporKimligi?.bulunan.length}
      />

      {/*
        HAKEM DEĞERLENDİRMELERİ — sonuçların panele dönüşü.
        Yapay zekâ önerisinden ÖNCE geliyor: koordinasyonun sorusu "hakemler
        ne dedi", modelin ne dediği ikincil.
      */}
      <HakemSonuclari
        olcutler={kategori.rubrik.kriterler}
        toplamPuan={kategori.rubrik.toplamPuan}
        nihaiPuan={ozet.puan}
        aiToplam={rapor.aiDegerlendirme?.aiToplam}
        sonuclar={hakemSonuclari}
      />

      {/*
        BARAJ KOORDİNASYONDA DA GÖRÜNÜYOR.
        Yarışmacı kendi sayfasında "barajın altında kaldınız" yazısını
        okuyunca koordinasyona soruyor. Aynı bilgi burada da olmasaydı
        koordinasyon soruyu cevaplamak için puanı elle eşikle
        karşılaştırmak zorunda kalırdı.
      */}
      <div className="mb-4">
        <BarajRozeti
          taraf="koordinasyon"
          girdi={{
            baraj: kategori.rubrik.barajPuani,
            puan: ozet.puan,
            tamamlandi: ozet.atanan > 0 && ozet.tamamlanan >= ozet.atanan,
          }}
        />
      </div>

      {/*
        ÖN KONTROL ŞERİDİ — başlıklı.
        Başlıksızken sayfadaki tek adsız bloktu: kullanıcı bu çiplerin ne
        olduğunu, kimin ürettiğini ve puanla ilişkisini bilmiyordu.
      */}
      <section className="mb-4 rounded-xl border border-cizgi bg-white px-5 py-3.5">
        <div className="mb-2.5 flex flex-wrap items-baseline gap-2">
          <h2 className="text-[13px] font-bold">Otomatik ön kontroller</h2>
          <span className="text-[11px] font-medium text-metin-2">
            yapay zekâ kullanmadan, saniyeler içinde · puana
            dahil değil
          </span>
          {/*
            BENZERLİK ÖTEKİ BEŞ KONTROLDEN YAPICA FARKLI.
            Diğerleri tek belgeye bakıyor: dili nedir, şablona uyuyor mu.
            Benzerlik ise İKİ RAPOR ARASINDA var olan bir şey — tek raporun
            sayfasında "hangi raporla, ne kadar, nerede" sorusu
            yanıtlanamıyor.

            Bulgu burada duruyor, karşılaştırma ekranı orada duruyordu ve
            aralarında hiçbir bağ yoktu: koordinasyon bulguyu görüp
            menüden ayrı bir ekran bulmak zorundaydı. Bağlantı eklendi.
          */}
          {karsilastirilabilir && (
            <Link
              href={`/koordinasyon/benzerlik?yarisma=${yarisma.id}&kategori=${kategori.id}`}
              className="ml-auto text-[11.5px] font-bold text-kirmizi hover:text-kirmizi-koyu"
            >
              Kategoriyi karşılaştır →
            </Link>
          )}
        </div>
        <div className="flex flex-wrap gap-2.5">
        {rapor.kontroller.map((k) => (
          <div key={k.kod} className="flex min-w-[150px] flex-1 items-center gap-2.5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold">{k.ad}</span>
                <SeviyeRozeti
                  seviye={k.durum}
                  metin={k.durum === 'temiz' ? 'TEMİZ' : k.bulgular.length.toString()}
                />
              </div>
              <div className="mt-0.5 text-[10.5px] font-medium text-metin-2">{k.ozet}</div>
            </div>
          </div>
        ))}
        </div>
      </section>

      {/* Otomatik kontrollerin bulguları */}
      {rapor.kontroller.some((k) => k.bulgular.length > 0) && (
        <details className="mb-4 rounded-xl border border-cizgi bg-white" open={rapor.genelDurum === 'hata'}>
          <summary className="cursor-pointer px-5 py-3.5 text-[13px] font-bold">
            Ön kontrol bulguları
            <span className="ml-2 font-medium text-metin-2">
              ({rapor.kontroller.reduce((t, k) => t + k.bulgular.length, 0)} bulgu)
            </span>
          </summary>
          <div className="flex flex-col gap-1.5 border-t border-cizgi px-5 py-3.5">
            {rapor.kontroller.flatMap((k) =>
              k.bulgular.map((b, i) => (
                <div
                  key={`${k.kod}-${b.kod}-${i}`}
                  className={`border-l-[3px] bg-zemin/60 py-2.5 pr-3 pl-3 ${
                    b.seviye === 'hata'
                      ? 'border-kirmizi'
                      : b.seviye === 'uyari'
                        ? 'border-amber'
                        : 'border-mavi'
                  }`}
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-[12.5px] font-bold">{b.baslik}</span>
                    {b.sayfa && (
                      <span className="rounded bg-white px-1.5 py-px text-[10px] font-bold text-metin-2 ring-1 ring-cizgi">
                        s.{b.sayfa}
                      </span>
                    )}
                    <code className="ml-auto text-[9.5px] font-semibold tracking-wide text-metin-3">
                      {b.kod}
                    </code>
                  </div>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-metin-2">{b.aciklama}</p>
                  {b.kanit && (
                    <p className="mt-1.5 truncate border-l-2 border-cizgi pl-2 text-[11px] text-metin-3 italic">
                      {b.kanit}
                    </p>
                  )}
                </div>
              )),
            )}
          </div>
        </details>
      )}

      {/*
        KOORDİNASYON PUAN GİRMİYOR.
        Eskiden burada bir puanlama formu vardı ("Taslak kaydet", "Nihai
        değerlendirmeyi tamamla"). Hakem paneli eklendikten sonra bu tutarsız
        hale geldi: aynı ekranda iki ayrı puan kaynağı görünüyor ve hangisinin
        geçerli olduğu belirsiz kalıyordu. Puanı hakem verir; koordinasyon
        ön değerlendirmeyi başlatır ve sonucu izler.
      */}
      {/*
        KAYNAKÇA DENETİMİ ÖN DEĞERLENDİRMENİN ÜSTÜNDE.

        İkisi de ücretli ve ikisi de koordinasyonun başlattığı iş, ama
        sıra tesadüf değil: uydurma kaynakça bulunan bir raporda puanlama
        tartışmalı hale geliyor. Koordinasyonun önce bakması gereken şey bu.
      */}
      <KaynakcaDenetimi
        raporId={rapor.id}
        baslangic={
          denetim
            ? {
                durum: denetim.durum,
                karar: denetim.karar,
                adimlar: denetim.adimlar,
                tur: denetim.tur,
                maliyet: denetim.maliyet,
                hata: denetim.hata,
              }
            : null
        }
      />

      <AiOnDegerlendirme
        raporId={rapor.id}
        olcutler={kategori.rubrik.kriterler}
        hakemAtandi={atananlar.length > 0}
        ai={
          rapor.aiDegerlendirme
            ? {
                aiToplam: rapor.aiDegerlendirme.aiToplam,
                azamiToplam: rapor.aiDegerlendirme.azamiToplam,
                incelemeGereken: rapor.aiDegerlendirme.incelemeGereken,
                maliyet: rapor.aiDegerlendirme.kullanim.maliyet,
                sureMs: rapor.aiDegerlendirme.sureMs,
                genelGucluYonler: rapor.aiDegerlendirme.genelGucluYonler,
                genelGelisimAlanlari: rapor.aiDegerlendirme.genelGelisimAlanlari,
                sartnameIhlalleri: rapor.aiDegerlendirme.sartnameIhlalleri ?? [],
                kriterler: rapor.aiDegerlendirme.kriterler.map((k) => ({
                  kod: k.kod,
                  ad: k.ad,
                  aiPuan: k.aiPuan,
                  azamiPuan: k.azamiPuan,
                  guven: k.guven,
                  gerekce: k.gerekce,
                  kanitlar: k.kanitlar,
                  oneri: k.oneri,
                  hakemIncelemesiGerekli: k.hakemIncelemesiGerekli,
                })),
              }
            : undefined
        }
      />

      {/* Rapor belgesi — koordinasyon da görebilmeli. */}
      <section className="mb-4 overflow-hidden rounded-xl border border-cizgi bg-white">
        <div className="flex items-center gap-2.5 border-b border-cizgi px-4 py-2.5">
          <h2 className="text-[12.5px] font-bold">Rapor belgesi</h2>
          <a
            href={`/api/rapor/${rapor.id}/dosya`}
            target="_blank"
            rel="noreferrer"
            className="ml-auto text-[11.5px] font-bold text-kirmizi hover:text-kirmizi-koyu"
          >
            Yeni sekmede aç →
          </a>
        </div>
        {rapor.dosyaYolu ? (
          <iframe
            src={`/api/rapor/${rapor.id}/dosya#view=FitH`}
            title="Rapor"
            className="h-[560px] w-full"
          />
        ) : (
          <p className="px-4 py-12 text-center text-[12px] font-medium text-metin-2">
            Bu rapor Word olarak yüklendiği için gömülü görüntüleme yok.
          </p>
        )}
      </section>

      {/*
        YAZIŞMA ARTIK İKİ YÖNLÜ.
        Eskiden yalnızca koordinasyon yazabiliyordu ve gönderen kendi
        rolünü SEÇİYORDU — herkes "hakem" olarak mesaj atabiliyordu.
        Artık hakem kendi panelinden yazıyor, kimliği erişim kodundan
        geliyor ve cevap bekleyen soru panoda "yapılacak iş" olarak
        sayılıyor.
      */}
      <Yazisma raporId={rapor.id} baslangic={rapor.mesajlar ?? []} />
    </>
  );
}
