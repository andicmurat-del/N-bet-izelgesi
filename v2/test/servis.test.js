// Servis hazırlama: yeni motor, eski uygulamanın aynı girdiyle ürettiği dağıtımı birebir üretmeli
// (servis-beklenen.json; eski uygulama tarayıcıda çalıştırılıp kaydedildi). Fark: eski uygulama yük dengesini yıl boyunca
// taşıyordu, yenisi her ayı kendi içinde dengeler; bu yüzden birebir karşılaştırma yalnız ilk ay (Ekim) için.
// Ayrıca günlük kurallar ve kayıt davranışı.
import { describe, test, expect } from "vitest";
import { createRequire } from "module";
import { servisAyHesapla, servisIslem, servisGunu, servisListesi } from "../src/motor/cizelge.js";

const require = createRequire(import.meta.url);
const { girdi, beklenen, bugun } = require("./servis-beklenen.json");
const kopya = o => JSON.parse(JSON.stringify(o));

const veri = kopya(girdi);
veri.servisKayit = {};
for (const ay of [9, 10]) veri.servisKayit["2026-" + ay] = servisAyHesapla(veri, 2026, ay, {}, bugun).kayit;

describe("servis hazırlama, eski uygulamayla aynı", () => {
  test("2026-10", () => {
    const R = veri.servisKayit["2026-9"];
    expect(Object.keys(R.gun).sort()).toEqual(Object.keys(beklenen[9]).sort());
    for (const [d, g] of Object.entries(beklenen[9])) expect({ gun: d, k: R.gun[d].k, n: R.gun[d].n, a: R.gun[d].a }).toEqual({ gun: d, ...g });
  });
  test("her ay kendi içinde dengelenir: Ekim dağıtımı Kasım'ı etkilemez", () => {
    const v = kopya(veri);
    delete v.servisKayit["2026-9"];
    const yalniz = servisAyHesapla(v, 2026, 10, {}, bugun).kayit.gun, ozet = G => Object.fromEntries(Object.entries(G).map(([d, g]) => [d, [g.k, g.n, g.a]]));
    expect(ozet(yalniz)).toEqual(ozet(veri.servisKayit["2026-10"].gun));
    // eski uygulama Ekim'i Kasım'a taşıdığı için Kasım'ın en az bir günü ondan farklı
    expect(Object.entries(beklenen[10]).some(([d, g]) => JSON.stringify(veri.servisKayit["2026-10"].gun[d].a) !== JSON.stringify(g.a))).toBe(true);
  });
});

describe("servis hazırlama kuralları", () => {
  const svc = new Map(servisListesi(veri).map(s => [s.name, s]));
  test("her gün kişi başı servis, YB ve zor servis sayısı en çok 1 farklı", () => {
    for (const ay of [9, 10]) for (const g of Object.values(veri.servisKayit["2026-" + ay].gun)) {
      const say = {}, yb = {}, zor = {};
      g.k.forEach(id => { say[id] = 0; yb[id] = 0; zor[id] = 0; });
      for (const [sn, id] of Object.entries(g.a)) { say[id]++; if (/\sYB$/.test(sn)) yb[id]++; if (svc.get(sn)?.zor) zor[id]++; }
      for (const t of [say, yb, zor]) { const v = Object.values(t); expect(Math.max(...v) - Math.min(...v)).toBeLessThanOrEqual(1); }
    }
  });
  test("girdi değişmezse yeniden hesap kaydı değiştirmez", () => {
    expect(servisAyHesapla(veri, 2026, 10, {}, bugun).degisti).toBe(false);
  });
  test("puantaj değişince geçmiş günler korunur (29 Ekim resmi tatil), bugün ve sonrası yeniden dağıtılır", () => {
    const v = kopya(veri), once = v.servisKayit["2026-9"];
    const kisi = once.gun[30].k[0];
    v.puantaj["2026-9"] = { ...(v.puantaj["2026-9"] || {}), [kisi]: { 5: "R", 30: "R" } };
    const R = servisAyHesapla(v, 2026, 9, {}, bugun).kayit;
    expect(R.gun[5].a).toEqual(once.gun[5].a);          // geçmiş gün olduğu gibi
    expect(R.gun[5].bayat).toBe(1);                       // ama değiştiği işaretlenir
    expect(R.gun[30].k).not.toContain(kisi);              // bugünden sonraki gün yeniden dağıtıldı
  });
  test("kişi dağıtımdan çıkarılınca o gün servis almaz; elle atama yeniden hesapta korunur", () => {
    const v = kopya(veri), d = 28, R0 = v.servisKayit["2026-9"].gun[d];
    const cik = R0.k[0];
    v.servisKayit["2026-9"] = servisIslem(v, 2026, 9, { tur: "kisi", gun: d, id: cik }, bugun);
    expect(v.servisKayit["2026-9"].gun[d].k).not.toContain(cik);
    expect(servisGunu(v, 2026, 9, d, bugun).kisiler.find(k => k.id === cik).on).toBe(false);
    const g = v.servisKayit["2026-9"].gun[d], sn = Object.keys(g.a)[0], hedef = g.k.find(id => id !== g.a[sn]);
    v.servisKayit["2026-9"] = servisIslem(v, 2026, 9, { tur: "ata", gun: d, sn, hedef, karsilik: null }, bugun);
    v.servisKayit["2026-9"] = servisIslem(v, 2026, 9, { tur: "karistir", gun: 30 }, bugun);
    expect(v.servisKayit["2026-9"].gun[d].a[sn]).toBe(hedef);
    expect(v.servisKayit["2026-9"].ata[d][sn]).toBe(hedef);
  });
  test("ay boyunca izin girdikçe yeniden dağıtılsa da günlük yük ve aylık servis tekrarı dengeli kalır", () => {
    // gerçek kullanım: her gün açılır, araya izinler girer, geçmiş günler donar. Eskiden yeniden hesapta önceki liste
    // korunduğu için günlük yük farkı ortalama %13'e, aynı servisin kişiler arası farkı 3'e çıkıyordu.
    const v = kopya(girdi); v.servisKayit = {};
    const olay = { 3: [10, [5, 6, 7]], 9: [12, [12, 13, 14, 15, 16]], 15: [8, [19, 20]], 22: [11, [23, 26, 27]], 26: [7, [28, 30]] };
    for (let d = 1; d <= 31; d++) {
      if (olay[d]) { const [id, gunler] = olay[d], P = (v.puantaj["2026-9"] ??= {}); P[id] = { ...(P[id] || {}) }; gunler.forEach(g => { P[id][g] = "YI"; }); }
      v.servisKayit["2026-9"] = servisAyHesapla(v, 2026, 9, {}, 20261000 + d).kayit;
    }
    const gunler = Object.values(v.servisKayit["2026-9"].gun), fark = [], say = {};
    for (const g of gunler) {
      const l = g.k.map(id => g.l[id]), ort = l.reduce((a, b) => a + b, 0) / l.length;
      fark.push((Math.max(...l) - Math.min(...l)) / ort);
      for (const [sn, id] of Object.entries(g.a)) { say[sn] ??= {}; g.k.forEach(k => { say[sn][k] ??= 0; }); say[sn][id]++; }
    }
    expect(fark.reduce((a, b) => a + b, 0) / fark.length).toBeLessThan(0.05);
    for (const sn in say) { const n = Object.values(say[sn]); expect(Math.max(...n) - Math.min(...n)).toBeLessThanOrEqual(2); }
  });
});
