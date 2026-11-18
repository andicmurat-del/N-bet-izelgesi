// "Bu ay yapılacaklar": ayın iş sırası (personel → izinler → nöbet çizelgesi ve onayı → acil listesi → onay listesi ve öğlen
// haftaları → çıktı) ve her adımın o anki durumu. Çıktı alınıp alınmadığı yalnız bu tarayıcıda tutulur (veriye girmez).
import { acilKadrosunda } from "../motor";
import { KAYIT_ANAHTARI } from "./dogrulama";
import { aydaCalisanlar, ayCizelgesi, depo, haftaOnayi, listeOnayi, tatilMi } from "./depo.svelte";
import { ayAnahtari, gunSayisi, haftaAnahtari, haftaGunu } from "./tarih";

const CIKTI_ANAHTAR = KAYIT_ANAHTARI + "-cikti";
function ciktiOku(): Record<string, number> {
  try {
    const o = JSON.parse(localStorage.getItem(CIKTI_ANAHTAR) || "{}");
    return o && typeof o === "object" && !Array.isArray(o) ? o : {};
  } catch {
    return {};
  }
}
/** ay → nöbet çizelgesinin PDF ya da Excel olarak son alındığı zaman */
export const ciktiIzi = $state<Record<string, number>>(ciktiOku());
export function ciktiAlindi(y: number, m: number, simdi = Date.now()) {
  ciktiIzi[ayAnahtari(y, m)] = simdi;
  try {
    localStorage.setItem(CIKTI_ANAHTAR, JSON.stringify(ciktiIzi));
  } catch {
    /* yer yoksa yalnız bu oturumda tutulur */
  }
}

/** tamam: yapıldı; kismen: başlandı ama bitmedi (ör. çizelge var, onay yok); bekliyor: yapılmadı */
export type AdimDurumu = "tamam" | "kismen" | "bekliyor";
/** adıma dokununca gidilecek yer */
export type AdimHedefi = "kisiler" | "izinler" | "nobet" | "acil" | "onay" | "oglen";
export interface Adim {
  baslik: string;
  ayrinti: string;
  durum: AdimDurumu;
  hedef: AdimHedefi;
}

/** ayın hafta içi günü olan haftaları (Pazartesi anahtarıyla); bütün hafta içi günleri tatil olan hafta sayılmaz */
function ayinHaftalari(y: number, m: number): { anahtar: string; gun: number }[] {
  const l = new Map<string, number>();
  for (let d = 1; d <= gunSayisi(y, m); d++) {
    if (haftaGunu(y, m, d) > 4 || tatilMi(y, m, d)) continue;
    const k = haftaAnahtari(y, m, d);
    if (!l.has(k)) l.set(k, d);
  }
  return [...l].map(([anahtar, gun]) => ({ anahtar, gun }));
}

/** ayın adımları, iş sırasıyla */
export function ayAdimlari(y: number, m: number): Adim[] {
  const ayK = ayAnahtari(y, m),
    c = ayCizelgesi(y, m);
  const kisiler = aydaCalisanlar(y, m);
  const eczane = kisiler.filter(k => !acilKadrosunda(k) && k.role !== "destek");
  const personelTamam = eczane.length >= 2 && eczane.some(k => k.role === "eczaci" || k.role === "nobetci");
  const ek = `-${y}-${m}-`;
  const isaret = Object.keys(depo.veri.prefs).filter(k => k.includes(ek)).length;
  const tatil = Object.keys(depo.veri.manualTatil).filter(k => k.startsWith(`${y}-${m}-`)).length;
  const adimlar: Adim[] = [
    {
      baslik: "Personel",
      ayrinti: personelTamam ? `${kisiler.length} kişi` : "En az 2 nöbetçi ve bir eczacı gerekir",
      durum: personelTamam ? "tamam" : "bekliyor",
      hedef: "kisiler",
    },
    {
      baslik: "İzin ve tatiller",
      ayrinti: `${isaret} izin / tercih işareti · ${tatil} resmi tatil`,
      // çizelgeden önce yapılır: çizelge varsa geçilmiş sayılır
      durum: c ? "tamam" : isaret || tatil ? "kismen" : "bekliyor",
      hedef: "izinler",
    },
    {
      baslik: "Nöbet çizelgesi",
      ayrinti: !c ? "Oluşturulmadı" : c.onay ? "Onaylandı" : "Taslak: onay bekliyor",
      durum: !c ? "bekliyor" : c.onay ? "tamam" : "kismen",
      hedef: "nobet",
    },
  ];
  if (kisiler.some(acilKadrosunda)) {
    const onayli = !!listeOnayi("acil", y, m),
      var_ = Object.keys(depo.veri.acil[ayK] ?? {}).length > 0;
    adimlar.push({
      baslik: "Acil nöbet listesi",
      ayrinti: onayli ? "Onaylandı" : var_ ? "Onay bekliyor" : "Oluşturulmadı",
      durum: onayli ? "tamam" : var_ ? "kismen" : "bekliyor",
      hedef: "acil",
    });
  }
  const haftalar = ayinHaftalari(y, m);
  for (const [tur, baslik, hedef] of [
    ["onay", "Onay listesi", "onay"],
    ["oglen", "Öğlen nöbeti", "oglen"],
  ] as const) {
    const n = haftalar.filter(h => haftaOnayi(tur, y, m, h.gun)).length;
    adimlar.push({
      baslik,
      ayrinti: `${n}/${haftalar.length} hafta onaylı`,
      durum: n === haftalar.length ? "tamam" : n ? "kismen" : "bekliyor",
      hedef,
    });
  }
  const cikti = ciktiIzi[ayK];
  adimlar.push({
    baslik: "Çıktı",
    ayrinti: cikti
      ? "Alındı: " + new Date(cikti).toLocaleDateString("tr-TR", { day: "numeric", month: "long" })
      : "PDF ya da Excel alınmadı",
    durum: cikti ? "tamam" : "bekliyor",
    hedef: "nobet",
  });
  return adimlar;
}
