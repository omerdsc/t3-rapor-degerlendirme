'use client';

import { useEffect, useState } from 'react';
import { bekleyenHakemler } from '@/lib/db/yazisma-durum';
import type { Mesaj } from '@/lib/depo/tipler';

/**
 * Rapor üzerindeki yazışma — iki kanal.
 *
 *   Koordinasyon · Hakem ile koordinasyon arasında, özel. Öteki hakemler
 *                  görmez.
 *   Hakem kurulu · Aynı rapora atanmış hakemler + koordinasyon.
 *
 * ── ROL SEÇİCİ KALDIRILDI ───────────────────────────────────────────────
 * Önceki sürümde gönderen kendi adını yazıp kendi rolünü SEÇİYORDU. Bir
 * denetim izinde bunun değeri sıfır: herkes "hakem" olarak yazabiliyordu.
 * Artık rol kimlik doğrulamadan geliyor.
 *
 * ── KURUL NİYE KİLİTLİ BAŞLIYOR ─────────────────────────────────────────
 * Atanmış bütün hakemler puanlamayı bitirene kadar kapalı. Çok hakemli
 * değerlendirmenin değeri hakemlerin BİRBİRİNDEN HABERSİZ bakmasından
 * geliyor; erken konuşulursa ölçtüğümüz ayrışma anlamını yitirir.
 *
 * Kilit sunucuda da var — bu bileşen kutuyu gizliyor, ama gizlenmiş bir
 * kutu kapatılmış bir kapı değildir.
 */

const ROL_ETIKET: Record<Mesaj['rol'], string> = {
  hakem: 'Hakem',
  koordinasyon: 'Koordinasyon',
  yarisma_yoneticisi: 'Yarışma Yöneticisi',
  sistem: 'Sistem',
};

const ROL_SINIF: Record<Mesaj['rol'], string> = {
  hakem: 'bg-mor-zemin text-mor',
  koordinasyon: 'bg-mavi-zemin text-mavi-koyu',
  yarisma_yoneticisi: 'bg-amber-zemin text-amber-koyu',
  sistem: 'bg-zemin text-metin-2',
};

function neZaman(iso: string): string {
  const dk = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (dk < 1) return 'az önce';
  if (dk < 60) return `${dk} dk önce`;
  if (dk < 1440) return `${Math.floor(dk / 60)} saat önce`;
  return new Date(iso).toLocaleDateString('tr', { day: 'numeric', month: 'long' });
}

interface Hakem {
  id: string;
  ad: string;
}

interface KurulDurumu {
  acik: boolean;
  hakemSayisi: number;
  bitiren: number;
}

export default function Yazisma({
  raporId,
  baslangic,
  kod,
}: {
  raporId: string;
  baslangic: Mesaj[];
  /** Hakem erişim kodu. Verilirse hakem tarafındayız. */
  kod?: string;
}) {
  const hakemTarafi = !!kod;
  const [mesajlar, setMesajlar] = useState<Mesaj[]>(baslangic);
  const [kurul, setKurul] = useState<KurulDurumu | null>(null);
  const [kanal, setKanal] = useState<'koordinasyon' | 'kurul'>('koordinasyon');
  /* Rapora atanmış hakemler — sunucu bu listeyi yalnızca koordinasyona veriyor. */
  const [hakemler, setHakemler] = useState<Hakem[]>([]);
  /* Koordinasyonun muhatabı; boşsa mesaj herkese açık duyuru oluyor. */
  const [hedef, setHedef] = useState('');
  const [metin, setMetin] = useState('');
  const [yazar, setYazar] = useState('');
  const [calisiyor, setCalisiyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  /*
   * İlk yüklemede sunucudan çekiliyor: sayfanın verdiği `baslangic`
   * KANALA GÖRE SÜZÜLMEMİŞ olabilir. Hakem tarafında bu, öteki hakemin
   * özel mesajını göstermek demek olurdu — kanal süzgeci sunucuda ve
   * doğru liste oradan geliyor.
   */
  useEffect(() => {
    let iptal = false;
    const q = kod ? `?kod=${encodeURIComponent(kod)}` : '';
    (async () => {
      try {
        const y = await fetch(`/api/rapor/${raporId}/mesaj${q}`);
        const d = await y.json();
        if (iptal || !y.ok) return;
        setMesajlar(d.mesajlar ?? []);
        setKurul(d.kurul ?? null);
        setHakemler(d.hakemler ?? []);
        /*
         * Bekleyen soru varsa muhatap KENDİLİĞİNDEN o hakem oluyor.
         * Koordinasyon bildirime tıklayıp geldiğinde bir de doğru
         * yazışmayı araması gerekmesin — soruyu soran zaten belli.
         */
        const hakemListesi: Hakem[] = d.hakemler ?? [];
        /*
         * Bildirimden gelindiyse hangi hakem olduğu adreste yazıyor;
         * o ipucu kendi tahminimizden önce geliyor. Tanınmayan bir
         * kimlik sessizce yok sayılıyor — elle düzenlenmiş bir adres
         * yüzünden boş sohbet açılmasın.
         */
        const ipucu = new URLSearchParams(window.location.search).get('hakem');
        const bekleyen = [...bekleyenHakemler(d.mesajlar ?? [])];
        if (ipucu && hakemListesi.some((h) => h.id === ipucu)) setHedef(ipucu);
        else if (bekleyen.length) setHedef(bekleyen[0]);
      } catch {
        // Ağ hatası: sayfanın verdiği liste duruyor.
      }
    })();
    return () => {
      iptal = true;
    };
  }, [raporId, kod]);

  const kurulAcik = kurul?.acik ?? false;
  const cokHakem = hakemler.length > 1;
  /* Muhatap seçimi yalnızca koordinasyon tarafında ve çok hakemli raporda. */
  const secim = !hakemTarafi && kanal === 'koordinasyon' && cokHakem ? hedef : '';
  const bekleyenler = bekleyenHakemler(mesajlar);
  const adiyla = (id: string) => hakemler.find((h) => h.id === id)?.ad ?? id;

  const kanallik = mesajlar
    .filter((m) => (m.kanal ?? 'koordinasyon') === kanal)
    /*
     * Bir hakem seçiliyse liste O HAKEMİN GÖRDÜĞÜNE iniyor: kendi
     * yazışması, herkese açık duyurular ve sistem notları — sunucudaki
     * `hakeminGorebilecekleri` kuralının aynısı. Hepsi iç içe
     * gösterilseydi koordinasyon kime cevap yazdığını bilemezdi.
     */
    .filter(
      (m) => !secim || m.rol === 'sistem' || !m.hakemId || m.hakemId === secim,
    );

  /* Cevap bekliyor mu — sunucudaki kuralın aynısı. */
  const insan = kanallik.filter((m) => m.rol !== 'sistem' && !m.otomatikMi);
  const sonInsan = insan.length
    ? insan.reduce((a, b) => (a.tarih >= b.tarih ? a : b))
    : null;
  const cevapBekliyor = kanal === 'koordinasyon' && sonInsan?.rol === 'hakem';

  async function gonder() {
    setCalisiyor(true);
    setHata(null);
    try {
      const y = await fetch(`/api/rapor/${raporId}/mesaj`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metin,
          kanal,
          ...(kod ? { kod } : { yazar }),
          /* Kurul kanalı zaten herkese açık — orada muhatap seçimi yok. */
          ...(secim ? { alici: secim } : {}),
        }),
      });
      const d = await y.json();
      if (!y.ok) setHata(d.hata ?? 'Mesaj gönderilemedi.');
      else {
        setMesajlar(d.mesajlar ?? []);
        setKurul(d.kurul ?? null);
        setMetin('');
      }
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Ağ hatası.');
    } finally {
      setCalisiyor(false);
    }
  }

  /* Kurul sekmesi yalnızca çok hakemli raporda anlamlı. */
  const kurulVar = (kurul?.hakemSayisi ?? 0) > 1;

  return (
    <section className="mb-4 overflow-hidden rounded-xl border border-cizgi bg-white">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-cizgi px-4 py-2.5">
        {(
          [
            ['koordinasyon', hakemTarafi ? 'Koordinasyona sor' : 'Hakem yazışması'],
            ['kurul', 'Hakem kurulu'],
          ] as Array<['koordinasyon' | 'kurul', string]>
        )
          .filter(([k]) => k === 'koordinasyon' || kurulVar)
          .map(([k, etiket]) => {
            const sayi = mesajlar.filter(
              (m) => (m.kanal ?? 'koordinasyon') === k,
            ).length;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setKanal(k)}
                className={`cursor-pointer rounded-lg px-3 py-1.5 text-[12px] font-bold transition-colors ${
                  kanal === k
                    ? 'bg-lacivert text-white'
                    : 'text-metin-2 hover:bg-zemin'
                }`}
              >
                {etiket}
                {sayi > 0 && (
                  <span
                    className={kanal === k ? 'text-white/70' : 'text-metin-3'}
                  >
                    {' '}
                    {sayi}
                  </span>
                )}
                {k === 'kurul' && !kurulAcik && ' 🔒'}
              </button>
            );
          })}

        {cevapBekliyor && (
          <span
            className={`ml-auto rounded px-2 py-0.5 text-[9.5px] font-bold tracking-wide ${
              hakemTarafi
                ? 'bg-mavi-zemin text-mavi-koyu'
                : 'bg-amber-zemin text-amber-koyu'
            }`}
          >
            {hakemTarafi ? 'CEVAP BEKLENİYOR' : 'HAKEM CEVAP BEKLİYOR'}
          </span>
        )}
      </div>

      {/* Kanalın ne olduğunu söyleyen tek satır — sekme adı yetmiyor. */}
      <p className="border-b border-cizgi bg-zemin/50 px-4 py-2 text-[10.5px] leading-relaxed font-medium text-metin-2">
        {kanal === 'koordinasyon'
          ? hakemTarafi
            ? 'Yalnızca siz ve koordinasyon görüyor. Öteki hakemler bu yazışmayı göremez.'
            : cokHakem
              ? secim
                ? `${adiyla(secim)} ile özel yazışma. Öteki hakemler görmez.`
                : 'Duyuru kipi: yazdığınızı atanmış bütün hakemler görür. Tek '
                  + 'hakeme yazmak için yukarıdan seçin.'
              : 'Hakemin size yazdığı özel kanal. Yarışmacı görmez.'
          : `Bu rapora atanmış ${kurul?.hakemSayisi ?? 0} hakem ve koordinasyon görüyor.`}
      </p>

      {/*
        * MUHATAP SEÇİCİ — yalnızca koordinasyonda, çok hakemli raporda.
        *
        * Tek hakemli raporda seçenek yok: kimliksiz mesajı zaten o tek
        * hakem görüyor. İki hakemliden itibaren "kime" sorusu gerçek bir
        * soru oluyor ve arayüz onu sormalı; yoksa koordinasyon A'ya
        * yazdığını sanırken ikisine birden yazmış olur.
        */}
      {!hakemTarafi && kanal === 'koordinasyon' && cokHakem && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-cizgi px-4 py-2">
          <span className="mr-0.5 text-[9.5px] font-bold tracking-wide text-metin-3">
            MUHATAP
          </span>
          {([{ id: '', ad: 'Hepsi (duyuru)' }, ...hakemler] as Hakem[]).map((h) => (
            <button
              key={h.id || 'hepsi'}
              type="button"
              onClick={() => setHedef(h.id)}
              className={`flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${
                hedef === h.id
                  ? 'bg-mavi-zemin text-mavi-koyu'
                  : 'text-metin-2 hover:bg-zemin'
              }`}
            >
              {h.ad}
              {bekleyenler.has(h.id) && (
                <span
                  className="size-1.5 rounded-full bg-kirmizi"
                  title="Cevap bekleyen sorusu var"
                />
              )}
            </button>
          ))}
        </div>
      )}

      {kanal === 'kurul' && !kurulAcik ? (
        /*
         * KİLİTLİ DURUM SEBEBİNİ SÖYLÜYOR.
         * "Kapalı" demek yetmez — kullanıcı ne zaman açılacağını ve NİYE
         * kapalı olduğunu bilmezse arayüzü bozuk sanır.
         */
        <div className="px-4 py-6 text-center">
          <p className="text-[12.5px] font-bold">Kurul yazışması henüz kapalı</p>
          <p className="mx-auto mt-1.5 max-w-[52ch] text-[11.5px] leading-relaxed font-medium text-metin-2">
            {kurul
              ? `${kurul.bitiren}/${kurul.hakemSayisi} hakem değerlendirmesini tamamladı. `
              : ''}
            Hakemler birbirini etkilemesin diye tartışma, atanmış bütün
            hakemler puanlamayı bitirdikten sonra açılıyor —{' '}
            <strong className="font-semibold text-metin">
              bağımsız değerlendirme önce, tartışma sonra
            </strong>
            . Acil bir durum varsa koordinasyon kanalını kullanabilirsiniz.
          </p>
        </div>
      ) : (
        <>
          {!!kanallik.length && (
            <ul className="flex max-h-[340px] flex-col gap-2 overflow-y-auto px-4 py-3">
              {kanallik.map((m) => (
                <li
                  key={m.id}
                  className={`rounded-lg px-3 py-2 ${
                    m.rol === 'sistem' || m.otomatikMi
                      ? 'bg-zemin/60'
                      : 'border border-cizgi bg-white'
                  }`}
                >
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wide ${ROL_SINIF[m.rol]}`}
                    >
                      {ROL_ETIKET[m.rol].toLocaleUpperCase('tr')}
                    </span>
                    <span className="text-[11px] font-semibold">{m.yazar}</span>
                    {/*
                      * Koordinasyonun yazdığı mesajda "kime" bilgisi
                      * metinde yok — etikette. Hakemin kendi mesajında
                      * gereksiz: yazar adı zaten onu söylüyor.
                      */}
                    {!hakemTarafi
                      && kanal === 'koordinasyon'
                      && cokHakem
                      && m.rol !== 'sistem'
                      && m.rol !== 'hakem' && (
                        <span className="rounded bg-zemin px-1.5 py-0.5 text-[9px] font-semibold text-metin-3">
                          {m.hakemId ? `→ ${adiyla(m.hakemId)}` : 'duyuru'}
                        </span>
                      )}
                    <span className="ml-auto text-[10px] font-medium text-metin-3">
                      {neZaman(m.tarih)}
                    </span>
                  </div>
                  <p className="text-[11.5px] leading-relaxed whitespace-pre-wrap text-metin">
                    {m.metin}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-cizgi px-4 py-3">
            <textarea
              value={metin}
              onChange={(e) => setMetin(e.target.value)}
              rows={2}
              placeholder={
                kanal === 'kurul'
                  ? 'Öteki hakemlere yazın — puanınızı nasıl gerekçelendirdiğiniz…'
                  : hakemTarafi
                    ? 'Bu rapor hakkında koordinasyona sormak istediğiniz…'
                    : secim
                      ? `${adiyla(secim)} için yanıtınız ya da notunuz…`
                      : cokHakem
                        ? 'Atanmış bütün hakemlere duyuru…'
                        : 'Hakeme yanıtınız ya da notunuz…'
              }
              className="w-full rounded-lg border border-cizgi px-3 py-2 text-[12px] font-medium outline-none focus:border-metin-3"
            />

            <div className="mt-2 flex flex-wrap items-center gap-2.5">
              {!hakemTarafi && (
                <input
                  value={yazar}
                  onChange={(e) => setYazar(e.target.value)}
                  placeholder="Adınız (isteğe bağlı)"
                  className="w-[168px] rounded-lg border border-cizgi px-2.5 py-1.5 text-[11.5px] font-medium outline-none focus:border-metin-3"
                />
              )}

              <button
                type="button"
                disabled={calisiyor || metin.trim().length < 2}
                onClick={gonder}
                className="dugme bg-lacivert px-4 py-1.5 text-[12px] font-bold text-white transition-colors hover:bg-lacivert-2 disabled:opacity-50"
              >
                {calisiyor
                  ? 'Gönderiliyor…'
                  : kanal === 'kurul'
                    ? 'Kurula gönder'
                    : hakemTarafi
                      ? 'Koordinasyona gönder'
                      : !secim && cokHakem
                        ? 'Duyuru gönder'
                        : 'Yanıtla'}
              </button>

              <span className="text-[10.5px] font-medium text-metin-3">
                Yarışmacıya gösterilmez.
              </span>
            </div>

            {hata && (
              <p className="mt-2 rounded-md bg-kirmizi-zemin px-3 py-2 text-[11.5px] font-semibold text-kirmizi-koyu">
                {hata}
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
