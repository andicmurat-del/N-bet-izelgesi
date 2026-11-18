// Günlük eczane nöbet çizelgesi: kayıt, eskime nedenleri, gün düzenleme ve kilit, onay.
// Durum ve kayıt: depo.svelte.ts (oradan da dışa verilir).
import type { AyCizelgesi, GunDuzeni, Gorevli } from "./tipler";
import { ayAnahtari, gunSayisi } from "./tarih";
import { Baglam, eczaneHazirlamacisi, eczaneNobetcisi, gunNobetFm } from "../motor/baglam";
import { gunDuzeniDogrula } from "./dogrulama";
import { tatilMi } from "./izinler.svelte";
import { depo, gecmisiSifirla, veriAnlik } from "./depo.svelte";

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
