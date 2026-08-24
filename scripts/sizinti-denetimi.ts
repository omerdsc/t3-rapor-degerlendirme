/**
 * Sızıntı denetimi — yarışmacı sayfasında görünmemesi gerekenler.
 *
 * ── NİYE BETİK ──────────────────────────────────────────────────────────
 * "Yapay zekâ puanı yarışmacıya gösterilmiyor" bir İDDİA. Belgede yazmak
 * yetmez; RSC yükü props'ları sayfa kaynağına gömüyor ve bir bileşene
 * fazladan alan geçirmek bu iddiayı sessizce bozabilir. Nitekim bir kez
 * bozuldu: bütün `Rapor` kaydı istemci bileşenine geçirilmiş ve gerçek
 * takım adı sayfa kaynağına düşmüştü.
 *
 * Aranan şeyler VERİTABANINDAN okunuyor, elle yazılmıyor: gerçek hakem
 * adları, gerçek erişim kodları, gerçek takım adları. Sabit dizeler
 * yazılsa veri değiştiğinde denetim sessizce boşa düşerdi.
 *
 * Kullanım: sunucu çalışırken `npx tsx scripts/sizinti-denetimi.ts`
 */
import { baglanti } from '@/lib/db/baglanti';

const KOK = process.env.DENETIM_KOK ?? 'http://localhost:3000';

interface Arama {
  ad: string;
  bul: (metin: string) => string | null;
}

function dize(ad: string, ...aranan: string[]): Arama {
  return {
    ad,
    bul: (m) => aranan.find((a) => a.length >= 4 && m.includes(a)) ?? null,
  };
}

async function main() {
  const db = baglanti();

  const hakemler = db.prepare('SELECT ad, kod FROM hakem').all() as
    Array<{ ad: string; kod: string }>;
  const raporlar = db
    .prepare(
      `SELECT basvuru_no, takim_id, takim, proje FROM rapor
        WHERE durum = 'tamamlandi'`,
    )
    .all() as Array<{ basvuru_no: string; takim_id: string; takim: string; proje: string }>;

  if (!raporlar.length) {
    console.log('Tamamlanmış rapor yok; denetlenecek sonuç sayfası yok.');
    return;
  }

  const aramalar: Arama[] = [
    // Yapay zekâ alanları — yarışmacıya HİÇ gösterilmiyor.
    dize('aiDegerlendirme alanı', 'aiDegerlendirme'),
    dize('yapay zekâ puanı', 'aiPuan', 'aiToplam'),
    dize('güven etiketi', '"guven"', 'hakemIncelemesiGerekli'),
    dize('şartname ihlali listesi', 'sartnameIhlalleri'),
    dize('yapay zekâ kullanım/maliyet', '"kullanim"', 'sureMs'),
    // Hakem kimliği — itiraz kurul üzerinden yürür, sayfada yayımlanmaz.
    dize('hakem adı', ...hakemler.map((h) => h.ad)),
    dize('hakem erişim kodu', ...hakemler.map((h) => h.kod)),
    // Yazışma — iç kayıt.
    dize('yazışma alanı', '"mesajlar"'),
  ];

  let hata = 0;
  console.log(`SIZINTI DENETİMİ · ${raporlar.length} tamamlanmış rapor\n`);

  for (const r of raporlar) {
    const y = await fetch(`${KOK}/sonuc?basvuru=${encodeURIComponent(r.basvuru_no)}`);
    const metin = await y.text();

    // Sayfanın gerçekten sonucu gösterdiğini doğrula: boş sayfada hiçbir
    // şey sızmaz ve denetim yanlışlıkla "temiz" der.
    if (!metin.includes('TOPLAM PUAN')) {
      console.log(`  ⚠ ${r.basvuru_no}: sonuç sayfası açılmadı (HTTP ${y.status}) — denetim geçersiz`);
      hata++;
      continue;
    }

    const bulunan = aramalar
      .map((a) => ({ ad: a.ad, iz: a.bul(metin) }))
      .filter((x) => x.iz);

    if (!bulunan.length) {
      console.log(`  ✓ ${r.basvuru_no}`);
    } else {
      hata++;
      for (const b of bulunan) {
        console.log(`  ✗ ${r.basvuru_no}: ${b.ad} — "${b.iz}"`);
      }
    }
  }

  console.log(hata ? `\n${hata} sorun bulundu.` : '\nSızıntı yok.');
  process.exitCode = hata ? 1 : 0;
}

void main();
