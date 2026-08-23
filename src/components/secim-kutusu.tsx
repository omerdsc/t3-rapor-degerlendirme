'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

/**
 * Açılır seçim kutusu — yarışma ve kategori seçimi için.
 *
 * ÖNCEKİ TASARIMIN SORUNU
 * Yarışmalar yatay çip listesi olarak basılıyordu. İki yarışmayla iyi
 * çalışıyordu; katalogdan 43 yarışma kurulduktan sonra ekranın yarısını
 * kapladı ve seçim yapmak imkânsızlaştı. Çip listesi az sayıda seçenek için
 * doğru bir kalıp — sayı büyüdüğünde açılır liste gerekiyor.
 *
 * NEDEN NATIVE <select>
 * Kendi açılır menümüzü yazmak yerine tarayıcının kendi kontrolü
 * kullanılıyor: klavyeyle gezinir, yazarak arama yapar, telefonda kendi
 * arayüzünü açar ve ekran okuyucularla sorunsuz çalışır. Elle yazılmış bir
 * menüde bunların hepsini yeniden kurmak gerekir.
 */

export interface Secenek {
  deger: string;
  etiket: string;
  /** Sağda gösterilen sayaç — "12 rapor" gibi. */
  ek?: string;
  /**
   * Seçildiğinde gidilecek adres.
   *
   * NEDEN HER SEÇENEKTE ADRES VAR, TEK BİR ÜRETİCİ FONKSİYON YOK
   * İlk sürüm `adresKur: (deger) => string` alıyordu. Bu bileşen bir İSTEMCİ
   * bileşeni ve sunucu bileşeninden çağrılıyor; React sunucu–istemci
   * sınırından fonksiyon geçirilemez, sayfa 500 döner. Adresi veriye
   * gömmek sınırı fonksiyonsuz geçmenin doğru yolu.
   */
  adres: string;
  /**
   * Seçeneğin grubu — "Raporu olanlar" gibi.
   *
   * 43 yarışmanın 41'inde rapor yok ve kullanıcı aradığını bulmak için
   * hepsinin arasından geçiyor. Gruplama tarayıcının kendi <optgroup>
   * kontrolüyle yapılıyor: ayrı bir arama kutusu yazmaya gerek kalmıyor,
   * klavye ve ekran okuyucu desteği kendiliğinden geliyor.
   */
  grup?: string;
}

export default function SecimKutusu({
  etiket,
  secenekler,
  secili,
  bosEtiket,
}: {
  etiket: string;
  secenekler: Secenek[];
  secili?: string;
  /** Hiçbir şey seçilmemişken gösterilecek metin. */
  bosEtiket?: string;
}) {
  const yonlendir = useRouter();

  /*
   * useTransition, elle tutulan bir "gidiyor" bayrağının YERİNE.
   *
   * İlk sürüm `useState` ile bayrağı true yapıp bir daha false'a
   * döndürmüyordu. Aynı adreste yalnızca arama parametresi değiştiği için
   * bileşen yeniden kurulmuyor ve bayrak true kalıyordu: kutu ilk seçimden
   * sonra sonsuza kadar devre dışı kalıyor, ikinci seçim yapılamıyordu.
   *
   * useTransition'ın `bekliyor` değeri gezinme tamamlanınca kendiliğinden
   * false'a döner — sıfırlamayı elle yapmak gerekmiyor, dolayısıyla
   * unutulamıyor.
   */
  const [bekliyor, gecisBaslat] = useTransition();

  // Grup sırası, seçeneklerin geliş sırasıyla aynı kalıyor: çağıran taraf
  // hangi grubun önce geleceğine karar verir.
  const gruplar: Array<[string, Secenek[]]> = [];
  for (const s of secenekler) {
    if (!s.grup) continue;
    const mevcut = gruplar.find(([ad]) => ad === s.grup);
    if (mevcut) mevcut[1].push(s);
    else gruplar.push([s.grup, [s]]);
  }

  // Tek seçenek varsa açılır liste anlamsız; düz metin gösteriliyor.
  if (secenekler.length <= 1) {
    const tek = secenekler[0];
    if (!tek) return null;
    return (
      <div>
        <span className="mb-1 block text-[10px] font-bold tracking-wide text-metin-3">
          {etiket.toLocaleUpperCase('tr')}
        </span>
        <span className="block truncate text-[12.5px] font-semibold">
          {tek.etiket}
          {tek.ek && <span className="ml-1.5 font-medium text-metin-2">{tek.ek}</span>}
        </span>
      </div>
    );
  }

  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[10px] font-bold tracking-wide text-metin-3">
        {etiket.toLocaleUpperCase('tr')}
      </span>
      {/*
        Geçiş sırasında kutu KİLİTLENMİYOR, yalnızca soluklaşıyor.

        Kullanıcının aktif olarak kullandığı kontrolü devre dışı bırakmak
        bozuk hissettiriyor: fikrini değiştirip hemen başka bir seçenek
        seçmek isteyen kişi engelleniyor. Gezinme zaten idempotent; son
        seçim kazanır.
      */}
      <select
        value={secili ?? ''}
        onChange={(e) => {
          const hedef = secenekler.find((x) => x.deger === e.target.value);
          if (!hedef) return;
          gecisBaslat(() => yonlendir.push(hedef.adres));
        }}
        className={`w-full cursor-pointer rounded-lg border border-cizgi bg-white px-3 py-2 text-[12.5px] font-semibold outline-none transition-[border-color,opacity] hover:border-metin-3 focus:border-metin-3 ${
          bekliyor ? 'opacity-60' : ''
        }`}
      >
        {bosEtiket && !secili && <option value="">{bosEtiket}</option>}

        {/* Grup verilmemişse düz liste; verilmişse grup sırası korunuyor. */}
        {gruplar.length === 0
          ? secenekler.map((s) => (
              <option key={s.deger} value={s.deger}>
                {`${s.etiket}${s.ek ? ` — ${s.ek}` : ''}`}
              </option>
            ))
          : gruplar.map(([grupAdi, oge]) => (
              <optgroup key={grupAdi} label={grupAdi}>
                {oge.map((s) => (
                  <option key={s.deger} value={s.deger}>
                    {`${s.etiket}${s.ek ? ` — ${s.ek}` : ''}`}
                  </option>
                ))}
              </optgroup>
            ))}
      </select>
    </label>
  );
}
