// Puantajda nöbet değişimi (yerine tutma, karşılıklı takas) ve izin/rapor nedeniyle yerine geçme: değişim yapılırsa
// hangi kurallar bozulur (engel / uyarı) ve kim yerine geçebilir.
import { eczaciMi, hazirlamaRol, ikiDisaridanSerbestMi, nobetciRol, type Baglam } from "./baglam";
import { ayIstatistik } from "./istatistik";
import { oncekiAySonKodu, puantajIzgarasi, type PuantajIzgarasi } from "./puantaj";
import { AYLAR, ayAnahtari, CUMA, CUMARTESI, PAZAR, PERSEMBE, sonrakiAy } from "./takvim";

export interface Degisiklik { y: number; m: number; gorev: "N" | "H"; tur: "devir" | "takas"; gun: number; cik: number; yer: number; gun2?: number; gorev2?: "N" | "H" }
export interface DegisimSonucu { engel: string[]; uyari: string[]; bilgi: string[] }

/** görevden çıkanın o günkü yeni kodu: tatilde ve normal mesaisi olmayanlarda boş, diğerlerinde normal mesai */
function cikYeniKod(B: Baglam, y: number, m: number, gun: number, cik: number): string {
  const st = B.kisi(cik);
  return B.tatilMi(y, m, gun) || (st && (st.role === "nobetci" || st.role === "destek")) ? "B" : "M";
}
const kisiAdi = (B: Baglam, id: number) => { const q = B.kisi(id); return q ? q.name : "(silinmiş)"; };

/** Değişim yapılırsa ne olur (asıl veri değişmez; varsayımsal puantajla denetlenir) */
export function degisimDenetle(B: Baglam, d: Degisiklik): DegisimSonucu {
  const out: DegisimSonucu = { engel: [], uyari: [], bilgi: [] }, y = d.y, m = d.m, ay = AYLAR[m];
  const HZ = d.gorev === "H", KOD = HZ ? "H" : "N", GOREV = HZ ? "hazırlama görevinde" : "nöbetçi";
  const KOD2 = d.gorev2 === "H" ? "H" : (d.gorev2 === "N" ? "N" : KOD), GOREV2 = KOD2 === "H" ? "hazırlama görevinde" : "nöbetçi";
  if (!d.cik || !d.yer) return out;
  if (d.cik === d.yer) { out.engel.push("Görevden çıkan ve yerine tutan aynı kişi."); return out; }
  const ad = (id: number) => kisiAdi(B, id);
  const G1 = puantajIzgarasi(B, y, m);
  const rc = G1.satirlar.find(x => x.s.id === d.cik), ry = G1.satirlar.find(x => x.s.id === d.yer);
  if (!rc || !ry) { out.engel.push("Kişilerden biri bu ay çalışmıyor."); return out; }
  if (!(d.gun >= 1 && d.gun <= G1.gunler.length)) { out.engel.push("Geçersiz tarih."); return out; }
  if (rc.cells[d.gun - 1].kod !== KOD) out.engel.push(ad(d.cik) + ", " + d.gun + " " + ay + " günü " + GOREV + " değil.");
  const takas = d.tur === "takas";
  if (takas) {
    if (!d.gun2) { out.engel.push("Takas için karşılık günü seçilmedi."); return out; }
    if (d.gun2 === d.gun) { out.engel.push("Takasın iki günü aynı olamaz."); return out; }
    if (ry.cells[d.gun2 - 1].kod !== KOD2) out.engel.push(ad(d.yer) + ", " + d.gun2 + " " + ay + " günü " + GOREV2 + " değil.");
  }
  // varsayımsal puantaj
  const k = ayAnahtari(y, m), asil = B.puantaj[k], kopya = JSON.parse(JSON.stringify(asil || {}));
  const uygula = (gun: number, cik: number, yer: number, kod: string) => { (kopya[cik] = kopya[cik] || {})[gun] = cikYeniKod(B, y, m, gun, cik); (kopya[yer] = kopya[yer] || {})[gun] = kod; };
  uygula(d.gun, d.cik, d.yer, KOD); if (takas) uygula(d.gun2!, d.yer, d.cik, KOD2);
  let G2: PuantajIzgarasi;
  B.puantaj[k] = kopya;
  try { G2 = puantajIzgarasi(B, y, m); } finally { if (asil === undefined) delete B.puantaj[k]; else B.puantaj[k] = asil; }
  // sonraki ayın 1. günü görevlileri (ayın son günü için art arda kontrolü)
  const sa = sonrakiAy(y, m), sS = B.cizelge(sa.y, sa.m);
  const sonrakiIlkN = sS && sS.days && sS.days[0] ? sS.days[0].assigned.map(p => p.id) : [];
  const sonrakiIlkH = sS && sS.days && sS.days[0] ? (sS.days[0].prep || []).map(p => p.id) : [];
  const oncekiSon = (id: number) => oncekiAySonKodu(B, id, y, m);

  const ortak = (id: number, gun: number, r1: PuantajIzgarasi["satirlar"][number], n: string, et: string) => {
    const once = r1.cells[gun - 1].kod;
    if (once === "YI") out.engel.push(n + " " + et + " yıllık izinde.");
    else if (once === "R") out.engel.push(n + " " + et + " raporlu.");
    else if (once === "DI") out.engel.push(n + " " + et + " izinli (diğer izin).");
    else if (once === "P") out.engel.push(n + " " + et + " tarihinde çalışmıyor (işe başlama / ayrılış dışında).");
    const pr = B.tercih(id, y, m, gun);
    if (pr === "izinli" && once !== "YI") out.engel.push(n + " " + et + " izinli olarak işaretli.");
    else if (pr !== "izinli" && B.izinArasiMi(id, y, m, gun)) out.engel.push(n + " " + et + " izin arasında (iki izin günü arasındaki tatil).");
    else if (B.izinHaftasiKenariMi(id, y, m, gun)) out.engel.push(n + " " + et + " bir haftalık yıllık izninin önündeki / arkasındaki hafta sonu.");
    if (pr === "esYok") out.engel.push(n + " için eş durumu: " + et + " gününe yazılmaması gerekiyor.");
    return once;
  };
  // yerine geçen nöbet alırsa
  const nobetKontrol = (id: number, gun: number) => {
    const st = B.kisi(id), r1 = G1.satirlar.find(x => x.s.id === id), r2 = G2.satirlar.find(x => x.s.id === id);
    const n = ad(id), et = gun + " " + ay, sonGun = gun === G1.gunler.length;
    if (!st || !r1 || !r2) return;
    const c2 = (i: number) => r2.cells[i];
    if (st.role === "destek") out.engel.push(n + " destek personeli; nöbet tutmaz.");
    const once = ortak(id, gun, r1, n, et);
    if (once === "N") out.engel.push(n + " " + et + " zaten nöbetçi.");
    if (B.tercih(id, y, m, gun) === "avoid") out.uyari.push(n + " " + et + " nöbet istemiyor olarak işaretli.");
    [-1, 1].forEach(kk => { const c = c2(gun - 1 + kk); if (c && c.kod === "N") out.engel.push(n + " " + (gun + kk) + ". gün de nöbetçi: art arda nöbet olur."); });
    if (gun === 1 && oncekiSon(id) === "N") out.engel.push(n + " önceki ayın son günü nöbetçi: art arda nöbet olur.");
    if (sonGun && sonrakiIlkN.indexOf(id) >= 0) out.engel.push(n + " sonraki ayın 1. günü nöbetçi: art arda nöbet olur.");
    if (gun === 1 && oncekiSon(id) === "H") out.engel.push(n + " önceki ayın son günü hazırlama görevinde (nöbetle komşu gün olamaz).");
    if (sonGun && sonrakiIlkH.indexOf(id) >= 0) out.engel.push(n + " sonraki ayın 1. günü hazırlama görevinde (nöbetle komşu gün olamaz).");
    if (once === "H") out.engel.push(n + " " + et + " hazırlama görevinde; aynı gün nöbete geçerse hazırlama yeri boş kalır.");
    [-1, 1].forEach(kk => { const c = c2(gun - 1 + kk); if (c && c.kod === "H") out.engel.push(n + " " + (gun + kk) + ". gün hazırlama görevinde (nöbetle komşu gün olamaz)."); });
    {
      const v = (k: number) => { const c = c2(gun - 1 + k); return !!(c && c.kod === "N"); };
      if ((v(-2) && v(-4)) || (v(-2) && v(2)) || (v(2) && v(4))) out.engel.push(n + " 5 gün içinde 3 nöbet tutmuş olur (ör. Pazartesi–Çarşamba–Cuma).");
    }
    const ara = B.sayi("minAra");
    for (let a2 = 2; a2 < ara; a2++) [-a2, a2].forEach(kk => { const c = c2(gun - 1 + kk); if (c && c.kod === "N") out.uyari.push(n + " " + (gun + kk) + ". gün de nöbetçi (en az " + ara + " gün ara önerilir)."); });
    // Kim ne kadar nöbet verip aldığı serbesttir: hafta sonu / Perşembe sayısı burada uyarılmaz,
    // ama Perşembe nöbeti ↔ aynı hafta sonu kuralı kontrol edilir
    const dwG = G1.gunler[gun - 1].dw, thuHs = B.ayar("thuHaftaSonu");
    if (dwG === PERSEMBE && thuHs) [2, 3].forEach(k => {
      const c = c2(gun - 1 + k); if (!c) return;
      if (c.kod === "H") out.engel.push(n + " " + (gun + k) + ". gün hazırlama görevinde; Perşembe nöbetini alırsa aynı hafta sonu hazırlama olur.");
      else if (c.kod === "N") out.uyari.push(n + " " + (gun + k) + ". gün de nöbetçi; Perşembe nöbetini tutan aynı hafta sonu nöbet tutmamalı.");
    });
    if (dwG === CUMA) {
      const c = c2(gun + 1);
      if (c && c.kod === "N") out.bilgi.push(n + " " + (gun + 2) + ". gün (Pazar) de nöbetçi (kural dışı değil; eşitlik gerekmiyorsa kaçınılır).");
      else if (c && c.kod === "H") out.bilgi.push(n + " " + (gun + 2) + ". gün (Pazar) hazırlama görevinde (kural dışı değil; eşitlik gerekmiyorsa kaçınılır).");
    }
    if (dwG === PAZAR) { const c = c2(gun - 3); if (c && c.kod === "N") out.bilgi.push(n + " aynı haftanın Cuma günü (" + (gun - 2) + ". gün) de nöbetçi (kural dışı değil; eşitlik gerekmiyorsa kaçınılır)."); }
    if ((dwG === CUMARTESI || dwG === PAZAR) && thuHs) { const c = c2(gun - 1 - (dwG === CUMARTESI ? 2 : 3)); if (c && c.kod === "N") out.uyari.push(n + " aynı haftanın Perşembe günü (" + (gun - (dwG === CUMARTESI ? 2 : 3)) + ". gün) nöbetçi."); }
  };
  // yerine geçen hazırlama alırsa
  const hazirlamaKontrol = (id: number, gun: number) => {
    const st = B.kisi(id), r1 = G1.satirlar.find(x => x.s.id === id), r2 = G2.satirlar.find(x => x.s.id === id);
    const n = ad(id), et = gun + " " + ay, sonGun = gun === G1.gunler.length;
    if (!st || !r1 || !r2) return;
    const c2 = (i: number) => r2.cells[i];
    if (!(st.role === "eczaci" || st.role === "teknisyen" || st.role === "destek" || st.role === "nobetci")) out.engel.push(n + " hazırlama görevi almaz (yalnızca eczacı, dışarıdan gelen eczacı, tekniker ve destek personeli).");
    const once = ortak(id, gun, r1, n, et);
    if (once === "N") out.engel.push(n + " " + et + " nöbetçi; aynı gün hazırlama yapamaz.");
    else if (once === "H") out.engel.push(n + " " + et + " zaten hazırlama görevinde.");
    if (!G1.gunler[gun - 1].tatil) out.uyari.push(et + " tatil günü değil; hazırlama yalnızca hafta sonu ve resmi tatilde yapılır.");
    [-1, 1].forEach(kk => { const c = c2(gun - 1 + kk); if (c && c.kod === "N") out.engel.push(n + " " + (gun + kk) + ". gün nöbetçi (hazırlama, nöbetle komşu gün olamaz)."); });
    if (gun === 1 && oncekiSon(id) === "N") out.engel.push(n + " önceki ayın son günü nöbetçi (hazırlama, nöbetle komşu gün olamaz).");
    if (sonGun && sonrakiIlkN.indexOf(id) >= 0) out.engel.push(n + " sonraki ayın 1. günü nöbetçi (hazırlama, nöbetle komşu gün olamaz).");
    [-1, 1].forEach(kk => { const c = c2(gun - 1 + kk); if (c && c.kod === "H") out.engel.push(n + " " + (gun + kk) + ". gün de hazırlama görevinde; art arda iki gün hazırlama yazılmaz."); });
    if (gun === 1 && oncekiSon(id) === "H") out.engel.push(n + " önceki ayın son günü hazırlama görevinde; art arda iki gün hazırlama yazılmaz.");
    if (sonGun && sonrakiIlkH.indexOf(id) >= 0) out.engel.push(n + " sonraki ayın 1. günü hazırlama görevinde; art arda iki gün hazırlama yazılmaz.");
    const dwH = G1.gunler[gun - 1].dw;
    if (dwH === PAZAR) { const c = c2(gun - 3); if (c && c.kod === "N") out.bilgi.push(n + " aynı haftanın Cuma günü (" + (gun - 2) + ". gün) nöbetçi; Pazar hazırlaması (kural dışı değil; eşitlik gerekmiyorsa kaçınılır)."); }
    if ((dwH === CUMARTESI || dwH === PAZAR) && B.ayar("thuHaftaSonu")) { const c = c2(gun - 1 - (dwH === CUMARTESI ? 2 : 3)); if (c && c.kod === "N") out.engel.push(n + " aynı haftanın Perşembe günü (" + (gun - (dwH === CUMARTESI ? 2 : 3)) + ". gün) nöbetçi; hafta sonu hazırlama yazılmaz."); }
  };
  // günün nöbetinde eczacı kalıyor mu, iki dışarıdan gelen eczacı birlikte mi
  const gunEczaci = (gun: number) => {
    const nb = G2.satirlar.filter(r => r.cells[gun - 1].kod === "N");
    if (nb.length && !nb.some(r => eczaciMi(r.s.role))) out.engel.push(gun + " " + ay + " günü nöbette eczacı kalmıyor.");
    if (nb.filter(r => r.s.role === "nobetci").length > 1 && !ikiDisaridanSerbestMi(y, m, gun)) out.engel.push(gun + " " + ay + " günü iki dışarıdan gelen eczacı birlikte nöbetçi olur (Cuma ve Cumartesi dışında aynı güne yalnızca biri nöbet yazılır; hazırlama olabilir).");
  };
  if (HZ) hazirlamaKontrol(d.yer, d.gun); else { nobetKontrol(d.yer, d.gun); gunEczaci(d.gun); }
  if (takas) { if (KOD2 === "H") hazirlamaKontrol(d.cik, d.gun2!); else { nobetKontrol(d.cik, d.gun2!); gunEczaci(d.gun2!); } }
  const karisik = takas && KOD2 !== KOD;
  [d.cik, d.yer].forEach(id => {
    const a1 = G1.satirlar.find(x => x.s.id === id), b1 = G2.satirlar.find(x => x.s.id === id);
    if (a1 && b1) out.bilgi.push(ad(id) + ": bu ay " + (karisik ? "nöbet " + a1.n + " → " + b1.n + ", hazırlama " + a1.h + " → " + b1.h : (HZ ? "hazırlama " + a1.h + " → " + b1.h : "nöbet " + a1.n + " → " + b1.n)) + ", fazla mesai " + a1.fm + " → " + b1.fm + " saat.");
  });
  out.engel = out.engel.filter((v, i, arr) => arr.indexOf(v) === i);
  out.uyari = out.uyari.filter((v, i, arr) => arr.indexOf(v) === i);
  return out;
}

/** yıl içinde kişi başı nöbet, hazırlama ve fazla mesai (çizelgeye göre) */
function yilGorevSayilari(B: Baglam, y: number) {
  const t: Record<string, { nobet: number; prep: number; fm: number }> = {};
  for (let mm = 0; mm < 12; mm++) {
    const sc = B.cizelge(y, mm); if (!sc || !Array.isArray(sc.days)) continue;
    const st = ayIstatistik(B, sc);
    Object.keys(st).forEach(id => { const a = t[id] || (t[id] = { nobet: 0, prep: 0, fm: 0 }), s = st[Number(id)]; a.nobet += s.nobet || 0; a.prep += s.prep || 0; a.fm += s.fm || 0; });
  }
  return t;
}

/** Görevden düşen kişinin (cik) yerine geçebilecekler: kurallara uyanlar önce, sonra yıl içinde en az görev alan */
export function yerineAdaylar(B: Baglam, y: number, m: number, gun: number, cik: number, gorev: "N" | "H") {
  const G = puantajIzgarasi(B, y, m), g = G.gunler[gun - 1], H = gorev === "H", Y = yilGorevSayilari(B, y);
  const out: { id: number; ad: string; rol: string; engel: number; uyari: number; yil: number; fm: number; k: DegisimSonucu }[] = [];
  G.satirlar.forEach(r => {
    const id = r.s.id; if (id === cik) return;
    if (H ? !(hazirlamaRol(r.s.role) || r.s.role === "destek") : !nobetciRol(r.s.role)) return;
    const c = r.cells[gun - 1]; if (!c || c.kod === "N" || c.kod === "H") return;
    if (["YI", "R", "DI", "NI", "P"].indexOf(c.kod) >= 0 || (c.kod === "B" && !g.tatil)) return;
    if (B.kesinYasak(id, y, m, gun)) return;
    const k = degisimDenetle(B, { y, m, gorev: H ? "H" : "N", tur: "devir", gun, cik, yer: id });
    const yt = Y[id] || { nobet: 0, prep: 0, fm: 0 };
    out.push({ id, ad: r.s.name, rol: r.s.role, engel: k.engel.length, uyari: k.uyari.length, yil: H ? yt.prep : yt.nobet, fm: yt.fm, k });
  });
  out.sort((a, b) => (Number(a.engel > 0) - Number(b.engel > 0)) || a.uyari - b.uyari || a.yil - b.yil || a.fm - b.fm || a.ad.localeCompare(b.ad, "tr"));
  return out;
}
