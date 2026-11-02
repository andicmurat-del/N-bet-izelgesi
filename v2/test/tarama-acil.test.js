// Rastgele senaryo taraması (acil eczane + öğlen nöbeti): acil kadrosu ("acilde nöbet tutar" işaretli eczacı / kemoterapi
// eczacısı, acil servis personeli) rastgele; acil listesi eczane çizelgesinden önce ya da sonra oluşturulur. Kesin kurallar:
// acil listesine yalnız acil kadrosu, günde en çok 2 kişi, aynı kişi iki kez yok, izinli / çalışma dönemi dışı güne yazılmaz;
// acil kadrosu eczane nöbeti / hazırlaması almaz; acil nöbeti olan kişi aynı / komşu günde eczanede görev almaz; öğlen
// nöbetine yalnız o gün mesaide olan eczacı ve tekniker yazılır; puantajda acil nöbeti 24 saat; aynı girdi aynı sonuç.
//   N=200 npx vitest run test/tarama-acil.test.js
import { test, expect } from "vitest";
import * as M from "../src/motor";
import { Baglam } from "../src/motor/baglam";
import { senaryo, hizliSaat, dimOf, rngOf } from "./tarama/ortak";

const N = Number(process.env.N || 20), BAS = Number(process.env.BAS || 1);

for (let s = BAS; s < BAS + N; s++) test("acil/öğlen senaryo " + s, () => {
  const { y, m0: m, veri } = senaryo(s);
  const r = rngOf(s * 7919 + 13), ri = (a, b) => a + Math.floor(r() * (b - a + 1));
  veri.staff.forEach(st => { if ((st.role === "eczaci" || st.role === "nobetci") && r() < 0.25) st.acilTutar = true; });
  let id = Math.max(...veri.staff.map(x => x.id)) + 1;
  for (let i = ri(0, 4); i > 0; i--) veri.staff.push({ id: id++, name: "acil" + id, role: "servis" });
  veri.acil = {}; veri.acilElle = {}; veri.oglen = {};
  const ayK = y + "-" + m, dim = dimOf(y, m), bulgu = [];
  const kadro = veri.staff.filter(M.acilKadrosunda);
  if (kadro.length >= 2 && r() < 0.4) {   // elle düzenlenmiş birkaç gün
    const a = (veri.acil[ayK] = {}), e = (veri.acilElle[ayK] = {});
    for (let j = ri(1, 3); j > 0; j--) { const d = ri(1, dim); const x = kadro[ri(0, kadro.length - 1)], z = kadro[ri(0, kadro.length - 1)]; if (x.id !== z.id) { a[d] = [x.id, z.id]; e[d] = true; } }
  }
  const acilYap = () => {
    const once = JSON.stringify(veri), ra = M.acilHesapla(veri, y, m);
    if (JSON.stringify(veri) !== once) bulgu.push("acil: girdi değişti");
    if (JSON.stringify(M.acilHesapla(veri, y, m)) !== JSON.stringify(ra)) bulgu.push("acil: aynı girdi farklı sonuç");
    veri.acil[ayK] = Object.fromEntries(ra.gunler.map(g => [g.gun, g.ids]));
    return ra;
  };
  const eczaneYap = () => {
    const rc = M.cizelgeOlustur(veri, y, m, { saat: hizliSaat() });
    if (rc.days) veri.schedules[ayK] = { year: y, month: m, days: rc.days, uyarilar: rc.warnings };
    return rc;
  };
  let ra, rc;
  try {
    if (r() < 0.5) { ra = acilYap(); rc = eczaneYap(); } else { rc = eczaneYap(); ra = acilYap(); }
  } catch (e) { bulgu.push("ÇÖKTÜ: " + e.stack.split("\n").slice(0, 4).join(" | ")); }
  if (ra && rc && rc.days) {
    const B = new Baglam(veri), sabit = veri.acilElle[ayK] || {};
    ra.gunler.forEach(g => {
      if (g.ids.length > 2) bulgu.push(g.gun + ": acilde 2'den fazla kişi");
      if (new Set(g.ids).size !== g.ids.length) bulgu.push(g.gun + ": acilde aynı kişi iki kez");
      if (sabit[g.gun]) return;
      g.ids.forEach(i => {
        const st = B.kisi(i);
        if (!st || !M.acilKadrosunda(st)) bulgu.push(g.gun + ": acil kadrosunda olmayan kişi " + (st && st.role));
        if (B.kesinYasak(i, y, m, g.gun)) bulgu.push(g.gun + ": " + st.name + " izinli / dönem dışı güne acil nöbeti");
      });
      if (g.ids.length < 2 && !ra.uyarilar.some(w => w.startsWith(g.gun + " "))) bulgu.push(g.gun + ": acil eksik ama uyarı yok");
    });
    rc.days.forEach(g => {
      if (g.locked) return;
      [...g.assigned, ...(g.prep || [])].forEach(p => {
        const st = B.kisi(p.id);
        if (st && M.acilKadrosunda(st)) bulgu.push(g.day + ": acil kadrosundaki " + st.name + " eczanede görevli");
      });
    });
    // acil önce oluşturulduysa eczane acil nöbetinin yanına yazmamalı (eczane önceyse acil eczanenin yanına yazmamalı)
    ra.gunler.forEach(g => { if (sabit[g.gun]) return; g.ids.forEach(i => { for (const k of [-1, 0, 1]) { const d = rc.days[g.gun - 1 + k]; if (d && !d.locked && [...d.assigned, ...(d.prep || [])].some(p => p.id === i)) bulgu.push(g.gun + ": " + i + " acil nöbetinin yanında eczane görevi"); } }); });
    try {
      const ro = M.oglenHesapla(veri, y, m);
      if (JSON.stringify(M.oglenHesapla(veri, y, m)) !== JSON.stringify(ro)) bulgu.push("öğlen: aynı girdi farklı sonuç");
      veri.oglen[ayK] = Object.fromEntries(ro.gunler.map(g => [g.gun, { e: g.e, t: g.t }]));
      const P = M.puantajHesapla(veri, y, m), hucre = (i, d) => P.satirlar.find(x => x.s.id === i)?.cells[d - 1];
      ro.gunler.forEach(g => {
        const hep = [...g.e, ...g.t];
        if (new Set(hep).size !== hep.length) bulgu.push(g.gun + ": öğlende aynı kişi iki kez");
        g.e.forEach(i => { if (B.kisi(i)?.role !== "eczaci") bulgu.push(g.gun + ": öğlen eczacı grubunda " + B.kisi(i)?.role); });
        g.t.forEach(i => { if (B.kisi(i)?.role !== "teknisyen") bulgu.push(g.gun + ": öğlen tekniker grubunda " + B.kisi(i)?.role); });
        hep.forEach(i => { const c = hucre(i, g.gun); if (!c || !(c.kod === "M" || c.kod === "N" || (c.kod.indexOf("S:") === 0 && c.saat > 0))) bulgu.push(g.gun + ": öğlende mesai dışı kişi " + (c && c.kod)); });
      });
      Object.entries(veri.acil[ayK]).forEach(([d, ids]) => ids.forEach(i => { const c = hucre(i, +d); if (c && !c.ov && !(c.kod === "N" && c.acil) && !B.kesinYasak(i, y, m, +d)) bulgu.push(d + ": puantajda acil nöbeti yok " + i + " " + c.kod); }));
      P.satirlar.forEach(rw => { const top = rw.cells.reduce((t, c) => t + c.saat, 0); if (Math.abs(top - rw.toplam) > 1e-9) bulgu.push("puantaj toplam " + rw.s.name); });
      M.calismaListesiHesapla(veri, y, m); M.yillikRaporHesapla(veri, y); M.oglenYillikHesapla(veri, y, m);
      M.oglenOnarimlariHesapla(veri, y * 10000 + (m + 1) * 100 + 10);
      ra.gunler.slice(0, 5).forEach(g => M.acilDenetle(veri, y, m, g.gun, g.ids));
    } catch (e) { bulgu.push("yan işlev ÇÖKTÜ: " + e.stack.split("\n").slice(0, 4).join(" | ")); }
  }
  if (bulgu.length) console.log("SENARYO " + s + " (" + veri.staff.map(x => x.role[0] + (x.acilTutar ? "*" : "")).join("") + "):\n  " + bulgu.slice(0, 12).join("\n  "));
  expect(bulgu.length).toBe(0);
}, 120000);
