'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { Rubrik } from '@/lib/analiz/sablon-cikar';
import type { Rapor } from '@/lib/depo/tipler';
import type { Guven } from '@/lib/ai/degerlendirme';

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

/**
 * Panelin gördüğü rapor — DARALTILMIŞ.
 *
 * Buraya `Rapor`'un tamamını geçmek bir GİZLİLİK HATASIYDI. Bu bir istemci
 * bileşeni; aldığı prop, RSC yüküyle tarayıcıya serileşiyor. Ekranda takım
 * adını maskelemek hiçbir şeye yaramıyordu — gerçek ad, takımId ve başvuru
 * numarası sayfa kaynağında düz metin olarak duruyordu.
 *
 * İkinci kazanç: `parmakizi` alanı rapor başına ~40 KB. Panel onu hiç
 * kullanmıyor ama tarayıcıya iniyordu.
 *
 * Kural: istemciye ne gösterilecekse o gönderilir, kaydın tamamı değil.
 */
export type PanelRaporu = Pick<
  Rapor,
  'id' | 'durum' | 'dosyaYolu' | 'hakemPuanlari' | 'hakemNotu' | 'aiDegerlendirme'
>;

export default function DegerlendirmePaneli({
  rapor,
  rubrik,
}: {
  rapor: PanelRaporu;
  rubrik: Rubrik;
}) {
  const yonlendir = useRouter();

  const [puanlar, setPuanlar] = useState<Record<string, string>>(() => {
    const b: Record<string, string> = {};
    for (const p of rapor.hakemPuanlari ?? []) b[p.kriterKodu] = String(p.puan);
    return b;
  });
  const [notlar, setNotlar] = useState<Record<string, string>>(() => {
    const b: Record<string, string> = {};
    for (const p of rapor.hakemPuanlari ?? []) if (p.not) b[p.kriterKodu] = p.not;
    return b;
  });

  const [genelNot, setGenelNot] = useState(rapor.hakemNotu ?? '');
  const [calisiyor, setCalisiyor] = useState<'ai' | 'kaydet' | 'tamamla' | null>(null);
  const [mesaj, setMesaj] = useState<{ tur: 'hata' | 'bilgi'; metin: string } | null>(null);

  const ai = rapor.aiDegerlendirme;
  const tamamlandi = rapor.durum === 'tamamlandi';

  const hakemToplam = useMemo(
    () => Object.values(puanlar).reduce((t, v) => t + (Number(v) || 0), 0),
    [puanlar],
  );
  const doldurulan = rubrik.kriterler.filter((k) => puanlar[k.kod] !== undefined && puanlar[k.kod] !== '').length;

  async function aiCalistir() {
    setCalisiyor('ai');
    setMesaj(null);
    try {
      const yanit = await fetch(`/api/rapor/${rapor.id}/degerlendir`, { method: 'POST' });
      const veri = await yanit.json();
      if (!yanit.ok) setMesaj({ tur: 'hata', metin: veri.hata ?? 'Değerlendirme başarısız.' });
      else {
        setMesaj({
          tur: 'bilgi',
          metin: `Değerlendirme tamamlandı · $${(veri.maliyet ?? 0).toFixed(4)}`,
        });
        yonlendir.refresh();
      }
    } catch (e) {
      setMesaj({ tur: 'hata', metin: e instanceof Error ? e.message : 'Ağ hatası.' });
    } finally {
      setCalisiyor(null);
    }
  }

  async function kaydet(tamamla: boolean) {
    setCalisiyor(tamamla ? 'tamamla' : 'kaydet');
    setMesaj(null);

    const gövde = {
      puanlar: rubrik.kriterler
        .filter((k) => puanlar[k.kod] !== undefined && puanlar[k.kod] !== '')
        .map((k) => ({
          kriterKodu: k.kod,
          puan: Number(puanlar[k.kod]) || 0,
          not: notlar[k.kod],
        })),
      not: genelNot,
      tamamla,
    };

    try {
      const yanit = await fetch(`/api/rapor/${rapor.id}/puan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gövde),
      });
      const veri = await yanit.json();
      if (!yanit.ok) setMesaj({ tur: 'hata', metin: veri.hata ?? 'Kaydedilemedi.' });
      else {
        setMesaj({ tur: 'bilgi', metin: tamamla ? 'Değerlendirme tamamlandı.' : 'Taslak kaydedildi.' });
        yonlendir.refresh();
      }
    } catch (e) {
      setMesaj({ tur: 'hata', metin: e instanceof Error ? e.message : 'Ağ hatası.' });
    } finally {
      setCalisiyor(null);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      {/* ---------------- sol: rapor görünümü */}
      <section className="flex flex-col overflow-hidden rounded-xl border border-cizgi bg-white">
        <div className="flex items-center justify-between border-b border-cizgi px-4 py-2.5">
          <span className="text-[12.5px] font-bold">Rapor</span>
          <a
            href={`/api/rapor/${rapor.id}/dosya`}
            target="_blank"
            rel="noreferrer"
            className="text-[11.5px] font-bold text-kirmizi hover:text-kirmizi-koyu"
          >
            Yeni sekmede aç →
          </a>
        </div>
        {rapor.dosyaYolu ? (
          <iframe
            src={`/api/rapor/${rapor.id}/dosya#view=FitH`}
            title="Rapor"
            className="h-[760px] w-full border-0 bg-zemin"
          />
        ) : (
          <p className="px-5 py-16 text-center text-[12.5px] font-medium text-metin-2">
            Bu rapor Word olarak yüklendiği için gömülü görüntüleme yok.
          </p>
        )}
      </section>

      {/* ---------------- sağ: 4. göz + hakem puanlaması */}
      <section className="flex flex-col overflow-hidden rounded-xl border border-cizgi bg-white">
        <div className="flex flex-wrap items-center gap-3 bg-lacivert px-5 py-3">
          <span className="flex size-[26px] shrink-0 items-center justify-center rounded-[7px] bg-kirmizi/20">
            <svg viewBox="0 0 24 24" className="size-[15px] stroke-[#F08A8F]" fill="none" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-white">4. Göz — Yapay Zekâ Ön Değerlendirmesi</p>
            <p className="mt-px text-[10.5px] font-medium text-metin-2">
              Bu bir öneridir. Nihai puanı ve kararı hakem verir.
            </p>
          </div>
          {ai && (
            <div className="text-right">
              <div className="text-[9.5px] font-bold tracking-wide text-metin-2">AI ÖNERİSİ</div>
              <div className="text-[17px] leading-tight font-extrabold text-white">
                {ai.aiToplam}
                <span className="text-[12px] font-semibold text-metin-2">/{ai.azamiToplam}</span>
              </div>
            </div>
          )}
        </div>

        {!ai && (
          <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
            <p className="max-w-md text-[12.5px] font-medium text-metin-2">
              Bu rapor için AI ön değerlendirmesi henüz çalıştırılmadı. Ücretli
              adım budur; bilinçli olarak otomatik değil. Aynı rapor ikinci kez
              istenirse önbellekten gelir, ek maliyet olmaz.
            </p>
            <button
              type="button"
              disabled={calisiyor !== null}
              onClick={aiCalistir}
              className="cursor-pointer rounded-lg bg-kirmizi px-5 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-kirmizi-koyu disabled:opacity-50"
            >
              {calisiyor === 'ai' ? 'Değerlendiriliyor… (~90 sn)' : '4. Göz analizini başlat'}
            </button>
          </div>
        )}

        {/* Şartname ihlali PUANDAN ÖNCE görünür. Bu bir kriter puanı değil:
            teknik kriterlerden tam puan alan bir rapor, şartnamenin katı bir
            kısıtıyla çelişen mimari önerdiği için yarışmaya uygun olmayabilir.
            Puan listesinin altına gömülürse hakem bunu kaçırır. */}
        {!!ai?.sartnameIhlalleri?.length && (
          <div className="border-b border-kirmizi/30 bg-kirmizi-zemin px-4 py-3">
            <p className="mb-2 text-[11.5px] font-bold text-kirmizi-koyu">
              Şartname uygunluk uyarısı — {ai.sartnameIhlalleri.length} katı
              kısıtla çelişki bulundu. Puanlamaya dahil DEĞİL; kararı hakem verir.
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

        {ai && (
          <div className="flex flex-col gap-2.5 p-4">
            {rubrik.kriterler.map((k) => {
              const d = ai.kriterler.find((x) => x.kod === k.kod);
              const hakemPuan = puanlar[k.kod] ?? '';
              const sapma =
                d && hakemPuan !== '' ? Number(hakemPuan) - d.aiPuan : null;

              return (
                <article
                  key={k.kod}
                  className={`rounded-[10px] border bg-white px-4 py-3.5 ${
                    d?.hakemIncelemesiGerekli ? 'border-[1.5px] border-amber' : 'border-cizgi'
                  }`}
                >
                  <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[13px] font-bold">{k.ad}</h3>
                        {d && (
                          <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wide ${GUVEN_SINIF[d.guven]}`}>
                            {GUVEN_ETIKET[d.guven]}
                          </span>
                        )}
                      </div>
                      {d && (
                        <p className="mt-1 text-[11.5px] leading-relaxed text-metin-2">{d.gerekce}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[9px] font-bold tracking-wide text-metin-3">AI</div>
                      <div className="text-[17px] leading-tight font-extrabold">
                        {d?.aiPuan ?? '—'}
                        <span className="text-[11px] text-metin-3">/{k.puan}</span>
                      </div>
                    </div>
                  </div>

                  {d?.hakemIncelemesiGerekli && (
                    <div className="mb-2.5 rounded-lg border border-amber/40 bg-amber-zemin px-3 py-2">
                      <p className="text-[11.5px] font-bold text-amber-koyu">Hakem incelemesi gerekli</p>
                      <p className="mt-px text-[11px] leading-relaxed text-amber-koyu/85">
                        Sistem bu kriterde kanıtı yeterli bulmadı; puan önerisine güvenmeyin.
                      </p>
                    </div>
                  )}

                  {d && d.kanitlar.length > 0 && (
                    <div className="mb-2.5 flex flex-col gap-1">
                      {d.kanitlar.slice(0, 2).map((kn, i) => (
                        <p
                          key={i}
                          className="rounded-md bg-zemin/70 px-2.5 py-1.5 text-[11px] leading-relaxed text-metin-2"
                        >
                          {kn.sayfa && (
                            <span className="mr-1.5 rounded bg-white px-1.5 py-px text-[9.5px] font-bold ring-1 ring-cizgi">
                              s.{kn.sayfa}
                            </span>
                          )}
                          <span className="italic">{kn.alinti}</span>
                        </p>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2.5 border-t border-cizgi/70 pt-2.5">
                    <label className="text-[11.5px] font-bold" htmlFor={`p-${k.kod}`}>
                      Hakem puanı
                    </label>
                    <input
                      id={`p-${k.kod}`}
                      type="number"
                      min={0}
                      max={k.puan}
                      step={1}
                      disabled={tamamlandi}
                      value={hakemPuan}
                      onChange={(e) => setPuanlar((ö) => ({ ...ö, [k.kod]: e.target.value }))}
                      className="w-[62px] rounded-lg border-[1.5px] border-kirmizi px-2 py-1.5 text-center text-[14px] font-extrabold disabled:border-cizgi disabled:bg-zemin"
                    />
                    <span className="text-[11.5px] font-semibold text-metin-3">/ {k.puan}</span>

                    {sapma !== null && sapma !== 0 && (
                      <span className="rounded bg-amber-zemin px-2 py-0.5 text-[10px] font-bold text-amber-koyu">
                        AI&apos;DAN {sapma > 0 ? '+' : ''}
                        {sapma} SAPMA
                      </span>
                    )}

                    <input
                      type="text"
                      placeholder="Not ekle (yarışmacıya gösterilir)"
                      disabled={tamamlandi}
                      value={notlar[k.kod] ?? ''}
                      onChange={(e) => setNotlar((ö) => ({ ...ö, [k.kod]: e.target.value }))}
                      className="min-w-[160px] flex-1 rounded-lg border border-cizgi px-2.5 py-1.5 text-[11.5px] disabled:bg-zemin"
                    />
                  </div>
                </article>
              );
            })}

            <textarea
              placeholder="Genel değerlendirme notu (isteğe bağlı)"
              disabled={tamamlandi}
              value={genelNot}
              onChange={(e) => setGenelNot(e.target.value)}
              rows={2}
              className="rounded-[10px] border border-cizgi px-3.5 py-2.5 text-[12px] disabled:bg-zemin"
            />
          </div>
        )}

        {/* alt karar çubuğu */}
        <div className="mt-auto flex flex-wrap items-center gap-4 border-t border-cizgi bg-zemin/50 px-5 py-3.5">
          <div>
            <div className="text-[9.5px] font-bold tracking-wide text-metin-3">HAKEM TOPLAMI</div>
            <div className="text-[20px] leading-tight font-extrabold">
              {hakemToplam}
              <span className="text-[12px] font-semibold text-metin-3">/{rubrik.toplamPuan}</span>
            </div>
          </div>

          {doldurulan < rubrik.kriterler.length && (
            <span className="rounded-md bg-amber-zemin px-2.5 py-1 text-[11px] font-bold text-amber-koyu">
              {rubrik.kriterler.length - doldurulan} kriter puanlanmadı
            </span>
          )}
          {tamamlandi && (
            <span className="rounded-md bg-yesil-zemin px-2.5 py-1 text-[11px] font-bold text-yesil-koyu">
              Tamamlandı · yarışmacı sonucu görebilir
            </span>
          )}

          <div className="ml-auto flex gap-2.5">
            <button
              type="button"
              disabled={calisiyor !== null || tamamlandi}
              onClick={() => kaydet(false)}
              className="cursor-pointer rounded-lg border border-cizgi bg-white px-4 py-2.5 text-[12.5px] font-bold disabled:opacity-50"
            >
              {calisiyor === 'kaydet' ? 'Kaydediliyor…' : 'Taslak kaydet'}
            </button>
            <button
              type="button"
              disabled={calisiyor !== null || tamamlandi || doldurulan < rubrik.kriterler.length}
              onClick={() => kaydet(true)}
              className="cursor-pointer rounded-lg bg-kirmizi px-5 py-2.5 text-[12.5px] font-bold text-white transition-colors hover:bg-kirmizi-koyu disabled:opacity-50"
            >
              {calisiyor === 'tamamla' ? 'Tamamlanıyor…' : 'Nihai değerlendirmeyi tamamla'}
            </button>
          </div>
        </div>

        {mesaj && (
          <p
            className={`px-5 py-2.5 text-[12px] font-semibold ${
              mesaj.tur === 'hata' ? 'bg-kirmizi-zemin text-kirmizi-koyu' : 'bg-yesil-zemin text-yesil-koyu'
            }`}
          >
            {mesaj.metin}
          </p>
        )}
      </section>
    </div>
  );
}
