// PDF çıktılarında ortak: A4 sayfa (varsayılan yatay) ve gömülü Türkçe yazı tipi (yazitipi/OKUBENI.md)
import { jsPDF } from "jspdf";
import normal from "./yazitipi/CizelgeSans-Regular.ttf?inline";
import kalin from "./yazitipi/CizelgeSans-SemiBold.ttf?inline";

const base64 = (dataUrl: string) => dataUrl.slice(dataUrl.indexOf(",") + 1);

/** boyut: A4 yerine mm cinsinden [en, boy] sayfa (ör. yalnız bir tablonun sığdığı sayfa) */
export function yeniPdf(yon: "landscape" | "portrait" = "landscape", boyut?: [number, number]): jsPDF {
  const doc = new jsPDF({ orientation: yon, unit: "mm", format: boyut ?? "a4" });
  doc.addFileToVFS("CizelgeSans-Regular.ttf", base64(normal));
  doc.addFont("CizelgeSans-Regular.ttf", "CizelgeSans", "normal");
  doc.addFileToVFS("CizelgeSans-SemiBold.ttf", base64(kalin));
  doc.addFont("CizelgeSans-SemiBold.ttf", "CizelgeSans", "bold");
  doc.setFont("CizelgeSans", "normal");
  return doc;
}

// ---- Haftalık form takvimi (ekrandaki takvimle aynı tema): koyu gün başlığı, her hafta ayrı blok ve solda hafta
// numarası, her günde tarih başlığı ve görev etiketli satırlar. Günlük ve acil nöbet PDF'leri bunu kullanır.
type Rgb = readonly [number, number, number];
export const PDF_RENK = {
  yazi: [21, 38, 43], soluk: [70, 89, 95], cizgi: [196, 211, 216], cizgiAcik: [224, 233, 236], petrol: [14, 74, 88], serit: [8, 51, 63],
  etiket: [239, 245, 246], hsBas: [193, 230, 235], hsZemin: [240, 247, 248], bos: [246, 249, 250], haz: [122, 67, 0], destek: [94, 107, 117], acikYazi: [191, 227, 232],
} as const satisfies Record<string, Rgb>;
export interface PdfSatir { et: string; ad: string; tur: "ecz" | "tek" | "des" | "haz" }
export interface PdfGun { gun: number; dw: number; tatil: boolean; etiket?: string; satirlar: PdfSatir[] }
const GUNLER = ["PAZARTESİ", "SALI", "ÇARŞAMBA", "PERŞEMBE", "CUMA", "CUMARTESİ", "PAZAR"], KISA = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

/** (x, y) köşesinden w × h alana takvimi çizer; blok yüksekliği hafta sayısına göre ayarlanır. */
export function haftalikTakvimCiz(doc: jsPDF, o: { x: number; y: number; w: number; h: number; yil: number; ay: number; gunler: PdfGun[] }) {
  const R = PDF_RENK, HN = 13, BAS = 7, ARA = 1.8, UST = 4.8, ET = 8, r = 1.6;
  const dolgu = (c: Rgb) => doc.setFillColor(c[0], c[1], c[2]), renk = (c: Rgb) => doc.setTextColor(c[0], c[1], c[2]), ciz = (c: Rgb) => doc.setDrawColor(c[0], c[1], c[2]);
  const iki = (n: number) => String(n).padStart(2, "0");
  const hucreler: (PdfGun | null)[] = [...Array(o.gunler[0]?.dw ?? 0).fill(null), ...o.gunler];
  while (hucreler.length % 7) hucreler.push(null);
  const hafta = hucreler.length / 7, cw = (o.w - HN) / 7, bh = (o.h - BAS - ARA * hafta) / hafta;
  // gün başlığı
  dolgu(R.serit); doc.roundedRect(o.x, o.y, o.w, BAS, r, r, "F");
  doc.setFont("CizelgeSans", "bold"); doc.setFontSize(7.5);
  GUNLER.forEach((g, i) => { renk(i >= 5 ? R.acikYazi : [255, 255, 255]); doc.text(g, o.x + HN + i * cw + cw / 2, o.y + 4.7, { align: "center", charSpace: 0.25 }); });
  for (let w = 0; w < hafta; w++) {
    const by = o.y + BAS + ARA + w * (bh + ARA);
    // blok: petrol zemin (sol sütun görünür), üstüne gün hücreleri
    dolgu(R.petrol); doc.roundedRect(o.x, by, o.w, bh, r, r, "F");
    dolgu([255, 255, 255]); doc.rect(o.x + HN, by, o.w - HN, bh, "F");
    renk([255, 255, 255]); doc.setFont("CizelgeSans", "bold"); doc.setFontSize(15); doc.text(String(w + 1), o.x + HN / 2, by + bh / 2 + 0.5, { align: "center" });
    doc.setFontSize(5.5); renk(R.acikYazi); doc.text("HAFTA", o.x + HN / 2, by + bh / 2 + 4, { align: "center", charSpace: 0.2 });
    for (let i = 0; i < 7; i++) {
      const g = hucreler[w * 7 + i], x = o.x + HN + i * cw;
      if (!g) { dolgu(R.bos); doc.rect(x, by, cw, bh, "F"); continue; }
      if (g.tatil) { dolgu(R.hsZemin); doc.rect(x, by, cw, bh, "F"); }
      dolgu(g.tatil ? R.hsBas : R.etiket); doc.rect(x, by, cw, UST, "F");
      doc.setFont("CizelgeSans", "bold"); doc.setFontSize(7.5); renk(R.petrol);
      doc.text(`${iki(g.gun)}.${iki(o.ay + 1)}.${o.yil}`, x + 1.6, by + 3.4);
      doc.setFont("CizelgeSans", g.etiket ? "bold" : "normal"); doc.setFontSize(7); doc.text(g.etiket || KISA[g.dw], x + cw - 1.6, by + 3.4, { align: "right" });
      const n = Math.max(2, g.satirlar.length), sh = (bh - UST) / n;
      g.satirlar.forEach((s, k) => {
        const sy = by + UST + k * sh;
        dolgu(R.etiket); doc.rect(x, sy, ET, sh, "F");
        doc.setFont("CizelgeSans", "bold"); doc.setFontSize(5.5); renk(R.soluk); doc.text(s.et, x + ET / 2, sy + sh / 2 + 0.7, { align: "center" });
        doc.setFont("CizelgeSans", s.tur === "ecz" ? "bold" : "normal"); renk(s.tur === "ecz" ? R.petrol : s.tur === "haz" ? R.haz : s.tur === "des" ? R.destek : R.yazi);
        let b = 8; doc.setFontSize(b);
        while (doc.getTextWidth(s.ad) > cw - ET - 2.4 && b > 5.5) { b -= 0.25; doc.setFontSize(b); }
        doc.text(s.ad, x + ET + 1.4, sy + sh / 2 + 0.9);
        if (k) { ciz(R.cizgiAcik); doc.setLineWidth(0.12); doc.line(x, sy, x + cw, sy); }
      });
      ciz(R.cizgiAcik); doc.setLineWidth(0.12); doc.line(x + ET, by + UST, x + ET, by + UST + sh * g.satirlar.length);
      ciz(R.cizgi); doc.setLineWidth(0.15); doc.line(x, by + UST, x + cw, by + UST);
    }
    ciz(R.cizgi); doc.setLineWidth(0.15);
    for (let i = 1; i < 7; i++) doc.line(o.x + HN + i * cw, by, o.x + HN + i * cw, by + bh);
    doc.roundedRect(o.x, by, o.w, bh, r, r, "S");
  }
}
/** tablolarda (jspdf-autotable) takvimle aynı koyu başlık */
export const PDF_TABLO_BAS = { font: "CizelgeSans", fontStyle: "bold" as const, fillColor: [8, 51, 63] as [number, number, number], textColor: [255, 255, 255] as [number, number, number] };

// ---- Ekrandaki tablo görünümü (onay listesi, öğlen nöbeti): koyu başlık şeridi (iki satırlı olabilir), açık renkli
// satır başı sütunu, ince çizgiler, yuvarlak dış köşe. Hücre: yazı, alt yazı, zemin, yazı rengi, kalınlık, hiza, rozet.
export interface EkranHucre { t: string; alt?: string; zemin?: Rgb; renk?: Rgb; kalin?: boolean; hiza?: "left" | "center"; rozet?: string; soluk?: boolean }
export interface EkranSutun { w: number; bas: string; basAlt?: string; basZemin?: Rgb; basHiza?: "left" | "center"; ayrac?: boolean; ust?: boolean }
export function ekranTablosuCiz(doc: jsPDF, o: { x: number; y: number; basH: number; satirH: number; sutunlar: EkranSutun[]; satirlar: EkranHucre[][]; buyuk?: boolean }) {
  const R = { serit: [8, 51, 63] as Rgb, cizgi: [211, 223, 226] as Rgb, petrol: [14, 74, 88] as Rgb, yazi: [21, 38, 43] as Rgb, acik: [191, 227, 232] as Rgb };
  const dolgu = (c: Rgb) => doc.setFillColor(c[0], c[1], c[2]), renk = (c: Rgb) => doc.setTextColor(c[0], c[1], c[2]), ciz = (c: Rgb) => doc.setDrawColor(c[0], c[1], c[2]);
  const W = o.sutunlar.reduce((a, s) => a + s.w, 0), H = o.basH + o.satirlar.length * o.satirH, r = 2;
  const fs = o.buyuk ? 11 : 10;
  // gövde zemini ve başlık (üst köşeler yuvarlak)
  dolgu([255, 255, 255]); doc.roundedRect(o.x, o.y, W, H, r, r, "F");
  let x = o.x;
  o.sutunlar.forEach((s, i) => {
    dolgu(s.basZemin ?? R.serit);
    if (i === 0) { doc.roundedRect(x, o.y, s.w, o.basH, r, r, "F"); doc.rect(x + r, o.y, s.w - r, o.basH, "F"); doc.rect(x, o.y + r, s.w, o.basH - r, "F"); }
    else if (i === o.sutunlar.length - 1) { doc.roundedRect(x, o.y, s.w, o.basH, r, r, "F"); doc.rect(x, o.y, s.w - r, o.basH, "F"); doc.rect(x, o.y + r, s.w, o.basH - r, "F"); }
    else doc.rect(x, o.y, s.w, o.basH, "F");
    const hiza = s.basHiza ?? "center", tx = hiza === "center" ? x + s.w / 2 : x + 3;
    doc.setFont("CizelgeSans", "bold");
    if (s.basAlt) {
      doc.setFontSize(9.5); renk([255, 255, 255]); doc.text(s.bas, tx, o.y + o.basH / 2 - 0.6, { align: hiza });
      doc.setFont("CizelgeSans", "normal"); doc.setFontSize(8); renk(R.acik); doc.text(s.basAlt, tx, o.y + o.basH / 2 + 3.6, { align: hiza });
    } else { doc.setFontSize(7.5); renk([255, 255, 255]); doc.text(s.bas.toLocaleUpperCase("tr-TR"), tx, o.y + o.basH / 2 + 1.1, { align: hiza, charSpace: 0.35 }); }
    if (s.ust) { doc.setFillColor(108, 196, 207); doc.rect(x, o.y + o.basH - 0.8, s.w, 0.8, "F"); }
    x += s.w;
  });
  // hücreler
  o.satirlar.forEach((satir, ri) => {
    const y = o.y + o.basH + ri * o.satirH; let cx = o.x;
    satir.forEach((h, ci) => {
      const s = o.sutunlar[ci];
      if (h.zemin) { dolgu(h.zemin); const son = ri === o.satirlar.length - 1; if (son && (ci === 0 || ci === satir.length - 1)) { doc.roundedRect(cx, y, s.w, o.satirH, r, r, "F"); doc.rect(ci === 0 ? cx + r : cx, y, s.w - r, o.satirH, "F"); doc.rect(cx, y, s.w, o.satirH - r, "F"); } else doc.rect(cx, y, s.w, o.satirH, "F"); }
      const hiza = h.hiza ?? "center", tx = hiza === "center" ? cx + s.w / 2 : cx + 3.2;
      if (h.t) {
        doc.setFont("CizelgeSans", h.kalin ? "bold" : "normal"); renk(h.renk ?? R.yazi);
        let b = h.alt ? 9.5 : (ci === 0 ? 8.5 : fs); doc.setFontSize(b);
        const yer = s.w - 6.4 - (h.rozet ? 4 : 0);
        while (doc.getTextWidth(h.t) > yer && b > 6) { b -= 0.25; doc.setFontSize(b); }
        const ty = h.alt ? y + o.satirH / 2 - 0.6 : y + o.satirH / 2 + 1.3;
        doc.text(h.t, tx, ty, { align: hiza });
        if (h.rozet) {
          const w = doc.getTextWidth(h.t), rx = (hiza === "center" ? tx + w / 2 : tx + w) + 1.6;
          doc.setFont("CizelgeSans", "bold"); doc.setFontSize(6.5); doc.setTextColor(179, 38, 30); doc.text(h.rozet, rx, ty - 0.2);
        }
        if (h.alt) { doc.setFont("CizelgeSans", "normal"); doc.setFontSize(7.5); doc.setTextColor(70, 89, 95); doc.text(h.alt, tx, y + o.satirH / 2 + 3.4, { align: hiza }); }
      }
      cx += s.w;
    });
  });
  // çizgiler
  ciz(R.cizgi); doc.setLineWidth(0.2);
  for (let ri = 1; ri < o.satirlar.length; ri++) { const y = o.y + o.basH + ri * o.satirH; doc.line(o.x, y, o.x + W, y); }
  x = o.x;
  o.sutunlar.forEach((s, i) => {
    if (i) { if (s.ayrac) { doc.setDrawColor(120, 150, 158); doc.setLineWidth(0.5); } else { ciz(R.cizgi); doc.setLineWidth(0.2); } doc.line(x, o.y + o.basH, x, o.y + H); if (s.ayrac) { doc.setDrawColor(108, 196, 207); doc.setLineWidth(0.4); doc.line(x, o.y, x, o.y + o.basH); } }
    x += s.w;
  });
  ciz(R.cizgi); doc.setLineWidth(0.25); doc.roundedRect(o.x, o.y, W, H, r, r, "S");
  return { w: W, h: H };
}
