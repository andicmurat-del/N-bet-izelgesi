// Kim kullanıyor: claude.ai hesabı (giriş ve kimlik doğrulamayı claude.ai yapar). Sayfa yalnız sorumlularla paylaşılır;
// veritabanı kuralları (sayfanın yetenek bildirimi) sunucuda uygulanır: verileri okuyup yazmak için paylaşımda en az
// "Contributor" (katkıda bulunan) düzeyi gerekir. Kimlik yalnız kişinin değişmez numarası (id) olarak saklanır; ad her
// gösterimde claude.ai'den çözülür (ad değişse de geçmiş doğru kişiyi gösterir).
// claude.ai dışında (geliştirme, ekran testleri) kimlik yoktur: uygulama eskisi gibi tek kullanıcılı çalışır.

import type { Onay, Veri } from "./tipler";
import { gunluk } from "./gunluk.svelte";
import { klasorKipi } from "./saklama";
import { platform } from "./yetenek";

interface Profil {
  id: string;
  name: string;
  color: string;
  guest: boolean;
}
export interface KullaniciYetenegi {
  me(): Promise<{ id: string | null; name: string; isOwner: boolean; canEdit: boolean }>;
  can(ad: string): Promise<boolean | null>;
  profiles(ids: readonly string[]): Promise<Record<string, Profil>>;
}

export type Rol = "sahip" | "duzenleyen" | "katkida" | "okuyan";
export const ROL_ADI: Record<Rol, string> = klasorKipi
  ? { sahip: "Sahip", duzenleyen: "Baş sorumlu", katkida: "Sorumlu", okuyan: "Yalnız görüntüleyen" }
  : {
      sahip: "Sahip",
      duzenleyen: "Baş sorumlu (Editor)",
      katkida: "Sorumlu (Contributor)",
      okuyan: "Yalnız görüntüleyen: verilere erişemez",
    };

export const kimlik = $state({
  /** claude.ai kimliği belli (sayfa claude.ai'de, oturum açık) */
  var: false,
  id: null as string | null,
  ad: "",
  rol: null as Rol | null,
  /** kişi numarası → claude.ai'deki adı (gösterim için; saklanmaz) */
  adlar: {} as Record<string, string>,
});

let kullanici: KullaniciYetenegi | null = null;
let baslama: Promise<KullaniciYetenegi | null> | null = null;

/** claude.ai kullanıcı yeteneğini bir kez alır; yoksa null */
export function kimlikBaslat(): Promise<KullaniciYetenegi | null> {
  if (baslama) return baslama;
  baslama = (async () => {
    const p = platform();
    if (!p) return null;
    try {
      kullanici = (await p.use("user")) as KullaniciYetenegi | null;
    } catch {
      kullanici = null;
    }
    if (!kullanici) return null;
    const ben = await kullanici.me();
    if (!ben.id) return kullanici;
    const yazar = await kullanici.can("data.write");
    kimlik.id = ben.id;
    kimlik.ad = ben.name;
    kimlik.rol = ben.isOwner ? "sahip" : ben.canEdit ? "duzenleyen" : yazar === false ? "okuyan" : "katkida";
    if (ben.name) kimlik.adlar[ben.id] = ben.name;
    kimlik.var = true;
    return kullanici;
  })();
  return baslama;
}

/** verilen kişilerin adlarını claude.ai'den çözer (önbellekli; sık çağrılabilir) */
export async function adlariCoz(ids: readonly string[]) {
  const u = await kimlikBaslat();
  const eksik = [...new Set(ids)].filter(Boolean);
  if (!u || !eksik.length) return;
  const p = await u.profiles(eksik);
  for (const id of eksik) if (p[id]?.name && kimlik.adlar[id] !== p[id].name) kimlik.adlar[id] = p[id].name;
}
/** kişinin adı (çözülemezse: paylaşımdan çıkarılmış ya da bilinmiyor) */
export const kisiAdi = (id: string | null | undefined) =>
  id === kimlik.id ? kimlik.ad || "Siz" : (id && kimlik.adlar[id]) || "Bilinmeyen kullanıcı";

/** onay kaydına yazılacak onaylayan: claude.ai kimliği, yoksa bu cihazda yazılan ad */
export const onaylayanKimligi = (): { kimId?: string; kimAd?: string } =>
  kimlik.id ? { kimId: kimlik.id } : gunluk.kullanici ? { kimAd: gunluk.kullanici } : {};
/** programda onaylayanın adı (yoksa boş) */
export const onaylayanAdi = (o: Onay | undefined | null): string => (o?.kimId ? kisiAdi(o.kimId) : o?.kimAd || "");
/** onay satırına eklenecek metin: " · onaylayan: Ayşe Kaya" (yoksa boş) */
export const onaylayanMetni = (o: Onay | undefined | null): string => {
  const ad = onaylayanAdi(o);
  return ad ? " · onaylayan: " + ad : "";
};
/** verideki bütün onaylayan kimlikleri (adları önceden çözülsün: çıktılar için) */
export function onayKimlikleri(v: Veri): string[] {
  const l = new Set<string>();
  for (const c of Object.values(v.schedules)) if (c.onay?.kimId) l.add(c.onay.kimId);
  for (const t of Object.values(v.listeOnay)) for (const o of Object.values(t)) if (o.kimId) l.add(o.kimId);
  for (const a of Object.values(v.notlar ?? {})) for (const g of Object.values(a)) for (const n of g) if (n.kimId) l.add(n.kimId);
  return [...l];
}
/** çıktıya giden onay kaydına çözülmüş adı ekler (kopya döner) */
export const ciktiOnayi = (o: Onay | undefined | null): Onay | null => (o ? { ...o, onaylayanAd: onaylayanAdi(o) } : null);
/** personel, ayarlar, kurum ve servis ayarlarını değiştirebilir mi: sahip ve baş sorumlu (Editor); claude.ai dışında
 *  herkes. Sunucuda veritabanı kuralı da uygular (nobet/yonetim belgesine yalnız admin yazar). */
export const yonetimYetkisi = () => !kimlik.var || kimlik.rol === "sahip" || kimlik.rol === "duzenleyen";
/** tüm veriyi değiştiren işlemler (yedekten yükleme, kopyaya dönme) de yönetim bölümlerini değiştirir */
export const YONETIM_UYARISI = klasorKipi
  ? "Bunu yalnız sahip ve baş sorumlu yapabilir."
  : "Bunu yalnız sahip ve baş sorumlu (Editor) yapabilir.";
/** ortak klasör kipinde sahip kişinin rolünü ya da adını değiştirince (sayfa yenilenmeden) */
export function kimlikGuncelle(o: { ad: string; rol: Rol; adlar?: Record<string, string> }) {
  kimlik.ad = o.ad;
  kimlik.rol = o.rol;
  if (kimlik.id) kimlik.adlar[kimlik.id] = o.ad;
  if (o.adlar) for (const [k, v] of Object.entries(o.adlar)) kimlik.adlar[k] = v;
}
