import Link from 'next/link';
import PortalDonus from '@/components/portal-donus';
import Yazisma from '@/components/yazisma';
import { notFound } from 'next/navigation';
import HakemPuanlama from '@/components/hakem-puanlama';
import RaporBolmesi from '@/components/rapor-bolmesi';
import KaynakcaDenetimi from '@/components/kaynakca-denetimi';
import { kaynakcaDenetimiGetir } from '@/lib/db/kaynakca-denetim-depo';
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
  const denetim = kaynakcaDenetimiGetir(rapor.id);

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
        {/*
          Otomatik kontroller — hakem raporu okumadan önce ne bilmeli.

          KONTROL YOKSA KUTU DA YOK. Önceden boş bir şerit çiziliyor ve
          içinde "Otomatik kontrol kaydı yok." yazıyordu. Hakemin bir
          sorusunu cevaplamıyordu: olmayan bir şeyin yokluğunu duyurmak
          ekranda yer kaplamaktan başka bir işe yaramıyor.
        */}
        {!!rapor.kontroller.length && (
          <div className="mb-4 flex flex-wrap gap-2.5 rounded-xl border border-cizgi bg-white px-4 py-3">
            {rapor.kontroller.map((k) => (
              <KontrolNoktasi
                key={k.kod}
                seviye={k.durum}
                baslik={`${k.ad}: ${k.ozet}`}
              />
            ))}
          </div>
        )}

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

        {/*
          KAYNAKÇA DENETİMİ HAKEMDE DE — AMA SALT OKUNUR.

          Uydurma kaynakça bulunan bir raporda puanlama tartışmalı hâle
          geliyor; bu bilgiye en çok ihtiyacı olan kişi puanı veren
          hakem. Önce yalnızca koordinasyon görüyordu ve bilgi karar
          veren tarafa hiç ulaşmıyordu.

          Düğme yok: denetim ücretli ve bütçe ortak. Harcamayı
          başlatan taraf koordinasyon, hakem sonucu okuyor. Denetim
          hiç yapılmamışsa bölüm çizilmiyor.
        */}
        {denetim && (
          <div>
            <KaynakcaDenetimi
              raporId={rapor.id}
              saltOkunur
              baslangic={{
                durum: denetim.durum,
                karar: denetim.karar,
                adimlar: denetim.adimlar,
                tur: denetim.tur,
                maliyet: denetim.maliyet,
                hata: denetim.hata,
              }}
            />
          </div>
        )}

        {/*
          BELGE YOKSA İKİ SÜTUN YOK.

          Düzen 50/50'ye sabitti. Görüntülenebilir bir belge olmadığında
          sol yarı bir uyarı cümlesiyle boş kalıyor, sağdaki puanlama da
          gereksiz yere ekranın yarısına sıkışıyordu — bir sütun boş,
          öteki dar. Belge yoksa puanlama tam genişlik alıyor ve uyarı
          tek satıra iniyor.
        */}
        <div
          className={`grid items-start gap-4 ${
            rapor.dosyaYolu ? 'lg:grid-cols-[1fr_1fr]' : 'grid-cols-1'
          }`}
        >
          {rapor.dosyaYolu ? (
            <RaporBolmesi raporId={rapor.id} kod={kod} dosyaAdi={rapor.dosyaAdi} />
          ) : (
            /*
              MESAJ DOSYA ADINDAN OKUNUYOR, TAHMİNDEN DEĞİL.

              Eskiden koşulsuz "Bu rapor Word olarak yüklendiği için…"
              yazıyordu. Oysa `dosyaYolu` yalnızca PDF'lerde doluyor; dosyası
              hiç saklanmamış bir raporda da bu cümle çıkıyor ve hakem
              olmayan bir Word belgesi arıyordu. Yanlış açıklama, açıklama
              yokluğundan kötüdür.
            */
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-cizgi bg-white px-4 py-3">
              <svg viewBox="0 0 24 24" className="size-4 shrink-0 stroke-metin-3" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                <path d="M14 2v6h6" />
              </svg>
              {/\.docx?$/i.test(rapor.dosyaAdi) ? (
                <>
                  <p className="min-w-0 flex-1 text-[12px] font-medium text-metin-2">
                    <strong className="font-bold text-metin">{rapor.dosyaAdi}</strong>{' '}
                    — Word belgeleri tarayıcıda gömülü açılmıyor.
                  </p>
                  <a
                    href={`/api/rapor/${rapor.id}/dosya?kod=${encodeURIComponent(kod)}`}
                    className="dugme shrink-0 border border-cizgi px-3.5 py-1.5 text-[12px] text-metin hover:bg-zemin"
                  >
                    Belgeyi indir
                  </a>
                </>
              ) : (
                <p className="min-w-0 flex-1 text-[12px] font-medium text-metin-2">
                  <strong className="font-bold text-metin">Belge açılamıyor</strong> —
                  bu raporun dosyası sistemde saklanmamış. Aşağıdaki ölçütler
                  ve bulgular geçerli; belgeyi görmeniz gerekiyorsa
                  koordinasyondan isteyebilirsiniz.
                </p>
              )}
            </div>
          )}

          {/*
            SAĞ SÜTUN: PUANLAMA + YAZIŞMA BİRLİKTE.

            Yazışma gridin ÜÇÜNCÜ hücresiydi; iki sütunlu düzende ikinci
            satırın sol hücresine, yani yapışkan rapor bölmesinin altındaki
            dar şeride düşüyordu. Ekranda belgenin altından taşan, yarısı
            kesik bir mesaj kutusu görünüyordu. İkisi tek bir sütunda:
            rapor solda kalıyor, hakemin yazdığı her şey sağda ve tam
            genişlikte.
          */}
          <div className="flex min-w-0 flex-col gap-4">
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
