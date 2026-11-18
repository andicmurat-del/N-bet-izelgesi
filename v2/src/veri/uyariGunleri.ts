// Uyarı metninde geçen günler (Kural denetimi panelinde uyarıdan güne geçmek için). Motorun yazdığı biçimler:
// "14. gün", "14 Kasım" (ayın adıyla) ve "Şu günler için ...: 4 (1/2), 5, 11" gibi iki noktadan sonraki gün listesi.
import { AYLAR } from "./tarih";

/** metinde geçen, ayın içindeki günler (küçükten büyüğe, tekrarsız) */
export function uyariGunleri(t: string, m: number, gunSayisi: number): number[] {
  const l = new Set<number>();
  const ekle = (x: string) => {
    const d = Number(x);
    if (d >= 1 && d <= gunSayisi) l.add(d);
  };
  for (const r of t.matchAll(/(?<![\d/])(\d{1,2})\. gün/g)) ekle(r[1]);
  for (const r of t.matchAll(new RegExp(`(?<![\\d/])(\\d{1,2}) ${AYLAR[m]}(?![a-zçğıöşü])`, "g"))) ekle(r[1]);
  const liste = /^Şu günler[^:]*:\s*(.*)$/.exec(t);
  if (liste) for (const r of liste[1].matchAll(/(?<![\d/])(\d{1,2})(?![\d/])/g)) ekle(r[1]);
  return [...l].sort((a, b) => a - b);
}
