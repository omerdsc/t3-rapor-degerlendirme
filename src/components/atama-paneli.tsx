'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { dagit } from '@/lib/db/dagitim';
import { kisaAd } from '@/lib/depo/ad';

/**
 * Rapor–hakem atama paneli.
 *
 * ── ÖNCEKİ SÜRÜMÜN SORUNU ───────────────────────────────────────────────
 * Hakem seçimi, rapor başına hakem sayısı, son tarih ve iki eylem düğmesi
 * tek satıra sıkışmıştı. İşliyordu ama kullanıcı basmadan önce NE OLACAĞINI
 * bilmiyordu: kaç atama yapılacak, hangi hakeme kaç rapor düşecek, dağıtım
 * dengeli mi.
 *
 * Şimdi ekranın ortasında bir ÖZET var: seçime göre kaç atama yapılacağını
 * ve her hakeme kaç rapor düşeceğini önden gösteriyor. "Dengeli dağıtım"
 * iddiası böylece görünür bir şey oluyor, koda gömülü bir söz değil.
 */

export interface AtamaSatiri {
  raporId: string;
  basvuruNo: string;
  takimRumuzu: string;
  proje: string;
  kategoriAdi: string;
  atananlar: Array<{ id: string; ad: string; tamamladi: boolean }>;
  kritikBulgu: boolean;
}

export interface HakemSecenegi {
  id: string;
  ad: string;
  kurum?: string;
  atanan: number;
  uzmanlik: string[];
}

type Kapsam = 'atanmamis' | 'secili';

export default function AtamaPaneli({
  yarismaId,
  kategoriId,
  satirlar,
  toplamRapor,
  toplamAtanmamis,
  hakemler,
}: {
  yarismaId: string;
  kategoriId?: string;
  /**
   * GÖRÜNÜR satırlar — kapsamın tamamı değil.
   *
   * Ölçüldü: 3000 raporun tamamını istemciye prop olarak göndermek atama
   * sayfasını 1,5 MB yapıyordu. "Atanmamış olanları dağıt" demek için
   * istemcinin 3000 kimlik bilmesi gerekmiyor; o kapsamı sunucu
   * hesaplıyor (`kapsam: 'atanmamis'`).
   */
  satirlar: AtamaSatiri[];
  /** Kapsamdaki toplam rapor — sayaçlar için. */
  toplamRapor: number;
  /** Kapsamdaki atanmamış rapor — önizleme ve düğme metni için. */
  toplamAtanmamis: number;
  hakemler: HakemSecenegi[];
}) {
  const yonlendir = useRouter();
  const [secili, setSecili] = useState<Set<string>>(new Set());
  const [seciliHakem, setSeciliHakem] = useState<Set<string>>(new Set());
  const [basinaHakem, setBasinaHakem] = useState(1);
  const [sonTarih, setSonTarih] = useState('');
  const [kapsam, setKapsam] = useState<Kapsam>('atanmamis');
  const [calisiyor, setCalisiyor] = useState(false);
  const [mesaj, setMesaj] = useState<{ metin: string; hata?: boolean } | null>(null);

  /*
   * GÖRÜNÜR SATIR SINIRI — ÖLÇÜLEREK EKLENDİ.
   *
   * `npm run hacim -- 3000` bu paneli ölçtü: sayfa 650 ms sürüyor ve
   * 4,9 MB iniyordu, çünkü 3000 satır birden çiziliyordu. Oysa panelin
   * asıl işi TOPLU atama: "atanmamış raporları dağıt" kapsamı bütün
   * raporlar üzerinde çalışıyor, kullanıcının hepsini GÖRMESİ gerekmiyor.
   *
   * Liste bu yüzden kırpılıyor ama KAPSAM kırpılmıyor — atama hâlâ
   * kapsamdaki bütün raporlara uygulanıyor ve önizleme gerçek sayıyı
   * gösteriyor. Kırpıldığı da yazılı: sessiz kırpma "hepsi bu kadar"
   * diye okunur.
   */
  const [gorunurSinir, setGorunurSinir] = useState(60);

  /** Görünür listedeki atanmamışlar — önizleme dağıtımı bunlarla kuruluyor. */
  const gorunurAtanmamis = useMemo(
    () => satirlar.filter((s) => !s.atananlar.length),
    [satirlar],
  );

  const hedefler = kapsam === 'atanmamis'
    ? gorunurAtanmamis
    : satirlar.filter((s) => secili.has(s.raporId));

  /*
   * Kapsamdaki GERÇEK hedef sayısı sunucudan geliyor. Önizleme dağıtımı
   * görünür satırlarla hesaplanıyor (dağıtım hesabı örnekle de doğru
   * çalışıyor) ama kullanıcıya gösterilen sayı gerçek olmalı — yoksa
   * "60 atama yapılacak" der, 3000 yapar.
   */
  const gercekHedefSayisi =
    kapsam === 'atanmamis' ? toplamAtanmamis : secili.size;

  /**
   * Dağıtım önizlemesi.
   *
   * Sunucunun kullandığı `dagit()` fonksiyonunun AYNISI çağrılıyor — ayrı
   * bir kopya yazılsa önizleme sunucudan sapardı ve kullanıcı basmadan
   * önce gördüğü sayı yanlış olurdu.
   */
  const onizleme = useMemo(() => {
    const secim = hakemler.filter((h) => seciliHakem.has(h.id));
    if (!secim.length || !hedefler.length) return null;

    const s = dagit(
      hedefler.map((h) => ({
        raporId: h.raporId,
        mevcut: h.atananlar.map((a) => a.id),
      })),
      secim.map((h) => ({ id: h.id, yuk: h.atanan })),
      basinaHakem,
    );

    /*
     * Görünür satırlar kapsamın tamamı olmayabilir. Dağıtım oranı doğru
     * ama SAYILAR gerçek kapsama ölçeklenmeli — kullanıcıya "60 atama"
     * deyip 3000 yapmak kabul edilemez.
     */
    const olcek =
      hedefler.length > 0 ? gercekHedefSayisi / hedefler.length : 1;
    const olcekli = (n: number) => Math.round(n * olcek);

    return {
      toplam: olcekli(s.ciftler.length),
      atlanan: olcekli(s.atlanan.length),
      kirpilmis: olcek > 1.001,
      etkilenen: new Set(s.ciftler.map((c) => c.raporId)),
      dagitim: secim.map((h) => ({
        hakem: h,
        yeni: olcekli(s.yeniYuk.get(h.id) ?? 0),
      })),
    };
  }, [seciliHakem, hedefler, basinaHakem, hakemler, gercekHedefSayisi]);

  function raporSec(id: string) {
    setSecili((o) => {
      const y = new Set(o);
      if (y.has(id)) y.delete(id);
      else y.add(id);
      return y;
    });
    setKapsam('secili');
  }

  function hakemSec(id: string) {
    setSeciliHakem((o) => {
      const y = new Set(o);
      if (y.has(id)) y.delete(id);
      else y.add(id);
      // Seçili hakem sayısı azalırsa rapor başına hakem de düşmeli.
      setBasinaHakem((b) => Math.min(b, Math.max(1, y.size)));
      return y;
    });
  }

  async function ata() {
    if (!seciliHakem.size || gercekHedefSayisi === 0) return;
    setCalisiyor(true);
    setMesaj(null);
    try {
      const y = await fetch('/api/atama', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          /*
           * "Atanmamış olanları dağıt" derken kimlik listesi
           * GÖNDERİLMİYOR: kapsamı sunucu hesaplıyor. 3000 kimliği
           * istekte taşımak hem ağı hem sayfayı şişiriyordu.
           */
          ...(kapsam === 'atanmamis'
            ? { kapsam: 'atanmamis' as const }
            : { raporIdler: hedefler.map((h) => h.raporId) }),
          hakemIdler: [...seciliHakem],
          yarismaId,
          kategoriId,
          atayan: 'koordinasyon',
          sonTarih: sonTarih || undefined,
          raporBasinaHakem: basinaHakem,
        }),
      });
      const d = await y.json();
      if (!y.ok) setMesaj({ metin: d.hata ?? 'Atama başarısız.', hata: true });
      else {
        setMesaj({
          metin:
            `${d.yapilan} atama yapıldı.` +
            (d.atlanan?.length ? ` ${d.atlanan.length} rapor atlandı.` : ''),
        });
        setSecili(new Set());
        setKapsam('atanmamis');
        yonlendir.refresh();
      }
    } catch (e) {
      setMesaj({ metin: e instanceof Error ? e.message : 'Ağ hatası.', hata: true });
    } finally {
      setCalisiyor(false);
    }
  }

  async function kaldir(raporId: string, hakemId: string) {
    setCalisiyor(true);
    setMesaj(null);
    try {
      const y = await fetch('/api/atama', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ raporId, hakemId }),
      });
      const d = await y.json();
      setMesaj({
        metin: d.kaldirildi ? 'Atama kaldırıldı.' : (d.neden ?? 'Kaldırılamadı.'),
        hata: !d.kaldirildi,
      });
      yonlendir.refresh();
    } finally {
      setCalisiyor(false);
    }
  }

  if (!hakemler.length) {
    return (
      <p className="rounded-xl bg-amber-zemin px-4 py-3 text-[12px] leading-relaxed font-semibold text-amber-koyu">
        Atama yapabilmek için önce hakem kaydı gerekiyor. Yukarıdaki
        &ldquo;+ Hakem ekle&rdquo; ile başlayın.
      </p>
    );
  }

  if (!satirlar.length) {
    return (
      <p className="rounded-xl border border-dashed border-metin-3/40 bg-white px-5 py-8 text-center text-[12.5px] font-medium text-metin-2">
        Bu seçimde rapor yok. Raporlar ekranından yükleyebilirsiniz.
      </p>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr] lg:items-start">
      {/* ---------------------------------------------- SOL: atama kurgusu */}
      <div className="rounded-xl border border-cizgi bg-white lg:sticky lg:top-4">
        <div className="border-b border-cizgi px-4 py-3">
          <h3 className="text-[13px] font-bold">Atama yap</h3>
          <p className="mt-0.5 text-[11px] font-medium text-metin-2">
            Hakem seç → kapsamı belirle → ata
          </p>
        </div>

        <div className="border-b border-cizgi px-4 py-3">
          <span className="mb-1.5 block text-[10px] font-bold tracking-wide text-metin-3">
            HAKEMLER · {seciliHakem.size} SEÇİLİ
          </span>
          <div className="flex flex-col gap-1">
            {hakemler.map((h) => {
              const s = seciliHakem.has(h.id);
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => hakemSec(h.id)}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                    s ? 'bg-lacivert text-white' : 'hover:bg-zemin'
                  }`}
                >
                  <span
                    className={`flex size-3.5 shrink-0 items-center justify-center rounded-[3px] border text-[9px] font-bold ${
                      s ? 'border-white bg-white text-lacivert' : 'border-cizgi'
                    }`}
                  >
                    {s ? '✓' : ''}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-bold">{h.ad}</span>
                    <span
                      className={`block truncate text-[10px] font-medium ${
                        s ? 'text-white/70' : 'text-metin-2'
                      }`}
                    >
                      {[h.kurum, ...h.uzmanlik].filter(Boolean).join(' · ') || 'bilgi yok'}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-[11px] font-bold ${
                      s ? 'text-white/80' : 'text-metin-3'
                    }`}
                    title="Şu anda atanmış rapor sayısı"
                  >
                    {h.atanan}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-b border-cizgi px-4 py-3">
          <span className="mb-1.5 block text-[10px] font-bold tracking-wide text-metin-3">
            KAPSAM
          </span>
          <div className="flex flex-col gap-1">
            {(
              [
                ['atanmamis', `Atanmamış raporlar (${toplamAtanmamis})`],
                ['secili', `Listeden seçtiklerim (${secili.size})`],
              ] as Array<[Kapsam, string]>
            ).map(([k, etiket]) => (
              <button
                key={k}
                type="button"
                onClick={() => setKapsam(k)}
                className={`cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-[12px] font-semibold transition-colors ${
                  kapsam === k ? 'bg-zemin text-metin' : 'text-metin-2 hover:bg-zemin/60'
                }`}
              >
                {kapsam === k ? '● ' : '○ '}
                {etiket}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-2.5 border-b border-cizgi px-4 py-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold tracking-wide text-metin-3">
              RAPOR BAŞINA
            </span>
            <select
              value={basinaHakem}
              onChange={(e) => setBasinaHakem(Number(e.target.value))}
              className="w-full dugme border border-cizgi px-2.5 py-1.5 text-[12px] font-semibold outline-none"
            >
              {[1, 2, 3].map((n) => (
                <option key={n} value={n} disabled={n > seciliHakem.size}>
                  {n} hakem
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold tracking-wide text-metin-3">
              SON TARİH
            </span>
            <input
              type="date"
              value={sonTarih}
              onChange={(e) => setSonTarih(e.target.value)}
              className="w-full rounded-lg border border-cizgi px-2.5 py-1.5 text-[12px] font-medium outline-none"
            />
          </label>
        </div>

        {/* ÖNİZLEME — basmadan önce ne olacağı */}
        <div className="px-4 py-3">
          {!onizleme ? (
            <p className="text-[11.5px] leading-relaxed font-medium text-metin-2">
              {!seciliHakem.size
                ? 'Hakem seçin.'
                : 'Kapsamda atanacak rapor yok.'}
            </p>
          ) : (
            <>
              <p className="mb-2 text-[12px] font-bold">
                {onizleme.toplam} atama yapılacak
                {onizleme.atlanan > 0 && (
                  <span className="ml-1 font-medium text-metin-2">
                    · {onizleme.atlanan} rapor atlanacak (zaten atanmış)
                  </span>
                )}
              </p>
              <div className="flex flex-col gap-1">
                {onizleme.dagitim.map((d) => (
                  <div
                    key={d.hakem.id}
                    className="flex items-center gap-2 text-[11.5px]"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {d.hakem.ad}
                    </span>
                    <span className="shrink-0 font-medium text-metin-2">
                      {d.hakem.atanan} → {d.hakem.atanan + d.yeni}
                    </span>
                    <span
                      className={`w-10 shrink-0 text-right font-bold ${
                        d.yeni ? 'text-yesil-koyu' : 'text-metin-3'
                      }`}
                    >
                      {d.yeni ? `+${d.yeni}` : '—'}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[10.5px] leading-relaxed font-medium text-metin-3">
                En az yüklü hakem önce iş alıyor — soldaki sayı mevcut,
                sağdaki atama sonrası yük.
                {onizleme.kirpilmis && (
                  <>
                    {' '}
                    Sayılar kapsamın tamamına ölçeklendi ({toplamAtanmamis}{' '}
                    rapor); listede yalnızca ilk {satirlar.length} tanesi
                    görünüyor.
                  </>
                )}
              </p>
            </>
          )}

          <button
            type="button"
            disabled={calisiyor || !onizleme || onizleme.toplam === 0}
            onClick={ata}
            className="mt-3 w-full dugme bg-kirmizi px-4 py-2.5 text-[12.5px] font-bold text-white transition-colors hover:bg-kirmizi-koyu disabled:opacity-50"
          >
            {calisiyor
              ? 'Atanıyor…'
              : onizleme
                ? `${onizleme.toplam} atamayı onayla`
                : 'Ata'}
          </button>
        </div>
      </div>

      {/* --------------------------------------------- SAĞ: rapor listesi */}
      <div>
        {mesaj && (
          <p
            className={`mb-3 rounded-lg px-3.5 py-2.5 text-[12px] font-semibold ${
              mesaj.hata
                ? 'bg-amber-zemin text-amber-koyu'
                : 'bg-yesil-zemin text-yesil-koyu'
            }`}
          >
            {mesaj.metin}
          </p>
        )}

        <div className="mb-2 flex flex-wrap items-center gap-2.5">
          <span className="text-[11.5px] font-medium text-metin-2">
            {toplamRapor - toplamAtanmamis}/{toplamRapor} rapor atanmış
          </span>
          <button
            type="button"
            onClick={() => {
              setSecili(
                secili.size === satirlar.length
                  ? new Set()
                  : new Set(satirlar.map((s) => s.raporId)),
              );
              setKapsam('secili');
            }}
            className="ml-auto cursor-pointer text-[11.5px] font-bold text-kirmizi"
          >
            {secili.size === satirlar.length
              ? 'Seçimi kaldır'
              : `Tümünü seç (${satirlar.length})`}
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-cizgi bg-white">
          {satirlar.slice(0, gorunurSinir).map((s) => {
            const isaretli = secili.has(s.raporId);
            const hedefte = hedefler.some((h) => h.raporId === s.raporId);
            return (
              <div
                key={s.raporId}
                className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-cizgi px-4 py-2.5 last:border-b-0 ${
                  hedefte ? 'bg-yesil-zemin/40' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={isaretli}
                  onChange={() => raporSec(s.raporId)}
                  className="size-3.5 cursor-pointer accent-kirmizi"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[12.5px] font-bold">{s.basvuruNo}</span>
                    <span className="text-[11px] font-medium text-metin-2">
                      {s.takimRumuzu}
                    </span>
                    {s.kritikBulgu && (
                      <span
                        className="rounded bg-kirmizi-zemin px-1.5 py-0.5 text-[9px] font-bold text-kirmizi-koyu"
                        title="Otomatik kontrollerde kritik bulgu var"
                      >
                        KRİTİK BULGU
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[11px] font-medium text-metin-2">
                    {s.proje}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  {s.atananlar.length ? (
                    s.atananlar.map((a) => (
                      <span
                        key={a.id}
                        title={a.tamamladi ? `${a.ad} — tamamladı` : `${a.ad} — bekliyor`}
                        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10.5px] font-bold ${
                          a.tamamladi
                            ? 'bg-yesil-zemin text-yesil-koyu'
                            : 'bg-amber-zemin text-amber-koyu'
                        }`}
                      >
                        {kisaAd(a.ad)}
                        {a.tamamladi && ' ✓'}
                        {!a.tamamladi && (
                          <button
                            type="button"
                            disabled={calisiyor}
                            onClick={() => kaldir(s.raporId, a.id)}
                            title="Atamayı kaldır"
                            className="cursor-pointer text-amber-koyu/70 hover:text-kirmizi"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))
                  ) : (
                    <span className="rounded bg-zemin px-2 py-0.5 text-[10.5px] font-bold text-metin-3">
                      ATANMADI
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {satirlar.length > gorunurSinir && (
          <div className="mt-2 flex flex-wrap items-center gap-3 rounded-lg bg-zemin px-3.5 py-2.5">
            <span className="text-[11.5px] font-medium text-metin-2">
              {gorunurSinir} / {satirlar.length} rapor gösteriliyor.{' '}
              <strong className="font-semibold text-metin">
                Atama kapsamı bundan etkilenmiyor
              </strong>{' '}
              — &ldquo;Atanmamış raporlar&rdquo; seçeneği hepsini kapsıyor.
            </span>
            <button
              type="button"
              onClick={() => setGorunurSinir((n) => n + 200)}
              className="ml-auto dugme border border-cizgi bg-white px-3 py-1.5 text-[11.5px] font-bold transition-colors hover:bg-zemin"
            >
              200 tane daha göster
            </button>
          </div>
        )}

        <p className="mt-2 text-[10.5px] leading-relaxed font-medium text-metin-3">
          Yeşil satırlar bu atamadan etkilenecek raporlar. Tamamlanmış
          değerlendirmenin ataması kaldırılamaz — yapılmış işi ortada
          bırakmamak için.
        </p>
      </div>
    </div>
  );
}
