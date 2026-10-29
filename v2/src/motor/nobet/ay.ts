// Bir ayın çizelgesi oluşturulurken bütün adımların ortak girdisi: kadro, yıllık devirler, ay sınırı, kişi sırası.
import { aktifAydaMi, aktifGunMu, eczaciMi, type Baglam, type MotorGunu } from "../baglam";
import { cmtDevir, cuDevir, devirHesapla, hsDevir, nobetDevir, pazDevir, peDevir, resmiDevir, type AyDevri, type Fark } from "../devir";
import type { Kisi } from "../../veri/tipler";
import { ayGunSayisi } from "../takvim";
import { aySiniri, sonGunEngeli, type AySiniri } from "./sinir";

export interface AyBilgisi {
  B: Baglam; y: number; m: number; dim: number;
  eczacilar: Kisi[]; teknisyenler: Kisi[];
  /** ayın kayıtlı taslağı (elle kilitlenmiş günler) ya da boş günler */
  taslak: MotorGunu[];
  devir: AyDevri;
  resmiDv: ReturnType<typeof resmiDevir>;
  /** önceki aylardan Cumartesi+Pazar, Cuma, Perşembe, Cumartesi, Pazar ve nöbet sayısı devirleri */
  hsDv: Fark; cuDv: Fark; peDv: Fark; cmtDv: Fark; pazDv: Fark; nDv: Fark;
  sinir: AySiniri;
  sonGunEngel: (id: number, d: number) => boolean;
  /** eşit durumlarda kişi sırası ("farklı dağılım" bu sırayı karıştırır) */
  sira: Record<number, number>;
  varyasyon: number;
  /** gün gün (0'dan) eş durumu "istiyor" istekleri: yazılacaklar ve birlikte yazılamadığı için düşenler */
  esDurumu: EsDurumu[];
}

export interface EsDurumu { secilen: Kisi[]; dusen: Kisi[] }

/** yıl içinde (önceki aylarda) kişinin eş durumu isteğinin karşılandığı gün sayısı */
export function esKarsilanan(B: Baglam, y: number, m: number): Record<number, number> {
  const k: Record<number, number> = {};
  for (let mm = 0; mm < m; mm++) {
    const sc = B.dengeCizelgesi(y, mm);
    if (sc && sc.days) sc.days.forEach(g => (g.assigned || []).forEach(p => { if (B.tercih(p.id, y, mm, g.day) === "esVar") k[p.id] = (k[p.id] || 0) + 1; }));
  }
  return k;
}

/** Bir günün eş durumu istekleri. Hepsi birlikte yazılamıyorsa (günde 2 nöbetçi, en az 1 eczacı) yıl içinde eş durumu isteği
 *  daha az karşılanan seçilir, diğerine uyarı verilir: ör. iki tekniker aynı gün isterse biri yazılır, öbür yer eczacının. */
export function esDurumuSec(B: Baglam, y: number, m: number, d: number, kadro: Kisi[], karsilanan: Record<number, number>): EsDurumu {
  const istek = kadro.filter(s => B.tercih(s.id, y, m, d) === "esVar" && aktifGunMu(s, y, m, d));
  if (istek.length <= 1) return { secilen: istek, dusen: [] };
  const sirali = istek.slice().sort((a, b) => (karsilanan[a.id] || 0) - (karsilanan[b.id] || 0) || a.id - b.id);
  const ilkEcz = sirali.find(s => eczaciMi(s.role)), secilen: Kisi[] = ilkEcz ? [ilkEcz] : [];
  for (const s of sirali) {
    if (secilen.length >= 2 || (!ilkEcz && secilen.length === 1)) break;   // eczacı yoksa ikinci yer eczacıya kalır
    if (!secilen.includes(s)) secilen.push(s);
  }
  return { secilen, dusen: istek.filter(s => !secilen.includes(s)) };
}

/** eski ensureScheduleDraft'ın karşılığı: ayın kayıtlı taslağı varsa (elle kilitlenmiş günler) o, yoksa boş günler */
function taslakGunler(B: Baglam, y: number, m: number): MotorGunu[] {
  const dim = ayGunSayisi(y, m), kayitli = B.cizelge(y, m);
  if (kayitli && Array.isArray(kayitli.days) && kayitli.days.length) {
    kayitli.days.forEach(d => { d.fazlaMesai = B.fazlaMesai(y, m, d.day, dim); });
    return kayitli.days;
  }
  const days: MotorGunu[] = [];
  for (let d = 1; d <= dim; d++) days.push({ day: d, tatil: B.tatilMi(y, m, d), conflict: false, fazlaMesai: B.fazlaMesai(y, m, d, dim), assigned: [], prep: [], locked: false });
  return days;
}

/** "farklı şekilde oluştur": eşit durumlarda kişi sırası ve arama tohumu değişir */
function kisiSirasi(staff: Kisi[], varyasyon: number): Record<number, number> {
  const ids = staff.map(s => s.id);
  if (varyasyon > 0) {
    let t = (varyasyon * 2654435761) >>> 0;
    const r = () => { t = (t * 1664525 + 1013904223) >>> 0; return t / 4294967296; };
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const tmp = ids[i]; ids[i] = ids[j]; ids[j] = tmp; }
  }
  const sira: Record<number, number> = {};
  ids.forEach((id, ix) => { sira[id] = ix; });
  return sira;
}

export function ayBilgisi(B: Baglam, y: number, m: number, varyasyon: number, eczacilar: Kisi[], teknisyenler: Kisi[]): AyBilgisi {
  const taslak = taslakGunler(B, y, m);
  const devir = devirHesapla(B, y, m);
  const sira = kisiSirasi(B.staff, varyasyon), dim = ayGunSayisi(y, m);
  const karsilanan = esKarsilanan(B, y, m), kadro = eczacilar.concat(teknisyenler), esDurumu: EsDurumu[] = [];
  for (let d = 1; d <= dim; d++) esDurumu.push(esDurumuSec(B, y, m, d, kadro, karsilanan));
  return {
    B, y, m, dim, eczacilar, teknisyenler, taslak, devir, sira, varyasyon, esDurumu,
    resmiDv: resmiDevir(B, y, m), hsDv: hsDevir(B, y, m), cuDv: cuDevir(B, y, m), peDv: peDevir(B, y, m),
    cmtDv: cmtDevir(B, y, m), pazDv: pazDevir(B, y, m), nDv: nobetDevir(B, y, m),
    sinir: aySiniri(B, y, m), sonGunEngel: sonGunEngeli(B, y, m),
  };
}

/** ayda çalışan eczacılar (dışarıdan gelen eczacı dahil) ve teknikerler */
export function nobetKadrosu(B: Baglam, y: number, m: number) {
  return {
    eczacilar: B.staff.filter(s => eczaciMi(s.role) && aktifAydaMi(s, y, m)),
    teknisyenler: B.staff.filter(s => s.role === "teknisyen" && aktifAydaMi(s, y, m)),
  };
}
