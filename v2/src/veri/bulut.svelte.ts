// Sunucuda saklama: veriler claude.ai'nin bu sayfaya ayırdığı veritabanında da tutulur; aynı hesapla başka bir
// bilgisayardan ya da telefondan açılınca aynı veriler gelir. Tarayıcı kaydı (depo.svelte.ts) olduğu gibi kalır: sayfa
// önce oradan açılır, sunucuya ulaşılamazsa uygulama eskisi gibi çalışır.
//
// Kurallar (bulutBicim.ts > eslemeKarari): yalnız değişmemiş ya da hiç eşitlenmemiş boş taraf ötekinin verisini alır.
// İki tarafta da ayrı değişiklik varsa (ör. iki cihazda aynı anda çalışıldı) hiçbiri ezilmez, kullanıcıya sorulur.
// Belgeler: "nobet/ana" (ortak bölüm + sürüm damgası z), "nobet/ana/aylar/<yil-ay>" (ayın kayıtları). Önce ay belgeleri,
// en son ana belge yazılır; öteki cihazlar ana belgenin damgası değişince yeniden okur.
import { depo, guvenliJson, tumVeriyiDegistir, veriAnlik, veriyiDogrula } from "./depo.svelte";
import { BELGE_SINIRI, birlestir, bosMu, eslemeKarari, ozet, parcala, parcalarAyni, type Iz, type Parcalar } from "./bulutBicim";

// claude.ai "db" yeteneğinin kullanılan kısmı
interface Belge { exists: boolean; data(): Record<string, unknown> | undefined; id: string; metadata?: { hasPendingWrites?: boolean } }
interface BelgeRef { get(): Promise<Belge>; set(d: Record<string, unknown>): Promise<void>; delete(): Promise<void>; onSnapshot(n: (b: Belge) => void, h?: (e: unknown) => void): () => void }
interface Db { doc(yol: string): BelgeRef; collection(yol: string): { doc(id: string): BelgeRef; limit(n: number): { get(): Promise<{ docs: Belge[] }> } } }

const ANA = "nobet/ana", AYLAR = "nobet/ana/aylar", IZ_ANAHTAR = "nobet-cizelgesi-v2-bulut";
const cihaz = Math.random().toString(36).slice(2, 10);

export type BulutDurumu =
  /** sunucu yanıtı bekleniyor */ | "bekliyor"
  /** bu görünümde sunucu yok: yalnız tarayıcı kaydı */ | "kapali"
  | "esit" | "gonderiliyor" | "hata"
  /** iki tarafta da değişiklik var: kullanıcı seçecek */ | "cakisma";
export const bulut = $state({ durum: "bekliyor" as BulutDurumu, mesaj: "", sunucuZaman: 0 });

let db: Db | null = null;
/** sunucudaki son bilinen içerik ve sürüm damgası */
let bilinen: Parcalar | null = null, bilinenZ: number | null = null;
let mesgul = false, yeniden = false, bekleyen: { p: Parcalar; z: number } | null = null;
let zamanlayici: ReturnType<typeof setTimeout> | undefined;

function izOku(): Iz | null {
  try { const o = JSON.parse(localStorage.getItem(IZ_ANAHTAR) || "null"); return o && Number.isFinite(o.z) && typeof o.ozet === "string" ? { z: o.z, ozet: o.ozet } : null; }
  catch { return null; }
}
function izYaz(iz: Iz) { try { localStorage.setItem(IZ_ANAHTAR, JSON.stringify(iz)); } catch { /* yer yoksa bir sonraki açılışta yeniden karşılaştırılır */ } }

const metinMi = (x: unknown): x is string => typeof x === "string";
async function sunucudanOku(d: Db, ana: Belge): Promise<{ p: Parcalar; z: number }> {
  const a = ana.data() ?? {};
  if (!metinMi(a.json)) throw new Error("Sunucudaki kayıt okunamadı.");
  const aylar: Record<string, string> = {};
  for (const b of (await d.collection(AYLAR).limit(1000).get()).docs) { const j = b.data()?.json; if (metinMi(j)) aylar[b.id] = j; }
  return { p: { ana: a.json, aylar }, z: Number(a.z) || 0 };
}
const bayt = (t: string) => new TextEncoder().encode(JSON.stringify(t)).length;
async function sunucuyaYaz(d: Db, p: Parcalar) {
  for (const [k, t] of [["ortak bölüm", p.ana], ...Object.entries(p.aylar)])
    if (bayt(t) > BELGE_SINIRI) throw new Error(`Sunucuya yazılamadı: ${k} kaydı çok büyük. Veriler bu tarayıcıda duruyor; yedek alın.`);
  const kol = d.collection(AYLAR);
  for (const [k, t] of Object.entries(p.aylar)) if (bilinen?.aylar[k] !== t) await kol.doc(k).set({ json: t });
  for (const k of Object.keys(bilinen?.aylar ?? {})) if (!(k in p.aylar)) await kol.doc(k).delete();
  const z = Math.max(Date.now(), (bilinenZ ?? 0) + 1);
  await d.doc(ANA).set({ z, cihaz, surum: 1, json: p.ana });
  bilinen = p; bilinenZ = z;
  izYaz({ z, ozet: ozet(p) });
}
function sunucudakiniUygula(s: { p: Parcalar; z: number }) {
  const v = veriyiDogrula(birlestir(s.p, guvenliJson));
  tumVeriyiDegistir(v);
  izYaz({ z: s.z, ozet: ozet(parcala(v)) });
}

async function esitle() {
  const d = db;
  if (!d || bulut.durum === "cakisma" || depo.baskaPencere) return;
  if (mesgul) { yeniden = true; return; }
  mesgul = true;
  try {
    do {
      yeniden = false;
      const yerelVeri = veriAnlik(), yerel = parcala(yerelVeri);
      const ana = await d.doc(ANA).get(), z = ana.exists ? Number(ana.data()?.z) || 0 : null;
      const sunucu = z === null ? null : z === bilinenZ && bilinen ? { p: bilinen, z } : await sunucudanOku(d, ana);
      bilinen = sunucu?.p ?? null; bilinenZ = sunucu?.z ?? null;
      const yerelOzet = ozet(yerel);
      const karar = eslemeKarari({ sunucuZ: bilinenZ, sunucuAyni: !!sunucu && parcalarAyni(sunucu.p, yerel), iz: izOku(), yerelOzet, yerelBos: bosMu(yerelVeri) });
      if (karar === "sor") { bekleyen = sunucu; bulut.durum = "cakisma"; return; }
      if (karar === "gonder") { bulut.durum = "gonderiliyor"; await sunucuyaYaz(d, yerel); }
      else if (karar === "al" && sunucu) sunucudakiniUygula(sunucu);
      else if (sunucu) izYaz({ z: sunucu.z, ozet: yerelOzet });
      // hesap sürerken veri değiştiyse (ya da sunucudan alındıysa) bir kez daha bakılır
      if (veriAnlik() !== yerelVeri && karar !== "al") yeniden = true;
    } while (yeniden);
    bulut.durum = "esit"; bulut.mesaj = ""; bulut.sunucuZaman = bilinenZ ?? 0;
  } catch (e) {
    bulut.durum = "hata";
    bulut.mesaj = e instanceof Error && /^Sunucu/.test(e.message) ? e.message : "Sunucuya ulaşılamadı; veriler bu tarayıcıda duruyor. Bağlantı gelince yeniden denenir.";
    planla(30000);
  } finally { mesgul = false; }
}
function planla(ms: number) {
  if (!db) return;
  clearTimeout(zamanlayici);
  zamanlayici = setTimeout(esitle, ms);
}

/** Çakışmada kullanıcının seçimi: "sunucu" sunucudaki veriyi bu cihaza alır (bu cihazdaki veri Ayarlar > Yedek'ten geri
 *  alınabilir), "cihaz" bu cihazdaki veriyi sunucuya yazar */
export function cakismayiCoz(secim: "sunucu" | "cihaz") {
  if (bulut.durum !== "cakisma" || !bekleyen) return;
  if (secim === "sunucu") sunucudakiniUygula(bekleyen);
  // sunucunun bu sürümü görülmüş sayılır: bu cihazdaki değişiklik onun üzerine yazılır
  else izYaz({ z: bekleyen.z, ozet: "" });
  bekleyen = null;
  bulut.durum = "bekliyor";
  void esitle();
}
export function bulutYenidenDene() { if (bulut.durum === "hata") { bulut.durum = "bekliyor"; planla(0); } }

/** Sunucu bağlantısını kurar (uygulama açılırken bir kez). Sunucu yoksa (claude.ai dışında, oturum kapalı) kapalı kalır. */
export async function bulutuBaslat() {
  if (typeof window === "undefined" || db) return;
  try { db = window.claude ? ((await window.claude.use("db")) as Db | null) : null; } catch { db = null; }
  if (!db) { bulut.durum = "kapali"; return; }
  await esitle();
  // başka cihaz yazınca: ana belgenin damgası değişir
  db.doc(ANA).onSnapshot(b => {
    if (!b.exists || b.metadata?.hasPendingWrites) return;
    if ((Number(b.data()?.z) || 0) !== bilinenZ) planla(0);
  }, () => { /* dinleme koparsa veri değişiminde ve açılışta yine eşitlenir */ });
  // bu cihazda veri değişince (art arda değişiklikler tek yazımda toplanır)
  $effect.root(() => { $effect(() => { veriAnlik(); planla(1500); }); });
}
