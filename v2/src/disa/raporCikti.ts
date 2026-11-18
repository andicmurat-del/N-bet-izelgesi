// Yıllık rapor Excel'i (aylara göre fazla mesai, görev dağılımı, yıllık denge) ve yönetime aylık rapor (PDF, Excel). Resmi çıktı: adlar büyük harf.
import { autoTable } from "jspdf-autotable";
import { yeniPdf, sonTabloY } from "./pdfOrtak";
import { xlsxKitap, type Hucre, type Sayfa } from "./xlsx";
import { ROL_AD, type Rol } from "../veri/tipler";
import { buyukAd } from "../veri/tarih";

export type Det = {
  fm: number;
  nobet: number;
  hi: number;
  cu: number;
  cmt: number;
  paz: number;
  thu: number;
  prep: number;
  ni: number;
  yi: number;
  rd: number;
  rt: number;
};
export type RK = { id: number; name: string; role: Rol; aktif: boolean; ayrildi?: boolean };
export type Rapor = {
  V: { yil: number; aylar: ({ m: number; det: Record<number, Det> } | null)[]; kisiler: RK[]; kayitli: number };
  D: null | {
    kisiler: { k: RK; t: Record<string, number>; ay: number; fark: Record<string, number>; bek: Record<string, number>; kismi: boolean }[];
    ort: Record<string, number>;
    tamAy: number;
    hedef: number;
  };
  toplam: Record<number, Det>;
  kolonlar: { k: string; t: string; saat?: boolean }[];
  ayKisa: string[];
};

const bas = (v: string): Hucre => ({ v, s: "baslik" });
const ad = (k: RK) => buyukAd(k.name) + (k.aktif ? "" : " (listeden çıkarıldı)");
const yuvarla = (d: number, saat?: boolean) => (saat ? Math.round(d) : Math.round(d * 10) / 10);

export function yillikKitap(R: Rapor, kurum: string): Blob {
  const y = R.V.yil,
    ust = `${kurum ? buyukAd(kurum) + " · " : ""}${y} yıllık rapor`;
  const fm: Hucre[][] = [
    [{ v: ust + " · aylara göre fazla mesai (saat)", s: "kalin" }],
    [],
    [bas("Ad soyad"), bas("Görev"), ...R.ayKisa.map(bas), bas("Toplam"), bas("Ay ortalaması")],
    ...R.V.kisiler.map(k => [
      ad(k),
      ROL_AD[k.role],
      ...R.V.aylar.map(a => (a && a.det[k.id] ? a.det[k.id].fm : null)),
      { v: R.toplam[k.id].fm, s: "kalin" as const },
      R.V.kayitli ? Math.round(R.toplam[k.id].fm / R.V.kayitli) : 0,
    ]),
    [],
    [{ v: `Boş sütunlar: çizelgesi veya puantajı olmayan aylar. Ay ortalaması kayıtlı ${R.V.kayitli} aya göre.`, s: "not" }],
  ];
  const gorev: Hucre[][] = [
    [{ v: ust + " · görev dağılımı (yıl toplamı)", s: "kalin" }],
    [],
    [
      "Ad soyad",
      "Görev",
      "Nöbet",
      "Perşembe",
      "Cuma",
      "Cumartesi",
      "Pazar",
      "Hazırlama",
      "Resmi tatil",
      "Yıllık izin",
      "Rapor",
      "Fazla mesai (saat)",
    ].map(bas),
    ...R.V.kisiler.map(k => {
      const t = R.toplam[k.id];
      return [ad(k), ROL_AD[k.role], t.nobet, t.thu, t.cu, t.cmt, t.paz, t.prep, t.rt, t.yi, t.rd, t.fm];
    }),
  ];
  const sayfalar: Sayfa[] = [
    { ad: "Fazla mesai", satirlar: fm, genislik: [30, 20, ...R.ayKisa.map(() => 7), 9, 12], dondur: { satir: 3, sutun: 1 } },
    { ad: "Görev dağılımı", satirlar: gorev, genislik: [30, 20, 8, 10, 8, 11, 8, 11, 11, 11, 8, 14], dondur: { satir: 3, sutun: 1 } },
  ];
  if (R.D) {
    const denge: Hucre[][] = [
      [{ v: ust + " · yıllık denge", s: "kalin" }],
      [],
      [bas("Ad soyad"), bas("Çalıştığı ay"), ...R.kolonlar.flatMap(c => [bas(c.t + (c.saat ? " (sa)" : "")), bas("Fark")])],
      ...R.D.kisiler.map(x => [ad(x.k), x.ay, ...R.kolonlar.flatMap(c => [x.t[c.k], yuvarla(x.fark[c.k], c.saat)])]),
      [],
      [
        {
          v: "Fark: yıl toplamının, kişinin çalıştığı ay sayısına göre beklenen paydan sapması. Nöbet sayısına hazırlama dahildir. Çizelgeden hesaplanır; puantajdaki gönüllü değişimler sayılmaz.",
          s: "not",
        },
      ],
    ];
    sayfalar.push({
      ad: "Yıllık denge",
      satirlar: denge,
      genislik: [30, 12, ...R.kolonlar.flatMap(() => [11, 8])],
      dondur: { satir: 3, sutun: 1 },
    });
  }
  return xlsxKitap(sayfalar);
}

/** Raporlar > Acil / Öğlen nöbeti tablosu: kişi başı ay ay, yıl toplamı ve ek sütunlar (Cuma vb.) */
export function dagilimKitap(
  baslik: string,
  yil: number,
  kurum: string,
  ayKisa: string[],
  aylar: boolean[],
  satirlar: { ad: string; rol: string; aylar: number[]; top: number; ek: number[] }[],
  ekler: string[],
): Blob {
  const ust = `${kurum ? buyukAd(kurum) + " · " : ""}${yil} ${baslik.toLocaleLowerCase("tr-TR")} dağılımı`;
  const sat: Hucre[][] = [
    [{ v: ust, s: "kalin" }],
    [],
    [bas("Ad soyad"), bas("Görev"), ...ayKisa.map(bas), bas("Yıl"), ...ekler.map(bas)],
    ...satirlar.map(s => [
      buyukAd(s.ad),
      ROL_AD[s.rol as Rol] ?? "",
      ...s.aylar.map((n, i) => (aylar[i] ? n : null)),
      { v: s.top, s: "kalin" as const },
      ...s.ek,
    ]),
    [],
    [{ v: "Boş sütunlar: listesi olmayan aylar.", s: "not" }],
  ];
  return xlsxKitap([
    {
      ad: baslik.slice(0, 31),
      satirlar: sat,
      genislik: [28, 14, ...ayKisa.map(() => 6), 7, ...ekler.map(() => 10)],
      dondur: { satir: 3, sutun: 2 },
    },
  ]);
}

// ---- yönetime aylık rapor (A4 yatay, tek sayfa; imza alanlı) ----
export interface AylikRaporVerisi {
  kurum: string;
  ay: string;
  kapsam: string;
  mesaiGun: number;
  mesaiToplam: number;
  /** onay bilgileri (ör. "Nöbet çizelgesi: onaylandı 30.10.2026 · Ecz. X") */
  onaylar: string[];
  satirlar: {
    ad: string;
    rol: string;
    nobet: number;
    tatilNobet: number;
    acil: number;
    haz: number;
    oglen: number;
    yi: number;
    rapor: number;
    di: number;
    ni: number;
    toplam: number;
    aylik: number | null;
    fm: number;
    gunduz: number;
    gece: number;
  }[];
  /** imza alanları: unvan ve (biliniyorsa) ad */
  imzalar: { unvan: string; ad: string }[];
}
const AYLIK_SUTUN = [
  "Ad soyad",
  "Görev",
  "Eczane nöbeti",
  "Tatilde",
  "Acil nöbeti",
  "Hazırlama",
  "Öğlen nöbeti",
  "Yıllık izin",
  "Rapor",
  "Diğer izin",
  "Nöbet izni*",
  "Toplam çalışma",
  "Aylık çalışma",
  "Fazla mesai",
  "08–20",
  "20–08",
];
const sy = (n: number) => (Number.isInteger(n) ? String(n) : String(n).replace(".", ","));
function aylikSatirlar(v: AylikRaporVerisi) {
  const t = { nobet: 0, tatilNobet: 0, acil: 0, haz: 0, oglen: 0, yi: 0, rapor: 0, di: 0, ni: 0, toplam: 0, fm: 0, gunduz: 0, gece: 0 };
  const govde = v.satirlar.map(s => {
    (Object.keys(t) as (keyof typeof t)[]).forEach(k => {
      t[k] += s[k];
    });
    return [
      buyukAd(s.ad),
      ROL_AD[s.rol as Rol] ?? s.rol,
      s.nobet,
      s.tatilNobet,
      s.acil,
      s.haz,
      s.oglen,
      s.yi,
      s.rapor,
      s.di,
      s.ni,
      s.toplam,
      s.aylik ?? "–",
      s.fm,
      s.gunduz,
      s.gece,
    ];
  });
  const toplam = [
    "TOPLAM",
    `${v.satirlar.length} kişi`,
    t.nobet,
    t.tatilNobet,
    t.acil,
    t.haz,
    t.oglen,
    t.yi,
    t.rapor,
    t.di,
    t.ni,
    t.toplam,
    "",
    t.fm,
    t.gunduz,
    t.gece,
  ];
  return { govde, toplam };
}
const AYLIK_NOT =
  "Puantaja göre (gerçekleşen: nöbet değişimleri ve izinler işlenmiş). Sayılar gün, saatler saat. Tatilde: hafta sonu / resmi tatile düşen eczane nöbeti. " +
  "Aylık çalışma: ayın normal mesai saatleri (işe başlama öncesi / ayrılış sonrası hariç; kemoterapi eczacısı ve destek personelinde yok). " +
  "Fazla mesai = toplam çalışma (yıllık izin ve rapor mesai sayılarak) − aylık çalışma. *Nöbet izni: puantaja elle girilen, fazla mesai karşılığı izin.";

export function aylikRaporPdf(v: AylikRaporVerisi): Blob {
  // tek sayfaya sığsın: önce olağan boyutla çizilir; taşarsa yazı ve satır aralığı küçültülerek yeniden çizilir
  let doc = aylikCiz(v, 1);
  for (let o = 0.92; doc.getNumberOfPages() > 1 && o >= 0.6; o -= 0.08) doc = aylikCiz(v, o);
  return doc.output("blob");
}
function aylikCiz(v: AylikRaporVerisi, olcek: number) {
  const doc = yeniPdf("landscape");
  const W = 297,
    H = 210,
    K = 10;
  doc.setProperties({ title: `${v.ay} aylık nöbet ve fazla mesai raporu`, creator: "Nöbet Çizelgesi" });
  doc.setFont("CizelgeSans", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(88, 105, 120);
  doc.text(buyukAd(v.kurum || "Hastane Eczanesi"), K, 11);
  doc.text(`Düzenlenme: ${new Date().toLocaleDateString("tr-TR")}`, W - K, 11, { align: "right" });
  doc.setFont("CizelgeSans", "bold");
  doc.setFontSize(14);
  doc.setTextColor(19, 33, 44);
  doc.text(`${v.ay} Aylık Nöbet ve Fazla Mesai Raporu`, K, 18);
  doc.setFont("CizelgeSans", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(60, 75, 88);
  doc.text(
    `${v.kapsam} · ${v.mesaiGun} mesai günü · aylık normal çalışma ${sy(v.mesaiToplam)} saat${v.onaylar.length ? " · " + v.onaylar.join(" · ") : ""}`,
    K,
    23.5,
    { maxWidth: W - 2 * K },
  );
  const { govde, toplam } = aylikSatirlar(v);
  const boyut = 8.5 * olcek,
    dolgu = 1.4 * olcek;
  autoTable(doc, {
    startY: 27,
    margin: { left: K, right: K, bottom: 34 },
    head: [AYLIK_SUTUN],
    body: govde.map(r => r.map(String)),
    foot: [toplam.map(String)],
    theme: "grid",
    showFoot: "lastPage",
    styles: {
      font: "CizelgeSans",
      fontSize: boyut,
      cellPadding: { top: dolgu, bottom: dolgu, left: 1.2, right: 1.2 },
      textColor: [21, 38, 43],
      lineColor: [190, 200, 206],
      lineWidth: 0.15,
      halign: "center",
      valign: "middle",
    },
    headStyles: {
      font: "CizelgeSans",
      fontStyle: "bold",
      fillColor: [222, 238, 241],
      textColor: [21, 38, 43],
      fontSize: Math.min(boyut, 7.5),
    },
    footStyles: { font: "CizelgeSans", fontStyle: "bold", fillColor: [240, 244, 246], textColor: [21, 38, 43] },
    columnStyles: { 0: { halign: "left", cellWidth: 44 }, 1: { halign: "left", cellWidth: 30 }, 13: { fontStyle: "bold" } },
  });
  const sonY = sonTabloY(doc, 150);
  doc.setFont("CizelgeSans", "normal");
  doc.setFontSize(7);
  doc.setTextColor(88, 105, 120);
  doc.text(AYLIK_NOT, K, Math.min(sonY + 4, H - 30), { maxWidth: W - 2 * K });
  // imza alanları
  const iw = (W - 2 * K) / v.imzalar.length,
    iy = H - 20;
  doc.setTextColor(19, 33, 44);
  v.imzalar.forEach((im, i) => {
    const x = K + i * iw;
    doc.setFont("CizelgeSans", "bold");
    doc.setFontSize(8.5);
    doc.text(im.unvan, x, iy);
    doc.setFont("CizelgeSans", "normal");
    doc.setFontSize(8);
    doc.text(`Adı soyadı: ${im.ad || "................................................"}`, x, iy + 5);
    doc.text("İmza: ................................      Tarih: ......./......./...........", x, iy + 10);
  });
  return doc;
}

export function aylikRaporKitabi(v: AylikRaporVerisi): Blob {
  const { govde, toplam } = aylikSatirlar(v);
  const sat: Hucre[][] = [
    [{ v: `${v.kurum ? buyukAd(v.kurum) + " · " : ""}${v.ay} aylık nöbet ve fazla mesai raporu`, s: "kalin" }],
    [
      {
        v: `${v.kapsam} · ${v.mesaiGun} mesai günü · aylık normal çalışma ${v.mesaiToplam} saat${v.onaylar.length ? " · " + v.onaylar.join(" · ") : ""}`,
        s: "not",
      },
    ],
    [],
    AYLIK_SUTUN.map(bas),
    ...govde,
    toplam.map(x => ({ v: x, s: "kalin" as const })),
    [],
    [{ v: AYLIK_NOT, s: "not" }],
    [],
    ...v.imzalar.map(im => [{ v: im.unvan, s: "kalin" as const }, im.ad || "", "İmza:", "", "Tarih:"]),
  ];
  return xlsxKitap([
    { ad: "Aylık rapor", satirlar: sat, genislik: [30, 20, 9, 8, 9, 9, 9, 9, 7, 8, 9, 10, 10, 10, 8, 8], dondur: { satir: 4, sutun: 1 } },
  ]);
}
