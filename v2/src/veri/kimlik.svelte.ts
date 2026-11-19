// Kim kullanıyor: claude.ai hesabı (giriş ve kimlik doğrulamayı claude.ai yapar). Sayfa yalnız sorumlularla paylaşılır;
// veritabanı kuralları (sayfanın yetenek bildirimi) sunucuda uygulanır: verileri okuyup yazmak için paylaşımda en az
// "Contributor" (katkıda bulunan) düzeyi gerekir. Kimlik yalnız kişinin değişmez numarası (id) olarak saklanır; ad her
// gösterimde claude.ai'den çözülür (ad değişse de geçmiş doğru kişiyi gösterir).
// claude.ai dışında (geliştirme, ekran testleri) kimlik yoktur: uygulama eskisi gibi tek kullanıcılı çalışır.

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
export const ROL_ADI: Record<Rol, string> = {
  sahip: "Sahip",
  duzenleyen: "Düzenleyen (Editor)",
  katkida: "Katkıda bulunan (Contributor)",
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
    if (typeof window === "undefined" || !window.claude) return null;
    try {
      kullanici = (await window.claude.use("user")) as KullaniciYetenegi | null;
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
