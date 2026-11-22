// Ortak klasöre erişim: masaüstü uygulamasında (Tauri) uygulamanın kendi komutlarıyla, tarayıcıda (Edge / Chrome)
// File System Access ile, testlerde bellekte. Yollar "/" ile ayrılır; parçalar yalnız harf, rakam, "-", "_", "."
// içerir (masaüstü uygulaması da aynısını denetler: klasörün dışına çıkılamaz).

export interface DosyaBilgisi {
  /** son değişme zamanı (ms) */
  z: number;
  boyut: number;
}
export interface KlasorOgesi extends DosyaBilgisi {
  ad: string;
  klasor: boolean;
}
export interface Klasor {
  /** kullanıcıya gösterilecek ad (yol ya da klasör adı) */
  ad: string;
  oku(yol: string): Promise<string | null>;
  /** dosyayı bütünüyle yazar (yarım dosya kalmaz: önce geçici dosyaya yazılıp yerine konur) */
  yaz(yol: string, metin: string): Promise<void>;
  /** dosya yoksa oluşturur (true); varsa dokunmaz (false). Kilit dosyaları için. */
  olustur(yol: string, metin: string): Promise<boolean>;
  sil(yol: string): Promise<void>;
  /** alt klasörü içindekilerle birlikte siler (eski yedekler için) */
  silKlasor(yol: string): Promise<void>;
  bilgi(yol: string): Promise<DosyaBilgisi | null>;
  /** klasördeki öğeler (klasör yoksa boş) */
  listele(yol: string): Promise<KlasorOgesi[]>;
}

const PARCA = /^[A-Za-z0-9._-]+$/;
export function yolParcalari(yol: string): string[] {
  if (!yol) return [];
  const p = yol.split("/");
  for (const s of p) if (!PARCA.test(s) || s === "." || s === "..") throw new Error("Geçersiz dosya yolu: " + yol);
  return p;
}

// ---------- bellek (testler) ----------
export function bellekKlasoru(ad = "bellek"): Klasor & { dosyalar: Map<string, { metin: string; z: number }> } {
  const dosyalar = new Map<string, { metin: string; z: number }>();
  let saat = 0;
  const zaman = () => (saat = Math.max(Date.now(), saat + 1));
  return {
    ad,
    dosyalar,
    oku: async y => (yolParcalari(y), dosyalar.get(y)?.metin ?? null),
    yaz: async (y, m) => {
      yolParcalari(y);
      dosyalar.set(y, { metin: m, z: zaman() });
    },
    olustur: async (y, m) => {
      yolParcalari(y);
      if (dosyalar.has(y)) return false;
      dosyalar.set(y, { metin: m, z: zaman() });
      return true;
    },
    sil: async y => void dosyalar.delete(y),
    silKlasor: async y => {
      yolParcalari(y);
      for (const k of [...dosyalar.keys()]) if (k.startsWith(y + "/")) dosyalar.delete(k);
    },
    bilgi: async y => {
      const d = dosyalar.get(y);
      return d ? { z: d.z, boyut: d.metin.length } : null;
    },
    listele: async y => {
      const on = y ? y + "/" : "";
      const l = new Map<string, KlasorOgesi>();
      for (const [k, d] of dosyalar) {
        if (!k.startsWith(on)) continue;
        const kalan = k.slice(on.length).split("/");
        if (kalan.length === 1) l.set(kalan[0], { ad: kalan[0], klasor: false, z: d.z, boyut: d.metin.length });
        else if (!l.has(kalan[0])) l.set(kalan[0], { ad: kalan[0], klasor: true, z: 0, boyut: 0 });
      }
      return [...l.values()];
    },
  };
}

// ---------- tarayıcı: File System Access (Edge / Chrome) ----------
type Dizin = FileSystemDirectoryHandle & {
  values(): AsyncIterable<FileSystemDirectoryHandle | FileSystemFileHandle>;
  queryPermission?(o: { mode: "readwrite" }): Promise<PermissionState>;
  requestPermission?(o: { mode: "readwrite" }): Promise<PermissionState>;
};
const bulunamadi = (e: unknown) =>
  (e as { name?: string })?.name === "NotFoundError" || (e as { name?: string })?.name === "TypeMismatchError";

export function tarayiciKlasoru(kok: FileSystemDirectoryHandle): Klasor {
  async function dizin(p: string[], olustur: boolean): Promise<Dizin | null> {
    let d = kok as Dizin;
    for (const s of p) {
      try {
        d = (await d.getDirectoryHandle(s, { create: olustur })) as Dizin;
      } catch (e) {
        if (bulunamadi(e)) return null;
        throw e;
      }
    }
    return d;
  }
  async function dosya(yol: string, olustur: boolean): Promise<FileSystemFileHandle | null> {
    const p = yolParcalari(yol);
    const d = await dizin(p.slice(0, -1), olustur);
    if (!d) return null;
    try {
      return await d.getFileHandle(p[p.length - 1], { create: olustur });
    } catch (e) {
      if (bulunamadi(e)) return null;
      throw e;
    }
  }
  async function yaz(yol: string, metin: string) {
    const f = (await dosya(yol, true))!;
    // yazılan geçici dosyaya gider, kapatınca yerine konur (yarım dosya kalmaz)
    const w = await f.createWritable();
    await w.write(metin);
    await w.close();
  }
  return {
    ad: kok.name,
    async oku(yol) {
      const f = await dosya(yol, false);
      if (!f) return null;
      try {
        return await (await f.getFile()).text();
      } catch (e) {
        if (bulunamadi(e)) return null;
        throw e;
      }
    },
    yaz,
    async olustur(yol, metin) {
      // tarayıcıda "yoksa oluştur" tek adımda yapılamaz; kısa bir yarış aralığı kalır (kilidi alan yazımdan önce
      // sunucudaki sürümü yeniden denetler, bu yüzden üst üste yazma olmaz)
      if (await dosya(yol, false)) return false;
      await yaz(yol, metin);
      return true;
    },
    async sil(yol) {
      const p = yolParcalari(yol);
      const d = await dizin(p.slice(0, -1), false);
      if (!d) return;
      try {
        await d.removeEntry(p[p.length - 1]);
      } catch (e) {
        if (!bulunamadi(e)) throw e;
      }
    },
    async silKlasor(yol) {
      const p = yolParcalari(yol);
      if (!p.length) throw new Error("Kök klasör silinemez.");
      const d = await dizin(p.slice(0, -1), false);
      if (!d) return;
      try {
        await d.removeEntry(p[p.length - 1], { recursive: true });
      } catch (e) {
        if (!bulunamadi(e)) throw e;
      }
    },
    async bilgi(yol) {
      const f = await dosya(yol, false);
      if (!f) return null;
      try {
        const x = await f.getFile();
        return { z: x.lastModified, boyut: x.size };
      } catch (e) {
        if (bulunamadi(e)) return null;
        throw e;
      }
    },
    async listele(yol) {
      const d = await dizin(yolParcalari(yol), false);
      if (!d) return [];
      const l: KlasorOgesi[] = [];
      for await (const h of d.values()) {
        if (h.kind === "directory") l.push({ ad: h.name, klasor: true, z: 0, boyut: 0 });
        else
          try {
            const x = await (h as FileSystemFileHandle).getFile();
            l.push({ ad: h.name, klasor: false, z: x.lastModified, boyut: x.size });
          } catch {
            /* bu arada silindi */
          }
      }
      return l;
    },
  };
}
/** tarayıcı klasöre yazma iznini hatırlamaz: her açılışta (kullanıcı bir düğmeye basınca) yeniden sorulur */
export async function tarayiciIzni(kok: FileSystemDirectoryHandle, iste: boolean): Promise<boolean> {
  const d = kok as Dizin;
  if (!d.queryPermission) return true;
  if ((await d.queryPermission({ mode: "readwrite" })) === "granted") return true;
  return iste && !!d.requestPermission && (await d.requestPermission({ mode: "readwrite" })) === "granted";
}

// ---------- masaüstü uygulaması (Tauri) ----------
interface TauriGenel {
  core: { invoke<T>(komut: string, arg?: Record<string, unknown>): Promise<T> };
  event: { listen(ad: string, f: () => void): Promise<() => void> };
}
declare global {
  interface Window {
    __TAURI__?: TauriGenel;
  }
}
export const masaustuMu = () => typeof window !== "undefined" && !!window.__TAURI__?.core;
export const tauri = () => window.__TAURI__!;
const komut = <T>(k: string, a?: Record<string, unknown>) => tauri().core.invoke<T>(k, a);
/** masaüstü hata iletisi (Rust tarafı Türkçe metin döner) */
const sar = async <T>(p: Promise<T>): Promise<T> => {
  try {
    return await p;
  } catch (e) {
    throw new Error(typeof e === "string" ? e : (e as Error)?.message || String(e));
  }
};

export function masaustuKlasoru(kok: string): Klasor {
  const y = (yol: string) => (yolParcalari(yol), yol);
  return {
    ad: kok,
    oku: yol => sar(komut<string | null>("dosya_oku", { kok, yol: y(yol) })),
    yaz: (yol, icerik) => sar(komut<void>("dosya_yaz", { kok, yol: y(yol), icerik })),
    olustur: (yol, icerik) => sar(komut<boolean>("dosya_olustur", { kok, yol: y(yol), icerik })),
    sil: yol => sar(komut<void>("dosya_sil", { kok, yol: y(yol) })),
    silKlasor: yol => sar(komut<void>("klasor_sil", { kok, yol: y(yol) })),
    bilgi: yol => sar(komut<DosyaBilgisi | null>("dosya_bilgi", { kok, yol: y(yol) })),
    listele: yol => sar(komut<KlasorOgesi[]>("klasor_listele", { kok, yol: yol ? y(yol) : "" })),
  };
}
/** masaüstünde klasör yolunu kullanıma açar (yol yoksa false) */
export const masaustuKokEkle = (kok: string) => sar(komut<boolean>("kok_ekle", { kok }));
/** masaüstünde klasör seçme penceresi */
export const masaustuKlasorSec = (baslik: string) => sar(komut<string | null>("klasor_sec", { baslik }));

/** klasörün bir alt klasörünü ayrı klasör gibi kullanır (yedekten okumak için) */
export function altKlasor(k: Klasor, alt: string): Klasor {
  yolParcalari(alt);
  const y = (yol: string) => (yol ? `${alt}/${yol}` : alt);
  return {
    ad: `${k.ad}/${alt}`,
    oku: yol => k.oku(y(yol)),
    yaz: (yol, m) => k.yaz(y(yol), m),
    olustur: (yol, m) => k.olustur(y(yol), m),
    sil: yol => k.sil(y(yol)),
    silKlasor: yol => k.silKlasor(y(yol)),
    bilgi: yol => k.bilgi(y(yol)),
    listele: yol => k.listele(y(yol)),
  };
}

// ---------- tarayıcıda seçilen klasörün hatırlanması (IndexedDB; içinde veri yok, yalnız klasör tutamağı) ----------
const IDB = "nobet-klasor";
function idb(): Promise<IDBDatabase> {
  return new Promise((tamam, hata) => {
    const r = indexedDB.open(IDB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("tutamak");
    r.onsuccess = () => tamam(r.result);
    r.onerror = () => hata(r.error);
  });
}
export async function tutamakOku(ad: string): Promise<FileSystemDirectoryHandle | null> {
  try {
    const d = await idb();
    return await new Promise(tamam => {
      const r = d.transaction("tutamak").objectStore("tutamak").get(ad);
      r.onsuccess = () => tamam((r.result as FileSystemDirectoryHandle) ?? null);
      r.onerror = () => tamam(null);
    });
  } catch {
    return null;
  }
}
export async function tutamakYaz(ad: string, h: FileSystemDirectoryHandle | null): Promise<void> {
  try {
    const d = await idb();
    await new Promise<void>(tamam => {
      const t = d.transaction("tutamak", "readwrite");
      if (h) t.objectStore("tutamak").put(h, ad);
      else t.objectStore("tutamak").delete(ad);
      t.oncomplete = () => tamam();
      t.onerror = () => tamam();
    });
  } catch {
    /* hatırlanamazsa bir sonraki açılışta yeniden seçilir */
  }
}
