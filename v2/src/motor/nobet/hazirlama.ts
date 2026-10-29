// 2. adım: tatil günlerinin hazırlama personeli (8 saat). Nöbetçiler belli olduktan sonra yazılır: önce her teknikere 1,
// sonra eczacılara; eşitlikte toplam fazla mesaisi en az olana. Destek personeli 2. yere, en zor günlerden başlayarak.
import { eczaciMi, gorevli } from "../baglam";
import type { Kisi } from "../../veri/tipler";
import { HAZ_SAYISI } from "../sabitler";
import { CUMA, CUMARTESI, PAZAR } from "../takvim";
import type { Kurallar } from "./kurallar";
import type { AramaKurulumu } from "./kurulum";

export function hazirlamaAta(K: AramaKurulumu, kural: Kurallar): void {
  const { A, days, tumHavuz, destekler, destekVar, DESTEK_AYLIK, prepAday, gunDow, oncekiAyCuma, prefGun, resmiGunDizi, HAZ_SAAT } = K;
  const { devir, resmiDv, sira } = A;
  const { prepUygun, yasak, prepKomsu, persembeNobetliMi, tatilGunu } = kural;

  const fmTop: Record<number, number> = {}, prpCnt: Record<number, number> = {}, rhCnt: Record<number, number> = {};
  tumHavuz.forEach(s => { fmTop[s.id] = devir.off[s.id] || 0; prpCnt[s.id] = 0; });
  const prpAg = (id: number) => prpCnt[id] + (devir.prepOff[id] || 0);
  days.forEach(dy => {
    dy.assigned.forEach(p => { if (fmTop[p.id] !== undefined) fmTop[p.id] += dy.fazlaMesai; });
    (dy.prep || []).forEach(pp => { if (fmTop[pp.id] !== undefined) { fmTop[pp.id] += HAZ_SAAT; prpCnt[pp.id]++; } });
  });

  // Cuma + Cumartesi + Pazar nöbeti olan kişi kendi grubunda (eczacı / tekniker) hazırlamayı en son alır
  const ucluNobet = new Set<number>();
  prepAday.forEach(s => {
    let cu = 0, ct = 0, pz = 0;
    days.forEach((dy, i) => {
      if (!dy.assigned.some(p => p.id === s.id)) return;
      if (gunDow[i] === CUMA) cu++; else if (gunDow[i] === CUMARTESI) ct++; else if (gunDow[i] === PAZAR) pz++;
    });
    if (cu && ct && pz) ucluNobet.add(s.id);
  });

  // bir güne (i) bir hazırlama yeri için kişi seç ve yaz; destekMi: yalnız destek personelinden seç
  function yerAta(i: number, slot: number, destekMi: boolean): boolean {
    const secilmis = days[i].prep.map(pp => pp.id);
    // Cuma nöbeti tutana aynı hafta Pazar hazırlaması yazılmasın
    const cuPz = (s: Kisi) => (gunDow[i] === PAZAR && ((i - 2 >= 0 && days[i - 2].assigned.some(p => p.id === s.id)) || (oncekiAyCuma[i] && oncekiAyCuma[i]!.has(s.id))) ? 1 : 0);
    // istenmeyen: "istemiyor" işareti, Cuma-Pazar, ayda 2. ve 3. hazırlama
    const ist = (s: Kisi) => (prefGun[i][s.id] === "avoid" ? 1 : 0) + 2 * cuPz(s) + (s.role !== "destek" && prpCnt[s.id] >= 2 ? 8 : 0) + (s.role !== "destek" && prpCnt[s.id] === 1 ? 4 : 0);
    const rH = (s: Kisi) => (resmiGunDizi[i] ? (resmiDv.offH[s.id] || 0) + (rhCnt[s.id] || 0) : 0);
    let adaylar: Kisi[];
    if (destekMi) {
      adaylar = destekler.filter(s => !secilmis.includes(s.id) && prepUygun(s.id, i) && prpCnt[s.id] < DESTEK_AYLIK)
        .sort((a, b) => (ist(a) - ist(b)) || (rH(a) - rH(b)) || (prpAg(a.id) - prpAg(b.id)) || sira[a.id] - sira[b.id]);
      if (!adaylar.length) return false;
    } else {
      // sıra: önce her teknikere 1, sonra eczacılara; yeni tur yine teknikerden. Grubun içinde Cuma + Cumartesi + Pazar
      // nöbeti olan en sona
      const tur = (s: Kisi) => prpCnt[s.id] * 4 + (eczaciMi(s.role) ? 2 : 0) + (ucluNobet.has(s.id) ? 1 : 0);
      adaylar = prepAday.filter(s => !secilmis.includes(s.id) && prepUygun(s.id, i))
        .sort((a, b) => (tur(a) - tur(b)) || (ist(a) - ist(b)) || (rH(a) - rH(b)) || fmTop[a.id] - fmTop[b.id] || prpAg(a.id) - prpAg(b.id) || sira[a.id] - sira[b.id]);
      if (!adaylar.length) {
        // başka kimse uygun değilse (yer boş kalmasın): art arda hazırlama kuralı esnetilir, gün uyarılı görünür
        adaylar = (slot === 1 && destekVar ? prepAday.concat(destekler) : prepAday)
          .filter(s => !secilmis.includes(s.id) && !yasak(s.id, i) && !prepKomsu(s.id, i) && !persembeNobetliMi(s.id, i) && !(s.role === "destek" && prpCnt[s.id] >= DESTEK_AYLIK))
          .sort((a, b) => (ist(a) - ist(b)) || (rH(a) - rH(b)) || fmTop[a.id] - fmTop[b.id] || prpAg(a.id) - prpAg(b.id) || sira[a.id] - sira[b.id]);
      }
      if (!adaylar.length) return false;
    }
    const sec = adaylar[0];
    days[i].prep.push(gorevli(sec)); fmTop[sec.id] += HAZ_SAAT; prpCnt[sec.id]++;
    if (resmiGunDizi[i]) rhCnt[sec.id] = (rhCnt[sec.id] || 0) + 1;
    return true;
  }

  const hzGunler: number[] = [];
  for (let i = 0; i < days.length; i++) if (!days[i].locked && tatilGunu(i)) hzGunler.push(i);
  // 1. geçiş: her tatil gününün 1. hazırlamacısı (eczacı / tekniker)
  hzGunler.forEach(i => { if (days[i].prep.length < 1) yerAta(i, 0, false); });
  // 2. geçiş: destek personeli, eczacı/tekniker için 2. yeri doldurmanın en zor olduğu günlere
  //    (uygun ve o ay henüz hazırlama almamış, tercihi engel olmayan kişi sayısı en az olan günler önce)
  if (destekVar) {
    const kolaylik = (i: number) => {
      const secilmis = days[i].prep.map(pp => pp.id);
      return prepAday.filter(s => !secilmis.includes(s.id) && prepUygun(s.id, i) && prpCnt[s.id] === 0 && prefGun[i][s.id] !== "avoid").length;
    };
    const sirali = hzGunler.filter(i => days[i].prep.length === 1).map(i => ({ i, k: kolaylik(i) })).sort((a, b) => a.k - b.k || a.i - b.i);
    sirali.forEach(({ i }) => { if (days[i].prep.length === 1) yerAta(i, 1, true); });
  }
  // 3. geçiş: kalan 2. yerler eczacı / teknikerle
  hzGunler.forEach(i => { while (days[i].prep.length < HAZ_SAYISI) { if (!yerAta(i, days[i].prep.length, false)) break; } });
}
