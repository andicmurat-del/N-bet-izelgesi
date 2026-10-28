// Motorun puantajHesapla() sonucunun biçimi (src/motor/cizelge.js, puantajGrid)
import type { Rol } from "../veri/tipler";

export interface PuantajSatiri {
  s: { id: number; name: string; role: Rol };
  cells: { kod: string; saat: number; ov: boolean; acil?: boolean }[];
  toplam: number;
  /** aylık normal mesai; normal mesaisi olmayanlarda (dışarıdan nöbetçi, destek) null */
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
  M: "Normal mesai", N: "Nöbet (24 saat)", H: "Hazırlama (tatil günü, 8 saat)", NI: "Nöbet izni (nöbet ertesi)",
  YI: "Yıllık izin", R: "Rapor", DI: "Diğer izin", B: "Çalışmadı / boş", P: "Çalışma dönemi dışında",
};
/** cetvelde hücre yazısı (kurum örneğindeki gibi): saat ya da kısaltma */
export const kodMetni = (kod: string, saat: number, arife: boolean) =>
  kod === "M" ? String(arife ? saat : 8) : kod === "N" ? "24" : kod === "H" ? "8" : kod === "NI" ? "Nİ" : kod === "YI" ? "Yİ" : kod === "DI" ? "Dİ" : kod === "R" ? "R" : kod === "P" ? "–" : "";
