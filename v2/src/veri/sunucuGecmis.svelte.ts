// Sunucudaki değişiklik geçmişi: her sorumlunun değişiklikleri kendi claude.ai kimliğinin altına yazılır
// ("gecmis/<kişi>/aylar/<yıl-ay>"). Veritabanı kuralı gereği herkes yalnız kendi kimliğinin altına yazabilir, başkasının
// kayıtlarını değiştiremez ya da silemez (sayfanın sahibi dahil); bütün sorumlular hepsini okur. Böylece "kim, ne zaman,
// ne değiştirdi" bilgisi kişinin beyanına değil, claude.ai girişine dayanır ve her cihazda aynıdır.
// Belge sınırı (256 KiB) ve belge sayısı için kayıtlar ay ay tek belgede toplanır; ay belgesi dolarsa "yıl-ay.2" açılır.
import type { DegisiklikKaydi, KayitTuru } from "./gunluk.svelte";

interface Belge {
  exists: boolean;
  id: string;
  data(): Record<string, unknown> | undefined;
}
interface Sorgu {
  where(a: string, op: string, d: unknown): Sorgu;
  orderBy(a: string, yon?: "asc" | "desc"): Sorgu;
  limit(n: number): Sorgu;
  get(): Promise<{ docs: Belge[] }>;
}
interface BelgeRef {
  get(): Promise<Belge>;
  set(d: Record<string, unknown>): Promise<void>;
}
export interface GecmisDb {
  doc(yol: string): BelgeRef;
  collection(yol: string): Sorgu & { doc(id: string): BelgeRef };
}

export interface SunucuKaydi {
  z: number;
  t: string[];
  tur?: KayitTuru;
  /** değişikliği yapanın claude.ai kimliği */
  kim: string;
}
interface AyBelgesi {
  ay: string;
  n: number;
  bas: number;
  k: { z: number; t: string[]; tur?: KayitTuru }[];
}

const KOK = "gecmis",
  BELGE_SINIRI = 200 * 1024;
export const sunucuGecmis = $state({
  /** sunucu geçmişi kullanılıyor (claude.ai'de, oturum açık) */
  acik: false,
  kayit: [] as SunucuKaydi[],
  yukleniyor: false,
  /** daha eski ay belgeleri de okundu */
  tumu: false,
  hata: "",
});

let db: GecmisDb | null = null,
  ben: string | null = null;
let benim: AyBelgesi | null = null,
  benimId = "";
let kisiBelgesiVar = false;
const kuyruk: { z: number; t: string[]; tur?: KayitTuru; birlesti: boolean }[] = [];
let yaziyor = false,
  zamanlayici: ReturnType<typeof setTimeout> | undefined;

const ayAnahtari = (z: number) => {
  const t = new Date(z);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
};

export function sunucuGecmisBaslat(d: GecmisDb, kisi: string) {
  db = d;
  ben = kisi;
  sunucuGecmis.acik = true;
}

/** bu cihazda kaydedilen değişikliği sunucu geçmişine ekler (art arda gelenler tek yazımda toplanır) */
export function sunucuyaKaydet(k: DegisiklikKaydi, birlesti: boolean) {
  if (!db || !ben || k.tur === "esitleme") return;
  kuyruk.push({ z: k.z, t: k.t, ...(k.tur ? { tur: k.tur } : {}), birlesti });
  clearTimeout(zamanlayici);
  zamanlayici = setTimeout(() => void yaz(), 2000);
}

async function ayBelgesiniAc(ay: string): Promise<void> {
  const kol = db!.collection(`${KOK}/${ben}/aylar`);
  const l = (await kol.where("ay", "==", ay).get()).docs.filter(b => b.exists);
  const son = l.sort((a, b) => (Number(b.data()?.n) || 0) - (Number(a.data()?.n) || 0))[0];
  if (son) {
    const d = son.data() as Partial<AyBelgesi>;
    benim = { ay, n: Number(d.n) || 1, bas: Number(d.bas) || 0, k: Array.isArray(d.k) ? d.k : [] };
    benimId = son.id;
  } else {
    benim = { ay, n: 1, bas: 0, k: [] };
    benimId = ay;
  }
}

async function yaz() {
  if (!db || !ben || yaziyor || !kuyruk.length) return;
  yaziyor = true;
  try {
    if (!kisiBelgesiVar) {
      const kb = db.doc(`${KOK}/${ben}`);
      if (!(await kb.get()).exists) await kb.set({ ilk: Date.now() });
      kisiBelgesiVar = true;
    }
    while (kuyruk.length) {
      const k = kuyruk[0];
      const ay = ayAnahtari(k.z);
      if (!benim || benim.ay !== ay) await ayBelgesiniAc(ay);
      const b = benim!;
      const son = b.k[b.k.length - 1];
      if (k.birlesti && son && JSON.stringify(son.t) === JSON.stringify(k.t)) son.z = k.z;
      else b.k.push({ z: k.z, t: k.t, ...(k.tur ? { tur: k.tur } : {}) });
      if (!b.bas) b.bas = k.z;
      // belge dolarsa yeni belgeye geçilir (son kayıt orada başlar)
      if (JSON.stringify(b).length > BELGE_SINIRI && b.k.length > 1) {
        const tasan = b.k.pop()!;
        await db
          .collection(`${KOK}/${ben}/aylar`)
          .doc(benimId)
          .set({ ...b });
        benim = { ay, n: b.n + 1, bas: tasan.z, k: [tasan] };
        benimId = `${ay}.${b.n + 1}`;
      }
      await db
        .collection(`${KOK}/${ben}/aylar`)
        .doc(benimId)
        .set({ ...benim! });
      kuyruk.shift();
      // ekrandaki listeye de eklenir (yeniden okumadan)
      if (sunucuGecmis.kayit.length || sunucuGecmis.tumu) {
        const l = sunucuGecmis.kayit;
        const ilk = l[0];
        if (k.birlesti && ilk && ilk.kim === ben && JSON.stringify(ilk.t) === JSON.stringify(k.t)) ilk.z = k.z;
        else l.unshift({ z: k.z, t: k.t, ...(k.tur ? { tur: k.tur } : {}), kim: ben });
      }
    }
    sunucuGecmis.hata = "";
  } catch {
    sunucuGecmis.hata = "Değişiklik geçmişi sunucuya yazılamadı; bağlantı gelince yeniden denenir.";
    clearTimeout(zamanlayici);
    zamanlayici = setTimeout(() => void yaz(), 30000);
  } finally {
    yaziyor = false;
  }
}

/** bütün sorumluların geçmişini okur: her kişinin son iki ay belgesi (tumu: hepsi), yeniden eskiye */
export async function sunucuGecmisiYukle(tumu = false) {
  if (!db) return;
  sunucuGecmis.yukleniyor = true;
  try {
    const kisiler = (await db.collection(KOK).limit(500).get()).docs.filter(b => b.exists).map(b => b.id);
    if (ben && !kisiler.includes(ben)) kisiler.push(ben);
    const l: SunucuKaydi[] = [];
    await Promise.all(
      kisiler.map(async kim => {
        const ayl = await db!
          .collection(`${KOK}/${kim}/aylar`)
          .orderBy("bas", "desc")
          .limit(tumu ? 1000 : 2)
          .get();
        for (const b of ayl.docs) {
          const k = b.data()?.k;
          if (!Array.isArray(k)) continue;
          for (const x of k as { z: unknown; t: unknown; tur?: unknown }[])
            if (Number.isFinite(Number(x.z)) && Array.isArray(x.t))
              l.push({
                z: Number(x.z),
                t: (x.t as unknown[]).map(String).slice(0, 13),
                ...(typeof x.tur === "string" ? { tur: x.tur as KayitTuru } : {}),
                kim,
              });
        }
      }),
    );
    sunucuGecmis.kayit = l.sort((a, b) => b.z - a.z);
    sunucuGecmis.tumu = tumu;
    sunucuGecmis.hata = "";
  } catch {
    sunucuGecmis.hata = "Değişiklik geçmişi sunucudan okunamadı.";
  } finally {
    sunucuGecmis.yukleniyor = false;
  }
}

/** testler için: modül durumunu sıfırlar */
export function sunucuGecmisiSifirla() {
  db = null;
  ben = null;
  benim = null;
  benimId = "";
  kisiBelgesiVar = false;
  kuyruk.length = 0;
  clearTimeout(zamanlayici);
  sunucuGecmis.acik = false;
  sunucuGecmis.kayit = [];
  sunucuGecmis.tumu = false;
  sunucuGecmis.hata = "";
}
/** testler için: bekleyen yazımı hemen yapar */
export const sunucuGecmisiYaz = () => yaz();
