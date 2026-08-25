/**
 * AI puan denetimi — modelin verdiği puanlar rubriğe uyuyor mu?
 *
 * ── NİYE GEREKLİ ────────────────────────────────────────────────────────
 * Model bir ölçüte azamisinden yüksek puan verebilir, ölçüt atlayabilir,
 * uydurma ölçüt kodu döndürebilir ya da kendi topladığı toplamı yanlış
 * hesaplayabilir. Kod bunlara karşı kırpma ve yeniden toplama yapıyor —
 * ama KIRPMANIN DEVREYE GİRİP GİRMEDİĞİ ölçülmeden bilinmez.
 *
 * Bu betik kayıtlı bütün değerlendirmeleri rubrikle karşılaştırıyor:
 *   · her ölçüt puanı 0 ile azamisi arasında mı
 *   · toplam gerçekten ölçüt puanlarının toplamı mı
 *   · azami toplam rubriğin toplam puanıyla aynı mı
 *   · rubrikteki her ölçüt değerlendirilmiş mi
 *   · uydurma ölçüt kodu var mı
 *   · öneri ve gerekçe boş kalan ölçüt var mı
 *   · model kendi çıktısıyla çelişiyor mu (güven ↔ alıntı ↔ inceleme)
 *
 * ── NEYİ ÖLÇMÜYOR ───────────────────────────────────────────────────────
 * Puanın YERİNDE olup olmadığını. Bunu ancak gerçek hakem söyler. Bu
 * betik mekanizmanın sağlam olduğunu doğruluyor: aralık, toplam, kapsam,
 * dayanak. Yargının kalitesi ayrı bir soru ve gerçek hakem puanları
 * biriktikçe `npm run kanit` içindeki hakem–model farkı ile ölçülüyor.
 */
import { kategoriGetir, raporlariListele } from '@/lib/depo/depo';

let sorun = 0;
let incelenen = 0;

console.log('\nAI PUAN DENETİMİ\n');

for (const rapor of raporlariListele()) {
  const ai = rapor.aiDegerlendirme;
  if (!ai) continue;
  const kategori = kategoriGetir(rapor.yarismaId, rapor.kategoriId);
  if (!kategori) continue;

  incelenen++;
  const rubrik = kategori.rubrik;
  const olcutler = new Map(rubrik.kriterler.map((k) => [k.kod, k]));
  const bulgular: string[] = [];

  // 1 · Her puan 0..azami aralığında mı
  for (const k of ai.kriterler) {
    const o = olcutler.get(k.kod);
    if (!o) {
      bulgular.push(`uydurma ölçüt kodu: "${k.kod}"`);
      continue;
    }
    if (k.aiPuan < 0 || k.aiPuan > o.puan) {
      bulgular.push(`${o.ad}: ${k.aiPuan} puan, azami ${o.puan} — ARALIK DIŞI`);
    }
    if (k.azamiPuan !== o.puan) {
      bulgular.push(`${o.ad}: azamiPuan ${k.azamiPuan} ≠ rubrik ${o.puan}`);
    }
  }

  // 2 · Toplam gerçekten toplam mı
  const hesap = ai.kriterler.reduce((t, k) => t + k.aiPuan, 0);
  if (Math.abs(hesap - ai.aiToplam) > 0.001) {
    bulgular.push(`toplam ${ai.aiToplam} ≠ ölçüt toplamı ${hesap}`);
  }

  // 3 · Azami toplam rubrikle uyuşuyor mu
  if (ai.azamiToplam !== rubrik.toplamPuan) {
    bulgular.push(`azami toplam ${ai.azamiToplam} ≠ rubrik ${rubrik.toplamPuan}`);
  }

  // 4 · Rubrikteki her ölçüt değerlendirilmiş mi
  const degerlendirilen = new Set(ai.kriterler.map((k) => k.kod));
  const eksik = rubrik.kriterler.filter((k) => !degerlendirilen.has(k.kod));
  if (eksik.length) {
    bulgular.push(`${eksik.length} ölçüt hiç değerlendirilmemiş: ${eksik.map((k) => k.ad).join(', ')}`);
  }

  // 5 · Gerekçe ve öneri boş mu
  const gerekcesiz = ai.kriterler.filter((k) => !k.gerekce?.trim()).length;
  const onerisiz = ai.kriterler.filter((k) => !k.oneri?.trim()).length;
  if (gerekcesiz) bulgular.push(`${gerekcesiz} ölçütte gerekçe boş`);

  /*
   * 6 · İÇ TUTARLILIK
   *
   * Modelin kendi çıktısı kendisiyle çelişiyor mu? İki gerçek çelişki:
   *   · düşük güven verip inceleme istememek — güvenmiyorsa söylemeli
   *   · yüksek güven verip rapordan hiç alıntı yapmamak — dayanaksız kesinlik
   *
   * DENENİP ELENEN BİR ÖLÇÜT: "0 puan + yüksek güven + inceleme istemiyor".
   * Çelişki sanılmıştı, değilmiş. Bölüm gerçekten yoksa model 0 verip emin
   * olmakta ve inceleme istememekte HAKLI — kesin bir yokluk tek bakışta
   * doğrulanır. Beş raporda bu deseni işaretledi, beşinde de model doğruydu.
   */
  for (const c of ai.kriterler) {
    if (c.guven === 'dusuk' && !c.hakemIncelemesiGerekli) {
      bulgular.push(`${c.ad}: düşük güven ama hakem incelemesi istemiyor`);
    }
    if (c.guven === 'yuksek' && c.kanitlar.length === 0) {
      bulgular.push(`${c.ad}: yüksek güven ama rapordan alıntı yok`);
    }
  }

  const durum = bulgular.length ? '✗' : '✓';
  console.log(
    `  ${durum} ${rapor.basvuruNo.padEnd(17)} ${String(ai.aiToplam).padStart(5)}/${ai.azamiToplam}`
    + ` · ${ai.kriterler.length}/${rubrik.kriterler.length} ölçüt`
    + ` · ${ai.kriterler.length - onerisiz} öneri`
    + ` · ${ai.incelemeGereken} inceleme`,
  );
  for (const b of bulgular) {
    console.log(`      → ${b}`);
    sorun++;
  }
}

console.log(
  sorun
    ? `\n${incelenen} değerlendirme incelendi, ${sorun} SORUN bulundu.`
    : `\n${incelenen} değerlendirmenin tamamı rubriğe uygun.`,
);
process.exitCode = sorun ? 1 : 0;
