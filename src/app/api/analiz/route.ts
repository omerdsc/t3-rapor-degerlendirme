/**
 * Rapor analizi uç noktası.
 *
 * Deterministik kontroller (MVP 1-2-3) burada koşar; model çağrısı yok,
 * dolayısıyla API maliyeti sıfır. Kriter değerlendirmesi (MVP 6) ayrı bir
 * uç noktada olacak.
 */

import { kapi } from '@/lib/yetki/koordinasyon';
import { raporuAnalizEt } from "@/lib/analiz";

/** Vercel Hobby katmanında fonksiyon süresi sınırlı; analiz ~100 ms sürüyor. */
export const maxDuration = 60;

const AZAMI_BOYUT = 25 * 1024 * 1024;

export async function POST(request: Request) {
  const yetkisiz = kapi(request);
  if (yetkisiz) return yetkisiz;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json(
      { hata: "İstek gövdesi okunamadı." },
      { status: 400 },
    );
  }

  const dosya = form.get("dosya");
  if (!(dosya instanceof File)) {
    return Response.json({ hata: "Dosya bulunamadı." }, { status: 400 });
  }

  if (dosya.size === 0) {
    return Response.json({ hata: "Dosya boş." }, { status: 400 });
  }
  if (dosya.size > AZAMI_BOYUT) {
    return Response.json(
      { hata: `Dosya çok büyük (${(dosya.size / 1024 / 1024).toFixed(1)} MB). Sınır 25 MB.` },
      { status: 413 },
    );
  }

  const veri = new Uint8Array(await dosya.arrayBuffer());

  // PDF sihirli baytı — uzantı yerine içeriğe bakılır (C1).
  if (!(veri[0] === 0x25 && veri[1] === 0x50 && veri[2] === 0x44 && veri[3] === 0x46)) {
    return Response.json(
      { hata: "Bu dosya bir PDF değil. Raporlar PDF olarak yüklenmelidir." },
      { status: 415 },
    );
  }

  try {
    const sonuc = await raporuAnalizEt(veri);
    // Belge nesnesi tüm metni taşıyor; istemciye göndermeye gerek yok.
    const { belge: _belge, ...gonderilecek } = sonuc;
    return Response.json({ dosyaAdi: dosya.name, ...gonderilecek });
  } catch (e) {
    const mesaj = e instanceof Error ? e.message : String(e);
    return Response.json(
      { hata: `Analiz sırasında hata: ${mesaj}` },
      { status: 500 },
    );
  }
}
