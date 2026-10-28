// Motorun bir çağrıdaki verisi: kayıtlı verinin kopyası (motor girdiyi hiç değiştirmez) ve bu veriyle cevaplanan
// sorular (o gün tatil mi, kişi izinli mi, ayarın değeri…). Eskiden her yerden erişilen tek bir ortak değişkendi;
// artık her hesap kendi Baglam'ıyla çalışır.
import type { Gorevli, Kisi } from "../veri/tipler";
import { AYAR_GIZLI, AYAR_VARSAYILAN, DURUM_KOD, IZIN_HAFTA_GUN, type AyarAdi } from "./sabitler";
import { ayAnahtari, ayGunSayisi, CUMA, gunAnahtari, gunKaydir, haftaGunu, haftaSonuMu, isoNo, sonrakiAy, tarihNo } from "./takvim";

/** Motorun okuduğu çizelge günü (kayıtlı verideki biçim) */
export interface MotorGunu {
  day: number;
  tatil: boolean;
  conflict: boolean;
  fazlaMesai: number;
  assigned: Gorevli[];
  prep: Gorevli[];
  locked: boolean;
}
export interface MotorCizelgesi { year: number; month: number; days: MotorGunu[]; [k: string]: unknown }
export type PuantajAyi = Record<string, Record<string, string>>;

type Nesne<T> = Record<string, T>;
const nesne = <T>(x: unknown): Nesne<T> => (x && typeof x === "object" && !Array.isArray(x) ? (x as Nesne<T>) : {});

export class Baglam {
  staff: Kisi[];
  prefs: Nesne<string>;
  manualTatil: Nesne<boolean>;
  arife: Nesne<boolean>;
  settings: Nesne<unknown>;
  schedules: Nesne<MotorCizelgesi>;
  puantaj: Nesne<PuantajAyi>;
  acil: Nesne<Nesne<number[]>>;
  servisKayit: Nesne<any>;

  /** veri kopyalanır: motorun yaptığı değişiklikler (taslak fazla mesai yenileme, varsayımsal puantaj) girdiye yansımaz */
  constructor(veri: unknown) {
    const v = JSON.parse(JSON.stringify(veri || {}));
    this.staff = Array.isArray(v.staff) ? v.staff : [];
    this.prefs = nesne(v.prefs); this.manualTatil = nesne(v.manualTatil); this.arife = nesne(v.arife);
    this.settings = nesne(v.settings); this.schedules = nesne(v.schedules); this.puantaj = nesne(v.puantaj); this.acil = nesne(v.acil);
    this.servisKayit = nesne(v.servisKayit);
  }

  // ---- ayarlar ----
  ayar<K extends AyarAdi>(k: K): (typeof AYAR_VARSAYILAN)[K] {
    if (AYAR_GIZLI.has(k)) return AYAR_VARSAYILAN[k];
    const v = this.settings[k];
    return (v === undefined || v === null ? AYAR_VARSAYILAN[k] : v) as (typeof AYAR_VARSAYILAN)[K];
  }
  /** sayısal ayar (çoğu kural için) */
  sayi(k: AyarAdi): number { return this.ayar(k) as number; }

  // ---- kişiler ----
  kisi(id: number): Kisi | undefined { return this.staff.find(x => x.id === id); }
  cizelge(y: number, m: number): MotorCizelgesi | undefined { return this.schedules[ayAnahtari(y, m)]; }

  // ---- takvim (veriye bağlı) ----
  /** takvimde elle işaretlenen resmi tatil (hafta içi ya da hafta sonu) */
  resmiTatilMi(y: number, m: number, d: number): boolean { return !!this.manualTatil[gunAnahtari(y, m, d)]; }
  tatilMi(y: number, m: number, d: number): boolean { return haftaSonuMu(y, m, d) || this.resmiTatilMi(y, m, d); }
  mesaiGunuMu(y: number, m: number, d: number): boolean { return !this.tatilMi(y, m, d); }
  /** Arife: takvimden elle işaretlenen hafta içi gün. Tatil sayılmaz; normal mesai yarım gündür (ayar: arifeSaat). */
  arifeMi(y: number, m: number, d: number): boolean { return !!this.arife[gunAnahtari(y, m, d)]; }
  /** o günün normal mesai saati: tatilde 0, arifede arifeSaat, diğer günlerde mesai */
  mesaiSaati(y: number, m: number, d: number): number {
    if (!this.mesaiGunuMu(y, m, d)) return 0;
    return this.arifeMi(y, m, d) ? this.sayi("arifeSaat") : this.sayi("mesai");
  }
  /** nöbet fazla mesaisi = nöbet süresi − o günün normal mesaisi − ertesi günün normal mesaisi (arife yarım gün) */
  fazlaMesai(y: number, m: number, d: number, dim: number): number {
    let ny = y, nm = m, nd = d + 1;
    if (d >= dim) { ({ y: ny, m: nm } = sonrakiAy(y, m)); nd = 1; }
    return Math.max(0, this.sayi("nobetSuresi") - this.mesaiSaati(y, m, d) - this.mesaiSaati(ny, nm, nd));
  }
  /** Cuma nöbeti (Cuma resmi tatil değilse): ertesi gün Cumartesi olduğundan 16 saat fazla mesai yazar
   *  (düşülecek nöbet izni yoktur). Puantajdaki "Cuma" sütunu bu sayıdır. */
  cumaTipiMi(y: number, m: number, d: number): boolean { return haftaGunu(y, m, d) === CUMA && !this.tatilMi(y, m, d); }

  // ---- tercihler ve izinler ----
  tercih(id: number, y: number, m: number, d: number): string | null { return this.prefs[id + "-" + y + "-" + m + "-" + d] || null; }
  /** İki izinli gün arasında kalan hafta sonu / resmi tatil günleri de izin sayılır: kişi tatildeyken araya nöbet
   *  ya da hazırlama yazılmaz (Cuma izinli + Pazartesi izinli → Cumartesi, Pazar da izin). */
  izinArasiMi(id: number, y: number, m: number, d: number): boolean {
    if (!this.tatilMi(y, m, d) || this.tercih(id, y, m, d) === "izinli") return false;
    const yon = (k: number) => {
      for (let j = 1; j <= 7; j++) {
        const [a, b, c] = gunKaydir(y, m, d, k * j);
        if (this.tercih(id, a, b, c) === "izinli") return true;
        if (!this.tatilMi(a, b, c)) return false;
      }
      return false;
    };
    return yon(-1) && yon(1);
  }
  izinliMi(id: number, y: number, m: number, d: number): boolean { return this.tercih(id, y, m, d) === "izinli" || this.izinArasiMi(id, y, m, d); }
  /** En az IZIN_HAFTA_GUN iş günü süren yıllık izin bloğunun hemen önündeki ve arkasındaki hafta sonu / tatil günleri:
   *  kişiye nöbet ya da hazırlama yazılmaz (bir haftalık izin, iki yanındaki hafta sonlarıyla birlikte kullanılır) */
  izinHaftasiKenariMi(id: number, y: number, m: number, d: number): boolean {
    if (!this.tatilMi(y, m, d) || this.tercih(id, y, m, d) === "izinli") return false;
    // k yönünde tatil günlerini geç, ilk mesai günü izinliyse o yönde izin bloğunun mesai günü sayısını say
    const blok = (k: number) => {
      let j = 1, a = 0, b = 0, c = 0;
      for (; j <= 10; j++) { [a, b, c] = gunKaydir(y, m, d, k * j); if (!this.tatilMi(a, b, c)) break; if (this.tercih(id, a, b, c) === "izinli") return 0; }
      if (j > 10 || this.tercih(id, a, b, c) !== "izinli") return 0;
      let n = 0;
      for (let t = 0; t < 40; t++, j++) {
        [a, b, c] = gunKaydir(y, m, d, k * j);
        const iz = this.tercih(id, a, b, c) === "izinli";
        if (!this.tatilMi(a, b, c)) { if (!iz) break; n++; }
      }
      return n;
    };
    return blok(1) >= IZIN_HAFTA_GUN || blok(-1) >= IZIN_HAFTA_GUN;
  }
  /** izinden önceki gün: ertesi gün izinli ise o gün nöbet yazılmaması tercih edilir (nöbet ertesi izni izne düşmesin) */
  izinOncesiMi(id: number, y: number, m: number, d: number): boolean {
    if (this.izinliMi(id, y, m, d)) return false;
    const [a, b, c] = gunKaydir(y, m, d, 1);
    return this.izinliMi(id, a, b, c);
  }
  /** ay içinde puantaja elle girilen yıllık izin / rapor / nöbet izni / diğer izin: o gün görev yazılamaz */
  puantajDurumu(id: number, y: number, m: number, d: number): string | null {
    const a = this.puantaj[ayAnahtari(y, m)], k = a && a[id] && a[id][d];
    return k && DURUM_KOD.indexOf(k) >= 0 ? k : null;
  }
  /** o gün kişiye hiçbir görev yazılamaz: izin, eş durumu yok, puantajdaki izin, izin arası, izin haftası kenarı, çalışma dönemi dışı */
  kesinYasak(id: number, y: number, m: number, d: number): boolean {
    const v = this.tercih(id, y, m, d); if (v === "izinli" || v === "esYok") return true;
    if (this.puantajDurumu(id, y, m, d)) return true;
    if (this.izinArasiMi(id, y, m, d)) return true;
    if (this.izinHaftasiKenariMi(id, y, m, d)) return true;
    const st = this.kisi(id);
    return !!(st && !aktifGunMu(st, y, m, d));
  }

  /** Bir günde GERÇEKTE nöbet / hazırlama tutanlar: çizelge + puantajdaki değişimler (nöbet değişimi, devir, takas).
   *  Yalnız ay sınırındaki dinlenme kuralları (art arda nöbet, 3 gün ara) için kullanılır; eşitlik hesabı çizelgeye göredir. */
  gercekGorev(y: number, m: number, d: number): { N: number[]; H: number[] } {
    const sc = this.cizelge(y, m), g = sc && sc.days && sc.days[d - 1];
    const N = new Set(g ? (g.assigned || []).map(p => p.id) : []), H = new Set(g ? (g.prep || []).map(p => p.id) : []);
    const ov = this.puantaj && this.puantaj[ayAnahtari(y, m)];
    if (ov) Object.keys(ov).forEach(k => {
      const c = ov[k] && ov[k][d]; if (c === undefined || c === null || c === "") return;
      const id = Number(k);
      N.delete(id); H.delete(id);
      if (c === "N") N.add(id); else if (c === "H") H.add(id);
    });
    return { N: [...N], H: [...H] };
  }
}

// ---- çalışma dönemi (işe başlama / ayrılış tarihi): yalnız kişiye bağlı ----
export function aktifGunMu(st: Kisi, y: number, m: number, d: number): boolean {
  const n = tarihNo(y, m, d), b = isoNo(st.baslangic), e = isoNo(st.bitis);
  return (b === null || n >= b) && (e === null || n <= e);
}
export function aktifAydaMi(st: Kisi, y: number, m: number): boolean {
  const a = tarihNo(y, m, 1), z = tarihNo(y, m, ayGunSayisi(y, m)), b = isoNo(st.baslangic), e = isoNo(st.bitis);
  return (b === null || b <= z) && (e === null || e >= a);
}
/** bugün itibarıyla ayrılmış mı */
export function ayrildiMi(st: Kisi): boolean {
  const e = isoNo(st.bitis); if (e === null) return false;
  const n = new Date();
  return e < tarihNo(n.getFullYear(), n.getMonth(), n.getDate());
}

// ---- roller ----
/** eczacı yerine sayılanlar (her gün en az biri nöbetçi) */
export const eczaciMi = (r: string) => r === "eczaci" || r === "nobetci";
/** nöbet tutanlar */
export const nobetciRol = (r: string) => r === "eczaci" || r === "teknisyen" || r === "nobetci";
/** 1. hazırlama yerine yazılabilenler (destek personeli yalnız 2. yere) */
export const hazirlamaRol = (r: string) => r === "eczaci" || r === "teknisyen" || r === "nobetci";
/** yıllık gün türü eşitliğine girenler (eczacı, dışarıdan gelen eczacı, tekniker) */
export const yillikEsitRol = (r: string) => eczaciMi(r) || r === "teknisyen";
export const gorevli = (s: Kisi | Gorevli): Gorevli => ({ id: s.id, name: s.name, role: s.role });
