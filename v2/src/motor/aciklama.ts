// "Neden bu kişi?": bir günün nöbetçileri ve hazırlamacıları için kimlerin yazılabileceği, ötekilerin neden
// yazılamadığı ve seçilenlerin öbür adaylarla karşılaştırması. Gerekçeler elle düzenleme denetiminden gelir
// (denetim.ts gunuDenetle): aday o güne yazılsaydı denetimin söyleyecekleri. Böylece açıklama kurallarla birebir aynıdır.
import type { Gorevli } from "../veri/tipler";
import { aktifGunMu, eczaneHazirlamacisi, eczaneNobetcisi, type Baglam, type MotorCizelgesi } from "./baglam";
import { gunuDenetle, type Bulgu } from "./denetim";
import { ayIstatistik } from "./istatistik";
import { CUMA, CUMARTESI, haftaGunu, PAZAR, PERSEMBE } from "./takvim";

/** yazili: o gün görevli; uygun: kurallara uyar; uyarili: yazılabilir ama uyarı çıkar; denge: o güne özgü engel yok ama
 *  tek başına bu değişiklik ayın eşitliğini (fazla mesai farkı) bozar, başka günler de değişmeli; yazilamaz: o güne özgü
 *  kesin kural engeli (izin, art arda nöbet, hafta sonu kuralı…) */
export type AdayDurumu = "yazili" | "uygun" | "uyarili" | "denge" | "yazilamaz";
export interface AdayAciklamasi {
  id: number;
  ad: string;
  rol: string;
  durum: AdayDurumu;
  /** o güne yazılsaydı: güne özgü kural dışı durumlar (yazılamaz) ya da uyarılar (uyarılı) */
  nedenler: string[];
  /** ayın eşitliğiyle ilgili sonuçlar (fazla mesai farkı, kişinin ortalamadan sapması) */
  denge: string[];
  /** bu ayki nöbet / hazırlama sayısı ve fazla mesai saati (çizelgeye göre) */
  ayNobet: number;
  ayHaz: number;
  ayFm: number;
  /** günün türünde (Perşembe, Cuma, Cumartesi, Pazar) bu yıl tutulan nöbet sayısı (bu ay dahil); hafta içinde null */
  yilGunTuru: number | null;
  /** bu aydaki önceki ve sonraki nöbete gün farkı */
  onceki: number | null;
  sonraki: number | null;
}
export interface GunAciklamasi {
  /** günün türü: "Cumartesi" gibi (yıllık sayının hangi gün için olduğu) */
  gunTuru: string | null;
  elle: boolean;
  nobet: AdayAciklamasi[];
  /** tatil gününde hazırlama adayları (değilse null) */
  hazirlama: AdayAciklamasi[] | null;
}

const SIRA: Record<AdayDurumu, number> = { yazili: 0, uygun: 1, uyarili: 2, denge: 3, yazilamaz: 4 };
/** ayın geneline ait eşitlik bulguları (tek günden değil, ayın dağılımından) */
const dengeMi = (t: string) => /fazla mesai farkı|: toplam [\d.,]+ saat, ortalama/.test(t);
const GUN_TURU: Record<number, string> = { [PERSEMBE]: "Perşembe", [CUMA]: "Cuma", [CUMARTESI]: "Cumartesi", [PAZAR]: "Pazar" };

export function gunAciklamasi(B: Baglam, sch: MotorCizelgesi, gun: number): GunAciklamasi {
  const y = sch.year,
    m = sch.month,
    g = sch.days[gun - 1];
  const dw = haftaGunu(y, m, gun);
  const gor = (id: number): Gorevli | null => {
    const k = B.kisi(id);
    return k ? { id: k.id, name: k.name, role: k.role } : null;
  };
  const ist = ayIstatistik(B, sch);
  // yıllık gün türü sayıları (yalnız Perşembe / Cuma / Cumartesi / Pazar)
  const yilSay: Record<number, number> = {};
  if (GUN_TURU[dw]) {
    const say = (gunler: { day: number; assigned: { id: number }[] }[], mm: number) =>
      gunler.forEach(d => {
        if (haftaGunu(y, mm, d.day) === dw) d.assigned.forEach(p => (yilSay[p.id] = (yilSay[p.id] ?? 0) + 1));
      });
    for (let mm = 0; mm < m; mm++) {
      const c = B.cizelge(y, mm);
      if (c?.days) say(c.days, mm);
    }
    say(sch.days, m);
  }
  const komsuNobet = (id: number, yon: 1 | -1): number | null => {
    for (let k = gun - 1 + yon; k >= 0 && k < sch.days.length; k += yon)
      if (sch.days[k].assigned.some(p => p.id === id)) return Math.abs(k - (gun - 1));
    return null;
  };
  const metinler = (l: Bulgu[]) => new Set(l.map(b => b.sev + "|" + b.t));
  const taban = metinler(gunuDenetle(B, sch, gun, g.assigned, g.prep));
  /** aday yerlerden birine yazılsaydı: en az kural dışı durumla yazılabildiği yer; yalnız o değişiklikle çıkan bulgular */
  function dene(liste: Gorevli[], aday: Gorevli, digeri: (l: Gorevli[]) => [Gorevli[], Gorevli[]]): Bulgu[] {
    let enIyi: Bulgu[] | null = null;
    const yerler = liste.length ? liste.map((_, i) => i) : [-1];
    for (const i of yerler) {
      const l = i < 0 ? [aday] : liste.map((p, j) => (j === i ? aday : p));
      const [nb, pr] = digeri(l);
      const yeni = gunuDenetle(B, sch, gun, nb, pr).filter(b => b.sev !== "bilgi" && !taban.has(b.sev + "|" + b.t));
      // önce güne özgü engeli en az olan yer, sonra eşitliği en az bozan
      const puan = (x: Bulgu[]) =>
        x.filter(b => b.sev === "hata" && !dengeMi(b.t)).length * 1000 + x.filter(b => b.sev === "hata").length * 100 + x.length;
      if (!enIyi || puan(yeni) < puan(enIyi)) enIyi = yeni;
    }
    return enIyi ?? [];
  }
  function aday(k: { id: number; name: string; role: string }, yazili: boolean, sonuc: Bulgu[] | null): AdayAciklamasi {
    const yerel = (sonuc ?? []).filter(b => !dengeMi(b.t)),
      denge = (sonuc ?? []).filter(b => dengeMi(b.t));
    const hata = yerel.filter(b => b.sev === "hata").map(b => b.t),
      uyari = yerel.filter(b => b.sev === "uyari").map(b => b.t),
      dengeHata = denge.some(b => b.sev === "hata");
    const s = ist[k.id];
    return {
      id: k.id,
      ad: k.name,
      rol: k.role,
      durum: yazili ? "yazili" : hata.length ? "yazilamaz" : dengeHata ? "denge" : uyari.length ? "uyarili" : "uygun",
      nedenler: hata.length ? hata : uyari,
      denge: denge.map(b => b.t),
      ayNobet: s?.nobet ?? 0,
      ayHaz: s?.prep ?? 0,
      ayFm: Math.round((s?.fm ?? 0) * 10) / 10,
      yilGunTuru: GUN_TURU[dw] ? (yilSay[k.id] ?? 0) : null,
      onceki: komsuNobet(k.id, -1),
      sonraki: komsuNobet(k.id, 1),
    };
  }
  const kadro = B.staff.filter(k => aktifGunMu(k, y, m, gun));
  const sirala = (l: AdayAciklamasi[]) => l.sort((a, b) => SIRA[a.durum] - SIRA[b.durum] || a.ad.localeCompare(b.ad, "tr"));

  const nobet = sirala(
    kadro.filter(eczaneNobetcisi).map(k =>
      g.assigned.some(p => p.id === k.id)
        ? aday(k, true, null)
        : aday(
            k,
            false,
            dene(g.assigned, gor(k.id)!, l => [l, g.prep]),
          ),
    ),
  );
  const hazirlama = g.tatil
    ? sirala(
        kadro
          .filter(k => eczaneHazirlamacisi(k) || k.role === "destek")
          .map(k =>
            g.prep.some(p => p.id === k.id)
              ? aday(k, true, null)
              : aday(
                  k,
                  false,
                  dene(g.prep, gor(k.id)!, l => [g.assigned, l]),
                ),
          ),
      )
    : null;
  return { gunTuru: GUN_TURU[dw] ?? null, elle: !!g.locked, nobet, hazirlama };
}
