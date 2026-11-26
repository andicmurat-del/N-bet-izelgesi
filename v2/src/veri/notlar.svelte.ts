// Gün notları: sorumlular bir güne not bırakır ("Ayşe ile takas konuşuldu", "Bu gün değişmesin"). Yazan, kullanıcı
// kimliğiyle (ortak klasör kipi dışında bu cihazda yazılan adla) saklanır; notlar bütün sorumlulara görünür, onaylı ayda da
// yazılabilir, çıktılara girmez. Herkes kendi notunu siler; kasanın sahibi bütün notları silebilir.
import type { GunNotu } from "./tipler";
import { ayAnahtari } from "./tarih";
import { NOT_SINIRI } from "./dogrulama";
import { depo } from "./depo.svelte";
import { kimlik, onaylayanKimligi, onaylayanAdi } from "./kimlik.svelte";
import { gunluk } from "./gunluk.svelte";

const BOS: GunNotu[] = [];
export const gunNotlari = (y: number, m: number, d: number): GunNotu[] => depo.veri.notlar[ayAnahtari(y, m)]?.[d] ?? BOS;
/** ayın notlu günleri: gün → not sayısı */
export function notluGunler(y: number, m: number): Record<number, number> {
  const a = depo.veri.notlar[ayAnahtari(y, m)] ?? {};
  return Object.fromEntries(Object.entries(a).map(([g, l]) => [Number(g), l.length]));
}
export function notEkle(y: number, m: number, d: number, metin: string): boolean {
  const t = metin.trim().slice(0, NOT_SINIRI);
  if (!t) return false;
  const ayK = ayAnahtari(y, m);
  const not: GunNotu = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    z: Date.now(),
    ...onaylayanKimligi(),
    metin: t,
  };
  ((depo.veri.notlar[ayK] ??= {})[d] ??= []).push(not);
  return true;
}
/** notu yazan mı (ya da sayfanın sahibi): silebilir */
export const notSilinebilir = (n: GunNotu) =>
  kimlik.rol === "sahip" || (n.kimId ? n.kimId === kimlik.id : !kimlik.var && (!n.kimAd || n.kimAd === gunluk.kullanici));
export function notSil(y: number, m: number, d: number, id: string) {
  const ayK = ayAnahtari(y, m),
    a = depo.veri.notlar[ayK];
  const l = a?.[d];
  if (!a || !l) return;
  const n = l.find(x => x.id === id);
  if (!n || !notSilinebilir(n)) return;
  const kalan = l.filter(x => x.id !== id);
  if (kalan.length) a[d] = kalan;
  else delete a[d];
  if (!Object.keys(a).length) delete depo.veri.notlar[ayK];
}
/** notu yazanın adı */
export const notYazari = (n: GunNotu) =>
  onaylayanAdi({ zaman: n.z, kim: "", ...(n.kimId ? { kimId: n.kimId } : {}), ...(n.kimAd ? { kimAd: n.kimAd } : {}) }) || "Adsız";
