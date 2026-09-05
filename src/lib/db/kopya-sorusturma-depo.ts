import { baglanti, jsonOku, jsonYaz } from './baglanti';
import type { Adim, AjanDurumu } from '@/lib/ai/ajan';
import type { KopyaKararDetayi } from '@/lib/ai/kopya-ajani';

/**
 * Kopya soruşturma kaydı.
 *
 * Kimlikler SIRALI saklanıyor: soruşturulan şey iki rapor arasındaki bağ
 * ve o bağın yönü yok. Sıralamasaydık (A,B) ile (B,A) iki ayrı kayıt
 * olurdu ve ikinci soruşturma birincisini bulamazdı.
 */
function sirala(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export interface KopyaSorusturmasi {
  aId: string;
  bId: string;
  durum: AjanDurumu;
  karar: KopyaKararDetayi | null;
  adimlar: Adim[];
  tur: number;
  maliyet: number;
  hata?: string;
  olusturuldu: string;
}

export function kopyaSorusturmasiKaydet(
  d: Omit<KopyaSorusturmasi, 'olusturuldu'>,
): void {
  const [a, b] = sirala(d.aId, d.bId);
  baglanti()
    .prepare(
      `INSERT INTO kopya_sorusturmasi
         (a_id, b_id, durum, karar, adimlar, tur, maliyet, hata, olusturuldu)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(a_id, b_id) DO UPDATE SET
         durum = excluded.durum, karar = excluded.karar,
         adimlar = excluded.adimlar, tur = excluded.tur,
         maliyet = excluded.maliyet, hata = excluded.hata,
         olusturuldu = excluded.olusturuldu`,
    )
    .run(
      a, b, d.durum, jsonYaz(d.karar), jsonYaz(d.adimlar) ?? '[]',
      d.tur, d.maliyet, d.hata ?? null, new Date().toISOString(),
    );
}

export function kopyaSorusturmasiGetir(
  aId: string,
  bId: string,
): KopyaSorusturmasi | null {
  const [a, b] = sirala(aId, bId);
  const s = baglanti()
    .prepare('SELECT * FROM kopya_sorusturmasi WHERE a_id = ? AND b_id = ?')
    .get(a, b) as Record<string, unknown> | undefined;
  if (!s) return null;
  return {
    aId: s.a_id as string,
    bId: s.b_id as string,
    durum: s.durum as AjanDurumu,
    karar: jsonOku<KopyaKararDetayi | null>(s.karar, null),
    adimlar: jsonOku<Adim[]>(s.adimlar, []),
    tur: s.tur as number,
    maliyet: s.maliyet as number,
    hata: (s.hata as string) ?? undefined,
    olusturuldu: s.olusturuldu as string,
  };
}
