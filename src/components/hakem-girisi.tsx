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
/**
 * `koyu`: giriş ekranındaki lacivert kartın üzerinde duruyor. Aynı
 * bileşenin iki zeminde de okunabilmesi için renkler prop'a bağlı —
 * ikinci bir kopya çıkarmak, ileride kod normalleştirmesindeki bir
 * düzeltmenin yalnızca birine uğraması demek olurdu.
 */
export default function HakemGirisi({
  koyu = false,
  acilir = false,
}: {
  koyu?: boolean;
  /**
   * `acilir`: kutu kapalı başlıyor, önce "Giriş yap" düğmesi görünüyor.
   *
   * Giriş ekranında üç kart yan yana duruyor ve ikisi tek bir düğme
   * gösteriyordu; ortadaki ise açık bir form, etiketi ve açıklama satırıyla
   * birlikte. Üç eş seçenekten biri ötekilerden iki kat yüksekti ve
   * "burada fazladan bir iş var" izlenimi veriyordu — oysa hakemin işi de
   * tek tık. Kutu artık düğmeye basılınca açılıyor.
   */
  acilir?: boolean;
}) {
  const yonlendir = useRouter();
  const [kod, setKod] = useState('');
  const [acik, setAcik] = useState(!acilir);
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

  if (!acik) {
    return (
      <button
        type="button"
        onClick={() => setAcik(true)}
        className="group/kod mt-auto flex cursor-pointer items-center gap-1.5 pt-4 text-[14px] font-bold text-kirmizi"
      >
        Giriş yap
        <span className="transition-transform duration-200 group-hover/kod:translate-x-1">
          →
        </span>
      </button>
    );
  }

  return (
    <div className={`mt-3 rounded-lg px-3 py-2.5 ${koyu ? 'bg-white/[0.06]' : 'bg-zemin'}`}>
      <label className={`mb-1.5 block text-[9.5px] font-bold tracking-wide ${koyu ? 'text-white/55' : 'text-metin-2'}`}>
        ERİŞİM KODUNUZ
      </label>
      <div className="flex gap-2">
        <input
          value={kod}
          onChange={(e) => setKod(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && gir()}
          /* Açılır kipte odak doğrudan alana geliyor: düğmeye basan
             kullanıcı bir de alana tıklamak zorunda kalmasın. */
          autoFocus={acilir}
          // Yer tutucu biçimi anlatır, GERÇEK KOD VERMEZ: gerçek bir
          // hakem kodu burada, giriş sayfasında duran kullanılabilir bir
          // kimlik bilgisi olurdu.
          placeholder="XXXX-XXXX"
          spellCheck={false}
          autoComplete="off"
          className={`min-w-0 flex-1 rounded-md border px-3 py-2 font-mono text-[13px] font-bold tracking-widest uppercase outline-none ${
            koyu
              ? 'border-white/15 bg-white/[0.07] text-white placeholder:text-white/25 focus:border-kirmizi'
              : 'border-cizgi bg-white focus:border-metin-3'
          }`}
        />
        <button
          type="button"
          disabled={temiz.length < 8 || gidiyor}
          onClick={gir}
          className={`shrink-0 cursor-pointer rounded-md px-4 py-2 text-[12px] font-bold text-white transition-colors disabled:opacity-45 ${
            koyu ? 'bg-kirmizi hover:bg-kirmizi-koyu' : 'bg-lacivert hover:bg-lacivert-2'
          }`}
        >
          {gidiyor ? 'Açılıyor…' : 'Panele gir'}
        </button>
      </div>
      <p className={`mt-1.5 text-[10px] leading-relaxed font-medium ${koyu ? 'text-white/40' : 'text-metin-3'}`}>
        8 karakter. Tireyi yazmanız gerekmiyor, küçük harf de olur. Kod
        koordinasyon tarafından size iletilir.
      </p>
    </div>
  );
}
