// Acil eczane nöbet listesi: günde 2 kişi; acil servis personeli ve "acilde nöbet tutar" işaretli eczacılar (kemoterapi dahil);
// eczane çizelgesiyle çakışmaz (aynı / komşu gün); art arda gün yok; eşitlik ayrı ve yıl boyunca; elle günler korunur.
import { describe, test, expect } from "vitest";
import { acilHesapla, calismaListesiHesapla, cizelgeOlustur, gunuDenetle } from "../src/motor";

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

describe("acil nöbetinde izin, rapor, eş durumu, istiyor / istemiyor", () => {
  test("eczane nöbetindeki gibi uygulanır", () => {
    const v = JSON.parse(JSON.stringify(veri));
    const k = (id, d) => `${id}-${Y}-${M}-${d}`;
    v.prefs[k(14, 8)] = "avoid";                       // istemiyor
    v.prefs[k(15, 11)] = "esVar";                      // eş durumu var: o gün yazılır
    v.prefs[k(16, 15)] = "esYok";                      // eş durumu yok: yazılmaz
    v.puantaj[`${Y}-${M}`] = { 13: { 18: "R", 19: "R" } };   // raporlu
    for (let d = 23; d <= 27; d++) v.prefs[k(14, d)] = "izinli";   // 22'de izin öncesi
    const r = acilHesapla(v, Y, M), gun = d => r.gunler[d - 1].ids;
    expect(gun(8)).not.toContain(14);
    expect(gun(11)).toContain(15);
    expect(gun(15)).not.toContain(16);
    expect(gun(18)).not.toContain(13); expect(gun(19)).not.toContain(13);
    expect(gun(22)).not.toContain(14);
    for (let d = 23; d <= 27; d++) expect(gun(d)).not.toContain(14);
  });
});

describe("acilde nöbet tutan eczacı günlük eczanede nöbet tutmaz", () => {
  test("eczane nöbet çizelgesine ve hazırlamaya yazılmaz", () => {
    const days = cizelgeOlustur(veri, Y, M, { saat: () => 0 }).days;
    days.forEach(g => [...g.assigned, ...g.prep].forEach(p => expect([1, 2, 13, 14, 15, 16]).not.toContain(p.id)));
  });
});

describe("kemoterapi eczacısı nöbeti günlükte ya da acilde tutar (seçilir)", () => {
  test("acilde tutar işaretliyse acil listesine girer, eczaneye girmez; değilse yalnız eczanede", () => {
    const v = JSON.parse(JSON.stringify(veri));
    v.staff.push({ id: 30, name: "K1", role: "nobetci", acilTutar: true }, { id: 31, name: "K2", role: "nobetci" });
    const acil = acilHesapla(v, Y, M), ecz = cizelgeOlustur(v, Y, M, { saat: () => 0 }).days;
    const acilde = new Set(acil.gunler.flatMap(g => g.ids)), eczanede = new Set(ecz.flatMap(g => [...g.assigned, ...g.prep].map(p => p.id)));
    expect(acilde.has(30)).toBe(true); expect(eczanede.has(30)).toBe(false);
    expect(acilde.has(31)).toBe(false); expect(eczanede.has(31)).toBe(true);
  });
});

describe("sonradan değişen kadro ve az kadro", () => {
  test("çizelgeden sonra 'acilde tutar' işaretlenen eczacı eczanede kalırsa gün denetimi hata verir; destek hazırlamada hata yok", () => {
    const v = JSON.parse(JSON.stringify(eczaneli));
    const sch = v.schedules[`${Y}-${M}`], i = sch.days.findIndex(g => g.assigned.some(p => p.id === 3));
    v.staff.find(s => s.id === 3).acilTutar = true;
    v.staff.push({ id: 40, name: "D1", role: "destek" });
    const b = gunuDenetle(v, sch, i + 1, sch.days[i].assigned, [{ id: 40, name: "D1", role: "destek" }]);
    expect(b.some(x => x.sev === "hata" && /E3 günlük eczanede nöbet tutmaz/.test(x.t))).toBe(true);
    expect(b.some(x => /D1 günlük eczanede hazırlama tutmaz/.test(x.t))).toBe(false);
  });

  test("kadro yetmezse art arda nöbet uyarısı tek satırda toplanır", () => {
    const v = { ...veri, staff: [...veri.staff.filter(s => s.role !== "servis"), { id: 13, name: "A1", role: "servis" }] };
    const r = acilHesapla(v, Y, M);
    r.gunler.forEach(g => expect(g.ids.length).toBe(2));
    expect(r.uyarilar.filter(w => /art arda/.test(w)).length).toBe(1);
    expect(r.uyarilar[0]).toMatch(/acil kadrosu yetmiyor/);
  });

  test("acil servis personeli günlük eczane çalışma listesinde görünmez", () => {
    const L = calismaListesiHesapla(eczaneli, Y, M);
    L.forEach(g => [...g.onay, ...g.haz, ...g.dst, ...g.gel, ...g.yok].forEach(x => expect(x.s.role).not.toBe("servis")));
  });
});

describe("sonradan izin: yerine önerilenler ve yıllık rapor", () => {
  test("sorunlu gün bulunur; öneriler engelsiz ve az nöbet tutan önce", async () => {
    const { acilAdaylariHesapla, acilSorunluGunler } = await import("../src/motor");
    const v = JSON.parse(JSON.stringify(eczaneli));
    const r = acilHesapla(v, Y, M); v.acil[`${Y}-${M}`] = Object.fromEntries(r.gunler.map(g => [g.gun, g.ids]));
    const g = r.gunler.find(x => x.gun > 5 && x.ids.includes(14));
    v.puantaj[`${Y}-${M}`] = { 14: { [g.gun]: "R" } };
    expect(acilSorunluGunler(v, Y, M)).toEqual([{ gun: g.gun, ids: [14] }]);
    const o = acilAdaylariHesapla(v, Y, M, g.gun, g.ids, null);
    expect(o.sorunlu).toEqual([14]);
    expect(o.adaylar.every(a => !g.ids.includes(a.id))).toBe(true);
    const ilk = o.adaylar[0];
    expect(ilk.engel).toBe(false);
    // sıralama: engel → uyarı sayısı → yıllık sayı
    for (let i = 1; i < o.adaylar.length; i++) {
      const a = o.adaylar[i - 1], b = o.adaylar[i];
      const k = x => [Number(x.engel), x.uyarilar.length, x.yil];
      const ka = k(a), kb = k(b), i0 = ka.findIndex((v, j) => v !== kb[j]);
      expect(i0 === -1 || ka[i0] < kb[i0]).toBe(true);
    }
  });
  test("yıllık acil ve öğlen raporu: aylar ve toplamlar kayıtla tutarlı", async () => {
    const { acilOglenRaporuHesapla } = await import("../src/motor");
    const v = JSON.parse(JSON.stringify(veri));
    const r = acilHesapla(v, Y, M); v.acil[`${Y}-${M}`] = Object.fromEntries(r.gunler.map(g => [g.gun, g.ids]));
    v.oglen = { [`${Y}-${M}`]: { 2: { e: [3, 4], t: [8] }, 6: { e: [3, 5, 6], t: [8, 9] } } };
    const R = acilOglenRaporuHesapla(v, Y);
    expect(R.acilAylar[M]).toBe(true); expect(R.acilAylar[M - 1]).toBe(false);
    expect(R.acil.reduce((t, s) => t + s.top, 0)).toBe(r.gunler.length * 2);
    expect(R.acil.every(s => [1, 2, 13, 14, 15, 16].includes(s.id))).toBe(true);
    const e3 = R.oglen.find(s => s.id === 3);
    expect(e3.aylar[M]).toBe(2); expect(e3.top).toBe(2); expect(e3.cuma).toBe(1);   // 6 Kasım 2026 Cuma
    expect(R.oglen.some(s => s.id === 13)).toBe(false);   // acil servis personeli öğlende yok
  });
});

describe("acil eşitliği günlük eczanedeki gibi: izinli günler düşülür, telafi yok", () => {
  // 6 kişilik acil kadrosu (2 işaretli eczacı + 4 acil servis personeli), eczane çizelgesi yok
  const v0 = () => JSON.parse(JSON.stringify({ ...veri, prefs: {} }));
  const say = (r, id) => r.gunler.filter(g => g.ids.includes(id)).length;
  test("10 gün izinli kişi o ay az tutar, sonraki ay fazla almaz", () => {
    const v = v0();
    for (let d = 1; d <= 10; d++) v.prefs[`13-${Y}-${M}-${d}`] = "izinli";
    const r1 = acilHesapla(v, Y, M);
    const n13 = say(r1, 13), diger = [1, 2, 14, 15, 16].map(id => say(r1, id));
    expect(n13).toBeLessThan(Math.min(...diger));                 // payı 20/30 gün
    expect(Math.abs(n13 - 60 * 20 / 170)).toBeLessThanOrEqual(1.5);
    v.acil[`${Y}-${M}`] = Object.fromEntries(r1.gunler.map(g => [g.gun, g.ids]));
    const r2 = acilHesapla(v, Y, M + 1);                           // Aralık: herkes tam ay
    const l2 = [1, 2, 13, 14, 15, 16].map(id => say(r2, id));
    expect(Math.max(...l2) - Math.min(...l2)).toBeLessThanOrEqual(1);
  });
  test("ay ortasında başlayan çalıştığı gün kadar pay alır", () => {
    const v = v0();
    v.staff.find(s => s.id === 16).baslangic = `${Y}-11-16`;      // 16 Kasım'da başlıyor (15 gün)
    const r = acilHesapla(v, Y, M), n = say(r, 16);
    expect(Math.abs(n - 60 * 15 / 165)).toBeLessThanOrEqual(1.5);
    v.acil[`${Y}-${M}`] = Object.fromEntries(r.gunler.map(g => [g.gun, g.ids]));
    const r2 = acilHesapla(v, Y, M + 1), l2 = [1, 2, 13, 14, 15, 16].map(id => say(r2, id));
    expect(Math.max(...l2) - Math.min(...l2)).toBeLessThanOrEqual(1);
  });
});

describe("acil eşitliği gün türlerine göre (günlük eczanedeki gibi)", () => {
  test("yıl boyunca Perşembe, Cuma, Cumartesi, Pazar ayrı ayrı eşit", () => {
    const v = JSON.parse(JSON.stringify({ ...veri, prefs: {} }));
    const kadro = [1, 2, 13, 14, 15, 16], n = {};
    kadro.forEach(id => { n[id] = { top: 0, pe: 0, cu: 0, cmt: 0, paz: 0 }; });
    for (let m = 0; m < 6; m++) {
      const r = acilHesapla(v, Y, m);
      v.acil[`${Y}-${m}`] = Object.fromEntries(r.gunler.map(g => [g.gun, g.ids]));
      r.gunler.forEach(g => {
        const dw = (new Date(Y, m, g.gun).getDay() + 6) % 7;
        g.ids.forEach(id => { n[id].top++; if (dw === 3) n[id].pe++; if (dw === 4) n[id].cu++; if (dw === 5) n[id].cmt++; if (dw === 6) n[id].paz++; });
      });
    }
    for (const t of ["top", "pe", "cu", "cmt", "paz"]) expect(fark(kadro.map(id => n[id][t])), t).toBeLessThanOrEqual(1);
  });
});

describe("Ayarlar > Acil eczane: iki acil nöbeti arasında önerilen en az gün", () => {
  const araSay = (r, k) => { let n = 0; r.gunler.forEach((g, i) => g.ids.forEach(id => { if (r.gunler[i + k]?.ids.includes(id)) n++; })); return n; };
  test("4 gün seçilince 3 gün arayla nöbet azalır; 2 gün seçilince 2 gün ara cezasız", () => {
    const v = JSON.parse(JSON.stringify(veri));
    const r3 = acilHesapla(v, Y, M);
    v.settings = { ...v.settings, acilMinAra: 4 };
    const r4 = acilHesapla(v, Y, M);
    expect(araSay(r4, 3)).toBeLessThan(araSay(r3, 3));
    v.settings = { ...v.settings, acilMinAra: 2 };
    const r2 = acilHesapla(v, Y, M);
    expect(araSay(r2, 2)).toBeGreaterThanOrEqual(araSay(r3, 2));
    [r2, r3, r4].forEach(r => expect(araSay(r, 1)).toBe(0));
  });
  test("denetim, önerilen aradan yakın acil nöbetini uyarır", async () => {
    const v = JSON.parse(JSON.stringify(veri));
    v.settings = { acilMinAra: 4 };
    v.acil[`${Y}-${M}`] = { 5: [13, 14], 8: [13, 15] };
    const { acilDenetle } = await import("../src/motor");
    expect(acilDenetle(v, Y, M, 8, [13, 15]).some(x => /5\. gün de acil eczanede nöbetçi \(en az 4 gün ara/.test(x.t))).toBe(true);
    v.settings = { acilMinAra: 3 };
    expect(acilDenetle(v, Y, M, 8, [13, 15]).some(x => /en az/.test(x.t))).toBe(false);
  });
});
