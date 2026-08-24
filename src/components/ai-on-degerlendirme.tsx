'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { RubrikKriteri } from '@/lib/analiz/sablon-cikar';
import type { Guven } from '@/lib/ai/degerlendirme';

/**
 * Yapay zekâ ön değerlendirmesi — KOORDİNASYON GÖRÜNÜMÜ, SALT OKUNUR.
 *
 * ── NEDEN BURADA PUAN GİRİLMİYOR ────────────────────────────────────────
 * Önceki sürümde bu panel aynı zamanda bir puanlama formuydu: koordinasyon
 * ekranında "Taslak kaydet" ve "Nihai değerlendirmeyi tamamla" düğmeleri
 * vardı. Hakem paneli eklendikten sonra bu tutarsız hale geldi — aynı
 * ekranda iki ayrı puan kaynağı görünüyordu ve hangisinin geçerli olduğu
 * belirsizdi.
 *
 * Sorumluluk ayrımı net: PUANI HAKEM VERİR. Koordinasyon ön
 * değerlendirmeyi BAŞLATIR (ücretli adım, bütçe kararı onun) ve sonucu
 * izler; puan girmez.
 *
 * ── ÖN DEĞERLENDİRME NEDEN KOORDİNASYONDA BAŞLATILIYOR ──────────────────
 * Rapor başına ~$0,18. Bunu hakemin başlatması, bütçe kararını hakeme
 * devretmek olurdu. Koordinasyon hangi raporlar için ön değerlendirme
 * istediğine karar veriyor; hakem hazır bulup kullanıyor.
 */

interface AiKriter {
  kod: string;
  ad: string;
  aiPuan: number;
  azamiPuan: number;
  guven: Guven;
  gerekce: string;
  kanitlar: Array<{ alinti: string; sayfa?: number }>;
  oneri?: string;
  hakemIncelemesiGerekli: boolean;
}

export interface AiOzeti {
  aiToplam: number;
  azamiToplam: number;
  incelemeGereken: number;
  maliyet: number;
  sureMs: number;
  kriterler: AiKriter[];
  genelGucluYonler: string[];
  genelGelisimAlanlari: string[];
  sartnameIhlalleri: Array<{
    kisit: string;
    guven: Guven;
    kanit: { alinti: string; sayfa?: number };
  }>;
}

const GUVEN_SINIF: Record<Guven, string> = {
  yuksek: 'bg-yesil-zemin text-yesil-koyu',
  orta: 'bg-mavi-zemin text-mavi-koyu',
  dusuk: 'bg-amber-zemin text-amber-koyu',
};

const GUVEN_ETIKET: Record<Guven, string> = {
  yuksek: 'YÜKSEK GÜVEN',
  orta: 'ORTA GÜVEN',
  dusuk: 'DÜŞÜK GÜVEN',
};

export default function AiOnDegerlendirme({
  raporId,
  olcutler,
  ai,
  hakemAtandi,
}: {
  raporId: string;
  olcutler: RubrikKriteri[];
  ai?: AiOzeti;
  /** Hiç hakem atanmadıysa ön değerlendirme henüz kimseye yaramıyor. */
  hakemAtandi: boolean;
}) {
  const yonlendir = useRouter();
  const [calisiyor, setCalisiyor] = useState(false);
  const [mesaj, setMesaj] = useState<{ tur: 'hata' | 'bilgi'; metin: string } | null>(null);
  const [acik, setAcik] = useState(false);

  async function baslat() {
    setCalisiyor(true);
    setMesaj(null);
    try {
      const y = await fetch(`/api/rapor/${raporId}/degerlendir`, { method: 'POST' });
      const d = await y.json();
      if (!y.ok) setMesaj({ tur: 'hata', metin: d.hata ?? 'Başarısız.' });
      else {
        setMesaj({
          tur: 'bilgi',
          metin:
            `Ön değerlendirme hazır · $${(d.maliyet ?? 0).toFixed(4)}` +
            (d.sekilSayisi ? ` · ${d.sekilSayisi} şekil okundu` : '') +
            (d.ozetMaliyeti ? ' · şartname özeti de üretildi' : ''),
        });
        yonlendir.refresh();
      }
    } catch (e) {
      setMesaj({ tur: 'hata', metin: e instanceof Error ? e.message : 'Ağ hatası.' });
    } finally {
      setCalisiyor(false);
    }
  }

  /* ---------------------------------------------- henüz çalıştırılmadı */
  if (!ai) {
    return (
      <div className="mb-4 rounded-xl border border-cizgi bg-white px-4 py-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-[13px] font-bold">Yapay zekâ ön değerlendirmesi</h2>
            <p className="mt-1 text-[11.5px] leading-relaxed font-medium text-metin-2">
              Ölçüt bazında puan önerisi, gerekçe ve rapordan alıntı üretir.
              Hakem bunu hazır bulur; kabul etmek zorunda değildir.{' '}
              <strong className="font-bold text-metin">
                Tek ücretli adım — rapor başına ~$0,18.
              </strong>{' '}
              Aynı rapor ikinci kez istenirse önbellekten gelir, ek maliyet
              olmaz.
            </p>
          </div>
          <button
            type="button"
            disabled={calisiyor}
            onClick={baslat}
            className="shrink-0 cursor-pointer rounded-lg bg-kirmizi px-4 py-2.5 text-[12.5px] font-bold text-white transition-colors hover:bg-kirmizi-koyu disabled:opacity-50"
          >
            {calisiyor ? 'Değerlendiriliyor… (~90 sn)' : 'Ön değerlendirmeyi başlat'}
          </button>
        </div>

        {!hakemAtandi && (
          <p className="mt-2.5 rounded-md bg-zemin px-3 py-2 text-[11px] leading-relaxed font-medium text-metin-2">
            Bu rapora henüz hakem atanmadı. Ön değerlendirme yine
            çalıştırılabilir ama onu görecek kimse yok — önce atama yapmak
            daha mantıklı.
          </p>
        )}

        {mesaj && (
          <p
            className={`mt-2.5 rounded-md px-3 py-2 text-[11.5px] font-semibold ${
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

  /* ------------------------------------------------------ sonuç görünümü */
  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-cizgi bg-white">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-cizgi px-4 py-3">
        <h2 className="text-[13px] font-bold">Yapay zekâ ön değerlendirmesi</h2>
        <span className="rounded bg-zemin px-2 py-0.5 text-[9.5px] font-bold tracking-wide text-metin-2">
          ÖNERİ · PUAN DEĞİL
        </span>
        {ai.incelemeGereken > 0 && (
          <span className="rounded bg-amber-zemin px-2 py-0.5 text-[9.5px] font-bold tracking-wide text-amber-koyu">
            {ai.incelemeGereken} ÖLÇÜT İNCELEME İSTİYOR
          </span>
        )}
        <div className="ml-auto text-right">
          <div className="text-[9.5px] font-bold tracking-wide text-metin-2">
            ÖNERİLEN TOPLAM
          </div>
          <div className="text-[16px] leading-tight font-extrabold text-metin-2">
            {ai.aiToplam}
            <span className="text-[11.5px] font-semibold">/{ai.azamiToplam}</span>
          </div>
        </div>
      </div>

      {/* Şartname ihlali puan konusu değil, uygunluk konusu — en üstte. */}
      {!!ai.sartnameIhlalleri.length && (
        <div className="border-b border-kirmizi/30 bg-kirmizi-zemin px-4 py-3">
          <p className="mb-2 text-[11.5px] font-bold text-kirmizi-koyu">
            Şartname uygunluk uyarısı — {ai.sartnameIhlalleri.length} katı
            kısıtla çelişki. Puanlamaya dahil DEĞİL; kararı hakem ve
            koordinasyon verir.
          </p>
          <ul className="flex flex-col gap-2">
            {ai.sartnameIhlalleri.map((i, n) => (
              <li key={n} className="rounded-md bg-white/70 px-2.5 py-2">
                <p className="text-[11px] font-bold text-kirmizi-koyu">{i.kisit}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-metin italic">
                  &ldquo;{i.kanit.alinti}&rdquo;
                  {i.kanit.sayfa ? (
                    <span className="ml-1 font-semibold not-italic text-metin-2">
                      s.{i.kanit.sayfa}
                    </span>
                  ) : null}
                </p>
                {i.guven !== 'yuksek' && (
                  <p className="mt-1 text-[10px] font-bold tracking-wide text-amber-koyu">
                    GÜVEN {i.guven.toLocaleUpperCase('tr')} — DOĞRULAYIN
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={() => setAcik((a) => !a)}
        className="w-full cursor-pointer px-4 py-2.5 text-left text-[11.5px] font-bold text-kirmizi transition-colors hover:bg-zemin/60"
      >
        {acik
          ? 'Ölçüt bazında öneriyi kapat'
          : `Ölçüt bazında öneriyi gör (${ai.kriterler.length} ölçüt) →`}
      </button>

      {acik && (
        <div className="flex flex-col gap-1.5 border-t border-cizgi px-4 py-3">
          {olcutler.map((o) => {
            const k = ai.kriterler.find((x) => x.kod === o.kod);
            if (!k) return null;
            return (
              <div key={o.kod} className="rounded-lg bg-zemin/60 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 text-[12px] font-bold">{o.ad}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wide ${GUVEN_SINIF[k.guven]}`}
                  >
                    {GUVEN_ETIKET[k.guven]}
                  </span>
                  <span className="text-[13px] font-extrabold">
                    {k.aiPuan}
                    <span className="text-[10.5px] font-semibold text-metin-2">
                      /{o.puan}
                    </span>
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-metin">{k.gerekce}</p>
                {k.kanitlar.slice(0, 2).map((kn, i) => (
                  <p key={i} className="mt-1 text-[10.5px] leading-relaxed text-metin-2 italic">
                    &ldquo;{kn.alinti}&rdquo;
                    {kn.sayfa ? (
                      <span className="ml-1 font-semibold not-italic">s.{kn.sayfa}</span>
                    ) : null}
                  </p>
                ))}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-cizgi px-4 py-2 text-[10.5px] font-medium text-metin-2">
        <span>maliyet ${ai.maliyet.toFixed(4)}</span>
        <span>süre {Math.round(ai.sureMs / 1000)} sn</span>
        <span>bu öneri hakem panelinde de görünüyor</span>
      </div>
    </div>
  );
}
