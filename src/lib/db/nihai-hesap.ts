/**
 * Nihai puan hesabı — SAF fonksiyonlar, veritabanından bağımsız.
 *
 * ── NEDEN AYRI DOSYA ────────────────────────────────────────────────────
 * Bu hesap bir kez sessizce bozuldu ve kimse fark etmedi: rapor listesi
 * 75,5 puan, detay sayfası 71,8 puan gösteriyordu. Sebep, nihai puanın
 * bir yerde HESAPLANIP başka yerde ÖNBELLEKTEN okunması ve iki yolun
 * ayrışmasıydı.
 *
 * Hesap `hakem-depo.ts` içinde SQL sorgularının arasında kalınca test
 * edilemiyordu. Buraya çıkarıldı: girdi düz veri, çıktı düz veri, test
 * veritabanı gerektirmiyor. `hakem-depo.ts` yalnızca veriyi çekip bu
 * fonksiyonları çağırıyor.
 */

export interface DegerlendirmeGirdisi {
  hakemId: string;
  durum: 'baslanmadi' | 'taslak' | 'tamamlandi';
  toplam?: number;
  aciklama?: string;
  puanlar: Array<{ kriterKodu: string; puan: number; not?: string }>;
  geriBildirim?: {
    gucluYonler: string[];
    gelisimAlanlari: string[];
    oneriler: Array<{ kriterKodu: string; metin: string }>;
  };
}

/**
 * Toplam nihai puan — TAMAMLANMIŞ değerlendirmelerin ortalaması.
 *
 * Taslaklar sayılmıyor: yarım kalmış bir puanlamayı nihai puana katmak,
 * hakemi bitirmeden karar vermiş göstermek olurdu.
 */
export function toplamOrtalamasi(
  degerlendirmeler: DegerlendirmeGirdisi[],
): { puan?: number; sapma?: number; tamamlanan: number } {
  const bitmis = degerlendirmeler.filter(
    (d) => d.durum === 'tamamlandi' && d.toplam !== undefined,
  );
  if (!bitmis.length) return { tamamlanan: 0 };

  const puanlar = bitmis.map((d) => d.toplam!);
  const ortalama = puanlar.reduce((a, b) => a + b, 0) / puanlar.length;

  return {
    tamamlanan: bitmis.length,
    puan: Math.round(ortalama * 10) / 10,
    sapma:
      puanlar.length > 1
        ? Math.round((Math.max(...puanlar) - Math.min(...puanlar)) * 10) / 10
        : 0,
  };
}

/**
 * Kriter bazında ortalama ve o kritere yazılmış notlar.
 *
 * Ortalama, O KRİTERİ PUANLAYAN hakem sayısına bölünüyor — tamamlanmış
 * hakem sayısına değil. İkisi ayrışabilir: bir hakem bir kriteri boş
 * bırakıp değerlendirmeyi tamamlarsa, o kriteri toplam hakem sayısına
 * bölmek puanı haksız yere düşürür.
 */
export function kriterOrtalamalari(
  degerlendirmeler: DegerlendirmeGirdisi[],
): Map<string, { puan: number; notlar: string[]; puanlayan: number }> {
  const biriktir = new Map<
    string,
    { toplam: number; adet: number; notlar: string[] }
  >();

  for (const d of degerlendirmeler) {
    if (d.durum !== 'tamamlandi') continue;
    for (const p of d.puanlar) {
      const g = biriktir.get(p.kriterKodu) ?? { toplam: 0, adet: 0, notlar: [] };
      g.toplam += p.puan;
      g.adet += 1;
      if (p.not?.trim()) g.notlar.push(p.not.trim());
      biriktir.set(p.kriterKodu, g);
    }
  }

  const sonuc = new Map<string, { puan: number; notlar: string[]; puanlayan: number }>();
  for (const [kod, g] of biriktir) {
    sonuc.set(kod, {
      puan: Math.round((g.toplam / g.adet) * 10) / 10,
      notlar: g.notlar,
      puanlayan: g.adet,
    });
  }
  return sonuc;
}


/**
 * Yarışmacıya gidecek birleşik geri bildirim.
 *
 * ── YALNIZCA TAMAMLANMIŞ VE ONAYLANMIŞ ──────────────────────────────────
 * Kaynak, hakemlerin ONAYLADIĞI metinler — model çıktısı değil. Taslak
 * değerlendirmenin geri bildirimi de alınmıyor: hakem henüz bitirmediyse
 * o metin üzerinde çalışıyor olabilir.
 *
 * ── ÇOK HAKEMLİ DURUMDA BİRLEŞTİRME ─────────────────────────────────────
 * İki hakem aynı şeyi farklı kelimelerle yazabilir. Birebir aynı olanlar
 * teklenip sıra korunuyor; benzer ama farklı yazılmış olanlar ayrı
 * kalıyor — birini seçip atmak, hangi hakemin cümlesinin atıldığına
 * sistemin karar vermesi olurdu.
 *
 * Hakem ADI taşınmıyor: yarışmacı kaç hakem baktığını görüyor, hangi
 * cümlenin kime ait olduğunu görmüyor. İtiraz kurul üzerinden yürür.
 */
export function birlesikGeriBildirim(
  degerlendirmeler: DegerlendirmeGirdisi[],
): { gucluYonler: string[]; gelisimAlanlari: string[]; oneriler: Map<string, string[]> } {
  const guclu: string[] = [];
  const gelisim: string[] = [];
  const oneriler = new Map<string, string[]>();

  /** Aynı cümleyi iki kez göstermemek için; boşluk ve büyük harf farkı sayılmıyor. */
  const anahtar = (m: string) => m.trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr');
  const gorulenGuclu = new Set<string>();
  const gorulenGelisim = new Set<string>();

  for (const d of degerlendirmeler) {
    if (d.durum !== 'tamamlandi' || !d.geriBildirim) continue;

    for (const g of d.geriBildirim.gucluYonler) {
      const m = g.trim();
      if (!m || gorulenGuclu.has(anahtar(m))) continue;
      gorulenGuclu.add(anahtar(m));
      guclu.push(m);
    }

    for (const g of d.geriBildirim.gelisimAlanlari) {
      const m = g.trim();
      if (!m || gorulenGelisim.has(anahtar(m))) continue;
      gorulenGelisim.add(anahtar(m));
      gelisim.push(m);
    }

    for (const o of d.geriBildirim.oneriler) {
      const m = o.metin.trim();
      if (!m) continue;
      const mevcut = oneriler.get(o.kriterKodu) ?? [];
      if (mevcut.some((x) => anahtar(x) === anahtar(m))) continue;
      mevcut.push(m);
      oneriler.set(o.kriterKodu, mevcut);
    }
  }

  return { gucluYonler: guclu, gelisimAlanlari: gelisim, oneriler };
}
