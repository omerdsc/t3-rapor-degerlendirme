'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { RubrikKriteri } from '@/lib/analiz/sablon-cikar';
import type { Guven } from '@/lib/ai/degerlendirme';
import DuzenlenebilirListe from './duzenlenebilir-liste';

/**
 * Hakemin puanlama formu.
 *
 * ── YAPAY ZEKÂ ÖNERİSİ NEDEN GÖSTERİLİYOR ───────────────────────────────
 * Göstermemek "kör hakem" gibi görünür ama sistemin amacı hakemi
 * hızlandırmak. Öneriyi gizlemek, hakemin raporu sıfırdan okumasını
 * gerektirirdi — sistemin var oluş nedeni ortadan kalkar.
 *
 * Buna karşılık öneri BAĞLAYICI DEĞİL ve öyle sunuluyor: puan alanı boş
 * başlıyor, öneri yanında gri duruyor, "öneriyi al" ayrı bir tıklama.
 * Hakemin öneriden saptığı yer ayrıca kaydediliyor — sistem kendi
 * güvenilirliğini bu farkla ölçüyor.
 *
 * ── TAMAMLAMA GERİ ALINAMAZ ─────────────────────────────────────────────
 * Bilinçli. Tamamlanmış bir değerlendirme bir karardır; sessizce
 * değiştirilebilirse denetim izi anlamsız kalır. Düzeltme gerekiyorsa
 * koordinasyon devreye giriyor.
 *
 * ── YARIŞMACIYA GİDEN METNİ HAKEM ONAYLIYOR ─────────────────────────────
 * Güçlü yönler, gelişime açık alanlar ve öneriler yapay zekâ önerisiyle
 * DOLU gelir; hakem düzeltir, siler, ekler ve tamamlayınca onaylamış olur.
 * Eskiden bu metinler doğrudan model çıktısından yarışmacı ekranına
 * basılıyordu — kimse okumadan. Puanı hakemden alıp metni modelden almak
 * tutarsızdı: yarışmacı için geri bildirim de bir karardır.
 */

interface AiKriter {
  kod: string;
  aiPuan: number;
  guven: Guven;
  gerekce: string;
  kanitlar: Array<{ alinti: string; sayfa?: number }>;
  oneri?: string;
  hakemIncelemesiGerekli: boolean;
}

const GUVEN_SINIF: Record<Guven, string> = {
  yuksek: 'bg-yesil-zemin text-yesil-koyu',
  orta: 'bg-mavi-zemin text-mavi-koyu',
  dusuk: 'bg-amber-zemin text-amber-koyu',
};

export default function HakemPuanlama({
  kod,
  raporId,
  olcutler,
  toplamPuan,
  aiKriterler,
  baslangicPuanlar,
  baslangicAciklama,
  baslangicGeriBildirim,
  aiGucluYonler,
  aiGelisimAlanlari,
  tamamlandi,
}: {
  kod: string;
  raporId: string;
  olcutler: RubrikKriteri[];
  toplamPuan: number;
  aiKriterler: AiKriter[];
  baslangicPuanlar: Record<string, string>;
  baslangicAciklama: string;
  /** Kayıtlı taslak geri bildirim; yoksa yapay zekâ önerisi kullanılır. */
  baslangicGeriBildirim?: {
    gucluYonler: string[];
    gelisimAlanlari: string[];
    oneriler: Array<{ kriterKodu: string; metin: string }>;
  };
  aiGucluYonler: string[];
  aiGelisimAlanlari: string[];
  tamamlandi: boolean;
}) {
  const yonlendir = useRouter();
  const [puanlar, setPuanlar] = useState<Record<string, string>>(baslangicPuanlar);
  const [notlar, setNotlar] = useState<Record<string, string>>({});
  const [aciklama, setAciklama] = useState(baslangicAciklama);

  /*
   * Geri bildirim: kayıtlı taslak varsa o, yoksa yapay zekâ önerisi.
   * Hakem hiç dokunmasa bile modelin önerisi tamamlamayla ONAYLANMIŞ
   * olur — bilinçli: hakem okuyup uygun bulduğu için bırakmıştır.
   * Silmek de bir karar; boş bırakılan bölüm yarışmacıya gösterilmiyor.
   */
  const [guclu, setGuclu] = useState<string[]>(
    baslangicGeriBildirim?.gucluYonler ?? aiGucluYonler,
  );
  const [gelisim, setGelisim] = useState<string[]>(
    baslangicGeriBildirim?.gelisimAlanlari ?? aiGelisimAlanlari,
  );
  const [oneriler, setOneriler] = useState<Record<string, string>>(() => {
    if (baslangicGeriBildirim) {
      return Object.fromEntries(
        baslangicGeriBildirim.oneriler.map((o) => [o.kriterKodu, o.metin]),
      );
    }
    return Object.fromEntries(
      aiKriterler.filter((k) => k.oneri).map((k) => [k.kod, k.oneri!]),
    );
  });
  const [calisiyor, setCalisiyor] = useState<'taslak' | 'tamamla' | null>(null);
  const [mesaj, setMesaj] = useState<{ tur: 'hata' | 'bilgi'; metin: string } | null>(null);

  const ai = useMemo(
    () => new Map(aiKriterler.map((k) => [k.kod, k])),
    [aiKriterler],
  );

  const toplam = useMemo(
    () =>
      Math.round(
        Object.values(puanlar).reduce((t, v) => t + (Number(v) || 0), 0) * 10,
      ) / 10,
    [puanlar],
  );
  const girilen = olcutler.filter(
    (k) => puanlar[k.kod] !== undefined && puanlar[k.kod] !== '',
  ).length;

  async function kaydet(tamamla: boolean) {
    setCalisiyor(tamamla ? 'tamamla' : 'taslak');
    setMesaj(null);
    try {
      const y = await fetch('/api/hakem-degerlendirme', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kod,
          raporId,
          tamamla,
          aciklama,
          geriBildirim: {
            gucluYonler: guclu.map((g) => g.trim()).filter(Boolean),
            gelisimAlanlari: gelisim.map((g) => g.trim()).filter(Boolean),
            oneriler: Object.entries(oneriler)
              .filter(([, m]) => m.trim())
              .map(([kriterKodu, metin]) => ({ kriterKodu, metin: metin.trim() })),
          },
          puanlar: olcutler
            .filter((k) => puanlar[k.kod] !== undefined && puanlar[k.kod] !== '')
            .map((k) => ({
              kriterKodu: k.kod,
              puan: Number(puanlar[k.kod]) || 0,
              not: notlar[k.kod],
            })),
        }),
      });
      const d = await y.json();
      if (!y.ok) setMesaj({ tur: 'hata', metin: d.hata ?? 'Kaydedilemedi.' });
      else {
        setMesaj({
          tur: 'bilgi',
          metin: tamamla
            ? d.raporTamamlandi
              ? 'Değerlendirmeniz tamamlandı. Bütün hakemler bitirdi.'
              : 'Değerlendirmeniz tamamlandı. Diğer hakemler bekleniyor.'
            : 'Taslak kaydedildi.',
        });
        yonlendir.refresh();
      }
    } catch (e) {
      setMesaj({ tur: 'hata', metin: e instanceof Error ? e.message : 'Ağ hatası.' });
    } finally {
      setCalisiyor(null);
    }
  }

  return (
    <div className="rounded-xl border border-cizgi bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-cizgi px-4 py-3">
        <h2 className="text-[14px] font-bold">Değerlendirmeniz</h2>
        <span className="text-[11.5px] font-medium text-metin-2">
          {girilen}/{olcutler.length} ölçüt
        </span>
        <div className="ml-auto text-right">
          <div className="text-[19px] leading-none font-extrabold">
            {toplam}
            <span className="text-[13px] font-semibold text-metin-2">/{toplamPuan}</span>
          </div>
        </div>
      </div>

      {tamamlandi && (
        <p className="border-b border-yesil/25 bg-yesil-zemin px-4 py-2.5 text-[11.5px] font-semibold text-yesil-koyu">
          Bu değerlendirmeyi tamamladınız. Kayıt değiştirilemez — düzeltme
          gerekiyorsa koordinasyona bildirin.
        </p>
      )}

      <div className="flex flex-col gap-2 p-4">
        {olcutler.map((k) => {
          const a = ai.get(k.kod);
          const deger = puanlar[k.kod] ?? '';
          const sapma =
            a && deger !== '' ? Math.round((Number(deger) - a.aiPuan) * 10) / 10 : null;

          return (
            <div key={k.kod} className="rounded-lg border border-cizgi px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="min-w-0 flex-1 text-[12.5px] font-bold">{k.ad}</span>

                {a && (
                  <>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wide ${GUVEN_SINIF[a.guven]}`}
                    >
                      {a.guven === 'yuksek' ? 'YÜKSEK' : a.guven === 'orta' ? 'ORTA' : 'DÜŞÜK'} GÜVEN
                    </span>
                    <span className="text-[11px] font-medium text-metin-2">
                      öneri {a.aiPuan}
                    </span>
                    {!tamamlandi && (
                      <button
                        type="button"
                        onClick={() =>
                          setPuanlar((o) => ({ ...o, [k.kod]: String(a.aiPuan) }))
                        }
                        className="cursor-pointer text-[11px] font-bold text-kirmizi hover:text-kirmizi-koyu"
                      >
                        öneriyi al
                      </button>
                    )}
                  </>
                )}

                <input
                  value={deger}
                  disabled={tamamlandi}
                  inputMode="decimal"
                  onChange={(e) =>
                    setPuanlar((o) => ({ ...o, [k.kod]: e.target.value }))
                  }
                  placeholder="—"
                  className="w-16 shrink-0 rounded-lg border border-cizgi px-2 py-1.5 text-center text-[13px] font-bold outline-none focus:border-metin-3 disabled:bg-zemin"
                />
                <span className="w-8 shrink-0 text-[11.5px] font-semibold text-metin-2">
                  /{k.puan}
                </span>

                {sapma !== null && sapma !== 0 && (
                  <span
                    className={`w-12 shrink-0 text-[11px] font-bold ${
                      sapma > 0 ? 'text-yesil-koyu' : 'text-amber-koyu'
                    }`}
                    title="Yapay zekâ önerisinden farkınız"
                  >
                    {sapma > 0 ? '+' : ''}
                    {sapma}
                  </span>
                )}
              </div>

              {a && (
                <details className="mt-1.5">
                  <summary className="cursor-pointer text-[11px] font-bold text-metin-2">
                    Ön değerlendirme gerekçesi
                    {a.hakemIncelemesiGerekli && (
                      <span className="ml-1.5 text-amber-koyu">· inceleme öneriliyor</span>
                    )}
                  </summary>
                  <p className="mt-1 text-[11px] leading-relaxed text-metin">
                    {a.gerekce}
                  </p>
                  {a.kanitlar.map((kn, i) => (
                    <p key={i} className="mt-1 text-[10.5px] leading-relaxed text-metin-2 italic">
                      &ldquo;{kn.alinti}&rdquo;
                      {kn.sayfa ? (
                        <span className="ml-1 font-semibold not-italic">s.{kn.sayfa}</span>
                      ) : null}
                    </p>
                  ))}
                  {a.oneri && (
                    <p className="mt-1 text-[10.5px] leading-relaxed font-medium text-mavi-koyu">
                      İyileştirme önerisi: {a.oneri}
                    </p>
                  )}
                </details>
              )}

              {!tamamlandi && (
                <input
                  value={notlar[k.kod] ?? ''}
                  onChange={(e) =>
                    setNotlar((o) => ({ ...o, [k.kod]: e.target.value }))
                  }
                  placeholder="Bu ölçüt için notunuz (yarışmacıya gösterilir)"
                  className="mt-1.5 w-full rounded-lg border border-cizgi px-2.5 py-1.5 text-[11.5px] font-medium outline-none focus:border-metin-3"
                />
              )}
            </div>
          );
        })}
      </div>

      {/*
        YARIŞMACIYA GİDECEK GERİ BİLDİRİM.
        Üç bölüm de yapay zekâ önerisiyle dolu geliyor; hakem düzeltip
        tamamladığında onaylamış olur. Puanlamadan SONRA duruyor: hakem
        önce raporu değerlendirir, sonra ne söyleyeceğine karar verir.
      */}
      <div className="border-t border-cizgi bg-zemin/40 px-4 py-3.5">
        <div className="mb-3 flex flex-wrap items-center gap-2.5">
          <h3 className="text-[13px] font-bold">Yarışmacıya gidecek geri bildirim</h3>
          <span className="rounded bg-mavi-zemin px-2 py-0.5 text-[9px] font-bold tracking-wide text-mavi-koyu">
            SİZİN ONAYINIZLA YAYIMLANIR
          </span>
        </div>
        <p className="mb-3 text-[11px] leading-relaxed font-medium text-metin-2">
          Aşağıdaki metinler yapay zekâ tarafından önerildi. Düzeltin, silin
          ya da ekleyin — <strong className="font-bold text-metin">
          değerlendirmeyi tamamladığınızda bu hâliyle yarışmacıya gider</strong>.
          Onaylamadığınız hiçbir cümle yayımlanmaz.
        </p>

        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="size-2 rounded-full bg-yesil" />
              <span className="text-[11.5px] font-bold">Güçlü yönler</span>
              <span className="text-[10.5px] font-medium text-metin-3">
                {guclu.filter((g) => g.trim()).length} madde
              </span>
            </div>
            <DuzenlenebilirListe
              satirlar={guclu}
              degistir={setGuclu}
              kilit={tamamlandi}
              yerTutucu="Projenin güçlü bulduğunuz bir yönü"
              modelOnerisi={aiGucluYonler}
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="size-2 rounded-full bg-amber" />
              <span className="text-[11.5px] font-bold">Gelişime açık alanlar</span>
              <span className="text-[10.5px] font-medium text-metin-3">
                {gelisim.filter((g) => g.trim()).length} madde
              </span>
            </div>
            <DuzenlenebilirListe
              satirlar={gelisim}
              degistir={setGelisim}
              kilit={tamamlandi}
              yerTutucu="Geliştirilmesi gereken bir alan"
              modelOnerisi={aiGelisimAlanlari}
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="size-2 rounded-full bg-mavi" />
              <span className="text-[11.5px] font-bold">Ölçüt bazında öneriler</span>
              <span className="text-[10.5px] font-medium text-metin-3">
                {Object.values(oneriler).filter((m) => m.trim()).length}/
                {olcutler.length} ölçüt
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {olcutler.map((k) => {
                const kayip = Math.max(
                  0,
                  k.puan - (Number(puanlar[k.kod]) || 0),
                );
                return (
                  <div key={k.kod} className="flex items-start gap-2">
                    <span className="mt-1.5 w-[132px] shrink-0 truncate text-[10.5px] font-bold text-metin-2">
                      {k.ad}
                    </span>
                    {/* Kaç puan kaybedildiği burada gösteriliyor: hakem
                        önceliği görsün, en çok kaybedilen ölçüte öneri
                        yazmak en değerli. */}
                    <span
                      className={`mt-1.5 w-[52px] shrink-0 text-[10px] font-bold ${
                        kayip > 0 ? 'text-amber-koyu' : 'text-metin-3'
                      }`}
                    >
                      {kayip > 0 ? `−${Math.round(kayip * 10) / 10} puan` : 'tam'}
                    </span>
                    <textarea
                      value={oneriler[k.kod] ?? ''}
                      disabled={tamamlandi}
                      rows={2}
                      onChange={(e) =>
                        setOneriler((o) => ({ ...o, [k.kod]: e.target.value }))
                      }
                      placeholder="Bu ölçütte nasıl gelişebilir?"
                      className="min-w-0 flex-1 resize-y rounded-lg border border-cizgi bg-white px-2.5 py-1.5 text-[11px] leading-relaxed font-medium outline-none focus:border-metin-3 disabled:bg-zemin"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-cizgi px-4 py-3">
        <textarea
          value={aciklama}
          disabled={tamamlandi}
          onChange={(e) => setAciklama(e.target.value)}
          rows={3}
          placeholder="Genel değerlendirme notunuz — yarışmacıya gösterilir."
          className="w-full rounded-lg border border-cizgi px-3 py-2 text-[12px] font-medium outline-none focus:border-metin-3 disabled:bg-zemin"
        />

        {!tamamlandi && (
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={calisiyor !== null}
              onClick={() => kaydet(false)}
              className="cursor-pointer rounded-lg border border-cizgi px-4 py-2.5 text-[12.5px] font-bold transition-colors hover:bg-zemin disabled:opacity-50"
            >
              {calisiyor === 'taslak' ? 'Kaydediliyor…' : 'Taslak kaydet'}
            </button>
            <button
              type="button"
              disabled={calisiyor !== null || girilen < olcutler.length}
              onClick={() => kaydet(true)}
              className="cursor-pointer rounded-lg bg-kirmizi px-5 py-2.5 text-[12.5px] font-bold text-white transition-colors hover:bg-kirmizi-koyu disabled:opacity-50"
            >
              {calisiyor === 'tamamla' ? 'Tamamlanıyor…' : 'Değerlendirmeyi tamamla'}
            </button>
            {girilen < olcutler.length && (
              <span className="text-[11px] font-medium text-metin-2">
                Tamamlamak için {olcutler.length - girilen} ölçüt daha
              </span>
            )}
          </div>
        )}
      </div>

      {mesaj && (
        <p
          className={`px-4 py-2.5 text-[12px] font-semibold ${
            mesaj.tur === 'hata'
              ? 'bg-kirmizi-zemin text-kirmizi-koyu'
              : 'bg-yesil-zemin text-yesil-koyu'
          }`}
        >
          {mesaj.metin}
        </p>
      )}
    </div>
  );
}
