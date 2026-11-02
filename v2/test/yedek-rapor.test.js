// Gerçek bir yedekten eşitlik raporu: her ay günlük eczane, acil eczane ve öğlen nöbeti için kişi başı sayılar ve
// en çok − en az farkları (Markdown). Yalnız elle çalıştırılır; YEDEK verilmezse atlanır.
//   YEDEK=yedek.json npx vitest run test/yedek-rapor.test.js
//   YEDEK=yedek.json YENIDEN=1 RAPOR=rapor.md npx vitest run test/yedek-rapor.test.js
// YENIDEN=1: acil ve öğlen listeleri kayıttaki yerine programın bugünkü hâliyle yeniden oluşturulur (elle günler korunur).
import { test } from "vitest";
import fs from "fs";
import * as M from "../src/motor";

const YEDEK = process.env.YEDEK;
const AY = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

(YEDEK ? test : test.skip)("yedek eşitlik raporu", () => {
  const ham = JSON.parse(fs.readFileSync(YEDEK, "utf8"));
  const v = ham.veri ?? ham;
  v.acil ??= {}; v.oglen ??= {};
  const out = [`# Eşitlik raporu`, ``, `Yedek: ${YEDEK}${process.env.YENIDEN ? " · acil ve öğlen yeniden oluşturuldu" : ""}`, ``];
  const fark = l => { const n = l.filter(x => typeof x === "number"); return n.length ? Math.max(...n) - Math.min(...n) : 0; };   // "–" (ör. Cuma muaf) sayılmaz
  const tablo = (baslik, kolonlar, satirlar) => {
    out.push(`### ${baslik}`, ``, `| Kişi | ${kolonlar.join(" | ")} |`, `|---|${kolonlar.map(() => "---:").join("|")}|`);
    satirlar.forEach(s => out.push(`| ${s.ad} | ${s.d.join(" | ")} |`));
    out.push(`| **En çok − en az** | ${kolonlar.map((_, i) => "**" + fark(satirlar.map(s => s.d[i])) + "**").join(" | ")} |`, ``);
  };
  const aylar = [...new Set([...Object.keys(v.schedules || {}), ...Object.keys(v.acil), ...Object.keys(v.oglen)])]
    .map(k => k.split("-").map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  for (const [y, m] of aylar) {
    const k = y + "-" + m;
    if (process.env.YENIDEN) {
      if (v.staff.some(M.acilKadrosunda)) { const r = M.acilHesapla(v, y, m); v.acil[k] = Object.fromEntries(r.gunler.filter(g => g.ids.length).map(g => [g.gun, g.ids])); }
      if (v.schedules?.[k]) { const r = M.oglenHesapla(v, y, m); v.oglen[k] = Object.fromEntries(r.gunler.map(g => [g.gun, { e: g.e, t: g.t, ...(g.elle ? { elle: true } : {}) }])); }
    }
    out.push(`## ${AY[m]} ${y}`, ``);
    const P = M.puantajHesapla(v, y, m);
    const kisi = id => v.staff.find(s => s.id === id);
    const satir = (r, alanlar) => ({ ad: r.s.name, d: alanlar.map(a => r[a]) });
    const eczane = P.satirlar.filter(r => { const s = kisi(r.s.id); return s && ["eczaci", "teknisyen", "nobetci"].includes(s.role) && !M.acilKadrosunda(s); });
    if (v.schedules?.[k] && eczane.length) tablo("Günlük eczane", ["Nöbet", "Prş", "Cuma", "Cmt", "Paz", "Resmi", "Hazırlama", "Fazla mesai"], eczane.map(r => satir(r, ["n", "thu", "cu", "cmt", "paz", "rt", "h", "fm"])));
    const acil = P.satirlar.filter(r => { const s = kisi(r.s.id); return s && M.acilKadrosunda(s); });
    if (v.acil[k] && acil.length) tablo("Acil eczane", ["Nöbet", "Prş", "Cuma", "Cmt", "Paz", "Resmi", "Fazla mesai"], acil.map(r => satir(r, ["n", "thu", "cu", "cmt", "paz", "rt", "fm"])));
    if (v.oglen[k]) {
      const say = {}, cu = {};
      for (const [gun, g] of Object.entries(v.oglen[k])) [...g.e, ...g.t].forEach(id => { say[id] = (say[id] || 0) + 1; if (new Date(y, m, +gun).getDay() === 5) cu[id] = (cu[id] || 0) + 1; });
      for (const [rol, ad] of [["eczaci", "Öğlen — eczacılar"], ["teknisyen", "Öğlen — teknikerler"]]) {
        const l = v.staff.filter(s => s.role === rol && P.satirlar.some(r => r.s.id === s.id));
        if (l.length) tablo(ad, ["Öğlen", "Cuma"], l.map(s => ({ ad: s.name + (s.cumaMuaf ? " (Cuma muaf)" : ""), d: [say[s.id] || 0, s.cumaMuaf ? "–" : cu[s.id] || 0] })));
      }
    }
  }
  const metin = out.join("\n");
  if (process.env.RAPOR) fs.writeFileSync(process.env.RAPOR, metin); else console.log(metin);
}, 600000);
