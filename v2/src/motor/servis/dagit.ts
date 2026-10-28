// Bir günün servislerini o gün çalışan teknikerlere dağıtır.
// Kesin: kişi başı servis, YB ve zor servis sayısı en fazla 1 farklı; aynı gruptaki servisler aynı kişiye verilmez.
// En aza indirilen: aylık servis-gün, yük, YB ve zor servis payından sapma, günlük yük farkı, aynı servisin aynı kişide
// tekrarı ve (yeniden hesaplanan gün için) önceki listeden ayrılma. Tüm maliyetler kişi başına artımlı tutulur;
// açgözlü başlangıçtan sonra taşı/takas ile iyileştirilir, 4 farklı başlangıcın en iyisi seçilir.
import { ybMi, zorMu, type Servis } from "./liste";

/** ağırlıklar: S servis-gün, L aylık yük, Y YB, D günlük yük, R tekrar, G grup ihlali, Z zor servis, M önceki listede kalma */
export const W = { S: 120, L: 220, Y: 60, D: 6000, R: 45, G: 100000, Z: 400, M: 400 };

/** kişi başı önceki günlerden birikim: w servis-gün, l yük, y YB, zr zor servis; f* payına düşen; rep/frep servis tekrarı */
export interface Birikim { w: number; l: number; y: number; zr: number; fw: number; fl: number; fy: number; fz: number; rep: Record<string, number>; frep: Record<string, number>; gun: number }

function rngOf(seed: number) { let t = (seed >>> 0) || 1; return () => { t = (t * 1664525 + 1013904223) >>> 0; return t / 4294967296; }; }

/**
 * people: o gün çalışanlar; svcs: hazırlanan servisler; n: çok günlük servislerin gün sayısı; cum: ay içindeki birikim;
 * sabit: {servis adı: kişi sırası} elle atanmış servisler (yerleri değişmez);
 * onceki: {servis adı: kişi} günün önceki dağıtımı; servis o gün hâlâ çalışan önceki kişisinde kalmayı mW kadar tercih eder.
 */
export function gunDagit(people: { id: number }[], svcs: Servis[], n: number, cum: Record<string, Birikim>, seed: number,
  sabit: Record<string, number> | null, onceki: Record<string, number> | null, mW: number) {
  sabit = sabit || {};
  const P = people.length, S = svcs.length;
  let GN = 0;
  const xs = svcs.map((s, ix) => { const w = s.multi ? n : 1; s.grps.forEach(g => { if (g + 1 > GN) GN = g + 1; }); return { s, ix, w, l: s.h * s.z * w, y: ybMi(s.name) ? 1 : 0, z: zorMu(s), g: s.grps }; });
  type X = (typeof xs)[number];
  let totW = 0, totL = 0, totY = 0, totZ = 0; xs.forEach(x => { totW += x.w; totL += x.l; totY += x.y; totZ += x.z; });
  const fW = totW / P, fL = totL / P, fY = totY / P, fZ = totZ / P, Ls = Math.max(1, fL);
  // günlük sınırlar: kişi başı servis, YB ve zor servis sayısı
  const cLo = Math.floor(S / P), cHi = Math.ceil(S / P), yLo = Math.floor(totY / P), yHi = Math.ceil(totY / P), zLo = Math.floor(totZ / P), zHi = Math.ceil(totZ / P);
  const gsize = new Array(GN).fill(0); xs.forEach(x => x.g.forEach(g => { gsize[g]++; }));
  const cap = gsize.map(v => Math.ceil(v / P));
  const pen = (g: number, v: number) => (v > cap[g] ? W.G * (v - cap[g]) : 0);
  const base = people.map(p => { const c = cum[p.id] || ({} as Partial<Birikim>); return { dW: (c.w || 0) - (c.fw || 0), dL: (c.l || 0) - (c.fl || 0), dY: (c.y || 0) - (c.fy || 0), dZ: (c.zr || 0) - (c.fz || 0) }; });
  const fOf = (i: number, w: number, l: number, y: number, z: number) => {
    const b = base[i];
    const a = b.dW + w - fW, c = (b.dL + l - fL) / Ls, e = b.dY + y - fY, dd = (l - fL) / Ls, zz = b.dZ + z - fZ;
    return W.S * a * a + W.L * c * c + W.Y * e * e + W.D * dd * dd + W.Z * zz * zz;
  };
  // aynı servis aynı kişiye: çalıştığı günlere göre düşen paydan fazlası cezalandırılır
  const burada = new Set(people.map(p => p.id));
  const rc = people.map(p => {
    const c = cum[p.id] || ({} as Partial<Birikim>), rep = c.rep || {}, frep = c.frep || {};
    return xs.map(x => {
      const d = (rep[x.s.name] || 0) - (frep[x.s.name] || 0) - 1 / P, o = onceki ? onceki[x.s.name] : undefined;
      return W.R * (2 * d + 1) + (o !== undefined && o !== p.id && burada.has(o) ? mW : 0);
    });
  });
  let best: { items: Servis[]; w: number; l: number; y: number }[] | null = null, bestJ = Infinity;
  for (let deneme = 0; deneme < 4; deneme++) {
    const rnd = rngOf(seed * 7919 + deneme * 104729 + 17);
    const A = people.map(() => ({ items: [] as X[], c: 0, w: 0, l: 0, y: 0, z: 0, gc: new Array(GN).fill(0) as number[], gp: 0, rp: 0 }));
    const upd = (i: number, x: X, sg: number) => {
      const a = A[i]; a.c += sg; a.w += sg * x.w; a.l += sg * x.l; a.y += sg * x.y; a.z += sg * x.z; a.rp += sg * rc[i][x.ix];
      for (let q = 0; q < x.g.length; q++) { const g = x.g[q], o = a.gc[g]; a.gc[g] = o + sg; a.gp += pen(g, o + sg) - pen(g, o); }
    };
    // günlük sınırlar aşılırsa çok büyük ceza: iyileştirme bunu önce düzeltir
    const sinirC = (c: number, y: number, z: number) => Math.max(0, c - cHi) + Math.max(0, cLo - c) + Math.max(0, y - yHi) + Math.max(0, yLo - y) + Math.max(0, z - zHi) + Math.max(0, zLo - z);
    const costHizli = (i: number) => { const a = A[i]; return fOf(i, a.w, a.l, a.y, a.z) + a.gp + a.rp; };
    const costCezali = (i: number) => { const a = A[i]; return fOf(i, a.w, a.l, a.y, a.z) + a.gp + a.rp + W.G * sinirC(a.c, a.y, a.z); };
    let cost = costCezali;
    let ybKalan = totY, zrKalan = totZ;
    // önce elle atananlar yerine konur
    const sabitX = new Set<X>();
    xs.forEach(x => { const i = sabit![x.s.name]; if (i !== undefined && i >= 0 && i < P) { A[i].items.push(x); upd(i, x, 1); sabitX.add(x); } });
    sabitX.forEach(x => { if (x.y) ybKalan--; if (x.z) zrKalan--; });
    // açgözlü başlangıç: önce zor servisler ve YB'ler, sonra diğerleri; büyük yükten küçüğe (eşitlerde rastgele)
    const sira = xs.filter(x => !sabitX.has(x)).map(x => ({ x, r: rnd() })).sort((p, q) => (q.x.z - p.x.z) || (q.x.y - p.x.y) || (q.x.l - p.x.l) || (p.r - q.r)).map(o => o.x);
    const S2 = sira.length;
    for (let ix = 0; ix < S2; ix++) {
      const x = sira[ix];
      let eksik = 0, ybEksik = 0, zrEksik = 0;
      for (let i = 0; i < P; i++) { eksik += Math.max(0, cLo - A[i].c); ybEksik += Math.max(0, yLo - A[i].y); zrEksik += Math.max(0, zLo - A[i].z); }
      const doldur = (S2 - ix) <= eksik, ybDoldur = x.y && ybKalan <= ybEksik, zrDoldur = x.z && zrKalan <= zrEksik;
      if (x.y) ybKalan--;
      if (x.z) zrKalan--;
      let bi = -1, bm = Infinity;
      for (let tur = 0; tur < 3 && bi < 0; tur++) {
        for (let i = 0; i < P; i++) {
          const a = A[i], c = a.items.length;
          if (tur < 2 && (c >= cHi || (doldur && c >= cLo))) continue;
          if (tur < 1 && x.y && (a.y >= yHi || (ybDoldur && a.y >= yLo))) continue;
          if (tur < 2 && x.z && (a.z >= zHi || (zrDoldur && a.z >= zLo))) continue;
          const once = cost(i); upd(i, x, 1); const mm = cost(i) - once + rnd() * 1e-6; upd(i, x, -1);
          if (mm < bm) { bm = mm; bi = i; }
        }
      }
      A[bi].items.push(x); upd(bi, x, 1);
    }
    // iyileştirme: taşı ve takas et (kişi başı servis ve YB sayısı sınırları korunur).
    // Başlangıç sınırları sağlıyorsa hızlı yol: sınırı bozacak hamle hiç denenmez.
    let bozuk = 0; for (let i = 0; i < P; i++) bozuk += sinirC(A[i].c, A[i].y, A[i].z);
    const hizli = bozuk === 0; cost = hizli ? costHizli : costCezali;
    let iyi = true, tur = 0;
    while (iyi && tur++ < 80) {
      iyi = false;
      for (let a = 0; a < P; a++) for (let b = 0; b < P; b++) {
        if (a === b) continue;
        const Aa = A[a], Ab = A[b];
        // taşı
        for (let k = Aa.items.length - 1; k >= 0 && k < Aa.items.length; k--) {
          const x = Aa.items[k];
          if (sabitX.has(x)) continue;
          if (hizli) {
            if (Aa.c - 1 < cLo || Ab.c + 1 > cHi) break;
            if (x.y && (Aa.y - 1 < yLo || Ab.y + 1 > yHi)) continue;
            if (x.z && (Aa.z - 1 < zLo || Ab.z + 1 > zHi)) continue;
          } else if (sinirC(Aa.c - 1, Aa.y - x.y, Aa.z - x.z) + sinirC(Ab.c + 1, Ab.y + x.y, Ab.z + x.z) > sinirC(Aa.c, Aa.y, Aa.z) + sinirC(Ab.c, Ab.y, Ab.z)) continue;
          const once = cost(a) + cost(b); upd(a, x, -1); upd(b, x, 1);
          if (cost(a) + cost(b) < once - 1e-9) { Aa.items.splice(k, 1); Ab.items.push(x); iyi = true; }
          else { upd(b, x, -1); upd(a, x, 1); }
        }
        if (b < a) continue;
        // takas
        for (let k = 0; k < Aa.items.length; k++) {
          for (let j = 0; j < Ab.items.length; j++) {
            const x = Aa.items[k], t = Ab.items[j];
            if (sabitX.has(x) || sabitX.has(t)) continue;
            if (x.y !== t.y || x.z !== t.z) {
              if (hizli) {
                const ya = Aa.y + t.y - x.y, yb2 = Ab.y + x.y - t.y, za = Aa.z + t.z - x.z, zb = Ab.z + x.z - t.z;
                if (ya < yLo || ya > yHi || yb2 < yLo || yb2 > yHi || za < zLo || za > zHi || zb < zLo || zb > zHi) continue;
              } else if (sinirC(Aa.c, Aa.y + t.y - x.y, Aa.z + t.z - x.z) + sinirC(Ab.c, Ab.y + x.y - t.y, Ab.z + x.z - t.z) > sinirC(Aa.c, Aa.y, Aa.z) + sinirC(Ab.c, Ab.y, Ab.z)) continue;
            }
            const once = cost(a) + cost(b);
            upd(a, x, -1); upd(b, t, -1); upd(a, t, 1); upd(b, x, 1);
            if (cost(a) + cost(b) < once - 1e-9) { Aa.items[k] = t; Ab.items[j] = x; iyi = true; }
            else { upd(a, t, -1); upd(b, x, -1); upd(a, x, 1); upd(b, t, 1); }
          }
        }
      }
    }
    let J = 0; for (let i = 0; i < P; i++) J += costCezali(i);
    if (J < bestJ - 1e-9) { bestJ = J; best = A.map(a => ({ items: a.items.map(x => x.s), w: a.w, l: a.l, y: a.y })); }
  }
  return { kisi: best!, totW, totL, totY };
}
