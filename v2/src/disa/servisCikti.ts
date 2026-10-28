// Servis hazırlama çıktıları: günün listeleri (PDF) ve yıllık rapor (Excel). Resmi çıktı: adlar büyük harf.
// Eski uygulamadaki yazdırma sayfalarının karşılığı: tek sayfada tüm teknikerler, her teknikere ayrı kontrol listesi,
// servis → hazırlayan toplu listesi.
import { autoTable } from "jspdf-autotable";
import type { jsPDF } from "jspdf";
import { yeniPdf } from "./pdfOrtak";
import { xlsxKitap, type Hucre } from "./xlsx";
import { buyukAd } from "../veri/tarih";
import type { ServisYilRaporu } from "../veri/servis.svelte";

export interface ServisGunCiktisi {
  kurum: string;
  /** "5 Ekim 2026 Pazartesi" */
  tarih: string;
  /** çok günlük servislerin bu seferki gün sayısı */
  n: number;
  kisiler: { ad: string; yb: number; items: { name: string; multi: boolean }[] }[];
}

type Rgb = [number, number, number];
const YAZI: Rgb = [19, 33, 44], SOLUK: Rgb = [88, 105, 120], BASLIK: Rgb = [214, 232, 238], CIZGI: Rgb = [150, 160, 170];
const ybMi = (sn: string) => /\sYB$/.test(sn);
const sirala = <T extends { name: string }>(l: T[]) => [...l].sort((a, b) => Number(ybMi(b.name)) - Number(ybMi(a.name)) || a.name.localeCompare(b.name, "tr"));
const servisSayisi = (v: ServisGunCiktisi) => v.kisiler.reduce((t, k) => t + k.items.length, 0);
const gunNotu = (v: ServisGunCiktisi) => (v.n > 1 ? ` · çok günlük servisler ${v.n} gün` : "");

function ust(doc: jsPDF, W: number, K: number, kurum: string, baslik: string, alt: string) {
  doc.setFont("CizelgeSans", "normal"); doc.setFontSize(9); doc.setTextColor(...SOLUK);
  if (kurum) doc.text(buyukAd(kurum), K, 11);
  doc.setFont("CizelgeSans", "bold"); doc.setFontSize(15); doc.setTextColor(...YAZI);
  doc.text(baslik, K, 18.5);
  doc.setFont("CizelgeSans", "normal"); doc.setFontSize(9.5); doc.setTextColor(...SOLUK);
  doc.text(alt, K, 24.5, { maxWidth: W - 2 * K });
}

/** Tüm teknikerler tek A4 yatay sayfada: kişi kutuları sayfayı doldurur, yazı sığan en büyük boyda */
export function servisTekSayfaPdf(v: ServisGunCiktisi): Blob {
  const doc = yeniPdf(), W = 297, H = 210, K = 10;
  doc.setProperties({ title: `Tekniker servis listesi ${v.tarih}`, creator: "Nöbet Çizelgesi" });
  ust(doc, W, K, v.kurum, "Tekniker Servis Listesi", `${v.tarih} · ${v.kisiler.length} kişi, ${servisSayisi(v)} servis${gunNotu(v)}`);
  const n = v.kisiler.length, kol = n <= 4 ? Math.max(1, n) : n <= 8 ? Math.ceil(n / 2) : Math.ceil(n / 3), sat = Math.ceil(n / kol);
  const top = 30, bosluk = 4, bw = (W - 2 * K - (kol - 1) * bosluk) / kol, bh = (H - top - K - (sat - 1) * bosluk) / sat;
  // en kalabalık kutuya göre satır aralığı ve yazı boyu
  const enCok = Math.max(1, ...v.kisiler.map(k => k.items.length));
  const satirMm = Math.min(7, (bh - 19) / enCok), fs = Math.max(6.5, Math.min(13, satirMm / 0.45));
  v.kisiler.forEach((k, i) => {
    const x = K + (i % kol) * (bw + bosluk), y = top + Math.floor(i / kol) * (bh + bosluk);
    doc.setDrawColor(...CIZGI); doc.setLineWidth(0.3); doc.roundedRect(x, y, bw, bh, 2, 2);
    doc.setFillColor(...BASLIK); doc.roundedRect(x, y, bw, 11, 2, 2, "F"); doc.rect(x, y + 6, bw, 5, "F");
    doc.setFont("CizelgeSans", "bold"); doc.setFontSize(11); doc.setTextColor(...YAZI);
    doc.text(buyukAd(k.ad), x + 3, y + 7.4, { maxWidth: bw - 6 });
    doc.setFont("CizelgeSans", "normal"); doc.setFontSize(8); doc.setTextColor(...SOLUK);
    doc.text(`${k.items.length} servis · ${k.yb} YB`, x + 3, y + 15.5);
    doc.setFontSize(fs); doc.setTextColor(...YAZI);
    sirala(k.items).forEach((s, j) => doc.text(`• ${s.name}${s.multi && v.n > 1 ? ` (${v.n} gün)` : ""}`, x + 3, y + 17 + (j + 1) * satirMm, { maxWidth: bw - 6 }));
  });
  return doc.output("blob");
}

/** Her teknikere ayrı sayfa (A4 dikey): servisler ve "Hazırlandı" işaret kutusu */
export function servisKisiPdf(v: ServisGunCiktisi): Blob {
  const doc = yeniPdf("portrait"), W = 210, K = 14;
  doc.setProperties({ title: `Servis hazırlama listesi ${v.tarih}`, creator: "Nöbet Çizelgesi" });
  v.kisiler.forEach((k, i) => {
    if (i) doc.addPage();
    const items = sirala(k.items);
    ust(doc, W, K, v.kurum, "Servis Hazırlama Listesi", `${buyukAd(k.ad)} · ${v.tarih} · ${items.length} servis, ${k.yb} YB${gunNotu(v)}`);
    autoTable(doc, {
      startY: 30, margin: { left: K, right: K },
      head: [["#", "Servis", "Hazırlama", "Hazırlandı"]],
      body: items.map((s, j) => [String(j + 1), s.name, s.multi && v.n > 1 ? `${v.n} günlük` : "Tek günlük", ""]),
      theme: "grid",
      styles: { font: "CizelgeSans", fontSize: 11, cellPadding: { top: 3.2, bottom: 3.2, left: 2.5, right: 2.5 }, textColor: YAZI, lineColor: CIZGI, lineWidth: 0.2, valign: "middle" },
      headStyles: { font: "CizelgeSans", fontStyle: "bold", fillColor: BASLIK, fontSize: 10 },
      columnStyles: { 0: { cellWidth: 10, halign: "center" }, 1: { fontStyle: "bold" }, 2: { cellWidth: 32 }, 3: { cellWidth: 28 } },
      didDrawCell: h => { if (h.section === "body" && h.column.index === 3) { doc.setDrawColor(110, 120, 130); doc.rect(h.cell.x + h.cell.width / 2 - 2.5, h.cell.y + h.cell.height / 2 - 2.5, 5, 5); } },
    });
  });
  return doc.output("blob");
}

/** Servis → hazırlayan listesi (alfabetik, iki sütun, tek A4 yatay) */
export function servisTopluPdf(v: ServisGunCiktisi): Blob {
  const doc = yeniPdf(), W = 297, K = 10;
  doc.setProperties({ title: `Servis hazırlama listesi ${v.tarih}`, creator: "Nöbet Çizelgesi" });
  ust(doc, W, K, v.kurum, "Servis Hazırlama Listesi", `${v.tarih} · ${v.kisiler.length} kişi, ${servisSayisi(v)} servis${gunNotu(v)}`);
  const satir = v.kisiler.flatMap(k => k.items.map(s => [s.name, buyukAd(k.ad)])).sort((a, b) => a[0].localeCompare(b[0], "tr"));
  const yari = Math.ceil(satir.length / 2), gen = (W - 2 * K - 8) / 2;
  // satırlar tek sayfaya sığsın: satır yüksekliği = yazı (pt → mm, satır aralığıyla) + iki kenar boşluğu
  const pad = 0.8, satirMm = 165 / (yari + 1), fs = Math.max(6, Math.min(10, (satirMm - 2 * pad) / (0.3528 * 1.15)));
  const ortak = {
    theme: "grid" as const, head: [["Servis", "Hazırlayan"]], startY: 30,
    styles: { font: "CizelgeSans", fontSize: fs, cellPadding: pad, textColor: YAZI, lineColor: CIZGI, lineWidth: 0.15 },
    headStyles: { font: "CizelgeSans", fontStyle: "bold" as const, fillColor: BASLIK },
    columnStyles: { 1: { fontStyle: "bold" as const } },
  };
  autoTable(doc, { ...ortak, body: satir.slice(0, yari), margin: { left: K, right: W - K - gen } });
  doc.setPage(1);
  if (satir.length > yari) autoTable(doc, { ...ortak, body: satir.slice(yari), margin: { left: K + gen + 8, right: K } });
  return doc.output("blob");
}

/** Panoya kopyalanacak düz metin */
export const servisMetni = (v: ServisGunCiktisi) =>
  `Servis dağıtımı · ${v.tarih}\n\n` + v.kisiler.map(k => `${k.ad} (${k.items.length} servis):\n` + sirala(k.items).map(s => `  - ${s.name}${s.multi && v.n > 1 ? ` (${v.n} gün)` : ""}`).join("\n")).join("\n\n");

const AY3 = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
/** Yıllık servis raporu: aylara göre yük ve servislerin kişilere dağılımı */
export function servisYilKitabi(R: ServisYilRaporu, yil: number, kurum: string): Blob {
  const bas = (v: string): Hucre => ({ v, s: "baslik" });
  const ust = `${kurum ? buyukAd(kurum) + " · " : ""}${yil} servis hazırlama`;
  const yuk: Hucre[][] = [
    [{ v: ust + " · aylara göre yük", s: "kalin" }], [],
    [bas("Ad soyad"), ...AY3.map(bas), bas("Gün"), bas("Yük"), bas("Ort. yük"), bas("Ekip ort.")],
    ...R.kisi.map(k => [buyukAd(k.ad), ...k.ay.map((a, i) => (a ? Math.round(a.l) : R.bosAy[i] ? null : 0)), k.gun, { v: Math.round(k.l), s: "kalin" as const }, k.gun ? Math.round(k.l / k.gun) : null, k.gun ? Math.round(k.fl / k.gun) : null]),
    [], [{ v: "Yük = servisin hasta sayısı × zorluğu (çok günlük servislerde gün sayısıyla). Ort. yük: çalıştığı gün başına; Ekip ort.: aynı günlerde ekipte kişi başına düşen yük.", s: "not" }],
  ];
  const ids = R.kisi.map(k => k.id);
  const dag: Hucre[][] = [
    [{ v: ust + " · servislerin kişilere dağılımı", s: "kalin" }], [],
    [bas("Servis"), ...R.kisi.map(k => bas(buyukAd(k.ad))), bas("Toplam")],
    ...R.matris.servisler.map(s => { const v = ids.map(id => s.say[id] ?? 0); return [s.sn, ...v, { v: v.reduce((t, x) => t + x, 0), s: "kalin" as const }]; }),
  ];
  return xlsxKitap([
    { ad: "Aylara göre", satirlar: yuk, genislik: [24, ...AY3.map(() => 8), 8, 10, 10, 10], dondur: { satir: 3, sutun: 1 } },
    { ad: "Servis dağılımı", satirlar: dag, genislik: [26, ...ids.map(() => 13), 10], dondur: { satir: 3, sutun: 1 } },
  ]);
}
