import type { AyCizelgesi, Kisi } from "../veri/tipler";
import { ROL_AD } from "../veri/tipler";
import { AYLAR, GUN_UZUN, buyukAd, haftaGunu } from "../veri/tarih";
import { xlsxKitap, type Hucre, type Sayfa } from "./xlsx";
import { ayOzeti } from "../veri/depo.svelte";

/** Ayın çizelgesi: gün gün liste ve kişi başı özet (resmi çıktı: adlar büyük harf) */
export function cizelgeKitabi(c: AyCizelgesi, kisiler: Kisi[], kurum: string, resmiTatil: (d: number) => boolean): Blob {
  const y = c.year, m = c.month, baslik = `${kurum ? kurum + " · " : ""}${AYLAR[m]} ${y} nöbet çizelgesi`;
  const iki = (n: number) => String(n).padStart(2, "0");
  const gunler: Hucre[][] = [
    [{ v: baslik, s: "kalin" }],
    [],
    ["Tarih", "Gün", "Gün türü", "Nöbetçi 1", "Nöbetçi 2", "Hazırlama 1", "Hazırlama 2", "Fazla mesai (sa)"].map(v => ({ v, s: "baslik" as const })),
  ];
  for (const g of c.days) {
    const tatil = g.tatil, s = tatil ? "tatil" as const : undefined;
    const tur = resmiTatil(g.day) ? "Resmi tatil" : tatil ? "Hafta sonu" : "Mesai";
    const ec = [...g.assigned].sort((a, b) => Number(b.role === "eczaci" || b.role === "nobetci") - Number(a.role === "eczaci" || a.role === "nobetci"));
    gunler.push([
      `${iki(g.day)}.${iki(m + 1)}.${y}`, GUN_UZUN[haftaGunu(y, m, g.day)], tur,
      buyukAd(ec[0]?.name ?? ""), buyukAd(ec[1]?.name ?? ""), buyukAd(g.prep[0]?.name ?? ""), buyukAd(g.prep[1]?.name ?? ""), g.fazlaMesai,
    ].map(v => (s ? { v, s } : v)));
  }
  const o = ayOzeti(c);
  const sayac = (id: number, w: number) => c.days.filter(g => haftaGunu(y, m, g.day) === w && g.assigned.some(p => p.id === id)).length;
  const ozet: Hucre[][] = [
    [{ v: baslik + " · kişi özeti", s: "kalin" }],
    [],
    ["Ad soyad", "Görev", "Nöbet", "Perşembe", "Cuma", "Cumartesi", "Pazar", "Hazırlama", "Fazla mesai (sa)"].map(v => ({ v, s: "baslik" as const })),
    ...kisiler.filter(k => o[k.id]).map(k => [
      buyukAd(k.name), ROL_AD[k.role], o[k.id].nobet, sayac(k.id, 3), sayac(k.id, 4), sayac(k.id, 5), sayac(k.id, 6), o[k.id].hazirlama, o[k.id].fazlaMesai,
    ]),
    [],
    [{ v: "Fazla mesai: nöbet saati eksi o günün ve ertesi günün normal mesaisi; hazırlama 8 saat.", s: "not" }],
  ];
  const sayfalar: Sayfa[] = [
    { ad: "Çizelge", satirlar: gunler, genislik: [12, 12, 12, 24, 24, 24, 24, 14], dondur: { satir: 3, sutun: 0 } },
    { ad: "Kişi özeti", satirlar: ozet, genislik: [26, 22, 9, 10, 9, 11, 9, 11, 14], dondur: { satir: 3, sutun: 1 } },
  ];
  return xlsxKitap(sayfalar);
}
