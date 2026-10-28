// Amaç fonksiyonu: çizelgenin "kötülük" puanı (küçük = daha adil). Ağırlıklar ve öncelik sırası sabitler.ts'deki AGIRLIK
// tablosundadır. Sayaçlar kişi başı dizilerde tutulur; aramadaki her aday hamlede yalnız değişen 1-2 gün ve onlara bakan
// komşu günler yeniden hesaplanır (artımlı hesap: jDelta).
import type { Gorevli } from "../../veri/tipler";
import { AGIRLIK, FM_MAX_FARK } from "../sabitler";
import { CUMA, CUMARTESI, PAZAR, PERSEMBE } from "../takvim";
import type { Kurallar } from "./kurallar";
import type { AramaKurulumu } from "./kurulum";

const { UYARI, KESIN } = AGIRLIK;

/** ix kümesindeki değerlerin ortalamadan kare sapma toplamı */
function ssIx(o: Float64Array, ix: number[]): number {
  const n = ix.length; let t = 0;
  for (let q = 0; q < n; q++) t += o[ix[q]];
  const mean = t / n; let r = 0;
  for (let q = 0; q < n; q++) { const z = o[ix[q]] - mean; r += z * z; }
  return r;
}
/** G grubundaki sayaç değerleri arasındaki fark 1'i aşıyorsa ceza */
function grupFarkCeza(o: Float64Array, G: number[], w: number): number {
  if (G.length < 2) return 0;
  let mx = -1, mn = 1e9;
  for (let q = 0; q < G.length; q++) { const v = o[G[q]]; if (v > mx) mx = v; if (v < mn) mn = v; }
  return mx - mn > 1 ? w * (mx - mn - 1) : 0;
}
/** fark 1'i aşınca: en iyi 1 genişliğindeki aralığın dışında kalan toplam sapma. Yalnız en çok – en az farkına
 *  bakılsaydı uçtaki kişilerden birini düzelten adım ödüllenmez, arama takılırdı. */
function yilBant(v: number[]): number {
  const n = v.length; let enAz = 1e18;
  for (let q = 0; q < n; q++) for (let k = 0; k < 2; k++) {
    const L = v[q] - k; let t = 0;
    for (let r = 0; r < n; r++) { const x = v[r]; if (x < L) t += L - x; else if (x > L + 1) t += x - L - 1; }
    if (t < enAz) enAz = t;
  }
  return enAz;
}

export type Amac = ReturnType<typeof amacKur>;

export function amacKur(K: AramaKurulumu, kural: Kurallar) {
  const { A, days, NH, hIx, GUN_SAY, gunDow, gunFm, resmiGunDizi, resmiGunVar, cuGunDizi, prefGun, izinOnceGun, zorunluGun,
    oncekiAyPersembe, oncekiAyCuma, ixStaff, ixPrep, ixDestek, ixEczPrep, ixTekPrep, eczIx, ixFmKural, onceki, pv, hsMusait,
    HS_SIFIR_IZIN, destekTamUyari, destekVar, DESTEK_AYLIK, HAZ_SAAT, prepAday, ayar } = K;
  const { sinir, devir } = A;
  const { gundeVar, tatilGunu, yasak } = kural;
  // hazırlama eşitliği: bu ay en az bir hazırlama gününde yazılabilen eczacı / tekniker
  const ixPrepAdil = prepAday.filter(s => days.some((_, i) => tatilGunu(i) && !yasak(s.id, i))).map(s => hIx[s.id]);

  // ---- sayaçlar: kişi başı bu ayki fazla mesai, nöbet, gün türleri, hazırlama ----
  const sayac = () => new Float64Array(NH);
  const hFm = sayac(), hCnt = sayac(), hWk = sayac(), hThu = sayac(), hPrp = sayac(), hSat = sayac(), hSun = sayac(), hCum = sayac(),
    hRc = sayac(), hRcH = sayac(), hHs = sayac(), hCu = sayac();
  // önceki aylarla birlikte (etkin) değerler için çalışma dizileri
  const hFmEf = sayac(), hPrpEf = sayac(), hRcEf = sayac(), hRcHEf = sayac(), hHsEf = sayac(), hCuEf = sayac(), hThuEf = sayac(), hCntEf = sayac(), hSatEf = sayac(), hSunEf = sayac();
  let hPrAv = 0;   // "istemiyor" işaretli güne yazılan hazırlama sayısı
  function sayaclariSifirla() { hPrAv = 0; for (const a of [hFm, hCnt, hWk, hThu, hPrp, hSat, hSun, hCum, hRc, hRcH, hHs, hCu]) a.fill(0); }

  /** bir günün nöbetçi + hazırlama katkısını sayaçlara ekler (sg=1) ya da çıkarır (sg=-1) */
  function katki(i: number, as: Gorevli[], pl: Gorevli[], sg: number) {
    const dow = gunDow[i], resmi = resmiGunDizi[i], fmGun = sg * gunFm[i];
    const hs = dow === CUMARTESI || dow === PAZAR;
    for (let q = 0; q < as.length; q++) {
      const ix = hIx[as[q].id];
      if (ix === undefined) continue;
      hFm[ix] += fmGun; hCnt[ix] += sg;
      if (resmi) hRc[ix] += sg;
      if (cuGunDizi[i]) hCu[ix] += sg;
      if (hs) { hWk[ix] += sg; hHs[ix] += sg; }
      if (dow === CUMARTESI) hSat[ix] += sg;
      else if (dow === PAZAR) hSun[ix] += sg;
      else if (dow === CUMA) hCum[ix] += sg;
      else if (dow === PERSEMBE) hThu[ix] += sg;
    }
    if (pl) {
      const pg = prefGun[i];
      for (let q = 0; q < pl.length; q++) {
        const ix = hIx[pl[q].id];
        if (ix === undefined) continue;
        hFm[ix] += sg * HAZ_SAAT; hWk[ix] += sg; hPrp[ix] += sg;
        if (resmi) hRcH[ix] += sg;
        if (pg[pl[q].id] === "avoid") hPrAv += sg;
      }
    }
  }

  // i. günün yumuşak ceza katkısı (o gün ve 2-3 gün sonrasındaki nöbetlere bakar); toplam gunTercihCarpani ile çarpılır
  function softGun(i: number): number {
    const as = days[i].assigned, pg = prefGun[i], dow = gunDow[i]; let sf = 0;
    for (let q = 0; q < as.length; q++) {
      const pid = as[q].id;
      if (hIx[pid] === undefined) continue;
      // "istiyor": düşük öncelik — eşit/adil dağıtımı bozmadan, yalnız eşitlik varken karşılanır
      if (pg[pid] === "want") sf -= AGIRLIK.istiyor;
      if (ayar.minAra >= 3 && i + 2 < GUN_SAY && gundeVar(i + 2, pid)) sf += AGIRLIK.araGun;
      if (ayar.minAra >= 4 && i + 3 < GUN_SAY && gundeVar(i + 3, pid)) sf += AGIRLIK.araGun;
      // ay başı: önceki ayın son günlerindeki (gerçekte tutulan) nöbetle en az gün farkı
      if (i < ayar.minAra) for (let k = 1; k <= 4; k++) { const ara = i + k; if (ara >= 2 && ara < ayar.minAra && sinir.oncekiSonGunler[k].indexOf(pid) >= 0) sf += AGIRLIK.araGun; }
      if (dow === PERSEMBE && ayar.thuHaftaSonu) {
        // Perşembe nöbeti tutana aynı hafta sonu nöbet yazılmaz (güçlü tercih; personel gerçekten yetmezse esner)
        if (i + 2 < GUN_SAY && gundeVar(i + 2, pid)) sf += AGIRLIK.thuHs;
        if (i + 3 < GUN_SAY && gundeVar(i + 3, pid)) sf += AGIRLIK.thuHs;
      }
      if (ayar.thuHaftaSonu && oncekiAyPersembe[i] && oncekiAyPersembe[i]!.has(pid)) sf += AGIRLIK.thuHs;
      // Cuma nöbeti tutana aynı hafta Pazar nöbeti yazılmaz (mümkün olduğunca; güçlü tercih)
      if (dow === CUMA && i + 2 < GUN_SAY && gundeVar(i + 2, pid)) sf += AGIRLIK.cuPaz;
      if (oncekiAyCuma[i] && oncekiAyCuma[i]!.has(pid)) sf += AGIRLIK.cuPaz;
    }
    // Cuma nöbeti tutana aynı hafta Pazar hazırlaması da yazılmaz (mümkün olduğunca)
    if (dow === PAZAR) {
      const pl = days[i].prep || [];
      for (let q = 0; q < pl.length; q++) {
        const pid = pl[q].id;
        if ((i - 2 >= 0 && gundeVar(i - 2, pid)) || (oncekiAyCuma[i] && oncekiAyCuma[i]!.has(pid))) sf += AGIRLIK.cuPaz;
      }
    }
    return sf;
  }
  // günün uyarı çıkaran durumları: karşılanmayan eş durumu, "istemiyor" işaretli güne nöbet,
  // ertesi gün izne çıkana nöbet (nöbet ertesi izni izne düşer)
  function zGun(i: number): number {
    const zg = zorunluGun[i]; let z = 0;
    for (let q = 0; q < zg.length; q++) { if (!gundeVar(i, zg[q])) z += UYARI; }
    const as = days[i].assigned, pg = prefGun[i];
    for (let q = 0; q < as.length; q++) {
      const pid = as[q].id;
      if (hIx[pid] === undefined) continue;
      if (pg[pid] === "avoid") z += UYARI;
      if (izinOnceGun[i][pid]) z += UYARI;
    }
    return z;
  }

  // yıllık gün türü (Perşembe, Cuma, Cumartesi, Pazar, resmi tatil): herkes birini almadan kimse ikincisini almasın
  function yilCeza(b: Float64Array, h: Float64Array): number {
    const n = ixFmKural.length; if (n < 2) return 0;
    let mx = -1e9, mn = 1e9; const v: number[] = [];
    for (let q = 0; q < n; q++) { const ix = ixFmKural[q], x = b[ix] + h[ix]; v.push(x); if (x > mx) mx = x; if (x < mn) mn = x; }
    return mx - mn > 1 + 1e-9 ? UYARI + AGIRLIK.gunYil * (mx - mn - 1) + AGIRLIK.gunYil * yilBant(v) : 0;
  }

  /** sayaçlardan toplam amaç değeri; soft: günlük tercihler, zPen: günlerin uyarıları */
  function ozetJ(soft: number, zPen: number): number {
    let uy = 0, hsSifir = 0;   // uy: uyarı çıkaran durum sayısı
    for (let ix = 0; ix < NH; ix++) { hPrpEf[ix] = hPrp[ix] + onceki.prp[ix]; hFmEf[ix] = hFm[ix] + onceki.fm[ix]; }
    let destekFazla = 0;
    // hazırlama adaleti: eczacılar kendi arasında, teknikerler kendi arasında fark en fazla 1
    let hzAdil = 0;
    hzAdil += grupFarkCeza(hPrp, ixEczPrep, AGIRLIK.grupHazFark); hzAdil += grupFarkCeza(hPrp, ixTekPrep, AGIRLIK.grupHazFark);
    // eczacı + tekniker hazırlama sayıları arasında fark en fazla 1 (biri 0, biri 2 olmaz); öncelik Ayarlar'daki seçime göre
    { const c = grupFarkCeza(hPrp, ixPrepAdil, ayar.hzFark); if (c > 0) { hzAdil += c; uy++; } }
    // hazırlama önce teknikerlere: her teknikere 1, sonra eczacılara; yeni tur yine teknikerden. Sıra yıl boyunca
    // sürer (önceki aylar dahil): her ay baştan başlasaydı ay içinde artan hazırlama hep teknikerlere kalır, yılda birikirdi
    {
      let mxE = -1e9, mnT = 1e9;
      for (let q = 0; q < ixPrepAdil.length; q++) { const ix = ixPrepAdil[q], v = hPrpEf[ix]; if (eczIx[ix]) { if (v > mxE) mxE = v; } else if (v < mnT) mnT = v; }
      if (mxE > -1e9 && mnT < 1e9 && mxE > mnT + 1e-6) hzAdil += AGIRLIK.tekOnce * (mxE - mnT);
    }
    // nöbet sayısı: kişiler arasında fark mümkünse en fazla 1, en fazla 2
    if (ixFmKural.length > 1) {
      let mx = -1, mn = 1e9;
      for (let q = 0; q < ixFmKural.length; q++) { const v = hCnt[ixFmKural[q]]; if (v > mx) mx = v; if (v < mn) mn = v; }
      if (mx - mn > 1) hzAdil += AGIRLIK.nobetFark * (mx - mn - 1);
      if (mx - mn > 2) { hzAdil += KESIN * (mx - mn - 2); uy++; }
    }
    // KESİN: destek personeli ayda tam ayardaki sayı kadar hazırlama alır
    if (destekVar) for (let q = 0; q < ixDestek.length; q++) {
      const v = hPrp[ixDestek[q]];
      destekFazla += AGIRLIK.destekSayi * Math.abs(v - DESTEK_AYLIK);
      if (destekTamUyari && v !== DESTEK_AYLIK) uy++;
    }
    let hsPen = 0, thuFazla = 0, devirPen = 0, kesinPen = 0;
    // KESİN: aylık fazla mesai farkı (destek hariç) en fazla FM_MAX_FARK saat
    if (ixFmKural.length > 1) {
      let mx = -1e9, mn = 1e9; const n = ixFmKural.length;
      for (let q = 0; q < n; q++) { const v = hFm[ixFmKural[q]]; if (v > mx) mx = v; if (v < mn) mn = v; }
      if (mx - mn > FM_MAX_FARK) {
        // herkesi FM_MAX_FARK genişliğinde tek bir aralığa sokmak için gereken toplam saat (en iyi aralığa göre);
        // tek kişinin bile aralığa yaklaşması ceza azaltır, böylece arama düzlükte takılmaz
        let enAz = 1e18;
        for (let q = 0; q < 2 * n; q++) {
          const L = q < n ? hFm[ixFmKural[q]] : hFm[ixFmKural[q - n]] - FM_MAX_FARK, U = L + FM_MAX_FARK;
          let t = 0; for (let r = 0; r < n; r++) { const v = hFm[ixFmKural[r]]; if (v < L) t += L - v; else if (v > U) t += v - U; }
          if (t < enAz) enAz = t;
        }
        kesinPen += KESIN * (mx - mn - FM_MAX_FARK) + AGIRLIK.fmBant * enAz; uy++;
      }
    }
    for (let q = 0; q < ixStaff.length; q++) {
      const ix = ixStaff[q];
      const w = hSat[ix] + hSun[ix], cm = hCum[ix];
      // ayda en fazla 1 Cumartesi ve 1 Pazar nöbeti; Cuma + Cumartesi + Pazar üçü birden olmaz
      if (hSat[ix] > 1) { kesinPen += AGIRLIK.hsKural * (hSat[ix] - 1); uy += hSat[ix] - 1; }
      if (hSun[ix] > 1) { kesinPen += AGIRLIK.hsKural * (hSun[ix] - 1); uy += hSun[ix] - 1; }
      if (cm > 0 && hSat[ix] > 0 && hSun[ix] > 0) { kesinPen += AGIRLIK.hsKural; uy++; }
      if (ayar.cumaEsles && w >= 1 && cm === 0) hsPen += AGIRLIK.cumaEslesmeYok;
      if (ayar.cumaEsles && w === 0 && cm >= 1) hsPen += AGIRLIK.cumaTek;
      if (cm > 1) hsPen += AGIRLIK.cumaFazla * (cm - 1);
      // ayda en az 1 Cumartesi/Pazar nöbeti (uygun hafta sonu günü varsa)
      if (hHs[ix] === 0 && hsMusait[ix]) { hsPen += AGIRLIK.hsEnAz1; hsSifir++; }
      // Cumartesi/Pazar NÖBETİ Ayarlar'daki hafta sonu üst sınırını aşmasın (hazırlama sayılmaz)
      if (hHs[ix] > ayar.hsUst) { hsPen += AGIRLIK.hsUst * (hHs[ix] - ayar.hsUst); uy += hHs[ix] - ayar.hsUst; }
      if (hThu[ix] > ayar.maxThu) thuFazla += hThu[ix] - ayar.maxThu;
      // eczacı / tekniker: ayda en fazla 2 hazırlama (çok güçlü tercih; yalnız başka çare yoksa aşılır)
      if (hPrp[ix] > 2) { hsPen += AGIRLIK.prepUst * (hPrp[ix] - 2); uy += hPrp[ix] - 2; }
      // ayda 1 hazırlama hedef: 2. hazırlama yalnız yerler 1'er kişiyle dolmuyorsa
      if (hPrp[ix] > 1) hsPen += AGIRLIK.prp2 * (hPrp[ix] - 1);
      if (devir.havePrev) {
        const p = pv[q];
        if (p.thu === 0 && hThu[ix] === 0) devirPen += AGIRLIK.devirPersembe;
        if (p.thu > 0 && hThu[ix] > 0) devirPen += AGIRLIK.devirPersembe;
        if (p.sun > 0 && hSun[ix] > 0) devirPen += AGIRLIK.devirPazar * hSun[ix];
        if (p.sat > 0 && hSat[ix] > 0) devirPen += AGIRLIK.devirCumartesi * hSat[ix];
      }
    }
    if (hsSifir > HS_SIFIR_IZIN) uy += hsSifir - HS_SIFIR_IZIN;
    // resmi tatil görevleri: nöbet ve hazırlama ayrı ayrı, gün sayısı olarak (saat değil); destek personeli kendi arasında
    let resmiPen = 0;
    if (resmiGunVar) {
      for (let ix = 0; ix < NH; ix++) { hRcEf[ix] = hRc[ix] + onceki.rc[ix]; hRcHEf[ix] = hRcH[ix] + onceki.rcH[ix]; }
      resmiPen = AGIRLIK.resmi * ssIx(hRcEf, ixStaff) + AGIRLIK.resmi * ssIx(hRcHEf, ixPrep) + (destekVar ? AGIRLIK.resmi * ssIx(hRcHEf, ixDestek) : 0);
      // yıllık toplam resmi tatil görevi (nöbet + hazırlama) kişiler arasında en fazla 1 fark (resmi tatil yılda az: açılan fark sonradan kapanmaz)
      {
        let mx = -1e9, mn = 1e9; const v: number[] = [];
        for (let q = 0; q < ixPrep.length; q++) { const ix = ixPrep[q], x = hRcEf[ix] + hRcHEf[ix]; v.push(x); if (x > mx) mx = x; if (x < mn) mn = x; }
        if (mx - mn > 1 + 1e-6) resmiPen += AGIRLIK.resmiYilToplam * (mx - mn - 1 + yilBant(v));
      }
    }
    for (let ix = 0; ix < NH; ix++) hHsEf[ix] = hHs[ix] + onceki.hs[ix];
    const hsYilPen = AGIRLIK.hsYil * ssIx(hHsEf, ixStaff);
    for (let ix = 0; ix < NH; ix++) hCuEf[ix] = hCu[ix] + onceki.cu[ix];
    const cuYilPen = AGIRLIK.cuYil * ssIx(hCuEf, ixStaff);
    for (let ix = 0; ix < NH; ix++) hThuEf[ix] = hThu[ix] + onceki.pe[ix];
    const peYilPen = AGIRLIK.peYil * ssIx(hThuEf, ixStaff);
    for (let ix = 0; ix < NH; ix++) hCntEf[ix] = hCnt[ix] + onceki.n[ix];
    const nYilPen = AGIRLIK.nYil * ssIx(hCntEf, ixStaff);
    for (let ix = 0; ix < NH; ix++) { hSatEf[ix] = hSat[ix] + onceki.cmt[ix]; hSunEf[ix] = hSun[ix] + onceki.paz[ix]; }
    const cpYilPen = AGIRLIK.cpYil * (ssIx(hSatEf, ixStaff) + ssIx(hSunEf, ixStaff));
    let gunYilPen = 0;
    if (ixFmKural.length > 1) {
      gunYilPen = yilCeza(onceki.bPe, hThu) + yilCeza(onceki.bCu, hCum) + yilCeza(onceki.bCmt, hSat) + yilCeza(onceki.bPaz, hSun) + (resmiGunVar ? yilCeza(onceki.bRt, hRc) : 0);
    }
    // fmYil: fazla mesai (saat) eşitliği yıllık — her ay 8 saat kuralının yanında yıl toplamı da eşite yakın
    return UYARI * (uy + hPrAv) + kesinPen + zPen + AGIRLIK.fmYil * ssIx(hFmEf, ixStaff) + hsYilPen + cuYilPen + peYilPen + nYilPen + cpYilPen + gunYilPen + devirPen
      + AGIRLIK.nobetAy * ssIx(hCnt, ixStaff) + AGIRLIK.haftaSonuIs * ssIx(hWk, ixStaff) + AGIRLIK.prpYil * ssIx(hPrpEf, ixPrep)
      + AGIRLIK.prpGrup * (ssIx(hPrpEf, ixEczPrep) + ssIx(hPrpEf, ixTekPrep)) + (destekVar ? AGIRLIK.destekYil * ssIx(hPrpEf, ixDestek) : 0)
      + destekFazla + hzAdil + hsPen + AGIRLIK.gunTercihCarpani * soft + AGIRLIK.thuFazla * thuFazla + resmiPen;
  }

  /** tam hesap: tüm günler baştan sayılır */
  function hesaplaJ(): number {
    sayaclariSifirla();
    let soft = 0, zPen = 0;
    for (let i = 0; i < GUN_SAY; i++) { zPen += zGun(i); katki(i, days[i].assigned, days[i].prep, 1); soft += softGun(i); }
    return ozetJ(soft, zPen);
  }

  // artımlı hesap: önce mevcut çözüm "taban" olarak kurulur, sonra her aday hamlede yalnızca değişen 1-2 gün ve onlara
  // bakan komşu günler yeniden hesaplanır
  const tAs: Gorevli[][] = new Array(GUN_SAY), tPr: Gorevli[][] = new Array(GUN_SAY);
  const bSoftGun = new Float64Array(GUN_SAY), bZGun = new Float64Array(GUN_SAY);
  const etkiDamga = new Int32Array(GUN_SAY);
  let bSoft = 0, bZ = 0, damga = 0;
  function tabanKur(): void {
    sayaclariSifirla(); bSoft = 0; bZ = 0;
    for (let i = 0; i < GUN_SAY; i++) {
      tAs[i] = days[i].assigned; tPr[i] = days[i].prep;
      katki(i, tAs[i], tPr[i], 1);
      bSoftGun[i] = softGun(i); bZGun[i] = zGun(i);
      bSoft += bSoftGun[i]; bZ += bZGun[i];
    }
  }
  /** taban çözümden i (ve varsa k) gününü değiştiren hamlenin amaç değeri; nobetDegisti: nöbetçiler de değişti */
  function jDelta(i: number, k: number, nobetDegisti: boolean): number {
    katki(i, tAs[i], tPr[i], -1); katki(i, days[i].assigned, days[i].prep, 1);
    if (k >= 0) { katki(k, tAs[k], tPr[k], -1); katki(k, days[k].assigned, days[k].prep, 1); }
    let soft = bSoft, zPen = bZ;
    // nöbet değiştiyse: o güne bakan günler (3 gün öncesi; Pazar hazırlaması için 2 gün sonrası) yeniden hesaplanır;
    // yalnız hazırlama değiştiyse: yalnız o günün kendisi
    damga++;
    for (let t = 0; t < 2; t++) {
      const g = t === 0 ? i : k;
      if (g < 0) continue;
      if (nobetDegisti) zPen += zGun(g) - bZGun[g];
      const lo = nobetDegisti ? g - 3 : g, hi = nobetDegisti ? Math.min(g + 2, GUN_SAY - 1) : g;
      for (let j = lo; j <= hi; j++) {
        if (j < 0 || etkiDamga[j] === damga) continue;
        etkiDamga[j] = damga;
        soft += softGun(j) - bSoftGun[j];
      }
    }
    const r = ozetJ(soft, zPen);
    katki(i, days[i].assigned, days[i].prep, -1); katki(i, tAs[i], tPr[i], 1);
    if (k >= 0) { katki(k, days[k].assigned, days[k].prep, -1); katki(k, tAs[k], tPr[k], 1); }
    return r;
  }

  return { hesaplaJ, tabanKur, jDelta };
}
