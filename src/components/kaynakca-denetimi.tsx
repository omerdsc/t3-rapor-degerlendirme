'use client';

import { useState } from 'react';
import type { Adim, AjanDurumu } from '@/lib/ai/ajan';
import type { KaynakBulgusu, KaynakKarari, KaynakcaKarari } from '@/lib/ai/kaynakca-ajani';
import AjanIzi from './ajan-izi';

/**
 * Kaynakça denetim paneli — ajanın kararı VE nasıl vardığı.
 *
 * ── İZ NİYE GÖSTERİLİYOR ────────────────────────────────────────────────
 * "Bu künye uydurma şüphesi taşıyor" cümlesi tek başına bir hakem için
 * kara kutu. Hakem katılmıyorsa nereye bakacağını bilmiyor, katılıyorsa
 * neye güvendiğini bilmiyor. Hangi indekste ne arandığı ve ne bulunduğu
 * görününce cümle bir iddiadan bir kanıta dönüşüyor.
 *
 * İz ayrıca sistemin ne yaptığını dürüstçe gösteriyor: ajan bazı
 * künyelere hiç sorgu harcamıyor (standart olduğunu türünden anlıyor),
 * bazılarında üç ayrı arama yapıyor. Bunu gizlemek, tek çağrılık bir
 * özetle ajanı ayıran şeyi de gizlemek olurdu.
 *
 * ── SIRALAMA ────────────────────────────────────────────────────────────
 * Bulgular ağırlığa göre sıralı, kaynakça sırasına göre değil. Yirmi
 * künyelik bir listede tek uydurma künye ondördüncü sıradaysa ve liste
 * numaraya göre dizilmişse, hakem onu görmek için on üç "doğrulandı"
 * satırından geçmek zorunda kalır.
 */

const KARAR_ETIKET: Record<KaynakKarari, string> = {
  uydurma_suphesi: 'UYDURMA ŞÜPHESİ',
  bulunamadi: 'BULUNAMADI',
  kismen: 'KÜNYE SAPIYOR',
  indekslenemez: 'İNDEKS DIŞI',
  dogrulandi: 'DOĞRULANDI',
};

const KARAR_SINIF: Record<KaynakKarari, string> = {
  uydurma_suphesi: 'bg-kirmizi-zemin text-kirmizi-koyu',
  bulunamadi: 'bg-amber-zemin text-amber-koyu',
  kismen: 'bg-amber-zemin text-amber-koyu',
  indekslenemez: 'bg-zemin text-metin-2',
  dogrulandi: 'bg-yesil-zemin text-yesil-koyu',
};

/* Ağırlık sırası: hakemin önce görmesi gereken en üstte. */
const AGIRLIK: Record<KaynakKarari, number> = {
  uydurma_suphesi: 0, kismen: 1, bulunamadi: 2, indekslenemez: 3, dogrulandi: 4,
};

const DURUM_METNI: Record<AjanDurumu, string> = {
  tamam: '',
  tur_siniri: 'Ajan tur sınırına takıldı; bazı künyeler eksik kalmış olabilir.',
  butce: 'Bütçe tavanı doldu, soruşturma yarıda kesildi. Aşağıdaki adımlar yapılanlar.',
  hata: 'Denetim tamamlanamadı.',
};

interface Yanit {
  durum: AjanDurumu;
  karar: KaynakcaKarari | null;
  adimlar: Adim[];
  tur: number;
  maliyet: number;
  kunyeSayisi?: number;
  hata?: string;
}

export default function KaynakcaDenetimi({
  raporId,
  baslangic,
  saltOkunur = false,
}: {
  raporId: string;
  baslangic: Yanit | null;
  /**
   * `saltOkunur`: hakem panelinde düğme YOK, yalnızca sonuç var.
   *
   * Denetim ücretli ve bütçe ortak. Hakem panelinde bir "denetle"
   * düğmesi olsaydı, on hakem aynı gün aynı raporlarda çalıştırıp
   * tavanı kimsenin karar vermediği bir anda bitirebilirdi. Harcamayı
   * başlatan taraf koordinasyon; hakem sonucu okuyor.
   */
  saltOkunur?: boolean;
}) {
  const [sonuc, setSonuc] = useState<Yanit | null>(baslangic);
  const [calisiyor, setCalisiyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [izAcik, setIzAcik] = useState(false);

  async function calistir() {
    setCalisiyor(true);
    setHata(null);
    try {
      const y = await fetch(`/api/rapor/${raporId}/kaynakca-denetle`, { method: 'POST' });
      const d = await y.json();
      if (!y.ok) setHata(d.hata ?? 'Denetim başarısız.');
      else setSonuc(d as Yanit);
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Ağ hatası.');
    } finally {
      setCalisiyor(false);
    }
  }

  const bulgular = [...(sonuc?.karar?.bulgular ?? [])].sort(
    (a, b) => AGIRLIK[a.karar] - AGIRLIK[b.karar],
  );
  const sayim = bulgular.reduce<Partial<Record<KaynakKarari, number>>>((t, b) => {
    t[b.karar] = (t[b.karar] ?? 0) + 1;
    return t;
  }, {});
  const suphe = sayim.uydurma_suphesi ?? 0;

  /*
   * SONUÇ YOKSA HAKEME BOŞ KUTU GÖSTERİLMİYOR.
   * Koordinasyon henüz denetimi başlatmamışsa hakemin ekranında
   * yapabileceği bir şey olmayan bir bölüm durmasın.
   */
  if (saltOkunur && !sonuc) return null;

  return (
    <section className="kart mb-4 px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="text-[14px] font-extrabold tracking-tight">Kaynakça denetimi</h2>
        <span className="rounded bg-mor-zemin px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-mor">
          AJAN
        </span>
        {sonuc && (
          <span className="text-[11px] font-medium text-metin-3">
            {bulgular.length} künye · {sonuc.tur} tur · {sonuc.adimlar.length} sorgu
          </span>
        )}
        {!saltOkunur && (
          <button
            type="button"
            onClick={calistir}
            disabled={calisiyor}
            className="dugme ml-auto border border-cizgi px-3.5 py-1.5 text-[12px] font-bold text-metin hover:bg-zemin disabled:opacity-50"
          >
            {calisiyor
              ? 'Ajan çalışıyor…'
              : sonuc
                ? 'Yeniden denetle'
                : 'Kaynakçayı denetle'}
          </button>
        )}
      </div>

      {!sonuc && !calisiyor && !hata && !saltOkunur && (
        <p className="mt-2.5 max-w-[76ch] text-[12px] leading-relaxed font-medium text-metin-2">
          Ajan her künyeyi Crossref ve OpenAlex üzerinde araştırır; bulamadığında
          başlığı sadeleştirip yeniden dener. Sonunda{' '}
          <strong className="font-bold text-metin">
            &laquo;gerçek ama indeks dışı&raquo;
          </strong>{' '}
          ile{' '}
          <strong className="font-bold text-metin">&laquo;uydurma şüphesi&raquo;</strong>{' '}
          ayrımını yapar — biçim kontrolünün yakalayamadığı tek şey budur.
        </p>
      )}

      {calisiyor && (
        <p className="mt-2.5 text-[12px] font-medium text-metin-2">
          Künyeler araştırılıyor. Künye sayısına göre 20-60 saniye sürebilir.
        </p>
      )}

      {hata && (
        <p className="mt-2.5 rounded-md bg-kirmizi-zemin px-3 py-2 text-[11.5px] font-semibold text-kirmizi-koyu">
          {hata}
        </p>
      )}

      {sonuc && (
        <>
          {sonuc.durum !== 'tamam' && (
            <p className="mt-2.5 rounded-md bg-amber-zemin px-3 py-2 text-[11.5px] leading-relaxed font-semibold text-amber-koyu">
              {DURUM_METNI[sonuc.durum]}
              {sonuc.hata ? ` (${sonuc.hata})` : ''}
            </p>
          )}

          {/* -------------------------------------------------- başlık satırı */}
          {!!bulgular.length && (
            <div
              className={`mt-3 rounded-lg px-3.5 py-2.5 ${
                suphe ? 'bg-kirmizi-zemin' : 'bg-zemin'
              }`}
            >
              <p
                className={`text-[12.5px] leading-relaxed font-bold ${
                  suphe ? 'text-kirmizi-koyu' : 'text-metin'
                }`}
              >
                {suphe
                  ? `${suphe} künyede uydurma şüphesi var`
                  : 'Uydurma şüphesi taşıyan künye yok'}
              </p>
              {sonuc.karar?.ozet && (
                <p className="mt-1 text-[11.5px] leading-relaxed font-medium text-metin-2">
                  {sonuc.karar.ozet}
                </p>
              )}
            </div>
          )}

          {/* ------------------------------------------------------- bulgular */}
          <ul className="mt-2.5 flex flex-col gap-2">
            {bulgular.map((b, i) => (
              <Bulgu key={`${b.numara ?? 'x'}-${i}`} b={b} />
            ))}
          </ul>

          {!!sonuc.adimlar.length && <AjanIzi adimlar={sonuc.adimlar} />}
        </>
      )}
    </section>
  );
}

function Bulgu({ b }: { b: KaynakBulgusu }) {
  const [acik, setAcik] = useState(false);
  const agir = b.karar === 'uydurma_suphesi';

  return (
    <li
      className={`rounded-lg border px-3.5 py-2.5 ${
        agir ? 'border-kirmizi/45 bg-kirmizi-zemin/40' : 'border-cizgi bg-white'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wide ${KARAR_SINIF[b.karar]}`}
        >
          {KARAR_ETIKET[b.karar]}
        </span>
        {b.numara !== null && (
          <span className="font-mono text-[10.5px] font-bold text-metin-3">
            #{b.numara}
          </span>
        )}
        <span className="text-[9.5px] font-bold tracking-wide text-metin-3">
          {b.guven.toLocaleUpperCase('tr')} GÜVEN
        </span>
      </div>

      <p className="mt-1.5 text-[11.5px] leading-relaxed font-medium text-metin">
        {b.ham}
      </p>
      <p className="mt-1.5 text-[11.5px] leading-relaxed font-medium text-metin-2">
        {b.gerekce}
      </p>

      {/*
        KANIT KAPALI BAŞLIYOR.
        Gerekçe hakemin okuyacağı şey; kanıt katılmadığında bakacağı şey.
        İkisini birden açık göstermek, çoğu satırda okunmayacak bir teknik
        dökümü her bulgunun altına yapıştırmak olurdu.
      */}
      <button
        type="button"
        onClick={() => setAcik((a) => !a)}
        className="mt-1.5 cursor-pointer text-[10.5px] font-bold text-metin-3 hover:text-metin-2"
      >
        {acik ? '▾ kanıtı gizle' : '▸ kanıt'}
      </button>
      {acik && (
        <p className="mt-1 rounded-md bg-zemin px-2.5 py-1.5 font-mono text-[10.5px] leading-relaxed text-metin-2">
          {b.kanit}
        </p>
      )}
    </li>
  );
}
