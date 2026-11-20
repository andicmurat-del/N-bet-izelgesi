// Sunucuda saklama: veriler claude.ai'nin bu sayfaya ayırdığı veritabanında da tutulur; aynı hesapla başka bir
// bilgisayardan ya da telefondan açılınca aynı veriler gelir. Tarayıcı kaydı (depo.svelte.ts) olduğu gibi kalır: sayfa
// önce oradan açılır, sunucuya ulaşılamazsa uygulama eskisi gibi çalışır.
//
// Kurallar (bulutBicim.ts > eslemeKarari): yalnız değişmemiş ya da hiç eşitlenmemiş boş taraf ötekinin verisini alır.
// İki tarafta da değişiklik varsa (ör. iki sorumlu aynı anda çalıştı) bölüm bölüm birleştirilir (ucluBirlestir): farklı
// bölümlerdeki (ör. farklı aylardaki) değişiklikler kendiliğinden birleşir; yalnız iki tarafta da değişen bölümler sorulur.
// Kimlik ve yetki claude.ai'den (kimlik.svelte.ts); değişiklik geçmişi ve günlük kopyalar da sunucuda tutulur
// (sunucuGecmis.svelte.ts, sunucuKopya.ts).
// Belgeler: "nobet/ana" (ortak bölüm + sürüm damgası z), "nobet/ana/aylar/<yil-ay>" (ayın kayıtları). Önce ay belgeleri,
// en son ana belge yazılır; öteki cihazlar ana belgenin damgası değişince yeniden okur.
import { depo, guvenliJson, kaynakBelirt, tumVeriyiDegistir, veriAnlik, veriyiDogrula, yerelVerileriSil } from "./depo.svelte";
import {
  BELGE_SINIRI,
  birlestir,
  bolumAdi,
  bolumOzetleri,
  bosMu,
  eslemeKarari,
  kararliJson,
  ozet,
  YONETIM_BOLUMLERI,
  parcala,
  parcalarAyni,
  ucluBirlestir,
  type Iz,
  type Parcalar,
} from "./bulutBicim";
import type { Veri } from "./tipler";
import { AYLAR as AY_ADLARI } from "./tarih";
import { kimlik, kimlikBaslat, yonetimYetkisi as yonetimYazabilir } from "./kimlik.svelte";
import { degisiklikDinle } from "./gunluk.svelte";
import { sunucuGecmisBaslat, sunucuyaKaydet } from "./sunucuGecmis.svelte";
import { gunlukSunucuKopyasi, sunucuKopyalari, sunucuKopyasiOku, type SunucuKopyasi } from "./sunucuKopya";

// claude.ai "db" yeteneğinin kullanılan kısmı
interface Belge {
  exists: boolean;
  data(): Record<string, unknown> | undefined;
  id: string;
  metadata?: { hasPendingWrites?: boolean };
}
interface BelgeRef {
  get(): Promise<Belge>;
  set(d: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
  onSnapshot(n: (b: Belge) => void, h?: (e: unknown) => void): () => void;
  /** kısa süreli kilit (platformda var; sahte ortamlarda olmayabilir) */
  acquire?(o: { holder: string; ttlMs?: number }): Promise<{ acquired: boolean; expiresAt?: string }>;
}
interface Sorgu {
  where(a: string, op: string, d: unknown): Sorgu;
  orderBy(a: string, yon?: "asc" | "desc"): Sorgu;
  limit(n: number): Sorgu;
  get(): Promise<{ docs: Belge[] }>;
}
interface Db {
  doc(yol: string): BelgeRef;
  collection(yol: string): Sorgu & { doc(id: string): BelgeRef };
}

const ANA = "nobet/ana",
  AYLAR = "nobet/ana/aylar",
  /** yazım kilidi: iki sorumlu aynı anda yazınca biri ötekinin değişikliğini ezmesin */
  KILIT = "nobet/kilit",
  /** personel, ayarlar, kurum, servis ayarları: veritabanı kuralıyla yalnız sahip ve Editor (baş sorumlu) yazar */
  YONETIM = "nobet/yonetim",
  IZ_ANAHTAR = "nobet-cizelgesi-v2-bulut";
const cihaz = Math.random().toString(36).slice(2, 10);

export type BulutDurumu =
  | /** sunucu yanıtı bekleniyor */ "bekliyor"
    /** bu görünümde sunucu yok: yalnız tarayıcı kaydı */
  | "kapali"
  | "esit"
  | "gonderiliyor"
  | "hata"
  /** iki tarafta da değişiklik var: kullanıcı seçecek */
  | "cakisma"
  /** bu claude.ai hesabının sunucudaki verilere erişim ya da yazma yetkisi yok */
  | "yetkisiz";
export const bulut = $state({
  durum: "bekliyor" as BulutDurumu,
  mesaj: "",
  sunucuZaman: 0,
  /** çakışmada iki tarafta da değişen bölümlerin adları (boşsa bütün veri) */
  catisan: [] as string[],
  /** erişimi kaldırıldığı için bu tarayıcıdaki kopya silindi */
  yerelSilindi: false,
  /** bilgi notu (ör. yetkisiz değişiklik geri alındı) */
  bilgi: "",
});

/** yönetim bölümleri son eşitlemeden beri bu cihazda değişti mi */
function yonetimYerelDegisti(v: Veri): boolean {
  const taban = izOku()?.bolum;
  if (!taban) return false;
  const o = bolumOzetleri(v);
  return YONETIM_BOLUMLERI.some(b => taban[b] !== undefined && o[b] !== taban[b]);
}
/** Bu claude.ai hesabının erişimi yok ya da kaldırıldı: eşitleme durur; sahip değilse bu tarayıcıdaki kopya da silinir
 *  (yetkisi kaldırılan sorumlu son eşitlenen verileri görmeye devam etmesin). */
function erisimYok() {
  clearTimeout(zamanlayici);
  db = null;
  degisiklikDinle(null);
  bulut.durum = "yetkisiz";
  bulut.mesaj = "";
  bulut.catisan = [];
  bekleyen = null;
  if (kimlik.var && kimlik.rol !== "sahip") {
    yerelVerileriSil();
    bulut.yerelSilindi = true;
  }
}
const kaldirildi = (e: unknown) => (e as { code?: string } | null)?.code === "revoked";

let db: Db | null = null;
/** sunucudaki son bilinen içerik ve sürüm damgası */
let bilinen: Parcalar | null = null,
  bilinenZ: number | null = null;
let mesgul = false,
  yeniden = false,
  bekleyen: { p: Parcalar; z: number; taban?: Record<string, string>; sv?: Veri } | null = null;
let zamanlayici: ReturnType<typeof setTimeout> | undefined;

function izOku(): Iz | null {
  try {
    const o = JSON.parse(localStorage.getItem(IZ_ANAHTAR) || "null");
    if (!o || !Number.isFinite(o.z) || typeof o.ozet !== "string") return null;
    const b = o.bolum && typeof o.bolum === "object" && !Array.isArray(o.bolum) ? (o.bolum as Record<string, string>) : undefined;
    return { z: o.z, ozet: o.ozet, ...(b ? { bolum: b } : {}) };
  } catch {
    return null;
  }
}
function izYaz(iz: Iz) {
  try {
    localStorage.setItem(IZ_ANAHTAR, JSON.stringify(iz));
  } catch {
    /* yer yoksa bir sonraki açılışta yeniden karşılaştırılır */
  }
}

const metinMi = (x: unknown): x is string => typeof x === "string";
async function sunucudanOku(d: Db, ana: Belge): Promise<{ p: Parcalar; z: number }> {
  const a = ana.data() ?? {};
  if (!metinMi(a.json)) throw new Error("Sunucudaki kayıt okunamadı.");
  const aylar: Record<string, string> = {};
  for (const b of (await d.collection(AYLAR).limit(1000).get()).docs) {
    const j = b.data()?.json;
    if (metinMi(j)) aylar[b.id] = j;
  }
  const y = await d.doc(YONETIM).get(),
    yj = y.exists ? y.data()?.json : undefined;
  return { p: { ana: a.json, aylar, ...(metinMi(yj) ? { yonetim: yj } : {}) }, z: Number(a.z) || 0 };
}
const bayt = (t: string) => new TextEncoder().encode(JSON.stringify(t)).length;
const bekle = (ms: number) => new Promise(r => setTimeout(r, ms));
/** Sunucuya yazar. Yazımdan önce kısa süreli kilit alınır ve sunucunun okunandan beri değişmediğine bakılır: başka bir
 *  sorumlu araya girdiyse yazılmaz (false), çağıran yeniden okuyup birleştirir. */
async function sunucuyaYaz(d: Db, p: Parcalar, v: Veri): Promise<boolean> {
  for (const [k, t] of [["ortak bölüm", p.ana], ...Object.entries(p.aylar)])
    if (bayt(t) > BELGE_SINIRI) throw new Error(`Sunucuya yazılamadı: ${k} kaydı çok büyük. Veriler bu tarayıcıda duruyor; yedek alın.`);
  const kilit = d.doc(KILIT);
  if (kilit.acquire) {
    const k = await kilit.acquire({ holder: cihaz, ttlMs: 8000 });
    if (!k.acquired) {
      const kalan = k.expiresAt ? Date.parse(k.expiresAt) - Date.now() : 2000;
      await bekle(Math.min(8000, Math.max(300, kalan)) + Math.random() * 500);
      return false;
    }
    const a = await d.doc(ANA).get();
    if ((a.exists ? Number(a.data()?.z) || 0 : null) !== bilinenZ) return false;
  }
  // günün ilk yazımından önce sunucudaki hâl günlük kopya olarak saklanır (kopya alınamazsa yazım yine yapılır)
  if (bilinen)
    try {
      await gunlukSunucuKopyasi(d, bilinen, kimlik.id);
    } catch (e) {
      console.warn("Sunucuya günlük kopya alınamadı", e);
    }
  // yönetim bölümleri: yalnız yetkisi olan yazar (öteki sorumluda sunucudaki olduğu gibi kalır)
  if (p.yonetim !== undefined && p.yonetim !== bilinen?.yonetim) {
    if (yonetimYazabilir()) await d.doc(YONETIM).set({ json: p.yonetim });
    else if (bilinen?.yonetim !== undefined) p = { ...p, yonetim: bilinen.yonetim };
    else throw new Error("Sunucu: yönetim bölümleri yazılamadı (yetki yok).");
  }
  const kol = d.collection(AYLAR);
  for (const [k, t] of Object.entries(p.aylar)) if (bilinen?.aylar[k] !== t) await kol.doc(k).set({ json: t });
  for (const k of Object.keys(bilinen?.aylar ?? {})) if (!(k in p.aylar)) await kol.doc(k).delete();
  const z = Math.max(Date.now(), (bilinenZ ?? 0) + 1);
  await d.doc(ANA).set({ z, cihaz, surum: 1, json: p.ana });
  bilinen = p;
  bilinenZ = z;
  izYaz({ z, ozet: ozet(p), bolum: bolumOzetleri(v) });
  return true;
}
function sunucudakiniUygula(s: { p: Parcalar; z: number }) {
  const v = veriyiDogrula(birlestir(s.p, guvenliJson));
  kaynakBelirt("esitleme");
  tumVeriyiDegistir(v);
  izYaz({ z: s.z, ozet: ozet(parcala(v)), bolum: bolumOzetleri(v) });
}
/** bölüm bölüm birleşmiş veriyi bu cihaza uygular, bu cihazdan gelen bölümler varsa sunucuya yazar */
async function birlesimiUygula(d: Db, s: { p: Parcalar; z: number }, sonuc: Record<string, unknown>, yerel: Veri): Promise<boolean> {
  const v = veriyiDogrula(sonuc);
  if (kararliJson(v) !== kararliJson(yerel)) {
    kaynakBelirt("esitleme");
    tumVeriyiDegistir(v);
  }
  const p = parcala(v);
  if (parcalarAyni(p, s.p)) izYaz({ z: s.z, ozet: ozet(p), bolum: bolumOzetleri(v) });
  else {
    bulut.durum = "gonderiliyor";
    return sunucuyaYaz(d, p, v);
  }
  return true;
}

async function esitle() {
  const d = db;
  if (!d || bulut.durum === "cakisma" || bulut.durum === "yetkisiz" || depo.baskaPencere) return;
  if (mesgul) {
    yeniden = true;
    return;
  }
  mesgul = true;
  try {
    do {
      yeniden = false;
      let yerelVeri = veriAnlik();
      const ana = await d.doc(ANA).get(),
        z = ana.exists ? Number(ana.data()?.z) || 0 : null;
      const sunucu = z === null ? null : z === bilinenZ && bilinen ? { p: bilinen, z } : await sunucudanOku(d, ana);
      bilinen = sunucu?.p ?? null;
      bilinenZ = sunucu?.z ?? null;
      // yönetim bölümlerini değiştirme yetkisi olmayan sorumluda bu cihazda değişmişlerse sunucudaki geri gelir
      if (sunucu && !yonetimYazabilir() && yonetimYerelDegisti(yerelVeri)) {
        const sv = veriyiDogrula(birlestir(sunucu.p, guvenliJson));
        const v = { ...yerelVeri } as Record<string, unknown>;
        for (const b of YONETIM_BOLUMLERI) v[b] = sv[b];
        kaynakBelirt("esitleme");
        tumVeriyiDegistir(veriyiDogrula(v));
        bulut.bilgi =
          "Personel, ayarlar, kurum ve servis ayarlarındaki değişiklik geri alındı: bunları yalnız sahip ve baş sorumlu (Editor) değiştirebilir.";
        yerelVeri = veriAnlik();
      }
      // yönetim belgesi henüz yoksa (eski biçim ya da boş sunucu) ve yazma yetkisi yoksa eski biçimle yazılır (personel ana
      // belgede kalır, silinmez); sahip / baş sorumlu ilk yazımında yeni biçime geçirir
      const yerel = parcala(yerelVeri, yonetimYazabilir() || !!sunucu?.p.yonetim);
      const yerelOzet = ozet(yerel);
      const karar = eslemeKarari({
        sunucuZ: bilinenZ,
        sunucuAyni: !!sunucu && parcalarAyni(sunucu.p, yerel),
        iz: izOku(),
        yerelOzet,
        yerelBos: bosMu(yerelVeri),
      });
      if (karar === "sor" && sunucu) {
        // son eşitlemenin bölüm özetleri biliniyorsa bölüm bölüm birleştirilir; yalnız iki tarafta da değişen bölümler sorulur
        const taban = izOku()?.bolum;
        const sv = taban ? veriyiDogrula(birlestir(sunucu.p, guvenliJson)) : undefined;
        const b = taban && sv ? ucluBirlestir(taban, yerelVeri, sv) : null;
        if (b && !b.catisan.length) {
          if (!(await birlesimiUygula(d, sunucu, b.sonuc, yerelVeri))) yeniden = true;
          continue;
        }
        bekleyen = { ...sunucu, ...(b ? { taban, sv } : {}) };
        bulut.catisan = b ? b.catisan.map(k => bolumAdi(k, AY_ADLARI)) : [];
        bulut.durum = "cakisma";
        return;
      }
      if (karar === "gonder") {
        bulut.durum = "gonderiliyor";
        if (!(await sunucuyaYaz(d, yerel, yerelVeri))) {
          // başka bir sorumlu araya girdi: yeniden okunup birleştirilir
          yeniden = true;
          continue;
        }
      } else if (karar === "al" && sunucu) sunucudakiniUygula(sunucu);
      else if (sunucu) izYaz({ z: sunucu.z, ozet: yerelOzet, bolum: bolumOzetleri(yerelVeri) });
      // hesap sürerken veri değiştiyse (ya da sunucudan alındıysa) bir kez daha bakılır
      if (veriAnlik() !== yerelVeri && karar !== "al") yeniden = true;
    } while (yeniden);
    bulut.durum = "esit";
    bulut.mesaj = "";
    bulut.sunucuZaman = bilinenZ ?? 0;
  } catch (e) {
    // erişim sayfa açıkken kaldırıldı
    if (kaldirildi(e)) {
      erisimYok();
      return;
    }
    // yetkisiz yazım (paylaşım düzeyi düşük): sunucu isteği reddeder
    if ((e as { code?: string })?.code === "invalid_argument" && kimlik.var && kimlik.rol !== "sahip") {
      bulut.durum = "yetkisiz";
      bulut.mesaj = "";
      return;
    }
    bulut.durum = "hata";
    bulut.mesaj =
      e instanceof Error && /^Sunucu/.test(e.message)
        ? e.message
        : "Sunucuya ulaşılamadı; veriler bu tarayıcıda duruyor. Bağlantı gelince yeniden denenir.";
    planla(30000);
  } finally {
    mesgul = false;
  }
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
  if (bekleyen.taban && bekleyen.sv) {
    // yalnız çatışan bölümlerde seçilen taraf alınır; öteki bölümler birleşir. Sunucunun bu sürümü görülmüş sayılır:
    // birleşen veri (sunucudakinden farklıysa) bir sonraki eşitlemede yazılır
    const yerel = veriAnlik();
    const b = ucluBirlestir(bekleyen.taban, yerel, bekleyen.sv, secim === "cihaz" ? "yerel" : "sunucu");
    const v = veriyiDogrula(b.sonuc);
    if (kararliJson(v) !== kararliJson(yerel)) {
      kaynakBelirt("esitleme");
      tumVeriyiDegistir(v);
    }
    izYaz({ z: bekleyen.z, ozet: "", bolum: bolumOzetleri(bekleyen.sv) });
  } else if (secim === "sunucu") sunucudakiniUygula(bekleyen);
  // sunucunun bu sürümü görülmüş sayılır: bu cihazdaki değişiklik onun üzerine yazılır
  else izYaz({ z: bekleyen.z, ozet: "" });
  bekleyen = null;
  bulut.catisan = [];
  bulut.durum = "bekliyor";
  void esitle();
}
export function bulutYenidenDene() {
  if (bulut.durum === "hata") {
    bulut.durum = "bekliyor";
    planla(0);
  }
}

/** Sunucu bağlantısını kurar (uygulama açılırken bir kez). Sunucu yoksa (claude.ai dışında, oturum kapalı) kapalı kalır. */
export async function bulutuBaslat() {
  if (typeof window === "undefined" || db) return;
  try {
    db = window.claude ? ((await window.claude.use("db")) as Db | null) : null;
  } catch {
    db = null;
  }
  if (!db) {
    bulut.durum = "kapali";
    return;
  }
  // kim kullanıyor, yetkisi ne (claude.ai): yalnız görüntüleyen verilere erişemez
  await kimlikBaslat();
  if (kimlik.rol === "okuyan") {
    erisimYok();
    return;
  }
  if (kimlik.id) {
    sunucuGecmisBaslat(db, kimlik.id);
    degisiklikDinle(sunucuyaKaydet);
  }
  await esitle();
  // başka cihaz yazınca: ana belgenin damgası değişir
  db.doc(ANA).onSnapshot(
    b => {
      if (!b.exists || b.metadata?.hasPendingWrites) return;
      if ((Number(b.data()?.z) || 0) !== bilinenZ) planla(0);
    },
    e => {
      // erişim kaldırıldıysa; öteki kopmalarda veri değişiminde ve açılışta yine eşitlenir
      if (kaldirildi(e)) erisimYok();
    },
  );
  // bu cihazda veri değişince (art arda değişiklikler tek yazımda toplanır)
  $effect.root(() => {
    $effect(() => {
      veriAnlik();
      planla(1500);
    });
  });
}

/** sunucudaki günlük kopyalar (sunucu yoksa boş) */
export async function sunucuKopyaListesi(): Promise<SunucuKopyasi[]> {
  return db ? sunucuKopyalari(db) : [];
}
/** sunucudaki bir günlük kopyaya döner (dönüş de bir değişikliktir: sunucuya yazılır, geçmişe girer) */
export async function sunucuKopyasinaDon(gun: string): Promise<boolean> {
  if (!db) return false;
  const p = await sunucuKopyasiOku(db, gun);
  if (!p) return false;
  kaynakBelirt("yukleme");
  tumVeriyiDegistir(veriyiDogrula(birlestir(p, guvenliJson)));
  return true;
}
