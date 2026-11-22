// Sayfanın yetenekleri (veritabanı, kullanıcı, oda): claude.ai'de window.claude; ortak klasör kipinde giriş yapılınca
// klasör oturumu (veri/klasor/platform.ts).
import type { Platform } from "./klasor/platform";

let klasor: Platform | null = null;
export const platformAyarla = (p: Platform | null) => {
  klasor = p;
};
export const platform = (): Platform | null => klasor ?? (typeof window !== "undefined" ? (window.claude ?? null) : null);
