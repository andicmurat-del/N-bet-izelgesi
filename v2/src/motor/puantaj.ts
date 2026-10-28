// Aylık puantaj cetveli: kişi başı gün gün kod (M, N, H, NI, YI, R, DI, B, P) ve saat, toplamlar, fazla mesai ve
// 08:00-20:00 / 20:00-08:00 dilimleri. Çizelge + puantajdaki elle değişiklikler + acil servis nöbetleri birlikte okunur.
import { aktifAydaMi, aktifGunMu, type Baglam } from "./baglam";
import { AYLAR, ayAnahtari, ayGunSayisi, CUMA, CUMARTESI, haftaGunu, oncekiAy, PAZAR, PERSEMBE, sonrakiAy } from "./takvim";
import type { Kisi } from "../veri/tipler";

export const PUANTAJ_KODLARI = [["M", "Normal mesai"], ["N", "Nöbet"], ["H", "Hazırlama (tatil günü)"], ["NI", "Nöbet izni"], ["YI", "Yıllık izin"], ["R", "Rapor"], ["B", "Çalışmadı (devamsız / ücretsiz)"]];
/** cetvelde satır sırası */
export const ROL_SIRA: Record<string, number> = { eczaci: 0, nobetci: 1, teknisyen: 2, destek: 3, servis: 4 };

function kodSaati(B: Baglam, kod: string): number {
  if (kod === "M") return B.sayi("mesai");
  if (kod === "N") return B.sayi("nobetSuresi");
  if (kod === "H") return B.sayi("hazSaat");
  if (kod && kod.indexOf("S:") === 0) return Number(kod.slice(2)) || 0;
  return 0;
}

/** önceki ayın son günündeki kod (ayın 1'i nöbet izni mi) */
export function oncekiAySonKodu(B: Baglam, id: number, y: number, m: number): string {
  const pm = oncekiAy(y, m), dimP = ayGunSayisi(pm.y, pm.m);
  const ov = B.puantaj[ayAnahtari(pm.y, pm.m)];
  const o = ov && ov[id] && ov[id][dimP];
  if (o) return o;
  const st = B.kisi(id);
  if (st && !aktifGunMu(st, pm.y, pm.m, dimP)) return "P";
  const sch = B.cizelge(pm.y, pm.m);
  if (sch && sch.days[dimP - 1] && sch.days[dimP - 1].assigned.some(p => p.id === id)) return "N";
  if (sch && sch.days[dimP - 1] && (sch.days[dimP - 1].prep || []).some(p => p.id === id)) return "H";
  // acil servis nöbeti (acil eczane çizelgesinden) ayın son gününe düştüyse ertesi ayın 1'i nöbet iznidir
  const ac = (B.acil || {})[ayAnahtari(pm.y, pm.m)];
  if (ac && Array.isArray(ac[dimP]) && ac[dimP].indexOf(id) >= 0) return "N";
  return "";
}

export interface PuantajHucresi { kod: string; saat: number; ov: boolean; acil: boolean }
export interface PuantajGunu { gun: number; dw: number; tatil: boolean; arife: boolean; ms: number }
export interface PuantajSatiri {
  s: Kisi; cells: PuantajHucresi[]; toplam: number; fm: number;
  n: number; hi: number; cu: number; cmt: number; paz: number; thu: number; h: number; ni: number; yi: number; rd: number; rt: number;
  gunlerN: { gun: number; dw: number; tip: "N" | "H" }[];
  fmAdj: number; aylik: number | null; izinMesai: number; dusum: number; fmGece: number; fmGunduz: number;
}
export interface PuantajIzgarasi { y: number; m: number; gunler: PuantajGunu[]; satirlar: PuantajSatiri[]; mesaiGun: number; mesaiS: number; arifeVar: boolean; mesaiToplam: number; ay: string }

export function puantajIzgarasi(B: Baglam, y: number, m: number): PuantajIzgarasi {
  const dim = ayGunSayisi(y, m), sch = B.cizelge(y, m), ov = B.puantaj[ayAnahtari(y, m)] || {}, acilAy = B.acil[ayAnahtari(y, m)] || {};
  const gunler: PuantajGunu[] = [];
  for (let d = 1; d <= dim; d++) { const tt = B.tatilMi(y, m, d); gunler.push({ gun: d, dw: haftaGunu(y, m, d), tatil: tt, arife: !tt && B.arifeMi(y, m, d), ms: B.mesaiSaati(y, m, d) }); }
  const mesaiS = B.sayi("mesai"), mesaiGun = gunler.filter(g => !g.tatil).length;
  // arife varsa beklenen mesai gün gün saatle hesaplanır (arife yarım gün)
  const arifeVar = gunler.some(g => g.arife), mesaiToplam = gunler.reduce((t, g) => t + g.ms, 0);
  const kisiler = B.staff.filter(st => aktifAydaMi(st, y, m)).sort((a, b) => ROL_SIRA[a.role] - ROL_SIRA[b.role] || a.name.localeCompare(b.name, "tr") || a.id - b.id);
  const sa = sonrakiAy(y, m);
  const satirlar = kisiler.map(st => {
    const hucre: PuantajHucresi[] = []; let prev = oncekiAySonKodu(B, st.id, y, m);
    const r = { s: st, cells: hucre, toplam: 0, fm: 0, n: 0, hi: 0, cu: 0, cmt: 0, paz: 0, thu: 0, h: 0, ni: 0, yi: 0, rd: 0, rt: 0, gunlerN: [] } as unknown as PuantajSatiri;
    let nMesaiSaat = 0, niSaat = 0, pSaat = 0, izinMesai = 0;
    const sadeceNobet = st.role === "nobetci" || st.role === "destek"; // normal mesaisi olmayanlar: yalnızca nöbet/hazırlama günleri
    gunler.forEach((g, i) => {
      const o = ov[st.id] && ov[st.id][g.gun];
      let kod: string, acilFlag = false;
      const acilVar = !!(acilAy[g.gun] && acilAy[g.gun].indexOf(st.id) >= 0);
      if (o) {
        kod = o;
        // acil servis nöbetçi eczacısına puantajda elle yazılan nöbet, eczane nöbeti değil acil servis nöbetidir
        if (o === "N" && (st.role === "servis" || acilVar)) acilFlag = true;
      } else {
        const sd = sch && sch.days[i];
        if (!aktifGunMu(st, y, m, g.gun)) kod = "P";
        else if (sd && sd.assigned.some(p => p.id === st.id)) kod = "N";
        else if (sd && (sd.prep || []).some(p => p.id === st.id)) kod = "H";
        else if (acilVar) { kod = "N"; acilFlag = true; }
        else if (sadeceNobet) kod = st.role === "nobetci" && !g.tatil && prev === "N" ? "NI" : "B";
        else if (!g.tatil) {
          if (prev === "N") kod = "NI";
          else if (B.tercih(st.id, y, m, g.gun) === "izinli") kod = "YI";
          else kod = "M";
        } else kod = "B";
      }
      let saat = kod === "M" && g.arife ? g.ms : kodSaati(B, kod);
      // memur: yıllık izin ve raporlu gün, o günün normal mesai saatiyle çalışılmış sayılır
      if (!sadeceNobet && (kod === "YI" || kod === "R" || kod === "DI")) saat = g.ms;
      hucre.push({ kod, saat, ov: !!o, acil: acilFlag });
      r.toplam += saat;
      if (kod === "N") {
        r.n++;
        if (!acilFlag && B.resmiTatilMi(y, m, g.gun)) r.rt++;
        if (!g.tatil) nMesaiSaat += g.ms;
        if (g.dw === CUMARTESI) r.cmt++; else if (g.dw === PAZAR) r.paz++; else if (g.dw === CUMA) r.cu++; else r.hi++;
        if (g.dw === PERSEMBE) r.thu++;
        r.gunlerN.push({ gun: g.gun, dw: g.dw, tip: "N" });
      } else if (kod === "H") { r.h++; r.gunlerN.push({ gun: g.gun, dw: g.dw, tip: "H" }); }
      else if (kod === "NI") { r.ni++; niSaat += g.ms; }
      else if (kod === "YI") r.yi++;
      else if (kod === "R" || kod === "DI") r.rd++;
      if (!g.tatil && (kod === "YI" || kod === "R" || kod === "DI" || kod === "P")) { if (kod === "P") pSaat += g.ms; else izinMesai += g.ms; }
      prev = kod;
    });
    // Ay sınırı: nöbetin ertesi gün izni (Nİ) nöbetin yazıldığı aya sayılır (çizelge planlamasıyla aynı):
    //  - ayın 1. gününe düşen, önceki ayın son gün nöbetinden gelen Nİ bu ayın fazla mesaisini azaltmaz
    //  - ayın son günü nöbet varsa ve ertesi gün mesai günüyse o Nİ bu aydan düşülür
    const ilkNI = hucre.length && hucre[0].kod === "NI" && !hucre[0].ov && oncekiAySonKodu(B, st.id, y, m) === "N";
    const ileriNI = hucre.length && hucre[hucre.length - 1].kod === "N" && B.mesaiGunuMu(sa.y, sa.m, 1) ? B.mesaiSaati(sa.y, sa.m, 1) : 0;
    r.fmAdj = (ilkNI ? gunler[0].ms : 0) - ileriNI;
    // Aylık çalışma saati: ayın normal mesai saatleri (işe başlama öncesi / ayrılış sonrası günler hariç).
    // Fazla mesai = toplam çalışma saati (Yİ ve R günleri mesai sayılarak) − aylık çalışma saati.
    // Dışarıdan gelen eczacı: nöbet günü (mesai günüyse) ve nöbet izni gününün mesaisi düşülür. Destek: hazırlama saatleri.
    r.aylik = sadeceNobet ? null : mesaiToplam - pSaat;
    r.izinMesai = izinMesai;
    r.dusum = st.role === "nobetci" ? niSaat + nMesaiSaat : 0;
    r.fm = st.role === "nobetci" ? r.toplam - r.dusum + r.fmAdj : (sadeceNobet ? r.toplam : r.toplam - (r.aylik as number) + r.fmAdj);
    // saat dilimleri: nöbet 08:00'de başlar. 20:00-08:00 dilimi (12 saat) tamamen fazla mesaidir; 08:00-20:00
    // diliminden o günün normal mesaisi düşülür. Ertesi günün nöbet izni (Nİ) önce 08:00-20:00 diliminden düşülür
    // (niDusum gizli ayar, hep 1), yetmezse kalanı 20:00-08:00 diliminden. Nöbet dışı tüm farklar (hazırlama, özel
    // saat, eksik gün...) 08:00-20:00'e yazılır.
    {
      const L = kodSaati(B, "N"), gecePay = Math.min(12, L), gunduzOnce = B.sayi("niDusum") !== 2; let gece = 0;
      hucre.forEach((c, i) => {
        if (c.kod !== "N") return;
        let gd = Math.max(0, L - gecePay - gunler[i].ms), gc = gecePay;
        const D = i + 1 < hucre.length ? (hucre[i + 1].kod === "NI" ? gunler[i + 1].ms : 0) : ileriNI;
        if (gunduzOnce) { gd -= D; if (gd < 0) { gc += gd; gd = 0; } } else { gc -= D; if (gc < 0) { gd += gc; gc = 0; } }
        gece += Math.max(0, gc);
      });
      if (r.fm <= 0) { r.fmGece = 0; r.fmGunduz = r.fm; }
      else { r.fmGece = Math.min(gece, r.fm); r.fmGunduz = r.fm - r.fmGece; }
    }
    return r;
  });
  return { y, m, gunler, satirlar, mesaiGun, mesaiS, arifeVar, mesaiToplam, ay: AYLAR[m] + " " + y };
}
