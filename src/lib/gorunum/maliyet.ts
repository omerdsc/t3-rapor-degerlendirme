/**
 * Maliyet rakamlarının ekranda görünüp görünmeyeceği.
 *
 * ── NİYE ANAHTAR, NİYE SİLME ────────────────────────────────────────────
 * Koordinasyon panelinde tutarların görünmesi istenmedi. Ama maliyetle
 * ilgili iki şey ekranda kalmalı, çünkü ikisi de RAKAM DEĞİL DAVRANIŞ:
 *
 *   1. Bütçe tavanı bir güvenlik özelliği — aşılınca sistem çağrıyı
 *      reddediyor. Rakamı gizlemek bu davranışı kaldırmıyor.
 *   2. Toplu değerlendirmedeki onay adımı, ücretli bir işlemi başlatmadan
 *      önce kullanıcıya "bu ücretli" demek zorunda. Tutarı gizlemek başka
 *      şey, ücretli olduğunu gizlemek başka şey.
 *
 * Bu yüzden rakamlar silinmedi, tek bir anahtara bağlandı. Varsayılan
 * KAPALI; `MALIYET_GOSTER=acik` ile geri açılıyor — kurum içi kullanımda
 * bütçeyi izleyen kişinin görmesi gerekebilir.
 *
 * Aynı desen `MASKELEME` anahtarında da kullanılıyor: sunum tercihi kodu
 * değiştirmeden ayarlanabilmeli.
 */

/** Ekranda para tutarı gösterilsin mi? */
export function maliyetGorunur(): boolean {
  return (process.env.MALIYET_GOSTER ?? '').trim().toLocaleLowerCase('tr') === 'acik';
}
