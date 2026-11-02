// Öğlen nöbeti çizelgesi: PDF (A4 dikey; hafta hafta gün listesi + kişi başı sayılar). Resmi çıktı: adlar büyük harf.
import { autoTable } from "jspdf-autotable";
import { yeniPdf } from "./pdfOrtak";
import { AYLAR, GUN_UZUN, buyukAd } from "../veri/tarih";

export interface OglenVerisi {
  y: number; m: number; kurum: string;
  haftalar: { gun: number; dw: number; e: string[]; t: string[] }[][];
  ozet: { ad: string; rol: string; ay: number; ayCuma: number | null; yil: number; yilCuma: number | null }[];
}

export function oglenPdf(v: OglenVerisi): Blob {
  const doc = yeniPdf("portrait");
  const W = 210, K = 12;
  const baslik = `${v.kurum ? buyukAd(v.kurum) + " · " : ""}${AYLAR[v.m]} ${v.y} öğlen nöbeti`;
  doc.setProperties({ title: `${AYLAR[v.m]} ${v.y} öğlen nöbeti`, creator: "Nöbet Çizelgesi" });
  doc.setFont("CizelgeSans", "bold"); doc.setFontSize(14); doc.setTextColor(19, 33, 44);
  doc.text(baslik, K, 16);
  const satirlar: { gun: number; dw: number; e: string[]; t: string[]; ilk: boolean }[] = [];
  v.haftalar.forEach(h => h.forEach((g, i) => satirlar.push({ ...g, ilk: i === 0 })));
  autoTable(doc, {
    startY: 21, margin: { left: K, right: K, bottom: 22 },
    head: [["Gün", "Eczacılar", "Tekniker"]],
    body: satirlar.map(g => [`${g.gun} ${GUN_UZUN[g.dw]}`, g.e.map(buyukAd).join(", "), g.t.map(buyukAd).join(", ")]),
    theme: "grid",
    styles: { font: "CizelgeSans", fontSize: 9.5, cellPadding: 2, textColor: [19, 33, 44], lineColor: [150, 160, 170], lineWidth: 0.15 },
    headStyles: { font: "CizelgeSans", fontStyle: "bold", fillColor: [214, 232, 238] },
    columnStyles: { 0: { cellWidth: 32, fontStyle: "bold" }, 2: { cellWidth: 55 } },
    didParseCell: h => {
      if (h.section !== "body") return;
      const g = satirlar[h.row.index];
      if (g.dw === 4) h.cell.styles.fillColor = [244, 246, 248];
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
      styles: { font: "CizelgeSans", fontSize: 8.5, cellPadding: 1.6, textColor: [19, 33, 44], lineColor: [150, 160, 170], lineWidth: 0.15, halign: "center" },
      headStyles: { font: "CizelgeSans", fontStyle: "bold", fillColor: [214, 232, 238] },
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
