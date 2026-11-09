// Onay listesi masaları: günlük eczanede 7 onay masası (ilk 6'sı her gün dolu olmalı) ve jokerler. Eczacılar (acilde
// tutanlar dahil, kemoterapi eczacıları hariç) her hafta sıradaki yere geçer:
//   Masa 1 → Masa 3 → Masa 2 → Masa 4 → Joker → Masa 5 → Joker → Masa 6 (9. kişi ve sonrası sona Joker olarak eklenir).
// Bir hafta boyunca herkes aynı yerde oturur. Günlük dağıtım (hafta içi, arife dahil, resmi tatil hariç):
//   1. Masa sahibi o gün çalışıyorsa (puantajda mesai ya da nöbet; nöbet ertesi, izin, rapor yok) masasında oturur.
//   2. Boş kalan ilk 6 masaya o gün çalışan jokerler sırayla geçer (joker görevini yapmış sayılır, masanın değil).
//   3. Geriye 2 ya da daha çok joker kalırsa ilki Masa 7'ye oturur; kalanlar joker.
//   4. İlk 6 masadan hâlâ boş varsa o günün hazırlama teknikerlerinden biri oturur; yıl boyunca sırayla (en az oturan).
// Yerleşim kullanıcıdan gelir: bir haftanın kimin hangi yerde olduğu girilir, sonraki haftalar oradan kendiliğinden ilerler;
// kadro değişince yeni haftanın yerleşimi yeniden girilir (en son girilen önceki hafta esas alınır).
import { aktifGunMu, type Baglam } from "./baglam";
import { puantajIzgarasi, type PuantajIzgarasi } from "./puantaj";
import { ayAnahtari, gunKaydir, haftaGunu } from "./takvim";

export type Yer = { tur: "masa"; no: number } | { tur: "joker"; no: number };
const TEMEL: ("J" | number)[] = [1, 3, 2, 4, "J", 5, "J", 6];

/** n kişilik sıra: temel 8 yer, 9. kişiden sonrası sona joker */
export function onayDongusu(n: number): Yer[] {
  const l = [...TEMEL]; while (l.length < n) l.push("J");
  let j = 0;
  return l.map(x => (x === "J" ? { tur: "joker", no: ++j } : { tur: "masa", no: x }));
}
export const yerAdi = (y: Yer) => (y.tur === "masa" ? "Masa " + y.no : "Joker " + y.no);

/** onay masası tutan eczacı: eczacı (acilde tutan dahil); kemoterapi eczacısı yok */
export const onayEczacisi = (s: { role: string }) => s.role === "eczaci";

/** "YYYY-AA-GG" ↔ gün */
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const coz = (t: string): [number, number, number] => { const [a, b, c] = t.split("-").map(Number); return [a, b - 1, c]; };
const gunNo = (y: number, m: number, d: number) => Math.round(Date.UTC(y, m, d) / 864e5);
/** günün haftasının Pazartesi'si */
export function pazartesi(y: number, m: number, d: number): [number, number, number] { return gunKaydir(y, m, d, -haftaGunu(y, m, d)); }

export type OnayYerlesimi = Record<string, Record<string, number>>;

/** o haftanın yerleşimi: kişi id → sıradaki yer; esas alınan (girilen) hafta; sıra uzunluğu */
export function haftaYerlesimi(B: Baglam, py: number, pm: number, pd: number) {
  const Y = B.onayYerlesim, bu = iso(py, pm, pd);
  const capa = Object.keys(Y).filter(k => k <= bu && Object.keys(Y[k] ?? {}).length).sort().pop();
  if (!capa) return null;
  const a = Y[capa], n = Math.max(TEMEL.length, Object.keys(a).length), fark = Math.round((gunNo(py, pm, pd) - gunNo(...coz(capa))) / 7);
  const yer: Record<number, number> = {};
  for (const [id, s] of Object.entries(a)) yer[Number(id)] = (((s + fark) % n) + n) % n;
  return { capa, girildi: capa === bu, yer, n, dongu: onayDongusu(n) };
}

export interface OnayHucre { id: number | null; ad: string; not?: string; tekniker?: true }
export interface OnayGunu { y: number; m: number; d: number; dw: number; tatil: boolean; arife: boolean; masa: OnayHucre[]; joker: OnayHucre[]; uyari: string[] }
export interface OnayHaftasi { pzt: string; yerlesim: ReturnType<typeof haftaYerlesimi>; gunler: OnayGunu[]; kisiler: { id: number; ad: string; yer: Yer | null }[]; sirasiz: string[] }

const CALISIR = (k: string, saat: number) => k === "M" || k === "N" || (k.startsWith("S:") && saat > 0);

function izgaraOkuyucu(B: Baglam) {
  const c = new Map<string, PuantajIzgarasi>();
  return (y: number, m: number) => { const k = ayAnahtari(y, m); let G = c.get(k); if (!G) { G = puantajIzgarasi(B, y, m); c.set(k, G); } return G; };
}

function gunHesapla(B: Baglam, izgara: ReturnType<typeof izgaraOkuyucu>, y: number, m: number, d: number, Yh: NonNullable<ReturnType<typeof haftaYerlesimi>>, sayac: Record<number, number>): OnayGunu {
  const dw = haftaGunu(y, m, d), tatil = B.resmiTatilMi(y, m, d), arife = !tatil && B.arifeMi(y, m, d);
  const g: OnayGunu = { y, m, d, dw, tatil, arife, masa: [], joker: [], uyari: [] };
  if (tatil) return g;
  const G = izgara(y, m), ad = (id: number) => B.kisi(id)?.name ?? "(silinmiş kişi)";
  const calisiyor = (id: number) => { const s = B.kisi(id); if (!s || !aktifGunMu(s, y, m, d)) return false; const c = G.satirlar.find(r => r.s.id === id)?.cells[d - 1]; return !!c && CALISIR(c.kod, c.saat); };
  const masaSahibi: Record<number, number> = {}, jokerler: { id: number; no: number }[] = [];
  for (const [id, s] of Object.entries(Yh.yer)) { const yer = Yh.dongu[s]; if (yer.tur === "masa") masaSahibi[yer.no] = Number(id); else jokerler.push({ id: Number(id), no: yer.no }); }
  jokerler.sort((a, b) => a.no - b.no);
  const bos: number[] = [];
  for (let no = 1; no <= 6; no++) {
    const id = masaSahibi[no];
    if (id !== undefined && calisiyor(id)) g.masa[no - 1] = { id, ad: ad(id) };
    else { g.masa[no - 1] = { id: null, ad: "" }; bos.push(no); }
  }
  const gelen = jokerler.filter(j => calisiyor(j.id));
  for (const no of [...bos]) {
    const j = gelen.shift(); if (!j) break;
    const sahip = masaSahibi[no];
    g.masa[no - 1] = { id: j.id, ad: ad(j.id), not: sahip !== undefined ? `joker · ${ad(sahip)} yerine` : "joker" };
    bos.splice(bos.indexOf(no), 1);
  }
  if (gelen.length >= 2) { const j = gelen.shift()!; g.masa[6] = { id: j.id, ad: ad(j.id), not: "joker" }; }
  else g.masa[6] = { id: null, ad: "" };
  g.joker = gelen.map(j => ({ id: j.id, ad: ad(j.id) }));
  // jokerler yetmedi: o günün hazırlama teknikerlerinden biri, yıl boyunca sırayla
  if (bos.length) {
    const k = B.servisKayit?.[ayAnahtari(y, m)]?.gun?.[d]?.k as number[] | undefined;
    const tek = (k?.length ? k : B.staff.filter(s => s.role === "teknisyen").map(s => s.id)).filter(id => B.kisi(id)?.role === "teknisyen" && calisiyor(id));
    const sec = tek.slice().sort((a, b) => (sayac[a] || 0) - (sayac[b] || 0) || ad(a).localeCompare(ad(b), "tr") || a - b);
    for (const no of [...bos]) {
      const id = sec.shift(); if (id === undefined) break;
      sayac[id] = (sayac[id] || 0) + 1;
      const sahip = masaSahibi[no];
      g.masa[no - 1] = { id, ad: ad(id), tekniker: true, not: sahip !== undefined ? `tekniker · ${ad(sahip)} yerine` : "tekniker" };
      bos.splice(bos.indexOf(no), 1);
    }
    if (bos.length) g.uyari.push(`Masa ${bos.join(", ")} boş kaldı: o gün yeterli eczacı ve hazırlama teknikeri yok.`);
  }
  return g;
}

/** yılın başından verilen güne kadar masaya oturan teknikerlerin sayısı (sırayla oturma için) */
function teknikerSayaci(B: Baglam, izgara: ReturnType<typeof izgaraOkuyucu>, y: number, m: number, d: number): Record<number, number> {
  const sayac: Record<number, number> = {}, son = gunNo(y, m, d);
  // yerleşimi hiç girilmemiş haftalar atlanır: ilk girilen haftadan önce sayılacak gün yok
  const ilk = Object.keys(B.onayYerlesim).sort()[0];
  if (!ilk) return sayac;
  let [a, b, c]: [number, number, number] = ilk > iso(y, 0, 1) ? coz(ilk) : [y, 0, 1];
  let Yh: ReturnType<typeof haftaYerlesimi> = null, hafta = "";
  while (gunNo(a, b, c) < son) {
    if (haftaGunu(a, b, c) <= 4) {
      const p = pazartesi(a, b, c), k = iso(...p);
      if (k !== hafta) { hafta = k; Yh = haftaYerlesimi(B, ...p); }
      if (Yh) gunHesapla(B, izgara, a, b, c, Yh, sayac);
    }
    [a, b, c] = gunKaydir(a, b, c, 1);
  }
  return sayac;
}

/** Pazartesi'si verilen haftanın onay listesi */
export function onayHaftasi(B: Baglam, py: number, pm: number, pd: number): OnayHaftasi {
  const Yh = haftaYerlesimi(B, py, pm, pd), izgara = izgaraOkuyucu(B), pzt = iso(py, pm, pd);
  const [ty, tm, td] = gunKaydir(py, pm, pd, 4);
  const kadro = B.staff.filter(s => onayEczacisi(s) && (aktifGunMu(s, py, pm, pd) || aktifGunMu(s, ty, tm, td))).sort((a, b) => a.name.localeCompare(b.name, "tr"));
  const kisiler = kadro.map(s => ({ id: s.id, ad: s.name, yer: Yh && Yh.yer[s.id] !== undefined ? Yh.dongu[Yh.yer[s.id]] : null }));
  const out: OnayHaftasi = { pzt, yerlesim: Yh, gunler: [], kisiler, sirasiz: Yh ? kisiler.filter(k => !k.yer).map(k => k.ad) : [] };
  if (!Yh) return out;
  // teknikerin yıl içi sırası: bu haftadan önceki günler sayılır, hafta içinde de sayılarak ilerler
  const sayac = teknikerSayaci(B, izgara, py, pm, pd);
  let yil = py;
  for (let i = 0; i < 5; i++) {
    const [a, b, c] = gunKaydir(py, pm, pd, i);
    if (a !== yil) { yil = a; Object.keys(sayac).forEach(k => delete sayac[Number(k)]); }   // yeni yıl: sıra baştan
    out.gunler.push(gunHesapla(B, izgara, a, b, c, Yh, sayac));
  }
  return out;
}
