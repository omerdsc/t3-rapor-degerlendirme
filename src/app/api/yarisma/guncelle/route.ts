/**
 * Yarışmayı katalogdan YERİNDE günceller.
 *
 * NEDEN SİLİP YENİDEN KURMAK OLMAZ
 * TEKNOFEST şablonları her yıl — bazen yıl içinde — değişiyor. "Güncelle"
 * yerine "sil ve yeniden kur" yapmak şu üçünü birden götürür:
 *
 *   · hakem puanları ve nihai değerlendirmeler
 *   · yüklenmiş raporlar (kategori kimliğine bağlı)
 *   · yöneticinin elle eklediği ölçütler ve onayları
 *
 * Bu yüzden güncelleme kategoriyi ADIYLA eşleştirip İÇİNİ tazeliyor;
 * kategori kimliği değişmiyor, ona bağlı raporlar yerinde kalıyor.
 *
 * KORUNAN VE DEĞİŞEN
 *   korunur  : kategori kimliği, elle eklenmiş ölçütler, şartname AI özeti
 *   değişir  : şablon bölümleri, şablondan çıkan ölçütler, sayfa/font kuralları
 *   sıfırlanır: onay bayrağı — şablon değiştiyse yeniden gözden geçirilmeli
 *
 * MALİYET: $0. Yapay zekâ çağrısı yapılmaz; var olan AI özeti korunur.
 */

import { rubrikCikar, sablonCikar } from '@/lib/analiz/sablon-cikar';
import { kurallariBirlestir, sartnameCozumle } from '@/lib/analiz/sartname';
import { bicimTespitEt, docxOku } from '@/lib/analiz/belge-docx';
import { pdfOku } from '@/lib/analiz/pdf';
import { belgeKur } from '@/lib/analiz/yapi';
import { katalogOku, katalogYarismasiGetir } from '@/lib/katalog/depo';
import { aktarimPlaniKur, belgeIndir } from '@/lib/katalog/aktar';
import {
  kategoriSablonuTazele, kimlik, sartnameKaydet, yarismaGetir, yarismaKaydet,
} from '@/lib/depo/depo';
import type { RubrikKriteri } from '@/lib/analiz/sablon-cikar';
import type { YarismaKategorisi } from '@/lib/depo/tipler';
import type { AktarimKategorisi } from '@/lib/katalog/aktar';

export const maxDuration = 300;

/**
 * Yöneticinin elle eklediği ölçütleri ayırır.
 *
 * Şablondan çıkan ölçütlerin kodu başlık adından türetiliyor; yeni şablonda
 * o başlık varsa aynı kod yeniden üretilir. Yeni şablonda KARŞILIĞI OLMAYAN
 * ölçüt ise ya kaldırılmış bir bölüm ya da yöneticinin elle eklediği bir
 * madde. İkincisi korunmalı — koordinasyonun "etik beyan var mı" gibi kendi
 * ölçütünü şablon güncellemesi silmemeli.
 */
function elleEklenenler(
  eski: RubrikKriteri[],
  yeniKodlar: Set<string>,
): RubrikKriteri[] {
  return eski.filter((k) => !yeniKodlar.has(k.kod));
}

async function sartnameCoz(url: string, dosyaAdi: string) {
  const veri = await belgeIndir({ url, dosyaAdi } as never);
  const bicim = bicimTespitEt(veri);
  if (bicim === 'docx') {
    const o = docxOku(veri);
    if (!o.tamam) throw new Error(o.hata);
    return sartnameCozumle(o.belge);
  }
  if (bicim === 'pdf') {
    const o = await pdfOku(veri);
    if (!o.tamam) throw new Error(o.hata);
    return sartnameCozumle(belgeKur(o.belge));
  }
  throw new Error('şartname biçimi tanınmadı');
}

export async function POST(request: Request) {
  let govde: { yarismaId?: string };
  try {
    govde = await request.json();
  } catch {
    return Response.json({ hata: 'İstek okunamadı.' }, { status: 400 });
  }
  if (!govde.yarismaId) {
    return Response.json({ hata: 'Yarışma seçilmedi.' }, { status: 400 });
  }

  let yarisma = yarismaGetir(govde.yarismaId);
  if (!yarisma) return Response.json({ hata: 'Yarışma bulunamadı.' }, { status: 404 });

  /*
   * SLUG YOKSA ADA GÖRE BULUNUR VE KALICI YAZILIR.
   *
   * `katalogSlug` alanı sisteme sonradan eklendi; ondan önce kurulmuş
   * yarışmalarda yok. Slug yok diye güncellemeyi reddetmek, mevcut 43
   * yarışmanın hiçbirinin güncellenememesi demekti — oysa katalogda adları
   * birebir duruyor.
   *
   * Bulunan slug kaydediliyor: bir sonraki güncellemede arama gerekmez ve
   * ad değişse bile kaynak bilinir.
   */
  let katalogKaydi = yarisma.katalogSlug
    ? katalogYarismasiGetir(yarisma.katalogSlug)
    : null;

  if (!katalogKaydi) {
    const hedefAd = yarisma.ad.toLocaleLowerCase('tr');
    katalogKaydi =
      katalogOku()?.yarismalar.find(
        (k) => k.ad.toLocaleLowerCase('tr') === hedefAd,
      ) ?? null;

    if (katalogKaydi) {
      await yarismaKaydet({ ...yarisma, katalogSlug: katalogKaydi.slug });
      yarisma = yarismaGetir(yarisma.id)!;
    }
  }

  if (!katalogKaydi) {
    return Response.json(
      {
        hata:
          'Bu yarışma katalogda bulunamadı. Elle kurulmuşsa şablonun yeni ' +
          'sürümünü "Kategori ekle" ile yükleyebilirsiniz.',
      },
      { status: 404 },
    );
  }

  const plan = aktarimPlaniKur(katalogKaydi, yarisma.yil);
  const raporlar: string[] = [];
  const degisen: string[] = [];
  const eklenen: string[] = [];
  const kalan: string[] = [];

  // Ada göre eşleştirme haritası.
  const mevcut = new Map(yarisma.kategoriler.map((k) => [k.ad, k]));
  const planlanan = new Set(plan.kategoriler.map((k) => k.ad));

  for (const hedef of plan.kategoriler) {
    let veri: Uint8Array;
    try {
      veri = await belgeIndir(hedef.sablon);
    } catch (e) {
      raporlar.push(`${hedef.ad}: şablon indirilemedi (${e instanceof Error ? e.message : ''})`);
      continue;
    }
    if (!(veri[0] === 0x50 && veri[1] === 0x4b)) {
      raporlar.push(`${hedef.ad}: şablon Word (.docx) değil, atlandı`);
      continue;
    }

    const eski = mevcut.get(hedef.ad);
    const kod = `kategori-${(eski?.id ?? kimlik()).slice(0, 8)}`;

    let cikarim;
    try {
      cikarim = sablonCikar(veri, kod, hedef.ad, yarisma.yil);
    } catch (e) {
      raporlar.push(`${hedef.ad}: şablon çözümlenemedi (${e instanceof Error ? e.message : ''})`);
      continue;
    }

    const yeniRubrik = rubrikCikar(cikarim);
    let sablonAyni = false;

    if (eski) {
      const yeniKodlar = new Set(yeniRubrik.kriterler.map((k) => k.kod));
      const elle = elleEklenenler(eski.rubrik.kriterler, yeniKodlar);

      /*
       * ŞABLON GERÇEKTEN DEĞİŞTİ Mİ?
       *
       * Karşılaştırma YALNIZCA şablondan gelen ölçütler üzerinden yapılıyor.
       * İlk sürüm bütün ölçütleri sayıyordu ve bu şu hataya yol açıyordu:
       * yönetici elle bir ölçüt eklediğinde (9 + 1 = 10), sonraki her
       * güncelleme "10 ≠ 9" diyerek şablonun değiştiğini sanıyor ve onayı
       * sıfırlıyordu. Hiçbir şey değişmemiş olsa bile.
       *
       * Onayı gereksiz sıfırlamak sistemin en önemli güvencesini yıpratır:
       * "onay bekliyor" uyarısı her güncellemede çıkarsa anlamını yitirir.
       */
      const eskiSablonKodlari = eski.rubrik.kriterler
        .filter((k) => !elle.some((e) => e.kod === k.kod))
        .map((k) => `${k.kod}:${k.puan}`)
        .sort()
        .join('|');
      const yeniSablonKodlari = yeniRubrik.kriterler
        .map((k) => `${k.kod}:${k.puan}`)
        .sort()
        .join('|');

      const ayni =
        eski.sablonDosyasi === hedef.sablon.dosyaAdi &&
        eskiSablonKodlari === yeniSablonKodlari;

      /*
       * ŞABLON DEĞİŞMEDİYSE RUBRİK TAZELENMEZ — AMA DÖNGÜ DEVAM EDER.
       *
       * İlk sürüm burada `continue` yapıyordu ve bu, aşağıdaki ŞARTNAME
       * bloğunun hiç çalışmaması demekti. Şablonlar çoğu zaman değişmediği
       * için normal akışta şartname asla tazelenmiyordu: 80 kategorinin
       * 79'unda şartname kaynağı boş kaldı ve o kategorilerin özeti hiç
       * üretilemez hale geldi.
       */
      if (ayni) {
        kalan.push(hedef.ad);
        sablonAyni = true;
      }

      // Onayı SIFIRLAYAN fonksiyon: şablon dışarıdan değişti, yeniden
      // gözden geçirilmeli. Şablon aynıysa hiç dokunulmuyor.
      if (!sablonAyni) {
        await kategoriSablonuTazele(yarisma.id, eski.id, {
          sablonDosyasi: hedef.sablon.dosyaAdi,
          asama: hedef.asama,
          sablon: cikarim.sablon,
          kurallar: cikarim.kurallar,
          rubrik: {
            // Elle eklenen ölçütler korunuyor; şablondan gelenler tazelendi.
            kriterler: [...yeniRubrik.kriterler, ...elle],
            toplamPuan:
              yeniRubrik.toplamPuan + elle.reduce((t, k) => t + k.puan, 0),
          },
          ornekKaynaklar: cikarim.ornekKaynaklar,
          uyarilar: cikarim.uyarilar,
        });
      }

      if (!sablonAyni) {
        degisen.push(
          `${hedef.ad}: şablondan ${yeniRubrik.kriterler.length} ölçüt tazelendi` +
            (elle.length ? `, ${elle.length} elle eklenen ölçüt korundu` : ''),
        );
      }
    } else {
      const yeni: YarismaKategorisi = {
        id: kimlik(),
        ad: hedef.ad,
        sablonDosyasi: hedef.sablon.dosyaAdi,
        asama: hedef.asama,
        olusturuldu: new Date().toISOString(),
        duzenlendi: false,
        sablon: cikarim.sablon,
        kurallar: cikarim.kurallar,
        rubrik: yeniRubrik,
        ornekKaynaklar: cikarim.ornekKaynaklar,
        uyarilar: cikarim.uyarilar,
      };
      await yarismaKaydet({
        ...yarismaGetir(yarisma.id)!,
        kategoriler: [...yarismaGetir(yarisma.id)!.kategoriler, yeni],
      });
      eklenen.push(hedef.ad);
    }

    // Şartname: AI özeti KORUNUYOR, yalnızca deterministik kurallar tazeleniyor.
    const belge = hedef.teknikSartname ?? hedef.sartname;
    const kategoriId = mevcut.get(hedef.ad)?.id
      ?? yarismaGetir(yarisma.id)?.kategoriler.find((k) => k.ad === hedef.ad)?.id;
    if (belge && kategoriId) {
      try {
        const cozum = await sartnameCoz(belge.url, belge.dosyaAdi);
        const oncekiOzet = mevcut.get(hedef.ad)?.sartname?.ozet;
        const birlesik = kurallariBirlestir(
          cikarim.sablon.asgariSayfa,
          cikarim.sablon.azamiSayfa,
          cozum.kurallar,
        );
        await sartnameKaydet(yarisma.id, kategoriId, {
          dosyaAdi: belge.dosyaAdi,
          yuklendi: new Date().toISOString(),
          sayfaSayisi: cozum.sayfaSayisi,
          kelimeSayisi: cozum.kelimeSayisi,
          kurallar: cozum.kurallar,
          // Var olan özet ücretli üretilmişti; güncelleme onu harcamamalı.
          ozet: oncekiOzet,
          catismalar: birlesik.catisma,
          uyarilar: cozum.uyarilar,
          kaynakUrl: belge.url,
          teknikMi: belge.tur === 'teknik_sartname' ? true : undefined,
        });
      } catch (e) {
        raporlar.push(
          `${hedef.ad}: şartname tazelenemedi (${e instanceof Error ? e.message : ''})`,
        );
      }
    }
  }

  /*
   * KALDIRILMIŞ KATEGORİLER SİLİNMİYOR.
   *
   * TEKNOFEST bir kategoriyi kaldırdığında o kategorideki raporlar ve hakem
   * puanları hâlâ geçerli — geçmiş bir değerlendirmenin kaydı. Silmek veri
   * kaybı olur. Yalnızca bildiriliyor; kaldırma kararı yöneticinin.
   */
  const artikYok = yarisma.kategoriler
    .filter((k) => !planlanan.has(k.ad))
    .map((k) => k.ad);

  return Response.json({
    yarismaId: yarisma.id,
    degisen,
    eklenen,
    degismeyen: kalan,
    katalogdaYok: artikYok,
    uyarilar: raporlar,
  });
}
