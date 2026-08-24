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
 * desteği var ve dağıtım DENGELİ: her hakeme yakın sayıda rapor düşüyor.
 */

import {
  atamaKaldir, atamaYap, hakemGetir, raporunHakemleri,
} from '@/lib/db/hakem-depo';
import { raporGetir, raporlariListele } from '@/lib/depo/depo';

export async function POST(istek: Request) {
  let g: {
    raporIdler?: string[];
    hakemIdler?: string[];
    /** Verilirse bu kategorinin TÜM raporları hedef alınır. */
    kategoriId?: string;
    yarismaId?: string;
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
    if (!hakem.aktif) {
      return Response.json(
        { hata: `${hakem.ad} pasif durumda; atama yapılamaz.` },
        { status: 422 },
      );
    }
  }

  // Hedef raporlar: doğrudan liste ya da kategorinin tamamı.
  let raporIdler = (g.raporIdler ?? []).filter(Boolean);
  if (!raporIdler.length && g.yarismaId) {
    raporIdler = raporlariListele(g.yarismaId, g.kategoriId).map((r) => r.id);
  }
  if (!raporIdler.length) {
    return Response.json({ hata: 'Atanacak rapor bulunamadı.' }, { status: 400 });
  }

  const basinaHakem = Math.max(
    1,
    Math.min(hakemIdler.length, g.raporBasinaHakem ?? 1),
  );

  const yapilan: Array<{ raporId: string; hakemId: string }> = [];
  const atlanan: string[] = [];

  /*
   * DENGELİ DAĞITIM.
   *
   * Raporlar hakemlere dönüşümlü (round-robin) dağıtılıyor ve başlangıç
   * noktası her rapor için kayıyor. Rastgele dağıtım bazı hakemlere iki kat
   * yük bindirebiliyor; sabit sıra ise ilk hakemi hep birinci yapıyor.
   */
  let imlec = 0;
  for (const raporId of raporIdler) {
    const rapor = raporGetir(raporId);
    if (!rapor) {
      atlanan.push(`${raporId}: rapor bulunamadı`);
      continue;
    }

    const mevcut = new Set(raporunHakemleri(raporId).map((h) => h.id));

    let atanmis = 0;
    for (let i = 0; i < hakemIdler.length && atanmis < basinaHakem; i++) {
      const hakemId = hakemIdler[(imlec + i) % hakemIdler.length];
      // Zaten atanmışsa yeniden atamaya çalışmıyoruz.
      if (mevcut.has(hakemId)) continue;
      atamaYap(raporId, hakemId, g.atayan, g.sonTarih);
      yapilan.push({ raporId, hakemId });
      atanmis++;
    }

    if (!atanmis && mevcut.size) {
      atlanan.push(`${rapor.basvuruNo}: seçilen hakemler zaten atanmış`);
    }
    imlec += basinaHakem;
  }

  return Response.json({ yapilan: yapilan.length, atlanan }, { status: 201 });
}

export async function DELETE(istek: Request) {
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
