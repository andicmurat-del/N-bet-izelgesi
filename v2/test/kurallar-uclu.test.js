// Kural: Cuma + Cumartesi + Pazar nöbeti olan, hazırlamayı grubunda en son alır (uzun senaryo; ayrı dosyada paralel koşar).
import { describe, test, expect } from "vitest";
import { cizelgeOlustur } from "../src/motor";
import { Baglam } from "../src/motor/baglam";
import { senaryo } from "./tarama/ortak";

describe("Cuma + Cumartesi + Pazar nöbeti olan hazırlamayı grubunda en son alır", () => {
  // gerçekçi kadrolu rastgele senaryo (≥6 eczacı, ≥4 tekniker, izinler, tercihler); 49. senaryonun ilk ayında kural
  // eklenmeden önce üçlü nöbetli bir eczacı grubundaki birinden fazla hazırlama alıyordu
  test("üçlü nöbetli, grubundaki herkesten fazla hazırlama almaz", () => {
    const { y, m0, veri } = senaryo(49, { eczaci: [6, 8], teknisyen: [4, 8] });
    const r = cizelgeOlustur(veri, y, m0, { saat: () => 0 }),
      B = new Baglam(veri);
    const gt = d => (new Date(y, m0, d).getDay() + 6) % 7,
      o = {};
    veri.staff
      .filter(s => ["eczaci", "teknisyen", "nobetci"].includes(s.role) && r.days.some(g => g.tatil && !B.kesinYasak(s.id, y, m0, g.day)))
      .forEach(s => {
        o[s.id] = { g: s.role === "teknisyen" ? "T" : "E", cu: 0, ct: 0, pz: 0, h: 0 };
      });
    r.days.forEach(g => {
      g.assigned.forEach(p => {
        const q = o[p.id],
          w = gt(g.day);
        if (!q) return;
        if (w === 4) q.cu++;
        if (w === 5) q.ct++;
        if (w === 6) q.pz++;
      });
      g.prep.forEach(p => {
        if (o[p.id]) o[p.id].h++;
      });
    });
    const uclu = q => q.cu > 0 && q.ct > 0 && q.pz > 0;
    let ucluVar = false;
    for (const g of ["E", "T"]) {
      const grup = Object.values(o).filter(q => q.g === g),
        diger = grup.filter(q => !uclu(q));
      if (!diger.length) continue;
      const enAz = Math.min(...diger.map(q => q.h));
      grup.filter(uclu).forEach(q => {
        ucluVar = true;
        expect(q.h).toBeLessThanOrEqual(enAz);
      });
    }
    expect(ucluVar, "senaryoda Cuma + Cumartesi + Pazar nöbeti olan biri bulunmalı").toBe(true);
  });
});
