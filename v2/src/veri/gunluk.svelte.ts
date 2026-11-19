// Değişiklik geçmişi ve günlük otomatik kopyalar. İkisi de yalnız bu tarayıcıda tutulur (veriye ve yedek dosyasına girmez).
// - Geçmiş: her kayıtta önceki hâlle fark özeti (veri/degisiklikOzeti.ts), zaman ve bu cihazda değişiklik yapanın adı;
//   geri alma, yedekten yükleme, başka cihazdan eşitleme ayrıca belirtilir. Son KAYIT_SINIR kayıt.
// - Günlük kopya: günün ilk kaydında verinin o anki (yani önceki günün sonundaki) hâli saklanır; son KOPYA_GUN gün.
//   Yanlış bir toplu değişiklikten (silme, yanlış yedek) dönmek içindir; tarayıcı verisi silinirse bunlar da gider.
import { degisiklikOzeti } from "./degisiklikOzeti";
import { KAYIT_ANAHTARI, guvenliJson, veriyiDogrula } from "./dogrulama";
import type { Veri } from "./tipler";

const GECMIS_ANAHTAR = KAYIT_ANAHTARI + "-degisiklikler",
  KULLANICI_ANAHTAR = KAYIT_ANAHTARI + "-kullanici",
  KOPYA_ONEK = KAYIT_ANAHTARI + "-kopya-";
export const KAYIT_SINIR = 500,
  KOPYA_GUN = 7;

/** kaydın kaynağı: kullanıcının değişikliği (boş), geri alma, yineleme, yedekten / kopyadan yükleme, başka cihazdan eşitleme */
export type KayitTuru = "geri" | "yinele" | "yukleme" | "esitleme";
export interface DegisiklikKaydi {
  z: number;
  kim: string;
  t: string[];
  tur?: KayitTuru;
}

function oku<T>(anahtar: string, vars: T): T {
  try {
    const s = localStorage.getItem(anahtar);
    return s === null ? vars : (JSON.parse(s) as T);
  } catch {
    return vars;
  }
}
function yaz(anahtar: string, deger: unknown) {
  try {
    localStorage.setItem(anahtar, typeof deger === "string" ? deger : JSON.stringify(deger));
    return true;
  } catch {
    return false;
  }
}

const ilkKayitlar = oku<DegisiklikKaydi[]>(GECMIS_ANAHTAR, []);
export const gunluk = $state<{ kayit: DegisiklikKaydi[]; kullanici: string }>({
  kayit: Array.isArray(ilkKayitlar) ? ilkKayitlar : [],
  kullanici: String(oku<string>(KULLANICI_ANAHTAR, "") ?? ""),
});

let siradakiTur: KayitTuru | undefined;
/** bir sonraki kaydın kaynağını belirtir (geri al, yedekten yükle, eşitleme) */
export function kaynakBelirt(tur: KayitTuru) {
  siradakiTur = tur;
}

/** iki kayıt arasındaki değişikliği geçmişe yazar (önceki yoksa ya da fark yoksa yazmaz) */
export function degisiklikIsle(once: Veri | null, sonra: Veri, simdi = Date.now()) {
  const tur = siradakiTur;
  siradakiTur = undefined;
  if (!once || once === sonra) return;
  let t = degisiklikOzeti(once, sonra);
  if (!t.length) return;
  if (t.length > 12) t = [...t.slice(0, 12), `… ve ${t.length - 12} değişiklik daha`];
  // aynı kişinin bir dakika içindeki aynı türden değişiklikleri tek kayıtta birleşir (ör. izin tablosunda art arda dokunuşlar)
  const son = gunluk.kayit[gunluk.kayit.length - 1];
  const birlesti = !!son && !tur && !son.tur && son.kim === gunluk.kullanici && simdi - son.z < 60_000 && json(son.t) === json(t);
  if (birlesti) son.z = simdi;
  else gunluk.kayit.push({ z: simdi, kim: gunluk.kullanici, t, ...(tur ? { tur } : {}) });
  if (gunluk.kayit.length > KAYIT_SINIR) gunluk.kayit.splice(0, gunluk.kayit.length - KAYIT_SINIR);
  yaz(GECMIS_ANAHTAR, gunluk.kayit);
  dinleyici?.(gunluk.kayit[gunluk.kayit.length - 1], birlesti);
}
let dinleyici: ((k: DegisiklikKaydi, birlesti: boolean) => void) | null = null;
/** her yeni kayıtta çağrılır (sunucu geçmişi: veri/sunucuGecmis.svelte.ts) */
export function degisiklikDinle(f: typeof dinleyici) {
  dinleyici = f;
}
const json = (x: unknown) => JSON.stringify(x);

export function kullaniciAyarla(ad: string) {
  gunluk.kullanici = ad.trim().slice(0, 40);
  yaz(KULLANICI_ANAHTAR, JSON.stringify(gunluk.kullanici));
}
export function gecmisiTemizle() {
  gunluk.kayit = [];
  yaz(GECMIS_ANAHTAR, []);
}

// ---------- günlük kopyalar ----------
const gunAnahtari = (t: Date) => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
/** kopya listesi değişince arayüz yenilensin */
export const kopyaIzi = $state({ surum: 0 });

/** günün ilk kaydında verinin o anki hâlini saklar; KOPYA_GUN günden eskileri siler. Yer yoksa en eskiden başlayarak siler. */
export function gunlukKopyaAl(v: Veri, simdi = new Date()) {
  const gun = gunAnahtari(simdi);
  let var_ = false;
  try {
    var_ = localStorage.getItem(KOPYA_ONEK + gun) !== null;
  } catch {
    return;
  }
  if (var_) return;
  const metin = JSON.stringify({ z: simdi.getTime(), veri: v });
  let liste = kopyaGunleri();
  while (!yaz(KOPYA_ONEK + gun, metin) && liste.length) {
    sil(liste[0]);
    liste = liste.slice(1);
  }
  const sinir = gunAnahtari(new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate() - KOPYA_GUN + 1));
  for (const g of kopyaGunleri()) if (g < sinir) sil(g);
  kopyaIzi.surum++;
}
function sil(gun: string) {
  try {
    localStorage.removeItem(KOPYA_ONEK + gun);
  } catch {
    /* yapılacak bir şey yok */
  }
}
/** saklanan kopyaların günleri (eskiden yeniye) */
function kopyaGunleri(): string[] {
  const l: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(KOPYA_ONEK)) l.push(k.slice(KOPYA_ONEK.length));
    }
  } catch {
    /* depolama yok */
  }
  return l.sort();
}
/** kopyalar: gün, alınma zamanı, boyut (KB), kişi ve çizelge sayısı (yeniden eskiye) */
export function gunlukKopyalar(): { gun: string; z: number; kb: number; kisi: number; ay: number }[] {
  void kopyaIzi.surum;
  return kopyaGunleri()
    .reverse()
    .map(gun => {
      try {
        const s = localStorage.getItem(KOPYA_ONEK + gun) ?? "";
        const o = JSON.parse(s) as { z: number; veri: Veri };
        return {
          gun,
          z: o.z,
          kb: Math.round(s.length / 1024),
          kisi: o.veri.staff?.length ?? 0,
          ay: Object.keys(o.veri.schedules ?? {}).length,
        };
      } catch {
        return null;
      }
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
}
/** kopyanın verisi (doğrulanmış); okunamazsa null */
export function gunlukKopyaVerisi(gun: string): Veri | null {
  try {
    const s = localStorage.getItem(KOPYA_ONEK + gun);
    if (!s) return null;
    const o = guvenliJson(s) as { veri?: unknown };
    return o && o.veri ? veriyiDogrula(o.veri) : null;
  } catch {
    return null;
  }
}
