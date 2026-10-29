// Puantajda ay içi değişiklikler (eski uygulamadaki mantık): nöbet değişimi (yerine tutma, karşılıklı takas),
// izin/rapor kaydı ve izin nedeniyle görevden düşen kişinin yerine geçen. Her değişim geri alınabilsin diye
// puantajdaki önceki kodlarla birlikte depo.veri.degisimler'e yazılır; liste son 300 değişimi tutar (bu yılın izin/rapor
// nedeniyle yerine geçmeleri silinmez: yıllık eşitlik ve yerine tutma sırası bunlara bakar), daha eskiler geri alınamaz.
import { depo, tatilMi, tercihAl } from "./depo.svelte";
import { puantajHesapla } from "../motor";
import { ayAnahtari, gunSayisi, tercihAnahtari } from "./tarih";
import type { Degisim, PuantajKodu } from "./tipler";
import type { Izgara } from "../disa/puantajTipleri";

export type Gorev = "N" | "H";
export type IzinTuru = "R" | "YI" | "NI" | "DI";
export const IZIN_AD: Record<IzinTuru, string> = { R: "Rapor", YI: "Yıllık izin", NI: "Nöbet izni (fazla mesai karşılığı)", DI: "Diğer izin" };
export const IZIN_KISA: Record<IzinTuru, string> = { R: "R", YI: "Yİ", NI: "Nİ", DI: "Dİ" };
const IZIN_KODLARI: PuantajKodu[] = ["YI", "R", "NI", "DI"];

/** Değişim isteği: tur "devir" yerine tutma; "takas" karşılıklı (gun2'deki görevi yer → cik alır) */
export interface DegisimIstegi { y: number; m: number; gorev: Gorev; tur: "devir" | "takas"; gun: number; cik: number; yer: number; gun2?: number; gorev2?: Gorev; not?: string }

export const puantajIzgarasi = (y: number, m: number) => puantajHesapla($state.snapshot(depo.veri), y, m) as Izgara;
const kisiAdi = (id: number) => depo.veri.staff.find(k => k.id === id)?.name ?? "(silinmiş)";
const ayKodlari = (y: number, m: number) => (depo.veri.puantaj[ayAnahtari(y, m)] ??= {});
function kodYaz(y: number, m: number, id: number, gun: number, kod: PuantajKodu | null) {
  const ayK = ayAnahtari(y, m);
  if (kod) { (ayKodlari(y, m)[id] ??= {})[gun] = kod; return; }
  const a = depo.veri.puantaj[ayK];
  if (!a?.[id]) return;
  delete a[id][gun];
  if (!Object.keys(a[id]).length) delete a[id];
  if (!Object.keys(a).length) delete depo.veri.puantaj[ayK];
}
const yeniId = () => depo.veri.degisimler.reduce((m, x) => Math.max(m, x.id), 0) + 1;
function kayitEkle(d: Omit<Degisim, "id" | "zaman">) {
  depo.veri.degisimler.push({ id: yeniId(), zaman: Date.now(), ...d });
  if (depo.veri.degisimler.length > 300) {
    // izin/rapor nedeniyle yerine geçmeler yıl boyunca saklanır: yıllık eşitlik ve yerine tutma sırası bunlara bakar
    const L = depo.veri.degisimler, yil = new Date().getFullYear(), i = L.findIndex(x => !(x.sebep && x.y >= yil));
    L.splice(i >= 0 ? i : 0, 1);
  }
}

/** nöbetten çıkan kişinin o gün dönüştüğü kod */
function cikYeniKod(y: number, m: number, gun: number, id: number): PuantajKodu {
  const r = depo.veri.staff.find(k => k.id === id)?.role;
  return tatilMi(y, m, gun) || r === "nobetci" || r === "destek" ? "B" : "M";
}

function tekDegisim(y: number, m: number, gun: number, cik: number, yer: number, kod: Gorev, ek: Partial<Degisim>) {
  const a = depo.veri.puantaj[ayAnahtari(y, m)] ?? {};
  const cikOnce = a[cik]?.[gun] ?? null, yerOnce = a[yer]?.[gun] ?? null, cikYeni = cikYeniKod(y, m, gun, cik);
  kodYaz(y, m, cik, gun, cikYeni);
  kodYaz(y, m, yer, gun, kod);
  kayitEkle({ y, m, gun, cik, yer, cikAd: kisiAdi(cik), yerAd: kisiAdi(yer), cikOnce, yerOnce, cikYeni, yerYeni: kod, gorev: kod, ...ek });
}

/** Değişimi puantaja işler (takasta iki gün birlikte). Yıllık denge çizelgeye göre kaldığı için çizelge değişmez. */
export function degisimUygula(d: DegisimIstegi) {
  const ek: Partial<Degisim> = d.not ? { not: d.not.slice(0, 160) } : {};
  if (d.tur === "takas" && d.gun2) ek.grup = `t${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  tekDegisim(d.y, d.m, d.gun, d.cik, d.yer, d.gorev, ek);
  if (d.tur === "takas" && d.gun2) tekDegisim(d.y, d.m, d.gun2, d.yer, d.cik, d.gorev2 ?? d.gorev, ek);
}

/**
 * Değişimi geri alır (takasın iki günü birlikte). Aynı güne sonradan yapılmış değişim varsa önce o geri alınmalı.
 * Değişimden sonra o hücreler elle değiştirildiyse `zorla` olmadan onay ister.
 */
export function degisimGeriAl(id: number, zorla = false): { tamam: true } | { tamam: false; hata?: string; onay?: string } {
  const L = depo.veri.degisimler, x = L.find(z => z.id === id);
  if (!x) return { tamam: false, hata: "Değişim bulunamadı." };
  const grup = x.grup ? L.filter(z => z.grup === x.grup) : [x];
  const enSon = Math.max(...grup.map(z => L.indexOf(z)));
  const sonraki = L.filter((z, i) => i > enSon && z.y === x.y && z.m === x.m && grup.some(g => g.gun === z.gun) && !grup.includes(z));
  if (sonraki.length) return { tamam: false, hata: `Bu günde sonradan yapılmış başka bir değişim var (${sonraki.map(z => `${z.gun}. gün: ${z.cikAd} yerine ${z.yerAd}`).join("; ")}). Önce onu geri alın.` };
  const a = depo.veri.puantaj[ayAnahtari(x.y, x.m)] ?? {};
  const elle = grup.some(z => (a[z.cik]?.[z.gun] ?? null) !== z.cikYeni || (a[z.yer]?.[z.gun] ?? null) !== z.yerYeni);
  if (elle && !zorla) return { tamam: false, onay: "Bu günler değişimden sonra elle yeniden düzenlenmiş. Yine de geri alınsın mı?" };
  // izin nedeniyle çizelgeye işlenen değişim çizelgeden de geri alınır
  for (const z of grup) {
    if (!z.zorunlu) continue;
    const g = depo.veri.schedules[ayAnahtari(z.y, z.m)]?.days[z.gun - 1];
    const k = depo.veri.staff.find(s => s.id === z.cik);
    if (!g || !k) continue;
    const liste = z.yerYeni === "H" ? g.prep : g.assigned, i = liste.findIndex(p => p.id === z.yer);
    if (i >= 0 && !liste.some(p => p.id === z.cik)) liste[i] = { id: k.id, name: k.name, role: k.role };
  }
  for (const z of [...grup].reverse()) { kodYaz(z.y, z.m, z.cik, z.gun, z.cikOnce); kodYaz(z.y, z.m, z.yer, z.gun, z.yerOnce); }
  depo.veri.degisimler = L.filter(z => !grup.includes(z));
  return { tamam: true };
}

/**
 * izin/rapor nedeniyle zorunlu değişim: puantaja yazılır; kişi o gün çizelgede görevliyse çizelgeye de işlenir (gün
 * gerçekte tutanı göstersin; yıllık eşitlikte görev yine çıkanın sayılır: motor değişim kaydından geri çevirir).
 * Görev çizelgeden değil bir nöbet değişiminden geldiyse çizelge değişmez.
 */
function zorunluDegisim(y: number, m: number, gun: number, cik: number, yer: number, gorev: Gorev, sebep: IzinTuru) {
  const k = depo.veri.staff.find(s => s.id === yer);
  if (!k) return;
  const g = depo.veri.schedules[ayAnahtari(y, m)]?.days[gun - 1];
  const liste = g ? (gorev === "H" ? g.prep : g.assigned) : [], i = liste.findIndex(p => p.id === cik);
  const cizelgede = !!g && i >= 0;
  if (cizelgede) { liste[i] = { id: k.id, name: k.name, role: k.role }; g.locked = true; }
  const a = depo.veri.puantaj[ayAnahtari(y, m)] ?? {};
  const cikOnce = a[cik]?.[gun] ?? null, yerOnce = a[yer]?.[gun] ?? null;
  kodYaz(y, m, yer, gun, gorev);
  // çıkan kişinin günü izinUygula'da izin koduyla yazılır
  kayitEkle({ y, m, gun, cik, yer, cikAd: kisiAdi(cik), yerAd: k.name, cikOnce, yerOnce, cikYeni: sebep, yerYeni: gorev, gorev, ...(cizelgede ? { zorunlu: true as const } : {}), sebep });
}

export interface YerineSecim { gun: number; gorev: Gorev; yer: number }
/**
 * Kişinin bas..bit günlerine izin/rapor yazar. Görevli olduğu günler için `secim` ile yerine geçenler çizelgeye ve
 * puantaja işlenir (yer 0: boş bırakılır). Mesai dışı günler (tatil; nöbetçi/destek için her gün) yalnız görev varsa yazılır.
 */
export function izinUygula(y: number, m: number, kisi: number, tur: IzinTuru, bas: number, bit: number, secim: YerineSecim[]) {
  const G = puantajIzgarasi(y, m), r = G.satirlar.find(x => x.s.id === kisi);
  if (!r) return;
  const sadece = r.s.role === "nobetci" || r.s.role === "destek";
  for (const s of secim) if (s.yer) zorunluDegisim(y, m, s.gun, kisi, s.yer, s.gorev, tur);
  for (let g = bas; g <= bit; g++) {
    const c = r.cells[g - 1], gg = G.gunler[g - 1], gorevli = c.kod === "N" || c.kod === "H";
    // yıllık izin, İzin ve tercihler takviminde de "İzinli" görünsün (eş durumu işaretleri korunur)
    if (tur === "YI") { const t = tercihAl(kisi, y, m, g); if (t !== "esVar" && t !== "esYok") depo.veri.prefs[tercihAnahtari(kisi, y, m, g)] = "izinli"; }
    if (c.kod === "NI" && !c.ov) continue; // nöbet ertesi izin olduğu gibi kalır
    if (gorevli || (!gg.tatil && !sadece)) kodYaz(y, m, kisi, g, tur);
  }
}

/** Kişinin bas..bit günlerindeki izin kodlarını (ve yıllık izinse İzinli işaretlerini) siler; puantaj yeniden çizelgeden gelir */
export function izinSil(y: number, m: number, kisi: number, bas: number, bit: number, kod: IzinTuru) {
  for (let g = bas; g <= bit; g++) if (depo.veri.puantaj[ayAnahtari(y, m)]?.[kisi]?.[g] === kod) kodYaz(y, m, kisi, g, null);
  if (kod === "YI") for (let g = bas; g <= bit; g++) { const k = tercihAnahtari(kisi, y, m, g); if (depo.veri.prefs[k] === "izinli") delete depo.veri.prefs[k]; }
}

/** kişinin o günkü izin türü: puantaj kaydı ya da İzinli işareti (yıllık izin) */
function izinKoduGun(id: number, y: number, m: number, d: number): IzinTuru | null {
  const k = depo.veri.puantaj[ayAnahtari(y, m)]?.[id]?.[d];
  if (k && IZIN_KODLARI.includes(k)) return k as IzinTuru;
  return tercihAl(id, y, m, d) === "izinli" ? "YI" : null;
}
export interface IzinKaydi { id: number; kod: IzinTuru; bas: number; bit: number; gunler: number[] }
/** Ayın izin/rapor kayıtları: kişi ve tür başına ardışık günler (arada yalnız tatil varsa da) tek kayıt */
export function ayIzinleri(y: number, m: number): IzinKaydi[] {
  const out: IzinKaydi[] = [], dim = gunSayisi(y, m);
  const kisiler = new Set<number>(Object.keys(depo.veri.puantaj[ayAnahtari(y, m)] ?? {}).map(Number));
  const re = new RegExp(`^(\\d+)-${y}-${m}-(\\d+)$`);
  for (const [k, t] of Object.entries(depo.veri.prefs)) { const e = k.match(re); if (e && t === "izinli") kisiler.add(Number(e[1])); }
  for (const id of kisiler) {
    let cur: IzinKaydi | null = null;
    for (let g = 1; g <= dim; g++) {
      const k = izinKoduGun(id, y, m, g);
      if (!k) continue;
      let bitisik = !!cur && cur.kod === k;
      if (cur && bitisik) for (let x = cur.bit + 1; x < g; x++) if (!tatilMi(y, m, x)) { bitisik = false; break; }
      if (cur && bitisik) { cur.bit = g; cur.gunler.push(g); }
      else { cur = { id, kod: k, bas: g, bit: g, gunler: [g] }; out.push(cur); }
    }
  }
  return out.sort((a, b) => a.bas - b.bas || a.id - b.id);
}

export const ayDegisimleri = (y: number, m: number) => depo.veri.degisimler.filter(z => z.y === y && z.m === m);
