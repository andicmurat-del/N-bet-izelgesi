// Puantaj değişim denetimi ve yerine geçecek aday önerisi (eski uygulamadan taşınan kurallar).
import { describe, test, expect } from "vitest";
import { cizelgeOlustur, degisimDenetle, yerineAdaylarHesapla, puantajHesapla, yillikRaporHesapla } from "../src/motor";

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

describe("rapor nedeniyle yerine tutma", () => {
  // raporlu kişinin yerine geçen çizelgeye işlenir (gün gerçekte tutanı gösterir); yıllık eşitlikte görev raporlu kişinin
  // sayılır: yerine tutan fazla, raporlu eksik görünmez, sonraki aylarda telafi edilmez
  const kopya = x => JSON.parse(JSON.stringify(x));
  const yerineGecir = (v, g, cikId, yerId, kayit = true) => {
    const d = v.schedules[`${Y}-${M}`].days[g - 1], i = d.assigned.findIndex(p => p.id === cikId), k = v.staff.find(s => s.id === yerId);
    d.assigned[i] = { id: k.id, name: k.name, role: k.role }; d.locked = true;
    v.puantaj[`${Y}-${M}`] = { ...(v.puantaj[`${Y}-${M}`] || {}), [cikId]: { [g]: "R" }, [yerId]: { [g]: "N" } };
    if (kayit) (v.degisimler ??= []).push({ id: v.degisimler.length + 1, zaman: 0, y: Y, m: M, gun: g, cik: cikId, yer: yerId, cikAd: "", yerAd: k.name, cikOnce: null, yerOnce: null, cikYeni: "R", yerYeni: "N", gorev: "N", zorunlu: true, sebep: "R" });
  };
  const yer = yerineAdaylarHesapla(veri, Y, M, 5, cik, "N", true)[0].id;

  test("sonraki ay, yerine tutma hiç olmamış gibi yazılır (telafi yok)", () => {
    const v = kopya(veri); yerineGecir(v, 5, cik, yer);
    const asil = cizelgeOlustur(veri, Y, M + 1, { saat: () => 0 }).days, sonra = cizelgeOlustur(v, Y, M + 1, { saat: () => 0 }).days;
    expect(JSON.stringify(sonra)).toBe(JSON.stringify(asil));
    // kayıt olmadan (eski davranış) yerine tutan fazla sayılır ve sonraki ay farklı yazılır
    const v2 = kopya(veri); yerineGecir(v2, 5, cik, yer, false);
    expect(JSON.stringify(cizelgeOlustur(v2, Y, M + 1, { saat: () => 0 }).days)).not.toBe(JSON.stringify(asil));
  });

  test("yıllık raporda görev raporlu kişinin sayılır", () => {
    const v = kopya(veri); yerineGecir(v, 5, cik, yer);
    const a = yillikRaporHesapla(veri, Y).D, b = yillikRaporHesapla(v, Y).D;
    expect(a).toBeTruthy();
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  test("yerine tutma sırayla gelir: yerine tutmuş olan, tutmamışların arkasına geçer", () => {
    const v = kopya(veri); yerineGecir(v, 5, cik, yer);
    // başka bir günde, başka bir nöbetçinin raporu: ilk aday artık yerine tutmuş kişi olmaz
    const g2 = v.schedules[`${Y}-${M}`].days[19], cik2 = g2.assigned.find(p => p.id !== yer).id;
    const l = yerineAdaylarHesapla(v, Y, M, 20, cik2, "N", true), uygun = l.filter(a => !a.engel);
    const i = uygun.findIndex(a => a.id === yer);
    if (i >= 0) expect(uygun.slice(0, i).length).toBe(uygun.filter(a => a.yerine === 0).length);
    expect(uygun[0].yerine).toBe(0);
    expect(l.find(a => a.id === yer)?.yerine ?? 1).toBe(1);
  });
});
