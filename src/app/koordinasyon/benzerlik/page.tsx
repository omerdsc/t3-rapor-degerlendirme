import { redirect } from 'next/navigation';

/**
 * Eski kopya kontrolü adresi — yönlendirme.
 *
 * ── NİYE SAYFA SİLİNMEDİ, YÖNLENDİRMEYE ÇEVRİLDİ ────────────────────────
 * Kopya kontrolü ayrı bir menü maddesiydi ve koordinasyon oraya ancak
 * aklına gelirse gidiyordu: kopya şüphesini görmek için kopya şüphesi
 * olduğunu tahmin etmesi gerekiyordu. Artık raporların bir sekmesi —
 * bulunduğu yer, ait olduğu yer.
 *
 * Adres silinseydi yer imi, tarayıcı geçmişi ve ekip içinde paylaşılmış
 * bağlantılar 404 alırdı. Yönlendirme onları doğru sekmeye taşıyor.
 */
export default async function BenzerlikYonlendirme({
  searchParams,
}: PageProps<'/koordinasyon/benzerlik'>) {
  const p = await searchParams;
  const q = new URLSearchParams({ durum: 'kopya' });
  if (typeof p.yarisma === 'string') q.set('yarisma', p.yarisma);
  if (typeof p.kategori === 'string') q.set('kategori', p.kategori);
  redirect(`/koordinasyon/raporlar?${q}`);
}
