// Motorun puantajHesapla() sonucunun biçimi (src/motor/puantaj.ts, puantajIzgarasi)
import type { Kisi } from "../veri/tipler";

export interface PuantajSatiri {
  s: Kisi;
  cells: { kod: string; saat: number; ov: boolean; acil?: boolean }[];
  toplam: number;
  /** aylık normal mesai; normal mesaisi olmayanlarda (kemoterapi eczacısı, destek) null */
  aylik: number | null;
  fm: number; fmGunduz: number; fmGece: number;
  n: number; h: number; thu: number; cu: number; cmt: number; paz: number; rt: number; yi: number; rd: number; ni: number;
}
export interface Izgara {
  gunler: { gun: number; dw: number; tatil: boolean; arife: boolean; ms: number }[];
  satirlar: PuantajSatiri[];
  mesaiToplam: number;
}

export const KOD_AD: Record<string, string> = {
  M: "Normal mesai", N: "Nöbet", H: "Hazırlama (tatil günü)", NI: "Nöbet izni (nöbet ertesi)",
  YI: "Yıllık izin", R: "Rapor", DI: "Diğer izin", B: "Çalışmadı / boş", P: "Çalışma dönemi dışında",
};
/** saat yazısı: tam saat olduğu gibi, yarım saat virgülle (7,5) */
export const saatYaz = (n: number) => (Number.isInteger(n) ? String(n) : String(n).replace(".", ","));
/** cetvelde hücre yazısı (kurum örneğindeki gibi): mesai, nöbet ve hazırlamada o günün saati (ayardaki süreler, arife,
 *  elle düzenlenen tatil günü), ötekilerde kısaltma */
export const kodMetni = (kod: string, saat: number) =>
  kod === "M" || kod === "N" || kod === "H" ? saatYaz(saat) : kod === "NI" ? "Nİ" : kod === "YI" ? "Yİ" : kod === "DI" ? "Dİ" : kod === "R" ? "R" : kod === "P" ? "–" : "";
