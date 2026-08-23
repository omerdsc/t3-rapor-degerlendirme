/**
 * Rapor arama.
 *
 * NEREDE ARANIYOR
 * Başvuru numarası, takım adı, takım ID, proje adı — hem başvuruda GİRİLEN
 * hem rapor KAPAĞINDAN okunan değerler. İkisi ayrı alanlarda duruyor ve
 * koordinasyon hangisini hatırlıyorsa onunla arayabilmeli.
 *
 * NEDEN SUNUCUDA
 * Arama, ekranda MASKELİ görünen değerler üzerinde çalışıyor. İstemciye
 * gerçek adları göndermek maskelemeyi anlamsız kılardı; bu yüzden arama
 * terimi adres satırından (?ara=) sunucuya gidiyor, eşleşme gerçek veriyle
 * yapılıyor ve sonuçlar yine maskeli çiziliyor.
 *
 * Maskeli rumuz da aranabiliyor ("8EM8"): hakem ekranda o kodu görüp
 * koordinasyona bildirdiğinde, koordinasyon aynı kodla raporu bulabilmeli.
 */

import { anahtar } from '../analiz/normalize';
import { raporRumuzu, takimRumuzu } from './maskele';
import type { Rapor } from './tipler';

/** Bir raporun aranabilir bütün metni. */
function aranabilirMetin(r: Rapor): string {
  const k = r.raporKimligi;
  return [
    r.basvuruNo,
    r.takim,
    r.takimId,
    r.proje,
    r.dosyaAdi,
    k?.takimAdi,
    k?.takimId,
    k?.basvuruId,
    k?.projeAdi,
    // Maskeli kodlar da aranabilir olmalı: hakem ekranda yalnızca onu görür.
    takimRumuzu(r.takimId || r.basvuruNo),
    raporRumuzu(r.id),
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Raporları arama terimine göre süzer.
 *
 * Karşılaştırma anahtar() üzerinden: "İSTANBUL" ile "istanbul", "Takım" ile
 * "TAKIM" eşleşsin. Türkçe'de büyük harfe çevirip karşılaştırmak yetmiyor
 * (I/ı ayrımı), bu yüzden aksan ve i/ı farkını kaldıran normalleştirici
 * kullanılıyor.
 *
 * Terim boşluk içeriyorsa BÜTÜN parçaların bulunması gerekiyor: "anadolu 004"
 * araması hem takımı hem numara parçasını taşıyan raporu bulur.
 */
export function raporlariAra(raporlar: Rapor[], terim: string): Rapor[] {
  const parcalar = anahtar(terim).split(' ').filter(Boolean);
  if (!parcalar.length) return raporlar;

  return raporlar.filter((r) => {
    const metin = anahtar(aranabilirMetin(r));
    return parcalar.every((p) => metin.includes(p));
  });
}
