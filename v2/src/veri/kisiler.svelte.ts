// Kişiler: ekleme, güncelleme (çizelgelerdeki ad ve görev de), silme (onaylı aylarda kaydı olan silinmez); ay içinde çalışanlar.
// Durum ve kayıt: depo.svelte.ts (oradan da dışa verilir).
import type { Kisi, Rol } from "./tipler";
import { ayAnahtari, gunSayisi } from "./tarih";
import { oglenOnayli } from "./listeler.svelte";
import { depo } from "./depo.svelte";

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

// ---------- ay içi sayımlar ----------

/** Ayda çalışan (başlangıç–bitiş aralığı ayla kesişen) kişiler */
export function aydaCalisanlar(y: number, m: number): Kisi[] {
  const ilk = `${y}-${String(m + 1).padStart(2, "0")}-01`, son = `${y}-${String(m + 1).padStart(2, "0")}-${String(gunSayisi(y, m)).padStart(2, "0")}`;
  return depo.veri.staff.filter(k => !(k.baslangic && k.baslangic > son) && !(k.bitis && k.bitis < ilk));
}
