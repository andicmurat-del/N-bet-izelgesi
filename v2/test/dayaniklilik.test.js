// Dayanıklılık (fuzz): yedek dosyası rastgele bozulsa da (eksik alan, yanlış tür, saçma sayı) yükleme çökmez ve motorun
// tüm hesapları doğrulanmış veriyle çalışır. Bozulmalar sabit tohumla üretilir (her çalıştırmada aynı).
import { describe, test, expect } from "vitest";
import { veriyiDogrula } from "../src/veri/depo.svelte.ts";
import {
  cizelgeOlustur, puantajHesapla, oglenHesapla, acilHesapla, onayHaftasiHesapla, yillikRaporHesapla, calismaListesiHesapla,
  acilOglenRaporuHesapla, yerineAdaylarHesapla, acilYerineAdaylarHesapla, oglenYillikHesapla, acilSorunluGunler,
} from "../src/motor";
import { veriKur } from "./altin/senaryo.js";

const Y = 2026, M = 0;
function tabanVeri() {
  const v = veriKur();
  v.schedules[`${Y}-${M}`] = { year: Y, month: M, days: cizelgeOlustur(v, Y, M, { saat: () => 0 }).days };
  v.oglen = { [`${Y}-${M}`]: Object.fromEntries(oglenHesapla(v, Y, M).gunler.map(g => [g.gun, { e: g.e, t: g.t }])) };
  const ecz = v.staff.filter(s => s.role === "eczaci");
  v.onayMasa = { yerlesim: { "2026-01-05": Object.fromEntries(ecz.map((s, i) => [s.id, i])) } };
  v.degisimler = [{ id: 1, zaman: 1, y: Y, m: M, gun: 3, cik: 1, yer: 2, cikAd: "a", yerAd: "b", cikOnce: null, yerOnce: null, cikYeni: "M", yerYeni: "N", gorev: "N" }];
  return v;
}

// sabit tohumlu sayı üreteci
function uretec(t) { return () => ((t = (t * 48271) % 2147483647) / 2147483647); }
const COP = [null, undefined, "", "x", -1, 0, 1e9, 3.5, NaN, true, false, [], {}, [1, "a", null], { a: 1 }, "2026-13-45", "__proto__"];

/** nesnenin rastgele bir yerini bozar (silme, türünü değiştirme, dizi/nesne yerine çöp) */
function boz(o, r, adim) {
  for (let k = 0; k < adim; k++) {
    let hedef = o;
    for (let d = 0; d < 6; d++) {
      const anahtarlar = hedef && typeof hedef === "object" ? Object.keys(hedef) : [];
      if (!anahtarlar.length) break;
      const a = anahtarlar[Math.floor(r() * anahtarlar.length)];
      if (r() < 0.35 || typeof hedef[a] !== "object" || hedef[a] === null) {
        if (r() < 0.25) delete hedef[a]; else hedef[a] = COP[Math.floor(r() * COP.length)];
        break;
      }
      hedef = hedef[a];
    }
  }
  return o;
}

function hepsiniHesapla(v) {
  puantajHesapla(v, Y, M);
  oglenHesapla(v, Y, M);
  oglenYillikHesapla(v, Y, M);
  acilHesapla(v, Y, M);
  acilSorunluGunler(v, Y, M);
  calismaListesiHesapla(v, Y, M);
  yillikRaporHesapla(v, Y);
  acilOglenRaporuHesapla(v, Y);
  onayHaftasiHesapla(v, Y, M, 12);
  const g = v.schedules[`${Y}-${M}`]?.days?.[4];
  if (g?.assigned?.[0]) yerineAdaylarHesapla(v, Y, M, 5, g.assigned[0].id, "N");
  const a = Object.entries(v.acil[`${Y}-${M}`] ?? {})[0];
  if (a) acilYerineAdaylarHesapla(v, Y, M, Number(a[0]), a[1][0]);
}

describe("dayanıklılık: bozuk yedek", () => {
  const taban = tabanVeri();
  const tabanJson = JSON.stringify(taban);

  test("bozulmamış veri doğrulamadan aynı anlamla geçer", () => {
    const v = veriyiDogrula(JSON.parse(tabanJson));
    expect(v.staff.length).toBe(taban.staff.length);
    expect(Object.keys(v.schedules)).toEqual([`${Y}-${M}`]);
    expect(v.onayMasa.yerlesim["2026-01-05"]).toBeTruthy();
    // kaldırılmış (false) resmi tatil işareti tatil sayılmaz
    expect(v.manualTatil["2025-11-31"]).toBeUndefined();
    expect(v.manualTatil["2026-0-1"]).toBe(true);
    hepsiniHesapla(v);
  });

  test("çizelgede eksik (silinmiş) gün boş gün olarak kurulur", () => {
    const o = JSON.parse(tabanJson); delete o.schedules[`${Y}-${M}`].days[9];
    const v = veriyiDogrula(o), g = v.schedules[`${Y}-${M}`].days[9];
    expect(g).toMatchObject({ day: 10, assigned: [], prep: [] });
    expect(veriyiDogrula(JSON.parse(JSON.stringify(v)))).toEqual(v);
  });

  test("tümüyle saçma girdiler boş veri verir", () => {
    for (const x of [null, undefined, 0, "", "{}", [], [1, 2], true, { staff: "x", schedules: [], puantaj: 5 }]) {
      const v = veriyiDogrula(x);
      expect(Array.isArray(v.staff)).toBe(true);
      hepsiniHesapla(v);
    }
  });

  test("150 rastgele bozulma: yükleme ve tüm hesaplar çökmez", () => {
    const r = uretec(20261109);
    const hatalar = [];
    for (let i = 0; i < 150; i++) {
      const bozuk = boz(JSON.parse(tabanJson), r, 1 + Math.floor(r() * 6));
      try {
        const v = veriyiDogrula(bozuk);
        // doğrulanmış veri JSON'a dönüp yeniden doğrulanınca değişmez (kararlı)
        expect(veriyiDogrula(JSON.parse(JSON.stringify(v)))).toEqual(v);
        hepsiniHesapla(v);
      } catch (e) { hatalar.push(i + ": " + (e && e.message)); }
    }
    expect(hatalar).toEqual([]);
  }, 300000);
});
