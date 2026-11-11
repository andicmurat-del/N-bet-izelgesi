// Sunucuda saklama biçimi ve eşitleme kararı (src/veri/bulutBicim.ts): veri belgelere bölünüp geri kurulunca aynı kalır;
// hiçbir durumda dolu ve değişmiş bir taraf sorulmadan ezilmez.
import { describe, test, expect } from "vitest";
import { parcala, birlestir, parcalarAyni, ozet, bosMu, eslemeKarari, BELGE_SINIRI } from "../src/veri/bulutBicim.ts";
import { veriyiDogrula, guvenliJson, bosVeri } from "../src/veri/depo.svelte.ts";
import { cizelgeOlustur, acilHesapla, oglenHesapla } from "../src/motor";
import { veriKur } from "./altin/senaryo.js";
import { hizliSaat } from "./tarama/ortak.js";

function doluVeri() {
  const v = veriyiDogrula(veriKur());
  for (const m of [0, 1]) {
    const r = cizelgeOlustur(v, 2026, m, { saat: hizliSaat() });
    v.schedules[`2026-${m}`] = { year: 2026, month: m, days: r.days, uyarilar: r.warnings, olusturma: 1 };
    v.acil[`2026-${m}`] = Object.fromEntries(acilHesapla(v, 2026, m).gunler.filter(g => g.ids.length).map(g => [g.gun, g.ids]));
    v.oglen[`2026-${m}`] = Object.fromEntries(oglenHesapla(v, 2026, m).gunler.map(g => [g.gun, { e: g.e, t: g.t }]));
  }
  v.kurum.ad = "Şehir Hastanesi \"Eczane\"";
  return veriyiDogrula(JSON.parse(JSON.stringify(v)));
}

describe("sunucu belgeleri", () => {
  const v = doluVeri(), p = parcala(v);
  test("veri ortak bölüm ve ay belgelerine bölünür, geri kurulunca aynıdır", () => {
    expect(Object.keys(p.aylar).sort()).toEqual(["2025-11", "2026-0", "2026-1"].filter(k => k in p.aylar).sort());
    expect(Object.keys(p.aylar)).toContain("2026-0");
    expect(JSON.parse(p.ana).schedules).toBeUndefined();
    expect(JSON.parse(p.ana).staff.length).toBe(v.staff.length);
    expect(veriyiDogrula(birlestir(p, guvenliJson))).toEqual(v);
  });
  test("boş veri de gidip gelir; ay belgesi olmaz", () => {
    const b = parcala(bosVeri());
    expect(b.aylar).toEqual({});
    expect(veriyiDogrula(birlestir(b, guvenliJson))).toEqual(bosVeri());
    expect(bosMu(bosVeri())).toBe(true);
    expect(bosMu(v)).toBe(false);
  });
  test("ay anahtarı olmayan ya da bozuk belge veriyi bozmaz", () => {
    const k = { ana: p.ana, aylar: { ...p.aylar, "x": "{\"schedules\":1}", "2026-5": "[1,2]", "2026-6": "{\"__proto__\":{\"kirli\":1},\"puantaj\":{\"__proto__\":{\"kirli\":\"M\"}}}" } };
    expect(veriyiDogrula(birlestir(k, guvenliJson)).schedules).toEqual(v.schedules);
    expect({}.kirli).toBeUndefined();
  });
  test("özet içerikle değişir, sırayla değişmez", () => {
    const ters = { ana: p.ana, aylar: Object.fromEntries(Object.entries(p.aylar).reverse()) };
    expect(ozet(ters)).toBe(ozet(p));
    expect(parcalarAyni(ters, p)).toBe(true);
    const v2 = JSON.parse(JSON.stringify(v)); v2.kurum.ad = "B";
    expect(ozet(parcala(v2))).not.toBe(ozet(p));
    expect(parcalarAyni(parcala(v2), p)).toBe(false);
  });
  test("iki aylık dolu veri belge sınırının çok altında", () => {
    for (const t of [p.ana, ...Object.values(p.aylar)]) expect(JSON.stringify(t).length).toBeLessThan(BELGE_SINIRI / 4);
  });
});

describe("eşitleme kararı", () => {
  const iz = { z: 5, ozet: "a" };
  const k = o => eslemeKarari({ sunucuZ: 5, sunucuAyni: false, iz, yerelOzet: "a", yerelBos: false, ...o });
  test("sunucu boş: dolu cihaz gönderir, boş cihaz bekler", () => {
    expect(k({ sunucuZ: null, iz: null })).toBe("gonder");
    expect(k({ sunucuZ: null, iz: null, yerelBos: true })).toBe("ayni");
  });
  test("iki taraf aynıysa bir şey yapılmaz", () => {
    expect(k({ sunucuAyni: true, iz: null })).toBe("ayni");
    expect(k({})).toBe("ayni");
  });
  test("yalnız bu cihaz değiştiyse gönderilir, yalnız sunucu değiştiyse alınır", () => {
    expect(k({ yerelOzet: "b" })).toBe("gonder");
    expect(k({ sunucuZ: 6 })).toBe("al");
  });
  test("ikisi de değiştiyse sorulur; hiç eşitlenmemiş dolu cihaz da sorar", () => {
    expect(k({ sunucuZ: 6, yerelOzet: "b" })).toBe("sor");
    expect(k({ iz: null })).toBe("sor");
  });
  test("hiç eşitlenmemiş boş cihaz sunucudakini alır", () => {
    expect(k({ iz: null, yerelBos: true, yerelOzet: "bos" })).toBe("al");
  });
  test("eşitlenmiş cihazda tüm verinin silinmesi bir değişikliktir: sunucudaki geri gelmez", () => {
    expect(k({ yerelBos: true, yerelOzet: "bos" })).toBe("gonder");
    expect(k({ yerelBos: true, yerelOzet: "bos", sunucuZ: 6 })).toBe("sor");
  });
});
