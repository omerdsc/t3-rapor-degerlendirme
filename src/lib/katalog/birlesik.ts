/**
 * Katalog ile depoyu tek listede birleştirir.
 *
 * NEDEN GEREKLİ
 * Arayüzde iki ayrı yarışma listesi vardı: "TEKNOFEST Kataloğu" (çekilen 60
 * yarışma) ve "Yarışma Yönetimi" (kurulmuş olanlar). İkisi de yarışma
 * listesiydi ve kullanıcı hangisinde ne olduğunu anlamıyordu — çünkü bu
 * ayrım kullanıcının değil, SİSTEMİN iç meselesi: veri katalogdan mı geldi
 * yoksa depoda mı duruyor.
 *
 * Kullanıcının sorusu tek: "bu yarışma değerlendirmeye hazır mı?" Bu modül
 * iki kaynağı birleştirip o soruyu yanıtlayan tek bir liste üretiyor.
 */

import { katalogOku } from './depo';
import { aktarimPlaniKur } from './aktar';
import { yarismalariListele } from '../depo/depo';
import type { Yarisma, YarismaKategorisi } from '../depo/tipler';
import type { KatalogYarismasi } from './tipler';

/**
 * Bir yarışmanın kullanıcı açısından durumu.
 *
 * Sıralama, ilgi sırasıdır: kullanıcının bakması gereken şey en üstte.
 */
export type YarismaDurumu =
  /** Kurulu, bütün kategorileri onaylı — rapor kabul edebilir. */
  | 'hazir'
  /** Kurulu ama en az bir kategorisi gözden geçirilmemiş. */
  | 'inceleme_bekliyor'
  /** Katalogda şablonu var, henüz kurulmamış. */
  | 'kurulabilir'
  /** TEKNOFEST bu yarışma için henüz rapor şablonu yayımlamamış. */
  | 'sablon_bekleniyor';

export interface BirlesikYarisma {
  /** Katalog slug'ı; kurulu ama katalogda olmayan yarışmalarda undefined. */
  slug?: string;
  ad: string;
  durum: YarismaDurumu;
  /** Depodaki kayıt — kurulmamışsa undefined. */
  kurulu?: Yarisma;
  /** Katalog kaydı — elle kurulmuş yarışmalarda undefined. */
  katalog?: KatalogYarismasi;

  /** Kurulacak/kurulmuş kategori sayısı. */
  kategoriSayisi: number;
  onayliKategori: number;
  /** Kaç kategoride şartname bağlı. */
  sartnameliKategori: number;
  /** Kaç kategoride AI özeti hazır. */
  ozetliKategori: number;
  raporSayisi: number;

  /** Katılımcı seviyeleri — Lise, Üniversite… */
  seviyeler: string[];
  /** Teknik şartname var mı? Puanlama detayı orada. */
  teknikSartname: boolean;
}

const SEVIYE_SIRASI = ['İlkokul', 'Ortaokul', 'Yıldızlar', 'Lise', 'Üniversite', 'Mezun'];

function seviyeleriTopla(k?: KatalogYarismasi, y?: Yarisma): string[] {
  const kume = new Set<string>();
  if (k?.adSeviyesi) kume.add(k.adSeviyesi);
  for (const b of k?.belgeler ?? []) if (b.seviye) kume.add(b.seviye);
  // Kurulu yarışmada seviye kategori adına geçmiş olabilir.
  for (const kat of y?.kategoriler ?? []) {
    for (const s of SEVIYE_SIRASI) if (kat.ad.includes(s)) kume.add(s);
  }
  return [...kume].sort((a, b) => SEVIYE_SIRASI.indexOf(a) - SEVIYE_SIRASI.indexOf(b));
}

function kategoriSay(kategoriler: YarismaKategorisi[]) {
  return {
    onayli: kategoriler.filter((k) => k.duzenlendi).length,
    sartnameli: kategoriler.filter((k) => k.sartname).length,
    ozetli: kategoriler.filter((k) => k.sartname?.ozet).length,
  };
}

const DURUM_SIRASI: Record<YarismaDurumu, number> = {
  inceleme_bekliyor: 0,
  hazir: 1,
  kurulabilir: 2,
  sablon_bekleniyor: 3,
};

export function birlesikListe(raporSayaci: (yarismaId: string) => number): BirlesikYarisma[] {
  const katalog = katalogOku();
  const kurulular = yarismalariListele();

  /*
   * EŞLEŞTİRME: önce slug, sonra ad.
   *
   * Katalogdan aktarılan yarışmalar slug taşıyor. Ama elle şablon yükleyerek
   * kurulmuş yarışmalar taşımıyor (ve eski kayıtlarda slug alanı hiç yok).
   * Ad üzerinden ikinci bir eşleştirme yapılmazsa aynı yarışma listede iki
   * kez görünür — kullanıcı için en kafa karıştırıcı sonuç.
   */
  const slugIle = new Map<string, Yarisma>();
  const adIle = new Map<string, Yarisma>();
  for (const y of kurulular) {
    if (y.katalogSlug) slugIle.set(y.katalogSlug, y);
    adIle.set(y.ad.toLocaleLowerCase('tr'), y);
  }

  const sonuc: BirlesikYarisma[] = [];
  const kullanilan = new Set<string>();

  for (const k of katalog?.yarismalar ?? []) {
    const y = slugIle.get(k.slug) ?? adIle.get(k.ad.toLocaleLowerCase('tr'));
    if (y) kullanilan.add(y.id);

    // Kurulmamışsa kategori sayısı plandan tahmin edilir; kullanıcı neyin
    // kurulacağını önceden görsün.
    const plan = y ? null : aktarimPlaniKur(k, new Date().getFullYear());
    const kategoriler = y?.kategoriler ?? [];
    const say = kategoriSay(kategoriler);

    const durum: YarismaDurumu = y
      ? say.onayli === kategoriler.length && kategoriler.length > 0
        ? 'hazir'
        : 'inceleme_bekliyor'
      : k.sablonVar
        ? 'kurulabilir'
        : 'sablon_bekleniyor';

    sonuc.push({
      slug: k.slug,
      ad: k.ad,
      durum,
      kurulu: y,
      katalog: k,
      kategoriSayisi: y ? kategoriler.length : (plan?.kategoriler.length ?? 0),
      onayliKategori: say.onayli,
      sartnameliKategori: say.sartnameli,
      ozetliKategori: say.ozetli,
      raporSayisi: y ? raporSayaci(y.id) : 0,
      seviyeler: seviyeleriTopla(k, y),
      teknikSartname: k.teknikSartnameVar,
    });
  }

  // Katalogda olmayan, elle kurulmuş yarışmalar da listede kalmalı.
  for (const y of kurulular) {
    if (kullanilan.has(y.id)) continue;
    const say = kategoriSay(y.kategoriler);
    sonuc.push({
      slug: y.katalogSlug,
      ad: y.ad,
      durum:
        say.onayli === y.kategoriler.length && y.kategoriler.length > 0
          ? 'hazir'
          : 'inceleme_bekliyor',
      kurulu: y,
      kategoriSayisi: y.kategoriler.length,
      onayliKategori: say.onayli,
      sartnameliKategori: say.sartnameli,
      ozetliKategori: say.ozetli,
      raporSayisi: raporSayaci(y.id),
      seviyeler: seviyeleriTopla(undefined, y),
      teknikSartname: y.kategoriler.some((k) => k.sartname?.teknikMi),
    });
  }

  return sonuc.sort(
    (a, b) =>
      DURUM_SIRASI[a.durum] - DURUM_SIRASI[b.durum] ||
      b.raporSayisi - a.raporSayisi ||
      a.ad.localeCompare(b.ad, 'tr'),
  );
}

export const DURUM_METNI: Record<YarismaDurumu, { etiket: string; aciklama: string }> = {
  hazir: {
    etiket: 'Hazır',
    aciklama: 'Ölçütleri onaylandı, rapor kabul edebilir.',
  },
  inceleme_bekliyor: {
    etiket: 'Onay bekliyor',
    aciklama: 'Ölçütler şablondan çıkarıldı ama henüz onaylanmadı.',
  },
  kurulabilir: {
    etiket: 'Kurulmadı',
    aciklama: 'Şablonu yayımlanmış; tek tıkla kurulabilir.',
  },
  sablon_bekleniyor: {
    etiket: 'Şablon bekleniyor',
    aciklama: 'TEKNOFEST bu yarışma için rapor şablonu yayımlamadı.',
  },
};

/**
 * İstemciye gönderilen İNCE satır.
 *
 * `BirlesikYarisma` içinde `katalog` (o yarışmanın bütün belgeleri) ve
 * `kurulu` (bütün kategoriler, rubrikler, şartname özetleri) var. Bunları
 * bir istemci bileşenine prop olarak geçmek sayfayı 1,5 MB'a çıkarıyordu —
 * liste yalnızca ad, durum ve sayaç gösteriyor.
 *
 * Kural: istemciye ne gösterilecekse o gönderilir.
 */
export interface YarismaSatiri {
  slug?: string;
  /** Kurulu yarışmanın kimliği — bağlantı için. */
  yarismaId?: string;
  ad: string;
  durum: YarismaDurumu;
  kategoriSayisi: number;
  onayliKategori: number;
  sartnameliKategori: number;
  ozetliKategori: number;
  raporSayisi: number;
  seviyeler: string[];
  teknikSartname: boolean;
}

export function satirlaraCevir(liste: BirlesikYarisma[]): YarismaSatiri[] {
  return liste.map((y) => ({
    slug: y.slug,
    yarismaId: y.kurulu?.id,
    ad: y.ad,
    durum: y.durum,
    kategoriSayisi: y.kategoriSayisi,
    onayliKategori: y.onayliKategori,
    sartnameliKategori: y.sartnameliKategori,
    ozetliKategori: y.ozetliKategori,
    raporSayisi: y.raporSayisi,
    seviyeler: y.seviyeler,
    teknikSartname: y.teknikSartname,
  }));
}
