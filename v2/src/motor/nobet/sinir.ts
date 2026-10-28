// Ay sınırı ve dinlenme kuralları: önceki ayın son günleri ile sonraki ayın 1. günündeki görevliler, 5 gün içinde
// 3 nöbet kuralı, ayrılan personelin son günü. Hem ilk yerleştirmede hem aramada kullanılır.
import type { Baglam, MotorGunu } from "../baglam";
import { gunKaydir, isoNo, oncekiAy, sonrakiAy, tarihNo, ayGunSayisi } from "../takvim";

export interface AySiniri {
  /** k gün önceki (önceki ayın son 4 günü) gerçek nöbetçiler: 5 gün içinde 3 nöbet kuralı ay sınırında da geçerli */
  oncekiSonGunler: Record<number, number[]>;
  oncekiSonN: number[]; oncekiSonH: number[];
  sonrakiIlkN: number[]; sonrakiIlkH: number[];
}

/** ay sınırı dinlenme kuralları gerçekte çalışılana göre (puantajdaki nöbet değişimleri dahil) */
export function aySiniri(B: Baglam, y: number, m: number): AySiniri {
  const o = oncekiAy(y, m), s = sonrakiAy(y, m);
  const oS = B.cizelge(o.y, o.m), sS = B.cizelge(s.y, s.m);
  const oSon = oS && oS.days && oS.days.length ? oS.days[oS.days.length - 1] : null;
  const sIlk = sS && sS.days && sS.days.length ? sS.days[0] : null;
  const oncekiSonGunler: Record<number, number[]> = {};
  for (let k = 1; k <= 4; k++) { const [a, b, c] = gunKaydir(y, m, 1, -k); oncekiSonGunler[k] = B.gercekGorev(a, b, c).N; }
  const oG = oSon ? B.gercekGorev(o.y, o.m, oSon.day) : { N: [], H: [] }, sG = sIlk ? B.gercekGorev(s.y, s.m, 1) : { N: [], H: [] };
  return { oncekiSonGunler, oncekiSonN: oG.N, oncekiSonH: oG.H, sonrakiIlkN: sG.N, sonrakiIlkH: sG.H };
}

/** j. gün (0'dan; eksi ise önceki ay) kişi nöbetçi mi. days ilk yerleştirmede henüz yarımdır. */
function nobetVarIdx(days: MotorGunu[], sinir: AySiniri, id: number, j: number): boolean {
  if (j >= 0) return j < days.length && !!days[j] && days[j].assigned.some(p => p.id === id);
  return (sinir.oncekiSonGunler[-j] || []).indexOf(id) >= 0;
}
/** aynı kişiye 5 gün içinde 3 nöbet yazılmaz (ör. Pazartesi–Çarşamba–Cuma); 2 gün arayla tek bir tekrar olabilir */
export function ucluSikisik(days: MotorGunu[], sinir: AySiniri, id: number, idx: number): boolean {
  const v = (k: number) => nobetVarIdx(days, sinir, id, idx + k);
  return (v(-2) && v(-4)) || (v(-2) && v(2)) || (v(2) && v(4));
}

/** Ayrılan personelin son çalışma günü: ertesi gün mesai günüyse nöbet izni kullanamaz, nöbet yazılmaz */
export function sonGunEngeli(B: Baglam, y: number, m: number): (id: number, d: number) => boolean {
  const dim = ayGunSayisi(y, m), engel: Record<string, true> = {};
  B.staff.forEach(s => {
    if (!s.bitis) return;
    const b = isoNo(s.bitis);
    for (let d = 1; d <= dim; d++) {
      if (tarihNo(y, m, d) !== b) continue;
      const sa = sonrakiAy(y, m);
      const ertesiMs = d < dim ? B.mesaiSaati(y, m, d + 1) : B.mesaiSaati(sa.y, sa.m, 1);
      if (ertesiMs > 0) engel[s.id + "-" + d] = true;
    }
  });
  // çoğu ay boştur: aramada anahtar oluşturmaya gerek kalmaz
  if (Object.keys(engel).length === 0) return () => false;
  return (id, d) => !!engel[id + "-" + d];
}
