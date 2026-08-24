'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { kodNormal } from '@/lib/db/kod';

/**
 * Hakem giriş kutusu — erişim koduyla panele giriş.
 *
 * ── NEDEN VAR ───────────────────────────────────────────────────────────
 * Önce hakem panelinin tek kapısı koordinasyondaki "kodu kopyala"
 * düğmesiydi. Yani hakem, kendisine gönderilmiş kodu elinde tutsa bile
 * giriş sayfasından İÇERİ GİREMİYORDU — adres çubuğuna elle yazması
 * gerekiyordu. Bir kullanıcının adres çubuğuna yol yazmak zorunda kalması
 * arayüzün eksik olduğunun işaretidir.
 *
 * ── KOD NEDEN DOĞRULANMIYOR ─────────────────────────────────────────────
 * Kod burada sunucuya sorulmuyor; doğrudan `/hakem/<kod>` adresine
 * gidiliyor. Geçersiz kod o sayfada 404 alıyor. Ayrı bir doğrulama
 * çağrısı eklemek "bu kod var" / "bu kod yok" bilgisini kimliksiz bir
 * uca açardı — kod deneyerek geçerli hakem kodu bulmayı kolaylaştırır.
 */
export default function HakemGirisi() {
  const yonlendir = useRouter();
  const [kod, setKod] = useState('');
  const [gidiyor, basla] = useTransition();

  /*
   * Girdi normalleştiriliyor ve sunucu da AYNI normalleştirmeyi yapıyor.
   *
   * Bu satır bir kez kendi başına hataydı: tireyi atıyor, sunucu ise tam
   * eşitlik arıyordu — kodunu doğru yazan hakem 404 alıyordu. Artık
   * normalleştirme `kod.ts` içinde tek yerde ve iki taraf onu çağırıyor.
   */
  const temiz = kodNormal(kod);

  function gir() {
    if (temiz.length < 8) return;
    basla(() => yonlendir.push(`/hakem/${temiz}`));
  }

  return (
    <div className="mt-3 rounded-lg bg-zemin px-3 py-2.5">
      <label className="mb-1.5 block text-[9.5px] font-bold tracking-wide text-metin-2">
        ERİŞİM KODUNUZ
      </label>
      <div className="flex gap-2">
        <input
          value={kod}
          onChange={(e) => setKod(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && gir()}
          // Yer tutucu biçimi anlatır, GERÇEK KOD VERMEZ: gerçek bir
          // hakem kodu burada, giriş sayfasında duran kullanılabilir bir
          // kimlik bilgisi olurdu.
          placeholder="XXXX-XXXX"
          spellCheck={false}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-md border border-cizgi bg-white px-3 py-2 font-mono text-[13px] font-bold tracking-widest uppercase outline-none focus:border-metin-3"
        />
        <button
          type="button"
          disabled={temiz.length < 8 || gidiyor}
          onClick={gir}
          className="shrink-0 cursor-pointer rounded-md bg-lacivert px-4 py-2 text-[12px] font-bold text-white transition-colors hover:bg-lacivert-2 disabled:opacity-40"
        >
          {gidiyor ? 'Açılıyor…' : 'Panele gir'}
        </button>
      </div>
      <p className="mt-1.5 text-[10px] leading-relaxed font-medium text-metin-3">
        8 karakter. Tireyi yazmanız gerekmiyor, küçük harf de olur. Kod
        koordinasyon tarafından size iletilir.
      </p>
    </div>
  );
}
