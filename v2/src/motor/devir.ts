// Yıllık devir: aynı yılın önceki aylarının çizelgelerinden kişi başı "payına göre fazla / eksik" sayıları.
// Bu ayın çizelgesi önceki ayların farkını kapatacak şekilde aranır. Her takvim yılı kendi içinde değerlendirilir:
// önceki yılların nöbetleri yeni yılı bağlamaz, Ocak'ta sayım sıfırdan başlar.
import { aktifAydaMi, aktifGunMu, hazirlamaRol, nobetciRol, yillikEsitRol, type Baglam } from "./baglam";
import { ayIstatistik, ayVeriVarMi, type AyIstatistigi } from "./istatistik";
import { CUMARTESI, haftaGunu, haftaSonuMu, PAZAR, PERSEMBE } from "./takvim";

export type Fark = Record<number, number>;

/** Bir gün türünün (hafta sonu, Cuma, Perşembe…) önceki aylardaki dağılımı: her ay, kişinin o türden müsait olduğu
 *  gün sayısına göre düşen payından farkı toplanır. */
function gunTipiDevir(B: Baglam, y: number, m: number, tipMi: (y: number, m: number, d: number) => boolean): Fark {
  const off: Fark = {};
  for (let mm = 0; mm < m; mm++) {
    const sc = B.cizelge(y, mm); if (!sc || !Array.isArray(sc.days)) continue;
    const gunler = sc.days.filter(d => d && tipMi(y, mm, d.day));
    if (!gunler.length) continue;
    const hv = B.staff.filter(s => yillikEsitRol(s.role) && aktifAydaMi(s, y, mm));
    if (!hv.length) continue;
    const say: Fark = {}, mus: Fark = {}; let top = 0, musTop = 0;
    hv.forEach(s => { say[s.id] = 0; mus[s.id] = 0; });
    gunler.forEach(d => {
      (d.assigned || []).forEach(p => { if (say[p.id] !== undefined) { say[p.id]++; top++; } });
      hv.forEach(s => { if (aktifGunMu(s, y, mm, d.day) && !B.kesinYasak(s.id, y, mm, d.day)) { mus[s.id]++; musTop++; } });
    });
    if (!musTop) continue;
    hv.forEach(s => { off[s.id] = (off[s.id] || 0) + say[s.id] - top * mus[s.id] / musTop; });
  }
  return off;
}
/** Cumartesi + Pazar nöbetleri */
export const hsDevir = (B: Baglam, y: number, m: number) => gunTipiDevir(B, y, m, haftaSonuMu);
/** Cuma nöbetleri (Cuma resmi tatil değilse) */
export const cuDevir = (B: Baglam, y: number, m: number) => gunTipiDevir(B, y, m, (a, b, c) => B.cumaTipiMi(a, b, c));
/** Cumartesi (24 saat) ve Pazar (16 saat) nöbetleri ayrı ayrı da yıl içinde eşit paylaşılır */
export const cmtDevir = (B: Baglam, y: number, m: number) => gunTipiDevir(B, y, m, (a, b, c) => haftaGunu(a, b, c) === CUMARTESI);
export const pazDevir = (B: Baglam, y: number, m: number) => gunTipiDevir(B, y, m, (a, b, c) => haftaGunu(a, b, c) === PAZAR);
/** Perşembe nöbetleri (Perşembe nöbetçisinin hafta sonu boş kaldığından tek kişide toplanmasın) */
export const peDevir = (B: Baglam, y: number, m: number) => gunTipiDevir(B, y, m, (a, b, c) => haftaGunu(a, b, c) === PERSEMBE);

/** Yıllık nöbet sayısı: önceki aylarda tutulan nöbet sayısının o ayın nöbetçi ortalamasından farkı (fazla mesai gibi
 *  izinden bağımsız: izin mesai sayıldığından herkesten eşit pay beklenir). */
export function nobetDevir(B: Baglam, y: number, m: number): Fark {
  const off: Fark = {};
  for (let mm = 0; mm < m; mm++) {
    const sc = B.cizelge(y, mm); if (!sc || !Array.isArray(sc.days)) continue;
    const hv = B.staff.filter(s => yillikEsitRol(s.role) && aktifAydaMi(s, y, mm)); if (!hv.length) continue;
    const c: Fark = {}; hv.forEach(s => { c[s.id] = 0; });
    sc.days.forEach(d => { (d.assigned || []).forEach(p => { if (c[p.id] !== undefined) c[p.id]++; }); });
    const ort = hv.reduce((t, s) => t + c[s.id], 0) / hv.length;
    hv.forEach(s => { off[s.id] = (off[s.id] || 0) + c[s.id] - ort; });
  }
  return off;
}

/** Resmi tatil görevleri: nöbet (off) ve hazırlama (offH) ayrı ayrı; say/sayH ham sayılar.
 *  Her havuz kendi içinde: nöbetçiler (nöbet), eczacı/tekniker (hazırlama), destek personeli (hazırlama). */
export function resmiDevir(B: Baglam, y: number, m: number) {
  const off: Fark = {}, say: Fark = {}, offH: Fark = {}, sayH: Fark = {};
  for (let mm = 0; mm < m; mm++) {
    const sc = B.cizelge(y, mm); if (!sc || !Array.isArray(sc.days)) continue;
    const rg = sc.days.filter(d => d && B.resmiTatilMi(y, mm, d.day)); if (!rg.length) continue;
    const cN: Fark = {}, cH: Fark = {};
    rg.forEach(d => {
      (d.assigned || []).forEach(p => { cN[p.id] = (cN[p.id] || 0) + 1; });
      (d.prep || []).forEach(p => { cH[p.id] = (cH[p.id] || 0) + 1; });
    });
    const havuzlar: [typeof B.staff, Fark, Fark, Fark][] = [
      [B.staff.filter(s => nobetciRol(s.role) && aktifAydaMi(s, y, mm)), cN, off, say],
      [B.staff.filter(s => hazirlamaRol(s.role) && aktifAydaMi(s, y, mm)), cH, offH, sayH],
      [B.staff.filter(s => s.role === "destek" && aktifAydaMi(s, y, mm)), cH, offH, sayH],
    ];
    havuzlar.forEach(([hv, c, o, sy]) => {
      if (!hv.length) return;
      const ort = hv.reduce((t, s) => t + (c[s.id] || 0), 0) / hv.length;
      hv.forEach(s => { o[s.id] = (o[s.id] || 0) + (c[s.id] || 0) - ort; sy[s.id] = (sy[s.id] || 0) + (c[s.id] || 0); });
    });
  }
  return { off, say, offH, sayH };
}

export interface AyDevri {
  /** kişi başı devreden fazla mesai (ortalamaya göre fark) */
  off: Fark;
  /** kişi başı devreden hazırlama sayısı */
  prepOff: Fark;
  /** hemen önceki ayın Perşembe / Cumartesi / Pazar nöbet sayıları */
  prev: Record<number, { thu: number; sat: number; sun: number }>;
  havePrev: boolean;
}
/** Önceki aylardan kişi başı devreden fazla mesai ve hazırlama, hemen önceki ayın Perşembe/Cumartesi/Pazar bilgisi.
 *  Aylık sapma yöntemi: her geçmiş ayda, o ay çalışan kişilerin ortalamasına göre sapma toplanır. Böylece sonradan
 *  gelen ya da ayrılan personel eski aylar için "eksik/fazla" sayılmaz; sadece çalıştığı aylardaki yük farkı telafi edilir. */
export function devirHesapla(B: Baglam, y: number, m: number): AyDevri {
  const cur = y * 12 + m;
  const aylar: { idx: number; y: number; m: number; st: Record<number, AyIstatistigi> }[] = [];
  Object.keys(B.schedules || {}).forEach(k => {
    const sch = B.schedules[k];
    if (!sch || !ayVeriVarMi(sch)) return;
    const idx = sch.year * 12 + sch.month;
    if (idx >= cur || sch.year !== y) return;
    aylar.push({ idx, y: sch.year, m: sch.month, st: ayIstatistik(B, sch) });
  });
  aylar.sort((a, b) => a.idx - b.idx);
  // kişinin ilk görüldüğü ay: işe başlama tarihi girilmemiş kişi bundan önceki aylar için borçlu sayılmaz
  const ilkGorulen: Record<number, number> = {};
  aylar.forEach(a => { Object.keys(a.st).forEach(id => { const n = Number(id); if (ilkGorulen[n] === undefined) ilkGorulen[n] = a.idx; }); });
  const varMi = (st: (typeof B.staff)[number], a: (typeof aylar)[number]) => {
    if (!aktifAydaMi(st, a.y, a.m)) return false;
    if (st.baslangic) return true;
    return ilkGorulen[st.id] !== undefined && a.idx >= ilkGorulen[st.id];
  };
  const sapma: Fark = {}, prepSapma: Fark = {};
  let oncekiAy: Record<number, AyIstatistigi> | null = null;
  aylar.forEach(a => {
    const duty = B.staff.filter(s => nobetciRol(s.role) && varMi(s, a));
    if (duty.length) {
      const v = duty.map(s => (a.st[s.id] || { fm: 0 }).fm), ort = v.reduce((x, z) => x + z, 0) / duty.length;
      duty.forEach((s, i) => { sapma[s.id] = (sapma[s.id] || 0) + (v[i] - ort); });
    }
    [B.staff.filter(s => hazirlamaRol(s.role) && varMi(s, a)), B.staff.filter(s => s.role === "destek" && varMi(s, a))].forEach(h => {
      if (!h.length) return;
      const v = h.map(s => (a.st[s.id] || { prep: 0 }).prep), ort = v.reduce((x, z) => x + z, 0) / h.length;
      h.forEach((s, i) => { prepSapma[s.id] = (prepSapma[s.id] || 0) + (v[i] - ort); });
    });
    if (a.idx === cur - 1) oncekiAy = a.st;
  });
  const off: Fark = {}, prepOff: Fark = {};
  B.staff.forEach(s => { off[s.id] = sapma[s.id] || 0; prepOff[s.id] = prepSapma[s.id] || 0; });
  const prev: AyDevri["prev"] = {};
  const onceki = oncekiAy as Record<number, AyIstatistigi> | null;
  B.staff.filter(s => nobetciRol(s.role)).forEach(s => { prev[s.id] = onceki && onceki[s.id] ? onceki[s.id] : { thu: 0, sat: 0, sun: 0 }; });
  return { off, prepOff, prev, havePrev: !!onceki };
}
