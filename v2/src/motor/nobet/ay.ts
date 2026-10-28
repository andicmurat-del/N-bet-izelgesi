// Bir ayın çizelgesi oluşturulurken bütün adımların ortak girdisi: kadro, yıllık devirler, ay sınırı, kişi sırası.
import { aktifAydaMi, eczaciMi, type Baglam, type MotorGunu } from "../baglam";
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
  const sira = kisiSirasi(B.staff, varyasyon);
  return {
    B, y, m, dim: ayGunSayisi(y, m), eczacilar, teknisyenler, taslak, devir, sira, varyasyon,
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
