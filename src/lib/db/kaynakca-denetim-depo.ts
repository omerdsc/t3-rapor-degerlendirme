import { baglanti, jsonOku, jsonYaz } from './baglanti';
import type { Adim, AjanDurumu } from '@/lib/ai/ajan';
import type { KaynakcaKarari } from '@/lib/ai/kaynakca-ajani';

/**
 * Kaynakça denetim kaydı — ajanın çıktısının kalıcı hâli.
 *
 * Rapor başına tek kayıt: denetim yeniden çalıştırılırsa öncekinin
 * üstüne yazıyor. Geçmiş tutulmuyor, çünkü saklanmaya değer olan
 * "kaynakça şu an ne durumda" — eski bir denetimin bulgusu, kaynakça
 * değişmediyse aynısı, değiştiyse yanlış.
 */
export interface KaynakcaDenetimi {
  raporId: string;
  durum: AjanDurumu;
  karar: KaynakcaKarari | null;
  adimlar: Adim[];
  tur: number;
  maliyet: number;
  hata?: string;
  olusturuldu: string;
}

export function kaynakcaDenetimiKaydet(d: Omit<KaynakcaDenetimi, 'olusturuldu'>): void {
  baglanti()
    .prepare(
      `INSERT INTO kaynakca_denetimi
         (rapor_id, durum, karar, adimlar, tur, maliyet, hata, olusturuldu)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(rapor_id) DO UPDATE SET
         durum = excluded.durum, karar = excluded.karar,
         adimlar = excluded.adimlar, tur = excluded.tur,
         maliyet = excluded.maliyet, hata = excluded.hata,
         olusturuldu = excluded.olusturuldu`,
    )
    .run(
      d.raporId, d.durum, jsonYaz(d.karar), jsonYaz(d.adimlar) ?? '[]',
      d.tur, d.maliyet, d.hata ?? null, new Date().toISOString(),
    );
}

export function kaynakcaDenetimiGetir(raporId: string): KaynakcaDenetimi | null {
  const s = baglanti()
    .prepare('SELECT * FROM kaynakca_denetimi WHERE rapor_id = ?')
    .get(raporId) as Record<string, unknown> | undefined;
  if (!s) return null;
  return {
    raporId: s.rapor_id as string,
    durum: s.durum as AjanDurumu,
    karar: jsonOku<KaynakcaKarari | null>(s.karar, null),
    adimlar: jsonOku<Adim[]>(s.adimlar, []),
    tur: s.tur as number,
    maliyet: s.maliyet as number,
    hata: (s.hata as string) ?? undefined,
    olusturuldu: s.olusturuldu as string,
  };
}
