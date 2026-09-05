import KenarCubugu from '@/components/kenar-cubugu';
import MesajCekmecesi from '@/components/mesaj-cekmecesi';
import { bekleyenKonusmaSayisi } from '@/lib/db/gelen-kutusu';
import { yetkiKurulu } from '@/lib/yetki/koordinasyon';

/**
 * Koordinasyon yerleşimi — kenar çubuğu + üst şerit.
 *
 * ── ÜST ŞERİT NİYE VAR ──────────────────────────────────────────────────
 * Tek amacı mesaj simgesini SAĞ ÜST KÖŞEDE tutmak. Simge önce kenar
 * çubuğundaydı ve orada bir menü maddesi gibi okunuyordu — oysa bir sayfa
 * değil, bir katman açıyor. Sağ üst köşe bildirimin beklendiği yer;
 * kullanıcı oraya bakmayı zaten biliyor.
 *
 * Şerit başka hiçbir şey taşımıyor: sayfa başlıkları kendi içeriklerinde
 * ve oraya bir kez daha yazmak dikey alanı iki kez harcamak olurdu.
 */
export default function PanelYerlesimi({ children }: LayoutProps<'/'>) {
  /*
   * Bekleyen konuşma sayısı YERLEŞİMDE hesaplanıyor: şerit her
   * koordinasyon ekranında çiziliyor, dolayısıyla rozet de her ekranda
   * güncel.
   *
   * SEZONA GÖRE SÜZÜLMÜYOR — bilerek. Pano sezona göre süzülüyor ama
   * mesaj rozeti bir hatırlatıcı, bir rapor değil: koordinasyon arşiv
   * sezonuna baktığı sırada bu yılın cevapsız sorusu unutulmamalı.
   */
  const bekleyenMesaj = bekleyenKonusmaSayisi();

  return (
    <div className="flex min-h-screen">
      <KenarCubugu yetkiKurulu={yetkiKurulu()} />

      {/*
        SİMGE KÖŞEDE, ŞERİT YOK.
        Önce üstte 52 piksellik beyaz bir şerit vardı ve içinde tek bir
        düğme duruyordu: bir düğme için kurulmuş bir bar. Şerit kalktı,
        simge sayfanın sağ üst köşesinde duruyor — `sticky` olduğu için
        aşağı kaydırınca da orada kalıyor.

        Simge HER SAYFADA: hakemin sorusu koordinasyon hangi ekranda
        çalışıyorsa o sırada geliyor. Yalnızca panoda olsaydı mesajı
        görmek için panoya gitmek, yani mesaj olduğunu önceden bilmek
        gerekirdi — ulaşmayan bildirim bildirim değildir.
      */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/*
          ŞERİT SAYDAM: kendi yerini koruyor ama görünmüyor.

          Önce beyaz ve çerçeveliydi — tek düğme için kurulmuş bir bar gibi
          duruyordu. Sonra tamamen kaldırılıp simge içeriğin ÜSTÜNE
          bindirildi ve bu sefer sayfa başlığındaki sezon seçicisini
          kapattı. Sayfa zemininde, çerçevesiz bir satır ikisini de çözüyor:
          göz bir bar görmüyor, içerik de simgenin altına girmiyor.
        */}
        <div className="flex shrink-0 justify-end px-7 pt-5 pb-1">
          <MesajCekmecesi baslangicBekleyen={bekleyenMesaj} />
        </div>
        <main className="min-w-0 flex-1 px-7 pt-1 pb-8">{children}</main>
      </div>
    </div>
  );
}
