'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { RubrikKriteri } from '@/lib/analiz/sablon-cikar';

/**
 * Rubrik düzenleme.
 *
 * Şablondan çıkarılan kriterler bir TASLAKTIR. Şablonlar her zaman eksiksiz
 * değil ve koordinasyon sonradan ölçüt getirebiliyor; yönetici kendi kriterini
 * ekleyebilmeli. Şablondan gelen kriterler de kaldırılabilir — çıkarım yanlış
 * yorumlamış olabilir.
 */
export default function KriterYonetimi({
  yarismaId,
  kategoriId,
  kriterler,
  toplamPuan,
  onayli,
}: {
  yarismaId: string;
  kategoriId: string;
  kriterler: RubrikKriteri[];
  toplamPuan: number;
  onayli: boolean;
}) {
  const yonlendir = useRouter();
  const [onayCalisiyor, setOnayCalisiyor] = useState(false);

  /**
   * Kategoriyi onaylar. Rubriği DEĞİŞTİRMEZ.
   *
   * Onay bayrağını daha önce yalnızca kriter ekleme/silme set ediyordu:
   * çıkarım doğru olan bir kategoride yönetici onaylamak için rubriği
   * bozmak zorunda kalıyordu.
   */
  async function onayDegistir() {
    setOnayCalisiyor(true);
    try {
      await fetch('/api/kriter', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ yarismaId, kategoriId, onayli: !onayli }),
      });
      yonlendir.refresh();
    } finally {
      setOnayCalisiyor(false);
    }
  }
  const [acik, setAcik] = useState(false);
  const [ad, setAd] = useState('');
  const [puan, setPuan] = useState('');
  const [olcut, setOlcut] = useState('');
  const [calisiyor, setCalisiyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  async function ekle() {
    setCalisiyor(true);
    setHata(null);
    try {
      const yanit = await fetch('/api/kriter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yarismaId,
          kategoriId,
          ad,
          puan: Number(puan),
          // Her satır ayrı bir ölçüt cümlesi; AI'a "neye bakılacak" olarak gider.
          olcut: olcut.split('\n').map((o) => o.trim()).filter(Boolean),
        }),
      });
      const veri = await yanit.json();
      if (!yanit.ok) setHata(veri.hata ?? 'Kriter eklenemedi.');
      else {
        setAd('');
        setPuan('');
        setOlcut('');
        setAcik(false);
        yonlendir.refresh();
      }
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Ağ hatası.');
    } finally {
      setCalisiyor(false);
    }
  }

  async function sil(kod: string) {
    setCalisiyor(true);
    try {
      await fetch('/api/kriter', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yarismaId, kategoriId, kod }),
      });
      yonlendir.refresh();
    } finally {
      setCalisiyor(false);
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-2.5">
        <h4 className="text-[11px] font-bold tracking-wide text-metin-3">
          DEĞERLENDİRME ÖLÇÜTLERİ · {kriterler.length} ADET · {toplamPuan} PUAN
        </h4>
        {toplamPuan !== 100 && (
          <span className="rounded bg-amber-zemin px-1.5 py-0.5 text-[9.5px] font-bold text-amber-koyu">
            TOPLAM 100 DEĞİL
          </span>
        )}
        <button
          type="button"
          disabled={onayCalisiyor}
          onClick={onayDegistir}
          title={
            onayli
              ? 'Onayı geri al — kategori yeniden taslak sayılır'
              : 'Bu rubriği gözden geçirdim ve doğru; rubriği değiştirmez'
          }
          className={`ml-auto cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors disabled:opacity-50 ${
            onayli
              ? 'bg-yesil-zemin text-yesil-koyu hover:bg-yesil-zemin/70'
              : 'bg-kirmizi text-white hover:bg-kirmizi-koyu'
          }`}
        >
          {onayCalisiyor ? '…' : onayli ? '✓ Onaylı' : 'Rubriği onayla'}
        </button>
        <button
          type="button"
          onClick={() => setAcik((a) => !a)}
          className="text-[11.5px] font-bold text-kirmizi hover:text-kirmizi-koyu"
        >
          {acik ? 'Vazgeç' : '+ Kriter ekle'}
        </button>
      </div>

      <ul className="flex flex-col gap-1">
        {kriterler.map((k) => (
          <li key={k.kod} className="group flex items-baseline gap-2.5 text-[12px]">
            <span className="w-9 shrink-0 text-right font-extrabold">{k.puan}p</span>
            <span className="min-w-0 flex-1 truncate font-medium">{k.ad}</span>
            {!k.bolumBekleniyor && (
              <span
                title="Raporda ayrı bölüm olarak beklenmiyor; raporun bütününe bakılarak puanlanır"
                className="shrink-0 rounded bg-mavi-zemin px-1.5 py-px text-[9px] font-bold text-mavi-koyu"
              >
                BÖLÜM YOK
              </span>
            )}
            <span className="shrink-0 text-[10px] font-medium text-metin-3">
              {k.olcut.length} ölçüt
            </span>
            <button
              type="button"
              disabled={calisiyor}
              onClick={() => sil(k.kod)}
              className="shrink-0 text-[10.5px] font-bold text-metin-3 opacity-0 transition-opacity group-hover:opacity-100 hover:text-kirmizi disabled:opacity-30"
            >
              kaldır
            </button>
          </li>
        ))}
      </ul>

      {acik && (
        <div className="mt-3 flex flex-col gap-2 rounded-lg border border-cizgi bg-zemin/60 p-3">
          <div className="flex flex-wrap gap-2">
            <input
              value={ad}
              onChange={(e) => setAd(e.target.value)}
              placeholder="Kriter adı (ör. Etik Beyan)"
              className="min-w-[200px] flex-1 rounded-lg border border-cizgi bg-white px-3 py-2 text-[12px] font-medium"
            />
            <input
              value={puan}
              onChange={(e) => setPuan(e.target.value)}
              type="number"
              min={1}
              max={100}
              placeholder="Puan"
              className="w-[86px] rounded-lg border border-cizgi bg-white px-3 py-2 text-[12px] font-semibold"
            />
          </div>
          <textarea
            value={olcut}
            onChange={(e) => setOlcut(e.target.value)}
            rows={3}
            placeholder={
              'Neye bakılacak? Her satır bir ölçüt.\n' +
              'Ör: Etik kurul onayı belirtilmiş mi?\n' +
              'Ör: Kişisel veri kullanımı açıklanmış mı?'
            }
            className="rounded-lg border border-cizgi bg-white px-3 py-2 text-[12px]"
          />
          <p className="text-[10.5px] leading-relaxed font-medium text-metin-2">
            Ölçüt cümleleri yapay zekâya bu kriterde neye bakacağını söyler.
            Boş bırakırsan model yalnızca kriter adına göre yorumlar.
          </p>
          <button
            type="button"
            disabled={calisiyor || ad.trim().length < 3 || !puan}
            onClick={ekle}
            className="self-start rounded-lg bg-kirmizi px-4 py-2 text-[12px] font-bold text-white disabled:opacity-50"
          >
            {calisiyor ? 'Ekleniyor…' : 'Kriteri ekle'}
          </button>
          {hata && <p className="text-[11.5px] font-semibold text-kirmizi-koyu">{hata}</p>}
        </div>
      )}
    </div>
  );
}
