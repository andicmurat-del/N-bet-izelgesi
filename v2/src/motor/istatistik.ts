// Bir ayın çizelgesinden sayımlar: kişi başı fazla mesai, gün türleri, hafta sonu kuralı, yıllık gün türü sayıları.
import { aktifAydaMi, aktifGunMu, nobetciRol, yillikEsitRol, type Baglam, type MotorCizelgesi, type MotorGunu } from "./baglam";
import type { YilGunTipi } from "./sabitler";
import { ayGunSayisi, CUMA, CUMARTESI, haftaGunu, PAZAR, PERSEMBE } from "./takvim";

/** fazla mesai kuralına giren kişiler: ayın tamamında çalışan eczacı, tekniker ve dışarıdan gelen eczacı */
export function fmKuralKisileri(B: Baglam, y: number, m: number) {
  const dim = ayGunSayisi(y, m);
  return B.staff.filter(s => nobetciRol(s.role) && aktifGunMu(s, y, m, 1) && aktifGunMu(s, y, m, dim));
}

/** günlere göre kişi başı aylık fazla mesai (nöbet + hazırlama saatleri) */
export function ayFmTablosu(B: Baglam, days: MotorGunu[]): Record<number, number> {
  const hz = B.sayi("hazSaat"), t: Record<number, number> = {};
  days.forEach(g => {
    (g.assigned || []).forEach(p => { t[p.id] = (t[p.id] || 0) + (g.fazlaMesai || 0); });
    (g.prep || []).forEach(p => { t[p.id] = (t[p.id] || 0) + hz; });
  });
  return t;
}

export function fmFarkBilgisi(B: Baglam, y: number, m: number, days: MotorGunu[]) {
  const t = ayFmTablosu(B, days), k = fmKuralKisileri(B, y, m);
  if (k.length < 2) return { fark: 0, kisiler: k, t };
  let enAz = k[0], enCok = k[0];
  k.forEach(s => { if ((t[s.id] || 0) < (t[enAz.id] || 0)) enAz = s; if ((t[s.id] || 0) > (t[enCok.id] || 0)) enCok = s; });
  return { fark: (t[enCok.id] || 0) - (t[enAz.id] || 0), enAz, enCok, t, kisiler: k };
}

/** kişinin ay içindeki Cuma / Cumartesi / Pazar nöbet sayıları */
export function hsSayilari(y: number, m: number, days: { day: number; assigned: { id: number }[] }[], id: number) {
  const r = { cu: 0, cmt: 0, paz: 0 };
  days.forEach(g => {
    if (!(g.assigned || []).some(p => p.id === id)) return;
    const w = haftaGunu(y, m, g.day);
    if (w === CUMA) r.cu++; else if (w === CUMARTESI) r.cmt++; else if (w === PAZAR) r.paz++;
  });
  return r;
}
/** hafta sonu kuralı: ayda en fazla 1 Cumartesi, 1 Pazar; Cuma + Cumartesi + Pazar üçü birden olmaz */
export function hsKuralIhlali(r: { cu: number; cmt: number; paz: number }): string[] {
  const o: string[] = [];
  if (r.cmt > 1) o.push(r.cmt + " Cumartesi");
  if (r.paz > 1) o.push(r.paz + " Pazar");
  if (r.cu > 0 && r.cmt > 0 && r.paz > 0) o.push("Cuma + Cumartesi + Pazar");
  return o;
}

export interface AyIstatistigi { fm: number; thu: number; sat: number; sun: number; cum: number; nobet: number; prep: number }
/** ayın çizelgesinden kişi başı fazla mesai, nöbet, hazırlama ve gün türü sayıları */
export function ayIstatistik(B: Baglam, sch: MotorCizelgesi): Record<number, AyIstatistigi> {
  const r: Record<number, AyIstatistigi> = {};
  const dim = ayGunSayisi(sch.year, sch.month);
  const yeni = (): AyIstatistigi => ({ fm: 0, thu: 0, sat: 0, sun: 0, cum: 0, nobet: 0, prep: 0 });
  sch.days.forEach(d => {
    const fmGun = B.fazlaMesai(sch.year, sch.month, d.day, dim);
    const dw = haftaGunu(sch.year, sch.month, d.day);
    d.assigned.forEach(p => {
      const x = r[p.id] || (r[p.id] = yeni());
      x.fm += fmGun; x.nobet++;
      if (dw === PERSEMBE) x.thu++; if (dw === CUMA) x.cum++; if (dw === CUMARTESI) x.sat++; if (dw === PAZAR) x.sun++;
    });
    (d.prep || []).forEach(pp => {
      const x = r[pp.id] || (r[pp.id] = yeni());
      x.fm += B.sayi("hazSaat"); x.prep++;
    });
  });
  return r;
}
export function ayVeriVarMi(sch: { days: { assigned: unknown[] }[] }): boolean { return sch.days.some(d => d.assigned.length > 0); }

type GunTipiSayilari = Record<YilGunTipi, number>;
/** Yıl içinde kişi başı Perşembe / Cuma / Cumartesi / Pazar / resmi tatil NÖBET sayıları (Ocak'tan m. aya kadar; curDays
 *  verilirse m. ayın günleri de eklenir). Kural: herkes birini almadan kimse ikincisini almasın (fark en fazla 1).
 *  Dönüş: kişi başı ekip ortalamasına göre fark (yalnız kişinin çalıştığı aylar; yeni başlayan personel önceki aylar için
 *  borçlu sayılmaz) ve ham sayılar (ham). */
export function yilGunSayilari(B: Baglam, y: number, m: number, curDays: MotorGunu[] | null) {
  const r: Record<number, GunTipiSayilari & { ham: GunTipiSayilari }> = {};
  const T: YilGunTipi[] = ["pe", "cu", "cmt", "paz", "rt"];
  const sifir = (): GunTipiSayilari => ({ pe: 0, cu: 0, cmt: 0, paz: 0, rt: 0 });
  const kayit = (id: number) => r[id] || (r[id] = { ...sifir(), ham: sifir() });
  const ay = (mm: number, gunler: MotorGunu[]) => {
    const hv = B.staff.filter(s => yillikEsitRol(s.role) && aktifAydaMi(s, y, mm)); if (!hv.length) return;
    const c: Record<number, GunTipiSayilari> = {}; hv.forEach(s => { c[s.id] = sifir(); });
    gunler.forEach(d => {
      if (!d) return;
      const dw = haftaGunu(y, mm, d.day), rt = B.resmiTatilMi(y, mm, d.day);
      (d.assigned || []).forEach(p => {
        const o = c[p.id]; if (!o) return;
        if (dw === PERSEMBE) o.pe++; else if (dw === CUMA) o.cu++; else if (dw === CUMARTESI) o.cmt++; else if (dw === PAZAR) o.paz++;
        if (rt) o.rt++;
      });
    });
    T.forEach(t => {
      const ort = hv.reduce((a, s) => a + c[s.id][t], 0) / hv.length;
      hv.forEach(s => { const o = kayit(s.id); o[t] += c[s.id][t] - ort; o.ham[t] += c[s.id][t]; });
    });
  };
  for (let mm = 0; mm < m; mm++) { const sc = B.cizelge(y, mm); if (sc && Array.isArray(sc.days)) ay(mm, sc.days); }
  if (curDays) ay(m, curDays);
  return r;
}
