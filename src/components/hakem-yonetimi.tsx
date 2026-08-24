'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { HakemYuku } from '@/lib/db/hakem-depo';

/**
 * Hakem kaydı ve iş yükü tablosu.
 *
 * ERİŞİM KODU EKRANDA GÖSTERİLİYOR
 * Hakem panele kodla giriyor; koordinasyon bu kodu hakeme iletmek zorunda.
 * Gizlemek işe yaramaz — koordinasyon zaten iletmek için görmek zorunda.
 * Kopyalanabilir olması gerekiyor, o yüzden tek tıkla kopyalanıyor.
 *
 * İŞ YÜKÜ NEDEN AYNI TABLODA
 * "Yeni hakem ekle" ile "kim ne kadar yüklü" ayrı ekranlarda olsa
 * koordinasyon atama yaparken yükü görmeden karar verirdi. Aynı tabloda
 * olması dengeli dağıtımı doğal kılıyor.
 */
export default function HakemYonetimi({ yukler }: { yukler: HakemYuku[] }) {
  const yonlendir = useRouter();
  const [acik, setAcik] = useState(false);
  const [calisiyor, setCalisiyor] = useState(false);
  const [mesaj, setMesaj] = useState<{ metin: string; hata?: boolean } | null>(null);
  const [kopyalanan, setKopyalanan] = useState<string | null>(null);

  const [ad, setAd] = useState('');
  const [eposta, setEposta] = useState('');
  const [kurum, setKurum] = useState('');
  const [uzmanlik, setUzmanlik] = useState('');

  async function ekle() {
    setCalisiyor(true);
    setMesaj(null);
    try {
      const y = await fetch('/api/hakem', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ad,
          eposta,
          kurum,
          uzmanlik: uzmanlik.split(',').map((u) => u.trim()).filter(Boolean),
        }),
      });
      const d = await y.json();
      if (!y.ok) setMesaj({ metin: d.hata ?? 'Eklenemedi.', hata: true });
      else {
        setMesaj({ metin: `${d.hakem.ad} eklendi · erişim kodu ${d.hakem.kod}` });
        setAd(''); setEposta(''); setKurum(''); setUzmanlik('');
        setAcik(false);
        yonlendir.refresh();
      }
    } catch (e) {
      setMesaj({ metin: e instanceof Error ? e.message : 'Ağ hatası.', hata: true });
    } finally {
      setCalisiyor(false);
    }
  }

  async function aktiflikDegistir(id: string, aktif: boolean) {
    setCalisiyor(true);
    try {
      await fetch('/api/hakem', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, aktif }),
      });
      yonlendir.refresh();
    } finally {
      setCalisiyor(false);
    }
  }

  async function sil(id: string, ad: string) {
    setCalisiyor(true);
    setMesaj(null);
    try {
      const y = await fetch('/api/hakem', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const d = await y.json();
      setMesaj({
        metin: d.silindi ? `${ad} silindi.` : (d.neden ?? 'Silinemedi.'),
        hata: !d.silindi,
      });
      yonlendir.refresh();
    } finally {
      setCalisiyor(false);
    }
  }

  async function kopyala(kod: string) {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/hakem/${kod}`,
      );
      setKopyalanan(kod);
      setTimeout(() => setKopyalanan(null), 2000);
    } catch {
      // Pano erişimi reddedilebilir; kod ekranda görünür durumda kalıyor.
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <h2 className="text-[15px] font-bold">Hakemler</h2>
        <span className="text-[11.5px] font-medium text-metin-2">
          {yukler.filter((y) => y.hakem.aktif).length} aktif · {yukler.length} kayıtlı
        </span>
        <button
          type="button"
          onClick={() => setAcik((a) => !a)}
          className="ml-auto cursor-pointer rounded-lg bg-kirmizi px-3.5 py-2 text-[12px] font-bold text-white transition-colors hover:bg-kirmizi-koyu"
        >
          {acik ? 'Vazgeç' : '+ Hakem ekle'}
        </button>
      </div>

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

      {acik && (
        <div className="mb-3 grid gap-2.5 rounded-xl border border-cizgi bg-white px-4 py-3.5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold tracking-wide text-metin-3">
              AD SOYAD *
            </span>
            <input
              value={ad}
              onChange={(e) => setAd(e.target.value)}
              placeholder="Prof. Dr. Ayşe Demir"
              className="w-full rounded-lg border border-cizgi px-3 py-2 text-[12.5px] font-medium outline-none focus:border-metin-3"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold tracking-wide text-metin-3">
              KURUM
            </span>
            <input
              value={kurum}
              onChange={(e) => setKurum(e.target.value)}
              placeholder="İTÜ Uçak ve Uzay Bilimleri"
              className="w-full rounded-lg border border-cizgi px-3 py-2 text-[12.5px] font-medium outline-none focus:border-metin-3"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold tracking-wide text-metin-3">
              E-POSTA
            </span>
            <input
              value={eposta}
              onChange={(e) => setEposta(e.target.value)}
              placeholder="hakem@kurum.edu.tr"
              className="w-full rounded-lg border border-cizgi px-3 py-2 text-[12.5px] font-medium outline-none focus:border-metin-3"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold tracking-wide text-metin-3">
              UZMANLIK (virgülle)
            </span>
            <input
              value={uzmanlik}
              onChange={(e) => setUzmanlik(e.target.value)}
              placeholder="Havacılık, Görüntü işleme"
              className="w-full rounded-lg border border-cizgi px-3 py-2 text-[12.5px] font-medium outline-none focus:border-metin-3"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="button"
              disabled={calisiyor || ad.trim().length < 3}
              onClick={ekle}
              className="cursor-pointer rounded-lg bg-lacivert px-4 py-2 text-[12px] font-bold text-white transition-colors hover:bg-lacivert-2 disabled:opacity-50"
            >
              {calisiyor ? 'Ekleniyor…' : 'Hakemi kaydet'}
            </button>
            <span className="ml-2.5 text-[11px] font-medium text-metin-3">
              Erişim kodu otomatik üretilir
            </span>
          </div>
        </div>
      )}

      {!yukler.length ? (
        <p className="rounded-xl border border-dashed border-metin-3/40 bg-white px-5 py-8 text-center text-[12.5px] font-medium text-metin-2">
          Henüz hakem kaydı yok. Rapor atayabilmek için önce hakem eklemelisiniz.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-cizgi bg-white">
          {yukler.map((y) => {
            const h = y.hakem;
            const bekleyen = y.atanan - y.tamamlanan;
            return (
              <div
                key={h.id}
                className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-cizgi px-4 py-3 last:border-b-0 ${
                  h.aktif ? '' : 'bg-zemin/50'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`truncate text-[13px] font-bold ${
                        h.aktif ? '' : 'text-metin-2'
                      }`}
                    >
                      {h.ad}
                    </span>
                    {!h.aktif && (
                      <span className="rounded bg-zemin px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-metin-2">
                        PASİF
                      </span>
                    )}
                    {h.uzmanlik.map((u) => (
                      <span
                        key={u}
                        className="rounded bg-mavi-zemin px-1.5 py-0.5 text-[9px] font-bold text-mavi-koyu"
                      >
                        {u}
                      </span>
                    ))}
                  </div>
                  <p className="mt-0.5 text-[11px] font-medium text-metin-2">
                    {[h.kurum, h.eposta].filter(Boolean).join(' · ') || 'bilgi girilmedi'}
                  </p>
                </div>

                <div className="w-[132px] shrink-0 text-[11px] font-medium">
                  <span className="font-bold">{y.atanan}</span> atanan
                  {bekleyen > 0 && (
                    <span className="text-amber-koyu"> · {bekleyen} bekliyor</span>
                  )}
                  {y.tamamlanan > 0 && (
                    <span className="text-yesil-koyu"> · {y.tamamlanan} bitti</span>
                  )}
                </div>

                {/* Erişim bağlantısı: koordinasyon bunu hakeme iletiyor. */}
                <button
                  type="button"
                  onClick={() => kopyala(h.kod)}
                  title="Hakemin panel bağlantısını kopyala"
                  className="shrink-0 cursor-pointer rounded-md bg-zemin px-2 py-1 font-mono text-[11px] font-bold tracking-wide transition-colors hover:bg-cizgi"
                >
                  {kopyalanan === h.kod ? 'kopyalandı ✓' : h.kod}
                </button>

                <button
                  type="button"
                  disabled={calisiyor}
                  onClick={() => aktiflikDegistir(h.id, !h.aktif)}
                  className="shrink-0 cursor-pointer text-[11px] font-bold text-metin-2 hover:text-metin disabled:opacity-50"
                >
                  {h.aktif ? 'Pasife al' : 'Aktifleştir'}
                </button>

                {y.atanan === 0 && (
                  <button
                    type="button"
                    disabled={calisiyor}
                    onClick={() => sil(h.id, h.ad)}
                    className="shrink-0 cursor-pointer text-[11px] font-bold text-metin-3 hover:text-kirmizi disabled:opacity-50"
                  >
                    Sil
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-2.5 text-[11px] leading-relaxed font-medium text-metin-3">
        Hakem, koda ait bağlantıdan kendi paneline giriyor ve{' '}
        <strong className="font-semibold">yalnızca kendisine atanmış</strong>{' '}
        raporları görüyor. Takım adları rumuzlu — puanlama kör.
        Değerlendirmesi olan hakem silinmiyor, pasife alınıyor: tamamlanmış
        bir değerlendirmenin sahibi kayıtta kalmalı.
      </p>
    </div>
  );
}
