/**
 * Açılış denetimi — sunucu ayağa kalkarken bir kez çalışıyor.
 *
 * ── NİYE VAR ────────────────────────────────────────────────────────────
 * Geliştirmede `KOORDINASYON_ANAHTARI` boşsa sistem AÇIK çalışıyor ve
 * ekranda uyarı gösteriyor. Bu bilinçli bir tercih: anahtarı bilmeyen
 * birinin projeyi hiç çalıştıramaması kötü olurdu.
 *
 * Aynı tercih canlıda felakete dönüşür. Açık kurulumda koordinasyon
 * paneline erişen herkes hakem silebilir, atama yapabilir, ÜCRETLİ yapay
 * zekâ çağrısı başlatabilir ve bütün veriyi dışa aktarabilir. Ekrandaki
 * uyarı şeridi buna karşı bir koruma değil — okuyanı uyarır, gelmeyeni
 * durdurmaz.
 *
 * Bu yüzden üretimde varsayılan tersine dönüyor: anahtar yoksa sunucu
 * AÇILMIYOR. Açık çalıştırmak hâlâ mümkün ama artık bir KARAR gerektiriyor
 * (`KOORDINASYON_ACIK=evet`) — unutulmuş bir ayar değil, yazılmış bir
 * cümle.
 *
 * ── NİYE HATA, NİYE UYARI DEĞİL ─────────────────────────────────────────
 * Uyarı, kimsenin bakmadığı bir günlüğe yazılır. Hata görülür.
 *
 * ÖLÇÜLDÜ — buradan atılan hata sunucu sürecini SONLANDIRMIYOR: Next
 * "Failed to prepare server" yazıp ayakta kalıyor ve gelen her isteğe 500
 * dönüyor. Amaç yine de karşılanıyor, hatta net karşılanıyor: giriş
 * sayfası dahil hiçbir ekran açılmıyor, yani panel kapalı. Sağlık
 * yoklaması da başarısız oluyor ve kapsayıcı "unhealthy" görünüyor.
 *
 * Bu ayrım yazılı çünkü beklenti "kapsayıcı yeniden başlar" olsaydı
 * yanlış olurdu; olan şey "kapsayıcı ayakta ama hiçbir şey sunmuyor".
 */

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NODE_ENV !== 'production') return;

  const anahtar = (process.env.KOORDINASYON_ANAHTARI ?? '').trim();
  const bilerekAcik = (process.env.KOORDINASYON_ACIK ?? '').trim() === 'evet';

  if (!anahtar && !bilerekAcik) {
    throw new Error(
      'KOORDINASYON_ANAHTARI tanımlı değil. Üretimde koordinasyon paneli '
        + 'anahtarsız açılmıyor: panele erişen herkes veri dışa aktarabilir '
        + 've ücretli yapay zekâ çağrısı başlatabilir. Uzun bir anahtar '
        + 'tanımlayın; bilerek herkese açık çalıştırmak istiyorsanız '
        + 'KOORDINASYON_ACIK=evet yazın.',
    );
  }

  /*
   * Kısa anahtar da bir sorun ama açılışı engellemiyor: hız sınırlama
   * yok, tek koruma uzunluk. Burada durdurmak, çalışan bir kurulumu
   * güncelleme sırasında kilitleyebilirdi — söylemek yetiyor.
   */
  if (anahtar && anahtar.length < 16) {
    console.warn(
      `[TPRDS] Koordinasyon anahtarı kısa (${anahtar.length} karakter). `
        + 'Hız sınırlama yok; kaba kuvvete karşı tek koruma uzunluk. '
        + 'En az 24 karakter önerilir.',
    );
  }

  if (bilerekAcik && !anahtar) {
    console.warn(
      '[TPRDS] Koordinasyon paneli HERKESE AÇIK çalışıyor '
        + '(KOORDINASYON_ACIK=evet). Bu kurulumda veri dışa aktarma ve '
        + 'ücretli çağrılar korumasızdır.',
    );
  }
}
