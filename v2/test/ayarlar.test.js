// Gelişmiş kurallar (Ayarlar), acil eczanede "art arda nöbet yazılmasın" seçeneği, puantaj hücre saatleri, paylaşım
// metinleri ve aramanın her bilgisayarda aynı sonucu vermesi.
import { describe, test, expect } from "vitest";
import { acilHesapla, cizelgeOlustur, oglenHesapla, puantajHesapla } from "../src/motor";
import { veriyiDogrula } from "../src/veri/dogrulama";
import { kodMetni } from "../src/disa/puantajTipleri";
import { ayListesiMetni, kisiGorevMetni } from "../src/veri/paylasim";

const Y = 2026,
  M = 10; // Kasım 2026: 1 Pazar
const staff = [];
for (let i = 1; i <= 6; i++) staff.push({ id: i, name: "E" + i, role: "eczaci" });
for (let i = 1; i <= 6; i++) staff.push({ id: 6 + i, name: "T" + i, role: "teknisyen" });
const veri = (settings = {}) => ({
  staff,
  prefs: {},
  manualTatil: {},
  arife: {},
  settings,
  schedules: {},
  puantaj: {},
  acil: {},
  oglen: {},
});

describe("ayarların doğrulaması", () => {
  test("sınır dışı değer sınıra çekilir, tanınmayan değer varsayılana döner, açık / kapalı seçenekler korunur", () => {
    const v = veriyiDogrula({
      staff: [],
      schedules: {},
      settings: {
        nobetSuresi: 40,
        mesai: 7.4,
        hazSaat: "x",
        maxThu: 99,
        oglenCE: 9,
        acilArdArda: false,
        thuHaftaSonu: false,
        hsTopla: false,
      },
    });
    expect(v.settings).toMatchObject({
      nobetSuresi: 24,
      mesai: 7.5,
      hazSaat: 8,
      maxThu: 99,
      oglenCE: 3,
      acilArdArda: false,
      thuHaftaSonu: false,
      cumaEsles: true,
      hsTopla: false,
    });
  });
  test("eski kayıt (yalnız dört ayar) varsayılanlarla tamamlanır", () => {
    const v = veriyiDogrula({ staff: [], schedules: {}, settings: { minAra: 4, acilMinAra: 3, destekAylik: 2, arifeSaat: 3 } });
    expect(v.settings).toMatchObject({
      minAra: 4,
      nobetSuresi: 24,
      mesai: 8,
      hazSaat: 8,
      oglenHE: 2,
      oglenHT: 1,
      oglenCE: 3,
      oglenCT: 2,
      acilArdArda: true,
    });
  });
});

describe("gelişmiş kurallar motora ve puantaja girer", () => {
  const sch = { year: Y, month: M, days: cizelgeOlustur(veri(), Y, M).days };
  test("nöbet süresi, mesai ve hazırlama saati puantajda", () => {
    const v = { ...veri({ nobetSuresi: 16, mesai: 7.5, hazSaat: 6 }), schedules: { [`${Y}-${M}`]: sch } };
    const G = puantajHesapla(v, Y, M);
    const hucreler = G.satirlar.flatMap(r => r.cells);
    expect(hucreler.filter(c => c.kod === "N").every(c => c.saat === 16)).toBe(true);
    expect(hucreler.filter(c => c.kod === "M").every(c => c.saat === 7.5)).toBe(true);
    expect(hucreler.filter(c => c.kod === "H").every(c => c.saat === 6)).toBe(true);
    // hücre yazısı gerçek saati gösterir
    expect(kodMetni("M", 7.5)).toBe("7,5");
    expect(kodMetni("N", 16)).toBe("16");
  });
  test("öğlen nöbetinde kişi sayıları ayardan", () => {
    const v = { ...veri({ oglenHE: 3, oglenHT: 2, oglenCE: 1, oglenCT: 1 }), schedules: { [`${Y}-${M}`]: sch } };
    const r = oglenHesapla(v, Y, M);
    for (const g of r.gunler) {
      const cuma = new Date(Y, M, g.gun).getDay() === 5;
      expect(g.e.length).toBe(cuma ? 1 : 3);
      expect(g.t.length).toBe(cuma ? 1 : 2);
    }
  });
  test("arama süreyle sınırlı değil: aynı veriyle her çağrıda aynı çizelge (eski saat seçeneği etkisiz)", () => {
    const a = cizelgeOlustur(veri(), Y, M),
      b = cizelgeOlustur(veri(), Y, M, { saat: () => 1e15 });
    expect(b.days).toEqual(a.days);
    expect(b.warnings).toEqual(a.warnings);
  });
});

describe("acil eczane: kadro yetmezse art arda nöbet", () => {
  // 3 kişilik acil kadrosu: günde 2 kişi için art arda nöbet olmadan yetmez
  const acilKadro = [
    ...staff,
    { id: 21, name: "A1", role: "servis" },
    { id: 22, name: "A2", role: "servis" },
    { id: 23, name: "A3", role: "servis" },
  ];
  const v = s => ({ ...veri(s), staff: acilKadro, acilElle: {} });
  const artArda = r => r.gunler.some((g, i) => i > 0 && g.ids.some(id => r.gunler[i - 1].ids.includes(id)));
  test("açıkken (varsayılan) her gün 2 kişi yazılır, art arda nöbet uyarılır", () => {
    const r = acilHesapla(v({}), Y, M);
    r.gunler.forEach(g => expect(g.ids.length).toBe(2));
    expect(artArda(r)).toBe(true);
  });
  test("kapalıyken art arda nöbet yazılmaz; eksik günler söylenir", () => {
    const r = acilHesapla(v({ acilArdArda: false }), Y, M);
    expect(artArda(r)).toBe(false);
    expect(r.gunler.some(g => g.ids.length < 2)).toBe(true);
    expect(r.uyarilar.some(w => /art arda nöbet yazılmadığı için .* eksik kaldı/.test(w))).toBe(true);
  });
});

describe("paylaşım metinleri", () => {
  const c = {
    year: Y,
    month: M,
    days: [
      {
        day: 1,
        tatil: true,
        conflict: false,
        fazlaMesai: 16,
        locked: false,
        assigned: [
          { id: 7, name: "T1", role: "teknisyen" },
          { id: 1, name: "E1", role: "eczaci" },
        ],
        prep: [{ id: 2, name: "E2", role: "eczaci" }],
      },
      {
        day: 2,
        tatil: false,
        conflict: false,
        fazlaMesai: 8,
        locked: false,
        assigned: [
          { id: 3, name: "E3", role: "eczaci" },
          { id: 8, name: "T2", role: "teknisyen" },
        ],
        prep: [],
      },
    ],
    uyarilar: [],
    olusturma: 0,
  };
  test("ay listesi: eczacı önce, tatil işaretli, taslak yazılı", () => {
    const t = ayListesiMetni(c, "Test Hastanesi", d => d === 1);
    expect(t.split("\n").slice(0, 3)).toEqual([
      "*Kasım 2026 Nöbet Listesi* · Test Hastanesi (taslak)",
      "1 Paz*: E1, T1 · Haz.: E2",
      "2 Pzt: E3, T2",
    ]);
  });
  test("kişinin görevleri: nöbet, acil nöbeti, hazırlama ve öğlen nöbeti, toplamlarla", () => {
    const hucreler = [{ kod: "N" }, { kod: "NI" }, { kod: "N", acil: true }, { kod: "M" }, { kod: "H" }];
    const t = kisiGorevMetni({ oglen: { [`${Y}-${M}`]: { 4: { e: [1], t: [] } } } }, Y, M, { id: 1, name: "E1" }, hucreler);
    expect(t).toBe(
      [
        "*Kasım 2026 · E1*",
        "• 1 Kasım Pazar: nöbet",
        "• 3 Kasım Salı: acil eczane nöbeti",
        "• 4 Kasım Çarşamba: öğlen nöbeti",
        "• 5 Kasım Perşembe: hazırlama",
        "",
        "Toplam: 1 nöbet, 1 acil nöbeti, 1 hazırlama, 1 öğlen nöbeti",
      ].join("\n"),
    );
  });
});

describe("yönetime aylık rapor", async () => {
  const { aylikRaporHesapla } = await import("../src/motor");
  test("puantajdaki görev, izin ve saatlerle aynı; acil nöbeti ve öğlen ayrı sayılır", () => {
    const acilli = [
      ...staff,
      { id: 21, name: "A1", role: "servis" },
      { id: 22, name: "A2", role: "servis" },
      { id: 23, name: "A3", role: "servis" },
      { id: 24, name: "A4", role: "servis" },
      { id: 25, name: "A5", role: "servis" },
    ];
    const v = { ...veri(), staff: acilli, acilElle: {} };
    v.schedules[`${Y}-${M}`] = { year: Y, month: M, days: cizelgeOlustur(v, Y, M).days };
    v.acil[`${Y}-${M}`] = Object.fromEntries(acilHesapla(v, Y, M).gunler.map(g => [g.gun, g.ids]));
    v.oglen[`${Y}-${M}`] = Object.fromEntries(oglenHesapla(v, Y, M).gunler.map(g => [g.gun, { e: g.e, t: g.t }]));
    v.puantaj[`${Y}-${M}`] = { 1: { 9: "R", 10: "DI" }, 7: { 11: "YI", 12: "NI" } };
    const R = aylikRaporHesapla(v, Y, M),
      G = puantajHesapla(v, Y, M);
    expect(R.satirlar.length).toBe(G.satirlar.length);
    for (const s of R.satirlar) {
      const r = G.satirlar.find(x => x.s.id === s.id);
      expect(s.nobet + s.acil).toBe(r.n);
      expect([s.haz, s.fm, s.toplam, s.aylik]).toEqual([r.h, r.fm, r.toplam, r.aylik]);
    }
    // acil: günde 2 kişi; eczane nöbeti puantajdaki (acil olmayan) nöbetlerle aynı
    const top = k => R.satirlar.reduce((t, s) => t + s[k], 0);
    expect(top("acil")).toBe(60);
    expect(top("nobet")).toBe(G.satirlar.flatMap(r => r.cells).filter(c => c.kod === "N" && !c.acil).length);
    const e1 = R.satirlar.find(s => s.id === 1),
      t1 = R.satirlar.find(s => s.id === 7);
    expect([e1.rapor, e1.di, t1.yi, t1.ni]).toEqual([1, 1, 1, 1]);
    expect(top("oglen")).toBe(Object.values(v.oglen[`${Y}-${M}`]).reduce((t, g) => t + g.e.length + g.t.length, 0));
    expect(R.satirlar.filter(s => s.acilKadro).map(s => s.id)).toEqual([21, 22, 23, 24, 25]);
  });
});
