/**
 * Yarışma terim profillerini okur.
 *
 * `scripts/terim-uret.ts` her yarışmanın şartnamesinden terim çıkarıp
 * `veri/terim-profilleri.json` dosyasına yazıyor. Bu modül onu okuyup
 * içerik uygunluğu kontrolünün beklediği biçime çeviriyor.
 *
 * ── SORUNUN DEĞİŞMESİ ───────────────────────────────────────────────────
 * Eski kontrol "bu rapor hangi TEKNİK ALANA ait?" diye soruyordu ve
 * cevabı elle yazılmış alan listelerinden arıyordu (tarım, yazılım,
 * savunma…). Listeler uydurmaydı.
 *
 * Yeni kontrol "bu rapor HANGİ YARIŞMANIN istediği şeyden bahsediyor?"
 * diye soruyor. Karşılaştırma kümesi gerçek: 37 şartnameden çıkarılmış
 * 70 profil. Bulgu da daha kullanışlı — "bu rapor Maden kategorisine
 * yüklenmiş ama Sürü İHA şartnamesine benziyor" doğrudan eyleme
 * dönüştürülebilir bir uyarı.
 *
 * Profil yoksa kontrol ÇALIŞMIYOR ve bunu söylüyor. Sessizce "uygun"
 * demek, hiç kontrol etmemekten daha kötü olurdu.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Kategori } from './kategori';

export interface TerimProfili {
  yarismaId: string;
  yarismaAdi: string;
  kategoriId: string;
  kategoriAdi: string;
  kaynak: string;
  terimler: string[];
}

const YOL = () => join(process.cwd(), 'veri', 'terim-profilleri.json');

let onbellek: { mtime: number; profiller: TerimProfili[] } | null = null;

export function profilleriOku(): TerimProfili[] {
  const yol = YOL();
  if (!existsSync(yol)) return [];
  try {
    // 70 profillik JSON her istekte yeniden ayrıştırılmasın.
    const mtime = statSync(yol).mtimeMs;
    if (onbellek?.mtime === mtime) return onbellek.profiller;
    const profiller = JSON.parse(readFileSync(yol, 'utf-8')) as TerimProfili[];
    onbellek = { mtime, profiller };
    return profiller;
  } catch {
    return [];
  }
}

/**
 * Profilleri kategori uygunluğu motorunun beklediği biçime çevirir.
 *
 * Kod olarak KATEGORİ kimliği kullanılıyor, yarışma kimliği değil: aynı
 * yarışmanın iki kategorisi (ÖTR / DTR gibi) farklı şablon ve farklı
 * beklenti taşıyabiliyor.
 */
export function kategoriKumesi(): Kategori[] {
  return profilleriOku().map((p) => ({
    kod: p.kategoriId,
    ad: p.yarismaAdi === p.kategoriAdi ? p.yarismaAdi : `${p.yarismaAdi} · ${p.kategoriAdi}`,
    terimler: p.terimler,
  }));
}

/** Belirli bir kategorinin profili var mı? */
export function profilVarMi(kategoriId: string): boolean {
  return profilleriOku().some((p) => p.kategoriId === kategoriId);
}
