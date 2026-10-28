// Puantaj cetveli: Excel (kişi × gün, özet sayfası) ve PDF (A4 yatay, imza alanlı). Resmi çıktı: adlar büyük harf.
import { autoTable } from "jspdf-autotable";
import { yeniPdf } from "./pdfOrtak";
import { xlsxKitap, type Hucre } from "./xlsx";
import { kodMetni, type Izgara } from "./puantajTipleri";
import { ROL_AD, type Onay } from "../veri/tipler";
import { AYLAR, GUN_KISA, buyukAd } from "../veri/tarih";

const baslik = (y: number, m: number, kurum: string) => `${kurum ? buyukAd(kurum) + " · " : ""}${AYLAR[m]} ${y} puantaj cetveli`;
const ONEK: Record<string, string> = { eczaci: "Ecz. ", nobetci: "Ecz. ", teknisyen: "Ecz. Tek. ", destek: "", servis: "Ecz. " };

export function puantajKitabi(G: Izgara, y: number, m: number, kurum: string): Blob {
  const gunBas: Hucre[] = G.gunler.map(g => ({ v: `${g.gun} ${GUN_KISA[g.dw]}`, s: g.tatil ? "baslikTatil" : "baslik" }));
  const cetvel: Hucre[][] = [
    [{ v: baslik(y, m, kurum), s: "kalin" }],
    [],
    [{ v: "Sıra", s: "baslik" }, { v: "Ad soyad", s: "baslik" }, ...gunBas, ...["Toplam çalışma", "Aylık çalışma", "Fazla mesai", "08:00-20:00", "20:00-08:00"].map(v => ({ v, s: "baslik" as const }))],
    ...G.satirlar.map((r, i) => [
      i + 1, ONEK[r.s.role] + buyukAd(r.s.name),
      ...r.cells.map((h, k) => { const t = kodMetni(h.kod, h.saat, G.gunler[k].arife); const v = /^\d+$/.test(t) ? Number(t) : t; return G.gunler[k].tatil ? { v, s: "tatil" as const } : v; }),
      r.toplam, r.aylik ?? "–", { v: r.fm, s: "kalin" as const }, r.fmGunduz, r.fmGece,
    ]),
    [],
    [{ v: "8: normal mesai · 24: nöbet · Nİ: nöbet izni · Yİ: yıllık izin · R: rapor · Dİ: diğer izin · –: çalışma dönemi dışında. Hafta sonu hazırlama 8 saattir.", s: "not" }],
  ];
  const ozet: Hucre[][] = [
    [{ v: baslik(y, m, kurum) + " · aylık özet", s: "kalin" }],
    [],
    ["Ad soyad", "Görev", "Nöbet", "Perşembe", "Cuma", "Cumartesi", "Pazar", "Hazırlama", "Resmi tatil", "Yıllık izin", "Rapor", "Toplam saat", "Fazla mesai", "08:00-20:00", "20:00-08:00"].map(v => ({ v, s: "baslik" as const })),
    ...G.satirlar.map(r => [buyukAd(r.s.name), ROL_AD[r.s.role], r.n, r.thu, r.cu, r.cmt, r.paz, r.h, r.rt, r.yi, r.rd, r.toplam, r.fm, r.fmGunduz, r.fmGece]),
  ];
  return xlsxKitap([
    { ad: "Puantaj", satirlar: cetvel, genislik: [6, 28, ...G.gunler.map(() => 5.2), 10, 10, 10, 10, 10], dondur: { satir: 3, sutun: 2 } },
    { ad: "Aylık özet", satirlar: ozet, genislik: [26, 22, 8, 10, 8, 11, 8, 11, 11, 11, 8, 11, 11, 12, 12], dondur: { satir: 3, sutun: 1 } },
  ]);
}

export function puantajPdf(G: Izgara, y: number, m: number, kurum: string, onay: Onay | null): Blob {
  const doc = yeniPdf();
  const W = 297, H = 210, K = 8;
  doc.setProperties({ title: `${AYLAR[m]} ${y} puantaj`, creator: "Nöbet Çizelgesi" });
  doc.setFont("CizelgeSans", "bold"); doc.setFontSize(14); doc.setTextColor(19, 33, 44);
  doc.text(baslik(y, m, kurum), K, 13);
  doc.setFont("CizelgeSans", "normal"); doc.setFontSize(8); doc.setTextColor(88, 105, 120);
  doc.text(onay ? `Onaylandı: ${new Date(onay.zaman).toLocaleDateString("tr-TR")}${onay.kim ? " · " + onay.kim : ""}` : "Çizelge onaylanmadı", W - K, 13, { align: "right" });
  const tatilSutun = new Set(G.gunler.map((g, i) => (g.tatil ? i + 2 : -1)).filter(i => i >= 0));
  autoTable(doc, {
    startY: 17, margin: { left: K, right: K, bottom: 20 },
    head: [["Sıra", "Ad soyad", ...G.gunler.map(g => `${g.gun}\n${GUN_KISA[g.dw]}`), "Toplam", "Aylık", "Fazla\nmesai", "08-20", "20-08"]],
    body: G.satirlar.map((r, i) => [String(i + 1), ONEK[r.s.role] + buyukAd(r.s.name), ...r.cells.map((h, k) => kodMetni(h.kod, h.saat, G.gunler[k].arife)), String(r.toplam), r.aylik === null ? "–" : String(r.aylik), String(r.fm), String(r.fmGunduz), String(r.fmGece)]),
    theme: "grid",
    // kişi sayısı azsa satırlar yükselir: tablo sayfayı doldurur, hücreler okunur kalır
    styles: { font: "CizelgeSans", fontSize: 7.5, cellPadding: { top: Math.min(3, Math.max(0.8, 60 / Math.max(1, G.satirlar.length))), bottom: Math.min(3, Math.max(0.8, 60 / Math.max(1, G.satirlar.length))), left: 0.5, right: 0.5 }, halign: "center", valign: "middle", textColor: [19, 33, 44], lineColor: [150, 160, 170], lineWidth: 0.12, overflow: "visible" },
    headStyles: { font: "CizelgeSans", fontStyle: "bold", fillColor: [214, 232, 238], textColor: [19, 33, 44], fontSize: 6.5, cellPadding: 0.8 },
    columnStyles: { 0: { cellWidth: 6 }, 1: { halign: "left", cellWidth: 42, overflow: "linebreak", fontSize: 7.5 } },
    didParseCell: h => {
      if (tatilSutun.has(h.column.index)) h.cell.styles.fillColor = h.section === "head" ? [236, 218, 190] : [251, 240, 224];
      if (h.section === "body" && h.column.index === G.gunler.length + 4) h.cell.styles.fontStyle = "bold";
    },
  });
  const sonY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 150;
  doc.setFontSize(7); doc.setTextColor(88, 105, 120);
  doc.text("8: normal mesai · 24: nöbet · Nİ: nöbet izni · Yİ: yıllık izin · R: rapor · Dİ: diğer izin · –: çalışma dönemi dışında. Gölgeli sütunlar: hafta sonu ve resmi tatil.", K, Math.min(sonY + 5, H - 14));
  doc.setTextColor(19, 33, 44); doc.setFontSize(8);
  doc.text("Düzenleyen: ________________________          Onaylayan: ________________________          İmza: ______________", W - K, H - 8, { align: "right" });
  return doc.output("blob");
}
