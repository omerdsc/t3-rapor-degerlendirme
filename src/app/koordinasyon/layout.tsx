import KenarCubugu from '@/components/kenar-cubugu';
import { cevapBekleyenYazismalar } from '@/lib/depo/depo';
import { yetkiKurulu } from '@/lib/yetki/koordinasyon';

export default function PanelYerlesimi({ children }: LayoutProps<'/'>) {
  const acik = !yetkiKurulu();

  /*
   * Bekleyen hakem mesajları YERLEŞİMDE hesaplanıyor: kenar çubuğu her
   * koordinasyon ekranında çiziliyor, dolayısıyla bildirim de her ekranda
   * güncel. Sorgu tek ve indeksli; sayfa başına maliyeti ihmal edilebilir.
   */
  const bekleyenSorular = cevapBekleyenYazismalar();

  return (
    <div className="flex min-h-screen">
      <KenarCubugu yetkiKurulu={!acik} bekleyenSorular={bekleyenSorular} />
      <main className="min-w-0 flex-1 px-7 py-6">
        {/*
          YETKİ KURULU DEĞİLSE SÖYLE.
          `KOORDINASYON_ANAHTARI` tanımlı değilken panel herkese açık.
          Bunu gizlemek, kapalı sanılan bir kapı bırakmak olurdu; açık
          olduğu bilinen kapı daha güvenlidir. Şerit kapatılamıyor:
          kapatılabilir bir uyarı kapatılır ve unutulur.
        */}
        {acik && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber/30 bg-amber-zemin px-4 py-3">
            <svg viewBox="0 0 24 24" className="mt-px size-4 shrink-0 stroke-amber-koyu" fill="none" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4M12 17h.01" />
              <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            </svg>
            <p className="text-[11.5px] leading-relaxed font-medium text-amber-koyu">
              <strong className="font-bold">
                Kimlik doğrulama kurulu değil — bu panel herkese açık.
              </strong>{' '}
              Sunucuya erişebilen herkes hakem ekleyip silebilir, atama
              yapabilir, ücretli yapay zekâ çağrısı başlatabilir ve gerçek
              yarışmacı belgelerini indirebilir.{' '}
              <code className="rounded bg-white/60 px-1 font-mono font-semibold">
                KOORDINASYON_ANAHTARI
              </code>{' '}
              ortam değişkenini <code className="font-mono font-semibold">.env.local</code>{' '}
              içinde tanımlayıp sunucuyu yeniden başlatın.
            </p>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
