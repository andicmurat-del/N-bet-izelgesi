// Ayın çizelgesi PDF olarak (A4 yatay): 1. sayfa ay takvimi (panoya asılır), 2. sayfa gün gün liste, 3. sayfa kişi özeti.
// Artifact içinde tarayıcının yazdırma penceresi açılmadığı için PDF sayfada üretilir. Türkçe karakterler için
// yazı tipi gömülür (yazitipi/OKUBENI.md).
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import normal from "./yazitipi/CizelgeSans-Regular.ttf?inline";
import kalin from "./yazitipi/CizelgeSans-SemiBold.ttf?inline";
import type { AyCizelgesi, Gorevli, Kisi } from "../veri/tipler";
import { ROL_AD } from "../veri/tipler";
import { AYLAR, GUN_KISA, GUN_UZUN, buyukAd, haftaGunu } from "../veri/tarih";
import { ayOzeti } from "../veri/depo.svelte";

const base64 = (dataUrl: string) => dataUrl.slice(dataUrl.indexOf(",") + 1);
const RENK = { yazi: [19, 33, 44], soluk: [88, 105, 120], cizgi: [190, 200, 208], tatil: [251, 244, 234], baslik: [227, 238, 240], ecz: [11, 107, 93], tek: [45, 92, 156], haz: [143, 82, 12] } as const;
type Rgb = readonly [number, number, number];

export interface PdfBilgi { kurum: string; resmiTatil: (d: number) => boolean; arife: (d: number) => boolean }

export function cizelgePdf(c: AyCizelgesi, kisiler: Kisi[], b: PdfBilgi): Blob {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.addFileToVFS("CizelgeSans-Regular.ttf", base64(normal));
  doc.addFont("CizelgeSans-Regular.ttf", "CizelgeSans", "normal");
  doc.addFileToVFS("CizelgeSans-SemiBold.ttf", base64(kalin));
  doc.addFont("CizelgeSans-SemiBold.ttf", "CizelgeSans", "bold");
  doc.setFont("CizelgeSans", "normal");
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
  ust("Her gün 2 nöbetçi · tatil günlerinde 2 hazırlama (H1, H2)");
  const bos = haftaGunu(y0, m, 1), satir = Math.ceil((bos + c.days.length) / 7);
  const ty = 25, th = 7, alan = H - ty - th - 22, ch = alan / satir, cw = (W - 2 * K) / 7;
  doc.setFont("CizelgeSans", "bold"); doc.setFontSize(9);
  GUN_KISA.forEach((_, i) => {
    dolgu(RENK.baslik); ciz(RENK.cizgi); doc.setLineWidth(0.2);
    doc.rect(K + i * cw, ty, cw, th, "FD");
    renk(RENK.yazi); doc.text(GUN_UZUN[i], K + i * cw + cw / 2, ty + 4.8, { align: "center" });
  });
  for (let i = 0; i < satir * 7; i++) {
    const x = K + (i % 7) * cw, y = ty + th + Math.floor(i / 7) * ch, d = i - bos + 1;
    const g = d >= 1 && d <= c.days.length ? c.days[d - 1] : null;
    if (g?.tatil) { dolgu(RENK.tatil); doc.rect(x, y, cw, ch, "F"); }
    ciz(RENK.cizgi); doc.setLineWidth(0.2); doc.rect(x, y, cw, ch, "S");
    if (!g) continue;
    doc.setFont("CizelgeSans", "bold"); doc.setFontSize(10); renk(RENK.yazi);
    doc.text(String(d), x + 2, y + 4.6);
    const etiket = b.resmiTatil(d) ? "Resmi tatil" : b.arife(d) ? "Arife" : "";
    if (etiket) { doc.setFont("CizelgeSans", "normal"); doc.setFontSize(7); renk(RENK.haz); doc.text(etiket, x + cw - 2, y + 4.4, { align: "right" }); }
    let yy = y + 9.2;
    const satirYaz = (t: string, onEk: string, r: Rgb, kalinMi: boolean) => {
      const gen = cw - 4 - (onEk ? 6 : 0);
      doc.setFont("CizelgeSans", kalinMi ? "bold" : "normal");
      const f = sigdir(t, gen, 8.2);
      for (const s of f.satirlar) {
        if (onEk) { doc.setFont("CizelgeSans", "bold"); doc.setFontSize(7); renk(RENK.haz); doc.text(onEk, x + 2, yy); doc.setFont("CizelgeSans", kalinMi ? "bold" : "normal"); }
        doc.setFontSize(f.boyut); renk(r); doc.text(s, x + 2 + (onEk ? 6 : 0), yy);
        yy += 3.6;
      }
    };
    for (const p of eczaciOnce(g.assigned)) satirYaz(buyukAd(p.name), "", p.role === "teknisyen" ? RENK.tek : RENK.ecz, p.role !== "teknisyen");
    g.prep.forEach((p, k) => satirYaz(buyukAd(p.name), "H" + (k + 1), RENK.yazi, false));
  }
  // lejant ve imza
  const ly = H - 15;
  doc.setFont("CizelgeSans", "normal"); doc.setFontSize(8); renk(RENK.soluk);
  doc.text("Koyu yeşil: eczacı · Mavi: tekniker · H1/H2: hazırlama (8 saat) · Gölgeli: hafta sonu ve resmi tatil. Nöbetçi ertesi gün izinlidir.", K, ly);
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
    styles: { font: "CizelgeSans", fontSize: 8, cellPadding: { top: 0.75, bottom: 0.75, left: 1.2, right: 1.2 }, textColor: [19, 33, 44], lineColor: [190, 200, 208], lineWidth: 0.15 },
    headStyles: { font: "CizelgeSans", fontStyle: "bold", fillColor: [227, 238, 240], textColor: [19, 33, 44] },
    columnStyles: { 7: { halign: "right" } },
    didParseCell: h => { if (h.section === "body" && c.days[h.row.index]?.tatil) h.cell.styles.fillColor = [251, 244, 234]; },
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
    styles: { font: "CizelgeSans", fontSize: 9, cellPadding: 1.6, textColor: [19, 33, 44], lineColor: [190, 200, 208], lineWidth: 0.15 },
    headStyles: { font: "CizelgeSans", fontStyle: "bold", fillColor: [227, 238, 240], textColor: [19, 33, 44] },
    columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" }, 8: { halign: "right" } },
  });
  const sonY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 120;
  doc.setFontSize(8); renk(RENK.soluk);
  doc.text("Fazla mesai: nöbet süresi (24 saat) eksi o günün ve ertesi günün normal mesaisi; hazırlama 8 saat.", K, sonY + 6);

  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) { doc.setPage(i); alt(i, n); }
  return doc.output("blob");
}
