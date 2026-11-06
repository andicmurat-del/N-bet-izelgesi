// Öğlen nöbeti çizelgesi: PDF (A4 dikey; gün listesi, her kişi ayrı sütunda; haftalık çıktıda tek hafta, kişi başı sayılar isteğe bağlı). Resmi çıktı: adlar büyük harf.
import { autoTable } from "jspdf-autotable";
import { yeniPdf } from "./pdfOrtak";
import { AYLAR, GUN_UZUN, buyukAd } from "../veri/tarih";

export interface OglenVerisi {
  y: number; m: number; kurum: string;
  /** başlıktaki dönem (ör. "2–6 Kasım 2026"; haftalık çıktı); yoksa ay ve yıl */
  donem?: string;
  haftalar: { gun: number; dw: number; e: string[]; t: string[] }[][];
  ozet: { ad: string; rol: string; ay: number; ayCuma: number | null; yil: number; yilCuma: number | null }[];
}

/** Haftalık öğlen nöbeti: yalnız tablo (başlık satırı yok), adlar ortalı; sayfa tablonun boyunda (A4 değil). */
function haftalikPdf(v: OglenVerisi): Blob {
  const satirlar = v.haftalar.flat();
  const EN = 200, K = 4;
  const ciz = (doc: ReturnType<typeof yeniPdf>) => {
    doc.setProperties({ title: `${v.donem} öğlen nöbeti`, creator: "Nöbet Çizelgesi" });
    autoTable(doc, {
      startY: K, margin: { left: K, right: K, top: K, bottom: K },
      body: satirlar.map(g => [`${g.gun} ${GUN_UZUN[g.dw]}`, ...[0, 1, 2].map(i => buyukAd(g.e[i] ?? "")), ...[0, 1].map(i => buyukAd(g.t[i] ?? ""))]),
      theme: "grid",
      styles: { font: "CizelgeSans", fontSize: 12, cellPadding: 4, halign: "center", valign: "middle", textColor: [21, 38, 43], lineColor: [150, 160, 170], lineWidth: 0.2 },
      columnStyles: { 0: { cellWidth: 34, fontStyle: "bold" }, 4: { lineWidth: { left: 0.6, right: 0.2, top: 0.2, bottom: 0.2 } } },
      didParseCell: h => { if (h.section === "body" && satirlar[h.row.index].dw === 4) h.cell.styles.fillColor = [244, 248, 249]; },
    });
    return (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 100;
  };
  // önce ölçülür, sonra tablonun boyunda sayfaya çizilir
  const boy = ciz(yeniPdf("portrait", [EN, 400])) + K;
  const doc = yeniPdf(EN > boy ? "landscape" : "portrait", [EN, boy]);
  ciz(doc);
  return doc.output("blob");
}

export function oglenPdf(v: OglenVerisi): Blob {
  if (v.donem) return haftalikPdf(v);
  const doc = yeniPdf("portrait");
  const W = 210, K = 12;
  const donem = v.donem ?? `${AYLAR[v.m]} ${v.y}`;
  const baslik = `${v.kurum ? buyukAd(v.kurum) + " · " : ""}${donem} öğlen nöbeti`;
  doc.setProperties({ title: `${donem} öğlen nöbeti`, creator: "Nöbet Çizelgesi" });
  doc.setFont("CizelgeSans", "bold"); doc.setFontSize(14); doc.setTextColor(19, 33, 44);
  doc.text(baslik, K, 16);
  const satirlar: { gun: number; dw: number; e: string[]; t: string[]; ilk: boolean }[] = [];
  v.haftalar.forEach(h => h.forEach((g, i) => satirlar.push({ ...g, ilk: i === 0 })));
  autoTable(doc, {
    startY: 21, margin: { left: K, right: K, bottom: 22 },
    head: [["Gün", "1. eczacı", "2. eczacı", "3. eczacı", "1. tekniker", "2. tekniker"]],
    body: satirlar.map(g => [`${g.gun} ${GUN_UZUN[g.dw]}`, ...[0, 1, 2].map(i => buyukAd(g.e[i] ?? "")), ...[0, 1].map(i => buyukAd(g.t[i] ?? ""))]),
    theme: "grid",
    styles: { font: "CizelgeSans", fontSize: 8.5, cellPadding: 1.8, textColor: [21, 38, 43], lineColor: [150, 160, 170], lineWidth: 0.15 },
    headStyles: { font: "CizelgeSans", fontStyle: "bold", fillColor: [208, 230, 235] },
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
      styles: { font: "CizelgeSans", fontSize: 8.5, cellPadding: 1.6, textColor: [21, 38, 43], lineColor: [150, 160, 170], lineWidth: 0.15, halign: "center" },
      headStyles: { font: "CizelgeSans", fontStyle: "bold", fillColor: [208, 230, 235] },
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
