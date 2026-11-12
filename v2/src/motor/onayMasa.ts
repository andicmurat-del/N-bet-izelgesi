// Onay listesi masaları: günlük eczanede 7 onay masası (ilk 6'sı her gün dolu olmalı) ve jokerler. Sabit sıra yoktur:
// yerler her gün yeniden dağıtılır. Dağıtıma o gün çalışan eczacılar girer (acilde tutanlar dahil, kemoterapi
// eczacıları hariç; puantajda mesai ya da nöbet; nöbet ertesi, izin, rapor yok). Hafta içi, arife dahil, resmi tatil hariç.
//   - Yerler: Masa 1–6; 7. kişi joker olur; 8 ve daha çok kişide ilk fazla kişi Masa 7'ye oturur, kalanlar joker.
//   - Kimse bir önceki çalıştığı gün oturduğu yere oturmaz (mümkünse aynı hafta içinde de aynı yere ikinci kez oturmaz).
//   - Yıl boyunca herkes her masaya (ve jokerliğe) eşit oturur: her gün yerler, kişilerin yıl içinde o yerde en az
//     oturduğu şekilde dağıtılır (en az toplam). Cuma (hafta sonu listeleri de onaylanır, 3 günlük iş) ayrı sayılır:
//     Cumalar kendi arasında, Pazartesi–Perşembe kendi arasında eşitlenir. Yıl başında sayılar sıfırlanır.
//   - İlk 6 masadan boş kalan olursa o günün hazırlama teknikerlerinden biri oturur; yıl boyunca sırayla (en az oturan).
//     Hangi teknikerin oturacağı elle de seçilebilir (o gün çalışan hazırlama teknikerlerinden); elle seçilen sırayı sayar.
//   - Elle değiştirilen günde kaydedilen yerler korunur (o gün çalışan ve yeri o gün var olanlar); kalanlar dağıtılır.
//     Eşitlikte gerçekte oturulan yer sayılır.
import { aktifGunMu, type Baglam } from "./baglam";
import { puantajIzgarasi, type PuantajIzgarasi } from "./puantaj";
import { ayAnahtari, gunKaydir, haftaGunu } from "./takvim";

/** onay masası tutan eczacı: eczacı (acilde tutan dahil); kemoterapi eczacısı yok */
const onayEczacisi = (s: { role: string }) => s.role === "eczaci";

/** "YYYY-AA-GG" */
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const gunNo = (y: number, m: number, d: number) => Math.round(Date.UTC(y, m, d) / 864e5);
/** günün haftasının Pazartesi'si */
export function pazartesi(y: number, m: number, d: number): [number, number, number] { return gunKaydir(y, m, d, -haftaGunu(y, m, d)); }

/** yer anahtarları: "1"–"7" masa, "J" joker */
export const ONAY_YERLERI = ["1", "2", "3", "4", "5", "6", "7", "J"] as const;
export type OnayYeri = (typeof ONAY_YERLERI)[number];
/** dağıtım ağırlıkları: yıl içinde o yerde aynı tür günde (Cuma ya da Pazartesi–Perşembe) oturulan her gün; tüm
 *  günlerin toplamı (eşitlikte ayırıcı); aynı hafta içinde aynı yere ikinci kez; önceki gün aynı yer */
export const AGIR = { sayi: 10, toplam: 1, hafta: 25, dun: 1e6 } as const;

/** en az maliyetli atama (Macar yöntemi): satır sayısı ≤ sütun sayısı; her satıra bir sütun */
export function enAzAtama(c: number[][]): number[] {
  const n = c.length, m = n ? c[0].length : 0;
  if (!n) return [];
  const u = new Array(n + 1).fill(0), v = new Array(m + 1).fill(0), p = new Array(m + 1).fill(0), way = new Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i; let j0 = 0;
    const minv = new Array(m + 1).fill(Infinity), used = new Array(m + 1).fill(false);
    do {
      used[j0] = true; const i0 = p[j0]; let delta = Infinity, j1 = 0;
      for (let j = 1; j <= m; j++) if (!used[j]) {
        const cur = c[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= m; j++) if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
  }
  const out = new Array(n).fill(-1);
  for (let j = 1; j <= m; j++) if (p[j]) out[p[j] - 1] = j - 1;
  return out;
}

export interface OnayHucre { id: number | null; ad: string; not?: string; tekniker?: true; elle?: true }
/** elle: gün elle değiştirildi */
/** tekAday: o gün boş masaya oturabilecek (çalışan hazırlama) teknikerler */
export interface OnayGunu { y: number; m: number; d: number; dw: number; tatil: boolean; arife: boolean; masa: OnayHucre[]; joker: OnayHucre[]; uyari: string[]; elle?: true; tekAday?: { id: number; ad: string }[] }
/** kisiler: haftanın onay eczacıları ve yıl başından hafta sonuna kadar her yerde oturdukları gün sayısı (cuma: yalnız Cumalar) */
export interface OnayHaftasi { pzt: string; gunler: OnayGunu[]; kisiler: { id: number; ad: string; say: Record<OnayYeri, number>; cuma: Record<OnayYeri, number> }[] }

const CALISIR = (k: string, saat: number) => k === "M" || k === "N" || (k.startsWith("S:") && saat > 0);

function izgaraOkuyucu(B: Baglam) {
  const c = new Map<string, PuantajIzgarasi>();
  return (y: number, m: number) => { const k = ayAnahtari(y, m); let G = c.get(k); if (!G) { G = puantajIzgarasi(B, y, m); c.set(k, G); } return G; };
}

/** yıl içi sayılar ve son yerler (gün gün ilerler) */
type Sayac = Record<number, Partial<Record<OnayYeri, number>>>;
interface Durum { say: Sayac; cuma: Sayac; hafici: Sayac; dun: Record<number, OnayYeri>; hafta: Record<number, Set<OnayYeri>>; haftaNo: number; tek: Record<number, number> }
const yeniDurum = (): Durum => ({ say: {}, cuma: {}, hafici: {}, dun: {}, hafta: {}, haftaNo: -1, tek: {} });

function gunHesapla(B: Baglam, izgara: ReturnType<typeof izgaraOkuyucu>, y: number, m: number, d: number, D: Durum): OnayGunu {
  const dw = haftaGunu(y, m, d), tatil = B.resmiTatilMi(y, m, d), arife = !tatil && B.arifeMi(y, m, d);
  const g: OnayGunu = { y, m, d, dw, tatil, arife, masa: [], joker: [], uyari: [] };
  if (tatil) return g;
  const hn = Math.floor((gunNo(y, m, d) + 3) / 7);   // Pazartesi'den başlayan hafta numarası
  if (hn !== D.haftaNo) { D.haftaNo = hn; D.hafta = {}; }
  const G = izgara(y, m), ad = (id: number) => B.kisi(id)?.name ?? "(silinmiş kişi)";
  const calisiyor = (id: number) => { const s = B.kisi(id); if (!s || !aktifGunMu(s, y, m, d)) return false; const c = G.satirlar.find(r => r.s.id === id)?.cells[d - 1]; return !!c && CALISIR(c.kod, c.saat); };
  const kisi = B.staff.filter(k => onayEczacisi(k) && calisiyor(k.id)).map(k => k.id).sort((a, b) => a - b);
  // o günün yerleri: Masa 1–6, fazla kişiden ilki (2 ya da daha çok fazla varsa) Masa 7, kalanlar joker
  const fazla = Math.max(0, kisi.length - 6);
  const yerler: OnayYeri[] = ["1", "2", "3", "4", "5", "6"];
  if (fazla >= 2) yerler.push("7");
  for (let k = 0; k < fazla - (fazla >= 2 ? 1 : 0); k++) yerler.push("J");
  const tur = dw === 4 ? D.cuma : D.hafici;   // Cuma ayrı, Pazartesi–Perşembe ayrı eşitlenir
  // elle kaydedilen yerler: o gün çalışan ve yeri o gün var olanlar sabit; kalan kişiler kalan yerlere dağıtılır
  const E = B.onayElle[iso(y, m, d)], sabit = new Map<number, OnayYeri>();
  if (E) {
    const kalanYer = [...yerler];
    for (const id of kisi) { const yr = E[id] as OnayYeri | undefined, i = yr ? kalanYer.indexOf(yr) : -1; if (i >= 0) { sabit.set(id, yr!); kalanYer.splice(i, 1); } }
    if (sabit.size) g.elle = true;
    yerler.length = 0; yerler.push(...kalanYer);
  }
  const serbest = kisi.filter(id => !sabit.has(id));
  const maliyet = serbest.map(id => yerler.map(yr => AGIR.sayi * (tur[id]?.[yr] || 0) + AGIR.toplam * (D.say[id]?.[yr] || 0) + (D.hafta[id]?.has(yr) ? AGIR.hafta : 0) + (D.dun[id] === yr ? AGIR.dun : 0)));
  const atama = enAzAtama(maliyet);
  for (let i = 0; i < 7; i++) g.masa[i] = { id: null, ad: "" };
  const yerOf = new Map<number, OnayYeri>(sabit);
  serbest.forEach((id, i) => yerOf.set(id, yerler[atama[i]]));
  kisi.forEach(id => {
    const yr = yerOf.get(id)!;
    if (yr === "J") g.joker.push({ id, ad: ad(id) }); else g.masa[Number(yr) - 1] = { id, ad: ad(id) };
    (D.say[id] ??= {})[yr] = (D.say[id][yr] || 0) + 1;
    (tur[id] ??= {})[yr] = (tur[id][yr] || 0) + 1;
    D.dun[id] = yr; (D.hafta[id] ??= new Set()).add(yr);
  });
  // ilk 6 masadan boş kalan: o günün hazırlama teknikerlerinden biri, yıl boyunca sırayla
  const bos = [1, 2, 3, 4, 5, 6].filter(no => !g.masa[no - 1].id);
  if (bos.length) {
    const k = B.servisKayit?.[ayAnahtari(y, m)]?.gun?.[d]?.k as number[] | undefined;
    const tek = (k?.length ? k : B.staff.filter(s => s.role === "teknisyen").map(s => s.id)).filter(id => B.kisi(id)?.role === "teknisyen" && calisiyor(id));
    g.tekAday = tek.map(id => ({ id, ad: ad(id) }));
    const sec = tek.slice().sort((a, b) => (D.tek[a] || 0) - (D.tek[b] || 0) || ad(a).localeCompare(ad(b), "tr") || a - b);
    // elle seçilen teknikerler: o gün çalışan aday ve masası o gün boşsa oturur
    if (E) for (const [k, yr] of Object.entries(E)) {
      const id = Number(k), no = Number(yr), i = sec.indexOf(id);
      if (i < 0 || !bos.includes(no)) continue;
      sec.splice(i, 1); bos.splice(bos.indexOf(no), 1);
      D.tek[id] = (D.tek[id] || 0) + 1;
      g.masa[no - 1] = { id, ad: ad(id), tekniker: true, not: "tekniker (elle)", elle: true };
      g.elle = true;
    }
    for (const no of [...bos]) {
      const id = sec.shift(); if (id === undefined) break;
      D.tek[id] = (D.tek[id] || 0) + 1;
      g.masa[no - 1] = { id, ad: ad(id), tekniker: true, not: "tekniker" };
      bos.splice(bos.indexOf(no), 1);
    }
    if (bos.length) g.uyari.push(`Masa ${bos.join(", ")} boş kaldı: o gün yeterli eczacı ve hazırlama teknikeri yok.`);
  }
  return g;
}

/** yıl başından verilen günden önceki son güne kadar dağıtımı yürütür */
function yilDurumu(B: Baglam, izgara: ReturnType<typeof izgaraOkuyucu>, y: number, m: number, d: number): Durum {
  const D = yeniDurum(), son = gunNo(y, m, d);
  let [a, b, c]: [number, number, number] = [y, 0, 1];
  while (gunNo(a, b, c) < son) {
    if (haftaGunu(a, b, c) <= 4) gunHesapla(B, izgara, a, b, c, D);
    [a, b, c] = gunKaydir(a, b, c, 1);
  }
  return D;
}

/** Pazartesi'si verilen haftanın onay listesi */
export function onayHaftasi(B: Baglam, py: number, pm: number, pd: number): OnayHaftasi {
  const izgara = izgaraOkuyucu(B), pzt = iso(py, pm, pd);
  const [ty, tm, td] = gunKaydir(py, pm, pd, 4);
  let D = yilDurumu(B, izgara, py, pm, pd), yil = py;
  const gunler: OnayGunu[] = [];
  for (let i = 0; i < 5; i++) {
    const [a, b, c] = gunKaydir(py, pm, pd, i);
    if (a !== yil) { yil = a; const dun = D.dun; D = yeniDurum(); D.dun = dun; }   // yeni yıl: sayılar baştan
    gunler.push(gunHesapla(B, izgara, a, b, c, D));
  }
  const kisiler = B.staff.filter(s => onayEczacisi(s) && (aktifGunMu(s, py, pm, pd) || aktifGunMu(s, ty, tm, td))).sort((a, b) => a.name.localeCompare(b.name, "tr"))
    .map(s => ({ id: s.id, ad: s.name, say: Object.fromEntries(ONAY_YERLERI.map(k => [k, D.say[s.id]?.[k] || 0])) as Record<OnayYeri, number>,
      cuma: Object.fromEntries(ONAY_YERLERI.map(k => [k, D.cuma[s.id]?.[k] || 0])) as Record<OnayYeri, number> }));
  return { pzt, gunler, kisiler };
}
