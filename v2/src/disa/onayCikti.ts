// Onay listesi masaları: haftalık PDF (A4 yatay; satırlarda haftanın günleri, sütunlarda masalar ve jokerler).
// Resmi çıktı: adlar büyük harf; jokerin / teknikerin kimin yerine oturduğu hücrede ikinci satırda.
import { autoTable } from "jspdf-autotable";
import { yeniPdf } from "./pdfOrtak";
import { buyukAd } from "../veri/tarih";

export interface OnayCiktiVerisi {
  kurum: string;
  /** başlıktaki dönem (ör. "9–13 Kasım 2026") */
  donem: string;
  /** sütun başlıkları (ör. "Pazartesi 9 Kasım"); tatil: o gün liste yok */
  gunler: { baslik: string; tatil: boolean }[];
  /** yerler (tabloda sütun): yer adı ve gün gün hücre (ad, açıklama) */
  satirlar: { yer: string; hucre: { ad: string; not?: string; bos?: boolean }[] }[];
  notlar: string[];
}

export function onayPdf(v: OnayCiktiVerisi): Blob {
  const doc = yeniPdf("landscape");
  const W = 297, K = 12;
  doc.setProperties({ title: `${v.donem} onay listesi masaları`, creator: "Nöbet Çizelgesi" });
  doc.setFont("CizelgeSans", "bold"); doc.setFontSize(14); doc.setTextColor(19, 33, 44);
  doc.text(`${v.kurum ? buyukAd(v.kurum) + " · " : ""}${v.donem} onay listesi masaları`, K, 16);
  autoTable(doc, {
    startY: 22, margin: { left: K, right: K, bottom: 24 },
    head: [["Gün", ...v.satirlar.map(r => r.yer)]],
    body: v.gunler.map((g, gi) => [g.baslik, ...v.satirlar.map(r => { const h = r.hucre[gi]; return g.tatil ? "" : h.bos ? "BOŞ" : h.ad ? buyukAd(h.ad) + (h.not ? "\n" + h.not : "") : "–"; })]),
    theme: "grid",
    styles: { font: "CizelgeSans", fontSize: 8.5, cellPadding: 2, halign: "center", valign: "middle", textColor: [21, 38, 43], lineColor: [150, 160, 170], lineWidth: 0.2 },
    headStyles: { font: "CizelgeSans", fontStyle: "bold", fillColor: [208, 230, 235] },
    columnStyles: { 0: { cellWidth: 30, fontStyle: "bold", halign: "left" } },
    didParseCell: h => {
      if (h.section !== "body") return;
      const g = v.gunler[h.row.index];
      if (g.tatil) { h.cell.styles.fillColor = [238, 241, 243]; h.cell.styles.textColor = [110, 120, 130]; if (h.column.index === 1) h.cell.text = ["Resmi tatil"]; return; }
      if (h.column.index === 0) return;
      const c = v.satirlar[h.column.index - 1].hucre[h.row.index];
      if (c?.bos) { h.cell.styles.fillColor = [253, 226, 226]; h.cell.styles.textColor = [160, 30, 30]; h.cell.styles.fontStyle = "bold"; }
      else if (c?.not?.includes("yerine")) h.cell.styles.fillColor = [255, 246, 222];
    },
  });
  const H = doc.internal.pageSize.getHeight();
  doc.setFont("CizelgeSans", "normal"); doc.setFontSize(8); doc.setTextColor(88, 105, 120);
  v.notlar.forEach((t, i) => doc.text(t, K, H - 18 + i * 4));
  doc.setTextColor(19, 33, 44);
  doc.text("Düzenleyen: __________________          Onaylayan: __________________", W - K, H - 8, { align: "right" });
  return doc.output("blob");
}
