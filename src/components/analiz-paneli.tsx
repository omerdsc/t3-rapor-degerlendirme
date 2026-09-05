"use client";

import { useCallback, useRef, useState } from "react";
import type { Bulgu, KontrolSonucu, Seviye } from "@/lib/analiz/tipler";

interface AnalizYaniti {
  dosyaAdi: string;
  basarili: boolean;
  hata?: string;
  kontroller: KontrolSonucu[];
  genelDurum: Seviye;
  kritikBulgular: Bulgu[];
  istatistik: {
    sayfaSayisi: number;
    kelimeSayisi: number;
    gorselSayisi: number;
    baslikSayisi: number;
    taranmisMi: boolean;
    metinBozulmaOrani: number;
    yinelenenSatirSayisi: number;
    sureMs: number;
  };
}

type Kayit =
  | { durum: "bekliyor"; ad: string }
  | { durum: "tamam"; ad: string; sonuc: AnalizYaniti }
  | { durum: "hata"; ad: string; mesaj: string };

const CIP: Record<Seviye, string> = {
  temiz: "bg-yesil-zemin text-yesil-koyu",
  bilgi: "bg-mavi-zemin text-mavi-koyu",
  uyari: "bg-amber-zemin text-amber-koyu",
  hata: "bg-kirmizi-zemin text-kirmizi-koyu",
};

const CIP_ETIKET: Record<Seviye, string> = {
  temiz: "TEMİZ",
  bilgi: "BİLGİ",
  uyari: "İNCELEME",
  hata: "SORUNLU",
};

function Isaret({ seviye }: { seviye: Seviye }) {
  if (seviye === "temiz") {
    return (
      <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-yesil-zemin">
        <svg viewBox="0 0 24 24" className="size-3 stroke-yesil" fill="none" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round">
          <path d="m20 6-11 11-5-5" />
        </svg>
      </span>
    );
  }
  if (seviye === "hata") {
    return (
      <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-kirmizi-zemin">
        <svg viewBox="0 0 24 24" className="size-3 stroke-kirmizi" fill="none" strokeWidth={3} strokeLinecap="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </span>
    );
  }
  const renk = seviye === "uyari" ? "bg-amber-zemin stroke-amber" : "bg-mavi-zemin stroke-mavi";
  return (
    <span className={`flex size-[22px] shrink-0 items-center justify-center rounded-full ${renk.split(" ")[0]}`}>
      <svg viewBox="0 0 24 24" className={`size-3 ${renk.split(" ")[1]}`} fill="none" strokeWidth={3} strokeLinecap="round">
        <path d="M12 7v6M12 16.5v.5" />
      </svg>
    </span>
  );
}

function BulguSatiri({ bulgu }: { bulgu: Bulgu }) {
  const kenar =
    bulgu.seviye === "hata"
      ? "border-kirmizi"
      : bulgu.seviye === "uyari"
        ? "border-amber"
        : "border-mavi";

  return (
    <div className={`border-l-[3px] ${kenar} bg-zemin/60 py-2.5 pl-3 pr-3`}>
      <div className="flex items-start gap-2">
        <span className="text-[12.5px] leading-snug font-bold">{bulgu.baslik}</span>
        {bulgu.sayfa ? (
          <span className="mt-px shrink-0 rounded bg-white px-1.5 py-px text-[10px] font-bold text-metin-2 ring-1 ring-cizgi">
            s.{bulgu.sayfa}
          </span>
        ) : null}
        <code className="ml-auto shrink-0 text-[9.5px] font-semibold tracking-wide text-metin-3">
          {bulgu.kod}
        </code>
      </div>
      <p className="mt-1 text-[11.5px] leading-relaxed text-metin-2">{bulgu.aciklama}</p>
      {bulgu.kanit ? (
        <p className="mt-1.5 truncate border-l-2 border-cizgi pl-2 text-[11px] text-metin-3 italic">
          {bulgu.kanit}
        </p>
      ) : null}
    </div>
  );
}

function KontrolKarti({ kontrol }: { kontrol: KontrolSonucu }) {
  return (
    <div className="rounded-xl border border-cizgi bg-white">
      <div className="flex items-center gap-2.5 px-4 py-3">
        <Isaret seviye={kontrol.durum} />
        <span className="text-[13.5px] font-bold">{kontrol.ad}</span>
        <span className="text-[11.5px] font-medium text-metin-2">{kontrol.ozet}</span>
        <span className={`ml-auto rounded px-2 py-0.5 text-[9.5px] font-bold tracking-wide ${CIP[kontrol.durum]}`}>
          {CIP_ETIKET[kontrol.durum]}
        </span>
      </div>
      {kontrol.bulgular.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-cizgi px-4 py-3">
          {kontrol.bulgular.map((b, i) => (
            <BulguSatiri key={`${b.kod}-${i}`} bulgu={b} />
          ))}
        </div>
      )}
    </div>
  );
}

function SonucKarti({ kayit }: { kayit: Extract<Kayit, { durum: "tamam" }> }) {
  const { sonuc } = kayit;
  const i = sonuc.istatistik;

  return (
    <section className="rounded-xl border border-cizgi bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-cizgi px-5 py-4">
        <Isaret seviye={sonuc.genelDurum} />
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-extrabold tracking-tight">{sonuc.dosyaAdi}</h2>
          <p className="mt-0.5 text-[11.5px] font-medium text-metin-2">
            {i.sayfaSayisi} sayfa · {i.kelimeSayisi.toLocaleString("tr")} kelime ·{" "}
            {i.baslikSayisi} başlık · {i.gorselSayisi} görsel · {i.sureMs} ms
          </p>
        </div>
        <span className={`ml-auto rounded-md px-2.5 py-1 text-[10.5px] font-bold tracking-wide ${CIP[sonuc.genelDurum]}`}>
          {sonuc.kritikBulgular.length > 0
            ? `${sonuc.kritikBulgular.length} KRİTİK BULGU`
            : CIP_ETIKET[sonuc.genelDurum]}
        </span>
      </div>

      {!sonuc.basarili ? (
        <p className="px-5 py-4 text-[12.5px] font-medium text-kirmizi-koyu">{sonuc.hata}</p>
      ) : (
        <>
          <div className="flex flex-col gap-2.5 p-4">
            {sonuc.kontroller.map((k) => (
              <KontrolKarti key={k.kod} kontrol={k} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-cizgi bg-zemin/60 px-5 py-2.5 text-[10.5px] font-semibold text-metin-2">
            <span>{i.yinelenenSatirSayisi} yinelenen satır elendi</span>
            <span>metin bozulma katsayısı: {i.metinBozulmaOrani}</span>
            {i.taranmisMi && <span className="text-kirmizi-koyu">taranmış PDF</span>}
            <span className="ml-auto text-yesil-koyu">API maliyeti: $0,00</span>
          </div>
        </>
      )}
    </section>
  );
}

export default function AnalizPaneli() {
  const [kayitlar, setKayitlar] = useState<Kayit[]>([]);
  const [suruklenIyor, setSuruklenIyor] = useState(false);
  const girdiRef = useRef<HTMLInputElement>(null);

  const analizEt = useCallback(async (dosyalar: FileList | File[]) => {
    const liste = Array.from(dosyalar).filter((d) => d.size > 0);
    if (!liste.length) return;

    setKayitlar(liste.map((d) => ({ durum: "bekliyor", ad: d.name })));

    // Sıralı işliyoruz: tek makinede paralel PDF ayrıştırma belleği zorluyor.
    for (let i = 0; i < liste.length; i++) {
      const gövde = new FormData();
      gövde.append("dosya", liste[i]);
      try {
        const yanit = await fetch("/api/analiz", { method: "POST", body: gövde });
        const veri = await yanit.json();
        setKayitlar((önceki) => {
          const yeni = [...önceki];
          yeni[i] = yanit.ok
            ? { durum: "tamam", ad: liste[i].name, sonuc: veri }
            : { durum: "hata", ad: liste[i].name, mesaj: veri.hata ?? "Bilinmeyen hata" };
          return yeni;
        });
      } catch (e) {
        const mesaj = e instanceof Error ? e.message : "Ağ hatası";
        setKayitlar((önceki) => {
          const yeni = [...önceki];
          yeni[i] = { durum: "hata", ad: liste[i].name, mesaj };
          return yeni;
        });
      }
    }
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setSuruklenIyor(true);
        }}
        onDragLeave={() => setSuruklenIyor(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSuruklenIyor(false);
          void analizEt(e.dataTransfer.files);
        }}
        className={`flex items-center gap-4 rounded-xl border-[1.5px] border-dashed bg-white px-5 py-6 transition-colors ${
          suruklenIyor ? "border-kirmizi bg-kirmizi-zemin/40" : "border-metin-3/50"
        }`}
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-[11px] bg-zemin">
          <svg viewBox="0 0 24 24" className="size-5 stroke-metin-2" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <path d="m17 8-5-5-5 5M12 3v12" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold">Raporları buraya sürükleyin</p>
          <p className="mt-0.5 text-[11.5px] font-medium text-metin-2">
            PDF · en fazla 25 MB · birden fazla dosya seçilebilir
          </p>
        </div>
        <input
          ref={girdiRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void analizEt(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => girdiRef.current?.click()}
          className="shrink-0 dugme bg-kirmizi px-4 py-2.5 text-[12.5px] font-bold text-white transition-colors hover:bg-kirmizi-koyu"
        >
          Dosya seç
        </button>
      </div>

      {kayitlar.map((kayit, i) => {
        if (kayit.durum === "bekliyor") {
          return (
            <div key={`${kayit.ad}-${i}`} className="flex items-center gap-3 rounded-xl border border-cizgi bg-white px-5 py-4">
              <span className="size-[22px] shrink-0 animate-spin rounded-full border-2 border-cizgi border-t-kirmizi" />
              <span className="truncate text-[13px] font-bold">{kayit.ad}</span>
              <span className="text-[11.5px] font-medium text-metin-2">analiz ediliyor…</span>
            </div>
          );
        }
        if (kayit.durum === "hata") {
          return (
            <div key={`${kayit.ad}-${i}`} className="rounded-xl border border-kirmizi/40 bg-white px-5 py-4">
              <div className="flex items-center gap-3">
                <Isaret seviye="hata" />
                <span className="truncate text-[13px] font-bold">{kayit.ad}</span>
              </div>
              <p className="mt-1.5 pl-[34px] text-[11.5px] font-medium text-kirmizi-koyu">{kayit.mesaj}</p>
            </div>
          );
        }
        return <SonucKarti key={`${kayit.ad}-${i}`} kayit={kayit} />;
      })}
    </div>
  );
}
