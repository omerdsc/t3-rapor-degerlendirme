'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * Toplu ön değerlendirme — PRD AKIŞ 01'in "AI analiz sürecini başlatır" adımı.
 *
 * ── NİYE SIRAYLA, TEK İSTEKTE DEĞİL ─────────────────────────────────────
 * Rapor başına ~90 saniye. 40 raporu tek istekte göndermek bir saat sürer,
 * rota zaman aşımına düşer ve kullanıcı ne olduğunu göremez. Sırayla
 * gidince her rapordan sonra harcanan tutar görünüyor ve kullanıcı
 * DURDURABİLİYOR.
 *
 * ── NİYE ÖNCE ONAY İSTENİYOR ────────────────────────────────────────────
 * Bu sistemin tek ücretli adımı bu ve "başlat"a basmak geri alınamaz bir
 * işlem. Kullanıcı kaç raporun işleneceğini ve ne kadar süreceğini
 * görmeden başlatmamalı.
 *
 * Tutarlar `MALIYET_GOSTER` anahtarına bağlı ve varsayılan kapalı; kapalıyken
 * rakam sunucudan İSTEMCİYE HİÇ GÖNDERİLMİYOR — sayfa kaynağında duran bir
 * rakam gizlenmiş sayılmaz. Ama tavan aşımı uyarısı tutarsız da veriliyor:
 * işlemin yarıda duracağını bilmek fiyat bilgisi değil, davranış bilgisi.
 *
 * ── BÜTÇE AŞIMINDA DÖNGÜ DURUYOR ────────────────────────────────────────
 * Sunucu 402 dönerse kalan raporlar denenmiyor. Aynı hatayı 40 kez almak
 * kullanıcıya "sistem bozuk" gibi görünür; sebebi bütçe, arıza değil.
 */

interface Hedef {
  raporId: string;
  basvuruNo: string;
  proje: string;
  olcutOnayli: boolean;
}

interface Durum {
  hedefler: Hedef[];
  zatenVar: number;
  /** Tutarlar `MALIYET_GOSTER` kapalıysa sunucudan hiç gelmiyor. */
  maliyetGoster: boolean;
  birimMaliyet?: number;
  tahminiTutar?: number;
  tavan?: number;
  tavaniAsiyor: boolean;
  onaysizOlcut: number;
}

export default function TopluDegerlendirme({
  yarismaId,
  kategoriId,
}: {
  yarismaId: string;
  kategoriId?: string;
}) {
  const yonlendir = useRouter();
  const [durum, setDurum] = useState<Durum | null>(null);
  const [acik, setAcik] = useState(false);
  const [calisiyor, setCalisiyor] = useState(false);
  const [durdur, setDurdur] = useState(false);
  const [ilerleme, setIlerleme] = useState<{
    bitti: number;
    harcanan: number;
    atlanan: number;
    hata: string[];
  } | null>(null);

  /* Hedef listesi ve maliyet tahmini — GET hiçbir şey harcamıyor. */
  useEffect(() => {
    let iptal = false;
    const q = new URLSearchParams({ yarisma: yarismaId });
    if (kategoriId) q.set('kategori', kategoriId);
    (async () => {
      try {
        const y = await fetch(`/api/degerlendir-toplu?${q}`);
        const d = await y.json();
        if (!iptal) setDurum(y.ok ? d : null);
      } catch {
        if (!iptal) setDurum(null);
      }
    })();
    return () => {
      iptal = true;
    };
  }, [yarismaId, kategoriId]);

  async function basla() {
    if (!durum) return;
    setCalisiyor(true);
    setDurdur(false);
    let harcanan = 0;
    let atlanan = 0;
    const hata: string[] = [];

    for (const [i, h] of durum.hedefler.entries()) {
      // Kullanıcı durdurduysa kalanları hiç denemiyoruz.
      if (durdur) break;
      try {
        const y = await fetch(`/api/rapor/${h.raporId}/degerlendir`, {
          method: 'POST',
        });
        const d = await y.json();

        if (y.status === 402) {
          // Bütçe tavanı: devam etmek anlamsız.
          hata.push(`Bütçe tavanına ulaşıldı — kalan ${durum.hedefler.length - i} rapor atlandı.`);
          setIlerleme({ bitti: i, harcanan, atlanan, hata: [...hata] });
          break;
        }
        if (!y.ok) {
          hata.push(`${h.basvuruNo}: ${d.hata ?? 'başarısız'}`);
        } else {
          harcanan += (d.maliyet ?? 0) + (d.ozetMaliyeti ?? 0);
          if (d.onbellek) atlanan++;
        }
      } catch (e) {
        hata.push(`${h.basvuruNo}: ${e instanceof Error ? e.message : 'ağ hatası'}`);
      }
      setIlerleme({ bitti: i + 1, harcanan, atlanan, hata: [...hata] });
    }

    setCalisiyor(false);
    yonlendir.refresh();
  }

  if (!durum) return null;

  /* Değerlendirilecek rapor yoksa şeridi hiç göstermiyoruz. */
  if (!durum.hedefler.length) {
    return durum.zatenVar > 0 ? (
      <div className="mb-4 flex flex-wrap items-center gap-2.5 rounded-xl border border-yesil/25 bg-yesil-zemin px-4 py-2.5">
        <svg viewBox="0 0 24 24" className="size-4 shrink-0 stroke-yesil-koyu" fill="none" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
          <path d="m20 6-11 11-5-5" />
        </svg>
        <p className="text-[11.5px] font-semibold text-yesil-koyu">
          Bu seçimdeki {durum.zatenVar} raporun tamamı ön değerlendirmeden
          geçti. Hakemler analizi hazır buluyor.
        </p>
      </div>
    ) : null;
  }

  const tutarAsiyor = durum.tavaniAsiyor;

  return (
    <div className="mb-4 rounded-xl border border-cizgi bg-white px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] font-bold">
            Yapay zekâ ön değerlendirmesi — {durum.hedefler.length} rapor bekliyor
          </h2>
          <p className="mt-1 text-[11.5px] leading-relaxed font-medium text-metin-2">
            Ölçüt bazında puan önerisi, gerekçe ve rapordan alıntı üretir;
            hakem hazır bulur.
            {durum.maliyetGoster && durum.tahminiTutar !== undefined && (
              <>
                {' '}Tahmini tutar{' '}
                <strong className="font-bold text-metin">
                  ${durum.tahminiTutar.toFixed(2)}
                </strong>{' '}
                ({durum.hedefler.length} × ${durum.birimMaliyet}).
              </>
            )}
            {durum.zatenVar > 0 && ` ${durum.zatenVar} rapor zaten değerlendirilmiş, atlanacak.`}
          </p>
        </div>

        {!calisiyor ? (
          <button
            type="button"
            onClick={() => setAcik((a) => !a)}
            className="shrink-0 cursor-pointer rounded-lg bg-kirmizi px-4 py-2.5 text-[12.5px] font-bold text-white transition-colors hover:bg-kirmizi-koyu"
          >
            {acik ? 'Vazgeç' : 'Toplu başlat'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setDurdur(true)}
            className="shrink-0 cursor-pointer rounded-lg border border-kirmizi px-4 py-2.5 text-[12.5px] font-bold text-kirmizi transition-colors hover:bg-kirmizi-zemin"
          >
            {durdur ? 'Durduruluyor…' : 'Durdur'}
          </button>
        )}
      </div>

      {acik && !calisiyor && (
        <div className="mt-3 rounded-lg bg-zemin px-3.5 py-3">
          <p className="text-[11.5px] leading-relaxed font-medium text-metin">
            <strong className="font-bold">
              {durum.hedefler.length} rapor değerlendirilecek
              {durum.maliyetGoster && durum.tahminiTutar !== undefined
                ? ` · ~$${durum.tahminiTutar.toFixed(2)}`
                : ''}
              {' · yaklaşık '}
              {Math.ceil((durum.hedefler.length * 90) / 60)} dakika
            </strong>
          </p>

          {/*
            TAVAN UYARISI TUTARSIZ DA VERİLİYOR.
            Tutar gizlense bile kullanıcı işlemin yarıda duracağını
            bilmeli — bu bir davranış bilgisi, fiyat değil.
          */}
          {tutarAsiyor && (
            <p className="mt-2 rounded-md bg-amber-zemin px-2.5 py-2 text-[11px] leading-relaxed font-semibold text-amber-koyu">
              Bu işlem kurulumun bütçe tavanını aşıyor
              {durum.maliyetGoster && durum.tavan !== undefined
                ? ` ($${durum.tavan})`
                : ''}
              . Sistem tavana ulaşınca çağrıyı reddedip duracak — başlatmak
              güvenli, ama hepsi tamamlanmayacak. Tavanı{' '}
              <code className="font-mono">TOPLAM_TAVAN</code> ile
              yükseltebilirsiniz.
            </p>
          )}

          {durum.onaysizOlcut > 0 && (
            <p className="mt-2 rounded-md bg-amber-zemin px-2.5 py-2 text-[11px] leading-relaxed font-semibold text-amber-koyu">
              {durum.onaysizOlcut} raporun kategorisinde ölçütler henüz
              onaylanmadı. Ön değerlendirme yine çalışır ama otomatik
              çıkarılmış ölçütlere göre puan önerir — önce Yarışmalar
              ekranından onaylamak daha doğru.
            </p>
          )}

          <p className="mt-2 text-[10.5px] leading-relaxed font-medium text-metin-2">
            Raporlar sırayla işlenir ve istediğiniz an
            durdurabilirsiniz. Durdurulan işlem tamamlanmış raporları geri
            almaz.
          </p>

          <button
            type="button"
            onClick={basla}
            className="mt-3 cursor-pointer rounded-lg bg-kirmizi px-4 py-2.5 text-[12.5px] font-bold text-white transition-colors hover:bg-kirmizi-koyu"
          >
            Onaylıyorum, başlat
          </button>
        </div>
      )}

      {ilerleme && (
        <div className="mt-3 rounded-lg bg-zemin px-3.5 py-3">
          <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
            <span className="text-[12px] font-bold">
              {ilerleme.bitti}/{durum.hedefler.length} rapor
            </span>
            {durum.maliyetGoster && (
              <span className="text-[11.5px] font-semibold text-metin-2">
                harcanan ${ilerleme.harcanan.toFixed(4)}
              </span>
            )}
            {calisiyor && (
              <span className="text-[11px] font-medium text-metin-2">
                sürüyor…
              </span>
            )}
          </div>

          <div className="h-[6px] overflow-hidden rounded-full bg-cizgi">
            <div
              className="h-full rounded-full bg-yesil transition-[width] duration-500"
              style={{
                width: `${(ilerleme.bitti / durum.hedefler.length) * 100}%`,
              }}
            />
          </div>

          {!!ilerleme.hata.length && (
            <ul className="mt-2 flex flex-col gap-1">
              {ilerleme.hata.map((h, i) => (
                <li key={i} className="text-[11px] font-semibold text-amber-koyu">
                  {h}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
