/**
 * Kimlik maskeleme.
 *
 * NEDEN
 * Sistemdeki örnek raporlar GERÇEK yarışmacı belgeleri. Takım adı, proje adı
 * ve başvuru numarası gerçek kişilere ait; demo ekranında, ekran görüntüsünde
 * ya da test çıktısında görünmemeli.
 *
 * MASKELEME İKİ AMACA HİZMET EDİYOR
 *   1. Kişisel veri sunum sırasında ekrana düşmez.
 *   2. HAKEM YANLILIĞINI AZALTIR. Değerlendirme sırasında takım adını
 *      görmek kör olmayan bir puanlama demek; "geçen yıl finale kalan
 *      ekip" bilgisi puanı etkiler. Maskeleme bunu da engelliyor.
 *
 * NASIL — GERİ DÖNÜŞSÜZ DEĞİL, TUTARLI
 * Ad silinmiyor, KARARLI bir rumuza çevriliyor: aynı takım her ekranda aynı
 * rumuzu alır ("Takım A3F1"). Rastgele olsa iki ekranda iki farklı ad
 * görünür ve hakem aynı takımı iki takım sanar. Rumuz takımId'nin
 * kısaltmasıdır; gerçek ad depoda kalır, yalnızca gösterimde değişir.
 *
 * NEREDE UYGULANMIYOR
 * Yarışmacı portalı (`/sonuc`) kendi raporunu gösteriyor; orada kişi kendi
 * adını görmeli. Maskeleme yalnızca HAKEM ve KOORDİNASYON ekranlarında.
 */

import type { Rapor } from './tipler';

/**
 * Maskeleme açık mı?
 *
 * Ortam değişkeniyle kapatılabiliyor: gerçek bir kurulumda koordinasyon
 * takım adını görmek isteyebilir. Varsayılan AÇIK — güvenli taraf.
 */
export function maskelemeAcikMi(): boolean {
  return process.env.MASKELEME !== 'kapali';
}

/**
 * Kararlı kısa kod — FNV-1a, base36.
 *
 * İLK SÜRÜM MASKELEMİYORDU. Kimliğin son 4 karakterini alıyordu ve
 * takımId okunur bir ad olduğunda bu doğrudan adı sızdırdı:
 *
 *     "anadolu" → "Takım DOLU"
 *     "botan"   → "Takım OTAN"
 *
 * Gerçek adın bir parçası maske değildir. Kırpma yerine hash: girdinin
 * hiçbir harfi çıktıya geçmez, aynı girdi her zaman aynı kodu verir.
 */
function kisaKod(girdi: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < girdi.length; i++) {
    h ^= girdi.charCodeAt(i);
    // FNV-1a çarpanı; >>> 0 ile 32 bitte tutuluyor.
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(36).toUpperCase().padStart(4, '0').slice(-4);
}

/** takımId'den kararlı, okunur ve sızdırmayan rumuz üretir. */
export function takimRumuzu(takimId: string): string {
  return `Takım ${kisaKod(takimId)}`;
}

/**
 * Rapor kodu.
 *
 * Takım rumuzu tek başına YETMİYOR: aynı takımın iki raporu (bu yılki ve
 * geçen yılki) aynı rumuzu alıyor ve benzerlik ekranında iki farklı çift
 * "Takım X ↔ Takım Y" diye görünüyor — hakem hangi raporun kastedildiğini
 * ayırt edemiyor. Rapor düzeyinde ayrı bir kod gerekiyor.
 */
export function raporRumuzu(raporId: string): string {
  return `R-${kisaKod(raporId)}`;
}

/**
 * Maskeli başvuru numarası.
 *
 * İlk sürüm numaranın son üç hanesini bırakıyordu. Bu SIZDIRIYOR: başvuru
 * numarası her zaman sayı değil. Gerçek veride "TF-ZAP" gibi takım
 * kısaltması taşıyan numaralar var ve son üç karakter doğrudan takımın
 * adını veriyordu — maskelemenin tam tersi.
 *
 * Bunun yerine takım rumuzuyla AYNI kod kullanılıyor: sızdırmaz, kararlıdır
 * ve iki alan birbiriyle tutarlı görünür. Hakemin TEKNOFEST'in kendi
 * numarasıyla eşleştirme yapamaması bir kayıp değil — maskelemenin amacı
 * tam olarak bu.
 */
export function basvuruRumuzu(takimId: string): string {
  return `#${takimRumuzu(takimId).replace('Takım ', '')}`;
}

/**
 * Proje adı maskelenmiyor — ama neden maskelenmediği önemli.
 *
 * Proje adı değerlendirmenin KONUSU: hakem "bu proje raporu şu işi
 * yapıyor" bilgisi olmadan puanlayamaz. Kişiyi tanımlamıyor, işi
 * tanımlıyor. Takım adı ise yalnızca kimliktir; puanlamaya katkısı yok,
 * yanlılık riski var.
 */
export interface MaskeliRapor {
  takim: string;
  basvuruNo: string;
  /** Aynı takımın birden çok raporunu ayırt eden kod. */
  raporKodu: string;
  maskeli: boolean;
}

export function raporuMaskele(
  rapor: Pick<Rapor, 'id' | 'takim' | 'takimId' | 'basvuruNo'>,
  acik = maskelemeAcikMi(),
): MaskeliRapor {
  if (!acik) {
    return {
      takim: rapor.takim,
      basvuruNo: rapor.basvuruNo,
      raporKodu: raporRumuzu(rapor.id),
      maskeli: false,
    };
  }
  // İkisi de AYNI kaynaktan türetiliyor: rumuz ile numara tutarlı görünsün
  // ve hiçbiri gerçek adı ya da gerçek numarayı taşımasın.
  const kaynak = rapor.takimId || rapor.basvuruNo;
  return {
    takim: takimRumuzu(kaynak),
    basvuruNo: basvuruRumuzu(kaynak),
    raporKodu: raporRumuzu(rapor.id),
    maskeli: true,
  };
}

/**
 * Metin içindeki takım adını maskeler.
 *
 * Eşleşen cümleler rapor GÖVDESİNDEN geliyor ve gövdede takım adı geçebilir
 * ("XYZ Takımı olarak bu projede…"). Yalnızca üst veriyi maskelemek yetmez.
 * Kısa adlar (3 harften az) maskelenmiyor: metinde rastgele eşleşip
 * okunamaz hale getirir.
 */
export function metindeMaskele(
  metin: string,
  adlar: Array<{ ad: string; rumuz: string }>,
): string {
  let sonuc = metin;
  for (const { ad, rumuz } of adlar) {
    const temiz = ad.trim();
    if (temiz.length < 3) continue;
    // Kaçış: ad içinde regex özel karakteri olabilir.
    const desen = new RegExp(temiz.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    sonuc = sonuc.replace(desen, rumuz);
  }
  return sonuc;
}
