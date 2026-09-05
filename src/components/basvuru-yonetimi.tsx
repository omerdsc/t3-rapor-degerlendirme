'use client';

import Link from 'next/link';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { BasvuruDurumu } from '@/lib/db/basvuru-depo';

interface Kategori {
  id: string;
  ad: string;
  asama?: string;
}

/**
 * Başvuru kayıtları — koordinasyon ekranı.
 *
 * ── BU EKRANIN VARLIK SEBEBİ ────────────────────────────────────────────
 * Koordinasyonun raporlarla teması eskiden N dosya yüklemekti. Artık bir
 * kez liste aktarmak. Bu ekran o değişimin bulunduğu yer: liste
 * yapıştırılıyor, kodlar üretiliyor, kimin yüklediği izleniyor.
 *
 * ── KODLARIN DIŞA AKTARIMI TARAYICIDA ───────────────────────────────────
 * Kod listesi yarışmacılara e-postayla gidiyor ve bu iş TPRDS'in dışında.
 * CSV üretmek için sunucuya gitmek gereksiz: veri zaten ekranda. Bir
 * sunucu ucu daha açmak, korunacak bir yüzey daha demekti.
 */
export default function BasvuruYonetimi({
  yarismaId,
  yarismaAdi,
  kategoriler,
  basvurular,
}: {
  yarismaId: string;
  yarismaAdi: string;
  kategoriler: Kategori[];
  basvurular: BasvuruDurumu[];
}) {
  const yonlendir = useRouter();
  const [kategoriId, setKategoriId] = useState(kategoriler[0]?.id ?? '');
  const [liste, setListe] = useState('');
  const [calisiyor, setCalisiyor] = useState(false);
  const [sonuc, setSonuc] = useState<
    | {
        eklenen: number;
        atlanan: string[];
        hatali: Array<{ satir: number; metin: string; sebep: string }>;
      }
    | null
  >(null);
  const [hata, setHata] = useState<string | null>(null);
  const [acik, setAcik] = useState(false);

  async function aktar() {
    if (!kategoriId || !liste.trim()) return;
    setHata(null);
    setSonuc(null);
    setCalisiyor(true);
    try {
      const yanit = await fetch('/api/basvuru', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yarismaId, kategoriId, liste }),
      });
      const veri = await yanit.json();
      if (!yanit.ok) {
        setHata(veri.hata ?? 'Liste aktarılamadı.');
        return;
      }
      setSonuc({
        eklenen: veri.eklenen.length,
        atlanan: veri.atlanan ?? [],
        hatali: veri.hatali ?? [],
      });
      setListe('');
      yonlendir.refresh();
    } catch {
      setHata('Sunucuya ulaşılamadı.');
    } finally {
      setCalisiyor(false);
    }
  }

  async function pasifeAl(id: string, aktif: boolean) {
    await fetch('/api/basvuru', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, aktif }),
    });
    yonlendir.refresh();
  }

  async function sil(id: string) {
    const yanit = await fetch(`/api/basvuru?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!yanit.ok) {
      const veri = await yanit.json();
      setHata(veri.hata ?? 'Silinemedi.');
      return;
    }
    yonlendir.refresh();
  }

  /**
   * Kod listesini CSV olarak indirir.
   *
   * Noktalı virgül ayırıcı: Türkçe Windows'ta Excel virgülü ondalık
   * ayırıcı sayıyor ve virgüllü CSV tek sütuna düşüyor. BOM da aynı
   * sebeple — onsuz Türkçe karakterler Excel'de bozuk açılıyor.
   */
  function kodlariIndir() {
    const satirlar = [
      'Basvuru No;Erisim Kodu;Takim;Proje;E-posta',
      ...basvurular.map((b) =>
        [b.basvuruNo, b.kod, b.takim, b.proje ?? '', b.eposta ?? '']
          .map((x) => String(x).replace(/;/g, ','))
          .join(';'),
      ),
    ].join('\r\n');

    const bag = URL.createObjectURL(
      new Blob(['﻿' + satirlar], { type: 'text/csv;charset=utf-8' }),
    );
    const a = document.createElement('a');
    a.href = bag;
    a.download = `basvuru-kodlari-${yarismaAdi.replace(/[^\p{L}\d]+/gu, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(bag);
  }

  const yukleyen = basvurular.filter((b) => b.raporId).length;
  const pasif = basvurular.filter((b) => !b.aktif).length;
  const oran = basvurular.length ? (yukleyen / basvurular.length) * 100 : 0;

  const olcutler: Array<{ n: number; ad: string; vurgu?: string }> = [
    { n: basvurular.length, ad: 'BAŞVURU' },
    { n: yukleyen, ad: 'RAPOR GELDİ', vurgu: 'text-yesil-koyu' },
    {
      n: basvurular.length - yukleyen, ad: 'BEKLİYOR',
      vurgu: basvurular.length - yukleyen > 0 ? 'text-amber-koyu' : undefined,
    },
    { n: pasif, ad: 'PASİF' },
  ];

  return (
    <div>
      {/*
        ÖZET ŞERİDİ YERİNE PANO.

        Önce "6 başvuru · 2 rapor yüklendi · 4 bekliyor" diye tek satır
        gri metindi. Sayılar doğruydu ama okunmuyordu: aynı puntoda, aynı
        renkte, yan yana üç ifade. Kartlar sayıyı öne çıkarıyor; çubuk da
        "ne kadarı geldi" sorusunu tek bakışta cevaplıyor.
      */}
      {basvurular.length > 0 && (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {olcutler.map((o, i) => (
              <div
                key={o.ad}
                style={{ '--sira': i } as React.CSSProperties}
                className="kart belir px-4 py-3.5"
              >
                <p className={`text-[24px] leading-none font-extrabold tabular-nums ${o.vurgu ?? ''}`}>
                  {o.n}
                </p>
                <p className="mt-1.5 text-[9.5px] leading-tight font-bold tracking-wide text-metin-2">
                  {o.ad}
                </p>
              </div>
            ))}
          </div>

          <div className="kart mb-4 flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-3.5">
            <div className="min-w-[220px] flex-1">
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="text-[12px] font-bold">Rapor teslim oranı</span>
                <span className="font-mono text-[11.5px] font-bold tabular-nums">
                  {yukleyen}/{basvurular.length}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-zemin">
                <div
                  className={`h-full rounded-full ${oran === 100 ? 'bg-yesil' : 'bg-amber'}`}
                  style={{ width: `${Math.max(2, oran)}%` }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={kodlariIndir}
              className="dugme shrink-0 border border-cizgi bg-white px-4 py-2 text-[12px] hover:bg-zemin"
            >
              Kodları CSV indir
            </button>
          </div>
        </>
      )}

      {/* ---- liste aktarımı */}
      <details
        open={acik || basvurular.length === 0}
        onToggle={(e) => setAcik((e.currentTarget as HTMLDetailsElement).open)}
        className="mb-5 rounded-xl border border-cizgi bg-white"
      >
        <summary className="cursor-pointer px-5 py-3.5 text-[13px] font-extrabold tracking-tight">
          Başvuru listesi aktar
        </summary>

        <div className="border-t border-cizgi px-5 py-4">
          <label className="mb-3 block">
            <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-metin-2">
              KATEGORİ
            </span>
            <select
              value={kategoriId}
              onChange={(e) => setKategoriId(e.target.value)}
              className="w-full rounded-lg border border-cizgi bg-white px-3 py-2 text-[12.5px] font-semibold"
            >
              {kategoriler.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.ad}
                  {k.asama ? ` · ${k.asama}` : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-metin-2">
              LİSTE
            </span>
            <textarea
              value={liste}
              onChange={(e) => setListe(e.target.value)}
              rows={7}
              spellCheck={false}
              placeholder={
                'TF-2026-04871\tTakım Ege\tEGE01\tAkıllı Sulama Sistemi\tege@okul.edu.tr\n'
                + 'TF-2026-04872\tTakım Anadolu\tANA07\tGüneş Takip Düzeneği'
              }
              className="w-full rounded-lg border border-cizgi bg-white px-3 py-2.5 font-mono text-[11.5px] leading-relaxed outline-none focus:border-metin-3"
            />
          </label>
          <p className="mt-1.5 mb-3 text-[11px] leading-relaxed font-medium text-metin-3">
            Excel&apos;den doğrudan yapıştırabilirsiniz. Sütun sırası: başvuru no,
            takım adı, takım kimliği, proje adı, e-posta. Başvuru numarası
            yoksa sistem üretir; yalnızca takım adı da yeterlidir. Her kayda
            bir erişim kodu üretilir.
          </p>

          <button
            type="button"
            onClick={aktar}
            disabled={!kategoriId || !liste.trim() || calisiyor}
            className="dugme bg-kirmizi px-4 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-kirmizi-koyu"
          >
            {calisiyor ? 'Aktarılıyor…' : 'Listeyi aktar'}
          </button>

          {sonuc && (
            <div className="mt-3 rounded-lg border border-yesil/30 bg-yesil-zemin px-4 py-3">
              <p className="text-[12.5px] font-bold text-yesil-koyu">
                {sonuc.eklenen} başvuru eklendi
              </p>
              {sonuc.atlanan.length > 0 && (
                <p className="mt-1 text-[11.5px] font-medium text-metin-2">
                  {sonuc.atlanan.length} kayıt zaten vardı, atlandı:{' '}
                  {sonuc.atlanan.slice(0, 5).join(', ')}
                  {sonuc.atlanan.length > 5 ? '…' : ''}
                </p>
              )}
              {sonuc.hatali.length > 0 && (
                <div className="mt-1.5">
                  <p className="text-[11.5px] font-bold text-kirmizi-koyu">
                    {sonuc.hatali.length} satır okunamadı:
                  </p>
                  <ul className="mt-0.5 list-disc pl-4 text-[11px] font-medium text-metin-2">
                    {sonuc.hatali.slice(0, 5).map((h) => (
                      <li key={h.satir}>
                        Satır {h.satir}: {h.sebep} — <code>{h.metin.slice(0, 50)}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </details>

      {hata && (
        <p
          role="alert"
          className="mb-3 rounded-lg bg-kirmizi-zemin px-3.5 py-2.5 text-[12px] font-semibold text-kirmizi-koyu"
        >
          {hata}
        </p>
      )}

      {/* ---- liste */}
      {basvurular.length === 0 ? (
        <p className="rounded-xl border border-dashed border-metin-3/40 bg-white px-5 py-6 text-center text-[12.5px] font-medium text-metin-2">
          Bu yarışmada henüz başvuru kaydı yok. Yukarıdan listeyi aktarın.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-cizgi bg-white">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-cizgi text-left text-[10.5px] font-bold tracking-wide text-metin-2">
                <th className="px-4 py-2.5">BAŞVURU NO</th>
                <th className="px-4 py-2.5">ERİŞİM KODU</th>
                <th className="px-4 py-2.5">TAKIM</th>
                <th className="px-4 py-2.5">PROJE</th>
                <th className="px-4 py-2.5">RAPOR</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {basvurular.map((b) => (
                <tr
                  key={b.id}
                  className={`border-b border-cizgi/60 last:border-0 ${
                    b.aktif ? '' : 'opacity-45'
                  }`}
                >
                  <td className="px-4 py-2.5 font-mono font-bold whitespace-nowrap">
                    {/* Numara detay sayfasına bağlı: yazışma, takım üyeleri
                        ve rapor bağlantısı orada. */}
                    <Link
                      href={`/koordinasyon/basvurular/${b.id}`}
                      className="hover:text-kirmizi hover:underline"
                    >
                      {b.basvuruNo}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => navigator.clipboard?.writeText(b.kod)}
                      title="Kodu kopyala"
                      className="cursor-pointer rounded bg-zemin px-2 py-1 font-mono text-[11.5px] font-bold tracking-wider transition-colors hover:bg-cizgi"
                    >
                      {b.kod}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 font-semibold">{b.takim}</td>
                  <td className="px-4 py-2.5 text-metin-2">{b.proje ?? '—'}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {b.raporId ? (
                      <span className="rounded bg-yesil-zemin px-2 py-0.5 text-[10.5px] font-bold text-yesil-koyu">
                        YÜKLENDİ
                      </span>
                    ) : (
                      <span className="rounded bg-amber-zemin px-2 py-0.5 text-[10.5px] font-bold text-amber-koyu">
                        BEKLİYOR
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => pasifeAl(b.id, !b.aktif)}
                      className="cursor-pointer text-[11px] font-bold text-metin-2 hover:text-metin"
                    >
                      {b.aktif ? 'Pasife al' : 'Aktifleştir'}
                    </button>
                    {/* Silme YALNIZCA raporu olmayan kayıtta görünüyor.
                        Sunucu da aynı kuralı uyguluyor; düğmeyi gizlemek
                        yalnızca kullanıcıyı reddedilecek bir tıklamadan
                        kurtarıyor. */}
                    {!b.raporId && (
                      <button
                        type="button"
                        onClick={() => sil(b.id)}
                        className="ml-3 cursor-pointer text-[11px] font-bold text-kirmizi hover:text-kirmizi-koyu"
                      >
                        Sil
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
