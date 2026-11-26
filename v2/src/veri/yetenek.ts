// Sayfanın yetenekleri (veritabanı, kullanıcı, oda): ortak klasör kipinde giriş yapılınca klasör oturumu verir
// (veri/klasor/platform.ts). Başka yerde (tek bilgisayarda tarayıcı) yoktur: veriler yalnız bu tarayıcıda durur.
import type { Platform } from "./klasor/platform";

let klasor: Platform | null = null;
export const platformAyarla = (p: Platform | null) => {
  klasor = p;
};
export const platform = (): Platform | null => klasor;
