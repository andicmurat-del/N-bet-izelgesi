// Acil eczane nöbet değişimi (yerine tutma): acil nöbetini başka bir acil kadrosu kişisine vermek hangi kuralları bozar
// (engel / uyarı) ve kim yerine tutabilir. Kurallar gerçekleşen puantaja göre (eczane nöbeti, hazırlama ve öteki
// değişimler dahil) denetlenir; değişim yalnız puantaja yansır, acil listesi ve yıllık eşitlik listeye göre kalır.
import { aktifGunMu, type Baglam } from "./baglam";
import { acilKadrosunda } from "./acil";
import { puantajIzgarasi, type PuantajIzgarasi } from "./puantaj";
import { CUMARTESI, gunKaydir, haftaGunu, PAZAR } from "./takvim";
import type { DegisimSonucu } from "./degisim";

const GOREV = new Set(["N", "H"]);
const IZIN_AD: Record<string, string> = { YI: "yıllık izinli", R: "raporlu", NI: "nöbet izinli", DI: "izinli", P: "çalışma dönemi dışında" };

function izgaralar(B: Baglam) {
  const c = new Map<string, PuantajIzgarasi>();
  const al = (y: number, m: number) => { const k = y + "-" + m; let G = c.get(k); if (!G) { G = puantajIzgarasi(B, y, m); c.set(k, G); } return G; };
  /** kişinin o günkü gerçek kodu ("" kadroda değilse) */
  const kod = (id: number, y: number, m: number, d: number) => al(y, m).satirlar.find(r => r.s.id === id)?.cells[d - 1]?.kod ?? "";
  return { al, kod };
}

/** cik kişisinin d. gündeki acil nöbetini yer kişisi tutarsa: engel (kural dışı) ve uyarılar */
export function acilDegisimDenetle(B: Baglam, y: number, m: number, d: number, cik: number, yer: number, I = izgaralar(B)): DegisimSonucu {
  const out: DegisimSonucu = { engel: [], uyari: [], bilgi: [] };
  const s = B.kisi(yer);
  if (!s) { out.engel.push("Kişi bulunamadı."); return out; }
  if (cik === yer) { out.engel.push("Nöbetten çıkan ve yerine tutan aynı kişi."); return out; }
  if (!acilKadrosunda(s)) out.engel.push(s.name + " acil kadrosunda değil.");
  if (!aktifGunMu(s, y, m, d)) out.engel.push(s.name + " o gün çalışma dönemi dışında.");
  const k0 = I.kod(yer, y, m, d);
  if (k0 === "N") out.engel.push(s.name + " o gün zaten nöbetçi.");
  else if (k0 === "H") out.engel.push(s.name + " o gün hazırlamada.");
  else if (IZIN_AD[k0]) out.engel.push(s.name + " o gün " + IZIN_AD[k0] + ".");
  const t = B.tercih(yer, y, m, d);
  if (t === "izinli") out.engel.push(s.name + " o gün izinli işaretli.");
  else if (t === "esYok") out.engel.push(s.name + " için o gün eş durumu: nöbet yazılmasın.");
  else if (t === "avoid") out.uyari.push(s.name + " o gün nöbet istemiyor.");
  // komşu günler: art arda nöbet olmaz; ara ve 5 günde 3 nöbet mümkünse olmaz
  const komsu = (q: number) => { const [a, b, c] = gunKaydir(y, m, d, q); return I.kod(yer, a, b, c); };
  if (GOREV.has(komsu(-1)) || GOREV.has(komsu(1))) out.engel.push(s.name + " bir gün önce ya da sonra görevli (art arda olmaz).");
  const ara = Math.max(2, Math.min(6, B.sayi("acilMinAra") || 3));
  for (let q = 2; q < ara; q++) if (komsu(-q) === "N" || komsu(q) === "N") { out.uyari.push(`${s.name} için iki nöbet arası ${ara} günden az kalır.`); break; }
  const say = (a: number) => { let n = 1; for (let q = a; q <= a + 4; q++) if (q && komsu(q) === "N") n++; return n; };
  if ([-4, -3, -2, -1, 0].some(a => say(a) >= 3)) out.uyari.push(s.name + " 5 gün içinde 3 nöbet tutmuş olur.");
  if (B.izinOncesiMi(yer, y, m, d)) out.uyari.push(s.name + " ertesi gün izne çıkıyor (nöbet izni izne denk gelir).");
  const dw = haftaGunu(y, m, d);
  if (dw === CUMARTESI || dw === PAZAR) {
    const G = I.al(y, m), r = G.satirlar.find(x => x.s.id === yer);
    const n = r ? r.cells.filter((c, i) => c.kod === "N" && G.gunler[i].dw === dw).length : 0;
    if (n >= 1) out.uyari.push(`${s.name} bu ay zaten ${n} ${dw === CUMARTESI ? "Cumartesi" : "Pazar"} nöbeti tutuyor.`);
  }
  out.bilgi.push("Değişim yalnız puantaja yansır; acil nöbet listesi ve yıllık eşitlik listeye göre kalır.");
  return out;
}

/** cik kişisinin d. gündeki acil nöbetini tutabilecek acil kadrosu: kurallara uyanlar önce, sonra uyarısı az olan,
 *  sonra yıl içinde (gerçekleşen) en az acil nöbeti tutan */
export function acilYerineAdaylar(B: Baglam, y: number, m: number, d: number, cik: number) {
  const I = izgaralar(B), yil: Record<number, number> = {};
  for (let mm = 0; mm <= m; mm++) for (const r of I.al(y, mm).satirlar) yil[r.s.id] = (yil[r.s.id] || 0) + r.cells.filter(c => c.kod === "N" && c.acil).length;
  const out = B.staff.filter(s => s.id !== cik && acilKadrosunda(s) && aktifGunMu(s, y, m, d)).map(s => {
    const k = acilDegisimDenetle(B, y, m, d, cik, s.id, I);
    return { id: s.id, ad: s.name, rol: s.role, engel: k.engel.length, uyari: k.uyari.length, yil: yil[s.id] || 0, k };
  });
  out.sort((a, b) => Number(a.engel > 0) - Number(b.engel > 0) || a.uyari - b.uyari || a.yil - b.yil || a.ad.localeCompare(b.ad, "tr"));
  return out;
}
