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
