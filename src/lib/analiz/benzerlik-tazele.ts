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
 */

import { benzerlikKontrolu, korpusTara, type Parmakizi } from './benzerlik';
import { parmakiziCoz } from './parmakizi-depo';
import { raporGuncelle, raporlariListele } from '../depo/depo';
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
  const raporlar = raporlariListele(yarismaId, kategoriId);
  const parmakizliler = raporlar.filter((r) => r.parmakizi);

  if (parmakizliler.length < 2) {
    return {
      taranan: parmakizliler.length,
      parmakizsiz: raporlar.length - parmakizliler.length,
      guncellenen: 0,
      isaretliCift: 0,
    };
  }

  const izler: Parmakizi[] = parmakizliler.map((r) => parmakiziCoz(r.parmakizi!));
  const korpus = korpusTara(izler);

  const adlar = new Map(
    raporlar.map((r) => {
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
    parmakizsiz: raporlar.length - parmakizliler.length,
    guncellenen,
    isaretliCift: korpus.isaretliler.length,
  };
}
