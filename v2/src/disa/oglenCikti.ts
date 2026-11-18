// Öğlen nöbeti haftalık PDF'i: gün listesi, her kişi ayrı sütunda; yalnız tablo, sayfa tablonun boyunda. Resmi çıktı: adlar büyük harf.
import { autoTable } from "jspdf-autotable";
import { yeniPdf, sonTabloY } from "./pdfOrtak";
import { GUN_UZUN, buyukAd } from "../veri/tarih";

export interface OglenVerisi {
  /** dönem (ör. "16–20 Kasım 2026"): PDF'in başlık bilgisi */
  donem: string;
  haftalar: { gun: number; dw: number; e: string[]; t: string[] }[][];
}

/** sütun sayısı: günlerdeki en çok eczacı / tekniker (Ayarlar'daki öğlen sayılarına göre değişir; en az 1) */
const sutunlar = (satirlar: { e: string[]; t: string[] }[]) => ({
  e: Math.max(1, ...satirlar.map(g => g.e.length)),
  t: Math.max(1, ...satirlar.map(g => g.t.length)),
});
const say = (n: number) => Array.from({ length: n }, (_, i) => i);

/** Haftalık öğlen nöbeti: yalnız tablo (başlık satırı yok), adlar ortalı; sayfa tablonun boyunda (A4 değil). */
function haftalikPdf(v: OglenVerisi): Blob {
  const satirlar = v.haftalar.flat(),
    S = sutunlar(satirlar);
  const EN = 200,
    K = 4;
  const ciz = (doc: ReturnType<typeof yeniPdf>) => {
    doc.setProperties({ title: `${v.donem} öğlen nöbeti`, creator: "Nöbet Çizelgesi" });
    autoTable(doc, {
      startY: K,
      margin: { left: K, right: K, top: K, bottom: K },
      body: satirlar.map(g => [
        `${g.gun} ${GUN_UZUN[g.dw]}`,
        ...say(S.e).map(i => buyukAd(g.e[i] ?? "")),
        ...say(S.t).map(i => buyukAd(g.t[i] ?? "")),
      ]),
      theme: "grid",
      styles: {
        font: "CizelgeSans",
        fontSize: 12,
        cellPadding: 4,
        halign: "center",
        valign: "middle",
        textColor: [21, 38, 43],
        lineColor: [150, 160, 170],
        lineWidth: 0.2,
      },
      columnStyles: { 0: { cellWidth: 34, fontStyle: "bold" }, [S.e + 1]: { lineWidth: { left: 0.6, right: 0.2, top: 0.2, bottom: 0.2 } } },
      didParseCell: h => {
        if (h.section === "body" && satirlar[h.row.index].dw === 4) h.cell.styles.fillColor = [244, 248, 249];
      },
    });
    return sonTabloY(doc, 100);
  };
  // önce ölçülür, sonra tablonun boyunda sayfaya çizilir
  const boy = ciz(yeniPdf("portrait", [EN, 400])) + K;
  const doc = yeniPdf(EN > boy ? "landscape" : "portrait", [EN, boy]);
  ciz(doc);
  return doc.output("blob");
}

export function oglenPdf(v: OglenVerisi): Blob {
  return haftalikPdf(v);
}
