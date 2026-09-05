import Link from 'next/link';
import HakemGirisi from '@/components/hakem-girisi';
import YildizAlani from '@/components/yildiz-alani';
import { katalogOku } from '@/lib/katalog/depo';
import { yarismalariListele } from '@/lib/depo/depo';

export const dynamic = 'force-dynamic';

/**
 * Giriş — üç portalın kapısı.
 *
 * ── NEDEN ÜÇ AYRI PORTAL ────────────────────────────────────────────────
 * Önce her şey tek kenar çubuğunun altındaydı: koordinasyon ekranları,
 * hakem paneli bağlantısı ve yarışmacı portalı aynı menüde. Çalışıyordu
 * ama yanlış bir şey söylüyordu — üç ayrı İZLEYİCİ aynı uygulamanın
 * kullanıcısı gibi görünüyordu.
 *
 * Rol ayrımı menüyle değil ERİŞİMLE yapılıyor: koordinasyon kendi
 * anahtarıyla, hakem kendi erişim koduyla, yarışmacı kendi hesabıyla
 * giriyor. Her portalın kendi düzeni, kendi başlığı var ve aralarında
 * gezinme bağlantısı YOK.
 *
 * ── TASARIM ─────────────────────────────────────────────────────────────
 * Ekran bir açılış sayfası gibi değil, bir form listesi gibi duruyordu:
 * gri zemin üstünde alt alta üç beyaz kutu. Oysa bu sayfa ürünün İLK
 * gördüğü yer ve üç ayrı kitleye aynı anda "burası senin kapın" demek
 * zorunda.
 *
 * Zemin gece laciverdi, üstünde canvas ile yıldız alanı ve çok sönük bir
 * radar süpürmesi var — havacılık ve uzay yarışmalarının kendi görsel
 * dili. Üç kapı yan yana: alt alta dizilmiş üç kutu, hangisinin kime ait
 * olduğunu okumadan anlatmıyordu; yan yana duran üç sütun bir seçim
 * olduğunu bir bakışta söylüyor.
 *
 * Renk tek yerde harcanıyor: kırmızı yalnızca eylemde (gir düğmesi,
 * radar, birincil kartın çerçevesi). Her kartı kendi rengine boyamak
 * üçünü de eşit derecede acil gösterirdi.
 */

interface Kapi {
  yol: string | null;
  ad: string;
  rol: string;
  aciklama: string;
  eylem: string;
  simge: React.ReactNode;
  birincil?: boolean;
  kodGirisi?: boolean;
}

/* Simgeler satır içi: tek kullanımlık üç ikon için paket bağımlılığı olmaz. */
const CIZGI = {
  fill: 'none' as const,
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export default function GirisSayfasi() {
  const yarismalar = yarismalariListele();
  /*
   * TEKNOFEST'İN GERÇEK YARIŞMA SAYISI KATALOGTAN GELİYOR.
   *
   * Hero'da "44 yarışma kurulu" yazıyordu; bu, SİSTEMDE kurulu olanların
   * sayısıydı, TEKNOFEST'in yarışma sayısı değil. Giriş ekranını ilk
   * açan kişi için bu sayı sistemin ölçeğini anlatıyor — kurulum
   * ilerlemesini değil. Katalog teknofest.org'dan çekiliyor; yoksa kurulu
   * sayıya düşüyor, uydurma bir sayı göstermiyor.
   */
  const katalog = katalogOku();
  const teknofestYarisma = katalog?.yarismalar?.length ?? yarismalar.length;
  /*
   * AÇIK SAYFA ARTIK İŞLETİM VERİSİ OKUMUYOR.
   *
   * Kartlarda "8 hakem · 4 değerlendirme bekliyor · 15 rapor" yazıyordu ve
   * bunun için sayfa her açılışında hakem yüklerini, başvuruları ve pano
   * özetini sorguluyordu. Kimliğini doğrulamamış bir ziyaretçiye kurumun
   * kaç hakemi olduğunu söylemenin gerekçesi yok; sorgular da onunla
   * birlikte gitti. Geriye yalnızca katalog sayısı kaldı — o zaten
   * teknofest.org'da herkese açık bir bilgi.
   */

  const kapilar: Kapi[] = [
    {
      yol: '/yarismaci',
      ad: 'Yarışmacı',
      rol: 'Başvuru sahibi',
      aciklama:
        'Takımını kurar, yarışmaya başvurur, raporunu yükler ve sürecin '
        + 'hangi adımda olduğunu izler. Sonuç ve gelişim geri bildirimi '
        + 'burada yayımlanır.',
      eylem: 'Giriş yap',
      simge: (
        <svg viewBox="0 0 24 24" className="size-[22px] stroke-current" {...CIZGI}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M19 8v6M22 11h-6" />
        </svg>
      ),
    },
    {
      yol: null,
      ad: 'Hakem',
      rol: 'Değerlendirici',
      aciklama:
        'Erişim koduyla girer ve YALNIZCA kendisine atanmış raporları görür. '
        + 'Takım adları rumuzlu, puanlama kör yapılır.',
      eylem: 'Panele gir',
      kodGirisi: true,
      simge: (
        <svg viewBox="0 0 24 24" className="size-[22px] stroke-current" {...CIZGI}>
          <path d="M12 3 4 6v6c0 4.4 3.4 8.3 8 9 4.6-.7 8-4.6 8-9V6l-8-3Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      ),
    },
    {
      yol: '/koordinasyon',
      ad: 'Koordinasyon',
      rol: 'Yarışmalar Koordinatörlüğü',
      aciklama:
        'Yarışmaları kurar, değerlendirme ölçütlerini onaylar, raporları '
        + 'hakemlere dağıtır, kopya şüphelerini inceler ve sonuçları dışa '
        + 'aktarır.',
      eylem: 'Panele gir',
      birincil: true,
      simge: (
        <svg viewBox="0 0 24 24" className="size-[22px] stroke-current" {...CIZGI}>
          <path d="M3 3v18h18" />
          <path d="M7 15V9M12 15V5M17 15v-3" />
        </svg>
      ),
    },
  ];

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#0b1220]">
      <YildizAlani />

      {/*
        İKİ KATMAN GRADYAN.
        Alttaki, sayfanın altına doğru koyulaşarak kartların oturduğu bir
        zemin veriyor; üstteki sol üstten gelen çok hafif bir aydınlanma.
        Düz tek renk zeminde canvas noktaları "üstüne serpilmiş" gibi
        duruyordu; gradyan onları bir derinliğin içine yerleştiriyor.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_15%_0%,rgba(37,99,168,0.13),transparent_55%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-[linear-gradient(to_top,#0b1220_25%,transparent)]"
      />

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-6xl flex-col px-6 py-8 sm:px-8">
        {/* ------------------------------------------------------ başlık */}
        <header className="flex items-center gap-3">
          <span className="flex size-[38px] shrink-0 items-center justify-center rounded-xl bg-kirmizi shadow-[0_0_22px_-4px_rgba(212,32,39,0.7)]">
            <svg viewBox="0 0 24 24" className="size-[21px] stroke-white" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </span>
          <div className="min-w-0">
            <h1 className="text-[19px] leading-none font-extrabold tracking-tight text-white">
              TPRDS
            </h1>
            <p className="mt-1 text-[9.5px] leading-none font-semibold tracking-[0.14em] text-white/45">
              TEKNOFEST PROJE RAPORLARI DEĞERLENDİRME SİSTEMİ
            </p>
          </div>
        </header>

        {/* -------------------------------------------------------- hero */}
        <section className="flex flex-1 flex-col justify-center py-12 sm:py-16">
          <p className="belir mb-4 flex w-fit items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[10px] font-bold tracking-[0.12em] text-white/60">
            <span className="size-1.5 rounded-full bg-kirmizi" />
            TEKNOFEST 2026
            <span className="text-white/25">/</span>
            <span className="text-white/45">{teknofestYarisma} YARIŞMA</span>
          </p>

          <h2
            style={{ '--sira': 1 } as React.CSSProperties}
            className="belir max-w-[19ch] text-[38px] leading-[1.05] font-extrabold tracking-tight text-balance text-white sm:text-[52px]"
          >
            Rapor değerlendirmesi,{' '}
            <span className="text-kirmizi">baştan sona tek yerde.</span>
          </h2>

          <p
            style={{ '--sira': 2 } as React.CSSProperties}
            className="belir mt-5 max-w-[62ch] text-[14px] leading-relaxed font-medium text-white/60"
          >
            Yarışmacı raporunu yükler, sistem biçim ve kaynak kontrollerini
            yapar, kopya şüphelerini çıkarır ve hakeme ön inceleme sunar.
            Puanı hakem verir.
          </p>

          {/*
            İŞLETİM SAYAÇLARI BURADA DEĞİL.

            Burada "15 rapor işlendi · 8 aktif hakem · 8 sonuç yayımlandı"
            yazıyordu. İki ayrı sorun: giriş sayfası HERKESE AÇIK ve bu
            sayılar kurumun işleyişine dair bilgi — kaç hakemi var, kaç rapor
            değerlendirilmiş — kimliğini doğrulamamış bir ziyaretçinin
            görmesi gereken şeyler değil. İkincisi, sayfayı açan kişinin
            sorusuna cevap vermiyorlar: o kişi "hangi kapı benim" diye
            bakıyor, "kaç rapor işlenmiş" diye değil.

            Yerine sistemin NE YAPTIĞI geliyor. Bunların hepsi üründe
            çalışan yetenekler; bir vaat listesi değil.
          */}
          <ul
            style={{ '--sira': 3 } as React.CSSProperties}
            className="belir mt-9 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11.5px] font-semibold text-white/45"
          >
            {[
              'Biçim ve şablon kontrolü',
              'Kaynakça doğrulama',
              'Kopya tespiti',
              'Kör değerlendirme',
            ].map((y, i) => (
              <li key={y} className="flex items-center gap-3">
                {i > 0 && <span aria-hidden="true" className="size-1 rounded-full bg-white/20" />}
                {y}
              </li>
            ))}
          </ul>
        </section>

        {/* ------------------------------------------------------ kapılar */}
        <section>
          <div className="mb-3 flex items-baseline gap-3">
            <h3 className="text-[12px] font-bold tracking-[0.1em] text-white/70">
              GİRİŞ
            </h3>
          </div>

          {/* Yan yana üç sütun; dar ekranda alt alta iniyor. */}
          <div className="grid gap-3.5 md:grid-cols-3">
            {kapilar.map((k, i) => {
              const govde = (
                <>
                  <div className="flex items-start gap-3">
                    <span
                      className={`flex size-[38px] shrink-0 items-center justify-center rounded-xl transition-colors ${
                        k.birincil
                          ? 'bg-kirmizi/12 text-kirmizi'
                          : 'bg-white/[0.06] text-white/70'
                      }`}
                    >
                      {k.simge}
                    </span>
                    <div className="min-w-0">
                      <h4 className="text-[16px] leading-tight font-extrabold tracking-tight text-white">
                        {k.ad}
                      </h4>
                      <p className="mt-0.5 text-[9.5px] font-bold tracking-wide text-white/40">
                        {k.rol.toLocaleUpperCase('tr')}
                      </p>
                    </div>
                  </div>

                  <p className="mt-3.5 text-[12px] leading-relaxed font-medium text-white/55">
                    {k.aciklama}
                  </p>


                  {k.kodGirisi ? (
                    <HakemGirisi koyu acilir />
                  ) : (
                    /*
                      Eylem satırı kartın ALTINA yapışıyor: üç kartın metni
                      farklı uzunlukta ve düğmeler farklı yüksekliklerde
                      dursaydı sütunlar hizasız görünürdü.
                    */
                    <span className="mt-auto flex items-center gap-1.5 pt-4 text-[14px] font-bold text-kirmizi">
                      {k.eylem}
                      <span className="transition-transform duration-200 group-hover:translate-x-1">
                        →
                      </span>
                    </span>
                  )}
                </>
              );

              const ortak =
                'belir group flex min-h-full flex-col rounded-2xl border px-5 py-5 backdrop-blur-sm transition-all duration-200';
              const renk = k.birincil
                ? 'border-kirmizi/35 bg-kirmizi/[0.045]'
                : 'border-white/10 bg-white/[0.035]';

              return k.yol ? (
                <Link
                  key={k.ad}
                  href={k.yol}
                  style={{ '--sira': 4 + i } as React.CSSProperties}
                  className={`${ortak} ${renk} hover:-translate-y-0.5 hover:border-kirmizi/55 hover:bg-white/[0.07]`}
                >
                  {govde}
                </Link>
              ) : (
                <div
                  key={k.ad}
                  style={{ '--sira': 4 + i } as React.CSSProperties}
                  className={`${ortak} ${renk}`}
                >
                  {govde}
                </div>
              );
            })}
          </div>
        </section>

        <footer className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/[0.07] pt-5 text-[10.5px] font-medium text-white/30">
          <span>TPRDS · TEKNOFEST Yarışmalar Koordinatörlüğü için geliştirildi</span>
          <span className="ml-auto">TecHane</span>
        </footer>
      </div>
    </div>
  );
}
