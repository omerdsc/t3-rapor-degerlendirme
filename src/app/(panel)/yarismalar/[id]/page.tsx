import Link from 'next/link';
import { notFound } from 'next/navigation';
import DisaAktarDugmesi from '@/components/disa-aktar-dugmesi';
import KategoriKarti from '@/components/kategori-karti';
import SablonYukleyici from '@/components/sablon-yukleyici';
import SartnameYukleyici from '@/components/sartname-yukleyici';
import YarismaGuncelle from '@/components/yarisma-guncelle';
import { asamaTakvimi, DURUM_ETIKETI, tarihYaz } from '@/lib/analiz/takvim';
import { raporlariListele, yarismaGetir } from '@/lib/depo/depo';

export const dynamic = 'force-dynamic';

const TAKVIM_RENGI: Record<string, string> = {
  degerlendirmede: 'bg-kirmizi-zemin text-kirmizi-koyu',
  gelecek: 'bg-mavi-zemin text-mavi-koyu',
  tamamlandi: 'bg-zemin text-metin-2',
  bilinmiyor: 'bg-amber-zemin text-amber-koyu',
};

/**
 * Tek yarışma — kategorileri ve hazırlık durumu.
 *
 * Bir ekran, bir iş: "bu yarışma rapor kabul etmeye hazır mı, değilse ne
 * eksik?" Ölçüt düzenleme, şartname özeti ve şablon güncelleme buradan
 * yapılıyor.
 */
export default async function YarismaSayfasi({ params }: PageProps<'/yarismalar/[id]'>) {
  const { id } = await params;
  const yarisma = yarismaGetir(id);
  if (!yarisma) notFound();

  const bugun = new Date();
  const raporlar = raporlariListele(yarisma.id);
  const onayli = yarisma.kategoriler.filter((k) => k.duzenlendi).length;
  const eksikSartname = yarisma.kategoriler.filter((k) => !k.sartname).length;
  const hazir = onayli === yarisma.kategoriler.length && yarisma.kategoriler.length > 0;

  return (
    <>
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <Link
          href="/yarismalar"
          className="shrink-0 rounded-lg border border-cizgi bg-white px-2.5 py-1.5 text-[12px] font-bold text-metin-2 transition-colors hover:bg-zemin"
        >
          ← Yarışmalar
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[20px] font-extrabold tracking-tight">
            {yarisma.ad}
          </h1>
          <p className="mt-0.5 text-[12px] font-medium text-metin-2">
            {yarisma.yil} · {yarisma.kategoriler.length} kategori · {onayli} onaylı ·{' '}
            {raporlar.length} rapor
          </p>
        </div>
        <span
          className={`shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-bold tracking-wide ${
            hazir ? 'bg-yesil-zemin text-yesil-koyu' : 'bg-amber-zemin text-amber-koyu'
          }`}
        >
          {hazir ? 'RAPOR KABUL EDEBİLİR' : 'HAZIRLIK SÜRÜYOR'}
        </span>
        {raporlar.length > 0 && (
          <>
            <DisaAktarDugmesi yarismaId={yarisma.id} raporSayisi={raporlar.length} />
            <Link
              href={`/raporlar?yarisma=${yarisma.id}`}
              className="shrink-0 rounded-lg bg-kirmizi px-3.5 py-2 text-[12px] font-bold text-white transition-colors hover:bg-kirmizi-koyu"
            >
              Raporlar →
            </Link>
          </>
        )}
      </header>

      {!hazir && (
        <p className="mb-4 rounded-xl bg-amber-zemin px-4 py-3 text-[11.5px] leading-relaxed font-medium text-amber-koyu">
          <strong className="font-bold">
            {yarisma.kategoriler.length - onayli} kategorinin ölçütleri
            onaylanmadı.
          </strong>{' '}
          Ölçütler şablondan otomatik çıkarıldı; yanlış olabilir. Her kategoride
          &ldquo;Ölçütler&rdquo;i açıp bakın, gerekiyorsa düzeltin, sonra
          onaylayın. Onaysız kategoride de değerlendirme yapılabilir ama
          puanların doğruluğu garanti değil.
          {eksikSartname > 0 &&
            ` ${eksikSartname} kategoride şartname de eksik — eleyici kurallar bilinmiyor.`}
        </p>
      )}

      <div className="mb-5 flex flex-col gap-3">
        {yarisma.kategoriler.map((kat) => {
          const t = asamaTakvimi(
            kat.sartname?.kurallar.tarihler ?? [],
            kat.asama,
            bugun,
          );
          return (
            <div key={kat.id}>
              <KategoriKarti
                yarismaId={yarisma.id}
                kategori={kat}
                raporSayisi={raporlariListele(yarisma.id, kat.id).length}
                takvim={
                  t
                    ? {
                        etiket:
                          DURUM_ETIKETI[t.durum].toLocaleUpperCase('tr') +
                          (t.durum === 'gelecek' && t.kalanGun !== undefined
                            ? ` · ${t.kalanGun} GÜN`
                            : ''),
                        renk: TAKVIM_RENGI[t.durum] ?? TAKVIM_RENGI.bilinmiyor,
                        baslik: `Son teslim ${tarihYaz(t.teslim)}${
                          t.sonucIlani ? ` · sonuç ${tarihYaz(t.sonucIlani)}` : ''
                        }`,
                      }
                    : null
                }
              />
              {/* Şartnamesi olmayan kategoride yükleyici görünür; olanlarda
                  kartın kendi paneli yeterli. */}
              {!kat.sartname && (
                <div className="rounded-b-xl border-x border-b border-cizgi bg-white px-4 pb-3">
                  <SartnameYukleyici yarismaId={yarisma.id} kategori={kat} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-cizgi bg-white px-4 py-3.5">
          <h2 className="mb-1.5 text-[13px] font-bold">Şablonlar değişti mi?</h2>
          <p className="mb-3 text-[11.5px] leading-relaxed font-medium text-metin-2">
            TEKNOFEST şablonları yıl içinde güncelleyebiliyor. Güncelleme
            kategori kimliklerini korur:{' '}
            <strong className="font-bold">
              yüklenmiş raporlar, hakem puanları ve kendi eklediğiniz ölçütler
              kaybolmaz.
            </strong>{' '}
            Değişen kategorilerin onayı sıfırlanır, çünkü yeni ölçütler
            görülmedi.
          </p>
          <YarismaGuncelle yarismaId={yarisma.id} slugVar={!!yarisma.katalogSlug} />
        </section>

        <section className="rounded-xl border border-cizgi bg-white px-4 py-3.5">
          <h2 className="mb-1.5 text-[13px] font-bold">Kategori ekle</h2>
          <p className="mb-3 text-[11.5px] leading-relaxed font-medium text-metin-2">
            Katalogda olmayan bir kategori için şablonu doğrudan
            yükleyebilirsiniz. Word (.docx) olmalı — bölüm başlıkları stil
            bilgisinden okunuyor.
          </p>
          <SablonYukleyici yarismaId={yarisma.id} yarismaAdi={yarisma.ad} />
        </section>
      </div>
    </>
  );
}
