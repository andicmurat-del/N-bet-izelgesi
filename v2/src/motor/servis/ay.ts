// Servis hazırlamanın ay kaydı: gün gün kim çalışıyor (puantajdan), dağıtım, elle değişiklikler. Kayıtlı ve girdisi
// değişmemiş günler korunur; bugün ve sonrasında girdisi değişen günler yeniden dağıtılır; geçmiş günler kendiliğinden
// değişmez. Ay kaydı veride servisKayit["yıl-ay"] altında durur.
import type { Baglam } from "../baglam";
import { ayVeriVarMi } from "../istatistik";
import { puantajIzgarasi, type PuantajIzgarasi } from "../puantaj";
import { ayAnahtari, ayGunSayisi, AY_KISA, tarihNo } from "../takvim";
import { gunDagit, W, type Birikim } from "./dagit";
import { servisleriKur, ybMi, zorMu, type Servis } from "./liste";

/** dağıtım kuralı değişince artırılır: bugün ve sonraki günler bir kez yeniden dağıtılır, geçmiş günler değişmez */
const DAGITIM_SURUMU = "2";

export interface GunKaydi {
  /** o gün dağıtıma katılan teknikerler */
  k: number[];
  /** çok günlük servislerin gün sayısı */
  n: number;
  /** imza: girdisi değişti mi */
  i: string;
  /** servis adı → kişi */
  a: Record<string, number>;
  /** kişi başı servis-gün, yük, YB */
  w: Record<string, number>; l: Record<string, number>; yb: Record<string, number>;
  /** günün toplamları */
  t: { w: number; l: number; y: number };
  /** son değişiklik zamanı */
  z: number;
  /** "yeniden karıştır" sayacı */
  sk?: number;
  /** geçmiş gün, kişi ya da gün sayısı sonradan değişti */
  bayat?: number;
}
export interface AyKaydi {
  gun: Record<string, GunKaydi>;
  elle: Record<string, Record<string, boolean>>;
  gunElle: Record<string, number>;
  sk: Record<string, number>;
  ad: Record<string, string>;
  ata: Record<string, Record<string, number>>;
}
export interface HesapSecenegi {
  /** bu günden itibaren (geçmiş dahil) zorla yeniden dağıt */
  from?: number;
  /** from ile: geçmiş günleri yine de koru */
  gecmisKoru?: boolean;
  /** yalnız bu günü zorla yeniden dağıt */
  zorlaGun?: number;
  /** elle değiştirilen gün: kayıt olduğu gibi kalır, imzası güncellenir */
  imzaTazele?: number;
  /** geçmiş ay için de dağıtım oluştur */
  zorla?: boolean;
}

const ETIKET: Record<string, string> = { NI: "nöbet ertesi izni", YI: "yıllık izin", R: "raporlu", DI: "izinli", P: "çalışmıyor", B: "çalışmıyor" };
/** FNV-1a: kısa imza */
function kisaImza(t: string): string { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
/** kayıttaki imzadan kişi/gün kısmı (önceki sürüm imzayı JSON dizisi olarak saklıyordu) */
function kisiGunImzasi(i: unknown): string {
  const s = String(i || "");
  if (s.charAt(0) === "[") { try { const a = JSON.parse(s); return (a[0] || []).join(",") + "/" + a[1]; } catch { return ""; } }
  return s.split("/").slice(0, 2).join("/");
}
const teknikerSatirlari = (G: PuantajIzgarasi) => G.satirlar.filter(r => r.s.role === "teknisyen");

/** servis hesabının bağlamı: veri, servis listesi, bugün (YYYYAAGG; öncesi geçmiş sayılır) */
export class ServisMotoru {
  readonly servisler: Servis[];
  private readonly adla: Map<string, Servis>;
  constructor(readonly B: Baglam, servisAyar: unknown, readonly bugun: number) {
    this.servisler = servisleriKur(servisAyar);
    this.adla = new Map(this.servisler.map(s => [s.name, s]));
  }
  servis(sn: string): Servis | undefined { return this.adla.get(sn); }
  /** servisin o günkü yükü: hasta × zorluk (çok günlükse gün sayısıyla) */
  yuk(sn: string, n: number): number { const s = this.servis(sn); return s ? s.h * s.z * (s.multi ? n : 1) : 0; }
  private kod(sn: string): string { const s = this.servisler.find(x => x.name === sn); return s && s.kod ? s.kod : sn; }
  /** servis ayarlarının kısa özeti (her gün kaydında tam metin saklanmasın) */
  private ayarImzasi(): string {
    return kisaImza(this.servisler.filter(s => s.on).map(s => (s.kod || s.name) + ":" + s.z + ":" + s.h + ":" + (s.multi ? 1 : 0)).join("|"));
  }

  // ---- ay kaydı ----
  kayit(y: number, m: number, olustur: true): AyKaydi;
  kayit(y: number, m: number, olustur: false): AyKaydi | null;
  kayit(y: number, m: number, olustur: boolean): AyKaydi | null {
    const B = this.B;
    if (!B.servisKayit || typeof B.servisKayit !== "object") B.servisKayit = {};
    const k = ayAnahtari(y, m);
    if (!B.servisKayit[k]) { if (!olustur) return null; B.servisKayit[k] = { gun: {}, elle: {}, gunElle: {}, sk: {}, ad: {}, ata: {} }; }
    const R = B.servisKayit[k];
    if (!R.__ok) {
      (["gun", "elle", "gunElle", "sk", "ad"] as const).forEach(a => { if (!R[a] || typeof R[a] !== "object" || Array.isArray(R[a])) R[a] = {}; });
      // bozuk ya da eksik gün kayıtları atılır (yedekten yüklenen eski/yanlış veri)
      Object.keys(R.gun).forEach(d => {
        const g = R.gun[d];
        if (!g || !Array.isArray(g.k) || !g.a || typeof g.a !== "object" || !g.t || typeof g.n !== "number") { delete R.gun[d]; return; }
        (["w", "l", "yb"] as const).forEach(f => { if (!g[f] || typeof g[f] !== "object") g[f] = {}; });
      });
      Object.defineProperty(R, "__ok", { value: true, enumerable: false, configurable: true });
    }
    if (!R.ata || typeof R.ata !== "object" || Array.isArray(R.ata)) R.ata = {};   // elle atamalar: {gün: {servis: kişi}}
    return R as AyKaydi;
  }
  kayitKopyasi(y: number, m: number): AyKaydi | null { const R = this.B.servisKayit[ayAnahtari(y, m)]; return R ? JSON.parse(JSON.stringify(R)) : null; }

  // ---- takvim ----
  gunNo(y: number, m: number, d: number) { return tarihNo(y, m, d); }
  gecmisAy(y: number, m: number): boolean { return tarihNo(y, m, ayGunSayisi(y, m)) < this.bugun; }
  /** servis dağıtımı yalnızca nöbet çizelgesi olan aylarda yapılır (çizelge yoksa kayıt yok sayılır) */
  cizelgeVar(y: number, m: number): boolean {
    try { const sc = this.B.cizelge(y, m); return !!(sc && ayVeriVarMi(sc)); } catch { return true; }
  }
  otoHesaplanir(y: number, m: number): boolean { return this.cizelgeVar(y, m) && (!!this.kayit(y, m, false) || !this.gecmisAy(y, m)); }
  /** çok günlük servisin bu sefer kaç gün hazırlanacağı: o gün + ardından gelen tatil günleri */
  otoGun(y: number, m: number, d: number): number {
    const dt = new Date(y, m, d); let n = 1;
    for (let i = 0; i < 14; i++) { dt.setDate(dt.getDate() + 1); if (this.B.tatilMi(dt.getFullYear(), dt.getMonth(), dt.getDate())) n++; else break; }
    return n;
  }

  /** o günün teknikerleri (puantajdan); elle kapatılan/açılan kişiler R.elle'den */
  gunKisileri(G: PuantajIzgarasi, R: AyKaydi, d: number) {
    const el = R.elle[d] || {};
    return teknikerSatirlari(G).filter(r => r.cells[d - 1] && r.cells[d - 1].kod !== "P").map(r => {
      const c = r.cells[d - 1], kod = c.kod;
      const calisiyor = kod === "M" || kod === "N" || kod === "H" || (kod && kod.indexOf("S:") === 0 && c.saat > 0);
      const id = r.s.id, oto = !!calisiyor;
      const on = Object.prototype.hasOwnProperty.call(el, id) ? !!el[id] : oto;
      return { id, name: r.s.name, on, oto, elle: on !== oto, etiket: kod === "N" ? "nöbetçi" : (calisiyor ? "" : (ETIKET[kod] || "çalışmıyor")) };
    });
  }

  /** önceki günün kaydını birikime ekler */
  private birikimEkle(cum: Record<string, Birikim>, rec: GunKaydi) {
    const P = rec.k.length; if (!P) return;
    const t = rec.t || { w: 0, l: 0, y: 0 };
    // zor servis sayısı kayıttaki servis adlarından, güncel zorluk puanına göre sayılır
    let zToplam = 0; const zKisi: Record<string, number> = {};
    Object.keys(rec.a).forEach(sn => { if (zorMu(this.servis(sn))) { zToplam++; zKisi[rec.a[sn]] = (zKisi[rec.a[sn]] || 0) + 1; } });
    rec.k.forEach(id => {
      const c = cum[id] || (cum[id] = { w: 0, l: 0, y: 0, zr: 0, fw: 0, fl: 0, fy: 0, fz: 0, rep: {}, frep: {}, gun: 0 });
      c.fw += t.w / P; c.fl += t.l / P; c.fy += t.y / P; c.fz += zToplam / P; c.gun++;
      Object.keys(rec.a).forEach(sn => { c.frep[sn] = (c.frep[sn] || 0) + 1 / P; });
      c.w += (rec.w && rec.w[id]) || 0; c.l += (rec.l && rec.l[id]) || 0; c.y += (rec.yb && rec.yb[id]) || 0;
    });
    Object.keys(rec.a).forEach(sn => { const c = cum[rec.a[sn]]; if (c) c.rep[sn] = (c.rep[sn] || 0) + 1; });
    Object.keys(zKisi).forEach(id => { const c = cum[id]; if (c) c.zr += zKisi[id]; });
  }

  /** Ayın tüm mesai günlerini hesaplar. Denge ay içinde kurulur: her ay sıfırdan başlar, önceki ayların dağıtımı bu ayı
   *  etkilemez (eski uygulama aynı yılın önceki aylarını da birikime katıyordu). Dönüş: kayıt değişti mi. */
  ayHesapla(y: number, m: number, opts: HesapSecenegi = {}): boolean {
    const R = this.kayit(y, m, true), once = JSON.stringify(R);
    let G: PuantajIzgarasi; try { G = puantajIzgarasi(this.B, y, m); } catch { return false; }
    const dim = ayGunSayisi(y, m), bugun = this.bugun, cfg = this.ayarImzasi();
    const svcs = this.servisler.filter(s => s.on);
    const cum: Record<string, Birikim> = {}; let degisti = false;
    teknikerSatirlari(G).forEach(r => { R.ad[r.s.id] = r.s.name; });
    for (let d = 1; d <= dim; d++) {
      if (this.B.tatilMi(y, m, d)) { if (R.gun[d]) { delete R.gun[d]; degisti = true; } continue; }
      const aktif = this.gunKisileri(G, R, d).filter(k => k.on).map(k => k.id);
      const n = R.gunElle[d] || this.otoGun(y, m, d), sk = R.sk[d] || 0;
      const ata = R.ata[d] || {}, sabit: Record<string, number> = {};
      Object.keys(ata).forEach(sn => { const ix = aktif.indexOf(ata[sn]); if (ix >= 0 && svcs.some(s => s.name === sn)) sabit[sn] = ix; });
      const ataImza = Object.keys(sabit).map(sn => [this.kod(sn), sn]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(([kd, sn]) => kd + "=" + aktif[sabit[sn]]).join(";");
      const ik = aktif.join(",") + "/" + n, imza = ik + "/" + cfg + "/" + sk + "/" + kisaImza(ataImza) + "/" + DAGITIM_SURUMU;
      const eski = R.gun[d], gecmis = tarihNo(y, m, d) < bugun, zorla = (opts.from && d >= opts.from && !(opts.gecmisKoru && gecmis)) || opts.zorlaGun === d;
      // elle değiştirilen gün: kayıt olduğu gibi kalır, imzası güncellenir
      if (eski && opts.imzaTazele === d) { eski.i = imza; delete eski.bayat; this.birikimEkle(cum, eski); continue; }
      if (eski && !zorla && (gecmis || (!degisti && eski.i === imza))) {
        // geçmiş gün: yalnızca kişi ya da gün sayısı değiştiyse uyarı (servis ayarı değişikliği geçmişi bozmaz)
        if (kisiGunImzasi(eski.i) !== ik) eski.bayat = 1; else delete eski.bayat;
        this.birikimEkle(cum, eski); continue;
      }
      if (!aktif.length || !svcs.length) { if (eski) { delete R.gun[d]; degisti = true; } continue; }
      // "Yeniden karıştır" (sk değişti) o günü baştan dağıtır. Diğer yeniden hesaplamalarda bugünün listesi (yazdırılmış
      // olabilir) korunmaya çalışılır; sonraki günler eşitlik için serbestçe yeniden dağıtılır (eski liste korunursa
      // izin/rapor girdikçe günlük yük ve servis tekrarı dengesi bozuluyordu)
      const onceki = eski && (eski.sk || 0) === sk ? eski.a : null;
      const mW = tarihNo(y, m, d) === bugun ? W.M : 0;
      const res = gunDagit(aktif.map(id => ({ id })), svcs, n, cum, tarihNo(y, m, d) * 31 + sk * 977, sabit, onceki, mW);
      const rec: GunKaydi = { k: aktif, n, i: imza, a: {}, w: {}, l: {}, yb: {}, t: { w: res.totW, l: res.totL, y: res.totY }, z: Date.now() };
      if (sk) rec.sk = sk;
      res.kisi.forEach((p, ix) => { const id = aktif[ix]; p.items.forEach(s => { rec.a[s.name] = id; }); rec.w[id] = p.w; rec.l[id] = p.l; rec.yb[id] = p.y; });
      if (!eski || JSON.stringify(eski.a) !== JSON.stringify(rec.a) || JSON.stringify(eski.k) !== JSON.stringify(rec.k) || eski.n !== rec.n) degisti = true;
      else rec.z = eski.z;
      R.gun[d] = rec;
      this.birikimEkle(cum, rec);
    }
    return JSON.stringify(R) !== once;
  }

  /** ayın kaydı ve puantajı, tekniker adı (silinmiş kişiler için kayıttaki ad) */
  ayVerisi(y: number, m: number) {
    const R = this.kayit(y, m, false) || { gun: {}, elle: {}, gunElle: {}, sk: {}, ad: {}, ata: {} } as AyKaydi;
    const G = puantajIzgarasi(this.B, y, m);
    const satir = teknikerSatirlari(G);
    const ad = (id: number) => { const r = satir.find(x => x.s.id === id); return r ? r.s.name : (R.ad[id] || "(silinmiş)"); };
    return { R, G, satir, ad };
  }
  /** bir günün dağıtımı: kişi başı servisler (YB'ler önce), yük ve zor servis sayısı */
  gunSonucu(V: ReturnType<ServisMotoru["ayVerisi"]>, d: number) {
    const rec = V.R.gun[d]; if (!rec) return null;
    const kisi = rec.k.map(id => ({ id, name: V.ad(id), items: [] as { name: string; multi: boolean; l: number; zor: boolean }[], total: 0, w: rec.w[id] || 0, yb: rec.yb[id] || 0, zr: 0 }));
    const svcs: { name: string; multi: boolean; l: number; zor: boolean }[] = [];
    Object.keys(rec.a).forEach(sn => {
      const p = kisi.find(k => k.id === rec.a[sn]); if (!p) return;
      const s = this.servis(sn) || { name: sn, h: 0, z: 0, multi: false };
      const l = s.h * s.z * (s.multi ? rec.n : 1);
      const it = { name: sn, multi: !!s.multi, l, zor: !!zorMu(s) };
      p.items.push(it); p.total += l; svcs.push(it); if (it.zor) p.zr++;
    });
    const ybSv = (sn: string) => (ybMi(sn) ? 1 : 0);
    kisi.forEach(p => p.items.sort((a, b) => (ybSv(b.name) - ybSv(a.name)) || a.name.localeCompare(b.name, "tr")));
    kisi.sort((a, b) => a.name.localeCompare(b.name, "tr"));
    return { rec, kisi, svcs };
  }

  // ---- elle atama ----
  kisiServisleri(rec: GunKaydi, id: number): string[] { return Object.keys(rec.a).filter(sn => rec.a[sn] === id); }
  private gunSinirlari(rec: GunKaydi) {
    const P = rec.k.length, adlar = Object.keys(rec.a), S = adlar.length, Y = adlar.filter(ybMi).length, gs: Record<number, number> = {};
    adlar.forEach(sn => { const s = this.servis(sn); (s ? s.grps : []).forEach(g => { gs[g] = (gs[g] || 0) + 1; }); });
    return { cLo: Math.floor(S / P), cHi: Math.ceil(S / P), yLo: Math.floor(Y / P), yHi: Math.ceil(Y / P), cap: (g: number) => Math.ceil((gs[g] || 0) / P) };
  }
  /** id kişisi sn servisini alırsa (cikan servis kişiden ayrılırken) aynı grupta sınırı aşan servisler */
  private grupCakisma(rec: GunKaydi, K: ReturnType<ServisMotoru["gunSinirlari"]>, id: number, sn: string, cikan: string | null) {
    const s = this.servis(sn); if (!s) return [];
    const L = this.kisiServisleri(rec, id).filter(x => x !== cikan && x !== sn), out: string[] = [];
    s.grps.forEach(g => {
      const ayni = L.filter(x => { const t = this.servis(x); return t && t.grps.indexOf(g) >= 0; });
      if (ayni.length + 1 > K.cap(g)) ayni.forEach(x => { if (out.indexOf(x) < 0) out.push(x); });
    });
    return out;
  }
  /** sn servisi hedef kişiye verilirse: sayı/YB dengesi bozulacaksa hedefin aynı türden, yükü en yakın servisi karşılık
   *  olarak geri verilir */
  degisimPlani(rec: GunKaydi, R: AyKaydi, d: number, sn: string, hedef: number) {
    const K = this.gunSinirlari(rec), kaynak = rec.a[sn], ata = R.ata[d] || {};
    const ks = this.kisiServisleri(rec, kaynak).filter(x => x !== sn), hs = this.kisiServisleri(rec, hedef).concat([sn]);
    const tamam = (L: string[]) => { const yb = L.filter(ybMi).length; return L.length >= K.cLo && L.length <= K.cHi && yb >= K.yLo && yb <= K.yHi; };
    let karsilik: string | null = null;
    if (!tamam(ks) || !tamam(hs)) {
      const l0 = this.yuk(sn, rec.n);
      karsilik = this.kisiServisleri(rec, hedef).filter(t => ybMi(t) === ybMi(sn) && ata[t] !== hedef && !this.grupCakisma(rec, K, kaynak, t, sn).length)
        .sort((a, b) => Math.abs(this.yuk(a, rec.n) - l0) - Math.abs(this.yuk(b, rec.n) - l0))[0] || null;
    }
    const uyari: string[] = [], cak = this.grupCakisma(rec, K, hedef, sn, karsilik);
    if (cak.length) uyari.push("Grup kuralı: aynı gün " + cak.join(", ") + " de bu kişide.");
    if (!karsilik && (!tamam(ks) || !tamam(hs))) uyari.push("Karşılık verilecek uygun servis yok; o gün kişi başı servis ya da YB sayısı 1'den fazla farklı olur.");
    return { kaynak, hedef, karsilik, uyari };
  }
  /** elle değişiklikten sonra günün kişi başı toplamları */
  kayitTopla(rec: GunKaydi) {
    rec.w = {}; rec.l = {}; rec.yb = {};
    rec.k.forEach(id => { rec.w[id] = 0; rec.l[id] = 0; rec.yb[id] = 0; });
    Object.keys(rec.a).forEach(sn => {
      const id = rec.a[sn], s = this.servis(sn), w = s && s.multi ? rec.n : 1;
      if (rec.w[id] === undefined) return;
      rec.w[id] += w; rec.l[id] += s ? s.h * s.z * w : 0; if (ybMi(sn)) rec.yb[id]++;
    });
  }

  // ---- yıllık ----
  yillikVeri(yil: number) {
    const aylar: GunKaydi[][] = [], adlar: Record<string, string> = {};
    type KisiYil = { id: number; ay: ({ gun: number; w: number; l: number } | null)[]; gun: number; w: number; l: number; fw: number; fl: number; y: number; adet: number };
    const kisi: Record<string, KisiYil> = {};
    (this.B.staff || []).forEach(st => { adlar[st.id] = st.name; });
    for (let mm = 0; mm < 12; mm++) {
      const R = this.cizelgeVar(yil, mm) && this.B.servisKayit && this.B.servisKayit[ayAnahtari(yil, mm)];
      const recs: GunKaydi[] = R && R.gun ? Object.keys(R.gun).map(Number).sort((a, b) => a - b).map(d => R.gun[d]).filter((g: GunKaydi) => g && Array.isArray(g.k) && g.k.length && g.a && g.t) : [];
      if (R && R.ad) Object.keys(R.ad).forEach(id => { if (!adlar[id]) adlar[id] = R.ad[id]; });
      aylar.push(recs);
      recs.forEach(g => {
        const P = g.k.length;
        g.k.forEach(id => {
          const k = kisi[id] || (kisi[id] = { id, ay: AY_KISA.map(() => null), gun: 0, w: 0, l: 0, fw: 0, fl: 0, y: 0, adet: 0 });
          const a = k.ay[mm] || (k.ay[mm] = { gun: 0, w: 0, l: 0 });
          a.gun++; a.w += g.w[id] || 0; a.l += g.l[id] || 0; k.gun++; k.w += g.w[id] || 0; k.l += g.l[id] || 0; k.y += g.yb[id] || 0; k.fw += g.t.w / P; k.fl += (g.t.l || 0) / P;
        });
        Object.keys(g.a).forEach(sn => { const k = kisi[g.a[sn]]; if (k) k.adet++; });
      });
    }
    const ad = (id: number) => adlar[id] || "(silinmiş)";
    const ids = Object.keys(kisi).map(Number).sort((a, b) => ad(a).localeCompare(ad(b), "tr"));
    return { yil, aylar, kisi, ids, ad, kayitli: aylar.filter(r => r.length).length };
  }
}
