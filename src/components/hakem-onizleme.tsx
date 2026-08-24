'use client';

import { useState } from 'react';

/**
 * Hakem paneli önizlemesi — koordinasyonun destek aracı.
 *
 * ── NEDEN VAR, ROL AYRIMINI BOZMUYOR MU ─────────────────────────────────
 * Portallar arasında gezinme bağlantısı yok, bilinçli. Ama koordinasyonun
 * gerçek bir ihtiyacı var: hakem "raporu göremiyorum" ya da "ölçütler
 * yanlış görünüyor" dediğinde koordinasyon onun ekranını görmek zorunda.
 * Bunu göremezse tek yapabileceği hakemin anlatımına güvenmek olur.
 *
 * Bu bir arka kapı değil, DESTEK ARACI ve öyle etiketlenmiş: hangi hakemin
 * paneli açıldığı seçiliyor, yeni sekmede açılıyor, koordinasyon ekranı
 * yerinde kalıyor. Kurumsal kurulumda bu kontrol yetkiye bağlanır ve
 * açılışı denetim kaydına düşer.
 *
 * ── NEDEN AÇILIR LİSTE ──────────────────────────────────────────────────
 * Erişim bağlantısı hakem listesindeki satırlarda da var ama orada
 * KAYBOLUYORDU: kullanıcı koordinasyondan hakem tarafına nasıl geçeceğini
 * bulamadı. Aranan şey bir eylemse, eylem görünür olmalı.
 */
export default function HakemOnizleme({
  hakemler,
}: {
  hakemler: Array<{ kod: string; ad: string; kurum?: string; bekleyen: number }>;
}) {
  const [secili, setSecili] = useState(hakemler[0]?.kod ?? '');

  if (!hakemler.length) return null;

  const hakem = hakemler.find((h) => h.kod === secili);

  return (
    <div
      id="onizleme"
      className="mb-5 rounded-xl border border-cizgi bg-white px-4 py-3.5"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] font-bold">Hakem panelini önizle</h2>
          <p className="mt-1 text-[11px] leading-relaxed font-medium text-metin-2">
            Seçtiğiniz hakemin ekranını yeni sekmede açar — hakem
            &ldquo;raporu göremiyorum&rdquo; dediğinde onun gördüğünü
            görmek için. Bu ekrandan çıkmıyorsunuz.
          </p>
        </div>

        <label className="min-w-[220px] flex-1">
          <span className="mb-1 block text-[9.5px] font-bold tracking-wide text-metin-3">
            HANGİ HAKEM
          </span>
          <select
            value={secili}
            onChange={(e) => setSecili(e.target.value)}
            className="w-full cursor-pointer rounded-lg border border-cizgi bg-white px-3 py-2 text-[12.5px] font-semibold outline-none focus:border-metin-3"
          >
            {hakemler.map((h) => (
              <option key={h.kod} value={h.kod}>
                {h.ad}
                {h.kurum ? ` — ${h.kurum}` : ''}
                {h.bekleyen ? ` (${h.bekleyen} bekliyor)` : ' (bekleyen iş yok)'}
              </option>
            ))}
          </select>
        </label>

        {/*
          Gerçek bir bağlantı, düğme taklidi değil: kullanıcı orta tuşla ya
          da sağ tuşla da açabilsin. `target="_blank"` koordinasyon
          ekranını yerinde tutuyor.
        */}
        <a
          href={`/hakem/${secili}`}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-lg bg-lacivert px-4 py-2.5 text-[12.5px] font-bold text-white transition-colors hover:bg-lacivert-2"
        >
          Paneli aç ↗
        </a>
      </div>

      {hakem && (
        <p className="mt-2.5 rounded-md bg-zemin px-3 py-2 text-[10.5px] leading-relaxed font-medium text-metin-2">
          Hakemin kendi bağlantısı:{' '}
          <code className="font-mono font-bold text-metin">/hakem/{hakem.kod}</code>{' '}
          — bu adresi hakeme iletin. Panelde yalnızca ona atanmış raporlar
          görünür ve takım adları rumuzludur.
        </p>
      )}
    </div>
  );
}
