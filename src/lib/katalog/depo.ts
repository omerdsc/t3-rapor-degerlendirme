/**
 * Katalog dosyasını okur.
 *
 * Katalog `veri/katalog.json`'da durur ve `scripts/katalog-cek.ts` ile
 * tazelenir. Sunucu tarafında salt okunur kullanılır: aktarım kararı
 * yöneticinin, kazıma ayrı ve elle başlatılan bir iştir.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Katalog, KatalogYarismasi } from './tipler';

const YOL = () => join(process.cwd(), 'veri', 'katalog.json');

let onbellek: { mtime: number; katalog: Katalog } | null = null;

/** Katalog yoksa null döner — arayüz "henüz çekilmedi" der. */
export function katalogOku(): Katalog | null {
  const yol = YOL();
  if (!existsSync(yol)) return null;

  try {
    // Dosya değişmedikçe yeniden ayrıştırılmaz: 260 belgelik JSON her
    // istekte çözülmesin.
    const mtime = statSync(yol).mtimeMs;
    if (onbellek && onbellek.mtime === mtime) return onbellek.katalog;

    const katalog = JSON.parse(readFileSync(yol, 'utf-8')) as Katalog;
    onbellek = { mtime, katalog };
    return katalog;
  } catch {
    return null;
  }
}

export function katalogYarismasiGetir(slug: string): KatalogYarismasi | null {
  return katalogOku()?.yarismalar.find((y) => y.slug === slug) ?? null;
}
