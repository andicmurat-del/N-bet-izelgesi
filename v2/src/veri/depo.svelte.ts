// Uygulama durumu ve tarayıcıda saklanması. Veriler yalnız bu tarayıcıda durur; taşımak için yedek dosyası kullanılır.
import type { AyCizelgesi, Ayarlar, GunDuzeni, Gorevli, Kisi, OglenGunu, OglenSabit, PuantajKodu, Rol, Tercih, Veri } from "./tipler";
import { ayAnahtari, gunAnahtari, gunSayisi, haftaAnahtari, haftaIciGunleri, haftaSonuMu, tercihAnahtari } from "./tarih";
import { oglenOnarimlariHesapla } from "../motor";
import { Baglam, eczaneHazirlamacisi, eczaneNobetcisi, gunNobetFm } from "../motor/baglam";

const ANAHTAR = "nobet-cizelgesi-v2";

// biçim ve doğrulama ayrı modülde (veri/dogrulama.ts); eski içe aktarmalar bozulmasın diye buradan da verilir
export { AYAR_VARSAYILAN, AYAR_SINIR, bosVeri, guvenliJson, gunDuzeniDogrula, veriyiDogrula } from "./dogrulama";
import { bosVeri, guvenliJson, gunDuzeniDogrula, oglenSabitDogrula, veriyiDogrula } from "./dogrulama";
import { diniBayramlarVar, yilinTatilleri } from "./resmiTatiller";

let acilisSorunu = "";
function yukle(): Veri {
  let s: string | null = null;
  try { s = localStorage.getItem(ANAHTAR); } catch { return bosVeri(); }
  if (!s) return bosVeri();
  try { return veriyiDogrula(guvenliJson(s)); }
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
  /** veriler başka bir pencerede (sekmede) değişti: bu pencere kaydetmez, yenilenmesi gerekir */
  baskaPencere: false,
});

/** Düz (proxy'siz) derin kopya. Svelte'in anlık görüntü işlevi her yaprak değerde structuredClone çağırdığından büyük
 *  veride çok yavaş; veri yalnız düz nesne, dizi ve ilkel değerlerden oluşur (JSON'a yazılan biçim). */
export function duzKopya<T>(x: T): T {
  if (Array.isArray(x)) { const k = new Array(x.length); for (let i = 0; i < x.length; i++) k[i] = duzKopya(x[i]); return k as T; }
  if (x !== null && typeof x === "object") { const k: Record<string, unknown> = {}; for (const a of Object.keys(x)) k[a] = duzKopya((x as Record<string, unknown>)[a]); return k as T; }
  return x;
}
/** Durum (state) nesnesinde k alanını yoksa kurar ve alanın kendisini (izlenen hâlini) verir. "(o[k] ??= {})" atanan ham
 *  nesneyi döndürür; ona yazılan değişiklik izlenmez (Svelte uyarısı: assignment_value_stale). */
export function alan<T>(o: Record<string, T>, k: string | number, yeni: () => NoInfer<T>): T {
  if (o[k] === undefined) o[k] = yeni();
  return o[k];
}
// Verinin tek ortak kopyası: veri değişince bir kez alınır; motor hesapları (yalnız okur), kayıt ve geri alma bunu kullanır.
// Bu kopya değiştirilmez: üzerinde değişiklik yapacak iş duzKopya(depo.veri) ile kendi kopyasını alır.
const anlik = $derived(duzKopya(depo.veri));
export const veriAnlik = (): Veri => anlik;

/** Sonradan girilen izin / rapor vb. öğlen nöbetini bozduysa bugünden sonraki eksikler kendiliğinden doldurulur
 *  (elle düzenlenen ve geçmiş günler değişmez); onarım, onu doğuran değişiklikle aynı geri alma adımına girer. */
function oglenOnar() {
  if (!Object.keys(depo.veri.oglen).length) return;
  const b = new Date();
  try {
    for (const o of oglenOnarimlariHesapla(veriAnlik(), b.getFullYear() * 10000 + (b.getMonth() + 1) * 100 + b.getDate()))
      oglenKaydet(o.y, o.m, o.gunler, true);
  } catch { /* onarım yapılamazsa kayıt yine yazılır; ekranda bozuk günler işaretli kalır */ }
}
let kayitZamanlayici: ReturnType<typeof setTimeout> | undefined;
function simdiKaydet() {
  clearTimeout(kayitZamanlayici);
  kayitZamanlayici = undefined;
  // başka pencere yeni veriyi yazdıysa bu penceredeki eski veriyle üzerine yazılmaz
  if (depo.baskaPencere) return;
  oglenOnar();
  gecmiseIsle();
  try {
    localStorage.setItem(ANAHTAR, JSON.stringify(veriAnlik()));
    if (depo.kayitSorunu !== acilisSorunu && !depo.baskaPencere) depo.kayitSorunu = "";
  } catch {
    depo.kayitSorunu = "Veriler bu tarayıcıya kaydedilemedi (gizli pencere ya da depolama dolu olabilir). Sayfayı kapatmadan önce Ayarlar'dan yedek alın.";
  }
}
function kaydet() {
  clearTimeout(kayitZamanlayici);
  kayitZamanlayici = setTimeout(simdiKaydet, 150);
}
/** Bekleyen kayıt varsa hemen yazar: değişiklikten hemen sonra sayfa kapanır ya da arka plana alınırsa (telefonda sekme
 *  kapatma, uygulama değiştirme) son değişiklik kaybolmasın */
export function bekleyenKaydiYaz() { if (kayitZamanlayici !== undefined) simdiKaydet(); }
$effect.root(() => {
  $effect(() => {
    veriAnlik();
    kaydet();
  });
});
// aynı tarayıcıda başka bir pencere (sekme) veriyi değiştirince: bu pencere kaydetmeyi durdurur ve uyarır
export const BASKA_PENCERE_UYARISI = "Veriler başka bir pencerede değiştirildi. Bu penceredeki değişiklikler artık kaydedilmiyor; güncel verilerle devam etmek için sayfayı yenileyin.";
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", bekleyenKaydiYaz);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") bekleyenKaydiYaz(); });
}
if (typeof window !== "undefined") window.addEventListener("storage", e => {
  if (e.key !== ANAHTAR && e.key !== null) return;
  clearTimeout(kayitZamanlayici);
  kayitZamanlayici = undefined;
  depo.baskaPencere = true;
  depo.kayitSorunu = BASKA_PENCERE_UYARISI;
});

// ---------- geri al / yinele (eski uygulamadaki gibi) ----------
// Her kayıtta verinin görüntüsü alınır. Servis dağıtım kaydı görüntüye girmez: puantaja göre kendiliğinden
// yeniden hesaplanır. Art arda çok hızlı değişiklikler (sürükleyerek işaretleme, yazı yazma) tek adım sayılır.
// Onay bir geri alma noktasıdır: onaydan önceki adımlara dönülmez, geri alma onayı kaldırmaz.
// Geçmiş yalnız bu oturumda tutulur (sayfa yenilenince sıfırlanır).
const GECMIS_SINIR = 30, GRUPLAMA_MS = 350;
export const gecmis = $state({ geri: [] as string[], ileri: [] as string[] });
let sonGoruntu: string | null = null, sonEkleme = 0;
const goruntu = () => JSON.stringify({ ...veriAnlik(), servisKayit: undefined });

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
  const simdi = duzKopya(depo.veri);
  const v = veriyiDogrula(JSON.parse(t));
  v.servisKayit = simdi.servisKayit;
  // onay geri alma ile değişmez: onaylı çizelge olduğu gibi kalır, onaysız ayın onayı geri gelmez
  for (const [k, c] of Object.entries(simdi.schedules)) if (c.onay) v.schedules[k] = c;
  for (const [k, c] of Object.entries(v.schedules)) if (c.onay && !simdi.schedules[k]?.onay) delete c.onay;
  // acil / öğlen listesi onayı da geri almayla değişmez: onaylı ayın listesi ve onayı olduğu gibi kalır
  v.listeOnay = simdi.listeOnay;
  for (const ayK of Object.keys(simdi.listeOnay.acil)) {
    if (simdi.acil[ayK]) v.acil[ayK] = simdi.acil[ayK]; else delete v.acil[ayK];
    if (simdi.acilElle[ayK]) v.acilElle[ayK] = simdi.acilElle[ayK]; else delete v.acilElle[ayK];
  }
  // öğlen nöbeti: onaylı haftalar olduğu gibi kalır; onay listesi onaysız haftada öğlen nöbeti olmaz
  const ogGunleri = (x: Veri) => Object.entries(x.oglen).flatMap(([ayK, a]) => { const [y, m] = ayK.split("-").map(Number); return Object.keys(a).map(g => ({ y, m, g: Number(g), ayK })); });
  for (const { y, m, g, ayK } of ogGunleri(v)) if (simdi.listeOnay.oglen[haftaAnahtari(y, m, g)] || !simdi.listeOnay.onay[haftaAnahtari(y, m, g)]) { delete v.oglen[ayK][g]; if (!Object.keys(v.oglen[ayK]).length) delete v.oglen[ayK]; }
  for (const { y, m, g, ayK } of ogGunleri(simdi)) if (simdi.listeOnay.oglen[haftaAnahtari(y, m, g)]) (v.oglen[ayK] ??= {})[g] = simdi.oglen[ayK][g];
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
  for (const a of Object.values(v.oglen)) for (const g of Object.values(a)) [...g.e, ...g.t].forEach(al);
  for (const d of v.degisimler) { al(d.cik); al(d.yer); }
  for (const a of Object.values(v.onayMasa.yerlesim)) Object.keys(a).forEach(al);
  for (const a of Object.values(v.onayMasa.elle)) Object.keys(a).forEach(al);
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
  if (!k.cumaMuaf) delete k.cumaMuaf;
  if (!k.acilTutar || !(k.role === "eczaci" || k.role === "nobetci")) delete k.acilTutar;
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
    .map(c => ayAnahtari(c.year, c.month))
    .concat(Object.keys(depo.veri.listeOnay.acil).filter(ayK => Object.values(depo.veri.acil[ayK] ?? {}).some(l => l.includes(id))))
    .concat(Object.entries(depo.veri.oglen).filter(([ayK, a]) => { const [y, m] = ayK.split("-").map(Number); return Object.entries(a).some(([g, x]) => oglenOnayli(y, m, Number(g)) && (x.e.includes(id) || x.t.includes(id))); }).map(([ayK]) => ayK))
    .filter((k, i, a) => a.indexOf(k) === i);
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
    if (depo.veri.listeOnay.acil[ayK]) continue;
    for (const [g, l] of Object.entries(a)) { a[g] = l.filter(x => x !== id); if (!a[g].length) delete a[g]; }
    if (!Object.keys(a).length) delete depo.veri.acil[ayK];
  }
  // öğlen nöbetinin kendi (haftalık) onayı var: yalnız onaylı haftalar korunur
  for (const [ayK, a] of Object.entries(depo.veri.oglen)) {
    const [y, m] = ayK.split("-").map(Number);
    for (const [g, x] of Object.entries(a)) { if (oglenOnayli(y, m, Number(g))) continue; x.e = x.e.filter(i => i !== id); x.t = x.t.filter(i => i !== id); if (!x.e.length && !x.t.length) delete a[g]; }
    if (!Object.keys(a).length) delete depo.veri.oglen[ayK];
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

// ---------- resmi tatillerin kendiliğinden işaretlenmesi ----------
/** Yılın resmi tatillerini ve arifelerini işaretler (veri/resmiTatiller.ts). Çizelgesi ya da acil listesi onaylı aylara
 *  dokunulmaz; kendiliginden: geçmiş ayların çizelgesi varsa onlara da dokunulmaz (o aylar elle işaretlenmiştir). Zaten
 *  işaretli günler sayılmaz. Yıl "işaretlendi" olarak kaydedilir: sonradan elle kaldırılan gün yeniden işaretlenmez. */
export function resmiTatilleriIsaretle(yil: number, secenek: { kendiliginden?: boolean } = {}): { isaretlenen: number; atlananAylar: number[] } {
  const b = new Date(), buAy = b.getFullYear() * 12 + b.getMonth();
  let n = 0;
  const atlanan = new Set<number>();
  for (const t of yilinTatilleri(yil)) {
    const c = ayCizelgesi(t.y, t.m);
    if (c?.onay || depo.veri.listeOnay.acil[ayAnahtari(t.y, t.m)]) { atlanan.add(t.m); continue; }
    if (secenek.kendiliginden && c && t.y * 12 + t.m < buAy) continue;
    if (t.arife) {
      if (!haftaSonuMu(t.y, t.m, t.d) && !resmiTatilMi(t.y, t.m, t.d) && !arifeMi(t.y, t.m, t.d)) { arifeAyarla(t.y, t.m, t.d, true); n++; }
    } else if (!resmiTatilMi(t.y, t.m, t.d)) { resmiTatilAyarla(t.y, t.m, t.d, true); n++; }
  }
  depo.veri.tatilYillari[String(yil)] = true;
  return { isaretlenen: n, atlananAylar: [...atlanan].sort((a, c) => a - c) };
}
/** yıl daha önce işaretlenmediyse (ve ayar açıksa, yıl tabloda varsa) kendiliğinden işaretler; işaretlenmediyse null */
export function tatilleriKendiligindenIsaretle(yil: number) {
  if (depo.veri.settings.tatilOtomatik === false || depo.veri.tatilYillari[String(yil)] || !diniBayramlarVar(yil)) return null;
  return resmiTatilleriIsaretle(yil, { kendiliginden: true });
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
  // arife (ya da komşu günün tatili) sonradan işaretlendiyse nöbetin fazla mesai saati değişir (çizelge eski saati tutar)
  const B = new Baglam(veriAnlik()), dim = gunSayisi(y, m);
  const saatFarki = c.days.filter(g => !tatilFarki.includes(g.day) && g.fmNobet === undefined && g.fazlaMesai !== B.fazlaMesai(y, m, g.day, dim)).map(g => g.day);
  if (saatFarki.length) n.push(`Arife ya da tatil değişikliği nedeniyle şu günlerin nöbet fazla mesaisi değişti: ${saatFarki.join(", ")}.`);
  const idler = new Set(depo.veri.staff.map(k => k.id));
  const silinen = new Set<string>();
  for (const g of c.days) for (const p of [...g.assigned, ...g.prep]) if (!idler.has(p.id)) silinen.add(p.name);
  if (silinen.size) n.push(`Çizelgede artık listede olmayan kişiler var: ${[...silinen].join(", ")}.`);
  // görevi sonradan değişen (ör. acil servis personeli, destek ya da acilde nöbet tutan yapılan) kişi eczane görevinde kaldıysa
  const kisi = new Map(depo.veri.staff.map(k => [k.id, k]));
  const uygunsuz = new Set<string>();
  for (const g of c.days) {
    for (const p of g.assigned) { const k = kisi.get(p.id); if (k && !eczaneNobetcisi(k)) uygunsuz.add(k.name); }
    for (const p of g.prep) { const k = kisi.get(p.id); if (k && !eczaneHazirlamacisi(k) && k.role !== "destek") uygunsuz.add(k.name); }
  }
  if (uygunsuz.size) n.push(`Görevi değiştiği için artık eczane nöbeti tutmayan kişiler çizelgede: ${[...uygunsuz].join(", ")}.`);
  return n;
}

/** Çizelgenin (kopyasının) günlerindeki nöbet fazla mesaisini takvimden yeniden yazar (elle yazılan saat korunur):
 *  çizelge kaydedildikten sonra işaretlenen arife / tatil de çıktılara ve özetlere doğru saatle girsin. c değişir. */
export function saatleriGuncelle<T extends AyCizelgesi>(c: T): T {
  const B = new Baglam(veriAnlik()), dim = gunSayisi(c.year, c.month);
  c.days.forEach(g => { g.fazlaMesai = gunNobetFm(B, c.year, c.month, g, dim); });
  return c;
}

/** Oluşturulan çizelgeyi kaydeder. Ay bu arada onaylandıysa (oluşturma sürerken başka sayfaya geçilip onaylanabilir)
 *  yazılmaz: false döner */
export function cizelgeKaydet(y: number, m: number, days: AyCizelgesi["days"], uyarilar: string[]): boolean {
  if (ayCizelgesi(y, m)?.onay) return false;
  depo.veri.schedules[ayAnahtari(y, m)] = { year: y, month: m, days, uyarilar, olusturma: Date.now() };
  return true;
}

/** Günü elle düzenler (gün kilitlenir: yeniden oluşturmada korunur). duzen: tatil gününde elle belirlenen nöbetçi /
 *  hazırlama sayısı ve fazla mesai saatleri (verilmezse günün kayıtlı düzeni kalır; null: düzen kaldırılır) */
export function gunuGuncelle(y: number, m: number, gun: number, nobetciler: Gorevli[], hazirlama: Gorevli[], duzen?: GunDuzeni | null) {
  const c = ayCizelgesi(y, m);
  if (!c || c.onay) return;
  const g = c.days[gun - 1];
  g.assigned = nobetciler;
  g.prep = hazirlama;
  g.locked = true;
  if (duzen !== undefined) {
    const d = gunDuzeniDogrula(duzen as Record<string, unknown> | null);
    for (const k of ["nobetSay", "hazSay", "fmNobet", "fmHaz"] as const) { if (d[k] !== undefined) g[k] = d[k]; else delete g[k]; }
    g.fazlaMesai = d.fmNobet ?? new Baglam(veriAnlik()).fazlaMesai(y, m, gun, gunSayisi(y, m));
  }
}
/** Gün otomatiğe döner: kilit ve elle düzen (sayılar, saatler) kalkar; yeniden oluşturmada gün baştan yazılır */
export function gunKilidiniKaldir(y: number, m: number, gun: number) {
  const c = ayCizelgesi(y, m);
  if (!c || c.onay) return;
  const g = c.days[gun - 1];
  g.locked = false;
  if (g.nobetSay !== undefined || g.hazSay !== undefined || g.fmNobet !== undefined || g.fmHaz !== undefined) {
    delete g.nobetSay; delete g.hazSay; delete g.fmNobet; delete g.fmHaz;
    g.fazlaMesai = new Baglam(veriAnlik()).fazlaMesai(y, m, gun, gunSayisi(y, m));
  }
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

// ---------- acil eczane listesi (aylık), öğlen nöbeti ve onay listesi (haftalık) onayı ----------
// Onaylanan liste elle değiştirilemez, yeniden oluşturulmaz ve silinemez (önce onay kaldırılır). Öğlen nöbetinde
// sonradan girilen izin / rapor yine kendiliğinden onarılır (kişi gerçekte yoktur); acil listesinde gün uyarılı kalır.
// Onay listesi onaylıyken de canlıdır: sonradan girilen izin / rapor masaları yine değiştirir; yalnız elle değiştirilemez.
export type ListeTuru = "acil";
export const listeOnayi = (tur: ListeTuru, y: number, m: number) => depo.veri.listeOnay[tur][ayAnahtari(y, m)];
export function listeyiOnayla(tur: ListeTuru, y: number, m: number) {
  depo.veri.listeOnay[tur][ayAnahtari(y, m)] = { zaman: Date.now(), kim: depo.veri.kurum.onaylayan };
  gecmisiSifirla();   // onay bir geri alma noktasıdır
}
export function listeOnayiniKaldir(tur: ListeTuru, y: number, m: number) { delete depo.veri.listeOnay[tur][ayAnahtari(y, m)]; }
export type HaftaListesi = "oglen" | "onay";
/** günün haftasının onayı (öğlen nöbeti ya da onay listesi) */
export const haftaOnayi = (tur: HaftaListesi, y: number, m: number, d: number) => depo.veri.listeOnay[tur][haftaAnahtari(y, m, d)];
const oglenOnayli = (y: number, m: number, d: number) => !!depo.veri.listeOnay.oglen[haftaAnahtari(y, m, d)];
export function haftayiOnayla(tur: HaftaListesi, y: number, m: number, d: number) {
  if (tur === "oglen" && !haftaOnayi("onay", y, m, d)) return;
  depo.veri.listeOnay[tur][haftaAnahtari(y, m, d)] = { zaman: Date.now(), kim: depo.veri.kurum.onaylayan };
  gecmisiSifirla();
}
/** haftanın onayını kaldırır; onay listesinin onayı kalkınca o haftanın öğlen nöbeti (onayıyla birlikte) silinir */
export function haftaOnayiniKaldir(tur: HaftaListesi, y: number, m: number, d: number) {
  const k = haftaAnahtari(y, m, d);
  delete depo.veri.listeOnay[tur][k];
  if (tur === "onay") { delete depo.veri.listeOnay.oglen[k]; oglenHaftasiniSil(y, m, d); }
}

// ---------- acil eczane nöbeti ----------
export const acilGunu = (y: number, m: number, gun: number): number[] => depo.veri.acil[ayAnahtari(y, m)]?.[gun] ?? [];
/** acil nöbet gününü elle ayarlar; elle: gün otomatik oluşturmada korunur (temizlenen gün korunmaz).
 *  onayliDuzeltme: onaylı ayda yalnız sonradan yazılamaz hâle gelen kişinin yerine başkası yazılırken */
export function acilGunuAyarla(y: number, m: number, gun: number, ids: number[], elle = true, onayliDuzeltme = false) {
  if (listeOnayi("acil", y, m) && !onayliDuzeltme) return;
  const ayK = ayAnahtari(y, m), tek = [...new Set(ids)].slice(0, 2);
  if (elle && tek.length) alan(depo.veri.acilElle, ayK, () => ({}))[gun] = true;
  else if (depo.veri.acilElle[ayK]) { delete depo.veri.acilElle[ayK][gun]; if (!Object.keys(depo.veri.acilElle[ayK]).length) delete depo.veri.acilElle[ayK]; }
  if (tek.length) { alan(depo.veri.acil, ayK, () => ({}))[gun] = tek; return; }
  const a = depo.veri.acil[ayK];
  if (!a) return;
  delete a[gun];
  if (!Object.keys(a).length) delete depo.veri.acil[ayK];
}
export function acilAyiniSil(y: number, m: number) { if (listeOnayi("acil", y, m)) return; delete depo.veri.acil[ayAnahtari(y, m)]; delete depo.veri.acilElle[ayAnahtari(y, m)]; }
export const acilElleMi = (y: number, m: number, gun: number) => !!depo.veri.acilElle[ayAnahtari(y, m)]?.[gun];
/** otomatik oluşturulan acil nöbet listesini kaydeder (elle günler olduğu gibi gelir) */
export function acilKaydet(y: number, m: number, gunler: { gun: number; ids: number[] }[]) {
  if (listeOnayi("acil", y, m)) return;
  const a: Record<string, number[]> = {};
  gunler.forEach(g => { if (g.ids.length) a[g.gun] = g.ids.slice(0, 2); });
  if (Object.keys(a).length) depo.veri.acil[ayAnahtari(y, m)] = a; else delete depo.veri.acil[ayAnahtari(y, m)];
}

// ---------- onay listesi masaları ----------
/** günün yerlerini elle kaydeder (gun: "YYYY-AA-GG"; kişi id → yer "1"–"7" ya da "J"); null: gün otomatiğe döner */
export function onayGunuAyarla(gun: string, yer: Record<number, string> | null) {
  const [gy, gm, gd] = gun.split("-").map(Number);
  if (haftaOnayi("onay", gy, gm - 1, gd)) return;
  if (!yer || !Object.keys(yer).length) { delete depo.veri.onayMasa.elle[gun]; return; }
  depo.veri.onayMasa.elle[gun] = Object.fromEntries(Object.entries(yer).map(([id, y]) => [id, y]));
}

// ---------- öğlen nöbeti ----------
/** onarim: izin / rapor sonrası kendiliğinden onarım (onaylı ayda da yapılır) */
type OglenKaydi = { gun: number; e: number[]; t: number[]; elle?: true; sabit?: OglenSabit };
const oglenKaydiYaz = (a: Record<string, OglenGunu>, g: OglenKaydi) => {
  if (g.e.length || g.t.length || g.elle || g.sabit) a[g.gun] = { e: g.e.slice(), t: g.t.slice(), ...(g.elle ? { elle: true as const } : {}), ...(g.sabit ? { sabit: duzKopya(g.sabit) } : {}) };
  else delete a[g.gun];
};
/** ayın öğlen nöbeti kaydını yazar. onarim: izin / rapor sonrası kendiliğinden onarım (onaylı haftada da yapılır);
 *  onarım değilse onaylı haftaların ve onay listesi onaysız haftaların günleri değişmez */
export function oglenKaydet(y: number, m: number, gunler: OglenKaydi[], onarim = false) {
  const ayK = ayAnahtari(y, m), eski = depo.veri.oglen[ayK] ?? {}, a: Record<string, OglenGunu> = {};
  const kilitli = (d: number) => !onarim && (oglenOnayli(y, m, d) || !haftaOnayi("onay", y, m, d));
  for (const [g, x] of Object.entries(eski)) if (kilitli(Number(g))) a[g] = x;
  gunler.forEach(g => { if (!kilitli(g.gun)) oglenKaydiYaz(a, g); });
  if (Object.keys(a).length) depo.veri.oglen[ayK] = a; else delete depo.veri.oglen[ayK];
}
/** bir haftanın öğlen nöbetini yazar (oglenHaftaHesapla parçaları: ay sınırını aşan hafta iki ay); haftanın onay listesi
 *  onaylı değilse ya da öğlen nöbeti onaylıysa yazılmaz */
export function oglenHaftaKaydet(parcalar: { y: number; m: number; bas: number; bit: number; gunler: OglenKaydi[] }[]) {
  const p0 = parcalar[0];
  if (!p0 || oglenOnayli(p0.y, p0.m, p0.bas) || !haftaOnayi("onay", p0.y, p0.m, p0.bas)) return;
  for (const p of parcalar) {
    const ayK = ayAnahtari(p.y, p.m), a = { ...(depo.veri.oglen[ayK] ?? {}) };
    for (let d = p.bas; d <= p.bit; d++) delete a[d];
    p.gunler.forEach(g => { if (g.gun >= p.bas && g.gun <= p.bit) oglenKaydiYaz(a, g); });
    if (Object.keys(a).length) depo.veri.oglen[ayK] = a; else delete depo.veri.oglen[ayK];
  }
}
/** günün haftasının öğlen nöbetini siler (onaylıysa silinmez) */
export function oglenHaftasiniSil(y: number, m: number, d: number) {
  if (oglenOnayli(y, m, d)) return;
  for (const [a, b, c] of haftaIciGunleri(y, m, d)) {
    const ayK = ayAnahtari(a, b), k = depo.veri.oglen[ayK];
    if (!k) continue;
    delete k[c];
    if (!Object.keys(k).length) delete depo.veri.oglen[ayK];
  }
}
/** bir günü elle düzenler. sabit: elle belirlenen yerler (yeniden oluşturma ve onarım yalnız bunlara dokunmaz; günün
 *  geri kalanı yeniden yazılabilir); null: gün tamamen otomatiğe bırakılır */
export function oglenGunuAyarla(y: number, m: number, gun: number, e: number[], t: number[], sabit: OglenSabit | null) {
  if (oglenOnayli(y, m, gun) || !haftaOnayi("onay", y, m, gun)) return;
  const a = alan(depo.veri.oglen, ayAnahtari(y, m), () => ({}));
  const E = [...new Set(e)], T = [...new Set(t)], sb = sabit ? oglenSabitDogrula(sabit, E, T) : undefined;
  a[gun] = { e: E, t: T, ...(sb ? { sabit: sb } : {}) };
}

// ---------- puantaj ----------
export function puantajKoduAyarla(y: number, m: number, id: number, gun: number, kod: PuantajKodu | null) {
  const ayK = ayAnahtari(y, m);
  if (kod) { alan(alan(depo.veri.puantaj, ayK, () => ({})), id, () => ({}))[gun] = kod; return; }
  const a = depo.veri.puantaj[ayK]?.[id];
  if (!a) return;
  delete a[gun];
  if (!Object.keys(a).length) delete depo.veri.puantaj[ayK][id];
  if (!Object.keys(depo.veri.puantaj[ayK]).length) delete depo.veri.puantaj[ayK];
}
export const puantajElleKodu = (y: number, m: number, id: number, gun: number): PuantajKodu | undefined => depo.veri.puantaj[ayAnahtari(y, m)]?.[id]?.[gun];

// ---------- ay içi sayımlar ----------

/** Ayda çalışan (başlangıç–bitiş aralığı ayla kesişen) kişiler */
export function aydaCalisanlar(y: number, m: number): Kisi[] {
  const ilk = `${y}-${String(m + 1).padStart(2, "0")}-01`, son = `${y}-${String(m + 1).padStart(2, "0")}-${String(gunSayisi(y, m)).padStart(2, "0")}`;
  return depo.veri.staff.filter(k => !(k.baslangic && k.baslangic > son) && !(k.bitis && k.bitis < ilk));
}

// ---------- yedek ----------
export function yedekVerisi(): string {
  return JSON.stringify({ uygulama: "nobet-cizelgesi-v2", zaman: new Date().toISOString(), veri: veriAnlik() }, null, 1);
}
export function yedektenYukle(metin: string): { tamam: true; atlanan: number } | { tamam: false; hata: string } {
  let o: any;
  try { o = guvenliJson(metin); } catch { return { tamam: false, hata: "Dosya okunamadı: geçerli bir yedek dosyası değil." }; }
  if (!o || o.uygulama !== "nobet-cizelgesi-v2" || !o.veri || typeof o.veri !== "object") return { tamam: false, hata: "Bu dosya bu uygulamanın yedeği değil." };
  if (!Array.isArray(o.veri.staff) || typeof o.veri.schedules !== "object" || !o.veri.schedules) return { tamam: false, hata: "Yedek dosyası eksik ya da bozuk; mevcut veriler değiştirilmedi." };
  const v = veriyiDogrula(o.veri);
  // okunamayıp atlanan kişi ve çizelge sayısı (kullanıcıya söylenir)
  const atlanan = (o.veri.staff.length - v.staff.length) + (Object.keys(o.veri.schedules).length - Object.keys(v.schedules).length);
  tumVeriyiDegistir(v);
  return { tamam: true, atlanan };
}
/** Verinin tamamını dışarıdan gelenle (yedek dosyası, sunucu) değiştirir. Önceki veri bir kez saklanır: yanlış dosya
 *  seçildiyse ya da sunucudan beklenmeyen veri geldiyse geri alınabilir (yuklemeOncesineDon). */
export function tumVeriyiDegistir(v: Veri) {
  try { localStorage.setItem(ANAHTAR + "-yukleme-oncesi", JSON.stringify(veriAnlik())); } catch { /* yer yoksa geçilir */ }
  depo.veri = v;
  gecmisiSifirla();   // yüklemenin kendi geri dönüşü var (yuklemeOncesineDon)
}
/** yüklemeden / sunucudan almadan önceki veri saklı mı */
export function yuklemeOncesiVar(): boolean {
  try { return !!localStorage.getItem(ANAHTAR + "-yukleme-oncesi"); } catch { return false; }
}
/** Yedekten yüklemeden önceki veriye döner (yanlış dosya seçildiyse) */
export function yuklemeOncesineDon(): boolean {
  try {
    const s = localStorage.getItem(ANAHTAR + "-yukleme-oncesi");
    if (!s) return false;
    depo.veri = veriyiDogrula(guvenliJson(s));
    gecmisiSifirla();
    localStorage.removeItem(ANAHTAR + "-yukleme-oncesi");
    return true;
  } catch { return false; }
}
// ---------- yedek hatırlatması ----------
// Son yedeğin zamanı yalnız bu tarayıcıda tutulur (verinin parçası değildir: geri almaya ve sunucuya girmez).
const YEDEK_ANAHTAR = ANAHTAR + "-yedek", GUN_MS = 86400000;
/** bu kadar gündür yedek alınmadıysa hatırlatılır */
export const YEDEK_GUN = 7;
function yedekIziOku(): { son: number; ertele: number } {
  try { const o = JSON.parse(localStorage.getItem(YEDEK_ANAHTAR) || "null"); return { son: Number(o?.son) || 0, ertele: Number(o?.ertele) || 0 }; }
  catch { return { son: 0, ertele: 0 }; }
}
export const yedekIzi = $state(yedekIziOku());
function yedekIziYaz() { try { localStorage.setItem(YEDEK_ANAHTAR, JSON.stringify({ son: yedekIzi.son, ertele: yedekIzi.ertele })); } catch { /* yazılamazsa hatırlatma yeniden çıkar */ } }
/** yedek dosyası kaydedildi */
export function yedekAlindi(simdi = Date.now()) { yedekIzi.son = simdi; yedekIzi.ertele = 0; yedekIziYaz(); }
/** hatırlatma bir gün ertelenir */
export function yedekErtele(simdi = Date.now()) { yedekIzi.ertele = simdi + GUN_MS; yedekIziYaz(); }
/** Yedek hatırlatması: veri varsa ve YEDEK_GUN gündür yedek alınmadıysa (ya da hiç alınmadıysa) geçen gün sayısı
 *  (hiç alınmadıysa -1); hatırlatma gerekmiyorsa null */
export function yedekHatirlatma(simdi = Date.now()): number | null {
  if (!depo.veri.staff.length && !Object.keys(depo.veri.schedules).length) return null;
  if (simdi < yedekIzi.ertele) return null;
  if (!yedekIzi.son) return -1;
  const gun = Math.floor((simdi - yedekIzi.son) / GUN_MS);
  return gun >= YEDEK_GUN ? gun : null;
}

/** Tüm verileri siler. Silinen veri bir kez saklanır: yanlışlıkla silindiyse (sayfa yenilendikten sonra da)
 *  "Önceki verilere dön" ile geri alınabilir; bu oturumda geri al da çalışır. */
export function tumVeriyiSil() {
  try { localStorage.setItem(ANAHTAR + "-yukleme-oncesi", JSON.stringify(veriAnlik())); } catch { /* yer yoksa geçilir */ }
  depo.veri = bosVeri();
}

