'use client';

import { useState } from 'react';
import type { Mesaj } from '@/lib/depo/tipler';

/**
 * Rapor üzerindeki yazışma — hakem ile koordinasyon arasında.
 *
 * Değerlendirme metnine yazılamayacak şeyler için: "bu takımın geçen yıl
 * raporuyla karşılaştırılsın mı", "şablon sürümünü teyit eder misiniz",
 * "bu bulguyu ben açtım". Rapora değil SÜRECE ait notlar.
 *
 * ── ROL SEÇİCİ KALDIRILDI ───────────────────────────────────────────────
 * Önceki sürümde gönderen kendi adını yazıp kendi rolünü SEÇİYORDU. Bir
 * denetim izinde bunun değeri sıfır: herkes "hakem" olarak yazabiliyordu.
 * Artık rol kimlik doğrulamadan geliyor ve bu bileşen hangi taraftaysa
 * onu biliyor.
 *
 * ── AYNI BİLEŞEN İKİ PORTALDA ───────────────────────────────────────────
 * Hakem ve koordinasyon aynı yazışmayı görüyor; ikisi için ayrı bileşen
 * yazmak, birinde düzeltilen bir hatanın ötekinde kalması demekti.
 * Fark tek bir prop: `kod` verilmişse hakem tarafındayız.
 *
 * Bu yazışma YARIŞMACIYA GÖSTERİLMEZ.
 */

const ROL_ETIKET: Record<Mesaj['rol'], string> = {
  hakem: 'Hakem',
  koordinasyon: 'Koordinasyon',
  yarisma_yoneticisi: 'Yarışma Yöneticisi',
  sistem: 'Sistem',
};

const ROL_SINIF: Record<Mesaj['rol'], string> = {
  hakem: 'bg-mor-zemin text-mor',
  koordinasyon: 'bg-mavi-zemin text-mavi-koyu',
  yarisma_yoneticisi: 'bg-amber-zemin text-amber-koyu',
  sistem: 'bg-zemin text-metin-2',
};

function neZaman(iso: string): string {
  const fark = Date.now() - new Date(iso).getTime();
  const dk = Math.floor(fark / 60000);
  if (dk < 1) return 'az önce';
  if (dk < 60) return `${dk} dk önce`;
  const sa = Math.floor(dk / 60);
  if (sa < 24) return `${sa} saat önce`;
  return new Date(iso).toLocaleDateString('tr', { day: 'numeric', month: 'long' });
}

export default function Yazisma({
  raporId,
  baslangic,
  kod,
}: {
  raporId: string;
  baslangic: Mesaj[];
  /** Hakem erişim kodu. Verilirse hakem tarafındayız. */
  kod?: string;
}) {
  const hakemTarafi = !!kod;
  const [mesajlar, setMesajlar] = useState<Mesaj[]>(baslangic);
  const [metin, setMetin] = useState('');
  const [yazar, setYazar] = useState('');
  const [calisiyor, setCalisiyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  /*
   * Cevap bekliyor mu — sunucudaki kuralın aynısı: son insan mesajı
   * hakemden geldiyse koordinasyon cevaplamamış demektir. Burada yeniden
   * hesaplanıyor çünkü mesaj gönderildikten sonra sunucuya sormadan
   * güncellenmeli.
   */
  const insan = mesajlar.filter((m) => m.rol !== 'sistem' && !m.otomatikMi);
  const sonInsan = insan.length
    ? insan.reduce((a, b) => (a.tarih >= b.tarih ? a : b))
    : null;
  const cevapBekliyor = sonInsan?.rol === 'hakem';

  async function gonder() {
    setCalisiyor(true);
    setHata(null);
    try {
      const yanit = await fetch(`/api/rapor/${raporId}/mesaj`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metin, ...(kod ? { kod } : { yazar }) }),
      });
      const veri = await yanit.json();
      if (!yanit.ok) setHata(veri.hata ?? 'Mesaj gönderilemedi.');
      else {
        setMesajlar(veri.mesajlar ?? []);
        setMetin('');
      }
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Ağ hatası.');
    } finally {
      setCalisiyor(false);
    }
  }

  return (
    <section className="mb-4 overflow-hidden rounded-xl border border-cizgi bg-white">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-cizgi px-4 py-3">
        <h2 className="text-[13px] font-bold">
          {hakemTarafi ? 'Koordinasyona sor' : 'Hakem yazışması'}
        </h2>
        <span className="text-[11px] font-medium text-metin-2">
          {mesajlar.length
            ? `${mesajlar.length} mesaj`
            : hakemTarafi
              ? 'bu rapor hakkında soru sorabilirsiniz'
              : 'henüz mesaj yok'}
        </span>

        {/*
          Cevap bekleyen soru İKİ TARAFTA DA işaretleniyor: koordinasyon
          "bana soru var" görüyor, hakem "sorum iletildi" görüyor. Aynı
          bilgi, iki farklı okuma.
        */}
        {cevapBekliyor && (
          <span
            className={`ml-auto rounded px-2 py-0.5 text-[9.5px] font-bold tracking-wide ${
              hakemTarafi
                ? 'bg-mavi-zemin text-mavi-koyu'
                : 'bg-amber-zemin text-amber-koyu'
            }`}
          >
            {hakemTarafi ? 'CEVAP BEKLENİYOR' : 'HAKEM CEVAP BEKLİYOR'}
          </span>
        )}
      </div>

      {!!mesajlar.length && (
        <ul className="flex max-h-[340px] flex-col gap-2 overflow-y-auto px-4 py-3">
          {mesajlar.map((m) => (
            <li
              key={m.id}
              className={`rounded-lg px-3 py-2 ${
                m.rol === 'sistem' || m.otomatikMi
                  ? 'bg-zemin/60'
                  : 'border border-cizgi bg-white'
              }`}
            >
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wide ${ROL_SINIF[m.rol]}`}
                >
                  {ROL_ETIKET[m.rol].toLocaleUpperCase('tr')}
                </span>
                <span className="text-[11px] font-semibold">{m.yazar}</span>
                <span className="ml-auto text-[10px] font-medium text-metin-3">
                  {neZaman(m.tarih)}
                </span>
              </div>
              <p className="text-[11.5px] leading-relaxed whitespace-pre-wrap text-metin">
                {m.metin}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-cizgi px-4 py-3">
        <textarea
          value={metin}
          onChange={(e) => setMetin(e.target.value)}
          rows={2}
          placeholder={
            hakemTarafi
              ? 'Bu rapor hakkında koordinasyona sormak istediğiniz…'
              : 'Hakeme yanıtınız ya da notunuz…'
          }
          className="w-full rounded-lg border border-cizgi px-3 py-2 text-[12px] font-medium outline-none focus:border-metin-3"
        />

        <div className="mt-2 flex flex-wrap items-center gap-2.5">
          {/*
            Koordinasyon ORTAK hesap — kim yazdıysa adını girebilir.
            Hakemde bu alan yok: adı kaydından geliyor ve
            değiştirilemez, yoksa denetim izi anlamını yitirir.
          */}
          {!hakemTarafi && (
            <input
              value={yazar}
              onChange={(e) => setYazar(e.target.value)}
              placeholder="Adınız (isteğe bağlı)"
              className="w-[168px] rounded-lg border border-cizgi px-2.5 py-1.5 text-[11.5px] font-medium outline-none focus:border-metin-3"
            />
          )}

          <button
            type="button"
            disabled={calisiyor || metin.trim().length < 2}
            onClick={gonder}
            className="cursor-pointer rounded-lg bg-lacivert px-4 py-1.5 text-[12px] font-bold text-white transition-colors hover:bg-lacivert-2 disabled:opacity-50"
          >
            {calisiyor ? 'Gönderiliyor…' : hakemTarafi ? 'Koordinasyona gönder' : 'Yanıtla'}
          </button>

          <span className="text-[10.5px] font-medium text-metin-3">
            {hakemTarafi
              ? 'Bu rapora bağlı olarak iletilir; yarışmacı görmez.'
              : 'Yarışmacıya gösterilmez.'}
          </span>
        </div>

        {hata && (
          <p className="mt-2 rounded-md bg-kirmizi-zemin px-3 py-2 text-[11.5px] font-semibold text-kirmizi-koyu">
            {hata}
          </p>
        )}
      </div>
    </section>
  );
}
