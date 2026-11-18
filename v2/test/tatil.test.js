// Resmi tatillerin kendiliğinden işaretlenmesi: tablo (sabit günler, dini bayramlar 2026–2050) ve işaretleme kuralları.
import { describe, test, expect, beforeEach } from "vitest";
import { yilinTatilleri, tatilAdi, diniBayramlarVar } from "../src/veri/resmiTatiller.ts";
import { depo, bosVeri, resmiTatilleriIsaretle, tatilleriKendiligindenIsaretle, resmiTatilMi, arifeMi, resmiTatilAyarla, veriyiDogrula } from "../src/veri/depo.svelte.ts";

const gun = (y, l) => l.filter(t => t.y === y).map(t => `${t.m + 1}-${t.d}${t.arife ? "a" : ""}`);

describe("resmi tatil tablosu", () => {
  test("2026: sabit günler, Ramazan (20–22 Mart, arife 19) ve Kurban Bayramı (27–30 Mayıs, arife 26), 28 Ekim arifesi", () => {
    expect(gun(2026, yilinTatilleri(2026))).toEqual(["1-1", "3-19a", "3-20", "3-21", "3-22", "4-23", "5-1", "5-19", "5-26a", "5-27", "5-28", "5-29", "5-30", "7-15", "8-30", "10-28a", "10-29"]);
    expect(tatilAdi(2026, 4, 28)).toBe("Kurban Bayramı 2. gün");
    expect(tatilAdi(2026, 2, 19)).toBe("Ramazan Bayramı arifesi");
  });
  test("Diyanet'in ilan ettiği bilinen tarihlerle aynı (2026–2027 bayram ilk günleri)", () => {
    const ilk = (y, ad) => yilinTatilleri(y).filter(t => t.ad === ad + " 1. gün").map(t => `${t.m + 1}-${t.d}`);
    expect([ilk(2026, "Ramazan Bayramı"), ilk(2026, "Kurban Bayramı"), ilk(2027, "Ramazan Bayramı"), ilk(2027, "Kurban Bayramı")]).toEqual([["3-20"], ["5-27"], ["3-9"], ["5-16"]]);
  });
  test("aynı yılda iki bayram (2033 Ramazan) ve yıl sınırına taşan bayram; çakışan iki tatil tek gün", () => {
    expect(yilinTatilleri(2033).filter(t => t.ad === "Ramazan Bayramı 1. gün").map(t => `${t.m + 1}-${t.d}`)).toEqual(["1-3", "12-23"]);
    // 2039 Kurban Bayramı 26–29 Aralık; arifesi 25 Aralık
    expect(gun(2039, yilinTatilleri(2039)).filter(x => x.startsWith("12-"))).toEqual(["12-25a", "12-26", "12-27", "12-28", "12-29"]);
    // 29 Ekim 2038: Cumhuriyet Bayramı ve Ramazan Bayramı aynı gün; 28 Ekim hem iki arife
    expect(tatilAdi(2038, 9, 29)).toBe("Cumhuriyet Bayramı · Ramazan Bayramı 1. gün");
    expect(yilinTatilleri(2038).filter(t => t.m === 9 && t.d === 28).length).toBe(1);
  });
  test("her yıl 2026–2050: Ramazan 3, Kurban 4 gün; tablo dışında yalnız sabit günler", () => {
    for (let y = 2026; y <= 2050; y++) {
      expect(diniBayramlarVar(y)).toBe(true);
      const l = yilinTatilleri(y);
      expect(l.filter(t => / 1\. gün/.test(t.ad)).length).toBeGreaterThanOrEqual(2);
      expect(new Set(l.map(t => `${t.m}-${t.d}`)).size).toBe(l.length);
    }
    expect(diniBayramlarVar(2051)).toBe(false);
    expect(gun(2051, yilinTatilleri(2051))).toEqual(["1-1", "4-23", "5-1", "5-19", "7-15", "8-30", "10-28a", "10-29"]);
  });
});

describe("işaretleme", () => {
  beforeEach(() => { depo.veri = bosVeri(); });
  test("yıl işaretlenir; hafta sonuna düşen arife işaretlenmez; yıl kaydedilir, ikinci kez kendiliğinden işaretlenmez", () => {
    const r = tatilleriKendiligindenIsaretle(2030);
    expect(r.isaretlenen).toBeGreaterThan(10);
    for (const t of yilinTatilleri(2030)) {
      const hs = [0, 6].includes(new Date(t.y, t.m, t.d).getDay());
      expect(t.arife ? arifeMi(t.y, t.m, t.d) : resmiTatilMi(t.y, t.m, t.d)).toBe(t.arife ? !hs : true);
    }
    expect(depo.veri.tatilYillari["2030"]).toBe(true);
    resmiTatilAyarla(2030, 0, 1, false);   // kullanıcı kaldırdı
    expect(tatilleriKendiligindenIsaretle(2030)).toBeNull();
    expect(resmiTatilMi(2030, 0, 1)).toBe(false);
  });
  test("onaylı aya ve (kendiliğinden işaretlemede) çizelgesi olan geçmiş aya dokunulmaz", () => {
    const ay = (y, m, onay) => ({ year: y, month: m, days: Array.from({ length: new Date(y, m + 1, 0).getDate() }, (_, i) => ({ day: i + 1, tatil: false, conflict: false, fazlaMesai: 8, assigned: [], prep: [], locked: false })), uyarilar: [], olusturma: 1, ...(onay ? { onay: { zaman: 1, kim: "" } } : {}) });
    depo.veri.schedules["2030-3"] = ay(2030, 3, true);      // Nisan 2030 onaylı: Kurban Bayramı 13–16 Nisan
    const r = resmiTatilleriIsaretle(2030);
    expect(r.atlananAylar).toEqual([3]);
    expect(resmiTatilMi(2030, 3, 13)).toBe(false);
    expect(resmiTatilMi(2030, 1, 4)).toBe(true);           // Şubat: Ramazan Bayramı
    // geçmiş ay (2020 Ocak) çizelgesi varsa kendiliğinden işaretlemede atlanır (tablo dışı yıl: elle işaretleme)
    depo.veri = bosVeri();
    depo.veri.schedules["2026-0"] = ay(2026, 0, false);
    resmiTatilleriIsaretle(2026, { kendiliginden: true });
    expect(resmiTatilMi(2026, 0, 1)).toBe(false);
    expect(resmiTatilMi(2026, 4, 19)).toBe(true);
  });
  test("ayar kapalıysa kendiliğinden işaretlenmez; işaretlenen yıllar ve ayar yedekte korunur", () => {
    depo.veri.settings.tatilOtomatik = false;
    expect(tatilleriKendiligindenIsaretle(2031)).toBeNull();
    const v = veriyiDogrula({ staff: [], schedules: {}, tatilYillari: { "2031": true, "x": true, "2032": false }, settings: { tatilOtomatik: false } });
    expect(v.tatilYillari).toEqual({ "2031": true });
    expect(v.settings.tatilOtomatik).toBe(false);
  });
});
