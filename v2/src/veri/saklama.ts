// Bu cihazda saklama. Normalde tarayıcı kaydı (localStorage). Ortak klasör kipinde (masaüstü uygulaması ya da tarayıcıda
// "ortak klasörde çalış" seçildiyse) veriler yalnız bellekte tutulur: bilgisayarda şifresiz kopya kalmaz, oturum
// kapanınca (sayfa yenilenince) silinir. Asıl kayıt ortak klasördeki şifreli kasadır (veri/klasor/).
import { masaustuMu } from "./klasor/dosya";

const KIP_ANAHTAR = "nobet-klasor-kipi";
function kalici(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
/** tarayıcıda ortak klasör kipi seçili mi (claude.ai'de olmaz) */
function kipSecili(): boolean {
  if (typeof window === "undefined" || window.claude) return false;
  try {
    return kalici()?.getItem(KIP_ANAHTAR) === "1";
  } catch {
    return false;
  }
}
/** ortak klasör kipi: masaüstü uygulamasında her zaman; tarayıcıda seçilirse */
export const klasorKipi: boolean = typeof window !== "undefined" && (masaustuMu() || kipSecili());
/** tarayıcıda ortak klasör kipine geçer ya da çıkar (sayfa yenilenince geçerli olur) */
export function klasorKipiniAyarla(acik: boolean) {
  try {
    if (acik) kalici()?.setItem(KIP_ANAHTAR, "1");
    else kalici()?.removeItem(KIP_ANAHTAR);
  } catch {
    /* tarayıcı kaydı yoksa kip seçilemez */
  }
}
/** tarayıcıda ortak klasör kipi kullanılabilir mi (Edge / Chrome; claude.ai'de değil) */
export const klasorKipiKullanilabilir = () =>
  typeof window !== "undefined" &&
  !window.claude &&
  !masaustuMu() &&
  typeof (window as { showDirectoryPicker?: unknown }).showDirectoryPicker === "function";

class Bellek implements Storage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
}
const bellek = new Bellek();
/** uygulama verisinin saklandığı yer: tarayıcı kaydı ya da (ortak klasör kipinde) bellek. localStorage gibi kullanılır;
 *  tarayıcı kaydı yoksa (gizli pencere vb.) erişim hata fırlatır, çağıranlar bunu zaten yakalar. */
export const yerel: Storage = new Proxy({} as Storage, {
  get(_, ad) {
    const d: Storage = klasorKipi ? bellek : (localStorage as Storage);
    const v = (d as unknown as Record<string | symbol, unknown>)[ad];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(d) : v;
  },
});
