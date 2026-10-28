// Acil servis nöbet çizelgesi: Excel (gün listesi + kişi özeti) ve PDF (A4 yatay takvim + kişi özeti). Resmi çıktı: adlar büyük harf.
import { autoTable } from "jspdf-autotable";
import { yeniPdf } from "./pdfOrtak";
import { xlsxKitap, type Hucre } from "./xlsx";
import { AYLAR, GUN_UZUN, buyukAd } from "../veri/tarih";

export interface AcilVerisi {
  y: number; m: number; kurum: string;
  gunler: { gun: number; dw: number; tatil: boolean; resmi: boolean; adlar: string[] }[];
  ozet: { ad: string; gunler: number[]; tatil: number }[];
}

const baslik = (v: AcilVerisi) => `${v.kurum ? buyukAd(v.kurum) + " · " : ""}${AYLAR[v.m]} ${v.y} acil servis nöbet çizelgesi`;
const iki = (n: number) => String(n).padStart(2, "0");

export function acilKitabi(v: AcilVerisi): Blob {
  const t = (h: Hucre, tatil: boolean): Hucre => (tatil && h !== null && typeof h !== "object" ? { v: h, s: "tatil" } : h);
  const liste: Hucre[][] = [
    [{ v: baslik(v), s: "kalin" }],
    [],
    ["Tarih", "Gün", "Gün türü", "1. nöbetçi", "2. nöbetçi"].map(x => ({ v: x, s: "baslik" as const })),
    ...v.gunler.map(g => [`${iki(g.gun)}.${iki(v.m + 1)}.${v.y}`, GUN_UZUN[g.dw], g.resmi ? "Resmi tatil" : g.tatil ? "Hafta sonu" : "Mesai", buyukAd(g.adlar[0] ?? ""), buyukAd(g.adlar[1] ?? "")].map(h => t(h, g.tatil))),
  ];
  const ozet: Hucre[][] = [
    [{ v: baslik(v) + " · kişi özeti", s: "kalin" }],
    [],
    ["Ad soyad", "Nöbet", "Hafta sonu / tatil", "Nöbet günleri"].map(x => ({ v: x, s: "baslik" as const })),
    ...v.ozet.map(o => [buyukAd(o.ad), o.gunler.length, o.tatil, o.gunler.join(", ")]),
  ];
  return xlsxKitap([
    { ad: "Acil servis", satirlar: liste, genislik: [13, 13, 13, 26, 26], dondur: { satir: 3, sutun: 0 } },
    { ad: "Kişi özeti", satirlar: ozet, genislik: [26, 9, 17, 50], dondur: { satir: 3, sutun: 0 } },
  ]);
}

export function acilPdf(v: AcilVerisi): Blob {
  const doc = yeniPdf();
  const W = 297, K = 10;
  doc.setProperties({ title: `${AYLAR[v.m]} ${v.y} acil servis`, creator: "Nöbet Çizelgesi" });
  doc.setFont("CizelgeSans", "bold"); doc.setFontSize(14); doc.setTextColor(19, 33, 44);
  doc.text(baslik(v), K, 14);
  // takvim: haftalar satır, günler sütun
  const ilk = v.gunler[0]?.dw ?? 0, hucreler: (AcilVerisi["gunler"][number] | null)[] = [...Array(ilk).fill(null), ...v.gunler];
  while (hucreler.length % 7) hucreler.push(null);
  const haftalar = Array.from({ length: hucreler.length / 7 }, (_, i) => hucreler.slice(i * 7, i * 7 + 7));
  autoTable(doc, {
    startY: 19, margin: { left: K, right: K },
    head: [GUN_UZUN],
    body: haftalar.map(h => h.map(g => (g ? `${g.gun}${g.resmi ? "  Resmi tatil" : ""}\n${g.adlar.map(buyukAd).join("\n") || " "}` : ""))),
    theme: "grid",
    styles: { font: "CizelgeSans", fontSize: 9, cellPadding: 2.2, valign: "top", textColor: [19, 33, 44], lineColor: [150, 160, 170], lineWidth: 0.15, minCellHeight: 24 },
    headStyles: { font: "CizelgeSans", fontStyle: "bold", fillColor: [214, 232, 238], halign: "center", minCellHeight: 0 },
    didParseCell: h => {
      if (h.section !== "body") return;
      const g = haftalar[h.row.index][h.column.index];
      if (g?.tatil) h.cell.styles.fillColor = [251, 240, 224];
      if (!g) h.cell.styles.fillColor = [244, 246, 248];
    },
  });
  const sonY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 150;
  if (v.ozet.length) {
    autoTable(doc, {
      startY: sonY + 8, margin: { left: K, right: K },
      head: [["Ad soyad", "Nöbet", "Hafta sonu / tatil", "Nöbet günleri"]],
      body: v.ozet.map(o => [buyukAd(o.ad), String(o.gunler.length), String(o.tatil), o.gunler.join(", ")]),
      theme: "grid",
      styles: { font: "CizelgeSans", fontSize: 9, cellPadding: 1.8, textColor: [19, 33, 44], lineColor: [150, 160, 170], lineWidth: 0.15 },
      headStyles: { font: "CizelgeSans", fontStyle: "bold", fillColor: [214, 232, 238] },
      columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 20, halign: "center" }, 2: { cellWidth: 34, halign: "center" } },
    });
  }
  doc.setFontSize(8); doc.setTextColor(88, 105, 120);
  doc.text("Gölgeli günler: hafta sonu ve resmi tatil. Acil servis nöbeti puantajda 24 saat sayılır; ertesi gün mesai günüyse nöbet izni.", K, 200);
  doc.setTextColor(19, 33, 44);
  doc.text("Düzenleyen: ________________________          Onaylayan: ________________________", W - K, 205, { align: "right" });
  return doc.output("blob");
}
