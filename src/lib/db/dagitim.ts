/**
 * Rapor–hakem dağıtımı — SAF fonksiyon, veritabanından bağımsız.
 *
 * ── NEDEN AYRI DOSYA ────────────────────────────────────────────────────
 * Dağıtım iki yerde gerekiyor: sunucu ATIYOR, arayüz kullanıcıya basmadan
 * önce NE OLACAĞINI gösteriyor. İki ayrı kopya yazıldığında önizleme
 * sunucunun yaptığından farklı bir sonuç göstermeye başlar — bu projede
 * nihai puan hesabı tam bu şekilde ayrışmış ve rapor listesiyle detay
 * sayfası farklı puan göstermeye başlamıştı. Tek kopya, iki çağıran.
 *
 * ── DENGE NEDEN MEVCUT YÜKÜ SAYIYOR ─────────────────────────────────────
 * Önceki dağıtım basit round-robin'di: imleç 0'dan başlıyor, sırayla
 * dağıtıyordu. Yeni atamaları eşit bölüyordu ama hakemlerin ELİNDEKİ işi
 * hiç saymıyordu. Elinde 12 rapor olan hakem ile hiç işi olmayan hakem
 * aynı payı alıyordu; "dengeli dağıtım" iddiası yalnızca o partiye ait
 * bir dengeydi. Şimdi her adımda EN AZ YÜKLÜ hakem seçiliyor.
 */

export interface DagitimHakemi {
  id: string;
  /** Şu anda elindeki atama sayısı. */
  yuk: number;
}

export interface DagitimHedefi {
  raporId: string;
  /** Bu rapora hâlihazırda atanmış hakem kimlikleri. */
  mevcut: string[];
}

export interface DagitimSonucu {
  /** Yapılacak (rapor, hakem) çiftleri — sırası deterministik. */
  ciftler: Array<{ raporId: string; hakemId: string }>;
  /** Hiç hakem atanamayan raporlar: seçilenlerin tamamı zaten atanmış. */
  atlanan: string[];
  /** Hakem başına yeni atama sayısı — önizleme bunu gösteriyor. */
  yeniYuk: Map<string, number>;
}

/**
 * Raporları hakemlere dağıtır.
 *
 * Her rapor için, o rapora atanmamış hakemler arasından en az yüklü
 * `raporBasinaHakem` tanesi seçilir. Eşitlikte `hakemler` dizisindeki sıra
 * belirleyicidir — aynı girdi her zaman aynı sonucu verir, testlenebilir
 * olması buna bağlı.
 */
export function dagit(
  hedefler: DagitimHedefi[],
  hakemler: DagitimHakemi[],
  raporBasinaHakem: number,
): DagitimSonucu {
  const ciftler: Array<{ raporId: string; hakemId: string }> = [];
  const atlanan: string[] = [];
  const yeniYuk = new Map<string, number>(hakemler.map((h) => [h.id, 0]));

  if (!hakemler.length) return { ciftler, atlanan: hedefler.map((h) => h.raporId), yeniYuk };

  const basina = Math.max(1, Math.min(hakemler.length, raporBasinaHakem));
  // Çalışma kopyası: özgün dizi değişmiyor, çağıran yeniden kullanabilir.
  const yuk = new Map(hakemler.map((h) => [h.id, h.yuk]));
  const sira = hakemler.map((h) => h.id);

  for (const hedef of hedefler) {
    const mevcut = new Set(hedef.mevcut);
    const uygun = sira.filter((id) => !mevcut.has(id));

    if (!uygun.length) {
      atlanan.push(hedef.raporId);
      continue;
    }

    /*
     * En az yüklüden seçim. Sıralama her rapor için yeniden yapılıyor:
     * bir önceki raporda atama alan hakemin yükü artmış olduğu için
     * sıradaki raporda geri plana düşüyor. Dizideki ilk sıra eşitlik
     * bozucu — `indexOf` ile deterministik.
     */
    const secilenler = [...uygun]
      .sort((a, b) => (yuk.get(a)! - yuk.get(b)!) || sira.indexOf(a) - sira.indexOf(b))
      .slice(0, basina);

    for (const hakemId of secilenler) {
      ciftler.push({ raporId: hedef.raporId, hakemId });
      yuk.set(hakemId, yuk.get(hakemId)! + 1);
      yeniYuk.set(hakemId, (yeniYuk.get(hakemId) ?? 0) + 1);
    }
  }

  return { ciftler, atlanan, yeniYuk };
}
