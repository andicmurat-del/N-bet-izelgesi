// Sunucuda saklama biçimi (saf işlevler; sunucu çağrıları bulut.svelte.ts'te).
// Veri tek belgeye sığmayabilir (belge sınırı 256 KiB): ortak bölüm tek belgede ("ana"), her ayın kayıtları kendi
// belgesinde durur. Her belge verinin JSON metnini taşır: alan adları (servis adları, gün anahtarları) sunucunun alan adı
// kurallarına takılmaz, okurken de yerel kayıtla aynı doğrulamadan geçer.
import type { Veri } from "./tipler";

/** aya göre tutulan bölümler: anahtarları "yil-ay" */
const AY_BOLUMLERI = ["schedules", "puantaj", "acil", "acilElle", "oglen", "servisKayit"] as const;
/** bir belgenin metni en çok bu kadar olabilir (sunucu sınırı 256 KiB; kaçış karakterleri ve zarf için pay bırakılır) */
export const BELGE_SINIRI = 200 * 1024;

export interface Parcalar { ana: string; aylar: Record<string, string> }

/** veriyi sunucu belgelerine böler: ana (ortak bölüm) ve ay belgeleri ("yil-ay" → o ayın kayıtları) */
export function parcala(veri: Veri): Parcalar {
  const ana: Record<string, unknown> = {}, aylar: Record<string, Record<string, unknown>> = {};
  for (const [bolum, deger] of Object.entries(veri)) {
    if (!(AY_BOLUMLERI as readonly string[]).includes(bolum)) { ana[bolum] = deger; continue; }
    for (const [ayK, x] of Object.entries(deger as Record<string, unknown>)) (aylar[ayK] ??= {})[bolum] = x;
  }
  return { ana: JSON.stringify(ana), aylar: Object.fromEntries(Object.entries(aylar).map(([k, x]) => [k, JSON.stringify(x)])) };
}

/** belgelerden veriyi geri kurar (doğrulanmamış; çağıran veriyiDogrula'dan geçirir). oku: güvenli JSON okuyucu */
export function birlestir(p: Parcalar, oku: (metin: string) => unknown): Record<string, unknown> {
  const nesne = (x: unknown) => (x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {});
  const v: Record<string, unknown> = { ...nesne(oku(p.ana)) };
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
  const ka = Object.keys(a.aylar), kb = Object.keys(b.aylar);
  return a.ana === b.ana && ka.length === kb.length && ka.every(k => a.aylar[k] === b.aylar[k]);
}

/** parçaların kısa özeti: "bu cihazdaki veri son eşitlemeden beri değişti mi" sorusu için (güvenlik amaçlı değildir) */
export function ozet(p: Parcalar): string {
  let h1 = 0x811c9dc5, h2 = 5381, n = 0;
  const ekle = (t: string) => { n += t.length; for (let i = 0; i < t.length; i++) { const c = t.charCodeAt(i); h1 = Math.imul(h1 ^ c, 0x01000193); h2 = (Math.imul(h2, 33) + c) | 0; } };
  ekle(p.ana);
  for (const k of Object.keys(p.aylar).sort()) { ekle("\n" + k + "\n"); ekle(p.aylar[k]); }
  return `${n}-${(h1 >>> 0).toString(36)}-${(h2 >>> 0).toString(36)}`;
}

/** kişi ya da çizelge yok: yeni açılmış, boş uygulama */
export const bosMu = (v: Veri) => !v.staff.length && !Object.keys(v.schedules).length;

/** son eşitlemenin izi (tarayıcıda saklanır): sunucudaki sürüm damgası ve o andaki yerel verinin özeti */
export interface Iz { z: number; ozet: string }

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
export function eslemeKarari(o: { sunucuZ: number | null; sunucuAyni: boolean; iz: Iz | null; yerelOzet: string; yerelBos: boolean }): Karar {
  if (o.sunucuZ === null) return o.yerelBos ? "ayni" : "gonder";
  if (o.sunucuAyni) return "ayni";
  const yerelDegisti = !o.iz || o.iz.ozet !== o.yerelOzet, sunucuDegisti = !o.iz || o.iz.z !== o.sunucuZ;
  // hiç eşitlenmemiş boş cihaz (yeni telefon, yeni tarayıcı) sunucudakini alır; eşitlenmiş bir cihazda verinin
  // silinmesi ise bir değişikliktir, aşağıdaki kurallara girer
  if (o.yerelBos && !o.iz) return "al";
  if (!sunucuDegisti) return yerelDegisti ? "gonder" : "ayni";
  return yerelDegisti ? "sor" : "al";
}
