// Acil eczane nöbet listesi: günde 2 kişi; acil servis eczacıları ve "acilde de nöbet tutar" işaretli eczacılar;
// eczane çizelgesiyle çakışmaz (aynı / komşu gün); art arda gün yok; eşitlik ayrı ve yıl boyunca; elle günler korunur.
import { describe, test, expect } from "vitest";
import { acilHesapla, cizelgeOlustur, gunuDenetle } from "../src/motor";

const staff = [];
for (let i = 1; i <= 7; i++) staff.push({ id: i, name: "E" + i, role: "eczaci", ...(i <= 2 ? { acilTutar: true } : {}) });
for (let i = 1; i <= 5; i++) staff.push({ id: 7 + i, name: "T" + i, role: "teknisyen" });
for (let i = 1; i <= 4; i++) staff.push({ id: 12 + i, name: "A" + i, role: "servis" });
const Y = 2026, M = 10, dim = 30;
const veri = { staff, prefs: { [`13-${Y}-${M}-10`]: "izinli" }, manualTatil: {}, arife: {}, settings: {}, schedules: {}, puantaj: {}, acil: {}, acilElle: {} };
// eczane çizelgesi olan hâli (çakışma denetimi için); eşitlik testleri acil önce oluşturulmuş gibi (eczane çizelgesi yok)
const eczaneli = JSON.parse(JSON.stringify(veri));
eczaneli.schedules[`${Y}-${M}`] = { year: Y, month: M, days: cizelgeOlustur(eczaneli, Y, M, { saat: () => 0 }).days };
const fark = v => Math.max(...v) - Math.min(...v);
const kaydet = (v, m, r) => { v.acil[`${Y}-${m}`] = Object.fromEntries(r.gunler.map(g => [g.gun, g.ids])); };

describe("acil eczane nöbet listesi", () => {
  const r = acilHesapla(veri, Y, M);
  const kadro = [1, 2, 13, 14, 15, 16];
  const sch = eczaneli.schedules[`${Y}-${M}`].days, re = acilHesapla(eczaneli, Y, M);

  test("her gün 2 kişi, yalnız acil kadrosundan; izinli güne yazılmaz", () => {
    expect(r.gunler.length).toBe(dim);
    r.gunler.forEach(g => { expect(g.ids.length).toBe(2); g.ids.forEach(id => expect(kadro).toContain(id)); });
    expect(r.gunler[9].ids).not.toContain(13);
    expect(r.uyarilar).toEqual([]);
  });

  test("art arda gün yok; eczane görevli eczacı aynı / komşu günde acile yazılmaz", () => {
    r.gunler.forEach((g, i) => { if (i > 0) g.ids.forEach(id => expect(r.gunler[i - 1].ids).not.toContain(id)); });
    for (const id of [1, 2]) re.gunler.forEach((g, i) => {
      if (!g.ids.includes(id)) return;
      for (const k of [i - 1, i, i + 1]) if (sch[k]) expect([...sch[k].assigned, ...sch[k].prep].map(p => p.id)).not.toContain(id);
    });
  });

  test("eşitlik: acil nöbet sayıları kadro içinde en fazla 1 fark", () => {
    const n = {}; kadro.forEach(id => { n[id] = 0; });
    r.gunler.forEach(g => g.ids.forEach(id => n[id]++));
    expect(fark(Object.values(n))).toBeLessThanOrEqual(1);
  });

  test("elle düzenlenen gün korunur; aynı veriyle aynı sonuç", () => {
    const v = JSON.parse(JSON.stringify(veri));
    v.acil[`${Y}-${M}`] = { 5: [13, 14] }; v.acilElle[`${Y}-${M}`] = { 5: true };
    const r2 = acilHesapla(v, Y, M);
    expect(r2.gunler[4].ids).toEqual([13, 14]);
    expect(JSON.stringify(acilHesapla(v, Y, M))).toBe(JSON.stringify(r2));
  });

  test("acil nöbeti önce varsa eczane çizelgesi o kişiyi aynı / komşu güne yazmaz", () => {
    const v = JSON.parse(JSON.stringify(veri));
    v.acil[`${Y}-${M}`] = { 6: [1, 13], 12: [2, 14], 20: [1, 15] };
    const days = cizelgeOlustur(v, Y, M, { saat: () => 0 }).days;
    for (const [d, id] of [[6, 1], [12, 2], [20, 1]]) for (const k of [d - 2, d - 1, d]) {
      expect([...days[k].assigned, ...days[k].prep].map(p => p.id)).not.toContain(id);
    }
    // elle düzenlemede de uyarı
    const s = { year: Y, month: M, days };
    const b = gunuDenetle(v, s, 6, [{ id: 1, name: "E1", role: "eczaci" }, { id: 8, name: "T1", role: "teknisyen" }], []);
    expect(b.some(x => /acil eczane nöbetçisi/.test(x.t))).toBe(true);
  });

  test("yıl boyu eşitlik: iki ayın toplamı en fazla 1 fark", () => {
    const v = JSON.parse(JSON.stringify(veri));
    kaydet(v, M, acilHesapla(v, Y, M));
    const r2 = acilHesapla(v, Y, M + 1);
    const n = {}; kadro.forEach(id => { n[id] = 0; });
    [...r.gunler, ...r2.gunler].forEach(g => g.ids.forEach(id => n[id]++));
    expect(fark(Object.values(n))).toBeLessThanOrEqual(1);
  });
});
