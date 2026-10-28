// Rastgele senaryo taraması: motorun tüm işlevleri çökmeden çalışmalı, kesin kurallar ya sağlanmalı ya da gün
// açıkça uyarılı (conflict) işaretlenmeli, girdi değişmemeli, aynı girdi aynı sonucu vermeli; "kadro yetmiyor" uyarısı
// yalnız ihlal kaçınılmazken verilmeli.
// Varsayılan 20 senaryo, hızlı saatle (arama ilk yerel en iyide durur). Daha geniş tarama:
//   N=200 BAS=1 npx vitest run test/tarama.test.js      (TAM=1: aramayı gerçek uzunlukta çalıştırır, yavaştır)
import { test, expect } from "vitest";
import * as M from "../src/motor";
import { Baglam, eczaciMi } from "../src/motor/baglam";
import { senaryo, denetle, hizliSaat, dimOf } from "./tarama/ortak";

const N = Number(process.env.N || 20), BAS = Number(process.env.BAS || 1);

for (let s = BAS; s < BAS + N; s++) test("senaryo " + s, () => {
  const { r, y, m0, veri } = senaryo(s);
  const bulgu = [];
  for (const [mi, m] of [[0, m0], [1, m0 + 1]]) {
    // ikinci ayda bazen elle kilitli günler
    let kilitli = null;
    if (mi === 1 && r() < 0.35 && veri.staff.length >= 2) {
      const dim = dimOf(y, m), gunler = Array.from({ length: dim }, (_, i) => ({ day: i + 1, tatil: false, conflict: false, fazlaMesai: 0, assigned: [], prep: [], locked: false }));
      const ecz = veri.staff.filter(x => eczaciMi(x.role)), dig = veri.staff.filter(x => ["teknisyen", "eczaci"].includes(x.role));
      for (let j = 0; j < 3; j++) { const d = 1 + Math.floor(r() * dim), a = ecz[Math.floor(r() * ecz.length)], b = dig[Math.floor(r() * dig.length)];
        if (a && b && a.id !== b.id) gunler[d - 1] = { ...gunler[d - 1], assigned: [a, b].map(x => ({ id: x.id, name: x.name, role: x.role })), locked: true }; }
      veri.schedules[y + "-" + m] = { year: y, month: m, days: gunler };
      kilitli = gunler.map(g => (g.locked ? { a: g.assigned, p: g.prep } : null));
    }
    const once = JSON.stringify(veri);
    let r1;
    try { r1 = M.cizelgeOlustur(veri, y, m, { saat: hizliSaat() }); } catch (e) { bulgu.push(`${y}-${m + 1} ÇÖKTÜ: ${e.stack}`); break; }
    if (JSON.stringify(veri) !== once) bulgu.push("girdi değişti");
    const r2 = M.cizelgeOlustur(veri, y, m, { saat: hizliSaat() });
    if (JSON.stringify(r1) !== JSON.stringify(r2)) bulgu.push(`${y}-${m + 1} aynı girdi farklı sonuç`);
    bulgu.push(...denetle(veri, y, m, r1, kilitli && kilitli.map((k, i) => k)));
    // destek personelinin aylık hazırlama sayısı kesin sınırdır (Ayarlar): aşılmamalı (elle kilitlenen günler hariç)
    if (r1.days) {
      const sinir = new Baglam(veri).sayi("destekAylik"), say = {};
      r1.days.forEach(g => { if (!g.locked) (g.prep || []).forEach(p => { if (p.role === "destek") say[p.id] = (say[p.id] || 0) + 1; }); });
      Object.entries(say).forEach(([id, n]) => { if (n > sinir) bulgu.push(`${y}-${m + 1} destek ${id} ${n} hazırlama (sınır ${sinir})`); });
    }
    // "matematiksel olarak mümkün değil" uyarısı yalnız kesin kural ihlali kaçınılmazken verilir: kırmızı gün olmalı
    if (r1.days && r1.warnings.some(w => /matematiksel olarak mümkün değil/.test(w)) && !r1.days.some(g => g.conflict && !g.locked)) bulgu.push(`${y}-${m + 1} "mümkün değil" uyarısı var ama kırmızı gün yok`);
    if (!r1.days) break;
    veri.schedules[y + "-" + m] = { year: y, month: m, days: r1.days, uyarilar: r1.warnings };
    // diğer işlevler çökmemeli ve tutarlı olmalı
    try {
      const P = M.puantajHesapla(veri, y, m);
      P.satirlar.forEach(rw => {
        const top = rw.cells.reduce((t, c) => t + c.saat, 0);
        if (Math.abs(top - rw.toplam) > 1e-9) bulgu.push(`${y}-${m + 1} puantaj toplam ${rw.s.name}`);
        if (Math.abs(rw.fmGece + rw.fmGunduz - rw.fm) > 1e-9) bulgu.push(`${y}-${m + 1} puantaj dilim toplamı ${rw.s.name}`);
        if (rw.fmGece < 0) bulgu.push(`${y}-${m + 1} puantaj gece eksi ${rw.s.name}`);
        if (rw.n !== rw.cells.filter(c => c.kod === "N").length) bulgu.push(`${y}-${m + 1} puantaj nöbet sayısı ${rw.s.name}`);
      });
      M.calismaListesiHesapla(veri, y, m);
      const sch = veri.schedules[y + "-" + m];
      for (const d of [1, 5, 15, dimOf(y, m)]) {
        const g = sch.days[d - 1];
        M.gunuDenetle(veri, sch, d, g.assigned, g.prep || []);
        if (g.assigned[0]) {
          const cik = g.assigned[0].id;
          veri.staff.slice(0, 6).forEach(st => { M.degisimDenetle(veri, { y, m, gorev: "N", tur: "devir", gun: d, cik, yer: st.id }); });
          M.yerineAdaylarHesapla(veri, y, m, d, cik, "N");
          M.degisimDenetle(veri, { y, m, gorev: "N", tur: "takas", gun: d, cik, yer: veri.staff[0].id, gun2: ((d + 3) % dimOf(y, m)) + 1, gorev2: "N" });
        }
        if (g.prep && g.prep[0]) M.yerineAdaylarHesapla(veri, y, m, d, g.prep[0].id, "H");
        M.acilDenetle(veri, y, m, d, veri.staff.slice(0, 2).map(x => x.id));
      }
      const bugun = y * 10000 + (m + 1) * 100 + 10;
      const sv = M.servisAyHesapla(veri, y, m, {}, bugun);
      if (sv.kayit) {
        veri.servisKayit = { ...(veri.servisKayit || {}), [y + "-" + m]: sv.kayit };
        Object.values(sv.kayit.gun).forEach(g => {
          const say = {}, yb = {}; g.k.forEach(id => { say[id] = 0; yb[id] = 0; });
          Object.entries(g.a).forEach(([sn, id]) => { if (say[id] === undefined) bulgu.push(`servis dağıtımı çalışmayan kişiye`); say[id]++; if (/\sYB$/.test(sn)) yb[id]++; });
          for (const t of [say, yb]) { const v = Object.values(t); if (v.length && Math.max(...v) - Math.min(...v) > 1) bulgu.push(`${y}-${m + 1} servis farkı 1'i aşıyor`); }
        });
        const gunler = Object.keys(sv.kayit.gun).map(Number);
        if (gunler.length) { const d = gunler[0], gk = sv.kayit.gun[d];
          M.servisGunu(veri, y, m, d, bugun);
          M.servisAtamaAdaylari(veri, y, m, d, Object.keys(gk.a)[0], bugun);
          M.servisIslem(veri, y, m, { tur: "karistir", gun: d }, bugun);
          M.servisIslem(veri, y, m, { tur: "kisi", gun: d, id: gk.k[0] }, bugun); }
      }
      M.servisYillik(veri, y, y * 10000 + 1231);
      M.yillikRaporHesapla(veri, y);
      r1.warnings.forEach(w => M.uyariSiniflandir(w));
    } catch (e) { bulgu.push(`${y}-${m + 1} yan işlev ÇÖKTÜ: ${e.stack.split("\n").slice(0, 4).join(" | ")}`); }
  }
  if (bulgu.length) console.log("SENARYO " + s + " (" + JSON.stringify({ kadro: veri.staff.map(x => x.role[0]).join(""), ayar: veri.settings }) + "):\n  " + bulgu.slice(0, 12).join("\n  "));
  expect(bulgu.length).toBe(0);
}, 120000);
