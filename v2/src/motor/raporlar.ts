// Raporlar: günlük çalışma listesi, acil servis denetimi, yılın raporu (ay ay puantaj özeti ve yıllık denge),
// uyarıların önem sınıfı.
import { aktifAydaMi, ayrildiMi, nobetciRol, type Baglam } from "./baglam";
import { ayVeriVarMi } from "./istatistik";
import { puantajIzgarasi, ROL_SIRA, type PuantajIzgarasi } from "./puantaj";
import { ayAnahtari, ayGunSayisi, AY_KISA, CUMA, CUMARTESI, haftaGunu, PAZAR, PERSEMBE } from "./takvim";

// ---- günlük çalışma listesi: puantaja göre her gün kim onayda, kim hazırlamada, kim yok (izin/rapor) ----
type ListeKisisi = { s: PuantajIzgarasi["satirlar"][number]["s"]; kod: string; saat: number; acil: boolean };
function gunlukListe(G: PuantajIzgarasi, d: number) {
  const var_: ListeKisisi[] = [], yok: { s: ListeKisisi["s"]; neden: string }[] = [], tatil = !!G.gunler[d - 1].tatil;
  G.satirlar.forEach(r => {
    const c = r.cells[d - 1], kod = c.kod;
    const calisiyor = kod === "M" || kod === "N" || kod === "H" || (kod && kod.indexOf("S:") === 0 && c.saat > 0);
    if (calisiyor) { var_.push({ s: r.s, kod, saat: c.saat, acil: !!c.acil }); return; }
    const neden = ({ NI: "Nöbet ertesi izni", YI: "Yıllık izin", R: "Raporlu", DI: "Diğer izin" } as Record<string, string>)[kod];
    if (neden) yok.push({ s: r.s, neden });
  });
  let onay: ListeKisisi[], haz: ListeKisisi[], dst: ListeKisisi[];
  // hafta sonu / tatil: dışarıdan gelen eczacı ayrı listelenmez, görevine göre onaycı ya da hazırlamacıdır
  const gel = tatil ? [] : var_.filter(x => x.s.role === "nobetci");
  if (tatil) {
    // Hafta sonu/tatil: nöbetçiler onay görevinde; 2 hazırlamacı rolü ne olursa olsun hazırlama görevinde. Acil serviste
    // nöbet tutan eczacılar hafta sonu / tatil listesinde gösterilmez: yalnız günlük eczanede nöbet tutanlar onaycıdır.
    const acilMi = (x: ListeKisisi) => x.acil || x.s.role === "servis";
    const hazMi = (x: ListeKisisi) => x.kod === "H" && !acilMi(x);
    const onayMi = (x: ListeKisisi) => x.kod === "N" && !acilMi(x);
    onay = var_.filter(onayMi);
    haz = var_.filter(hazMi);
    dst = [];
    // nöbet/hazırlama dışında kalan diğer çalışanlar rolüne göre yerleşir
    var_.forEach(x => {
      if (acilMi(x) || onayMi(x) || hazMi(x) || x.s.role === "nobetci") return;
      if (x.s.role === "eczaci") onay.push(x); else haz.push(x);
    });
  } else {
    onay = var_.filter(x => x.s.role === "eczaci" || x.s.role === "servis");
    haz = var_.filter(x => x.s.role === "teknisyen");
    dst = var_.filter(x => x.s.role === "destek");
  }
  const azSira = (a: { s: { name: string } }, b: { s: { name: string } }) => a.s.name.localeCompare(b.s.name, "tr");
  [onay, haz, dst, gel, yok].forEach(l => l.sort(azSira));
  return { tatil, onay, haz, dst, gel, yok, toplam: var_.length, nobetci: var_.filter(x => x.kod === "N" && !x.acil).length, acilN: var_.filter(x => x.acil).length };
}
export function calismaListesi(B: Baglam, y: number, m: number) {
  const G = puantajIzgarasi(B, y, m);
  return G.gunler.map(g => ({ gun: g.gun, dw: g.dw, ...gunlukListe(G, g.gun) }));
}

// ---- acil servis nöbeti denetimi: aynı kişi iki kez, izin/eş durumu, art arda iki gün, aynı gün eczane nöbeti ----
export function acilDenetle(B: Baglam, y: number, m: number, g: number, ids: number[]) {
  const ay = B.acil[ayAnahtari(y, m)] || {}, out: { sev: "hata" | "uyari"; t: string }[] = [];
  if (ids.length === 2 && ids[0] === ids[1]) out.push({ sev: "hata", t: "Aynı kişi iki kez seçilemez." });
  const sch = B.cizelge(y, m);
  [...new Set(ids)].forEach(id => {
    const s = B.kisi(id); if (!s) return;
    if (B.kesinYasak(id, y, m, g)) out.push({ sev: "uyari", t: s.name + " bu gün izinli, eş durumu nedeniyle yazılmamalı ya da çalışma dönemi dışında." });
    [-1, 1].forEach(k => { if ((ay[g + k] || []).indexOf(id) >= 0) out.push({ sev: "uyari", t: s.name + ", " + (g + k) + ". gün de acil serviste nöbetçi (nöbet ertesi gün izin gerekir)." }); });
    if (sch && sch.days[g - 1] && sch.days[g - 1].assigned.some(p => p.id === id)) out.push({ sev: "uyari", t: s.name + " aynı gün eczane nöbetçisi." });
  });
  return out;
}

// ---- yılın raporu ----
interface AyDetay { fm: number; nobet: number; hi: number; cu: number; cmt: number; paz: number; thu: number; prep: number; ni: number; yi: number; rd: number; rt: number; gunler: { gun: number; dw: number; tip: string }[] }
const bosDetay = (): AyDetay => ({ fm: 0, nobet: 0, hi: 0, cu: 0, cmt: 0, paz: 0, thu: 0, prep: 0, ni: 0, yi: 0, rd: 0, rt: 0, gunler: [] });

/** ayın kişi başı özeti (puantajdan; listeden çıkarılmış kişilerin eski çizelge verisi dahil) */
function ayDetayi(B: Baglam, y: number, m: number): Record<number, AyDetay> {
  const G = puantajIzgarasi(B, y, m), r: Record<number, AyDetay> = {};
  G.satirlar.forEach(x => { r[x.s.id] = { fm: x.fm, nobet: x.n, hi: x.hi, cu: x.cu, cmt: x.cmt, paz: x.paz, thu: x.thu, prep: x.h, ni: x.ni, yi: x.yi, rd: x.rd, rt: x.rt || 0, gunler: x.gunlerN }; });
  const sch = B.cizelge(y, m);
  if (sch) {
    const dimS = ayGunSayisi(y, m), hz = B.sayi("hazSaat");
    const silinmis = (p: { id: number }) => !B.staff.some(s => s.id === p.id);
    sch.days.forEach(d => {
      const dw = haftaGunu(y, m, d.day), fm = B.fazlaMesai(y, m, d.day, dimS);
      d.assigned.filter(silinmis).forEach(p => {
        const x = r[p.id] || (r[p.id] = bosDetay());
        x.fm += fm; x.nobet++;
        if (dw === CUMARTESI) x.cmt++; else if (dw === PAZAR) x.paz++; else if (dw === CUMA) x.cu++; else x.hi++;
        if (dw === PERSEMBE) x.thu++;
        x.gunler.push({ gun: d.day, dw, tip: "N" });
      });
      (d.prep || []).filter(silinmis).forEach(p => {
        const x = r[p.id] || (r[p.id] = bosDetay());
        x.fm += hz; x.prep++; x.gunler.push({ gun: d.day, dw, tip: "H" });
      });
    });
  }
  return r;
}

function yilVerisi(B: Baglam, yil: number) {
  const aylar: ({ m: number; sch: unknown; det: Record<number, AyDetay> } | null)[] = [];
  for (let m = 0; m < 12; m++) {
    const sch = B.cizelge(yil, m);
    const veri = (sch && ayVeriVarMi(sch)) || Object.keys(B.puantaj[ayAnahtari(yil, m)] || {}).length > 0 || Object.keys(B.acil[ayAnahtari(yil, m)] || {}).length > 0;
    aylar.push(veri ? { m, sch: sch || null, det: ayDetayi(B, yil, m) } : null);
  }
  const kisiler: { id: number; name: string; role: string; aktif: boolean; ayrildi?: boolean }[] = [], goruldu: Record<number, true> = {};
  B.staff.forEach(s => { kisiler.push({ id: s.id, name: s.name, role: s.role, aktif: true, ayrildi: !!s.bitis && ayrildiMi(s) }); goruldu[s.id] = true; });
  aylar.forEach(a => {
    if (!a || !a.sch) return;
    (a.sch as { days: { assigned: { id: number; name: string; role: string }[]; prep?: { id: number; name: string; role: string }[] }[] }).days
      .forEach(d => d.assigned.concat(d.prep || []).forEach(p => { if (!goruldu[p.id]) { goruldu[p.id] = true; kisiler.push({ id: p.id, name: p.name, role: p.role, aktif: false }); } }));
  });
  kisiler.sort((a, b) => ROL_SIRA[a.role] - ROL_SIRA[b.role] || a.id - b.id);
  return { yil, aylar, kisiler, kayitli: aylar.filter(Boolean).length };
}
type YilVerisi = ReturnType<typeof yilVerisi>;

function kisiYillik(V: YilVerisi, id: number) {
  const t = { fm: 0, nobet: 0, hi: 0, cu: 0, cmt: 0, paz: 0, thu: 0, prep: 0, ni: 0, yi: 0, rd: 0, rt: 0 };
  V.aylar.forEach(a => {
    if (!a) return; const d = a.det[id]; if (!d) return;
    (Object.keys(t) as (keyof typeof t)[]).forEach(k => { t[k] += d[k] || 0; });
  });
  return t;
}

type DengeAnahtari = "nobet" | "pe" | "cu" | "cmt" | "paz" | "prep" | "rt" | "fm";
/** yıllık denge sütunları */
export const DENGE_KOL: { k: DengeAnahtari; t: string; saat?: boolean }[] = [
  { k: "nobet", t: "Nöbet sayısı" }, { k: "pe", t: "Perşembe" }, { k: "cu", t: "Cuma" }, { k: "cmt", t: "Cumartesi" }, { k: "paz", t: "Pazar" },
  { k: "prep", t: "Hazırlama" }, { k: "rt", t: "Resmi tatil" }, { k: "fm", t: "Fazla mesai", saat: true },
];
type DengeSayilari = Record<DengeAnahtari, number> & { aylar?: number[] };

/** Yıllık denge onaylanan çizelgeden hesaplanır (adalet referansı): puantajdaki gönüllü nöbet değişimleri sayılmaz;
 *  izin/rapor nedeniyle yerine geçmeler çizelgeye işlendiği için sayılır. Fazla mesai = nöbet + hazırlama saatleri. */
function cizelgeYillik(B: Baglam, yil: number) {
  const t: Record<string, DengeSayilari> = {}, aylar: number[] = [], hz = B.sayi("hazSaat");
  const bos = (): DengeSayilari => ({ nobet: 0, cu: 0, cmt: 0, paz: 0, pe: 0, rt: 0, prep: 0, fm: 0 });
  for (let mm = 0; mm < 12; mm++) {
    const sc = B.cizelge(yil, mm); if (!sc || !Array.isArray(sc.days) || !ayVeriVarMi(sc)) continue;
    aylar.push(mm);
    const dim = ayGunSayisi(yil, mm), kisiAy: Record<string, true> = {};
    sc.days.forEach(d => {
      const dw = haftaGunu(yil, mm, d.day), tt = B.tatilMi(yil, mm, d.day), rt = B.resmiTatilMi(yil, mm, d.day), fm = B.fazlaMesai(yil, mm, d.day, dim);
      (d.assigned || []).forEach(p => {
        const x = t[p.id] || (t[p.id] = bos());
        x.nobet++; x.fm += fm;
        if (dw === CUMA && !tt) x.cu++; if (dw === CUMARTESI) x.cmt++; if (dw === PAZAR) x.paz++; if (dw === PERSEMBE) x.pe++; if (rt) x.rt++;
        kisiAy[p.id] = true;
      });
      // nöbet sayısı = nöbetler + hazırlama (raporlarda ortak tanım)
      (d.prep || []).forEach(p => { const x = t[p.id] || (t[p.id] = bos()); x.prep++; x.nobet++; x.fm += hz; kisiAy[p.id] = true; });
    });
    Object.keys(kisiAy).forEach(id => { (t[id].aylar = t[id].aylar || []).push(mm); });
  }
  return { t, aylar, bos };
}

/** her nöbetçinin yıl toplamları ve çalıştığı ay sayısına göre beklenen paydan farkı */
function dengeVerisi(B: Baglam, V: YilVerisi) {
  const CZ = cizelgeYillik(B, V.yil);
  const kayitliAy = CZ.aylar;
  const kisiler = V.kisiler.filter(k => nobetciRol(k.role)).map(k => {
    const st = B.kisi(k.id), t = CZ.t[k.id] || CZ.bos();
    const ay = kayitliAy.filter(i => (st ? aktifAydaMi(st, V.yil, i) : (t.aylar || []).indexOf(i) >= 0)).length;
    return { k, t, ay } as { k: typeof k; t: DengeSayilari; ay: number; fark: Record<string, number>; bek: Record<string, number>; kismi: boolean };
  }).filter(x => x.ay > 0);
  const ayTop = kisiler.reduce((a, x) => a + x.ay, 0);
  const ort: Record<string, number> = {};
  DENGE_KOL.forEach(c => { ort[c.k] = ayTop ? kisiler.reduce((a, x) => a + x.t[c.k], 0) / ayTop : 0; });   // ay başına ortalama
  const tamAy = kayitliAy.length;
  kisiler.forEach(x => { x.fark = {}; x.bek = {}; DENGE_KOL.forEach(c => { x.bek[c.k] = ort[c.k] * x.ay; x.fark[c.k] = x.t[c.k] - x.bek[c.k]; }); x.kismi = x.ay < tamAy; });
  // yalnız tüm yıl (kayıtlı ayların hepsinde) çalışanlar arasında en çok − en az
  const tam = kisiler.filter(x => !x.kismi), aralik: Record<string, { min: number; max: number } | null> = {};
  DENGE_KOL.forEach(c => { const v = tam.map(x => x.t[c.k]); aralik[c.k] = v.length ? { min: Math.min(...v), max: Math.max(...v) } : null; });
  return { kisiler, ort, tamAy, aralik, hedef: B.sayi("fmHedef") };
}

/** Yılın raporu: ay ay kişi başı puantaj özeti ve yıllık denge (çizelgeye göre) */
export function yillikRapor(B: Baglam, yil: number) {
  const V = yilVerisi(B, yil);
  const D = V.kayitli ? dengeVerisi(B, V) : null;
  const toplam: Record<number, ReturnType<typeof kisiYillik>> = {};
  V.kisiler.forEach(k => { toplam[k.id] = kisiYillik(V, k.id); });
  return { V, D, toplam, kolonlar: DENGE_KOL, ayKisa: AY_KISA };
}

// ---- uyarının önemi ve kısa başlığı: hata (kural gevşetildi / eksik), uyarı (sınır aşıldı), bilgi (açıklama) ----
const UYARI_BASLIK: [RegExp, string][] = [
  [/matematiksel olarak mümkün değil/i, "Personel kurallara yetmiyor"], [/hazırlamanın ertesi günü nöbet/i, "Hazırlama ertesi nöbet"],
  [/^Yıllık gün dağılımı/, "Yıllık gün dağılımı"], [/^Hazırlama farkı/, "Hazırlama farkı"], [/^Nöbet sayısı farkı/, "Nöbet sayısı farkı"], [/^Hafta sonu kuralı/, "Hafta sonu kuralı"],
  [/^KESİN KURAL sağlanamadı: fazla mesai/, "Fazla mesai farkı"], [/KESİN KURAL/i, "Kesin kural"], [/dinlenme kuralı/i, "Zorunlu atama yapılan günler"], [/kural dışı atama/i, "Kural dışı atama"],
  [/hazırlama (personeli bulunamadı|yeri eksik)/i, "Eksik hazırlama"], [/3 ya da daha fazla Cumartesi/i, "3 ya da daha fazla hafta sonu nöbeti"], [/Hafta sonu .*aşan/i, "Hafta sonu sınırı aşıldı"],
  [/eş durumu/i, "Eş durumu"], [/Perşembe/i, "Perşembe nöbeti sınırı"], [/destek personeli ayda/i, "Destek personeli yetmiyor"], [/Eczacı sayısı/i, "Eczacı sayısı az"],
  [/En az 2 eczacı/i, "Eczacı yetersiz"], [/personel sayısı/i, "Personel yetersiz"], [/sonraki ay/i, "Ay geçişi"],
];
export function uyariSiniflandir(w: string): { seviye: "hata" | "uyari" | "bilgi"; baslik: string } {
  const t = String(w);
  const seviye = /(dolduruldu|normaldir)\.?$/.test(t) ? "bilgi"
    : /(korunamadı|bulunamadı|karşılanamadı|yetersiz\.|gerekiyor|eczacı yok|eksik kişi|eksik tatil|yeri eksik|sağlanamadı|mümkün değil)/i.test(t) ? "hata" : "uyari";
  const b = UYARI_BASLIK.find(x => x[0].test(t));
  return { seviye, baslik: b ? b[1] : (seviye === "bilgi" ? "Bilgi" : "Uyarı") };
}
