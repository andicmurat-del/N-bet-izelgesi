// Aramanın sabit girdileri: ilk yerleştirmeden sonra bir kez hesaplanır, arama boyunca değişmez (hız için diziler).
// Kişiler aramada sıra numarasıyla (hIx) tutulur; sayaçlar Float64Array'dir.
import { aktifAydaMi, aktifGunMu, eczaciMi, hazirlamaRol, type MotorGunu } from "../baglam";
import { fmKuralKisileri, yilGunSayilari } from "../istatistik";
import type { Kisi } from "../../veri/tipler";
import { AGIRLIK } from "../sabitler";
import { CUMARTESI, gunKaydir, haftaGunu, PAZAR } from "../takvim";
import type { AyBilgisi } from "./ay";

export type AramaKurulumu = ReturnType<typeof aramaKur>;

export function aramaKur(A: AyBilgisi, days: MotorGunu[]) {
  const { B, y, m, eczacilar, teknisyenler, devir, resmiDv, hsDv, cuDv, peDv, cmtDv, pazDv, nDv } = A;
  const staffList: Kisi[] = eczacilar.concat(teknisyenler);
  // destek personeli varsa 2. hazırlama yerine yazılabilir (nöbet tutmaz, nöbetçilerle eşitlenmez, kendi arasında eşitlenir)
  const destekler = B.staff.filter(s => s.role === "destek" && aktifAydaMi(s, y, m));
  const destekVar = destekler.length > 0;
  const DESTEK_AYLIK = B.sayi("destekAylik");   // destek personeli başına aylık hazırlama
  const prepAday = staffList.filter(s => hazirlamaRol(s.role));
  const tumHavuz = destekler.length ? staffList.concat(destekler) : staffList;
  /** 2. hazırlama yeri (slot 1) destek personeli ya da eczacı/tekniker olabilir */
  function degisimHavuzu(eski: { role: string }, slot: number): Kisi[] {
    if (destekVar && slot === 1) return prepAday.concat(destekler);
    return destekVar && eski.role === "destek" ? destekler : prepAday;
  }
  const ayniTur = (a: { role: string }, b: { role: string }) => (a.role === "destek") === (b.role === "destek");

  const GUN_SAY = days.length;
  const gunDow = days.map(dy => haftaGunu(y, m, dy.day));
  const gunFm = days.map(dy => dy.fazlaMesai);
  const resmiGunDizi = days.map(dy => B.resmiTatilMi(y, m, dy.day)), resmiGunVar = resmiGunDizi.some(Boolean);
  const cuGunDizi = days.map(dy => B.cumaTipiMi(y, m, dy.day));
  // eş durumu: "istiyor" işaretli güne o kişi kesin nöbetçi yazılır
  const zorunluGun = days.map(dy => staffList.filter(s => B.tercih(s.id, y, m, dy.day) === "esVar" && aktifGunMu(s, y, m, dy.day)).map(s => s.id));

  const NH = tumHavuz.length, hIx: Record<number, number> = {};
  tumHavuz.forEach((s, ix) => { hIx[s.id] = ix; });
  const gunluk = <T>(f: (id: number, d: number) => T) => days.map(dy => { const o: Record<number, T> = {}; tumHavuz.forEach(s => { o[s.id] = f(s.id, dy.day); }); return o; });
  const prefGun = gunluk((id, d) => B.tercih(id, y, m, d));
  const yasakGun = gunluk((id, d) => B.kesinYasak(id, y, m, d));
  const izinOnceGun = gunluk((id, d) => B.izinOncesiMi(id, y, m, d));
  // ayın ilk hafta sonu: önceki ayın son Perşembe günü nöbet tutanlar (Perşembe → aynı hafta sonu kuralı ay sınırında da geçerli)
  const oncekiAyGorevlileri = (dy: MotorGunu, k: number) => {
    const [a, b, c] = gunKaydir(y, m, dy.day, -k), sc = B.cizelge(a, b);
    const g = sc && sc.days && sc.days[c - 1]; return g ? new Set((g.assigned || []).map(p => p.id)) : null;
  };
  const oncekiAyPersembe = days.map((dy, i) => {
    const dw = gunDow[i]; if ((dw !== CUMARTESI && dw !== PAZAR) || i - (dw === CUMARTESI ? 2 : 3) >= 0) return null;
    return oncekiAyGorevlileri(dy, dw === CUMARTESI ? 2 : 3);
  });
  // ayın ilk Pazarı: önceki ayın son Cuma günü nöbet tutanlar (Cuma → aynı hafta Pazar kuralı ay sınırında da geçerli)
  const oncekiAyCuma = days.map((dy, i) => (gunDow[i] !== PAZAR || i - 2 >= 0 ? null : oncekiAyGorevlileri(dy, 2)));

  const ixStaff = staffList.map(s => hIx[s.id]), ixPrep = prepAday.map(s => hIx[s.id]), ixDestek = destekler.map(s => hIx[s.id]);
  const ixEczPrep = eczacilar.filter(s => hazirlamaRol(s.role)).map(s => hIx[s.id]), ixTekPrep = teknisyenler.filter(s => hazirlamaRol(s.role)).map(s => hIx[s.id]);
  const eczIx = new Uint8Array(NH); tumHavuz.forEach((s, ix) => { if (eczaciMi(s.role)) eczIx[ix] = 1; });
  // kesin kural grubu: fazla mesai farkı en fazla FM_MAX_FARK saat (ayın tamamında çalışan nöbetçi personel; destek hariç)
  const ixFmKural = fmKuralKisileri(B, y, m).map(s => hIx[s.id]).filter(ix => ix !== undefined);

  // önceki aylardan gelen sayılar (yıllık eşitlik): kişi sırasıyla diziler
  const dizi = (f: (s: Kisi) => number) => { const a = new Float64Array(NH); tumHavuz.forEach((s, ix) => { a[ix] = f(s); }); return a; };
  const yb0 = yilGunSayilari(B, y, m, null);   // yıl içinde birikmiş ham gün türü sayıları (fark 1'i aşmasın)
  const ham = (s: Kisi, k: "pe" | "cu" | "cmt" | "paz" | "rt") => { const o = yb0[s.id]; return o ? o[k] : 0; };
  const onceki = {
    fm: dizi(s => devir.off[s.id] || 0), prp: dizi(s => devir.prepOff[s.id] || 0),
    rc: dizi(s => resmiDv.off[s.id] || 0), rcH: dizi(s => resmiDv.offH[s.id] || 0),
    hs: dizi(s => hsDv[s.id] || 0), cu: dizi(s => cuDv[s.id] || 0), n: dizi(s => nDv[s.id] || 0),
    cmt: dizi(s => cmtDv[s.id] || 0), paz: dizi(s => pazDv[s.id] || 0), pe: dizi(s => peDv[s.id] || 0),
    bPe: dizi(s => ham(s, "pe")), bCu: dizi(s => ham(s, "cu")), bCmt: dizi(s => ham(s, "cmt")), bPaz: dizi(s => ham(s, "paz")), bRt: dizi(s => ham(s, "rt")),
  };
  // hemen önceki ayın Perşembe / Cumartesi / Pazar nöbetleri (staffList sırasıyla)
  const pv = staffList.map(s => devir.prev[s.id] || { thu: 0, sat: 0, sun: 0 });

  // ayda en az 1 Cumartesi/Pazar nöbeti: yalnız o ay en az bir hafta sonu günü uygun olan kişiler için
  const hsMusait = new Uint8Array(NH);
  staffList.forEach(s => {
    const ix = hIx[s.id];
    for (let i = 0; i < GUN_SAY; i++) {
      const dw = gunDow[i];
      if ((dw === CUMARTESI || dw === PAZAR) && !yasakGun[i][s.id] && aktifGunMu(s, y, m, days[i].day)) { hsMusait[ix] = 1; break; }
    }
  });
  // hafta sonu nöbet yeri uygun kişi sayısından azsa bu kadar kişinin 0 kalması kaçınılmazdır (uyarı sayılmaz)
  const HS_SIFIR_IZIN = Math.max(0, hsMusait.reduce((t, v) => t + v, 0) - 2 * gunDow.filter(dw => dw === CUMARTESI || dw === PAZAR).length);
  // destek personelinin hazırlama sayısı ayardakinden farklıysa yalnız tatil günleri yetiyorsa uyarı çıkar
  const destekTamUyari = destekVar && days.filter(dy => dy.tatil).length >= destekler.length * DESTEK_AYLIK;

  return {
    A, B, y, m, days, staffList, destekler, destekVar, DESTEK_AYLIK, prepAday, tumHavuz, degisimHavuzu, ayniTur,
    GUN_SAY, gunDow, gunFm, resmiGunDizi, resmiGunVar, cuGunDizi, zorunluGun,
    NH, hIx, prefGun, yasakGun, izinOnceGun, oncekiAyPersembe, oncekiAyCuma,
    ixStaff, ixPrep, ixDestek, ixEczPrep, ixTekPrep, eczIx, ixFmKural, onceki, pv, hsMusait, HS_SIFIR_IZIN, destekTamUyari,
    HAZ_SAAT: B.sayi("hazSaat"),
    ayar: {
      minAra: B.sayi("minAra"), thuHaftaSonu: !!B.ayar("thuHaftaSonu"), cumaEsles: !!B.ayar("cumaEsles"), hsUst: B.sayi("hsUst"), maxThu: B.sayi("maxThu"),
      // saat ile hazırlama çakışırsa öncelik (Ayarlar): 1 = hazırlama eşitliği (fark en fazla 1, saat esner), 2 = fazla mesai saati
      hzFark: Number(B.ayar("cakismaOncelik")) === 2 ? AGIRLIK.hzFarkSaatOncelik : AGIRLIK.hzFarkHazirlamaOncelik,
    },
  };
}
