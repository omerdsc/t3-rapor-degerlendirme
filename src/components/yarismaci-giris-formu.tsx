'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

type Sekme = 'giris' | 'kayit';

/**
 * Yarışmacı giriş ve kayıt formu.
 *
 * ── İKİSİ TEK BİLEŞENDE ─────────────────────────────────────────────────
 * Ayrı sayfalara bölünse, kayıt olmaya çalışıp "zaten kayıtlısınız"
 * uyarısı alan kullanıcı başka bir adrese gidip formu baştan doldurmak
 * zorunda kalırdı. Sekme geçişinde e-posta korunuyor.
 */
export default function YarismaciGirisFormu({ ilkSekme = 'giris' }: { ilkSekme?: Sekme }) {
  const yonlendir = useRouter();
  const [sekme, setSekme] = useState<Sekme>(ilkSekme);
  const [eposta, setEposta] = useState('');
  const [parola, setParola] = useState('');
  const [adSoyad, setAdSoyad] = useState('');
  const [kurum, setKurum] = useState('');
  const [sehir, setSehir] = useState('');
  const [telefon, setTelefon] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);
  const [gidiyor, basla] = useTransition();

  const kayit = sekme === 'kayit';

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setHata(null);
    setCalisiyor(true);
    try {
      const yanit = await fetch('/api/yarismaci/giris', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          kayit
            ? { islem: 'kayit', eposta, parola, adSoyad, kurum, sehir, telefon }
            : { islem: 'giris', eposta, parola },
        ),
      });
      const veri = await yanit.json();
      if (!yanit.ok) {
        setHata(veri.hata ?? 'İşlem tamamlanamadı.');
        return;
      }
      basla(() => {
        yonlendir.push('/yarismaci');
        yonlendir.refresh();
      });
    } catch {
      setHata('Sunucuya ulaşılamadı. Bağlantınızı kontrol edin.');
    } finally {
      setCalisiyor(false);
    }
  }

  const bekliyor = calisiyor || gidiyor;
  const gecerli = kayit
    ? eposta.trim() && parola.length >= 8 && adSoyad.trim().length >= 3
    : eposta.trim() && parola;

  const girdi =
    'w-full rounded-lg border border-cizgi bg-white px-3.5 py-2.5 text-[13px] font-semibold outline-none focus:border-metin-3';
  const etiket = 'mb-1.5 block text-[11px] font-bold tracking-wide text-metin-2';

  return (
    <div className="rounded-xl border border-cizgi bg-white">
      <div className="flex border-b border-cizgi">
        {(['giris', 'kayit'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setSekme(s);
              setHata(null);
            }}
            className={`flex-1 cursor-pointer px-4 py-3 text-[13px] font-bold transition-colors ${
              sekme === s
                ? 'border-b-2 border-kirmizi text-kirmizi'
                : 'text-metin-2 hover:text-metin'
            }`}
          >
            {s === 'giris' ? 'Giriş yap' : 'Kayıt ol'}
          </button>
        ))}
      </div>

      <form onSubmit={gonder} className="p-5">
        {kayit && (
          <>
            <label className="mb-3 block">
              <span className={etiket}>AD SOYAD</span>
              <input
                value={adSoyad}
                onChange={(e) => setAdSoyad(e.target.value)}
                autoComplete="name"
                className={girdi}
              />
            </label>
            <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={etiket}>OKUL / KURUM</span>
                <input
                  value={kurum}
                  onChange={(e) => setKurum(e.target.value)}
                  autoComplete="organization"
                  className={girdi}
                />
              </label>
              <label className="block">
                <span className={etiket}>ŞEHİR</span>
                <input
                  value={sehir}
                  onChange={(e) => setSehir(e.target.value)}
                  autoComplete="address-level2"
                  className={girdi}
                />
              </label>
            </div>
          </>
        )}

        <label className="mb-3 block">
          <span className={etiket}>E-POSTA</span>
          <input
            type="email"
            value={eposta}
            onChange={(e) => setEposta(e.target.value)}
            autoComplete="email"
            spellCheck={false}
            className={girdi}
          />
        </label>

        <label className="mb-1 block">
          <span className={etiket}>PAROLA</span>
          <input
            type="password"
            value={parola}
            onChange={(e) => setParola(e.target.value)}
            autoComplete={kayit ? 'new-password' : 'current-password'}
            className={girdi}
          />
        </label>
        {kayit && (
          <p className="mb-3 text-[10.5px] font-medium text-metin-3">
            En az 8 karakter.
          </p>
        )}

        {kayit && (
          <label className="mt-2 mb-4 block">
            <span className={etiket}>TELEFON (İSTEĞE BAĞLI)</span>
            <input
              value={telefon}
              onChange={(e) => setTelefon(e.target.value)}
              autoComplete="tel"
              className={girdi}
            />
          </label>
        )}

        {hata && (
          <p
            role="alert"
            className="mt-3 mb-3 rounded-lg bg-kirmizi-zemin px-3.5 py-2.5 text-[12px] font-semibold text-kirmizi-koyu"
          >
            {hata}
          </p>
        )}

        <button
          type="submit"
          disabled={!gecerli || bekliyor}
          className="mt-2 w-full dugme bg-kirmizi px-5 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-kirmizi-koyu"
        >
          {bekliyor
            ? kayit ? 'Hesap açılıyor…' : 'Giriş yapılıyor…'
            : kayit ? 'Hesap oluştur' : 'Giriş yap'}
        </button>
      </form>
    </div>
  );
}
