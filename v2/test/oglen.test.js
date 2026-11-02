// Öğlen nöbeti: hafta içi, mesaide çalışanlardan; Pzt–Prş 2 eczacı + 1 tekniker, Cuma 3 eczacı + 2 tekniker; Cuma'dan
// muaf olan Cuma yazılmaz; haftada en fazla 2; yıl boyunca toplam ve Cuma sayısı eşit; nöbetçiye mümkünse yazılmaz.
import { describe, test, expect } from "vitest";
import { cizelgeOlustur, oglenHesapla, oglenOnarimlariHesapla, oglenYillikHesapla, puantajHesapla } from "../src/motor";

const staff = [];
for (let i = 1; i <= 7; i++) staff.push({ id: i, name: "E" + i, role: "eczaci", ...(i === 7 ? { cumaMuaf: true } : {}) });
staff.push({ id: 8, name: "A1", role: "servis" });
for (let i = 1; i <= 5; i++) staff.push({ id: 8 + i, name: "T" + i, role: "teknisyen" });
const veri = { staff, prefs: {}, manualTatil: {}, arife: {}, settings: {}, schedules: {}, puantaj: {}, acil: {}, oglen: {} };
// E2 Kasım'ın ikinci haftası yıllık izinde; 20 Kasım arife
for (let d = 9; d <= 13; d++) veri.prefs[`2-2026-10-${d}`] = "izinli";
veri.arife["2026-10-20"] = true;
const Y = 2026;
const hg = (m, d) => (new Date(Y, m, d).getDay() + 6) % 7;
const fark = v => Math.max(...v) - Math.min(...v);

function ay(m) {
  veri.schedules[`${Y}-${m}`] = { year: Y, month: m, days: cizelgeOlustur(veri, Y, m, { saat: () => 0 }).days };
  const r = oglenHesapla(veri, Y, m);
  veri.oglen[`${Y}-${m}`] = Object.fromEntries(r.gunler.map(g => [g.gun, { e: g.e, t: g.t }]));
  return r;
}

describe("öğlen nöbeti", () => {
  const r = ay(10), G = puantajHesapla(veri, Y, 10);
  const hucre = (id, d) => G.satirlar.find(x => x.s.id === id).cells[d - 1];

  test("yalnız hafta içi, tatil ve arife değil; gün başına gereken kişi", () => {
    expect(r.gunler.every(g => g.dw <= 4)).toBe(true);
    expect(r.gunler.some(g => g.gun === 20)).toBe(false);
    r.gunler.forEach(g => {
      expect(g.e.length).toBe(g.dw === 4 ? 3 : 2);
      expect(g.t.length).toBe(g.dw === 4 ? 2 : 1);
    });
    expect(r.uyarilar).toEqual([]);
  });

  test("o gün mesaide çalışanlardan; Cuma'dan muaf Cuma yazılmaz; doğru gruptan", () => {
    r.gunler.forEach(g => {
      [...g.e, ...g.t].forEach(id => expect(["M", "N"]).toContain(hucre(id, g.gun).kod));
      g.e.forEach(id => expect(["eczaci", "servis"]).toContain(staff.find(s => s.id === id).role));
      g.t.forEach(id => expect(staff.find(s => s.id === id).role).toBe("teknisyen"));
      if (g.dw === 4) expect(g.e).not.toContain(7);
    });
    // izinli haftasında E2 yok
    r.gunler.filter(g => g.gun >= 9 && g.gun <= 13).forEach(g => expect(g.e).not.toContain(2));
  });

  test("haftada en fazla 2; nöbetçiye yazma az", () => {
    const hf = {};
    r.gunler.forEach(g => [...g.e, ...g.t].forEach(id => { const k = Math.floor((g.gun - 1 + hg(10, 1)) / 7) + ":" + id; hf[k] = (hf[k] || 0) + 1; }));
    expect(Math.max(...Object.values(hf))).toBeLessThanOrEqual(2);
    const nob = r.gunler.reduce((t, g) => t + [...g.e, ...g.t].filter(id => g.nobetci.includes(id)).length, 0);
    expect(nob).toBeLessThanOrEqual(3);
  });

  test("yıl boyu eşitlik: toplam ve Cuma (izinli olan sonraki ay kapatır)", () => {
    ay(11);
    const Yl = oglenYillikHesapla(veri, Y, 11);
    const say = ids => ids.map(id => (Yl[id] || { top: 0 }).top);
    expect(fark(say([1, 2, 3, 4, 5, 6, 7, 8]))).toBeLessThanOrEqual(1);
    expect(fark(say([9, 10, 11, 12, 13]))).toBeLessThanOrEqual(1);
    expect(fark([1, 2, 3, 4, 5, 6, 8].map(id => Yl[id].cuma))).toBeLessThanOrEqual(1);
    expect(fark([9, 10, 11, 12, 13].map(id => Yl[id].cuma))).toBeLessThanOrEqual(1);
    expect(Yl[7].cuma).toBe(0);
  });

  test("aynı veriyle aynı sonuç", () => {
    expect(JSON.stringify(oglenHesapla(veri, Y, 11))).toBe(JSON.stringify(oglenHesapla(veri, Y, 11)));
  });
});

describe("öğlen nöbeti: elle düzenleme ve sonradan izin / rapor", () => {
  const kopya = x => JSON.parse(JSON.stringify(x));
  const ayK = `${Y}-10`;

  test("elle düzenlenen gün yeniden oluşturmada korunur", () => {
    const v = kopya(veri);
    v.oglen[ayK][3] = { e: [5, 6], t: [13], elle: true };
    const r = oglenHesapla(v, Y, 10), g = r.gunler.find(x => x.gun === 3);
    expect([g.e, g.t, g.elle]).toEqual([[5, 6], [13], true]);
  });

  test("sonradan izin girilen kişinin yeri doldurulur, diğer günler değişmez", () => {
    const v = kopya(veri), kayit = v.oglen[ayK];
    const gun = Number(Object.keys(kayit).find(d => Number(d) >= 16 && kayit[d].e.length)), kim = kayit[gun].e[0];
    v.prefs[`${kim}-${Y}-10-${gun}`] = "izinli";
    const o = oglenOnarimlariHesapla(v, 20261101);
    expect(o.map(x => x.m)).toEqual([10]);
    const yeni = Object.fromEntries(o[0].gunler.map(g => [g.gun, { e: g.e, t: g.t }]));
    expect(yeni[gun].e).not.toContain(kim);
    expect(yeni[gun].e.length).toBe(kayit[gun].e.length);
    for (const d of Object.keys(kayit)) if (Number(d) !== gun) expect(yeni[d]).toEqual({ e: kayit[d].e, t: kayit[d].t });
    // onarılmış hâl yeniden onarım gerektirmez
    v.oglen[ayK] = yeni;
    expect(oglenOnarimlariHesapla(v, 20261101)).toEqual([]);
  });

  test("geçmiş günler ve elle düzenlenen günler onarılmaz", () => {
    const v = kopya(veri), kayit = v.oglen[ayK];
    const kim = kayit[3].e[0];
    v.prefs[`${kim}-${Y}-10-3`] = "izinli";
    expect(oglenOnarimlariHesapla(v, 20261110)).toEqual([]);   // 3 Kasım geçmişte
    kayit[3].elle = true;
    expect(oglenOnarimlariHesapla(v, 20261101)).toEqual([]);   // elle düzenlenmiş
  });
});
