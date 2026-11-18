// Personele gönderilecek metinler (WhatsApp, e-posta): ayın nöbet listesi ya da bir kişinin bu ayki görevleri.
// Durumdan bağımsız: veri ve hesaplanmış puantaj dışarıdan verilir (test edilebilsin).
import type { AyCizelgesi, Veri } from "./tipler";
import { AYLAR, GUN_KISA, gunMetni, haftaGunu } from "./tarih";

const eczaciMi = (r: string) => r === "eczaci" || r === "nobetci";

/** Ayın nöbet listesi: her gün nöbetçiler (eczacı önce) ve tatil günlerinde hazırlama; tatil günleri * ile */
export function ayListesiMetni(c: AyCizelgesi, kurum: string, tatil: (d: number) => boolean): string {
  const y = c.year, m = c.month;
  const bas = `*${AYLAR[m]} ${y} Nöbet Listesi*${kurum ? " · " + kurum : ""}${c.onay ? "" : " (taslak)"}`;
  const satir = c.days.map(g => {
    const n = [...g.assigned].sort((a, b) => Number(eczaciMi(b.role)) - Number(eczaciMi(a.role))).map(p => p.name).join(", ") || "—";
    const h = g.prep.length ? ` · Haz.: ${g.prep.map(p => p.name).join(", ")}` : "";
    return `${g.day} ${GUN_KISA[haftaGunu(y, m, g.day)]}${tatil(g.day) ? "*" : ""}: ${n}${h}`;
  });
  return [bas, ...satir, "", "* hafta sonu / resmi tatil"].join("\n");
}

/** puantaj hücresinin okunan alanları */
interface Hucre { kod: string; acil?: boolean }

/** Bir kişinin bu ayki görevleri (gerçekleşen, puantaja göre: nöbet değişimleri işlenmiş): eczane nöbeti, acil eczane
 *  nöbeti, hazırlama ve öğlen nöbeti. hucreler: kişinin puantaj satırı (gün sırasıyla) */
export function kisiGorevMetni(veri: Pick<Veri, "oglen">, y: number, m: number, kisi: { id: number; name: string }, hucreler: Hucre[]): string {
  const l: string[] = [], say = { n: 0, a: 0, h: 0, o: 0 };
  const oglen = veri.oglen[`${y}-${m}`] ?? {};
  hucreler.forEach((c, i) => {
    const d = i + 1, isler: string[] = [];
    if (c.kod === "N") { if (c.acil) { isler.push("acil eczane nöbeti"); say.a++; } else { isler.push("nöbet"); say.n++; } }
    else if (c.kod === "H") { isler.push("hazırlama"); say.h++; }
    const og = oglen[d];
    if (og && (og.e.includes(kisi.id) || og.t.includes(kisi.id))) { isler.push("öğlen nöbeti"); say.o++; }
    if (isler.length) l.push(`• ${gunMetni(y, m, d)}: ${isler.join(", ")}`);
  });
  const ozet = [say.n && `${say.n} nöbet`, say.a && `${say.a} acil nöbeti`, say.h && `${say.h} hazırlama`, say.o && `${say.o} öğlen nöbeti`].filter(Boolean).join(", ");
  return [`*${AYLAR[m]} ${y} · ${kisi.name}*`, ...(l.length ? l : ["Bu ay görev yok."]), ...(ozet ? ["", "Toplam: " + ozet] : [])].join("\n");
}
