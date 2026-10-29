// Tek tek kural testleri: kullanıcının netleştirdiği kurallar (elle düzenleme denetimi üzerinden).
import { describe, test, expect } from "vitest";
import { cizelgeOlustur, gunuDenetle } from "../src/motor";

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
