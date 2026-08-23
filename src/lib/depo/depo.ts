/**
 * Dosya tabanlı kalıcı depo.
 *
 * Lokalde kurulum gerektirmemesi için JSON dosyaları kullanıyor. Arayüz bu
 * modülün imzasına bağlı, dosya sistemine değil — canlıya alırken Supabase'e
 * geçmek yalnızca bu dosyayı değiştirmek demek.
 *
 * Yazma işlemleri süreç içinde sıraya alınır: Next dev sunucusu istekleri
 * paralel işliyor, aynı kaydı iki istek aynı anda yazarsa değişiklik kaybolur.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Mesaj, Rapor, Yarisma, YarismaKategorisi } from './tipler';
import type { RubrikKriteri } from '../analiz/sablon-cikar';

const KOK = join(process.cwd(), 'veri');
const YARISMA_DIZINI = join(KOK, 'yarismalar');
const RAPOR_DIZINI = join(KOK, 'raporlar');
const DOSYA_DIZINI = join(KOK, 'dosyalar');

function dizinleriKur() {
  for (const d of [KOK, YARISMA_DIZINI, RAPOR_DIZINI, DOSYA_DIZINI]) {
    if (!existsSync(d)) mkdirSync(d, { recursive: true });
  }
}

/** Yazma kuyruğu — eşzamanlı isteklerde son yazan öbürünü ezmesin. */
let kuyruk: Promise<unknown> = Promise.resolve();
function sirala<T>(is: () => T): Promise<T> {
  const sonraki = kuyruk.then(is, is);
  kuyruk = sonraki.catch(() => undefined);
  return sonraki;
}

function oku<T>(yol: string): T | null {
  if (!existsSync(yol)) return null;
  try {
    return JSON.parse(readFileSync(yol, 'utf-8')) as T;
  } catch {
    return null;
  }
}

function yaz(yol: string, veri: unknown) {
  writeFileSync(yol, JSON.stringify(veri, null, 2), 'utf-8');
}

export function kimlik(): string {
  return randomUUID();
}

// ------------------------------------------------------------- yarışma

export function yarismaKaydet(y: Yarisma): Promise<Yarisma> {
  return sirala(() => {
    dizinleriKur();
    yaz(join(YARISMA_DIZINI, `${y.id}.json`), y);
    return y;
  });
}

export function yarismaGetir(id: string): Yarisma | null {
  dizinleriKur();
  return oku<Yarisma>(join(YARISMA_DIZINI, `${id}.json`));
}

export function yarismalariListele(): Yarisma[] {
  dizinleriKur();
  return readdirSync(YARISMA_DIZINI)
    .filter((d) => d.endsWith('.json'))
    .map((d) => oku<Yarisma>(join(YARISMA_DIZINI, d)))
    .filter((y): y is Yarisma => y !== null)
    .sort((a, b) => b.olusturuldu.localeCompare(a.olusturuldu));
}

// ------------------------------------------------------------ kategori

/** Yarışmaya yeni bir kategori (ve şablonunu) ekler. */
export function kategoriEkle(
  yarismaId: string,
  kategori: YarismaKategorisi,
): Promise<Yarisma | null> {
  return sirala(() => {
    const y = yarismaGetir(yarismaId);
    if (!y) return null;
    const yeni: Yarisma = { ...y, kategoriler: [...y.kategoriler, kategori] };
    yaz(join(YARISMA_DIZINI, `${yarismaId}.json`), yeni);
    return yeni;
  });
}

export function kategoriGetir(
  yarismaId: string,
  kategoriId: string,
): YarismaKategorisi | null {
  return yarismaGetir(yarismaId)?.kategoriler.find((k) => k.id === kategoriId) ?? null;
}

/** Yöneticinin kategori üzerinde yaptığı düzeltmeler. */
export function kategoriGuncelle(
  yarismaId: string,
  kategoriId: string,
  degisiklik: Partial<Pick<YarismaKategorisi, 'ad' | 'sablon' | 'rubrik' | 'kurallar'>>,
): Promise<YarismaKategorisi | null> {
  return sirala(() => {
    const y = yarismaGetir(yarismaId);
    if (!y) return null;
    const i = y.kategoriler.findIndex((k) => k.id === kategoriId);
    if (i < 0) return null;

    const guncel: YarismaKategorisi = { ...y.kategoriler[i], ...degisiklik, duzenlendi: true };
    const kategoriler = [...y.kategoriler];
    kategoriler[i] = guncel;
    yaz(join(YARISMA_DIZINI, `${yarismaId}.json`), { ...y, kategoriler });
    return guncel;
  });
}

/**
 * Kategorinin ŞABLONDAN GELEN kısmını tazeler — güncelleme akışı için.
 *
 * `kategoriGuncelle`'den ayrı bir fonksiyon, çünkü anlamları zıt:
 *
 *   kategoriGuncelle    → yönetici elle düzeltti, dolayısıyla ONAYLADI
 *   kategoriSablonuTazele → şablon dışarıdan değişti, ONAY GEÇERSİZ kaldı
 *
 * İkisini aynı fonksiyonla yapmak, TEKNOFEST'in değiştirdiği bir şablonu
 * yöneticinin onayladığı gibi göstermek olur — sistemin en temel güvencesi
 * ("çıkarım taslaktır, insan onaylar") sessizce çiğnenir.
 */
export function kategoriSablonuTazele(
  yarismaId: string,
  kategoriId: string,
  degisiklik: Partial<
    Pick<
      YarismaKategorisi,
      'sablonDosyasi' | 'asama' | 'sablon' | 'kurallar' | 'rubrik'
        | 'ornekKaynaklar' | 'uyarilar'
    >
  >,
): Promise<YarismaKategorisi | null> {
  return sirala(() => {
    const y = yarismaGetir(yarismaId);
    if (!y) return null;
    const i = y.kategoriler.findIndex((k) => k.id === kategoriId);
    if (i < 0) return null;

    const guncel: YarismaKategorisi = {
      ...y.kategoriler[i],
      ...degisiklik,
      // Şablon değişti: yeniden gözden geçirilmeli.
      duzenlendi: false,
    };
    const kategoriler = [...y.kategoriler];
    kategoriler[i] = guncel;
    yaz(join(YARISMA_DIZINI, `${yarismaId}.json`), { ...y, kategoriler });
    return guncel;
  });
}

/**
 * Şablondan çıkmayan, yöneticinin elle tanımladığı kriter ekler.
 *
 * Şablonlar her zaman eksiksiz değil; koordinasyon sonradan bir ölçüt
 * getirebiliyor. Rubrik bu yüzden kapalı bir liste değil.
 */
export function kriterEkle(
  yarismaId: string,
  kategoriId: string,
  kriter: RubrikKriteri,
): Promise<YarismaKategorisi | null> {
  return sirala(() => {
    const y = yarismaGetir(yarismaId);
    if (!y) return null;
    const i = y.kategoriler.findIndex((k) => k.id === kategoriId);
    if (i < 0) return null;

    const eski = y.kategoriler[i];
    const kriterler = [...eski.rubrik.kriterler, kriter];
    const guncel: YarismaKategorisi = {
      ...eski,
      duzenlendi: true,
      rubrik: { kriterler, toplamPuan: kriterler.reduce((t, k) => t + k.puan, 0) },
    };
    const kategoriler = [...y.kategoriler];
    kategoriler[i] = guncel;
    yaz(join(YARISMA_DIZINI, `${yarismaId}.json`), { ...y, kategoriler });
    return guncel;
  });
}

/** Kategoriye şartname bağlar. */
export function sartnameKaydet(
  yarismaId: string,
  kategoriId: string,
  sartname: NonNullable<YarismaKategorisi['sartname']>,
): Promise<YarismaKategorisi | null> {
  return sirala(() => {
    const y = yarismaGetir(yarismaId);
    if (!y) return null;
    const i = y.kategoriler.findIndex((k) => k.id === kategoriId);
    if (i < 0) return null;

    const eski = y.kategoriler[i];
    // Şartname bağlayıcı metindir: sayfa sınırı çakışırsa şartname kazanır.
    const guncel: YarismaKategorisi = {
      ...eski,
      sartname,
      sablon: {
        ...eski.sablon,
        asgariSayfa: sartname.kurallar.asgariSayfa ?? eski.sablon.asgariSayfa,
        azamiSayfa: sartname.kurallar.azamiSayfa ?? eski.sablon.azamiSayfa,
      },
    };
    const kategoriler = [...y.kategoriler];
    kategoriler[i] = guncel;
    yaz(join(YARISMA_DIZINI, `${yarismaId}.json`), { ...y, kategoriler });
    return guncel;
  });
}

/**
 * Kategoriyi "yönetici onaylı" işaretler.
 *
 * NEDEN AYRI BİR EYLEM GEREKİYOR
 * Sistemin tasarımı "çıkarım bir TASLAKTIR, yönetici onaylar" üzerine
 * kurulu ve arayüz her kategoriyi "TASLAK · İNCELENMEDİ" diye gösteriyor.
 * Ama onay bayrağını yalnızca kriter ekleme/silme set ediyordu: çıkarım
 * DOĞRU olan bir kategoride yönetici, onaylamak için rubriği bozmak
 * zorunda kalıyordu. Doğru çıkarımı onaylamanın yolu olmaması, onay
 * mekanizmasını işlevsiz bırakır.
 */
export function kategoriOnayla(
  yarismaId: string,
  kategoriId: string,
  onayli = true,
): Promise<YarismaKategorisi | null> {
  return sirala(() => {
    const y = yarismaGetir(yarismaId);
    if (!y) return null;
    const i = y.kategoriler.findIndex((k) => k.id === kategoriId);
    if (i < 0) return null;

    const guncel = { ...y.kategoriler[i], duzenlendi: onayli };
    const kategoriler = [...y.kategoriler];
    kategoriler[i] = guncel;
    yaz(join(YARISMA_DIZINI, `${yarismaId}.json`), { ...y, kategoriler });
    return guncel;
  });
}

export function kriterSil(
  yarismaId: string,
  kategoriId: string,
  kriterKodu: string,
): Promise<YarismaKategorisi | null> {
  return sirala(() => {
    const y = yarismaGetir(yarismaId);
    if (!y) return null;
    const i = y.kategoriler.findIndex((k) => k.id === kategoriId);
    if (i < 0) return null;

    const eski = y.kategoriler[i];
    const kriterler = eski.rubrik.kriterler.filter((k) => k.kod !== kriterKodu);
    const guncel: YarismaKategorisi = {
      ...eski,
      duzenlendi: true,
      rubrik: { kriterler, toplamPuan: kriterler.reduce((t, k) => t + k.puan, 0) },
    };
    const kategoriler = [...y.kategoriler];
    kategoriler[i] = guncel;
    yaz(join(YARISMA_DIZINI, `${yarismaId}.json`), { ...y, kategoriler });
    return guncel;
  });
}

// --------------------------------------------------------------- rapor

export function raporKaydet(r: Rapor): Promise<Rapor> {
  return sirala(() => {
    dizinleriKur();
    yaz(join(RAPOR_DIZINI, `${r.id}.json`), r);
    return r;
  });
}

export function raporGetir(id: string): Rapor | null {
  dizinleriKur();
  return oku<Rapor>(join(RAPOR_DIZINI, `${id}.json`));
}

export function raporlariListele(yarismaId?: string, kategoriId?: string): Rapor[] {
  dizinleriKur();
  return readdirSync(RAPOR_DIZINI)
    .filter((d) => d.endsWith('.json'))
    .map((d) => oku<Rapor>(join(RAPOR_DIZINI, d)))
    .filter(
      (r): r is Rapor =>
        r !== null &&
        (!yarismaId || r.yarismaId === yarismaId) &&
        (!kategoriId || r.kategoriId === kategoriId),
    )
    .sort((a, b) => b.yuklendi.localeCompare(a.yuklendi));
}

export function raporGuncelle(id: string, degisiklik: Partial<Rapor>): Promise<Rapor | null> {
  return sirala(() => {
    const mevcut = raporGetir(id);
    if (!mevcut) return null;
    const yeni = { ...mevcut, ...degisiklik };
    yaz(join(RAPOR_DIZINI, `${id}.json`), yeni);
    return yeni;
  });
}

export function raporBasvuruNoIle(basvuruNo: string): Rapor | null {
  const hedef = basvuruNo.trim().toLocaleUpperCase('tr');
  return (
    raporlariListele().find((r) => r.basvuruNo.toLocaleUpperCase('tr') === hedef) ?? null
  );
}

// -------------------------------------------------------------- mesaj

/** Rapora yazışma ekler. Yarışmacıya gösterilmez. */
export function mesajEkle(
  raporId: string,
  mesaj: Omit<Mesaj, 'id' | 'tarih'>,
): Promise<Rapor | null> {
  return sirala(() => {
    const r = raporGetir(raporId);
    if (!r) return null;
    const yeni: Rapor = {
      ...r,
      mesajlar: [
        ...(r.mesajlar ?? []),
        { ...mesaj, id: randomUUID(), tarih: new Date().toISOString() },
      ],
    };
    yaz(join(RAPOR_DIZINI, `${raporId}.json`), yeni);
    return yeni;
  });
}

// -------------------------------------------------------------- dosya

export function dosyaKaydet(raporId: string, veri: Uint8Array): string {
  dizinleriKur();
  const yol = join(DOSYA_DIZINI, `${raporId}.pdf`);
  writeFileSync(yol, veri);
  return yol;
}

export function dosyaOku(raporId: string): Buffer | null {
  const yol = join(DOSYA_DIZINI, `${raporId}.pdf`);
  return existsSync(yol) ? readFileSync(yol) : null;
}

// ------------------------------------------------------------- özetler

export interface PanoOzeti {
  toplam: number;
  bekleyen: number;
  analizde: number;
  tamamlanan: number;
  manuelInceleme: number;
  bayrakli: number;
  ortalamaSapma: number | null;
  uyumOrani: number | null;
  toplamMaliyet: number;
  raporBasinaMaliyet: number | null;
}

export function panoOzeti(yarismaId?: string, kategoriId?: string): PanoOzeti {
  const raporlar = raporlariListele(yarismaId, kategoriId);

  const tamamlananlar = raporlar.filter(
    (r) => r.durum === 'tamamlandi' && r.hakemToplam !== undefined && r.aiDegerlendirme,
  );
  const sapmalar = tamamlananlar.map(
    (r) => Math.abs((r.hakemToplam ?? 0) - (r.aiDegerlendirme?.aiToplam ?? 0)),
  );
  const maliyetler = raporlar
    .map((r) => r.aiDegerlendirme?.kullanim.maliyet ?? 0)
    .filter((m) => m > 0);

  return {
    toplam: raporlar.length,
    bekleyen: raporlar.filter((r) => r.durum === 'hakem_bekliyor').length,
    analizde: raporlar.filter((r) => r.durum === 'analiz_ediliyor' || r.durum === 'yuklendi').length,
    tamamlanan: raporlar.filter((r) => r.durum === 'tamamlandi').length,
    manuelInceleme: raporlar.filter((r) => r.durum === 'manuel_inceleme').length,
    bayrakli: raporlar.filter((r) => r.genelDurum === 'hata').length,
    ortalamaSapma: sapmalar.length
      ? Math.round((sapmalar.reduce((a, b) => a + b, 0) / sapmalar.length) * 10) / 10
      : null,
    uyumOrani: sapmalar.length
      ? Math.round((sapmalar.filter((s) => s <= 5).length / sapmalar.length) * 100)
      : null,
    toplamMaliyet: maliyetler.reduce((a, b) => a + b, 0),
    raporBasinaMaliyet: maliyetler.length
      ? maliyetler.reduce((a, b) => a + b, 0) / maliyetler.length
      : null,
  };
}
