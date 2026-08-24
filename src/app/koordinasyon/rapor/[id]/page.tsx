import Link from 'next/link';
import { notFound } from 'next/navigation';
import DegerlendirmePaneli from '@/components/degerlendirme-paneli';
import { DurumRozeti, SeviyeRozeti } from '@/components/rozet';
import Yazisma from '@/components/yazisma';
import { kategoriGetir, raporGetir, yarismaGetir } from '@/lib/depo/depo';
import HakemSonuclari, { type HakemSonucu } from '@/components/hakem-sonuclari';
import KimlikPaneli from '@/components/kimlik-paneli';
import {
  nihaiOzet, raporunDegerlendirmeleri, raporunHakemleri,
} from '@/lib/db/hakem-depo';
import { raporuMaskele } from '@/lib/depo/maskele';

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
  const degerlendirmeler = raporunDegerlendirmeleri(rapor.id);
  const ozet = nihaiOzet(rapor.id);

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
              {maske.basvuruNo} · {maske.takim} · {maske.raporKodu} ·{' '}
              {rapor.istatistik.sayfaSayisi} sayfa ·{' '}
              {rapor.istatistik.kelimeSayisi.toLocaleString('tr')} kelime ·{' '}
              {rapor.istatistik.gorselSayisi} görsel · {yarisma.ad} · {kategori.ad}
            </p>
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

      {/* Ön kontrol şeridi — dört otomatik kontrol tek bakışta */}
      <div className="mb-4 flex flex-wrap gap-2.5 rounded-xl border border-cizgi bg-white px-5 py-3.5">
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

      {/* Otomatik kontrollerin bulguları */}
      {rapor.kontroller.some((k) => k.bulgular.length > 0) && (
        <details className="mb-4 rounded-xl border border-cizgi bg-white" open={rapor.genelDurum === 'hata'}>
          <summary className="cursor-pointer px-5 py-3.5 text-[13px] font-bold">
            Ön kontrol bulguları
            <span className="ml-2 font-medium text-metin-2">
              ({rapor.kontroller.reduce((t, k) => t + k.bulgular.length, 0)} bulgu · maliyet $0)
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

      {/* Kaydın tamamı DEĞİL, panelin kullandığı alanlar gönderiliyor:
          istemciye inen her alan sayfa kaynağında okunabilir. */}
      <DegerlendirmePaneli
        rapor={{
          id: rapor.id,
          durum: rapor.durum,
          dosyaYolu: rapor.dosyaYolu,
          hakemPuanlari: rapor.hakemPuanlari,
          hakemNotu: rapor.hakemNotu,
          aiDegerlendirme: rapor.aiDegerlendirme,
        }}
        rubrik={kategori.rubrik}
      />

      <Yazisma raporId={rapor.id} baslangic={rapor.mesajlar ?? []} />
    </>
  );
}
