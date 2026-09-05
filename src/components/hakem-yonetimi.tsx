'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { HakemYuku } from '@/lib/db/hakem-depo';

/**
 * Hakem kaydı ve iş yükü tablosu.
 *
 * ERİŞİM KODU EKRANDA GÖSTERİLİYOR
 * Hakem panele kodla giriyor; koordinasyon bu kodu hakeme iletmek zorunda.
 * Gizlemek işe yaramaz — koordinasyon zaten iletmek için görmek zorunda.
 * Kopyalanabilir olması gerekiyor, o yüzden tek tıkla kopyalanıyor — ve
 * çipte YAZAN şey kopyalanıyor. Eskiden kod gösterip tam bağlantı
 * kopyalıyordu; kullanıcı gördüğünden başka bir şey yapıştırıyordu.
 *
 * İŞ YÜKÜ NEDEN AYNI TABLODA
 * "Yeni hakem ekle" ile "kim ne kadar yüklü" ayrı ekranlarda olsa
 * koordinasyon atama yaparken yükü görmeden karar verirdi. Aynı tabloda
 * olması dengeli dağıtımı doğal kılıyor.
 *
 * ── ARAMA VE SAYFALAMA: ÖLÇEK ───────────────────────────────────────────
 * Liste `yukler.map()` ile ne varsa çiziyordu. Bir yarışmada 100 hakem
 * olağan; hepsi alt alta dizildiğinde ekran 100 satırlık bir duvar oluyor
 * ve aranan kişi ancak kaydırılarak bulunuyor. Aynı hata rapor listesinde
 * ölçülmüştü: 1000 satır, 24 saniye, 8,7 MB HTML.
 *
 * Arama TÜRKÇE DUYARSIZ: "sahin" yazan "Şahin"i bulmalı. `toLowerCase()`
 * Türkçe yerel ayarda `I` harfini `ı` yapıyor, o yüzden `en` yerel ayarı
 * ve elle harf eşlemesi kullanılıyor.
 */

/** Sayfa başına hakem. Bir ekranda rahat kaydırılan aralık. */
const SAYFA_BOYU = 25;

/** Türkçe duyarsız arama biçimi. */
function ara(m: string): string {
  const harf: Record<string, string> = {
    ç: 'c', ğ: 'g', ı: 'i', İ: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u',
  };
  return [...m.toLocaleLowerCase('en')]
    .map((h) => harf[h] ?? harf[h.toLocaleLowerCase('tr')] ?? h)
    .join('');
}

type Suzgec = 'tumu' | 'aktif' | 'pasif' | 'bekleyen';
export default function HakemYonetimi({ yukler }: { yukler: HakemYuku[] }) {
  const yonlendir = useRouter();
  const [acik, setAcik] = useState(false);
  const [calisiyor, setCalisiyor] = useState(false);
  const [mesaj, setMesaj] = useState<{ metin: string; hata?: boolean } | null>(null);
  /* Hangi hakemin NEYİ kopyalandı — geri bildirim doğru olsun diye. */
  const [kopyalanan, setKopyalanan] = useState<
    { kod: string; tur: 'kod' | 'baglanti' } | null
  >(null);

  const [ad, setAd] = useState('');
  const [eposta, setEposta] = useState('');
  const [kurum, setKurum] = useState('');
  const [uzmanlik, setUzmanlik] = useState('');

  const [sorgu, setSorgu] = useState('');
  const [suzgec, setSuzgec] = useState<Suzgec>('tumu');
  const [sayfa, setSayfa] = useState(1);

  /*
   * Süzme ve arama TEK yerde. Arama kutusuna her harfte bütün listeyi
   * yeniden süzmek 500 hakemde hissedilir; `useMemo` girdiler
   * değişmedikçe tekrar hesaplamıyor.
   */
  const suzulmus = useMemo(() => {
    const q = ara(sorgu.trim());
    return yukler.filter((y) => {
      const bekleyen = y.atanan - y.tamamlanan;
      if (suzgec === 'aktif' && !y.hakem.aktif) return false;
      if (suzgec === 'pasif' && y.hakem.aktif) return false;
      if (suzgec === 'bekleyen' && bekleyen <= 0) return false;
      if (!q) return true;
      // Ad, kurum, kod ve uzmanlık: koordinasyonun elinde hangisi varsa.
      const alanlar = [
        y.hakem.ad, y.hakem.kurum ?? '', y.hakem.kod,
        (y.hakem.uzmanlik ?? []).join(' '),
      ].join(' ');
      return ara(alanlar).includes(q);
    });
  }, [yukler, sorgu, suzgec]);

  const sayfaSayisi = Math.max(1, Math.ceil(suzulmus.length / SAYFA_BOYU));
  // Süzgeç daraldığında mevcut sayfa listenin dışında kalabilir.
  const gecerliSayfa = Math.min(sayfa, sayfaSayisi);
  const gorunen = suzulmus.slice(
    (gecerliSayfa - 1) * SAYFA_BOYU,
    gecerliSayfa * SAYFA_BOYU,
  );

  const sayilar: Record<Suzgec, number> = {
    tumu: yukler.length,
    aktif: yukler.filter((y) => y.hakem.aktif).length,
    pasif: yukler.filter((y) => !y.hakem.aktif).length,
    bekleyen: yukler.filter((y) => y.atanan - y.tamamlanan > 0).length,
  };
  const SUZGEC_ETIKET: Record<Suzgec, string> = {
    tumu: 'Tümü', aktif: 'Aktif', pasif: 'Pasif', bekleyen: 'İşi bekleyen',
  };

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

  /**
   * Panoya kopyalar.
   *
   * ── GÖRÜNEN NE İSE KOPYALANAN O ─────────────────────────────────────
   * Kod çipi eskiden kodu GÖSTERİP tam bağlantıyı kopyalıyordu
   * (`http://…/hakem/7KSN-NTBD`). Kullanıcı `7KSN-NTBD` görüp yapıştırınca
   * bambaşka bir şey çıkıyordu. Düğmenin üstünde ne yazıyorsa panoya o
   * gitmeli.
   *
   * Bağlantı da lazım — hakeme tıklanabilir bir adres göndermek en kolayı —
   * ama o ayrı bir düğme. İki ihtiyaç, iki düğme.
   */
  async function kopyala(kod: string, tur: 'kod' | 'baglanti') {
    const metin =
      tur === 'kod' ? kod : `${window.location.origin}/hakem/${kod}`;
    try {
      await navigator.clipboard.writeText(metin);
      setKopyalanan({ kod, tur });
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
          className="ml-auto dugme bg-kirmizi px-3.5 py-2 text-[12px] font-bold text-white transition-colors hover:bg-kirmizi-koyu"
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
              className="dugme bg-lacivert px-4 py-2 text-[12px] font-bold text-white transition-colors hover:bg-lacivert-2 disabled:opacity-50"
            >
              {calisiyor ? 'Ekleniyor…' : 'Hakemi kaydet'}
            </button>
            <span className="ml-2.5 text-[11px] font-medium text-metin-3">
              Erişim kodu otomatik üretilir
            </span>
          </div>
        </div>
      )}

      {/*
        ARAÇ ÇUBUĞU YALNIZCA LİSTE UZUNKEN.
        Beş hakemli bir kurulumda arama kutusu ve sayfalama gereksiz bir
        katman; aranacak bir şey yok. Eşik sayfa boyutunun yarısı: liste
        tek ekranı doldurmaya başladığında araçlar beliriyor.
      */}
      {yukler.length > SAYFA_BOYU / 2 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <svg
              viewBox="0 0 24 24" aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 stroke-metin-3"
              fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              value={sorgu}
              onChange={(e) => { setSorgu(e.target.value); setSayfa(1); }}
              placeholder="Ad, kurum, erişim kodu veya uzmanlık ara…"
              className="w-full rounded-lg border border-cizgi bg-white py-2 pr-3 pl-9 text-[12.5px] font-semibold outline-none transition-colors focus:border-metin-3"
            />
          </div>

          <div className="flex flex-wrap gap-1">
            {(['tumu', 'aktif', 'pasif', 'bekleyen'] as Suzgec[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => { setSuzgec(d); setSayfa(1); }}
                className={`dugme px-3 py-2 text-[11.5px] ${
                  suzgec === d
                    ? 'bg-lacivert text-white'
                    : 'border border-cizgi bg-white text-metin-2 hover:bg-zemin'
                }`}
              >
                {SUZGEC_ETIKET[d]}
                <span className={`ml-1.5 tabular-nums ${suzgec === d ? 'text-white/60' : 'text-metin-3'}`}>
                  {sayilar[d]}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!yukler.length ? (
        <p className="rounded-xl border border-dashed border-metin-3/40 bg-white px-5 py-8 text-center text-[12.5px] font-medium text-metin-2">
          Henüz hakem kaydı yok. Rapor atayabilmek için önce hakem eklemelisiniz.
        </p>
      ) : !suzulmus.length ? (
        <p className="rounded-xl border border-dashed border-metin-3/40 bg-white px-5 py-8 text-center text-[12.5px] font-medium text-metin-2">
          {sorgu
            ? `“${sorgu}” ile eşleşen hakem bulunamadı.`
            : `“${SUZGEC_ETIKET[suzgec]}” grubunda hakem yok.`}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-cizgi bg-white">
          {gorunen.map((y) => {
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
                    {h.sistem ? (
                      <span
                        title="Bir kişiyi temsil etmiyor: eski puanların taşındığı arşiv kaydı. Panele giremez, rapor atanamaz."
                        className="rounded bg-mor-zemin px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-mor-koyu"
                      >
                        SİSTEM KAYDI
                      </span>
                    ) : !h.aktif ? (
                      <span className="rounded bg-zemin px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-metin-2">
                        PASİF
                      </span>
                    ) : null}
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

                {/*
                  İKİ AYRI EYLEM, ÇÜNKÜ İKİ AYRI İHTİYAÇ.
                  "Kopyala" hakeme iletmek için (e-posta, mesaj). "Aç" ise
                  koordinasyonun hakemin ne gördüğünü kontrol etmesi için —
                  önceki sürümde yalnızca kopyalama vardı ve panele girmenin
                  görünür bir yolu yoktu.
                */}
                {/*
                  SİSTEM KAYDINDA EYLEM YOK.
                  Arşiv kaydına "Aç ↗" sunmak kırık bir bağlantı vermek
                  ("giremez" kuralı sunucuda), "Aktifleştir" sunmak ise
                  olmayan bir kişiyi işe almak olurdu. Görünmeye devam
                  ediyor çünkü eski puanların sahibi — ama eylemsiz.
                */}
                {h.sistem ? (
                  <span className="shrink-0 text-[10.5px] font-medium text-metin-3">
                    eski puanların sahibi · giriş yok
                  </span>
                ) : (
                <>
                <div className="flex shrink-0 items-center gap-1">
                  {/* Çipte ne yazıyorsa panoya o gidiyor: sadece kod. */}
                  <button
                    type="button"
                    onClick={() => kopyala(h.kod, 'kod')}
                    title="Erişim kodunu kopyala"
                    className="cursor-pointer rounded-md bg-zemin px-2 py-1 font-mono text-[11px] font-bold tracking-wide transition-colors hover:bg-cizgi"
                  >
                    {kopyalanan?.kod === h.kod && kopyalanan.tur === 'kod'
                      ? 'kod kopyalandı ✓'
                      : h.kod}
                  </button>
                  {/* Tıklanabilir adres isteyenler için ayrı düğme. */}
                  <button
                    type="button"
                    onClick={() => kopyala(h.kod, 'baglanti')}
                    title="Hakemin panel bağlantısını kopyala — e-postayla göndermek için"
                    className="dugme border border-cizgi px-2 py-1 text-[10.5px] font-bold text-metin-2 transition-colors hover:bg-zemin"
                  >
                    {kopyalanan?.kod === h.kod && kopyalanan.tur === 'baglanti'
                      ? 'bağlantı ✓'
                      : 'Bağlantı'}
                  </button>
                  <a
                    href={`/hakem/${h.kod}`}
                    target="_blank"
                    rel="noreferrer"
                    title="Hakemin panelini yeni sekmede aç — ne gördüğünü kontrol edin"
                    className="rounded-md border border-cizgi px-2 py-1 text-[10.5px] font-bold text-metin-2 transition-colors hover:bg-zemin"
                  >
                    Aç ↗
                  </a>
                </div>

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
                </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/*
        SAYFALAMA — LİSTE SIĞMADIĞINDA.
        Rapor listesinde ölçülen ders: 1000 satırı birden çizmek sayfayı
        24 saniyeye çıkarıyor. Hakem sayısı o ölçeğe çıkmasa da 100 satır
        aranan kişiyi kaydırma mesafesine gömüyor.
      */}
      {sayfaSayisi > 1 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[11.5px] font-medium text-metin-2">
            {suzulmus.length} hakem · sayfa {gecerliSayfa}/{sayfaSayisi}
          </span>
          <div className="ml-auto flex gap-1.5">
            <button
              type="button"
              onClick={() => setSayfa(gecerliSayfa - 1)}
              disabled={gecerliSayfa <= 1}
              className="dugme border border-cizgi bg-white px-3 py-1.5 text-[11.5px] text-metin-2 hover:bg-zemin"
            >
              ← Önceki
            </button>
            <button
              type="button"
              onClick={() => setSayfa(gecerliSayfa + 1)}
              disabled={gecerliSayfa >= sayfaSayisi}
              className="dugme border border-cizgi bg-white px-3 py-1.5 text-[11.5px] text-metin-2 hover:bg-zemin"
            >
              Sonraki →
            </button>
          </div>
        </div>
      )}

      {/*
        DÜĞME AÇIKLAMASI KALDIRILDI.
        "Kod yalnızca erişim kodunu kopyalar; Bağlantı hakeme gönderilecek
        tam adresi…" diye bir paragraf duruyordu. Düğmenin ne yaptığını
        altında anlatmak gerekiyorsa düğmenin adı yanlıştır — ve burada
        değil: "Kod" kodu, "Bağlantı" bağlantıyı kopyalıyor. Metin bir kez
        okunup bir daha hiç okunmayan, her açılışta yer kaplayan bir
        dipnottu.
      */}
    </div>
  );
}
