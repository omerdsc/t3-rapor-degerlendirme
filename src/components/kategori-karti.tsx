'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { YarismaKategorisi } from '@/lib/depo/tipler';

/**
 * Tek kategori kartı — "bu kategori değerlendirmeye hazır mı?"
 *
 * ÖNCEKİ TASARIMIN SORUNU
 * Kategori bloğu aynı anda dört şey gösteriyordu: ölçüt listesi, şablon
 * kuralları, şartname paneli ve uyarılar. Hepsi açık, hepsi aynı görsel
 * ağırlıkta. Kullanıcı neye bakması gerektiğini bilemiyordu.
 *
 * Şimdi kart üç HAZIRLIK ADIMI gösteriyor ve yalnızca eksik olan adım
 * vurgulanıyor. Ayrıntılar (ölçüt listesi, kurallar) katlanmış duruyor;
 * gerektiğinde açılıyor.
 */

interface Adim {
  ad: string;
  tamam: boolean;
  aciklama: string;
}

export default function KategoriKarti({
  yarismaId,
  kategori,
  raporSayisi,
  takvim,
}: {
  yarismaId: string;
  kategori: YarismaKategorisi;
  raporSayisi: number;
  takvim?: { etiket: string; renk: string; baslik: string } | null;
}) {
  const yonlendir = useRouter();
  const [acik, setAcik] = useState<'olcut' | 'sartname' | 'kural' | null>(null);
  const [calisiyor, setCalisiyor] = useState<string | null>(null);
  const [mesaj, setMesaj] = useState<{ metin: string; hata?: boolean } | null>(null);

  // Yeni ölçüt formu
  const [yeniAd, setYeniAd] = useState('');
  const [yeniPuan, setYeniPuan] = useState('');

  const s = kategori.sartname;
  const rubrik = kategori.rubrik;

  const adimlar: Adim[] = [
    {
      ad: 'Ölçütler',
      tamam: rubrik.kriterler.length >= 3,
      /*
       * BARAJ ÖZET SATIRINDA DA GÖRÜNÜYOR.
       *
       * Eşik "Ölçütler" panelinin içinde, bir tıklama arkasındaydı.
       * Kart kapalıyken bir kategoride baraj olup olmadığı görünmüyordu;
       * koordinasyon "hangi kategorilerde eleme var" sorusunu ancak
       * kategorileri tek tek açarak cevaplayabiliyordu — oysa bu ekranın
       * işi zaten "kategori hazır mı" sorusunu bir bakışta cevaplamak.
       *
       * Baraj yoksa yazılmıyor: eleme olmaması bir eksiklik değil, bir
       * tercih. "Baraj yok" diye bir satır, olmayan bir eksiği duyururdu.
       */
      aciklama:
        `${rubrik.kriterler.length} ölçüt · ${rubrik.toplamPuan} puan`
        + (rubrik.barajPuani ? ` · baraj ${rubrik.barajPuani}` : ''),
    },
    {
      ad: 'Şartname',
      tamam: !!s,
      aciklama: s
        ? `${s.dosyaAdi.slice(0, 30)} · ${s.sayfaSayisi} sayfa`
        : 'yüklenmedi — eleyici kurallar bilinmiyor',
    },
    {
      ad: 'Onay',
      tamam: kategori.duzenlendi,
      aciklama: kategori.duzenlendi
        ? 'yönetici onayladı'
        : 'ölçütler gözden geçirilmedi',
    },
  ];

  const hazir = adimlar.every((a) => a.tamam);

  async function istek(
    yol: string,
    secenek: RequestInit,
    basarili: string,
    etiket: string,
  ) {
    setCalisiyor(etiket);
    setMesaj(null);
    try {
      const yanit = await fetch(yol, secenek);
      const d = await yanit.json().catch(() => ({}));
      if (!yanit.ok) setMesaj({ metin: d.hata ?? 'İşlem başarısız.', hata: true });
      else {
        setMesaj({ metin: d.zatenVar ? 'Zaten hazır.' : basarili });
        yonlendir.refresh();
      }
    } catch (e) {
      setMesaj({ metin: e instanceof Error ? e.message : 'Ağ hatası.', hata: true });
    } finally {
      setCalisiyor(null);
    }
  }

  const govde = (v: unknown) => ({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(v),
  });

  return (
    <div className="rounded-xl border border-cizgi bg-white">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-cizgi px-4 py-3">
        <span
          className={`size-2 shrink-0 rounded-full ${hazir ? 'bg-yesil' : 'bg-amber'}`}
        />
        <h3 className="min-w-0 flex-1 truncate text-[13.5px] font-bold">{kategori.ad}</h3>

        {kategori.asama && !kategori.ad.includes(kategori.asama) && (
          <span className="rounded bg-lacivert px-2 py-0.5 text-[9px] font-bold tracking-wide text-white">
            {kategori.asama}
          </span>
        )}
        {takvim && (
          <span
            className={`rounded px-2 py-0.5 text-[9px] font-bold tracking-wide ${takvim.renk}`}
            title={takvim.baslik}
          >
            {takvim.etiket}
          </span>
        )}
        {raporSayisi > 0 && (
          <span className="text-[11px] font-medium text-metin-2">{raporSayisi} rapor</span>
        )}
        <span
          className={`rounded px-2 py-0.5 text-[9.5px] font-bold tracking-wide ${
            hazir ? 'bg-yesil-zemin text-yesil-koyu' : 'bg-amber-zemin text-amber-koyu'
          }`}
        >
          {hazir ? 'HAZIR' : 'EKSİK ADIM VAR'}
        </span>
      </div>

      {/* ÜÇ ADIM — eksik olan vurgulu, tamam olan sessiz. */}
      <div className="grid gap-2 px-4 py-3 sm:grid-cols-3">
        {adimlar.map((a) => (
          <div
            key={a.ad}
            className={`rounded-lg px-3 py-2 ${
              a.tamam ? 'bg-zemin' : 'bg-amber-zemin'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span
                className={`text-[11px] font-bold ${
                  a.tamam ? 'text-yesil-koyu' : 'text-amber-koyu'
                }`}
              >
                {a.tamam ? '✓' : '!'}
              </span>
              <span className="text-[11.5px] font-bold">{a.ad}</span>
            </div>
            <p className="mt-0.5 text-[10.5px] leading-relaxed font-medium text-metin-2">
              {a.aciklama}
            </p>
          </div>
        ))}
      </div>

      {/* Eksik adımın eylemi burada; tamam olanlar için düğme gösterilmiyor. */}
      <div className="flex flex-wrap items-center gap-2 border-t border-cizgi px-4 py-2.5">
        {!kategori.duzenlendi && (
          <button
            type="button"
            disabled={!!calisiyor}
            onClick={() =>
              istek(
                '/api/kriter',
                {
                  method: 'PATCH',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({
                    yarismaId,
                    kategoriId: kategori.id,
                    onayli: true,
                  }),
                },
                'Ölçütler onaylandı.',
                'onay',
              )
            }
            className="dugme bg-kirmizi px-3 py-1.5 text-[11.5px] font-bold text-white transition-colors hover:bg-kirmizi-koyu disabled:opacity-50"
          >
            {calisiyor === 'onay' ? '…' : 'Ölçütleri onayla'}
          </button>
        )}

        {s && !s.ozet && s.kaynakUrl && (
          <button
            type="button"
            disabled={!!calisiyor}
            onClick={() =>
              istek(
                '/api/sartname',
                {
                  method: 'PATCH',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ yarismaId, kategoriId: kategori.id }),
                },
                'Şartname özeti hazırlandı.',
                'ozet',
              )
            }
            title="Yapay zekâ, şartnameden değerlendirmede kullanılacak maddeleri çıkarır. Kategori başına bir kez."
            className="dugme border border-cizgi px-3 py-1.5 text-[11.5px] font-bold transition-colors hover:bg-zemin disabled:opacity-50"
          >
            {calisiyor === 'ozet' ? 'Hazırlanıyor…' : 'Şartname özetini hazırla'}
          </button>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-3 text-[11.5px] font-bold">
          <button
            type="button"
            onClick={() => setAcik(acik === 'olcut' ? null : 'olcut')}
            className="cursor-pointer text-metin-2 hover:text-metin"
          >
            Ölçütler ({rubrik.kriterler.length})
          </button>
          {s && (
            <button
              type="button"
              onClick={() => setAcik(acik === 'sartname' ? null : 'sartname')}
              className="cursor-pointer text-metin-2 hover:text-metin"
            >
              Şartname {s.ozet ? '· özet hazır' : ''}
            </button>
          )}
          <button
            type="button"
            onClick={() => setAcik(acik === 'kural' ? null : 'kural')}
            className="cursor-pointer text-metin-2 hover:text-metin"
          >
            Rapor kuralları
          </button>
        </div>
      </div>

      {mesaj && (
        <p
          className={`border-t px-4 py-2 text-[11.5px] font-semibold ${
            mesaj.hata
              ? 'border-kirmizi/25 bg-kirmizi-zemin text-kirmizi-koyu'
              : 'border-yesil/25 bg-yesil-zemin text-yesil-koyu'
          }`}
        >
          {mesaj.metin}
        </p>
      )}

      {acik === 'olcut' && (
        <div className="border-t border-cizgi bg-zemin/40 px-4 py-3">
          <ul className="mb-2.5 flex flex-col gap-1">
            {rubrik.kriterler.map((k) => (
              <li
                key={k.kod}
                className="flex items-center gap-2 rounded-md bg-white px-2.5 py-1.5"
              >
                <span className="w-10 shrink-0 text-[12px] font-extrabold">{k.puan}</span>
                <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium">
                  {k.ad}
                </span>
                {!k.bolumBekleniyor && (
                  <span
                    className="shrink-0 rounded bg-zemin px-1.5 py-0.5 text-[9px] font-bold text-metin-2"
                    title="Bu ölçüt için raporda ayrı bir bölüm beklenmiyor"
                  >
                    BÖLÜM YOK
                  </span>
                )}
                <button
                  type="button"
                  disabled={!!calisiyor}
                  onClick={() =>
                    istek(
                      '/api/kriter',
                      {
                        method: 'DELETE',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({
                          yarismaId,
                          kategoriId: kategori.id,
                          kod: k.kod,
                        }),
                      },
                      'Ölçüt kaldırıldı.',
                      `sil-${k.kod}`,
                    )
                  }
                  className="shrink-0 cursor-pointer text-[11px] font-bold text-metin-3 hover:text-kirmizi disabled:opacity-50"
                  title="Ölçütü kaldır"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>

          {/* Kendi ölçütünü ekleme her zaman görünür: koordinasyon sonradan
              ölçüt getirebiliyor ve bu istisna değil, olağan durum. */}
          <div className="flex flex-wrap items-center gap-2 border-t border-cizgi pt-2.5">
            <input
              value={yeniAd}
              onChange={(e) => setYeniAd(e.target.value)}
              placeholder="Yeni ölçüt adı (ör. Etik beyan)"
              className="min-w-[180px] flex-1 rounded-lg border border-cizgi bg-white px-3 py-1.5 text-[12px] font-medium outline-none focus:border-metin-3"
            />
            <input
              value={yeniPuan}
              onChange={(e) => setYeniPuan(e.target.value)}
              placeholder="Puan"
              inputMode="numeric"
              className="w-20 rounded-lg border border-cizgi bg-white px-3 py-1.5 text-[12px] font-medium outline-none focus:border-metin-3"
            />
            <button
              type="button"
              disabled={!yeniAd.trim() || !yeniPuan || !!calisiyor}
              onClick={async () => {
                await istek(
                  '/api/kriter',
                  govde({
                    yarismaId,
                    kategoriId: kategori.id,
                    ad: yeniAd.trim(),
                    puan: Number(yeniPuan),
                  }),
                  'Ölçüt eklendi.',
                  'ekle',
                );
                setYeniAd('');
                setYeniPuan('');
              }}
              className="dugme bg-lacivert px-3 py-1.5 text-[11.5px] font-bold text-white transition-colors hover:bg-lacivert-2 disabled:opacity-50"
            >
              {calisiyor === 'ekle' ? '…' : 'Ölçüt ekle'}
            </button>
          </div>

          {rubrik.toplamPuan !== 100 && (
            <p className="mt-2 text-[10.5px] leading-relaxed font-medium text-amber-koyu">
              Ölçüt toplamı {rubrik.toplamPuan} puan, 100 değil. Şablon
              ağırlıkları vermemişse eşit dağıtılmış olabilir — gerçek
              ağırlıklar şartnamede olabilir.
            </p>
          )}

          {/*
            BARAJ ÖLÇÜTLERİN ALTINDA, ÇÜNKÜ ONLARA BAĞLI.
            Eşiğin anlamı toplam puana göre değişiyor; 70, toplamı 100
            olan bir rubrikte başka, 85 olanda başka bir şey demek.
            Ayrı bir sekmeye konsaydı koordinasyon eşiği neye göre
            belirlediğini görmeden yazardı.
          */}
          <div className="mt-3 border-t border-cizgi pt-3">
            <Baraj
              yarismaId={yarismaId}
              kategoriId={kategori.id}
              mevcut={rubrik.barajPuani}
              toplamPuan={rubrik.toplamPuan}
              istek={istek}
              calisiyor={calisiyor === 'baraj'}
            />
          </div>
        </div>
      )}

      {acik === 'sartname' && s && (
        <div className="border-t border-cizgi bg-zemin/40 px-4 py-3">
          <p className="mb-2 text-[11.5px] font-medium text-metin-2">
            {s.dosyaAdi} · {s.sayfaSayisi} sayfa · {s.kelimeSayisi.toLocaleString('tr')} kelime
            {s.teknikMi && (
              <span className="ml-1.5 rounded bg-yesil-zemin px-1.5 py-0.5 text-[9px] font-bold text-yesil-koyu">
                TEKNİK ŞARTNAME
              </span>
            )}
          </p>

          {s.kurallar.eleyiciHukumler.length > 0 && (
            <details className="mb-2 rounded-lg bg-kirmizi-zemin px-3 py-2">
              <summary className="cursor-pointer text-[11px] font-bold text-kirmizi-koyu">
                {s.kurallar.eleyiciHukumler.length} eleyici hüküm
              </summary>
              <ul className="mt-1.5 flex flex-col gap-1">
                {s.kurallar.eleyiciHukumler.map((h, i) => (
                  <li key={i} className="text-[10.5px] leading-relaxed text-kirmizi-koyu/90">
                    • {h}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {s.ozet ? (
            <div className="flex flex-col gap-2.5 rounded-lg border border-mavi/25 bg-mavi-zemin/50 px-3 py-2.5">
              <p className="text-[10.5px] font-bold text-mavi-koyu">
                Değerlendirmede kullanılan özet — yapay zekâ her raporda bunu
                okuyor
              </p>
              {(
                [
                  ['Yarışmanın amacı', s.ozet.yarismaninAmaci],
                  ['Teknik beklentiler', s.ozet.teknikBeklentiler],
                  ['Katı kısıtlar', s.ozet.katiKisitlar],
                  ['Eleyici durumlar', s.ozet.eleyiciDurumlar],
                  ['Hakem notları', s.ozet.hakemNotlari],
                ] as Array<[string, string[]]>
              )
                .filter(([, l]) => l?.length)
                .map(([baslik, l]) => (
                  <div key={baslik}>
                    <h5 className="mb-1 text-[10px] font-bold tracking-wide text-mavi-koyu">
                      {baslik.toLocaleUpperCase('tr')}
                    </h5>
                    <ul className="flex flex-col gap-0.5">
                      {l.map((x, i) => (
                        <li key={i} className="text-[10.5px] leading-relaxed text-metin">
                          • {x}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-[11.5px] leading-relaxed font-medium text-metin-2">
              Özet henüz hazırlanmadı. Hazırlanmadığı sürece ilk rapor
              değerlendirmesinde <strong className="font-bold">kendiliğinden</strong>{' '}
              üretilir; şimdi hazırlamak istersen yukarıdaki düğmeyi kullan.
            </p>
          )}

          {s.catismalar.map((c, i) => (
            <p key={i} className="mt-1.5 text-[10.5px] font-bold text-amber-koyu">
              ⚠ {c}
            </p>
          ))}
        </div>
      )}

      {acik === 'kural' && (
        <div className="border-t border-cizgi bg-zemin/40 px-4 py-3">
          <dl className="grid gap-x-6 gap-y-1 text-[11.5px] sm:grid-cols-2">
            {[
              ['Sayfa sayısı', `${kategori.sablon.asgariSayfa ?? '—'} – ${kategori.sablon.azamiSayfa ?? '—'}`],
              ['Yazı tipi', `${kategori.kurallar.yaziTipi ?? '—'} ${kategori.kurallar.govdePunto ?? ''}`],
              ['Kaynakça bölümü', kategori.sablon.kaynakca?.adlar[0] ?? 'tanımsız'],
              ['Atıf biçimi', kategori.kurallar.atifBicimi ?? '—'],
              ['Şablon dosyası', kategori.sablonDosyasi],
              ['Beklenen bölüm', `${kategori.sablon.basliklar.length} başlık`],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="w-[116px] shrink-0 font-medium text-metin-2">{k}</dt>
                <dd className="min-w-0 truncate font-semibold">{v}</dd>
              </div>
            ))}
          </dl>

          {kategori.kurallar.eleyiciMi && (
            <p className="mt-2 rounded-md bg-kirmizi-zemin px-2.5 py-1.5 text-[11px] font-bold text-kirmizi-koyu">
              Şablona uymayan rapor değerlendirilmiyor (eleyici hüküm).
            </p>
          )}

          {kategori.uyarilar.map((u, i) => (
            <p key={i} className="mt-1.5 text-[10.5px] leading-relaxed font-medium text-amber-koyu">
              ⚠ {u}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Baraj puanı girişi.
 *
 * ── NİYE MODÜL DÜZEYİNDE ────────────────────────────────────────────────
 * Kart fonksiyonunun İÇİNDE tanımlansaydı her çizimde yeni bir bileşen
 * tipi olurdu ve React onu her seferinde baştan bağlardı — kullanıcı
 * yazarken alanın odağı kaçardı.
 *
 * ── NİYE BOŞ BIRAKILABİLİR ──────────────────────────────────────────────
 * Baraj zorunlu değil. Bir yarışmada eleme olmayabilir ve o zaman
 * sistemin kimseyi elememesi gerekir. Varsayılan bir eşik konsaydı
 * (örneğin 50), koordinasyon farkında olmadan bir eleme kuralı
 * yürürlüğe koymuş olurdu.
 */
function Baraj({
  yarismaId,
  kategoriId,
  mevcut,
  toplamPuan,
  istek,
  calisiyor,
}: {
  yarismaId: string;
  kategoriId: string;
  mevcut?: number;
  toplamPuan: number;
  istek: (yol: string, secenek: RequestInit, basarili: string, etiket: string) => Promise<void>;
  calisiyor: boolean;
}) {
  const [deger, setDeger] = useState(mevcut ? String(mevcut) : '');

  const sayi = Number(deger.replace(',', '.'));
  const gecerli = deger.trim() !== '' && Number.isFinite(sayi) && sayi > 0 && sayi <= toplamPuan;
  const degisti = (mevcut ?? null) !== (gecerli ? sayi : null);

  function gonder(puan: number | null) {
    void istek(
      '/api/kriter',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ yarismaId, kategoriId, barajPuani: puan }),
      },
      puan === null ? 'Baraj kaldırıldı.' : `Baraj ${puan} puan olarak ayarlandı.`,
      'baraj',
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold">Baraj puanı</span>
        <div className="flex items-center gap-1.5">
          <input
            value={deger}
            onChange={(e) => setDeger(e.target.value)}
            inputMode="decimal"
            placeholder="—"
            className="w-[64px] rounded-md border border-cizgi bg-white px-2 py-1 text-center font-mono text-[12px] font-bold outline-none focus:border-metin-3"
          />
          <span className="font-mono text-[11px] font-bold text-metin-3">
            /{toplamPuan}
          </span>
        </div>
        <button
          type="button"
          disabled={calisiyor || !gecerli || !degisti}
          onClick={() => gonder(sayi)}
          className="dugme border border-cizgi px-3 py-1 text-[11.5px] font-bold text-metin hover:bg-zemin disabled:opacity-40"
        >
          {calisiyor ? '…' : 'Kaydet'}
        </button>
        {mevcut !== undefined && (
          <button
            type="button"
            disabled={calisiyor}
            onClick={() => {
              setDeger('');
              gonder(null);
            }}
            className="cursor-pointer text-[11px] font-bold text-metin-3 hover:text-kirmizi disabled:opacity-40"
          >
            Barajı kaldır
          </button>
        )}
      </div>

      <p className="mt-1.5 max-w-[70ch] text-[10.5px] leading-relaxed font-medium text-metin-3">
        {mevcut === undefined
          ? 'Boş bırakılırsa eleme yapılmaz. Girilirse yarışmacı, bütün '
            + 'hakemler değerlendirmeyi bitirdikten sonra barajı geçip '
            + 'geçmediğini kendi sayfasında görür.'
          : `Nihai puanı ${mevcut} ve üzeri olan yarışmacılar geçer. Sonuç, `
            + 'yalnızca atanmış bütün hakemler bitirdikten sonra yayımlanır.'}
      </p>
    </>
  );
}
