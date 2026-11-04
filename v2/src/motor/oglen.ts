// Öğlen nöbeti: hafta içi öğle arasında diğerleri yemeğe giderken eczanede kalanlar. Nöbet ya da fazla mesai değildir,
// sırayla yapılan bir iştir. Pazartesi–Perşembe 2 eczacı + 1 tekniker, Cuma 3 eczacı + 2 tekniker. Eczacı: eczacı ve
// acilde nöbet tutan eczacılar da (acil servis personeli yazılmaz); Cuma'dan muaf işaretli kişiler (eczacı ya da tekniker) Cuma yazılmaz. O gün mesaide çalışanlardan yazılır (puantaja
// göre: izinli, raporlu, nöbet ertesi izinli olan yazılmaz); resmi tatil ve arife günü öğlen nöbeti yoktur.
// Hedefler (önem sırasıyla): herkese haftada bir (kişi yetmezse iki), yıl boyunca toplam sayı eşit, Cuma sayısı Cuma
// yazılabilenler arasında ayrıca eşit, mümkünse o günün eczane / acil servis nöbetçisine yazılmaz (eşitlik bozulmuyorsa),
// mümkünse aynı kişi art arda iki Cuma yazılmaz.
// Hangi gün tutulduğu eşitlikte önemsizdir; yalnız Cuma ayrıca sayılır.
import { aktifAydaMi, type Baglam } from "./baglam";
import { puantajIzgarasi } from "./puantaj";
import { ayAnahtari, ayGunSayisi, AYLAR, CUMA, gunKaydir, haftaGunu, oncekiAy, tarihNo } from "./takvim";

/** elle belirlenen yerler: e / t elle yazılan kişiler, be / bt elle boş bırakılan yer sayısı */
export interface OglenSabit { e: number[]; t: number[]; be?: number; bt?: number }
/** bir günün öğlen nöbetçileri (kişi id'leri): eczacılar, teknikerler; sabit: elle belirlenen yerler (yeniden oluşturma
 *  ve otomatik onarım yalnız bunlara dokunmaz); elle: günün tamamı elle (eski kayıtlar; gün hiç değişmez) */
export interface OglenGunu { e: number[]; t: number[]; elle?: true; sabit?: OglenSabit }
const bosSayisi = (sb: OglenSabit | undefined, g: "e" | "t") => (sb ? (g === "e" ? sb.be : sb.bt) || 0 : 0);

/** günde gereken kişi: Pazartesi–Perşembe, Cuma */
export const OGLEN_GEREK = { hafta: { e: 2, t: 1 }, cuma: { e: 3, t: 2 } };
type Grup = "e" | "t";
const GRUPLAR: Grup[] = ["e", "t"];
/** öğlen nöbetinde kişinin grubu: eczacı (acilde nöbet tutan eczacılar dahil: günlük eczanede mesai yaparlar) ya da
 *  tekniker; acil servis personeli, kemoterapi eczacısı ve destek personeli yazılmaz */
export const oglenGrubu = (rol: string): Grup | null => (rol === "eczaci" ? "e" : rol === "teknisyen" ? "t" : null);

/** amaç ağırlıkları (küçük daha iyi): haftada üçüncü kez çok ağır; haftada ikinci kez her seferinde ceza (kişi
 *  yetiyorsa herkes bir kez); eşitlik nöbetçiden kaçınmaktan önce gelir; art arda iki Cuma haftada ikinci kez kadar ağır */
const W = { hafta3: 1000, hafta: 3, toplam: 1, cuma: 3, cumaArdArda: 3, nobetci: 0.5, ardArda: 0.2 };

export interface OglenGunSonucu { gun: number; dw: number; e: number[]; t: number[]; nobetci: number[]; elle?: true; sabit?: OglenSabit }
export interface OglenSonucu { gunler: OglenGunSonucu[]; uyarilar: string[] }

/** öğlen nöbeti yazılan günler: hafta içi, resmi tatil ve arife değil */
export function oglenGunuMu(B: Baglam, y: number, m: number, d: number): boolean {
  return haftaGunu(y, m, d) <= CUMA && !B.tatilMi(y, m, d) && !B.arifeMi(y, m, d);
}

/** Yılın önceki aylarından kişi başı fark: o ay çalışan grup arkadaşlarının ortalamasına göre fazla (+) / eksik (−).
 *  Toplam ve Cuma ayrı; Cuma farkı yalnız Cuma yazılabilenler arasında. Ocak'ta sayım sıfırdan başlar. */
function oglenDevir(B: Baglam, y: number, m: number) {
  const top: Record<number, number> = {}, cuma: Record<number, number> = {};
  for (let mm = 0; mm < m; mm++) {
    const kayit = B.oglen[ayAnahtari(y, mm)]; if (!kayit) continue;
    for (const g of GRUPLAR) {
      const havuz = B.staff.filter(s => oglenGrubu(s.role) === g && aktifAydaMi(s, y, mm)); if (!havuz.length) continue;
      const cHavuz = havuz.filter(s => !s.cumaMuaf);
      const c: Record<number, number> = {}, f: Record<number, number> = {};
      havuz.forEach(s => { c[s.id] = 0; f[s.id] = 0; });
      for (const [gun, k] of Object.entries(kayit)) {
        const cu = haftaGunu(y, mm, Number(gun)) === CUMA;
        (k[g] || []).forEach(id => { if (c[id] === undefined) return; c[id]++; if (cu) f[id]++; });
      }
      const ort = havuz.reduce((t, s) => t + c[s.id], 0) / havuz.length;
      havuz.forEach(s => { top[s.id] = (top[s.id] || 0) + c[s.id] - ort; });
      if (cHavuz.length) {
        const ortF = cHavuz.reduce((t, s) => t + f[s.id], 0) / cHavuz.length;
        cHavuz.forEach(s => { cuma[s.id] = (cuma[s.id] || 0) + f[s.id] - ortF; });
      }
    }
  }
  return { top, cuma };
}

/** o gün öğlen nöbetine yazılabilenler (grup başına) ve o günün nöbetçileri */
function gunAdaylari(G: ReturnType<typeof puantajIzgarasi>, y: number, m: number, d: number) {
  const cu = haftaGunu(y, m, d) === CUMA, nobetci: number[] = [], ca: Record<Grup, number[]> = { e: [], t: [] };
  G.satirlar.forEach(r => {
    const g = oglenGrubu(r.s.role); if (!g) return;
    const c = r.cells[d - 1];
    // o gün mesaide: normal mesai ya da nöbet (eczane / acil servis nöbetçisi gün içinde de çalışır)
    if (!(c.kod === "M" || c.kod === "N" || (c.kod.indexOf("S:") === 0 && c.saat > 0))) return;
    if (c.kod === "N") nobetci.push(r.s.id);
    if (cu && r.s.cumaMuaf) return;
    ca[g].push(r.s.id);
  });
  return { ca, nobetci };
}

/**
 * Ayın öğlen nöbeti çizelgesini oluşturur (aynı veriyle her zaman aynı sonuç).
 * onceki: ayın kayıtlı öğlen nöbeti. Elle düzenlenen günler olduğu gibi kalır. onarim verilirse yalnız eksikler
 * doldurulur: o günden önceki günler hiç değişmez, sonraki günlerde hâlâ yazılabilen kişiler yerinde kalır (sonradan
 * girilen izin / rapor gibi durumlarda listenin geri kalanı karışmasın).
 */
export function oglenOlustur(B: Baglam, y: number, m: number, onceki: Record<string, OglenGunu> = {}, onarim?: { bugun: number }): OglenSonucu {
  const G = puantajIzgarasi(B, y, m), dim = ayGunSayisi(y, m), uyarilar: string[] = [];
  const ilkDw = haftaGunu(y, m, 1), hafta = (d: number) => Math.floor((d - 1 + ilkDw) / 7);
  const devir = oglenDevir(B, y, m);
  // ay hafta ortasında başlıyorsa önceki ayın aynı haftadaki öğlen nöbetleri haftalık sayıma girer
  const oncekiHafta: Record<number, number> = {};
  if (ilkDw > 0) {
    const o = oncekiAy(y, m), ok = B.oglen[ayAnahtari(o.y, o.m)] || {};
    for (let k = 1; k <= ilkDw; k++) {
      const [, , d] = gunKaydir(y, m, 1, -k), r = ok[d];
      if (r) [...(r.e || []), ...(r.t || [])].forEach(id => { oncekiHafta[id] = (oncekiHafta[id] || 0) + 1; });
    }
  }
  // ayın ilk Cuması için önceki ayın son Cuma'sındaki öğlen nöbetçileri (art arda iki Cuma sayımı)
  const oncekiCuma = new Set<number>();
  {
    const o = oncekiAy(y, m), ok = B.oglen[ayAnahtari(o.y, o.m)] || {};
    for (let d = 1; d <= 7; d++) if (haftaGunu(y, m, d) === CUMA) {
      const [, , od] = gunKaydir(y, m, d, -7), r = ok[od];
      if (r) [...(r.e || []), ...(r.t || [])].forEach(id => oncekiCuma.add(id));
    }
  }
  const gunler: OglenGunSonucu[] = [], aday: Record<Grup, number[][]> = { e: [], t: [] }, gerek: Record<Grup, number[]> = { e: [], t: [] };
  // sabit: değişmeyecek kişiler (gün başına, grup başına); tamSabit: gün hiç değişmez (elle ya da onarımda geçmiş gün)
  const sabit: Record<Grup, number[][]> = { e: [], t: [] }, tamSabit: boolean[] = [];
  for (let d = 1; d <= dim; d++) {
    const k = onceki[d], gecmis = !!onarim && tarihNo(y, m, d) < onarim.bugun;
    if (!oglenGunuMu(B, y, m, d) && !(k && (k.elle || k.sabit || gecmis))) continue;
    const dw = haftaGunu(y, m, d), cu = dw === CUMA, ger = cu ? OGLEN_GEREK.cuma : OGLEN_GEREK.hafta;
    const { ca, nobetci } = gunAdaylari(G, y, m, d);
    const tam = !!k && (!!k.elle || gecmis), sb = k?.sabit;
    gunler.push({ gun: d, dw, e: [], t: [], nobetci, ...(k?.elle ? { elle: true as const } : {}), ...(sb ? { sabit: sb } : {}) });
    tamSabit.push(tam);
    const hedef = { e: 0, t: 0 };
    for (const g of GRUPLAR) {
      aday[g].push(ca[g]);
      // elle yazılan kişiler yerinde kalır; onarımda öteki geçerli kişiler de kalır, yalnız eksikler doldurulur
      const elleKisi = sb ? (sb[g] || []).slice() : [];
      const kalan = tam ? (k![g] || []).slice() : [...elleKisi, ...(onarim && k ? (k[g] || []).filter(id => ca[g].includes(id) && !elleKisi.includes(id)) : [])];
      sabit[g].push(kalan);
      // elle boş bırakılan yer doldurulmaz
      hedef[g] = Math.max(0, ger[g] - bosSayisi(sb, g));
      const yazilabilen = new Set([...ca[g], ...elleKisi]).size;
      gerek[g].push(tam ? kalan.length : Math.max(kalan.length, Math.min(hedef[g], yazilabilen)));
    }
    if (tam) continue;
    const gunAd = d + " " + AYLAR[m];
    if (ca.e.length < hedef.e && (sb?.e.length || 0) < hedef.e) uyarilar.push(gunAd + ": öğlen nöbeti için " + ger.e + " eczacı gerekli, o gün çalışan " + ca.e.length + " eczacı var" + (cu ? " (Cuma'dan muaf olanlar hariç)" : "") + ".");
    if (ca.t.length < hedef.t && (sb?.t.length || 0) < hedef.t) uyarilar.push(gunAd + ": öğlen nöbeti için " + ger.t + " tekniker gerekli, o gün çalışan " + ca.t.length + " tekniker var" + (cu ? " (Cuma'dan muaf olanlar hariç)" : "") + ".");
  }

  const N = gunler.length, nobetciMi = gunler.map(x => new Set(x.nobetci));
  const ardisik = gunler.map((x, i) => i > 0 && gunler[i - 1].gun === x.gun - 1);
  const haftaNo = gunler.map(x => hafta(x.gun)), cumaMi = gunler.map(x => x.dw === CUMA);
  // bir önceki Cuma: bu aydaysa gün sırası, ay öncesindeyse -2, öğlen nöbeti yoksa -1
  const oncekiCumaNo = gunler.map(x => x.dw !== CUMA ? -1 : x.gun > 7 ? gunler.findIndex(z => z.gun === x.gun - 7) : -2);
  for (const g of GRUPLAR) {
    const havuz = B.staff.filter(s => oglenGrubu(s.role) === g && aktifAydaMi(s, y, m));
    const cumaHavuz = havuz.filter(s => !s.cumaMuaf);
    const sec: number[][] = gunler.map((_, i) => sabit[g][i].slice());
    // değişmez yerler: sabit kişiler listenin başında durur, arama yalnız sonrasına dokunur
    const ilkSerbest = sabit[g].map(l => l.length);
    const J = (): number => {
      const top: Record<number, number> = {}, cu: Record<number, number> = {}, hf: Record<string, number> = {};
      let j = 0;
      for (let i = 0; i < N; i++) for (const id of sec[i]) {
        top[id] = (top[id] || 0) + 1;
        if (cumaMi[i]) cu[id] = (cu[id] || 0) + 1;
        const k = haftaNo[i] + ":" + id; hf[k] = (hf[k] || 0) + 1;
        if (nobetciMi[i].has(id)) j += W.nobetci;
        if (ardisik[i] && sec[i - 1].includes(id)) j += W.ardArda;
        const oc = oncekiCumaNo[i];
        if (oc >= 0 ? sec[oc].includes(id) : oc === -2 && oncekiCuma.has(id)) j += W.cumaArdArda;
      }
      havuz.forEach(s => { const v = (top[s.id] || 0) + (devir.top[s.id] || 0); j += W.toplam * v * v; });
      cumaHavuz.forEach(s => { const v = (cu[s.id] || 0) + (devir.cuma[s.id] || 0); j += W.cuma * v * v; });
      for (const [k, v0] of Object.entries(hf)) {
        const v = v0 + (k.startsWith("0:") ? oncekiHafta[Number(k.slice(2))] || 0 : 0);
        j += (v > 1 ? W.hafta * (v - 1) : 0) + (v > 2 ? W.hafta3 * (v - 2) : 0);
      }
      return j;
    };
    // açgözlü başlangıç: gün gün, amacı en az artıran aday (eşitlikte listedeki sıra)
    for (let i = 0; i < N; i++) {
      while (sec[i].length < gerek[g][i]) {
        let en = -1, enJ = Infinity;
        for (const id of aday[g][i]) {
          if (sec[i].includes(id)) continue;
          sec[i].push(id); const v = J(); sec[i].pop();
          if (v < enJ - 1e-9) { enJ = v; en = id; }
        }
        if (en < 0) break;
        sec[i].push(en);
      }
    }
    // yerel arama: bir yeri başka adayla değiştir ya da iki günün kişilerini takas et; iyileşme kalmayana dek
    let cur = J();
    for (let tur = 0; tur < 100; tur++) {
      let iyi = false;
      for (let i = 0; i < N; i++) for (let q = ilkSerbest[i]; q < sec[i].length; q++) for (const id of aday[g][i]) {
        if (sec[i].includes(id)) continue;
        const eski = sec[i][q]; sec[i][q] = id; const v = J();
        if (v < cur - 1e-9) { cur = v; iyi = true; } else sec[i][q] = eski;
      }
      for (let i = 0; i < N; i++) for (let k = i + 1; k < N; k++) for (let a = ilkSerbest[i]; a < sec[i].length; a++) for (let b = ilkSerbest[k]; b < sec[k].length; b++) {
        const p = sec[i][a], r = sec[k][b];
        if (p === r || sec[k].includes(p) || sec[i].includes(r) || !aday[g][k].includes(p) || !aday[g][i].includes(r)) continue;
        sec[i][a] = r; sec[k][b] = p; const v = J();
        if (v < cur - 1e-9) { cur = v; iyi = true; } else { sec[i][a] = p; sec[k][b] = r; }
      }
      if (!iyi) break;
    }
    // haftada üçüncü öğlen nöbeti ancak o hafta kişi gerçekten yetmiyorsa kalır; bildirilir
    const hf: Record<string, number> = {};
    sec.forEach((l, i) => l.forEach(id => { const k = haftaNo[i] + ":" + id; hf[k] = (hf[k] ?? (haftaNo[i] === 0 ? oncekiHafta[id] || 0 : 0)) + 1; }));
    for (const [k, v] of Object.entries(hf)) if (v > 2) uyarilar.push((B.kisi(Number(k.split(":")[1]))?.name ?? "") + " bir haftada " + v + " öğlen nöbeti aldı (o hafta yeterli kişi yok).");
    gunler.forEach((x, i) => { x[g] = tamSabit[i] ? sec[i] : sec[i].slice().sort((a, b) => a - b); });
  }
  return { gunler, uyarilar };
}

/** Yıl içinde kişi başı öğlen nöbeti sayısı (toplam ve Cuma; yılın başından sonAy'a, ayrıca yalnız sonAy) */
export function oglenYillik(B: Baglam, y: number, sonAy: number): Record<number, { top: number; cuma: number; ay: number; ayCuma: number }> {
  const t: Record<number, { top: number; cuma: number; ay: number; ayCuma: number }> = {};
  for (let mm = 0; mm <= sonAy; mm++) {
    const kayit = B.oglen[ayAnahtari(y, mm)]; if (!kayit) continue;
    for (const [gun, k] of Object.entries(kayit)) {
      const cu = haftaGunu(y, mm, Number(gun)) === CUMA;
      [...(k.e || []), ...(k.t || [])].forEach(id => {
        const a = (t[id] ??= { top: 0, cuma: 0, ay: 0, ayCuma: 0 });
        a.top++; if (cu) a.cuma++;
        if (mm === sonAy) { a.ay++; if (cu) a.ayCuma++; }
      });
    }
  }
  return t;
}

/**
 * Kayıtlı öğlen nöbetlerinde sonradan bozulan günler (izin, rapor, nöbet ertesi izni, resmi tatil / arife işareti, Cuma
 * muafiyeti, çalışma dönemi): bugünden itibaren, elle düzenlenmemiş günlerde yazılamayacak kişi ya da doldurulabilecek
 * eksik yer var mı. Varsa ayın onarılmış hâli döner (eksikler doldurulur, geri kalanı yerinde kalır).
 */
export function oglenOnarimlari(B: Baglam, bugun: number): { y: number; m: number; gunler: OglenGunSonucu[] }[] {
  const out: { y: number; m: number; gunler: OglenGunSonucu[] }[] = [];
  for (const [ayK, kayit] of Object.entries(B.oglen)) {
    const [y, m] = ayK.split("-").map(Number), dim = ayGunSayisi(y, m);
    if (!kayit || tarihNo(y, m, dim) < bugun) continue;
    const G = puantajIzgarasi(B, y, m);
    let bozuk = false;
    for (let d = 1; d <= dim && !bozuk; d++) {
      if (tarihNo(y, m, d) < bugun) continue;
      const k = kayit[d];
      if (k?.elle) continue;
      if (!oglenGunuMu(B, y, m, d)) { bozuk = !!k && !k.sabit; continue; }
      const { ca } = gunAdaylari(G, y, m, d), ger = haftaGunu(y, m, d) === CUMA ? OGLEN_GEREK.cuma : OGLEN_GEREK.hafta;
      for (const g of GRUPLAR) {
        // elle yazılan kişiye ve elle boş bırakılan yere dokunulmaz
        const l = k ? k[g] || [] : [], elleKisi = k?.sabit?.[g] || [];
        const hedef = Math.max(0, ger[g] - bosSayisi(k?.sabit, g)), yazilabilen = new Set([...ca[g], ...elleKisi]).size;
        if (l.some(id => !ca[g].includes(id) && !elleKisi.includes(id)) || l.length < Math.min(hedef, yazilabilen)) bozuk = true;
      }
    }
    if (bozuk) out.push({ y, m, gunler: oglenOlustur(B, y, m, kayit, { bugun }).gunler });
  }
  return out;
}
