// Tek tek kural testleri: kullanıcının netleştirdiği kurallar (elle düzenleme denetimi üzerinden).
import { describe, test, expect } from "vitest";
import { canliDenetimHesapla, cizelgeOlustur, gunuDenetle, uyariSiniflandir } from "../src/motor";
import { cizelgeUret } from "../src/motor/nobet/olustur";
import { Baglam } from "../src/motor/baglam";
import { fmFarkiYapisal } from "../src/motor/istatistik";
import { senaryo } from "./tarama/ortak";

const staff = [
  { id: 1, name: "E1", role: "eczaci" },
  { id: 2, name: "E2", role: "eczaci" },
  { id: 3, name: "E3", role: "eczaci" },
  { id: 4, name: "E4", role: "eczaci" },
  { id: 5, name: "E5", role: "eczaci" },
  { id: 6, name: "E6", role: "eczaci" },
  { id: 7, name: "D1", role: "nobetci" },
  { id: 8, name: "D2", role: "nobetci" },
  { id: 9, name: "T1", role: "teknisyen" },
  { id: 10, name: "T2", role: "teknisyen" },
  { id: 11, name: "T3", role: "teknisyen" },
  { id: 12, name: "T4", role: "teknisyen" },
];
const veri = { staff, prefs: {}, manualTatil: {}, arife: {}, settings: {}, schedules: {}, puantaj: {}, acil: {} };
const Y = 2026,
  M = 9; // Ekim 2026: 1 Perşembe, 2 Cuma, 3 Cumartesi, 4 Pazar, 5 Pazartesi
const sch = { year: Y, month: M, days: cizelgeOlustur(veri, Y, M, { saat: () => 0 }).days };
const ikiDisaridan = gun =>
  gunuDenetle(
    veri,
    sch,
    gun,
    [staff[6], staff[7]].map(s => ({ id: s.id, name: s.name, role: s.role })),
    [],
  ).filter(b => b.sev === "hata" && /İki kemoterapi eczacısı/.test(b.t));

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
    const gt = d => (new Date(2027, 0, d).getDay() + 6) % 7,
      say = {};
    r.days.forEach(g =>
      g.assigned.forEach(p => {
        const o = (say[p.id] ??= [0, 0, 0]);
        const w = gt(g.day);
        if (w >= 4) o[w - 4]++;
      }),
    );
    Object.values(say).forEach(o => expect(Math.max(...o)).toBeLessThanOrEqual(1));
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
    let duz = 0,
      ters = 0;
    r.days.forEach((g, i) =>
      g.prep.forEach(p => {
        if (r.days[i + 1] && r.days[i + 1].assigned.some(q => q.id === p.id)) duz++;
        if (i > 0 && r.days[i - 1].assigned.some(q => q.id === p.id)) ters++;
      }),
    );
    expect(ters).toBe(0);
    expect(duz).toBeGreaterThan(0);
    expect(eksik).toBeLessThan(7);
    expect(r.warnings.some(w => /hazırlamanın ertesi günü nöbet/.test(w))).toBe(true);
  });
});

describe("eş durumu isteyenler birlikte yazılamıyorsa biri yazılır", () => {
  // iki tekniker aynı gün eş durumu isterse ikisi birden yazılınca gün eczacısız kalır: biri yazılır (yıl içinde eş durumu
  // daha az karşılanan), öbür yer eczacının; diğerine uyarı çıkar
  const gun = 14,
    T1 = 9,
    T2 = 10;
  const kur = onceki => {
    const prefs = { [T1 + "-" + Y + "-" + M + "-" + gun]: "esVar", [T2 + "-" + Y + "-" + M + "-" + gun]: "esVar" };
    const schedules = {};
    if (onceki) {
      // Eylül'de T1'in eş durumu bir kez karşılanmış
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
    expect(
      g.assigned.some(p => ["eczaci", "nobetci"].includes(p.role)),
      "günde eczacı olmalı",
    ).toBe(true);
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

describe("çizelge her zaman en az uyarılı hâliyle oluşturulur", () => {
  // ilk aramada uyarı kalırsa farklı başlangıçlarla yeniden aranır, en az uyarılı olan seçilir. Küçük kadrolu 5.
  // senaryoda ilk arama 4 uyarı / kırmızı gün bırakıyor; ek denemelerle hiç kalmıyor
  const say = r => r.warnings.filter(w => uyariSiniflandir(w).seviye !== "bilgi").length + r.days.filter(g => g.conflict).length;
  test("ilk aramadan daha çok uyarılı olmaz; ek denemelerin en az uyarılısı seçilir", () => {
    const { y, m0, veri } = senaryo(5);
    const ilk = cizelgeUret(new Baglam(veri), y, m0, 0, () => 0),
      son = cizelgeOlustur(veri, y, m0, { saat: () => 0 });
    expect(say(ilk)).toBeGreaterThan(0);
    expect(say(son)).toBeLessThan(say(ilk));
  });
});

describe("çizelgenin o anki hâlinin denetimi (Kural denetimi paneli, onay)", () => {
  // elle düzenleme ya da "Otomatiğe bırak" sonrası oluşturma uyarıları yenilenmiyordu: eczacısız gün listede görünmüyordu
  const kopya = () => JSON.parse(JSON.stringify(sch));
  test("eczacısız ve eksik gün hata olarak listelenir", () => {
    const c = kopya();
    expect(canliDenetimHesapla(veri, c)).toEqual([]);
    c.days[4].assigned = [9, 10].map(id => ({ id, name: "T" + (id - 8), role: "teknisyen" })); // 5. gün: iki tekniker
    c.days[6].assigned = c.days[6].assigned.slice(0, 1); // 7. gün: tek kişi
    const l = canliDenetimHesapla(veri, c);
    expect(l.some(t => /^Nöbette eczacı yok: 5\. gün/.test(t))).toBe(true);
    expect(l.some(t => /eksik kişi: 7\. gün \(1\/2\)/.test(t))).toBe(true);
    l.forEach(t => expect(uyariSiniflandir(t).seviye).toBe("hata"));
    expect(uyariSiniflandir(l[0]).baslik).toBe("Eczacısız gün");
  });
  test("çizelgeden sonra izinli işaretlenen ya da raporlu görevli hata olarak listelenir", () => {
    const c = kopya(),
      p = c.days[4].assigned[0],
      h = c.days.find(g => g.prep.length);
    const v = { ...veri, prefs: { [`${p.id}-${Y}-${M}-5`]: "izinli" }, puantaj: { [`${Y}-${M}`]: { [h.prep[0].id]: { [h.day]: "R" } } } };
    const l = canliDenetimHesapla(v, c).filter(t => t.startsWith("İzinli ya da"));
    expect(l.length).toBe(1);
    expect(l[0]).toContain(`${p.name} (5. gün, nöbet)`);
    expect(l[0]).toContain(`${h.prep[0].name} (${h.day}. gün, hazırlama)`);
    expect(uyariSiniflandir(l[0])).toEqual({ seviye: "hata", baslik: "İzinli günde görev" });
  });
  test("karşılanmayan nöbet isteği uyarı olarak listelenir", () => {
    const c = kopya(),
      d = c.days.findIndex(g => !g.assigned.some(p => p.id === 3)) + 1;
    const v = { ...veri, prefs: { [`3-${Y}-${M}-${d}`]: "want" } };
    const l = canliDenetimHesapla(v, c);
    expect(l).toEqual([`Nöbet istediği güne yazılmayanlar: E3 (${d}. gün).`]);
    expect(uyariSiniflandir(l[0]).seviye).toBe("uyari");
  });
});

describe("eczacı az olduğunda fazla mesai / nöbet farkı", () => {
  // her gün en az bir eczacı nöbetçi: eczacılar teknikerlerden azsa iki grup arasındaki fark kapanamaz (kesin kural hatası değil)
  const kadro = (nE, nT) =>
    new Baglam({
      staff: [...Array(nE)]
        .map((_, i) => ({ id: i + 1, name: "E" + i, role: "eczaci" }))
        .concat([...Array(nT)].map((_, i) => ({ id: 100 + i, name: "T" + i, role: "teknisyen" }))),
    });
  const t = (e, tk) => Object.fromEntries([...e.map((x, i) => [i + 1, x]), ...tk.map((x, i) => [100 + i, x])]);
  test("gruplar kendi içinde eşitse fark yapısaldır", () => {
    expect(fmFarkiYapisal(kadro(2, 4), 2026, 9, t([72, 64], [48, 48, 56, 48]))).toBe(true);
  });
  test("eczacılar kendi içinde eşit değilse ya da eczacı az değilse yapısal sayılmaz", () => {
    expect(fmFarkiYapisal(kadro(2, 4), 2026, 9, t([80, 64], [48, 48, 56, 48]))).toBe(false);
    expect(fmFarkiYapisal(kadro(3, 3), 2026, 9, t([72, 64, 64], [48, 48, 48]))).toBe(false);
    expect(fmFarkiYapisal(kadro(2, 4), 2026, 9, t([48, 48], [72, 64, 64, 64]))).toBe(false);
  });
});

describe("tatil gününde elle sayı ve fazla mesai", () => {
  const ilkCumartesi = sch.days.findIndex(g => new Date(Y, M, g.day).getDay() === 6);
  test("yeniden oluşturmada gün düzeniyle korunur; eşitlik hesabına yazılan saat girer", () => {
    const g = JSON.parse(JSON.stringify(sch.days[ilkCumartesi]));
    const ek = staff.find(s => !g.assigned.some(p => p.id === s.id) && !g.prep.some(p => p.id === s.id) && s.role === "teknisyen");
    Object.assign(g, {
      locked: true,
      assigned: [...g.assigned, { id: ek.id, name: ek.name, role: ek.role }],
      nobetSay: 3,
      hazSay: 1,
      prep: g.prep.slice(0, 1),
      fmNobet: 30,
      fmHaz: 4,
      fazlaMesai: 30,
    });
    const days = sch.days.map((x, i) => (i === ilkCumartesi ? g : x));
    const v = { ...veri, schedules: { [`${Y}-${M}`]: { year: Y, month: M, days } } };
    const r = cizelgeOlustur(v, Y, M, { saat: () => 0 });
    const k = r.days[ilkCumartesi];
    expect(k).toMatchObject({ locked: true, nobetSay: 3, hazSay: 1, fmNobet: 30, fmHaz: 4, fazlaMesai: 30 });
    expect(k.assigned.length).toBe(3);
    // canlı denetim 3 kişiyi eksik saymaz; elle günün düzeni denetime girer
    expect(canliDenetimHesapla(v, { year: Y, month: M, days: r.days }).some(t => t.includes(k.day + ". gün ("))).toBe(false);
    const b = gunuDenetle(v, { year: Y, month: M, days: r.days }, k.day, k.assigned.slice(0, 2), [], {
      nobetSay: 3,
      hazSay: 1,
      fmNobet: 30,
    });
    expect(b.some(x => x.t === "Bu gün 3 nöbetçi olmalı; 1 yer boş.")).toBe(true);
    expect(b.some(x => x.t === "Bu gün 1 hazırlama personeli olmalı; 1 yer boş.")).toBe(true);
  });
});
