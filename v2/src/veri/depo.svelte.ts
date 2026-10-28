// Uygulama durumu ve tarayıcıda saklanması. Veriler yalnız bu tarayıcıda durur; taşımak için yedek dosyası kullanılır.
import type { AyCizelgesi, Ayarlar, Gorevli, Kisi, Rol, Tercih, Veri } from "./tipler";
import { ayAnahtari, gunAnahtari, gunSayisi, haftaSonuMu, tercihAnahtari } from "./tarih";

const ANAHTAR = "nobet-cizelgesi-v2";

export const AYAR_VARSAYILAN: Ayarlar = { minAra: 3, destekAylik: 2, cakismaOncelik: 1, arifeSaat: 3 };

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
  };
}

/** Yedekten ya da tarayıcıdan okunan veriyi güvenli biçime getirir; tanınmayan alanlar atılır. */
export function veriyiDogrula(ham: unknown): Veri {
  const v = bosVeri();
  if (!ham || typeof ham !== "object") return v;
  const o = ham as Record<string, any>;
  const nesne = (x: unknown) => (x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, any>) : {});
  const roller: Rol[] = ["eczaci", "teknisyen", "destek", "nobetci"];
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
  const sayi = (x: unknown, a: number, b: number, vars: number) => (Number.isFinite(Number(x)) && Number(x) >= a && Number(x) <= b ? Number(x) : vars);
  v.settings = {
    minAra: sayi(s.minAra, 2, 6, AYAR_VARSAYILAN.minAra),
    destekAylik: sayi(s.destekAylik, 0, 8, AYAR_VARSAYILAN.destekAylik),
    cakismaOncelik: Number(s.cakismaOncelik) === 2 ? 2 : 1,
    arifeSaat: sayi(s.arifeSaat, 0, 8, AYAR_VARSAYILAN.arifeSaat),
  };
  for (const [k, c] of Object.entries(nesne(o.schedules))) {
    if (!c || !Array.isArray(c.days) || !Number.isInteger(c.year) || !Number.isInteger(c.month)) continue;
    v.schedules[k] = {
      year: c.year, month: c.month,
      days: c.days,
      uyarilar: Array.isArray(c.uyarilar) ? c.uyarilar.map(String) : [],
      olusturma: Number(c.olusturma) || 0,
      ...(c.onay && typeof c.onay === "object" ? { onay: { zaman: Number(c.onay.zaman) || 0, kim: String(c.onay.kim ?? "") } } : {}),
    };
  }
  if (o.ornek === true) v.ornek = true;
  return v;
}

function yukle(): Veri {
  try {
    const s = localStorage.getItem(ANAHTAR);
    return s ? veriyiDogrula(JSON.parse(s)) : bosVeri();
  } catch {
    return bosVeri();
  }
}

const bugun = new Date();
export const depo = $state({
  veri: yukle(),
  yil: bugun.getFullYear(),
  ay: bugun.getMonth(),
  /** tarayıcı kaydı yazamazsa gösterilecek uyarı */
  kayitSorunu: "" as string,
});

let kayitZamanlayici: ReturnType<typeof setTimeout> | undefined;
function kaydet() {
  clearTimeout(kayitZamanlayici);
  kayitZamanlayici = setTimeout(() => {
    try {
      localStorage.setItem(ANAHTAR, JSON.stringify($state.snapshot(depo.veri)));
      depo.kayitSorunu = "";
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

// ---------- kişiler ----------
export function kisiEkle(name: string, role: Rol): Kisi {
  const id = depo.veri.staff.reduce((m, k) => Math.max(m, k.id), 0) + 1;
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

/** Kişinin onaylı bir ayda görevi var mı (varsa silinmez, ayrılış tarihi girilir) */
export function onayliGoreviVar(id: number): string[] {
  return Object.values(depo.veri.schedules)
    .filter(c => c.onay && c.days.some(g => [...g.assigned, ...g.prep].some(p => p.id === id)))
    .map(c => ayAnahtari(c.year, c.month));
}

export function kisiSil(id: number) {
  depo.veri.staff = depo.veri.staff.filter(k => k.id !== id);
  for (const k of Object.keys(depo.veri.prefs)) if (k.startsWith(id + "-")) delete depo.veri.prefs[k];
  for (const c of Object.values(depo.veri.schedules)) {
    if (c.onay) continue;
    for (const g of c.days) { g.assigned = g.assigned.filter(p => p.id !== id); g.prep = g.prep.filter(p => p.id !== id); }
  }
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
}
export function onayiKaldir(y: number, m: number) {
  const c = ayCizelgesi(y, m);
  if (c) delete c.onay;
}

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
export function yedektenYukle(metin: string): { tamam: true } | { tamam: false; hata: string } {
  let o: any;
  try { o = JSON.parse(metin); } catch { return { tamam: false, hata: "Dosya okunamadı: geçerli bir yedek dosyası değil." }; }
  if (!o || o.uygulama !== "nobet-cizelgesi-v2" || !o.veri) return { tamam: false, hata: "Bu dosya bu uygulamanın yedeği değil." };
  depo.veri = veriyiDogrula(o.veri);
  return { tamam: true };
}
export function tumVeriyiSil() {
  depo.veri = bosVeri();
}

/** Uygulamayı denemek için örnek kadro: 6 eczacı, 6 tekniker. Ekranda "örnek" diye belirtilir. */
export function ornekKadroYukle() {
  const v = bosVeri();
  v.ornek = true;
  v.kurum.ad = "Örnek Hastane Eczanesi";
  const ecz = ["Ayşe Yılmaz", "Mehmet Kaya", "Zeynep Demir", "Ali Çelik", "Elif Şahin", "Murat Arslan"];
  const tek = ["Fatma Koç", "Emre Aydın", "Selin Öztürk", "Burak Yıldız", "Hülya Kurt", "Can Polat"];
  ecz.forEach((name, i) => v.staff.push({ id: i + 1, name, role: "eczaci" }));
  tek.forEach((name, i) => v.staff.push({ id: i + 7, name, role: "teknisyen" }));
  depo.veri = v;
}
