// Tek tek kural testleri: kullanıcının netleştirdiği kurallar (elle düzenleme denetimi üzerinden).
import { describe, test, expect } from "vitest";
import { canliDenetimHesapla, cizelgeOlustur, gunuDenetle, uyariSiniflandir } from "../src/motor";
import { cizelgeUret } from "../src/motor/nobet/olustur";
import { Baglam } from "../src/motor/baglam";
import { senaryo } from "./tarama/ortak";

const staff = [
  { id: 1, name: "E1", role: "eczaci" }, { id: 2, name: "E2", role: "eczaci" }, { id: 3, name: "E3", role: "eczaci" },
  { id: 4, name: "E4", role: "eczaci" }, { id: 5, name: "E5", role: "eczaci" }, { id: 6, name: "E6", role: "eczaci" },
  { id: 7, name: "D1", role: "nobetci" }, { id: 8, name: "D2", role: "nobetci" },
  { id: 9, name: "T1", role: "teknisyen" }, { id: 10, name: "T2", role: "teknisyen" }, { id: 11, name: "T3", role: "teknisyen" }, { id: 12, name: "T4", role: "teknisyen" },
];
const veri = { staff, prefs: {}, manualTatil: {}, arife: {}, settings: {}, schedules: {}, puantaj: {}, acil: {} };
const Y = 2026, M = 9;   // Ekim 2026: 1 Perşembe, 2 Cuma, 3 Cumartesi, 4 Pazar, 5 Pazartesi
const sch = { year: Y, month: M, days: cizelgeOlustur(veri, Y, M, { saat: () => 0 }).days };
const ikiDisaridan = gun => gunuDenetle(veri, sch, gun, [staff[6], staff[7]].map(s => ({ id: s.id, name: s.name, role: s.role })), [])
  .filter(b => b.sev === "hata" && /İki kemoterapi eczacısı/.test(b.t));

describe("iki kemoterapi eczacısı aynı gün", () => {
  test("Cuma ve Cumartesi birlikte nöbetçi olabilir", () => {
    expect(ikiDisaridan(2)).toEqual([]);
    expect(ikiDisaridan(3)).toEqual([]);
  });
  test("diğer günlerde birlikte nöbetçi olmaz", () => {
    expect(ikiDisaridan(4).length).toBe(1);
    expect(ikiDisaridan(5).length).toBe(1);
    expect(ikiDisaridan(1).length).toBe(1);
  });
});

describe("Cuma + Cumartesi + Pazar kesin kural değil", () => {
  // Ocak 2027: 5 Cuma, 5 Cumartesi, 5 Pazar; 1 Ocak resmi tatil. 7 eczacıya 15 yer düşer: herkes 1 Cuma'yı geçmesin diye
  // biri Cuma + Cumartesi + Pazar alır (eskiden bu kesin kuraldı ve yıllık Cuma eşitliği uyarısı çıkıyordu)
  const kadro = [];
  for (let i = 1; i <= 7; i++) kadro.push({ id: i, name: "E" + i, role: "eczaci" });
  for (let i = 1; i <= 7; i++) kadro.push({ id: 7 + i, name: "T" + i, role: "teknisyen" });
  for (let i = 1; i <= 3; i++) kadro.push({ id: 14 + i, name: "D" + i, role: "destek" });
  const v = { staff: kadro, prefs: {}, manualTatil: { "2027-0-1": true }, arife: {}, settings: {}, schedules: {}, puantaj: {}, acil: {} };
  test("uyarı yok; herkes en fazla 1 Cuma, 1 Cumartesi, 1 Pazar", () => {
    const r = cizelgeOlustur(v, 2027, 0, { saat: () => 0 });
    expect(r.warnings).toEqual([]);
    const gt = d => (new Date(2027, 0, d).getDay() + 6) % 7, say = {};
    r.days.forEach(g => g.assigned.forEach(p => { const o = (say[p.id] ??= [0, 0, 0]); const w = gt(g.day); if (w >= 4) o[w - 4]++; }));
    Object.values(say).forEach(o => expect(Math.max(...o)).toBeLessThanOrEqual(1));
  });
});

describe("Cuma + Cumartesi + Pazar nöbeti olan hazırlamayı grubunda en son alır", () => {
  // gerçekçi kadrolu rastgele senaryo (≥6 eczacı, ≥4 tekniker, izinler, tercihler); 49. senaryonun ilk ayında kural
  // eklenmeden önce üçlü nöbetli bir eczacı grubundaki birinden fazla hazırlama alıyordu
  test("üçlü nöbetli, grubundaki herkesten fazla hazırlama almaz", () => {
    const { y, m0, veri } = senaryo(49, { eczaci: [6, 8], teknisyen: [4, 8] });
    const r = cizelgeOlustur(veri, y, m0, { saat: () => 0 }), B = new Baglam(veri);
    const gt = d => (new Date(y, m0, d).getDay() + 6) % 7, o = {};
    veri.staff.filter(s => ["eczaci", "teknisyen", "nobetci"].includes(s.role) && r.days.some(g => g.tatil && !B.kesinYasak(s.id, y, m0, g.day)))
      .forEach(s => { o[s.id] = { g: s.role === "teknisyen" ? "T" : "E", cu: 0, ct: 0, pz: 0, h: 0 }; });
    r.days.forEach(g => { g.assigned.forEach(p => { const q = o[p.id], w = gt(g.day); if (!q) return; if (w === 4) q.cu++; if (w === 5) q.ct++; if (w === 6) q.pz++; }); g.prep.forEach(p => { if (o[p.id]) o[p.id].h++; }); });
    const uclu = q => q.cu > 0 && q.ct > 0 && q.pz > 0;
    let ucluVar = false;
    for (const g of ["E", "T"]) {
      const grup = Object.values(o).filter(q => q.g === g), diger = grup.filter(q => !uclu(q));
      if (!diger.length) continue;
      const enAz = Math.min(...diger.map(q => q.h));
      grup.filter(uclu).forEach(q => { ucluVar = true; expect(q.h).toBeLessThanOrEqual(enAz); });
    }
    expect(ucluVar, "senaryoda Cuma + Cumartesi + Pazar nöbeti olan biri bulunmalı").toBe(true);
  });
});

describe("kadro yetmezse önce hazırlama ertesi gün nöbet esner", () => {
  // 4 eczacı + 3 tekniker: hafta sonu için 8 farklı kişi gerekir, 7 kişi var. Hazırlamacı ertesi gün nöbet tutabilince
  // (Cumartesi hazırlama, Pazar nöbet) yerler dolar. Ters yön (nöbet ertesi gün hazırlama) bu ayda olmaz: nöbet ertesi
  // dinlenilir (kadronun yetmediği bazı aylarda zorunlu kalabilir; ör. Ocak 2027). Bu kural eklenmeden önce Ocak 2027'de
  // 7 tatil gününde hazırlama eksik kalıyordu; Mart 2027'de 4.
  const kadro = [];
  for (let i = 1; i <= 4; i++) kadro.push({ id: i, name: "E" + i, role: "eczaci" });
  for (let i = 1; i <= 3; i++) kadro.push({ id: 4 + i, name: "T" + i, role: "teknisyen" });
  const v = { staff: kadro, prefs: {}, manualTatil: {}, arife: {}, settings: {}, schedules: {}, puantaj: {}, acil: {} };
  test("eksik hazırlama azalır, nöbet ertesi hazırlama olmaz", () => {
    const r = cizelgeOlustur(v, 2027, 2, { saat: () => 0 });
    const eksik = r.days.filter(g => g.tatil && g.prep.length < 2).length;
    let duz = 0, ters = 0;
    r.days.forEach((g, i) => g.prep.forEach(p => {
      if (r.days[i + 1] && r.days[i + 1].assigned.some(q => q.id === p.id)) duz++;
      if (i > 0 && r.days[i - 1].assigned.some(q => q.id === p.id)) ters++;
    }));
    expect(ters).toBe(0);
    expect(duz).toBeGreaterThan(0);
    expect(eksik).toBeLessThan(7);
    expect(r.warnings.some(w => /hazırlamanın ertesi günü nöbet/.test(w))).toBe(true);
  });
});

describe("eş durumu isteyenler birlikte yazılamıyorsa biri yazılır", () => {
  // iki tekniker aynı gün eş durumu isterse ikisi birden yazılınca gün eczacısız kalır: biri yazılır (yıl içinde eş durumu
  // daha az karşılanan), öbür yer eczacının; diğerine uyarı çıkar
  const gun = 14, T1 = 9, T2 = 10;
  const kur = (onceki) => {
    const prefs = { [T1 + "-" + Y + "-" + M + "-" + gun]: "esVar", [T2 + "-" + Y + "-" + M + "-" + gun]: "esVar" };
    const schedules = {};
    if (onceki) {   // Eylül'de T1'in eş durumu bir kez karşılanmış
      prefs[T1 + "-" + Y + "-" + (M - 1) + "-10"] = "esVar";
      const days = cizelgeOlustur({ ...veri, prefs }, Y, M - 1, { saat: () => 0 }).days;
      expect(days[9].assigned.some(p => p.id === T1)).toBe(true);
      schedules[Y + "-" + (M - 1)] = { year: Y, month: M - 1, days };
    }
    const v = { ...veri, prefs, schedules };
    return { v, r: cizelgeOlustur(v, Y, M, { saat: () => 0 }) };
  };
  const bak = ({ v, r }, yazilan, yazilmayan) => {
    const g = r.days[gun - 1];
    expect(g.assigned.some(p => ["eczaci", "nobetci"].includes(p.role)), "günde eczacı olmalı").toBe(true);
    expect(g.assigned.some(p => p.id === yazilan)).toBe(true);
    expect(g.assigned.some(p => p.id === yazilmayan)).toBe(false);
    expect(g.conflict).toBe(false);
    expect(r.warnings.some(w => /birlikte yazılamıyor/.test(w))).toBe(true);
    // elle düzenleme denetimi de yazılmayan için hata değil uyarı verir
    const bul = gunuDenetle(v, { year: Y, month: M, days: r.days }, gun, g.assigned, g.prep).filter(b => /eş durumu/.test(b.t));
    expect(bul.map(b => b.sev)).toEqual(["uyari"]);
  };
  test("yıl içinde eşitse ilk sıradaki yazılır", () => bak(kur(false), T1, T2));
  test("yıl içinde eş durumu daha az karşılanan yazılır", () => bak(kur(true), T2, T1));
});

describe("ay içinde ayrılan kişinin nöbetleri kalan günlere sığdırılır", () => {
  // ayrılacağı baştan belliyse (en az 15 gün çalışıyorsa) o ayın nöbetlerini ayrılmadan önce herkes kadar tutar;
  // eskiden ayrılan aylık eşitliğe girmiyordu ve Kasım 2026'da 4 nöbet alıyordu (diğerleri 6–7)
  // fazla mesai farkı grup içinde ölçüldüğünden (eczacılar / teknikerler) ayrılan kişi kalan günlerine sığan en fazla
  // saati alır (amaçta eksik saat başına ceza); 5 eczacı + 5 teknikerde herkesin en azı kadar
  test("15'inde ayrılan, ayın tamamında çalışanların en azından az nöbet almaz", () => {
    const kadro = [];
    for (let i = 1; i <= 5; i++) kadro.push({ id: i, name: "E" + i, role: "eczaci" });
    for (let i = 1; i <= 5; i++) kadro.push({ id: 5 + i, name: "T" + i, role: "teknisyen" });
    kadro[0].bitis = "2026-11-15";
    const v = { staff: kadro, prefs: {}, manualTatil: {}, arife: {}, settings: {}, schedules: {}, puantaj: {}, acil: {} };
    const r = cizelgeOlustur(v, 2026, 10, { saat: () => 0 }), n = {};
    r.days.forEach(g => g.assigned.forEach(p => { n[p.id] = (n[p.id] || 0) + 1; }));
    expect(r.days.slice(15).some(g => g.assigned.some(p => p.id === 1))).toBe(false);
    expect(n[1]).toBeGreaterThanOrEqual(Math.min(...kadro.slice(1).map(s => n[s.id] || 0)));
    expect(r.warnings).toEqual([]);
  });
});

describe("çizelge her zaman en az uyarılı hâliyle oluşturulur", () => {
  // ilk aramada uyarı kalırsa farklı başlangıçlarla yeniden aranır, en az uyarılı olan seçilir. Gerçekçi kadrolu 25.
  // senaryoda ilk arama 3 uyarı / kırmızı gün bırakıyor; ek denemelerden biri uyarısız
  const say = r => r.warnings.filter(w => uyariSiniflandir(w).seviye !== "bilgi").length + r.days.filter(g => g.conflict).length;
  test("ilk aramadan daha çok uyarılı olmaz; uyarısızı bulunursa o seçilir", () => {
    const { y, m0, veri } = senaryo(25, { eczaci: [6, 8], teknisyen: [4, 8] });
    const ilk = cizelgeUret(new Baglam(veri), y, m0, 0, () => 0), son = cizelgeOlustur(veri, y, m0, { saat: () => 0 });
    expect(say(ilk)).toBeGreaterThan(0);
    expect(say(son)).toBe(0);
  });
});

describe("fazla mesai farkı eczacılar ve teknikerler arasında ayrı ölçülür", () => {
  // 7 eczacı + 13 tekniker: her gün bir eczacı nöbetçi olduğundan eczacılar teknikerlerden çok fazla mesai yapar (kadro
  // yapısı). Kural iki grubun kendi içinde uygulanır; eskiden herkes birlikte ölçülüyor, Ocak 2027'de 40 saat fark ve
  // KESİN KURAL uyarısı çıkıyordu
  test("Ocak 2027: grup içinde fark en fazla 8 saat, KESİN KURAL uyarısı yok", () => {
    const kadro = [];
    for (let i = 1; i <= 7; i++) kadro.push({ id: i, name: "E" + i, role: "eczaci" });
    for (let i = 1; i <= 13; i++) kadro.push({ id: 7 + i, name: "T" + i, role: "teknisyen" });
    const v = { staff: kadro, prefs: {}, manualTatil: {}, arife: {}, settings: {}, schedules: {}, puantaj: {}, acil: {} };
    let t = 0; const r = cizelgeOlustur(v, 2027, 0, { saat: () => (t += 500) }), fm = {};
    const hz = 8;
    r.days.forEach(g => { g.assigned.forEach(p => { fm[p.id] = (fm[p.id] || 0) + g.fazlaMesai; }); g.prep.forEach(p => { fm[p.id] = (fm[p.id] || 0) + hz; }); });
    const fark = ids => Math.max(...ids.map(id => fm[id] || 0)) - Math.min(...ids.map(id => fm[id] || 0));
    expect(fark(kadro.filter(s => s.role === "eczaci").map(s => s.id))).toBeLessThanOrEqual(8);
    expect(fark(kadro.filter(s => s.role === "teknisyen").map(s => s.id))).toBeLessThanOrEqual(8);
    expect(r.warnings.filter(w => /KESİN KURAL/.test(w))).toEqual([]);
    // iki grubun ortalaması arasındaki fark kadro yapısından 8 saati aşar: uyarı değil bilgi notu
    const ortNot = r.warnings.filter(w => /fazla mesai ortalaması/.test(w));
    expect(ortNot.length).toBe(1);
    expect(uyariSiniflandir(ortNot[0])).toEqual({ seviye: "bilgi", baslik: "Eczacı / tekniker ortalaması" });
  }, 120000);
  test("dengeli kadroda eczacı ve tekniker ortalamaları arasında fark en fazla 8 saat", () => {
    const kadro = [];
    for (let i = 1; i <= 8; i++) kadro.push({ id: i, name: "E" + i, role: "eczaci" });
    for (let i = 1; i <= 8; i++) kadro.push({ id: 8 + i, name: "T" + i, role: "teknisyen" });
    const v = { staff: kadro, prefs: {}, manualTatil: {}, arife: {}, settings: {}, schedules: {}, puantaj: {}, acil: {} };
    let t = 0; const r = cizelgeOlustur(v, 2026, 10, { saat: () => (t += 500) }), fm = {};
    r.days.forEach(g => { g.assigned.forEach(p => { fm[p.id] = (fm[p.id] || 0) + g.fazlaMesai; }); g.prep.forEach(p => { fm[p.id] = (fm[p.id] || 0) + 8; }); });
    const ort = rol => { const l = kadro.filter(s => s.role === rol); return l.reduce((a, s) => a + (fm[s.id] || 0), 0) / l.length; };
    expect(Math.abs(ort("eczaci") - ort("teknisyen"))).toBeLessThanOrEqual(8);
    expect(r.warnings.filter(w => /fazla mesai ortalaması/.test(w))).toEqual([]);
  }, 120000);
});

describe("çizelgenin o anki hâlinin denetimi (Kural denetimi paneli, onay)", () => {
  // elle düzenleme ya da "Otomatiğe bırak" sonrası oluşturma uyarıları yenilenmiyordu: eczacısız gün listede görünmüyordu
  const kopya = () => JSON.parse(JSON.stringify(sch));
  test("eczacısız ve eksik gün hata olarak listelenir", () => {
    const c = kopya();
    expect(canliDenetimHesapla(veri, c)).toEqual([]);
    c.days[4].assigned = [9, 10].map(id => ({ id, name: "T" + (id - 8), role: "teknisyen" }));   // 5. gün: iki tekniker
    c.days[6].assigned = c.days[6].assigned.slice(0, 1);                                          // 7. gün: tek kişi
    const l = canliDenetimHesapla(veri, c);
    expect(l.some(t => /^Nöbette eczacı yok: 5\. gün/.test(t))).toBe(true);
    expect(l.some(t => /eksik kişi: 7\. gün \(1\/2\)/.test(t))).toBe(true);
    l.forEach(t => expect(uyariSiniflandir(t).seviye).toBe("hata"));
    expect(uyariSiniflandir(l[0]).baslik).toBe("Eczacısız gün");
  });
  test("karşılanmayan nöbet isteği uyarı olarak listelenir", () => {
    const c = kopya(), d = c.days.findIndex(g => !g.assigned.some(p => p.id === 3)) + 1;
    const v = { ...veri, prefs: { [`3-${Y}-${M}-${d}`]: "want" } };
    const l = canliDenetimHesapla(v, c);
    expect(l).toEqual([`Nöbet istediği güne yazılmayanlar: E3 (${d}. gün).`]);
    expect(uyariSiniflandir(l[0]).seviye).toBe("uyari");
  });
});
