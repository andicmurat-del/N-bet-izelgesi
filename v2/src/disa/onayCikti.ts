// Onay listesi masaları: haftalık PDF, programdaki tabloyla aynı görünüm: koyu başlık (GÜN, MASA 1…, jokerler ayrı
// renkte), satır başında gün adı ve tarih, hücrelerde adlar; teknikerin oturduğu hücre açık turkuaz, program
// dolduramadığı masa kırmızı "Boş", elle boş bırakılan masa boş. Sayfa tablonun boyunda (A4 değil).
import { yeniPdf, ekranTablosuCiz, type EkranHucre, type EkranSutun } from "./pdfOrtak";

export interface OnayCiktiVerisi {
  kurum: string;
  /** belge adı için dönem (ör. "9–13 Kasım 2026") */
  donem: string;
  /** satır başları: gün adı ve tarih (ör. "Pazartesi", "9 Kasım"); tatil: o gün liste yok */
  gunler: { baslik: string; alt?: string; tatil: boolean }[];
  /** yerler (tabloda sütun): yer adı, joker mi, gün gün hücre */
  satirlar: { yer: string; joker?: boolean; hucre: { ad: string; bos?: boolean; yerine?: boolean; elleBos?: boolean }[] }[];
  notlar: string[];
}

export function onayPdf(v: OnayCiktiVerisi): Blob {
  const K = 5, GUN = 30, SUT = 30, BAS = 9, SAT = 14;
  const sutunlar: EkranSutun[] = [{ w: GUN, bas: "Gün" }, ...v.satirlar.map((r, i) => ({ w: SUT, bas: r.yer, basZemin: r.joker ? [27, 107, 123] as const : undefined, ayrac: r.joker && !v.satirlar[i - 1]?.joker }))];
  const satirlar: EkranHucre[][] = v.gunler.map((g, gi) => [
    { t: g.baslik, alt: g.alt, kalin: true, renk: [14, 74, 88], hiza: "left", zemin: [239, 245, 246] },
    ...v.satirlar.map((r, si): EkranHucre => {
      if (g.tatil) return { t: si === 0 ? "Resmi tatil" : "", renk: [86, 106, 112], zemin: [245, 249, 250] };
      const h = r.hucre[gi];
      if (h?.bos) return { t: "Boş", kalin: true, renk: [179, 38, 30], zemin: [253, 241, 240] };
      if (h?.elleBos) return { t: "" };
      if (!h?.ad) return { t: "–", renk: [86, 106, 112] };
      return { t: h.ad, kalin: true, zemin: h.yerine ? [214, 239, 243] : undefined };
    }),
  ]);
  const W = sutunlar.reduce((a, c) => a + c.w, 0) + 2 * K, H = BAS + satirlar.length * SAT + 2 * K;
  const doc = yeniPdf(W > H ? "landscape" : "portrait", [W, H]);
  doc.setProperties({ title: `${v.donem} onay listesi masaları`, creator: "Nöbet Çizelgesi" });
  ekranTablosuCiz(doc, { x: K, y: K, basH: BAS, satirH: SAT, sutunlar, satirlar });
  return doc.output("blob");
}
