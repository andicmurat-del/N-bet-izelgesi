// Bir ayın çizelgesinin özet ölçütleri: ayar değişikliğinin etkisini karşılaştırmak için (Ayarlar > ayar önizlemesi).
import { aktifGunMu, eczaneHazirlamacisi, eczaneNobetcisi, type Baglam, type MotorGunu } from "./baglam";
import { fmFarkBilgisi, fmKuralKisileri } from "./istatistik";
import { uyariSiniflandir } from "./raporlar";
import { CUMA, CUMARTESI, haftaGunu, PERSEMBE } from "./takvim";

export interface CizelgeOlcutleri {
  /** uyarı (bilgi notları hariç) ve kırmızı (kuralı esnetilmiş) gün sayısı */
  uyari: number;
  kirmizi: number;
  /** ayın tamamında çalışanlar arasında fazla mesai farkı (saat) ve nöbet sayısı farkı */
  fmFark: number;
  nobetFark: number;
  /** kişi başı boş hafta sonu (Cumartesi + Pazar ikisinde de görev yok) toplamı ve olası toplam: o hafta sonu çalışan herkes
   *  (eczacı, tekniker, kemoterapi eczacısı, destek personeli; ay içinde başlayan / ayrılan dahil) */
  bosHaftaSonu: number;
  haftaSonuToplam: number;
  /** Cuma nöbetçisine aynı hafta Pazar nöbeti / hazırlaması; Perşembe nöbetçisine aynı hafta sonu nöbet */
  cumaPazar: number;
  persembeHaftaSonu: number;
  /** iki nöbeti arasında ayardaki en az günden az olan */
  kisaAra: number;
}

export function cizelgeOlcutleri(B: Baglam, y: number, m: number, sonuc: { days: MotorGunu[]; warnings: string[] }): CizelgeOlcutleri {
  const days = sonuc.days;
  const kisiler = fmKuralKisileri(B, y, m);
  // hafta sonu görevi alabilenler: eczane nöbetçileri, hazırlamacılar ve destek personeli
  const hsKadro = B.staff.filter(s => eczaneNobetcisi(s) || eczaneHazirlamacisi(s) || s.role === "destek");
  const nobetSay: Record<number, number> = {};
  kisiler.forEach(k => (nobetSay[k.id] = 0));
  days.forEach(d => d.assigned.forEach(p => p.id in nobetSay && nobetSay[p.id]++));
  const ns = Object.values(nobetSay);
  const gorevli = (i: number, id: number, hazDahil = true) =>
    !!days[i] && (days[i].assigned.some(p => p.id === id) || (hazDahil && (days[i].prep ?? []).some(p => p.id === id)));
  let bos = 0,
    toplam = 0,
    cumaPazar = 0,
    persembe = 0,
    kisaAra = 0;
  const minAra = B.sayi("minAra");
  days.forEach((d, i) => {
    const dw = haftaGunu(y, m, d.day);
    if (dw === CUMARTESI && i + 1 < days.length)
      for (const s of hsKadro) {
        if (!aktifGunMu(s, y, m, d.day) && !aktifGunMu(s, y, m, days[i + 1].day)) continue;
        toplam++;
        if (!gorevli(i, s.id) && !gorevli(i + 1, s.id)) bos++;
      }
    if (dw === CUMA) for (const p of d.assigned) if (gorevli(i + 2, p.id)) cumaPazar++;
    if (dw === PERSEMBE) for (const p of d.assigned) if (gorevli(i + 2, p.id, false) || gorevli(i + 3, p.id, false)) persembe++;
    for (const p of d.assigned) for (let k = 2; k < minAra; k++) if (days[i + k]?.assigned.some(q => q.id === p.id)) kisaAra++;
  });
  return {
    uyari: sonuc.warnings.filter(w => uyariSiniflandir(w).seviye !== "bilgi").length,
    kirmizi: days.filter(d => d.conflict).length,
    fmFark: fmFarkBilgisi(B, y, m, days).fark,
    nobetFark: ns.length ? Math.max(...ns) - Math.min(...ns) : 0,
    bosHaftaSonu: bos,
    haftaSonuToplam: toplam,
    cumaPazar,
    persembeHaftaSonu: persembe,
    kisaAra,
  };
}
/** iki çizelge arasında görevlileri (nöbet ya da hazırlama) değişen gün sayısı */
export function degisenGunSayisi(a: MotorGunu[], b: MotorGunu[]): number {
  const k = (d?: MotorGunu) =>
    d ? JSON.stringify([d.assigned.map(p => p.id).sort((x, z) => x - z), (d.prep ?? []).map(p => p.id).sort((x, z) => x - z)]) : "";
  return Math.max(a.length, b.length) ? a.filter((d, i) => k(d) !== k(b[i])).length : 0;
}
