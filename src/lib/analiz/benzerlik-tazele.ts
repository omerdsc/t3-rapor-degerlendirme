/**
 * Kategorinin benzerlik bulgularını tazeler.
 *
 * NEDEN YÜKLEMEDE TEK RAPOR YETMİYOR
 * Öteki kontroller (şablon, kaynakça, kategori) tek raporun kendi içine
 * bakıyor; yükleme anında bir kez koşup bitiyorlar. Benzerlik ise KORPUSA
 * bağlı ve bu onu farklı kılıyor:
 *
 *   1. rapor yüklenir  → korpusta 1 rapor, karşılaştırma yok, bulgu yok
 *   2. ikinci yüklenir → yeni raporun bulgusu çıkar
 *   3. ama BİRİNCİ raporun bulgusu da değişti — kimse tazelemezse
 *      birinci rapor "temiz" olarak kalır ve kopya sessizce kaçar
 *
 * Bu yüzden her yüklemede KATEGORİNİN TAMAMI tazeleniyor. Maliyeti $0 ve
 * yerel; 100 raporlu kategoride 4.950 çift saniyeler sürüyor.
 *
 * MASKELEME
 * Bulgu metinlerinde ham kimlik ("64e55f97-…") değil maskeli rumuz
 * ("Takım 8EM8 R-WKT4") yazıyor. Hakem bulguyu okuduğunda hangi raporun
 * kastedildiğini anlamalı ama gerçek takım adını görmemeli.
 *
 * ── ÖLÇÜLMÜŞ HATA: TARAMA HİÇ ÇALIŞMIYORDU ──────────────────────────────
 * Bu fonksiyon raporları `raporlariListele()` ile çekiyordu. O fonksiyon
 * LİSTE GÖRÜNÜMÜ ve parmak izlerini BİLEREK okumuyor — rapor başına
 * ~40 KB, listede taşınması anlamsız (kendi kodunda yazılı). Sonuç:
 * `r.parmakizi` her zaman `undefined` geliyor, her rapor "parmakizsiz"
 * sayılıyor ve fonksiyon iki iz bulamadığı için ERKEN DÖNÜYORDU.
 *
 * Yani her yüklemeden sonra koşan otomatik kopya taraması hiçbir zaman
 * hiçbir şey taramadı. Hata sessizdi: fonksiyon başarıyla dönüyor,
 * "0 çift" diyor ve bu "kopya yok" gibi okunuyordu. Kopya bulgusu
 * yalnızca kopya ekranından ELLE tarama koşturulduğunda çıkıyordu —
 * çünkü o yol `parmakizliRaporlar()` kullanıyor.
 *
 * Örnek kopya verisi kurulurken yakalandı: iki birbirinin kopyası rapor
 * kaydedildi, veritabanında parmak izleri duruyordu, tarama "4 izsiz"
 * dedi.
 */

import { benzerlikKontrolu, korpusTara, type Parmakizi } from './benzerlik';
import { parmakiziCoz } from './parmakizi-depo';
import { parmakizliRaporlar, raporGuncelle, raporSayilari } from '../depo/depo';
import { raporuMaskele } from '../depo/maskele';

export interface TazelemeSonucu {
  taranan: number;
  parmakizsiz: number;
  guncellenen: number;
  isaretliCift: number;
}

export async function benzerlikTazele(
  yarismaId: string,
  kategoriId: string,
): Promise<TazelemeSonucu> {
  /*
   * `parmakizliRaporlar` — parmak izini GERÇEKTEN okuyan sorgu.
   * Toplam sayı ayrı ve ucuz bir sayaçtan geliyor; "kaç rapor izsiz"
   * sorusunu cevaplamak için bütün raporları nesneye çevirmek gereksiz.
   */
  const parmakizliler = parmakizliRaporlar(yarismaId, kategoriId).map((x) => x.rapor);
  const toplamRapor = raporSayilari().kategoriye.get(kategoriId) ?? parmakizliler.length;

  if (parmakizliler.length < 2) {
    return {
      taranan: parmakizliler.length,
      parmakizsiz: Math.max(0, toplamRapor - parmakizliler.length),
      guncellenen: 0,
      isaretliCift: 0,
    };
  }

  const izler: Parmakizi[] = parmakizliler.map((r) => parmakiziCoz(r.parmakizi!));
  const korpus = korpusTara(izler);

  const adlar = new Map(
    parmakizliler.map((r) => {
      const m = raporuMaskele(r);
      return [r.id, `${m.takim} ${m.raporKodu}`];
    }),
  );

  let guncellenen = 0;
  for (const rapor of parmakizliler) {
    const kontrol = benzerlikKontrolu(
      rapor.id,
      korpus,
      (id) => adlar.get(id) ?? id,
    );

    const eski = rapor.kontroller.find((k) => k.kod === kontrol.kod);
    // Değişmemişse yazma: gereksiz disk yazımı ve yazma kuyruğu yükü.
    if (
      eski &&
      eski.durum === kontrol.durum &&
      eski.bulgular.length === kontrol.bulgular.length &&
      eski.ozet === kontrol.ozet
    ) {
      continue;
    }

    await raporGuncelle(rapor.id, {
      kontroller: [...rapor.kontroller.filter((k) => k.kod !== kontrol.kod), kontrol],
    });
    guncellenen++;
  }

  return {
    taranan: parmakizliler.length,
    parmakizsiz: Math.max(0, toplamRapor - parmakizliler.length),
    guncellenen,
    isaretliCift: korpus.isaretliler.length,
  };
}
