// Takvim yardımcıları: veriden bağımsız, saf tarih hesapları. Ay 0'dan başlar (0 = Ocak); haftanın günü
// Pazartesi'den başlar (0 = Pazartesi … 6 = Pazar).

export const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
export const AY_KISA = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
export const GUN_AD = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

/** Pazartesi'den başlayan gün sırası */
export const PERSEMBE = 3, CUMA = 4, CUMARTESI = 5, PAZAR = 6;

export function ayGunSayisi(y: number, m: number): number { return new Date(y, m + 1, 0).getDate(); }

/** 0 = Pazartesi … 6 = Pazar */
export function haftaGunu(y: number, m: number, d: number): number { return (new Date(y, m, d).getDay() + 6) % 7; }

export function haftaSonuMu(y: number, m: number, d: number): boolean { const g = haftaGunu(y, m, d); return g === CUMARTESI || g === PAZAR; }

/** Ay ve yıl sınırını aşarak k gün kaydırır */
export function gunKaydir(y: number, m: number, d: number, k: number): [number, number, number] {
  const t = new Date(y, m, d + k);
  return [t.getFullYear(), t.getMonth(), t.getDate()];
}

export const oncekiAy = (y: number, m: number) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 });
export const sonrakiAy = (y: number, m: number) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 });

/** "yıl-ay" (verideki çizelge, puantaj, acil anahtarları) */
export const ayAnahtari = (y: number, m: number) => y + "-" + m;
/** "yıl-ay-gün" (resmi tatil, arife anahtarları) */
export const gunAnahtari = (y: number, m: number, d: number) => y + "-" + m + "-" + d;

/** Karşılaştırılabilir gün numarası: YYYYAAGG (ay 1'den) */
export const tarihNo = (y: number, m: number, d: number) => y * 10000 + (m + 1) * 100 + d;
/** "YYYY-AA-GG" → YYYYAAGG; boşsa null */
export function isoNo(t: string | undefined | null): number | null {
  if (!t) return null;
  const p = String(t).split("-");
  return Number(p[0]) * 10000 + Number(p[1]) * 100 + Number(p[2]);
}
