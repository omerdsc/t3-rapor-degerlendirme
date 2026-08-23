'use client';

import { useState } from 'react';
import type { KimlikUyusmazligi, RaporKimligi } from '@/lib/analiz/kimlik';

/**
 * Rapor kimlik paneli.
 *
 * İKİ KAYNAK YAN YANA
 * Soldaki değerler BAŞVURUDAN (yükleme formu), sağdaki RAPOR KAPAĞINDAN
 * okundu. İkisini ayrı göstermek şart: çelişki tek başına bir bulgu —
 * yanlış dosya yüklenmiş, eski takımın şablonu doldurulmuş ya da başvuru
 * kaydı hatalı olabilir. Tek alanda birleştirilse bu görünmez olurdu.
 *
 * MASKELEME İLE İLİŞKİSİ
 * Ekranın üst kısmında takım adı rumuzla gösteriliyor (hakem yanlılığını
 * azaltmak ve kişisel veriyi ekranda tutmamak için). Bu panel KAPALI
 * başlıyor ve açmak bilinçli bir eylem: koordinasyon gerçek künyeyi görmek
 * istediğinde açar, hakem puanlarken açmak zorunda kalmaz.
 */
interface Veri {
  basvuru: { basvuruNo: string; takim: string; takimId: string; proje: string };
  kimlik: RaporKimligi | null;
  uyusmazlik: KimlikUyusmazligi[];
}

export default function KimlikPaneli({
  raporId,
  uyusmazlikSayisi,
  kapaktanOkundu,
}: {
  raporId: string;
  /**
   * Özet sayaçlar sayfa yüküyle geliyor — bunlar kimlik DEĞİL, yalnızca
   * "burada bakılacak bir şey var mı" bilgisi. Kapalı başlıkta uyarı
   * göstermek için gerekli; gerçek adları taşımıyorlar.
   */
  uyusmazlikSayisi: number;
  kapaktanOkundu: boolean;
}) {
  const [acik, setAcik] = useState(false);
  const [veri, setVeri] = useState<Veri | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const sorunlu = uyusmazlikSayisi > 0;

  /*
   * Gerçek künye AÇILDIĞINDA çekiliyor.
   *
   * Sayfa yüküyle gelseydi panel kapalı olsa bile gerçek takım adı sayfa
   * kaynağında düz metin olarak dururdu — maskelemeyi anlamsız kılan tam
   * o hata. Bir kez çekilip bellekte tutuluyor; ikinci açılışta istek yok.
   */
  async function ac() {
    setAcik(true);
    if (veri || yukleniyor) return;
    setYukleniyor(true);
    setHata(null);
    try {
      const y = await fetch(`/api/rapor/${raporId}/kimlik`);
      const d = await y.json();
      if (!y.ok) setHata(d.hata ?? 'Bilgiler alınamadı.');
      else setVeri(d);
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Ağ hatası.');
    } finally {
      setYukleniyor(false);
    }
  }

  const satirlar: Array<[string, string, string | undefined]> = veri
    ? [
        ['Başvuru numarası', veri.basvuru.basvuruNo, veri.kimlik?.basvuruId],
        ['Takım adı', veri.basvuru.takim, veri.kimlik?.takimAdi],
        ['Takım ID', veri.basvuru.takimId, veri.kimlik?.takimId],
        ['Proje adı', veri.basvuru.proje, veri.kimlik?.projeAdi],
      ]
    : [];

  return (
    <div
      className={`mb-4 overflow-hidden rounded-xl border bg-white ${
        sorunlu ? 'border-amber/50' : 'border-cizgi'
      }`}
    >
      <button
        type="button"
        onClick={() => (acik ? setAcik(false) : void ac())}
        className="flex w-full cursor-pointer flex-wrap items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-zemin/60"
      >
        <span className="text-[12.5px] font-bold">Takım ve başvuru bilgileri</span>

        {sorunlu ? (
          <span className="rounded bg-amber-zemin px-2 py-0.5 text-[9.5px] font-bold tracking-wide text-amber-koyu">
            {uyusmazlikSayisi} ALAN UYUŞMUYOR
          </span>
        ) : kapaktanOkundu ? (
          <span className="rounded bg-yesil-zemin px-2 py-0.5 text-[9.5px] font-bold tracking-wide text-yesil-koyu">
            RAPORLA UYUMLU
          </span>
        ) : (
          <span
            className="rounded bg-zemin px-2 py-0.5 text-[9.5px] font-bold tracking-wide text-metin-2"
            title="Kapak sayfasında etiketli kimlik alanı bulunamadı"
          >
            KAPAKTAN OKUNAMADI
          </span>
        )}

        <span className="ml-auto text-[11.5px] font-bold text-kirmizi">
          {acik ? 'Gizle' : 'Göster'}
        </span>
      </button>

      {acik && (
        <div className="border-t border-cizgi px-4 py-3">
          {yukleniyor && (
            <p className="text-[11.5px] font-medium text-metin-2">Bilgiler alınıyor…</p>
          )}
          {hata && (
            <p className="text-[11.5px] font-semibold text-kirmizi-koyu">{hata}</p>
          )}
          {veri && (
            <>
          <div className="mb-2 grid grid-cols-[1fr_1fr_1fr] gap-x-3 text-[9.5px] font-bold tracking-wide text-metin-3">
            <span>ALAN</span>
            <span>BAŞVURUDA GİRİLEN</span>
            <span>RAPOR KAPAĞINDA</span>
          </div>

          <div className="flex flex-col gap-1">
            {satirlar.map(([ad, girilen, raporda]) => {
              const cakisan = veri?.uyusmazlik.some((u) =>
                u.alan.startsWith(ad.split(' ')[0]),
              );
              return (
                <div
                  key={ad}
                  className={`grid grid-cols-[1fr_1fr_1fr] items-baseline gap-x-3 rounded-md px-2 py-1.5 ${
                    cakisan ? 'bg-amber-zemin' : 'bg-zemin/60'
                  }`}
                >
                  <span className="text-[11px] font-medium text-metin-2">{ad}</span>
                  <span className="min-w-0 truncate text-[11.5px] font-semibold">
                    {girilen}
                  </span>
                  <span
                    className={`min-w-0 truncate text-[11.5px] ${
                      raporda ? 'font-semibold' : 'font-medium text-metin-3'
                    }`}
                  >
                    {raporda ?? '—'}
                  </span>
                </div>
              );
            })}
          </div>

          {sorunlu && veri && (
            <p className="mt-2.5 rounded-md bg-amber-zemin px-3 py-2 text-[11px] leading-relaxed font-medium text-amber-koyu">
              <strong className="font-bold">Başvuru kaydı ile rapor kapağı çelişiyor.</strong>{' '}
              Yanlış dosya yüklenmiş, başka bir takımın şablonu doldurulmuş ya
              da başvuru bilgisi hatalı girilmiş olabilir. Puanlamadan önce
              doğrulanması gerekir — bu tek başına bir kural ihlali değildir
              ama hangi raporu değerlendirdiğinizden emin olmalısınız.
            </p>
          )}

          {!veri.kimlik?.bulunan.length && (
            <p className="mt-2.5 text-[11px] leading-relaxed font-medium text-metin-2">
              Rapor kapağında etiketli kimlik alanı (&ldquo;Takım Adı:&rdquo;,
              &ldquo;Takım ID:&rdquo;) bulunamadı — alanlar tabloya ya da
              görsele gömülü olabilir.{' '}
              <strong className="font-bold">Bu bir kusur değildir</strong> ve
              hiçbir kritere puan olarak yansımaz; yalnızca karşılaştırma
              yapılamadı demektir.
            </p>
          )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
