// Tek tek kural testleri: kullanıcının netleştirdiği kurallar (elle düzenleme denetimi üzerinden).
import { describe, test, expect } from "vitest";
import { cizelgeOlustur, gunuDenetle } from "../src/motor";
import { Baglam } from "../src/motor/baglam";
import { senaryo } from "./tarama/ortak";

const staff = [
  { id: 1, name: "E1", role: "eczaci" }, { id: 2, name: "E2", role: "eczaci" }, { id: 3, name: "E3", role: "eczaci" },
  { id: 4, name: "E4", role: "eczaci" }, { id: 5, name: "E5", role: "eczaci" }, { id: 6, name: "E6", role: "eczaci" },
  { id: 7, name: "D1", role: "nobetci" }, { id: 8, name: "D2", role: "nobetci" },
  { id: 9, name: "T1", role: "teknisyen" }, { id: 10, name: "T2", role: "teknisyen" }, { id: 11, name: "T3", role: "teknisyen" }, { id: 12, name: "T4", role: "teknisyen" },
];
const veri = { staff, prefs: {}, manualTatil: {}, arife: {}, settings: {}, schedules: {}, puantaj: {}, acil: {} };
const Y = 2026, M = 9;   // Ekim 2026: 1 Perşembe, 2 Cuma, 3 Cumartesi, 4 Pazar, 5 Pazartesi
const sch = { year: Y, month: M, days: cizelgeOlustur(veri, Y, M, { saat: () => 0 }).days };
const ikiDisaridan = gun => gunuDenetle(veri, sch, gun, [staff[6], staff[7]].map(s => ({ id: s.id, name: s.name, role: s.role })), [])
  .filter(b => b.sev === "hata" && /Dışarıdan/.test(b.t));

describe("dışarıdan gelen iki eczacı aynı gün", () => {
  test("Cuma ve Cumartesi birlikte nöbetçi olabilir", () => {
    expect(ikiDisaridan(2)).toEqual([]);
    expect(ikiDisaridan(3)).toEqual([]);
  });
  test("diğer günlerde birlikte nöbetçi olmaz", () => {
    expect(ikiDisaridan(4).length).toBe(1);
    expect(ikiDisaridan(5).length).toBe(1);
    expect(ikiDisaridan(1).length).toBe(1);
  });
});

describe("Cuma + Cumartesi + Pazar kesin kural değil", () => {
  // Ocak 2027: 5 Cuma, 5 Cumartesi, 5 Pazar; 1 Ocak resmi tatil. 7 eczacıya 15 yer düşer: herkes 1 Cuma'yı geçmesin diye
  // biri Cuma + Cumartesi + Pazar alır (eskiden bu kesin kuraldı ve yıllık Cuma eşitliği uyarısı çıkıyordu)
  const kadro = [];
  for (let i = 1; i <= 7; i++) kadro.push({ id: i, name: "E" + i, role: "eczaci" });
  for (let i = 1; i <= 7; i++) kadro.push({ id: 7 + i, name: "T" + i, role: "teknisyen" });
  for (let i = 1; i <= 3; i++) kadro.push({ id: 14 + i, name: "D" + i, role: "destek" });
  const v = { staff: kadro, prefs: {}, manualTatil: { "2027-0-1": true }, arife: {}, settings: {}, schedules: {}, puantaj: {}, acil: {} };
  test("uyarı yok; herkes en fazla 1 Cuma, 1 Cumartesi, 1 Pazar", () => {
    const r = cizelgeOlustur(v, 2027, 0, { saat: () => 0 });
    expect(r.warnings).toEqual([]);
    const gt = d => (new Date(2027, 0, d).getDay() + 6) % 7, say = {};
    r.days.forEach(g => g.assigned.forEach(p => { const o = (say[p.id] ??= [0, 0, 0]); const w = gt(g.day); if (w >= 4) o[w - 4]++; }));
    Object.values(say).forEach(o => expect(Math.max(...o)).toBeLessThanOrEqual(1));
  });
});

describe("Cuma + Cumartesi + Pazar nöbeti olan hazırlamayı grubunda en son alır", () => {
  // gerçekçi kadrolu rastgele senaryo (≥6 eczacı, ≥4 tekniker, izinler, tercihler); 49. senaryonun ilk ayında kural
  // eklenmeden önce üçlü nöbetli bir eczacı grubundaki birinden fazla hazırlama alıyordu
  test("üçlü nöbetli, grubundaki herkesten fazla hazırlama almaz", () => {
    const { y, m0, veri } = senaryo(49, { eczaci: [6, 8], teknisyen: [4, 8] });
    const r = cizelgeOlustur(veri, y, m0, { saat: () => 0 }), B = new Baglam(veri);
    const gt = d => (new Date(y, m0, d).getDay() + 6) % 7, o = {};
    veri.staff.filter(s => ["eczaci", "teknisyen", "nobetci"].includes(s.role) && r.days.some(g => g.tatil && !B.kesinYasak(s.id, y, m0, g.day)))
      .forEach(s => { o[s.id] = { g: s.role === "teknisyen" ? "T" : "E", cu: 0, ct: 0, pz: 0, h: 0 }; });
    r.days.forEach(g => { g.assigned.forEach(p => { const q = o[p.id], w = gt(g.day); if (!q) return; if (w === 4) q.cu++; if (w === 5) q.ct++; if (w === 6) q.pz++; }); g.prep.forEach(p => { if (o[p.id]) o[p.id].h++; }); });
    const uclu = q => q.cu > 0 && q.ct > 0 && q.pz > 0;
    let ucluVar = false;
    for (const g of ["E", "T"]) {
      const grup = Object.values(o).filter(q => q.g === g), diger = grup.filter(q => !uclu(q));
      if (!diger.length) continue;
      const enAz = Math.min(...diger.map(q => q.h));
      grup.filter(uclu).forEach(q => { ucluVar = true; expect(q.h).toBeLessThanOrEqual(enAz); });
    }
    expect(ucluVar, "senaryoda Cuma + Cumartesi + Pazar nöbeti olan biri bulunmalı").toBe(true);
  });
});

describe("kadro yetmezse önce hazırlama ertesi gün nöbet esner", () => {
  // 4 eczacı + 3 tekniker: hafta sonu için 8 farklı kişi gerekir, 7 kişi var. Hazırlamacı ertesi gün nöbet tutabilince
  // (Cumartesi hazırlama, Pazar nöbet) yerler dolar. Ters yön (nöbet ertesi gün hazırlama) hiç olmaz: nöbet ertesi dinlenilir.
  // Bu kural eklenmeden önce Ocak 2027'de 7 tatil gününde hazırlama eksik kalıyordu.
  const kadro = [];
  for (let i = 1; i <= 4; i++) kadro.push({ id: i, name: "E" + i, role: "eczaci" });
  for (let i = 1; i <= 3; i++) kadro.push({ id: 4 + i, name: "T" + i, role: "teknisyen" });
  const v = { staff: kadro, prefs: {}, manualTatil: {}, arife: {}, settings: {}, schedules: {}, puantaj: {}, acil: {} };
  test("eksik hazırlama azalır, nöbet ertesi hazırlama olmaz", () => {
    const r = cizelgeOlustur(v, 2027, 0, { saat: () => 0 });
    const eksik = r.days.filter(g => g.tatil && g.prep.length < 2).length;
    let duz = 0, ters = 0;
    r.days.forEach((g, i) => g.prep.forEach(p => {
      if (r.days[i + 1] && r.days[i + 1].assigned.some(q => q.id === p.id)) duz++;
      if (i > 0 && r.days[i - 1].assigned.some(q => q.id === p.id)) ters++;
    }));
    expect(ters).toBe(0);
    expect(duz).toBeGreaterThan(0);
    expect(eksik).toBeLessThan(7);
    expect(r.warnings.some(w => /hazırlamanın ertesi günü nöbet/.test(w))).toBe(true);
  });
});
