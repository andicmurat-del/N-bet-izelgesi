// Aramada her hamlede korunan kesin kurallar: izinli yok, komşu günde nöbet/hazırlama yok, günde en az 1 eczacı,
// 5 gün içinde 3 nöbet yok, Perşembe nöbetçisine aynı hafta sonu hazırlama yok, art arda iki gün hazırlama yok.
import type { Gorevli } from "../../veri/tipler";
import { eczaciMi } from "../baglam";
import { CUMARTESI, gunKaydir, PAZAR, PERSEMBE } from "../takvim";
import type { AramaKurulumu } from "./kurulum";
import { ucluSikisik } from "./sinir";

export type Kurallar = ReturnType<typeof kurallarKur>;

export function kurallarKur(K: AramaKurulumu) {
  const { B, y, m, days, A, yasakGun, zorunluGun, gunDow } = K;
  const { sinir, sonGunEngel } = A;
  const thuHaftaSonu = K.ayar.thuHaftaSonu;

  /** o gün kişiye görev yazılamaz (izin, eş durumu yok, çalışma dönemi dışı…) */
  function yasak(id: number, i: number): boolean { const v = yasakGun[i][id]; return v === undefined ? B.kesinYasak(id, y, m, days[i].day) : v; }
  /** eş durumu: kişi o gün kesin nöbetçi yazılmalı */
  function zorunluMu(id: number, i: number): boolean { return zorunluGun[i].indexOf(id) >= 0; }
  function gundeVar(i: number, id: number): boolean { const l = days[i].assigned; for (let q = 0; q < l.length; q++) if (l[q].id === id) return true; return false; }
  /** hazırlama personeli yazılacak gün: Cumartesi, Pazar veya işaretli resmi tatil */
  function tatilGunu(idx: number): boolean { return !!days[idx].tatil; }

  /** nöbetçi yazılacak kişi komşu günlerde nöbetçi, komşu günlerde ya da aynı gün hazırlama personeli olamaz */
  function komsuda(id: number, idx: number): boolean {
    for (let k = idx - 1; k <= idx + 1; k++) {
      if (k < 0 || k >= days.length) continue;
      if (k !== idx && days[k].assigned.some(p => p.id === id)) return true;
      if (days[k].prep && days[k].prep.some(pp => pp.id === id)) return true;
    }
    if (idx === 0 && (sinir.oncekiSonN.indexOf(id) >= 0 || sinir.oncekiSonH.indexOf(id) >= 0)) return true;
    if (idx === days.length - 1 && (sinir.sonrakiIlkN.indexOf(id) >= 0 || sinir.sonrakiIlkH.indexOf(id) >= 0)) return true;
    return false;
  }
  /** hazırlama personeli aynı gün ve önceki/sonraki gün nöbetçi olamaz */
  function prepKomsu(id: number, idx: number): boolean {
    for (let k = idx - 1; k <= idx + 1; k++) {
      if (k < 0 || k >= days.length) continue;
      if (days[k].assigned.some(p => p.id === id)) return true;
    }
    if (idx === 0 && sinir.oncekiSonN.indexOf(id) >= 0) return true;
    if (idx === days.length - 1 && sinir.sonrakiIlkN.indexOf(id) >= 0) return true;
    return false;
  }
  /** aynı kişiye art arda iki gün hazırlama yazılmaz (Cumartesi + Pazar, ya da bitişik tatil günleri; ay sınırı dahil) */
  function prepBitisik(id: number, idx: number): boolean {
    if (idx - 1 >= 0 && (days[idx - 1].prep || []).some(pp => pp.id === id)) return true;
    if (idx + 1 < days.length && (days[idx + 1].prep || []).some(pp => pp.id === id)) return true;
    if (idx === 0 && sinir.oncekiSonH.indexOf(id) >= 0) return true;
    if (idx === days.length - 1 && sinir.sonrakiIlkH.indexOf(id) >= 0) return true;
    return false;
  }
  /** hafta sonu günü (idx) için: kişi aynı haftanın Perşembe günü nöbetçi mi (Perşembe önceki aydaysa o ayın çizelgesine bakılır) */
  function persembeNobetliMi(id: number, idx: number): boolean {
    const dw = gunDow[idx]; if (!thuHaftaSonu || (dw !== CUMARTESI && dw !== PAZAR)) return false;
    const k = dw === CUMARTESI ? 2 : 3, t = idx - k;
    if (t >= 0) return days[t].assigned.some(p => p.id === id);
    const [a, b, c] = gunKaydir(y, m, days[idx].day, -k), sc = B.cizelge(a, b);
    return !!(sc && sc.days && sc.days[c - 1] && (sc.days[c - 1].assigned || []).some(p => p.id === id));
  }
  /** Perşembe günü (idx) nöbetçi yazılacak kişinin aynı hafta sonu hazırlaması var mı */
  function hsHazirligiVarMi(id: number, idx: number): boolean {
    if (!thuHaftaSonu || gunDow[idx] !== PERSEMBE) return false;
    for (const k of [2, 3]) { const t = idx + k; if (t < days.length && (days[t].prep || []).some(pp => pp.id === id)) return true; }
    return false;
  }
  function prepUygun(id: number, idx: number): boolean {
    return !yasak(id, idx) && !prepKomsu(id, idx) && !persembeNobetliMi(id, idx) && !prepBitisik(id, idx);
  }
  /** dışarıdan nöbete gelen iki eczacı aynı gün birlikte nöbetçi olmaz (ikisi de eş durumu zorunluluğuysa hariç) */
  function ikiDisaridan(as: Gorevli[], idx: number): boolean { const d = as.filter(p => p.role === "nobetci"); return d.length > 1 && !d.every(p => zorunluMu(p.id, idx)); }
  /** günün nöbetçileri kesin kurallara uyuyor mu */
  function gunGecerli(idx: number): boolean {
    const dy = days[idx];
    if (!dy.assigned.some(p => eczaciMi(p.role))) return false;
    if (ikiDisaridan(dy.assigned, idx)) return false;
    return dy.assigned.every(p => {
      if (yasak(p.id, idx)) return false;
      if (zorunluMu(p.id, idx)) return true;
      return !sonGunEngel(p.id, dy.day) && !komsuda(p.id, idx) && !hsHazirligiVarMi(p.id, idx) && !ucluSikisik(days, sinir, p.id, idx);
    });
  }

  return { yasak, zorunluMu, gundeVar, tatilGunu, komsuda, prepKomsu, prepBitisik, persembeNobetliMi, hsHazirligiVarMi, prepUygun, ikiDisaridan, gunGecerli };
}
