'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import type { YarismaKategorisi } from '@/lib/depo/tipler';

/**
 * Şartname yükleyici.
 *
 * Şablondan ayrı bir belge. İki aşamalı:
 *   1. Deterministik çıkarım — sayfa sınırı, takım kuralları, tarihler,
 *      aşamalar, eleyici hükümler. Modelsiz, ücretsiz.
 *   2. Tek seferlik AI özeti (isteğe bağlı) — hakemin puanlarken bilmesi
 *      gerekenler. Kurulumda bir kez, sonra her raporda bedava.
 */
export default function SartnameYukleyici({
  yarismaId,
  kategori,
}: {
  yarismaId: string;
  kategori: YarismaKategorisi;
}) {
  const yonlendir = useRouter();
  const girdiRef = useRef<HTMLInputElement>(null);
  const [ozetle, setOzetle] = useState(true);
  const [calisiyor, setCalisiyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);

  const s = kategori.sartname;

  /**
   * Kayıtlı şartnameden özet üretir — dosya seçmeden.
   *
   * Katalogdan aktarılan kategorilerde şartname zaten çözümlü ama özeti yok
   * (ücretli adım). Kaynağı kayıtlı olduğu için yeniden yüklemeye gerek yok.
   */
  async function kaynaktanOzetle() {
    setCalisiyor(true);
    setHata(null);
    setBilgi(null);
    try {
      const yanit = await fetch('/api/sartname', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ yarismaId, kategoriId: kategori.id }),
      });
      const veri = await yanit.json();
      if (!yanit.ok) setHata(veri.hata ?? 'Özet üretilemedi.');
      else {
        setBilgi(
          veri.zatenVar
            ? 'Bu şartnamenin özeti zaten var; yeni çağrı yapılmadı.'
            : 'Özet üretildi.',
        );
        yonlendir.refresh();
      }
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Ağ hatası.');
    } finally {
      setCalisiyor(false);
    }
  }

  async function gonder(dosya: File) {
    setCalisiyor(true);
    setHata(null);
    setBilgi(null);

    const gövde = new FormData();
    gövde.append('sartname', dosya);
    gövde.append('yarismaId', yarismaId);
    gövde.append('kategoriId', kategori.id);
    if (ozetle) gövde.append('ozetle', '1');

    try {
      const yanit = await fetch('/api/sartname', { method: 'POST', body: gövde });
      const veri = await yanit.json();
      if (!yanit.ok) setHata(veri.hata ?? 'Şartname işlenemedi.');
      else {
        setBilgi(
          veri.maliyet > 0
            ? 'Şartname çözümlendi ve özetlendi.'
            : 'Şartname çözümlendi · maliyet $0',
        );
        yonlendir.refresh();
      }
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Ağ hatası.');
    } finally {
      setCalisiyor(false);
    }
  }

  return (
    <div className="mt-3 border-t border-cizgi pt-3">
      <div className="mb-2 flex flex-wrap items-center gap-2.5">
        <h4 className="text-[11px] font-bold tracking-wide text-metin-3">ŞARTNAME</h4>
        {s ? (
          <span className="rounded bg-yesil-zemin px-2 py-0.5 text-[9px] font-bold tracking-wide text-yesil-koyu">
            YÜKLÜ
          </span>
        ) : (
          <span className="rounded bg-amber-zemin px-2 py-0.5 text-[9px] font-bold tracking-wide text-amber-koyu">
            EKSİK
          </span>
        )}
        {s?.ozet && (
          <span className="rounded bg-mavi-zemin px-2 py-0.5 text-[9px] font-bold tracking-wide text-mavi-koyu">
            AI ÖZETİ VAR
          </span>
        )}
      </div>

      {!s && (
        <p className="mb-2.5 text-[11px] leading-relaxed font-medium text-metin-2">
          Şablon &ldquo;raporu nasıl yaz&rdquo; der; şartname{' '}
          <strong className="font-bold">
            &ldquo;yarışma ne istiyor, ne eler&rdquo;
          </strong>{' '}
          der. Yüklenmezse kategori tanımları, eleyici hükümler ve teknik
          beklentiler eksik kalır — özgünlük ve uygulanabilirlik kriterleri
          bunlar olmadan doğru puanlanamaz.
        </p>
      )}

      {s && (
        <dl className="mb-2.5 flex flex-col gap-1 text-[11.5px]">
          <div className="flex gap-2">
            <dt className="w-[104px] shrink-0 font-medium text-metin-2">Dosya</dt>
            <dd className="min-w-0 truncate font-semibold">
              {s.dosyaAdi} · {s.sayfaSayisi} sayfa
            </dd>
          </div>
          {(s.kurallar.asgariSayfa || s.kurallar.azamiSayfa) && (
            <div className="flex gap-2">
              <dt className="w-[104px] shrink-0 font-medium text-metin-2">Sayfa sınırı</dt>
              <dd className="font-semibold">
                {s.kurallar.asgariSayfa ?? '—'} – {s.kurallar.azamiSayfa ?? '—'}
              </dd>
            </div>
          )}
          {s.kurallar.azamiUye && (
            <div className="flex gap-2">
              <dt className="w-[104px] shrink-0 font-medium text-metin-2">Azami üye</dt>
              <dd className="font-semibold">{s.kurallar.azamiUye} kişi</dd>
            </div>
          )}
          {s.kurallar.asamalar.length > 0 && (
            <div className="flex gap-2">
              <dt className="w-[104px] shrink-0 font-medium text-metin-2">Aşamalar</dt>
              <dd className="min-w-0 font-semibold">{s.kurallar.asamalar.join(' → ')}</dd>
            </div>
          )}
          {s.kurallar.katilimciSeviyeleri.length > 0 && (
            <div className="flex gap-2">
              <dt
                className="w-[104px] shrink-0 font-medium text-metin-2"
                title="Şartnamedeki &quot;kategori&quot; teknik alan değil katılımcı seviyesi anlamına gelir"
              >
                Katılımcı
              </dt>
              <dd className="min-w-0 font-semibold">
                {s.kurallar.katilimciSeviyeleri.join(' · ')}
              </dd>
            </div>
          )}
          {s.kurallar.tarihler.length > 0 && (
            <div className="flex gap-2">
              <dt className="w-[104px] shrink-0 font-medium text-metin-2">Tarihler</dt>
              <dd className="min-w-0 font-semibold">
                {s.kurallar.tarihler
                  .slice(0, 3)
                  .map((t) => `${t.etiket}: ${t.tarih}`)
                  .join(' · ')}
              </dd>
            </div>
          )}
        </dl>
      )}

      {s && s.kurallar.eleyiciHukumler.length > 0 && (
        <details className="mb-2.5 rounded-lg bg-kirmizi-zemin px-3 py-2">
          <summary className="cursor-pointer text-[11px] font-bold text-kirmizi-koyu">
            {s.kurallar.eleyiciHukumler.length} eleyici hüküm bulundu
          </summary>
          <ul className="mt-1.5 flex flex-col gap-1">
            {s.kurallar.eleyiciHukumler.map((h, i) => (
              <li key={i} className="text-[10.5px] leading-relaxed text-kirmizi-koyu/90">
                • {h}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* AI özeti — modelin her değerlendirmede kullanacağı metin.
          Yöneticiye gösteriliyor ki neyin esas alındığını doğrulayabilsin. */}
      {s?.ozet && (
        <details className="mb-2.5 rounded-lg border border-mavi/25 bg-mavi-zemin/50 px-3 py-2">
          <summary className="cursor-pointer text-[11px] font-bold text-mavi-koyu">
            AI özeti — her değerlendirmede bu metin kullanılıyor
          </summary>
          <div className="mt-2 flex flex-col gap-2.5">
            {(
              [
                ['Yarışmanın amacı', s.ozet.yarismaninAmaci],
                ['Teknik beklentiler', s.ozet.teknikBeklentiler],
                ['Katı kısıtlar — uyulmazsa tasarım geçersiz', s.ozet.katiKisitlar],
                ['Eleyici durumlar', s.ozet.eleyiciDurumlar],
                ['Hakem için notlar', s.ozet.hakemNotlari],
              ] as Array<[string, string[]]>
            )
              .filter(([, liste]) => liste?.length)
              .map(([baslik, liste]) => (
                <div key={baslik}>
                  <h5 className="mb-1 text-[10px] font-bold tracking-wide text-mavi-koyu">
                    {baslik.toLocaleUpperCase('tr')}
                  </h5>
                  <ul className="flex flex-col gap-0.5">
                    {liste.map((x, i) => (
                      <li key={i} className="text-[10.5px] leading-relaxed text-metin">
                        • {x}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        </details>
      )}

      {s?.catismalar.map((c, i) => (
        <p key={i} className="mb-1.5 text-[10.5px] leading-relaxed font-bold text-amber-koyu">
          ⚠ {c}
        </p>
      ))}
      {s?.uyarilar.map((u, i) => (
        <p key={i} className="mb-1 text-[10.5px] leading-relaxed font-medium text-amber-koyu">
          ⚠ {u}
        </p>
      ))}

      <div className="flex flex-wrap items-center gap-2.5">
        <input
          ref={girdiRef}
          type="file"
          accept=".pdf,.docx,application/pdf"
          className="hidden"
          onChange={(e) => {
            const d = e.target.files?.[0];
            if (d) void gonder(d);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          disabled={calisiyor}
          onClick={() => girdiRef.current?.click()}
          className="dugme border border-cizgi bg-white px-3.5 py-2 text-[12px] font-bold transition-colors hover:bg-zemin disabled:opacity-50"
        >
          {calisiyor ? 'Çözümleniyor…' : s ? 'Şartnameyi değiştir' : 'Şartname yükle'}
        </button>

        {/* Katalogdan gelen şartnamenin özeti dosya yüklemeden üretilebilir:
            kaynak URL kayıtlı. Bu düğme olmadan yönetici teknofest.org'dan
            indirip elle yüklemek zorunda kalıyordu. */}
        {s && !s.ozet && s.kaynakUrl && (
          <button
            type="button"
            disabled={calisiyor}
            onClick={kaynaktanOzetle}
            className="dugme bg-lacivert px-3.5 py-2 text-[12px] font-bold text-white transition-colors hover:bg-lacivert-2 disabled:opacity-50"
          >
            {calisiyor ? 'Özetleniyor…' : 'Kayıtlı şartnameden AI özeti üret'}
          </button>
        )}

        <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-metin-2">
          <input
            type="checkbox"
            checked={ozetle}
            onChange={(e) => setOzetle(e.target.checked)}
            className="size-3.5 accent-kirmizi"
          />
          AI özeti üret{' '}
          <span className="text-metin-3">(tek seferlik)</span>
        </label>
      </div>

      {hata && (
        <p className="mt-2 text-[11.5px] font-semibold text-kirmizi-koyu">{hata}</p>
      )}
      {bilgi && (
        <p className="mt-2 text-[11.5px] font-semibold text-yesil-koyu">{bilgi}</p>
      )}
    </div>
  );
}
