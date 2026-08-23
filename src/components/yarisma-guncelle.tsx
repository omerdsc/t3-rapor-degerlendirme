'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Sonuc {
  degisen?: string[];
  eklenen?: string[];
  degismeyen?: string[];
  katalogdaYok?: string[];
  uyarilar?: string[];
  hata?: string;
}

/**
 * Şablon güncelleme düğmesi.
 *
 * Sonucu AYRINTILI gösteriyor, çünkü güncelleme yıkıcı görünen bir işlem:
 * kullanıcı neyin değiştiğini, neyin korunduğunu ve neyin dokunulmadığını
 * görmeden basmaktan çekinir. "Güncellendi" demek yetmez.
 */
export default function YarismaGuncelle({
  yarismaId,
  slugVar,
}: {
  yarismaId: string;
  slugVar: boolean;
}) {
  const yonlendir = useRouter();
  const [calisiyor, setCalisiyor] = useState(false);
  const [sonuc, setSonuc] = useState<Sonuc | null>(null);

  async function guncelle() {
    setCalisiyor(true);
    setSonuc(null);
    try {
      const yanit = await fetch('/api/yarisma/guncelle', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ yarismaId }),
      });
      const d: Sonuc = await yanit.json();
      setSonuc(d);
      if (yanit.ok) yonlendir.refresh();
    } catch (e) {
      setSonuc({ hata: e instanceof Error ? e.message : 'Ağ hatası.' });
    } finally {
      setCalisiyor(false);
    }
  }

  if (!slugVar) {
    return (
      <p className="rounded-lg bg-zemin px-3 py-2.5 text-[11.5px] leading-relaxed font-medium text-metin-2">
        Bu yarışma elle kurulmuş, katalog kaynağı yok. Şablonu yenilemek için
        yeni sürümü &ldquo;Kategori ekle&rdquo; ile yükleyin.
      </p>
    );
  }

  return (
    <div>
      <button
        type="button"
        disabled={calisiyor}
        onClick={guncelle}
        className="cursor-pointer rounded-lg border border-lacivert bg-white px-3.5 py-2 text-[12px] font-bold text-lacivert transition-colors hover:bg-zemin disabled:opacity-50"
      >
        {calisiyor ? 'Kontrol ediliyor…' : 'Şablonları teknofest.org’dan yenile'}
      </button>
      <span className="ml-2 text-[11px] font-medium text-metin-3">ücretsiz</span>

      {sonuc && (
        <div className="mt-3 flex flex-col gap-1.5 text-[11.5px]">
          {sonuc.hata && (
            <p className="rounded-lg bg-kirmizi-zemin px-3 py-2 font-semibold text-kirmizi-koyu">
              {sonuc.hata}
            </p>
          )}

          {!sonuc.hata &&
            !sonuc.degisen?.length &&
            !sonuc.eklenen?.length && (
              <p className="rounded-lg bg-yesil-zemin px-3 py-2 font-semibold text-yesil-koyu">
                Şablonlar güncel — değişiklik yok.
                {!!sonuc.degismeyen?.length &&
                  ` ${sonuc.degismeyen.length} kategori kontrol edildi.`}
              </p>
            )}

          {!!sonuc.degisen?.length && (
            <div className="rounded-lg bg-amber-zemin px-3 py-2">
              <p className="mb-1 font-bold text-amber-koyu">
                {sonuc.degisen.length} kategori güncellendi — onayları
                sıfırlandı
              </p>
              <ul className="flex flex-col gap-0.5">
                {sonuc.degisen.map((d, i) => (
                  <li key={i} className="text-[10.5px] leading-relaxed text-amber-koyu/90">
                    • {d}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!!sonuc.eklenen?.length && (
            <p className="rounded-lg bg-mavi-zemin px-3 py-2 font-semibold text-mavi-koyu">
              {sonuc.eklenen.length} yeni kategori eklendi: {sonuc.eklenen.join(', ')}
            </p>
          )}

          {!!sonuc.katalogdaYok?.length && (
            <div className="rounded-lg bg-zemin px-3 py-2">
              <p className="font-bold text-metin-2">
                {sonuc.katalogdaYok.length} kategori artık katalogda yok
              </p>
              <p className="mt-0.5 text-[10.5px] leading-relaxed font-medium text-metin-2">
                Silinmedi: {sonuc.katalogdaYok.join(', ')}. Bu kategorilerdeki
                raporlar ve hakem puanları geçmiş bir değerlendirmenin kaydı;
                kaldırma kararı sizin.
              </p>
            </div>
          )}

          {!!sonuc.uyarilar?.length && (
            <details className="rounded-lg bg-zemin px-3 py-2">
              <summary className="cursor-pointer font-bold text-metin-2">
                {sonuc.uyarilar.length} uyarı
              </summary>
              <ul className="mt-1 flex flex-col gap-0.5">
                {sonuc.uyarilar.map((u, i) => (
                  <li key={i} className="text-[10.5px] leading-relaxed text-metin-2">
                    • {u}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
