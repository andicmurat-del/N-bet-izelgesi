// Ortak klasörde kayıtlar: claude.ai veritabanının kullandığımız kısmıyla aynı arayüz (doc / collection / get / set /
// delete / onSnapshot / acquire). Böylece eşitleme, birleştirme, değişiklik geçmişi ve günlük kopyalar (bulut.svelte.ts,
// sunucuGecmis.svelte.ts, sunucuKopya.ts) olduğu gibi çalışır.
//
// Her kayıt ayrı dosyadır: "nobet/ana/aylar/2026-11" → veri/nobet/ana/aylar/2026-11.nbk. Dosya veri anahtarıyla
// şifrelidir (AES-GCM; dosyanın yolu da doğrulanır: başka yere kopyalanan dosya açılmaz). İçinde yazanın kimliği,
// zaman ve yazanın imzası vardır. Okurken imza ve yazanın yetkisi denetlenir (sunucudaki veritabanı kurallarının yerine):
// - nobet/yonetim (personel, ayarlar, kurum, servis ayarları): yalnız sahip ve baş sorumlu
// - gecmis/<kişi>/…: yalnız o kişi (kişi sonradan kaldırılsa da kayıtları geçerli kalır)
// - öteki kayıtlar: etkin kullanıcılar
// Geçmeyen kayıt kullanılmaz; eşitleme durur ve neden gösterilir.
import { kararliJson } from "../bulutBicim";
import type { Klasor, KlasorOgesi } from "./dosya";
import { yoneticiRolu, type KasaImzali, type KasaKisi, type Oturum } from "./kasa";
import { ac, baytMetin, dogrula, kapat } from "./sifre";

const KOK = "veri",
  UZANTI = ".nbk";
export const belgeDosyasi = (yol: string) => `${KOK}/${yol}${UZANTI}`;
const belgeEki = (yol: string) => "belge|" + yol;

interface Zarf {
  b: 1;
  a: string;
  iv: string;
  v: string;
}
export interface Ic {
  y: string;
  k: string;
  z: number;
  d: Record<string, unknown>;
  i: string;
}
/** platformdaki gibi hata: code (revoked, invalid_argument, imza…) ve kullanıcıya gösterilecek mesaj */
export class BelgeHatasi extends Error {
  constructor(
    public code: string,
    public mesaj: string,
  ) {
    super(mesaj);
  }
}

const YOL_ADI: [RegExp, string][] = [
  [/^nobet\/yonetim$/, "Personel ve ayarlar"],
  [/^nobet\/ana$/, "Ortak bölüm"],
  [/^nobet\/ana\/aylar\/(\d+)-(\d+)$/, "$1-$2 ayı"],
  [/^gecmis\//, "Değişiklik geçmişi"],
  [/^kopyalar\//, "Günlük kopya"],
];
const yolAdi = (y: string) => {
  for (const [r, a] of YOL_ADI) if (r.test(y)) return y.replace(r, a);
  return y;
};

/** yazma kuralı (yazan kişi için) */
export function yazabilir(yol: string, kisi: KasaKisi): boolean {
  if (kisi.durum !== "aktif") return false;
  const s = yol.split("/");
  if (s[0] === "gecmis") return s[1] === kisi.id;
  if (yol === "nobet/yonetim") return yoneticiRolu(kisi.rol);
  return s[0] === "nobet" || s[0] === "kopyalar" || s[0] === "oda";
}
const imzaMetni = (ic: Omit<Ic, "i">) => kararliJson({ y: ic.y, k: ic.k, z: ic.z, d: ic.d });

/** imza kişinin hangi anahtarıyla tutuyor */
async function imzaAnahtari(o: Oturum, kisi: KasaKisi, ic: Ic): Promise<"guncel" | "eski" | null> {
  const m = imzaMetni(ic);
  if (await dogrula(await o.dogrulayici(kisi.acik.ecdsa), m, ic.i)) return "guncel";
  for (const j of kisi.eskiImza ?? []) if (await dogrula(await o.dogrulayici(j), m, ic.i)) return "eski";
  return null;
}
/** okuma kuralı: imza tutuyor ve yazanın şu an bu kaydı yazma yetkisi var (geçmiş kayıtlarında: kaydın sahibi) */
export async function gecerliMi(o: Oturum, kasa: KasaImzali, ic: Ic): Promise<boolean> {
  const kisi = kasa.kisiler.find(k => k.id === ic.k);
  if (!kisi) return false;
  const a = await imzaAnahtari(o, kisi, ic);
  if (!a) return false;
  const s = ic.y.split("/");
  if (s[0] === "gecmis") return s[1] === kisi.id;
  return a === "guncel" && yazabilir(ic.y, kisi);
}
/** imza doğru ama kural artık geçmiyor: yazan kaldırıldı, şifresi yenilendi ya da yöneticilikten çıktı. Kayıt o zaman
 *  geçerliydi: sahip kendi imzasıyla yeniler. */
async function bayatMi(o: Oturum, kasa: KasaImzali, ic: Ic, eskiYoneticiler: ReadonlySet<string>): Promise<boolean> {
  if (ic.y.startsWith("gecmis/") || ic.y.startsWith("oda/")) return false;
  const kisi = kasa.kisiler.find(k => k.id === ic.k);
  if (!kisi || !(await imzaAnahtari(o, kisi, ic)) || (await gecerliMi(o, kasa, ic))) return false;
  if (ic.y === "nobet/yonetim") return yoneticiRolu(kisi.rol) || eskiYoneticiler.has(kisi.id);
  return true;
}
async function imzaliIc(o: Oturum, yol: string, d: Record<string, unknown>): Promise<Ic> {
  const ic = { y: yol, k: o.id, z: Date.now(), d: JSON.parse(JSON.stringify(d)) as Record<string, unknown> };
  return { ...ic, i: await o.imzala(imzaMetni(ic)) };
}
async function sifrele(o: Oturum, ic: Ic): Promise<string> {
  const { nesil, k } = o.guncel();
  const z: Zarf = { b: 1, a: nesil, ...(await kapat(k, JSON.stringify(ic), belgeEki(ic.y))) };
  return JSON.stringify(z);
}
/** dosyayı açar (imzayı denetlemeden); anahtar yoksa null */
async function ac_(o: Oturum, yol: string, metin: string): Promise<{ zarf: Zarf; ic: Ic } | null> {
  let zarf: Zarf;
  try {
    zarf = JSON.parse(metin);
  } catch {
    throw new BelgeHatasi("bozuk", `${yolAdi(yol)} kaydı bozuk (dosya okunamadı).`);
  }
  if (zarf?.b !== 1 || typeof zarf.a !== "string") throw new BelgeHatasi("bozuk", `${yolAdi(yol)} kaydı bozuk.`);
  let k = o.anahtar(zarf.a);
  if (!k) {
    await o.tazeleZorla();
    k = o.anahtar(zarf.a);
  }
  if (!k) return null;
  let ic: Ic;
  try {
    ic = JSON.parse(baytMetin(await ac(k, zarf, belgeEki(yol))));
  } catch {
    throw new BelgeHatasi("bozuk", `${yolAdi(yol)} kaydı açılamadı: bozuk ya da değiştirilmiş.`);
  }
  if (ic?.y !== yol || typeof ic.k !== "string" || typeof ic.i !== "string" || !ic.d || typeof ic.d !== "object")
    throw new BelgeHatasi("bozuk", `${yolAdi(yol)} kaydı bozuk ya da yeri değiştirilmiş.`);
  return { zarf, ic };
}

// claude.ai db yeteneğinin kullanılan kısmı (bulut.svelte.ts ile aynı)
interface Anlik {
  id: string;
  exists: boolean;
  data(): Record<string, unknown> | undefined;
  metadata: { hasPendingWrites: boolean; fromCache: boolean };
}
const anlik = (yol: string, d: Record<string, unknown> | null): Anlik => ({
  id: yol.split("/").pop()!,
  exists: d !== null,
  data: () => (d === null ? undefined : JSON.parse(JSON.stringify(d))),
  metadata: { hasPendingWrites: false, fromCache: false },
});

export interface KlasorDbAyari {
  /** dinlenen kayıtlara kaç ms'de bir bakılır */
  yoklama?: number;
}
export type KlasorDb = ReturnType<typeof klasorDb>;

export function klasorDb(o: Oturum, ayar: KlasorDbAyari = {}) {
  const k: Klasor = o.klasor;
  const yoklama = ayar.yoklama ?? 3000;
  const onbellek = new Map<string, { iz: string; ic: Ic }>();
  const zamanlayicilar = new Set<ReturnType<typeof setTimeout>>();
  let kapali = false;

  async function hazirla() {
    if (kapali) throw new BelgeHatasi("revoked", "Oturum kapandı.");
    await o.tazele();
    if (o.iptal) throw new BelgeHatasi("revoked", o.iptal.mesaj);
  }
  /** kaydı okur ve denetler (yoksa null). b: dosya bilgisi elde varsa */
  async function oku(yol: string, b?: { z: number; boyut: number } | null): Promise<Ic | null> {
    const dosya = belgeDosyasi(yol);
    if (b === undefined) b = await k.bilgi(dosya);
    if (!b) {
      onbellek.delete(dosya);
      return null;
    }
    const iz = `${b.z}|${b.boyut}|${o.kasa.imzali.degisme}`;
    const ob = onbellek.get(dosya);
    if (ob && ob.iz === iz) return ob.ic;
    const metin = await k.oku(dosya);
    if (metin === null) return null;
    const a = await ac_(o, yol, metin);
    if (!a) throw new BelgeHatasi("anahtar", `${yolAdi(yol)} kaydı bu hesabın açamadığı bir anahtarla şifreli.`);
    if (!(await gecerliMi(o, o.kasa.imzali, a.ic)))
      throw new BelgeHatasi(
        "imza",
        `${yolAdi(yol)} kaydının imzası geçersiz ya da yazanın buna yetkisi yok; kullanılmadı. Sahip, Ayarlar > Geçmiş'teki günlük kopyalardan ya da yedek klasöründen önceki hâle dönebilir.`,
      );
    onbellek.set(dosya, { iz, ic: a.ic });
    return a.ic;
  }
  async function yaz(yol: string, d: Record<string, unknown>) {
    await hazirla();
    if (!yazabilir(yol, o.ben)) throw new BelgeHatasi("invalid_argument", "Bu kaydı yazma yetkiniz yok.");
    const ic = await imzaliIc(o, yol, d);
    await k.yaz(belgeDosyasi(yol), await sifrele(o, ic));
    onbellek.delete(belgeDosyasi(yol));
  }
  async function sil(yol: string) {
    await hazirla();
    if (!yazabilir(yol, o.ben)) throw new BelgeHatasi("invalid_argument", "Bu kaydı silme yetkiniz yok.");
    await k.sil(belgeDosyasi(yol));
    onbellek.delete(belgeDosyasi(yol));
  }
  /** koleksiyondaki kayıtlar. katı değilse (geçmiş, kopyalar, oda) denetimden geçmeyenler atlanır */
  async function liste(yol: string): Promise<{ id: string; ic: Ic }[]> {
    await hazirla();
    const kati = yol.startsWith("nobet/");
    const l: { id: string; ic: Ic }[] = [];
    for (const x of await k.listele(`${KOK}/${yol}`)) {
      if (x.klasor || !x.ad.endsWith(UZANTI)) continue;
      const id = x.ad.slice(0, -UZANTI.length);
      try {
        const ic = await oku(`${yol}/${id}`, x);
        if (ic) l.push({ id, ic });
      } catch (e) {
        if (kati) throw e;
        console.warn("Kayıt atlandı:", yol + "/" + id, (e as Error).message);
      }
    }
    return l;
  }

  type Filtre = [string, unknown][];
  const sorgu = (yol: string, filtre: Filtre = [], sira: [string, "asc" | "desc"] | null = null, sinir = 1000) => ({
    where: (a: string, op: string, v: unknown) => {
      if (op !== "==") throw new Error("klasör: yalnız ==");
      return sorgu(yol, [...filtre, [a, v]], sira, sinir);
    },
    orderBy: (a: string, yon: "asc" | "desc" = "asc") => sorgu(yol, filtre, [a, yon], sinir),
    limit: (n: number) => sorgu(yol, filtre, sira, n),
    get: async () => {
      let l = (await liste(yol)).filter(({ ic }) => filtre.every(([a, v]) => ic.d[a] === v));
      if (sira) {
        const [a, yon] = sira;
        l.sort((p, q) => {
          const x = p.ic.d[a] as number | string,
            y = q.ic.d[a] as number | string;
          return (x < y ? -1 : x > y ? 1 : 0) * (yon === "desc" ? -1 : 1);
        });
      } else l.sort((p, q) => (p.id < q.id ? -1 : 1));
      l = l.slice(0, sinir);
      const docs = l.map(({ id, ic }) => anlik(`${yol}/${id}`, ic.d));
      return { docs, size: docs.length, empty: !docs.length };
    },
  });

  const doc = (yol: string) => ({
    id: yol.split("/").pop()!,
    path: yol,
    get: async () => {
      await hazirla();
      return anlik(yol, (await oku(yol))?.d ?? null);
    },
    set: (d: Record<string, unknown>) => yaz(yol, d),
    delete: () => sil(yol),
    /** dosyaya yoklama ile bakılır; değişince bildirilir. Kayıt denetimden geçmezse bir kez "değişti" bildirilir
     *  (eşitleme okurken hatayı gösterir). */
    onSnapshot(next: (b: Anlik) => void, hata?: (e: unknown) => void): () => void {
      let son: string | null = null,
        durdu = false,
        zaman: ReturnType<typeof setTimeout> | undefined;
      const bak = async () => {
        if (durdu) return;
        try {
          await hazirla();
          const b = await k.bilgi(belgeDosyasi(yol));
          const iz = b ? `${b.z}|${b.boyut}` : "yok";
          if (iz !== son) {
            son = iz;
            try {
              next(anlik(yol, b ? ((await oku(yol, b))?.d ?? null) : null));
            } catch {
              next(anlik(yol, { z: -1 }));
            }
          }
        } catch (e) {
          if ((e as BelgeHatasi)?.code === "revoked") {
            durdu = true;
            hata?.(e);
            return;
          }
          /* klasöre o an ulaşılamadı: sonra yeniden bakılır */
        }
        if (zaman !== undefined) zamanlayicilar.delete(zaman);
        zaman = setTimeout(bak, yoklama);
        zamanlayicilar.add(zaman);
      };
      zaman = setTimeout(bak, 0);
      zamanlayicilar.add(zaman);
      return () => {
        durdu = true;
        if (zaman !== undefined) {
          clearTimeout(zaman);
          zamanlayicilar.delete(zaman);
        }
      };
    },
    /** kısa süreli kilit (kilit dosyası, şifresiz: yalnız tutan cihazın rastgele numarası ve bitiş zamanı) */
    async acquire({ holder, ttlMs = 8000 }: { holder: string; ttlMs?: number }) {
      await hazirla();
      const r = await kisaKilit(k, `${KOK}/${yol}.lock`, holder, ttlMs);
      return { acquired: r.alindi, expiresAt: new Date(r.bitis).toISOString() };
    },
    collection: (alt: string) => koleksiyon(yol + "/" + alt),
  });
  const koleksiyon = (yol: string) => ({ ...sorgu(yol), path: yol, doc: (id: string) => doc(yol + "/" + id) });

  return {
    doc,
    collection: koleksiyon,
    /** koleksiyondaki kayıtlar, yazanlarıyla (oda için) */
    liste,
    /** yoklamaları durdurur (oturum kapanırken) */
    kapat() {
      kapali = true;
      for (const z of zamanlayicilar) clearTimeout(z);
      zamanlayicilar.clear();
    },
  };
}

/** Kısa süreli kilit: dosya yoksa ya da süresi dolmuşsa ya da aynı tutanınsa alınır. Tarayıcıda "yoksa oluştur" tek
 *  adımda yapılamadığından çok kısa bir yarış aralığı kalır; eşitleme yazmadan önce sürümü yeniden denetler. */
export async function kisaKilit(k: Klasor, dosya: string, tutan: string, ttl: number): Promise<{ alindi: boolean; bitis: number }> {
  const simdi = Date.now(),
    bitis = simdi + ttl;
  const icerik = JSON.stringify({ h: tutan, b: bitis });
  if (await k.olustur(dosya, icerik)) return { alindi: true, bitis };
  const oku = async () => {
    try {
      return JSON.parse((await k.oku(dosya)) || "null") as { h?: string; b?: number } | null;
    } catch {
      return null;
    }
  };
  const m = await oku();
  if (!m || !(Number(m.b) > simdi) || m.h === tutan) {
    await k.sil(dosya);
    if (await k.olustur(dosya, icerik)) return { alindi: true, bitis };
    return { alindi: false, bitis: Number((await oku())?.b) || simdi + 1000 };
  }
  return { alindi: false, bitis: Number(m.b) };
}

const bekle = (ms: number) => new Promise(r => setTimeout(r, ms));

// ---------- bakım (sahip) ----------
/** klasördeki bütün kayıt dosyaları (yol: "nobet/ana" gibi) */
async function tumKayitlar(k: Klasor, alt = ""): Promise<{ yol: string; b: KlasorOgesi }[]> {
  const l: { yol: string; b: KlasorOgesi }[] = [];
  for (const x of await k.listele(alt ? `${KOK}/${alt}` : KOK)) {
    const y = alt ? `${alt}/${x.ad}` : x.ad;
    if (x.klasor) {
      if (y !== "oda") l.push(...(await tumKayitlar(k, y)));
    } else if (x.ad.endsWith(UZANTI)) l.push({ yol: y.slice(0, -UZANTI.length), b: x });
  }
  return l;
}

/** Kasa değişikliğinden sonra kayıtları düzeltir (yalnız sahip): eski nesille şifreli kayıtlar güncel anahtarla yeniden
 *  şifrelenir; kaldırılan / şifresi yenilenen / yöneticilikten çıkan kişinin yazdığı (o zaman geçerli olan) kayıtlar
 *  sahibin imzasıyla yenilenir (değişiklik geçmişinde yazanın kendi imzası kalır). Hepsi bitince eski nesiller atılır.
 *  İmzası hiç tutmayan kayıtlara dokunulmaz. Bu sırada başkasının yazdığı dosya atlanır (sonra yeniden denenir). */
export async function belgeleriYenile(
  o: Oturum,
  ayar: { eskiYoneticiler?: string[]; ilerleme?: (bitti: number, toplam: number) => void; bekleme?: number } = {},
): Promise<{ yenilenen: number; kalan: number }> {
  if (!o.sahipMi) return { yenilenen: 0, kalan: 0 };
  await o.tazeleZorla();
  const eskiY = new Set(ayar.eskiYoneticiler ?? []);
  const k = o.klasor;
  const kayitlar = await tumKayitlar(k);
  let yenilenen = 0,
    kalan = 0,
    i = 0;
  const tutan = "bakim-" + o.id;
  for (const { yol, b } of kayitlar) {
    ayar.ilerleme?.(i++, kayitlar.length);
    const dosya = belgeDosyasi(yol);
    const metin = await k.oku(dosya);
    if (metin === null) continue;
    let a: Awaited<ReturnType<typeof ac_>>;
    try {
      a = await ac_(o, yol, metin);
    } catch {
      continue; // bozuk: dokunulmaz
    }
    if (!a) {
      kalan++;
      continue;
    }
    const guncel = o.kasa.imzali.guncel;
    const bayat = await bayatMi(o, o.kasa.imzali, a.ic, eskiY);
    if (!bayat && (a.zarf.a === guncel || !(await gecerliMi(o, o.kasa.imzali, a.ic)))) continue;
    const ic = bayat ? await imzaliIc(o, yol, a.ic.d) : a.ic;
    // eşitlemeyle yarışmasın: ortak kayıtlarda eşitleme kilidi alınır, dosya okunduğundan beri değişmediyse yazılır
    const kilit = yol.startsWith("nobet/") ? `${KOK}/nobet/kilit.lock` : null;
    if (kilit && !(await kisaKilit(k, kilit, tutan, 8000)).alindi) {
      kalan++;
      continue;
    }
    try {
      const simdi = await k.bilgi(dosya);
      if (!simdi || simdi.z !== b.z || simdi.boyut !== b.boyut) {
        kalan++;
        continue;
      }
      await k.yaz(dosya, await sifrele(o, ic));
      yenilenen++;
    } finally {
      if (kilit) await k.sil(kilit);
    }
  }
  ayar.ilerleme?.(kayitlar.length, kayitlar.length);
  // Öteki bilgisayarlar kasanın değiştiğini birkaç saniye içinde görür; o arada eski anahtarla yazmış olabilirler. Eski
  // nesiller, hiçbir dosya onlarla şifreli kalmadığı görülünce atılır (yoksa o dosyalar açılamaz olurdu).
  if (!kalan)
    for (let tur = 0; ; tur++) {
      await bekle(ayar.bekleme ?? 3000);
      const guncel = o.kasa.imzali.guncel;
      let eski = 0;
      for (const { yol } of await tumKayitlar(k)) {
        const metin = await k.oku(belgeDosyasi(yol));
        let a: string | undefined;
        try {
          a = metin ? (JSON.parse(metin) as Zarf).a : undefined;
        } catch {
          continue;
        }
        if (!a || a === guncel) continue;
        eski++;
        // eski anahtarla yeni yazılmış: geçerliyse yeniden şifrelenir
        const ac2 = await ac_(o, yol, metin!).catch(() => null);
        if (ac2 && (await gecerliMi(o, o.kasa.imzali, ac2.ic))) {
          await k.yaz(belgeDosyasi(yol), await sifrele(o, ac2.ic));
          yenilenen++;
        }
      }
      if (!eski) {
        await o.bakimBitti(Object.keys(o.kasa.imzali.anahtarlar));
        break;
      }
      if (tur >= 3) {
        kalan += eski;
        break;
      }
    }
  return { yenilenen, kalan };
}
