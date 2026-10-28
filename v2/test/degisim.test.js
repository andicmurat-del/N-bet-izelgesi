// Puantaj değişim denetimi ve yerine geçecek aday önerisi (eski uygulamadan taşınan kurallar).
import { describe, test, expect } from "vitest";
import { cizelgeOlustur, degisimDenetle, yerineAdaylarHesapla, puantajHesapla } from "../src/motor/cizelge.js";

const adlar = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
const veri = {
  staff: adlar.map((name, i) => ({ id: i + 1, name, role: i < 6 ? "eczaci" : "teknisyen" })),
  prefs: {}, manualTatil: {}, arife: {}, settings: {}, schedules: {}, puantaj: {}, acil: {},
};
const Y = 2026, M = 9;
veri.schedules[`${Y}-${M}`] = { year: Y, month: M, days: cizelgeOlustur(veri, Y, M, { saat: () => 0 }).days };
const gun = veri.schedules[`${Y}-${M}`].days[4];
const cik = gun.assigned[0].id;

describe("nöbet değişimi", () => {
  test("adaylar: kural dışı olmayanlar önce, çıkan kişi ve o gün nöbetçi olan aday değil", () => {
    const l = yerineAdaylarHesapla(veri, Y, M, 5, cik, "N");
    expect(l.length).toBeGreaterThan(0);
    expect(l.some(a => a.id === cik || gun.assigned.some(p => p.id === a.id))).toBe(false);
    const ilkEngelli = l.findIndex(a => a.engel > 0);
    if (ilkEngelli >= 0) expect(l.slice(ilkEngelli).every(a => a.engel > 0)).toBe(true);
  });

  test("ertesi gün nöbetçi olan kişiye devir art arda nöbet sayılır", () => {
    const ertesi = veri.schedules[`${Y}-${M}`].days[5].assigned.find(p => p.id !== cik);
    const k = degisimDenetle(veri, { y: Y, m: M, gorev: "N", tur: "devir", gun: 5, cik, yer: ertesi.id });
    expect(k.engel.some(t => t.includes("art arda"))).toBe(true);
  });

  test("denetim asıl veriyi değiştirmez", () => {
    const once = JSON.stringify(veri);
    degisimDenetle(veri, { y: Y, m: M, gorev: "N", tur: "devir", gun: 5, cik, yer: yerineAdaylarHesapla(veri, Y, M, 5, cik, "N")[0].id });
    expect(JSON.stringify(veri)).toBe(once);
  });

  test("raporlu kişi aday olmaz", () => {
    const aday = yerineAdaylarHesapla(veri, Y, M, 5, cik, "N")[0].id;
    const v = { ...veri, puantaj: { [`${Y}-${M}`]: { [aday]: { 5: "R" } } } };
    expect(yerineAdaylarHesapla(v, Y, M, 5, cik, "N").some(a => a.id === aday)).toBe(false);
    expect(puantajHesapla(v, Y, M).satirlar.find(r => r.s.id === aday).cells[4].kod).toBe("R");
  });
});
