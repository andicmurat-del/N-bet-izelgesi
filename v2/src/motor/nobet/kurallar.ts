// Aramada her hamlede korunan kesin kurallar: izinli yok, komşu günde nöbet/hazırlama yok, günde en az 1 eczacı,
// 5 gün içinde 3 nöbet yok, Perşembe nöbetçisine aynı hafta sonu hazırlama yok, art arda iki gün hazırlama yok.
import type { Gorevli } from "../../veri/tipler";
import { eczaciMi } from "../baglam";
import { HAZ_SAYISI } from "../sabitler";
import { CUMA, CUMARTESI, gunKaydir, PAZAR, PERSEMBE } from "../takvim";
import type { AramaKurulumu } from "./kurulum";
import { ucluSikisik } from "./sinir";

export type Kurallar = ReturnType<typeof kurallarKur>;

export function kurallarKur(K: AramaKurulumu) {
  const { B, y, m, days, A, yasakGun, zorunluGun, gunDow } = K;
  const { sinir, sonGunEngel } = A;
  const thuHaftaSonu = K.ayar.thuHaftaSonu;
  const destekId = new Set(K.destekler.map(s => s.id)), DESTEK_AYLIK = K.DESTEK_AYLIK;

  /** o gün kişiye görev yazılamaz (izin, eş durumu yok, çalışma dönemi dışı…) */
  function yasak(id: number, i: number): boolean { const v = yasakGun[i][id]; return v === undefined ? B.kesinYasak(id, y, m, days[i].day) : v; }
  /** eş durumu: kişi o gün kesin nöbetçi yazılmalı */
  function zorunluMu(id: number, i: number): boolean { return zorunluGun[i].indexOf(id) >= 0; }
  function gundeVar(i: number, id: number): boolean { const l = days[i].assigned; for (let q = 0; q < l.length; q++) if (l[q].id === id) return true; return false; }
  /** hazırlama personeli yazılacak gün: Cumartesi, Pazar veya işaretli resmi tatil */
  function tatilGunu(idx: number): boolean { return !!days[idx].tatil; }

  /** nöbetçi yazılacak kişi komşu günlerde nöbetçi, komşu günlerde ya da aynı gün hazırlama personeli olamaz */
  function komsuda(id: number, idx: number): boolean {
    for (let k = idx - 1; k <= idx + 1; k++) {
      if (k < 0 || k >= days.length) continue;
      if (k !== idx && gundeVar(k, id)) return true;
      const pr = days[k].prep;
      if (pr) for (let q = 0; q < pr.length; q++) if (pr[q].id === id) return true;
    }
    if (idx === 0 && (sinir.oncekiSonN.indexOf(id) >= 0 || sinir.oncekiSonH.indexOf(id) >= 0)) return true;
    if (idx === days.length - 1 && (sinir.sonrakiIlkN.indexOf(id) >= 0 || sinir.sonrakiIlkH.indexOf(id) >= 0)) return true;
    return false;
  }
  /** hazırlama personeli aynı gün ve önceki/sonraki gün nöbetçi olamaz */
  function prepKomsu(id: number, idx: number): boolean {
    for (let k = idx - 1; k <= idx + 1; k++) {
      if (k < 0 || k >= days.length) continue;
      if (days[k].assigned.some(p => p.id === id)) return true;
    }
    if (idx === 0 && sinir.oncekiSonN.indexOf(id) >= 0) return true;
    if (idx === days.length - 1 && sinir.sonrakiIlkN.indexOf(id) >= 0) return true;
    return false;
  }
  /** aynı kişiye art arda iki gün hazırlama yazılmaz (Cumartesi + Pazar, ya da bitişik tatil günleri; ay sınırı dahil) */
  function prepBitisik(id: number, idx: number): boolean {
    if (idx - 1 >= 0 && (days[idx - 1].prep || []).some(pp => pp.id === id)) return true;
    if (idx + 1 < days.length && (days[idx + 1].prep || []).some(pp => pp.id === id)) return true;
    if (idx === 0 && sinir.oncekiSonH.indexOf(id) >= 0) return true;
    if (idx === days.length - 1 && sinir.sonrakiIlkH.indexOf(id) >= 0) return true;
    return false;
  }
  /** hafta sonu günü (idx) için: kişi aynı haftanın Perşembe günü nöbetçi mi (Perşembe önceki aydaysa o ayın çizelgesine bakılır) */
  function persembeNobetliMi(id: number, idx: number): boolean {
    const dw = gunDow[idx]; if (!thuHaftaSonu || (dw !== CUMARTESI && dw !== PAZAR)) return false;
    const k = dw === CUMARTESI ? 2 : 3, t = idx - k;
    if (t >= 0) return days[t].assigned.some(p => p.id === id);
    const [a, b, c] = gunKaydir(y, m, days[idx].day, -k), sc = B.cizelge(a, b);
    return !!(sc && sc.days && sc.days[c - 1] && (sc.days[c - 1].assigned || []).some(p => p.id === id));
  }
  /** Perşembe günü (idx) nöbetçi yazılacak kişinin aynı hafta sonu hazırlaması var mı */
  function hsHazirligiVarMi(id: number, idx: number): boolean {
    if (!thuHaftaSonu || gunDow[idx] !== PERSEMBE) return false;
    for (const k of [2, 3]) { const t = idx + k; if (t < days.length && (days[t].prep || []).some(pp => pp.id === id)) return true; }
    return false;
  }
  /** destek personelinin aylık hazırlama sayısı (Ayarlar) kesin sınırdır: o ayki hazırlamaları sınırı aşmamalı */
  function destekSiniriAsildi(id: number): boolean {
    if (!destekId.has(id)) return false;
    let n = 0;
    for (let k = 0; k < days.length; k++) { const pr = days[k].prep; for (let q = 0; q < pr.length; q++) if (pr[q].id === id) n++; }
    return n > DESTEK_AYLIK;
  }
  function prepUygun(id: number, idx: number): boolean {
    return !yasak(id, idx) && !prepKomsu(id, idx) && !persembeNobetliMi(id, idx) && !prepBitisik(id, idx) && !destekSiniriAsildi(id);
  }
  /** dışarıdan nöbete gelen iki eczacı aynı gün birlikte nöbetçi olmaz (Cuma ve Cumartesi olabilir; ikisi de eş durumu
   *  zorunluluğuysa da olabilir) */
  function ikiDisaridan(as: Gorevli[], idx: number): boolean {
    if (gunDow[idx] === CUMA || gunDow[idx] === CUMARTESI) return false;
    let say = 0, hepsiZorunlu = true;
    for (let q = 0; q < as.length; q++) if (as[q].role === "nobetci") { say++; if (!zorunluMu(as[q].id, idx)) hepsiZorunlu = false; }
    return say > 1 && !hepsiZorunlu;
  }
  /** günün nöbetçileri kesin kurallara uyuyor mu */
  function gunGecerli(idx: number): boolean {
    const dy = days[idx], as = dy.assigned;
    let eczaci = false;
    for (let q = 0; q < as.length; q++) if (eczaciMi(as[q].role)) { eczaci = true; break; }
    if (!eczaci) return false;
    if (ikiDisaridan(as, idx)) return false;
    for (let q = 0; q < as.length; q++) {
      const id = as[q].id;
      if (yasak(id, idx)) return false;
      if (zorunluMu(id, idx)) continue;
      if (sonGunEngel(id, dy.day) || komsuda(id, idx) || hsHazirligiVarMi(id, idx) || ucluSikisik(days, sinir, id, idx)) return false;
    }
    return true;
  }
  /** ihlalli günde denenen hamlelerde bile bozulmayacak temel kurallar: günde eczacı var, kimse aynı gün hem nöbetçi
   *  hem hazırlamacı değil, izinli/yasaklı kişi nöbetçi değil (eş durumu zorunluluğu hariç) */
  function temelUygun(idx: number): boolean {
    const dy = days[idx], as = dy.assigned, pr = dy.prep;
    let eczaci = false;
    for (let q = 0; q < as.length; q++) {
      const id = as[q].id;
      if (eczaciMi(as[q].role)) eczaci = true;
      if (yasak(id, idx) && !zorunluMu(id, idx)) return false;
      for (let r = 0; r < pr.length; r++) if (pr[r].id === id) return false;
    }
    return eczaci;
  }
  /** Günün kesin kural ihlali sayısı (nöbetçiler ve hazırlama personeli için yukarıdaki kuralların hepsi). İlk yerleştirme
   *  başka kimse kalmayınca kural esnetebilir; aramadaki hamleler yeni ihlal yaratmaz (gunGecerli, prepUygun), ama var olanı
   *  gidermeleri için amaç fonksiyonu bu sayıyı cezalandırır. Boş kalan hazırlama yeri de sayılır. Gün kırmızı işareti de buna göredir. Bir günün sayısı
   *  idx−4 … idx+4 günlerine bağlıdır (5 günde 3 nöbet). */
  function ihlalSayisi(idx: number): number {
    const dy = days[idx];
    let n = 0;
    // tatil gününde boş kalan hazırlama yeri (her eksik yer bir ihlal)
    if (!dy.locked && tatilGunu(idx) && dy.prep.length < HAZ_SAYISI) n += HAZ_SAYISI - dy.prep.length;
    if (!dy.assigned.some(p => eczaciMi(p.role))) n++;
    if (ikiDisaridan(dy.assigned, idx)) n++;
    for (const p of dy.assigned) {
      if (yasak(p.id, idx)) { n++; continue; }
      if (zorunluMu(p.id, idx)) continue;
      if (sonGunEngel(p.id, dy.day)) n++;
      if (komsuda(p.id, idx)) n++;
      if (hsHazirligiVarMi(p.id, idx)) n++;
      if (ucluSikisik(days, sinir, p.id, idx)) n++;
    }
    for (const p of dy.prep || []) {
      if (yasak(p.id, idx)) n++;
      if (prepKomsu(p.id, idx)) n++;
      if (persembeNobetliMi(p.id, idx)) n++;
      // destek personelinde art arda hazırlama ihlal sayılmaz (yalnız başka yer yoksa yazılır; eski uygulamada da işaretlenmez)
      if (p.role !== "destek" && prepBitisik(p.id, idx)) n++;
    }
    return n;
  }

  return { yasak, zorunluMu, gundeVar, tatilGunu, komsuda, prepKomsu, prepBitisik, persembeNobetliMi, hsHazirligiVarMi, prepUygun, ikiDisaridan, gunGecerli, temelUygun, ihlalSayisi };
}
