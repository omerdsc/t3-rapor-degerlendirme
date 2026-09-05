'use client';

import { useState } from 'react';
import type { Adim, AjanDurumu } from '@/lib/ai/ajan';
import type { KopyaKarari, KopyaKararDetayi } from '@/lib/ai/kopya-ajani';
import AjanIzi from './ajan-izi';

/**
 * Kopya soruşturma paneli — işaretli çiftin altında.
 *
 * ── NİYE BURADA, AYRI EKRANDA DEĞİL ─────────────────────────────────────
 * Soruşturulan şey tam da bu çift ve koordinasyon zaten ölçümlere bakarken
 * karar veriyor: "bu ikisi gerçekten kopya mı?" Ayrı bir ekran, soruyu
 * soran yerle cevabı veren yeri birbirinden ayırırdı.
 *
 * ── DÜĞME NİYE HER ÇİFTTE AYRI ──────────────────────────────────────────
 * Bir kategoride otuz işaretli çift olabiliyor; hepsini soruşturmak
 * bütçeyi tek kategoride bitirir. Hangi çiftin soruşturulmaya değdiğine
 * koordinasyon karar veriyor — ölçümler zaten önünde.
 */

const KARAR_ETIKET: Record<KopyaKarari, string> = {
  kopya_suphesi_guclu: 'KOPYA ŞÜPHESİ GÜÇLÜ',
  incelenmeli: 'İNCELENMELİ',
  devam_projesi: 'DEVAM PROJESİ',
  sablon_kalibi: 'ŞABLON KALIBI',
  zayif_iz: 'ZAYIF İZ',
};

const KARAR_SINIF: Record<KopyaKarari, string> = {
  kopya_suphesi_guclu: 'bg-kirmizi text-white',
  incelenmeli: 'bg-amber-zemin text-amber-koyu',
  devam_projesi: 'bg-mavi-zemin text-mavi-koyu',
  sablon_kalibi: 'bg-zemin text-metin-2',
  zayif_iz: 'bg-zemin text-metin-2',
};

interface Yanit {
  durum: AjanDurumu;
  karar: KopyaKararDetayi | null;
  adimlar: Adim[];
  tur: number;
  maliyet: number;
  korpusBoyu?: number;
  hata?: string;
}

export default function KopyaSorusturmasi({
  aId,
  bId,
}: {
  aId: string;
  bId: string;
}) {
  const [sonuc, setSonuc] = useState<Yanit | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  async function sorustur() {
    setCalisiyor(true);
    setHata(null);
    try {
      const y = await fetch('/api/kopya-sorustur', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ a: aId, b: bId }),
      });
      const d = await y.json();
      if (!y.ok) setHata(d.hata ?? 'Soruşturma başarısız.');
      else setSonuc(d as Yanit);
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Ağ hatası.');
    } finally {
      setCalisiyor(false);
    }
  }

  const k = sonuc?.karar;

  return (
    <div className="mt-4 rounded-lg border border-mor/25 bg-mor-zemin/35 px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
        <h4 className="text-[12.5px] font-extrabold tracking-tight">
          Kopya soruşturması
        </h4>
        <span className="rounded bg-mor-zemin px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-mor">
          AJAN
        </span>
        {sonuc && (
          <span className="text-[10.5px] font-medium text-metin-3">
            {sonuc.tur} tur · {sonuc.adimlar.length} sorgu
            {sonuc.korpusBoyu ? ` · korpus ${sonuc.korpusBoyu}` : ''}
          </span>
        )}
        <button
          type="button"
          onClick={sorustur}
          disabled={calisiyor}
          className="dugme ml-auto border border-cizgi bg-white px-3 py-1.5 text-[11.5px] font-bold text-metin hover:bg-zemin disabled:opacity-50"
        >
          {calisiyor ? 'Soruşturuluyor…' : sonuc ? 'Yeniden soruştur' : 'Soruştur'}
        </button>
      </div>

      {!sonuc && !calisiyor && !hata && (
        <p className="mt-2 max-w-[78ch] text-[11.5px] leading-relaxed font-medium text-metin-2">
          Yukarıdaki oranlar örtüşmeyi ölçüyor ama ne anlama geldiğini
          söylemiyor: aynı sayılar gerçek kopyadan da çıkabilir, iki raporun
          aynı şartname kalıbını kullanmasından da. Ajan ortak cümleleri açıp{' '}
          <strong className="font-bold text-metin">
            korpusta kaç raporda geçtiklerini
          </strong>{' '}
          ölçer — kalıbı kalıp yapan şey zaten çok yerde geçmesidir.
        </p>
      )}

      {calisiyor && (
        <p className="mt-2 text-[11.5px] font-medium text-metin-2">
          Ortak cümleler açılıyor, korpus taranıyor… 30-60 saniye.
        </p>
      )}

      {hata && (
        <p className="mt-2 rounded-md bg-kirmizi-zemin px-3 py-2 text-[11px] font-semibold text-kirmizi-koyu">
          {hata}
        </p>
      )}

      {sonuc && sonuc.durum !== 'tamam' && (
        <p className="mt-2 rounded-md bg-amber-zemin px-3 py-2 text-[11px] font-semibold text-amber-koyu">
          Soruşturma tamamlanamadı ({sonuc.durum}). Aşağıdaki adımlar yapılanlar.
          {sonuc.hata ? ` ${sonuc.hata}` : ''}
        </p>
      )}

      {k && (
        <>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-md px-2 py-0.5 text-[9.5px] font-bold tracking-wide ${KARAR_SINIF[k.karar]}`}
            >
              {KARAR_ETIKET[k.karar]}
            </span>
            <span className="text-[9.5px] font-bold tracking-wide text-metin-3">
              {k.guven.toLocaleUpperCase('tr')} GÜVEN
            </span>
          </div>

          <p className="mt-2 text-[12.5px] leading-relaxed font-bold text-metin">
            {k.baslik}
          </p>
          <p className="mt-1.5 text-[11.5px] leading-relaxed font-medium text-metin-2">
            {k.gerekce}
          </p>

          {!!k.kanit.length && (
            <ul className="mt-2.5 flex flex-col gap-1">
              {k.kanit.map((x, i) => (
                <li
                  key={i}
                  className="rounded-md bg-white px-3 py-1.5 text-[11px] leading-relaxed font-medium text-metin"
                >
                  {x}
                </li>
              ))}
            </ul>
          )}

          <p className="mt-2.5 rounded-md bg-white px-3 py-2 text-[11.5px] leading-relaxed font-semibold text-metin">
            <span className="text-metin-3">Hakeme: </span>
            {k.hakemeNot}
          </p>
        </>
      )}

      {!!sonuc?.adimlar.length && <AjanIzi adimlar={sonuc.adimlar} />}
    </div>
  );
}
