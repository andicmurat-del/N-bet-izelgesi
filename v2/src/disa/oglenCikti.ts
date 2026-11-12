// Öğlen nöbeti çizelgesi: PDF (A4 dikey; gün listesi, her kişi ayrı sütunda; haftalık çıktıda tek hafta, kişi başı sayılar isteğe bağlı). Resmi çıktı: adlar büyük harf.
import { autoTable } from "jspdf-autotable";
import { yeniPdf, ekranTablosuCiz, type EkranHucre, type EkranSutun } from "./pdfOrtak";
import { AYLAR, GUN_UZUN, buyukAd } from "../veri/tarih";

export interface OglenVerisi {
  y: number; m: number; kurum: string;
  /** başlıktaki dönem (ör. "2–6 Kasım 2026"; haftalık çıktı); yoksa ay ve yıl */
  donem?: string;
  /** ay: günün ayı (hafta ay sınırını aşarsa); eN / tN: o yerdeki kişi o günün nöbetçisi */
  haftalar: { gun: number; dw: number; e: string[]; t: string[]; ay?: number; eN?: boolean[]; tN?: boolean[] }[][];
  ozet: { ad: string; rol: string; ay: number; ayCuma: number | null; yil: number; yilCuma: number | null }[];
}

/** Haftalık öğlen nöbeti, programdaki tabloyla aynı görünüm: sütunlarda günler (koyu başlıkta tarih ve gün adı, Cuma
 *  ayrı renkte), satırlarda 1.–3. eczacı ve 1.–2. tekniker; o günün nöbetçisinin yanında kırmızı "N". Sayfa tablonun
 *  boyunda (A4 değil). */
function haftalikPdf(v: OglenVerisi): Blob {
  const gunler = v.haftalar.flat(), cuma = (g: { dw: number }) => g.dw === 4;
  const kac = (k: "e" | "t") => Math.max(0, ...gunler.map(g => Math.max(g[k].length, k === "e" ? (cuma(g) ? 3 : 2) : (cuma(g) ? 2 : 1))));
  const satirTur = [...Array.from({ length: kac("e") }, (_, i) => ({ k: "e" as const, i })), ...Array.from({ length: kac("t") }, (_, i) => ({ k: "t" as const, i }))];
  const K = 5, ET = 30, SUT = 44, BAS = 14, SAT = 13;
  const sutunlar: EkranSutun[] = [{ w: ET, bas: "" }, ...gunler.map(g => ({ w: SUT, bas: `${g.gun} ${AYLAR[g.ay ?? v.m]}`, basAlt: GUN_UZUN[g.dw], basHiza: "left" as const, basZemin: cuma(g) ? [27, 107, 123] as const : undefined }))];
  const satirlar: EkranHucre[][] = satirTur.map(r => [
    { t: `${r.i + 1}. ${r.k === "e" ? "Eczacı" : "Tekniker"}`, kalin: true, renk: [14, 74, 88], hiza: "left", zemin: r.k === "e" ? [239, 245, 246] : [234, 246, 248] },
    ...gunler.map((g): EkranHucre => ({ t: g[r.k][r.i] ?? "", kalin: true, hiza: "left", zemin: cuma(g) ? [236, 244, 246] : undefined, rozet: (r.k === "e" ? g.eN : g.tN)?.[r.i] ? "N" : undefined })),
  ]);
  const W = sutunlar.reduce((a, c) => a + c.w, 0) + 2 * K, H = BAS + satirlar.length * SAT + 2 * K;
  const doc = yeniPdf(W > H ? "landscape" : "portrait", [W, H]);
  doc.setProperties({ title: `${v.donem} öğlen nöbeti`, creator: "Nöbet Çizelgesi" });
  ekranTablosuCiz(doc, { x: K, y: K, basH: BAS, satirH: SAT, sutunlar, satirlar });
  return doc.output("blob");
}

export function oglenPdf(v: OglenVerisi): Blob {
  if (v.donem) return haftalikPdf(v);
  const doc = yeniPdf("portrait");
  const W = 210, K = 12;
  const donem = v.donem ?? `${AYLAR[v.m]} ${v.y}`;
  const baslik = `${v.kurum ? buyukAd(v.kurum) + " · " : ""}${donem} öğlen nöbeti`;
  doc.setProperties({ title: `${donem} öğlen nöbeti`, creator: "Nöbet Çizelgesi" });
  doc.setFont("CizelgeSans", "bold"); doc.setFontSize(14); doc.setTextColor(14, 74, 88);
  doc.text(baslik, K, 16);
  const satirlar: { gun: number; dw: number; e: string[]; t: string[]; ilk: boolean }[] = [];
  v.haftalar.forEach(h => h.forEach((g, i) => satirlar.push({ ...g, ilk: i === 0 })));
  autoTable(doc, {
    startY: 21, margin: { left: K, right: K, bottom: 22 },
    head: [["Gün", "1. eczacı", "2. eczacı", "3. eczacı", "1. tekniker", "2. tekniker"]],
    body: satirlar.map(g => [`${g.gun} ${GUN_UZUN[g.dw]}`, ...[0, 1, 2].map(i => buyukAd(g.e[i] ?? "")), ...[0, 1].map(i => buyukAd(g.t[i] ?? ""))]),
    theme: "grid",
    styles: { font: "CizelgeSans", fontSize: 8.5, cellPadding: 1.8, textColor: [21, 38, 43], lineColor: [170, 190, 196], lineWidth: 0.15 },
    headStyles: { font: "CizelgeSans", fontStyle: "bold", fillColor: [8, 51, 63], textColor: [255, 255, 255] },
    columnStyles: { 0: { cellWidth: 26, fontStyle: "bold" }, 4: { lineWidth: { left: 0.6, right: 0.15, top: 0.15, bottom: 0.15 } } },
    didParseCell: h => {
      if (h.section !== "body") return;
      const g = satirlar[h.row.index];
      if (g.dw === 4) h.cell.styles.fillColor = [244, 248, 249];
      if (g.ilk && h.row.index > 0) { h.cell.styles.lineWidth = { top: 0.6, bottom: 0.15, left: 0.15, right: 0.15 }; }
    },
  });
  const sonY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 150;
  if (v.ozet.length) {
    autoTable(doc, {
      startY: sonY + 7, margin: { left: K, right: K, bottom: 22 },
      head: [["Ad soyad", "Bu ay", "Bu ay Cuma", `Yıl (${v.y})`, "Yıl Cuma"]],
      body: v.ozet.map(o => [`${buyukAd(o.ad)}  (${o.rol})`, String(o.ay), o.ayCuma === null ? "–" : String(o.ayCuma), String(o.yil), o.yilCuma === null ? "–" : String(o.yilCuma)]),
      theme: "grid",
      styles: { font: "CizelgeSans", fontSize: 8.5, cellPadding: 1.6, textColor: [21, 38, 43], lineColor: [170, 190, 196], lineWidth: 0.15, halign: "center" },
      headStyles: { font: "CizelgeSans", fontStyle: "bold", fillColor: [8, 51, 63], textColor: [255, 255, 255] },
      columnStyles: { 0: { halign: "left" } },
    });
  }
  const H = doc.internal.pageSize.getHeight();
  doc.setFontSize(8); doc.setTextColor(88, 105, 120);
  doc.text("Pazartesi–Perşembe 2 eczacı + 1 tekniker, Cuma 3 eczacı + 2 tekniker. Gölgeli satırlar: Cuma.", K, H - 14);
  doc.setTextColor(19, 33, 44);
  doc.text("Düzenleyen: __________________          Onaylayan: __________________", W - K, H - 8, { align: "right" });
  return doc.output("blob");
}
