// Servis hazırlama: motorun (src/motor/cizelge.js, servis bölümü) hesapladığı ay kayıtlarını ve servis ayarlarını saklar.
// Motor verinin kopyasıyla çalışır; burada yalnız değişen ay kaydı depo.veri.servisKayit'e yazılır.
import { depo } from "./depo.svelte";
import { servisAyHesapla, servisIslem, servisListesi, servisYillik } from "../motor/cizelge.js";
import type { ServisAyKaydi } from "./tipler";

export type ServisIslemi =
  | { tur: "kisi"; gun: number; id: number }
  | { tur: "karistir" | "yeniden" | "ataSifirla"; gun: number }
  | { tur: "ngun"; gun: number; n: number }
  | { tur: "ata"; gun: number; sn: string; hedef: number; karsilik: string | null }
  | { tur: "oto"; gun: number; sn: string }
  | { tur: "olustur"; gun?: number };

export interface ServisBilgisi { id: number; name: string; z: number; h: number; multi: boolean; on: boolean; z0: number; h0: number; multi0: boolean; ekstra: boolean; yb: boolean; zor: boolean; grup: boolean }

const anahtar = (y: number, m: number) => `${y}-${m}`;
const kopya = () => $state.snapshot(depo.veri);

/** Ayın dağıtımını puantaja ve ayarlara göre günceller; değiştiyse kaydeder. */
export function servisAyiniGuncelle(y: number, m: number): { cizelgeVar: boolean; kayitVar: boolean } {
  const r = servisAyHesapla(kopya(), y, m, {}) as { cizelgeVar: boolean; kayit: ServisAyKaydi | null; degisti: boolean; sil?: boolean };
  if (r.sil) delete depo.veri.servisKayit[anahtar(y, m)];
  else if (r.degisti && r.kayit) depo.veri.servisKayit[anahtar(y, m)] = r.kayit;
  return { cizelgeVar: r.cizelgeVar, kayitVar: !!depo.veri.servisKayit[anahtar(y, m)] };
}

export function servisIslemYap(y: number, m: number, islem: ServisIslemi) {
  const kayit = servisIslem(kopya(), y, m, islem) as ServisAyKaydi | null;
  if (kayit) depo.veri.servisKayit[anahtar(y, m)] = kayit;
}

export const servisler = () => servisListesi(kopya()) as ServisBilgisi[];

/** Servisin zorluk, hasta sayısı, çok günlük ve hazırlanıyor ayarı */
export function servisAyariYaz(s: Pick<ServisBilgisi, "name" | "z" | "h" | "multi" | "on">) {
  depo.veri.servisAyar.svc[s.name] = { z: s.z, h: s.h, multi: s.multi, on: s.on };
}
export function servisEkle(ad: string, z: number, h: number, multi: boolean): string | null {
  const name = ad.trim().toLocaleUpperCase("tr").slice(0, 40);
  if (!name) return "Servis adını yazın.";
  if (servisler().some(s => s.name.toLocaleUpperCase("tr") === name)) return "Bu adda servis zaten var.";
  depo.veri.servisAyar.ekstra.push({ name, z: Math.max(1, Math.min(10, Math.round(z) || 1)), h: Math.max(0, Math.min(999, Math.round(h) || 0)), multi });
  return null;
}
export function servisSil(name: string) {
  depo.veri.servisAyar.ekstra = depo.veri.servisAyar.ekstra.filter(e => e.name !== name);
  delete depo.veri.servisAyar.svc[name];
}
export function servisAyarlariniSifirla() { depo.veri.servisAyar.svc = {}; }

export interface ServisYilRaporu {
  kayitli: number; bosAy: boolean[];
  kisi: { id: number; ad: string; ay: ({ gun: number; w: number; l: number } | null)[]; gun: number; l: number; fl: number; w: number; y: number; adet: number; sapma: number }[];
  matris: { servisler: { sn: string; grup: "yb" | "cok" | "tek"; say: Record<string, number>; pay: Record<string, number> }[]; gun: Record<string, number> };
}
/** Yılın raporu: önce çizelgesi olan ayların dağıtımı güncellenir ve kaydedilir */
export function servisYilRaporu(yil: number): ServisYilRaporu {
  const r = servisYillik(kopya(), yil) as ServisYilRaporu & { kayitlar: Record<string, ServisAyKaydi | null> };
  for (const [k, v] of Object.entries(r.kayitlar)) { if (v) depo.veri.servisKayit[k] = v; else delete depo.veri.servisKayit[k]; }
  return r;
}
