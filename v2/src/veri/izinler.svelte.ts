// İzinler: kişi tercihleri (izinli, nöbet isteği, eş durumu), resmi tatil ve arife işaretleri; resmi tatillerin
// kendiliğinden işaretlenmesi (veri/resmiTatiller.ts).
// Durum ve kayıt: depo.svelte.ts (oradan da dışa verilir).
import type { Tercih } from "./tipler";
import { ayAnahtari, gunAnahtari, haftaSonuMu, tercihAnahtari } from "./tarih";
import { diniBayramlarVar, yilinTatilleri } from "./resmiTatiller";
import { ayCizelgesi } from "./cizelge.svelte";
import { depo } from "./depo.svelte";

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
