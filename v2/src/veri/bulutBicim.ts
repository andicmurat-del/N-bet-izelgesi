// Sunucuda saklama biçimi (saf işlevler; sunucu çağrıları bulut.svelte.ts'te).
// Veri tek belgeye sığmayabilir (belge sınırı 256 KiB): ortak bölüm tek belgede ("ana"), her ayın kayıtları kendi
// belgesinde durur. Her belge verinin JSON metnini taşır: alan adları (servis adları, gün anahtarları) sunucunun alan adı
// kurallarına takılmaz, okurken de yerel kayıtla aynı doğrulamadan geçer.
import type { Veri } from "./tipler";

/** aya göre tutulan bölümler: anahtarları "yil-ay" */
const AY_BOLUMLERI = ["schedules", "puantaj", "acil", "acilElle", "oglen", "servisKayit", "notlar"] as const;
/** yönetim bölümleri: personel, ayarlar, kurum, servis listesi ayarları. Sunucuda ayrı belgede ("nobet/yonetim") durur;
 *  veritabanı kuralı gereği yalnız sahip ve Editor (baş sorumlu) yazar */
export const YONETIM_BOLUMLERI = ["staff", "settings", "kurum", "servisAyar"] as const;
/** bir belgenin metni en çok bu kadar olabilir (sunucu sınırı 256 KiB; kaçış karakterleri ve zarf için pay bırakılır) */
export const BELGE_SINIRI = 200 * 1024;

export interface Parcalar {
  ana: string;
  aylar: Record<string, string>;
  /** yönetim bölümleri (boşsa eski biçim: hepsi ana belgede) */
  yonetim?: string;
}

/** veriyi sunucu belgelerine böler: ana (ortak bölüm), yönetim (ayri ise) ve ay belgeleri ("yil-ay" → o ayın kayıtları).
 *  ayri: false eski biçim (yönetim bölümleri de ana belgede; yönetim belgesi henüz yokken yazma yetkisi olmayan için) */
export function parcala(veri: Veri, ayri = true): Parcalar {
  const ana: Record<string, unknown> = {},
    yon: Record<string, unknown> = {},
    aylar: Record<string, Record<string, unknown>> = {};
  for (const [bolum, deger] of Object.entries(veri)) {
    if (ayri && (YONETIM_BOLUMLERI as readonly string[]).includes(bolum)) {
      yon[bolum] = deger;
      continue;
    }
    if (!(AY_BOLUMLERI as readonly string[]).includes(bolum)) {
      ana[bolum] = deger;
      continue;
    }
    for (const [ayK, x] of Object.entries(deger as Record<string, unknown>)) (aylar[ayK] ??= {})[bolum] = x;
  }
  return {
    ana: JSON.stringify(ana),
    aylar: Object.fromEntries(Object.entries(aylar).map(([k, x]) => [k, JSON.stringify(x)])),
    ...(ayri ? { yonetim: JSON.stringify(yon) } : {}),
  };
}

/** belgelerden veriyi geri kurar (doğrulanmamış; çağıran veriyiDogrula'dan geçirir). oku: güvenli JSON okuyucu */
export function birlestir(p: Parcalar, oku: (metin: string) => unknown): Record<string, unknown> {
  const nesne = (x: unknown) => (x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {});
  // yönetim belgesi varsa onun bölümleri geçerlidir (ana belgede kalmış eski kopyası sayılmaz)
  const v: Record<string, unknown> = { ...nesne(oku(p.ana)), ...(p.yonetim ? nesne(oku(p.yonetim)) : {}) };
  for (const b of AY_BOLUMLERI) v[b] = {};
  for (const [ayK, metin] of Object.entries(p.aylar)) {
    if (!/^\d{4}-\d{1,2}$/.test(ayK)) continue;
    const a = nesne(oku(metin));
    for (const b of AY_BOLUMLERI) if (a[b] !== undefined) (v[b] as Record<string, unknown>)[ayK] = a[b];
  }
  return v;
}

/** iki parça kümesi aynı mı */
export function parcalarAyni(a: Parcalar, b: Parcalar): boolean {
  const ka = Object.keys(a.aylar),
    kb = Object.keys(b.aylar);
  return a.ana === b.ana && (a.yonetim ?? "") === (b.yonetim ?? "") && ka.length === kb.length && ka.every(k => a.aylar[k] === b.aylar[k]);
}

/** parçaların kısa özeti: "bu cihazdaki veri son eşitlemeden beri değişti mi" sorusu için (güvenlik amaçlı değildir) */
export function ozet(p: Parcalar): string {
  let h1 = 0x811c9dc5,
    h2 = 5381,
    n = 0;
  const ekle = (t: string) => {
    n += t.length;
    for (let i = 0; i < t.length; i++) {
      const c = t.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x01000193);
      h2 = (Math.imul(h2, 33) + c) | 0;
    }
  };
  ekle(p.ana);
  if (p.yonetim) ekle("\n#yonetim\n" + p.yonetim);
  for (const k of Object.keys(p.aylar).sort()) {
    ekle("\n" + k + "\n");
    ekle(p.aylar[k]);
  }
  return `${n}-${(h1 >>> 0).toString(36)}-${(h2 >>> 0).toString(36)}`;
}

/** kişi ya da çizelge yok: yeni açılmış, boş uygulama */
export const bosMu = (v: Veri) => !v.staff.length && !Object.keys(v.schedules).length;

/** son eşitlemenin izi (tarayıcıda saklanır): sunucudaki sürüm damgası ve o andaki yerel verinin özeti */
export interface Iz {
  z: number;
  ozet: string;
  /** o andaki bölüm özetleri (bölüm bölüm birleştirmenin tabanı; eski izlerde yok) */
  bolum?: Record<string, string>;
}

export type Karar =
  /** yapılacak bir şey yok: iki taraf aynı */
  | "ayni"
  /** bu cihazdaki veri sunucuya yazılır */
  | "gonder"
  /** sunucudaki veri bu cihaza alınır */
  | "al"
  /** iki tarafta da ayrı değişiklik var: kullanıcıya sorulur */
  | "sor";

/**
 * Sunucudaki ve bu cihazdaki verinin durumuna göre ne yapılacağı. Hiçbir durumda dolu bir taraf sorulmadan ezilmez:
 * yalnız "değişmemiş" ya da "boş" taraf ötekinin verisini alır.
 *  sunucuZ: sunucudaki sürüm damgası (null: sunucuda veri yok); iz: son eşitlemenin izi (null: bu cihaz hiç eşitlenmedi)
 */
export function eslemeKarari(o: {
  sunucuZ: number | null;
  sunucuAyni: boolean;
  iz: Iz | null;
  yerelOzet: string;
  yerelBos: boolean;
}): Karar {
  if (o.sunucuZ === null) return o.yerelBos ? "ayni" : "gonder";
  if (o.sunucuAyni) return "ayni";
  const yerelDegisti = !o.iz || o.iz.ozet !== o.yerelOzet,
    sunucuDegisti = !o.iz || o.iz.z !== o.sunucuZ;
  // hiç eşitlenmemiş boş cihaz (yeni telefon, yeni tarayıcı) sunucudakini alır; eşitlenmiş bir cihazda verinin
  // silinmesi ise bir değişikliktir, aşağıdaki kurallara girer
  if (o.yerelBos && !o.iz) return "al";
  if (!sunucuDegisti) return yerelDegisti ? "gonder" : "ayni";
  return yerelDegisti ? "sor" : "al";
}

// ---------- bölüm bölüm üç yönlü birleştirme (birden çok sorumlu) ----------
// Veri bölümlere ayrılır: ortak bölümler kendi adıyla ("staff", "prefs", "settings"…), aylık bölümler bölüm ve ay olarak
// ("schedules/2026-10", "puantaj/2026-10"…). Son eşitlemedeki her bölümün özeti tarayıcıda saklanır (taban). Eşitlemede
// bir bölüm yalnız bir tarafta değiştiyse o tarafınki alınır; iki tarafta da (farklı biçimde) değiştiyse çatışmadır ve
// yalnız o bölümler için kullanıcıya sorulur. Böylece iki sorumlu farklı aylarda ya da farklı ekranlarda çalışınca
// değişiklikler kendiliğinden birleşir.

/** anahtarları sıralı JSON: aynı içerik, anahtar sırası farklı olsa da aynı metni verir */
export function kararliJson(x: unknown): string {
  if (x === null || typeof x !== "object") return JSON.stringify(x) ?? "null";
  if (Array.isArray(x)) return "[" + x.map(kararliJson).join(",") + "]";
  const o = x as Record<string, unknown>;
  return (
    "{" +
    Object.keys(o)
      .filter(k => o[k] !== undefined)
      .sort()
      .map(k => JSON.stringify(k) + ":" + kararliJson(o[k]))
      .join(",") +
    "}"
  );
}
function metinOzeti(t: string): string {
  let h1 = 0x811c9dc5,
    h2 = 5381;
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = (Math.imul(h2, 33) + c) | 0;
  }
  return `${t.length}-${(h1 >>> 0).toString(36)}-${(h2 >>> 0).toString(36)}`;
}
const ayBolumuMu = (b: string) => (AY_BOLUMLERI as readonly string[]).includes(b);

/** bölüm anahtarı → içerik özeti (olmayan aylık bölüm listede yer almaz) */
export function bolumOzetleri(v: Veri): Record<string, string> {
  const o: Record<string, string> = {};
  for (const [b, deger] of Object.entries(v)) {
    if (!ayBolumuMu(b)) {
      o[b] = metinOzeti(kararliJson(deger));
      continue;
    }
    for (const [ayK, x] of Object.entries(deger as Record<string, unknown>)) o[b + "/" + ayK] = metinOzeti(kararliJson(x));
  }
  return o;
}
function bolumAl(v: Veri, k: string): unknown {
  const [b, ayK] = k.split("/");
  const d = (v as unknown as Record<string, unknown>)[b];
  return ayK === undefined ? d : (d as Record<string, unknown> | undefined)?.[ayK];
}
function bolumYaz(v: Record<string, unknown>, k: string, deger: unknown) {
  const [b, ayK] = k.split("/");
  if (ayK === undefined) {
    v[b] = deger;
    return;
  }
  const d = { ...((v[b] as Record<string, unknown>) ?? {}) };
  if (deger === undefined) delete d[ayK];
  else d[ayK] = deger;
  v[b] = d;
}

export interface Birlesim {
  /** birleşmiş veri (doğrulanmamış: çağıran veriyiDogrula'dan geçirir); çatışan bölümlerde sunucudaki ya da (secim
   *  "yerel" ise) bu cihazdaki */
  sonuc: Record<string, unknown>;
  /** iki tarafta da farklı biçimde değişen bölümler */
  catisan: string[];
  /** bu cihazdan sunucuya gidecek bölümler, sunucudan bu cihaza gelecek bölümler */
  yerelden: string[];
  sunucudan: string[];
}
/** taban: son eşitlemedeki bölüm özetleri. secim: çatışan bölümlerde hangi tarafın alınacağı */
export function ucluBirlestir(taban: Record<string, string>, yerel: Veri, sunucu: Veri, secim: "sunucu" | "yerel" = "sunucu"): Birlesim {
  const oy = bolumOzetleri(yerel),
    os = bolumOzetleri(sunucu);
  const sonuc: Record<string, unknown> = { ...(sunucu as unknown as Record<string, unknown>) };
  const catisan: string[] = [],
    yerelden: string[] = [],
    sunucudan: string[] = [];
  for (const k of new Set([...Object.keys(oy), ...Object.keys(os), ...Object.keys(taban)])) {
    const b = taban[k],
      l = oy[k],
      s = os[k];
    if (l === s) continue;
    if (s === b) {
      yerelden.push(k);
      bolumYaz(sonuc, k, bolumAl(yerel, k));
    } else if (l === b) sunucudan.push(k);
    else {
      catisan.push(k);
      if (secim === "yerel") bolumYaz(sonuc, k, bolumAl(yerel, k));
    }
  }
  return { sonuc, catisan, yerelden, sunucudan };
}

const BOLUM_ADI: Record<string, string> = {
  staff: "personel",
  prefs: "izin ve tercih işaretleri",
  manualTatil: "resmi tatil işaretleri",
  arife: "arife işaretleri",
  settings: "ayarlar",
  kurum: "kurum bilgileri",
  listeOnay: "liste onayları",
  degisimler: "nöbet değişimleri",
  servisAyar: "servis listesi ayarları",
  onayMasa: "onay listesi masaları",
  tatilYillari: "resmi tatil yılları",
  schedules: "nöbet çizelgesi",
  puantaj: "puantaj",
  acil: "acil listesi",
  acilElle: "acil listesi (elle günler)",
  oglen: "öğlen nöbeti",
  servisKayit: "servis hazırlama",
  notlar: "gün notları",
};
/** bölüm anahtarının okunur adı: "Kasım 2026 nöbet çizelgesi", "izin ve tercih işaretleri" */
export function bolumAdi(k: string, aylar: readonly string[]): string {
  const [b, ayK] = k.split("/");
  const ad = BOLUM_ADI[b] ?? b;
  if (ayK === undefined) return ad;
  const [y, m] = ayK.split("-").map(Number);
  return `${aylar[m] ?? "?"} ${y} ${ad}`;
}
