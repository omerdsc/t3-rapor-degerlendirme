import Link from 'next/link';
import PortalDonus from '@/components/portal-donus';
import Yazisma from '@/components/yazisma';
import { notFound } from 'next/navigation';
import HakemPuanlama from '@/components/hakem-puanlama';
import { KontrolNoktasi } from '@/components/rozet';
import {
  degerlendirmeGetir, hakemKodIle, hakeminRaporlari,
} from '@/lib/db/hakem-depo';
import { kategoriGetir, raporGetir, yarismaGetir } from '@/lib/depo/depo';
import { raporRumuzu, takimRumuzu } from '@/lib/depo/maskele';

export const dynamic = 'force-dynamic';

/**
 * Hakemin tek rapor değerlendirme ekranı.
 *
 * ── ERİŞİM DENETİMİ VERİ TARAFINDA ──────────────────────────────────────
 * Sayfa, raporun bu hakeme ATANMIŞ olup olmadığını kontrol ediyor. Sadece
 * arayüzde gizlemek yetmez: hakem adres satırına başka bir rapor kimliği
 * yazarsa açılmamalı. Aynı denetim API tarafında da var — iki katman,
 * çünkü biri atlanırsa öteki tutuyor.
 *
 * ── HAKEM NE GÖRÜYOR, NE GÖRMÜYOR ───────────────────────────────────────
 * Görüyor : rapor PDF'i, otomatik kontrol bulguları, yapay zekâ önerisi
 * Görmüyor: gerçek takım adı, başvuru sahibinin kimliği, öteki hakemlerin
 *           puanları, nihai puan
 *
 * Öteki hakemlerin puanı bilinçli gizli: görürse ona yakınsama (anchoring)
 * eğilimi doğar ve bağımsız iki değerlendirme almanın anlamı kalmaz.
 */
export default async function HakemRaporSayfasi({
  params,
}: PageProps<'/hakem/[kod]/[raporId]'>) {
  const { kod, raporId } = await params;

  const hakem = hakemKodIle(kod);
  if (!hakem) notFound();

  // Atanmamış rapor açılmıyor — adres satırından erişim denemesi dahil.
  if (!hakeminRaporlari(hakem.id).includes(raporId)) notFound();

  const rapor = raporGetir(raporId);
  if (!rapor) notFound();

  const yarisma = yarismaGetir(rapor.yarismaId);
  const kategori = kategoriGetir(rapor.yarismaId, rapor.kategoriId);
  if (!yarisma || !kategori) notFound();

  const mevcut = degerlendirmeGetir(raporId, hakem.id);
  const tamamlandi = mevcut?.durum === 'tamamlandi';

  const baslangicPuanlar: Record<string, string> = {};
  for (const p of mevcut?.puanlar ?? []) {
    baslangicPuanlar[p.kriterKodu] = String(p.puan);
  }

  const bulgular = rapor.kontroller.flatMap((k) =>
    k.bulgular.map((b) => ({ ...b, kontrol: k.ad })),
  );

  return (
    <div className="min-h-dvh bg-zemin">
      <header className="bg-lacivert px-6 py-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
          <Link
            href={`/hakem/${kod}`}
            className="shrink-0 rounded-lg border border-lacivert-3 px-2.5 py-1.5 text-[12px] font-bold text-metin-2 transition-colors hover:bg-lacivert-2"
          >
            ← Listem
          </Link>
          <div className="min-w-0 flex-1">
            {/*
              Ham başvuru numarası KALDIRILDI: takım adını içerebiliyor
              ("TF-BOTAN") ve rumuzun yanında durunca maskelemeyi boşa
              çıkarıyordu. Yerinde rapor kodu var — kimlik taşımayan,
              yazışmada kullanılabilir sabit bir referans.
            */}
            <h1 className="truncate text-[15px] font-extrabold tracking-tight text-white">
              <span
                title="Rapor kodu — koordinasyonla yazışırken bu kodu kullanın"
                className="font-mono"
              >
                {raporRumuzu(rapor.id)}
              </span>
              {' · '}
              {takimRumuzu(rapor.takimId)}
            </h1>
            <p className="mt-0.5 truncate text-[11.5px] font-medium text-metin-2">
              {yarisma.ad}
              {kategori.ad !== yarisma.ad && ` · ${kategori.ad}`} ·{' '}
              {rapor.istatistik.sayfaSayisi} sayfa ·{' '}
              {rapor.istatistik.kelimeSayisi.toLocaleString('tr')} kelime
            </p>
          </div>
          <span className="shrink-0 text-[11px] font-medium text-metin-2">
            {hakem.ad}
          </span>
          <PortalDonus />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-5">
        {/* Otomatik kontroller — hakem raporu okumadan önce ne bilmeli */}
        <div className="mb-4 flex flex-wrap gap-2.5 rounded-xl border border-cizgi bg-white px-4 py-3">
          {rapor.kontroller.map((k) => (
            <KontrolNoktasi
              key={k.kod}
              seviye={k.durum}
              baslik={`${k.ad}: ${k.ozet}`}
            />
          ))}
          {!rapor.kontroller.length && (
            <span className="text-[11.5px] font-medium text-metin-2">
              Otomatik kontrol kaydı yok.
            </span>
          )}
        </div>

        {!!bulgular.length && (
          <details className="mb-4 rounded-xl border border-cizgi bg-white px-4 py-3">
            <summary className="cursor-pointer text-[12.5px] font-bold">
              Otomatik bulgular ({bulgular.length})
            </summary>
            <ul className="mt-2 flex flex-col gap-1.5">
              {bulgular.map((b, i) => (
                <li
                  key={i}
                  className={`rounded-md px-2.5 py-1.5 text-[11px] leading-relaxed ${
                    b.seviye === 'hata'
                      ? 'bg-kirmizi-zemin text-kirmizi-koyu'
                      : b.seviye === 'uyari'
                        ? 'bg-amber-zemin text-amber-koyu'
                        : 'bg-zemin text-metin-2'
                  }`}
                >
                  <strong className="font-bold">{b.baslik}</strong>
                  {b.sayfa ? <span className="ml-1 font-semibold">· s.{b.sayfa}</span> : null}
                  <br />
                  {b.aciklama}
                </li>
              ))}
            </ul>
          </details>
        )}

        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          {/* Rapor PDF'i — hakem belgeyi görmeden puanlamamalı */}
          <section className="overflow-hidden rounded-xl border border-cizgi bg-white">
            <div className="flex items-center gap-2.5 border-b border-cizgi px-4 py-2.5">
              <h2 className="text-[12.5px] font-bold">Rapor</h2>
              <a
                href={`/api/rapor/${rapor.id}/dosya?kod=${encodeURIComponent(kod)}`}
                target="_blank"
                rel="noreferrer"
                className="ml-auto text-[11.5px] font-bold text-kirmizi hover:text-kirmizi-koyu"
              >
                Yeni sekmede aç →
              </a>
            </div>
            {rapor.dosyaYolu ? (
              <iframe
                src={`/api/rapor/${rapor.id}/dosya?kod=${encodeURIComponent(kod)}#view=FitH`}
                title="Rapor"
                className="h-[720px] w-full"
              />
            ) : (
              <p className="px-4 py-16 text-center text-[12px] font-medium text-metin-2">
                Bu rapor Word olarak yüklendiği için gömülü görüntüleme yok.
                Yukarıdaki bağlantıdan indirebilirsiniz.
              </p>
            )}
          </section>

          <HakemPuanlama
            kod={kod}
            raporId={rapor.id}
            olcutler={kategori.rubrik.kriterler}
            toplamPuan={kategori.rubrik.toplamPuan}
            aiKriterler={(rapor.aiDegerlendirme?.kriterler ?? []).map((k) => ({
              kod: k.kod,
              aiPuan: k.aiPuan,
              guven: k.guven,
              gerekce: k.gerekce,
              kanitlar: k.kanitlar,
              oneri: k.oneri,
              hakemIncelemesiGerekli: k.hakemIncelemesiGerekli,
            }))}
            baslangicPuanlar={baslangicPuanlar}
            baslangicAciklama={mevcut?.aciklama ?? ''}
            // Kayıtlı taslak varsa o gösterilir; yoksa yapay zekâ önerisi
            // dolu gelir ve hakem onaylayarak yayımlar.
            baslangicGeriBildirim={mevcut?.geriBildirim}
            aiGucluYonler={rapor.aiDegerlendirme?.genelGucluYonler ?? []}
            aiGelisimAlanlari={rapor.aiDegerlendirme?.genelGelisimAlanlari ?? []}
            tamamlandi={tamamlandi}
          />

          {/*
            KOORDİNASYONA SORU — puanlamanın hemen ardında.
            Hakemin koordinasyona yazacağı şey genellikle puanlarken
            aklına geliyor: "şablon sürümü doğru mu", "bu takımın geçen
            yılki raporuna bakılsın mı". Ayrı bir ekrana gitmesi
            gerekseydi çoğu soru hiç sorulmazdı.

            Mesaj bu rapora bağlı gidiyor; hakem hangi rapordan söz
            ettiğini ayrıca yazmak zorunda değil.
          */}
          <div className="mt-4">
            <Yazisma
              raporId={rapor.id}
              baslangic={rapor.mesajlar ?? []}
              kod={kod}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
