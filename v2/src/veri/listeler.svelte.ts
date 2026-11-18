// Acil eczane listesi, onay listesi ve öğlen nöbeti (kayıt ve onaylar), puantajda elle girilen kodlar.
// Durum ve kayıt: depo.svelte.ts (oradan da dışa verilir).
import type { OglenGunu, OglenSabit, PuantajKodu } from "./tipler";
import { ayAnahtari, haftaAnahtari, haftaIciGunleri } from "./tarih";
import { oglenSabitDogrula } from "./dogrulama";
import { alan, depo, duzKopya, gecmisiSifirla } from "./depo.svelte";

// ---------- acil eczane listesi (aylık), öğlen nöbeti ve onay listesi (haftalık) onayı ----------
// Onaylanan liste elle değiştirilemez, yeniden oluşturulmaz ve silinemez (önce onay kaldırılır). Öğlen nöbetinde
// sonradan girilen izin / rapor yine kendiliğinden onarılır (kişi gerçekte yoktur); acil listesinde gün uyarılı kalır.
// Onay listesi onaylıyken de canlıdır: sonradan girilen izin / rapor masaları yine değiştirir; yalnız elle değiştirilemez.
export type ListeTuru = "acil";
export const listeOnayi = (tur: ListeTuru, y: number, m: number) => depo.veri.listeOnay[tur][ayAnahtari(y, m)];
export function listeyiOnayla(tur: ListeTuru, y: number, m: number) {
  depo.veri.listeOnay[tur][ayAnahtari(y, m)] = { zaman: Date.now(), kim: depo.veri.kurum.onaylayan };
  gecmisiSifirla();   // onay bir geri alma noktasıdır
}
export function listeOnayiniKaldir(tur: ListeTuru, y: number, m: number) { delete depo.veri.listeOnay[tur][ayAnahtari(y, m)]; }
export type HaftaListesi = "oglen" | "onay";
/** günün haftasının onayı (öğlen nöbeti ya da onay listesi) */
export const haftaOnayi = (tur: HaftaListesi, y: number, m: number, d: number) => depo.veri.listeOnay[tur][haftaAnahtari(y, m, d)];
export const oglenOnayli = (y: number, m: number, d: number) => !!depo.veri.listeOnay.oglen[haftaAnahtari(y, m, d)];
export function haftayiOnayla(tur: HaftaListesi, y: number, m: number, d: number) {
  if (tur === "oglen" && !haftaOnayi("onay", y, m, d)) return;
  depo.veri.listeOnay[tur][haftaAnahtari(y, m, d)] = { zaman: Date.now(), kim: depo.veri.kurum.onaylayan };
  gecmisiSifirla();
}
/** haftanın onayını kaldırır; onay listesinin onayı kalkınca o haftanın öğlen nöbeti (onayıyla birlikte) silinir */
export function haftaOnayiniKaldir(tur: HaftaListesi, y: number, m: number, d: number) {
  const k = haftaAnahtari(y, m, d);
  delete depo.veri.listeOnay[tur][k];
  if (tur === "onay") { delete depo.veri.listeOnay.oglen[k]; oglenHaftasiniSil(y, m, d); }
}

// ---------- acil eczane nöbeti ----------
export const acilGunu = (y: number, m: number, gun: number): number[] => depo.veri.acil[ayAnahtari(y, m)]?.[gun] ?? [];
/** acil nöbet gününü elle ayarlar; elle: gün otomatik oluşturmada korunur (temizlenen gün korunmaz).
 *  onayliDuzeltme: onaylı ayda yalnız sonradan yazılamaz hâle gelen kişinin yerine başkası yazılırken */
export function acilGunuAyarla(y: number, m: number, gun: number, ids: number[], elle = true, onayliDuzeltme = false) {
  if (listeOnayi("acil", y, m) && !onayliDuzeltme) return;
  const ayK = ayAnahtari(y, m), tek = [...new Set(ids)].slice(0, 2);
  if (elle && tek.length) alan(depo.veri.acilElle, ayK, () => ({}))[gun] = true;
  else if (depo.veri.acilElle[ayK]) { delete depo.veri.acilElle[ayK][gun]; if (!Object.keys(depo.veri.acilElle[ayK]).length) delete depo.veri.acilElle[ayK]; }
  if (tek.length) { alan(depo.veri.acil, ayK, () => ({}))[gun] = tek; return; }
  const a = depo.veri.acil[ayK];
  if (!a) return;
  delete a[gun];
  if (!Object.keys(a).length) delete depo.veri.acil[ayK];
}
export function acilAyiniSil(y: number, m: number) { if (listeOnayi("acil", y, m)) return; delete depo.veri.acil[ayAnahtari(y, m)]; delete depo.veri.acilElle[ayAnahtari(y, m)]; }
export const acilElleMi = (y: number, m: number, gun: number) => !!depo.veri.acilElle[ayAnahtari(y, m)]?.[gun];
/** otomatik oluşturulan acil nöbet listesini kaydeder (elle günler olduğu gibi gelir) */
export function acilKaydet(y: number, m: number, gunler: { gun: number; ids: number[] }[]) {
  if (listeOnayi("acil", y, m)) return;
  const a: Record<string, number[]> = {};
  gunler.forEach(g => { if (g.ids.length) a[g.gun] = g.ids.slice(0, 2); });
  if (Object.keys(a).length) depo.veri.acil[ayAnahtari(y, m)] = a; else delete depo.veri.acil[ayAnahtari(y, m)];
}

// ---------- onay listesi masaları ----------
/** günün yerlerini elle kaydeder (gun: "YYYY-AA-GG"; kişi id → yer "1"–"7" ya da "J"); null: gün otomatiğe döner */
export function onayGunuAyarla(gun: string, yer: Record<number, string> | null) {
  const [gy, gm, gd] = gun.split("-").map(Number);
  if (haftaOnayi("onay", gy, gm - 1, gd)) return;
  if (!yer || !Object.keys(yer).length) { delete depo.veri.onayMasa.elle[gun]; return; }
  depo.veri.onayMasa.elle[gun] = Object.fromEntries(Object.entries(yer).map(([id, y]) => [id, y]));
}

// ---------- öğlen nöbeti ----------
/** onarim: izin / rapor sonrası kendiliğinden onarım (onaylı ayda da yapılır) */
type OglenKaydi = { gun: number; e: number[]; t: number[]; elle?: true; sabit?: OglenSabit };
const oglenKaydiYaz = (a: Record<string, OglenGunu>, g: OglenKaydi) => {
  if (g.e.length || g.t.length || g.elle || g.sabit) a[g.gun] = { e: g.e.slice(), t: g.t.slice(), ...(g.elle ? { elle: true as const } : {}), ...(g.sabit ? { sabit: duzKopya(g.sabit) } : {}) };
  else delete a[g.gun];
};
/** ayın öğlen nöbeti kaydını yazar. onarim: izin / rapor sonrası kendiliğinden onarım (onaylı haftada da yapılır);
 *  onarım değilse onaylı haftaların ve onay listesi onaysız haftaların günleri değişmez */
export function oglenKaydet(y: number, m: number, gunler: OglenKaydi[], onarim = false) {
  const ayK = ayAnahtari(y, m), eski = depo.veri.oglen[ayK] ?? {}, a: Record<string, OglenGunu> = {};
  const kilitli = (d: number) => !onarim && (oglenOnayli(y, m, d) || !haftaOnayi("onay", y, m, d));
  for (const [g, x] of Object.entries(eski)) if (kilitli(Number(g))) a[g] = x;
  gunler.forEach(g => { if (!kilitli(g.gun)) oglenKaydiYaz(a, g); });
  if (Object.keys(a).length) depo.veri.oglen[ayK] = a; else delete depo.veri.oglen[ayK];
}
/** bir haftanın öğlen nöbetini yazar (oglenHaftaHesapla parçaları: ay sınırını aşan hafta iki ay); haftanın onay listesi
 *  onaylı değilse ya da öğlen nöbeti onaylıysa yazılmaz */
export function oglenHaftaKaydet(parcalar: { y: number; m: number; bas: number; bit: number; gunler: OglenKaydi[] }[]) {
  const p0 = parcalar[0];
  if (!p0 || oglenOnayli(p0.y, p0.m, p0.bas) || !haftaOnayi("onay", p0.y, p0.m, p0.bas)) return;
  for (const p of parcalar) {
    const ayK = ayAnahtari(p.y, p.m), a = { ...(depo.veri.oglen[ayK] ?? {}) };
    for (let d = p.bas; d <= p.bit; d++) delete a[d];
    p.gunler.forEach(g => { if (g.gun >= p.bas && g.gun <= p.bit) oglenKaydiYaz(a, g); });
    if (Object.keys(a).length) depo.veri.oglen[ayK] = a; else delete depo.veri.oglen[ayK];
  }
}
/** günün haftasının öğlen nöbetini siler (onaylıysa silinmez) */
export function oglenHaftasiniSil(y: number, m: number, d: number) {
  if (oglenOnayli(y, m, d)) return;
  for (const [a, b, c] of haftaIciGunleri(y, m, d)) {
    const ayK = ayAnahtari(a, b), k = depo.veri.oglen[ayK];
    if (!k) continue;
    delete k[c];
    if (!Object.keys(k).length) delete depo.veri.oglen[ayK];
  }
}
/** bir günü elle düzenler. sabit: elle belirlenen yerler (yeniden oluşturma ve onarım yalnız bunlara dokunmaz; günün
 *  geri kalanı yeniden yazılabilir); null: gün tamamen otomatiğe bırakılır */
export function oglenGunuAyarla(y: number, m: number, gun: number, e: number[], t: number[], sabit: OglenSabit | null) {
  if (oglenOnayli(y, m, gun) || !haftaOnayi("onay", y, m, gun)) return;
  const a = alan(depo.veri.oglen, ayAnahtari(y, m), () => ({}));
  const E = [...new Set(e)], T = [...new Set(t)], sb = sabit ? oglenSabitDogrula(sabit, E, T) : undefined;
  a[gun] = { e: E, t: T, ...(sb ? { sabit: sb } : {}) };
}

// ---------- puantaj ----------
export function puantajKoduAyarla(y: number, m: number, id: number, gun: number, kod: PuantajKodu | null) {
  const ayK = ayAnahtari(y, m);
  if (kod) { alan(alan(depo.veri.puantaj, ayK, () => ({})), id, () => ({}))[gun] = kod; return; }
  const a = depo.veri.puantaj[ayK]?.[id];
  if (!a) return;
  delete a[gun];
  if (!Object.keys(a).length) delete depo.veri.puantaj[ayK][id];
  if (!Object.keys(depo.veri.puantaj[ayK]).length) delete depo.veri.puantaj[ayK];
}
export const puantajElleKodu = (y: number, m: number, id: number, gun: number): PuantajKodu | undefined => depo.veri.puantaj[ayAnahtari(y, m)]?.[id]?.[gun];
