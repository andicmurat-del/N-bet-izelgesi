// Öğlen nöbeti: hafta içi, mesaide çalışanlardan; Pzt–Prş 2 eczacı + 1 tekniker, Cuma 3 eczacı + 2 tekniker; Cuma'dan
// muaf olan Cuma yazılmaz; haftada en fazla 2; yıl boyunca toplam ve Cuma sayısı eşit; nöbetçiye mümkünse yazılmaz.
import { describe, test, expect } from "vitest";
import SABIT from "./altin/oglen-cizelge.json";
import { oglenHesapla, oglenHaftaHesapla, oglenOnarimlariHesapla, oglenYillikHesapla, onayHaftasiHesapla, puantajHesapla } from "../src/motor";

const staff = [];
for (let i = 1; i <= 7; i++) staff.push({ id: i, name: "E" + i, role: "eczaci", ...(i === 7 ? { cumaMuaf: true } : {}) });
staff.push({ id: 8, name: "A1", role: "servis" });
for (let i = 1; i <= 5; i++) staff.push({ id: 8 + i, name: "T" + i, role: "teknisyen", ...(i === 5 ? { cumaMuaf: true } : {}) });
const veri = { staff, prefs: {}, manualTatil: {}, arife: {}, settings: {}, schedules: {}, puantaj: {}, acil: {}, oglen: {} };
// E2 Kasım'ın ikinci haftası yıllık izinde; 20 Kasım arife
for (let d = 9; d <= 13; d++) veri.prefs[`2-2026-10-${d}`] = "izinli";
veri.arife["2026-10-20"] = true;
const Y = 2026;
const hg = (m, d) => (new Date(Y, m, d).getDay() + 6) % 7;
const fark = v => Math.max(...v) - Math.min(...v);

// nöbet çizelgesi sabit kayıttan (test/altin/oglen-cizelge.json): öğlen kuralları nöbet motorundaki değişikliklerden
// bağımsız denetlenir. Kayıt bu verinin cizelgeOlustur çıktısıdır (yalnız kişi numaraları).
const kisi = id => { const s = staff.find(x => x.id === id); return { id, name: s.name, role: s.role }; };
function sabitCizelge(m) {
  return SABIT[m].map((g, i) => ({ day: i + 1, assigned: g.a.map(kisi), prep: g.p.map(kisi), conflict: g.c, locked: false, tatil: g.t }));
}
function ay(m) {
  veri.schedules[`${Y}-${m}`] = { year: Y, month: m, days: sabitCizelge(m) };
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
      g.e.forEach(id => expect(staff.find(s => s.id === id).role).toBe("eczaci"));
      g.t.forEach(id => expect(staff.find(s => s.id === id).role).toBe("teknisyen"));
      if (g.dw === 4) { expect(g.e).not.toContain(7); expect(g.t).not.toContain(13); }
    });
    // izinli haftasında E2 yok
    r.gunler.filter(g => g.gun >= 9 && g.gun <= 13).forEach(g => expect(g.e).not.toContain(2));
  });

  test("haftada en fazla 2; nöbetçiye yazma az", () => {
    const hf = {};
    r.gunler.forEach(g => [...g.e, ...g.t].forEach(id => { const k = Math.floor((g.gun - 1 + hg(10, 1)) / 7) + ":" + id; hf[k] = (hf[k] || 0) + 1; }));
    expect(Math.max(...Object.values(hf))).toBeLessThanOrEqual(2);
    const nob = r.gunler.reduce((t, g) => t + [...g.e, ...g.t].filter(id => g.nobetci.includes(id)).length, 0);
    // tek Cuma'dan muaf tekniker (T5) Pazartesi–Perşembe çoğu güne yazıldığı için nöbetçi olduğu günlere de düşebilir
    expect(nob).toBeLessThanOrEqual(6);
  });

  test("yıl boyu eşitlik: toplam ve Cuma; izinli günler paydan düşer (izinden dönen fazladan yazılmaz)", () => {
    ay(11);
    const Yl = oglenYillikHesapla(veri, Y, 11);
    const say = ids => ids.map(id => (Yl[id] || { top: 0 }).top);
    expect(fark(say([1, 3, 4, 5, 6, 7]))).toBeLessThanOrEqual(1);
    // E2 Kasım'da bir hafta izinliydi: o haftanın payı düşer, Aralık'ta kapatmaz (öbürlerinden az, en çok bir haftalık pay)
    const enAz = Math.min(...say([1, 3, 4, 5, 6, 7]));
    expect(Yl[2].top).toBeLessThan(enAz);
    expect(enAz - Yl[2].top).toBeLessThanOrEqual(2);
    expect(Yl[8]).toBeUndefined();   // acil servis personeli öğlen nöbetine yazılmaz
    // teknikerde Pazartesi–Perşembe Cuma'dan muaf olana (T5), Cuma öbürlerine; eşitlik iki grubun kendi içinde
    expect(fark(say([9, 10, 11, 12]))).toBeLessThanOrEqual(1);
    const tGun = { muaf: { h: 0, c: 0 }, diger: { h: 0, c: 0 } };
    for (const m of [10, 11]) Object.entries(veri.oglen[`${Y}-${m}`]).forEach(([d, k]) => k.t.forEach(id => {
      const a = id === 13 ? tGun.muaf : tGun.diger; if (hg(m, +d) === 4) a.c++; else a.h++; }));
    expect(tGun.muaf.c).toBe(0);
    expect(tGun.muaf.h).toBeGreaterThan(tGun.diger.h / 4 * 2);   // muaf haftada en çok 2; kalan Pzt–Prş öbür dördüne
    expect(fark([1, 2, 3, 4, 5, 6].map(id => Yl[id].cuma))).toBeLessThanOrEqual(1);
    expect(fark([9, 10, 11, 12].map(id => Yl[id].cuma))).toBeLessThanOrEqual(1);
    expect(Yl[7].cuma).toBe(0);
    expect(Yl[13].cuma).toBe(0);
  });

  test("mümkünse aynı kişi art arda iki Cuma yazılmaz", () => {
    const cumalar = [10, 11].flatMap(m => Object.entries(veri.oglen[`${Y}-${m}`]).filter(([d]) => hg(m, +d) === 4)
      .map(([d, k]) => ({ t: new Date(Y, m, +d).getTime(), ids: [...k.e, ...k.t] })));
    let tekrar = 0;
    for (let i = 1; i < cumalar.length; i++) if (cumalar[i].t - cumalar[i - 1].t === 7 * 864e5) tekrar += cumalar[i].ids.filter(id => cumalar[i - 1].ids.includes(id)).length;
    // kuraldan önce 7, kuralla 5. Cuma onay listesinde M1, M2 ve jokerlerden en az 2'si masada kaldığından bu küçük kadroda
    // (6 eczacı Cuma yazılabilir) Cuma öğlene yazılabilecek kişi 3–4'e iner; aynı kişiler daha sık denk gelir (9 eczacılı
    // gerçekçi kadroda 6 ayda 4 → 5)
    expect(tekrar).toBeLessThanOrEqual(7);
  });

  test("haftada iki alan eczacının iki öğlen nöbeti mümkünse art arda günlere düşmez", () => {
    let ard = 0, iki = 0;
    for (const m of [10, 11]) {
      const k = veri.oglen[`${Y}-${m}`], gunler = Object.keys(k).map(Number).sort((a, b) => a - b);
      for (let i = 1; i < gunler.length; i++) if (gunler[i] === gunler[i - 1] + 1) ard += k[gunler[i]].e.filter(id => k[gunler[i - 1]].e.includes(id)).length;
      iki += gunler.length;
    }
    expect(iki).toBeGreaterThan(0);
    // Kasım 12–13: E1'in o hafta nöbet dışı yalnız iki boş günü var (zorunlu); 25–26: Cuma eşitliği için kalır. Cuma
    // masa kuralı (M1, M2, jokerlerden en az 2'si masada) bu küçük kadroda Cuma'yı daralttığından 2 → 4
    expect(ard).toBeLessThanOrEqual(4);
  });

  test("haftada iki öğlen nöbeti sırayla: herkes bir kez iki almadan kimse yeniden iki almaz", () => {
    // haftalar Pazartesi'ye göre (ay geçişindeki hafta tek hafta sayılır)
    const hf = {};
    for (const m of [10, 11]) Object.entries(veri.oglen[`${Y}-${m}`]).forEach(([d, k]) => k.e.forEach(id => {
      const pzt = new Date(Y, m, +d - hg(m, +d)).getTime(); (hf[pzt] ??= {})[id] = (hf[pzt][id] || 0) + 1; }));
    const say = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 }, bozuk = [];
    for (const pzt of Object.keys(hf).sort((a, b) => a - b)) {
      const iki = Object.keys(hf[pzt]).filter(id => hf[pzt][id] > 1).map(Number), enAz = Math.min(...Object.values(say));
      expect(Math.max(...Object.values(hf[pzt]))).toBeLessThanOrEqual(2);
      const bekleyen = Object.keys(say).map(Number).filter(id => say[id] === enAz && !iki.includes(id));
      if (bekleyen.length && iki.some(id => say[id] > enAz)) bozuk.push(new Date(+pzt).toISOString().slice(0, 10));
      iki.forEach(id => say[id]++);
    }
    expect(bozuk).toEqual([]);
  });

  test("haftada herkese bir: o hafta yazılabilen biri hiç yazılmamışken kimse iki almaz", () => {
    const acik = [];
    for (const m of [10, 11]) {
      const G = puantajHesapla(veri, Y, m), kayit = veri.oglen[`${Y}-${m}`], hf = {}, yazilir = {};
      for (const [d, k] of Object.entries(kayit)) {
        const h = Math.floor((+d - 1 + hg(m, 1)) / 7);
        for (const grup of ["e", "t"]) {
          k[grup].forEach(id => { const kk = grup + h + ":" + id; hf[kk] = (hf[kk] || 0) + 1; });
          G.satirlar.filter(r => r.s.role === (grup === "e" ? "eczaci" : "teknisyen")).forEach(r => {
            const c = r.cells[+d - 1];
            // teknikerde Pazartesi–Perşembe muaf olmayan yalnız muaflar yetmezse yazılır: o güne sayılmaz
            if ((c.kod === "M" || c.kod === "N") && !(hg(m, +d) === 4 && r.s.cumaMuaf) && !(grup === "t" && hg(m, +d) < 4 && !r.s.cumaMuaf)) (yazilir[grup + h] ??= new Set()).add(r.s.id);
          });
        }
      }
      // ayın ilk ve son yarım haftası komşu aya taşar; yalnız ayın içindeki tam haftalar denetlenir
      for (const [gh, l] of Object.entries(yazilir)) {
        const h = +gh.slice(1); if (h === 0 || Object.keys(kayit).every(d => Math.floor((+d - 1 + hg(m, 1)) / 7) < h + 1)) continue;
        if (Object.keys(kayit).filter(d => Math.floor((+d - 1 + hg(m, 1)) / 7) === h).length < 5) continue;
        const iki = [...l].some(id => hf[gh + ":" + id] > 1);
        if (iki) l.forEach(id => { if (!hf[gh + ":" + id]) acik.push(`${m + 1}. ay ${h}. hafta: ${id}`); });
      }
    }
    expect(acik).toEqual([]);
  });

  test("aynı veriyle aynı sonuç", () => {
    expect(JSON.stringify(oglenHesapla(veri, Y, 11))).toBe(JSON.stringify(oglenHesapla(veri, Y, 11)));
  });

  test("Cuma: onay listesinde Masa 1, Masa 2, Masa 7 ve jokerlerden en az 2 eczacı masada kalır", () => {
    let cumaSay = 0;
    for (const m of [10, 11]) for (const [d, k] of Object.entries(veri.oglen[`${Y}-${m}`])) {
      if (hg(m, +d) !== 4) continue;
      const og = onayHaftasiHesapla(veri, Y, m, +d - 4).gunler[4];
      const grup = [og.masa[0], og.masa[1], og.masa[6], ...og.joker].filter(h => h?.id && !h.tekniker).map(h => h.id);
      const ogle = k.e.filter(id => grup.includes(id)).length;
      expect(ogle, `${+d}.${m + 1}: grup ${grup.join(",")}, öğlen ${k.e.join(",")}`).toBeLessThanOrEqual(Math.max(0, grup.length - 2));
      cumaSay++;
    }
    expect(cumaSay).toBeGreaterThan(5);
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

  // 3 Kasım 2026 Salı: 2 eczacı + 1 tekniker
  const gun3 = v => oglenHesapla(v, Y, 10).gunler.find(x => x.gun === 3);
  test("yalnız elle değiştirilen yer korunur; günün öteki yerleri yeniden yazılabilir", () => {
    const v = kopya(veri), once = v.oglen[ayK][3];
    const yeniTek = [9, 10, 11, 12].find(id => !once.t.includes(id));
    v.oglen[ayK][3] = { e: once.e, t: [yeniTek], sabit: { e: [], t: [yeniTek] } };
    const g = gun3(v);
    expect(g.t).toEqual([yeniTek]);
    expect(g.e.length).toBe(2);
    expect(g.sabit).toEqual({ e: [], t: [yeniTek] });
    // elle eczacı: o kişi kalır, öteki eczacı yeri yeniden yazılır
    v.oglen[ayK][3] = { e: [4, 5], t: once.t, sabit: { e: [4], t: [] } };
    expect(gun3(v).e).toContain(4);
  });

  test("elle boş bırakılan yer yeniden oluşturmada boş kalır", () => {
    const v = kopya(veri), once = v.oglen[ayK][3];
    v.oglen[ayK][3] = { e: once.e, t: [], sabit: { e: [], t: [], bt: 1 } };
    const g = gun3(v);
    expect(g.t).toEqual([]);
    expect(g.e.length).toBe(2);
    // onarım da boş yeri doldurmaz, elle yazılan kişiye dokunmaz
    expect(oglenOnarimlariHesapla(v, 20261101).every(o => o.gunler.find(x => x.gun === 3).t.length === 0)).toBe(true);
  });

  test("onarım elle yazılan kişiyi değiştirmez, öteki yerleri onarır", () => {
    const v = kopya(veri), k = v.oglen[ayK][5];
    const [a, b] = k.e;
    v.oglen[ayK][5] = { ...k, sabit: { e: [a], t: [] } };
    v.prefs[`${a}-${Y}-10-5`] = "izinli"; v.prefs[`${b}-${Y}-10-5`] = "izinli";
    const o = oglenOnarimlariHesapla(v, 20261101), g = o[0].gunler.find(x => x.gun === 5);
    expect(g.e).toContain(a);
    expect(g.e).not.toContain(b);
    expect(g.e.length).toBe(2);
  });
});

describe("öğlen nöbeti haftalık oluşturulur", () => {
  // Kasım ve Aralık çizelgeleri kayıtlı; öğlen nöbeti hafta hafta yazılır
  const kopya = x => JSON.parse(JSON.stringify(x));
  const bos = () => { const v = kopya(veri); v.schedules[`${Y}-10`] = { year: Y, month: 10, days: sabitCizelge(10) }; v.schedules[`${Y}-11`] = { year: Y, month: 11, days: sabitCizelge(11) }; v.oglen = {}; return v; };
  const yaz = (v, p) => p.forEach(x => { const a = (v.oglen[`${x.y}-${x.m}`] ??= {}); x.gunler.forEach(g => { a[g.gun] = { e: g.e, t: g.t }; }); });

  test("yalnız seçilen haftanın günleri yazılır; öteki haftalar kayıtsız kalır", () => {
    const v = bos(), r = oglenHaftaHesapla(v, Y, 10, 9);
    expect(r.parcalar.map(p => [p.m, p.bas, p.bit])).toEqual([[10, 9, 13]]);
    expect(r.parcalar[0].gunler.map(g => g.gun)).toEqual([9, 10, 11, 12, 13]);
    r.parcalar[0].gunler.forEach(g => expect(g.e.length).toBe(g.dw === 4 ? 3 : 2));
  });

  test("ay sınırını aşan hafta iki parça: ikinci parça birincinin haftalık sayısını görür", () => {
    const v = bos(), r = oglenHaftaHesapla(v, Y, 10, 30);   // 30 Kasım – 4 Aralık
    expect(r.parcalar.map(p => [p.m, p.bas, p.bit])).toEqual([[10, 30, 30], [11, 1, 4]]);
    const hf = {};
    r.parcalar.flatMap(p => p.gunler).forEach(g => [...g.e, ...g.t].forEach(id => { hf[id] = (hf[id] || 0) + 1; }));
    expect(Math.max(...Object.values(hf))).toBeLessThanOrEqual(2);
    // ay geçişinde de aynı kişi art arda iki güne (30 Kasım, 1 Aralık) yazılmaz
    const [p1, p2] = r.parcalar, g30 = p1.gunler[0], g1 = p2.gunler.find(g => g.gun === 1);
    expect([...g30.e, ...g30.t].filter(id => [...g1.e, ...g1.t].includes(id))).toEqual([]);
  });

  test("önceki haftalar değişmez ve eşitliğe sayılır; hafta hafta yazınca yıl eşitliği korunur", () => {
    const v = bos();
    for (const d of [2, 9, 16, 23]) yaz(v, oglenHaftaHesapla(v, Y, 10, d).parcalar);
    const once = kopya(v.oglen[`${Y}-10`]);
    yaz(v, oglenHaftaHesapla(v, Y, 10, 30).parcalar);
    for (const d of Object.keys(once)) expect(v.oglen[`${Y}-10`][d]).toEqual(once[d]);
    for (const d of [7, 14, 21, 28]) yaz(v, oglenHaftaHesapla(v, Y, 11, d).parcalar);
    // Kasım–Aralık sonunda (E2 bir hafta izinli, E7 Cuma'dan muaf; aylık oluşturmadaki kadar eşit)
    const Yl = oglenYillikHesapla(v, Y, 11), say = ids => ids.map(id => (Yl[id] || { top: 0 }).top);
    expect(fark(say([1, 3, 4, 5, 6, 7]))).toBeLessThanOrEqual(1);
    expect(fark(say([9, 10, 11, 12]))).toBeLessThanOrEqual(1);
  });

  test("onarım hiç oluşturulmamış haftayı doldurmaz", () => {
    const v = bos();
    yaz(v, oglenHaftaHesapla(v, Y, 10, 9).parcalar);
    const o = oglenOnarimlariHesapla(v, 20261101);
    expect(o).toEqual([]);
    const kim = v.oglen[`${Y}-10`][10].e[0];
    v.prefs[`${kim}-${Y}-10-10`] = "izinli";
    const o2 = oglenOnarimlariHesapla(v, 20261101);
    expect(o2[0].gunler.map(g => g.gun)).toEqual([9, 10, 11, 12, 13]);
    expect(o2[0].gunler.find(g => g.gun === 10).e).not.toContain(kim);
  });
});
