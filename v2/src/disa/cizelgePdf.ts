// Ayın çizelgesi PDF olarak (A4 yatay): 1. sayfa ay takvimi (panoya asılır), 2. sayfa gün gün liste, 3. sayfa kişi özeti.
// Artifact içinde tarayıcının yazdırma penceresi açılmadığı için PDF sayfada üretilir. Türkçe karakterler için
// yazı tipi gömülür (yazitipi/OKUBENI.md).
import { autoTable } from "jspdf-autotable";
import { yeniPdf, haftalikTakvimCiz, PDF_TABLO_BAS, type PdfSatir } from "./pdfOrtak";
import type { AyCizelgesi, Gorevli, Kisi } from "../veri/tipler";
import { ROL_AD } from "../veri/tipler";
import { AYLAR, GUN_UZUN, buyukAd, haftaGunu } from "../veri/tarih";
import { ayOzeti } from "../veri/ozet";

const RENK = { yazi: [21, 38, 43], soluk: [70, 89, 95], cizgi: [202, 214, 218], tatil: [251, 244, 234], baslik: [222, 238, 241], ecz: [14, 74, 88], tek: [12, 127, 141], haz: [143, 82, 12] } as const;
type Rgb = readonly [number, number, number];

export interface PdfBilgi { kurum: string; resmiTatil: (d: number) => boolean; arife: (d: number) => boolean }

export function cizelgePdf(c: AyCizelgesi, kisiler: Kisi[], b: PdfBilgi): Blob {
  const doc = yeniPdf();
  doc.setProperties({ title: `${AYLAR[c.month]} ${c.year} nöbet çizelgesi`, creator: "Nöbet Çizelgesi" });

  const W = 297, H = 210, K = 10;
  const y0 = c.year, m = c.month;
  const renk = (r: Rgb) => doc.setTextColor(r[0], r[1], r[2]);
  const dolgu = (r: Rgb) => doc.setFillColor(r[0], r[1], r[2]);
  const ciz = (r: Rgb) => doc.setDrawColor(r[0], r[1], r[2]);
  const eczaciOnce = (l: Gorevli[]) => [...l].sort((a, z) => Number(z.role === "eczaci" || z.role === "nobetci") - Number(a.role === "eczaci" || a.role === "nobetci"));
  const onay = c.onay ? `Onaylandı: ${new Date(c.onay.zaman).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}${c.onay.kim ? " · " + c.onay.kim : ""}` : "Taslak (onaylanmadı)";

  function ust(alt: string) {
    renk(RENK.soluk); doc.setFont("CizelgeSans", "normal"); doc.setFontSize(9);
    if (b.kurum) doc.text(buyukAd(b.kurum), K, 11);
    renk(RENK.yazi); doc.setFont("CizelgeSans", "bold"); doc.setFontSize(16);
    doc.text(`${AYLAR[m]} ${y0} Nöbet Çizelgesi`, K, 18.5);
    doc.setFont("CizelgeSans", "normal"); doc.setFontSize(9); renk(RENK.soluk);
    doc.text(alt, W - K, 18.5, { align: "right" });
    doc.text(onay, W - K, 11, { align: "right" });
  }
  function alt(sayfa: number, toplam: number) {
    doc.setFontSize(8); renk(RENK.soluk); doc.setFont("CizelgeSans", "normal");
    doc.text(`Sayfa ${sayfa} / ${toplam}`, W - K, H - 6, { align: "right" });
    doc.text(`Oluşturuldu: ${new Date().toLocaleDateString("tr-TR")}`, K, H - 6);
  }
  /** metni genişliğe sığdırır: önce yazı küçülür, sonra satır kırılır */
  function sigdir(t: string, gen: number, boyut: number, enAz = 6.5): { satirlar: string[]; boyut: number } {
    let s = boyut;
    doc.setFontSize(s);
    while (doc.getTextWidth(t) > gen && s > enAz) { s -= 0.25; doc.setFontSize(s); }
    return { satirlar: doc.getTextWidth(t) > gen ? doc.splitTextToSize(t, gen) : [t], boyut: s };
  }

  // ---------- 1. sayfa: ay takvimi ----------
  ust("Her gün 2 nöbetçi · tatil günlerinde 2 hazırlama");
  const tur = (p: Gorevli): PdfSatir["tur"] => (p.role === "eczaci" || p.role === "nobetci" ? "ecz" : p.role === "destek" ? "des" : "tek");
  const ET: Record<string, string> = { ecz: "ECZ", tek: "TEK", des: "DES" };
  haftalikTakvimCiz(doc, {
    x: K, y: 23, w: W - 2 * K, h: H - 23 - 19, yil: y0, ay: m,
    gunler: c.days.map(g => ({
      gun: g.day, dw: haftaGunu(y0, m, g.day), tatil: !!g.tatil, etiket: b.resmiTatil(g.day) ? "Resmi tatil" : b.arife(g.day) ? "Arife" : "",
      satirlar: [...eczaciOnce(g.assigned).map(p => ({ et: ET[tur(p)], ad: buyukAd(p.name), tur: tur(p) })), ...g.prep.map(p => ({ et: "HAZ", ad: buyukAd(p.name), tur: "haz" as const }))],
    })),
  });
  // lejant ve imza
  const ly = H - 15;
  doc.setFont("CizelgeSans", "normal"); doc.setFontSize(8); renk(RENK.soluk);
  doc.text("ECZ: eczacı · TEK: tekniker · HAZ: hazırlama (8 saat) · Turkuaz başlık: hafta sonu ve resmi tatil. Nöbetçi ertesi gün izinlidir.", K, ly);
  renk(RENK.yazi); doc.text("Onaylayan: ______________________________   İmza: ______________", W - K, ly, { align: "right" });

  // ---------- 2. sayfa: gün gün liste ----------
  doc.addPage();
  ust("Gün gün nöbetçi ve hazırlama listesi");
  const iki = (n: number) => String(n).padStart(2, "0");
  autoTable(doc, {
    startY: 24, margin: { left: K, right: K, bottom: 14 },
    head: [["Tarih", "Gün", "Gün türü", "Nöbetçi 1", "Nöbetçi 2", "Hazırlama 1", "Hazırlama 2", "Fazla mesai"]],
    body: c.days.map(g => {
      const ec = eczaciOnce(g.assigned);
      return [`${iki(g.day)}.${iki(m + 1)}.${y0}`, GUN_UZUN[haftaGunu(y0, m, g.day)], b.resmiTatil(g.day) ? "Resmi tatil" : g.tatil ? "Hafta sonu" : b.arife(g.day) ? "Arife" : "Mesai",
        buyukAd(ec[0]?.name ?? ""), buyukAd(ec[1]?.name ?? ""), buyukAd(g.prep[0]?.name ?? ""), buyukAd(g.prep[1]?.name ?? ""), g.fazlaMesai + " sa"];
    }),
    // 31 gün tek sayfaya sığsın
    styles: { font: "CizelgeSans", fontSize: 8, cellPadding: { top: 0.75, bottom: 0.75, left: 1.2, right: 1.2 }, textColor: [21, 38, 43], lineColor: [202, 214, 218], lineWidth: 0.15 },
    headStyles: PDF_TABLO_BAS,
    columnStyles: { 7: { halign: "right" } },
    didParseCell: h => {
      if (h.section !== "body") return;
      const tatil = !!c.days[h.row.index]?.tatil;
      if (tatil) h.cell.styles.fillColor = [240, 247, 248];
      if (h.column.index === 0) { h.cell.styles.fontStyle = "bold"; h.cell.styles.textColor = [14, 74, 88]; h.cell.styles.fillColor = tatil ? [193, 230, 235] : [239, 245, 246]; }
    },
  });

  // ---------- 3. sayfa: kişi özeti ----------
  doc.addPage();
  ust("Kişi başı nöbet, hazırlama ve fazla mesai");
  const o = ayOzeti(c);
  const say = (id: number, w: number) => c.days.filter(g => haftaGunu(y0, m, g.day) === w && g.assigned.some(p => p.id === id)).length;
  autoTable(doc, {
    startY: 24, margin: { left: K, right: K, bottom: 14 },
    head: [["Ad soyad", "Görev", "Nöbet", "Perşembe", "Cuma", "Cumartesi", "Pazar", "Hazırlama", "Fazla mesai"]],
    body: kisiler.filter(k => o[k.id]).map(k => [buyukAd(k.name), ROL_AD[k.role], o[k.id].nobet, say(k.id, 3), say(k.id, 4), say(k.id, 5), say(k.id, 6), o[k.id].hazirlama, o[k.id].fazlaMesai + " sa"]),
    styles: { font: "CizelgeSans", fontSize: 9, cellPadding: 1.6, textColor: [21, 38, 43], lineColor: [202, 214, 218], lineWidth: 0.15 },
    headStyles: PDF_TABLO_BAS,
    columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" }, 8: { halign: "right" } },
  });
  const sonY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 120;
  doc.setFontSize(8); renk(RENK.soluk);
  doc.text("Fazla mesai: nöbet süresi (24 saat) eksi o günün ve ertesi günün normal mesaisi; hazırlama 8 saat.", K, sonY + 6);

  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) { doc.setPage(i); alt(i, n); }
  return doc.output("blob");
}
