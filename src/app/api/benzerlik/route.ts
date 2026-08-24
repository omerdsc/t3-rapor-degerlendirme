/**
 * MVP 5 — Benzerlik / kopya taraması.
 *
 * Kategorideki bütün raporların parmakizleri karşılaştırılır ve doğal
 * benzerlik tabanının belirgin üstündeki çiftler döndürülür.
 *
 * MALİYET: $0. Yapay zekâ çağrısı yok; MinHash, kapsama oranı ve algısal
 * görsel hash'i tamamen yerel çalışıyor.
 *
 * NEDEN SABİT EŞİK YOK
 * Aynı kategorideki raporlar zaten ortak terminoloji taşır — "İHA", "görev
 * yükü", "YOLOv8" her raporda geçer. Sabit bir eşik ya her çifti işaretler
 * ya hiçbirini. Motor her kategorinin kendi tabanını hesaplayıp eşiği
 * taban + 3×MAD alıyor; işaretlenen çift "bu kategoride olağandışı derecede
 * benzer" demektir.
 *
 * MASKELEME BURADA UYGULANIYOR
 * Ekran gerçek yarışmacı raporlarını yan yana koyuyor. Takım adı hem üst
 * veride hem eşleşen cümlelerin İÇİNDE geçebiliyor ("XYZ Takımı olarak…");
 * ikisi de maskeleniyor. Maskeleme sunucu tarafında yapılıyor: istemciye
 * hiç gerçek ad gönderilmiyor, tarayıcı geliştirici aracıyla bile
 * görülemesin.
 */

import { kapi } from '@/lib/yetki/koordinasyon';
import {
  ciftKarsilastir, korpusTara, type CiftSonucu, type Parmakizi,
} from '@/lib/analiz/benzerlik';
import { parmakiziCoz } from '@/lib/analiz/parmakizi-depo';
import {
  kategoriGetir, parmakizliRaporlar, raporGetir, raporlariListele, yarismaGetir,
} from '@/lib/depo/depo';
import { maskelemeAcikMi, metindeMaskele, raporuMaskele } from '@/lib/depo/maskele';

/** 100 raporlu kategoride 4.950 çift — yerel hesap ama anlık değil. */
export const maxDuration = 120;

interface RaporBasligi {
  id: string;
  takim: string;
  /** Aynı takımın iki raporunu ayırt eder — devam projelerinde şart. */
  raporKodu: string;
  basvuruNo: string;
  proje: string;
  kategoriAdi: string;
  yuklendi: string;
}

export async function GET(request: Request) {
  const yetkisiz = kapi(request);
  if (yetkisiz) return yetkisiz;

  const q = new URL(request.url).searchParams;
  const yarismaId = q.get('yarisma');
  const kategoriId = q.get('kategori');
  // Tek rapora odaklı görünüm: yalnızca bu raporun çiftleri döner.
  const raporId = q.get('rapor');

  if (!yarismaId) {
    return Response.json({ hata: 'Yarışma seçilmedi.' }, { status: 400 });
  }
  const yarisma = yarismaGetir(yarismaId);
  if (!yarisma) return Response.json({ hata: 'Yarışma bulunamadı.' }, { status: 404 });

  const raporlar = raporlariListele(yarismaId, kategoriId ?? undefined);

  /*
   * ── PARMAK İZLERİ AYRI TABLODAN OKUNUYOR ─────────────────────────────
   * Burada eskiden `raporlar.filter((r) => r.parmakizi)` vardı ve HİÇBİR
   * ZAMAN eşleşmiyordu: parmak izleri rapor başına ~40 KB olduğu için
   * ayrı tabloya taşındı ve `raporlariListele()` onları getirmiyor —
   * liste ekranlarına gereksiz yük olurdu.
   *
   * Sonuç: bu ekran SQLite göçünden beri her kategoride "karşılaştırılacak
   * çift yok" diyordu. Rapor sayfalarındaki benzerlik bulguları yükleme
   * anında üretildiği için duruyordu; karşılaştırma ekranı boştu ve
   * kimse fark etmemişti.
   *
   * `parmakizliRaporlar()` parmak izi tablosuyla JOIN yapıyor.
   */
  const parmakizliler = parmakizliRaporlar(yarismaId, kategoriId ?? undefined);
  const parmakizsiz = raporlar.length - parmakizliler.length;

  if (parmakizliler.length < 2) {
    return Response.json({
      isaretliler: [],
      tabanlar: {},
      toplamCift: 0,
      raporSayisi: raporlar.length,
      parmakizsiz,
      maskeli: maskelemeAcikMi(),
      not: 'Karşılaştırma için en az iki çözümlenmiş rapor gerekir.',
    });
  }

  const izler: Parmakizi[] = parmakizliler.map((x) => parmakiziCoz(x.parmakizi));
  const korpus = korpusTara(izler);

  /*
   * TEK RAPOR ODAĞI
   *
   * korpusTara yalnızca eşiği geçen çiftleri döndürüyor. Bir rapor sayfasında
   * "bu raporun en benzer olduğu raporlar" göstermek istediğimizde eşiği
   * geçmeyen çiftler de gerekiyor: hakem "hiçbir şey bulunmadı" ile "en
   * yakını %12" arasındaki farkı görmeli. Bu yüzden odaklı istekte çiftler
   * yeniden hesaplanıyor ve en yakın beş tanesi eklenıyor.
   */
  let ciftler: CiftSonucu[] = korpus.isaretliler;
  if (raporId) {
    const odak = izler.find((i) => i.raporId === raporId);
    if (!odak) return Response.json({ hata: 'Rapor bulunamadı.' }, { status: 404 });
    ciftler = izler
      .filter((i) => i.raporId !== raporId)
      .map((i) => ciftKarsilastir(odak, i))
      .sort((a, b) => Math.max(b.kapsama, b.metinOrani) - Math.max(a.kapsama, a.metinOrani))
      .slice(0, 5);
  }

  const baslikHaritasi = new Map<string, RaporBasligi>();
  const adEslemesi: Array<{ ad: string; rumuz: string }> = [];
  for (const r of raporlar) {
    const m = raporuMaskele(r);
    const kategori = kategoriGetir(yarismaId, r.kategoriId);
    baslikHaritasi.set(r.id, {
      id: r.id,
      takim: m.takim,
      raporKodu: m.raporKodu,
      basvuruNo: m.basvuruNo,
      proje: r.proje,
      kategoriAdi: kategori?.ad ?? '—',
      yuklendi: r.yuklendi,
    });
    if (m.maskeli && r.takim && r.takim !== 'Belirtilmemiş') {
      adEslemesi.push({ ad: r.takim, rumuz: m.takim });
    }
  }

  const cikti = ciftler.map((c) => ({
    ...c,
    a: baslikHaritasi.get(c.aId) ?? null,
    b: baslikHaritasi.get(c.bId) ?? null,
    // Eşleşen cümleler rapor gövdesinden geliyor; takım adı içinde geçebilir.
    cumleEslesmeleri: c.cumleEslesmeleri.map((e) => ({
      ...e,
      a: { ...e.a, metin: metindeMaskele(e.a.metin, adEslemesi) },
      b: { ...e.b, metin: metindeMaskele(e.b.metin, adEslemesi) },
    })),
  }));

  return Response.json({
    isaretliler: cikti,
    tabanlar: korpus.tabanlar,
    toplamCift: korpus.toplamCift,
    raporSayisi: raporlar.length,
    parmakizsiz,
    maskeli: maskelemeAcikMi(),
    odakli: !!raporId,
  });
}

/**
 * Tek raporun kopya kontrolünü yeniden koşup kaydına yazar.
 *
 * Kontroller yükleme anında koşuyor ama benzerlik KORPUSA bağlı: yeni bir
 * rapor yüklendiğinde eski raporların benzerlik durumu da değişebilir.
 * Bu uç, bir raporun bulgusunu güncel korpusa göre tazeler.
 */
export async function POST(request: Request) {
  const yetkisiz = kapi(request);
  if (yetkisiz) return yetkisiz;

  let govde: { raporId?: string };
  try {
    govde = await request.json();
  } catch {
    return Response.json({ hata: 'İstek okunamadı.' }, { status: 400 });
  }
  if (!govde.raporId) return Response.json({ hata: 'Rapor seçilmedi.' }, { status: 400 });

  const rapor = raporGetir(govde.raporId);
  if (!rapor) return Response.json({ hata: 'Rapor bulunamadı.' }, { status: 404 });
  if (!rapor.parmakizi) {
    return Response.json(
      { hata: 'Bu raporun parmakizi yok; muhtemelen taranmış veya okunamadı.' },
      { status: 422 },
    );
  }

  const izler = raporlariListele(rapor.yarismaId, rapor.kategoriId)
    .filter((r) => r.parmakizi)
    .map((r) => parmakiziCoz(r.parmakizi!));

  const { benzerlikKontrolu } = await import('@/lib/analiz/benzerlik');
  // Bulgu metinlerinde ham kimlik değil maskeli rumuz görünsün.
  const adlar = new Map(
    raporlariListele(rapor.yarismaId, rapor.kategoriId).map((r) => [
      r.id,
      `${raporuMaskele(r).takim} ${raporuMaskele(r).raporKodu}`,
    ]),
  );
  const kontrol = benzerlikKontrolu(
    rapor.id,
    korpusTara(izler),
    (id) => adlar.get(id) ?? id,
  );

  const { raporGuncelle } = await import('@/lib/depo/depo');
  const digerleri = rapor.kontroller.filter((k) => k.ad !== kontrol.ad);
  const guncel = await raporGuncelle(rapor.id, {
    kontroller: [...digerleri, kontrol],
  });

  return Response.json({ kontrol, rapor: guncel });
}
