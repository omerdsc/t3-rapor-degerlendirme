/**
 * Duman testi — bütün ekranlar ve uçlar açılıyor mu.
 *
 * ── NİYE VAR ────────────────────────────────────────────────────────────
 * Bu projede iki kez şu oldu: tip denetimi temiz, testler geçiyor, derleme
 * başarılı — ama bir ekran gerçekte kırık. Yarışmacı portalı her kriteri 0
 * gösteriyordu; hakem paneli tiresiz kodda 404 veriyordu. İkisi de yalnızca
 * SAYFAYI AÇIP BAKINCA görülüyordu.
 *
 * Bu betik onu otomatikleştiriyor: her rota çağrılıyor, beklenen durum
 * kodu doğrulanıyor ve yetki sınırları ayrıca sınanıyor. Veriden bağımsız
 * çalışması için kimlikler veritabanından okunuyor.
 *
 * Kullanım: sunucu çalışırken `npm run duman`
 */

import { baglanti } from '@/lib/db/baglanti';
import { hakemYukleri } from '@/lib/db/hakem-depo';
import { raporlariListele } from '@/lib/depo/depo';

const KOK = process.env.DENETIM_KOK ?? 'http://localhost:3000';
const ANAHTAR = process.env.KOORDINASYON_ANAHTARI ?? '';

interface Vaka {
  ad: string;
  yol: string;
  bekle: number | number[];
  /** Koordinasyon anahtarı gönderilsin mi? */
  yetkili?: boolean;
}

let gecen = 0;
const basarisiz: string[] = [];

async function dene(v: Vaka) {
  const beklenen = Array.isArray(v.bekle) ? v.bekle : [v.bekle];
  try {
    const y = await fetch(KOK + v.yol, {
      redirect: 'manual',
      headers: v.yetkili ? { 'x-koordinasyon-anahtari': ANAHTAR } : {},
    });
    if (beklenen.includes(y.status)) {
      gecen++;
    } else {
      basarisiz.push(`${v.ad}: ${y.status} (beklenen ${beklenen.join('/')})  ${v.yol}`);
    }
  } catch (e) {
    basarisiz.push(`${v.ad}: ${e instanceof Error ? e.message : 'ağ hatası'}`);
  }
}

async function main() {
  const hakemler = hakemYukleri().filter((h) => h.hakem.aktif && !h.hakem.sistem);
  const arsiv = baglanti()
    .prepare("SELECT kod FROM hakem WHERE sistem = 1 LIMIT 1")
    .get() as { kod: string } | undefined;
  const raporlar = raporlariListele();
  const tamamlanan = raporlar.find((r) => r.durum === 'tamamlandi');
  const rapor = raporlar[0];

  if (!hakemler.length || !rapor) {
    console.log('Demo verisi eksik. Önce: npm run demo');
    process.exitCode = 1;
    return;
  }

  const hakem = hakemler[0];
  const hakeminRaporu = baglanti()
    .prepare('SELECT rapor_id FROM atama WHERE hakem_id = ? LIMIT 1')
    .get(hakem.hakem.id) as { rapor_id: string } | undefined;
  const baskaHakem = hakemler[1];

  const vakalar: Vaka[] = [
    // ── Portal kapıları ────────────────────────────────────────────────
    { ad: 'Portal seçimi', yol: '/', bekle: 200 },
    { ad: 'Koordinasyon girişi', yol: '/giris', bekle: [200, 307] },

    // ── Koordinasyon ekranları ─────────────────────────────────────────
    { ad: 'Pano', yol: '/koordinasyon', bekle: 200, yetkili: true },
    { ad: 'Raporlar', yol: '/koordinasyon/raporlar', bekle: 200, yetkili: true },
    { ad: 'Raporlar · tümü', yol: '/koordinasyon/raporlar?durum=tumu', bekle: 200, yetkili: true },
    { ad: 'Raporlar · arama', yol: `/koordinasyon/raporlar?ara=${encodeURIComponent(rapor.basvuruNo)}`, bekle: 200, yetkili: true },
    { ad: 'Raporlar · olmayan yarışma', yol: '/koordinasyon/raporlar?yarisma=yok', bekle: 200, yetkili: true },
    { ad: 'Hakemler ve atama', yol: '/koordinasyon/hakemler', bekle: 200, yetkili: true },
    { ad: 'Yarışmalar', yol: '/koordinasyon/yarismalar', bekle: 200, yetkili: true },
    { ad: 'Kopya kontrolü', yol: '/koordinasyon/benzerlik', bekle: 200, yetkili: true },
    { ad: 'Rapor detayı', yol: `/koordinasyon/rapor/${rapor.id}`, bekle: 200, yetkili: true },
    { ad: 'Rapor · olmayan kimlik', yol: '/koordinasyon/rapor/yok-boyle-bir-id', bekle: 404, yetkili: true },

    // ── Hakem portalı ──────────────────────────────────────────────────
    { ad: 'Hakem paneli', yol: `/hakem/${hakem.hakem.kod}`, bekle: 200 },
    { ad: 'Hakem · tiresiz kod', yol: `/hakem/${hakem.hakem.kod.replace(/-/g, '')}`, bekle: 200 },
    { ad: 'Hakem · küçük harf', yol: `/hakem/${hakem.hakem.kod.toLowerCase()}`, bekle: 200 },
    { ad: 'Hakem · geçersiz kod', yol: '/hakem/YOKBOYLE', bekle: 404 },

    // ── Yarışmacı portalı ──────────────────────────────────────────────
    { ad: 'Yarışmacı girişi', yol: '/sonuc', bekle: 200 },
    { ad: 'Yarışmacı · olmayan numara', yol: '/sonuc?basvuru=YOK-123', bekle: 200 },

    // ── Eski adresler yönleniyor ───────────────────────────────────────
    { ad: 'Eski /raporlar', yol: '/raporlar', bekle: 307 },
    { ad: 'Eski /hakemler', yol: '/hakemler', bekle: 307 },

    /*
     * ── API YETKİSİ ────────────────────────────────────────────────────
     * Beklenen kod KURULUMA bağlı: anahtar kuruluysa 401, kurulu değilse
     * sistem açık ve istek geçiyor (o zaman "yarışma yok" 404'ü dönüyor).
     * İki kurulumu da sınamak gerekiyor çünkü ikisi de gerçek: demo açık
     * çalışabiliyor, teslim kapalı.
     */
    {
      ad: 'API · yetkisiz dışa aktarma',
      yol: '/api/disa-aktar?yarisma=x',
      bekle: ANAHTAR ? [401] : [404, 400],
    },
    { ad: 'API · yetkisiz toplu özet', yol: '/api/ozet-toplu', bekle: ANAHTAR ? [401] : [200] },
    { ad: 'API · yetkili toplu özet', yol: '/api/ozet-toplu', bekle: 200, yetkili: true },
    { ad: 'API · toplu değerlendirme önizleme', yol: `/api/degerlendir-toplu?yarisma=${rapor.yarismaId}`, bekle: 200, yetkili: true },

    // ── Rapor dosyası: iki kapı ────────────────────────────────────────
    { ad: 'Dosya · koordinasyon anahtarıyla', yol: `/api/rapor/${rapor.id}/dosya`, bekle: [200, 404], yetkili: true },
    {
      ad: ANAHTAR ? 'Dosya · anahtarsız REDDEDİLİYOR' : 'Dosya · açık kurulumda geçiyor',
      yol: `/api/rapor/${rapor.id}/dosya`,
      bekle: ANAHTAR ? [403] : [200, 404],
    },
  ];

  if (tamamlanan) {
    vakalar.push({
      ad: 'Yarışmacı · sonuç sayfası',
      yol: `/sonuc?basvuru=${encodeURIComponent(tamamlanan.basvuruNo)}`,
      bekle: 200,
    });
  }

  if (hakeminRaporu) {
    vakalar.push(
      {
        ad: 'Hakem · kendi raporu',
        yol: `/hakem/${hakem.hakem.kod}/${hakeminRaporu.rapor_id}`,
        bekle: 200,
      },
      {
        ad: 'Dosya · atanmış hakem koduyla',
        yol: `/api/rapor/${hakeminRaporu.rapor_id}/dosya?kod=${hakem.hakem.kod}`,
        bekle: [200, 404],
      },
      /*
       * Yazışma iki yönlü ve iki ayrı kimlikle çalışıyor. Hakem kendi
       * koduyla giriyor; kod geçersizse ya da rapor ona atanmamışsa
       * yazışmaya hiç erişemiyor.
       */
      {
        ad: 'Yazışma · hakem kendi koduyla okuyor',
        yol: `/api/rapor/${hakeminRaporu.rapor_id}/mesaj?kod=${hakem.hakem.kod}`,
        bekle: 200,
      },
      {
        ad: 'Yazışma · geçersiz kodla reddediliyor',
        yol: `/api/rapor/${hakeminRaporu.rapor_id}/mesaj?kod=YOKBOYLE`,
        bekle: 403,
      },
    );
    if (baskaHakem) {
      /*
       * Bu vaka en önemlilerinden: atanmamış hakem başka bir raporu
       * göremiyor. Rol ayrımının VERİ tarafı burada sınanıyor.
       */
      const baskasi = baglanti()
        .prepare(
          `SELECT id FROM rapor
            WHERE id NOT IN (SELECT rapor_id FROM atama WHERE hakem_id = ?)
            LIMIT 1`,
        )
        .get(baskaHakem.hakem.id) as { id: string } | undefined;
      if (baskasi) {
        vakalar.push({
          ad: 'Hakem · ATANMAMIŞ rapora erişemiyor',
          yol: `/hakem/${baskaHakem.hakem.kod}/${baskasi.id}`,
          bekle: 404,
        });
      }
    }
  }

  if (arsiv) {
    vakalar.push({
      ad: 'Arşiv kaydı panele giremiyor',
      yol: `/hakem/${arsiv.kod}`,
      bekle: 404,
    });
  }

  console.log(`\nDUMAN TESTİ · ${vakalar.length} vaka · ${KOK}`);
  console.log(ANAHTAR ? '  (koordinasyon anahtarı kurulu)\n' : '  (anahtar yok — açık kurulum)\n');

  for (const v of vakalar) await dene(v);

  if (basarisiz.length) {
    for (const b of basarisiz) console.log(`  ✗ ${b}`);
    console.log(`\n${gecen} geçti, ${basarisiz.length} BAŞARISIZ.`);
    process.exitCode = 1;
  } else {
    console.log(`  ${gecen}/${vakalar.length} vaka geçti.\n`);
  }
}

void main();
