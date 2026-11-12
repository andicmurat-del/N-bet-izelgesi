// Onay listesi masaları: haftalık PDF, öğlen nöbeti haftalık çıktısıyla aynı biçimde: yalnız tablo (satırlarda haftanın
// günleri, sütunlarda masalar ve jokerler; üstte yalnız masa adları), adlar ortalı ve büyük harf; sayfa tablonun
// boyunda (A4 değil). Teknikerin oturduğu hücre renkli; program dolduramadığı masa kırmızı "BOŞ"; elle boş bırakılan boş.
import { autoTable } from "jspdf-autotable";
import { yeniPdf } from "./pdfOrtak";
import { buyukAd } from "../veri/tarih";

export interface OnayCiktiVerisi {
  kurum: string;
  /** belge adı için dönem (ör. "9–13 Kasım 2026") */
  donem: string;
  /** satır başları (ör. "9 Pazartesi"); tatil: o gün liste yok */
  gunler: { baslik: string; tatil: boolean }[];
  /** yerler (tabloda sütun): yer adı ve gün gün hücre */
  satirlar: { yer: string; hucre: { ad: string; bos?: boolean; yerine?: boolean }[] }[];
  notlar: string[];
}

export function onayPdf(v: OnayCiktiVerisi): Blob {
  const K = 4, GUN = 34, SUT = 31, EN = GUN + v.satirlar.length * SUT + 2 * K;
  const ciz = (doc: ReturnType<typeof yeniPdf>) => {
    doc.setProperties({ title: `${v.donem} onay listesi masaları`, creator: "Nöbet Çizelgesi" });
    autoTable(doc, {
      startY: K, margin: { left: K, right: K, top: K, bottom: K },
      head: [["", ...v.satirlar.map(r => r.yer)]],
      body: v.gunler.map((g, gi) => [g.baslik, ...v.satirlar.map(r => { const h = r.hucre[gi]; return g.tatil ? "" : h?.bos ? "BOŞ" : buyukAd(h?.ad ?? ""); })]),
      theme: "grid",
      styles: { font: "CizelgeSans", fontSize: 12, cellPadding: 4, halign: "center", valign: "middle", textColor: [21, 38, 43], lineColor: [170, 190, 196], lineWidth: 0.2 },
      headStyles: { font: "CizelgeSans", fontStyle: "bold", fontSize: 10, cellPadding: 2.5, fillColor: [239, 245, 246], textColor: [14, 74, 88] },
      columnStyles: { 0: { cellWidth: GUN, fontStyle: "bold", fillColor: [239, 245, 246], textColor: [14, 74, 88] } },
      didParseCell: h => {
        if (h.section !== "body") return;
        const g = v.gunler[h.row.index];
        if (g.tatil) { if (h.column.index > 0) { h.cell.styles.fillColor = [244, 248, 249]; h.cell.styles.textColor = [110, 120, 130]; if (h.column.index === 1) h.cell.text = ["Resmi tatil"]; } return; }
        if (h.column.index === 0) return;
        const c = v.satirlar[h.column.index - 1].hucre[h.row.index];
        if (c?.bos) { h.cell.styles.fillColor = [253, 226, 226]; h.cell.styles.textColor = [160, 30, 30]; h.cell.styles.fontStyle = "bold"; }
        else if (c?.yerine) h.cell.styles.fillColor = [214, 239, 243];
      },
    });
    return (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 100;
  };
  // önce ölçülür, sonra tablonun boyunda sayfaya çizilir
  const boy = ciz(yeniPdf("landscape", [EN, 400])) + K;
  const doc = yeniPdf(EN > boy ? "landscape" : "portrait", [EN, boy]);
  ciz(doc);
  return doc.output("blob");
}
