// Rastgele senaryo üretici ve kural denetçisi (test/tarama.test.js). Denetçi motordan bağımsız yazılmıştır:
// motorun kurallarını yeniden uygular, motor kodunu kullanmaz (Baglam yalnız veri okumak için).
import { Baglam, aktifGunMu, eczaciMi } from "../../src/motor/baglam";
export function rngOf(seed) { let t = seed >>> 0 || 1; return () => { t = (t * 1664525 + 1013904223) >>> 0; return t / 4294967296; }; }
export const dimOf = (y, m) => new Date(y, m + 1, 0).getDate();
const hg = (y, m, d) => (new Date(y, m, d).getDay() + 6) % 7;

/** kadro: isteğe bağlı aralıklar, ör. { eczaci: [6, 8], teknisyen: [4, 8] } (gerçekçi kadro); verilmezse geniş tarama */
export function senaryo(seed, kadro = {}) {
  const r = rngOf(seed), ri = (a, b) => a + Math.floor(r() * (b - a + 1)), sec = a => a[Math.floor(r() * a.length)];
  const y = sec([2025, 2026, 2027]), m0 = ri(0, 10);
  const staff = []; let id = 1;
  const ekle = (role, n) => { for (let i = 0; i < n; i++) staff.push({ id: id++, name: role.slice(0, 3) + id, role }); };
  ekle("eczaci", ri(...(kadro.eczaci || [1, 6]))); ekle("nobetci", ri(0, 2)); ekle("teknisyen", ri(...(kadro.teknisyen || [0, 8]))); ekle("destek", ri(0, 3)); ekle("servis", ri(0, 1));
  // çalışma dönemi
  staff.forEach(s => {
    if (r() < 0.08) s.baslangic = `${y}-${String(m0 + 1).padStart(2, "0")}-${String(ri(2, 25)).padStart(2, "0")}`;
    else if (r() < 0.06) s.bitis = `${y}-${String(m0 + 2).padStart(2, "0")}-${String(ri(2, 26)).padStart(2, "0")}`;
  });
  const prefs = {}, manualTatil = {}, arife = {}, puantaj = {}, acil = {};
  for (const m of [m0, m0 + 1]) {
    const dim = dimOf(y, m);
    staff.forEach(s => {
      const k = d => `${s.id}-${y}-${m}-${d}`;
      if (r() < 0.25) { const b = ri(1, dim - 6), L = ri(1, 9); for (let d = b; d <= Math.min(dim, b + L); d++) prefs[k(d)] = "izinli"; }
      for (let j = 0; j < ri(0, 3); j++) prefs[k(ri(1, dim))] = sec(["avoid", "want", "want", "avoid", "esYok"]);
      if (r() < 0.1) prefs[k(ri(1, dim))] = "esVar";
      if (r() < 0.12) { const p = (puantaj[y + "-" + m] ??= {}); (p[s.id] ??= {})[ri(1, dim)] = sec(["YI", "R", "NI", "DI"]); }
    });
    for (let j = 0; j < ri(0, 3); j++) manualTatil[`${y}-${m}-${ri(1, dim)}`] = true;
    if (r() < 0.3) arife[`${y}-${m}-${ri(1, dim)}`] = true;
    const acilKisi = staff.filter(s => s.role === "servis" || s.role === "eczaci");
    if (acilKisi.length) { const a = (acil[y + "-" + m] = {}); for (let j = 0; j < ri(0, 6); j++) a[ri(1, dim)] = [sec(acilKisi).id]; }
  }
  const settings = { minAra: sec([2, 3, 4]), cakismaOncelik: sec([1, 2]), destekAylik: sec([1, 2, 3]), arifeSaat: sec([3, 4, 5]) };
  return { r, y, m0, veri: { staff, prefs, manualTatil, arife, puantaj, acil, settings, schedules: {}, servisAyar: {} } };
}

// hızlı saat: yinelemeli yerel arama hemen biter (kurallar aramadan bağımsız denetlenir)
export const hizliSaat = () => { if (process.env.TAM) return () => 0; let t = 0; return () => (t += 100000); };

export function denetle(veri, y, m, r0, kilitli) {
  const B = new Baglam(veri), dim = dimOf(y, m), hatalar = [];
  const days = r0.days;
  if (!days) return r0.warnings.length ? [] : ["days null ve uyarı yok"];
  if (days.length !== dim) hatalar.push("gün sayısı " + days.length);
  const nob = days.map(g => new Set(g.assigned.map(p => p.id)));
  const haz = days.map(g => new Set((g.prep || []).map(p => p.id)));
  days.forEach((g, i) => {
    const d = i + 1, yer = `${y}-${m + 1}-${d}`;
    if (g.day !== d) hatalar.push(yer + " day alanı yanlış");
    if (g.assigned.length > 2) hatalar.push(yer + " 2'den fazla nöbetçi");
    if (nob[i].size !== g.assigned.length) hatalar.push(yer + " aynı kişi iki kez nöbetçi");
    if ((g.prep || []).length > 2) hatalar.push(yer + " 2'den fazla hazırlama");
    if (haz[i].size !== (g.prep || []).length) hatalar.push(yer + " aynı kişi iki kez hazırlama");
    g.assigned.forEach(p => { if (haz[i].has(p.id)) hatalar.push(yer + " aynı kişi hem nöbet hem hazırlama"); });
    if ((g.prep || []).length && !g.tatil && !g.locked) hatalar.push(yer + " tatil olmayan güne hazırlama");
    if (g.tatil !== B.tatilMi(y, m, d)) hatalar.push(yer + " tatil alanı yanlış");
    g.assigned.forEach(p => { const s = B.kisi(p.id); if (!s || !["eczaci", "teknisyen", "nobetci"].includes(s.role)) hatalar.push(yer + " nöbete uygun olmayan rol " + (s && s.role)); });
    (g.prep || []).forEach(p => { const s = B.kisi(p.id); if (!s || !["eczaci", "teknisyen", "nobetci", "destek"].includes(s.role)) hatalar.push(yer + " hazırlamaya uygun olmayan rol " + (s && s.role)); });
    if (g.locked) { if (kilitli && JSON.stringify(kilitli[i]) !== JSON.stringify({ a: g.assigned, p: g.prep })) hatalar.push(yer + " kilitli gün değişti"); return; }
    // kesin kurallar: sağlanmıyorsa gün işaretli olmalı
    const ihlal = [];
    const zorunlu = id => B.tercih(id, y, m, d) === "esVar";
    if (!g.assigned.some(p => eczaciMi(p.role))) ihlal.push("eczacı yok");
    if (g.assigned.length < 2) ihlal.push("2 nöbetçi yok");
    // dışarıdan gelen iki eczacı aynı gün birlikte olmaz (Cuma ve Cumartesi olabilir)
    if (g.assigned.filter(p => p.role === "nobetci").length > 1 && !g.assigned.every(p => zorunlu(p.id)) && hg(y, m, d) !== 4 && hg(y, m, d) !== 5) ihlal.push("iki dışarıdan");
    g.assigned.forEach(p => {
      if (B.kesinYasak(p.id, y, m, d)) ihlal.push(p.name + " yasaklı günde nöbet");
      if (zorunlu(p.id)) return;
      if ((i > 0 && nob[i - 1].has(p.id)) || (i < dim - 1 && nob[i + 1].has(p.id))) ihlal.push(p.name + " art arda nöbet");
      if ([i - 1, i, i + 1].some(k => k >= 0 && k < dim && haz[k].has(p.id))) ihlal.push(p.name + " nöbet komşu/aynı gün hazırlama");
      const v = k => i + k >= 0 && i + k < dim && nob[i + k].has(p.id);
      if ((v(-2) && v(-4)) || (v(-2) && v(2)) || (v(2) && v(4))) ihlal.push(p.name + " 5 günde 3 nöbet");
      if (hg(y, m, d) === 3) [2, 3].forEach(k => { if (i + k < dim && haz[i + k].has(p.id)) ihlal.push(p.name + " Perşembe nöbeti + hafta sonu hazırlama"); });
      const st = B.kisi(p.id);
      if (st && st.bitis) { const [yy, mm, dd] = st.bitis.split("-").map(Number); if (yy === y && mm === m + 1 && dd === d && B.mesaiSaati(...(d < dim ? [y, m, d + 1] : (m === 11 ? [y + 1, 0, 1] : [y, m + 1, 1]))) > 0) ihlal.push(p.name + " son gününde nöbet"); }
    });
    if (g.tatil && (g.prep || []).length < 2) ihlal.push("hazırlama eksik");
    (g.prep || []).forEach(p => {
      if (B.kesinYasak(p.id, y, m, d)) ihlal.push(p.name + " yasaklı günde hazırlama");
      if ([i - 1, i + 1].some(k => k >= 0 && k < dim && haz[k].has(p.id)) && p.role !== "destek") ihlal.push(p.name + " art arda hazırlama");
      if ([i - 1, i, i + 1].some(k => k >= 0 && k < dim && nob[k].has(p.id))) ihlal.push(p.name + " hazırlama komşu nöbet");
      const dw = hg(y, m, d); if (dw === 5 || dw === 6) { const k = i - (dw === 5 ? 2 : 3); if (k >= 0 && nob[k].has(p.id)) ihlal.push(p.name + " Perşembe nöbetçisine hafta sonu hazırlama"); }
    });
    // eş durumu karşılanmadı (hepsi birlikte yazılamıyorsa — günde 2 nöbetçi, en az 1 eczacı — sığmayanlar hariç)
    const esIstek = B.staff.filter(s => ["eczaci", "teknisyen", "nobetci"].includes(s.role) && zorunlu(s.id) && aktifGunMu(s, y, m, d));
    const esYok = esIstek.filter(s => !nob[i].has(s.id));
    if (esYok.length > Math.max(0, esIstek.length - (esIstek.some(s => eczaciMi(s.role)) ? 2 : 1))) esYok.forEach(s => ihlal.push(s.name + " eş durumu karşılanmadı"));
    if (ihlal.length && !g.conflict) hatalar.push(yer + " İŞARETSİZ İHLAL: " + ihlal.join("; "));
  });
  return hatalar;
}
