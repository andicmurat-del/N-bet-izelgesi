// Yıllık rapor Excel'i: aylara göre fazla mesai, görev dağılımı ve yıllık denge sayfaları. Resmi çıktı: adlar büyük harf.
import { xlsxKitap, type Hucre, type Sayfa } from "./xlsx";
import { ROL_AD, type Rol } from "../veri/tipler";
import { buyukAd } from "../veri/tarih";

export type Det = { fm: number; nobet: number; hi: number; cu: number; cmt: number; paz: number; thu: number; prep: number; ni: number; yi: number; rd: number; rt: number };
export type RK = { id: number; name: string; role: Rol; aktif: boolean; ayrildi?: boolean };
export type Rapor = {
  V: { yil: number; aylar: ({ m: number; det: Record<number, Det> } | null)[]; kisiler: RK[]; kayitli: number };
  D: null | { kisiler: { k: RK; t: Record<string, number>; ay: number; fark: Record<string, number>; bek: Record<string, number>; kismi: boolean }[]; ort: Record<string, number>; tamAy: number; hedef: number };
  toplam: Record<number, Det>;
  kolonlar: { k: string; t: string; saat?: boolean }[];
  ayKisa: string[];
};

const bas = (v: string): Hucre => ({ v, s: "baslik" });
const ad = (k: RK) => buyukAd(k.name) + (k.aktif ? "" : " (listeden çıkarıldı)");
const yuvarla = (d: number, saat?: boolean) => (saat ? Math.round(d) : Math.round(d * 10) / 10);

export function yillikKitap(R: Rapor, kurum: string): Blob {
  const y = R.V.yil, ust = `${kurum ? buyukAd(kurum) + " · " : ""}${y} yıllık rapor`;
  const fm: Hucre[][] = [
    [{ v: ust + " · aylara göre fazla mesai (saat)", s: "kalin" }],
    [],
    [bas("Ad soyad"), bas("Görev"), ...R.ayKisa.map(bas), bas("Toplam"), bas("Ay ortalaması")],
    ...R.V.kisiler.map(k => [
      ad(k), ROL_AD[k.role],
      ...R.V.aylar.map(a => (a && a.det[k.id] ? a.det[k.id].fm : null)),
      { v: R.toplam[k.id].fm, s: "kalin" as const }, R.V.kayitli ? Math.round(R.toplam[k.id].fm / R.V.kayitli) : 0,
    ]),
    [],
    [{ v: `Boş sütunlar: çizelgesi veya puantajı olmayan aylar. Ay ortalaması kayıtlı ${R.V.kayitli} aya göre.`, s: "not" }],
  ];
  const gorev: Hucre[][] = [
    [{ v: ust + " · görev dağılımı (yıl toplamı)", s: "kalin" }],
    [],
    ["Ad soyad", "Görev", "Nöbet", "Perşembe", "Cuma", "Cumartesi", "Pazar", "Hazırlama", "Resmi tatil", "Yıllık izin", "Rapor", "Fazla mesai (saat)"].map(bas),
    ...R.V.kisiler.map(k => { const t = R.toplam[k.id]; return [ad(k), ROL_AD[k.role], t.nobet, t.thu, t.cu, t.cmt, t.paz, t.prep, t.rt, t.yi, t.rd, t.fm]; }),
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
      [{ v: "Fark: yıl toplamının, kişinin çalıştığı ay sayısına göre beklenen paydan sapması. Nöbet sayısına hazırlama dahildir. Çizelgeden hesaplanır; puantajdaki gönüllü değişimler sayılmaz.", s: "not" }],
    ];
    sayfalar.push({ ad: "Yıllık denge", satirlar: denge, genislik: [30, 12, ...R.kolonlar.flatMap(() => [11, 8])], dondur: { satir: 3, sutun: 1 } });
  }
  return xlsxKitap(sayfalar);
}
