// Acil eczane nöbet listesi: her gün 2 nöbetçi (24 saat). Eczane nöbet çizelgesinden bağımsız oluşturulur; hazırlama ve
// "her gün en az bir eczacı" kuralı yoktur. Nöbet tutanlar: acil servis personeli ve Personel'de "acilde nöbet tutar"
// işaretli eczacılar (görevi eczacı kalır; günlük eczanede mesai yapar, eczane nöbeti ve hazırlaması tutmaz). Kurallar eczane nöbetindeki gibi: izinli / eş durumu yok / çalışma dönemi
// dışındaki güne yazılmaz, art arda iki gün ve 5 günde 3 nöbet olmaz, mümkünse 2 gün aradan kaçınılır, ayda en fazla bir
// Cumartesi ve bir Pazar; izin, rapor (puantaj), eş durumu ve istiyor / istemiyor tercihleri eczane nöbetindeki gibi
// (eş durumu var: o gün yazılır; istemiyor: mümkünse yazılmaz; ertesi gün izne çıkana mümkünse yazılmaz); eşitlik ayrı (yalnız acil nöbetleri) ve yıl boyunca: toplam nöbet ile Perşembe, Cuma, Cumartesi, Pazar
// ve resmi tatil nöbetleri ayrı ayrı (günlük eczanedeki gibi); herkesin payı yazılabildiği gün sayısına göredir (izinli / raporlu günler düşülür, telafi istenmez). Kişinin aynı gün ya da komşu günde eczane nöbeti / hazırlaması varsa o güne yazılmaz (iki liste çakışmaz).
// Elle düzenlenen günler korunur.
import type { Kisi } from "../veri/tipler";
import { aktifAydaMi, aktifGunMu, type Baglam } from "./baglam";
import { ayAnahtari, ayGunSayisi, AYLAR, CUMA, CUMARTESI, gunKaydir, haftaGunu, PAZAR, PERSEMBE } from "./takvim";

/** acil nöbetine yazılabilir mi: acil servis personeli ya da "acilde nöbet tutar" işaretli eczacı / kemoterapi eczacısı */
export const acilKadrosunda = (s: { role: string; acilTutar?: true }) => s.role === "servis" || ((s.role === "eczaci" || s.role === "nobetci") && !!s.acilTutar);
/** günde acil nöbetçi sayısı */
export const ACIL_GUNLUK = 2;

/** amaç ağırlıkları (küçük daha iyi) */
const W = { ardArda: 1000, ucBes: 500, eksik: 5000, hsFazla: 60, araIki: 3, toplam: 6, tur: 3, istemiyor: 20, istiyor: 1, esVar: 300, izinOnce: 200 };

export interface AcilSonucu { gunler: { gun: number; ids: number[]; elle?: true }[]; uyarilar: string[] }

/** kişinin o gün ya da komşu günde eczane nöbeti / hazırlaması var mı (gerçekte tutulana göre; ay sınırı dahil) */
export function eczaneGoreviYakin(B: Baglam, id: number, y: number, m: number, d: number): boolean {
  for (const k of [-1, 0, 1]) {
    const [a, b, c] = gunKaydir(y, m, d, k), g = B.gercekGorev(a, b, c);
    if (g.N.includes(id) || g.H.includes(id)) return true;
  }
  return false;
}
/** kişinin o gün ya da komşu günde acil nöbeti var mı (eczane çizelgesi bu günlere yazmaz) */
export function acilNobetiYakin(B: Baglam, id: number, y: number, m: number, d: number): boolean {
  for (const k of [-1, 0, 1]) {
    const [a, b, c] = gunKaydir(y, m, d, k), l = B.acil[ayAnahtari(a, b)]?.[c];
    if (l && l.includes(id)) return true;
  }
  return false;
}

/** Eşitlenen gün türleri (günlük eczanedeki gibi, her biri yıl boyunca ayrı): toplam nöbet, Perşembe, Cuma (resmi tatil
 *  olmayan), Cumartesi, Pazar, resmi tatil. */
const TURLER = ["top", "pe", "cu", "cmt", "paz", "resmi"] as const;
type Tur = (typeof TURLER)[number];
type TurSayi = Record<Tur, Record<number, number>>;
const bosTur = (): TurSayi => ({ top: {}, pe: {}, cu: {}, cmt: {}, paz: {}, resmi: {} });
/** günün girdiği türler (toplam her gün) */
function gunTurleri(B: Baglam, y: number, m: number, d: number): Tur[] {
  const dw = haftaGunu(y, m, d), resmi = B.resmiTatilMi(y, m, d), l: Tur[] = ["top"];
  if (dw === PERSEMBE && !resmi) l.push("pe");
  if (dw === CUMA && !resmi) l.push("cu");
  if (dw === CUMARTESI) l.push("cmt");
  if (dw === PAZAR) l.push("paz");
  if (resmi) l.push("resmi");
  return l;
}

/** Kişinin ayın nöbetinden payı (günlük eczanedeki gibi): her gün türünde o ay yazılabildiği gün sayısına göre. İzinli,
 *  raporlu, eş durumu yok, çalışma dönemi dışı günler kişiden düşülür; bu günler için sonradan telafi istenmez
 *  (her türde oranların toplamı 1; o türden müsait günü olmayanın payı 0). */
function acilPaylari(B: Baglam, y: number, m: number, havuz: Kisi[]): TurSayi {
  const mus = bosTur(), top: Record<string, number> = {}, pay = bosTur();
  for (const s of havuz) for (const t of TURLER) mus[t][s.id] = 0;
  for (let d = 1; d <= ayGunSayisi(y, m); d++) {
    const tl = gunTurleri(B, y, m, d);
    for (const s of havuz) {
      if (!aktifGunMu(s, y, m, d) || B.kesinYasak(s.id, y, m, d)) continue;
      for (const t of tl) { mus[t][s.id]++; top[t] = (top[t] || 0) + 1; }
    }
  }
  for (const t of TURLER) for (const s of havuz) pay[t][s.id] = top[t] ? mus[t][s.id] / top[t] : 0;
  return pay;
}

/** yılın önceki aylarından kişi başı fark, her gün türünde: tutulan acil nöbeti − o ayki payı (yazılabildiği güne göre).
 *  İzin / rapor ayları telafi ettirilmez; ay ortası başlayan / ayrılan çalıştığı gün kadar pay alır. */
function acilDevir(B: Baglam, y: number, m: number): TurSayi {
  const off = bosTur();
  for (let mm = 0; mm < m; mm++) {
    const kayit = B.acil[ayAnahtari(y, mm)]; if (!kayit) continue;
    const havuz = B.staff.filter(s => acilKadrosunda(s) && aktifAydaMi(s, y, mm)); if (!havuz.length) continue;
    const c = bosTur(), T: Record<string, number> = {};
    for (const t of TURLER) havuz.forEach(s => { c[t][s.id] = 0; });
    for (const [gun, l] of Object.entries(kayit)) {
      const tl = gunTurleri(B, y, mm, Number(gun));
      l.forEach(id => { if (c.top[id] === undefined) return; for (const t of tl) { c[t][id]++; T[t] = (T[t] || 0) + 1; } });
    }
    const pay = acilPaylari(B, y, mm, havuz);
    for (const t of TURLER) havuz.forEach(s => { off[t][s.id] = (off[t][s.id] || 0) + c[t][s.id] - (T[t] || 0) * pay[t][s.id]; });
  }
  return off;
}

/** Ayın acil nöbet listesini oluşturur (aynı veriyle her zaman aynı sonuç). elle: elle düzenlenen günler (korunur). */
export function acilOlustur(B: Baglam, y: number, m: number, elle: Record<string, true> = {}): AcilSonucu {
  const dim = ayGunSayisi(y, m), uyarilar: string[] = [], kayit = B.acil[ayAnahtari(y, m)] || {};
  const havuz = B.staff.filter(s => acilKadrosunda(s) && aktifAydaMi(s, y, m));
  const devir = acilDevir(B, y, m), pay = acilPaylari(B, y, m, havuz);
  // ay sınırı: önceki ayın son 4 günü ve sonraki ayın ilk 4 günündeki acil nöbetleri (art arda / 5 günde 3 için)
  const disGun: Record<number, number[]> = {};
  for (const k of [-3, -2, -1, 0, dim + 1, dim + 2, dim + 3, dim + 4]) {
    const [a, b, c] = gunKaydir(y, m, 1, k - 1);
    disGun[k] = B.acil[ayAnahtari(a, b)]?.[c] || [];
  }
  const aday: number[][] = [], sabit: boolean[] = [], sec: number[][] = [];
  for (let d = 1; d <= dim; d++) {
    const ca = havuz.filter(s => !B.kesinYasak(s.id, y, m, d) && !eczaneGoreviYakin(B, s.id, y, m, d)).map(s => s.id);
    aday.push(ca);
    if (elle[d]) { sabit.push(true); sec.push((kayit[d] || []).slice()); continue; }
    sabit.push(false); sec.push([]);
    if (ca.length < ACIL_GUNLUK) uyarilar.push(d + " " + AYLAR[m] + ": acil nöbeti için " + ACIL_GUNLUK + " kişi gerekli, yazılabilen " + ca.length + " kişi var (izin ya da aynı / komşu günde eczane nöbeti).");
  }
  const dw = Array.from({ length: dim }, (_, i) => haftaGunu(y, m, i + 1)), turler = Array.from({ length: dim }, (_, i) => gunTurleri(B, y, m, i + 1));
  const tercih = (id: number, i: number) => B.tercih(id, y, m, i + 1);
  // ertesi gün izne çıkana nöbet yazılmaz (nöbet ertesi izni izne denk gelir); başka kimse yoksa yazılır
  const izinOnce = Array.from({ length: dim }, (_, i) => new Set(havuz.filter(s => B.izinOncesiMi(s.id, y, m, i + 1)).map(s => s.id)));
  const var_ = (id: number, d: number) => (d >= 1 && d <= dim ? sec[d - 1].includes(id) : (disGun[d] || []).includes(id));
  const J = (): number => {
    let j = 0;
    const say = bosTur(), cmt: Record<number, number> = {}, paz: Record<number, number> = {};
    for (let i = 0; i < dim; i++) {
      if (!sabit[i]) j += W.eksik * Math.max(0, Math.min(ACIL_GUNLUK, aday[i].length) - sec[i].length);
      const d = i + 1;
      for (const id of sec[i]) {
        for (const t of turler[i]) say[t][id] = (say[t][id] || 0) + 1;
        if (dw[i] === CUMARTESI) cmt[id] = (cmt[id] || 0) + 1;
        if (dw[i] === PAZAR) paz[id] = (paz[id] || 0) + 1;
        // ileriye bakan çiftler bir kez sayılır; ay başında önceki ayla olanlar da
        if (var_(id, d + 1)) j += W.ardArda;
        if (var_(id, d + 2)) j += W.araIki;
        if (var_(id, d + 2) && var_(id, d + 4)) j += W.ucBes;
        if (d === 1 && var_(id, 0)) j += W.ardArda;
        if (d <= 2 && var_(id, d - 2)) j += W.araIki;
        if (d <= 4 && var_(id, d - 2) && var_(id, d - 4)) j += W.ucBes;
        if (d <= 2 && var_(id, d - 2) && var_(id, d + 2)) j += W.ucBes;
        const t = tercih(id, i);
        if (t === "avoid") j += W.istemiyor; else if (t === "want") j -= W.istiyor;
        if (izinOnce[i].has(id)) j += W.izinOnce;
      }
      for (const id of aday[i]) if (tercih(id, i) === "esVar" && !sec[i].includes(id)) j += W.esVar;
    }
    // bu ayın payı da yazılabildiği güne göre: izinli / raporlu olan o ay daha az alır, sonra telafi etmez
    for (const t of TURLER) {
      let N = 0;
      for (const s of havuz) N += say[t][s.id] || 0;
      const w = t === "top" ? W.toplam : W.tur;
      for (const s of havuz) { const a = (say[t][s.id] || 0) - N * pay[t][s.id] + (devir[t][s.id] || 0); j += w * a * a; }
    }
    for (const s of havuz) {
      if ((cmt[s.id] || 0) > 1) j += W.hsFazla * ((cmt[s.id] || 0) - 1);
      if ((paz[s.id] || 0) > 1) j += W.hsFazla * ((paz[s.id] || 0) - 1);
    }
    return j;
  };
  // açgözlü başlangıç, sonra yerel arama (bir yeri değiştir / iki günün kişilerini takas et)
  for (let i = 0; i < dim; i++) {
    if (sabit[i]) continue;
    while (sec[i].length < Math.min(ACIL_GUNLUK, aday[i].length)) {
      let en = -1, enJ = Infinity;
      for (const id of aday[i]) { if (sec[i].includes(id)) continue; sec[i].push(id); const v = J(); sec[i].pop(); if (v < enJ - 1e-9) { enJ = v; en = id; } }
      if (en < 0) break;
      sec[i].push(en);
    }
  }
  let cur = J();
  for (let tur = 0; tur < 60; tur++) {
    let iyi = false;
    for (let i = 0; i < dim; i++) {
      if (sabit[i]) continue;
      for (let q = 0; q < sec[i].length; q++) for (const id of aday[i]) {
        if (sec[i].includes(id)) continue;
        const eski = sec[i][q]; sec[i][q] = id; const v = J();
        if (v < cur - 1e-9) { cur = v; iyi = true; } else sec[i][q] = eski;
      }
    }
    for (let i = 0; i < dim; i++) for (let k = i + 1; k < dim; k++) {
      if (sabit[i] || sabit[k]) continue;
      for (let a = 0; a < sec[i].length; a++) for (let b = 0; b < sec[k].length; b++) {
        const p = sec[i][a], r = sec[k][b];
        if (p === r || sec[k].includes(p) || sec[i].includes(r) || !aday[k].includes(p) || !aday[i].includes(r)) continue;
        sec[i][a] = r; sec[k][b] = p; const v = J();
        if (v < cur - 1e-9) { cur = v; iyi = true; } else { sec[i][a] = p; sec[k][b] = r; }
      }
    }
    // kuyruk takası: iki kişinin d gününden sonraki tüm nöbetleri yer değiştirir (aralar korunur; sıkışık dönüşümde
    // tek yer değişikliği hep art arda nöbet doğurduğu için eşitlik ancak böyle düzelir)
    for (let a = 0; a < havuz.length; a++) for (let b = a + 1; b < havuz.length; b++) {
      const p = havuz[a].id, r = havuz[b].id;
      for (let d0 = 0; d0 < dim; d0++) {
        const degisen: number[] = [];
        let olur = true;
        for (let i = d0; i < dim && olur; i++) {
          if (sabit[i]) continue;
          const vp = sec[i].includes(p), vr = sec[i].includes(r);
          if (vp === vr) continue;
          if ((vp && !aday[i].includes(r)) || (vr && !aday[i].includes(p))) olur = false; else degisen.push(i);
        }
        if (!olur || !degisen.length) continue;
        const takas = () => degisen.forEach(i => { sec[i] = sec[i].map(x => (x === p ? r : x === r ? p : x)); });
        takas(); const v = J();
        if (v < cur - 1e-9) { cur = v; iyi = true; } else takas();
      }
    }
    if (!iyi) break;
  }
  // personel yetmediği için kalan art arda nöbetler ve karşılanamayan eş durumu / istemiyor bildirilir
  const ad = (id: number) => B.kisi(id)?.name ?? "";
  for (let i = 0; i < dim; i++) {
    if (sabit[i]) continue;
    for (const id of aday[i]) if (tercih(id, i) === "esVar" && !sec[i].includes(id)) uyarilar.push((i + 1) + " " + AYLAR[m] + ": " + ad(id) + " için eş durumu isteği acil listesinde karşılanamadı.");
    for (const id of sec[i]) if (tercih(id, i) === "avoid") uyarilar.push((i + 1) + " " + AYLAR[m] + ": " + ad(id) + " nöbet istemiyordu, başka uygun kişi olmadığı için yazıldı.");
  }
  const artArda: string[] = [];
  for (let i = 0; i < dim; i++) for (const id of sec[i]) {
    if (var_(id, i + 2)) artArda.push(ad(id) + ": " + (i + 1) + " ve " + (i + 2) + " " + AYLAR[m] + " art arda acil nöbeti (personel yetmiyor).");
  }
  // çok sayıda art arda nöbet kadronun yetmediğini gösterir: tek tek yerine tek satır
  if (artArda.length > 5) uyarilar.push(AYLAR[m] + ": acil kadrosu yetmiyor; " + artArda.length + " kez art arda acil nöbeti yazıldı (günde " + ACIL_GUNLUK + " kişi için art arda gün olmadan en az " + 2 * ACIL_GUNLUK + " kişi gerekir).");
  else uyarilar.push(...artArda);
  return { gunler: sec.map((ids, i) => ({ gun: i + 1, ids: sabit[i] ? ids : ids.slice().sort((a, b) => a - b), ...(sabit[i] ? { elle: true as const } : {}) })), uyarilar };
}
