// Servis hazırlama: motorun (src/motor/servis) hesapladığı ay kayıtlarını ve servis ayarlarını saklar.
// Motor verinin kopyasıyla çalışır; burada yalnız değişen ay kaydı depo.veri.servisKayit'e yazılır.
import { depo, duzKopya, veriAnlik } from "./depo.svelte";
import { servisAyHesaplaAdim, servisIslem, servisListesi, servisYillikAdim } from "../motor";
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
// motor girdiyi kopyalayarak çalışır: uzun hesaplara paylaşılan anlık kopya (veriAnlik) doğrudan verilir
const kopya = () => duzKopya(depo.veri);

// Ayın dağıtımı pahalıdır (telefonda yarım saniyeyi geçer): veri değişmediyse (paylaşılan anlık kopya aynıysa) son sonuç
// yeniden kullanılır; sekme her açıldığında baştan hesaplanmaz.
let son: { v: object; y: number; m: number; r: { cizelgeVar: boolean; kayitVar: boolean } } | null = null;
/** Önbellekte bu veri ve ay için sonuç varsa döner (hesap yapmaz) */
export function servisAyiOnbellekte(y: number, m: number): { cizelgeVar: boolean; kayitVar: boolean } | null {
  return son && son.v === veriAnlik() && son.y === y && son.m === m ? son.r : null;
}
type AySonucu = { cizelgeVar: boolean; kayit: ServisAyKaydi | null; degisti: boolean; sil?: boolean };
function aySonucunuIsle(y: number, m: number, r: AySonucu) {
  if (r.sil) delete depo.veri.servisKayit[anahtar(y, m)];
  else if (r.degisti && r.kayit) depo.veri.servisKayit[anahtar(y, m)] = r.kayit;
  const sonuc = { cizelgeVar: r.cizelgeVar, kayitVar: !!depo.veri.servisKayit[anahtar(y, m)] };
  // kayıt yazıldıysa anlık kopya yenilenir; yeni kopya bu sonucun karşılığıdır (yeniden hesap aynı kaydı verir)
  son = { v: veriAnlik(), y, m, r: sonuc };
  return sonuc;
}

/** Adım adım hesabı küçük dilimlerle çalıştırır; dilimler arasında ekran çizilir ve dokunuşlar yanıtlanır (donma olmaz). */
function parcaParca<T>(g: Generator<void, T>, dilimMs = 30): Promise<T> {
  return new Promise((coz, reddet) => {
    const adim = () => {
      try {
        const t0 = performance.now();
        for (;;) { const r = g.next(); if (r.done) { coz(r.value); return; } if (performance.now() - t0 > dilimMs) break; }
        setTimeout(adim, 0);
      } catch (e) { reddet(e); }
    };
    setTimeout(adim, 0);
  });
}
/** Ayın dağıtımını puantaja ve ayarlara göre günceller, değiştiyse kaydeder. Ekranı dondurmaz: hesap küçük parçalar
 *  hâlinde yapılır; hesap sürerken veri değişirse yeniden hesaplanır. */
export async function servisAyiniArkadaGuncelle(y: number, m: number): Promise<{ cizelgeVar: boolean; kayitVar: boolean }> {
  for (;;) {
    const v = veriAnlik();
    if (son && son.v === v && son.y === y && son.m === m) return son.r;
    const r = await parcaParca(servisAyHesaplaAdim(v, y, m, {}) as Generator<void, AySonucu>);
    if (veriAnlik() === v) return aySonucunuIsle(y, m, r);
  }
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
// yıllık rapor da aynı veri ve yıl için bir kez hesaplanır (sekmeye yeniden girince bekletmez)
let sonYil: { v: object; yil: number; r: ServisYilRaporu } | null = null;
export function servisYilRaporuOnbellekte(yil: number): ServisYilRaporu | null {
  return sonYil && sonYil.v === veriAnlik() && sonYil.yil === yil ? sonYil.r : null;
}
function yilSonucunuIsle(yil: number, r: ServisYilRaporu & { kayitlar: Record<string, ServisAyKaydi | null> }): ServisYilRaporu {
  for (const [k, v] of Object.entries(r.kayitlar)) { if (v) depo.veri.servisKayit[k] = v; else delete depo.veri.servisKayit[k]; }
  sonYil = { v: veriAnlik(), yil, r };
  return r;
}
/** Yılın raporu (ekranı dondurmadan): çizelgesi olan ayların dağıtımı güncellenir ve kaydedilir */
export async function servisYilRaporuArkada(yil: number): Promise<ServisYilRaporu> {
  for (;;) {
    const v = veriAnlik(), hazir = servisYilRaporuOnbellekte(yil); if (hazir) return hazir;
    const r = await parcaParca(servisYillikAdim(v, yil) as Generator<void, ServisYilRaporu & { kayitlar: Record<string, ServisAyKaydi | null> }>);
    if (veriAnlik() === v) return yilSonucunuIsle(yil, r);
  }
}
