/**
 * Şartname özetini gerektiğinde kendiliğinden hazırlar.
 *
 * NEDEN TEMBEL ÜRETİM
 * Kullanıcı "bütün yarışmaların özetleri hazır bulunsun" istiyor. Bunu
 * peşin yapmak 37 farklı şartname × $0.15 = ~$5.55 demek — kalan bütçenin
 * %79'u ve büyük kısmı hiç kullanılmayacak kategoriler için harcanmış olurdu.
 *
 * Bu yüzden özet, bir kategoride İLK DEĞERLENDİRME yapıldığında üretilip
 * kategoriye kalıcı olarak yazılıyor. Kullanıcı açısından fark yok: hiçbir
 * şey yapmadan özet hazır oluyor. Fark yalnızca faturada — para gerçekten
 * kullanılan kategori için gidiyor ve o kategori için bir kez gidiyor.
 *
 * Peşin hazırlamak isteyen yönetici için kategori kartında düğme var; bu
 * modül o yolu kapatmıyor, yalnızca hiçbir şey yapılmadığında da doğru
 * davranışı garanti ediyor.
 */

import { sartnameOzetle, type SartnameOzeti } from './sartname-ozeti';
import { ClaudeIstemcisi } from './istemci';
import { bicimTespitEt, docxOku } from '../analiz/belge-docx';
import { pdfOku } from '../analiz/pdf';
import { belgeKur } from '../analiz/yapi';
import { sartnameCozumle } from '../analiz/sartname';
import { sartnameKaydet } from '../depo/depo';
import type { Yarisma, YarismaKategorisi } from '../depo/tipler';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export interface OzetSonucu {
  ozet?: SartnameOzeti;
  maliyet: number;
  /** Neden üretilmedi — arayüzde gösterilebilsin. */
  atlandi?: string;
}

/**
 * Kategorinin şartname özetini döndürür; yoksa üretip kaydeder.
 *
 * HATA YUTULUYOR — BİLEREK. Özet üretilemezse değerlendirme özetsiz devam
 * etmeli; şartname özeti değerlendirmeyi iyileştiren bir bağlam, olmazsa
 * olmaz değil. Özet yüzünden bütün değerlendirmeyi düşürmek, hakemi
 * elindeki tek yardımdan da mahrum bırakır.
 */
export async function ozetiHazirla(
  yarisma: Yarisma,
  kategori: YarismaKategorisi,
  istemci: ClaudeIstemcisi,
): Promise<OzetSonucu> {
  const s = kategori.sartname;
  if (s?.ozet) return { ozet: s.ozet, maliyet: 0 };
  if (!s) return { maliyet: 0, atlandi: 'kategoriye şartname yüklenmemiş' };
  if (!s.kaynakUrl) {
    return {
      maliyet: 0,
      atlandi: 'şartnamenin kaynağı kayıtlı değil; elle özetlenmeli',
    };
  }

  try {
    const yanit = await fetch(s.kaynakUrl, { headers: { 'user-agent': UA } });
    if (!yanit.ok) throw new Error(`kaynak ${yanit.status}`);
    const veri = new Uint8Array(await yanit.arrayBuffer());

    const bicim = bicimTespitEt(veri);
    let belge;
    if (bicim === 'docx') {
      const o = docxOku(veri);
      if (!o.tamam) throw new Error(o.hata);
      belge = o.belge;
    } else if (bicim === 'pdf') {
      const o = await pdfOku(veri);
      if (!o.tamam) throw new Error(o.hata);
      belge = belgeKur(o.belge);
    } else {
      throw new Error('biçim tanınmadı');
    }

    const cozum = sartnameCozumle(belge);
    const sonuc = await sartnameOzetle(
      cozum.metin,
      `${yarisma.ad} · ${kategori.ad}`,
      { istemci },
    );
    if (!sonuc.ozet) throw new Error('model özet üretmedi');

    // Kalıcı yazılıyor: aynı kategorideki sonraki raporlar bedava kullanır.
    await sartnameKaydet(yarisma.id, kategori.id, { ...s, ozet: sonuc.ozet });

    return { ozet: sonuc.ozet, maliyet: sonuc.kullanim.maliyet };
  } catch (e) {
    return {
      maliyet: 0,
      atlandi: `özet üretilemedi: ${e instanceof Error ? e.message : 'hata'}`,
    };
  }
}
