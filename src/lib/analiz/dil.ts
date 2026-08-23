/**
 * Rapor dilinin tespiti (MVP 1).
 *
 * Harici bağımlılık yok: Türkçe'ye özgü harfler ve iki dilin işlev sözcükleri
 * sayılır. Karışık dilli raporları yakalamak için bölüm bazlı dağılım da
 * çıkarılır — yarısı İngilizce yazılmış rapor tek bir "tr" etiketiyle
 * geçiştirilmemeli.
 */

import type { Belge, Bulgu, KontrolSonucu } from './tipler';
import { onar } from './normalize';

const TR_ISLEV = new Set([
  've', 'bir', 'bu', 'için', 'ile', 'olarak', 'olan', 'daha', 'gibi', 'sonra',
  'ancak', 'ise', 'da', 'de', 'ki', 'en', 'çok', 'her', 'veya', 'göre',
  'üzere', 'kadar', 'tarafından', 'içinde', 'arasında', 'bulunmaktadır',
  'edilmiştir', 'yapılmıştır', 'olduğu', 'amacıyla', 'nedeniyle',
]);

const EN_ISLEV = new Set([
  'the', 'and', 'of', 'to', 'in', 'is', 'for', 'with', 'that', 'this',
  'are', 'as', 'be', 'by', 'on', 'from', 'was', 'were', 'which', 'has',
  'have', 'been', 'these', 'their', 'can', 'will', 'other', 'between',
]);

/** ı, ğ, ş ve büyük harfleri pratikte yalnızca Türkçe'de bulunur. */
const TR_HARF = /[ığşİĞŞ]/g;

export interface DilSonucu {
  dil: 'tr' | 'en' | 'karisik' | 'belirsiz';
  guven: number;
  trOran: number;
  enOran: number;
}

export function diliTespitEt(metin: string): DilSonucu {
  const s = onar(metin).toLocaleLowerCase('tr');
  const sozcukler = s.split(/[^\p{L}]+/u).filter((k) => k.length > 1);

  if (sozcukler.length < 20) return { dil: 'belirsiz', guven: 0, trOran: 0, enOran: 0 };

  let tr = 0;
  let en = 0;
  for (const k of sozcukler) {
    if (TR_ISLEV.has(k)) tr++;
    else if (EN_ISLEV.has(k)) en++;
  }

  // Türkçe'ye özgü harf yoğunluğu ek kanıt sayılır.
  const harfIzi = (metin.match(TR_HARF) ?? []).length;
  tr += Math.min(harfIzi / 12, sozcukler.length * 0.05);

  const toplam = tr + en;
  if (toplam < 5) return { dil: 'belirsiz', guven: 0, trOran: 0, enOran: 0 };

  const trOran = tr / toplam;
  const enOran = en / toplam;
  const guven = Math.abs(trOran - enOran);

  if (guven < 0.25) return { dil: 'karisik', guven, trOran, enOran };
  return { dil: trOran > enOran ? 'tr' : 'en', guven, trOran, enOran };
}

export function dilKontrolu(belge: Belge, beklenen: 'tr' | 'en'): KontrolSonucu {
  const genel = diliTespitEt(belge.metin);
  const bulgular: Bulgu[] = [];

  const adi = (d: string) =>
    ({ tr: 'Türkçe', en: 'İngilizce', karisik: 'karışık', belirsiz: 'belirsiz' })[d] ?? d;

  if (genel.dil === 'belirsiz') {
    bulgular.push({
      kod: 'DIL_BELIRSIZ',
      seviye: 'uyari',
      baslik: 'Dil tespit edilemedi',
      aciklama: 'Metin katmanı dil tespiti için yetersiz. Rapor taranmış olabilir.',
    });
  } else if (genel.dil === 'karisik') {
    bulgular.push({
      kod: 'DIL_KARISIK',
      seviye: 'uyari',
      baslik: 'Rapor karışık dilde yazılmış',
      aciklama:
        `Türkçe %${Math.round(genel.trOran * 100)}, İngilizce %${Math.round(genel.enOran * 100)}. ` +
        'Şartname tek dilde yazım bekliyor.',
    });
  } else if (genel.dil !== beklenen) {
    bulgular.push({
      kod: 'DIL_UYUMSUZ',
      seviye: 'hata',
      baslik: `Rapor ${adi(genel.dil)} yazılmış`,
      aciklama: `Bu yarışma kategorisinde ${adi(beklenen)} rapor bekleniyor.`,
    });
  }

  // Bölüm bazlı sapma: gövde Türkçe ama bir bölüm tamamen İngilizceyse.
  const sapan = belge.bolumler
    .filter((b) => b.kelimeSayisi >= 40)
    .map((b) => ({ b, d: diliTespitEt(b.govde) }))
    .filter(({ d }) => d.dil !== 'belirsiz' && d.dil !== genel.dil && d.guven > 0.4);

  if (sapan.length && genel.dil !== 'karisik') {
    bulgular.push({
      kod: 'DIL_BOLUM_SAPMASI',
      seviye: 'bilgi',
      baslik: `${sapan.length} bölüm farklı dilde`,
      aciklama: sapan.map(({ b, d }) => `"${b.baslik.sade}" (${adi(d.dil)})`).join(', '),
      sayfa: sapan[0].b.baslik.sayfa,
    });
  }

  const durum = bulgular.some((x) => x.seviye === 'hata')
    ? 'hata'
    : bulgular.some((x) => x.seviye === 'uyari')
      ? 'uyari'
      : 'temiz';

  return {
    kod: 'dil',
    ad: 'Dil',
    durum,
    ozet:
      genel.dil === 'belirsiz'
        ? 'Tespit edilemedi'
        : `${adi(genel.dil)} · %${Math.round(Math.max(genel.trOran, genel.enOran) * 100)}`,
    bulgular,
    veri: { dil: genel.dil, guven: genel.guven, trOran: genel.trOran, enOran: genel.enOran },
  };
}
