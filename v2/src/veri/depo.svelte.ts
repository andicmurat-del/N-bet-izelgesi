// Uygulama durumu ve tarayıcıda saklanması. Veriler yalnız bu tarayıcıda durur; taşımak için yedek dosyası kullanılır.
import type { AyCizelgesi, Ayarlar, Gorevli, Kisi, PuantajKodu, Rol, Tercih, Veri } from "./tipler";
import { ayAnahtari, gunAnahtari, gunSayisi, haftaSonuMu, tercihAnahtari } from "./tarih";

const ANAHTAR = "nobet-cizelgesi-v2";

export const AYAR_VARSAYILAN: Ayarlar = { minAra: 3, destekAylik: 2, arifeSaat: 3 };

export function bosVeri(): Veri {
  return {
    surum: 1,
    kurum: { ad: "", onaylayan: "" },
    staff: [],
    prefs: {},
    manualTatil: {},
    arife: {},
    settings: { ...AYAR_VARSAYILAN },
    schedules: {},
    puantaj: {},
    acil: {},
    degisimler: [],
    servisAyar: { svc: {}, ekstra: [] },
    servisKayit: {},
  };
}

/** Yedekten ya da tarayıcıdan okunan veriyi güvenli biçime getirir; tanınmayan alanlar atılır. */
export function veriyiDogrula(ham: unknown): Veri {
  const v = bosVeri();
  if (!ham || typeof ham !== "object") return v;
  const o = ham as Record<string, any>;
  const nesne = (x: unknown) => (x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, any>) : {});
  const roller: Rol[] = ["eczaci", "teknisyen", "destek", "nobetci", "servis"];
  const iso = (t: unknown) => (typeof t === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : undefined);
  const kurum = nesne(o.kurum);
  v.kurum = { ad: String(kurum.ad ?? ""), onaylayan: String(kurum.onaylayan ?? "") };
  const goruldu = new Set<number>();
  v.staff = (Array.isArray(o.staff) ? o.staff : [])
    .filter((k: any) => k && Number.isInteger(k.id) && !goruldu.has(k.id) && goruldu.add(k.id))
    .map((k: any): Kisi => ({
      id: k.id,
      name: String(k.name ?? "").trim().slice(0, 60),
      role: roller.includes(k.role) ? k.role : "eczaci",
      ...(iso(k.baslangic) ? { baslangic: iso(k.baslangic) } : {}),
      ...(iso(k.bitis) ? { bitis: iso(k.bitis) } : {}),
    }));
  const tercihler: Tercih[] = ["izinli", "want", "avoid", "esVar", "esYok"];
  for (const [k, t] of Object.entries(nesne(o.prefs))) if (tercihler.includes(t)) v.prefs[k] = t;
  for (const k of Object.keys(nesne(o.manualTatil))) v.manualTatil[k] = true;
  for (const k of Object.keys(nesne(o.arife))) v.arife[k] = true;
  const s = nesne(o.settings);
  const sayi = (x: unknown, a: number, b: number, vars: number) => (x !== null && x !== "" && Number.isFinite(Number(x)) && Number(x) >= a && Number(x) <= b ? Number(x) : vars);
  v.settings = {
    minAra: sayi(s.minAra, 2, 6, AYAR_VARSAYILAN.minAra),
    destekAylik: sayi(s.destekAylik, 0, 8, AYAR_VARSAYILAN.destekAylik),
    arifeSaat: sayi(s.arifeSaat, 0, 8, AYAR_VARSAYILAN.arifeSaat),
  };
  const kodlar: PuantajKodu[] = ["M", "N", "H", "NI", "YI", "R", "DI", "B"];
  for (const [ayK, kisiler] of Object.entries(nesne(o.puantaj))) {
    if (!/^\d{4}-\d{1,2}$/.test(ayK)) continue;
    for (const [id, gunler] of Object.entries(nesne(kisiler)))
      for (const [gun, kod] of Object.entries(nesne(gunler)))
        if (kodlar.includes(kod as PuantajKodu)) ((v.puantaj[ayK] ??= {})[id] ??= {})[gun] = kod as PuantajKodu;
  }
  const kisiIdleri = new Set(v.staff.map(k => k.id));
  for (const [ayK, gunler] of Object.entries(nesne(o.acil))) {
    if (!/^\d{4}-\d{1,2}$/.test(ayK)) continue;
    for (const [gun, ids] of Object.entries(nesne(gunler))) {
      const l = (Array.isArray(ids) ? ids : []).filter((id: unknown): id is number => Number.isInteger(id) && kisiIdleri.has(id as number));
      const tek = [...new Set(l)].slice(0, 2);
      if (/^\d{1,2}$/.test(gun) && tek.length) (v.acil[ayK] ??= {})[gun] = tek;
    }
  }
  for (const [k, c] of Object.entries(nesne(o.schedules))) {
    if (!c || !Array.isArray(c.days) || !Number.isInteger(c.year) || !Number.isInteger(c.month)) continue;
    // anahtar, ay ve gün sayısı tutmalı; günler alan alan kurulur (bozuk bir gün sayfayı her açılışta çökertmesin)
    if (c.month < 0 || c.month > 11 || k !== ayAnahtari(c.year, c.month) || c.days.length !== gunSayisi(c.year, c.month)) continue;
    const gorevli = (l: unknown): Gorevli[] => (Array.isArray(l) ? l : [])
      .filter((p: any) => p && Number.isInteger(p.id))
      .map((p: any) => ({ id: p.id, name: String(p.name ?? ""), role: roller.includes(p.role) ? p.role : "eczaci" }));
    v.schedules[k] = {
      year: c.year, month: c.month,
      days: c.days.map((g: unknown, i: number) => {
        const x = nesne(g);
        return { day: i + 1, tatil: x.tatil === true, conflict: x.conflict === true, fazlaMesai: Number.isFinite(Number(x.fazlaMesai)) ? Number(x.fazlaMesai) : 0,
          assigned: gorevli(x.assigned), prep: gorevli(x.prep), locked: x.locked === true };
      }),
      uyarilar: Array.isArray(c.uyarilar) ? c.uyarilar.map(String) : [],
      olusturma: Number(c.olusturma) || 0,
      ...(c.onay && typeof c.onay === "object" ? { onay: { zaman: Number(c.onay.zaman) || 0, kim: String(c.onay.kim ?? "") } } : {}),
    };
  }
  const tamsayi = (x: unknown) => Number.isInteger(x);
  const kodMu = (x: unknown) => kodlar.includes(x as PuantajKodu);
  v.degisimler = (Array.isArray(o.degisimler) ? o.degisimler : [])
    .filter((d: any) => d && [d.id, d.y, d.m, d.gun, d.cik, d.yer].every(tamsayi) && (d.gorev === "N" || d.gorev === "H") && kodMu(d.cikYeni) && (d.yerYeni === "N" || d.yerYeni === "H"))
    .slice(-300)
    .map((d: any) => ({
      id: d.id, zaman: Number(d.zaman) || 0, y: d.y, m: d.m, gun: d.gun, cik: d.cik, yer: d.yer,
      cikAd: String(d.cikAd ?? ""), yerAd: String(d.yerAd ?? ""),
      cikOnce: kodMu(d.cikOnce) ? d.cikOnce : null, yerOnce: kodMu(d.yerOnce) ? d.yerOnce : null,
      cikYeni: d.cikYeni, yerYeni: d.yerYeni, gorev: d.gorev,
      ...(typeof d.grup === "string" ? { grup: d.grup } : {}),
      ...(d.zorunlu === true ? { zorunlu: true as const } : {}),
      ...(kodMu(d.sebep) ? { sebep: d.sebep } : {}),
      ...(typeof d.not === "string" && d.not ? { not: d.not.slice(0, 160) } : {}),
    }));
  // servis hazırlama: ayarlar sınırlar içinde; ay kayıtları motorun biçiminde (motor bozuk gün kayıtlarını kendisi atar)
  const sa = nesne(o.servisAyar);
  for (const [ad, k] of Object.entries(nesne(sa.svc))) {
    const x = nesne(k);
    v.servisAyar.svc[ad] = { z: sayi(x.z, 1, 10, 1), h: sayi(x.h, 0, 999, 0), multi: x.multi === true, on: x.on !== false };
  }
  v.servisAyar.ekstra = (Array.isArray(sa.ekstra) ? sa.ekstra : [])
    .filter((e: any) => e && typeof e.name === "string" && e.name.trim())
    .map((e: any) => ({ name: String(e.name).trim().slice(0, 40), z: sayi(e.z, 1, 10, 1), h: sayi(e.h, 0, 999, 0), multi: e.multi === true }));
  for (const [k, R] of Object.entries(nesne(o.servisKayit))) {
    if (!/^\d{4}-\d{1,2}$/.test(k) || !R || typeof R !== "object") continue;
    const r = R as Record<string, unknown>;
    v.servisKayit[k] = { gun: nesne(r.gun), elle: nesne(r.elle), gunElle: nesne(r.gunElle), sk: nesne(r.sk), ad: nesne(r.ad), ata: nesne(r.ata) } as any;
  }
  if (o.ornek === true) v.ornek = true;
  return v;
}

let acilisSorunu = "";
function yukle(): Veri {
  let s: string | null = null;
  try { s = localStorage.getItem(ANAHTAR); } catch { return bosVeri(); }
  if (!s) return bosVeri();
  try { return veriyiDogrula(JSON.parse(s)); }
  catch {
    // kayıt okunamadı: boş veri kaydedilmeden önce ham hali ayrı anahtara alınır, kullanıcıya söylenir
    try { localStorage.setItem(ANAHTAR + "-okunamayan", s); } catch { /* yer yoksa yapılacak bir şey yok */ }
    acilisSorunu = "Bu tarayıcıdaki kayıtlı veriler okunamadı; uygulama boş açıldı. Okunamayan kayıt ayrıca saklandı. Yedeğiniz varsa Ayarlar > Yedekten yükle ile geri alın.";
    return bosVeri();
  }
}

const bugun = new Date();
export const depo = $state({
  veri: yukle(),
  yil: bugun.getFullYear(),
  ay: bugun.getMonth(),
  /** tarayıcı kaydı yazamazsa gösterilecek uyarı */
  kayitSorunu: acilisSorunu,
});

let kayitZamanlayici: ReturnType<typeof setTimeout> | undefined;
function kaydet() {
  clearTimeout(kayitZamanlayici);
  kayitZamanlayici = setTimeout(() => {
    gecmiseIsle();
    try {
      localStorage.setItem(ANAHTAR, JSON.stringify($state.snapshot(depo.veri)));
      if (depo.kayitSorunu !== acilisSorunu) depo.kayitSorunu = "";
    } catch {
      depo.kayitSorunu = "Veriler bu tarayıcıya kaydedilemedi (gizli pencere ya da depolama dolu olabilir). Sayfayı kapatmadan önce Ayarlar'dan yedek alın.";
    }
  }, 150);
}
$effect.root(() => {
  $effect(() => {
    JSON.stringify(depo.veri);
    kaydet();
  });
});

// ---------- geri al / yinele (eski uygulamadaki gibi) ----------
// Her kayıtta verinin görüntüsü alınır. Servis dağıtım kaydı görüntüye girmez: puantaja göre kendiliğinden
// yeniden hesaplanır. Art arda çok hızlı değişiklikler (sürükleyerek işaretleme, yazı yazma) tek adım sayılır.
// Onay bir geri alma noktasıdır: onaydan önceki adımlara dönülmez, geri alma onayı kaldırmaz.
// Geçmiş yalnız bu oturumda tutulur (sayfa yenilenince sıfırlanır).
const GECMIS_SINIR = 30, GRUPLAMA_MS = 350;
export const gecmis = $state({ geri: [] as string[], ileri: [] as string[] });
let sonGoruntu: string | null = null, sonEkleme = 0;
const goruntu = () => JSON.stringify({ ...$state.snapshot(depo.veri), servisKayit: undefined });

/** Son kayıttan bu yana değişiklik varsa önceki görüntü geri alma yığınına girer (kayıt sırasında çağrılır) */
export function gecmiseIsle() {
  const t = goruntu();
  if (sonGoruntu === null) { sonGoruntu = t; return; }
  if (t === sonGoruntu) return;
  const su = Date.now();
  if (su - sonEkleme > GRUPLAMA_MS || !gecmis.geri.length) {
    gecmis.geri.push(sonGoruntu);
    if (gecmis.geri.length > GECMIS_SINIR) gecmis.geri.shift();
  }
  sonEkleme = su;
  gecmis.ileri = [];
  sonGoruntu = t;
}
/** Geri alma noktası: önceki adımlar unutulur */
export function gecmisiSifirla() {
  gecmis.geri = []; gecmis.ileri = [];
  sonGoruntu = goruntu();
}
function goruntuyuUygula(t: string) {
  const simdi = $state.snapshot(depo.veri);
  const v = veriyiDogrula(JSON.parse(t));
  v.servisKayit = simdi.servisKayit;
  // onay geri alma ile değişmez: onaylı çizelge olduğu gibi kalır, onaysız ayın onayı geri gelmez
  for (const [k, c] of Object.entries(simdi.schedules)) if (c.onay) v.schedules[k] = c;
  for (const [k, c] of Object.entries(v.schedules)) if (c.onay && !simdi.schedules[k]?.onay) delete c.onay;
  depo.veri = v;
  sonGoruntu = goruntu();
}
/** Son değişikliği geri alır; geri alınacak bir şey yoksa false */
export function geriAl(): boolean {
  gecmiseIsle();   // henüz kayda girmemiş son değişiklik de bir adım sayılır
  const t = gecmis.geri.pop();
  if (t === undefined) return false;
  gecmis.ileri.push(sonGoruntu!);
  goruntuyuUygula(t);
  return true;
}
/** Geri alınanı yineler; yinelenecek bir şey yoksa false */
export function yinele(): boolean {
  gecmiseIsle();
  const t = gecmis.ileri.pop();
  if (t === undefined) return false;
  gecmis.geri.push(sonGoruntu!);
  goruntuyuUygula(t);
  return true;
}

// ---------- kişiler ----------
/** Verinin herhangi bir yerinde geçen en büyük kişi numarası (silinen kişiler onaylı aylarda, değişim ve servis kayıtlarında kalır) */
function enBuyukKisiNo(): number {
  const v = depo.veri;
  let n = 0;
  const al = (x: unknown) => { const i = Number(x); if (Number.isInteger(i) && i > n) n = i; };
  v.staff.forEach(k => al(k.id));
  for (const c of Object.values(v.schedules)) for (const g of c.days) for (const p of [...g.assigned, ...g.prep]) al(p.id);
  for (const a of Object.values(v.puantaj)) Object.keys(a).forEach(al);
  for (const a of Object.values(v.acil)) for (const l of Object.values(a)) l.forEach(al);
  for (const d of v.degisimler) { al(d.cik); al(d.yer); }
  for (const R of Object.values(v.servisKayit)) { Object.keys(R.ad ?? {}).forEach(al); for (const g of Object.values(R.gun ?? {})) (g.k ?? []).forEach(al); }
  return n;
}

export function kisiEkle(name: string, role: Rol): Kisi {
  const id = enBuyukKisiNo() + 1;
  const kisi: Kisi = { id, name: name.trim().replace(/\s+/g, " "), role };
  depo.veri.staff.push(kisi);
  return kisi;
}

export function kisiGuncelle(id: number, alanlar: Partial<Omit<Kisi, "id">>) {
  const k = depo.veri.staff.find(x => x.id === id);
  if (!k) return;
  Object.assign(k, alanlar);
  if (!k.baslangic) delete k.baslangic;
  if (!k.bitis) delete k.bitis;
  // çizelgelerdeki ad ve görev de güncellenir (eski aylar dahil)
  for (const c of Object.values(depo.veri.schedules))
    for (const g of c.days) for (const p of [...g.assigned, ...g.prep]) if (p.id === id) { p.name = k.name; p.role = k.role; }
}

/** Kişinin onaylı aylarda kaydı (çizelge görevi, acil servis nöbeti, puantaj kaydı) var mı; varsa silinmez, ayrılış tarihi girilir */
export function onayliGoreviVar(id: number): string[] {
  return Object.values(depo.veri.schedules)
    .filter(c => {
      if (!c.onay) return false;
      const ayK = ayAnahtari(c.year, c.month);
      return c.days.some(g => [...g.assigned, ...g.prep].some(p => p.id === id))
        || Object.values(depo.veri.acil[ayK] ?? {}).some(l => l.includes(id))
        || !!depo.veri.puantaj[ayK]?.[id];
    })
    .map(c => ayAnahtari(c.year, c.month));
}

/** Kişiyi siler; onaylı aylarda kaydı varsa silmez (false döner) */
export function kisiSil(id: number): boolean {
  if (onayliGoreviVar(id).length) return false;
  depo.veri.staff = depo.veri.staff.filter(k => k.id !== id);
  for (const k of Object.keys(depo.veri.prefs)) if (k.startsWith(id + "-")) delete depo.veri.prefs[k];
  for (const c of Object.values(depo.veri.schedules)) {
    if (c.onay) continue;
    for (const g of c.days) { g.assigned = g.assigned.filter(p => p.id !== id); g.prep = g.prep.filter(p => p.id !== id); }
  }
  for (const [ayK, a] of Object.entries(depo.veri.puantaj)) if (!depo.veri.schedules[ayK]?.onay) delete a[id];
  for (const [ayK, a] of Object.entries(depo.veri.acil)) {
    for (const [g, l] of Object.entries(a)) { a[g] = l.filter(x => x !== id); if (!a[g].length) delete a[g]; }
    if (!Object.keys(a).length) delete depo.veri.acil[ayK];
  }
  // geri alınacak kişisi kalmayan değişim kayıtları (onaysız aylar) da gider
  depo.veri.degisimler = depo.veri.degisimler.filter(d => (d.cik !== id && d.yer !== id) || !!depo.veri.schedules[ayAnahtari(d.y, d.m)]?.onay);
  return true;
}

// ---------- tercih ve tatil işaretleri ----------
export function tercihAl(id: number, y: number, m: number, d: number): Tercih | undefined {
  return depo.veri.prefs[tercihAnahtari(id, y, m, d)];
}
export function tercihAyarla(id: number, y: number, m: number, d: number, t: Tercih | null) {
  const k = tercihAnahtari(id, y, m, d);
  if (t) depo.veri.prefs[k] = t; else delete depo.veri.prefs[k];
}
export const resmiTatilMi = (y: number, m: number, d: number) => !!depo.veri.manualTatil[gunAnahtari(y, m, d)];
export const arifeMi = (y: number, m: number, d: number) => !!depo.veri.arife[gunAnahtari(y, m, d)];
export const tatilMi = (y: number, m: number, d: number) => haftaSonuMu(y, m, d) || resmiTatilMi(y, m, d);
export function resmiTatilAyarla(y: number, m: number, d: number, acik: boolean) {
  const k = gunAnahtari(y, m, d);
  if (acik) { depo.veri.manualTatil[k] = true; delete depo.veri.arife[k]; } else delete depo.veri.manualTatil[k];
}
export function arifeAyarla(y: number, m: number, d: number, acik: boolean) {
  const k = gunAnahtari(y, m, d);
  if (acik && !haftaSonuMu(y, m, d)) { depo.veri.arife[k] = true; delete depo.veri.manualTatil[k]; } else delete depo.veri.arife[k];
}

// ---------- çizelge ----------
export const ayCizelgesi = (y: number, m: number): AyCizelgesi | undefined => depo.veri.schedules[ayAnahtari(y, m)];

/** Ay çizelgesinin işaretleri (tatil günleri, personel) çizelge oluşturulduktan sonra değiştiyse bildirim metinleri */
export function eskimeNedenleri(y: number, m: number): string[] {
  const c = ayCizelgesi(y, m);
  if (!c || c.onay) return [];
  const n: string[] = [];
  const tatilFarki = c.days.filter(g => g.tatil !== tatilMi(y, m, g.day)).map(g => g.day);
  if (tatilFarki.length) n.push(`Tatil günleri değişti (${tatilFarki.join(", ")}).`);
  const idler = new Set(depo.veri.staff.map(k => k.id));
  const silinen = new Set<string>();
  for (const g of c.days) for (const p of [...g.assigned, ...g.prep]) if (!idler.has(p.id)) silinen.add(p.name);
  if (silinen.size) n.push(`Çizelgede artık listede olmayan kişiler var: ${[...silinen].join(", ")}.`);
  return n;
}

export function cizelgeKaydet(y: number, m: number, days: AyCizelgesi["days"], uyarilar: string[]) {
  depo.veri.schedules[ayAnahtari(y, m)] = { year: y, month: m, days, uyarilar, olusturma: Date.now() };
}

export function gunuGuncelle(y: number, m: number, gun: number, nobetciler: Gorevli[], hazirlama: Gorevli[]) {
  const c = ayCizelgesi(y, m);
  if (!c || c.onay) return;
  const g = c.days[gun - 1];
  g.assigned = nobetciler;
  g.prep = hazirlama;
  g.locked = true;
}
export function gunKilidiniKaldir(y: number, m: number, gun: number) {
  const c = ayCizelgesi(y, m);
  if (!c || c.onay) return;
  c.days[gun - 1].locked = false;
}
export function cizelgeSil(y: number, m: number) {
  const c = ayCizelgesi(y, m);
  if (!c || c.onay) return;
  delete depo.veri.schedules[ayAnahtari(y, m)];
}
export function onayla(y: number, m: number) {
  const c = ayCizelgesi(y, m);
  if (c) c.onay = { zaman: Date.now(), kim: depo.veri.kurum.onaylayan };
  gecmisiSifirla();   // onay bir geri alma noktasıdır
}
export function onayiKaldir(y: number, m: number) {
  const c = ayCizelgesi(y, m);
  if (c) delete c.onay;
}

// ---------- acil servis nöbeti ----------
export const acilGunu = (y: number, m: number, gun: number): number[] => depo.veri.acil[ayAnahtari(y, m)]?.[gun] ?? [];
export function acilGunuAyarla(y: number, m: number, gun: number, ids: number[]) {
  const ayK = ayAnahtari(y, m), tek = [...new Set(ids)].slice(0, 2);
  if (tek.length) { (depo.veri.acil[ayK] ??= {})[gun] = tek; return; }
  const a = depo.veri.acil[ayK];
  if (!a) return;
  delete a[gun];
  if (!Object.keys(a).length) delete depo.veri.acil[ayK];
}
export function acilAyiniSil(y: number, m: number) { delete depo.veri.acil[ayAnahtari(y, m)]; }

// ---------- puantaj ----------
export function puantajKoduAyarla(y: number, m: number, id: number, gun: number, kod: PuantajKodu | null) {
  const ayK = ayAnahtari(y, m);
  if (kod) { ((depo.veri.puantaj[ayK] ??= {})[id] ??= {})[gun] = kod; return; }
  const a = depo.veri.puantaj[ayK]?.[id];
  if (!a) return;
  delete a[gun];
  if (!Object.keys(a).length) delete depo.veri.puantaj[ayK][id];
  if (!Object.keys(depo.veri.puantaj[ayK]).length) delete depo.veri.puantaj[ayK];
}
export const puantajElleKodu = (y: number, m: number, id: number, gun: number): PuantajKodu | undefined => depo.veri.puantaj[ayAnahtari(y, m)]?.[id]?.[gun];

// ---------- ay içi sayımlar ----------
export interface KisiAyOzeti { nobet: number; hazirlama: number; fazlaMesai: number; haftaSonu: number }
export function ayOzeti(c: AyCizelgesi): Record<number, KisiAyOzeti> {
  const o: Record<number, KisiAyOzeti> = {};
  const al = (id: number) => (o[id] ??= { nobet: 0, hazirlama: 0, fazlaMesai: 0, haftaSonu: 0 });
  for (const g of c.days) {
    const hs = haftaSonuMu(c.year, c.month, g.day);
    for (const p of g.assigned) { const x = al(p.id); x.nobet++; x.fazlaMesai += g.fazlaMesai; if (hs) x.haftaSonu++; }
    for (const p of g.prep) { const x = al(p.id); x.hazirlama++; x.fazlaMesai += 8; }
  }
  return o;
}

/** Ayda çalışan (başlangıç–bitiş aralığı ayla kesişen) kişiler */
export function aydaCalisanlar(y: number, m: number): Kisi[] {
  const ilk = `${y}-${String(m + 1).padStart(2, "0")}-01`, son = `${y}-${String(m + 1).padStart(2, "0")}-${String(gunSayisi(y, m)).padStart(2, "0")}`;
  return depo.veri.staff.filter(k => !(k.baslangic && k.baslangic > son) && !(k.bitis && k.bitis < ilk));
}

// ---------- yedek ----------
export function yedekVerisi(): string {
  return JSON.stringify({ uygulama: "nobet-cizelgesi-v2", zaman: new Date().toISOString(), veri: $state.snapshot(depo.veri) }, null, 1);
}
export function yedektenYukle(metin: string): { tamam: true; atlanan: number } | { tamam: false; hata: string } {
  let o: any;
  try { o = JSON.parse(metin); } catch { return { tamam: false, hata: "Dosya okunamadı: geçerli bir yedek dosyası değil." }; }
  if (!o || o.uygulama !== "nobet-cizelgesi-v2" || !o.veri || typeof o.veri !== "object") return { tamam: false, hata: "Bu dosya bu uygulamanın yedeği değil." };
  if (!Array.isArray(o.veri.staff) || typeof o.veri.schedules !== "object" || !o.veri.schedules) return { tamam: false, hata: "Yedek dosyası eksik ya da bozuk; mevcut veriler değiştirilmedi." };
  const v = veriyiDogrula(o.veri);
  // okunamayıp atlanan kişi ve çizelge sayısı (kullanıcıya söylenir)
  const atlanan = (o.veri.staff.length - v.staff.length) + (Object.keys(o.veri.schedules).length - Object.keys(v.schedules).length);
  // yüklemeden önceki veri bir kez saklanır: yanlış dosya seçilirse geri alınabilir
  try { localStorage.setItem(ANAHTAR + "-yukleme-oncesi", JSON.stringify($state.snapshot(depo.veri))); } catch { /* yer yoksa geçilir */ }
  depo.veri = v;
  gecmisiSifirla();   // yüklemenin kendi geri dönüşü var (yuklemeOncesineDon)
  return { tamam: true, atlanan };
}
/** Yedekten yüklemeden önceki veriye döner (yanlış dosya seçildiyse) */
export function yuklemeOncesineDon(): boolean {
  try {
    const s = localStorage.getItem(ANAHTAR + "-yukleme-oncesi");
    if (!s) return false;
    depo.veri = veriyiDogrula(JSON.parse(s));
    gecmisiSifirla();
    localStorage.removeItem(ANAHTAR + "-yukleme-oncesi");
    return true;
  } catch { return false; }
}
export function tumVeriyiSil() {
  depo.veri = bosVeri();
}

/** Uygulamayı denemek için örnek kadro: 6 eczacı, 6 tekniker, 2 acil servis eczacısı. Ekranda "örnek" diye belirtilir. */
export function ornekKadroYukle() {
  const v = bosVeri();
  v.ornek = true;
  v.kurum.ad = "Örnek Hastane Eczanesi";
  const ecz = ["Ayşe Yılmaz", "Mehmet Kaya", "Zeynep Demir", "Ali Çelik", "Elif Şahin", "Murat Arslan"];
  const tek = ["Fatma Koç", "Emre Aydın", "Selin Öztürk", "Burak Yıldız", "Hülya Kurt", "Can Polat"];
  ecz.forEach((name, i) => v.staff.push({ id: i + 1, name, role: "eczaci" }));
  tek.forEach((name, i) => v.staff.push({ id: i + 7, name, role: "teknisyen" }));
  ["Deniz Acar", "Okan Tekin"].forEach((name, i) => v.staff.push({ id: i + 13, name, role: "servis" }));
  depo.veri = v;
}
