// Onay listesi masaları: sabit sıra yok, yerler her gün dağıtılır. Kimse önceki çalıştığı gün oturduğu yere oturmaz;
// yıl boyunca herkes her masaya eşit oturur. 7. kişi joker, 8+ kişide fazlalardan ilki Masa 7; ilk 6 masa dolmazsa
// hazırlama teknikeri (yıl boyunca sırayla); resmi tatilde liste yok.
import { describe, test, expect } from "vitest";
import { onayHaftasiHesapla } from "../src/motor";
import { enAzAtama } from "../src/motor/onayMasa";

const staff = [];
for (let i = 1; i <= 9; i++) staff.push({ id: i, name: "E" + i, role: "eczaci", ...(i === 9 ? { acilTutar: true } : {}) });
staff.push({ id: 10, name: "K1", role: "nobetci" });
for (let i = 1; i <= 3; i++) staff.push({ id: 10 + i, name: "T" + i, role: "teknisyen" });
const veri = {
  staff, prefs: {}, manualTatil: { "2026-10-12": true }, arife: { "2026-10-13": true }, settings: {}, schedules: {}, acil: {}, oglen: {},
  puantaj: { "2026-10": { 1: { 10: "YI", 11: "YI" }, 2: { 11: "R" }, 3: { 11: "R" }, 4: { 11: "NI" } } },
};
const oturan = g => [...g.masa, ...g.joker].filter(h => h?.id).map(h => h.ad);
const yerOf = (g, ad) => { const i = g.masa.findIndex(h => h?.ad === ad); return i >= 0 ? String(i + 1) : g.joker.some(h => h.ad === ad) ? "J" : null; };

describe("onay listesi masaları", () => {
  const H = onayHaftasiHesapla(veri, 2026, 10, 9);   // 9–13 Kasım

  test("kemoterapi eczacısı yok; acilde tutan eczacı var", () => {
    expect(H.kisiler.map(k => k.ad)).toEqual(["E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8", "E9"]);
    H.gunler.forEach(g => expect(oturan(g)).not.toContain("K1"));
  });

  test("9 kişi: 6 masa dolu, fazlalardan ilki Masa 7, kalan ikisi joker", () => {
    const g = H.gunler[0];
    expect(g.masa.every(h => h.id)).toBe(true);
    expect(g.joker.length).toBe(2);
    expect(new Set(oturan(g)).size).toBe(9);
  });

  test("7 kişi: biri joker, Masa 7 boş; 6 kişi: joker yok", () => {
    const v = JSON.parse(JSON.stringify(veri)); v.puantaj = { "2026-10": { 8: { 9: "YI", 10: "YI" }, 9: { 9: "YI", 10: "YI" } } };
    const S = onayHaftasiHesapla(v, 2026, 10, 9);
    expect(S.gunler[0].joker.length).toBe(1);
    expect(S.gunler[0].masa[6].id).toBe(null);
    v.puantaj["2026-10"][7] = { 9: "YI" };
    const T = onayHaftasiHesapla(v, 2026, 10, 9);
    expect(T.gunler[0].joker).toEqual([]);
    expect(T.gunler[0].masa.slice(0, 6).every(h => h.id)).toBe(true);
  });

  test("eczacı yetmezse o günün teknikeri oturur; Masa 7 ve joker boş", () => {
    const g = H.gunler[2];   // 11 Kasım: E1–E4 yok (izin, rapor, nöbet ertesi)
    expect(g.masa.slice(0, 6).filter(h => h.tekniker).map(h => h.ad)).toEqual(["T1"]);
    expect(g.masa.slice(0, 6).every(h => h.id)).toBe(true);
    expect(g.masa[6].id).toBe(null);
    expect(g.joker).toEqual([]);
    expect(g.uyari).toEqual([]);
  });

  test("resmi tatilde liste yok; arife günü var", () => {
    expect(H.gunler[3].tatil).toBe(true);
    expect(H.gunler[3].masa).toEqual([]);
    expect(H.gunler[4].arife).toBe(true);
    expect(H.gunler[4].masa.slice(0, 6).every(h => h.id)).toBe(true);
  });

  test("nöbet günü (eczane ya da acil) masada; nöbet ertesi değil", () => {
    const v = JSON.parse(JSON.stringify(veri)); v.puantaj = {};
    v.acil = { "2026-10": { 9: [9] } };   // E9 9 Kasım acil nöbetinde, 10 Kasım nöbet ertesi
    const H2 = onayHaftasiHesapla(v, 2026, 10, 9);
    expect(oturan(H2.gunler[0])).toContain("E9");
    expect(oturan(H2.gunler[1])).not.toContain("E9");
  });

  test("tekniker sırası yıl boyunca: masaya oturan tekniker sonraki sefer arkaya geçer", () => {
    const v = JSON.parse(JSON.stringify(veri));
    v.puantaj["2026-10"] = Object.fromEntries([1, 2, 3, 4].map(id => [id, { 16: "R", 17: "R" }]));
    const S = onayHaftasiHesapla(v, 2026, 10, 16);
    const tek = S.gunler.slice(0, 2).flatMap(g => g.masa.filter(h => h?.tekniker).map(h => h.ad));
    expect(tek).toEqual(["T1", "T2"]);
  });
});

describe("her gün yer değişir, yıl boyunca her masaya eşit oturulur", () => {
  // 9 eczacı, izinsiz bir yıl: kimse önceki gün oturduğu yere oturmaz; yıl sonunda her kişinin Masa 1–6 sayıları
  // arasındaki fark en fazla 1
  const v = JSON.parse(JSON.stringify(veri)); v.puantaj = {}; v.manualTatil = {}; v.arife = {};
  const haftalar = [];
  for (let t = new Date(2027, 0, 4); t.getFullYear() === 2027; t.setDate(t.getDate() + 7)) haftalar.push(onayHaftasiHesapla(v, t.getFullYear(), t.getMonth(), t.getDate()));

  test("kimse art arda iki gün aynı yerde oturmaz", () => {
    const gunler = haftalar.flatMap(h => h.gunler).filter(g => !g.tatil && g.y === 2027);
    let ayni = 0;
    for (let i = 1; i < gunler.length; i++) for (const ad of oturan(gunler[i])) if (yerOf(gunler[i], ad) === yerOf(gunler[i - 1], ad)) ayni++;
    expect(ayni).toBe(0);
  });

  test("yıl sonunda herkesin masa sayıları arasında fark en fazla 1", () => {
    const son = haftalar.at(-1);
    son.kisiler.forEach(k => {
      const masa = ["1", "2", "3", "4", "5", "6"].map(y => k.say[y]);
      expect(Math.max(...masa) - Math.min(...masa)).toBeLessThanOrEqual(1);
    });
    const joker = son.kisiler.map(k => k.say.J + k.say["7"]);
    expect(Math.max(...joker) - Math.min(...joker)).toBeLessThanOrEqual(1);
  });

  test("izinli kişinin de kendi günleri masalara eşit dağılır", () => {
    const w = JSON.parse(JSON.stringify(v));
    w.puantaj = {}; for (let m = 2; m <= 3; m++) w.puantaj[`2027-${m}`] = { 1: Object.fromEntries(Array.from({ length: 31 }, (_, i) => [i + 1, "YI"])) };
    const S = onayHaftasiHesapla(w, 2027, 11, 27);
    const e1 = S.kisiler.find(k => k.ad === "E1");
    const masa = ["1", "2", "3", "4", "5", "6"].map(y => e1.say[y]);
    expect(Math.max(...masa) - Math.min(...masa)).toBeLessThanOrEqual(1);
  });
});

test("en az maliyetli atama", () => {
  expect(enAzAtama([[4, 1, 3], [2, 0, 5], [3, 2, 2]])).toEqual([1, 0, 2]);
  expect(enAzAtama([[1, 9, 9, 0]])).toEqual([3]);
});
