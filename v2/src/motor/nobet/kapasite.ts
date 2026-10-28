// Kadro bu ay kesin kurallara yetiyor mu. Kuralların izin verdiği en çok görev, gerekenden azsa kurallara tam uyan
// çizelge matematiksel olarak mümkün değildir; kullanıcıya nedeniyle birlikte söylenir. Hesap bir üst sınırdır (ay
// sınırı, Perşembe kuralı, dışarıdan gelen eczacı kuralı yok sayılır): "yetmiyor" denirse kesin yetmez, ama her
// yetmeyen durum yakalanmaz.
import { eczaciMi } from "../baglam";
import { HAZ_SAYISI } from "../sabitler";
import { AYLAR } from "../takvim";
import type { AramaKurulumu } from "./kurulum";

/** Kişinin müsait günlerinde (av) kurallara uyan en çok görev sayısı: görevler bitişik günlere düşmez, nöbetlerde
 *  5 günde 3 nöbet (x, x+2, x+4) olmaz. hazirlamaDa: tatil günlerinde hazırlama da sayılır. */
export function enCokGorev(av: boolean[], tatil: boolean[], hazirlamaDa: boolean): number {
  // durum: son 4 günün görevi, 2'şer bit (en düşük bitler dün): 0 boş, 1 nöbet, 2 hazırlama
  let dp = new Map<number, number>([[0, 0]]);
  for (let d = 0; d < av.length; d++) {
    const yeni = new Map<number, number>();
    for (const [s, v] of dp) {
      const secenek = [0];
      if (av[d] && (s & 3) === 0) {
        if (!(((s >> 2) & 3) === 1 && ((s >> 6) & 3) === 1)) secenek.push(1);
        if (hazirlamaDa && tatil[d]) secenek.push(2);
      }
      for (const t of secenek) {
        const ns = ((s << 2) | t) & 0xff, nv = v + (t ? 1 : 0);
        if ((yeni.get(ns) ?? -1) < nv) yeni.set(ns, nv);
      }
    }
    dp = yeni;
  }
  let en = 0;
  for (const v of dp.values()) if (v > en) en = v;
  return en;
}

/** Kadronun bu ay kesin kurallara yetmediğini gösteren nedenler (boşsa yetmediği kanıtlanamadı) */
export function kadroYetersizlikNedenleri(K: AramaKurulumu): string[] {
  const { m, days, staffList, destekler, DESTEK_AYLIK, yasakGun, zorunluGun } = K;
  const n = days.length, acik = days.map(d => !d.locked), tatil = days.map((d, i) => acik[i] && !!d.tatil);
  const musait = (id: number, i: number) => acik[i] && !yasakGun[i][id];
  const av = (id: number) => days.map((_, i) => musait(id, i));
  const gunAdi = (i: number) => days[i].day + " " + AYLAR[m];
  const gunSay = acik.filter(Boolean).length, tatilSay = tatil.filter(Boolean).length;
  const eczacilar = staffList.filter(s => eczaciMi(s.role));
  const destekVarGun = (i: number) => DESTEK_AYLIK > 0 && destekler.some(s => musait(s.id, i));
  const neden: string[] = [];

  const eczacisiz: number[] = [], kisisiz: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!acik[i]) continue;
    if (!eczacilar.some(s => musait(s.id, i))) eczacisiz.push(i);
    if (staffList.filter(s => musait(s.id, i)).length < 2) kisisiz.push(i);
  }
  if (eczacisiz.length) neden.push(eczacisiz.map(gunAdi).join(", ") + " günlerinde nöbet tutabilecek eczacı yok");
  if (kisisiz.length) neden.push(kisisiz.map(gunAdi).join(", ") + " günlerinde nöbet tutabilecek 2 kişi yok");

  const eczNobet = eczacilar.reduce((t, s) => t + enCokGorev(av(s.id), tatil, false), 0);
  if (eczNobet < gunSay) neden.push("eczacılar dinlenme kurallarıyla bu ay en fazla " + eczNobet + " nöbet tutabilir, " + gunSay + " gün eczacı nöbeti gerekiyor");
  const nobet = staffList.reduce((t, s) => t + enCokGorev(av(s.id), tatil, false), 0);
  if (nobet < 2 * gunSay) neden.push("nöbetçi personel dinlenme kurallarıyla bu ay en fazla " + nobet + " nöbet tutabilir, " + 2 * gunSay + " nöbet gerekiyor");
  const gorev = staffList.reduce((t, s) => t + enCokGorev(av(s.id), tatil, true), 0)
    + destekler.reduce((t, s) => t + Math.min(DESTEK_AYLIK, tatil.filter((tt, i) => tt && musait(s.id, i)).length), 0);
  const gorevGerek = 2 * gunSay + HAZ_SAYISI * tatilSay;
  if (gorev < gorevGerek) neden.push("nöbet ve hazırlama birlikte en fazla " + gorev + " görev yapılabilir, " + gorevGerek + " görev gerekiyor");

  // tatil günü: 2 nöbetçi ve hazırlama personeli aynı gün farklı kişiler. Art arda iki tatil gününde (Cumartesi–Pazar)
  // iki günün nöbetçileri ve hazırlamacıları hep farklı kişilerdir (aynı kişi bitişik günlerde görev alamaz); destek
  // personeli günde en çok bir hazırlama yerini doldurur. Eş durumu olan günlerde bitişik gün kuralı esnediğinden atlanır.
  const tatilEksik: string[] = [];
  for (let i = 0; i < n; i++) {
    if (!tatil[i] || zorunluGun[i].length) continue;
    const ciftMi = i + 1 < n && tatil[i + 1] && !zorunluGun[i + 1].length;
    const gerek = ciftMi ? 4 + (HAZ_SAYISI - (destekVarGun(i) ? 1 : 0)) + (HAZ_SAYISI - (destekVarGun(i + 1) ? 1 : 0)) : 2 + HAZ_SAYISI - (destekVarGun(i) ? 1 : 0);
    const var_ = staffList.filter(s => musait(s.id, i) || (ciftMi && musait(s.id, i + 1))).length;
    if (var_ < gerek) tatilEksik.push((ciftMi ? days[i].day + "–" + gunAdi(i + 1) : gunAdi(i)) + " (" + gerek + " kişi gerekli, " + var_ + " müsait)");
  }
  if (tatilEksik.length) {
    neden.push("tatil gününde nöbetçiler ve hazırlama personeli ayrı kişilerdir; art arda iki tatil gününde (Cumartesi–Pazar) aynı kişi iki gün görev alamadığından iki günün görevlileri de ayrı kişiler olmalı. Yetmeyen günler: " + tatilEksik.join(", "));
  }
  return neden;
}
