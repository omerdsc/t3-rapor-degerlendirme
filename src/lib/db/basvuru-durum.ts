/**
 * Başvurunun hangi aşamada olduğu — yarışmacının izlediği çizelge.
 *
 * ── NİYE TÜRETİLİYOR, NİYE SAKLANMIYOR ──────────────────────────────────
 * Aşama ayrı bir sütunda tutulsaydı iki gerçek olurdu: sütunun söylediği
 * ve tabloların söylediği. Rapor silinince, atama kaldırılınca ya da puan
 * geri alınınca sütunu güncellemeyi unutan tek bir kod yolu yeter — ve
 * yarışmacı "sonuçlandı" yazan bir ekranda hiç sonuç göremez.
 *
 * Aşama burada HER SEFERİNDE veriden okunuyor. Sorgular indeksli ve
 * başvuru başına dört sayım; yanlış bilgi göstermenin bedeli yanında
 * ihmal edilebilir.
 *
 * ── DÖRT AŞAMA, ÜÇ GEÇİŞ ────────────────────────────────────────────────
 *   basvuruldu     → başvuru açıldı, rapor yok
 *   rapor_yuklendi → rapor teslim edildi, hakem atanmadı
 *   degerlendirmede→ hakem atandı, henüz nihai puan yok
 *   sonuclandi     → nihai puan var
 *
 * "Reddedildi" ya da "diskalifiye" aşaması YOK: bu sistem eleme kararı
 * vermiyor, değerlendirme yürütüyor. Olmayan bir aşamayı çizelgeye
 * koymak, sistemin yetkisi olmayan bir sonucu varmış gibi gösterirdi.
 */

import { baglanti } from './baglanti';

export type BasvuruAsamasi =
  | 'basvuruldu'
  | 'rapor_yuklendi'
  | 'degerlendirmede'
  | 'sonuclandi';

export interface AsamaDurumu {
  asama: BasvuruAsamasi;
  raporId?: string;
  raporAdi?: string;
  yuklendi?: string;
  /** Kaç hakem atandı. */
  hakemSayisi: number;
  /** Kaçı değerlendirmesini tamamladı. */
  tamamlayan: number;
  nihaiPuan?: number;
  /** Rapor artık değiştirilemez mi (hakem atandı). */
  kilitli: boolean;
}

export const ASAMA_ETIKETI: Record<BasvuruAsamasi, string> = {
  basvuruldu: 'Rapor bekleniyor',
  rapor_yuklendi: 'Rapor teslim edildi',
  degerlendirmede: 'Değerlendirmede',
  sonuclandi: 'Sonuçlandı',
};

export const ASAMA_ACIKLAMASI: Record<BasvuruAsamasi, string> = {
  basvuruldu:
    'Başvurunuz açıldı. Son teslim tarihine kadar proje raporunuzu yükleyebilirsiniz.',
  rapor_yuklendi:
    'Raporunuz alındı. Hakem ataması yapıldığında değerlendirme başlayacak; '
    + 'o ana kadar raporunuzu değiştirebilirsiniz.',
  degerlendirmede:
    'Raporunuz hakemlere iletildi ve değerlendiriliyor. Bu aşamada rapor '
    + 'değiştirilemiyor.',
  sonuclandi:
    'Değerlendirme tamamlandı. Puanınızı ve gelişim geri bildiriminizi '
    + 'aşağıdan görüntüleyebilirsiniz.',
};

/** Çizelgede gösterilen sıra. */
export const ASAMA_SIRASI: BasvuruAsamasi[] = [
  'basvuruldu',
  'rapor_yuklendi',
  'degerlendirmede',
  'sonuclandi',
];

export function basvuruAsamasi(basvuruId: string): AsamaDurumu {
  const db = baglanti();

  const r = db
    .prepare(
      `SELECT id, dosya_adi, yuklendi, nihai_puan
         FROM rapor WHERE basvuru_id = ? ORDER BY yuklendi DESC LIMIT 1`,
    )
    .get(basvuruId) as
    | { id: string; dosya_adi: string; yuklendi: string; nihai_puan: number | null }
    | undefined;

  if (!r) {
    return { asama: 'basvuruldu', hakemSayisi: 0, tamamlayan: 0, kilitli: false };
  }

  const atama = db
    .prepare('SELECT COUNT(*) AS n FROM atama WHERE rapor_id = ?')
    .get(r.id) as { n: number };
  const bitmis = db
    .prepare("SELECT COUNT(*) AS n FROM degerlendirme WHERE rapor_id = ? AND durum = 'tamamlandi'")
    .get(r.id) as { n: number };

  const hakemSayisi = Number(atama.n);
  const tamamlayan = Number(bitmis.n);

  /*
   * SONUÇ ÖLÇÜTÜ NİHAİ PUAN, "hepsi tamamladı" DEĞİL.
   *
   * Üç hakemin üçü de puanladığı hâlde koordinasyon nihai puanı henüz
   * yazmamış olabilir (itiraz, ortalama düzeltmesi). Yarışmacıya
   * "sonuçlandı" demek ama sonuç sayfasını boş göstermek, en kötü
   * kombinasyon olurdu.
   */
  const asama: BasvuruAsamasi =
    r.nihai_puan !== null && r.nihai_puan !== undefined
      ? 'sonuclandi'
      : hakemSayisi > 0
        ? 'degerlendirmede'
        : 'rapor_yuklendi';

  return {
    asama,
    raporId: r.id,
    raporAdi: r.dosya_adi,
    yuklendi: r.yuklendi,
    hakemSayisi,
    tamamlayan,
    nihaiPuan: r.nihai_puan ?? undefined,
    kilitli: hakemSayisi > 0,
  };
}
