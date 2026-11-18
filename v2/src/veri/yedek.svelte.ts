// Yedek dosyası (alma, yükleme, önceki verilere dönüş), haftalık yedek hatırlatması, tüm verileri silme.
// Durum ve kayıt: depo.svelte.ts (oradan da dışa verilir).
import type { Veri } from "./tipler";
import { KAYIT_ANAHTARI as ANAHTAR } from "./dogrulama";
import { bosVeri, guvenliJson, veriyiDogrula } from "./dogrulama";
import { depo, gecmisiSifirla, veriAnlik } from "./depo.svelte";

// ---------- yedek ----------
export function yedekVerisi(): string {
  return JSON.stringify({ uygulama: "nobet-cizelgesi-v2", zaman: new Date().toISOString(), veri: veriAnlik() }, null, 1);
}
export function yedektenYukle(metin: string): { tamam: true; atlanan: number } | { tamam: false; hata: string } {
  let o: { uygulama?: unknown; veri?: { staff?: unknown; schedules?: unknown } } | null;
  try { o = guvenliJson(metin) as typeof o; } catch { return { tamam: false, hata: "Dosya okunamadı: geçerli bir yedek dosyası değil." }; }
  if (!o || o.uygulama !== "nobet-cizelgesi-v2" || !o.veri || typeof o.veri !== "object") return { tamam: false, hata: "Bu dosya bu uygulamanın yedeği değil." };
  const { staff, schedules } = o.veri;
  if (!Array.isArray(staff) || typeof schedules !== "object" || !schedules) return { tamam: false, hata: "Yedek dosyası eksik ya da bozuk; mevcut veriler değiştirilmedi." };
  const v = veriyiDogrula(o.veri);
  // okunamayıp atlanan kişi ve çizelge sayısı (kullanıcıya söylenir)
  const atlanan = (staff.length - v.staff.length) + (Object.keys(schedules).length - Object.keys(v.schedules).length);
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
