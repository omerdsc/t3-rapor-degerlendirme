'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

interface Teslim {
  basvuruNo: string;
  dosyaAdi: string;
  yuklendi: string;
  sayfaSayisi: number;
  yenilendi: boolean;
}

/**
 * Yarışmacının rapor yükleme alanı.
 *
 * ── TEK DOSYA, ÇOK DOSYA DEĞİL ──────────────────────────────────────────
 * Koordinasyonun yükleyicisi çoklu seçime izin veriyor çünkü orada iş
 * yığın halinde. Burada bir başvurunun bir raporu var; çoklu seçim
 * yarışmacıya "hepsini yükleyebilirim" izlenimi verir, oysa sonuncusu
 * öncekini siler. Kısıt arayüzde de görünmeli.
 *
 * ── YÜKLEME UZUN SÜRÜYOR, BUNU SÖYLÜYORUZ ───────────────────────────────
 * Kaynak doğrulama Crossref ve OpenAlex'e sorgu atıyor; 15 künyelik bir
 * kaynakçada bu ~10 saniye. Sessiz bir bekleme, yarışmacının sekmeyi
 * kapatmasına yol açar — teslim tam da o an yarıda kalır.
 */
export default function BasvuruYukleyici({
  basvuruId,
  kilitli,
  mevcutDosya,
}: {
  basvuruId: string;
  /** Değerlendirme başladı: yükleme kapalı. */
  kilitli: boolean;
  mevcutDosya?: string;
}) {
  const yonlendir = useRouter();
  const girdiRef = useRef<HTMLInputElement>(null);
  const [suruklenIyor, setSuruklenIyor] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [teslim, setTeslim] = useState<Teslim | null>(null);

  async function gonder(dosya: File) {
    setHata(null);
    setTeslim(null);
    setYukleniyor(true);
    try {
      const govde = new FormData();
      govde.append('dosya', dosya);
      const yanit = await fetch(
        `/api/yarismaci/rapor?basvuru=${encodeURIComponent(basvuruId)}`,
        { method: 'POST', body: govde },
      );
      const veri = await yanit.json();
      if (!yanit.ok) {
        setHata(veri.hata ?? 'Rapor yüklenemedi.');
        return;
      }
      setTeslim(veri.teslim);
      yonlendir.refresh();
    } catch {
      setHata('Yükleme tamamlanamadı. Bağlantınızı kontrol edip tekrar deneyin.');
    } finally {
      setYukleniyor(false);
      if (girdiRef.current) girdiRef.current.value = '';
    }
  }

  if (kilitli) {
    return (
      <div className="rounded-xl border border-cizgi bg-zemin px-5 py-4">
        <p className="text-[13px] font-bold">Raporunuz değerlendirmeye alındı</p>
        <p className="mt-1 text-[12px] leading-relaxed font-medium text-metin-2">
          Rapor hakeme iletildiği için artık değiştirilemiyor. Bir sorun
          olduğunu düşünüyorsanız koordinasyonla iletişime geçin.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setSuruklenIyor(true);
        }}
        onDragLeave={() => setSuruklenIyor(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSuruklenIyor(false);
          const d = e.dataTransfer.files?.[0];
          if (d && !yukleniyor) gonder(d);
        }}
        onClick={() => !yukleniyor && girdiRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed px-5 py-8 text-center transition-colors ${
          suruklenIyor ? 'border-kirmizi bg-kirmizi/5' : 'border-cizgi bg-white hover:bg-zemin/50'
        } ${yukleniyor ? 'pointer-events-none opacity-60' : ''}`}
      >
        <input
          ref={girdiRef}
          type="file"
          accept=".pdf,.docx,application/pdf"
          className="hidden"
          onChange={(e) => {
            const d = e.target.files?.[0];
            if (d) gonder(d);
          }}
        />
        {yukleniyor ? (
          <>
            <p className="text-[13px] font-bold">Raporunuz yükleniyor…</p>
            <p className="mt-1 text-[11.5px] font-medium text-metin-2">
              Belge inceleniyor. Bu işlem yarım dakikayı bulabilir — lütfen
              sayfayı kapatmayın.
            </p>
          </>
        ) : (
          <>
            <p className="text-[13px] font-bold">
              {mevcutDosya ? 'Raporunuzu değiştirin' : 'Raporunuzu yükleyin'}
            </p>
            <p className="mt-1 text-[11.5px] font-medium text-metin-2">
              Dosyayı buraya sürükleyin ya da tıklayıp seçin · PDF veya Word
              (.docx) · en fazla 25 MB
            </p>
            {mevcutDosya && (
              <p className="mt-2 text-[11px] font-semibold text-metin-3">
                Yeni yükleme mevcut raporunuzun yerine geçer.
              </p>
            )}
          </>
        )}
      </div>

      {hata && (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-kirmizi-zemin px-3.5 py-2.5 text-[12px] font-semibold text-kirmizi-koyu"
        >
          {hata}
        </p>
      )}

      {teslim && (
        <div className="mt-3 rounded-lg border border-yesil/30 bg-yesil-zemin px-4 py-3">
          <p className="text-[13px] font-bold text-yesil-koyu">
            {teslim.yenilendi ? 'Yeni raporunuz alındı' : 'Raporunuz alındı'}
          </p>
          <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11.5px] font-medium">
            <dt className="text-metin-2">Başvuru</dt>
            <dd className="font-mono font-bold">{teslim.basvuruNo}</dd>
            <dt className="text-metin-2">Dosya</dt>
            <dd className="font-semibold">{teslim.dosyaAdi}</dd>
            <dt className="text-metin-2">Sayfa</dt>
            <dd className="font-semibold">{teslim.sayfaSayisi}</dd>
            <dt className="text-metin-2">Zaman</dt>
            <dd className="font-semibold">
              {new Date(teslim.yuklendi).toLocaleString('tr')}
            </dd>
          </dl>
        </div>
      )}
    </div>
  );
}
