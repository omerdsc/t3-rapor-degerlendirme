/**
 * Rapor–hakem ataması.
 *
 * POST   · atama yap (tek rapor ya da toplu)
 * DELETE · atamayı kaldır
 *
 * MALİYET: $0.
 *
 * ── TOPLU ATAMA NEDEN GEREKLİ ───────────────────────────────────────────
 * Bir kategoride 100 rapor ve 5 hakem olduğunda tek tek atamak 100 tıklama
 * demek. Koordinasyon bunu yapmaz; sonuç, atama özelliğinin hiç
 * kullanılmaması olur. Bu yüzden "seçili raporları şu hakemlere dağıt"
 * desteği var ve dağıtım DENGELİ: hakemlerin ELİNDEKİ yük de sayılıyor,
 * en az yüklü hakem önce iş alıyor. Dağıtım hesabı `dagitim.ts` içinde ve
 * test kapsamında; arayüzdeki önizleme aynı fonksiyonu çağırıyor.
 */

import { kapi } from '@/lib/yetki/koordinasyon';
import { dagit } from '@/lib/db/dagitim';
import {
  atamaKaldir, atamalariYaz, hakemGetir, hakemYukleri,
  raporlarinHakemDurumu, raporunHakemleri,
} from '@/lib/db/hakem-depo';
import { raporGetir, raporlariListele } from '@/lib/depo/depo';

export async function POST(istek: Request) {
  const yetkisiz = kapi(istek);
  if (yetkisiz) return yetkisiz;

  let g: {
    raporIdler?: string[];
    hakemIdler?: string[];
    /** Verilirse bu kategorinin TÜM raporları hedef alınır. */
    kategoriId?: string;
    yarismaId?: string;
    /**
     * Kapsam sunucuda hesaplanıyor.
     *
     * `atanmamis` gönderildiğinde istemci rapor kimliklerini SAYMAK
     * zorunda değil. Ölçüldü: 3000 raporda bütün satırları istemciye
     * göndermek atama sayfasını 1,5 MB yapıyordu. İstemcinin "atanmamış
     * olanları dağıt" demek için 3000 kimlik bilmesi gerekmiyor.
     */
    kapsam?: 'atanmamis';
    atayan?: string;
    sonTarih?: string;
    /** Her rapora kaç hakem atanacak — dengeli dağıtımda kullanılır. */
    raporBasinaHakem?: number;
  };
  try {
    g = await istek.json();
  } catch {
    return Response.json({ hata: 'İstek okunamadı.' }, { status: 400 });
  }

  const hakemIdler = (g.hakemIdler ?? []).filter(Boolean);
  if (!hakemIdler.length) {
    return Response.json({ hata: 'En az bir hakem seçilmeli.' }, { status: 400 });
  }
  for (const h of hakemIdler) {
    const hakem = hakemGetir(h);
    if (!hakem) return Response.json({ hata: 'Hakem bulunamadı.' }, { status: 404 });
    /*
     * SİSTEM KAYDINA ATAMA YAPILAMAZ.
     * Arşiv kaydı bir insan değil; ona rapor atamak, hiç kimsenin
     * değerlendirmeyeceği bir işi "atanmış" saymak olurdu.
     */
    if (hakem.sistem) {
      return Response.json(
        { hata: `${hakem.ad} bir sistem kaydı; rapor atanamaz.` },
        { status: 422 },
      );
    }
    if (!hakem.aktif) {
      return Response.json(
        { hata: `${hakem.ad} pasif durumda; atama yapılamaz.` },
        { status: 422 },
      );
    }
  }

  // Hedef raporlar: kapsam sunucuda, ya da istemcinin verdiği liste.
  let raporIdler = (g.raporIdler ?? []).filter(Boolean);

  if (g.kapsam === 'atanmamis') {
    if (!g.yarismaId) {
      return Response.json(
        { hata: 'Kapsam için yarışma gerekli.' },
        { status: 400 },
      );
    }
    const tumu = raporlariListele(g.yarismaId, g.kategoriId);
    const atanmis = new Set(
      raporlarinHakemDurumu(tumu.map((r) => r.id)).keys(),
    );
    raporIdler = tumu.filter((r) => !atanmis.has(r.id)).map((r) => r.id);
  } else if (!raporIdler.length && g.yarismaId) {
    raporIdler = raporlariListele(g.yarismaId, g.kategoriId).map((r) => r.id);
  }
  if (!raporIdler.length) {
    return Response.json({ hata: 'Atanacak rapor bulunamadı.' }, { status: 400 });
  }

  const basinaHakem = Math.max(
    1,
    Math.min(hakemIdler.length, g.raporBasinaHakem ?? 1),
  );

  /*
   * DAĞITIM `dagitim.ts` İÇİNDE.
   *
   * Hesap burada değil, çünkü arayüz de aynı hesabı yapmak zorunda:
   * kullanıcı "ata" düğmesine basmadan önce kaç atama olacağını ve hangi
   * hakeme kaç rapor düşeceğini görüyor. İki ayrı kopya yazılsa önizleme
   * sunucudan sapardı — bu projede nihai puan hesabı tam böyle ayrışmış
   * ve iki ekran farklı puan göstermeye başlamıştı.
   */
  const yukler = new Map(hakemYukleri().map((y) => [y.hakem.id, y.atanan]));

  const hedefler: Array<{ raporId: string; mevcut: string[]; basvuruNo: string }> = [];
  const bulunmayan: string[] = [];
  for (const raporId of raporIdler) {
    const rapor = raporGetir(raporId);
    if (!rapor) {
      bulunmayan.push(`${raporId}: rapor bulunamadı`);
      continue;
    }
    hedefler.push({
      raporId,
      basvuruNo: rapor.basvuruNo,
      mevcut: raporunHakemleri(raporId).map((h) => h.id),
    });
  }

  const sonuc = dagit(
    hedefler,
    hakemIdler.map((id) => ({ id, yuk: yukler.get(id) ?? 0 })),
    basinaHakem,
  );

  // Tek işlemde: 6000 atama tek tek yazılınca 15,5 saniye sürüyordu.
  atamalariYaz(sonuc.ciftler, g.atayan, g.sonTarih);

  const atlanan = [
    ...bulunmayan,
    ...sonuc.atlanan.map((id) => {
      const h = hedefler.find((x) => x.raporId === id);
      return `${h?.basvuruNo ?? id}: seçilen hakemler zaten atanmış`;
    }),
  ];

  return Response.json({ yapilan: sonuc.ciftler.length, atlanan }, { status: 201 });
}

export async function DELETE(istek: Request) {
  const yetkisiz = kapi(istek);
  if (yetkisiz) return yetkisiz;

  let g: { raporId?: string; hakemId?: string };
  try {
    g = await istek.json();
  } catch {
    return Response.json({ hata: 'İstek okunamadı.' }, { status: 400 });
  }
  if (!g.raporId || !g.hakemId) {
    return Response.json({ hata: 'Rapor ve hakem gerekli.' }, { status: 400 });
  }

  const sonuc = atamaKaldir(g.raporId, g.hakemId);
  return Response.json(sonuc, { status: sonuc.kaldirildi ? 200 : 422 });
}
