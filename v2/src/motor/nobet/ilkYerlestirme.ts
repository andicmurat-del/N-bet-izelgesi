// 1. adım: açgözlü ilk yerleştirme. Günler sırayla doldurulur; her güne o ana kadarki yüke göre en uygun eczacı ve
// ikinci nöbetçi yazılır. Sonraki adımlar (hazırlama, yerel arama) bu çizelgeyi iyileştirir.
import { aktifGunMu, eczaciMi, gorevli, ikiDisaridanSerbestMi, type MotorGunu } from "../baglam";
import type { Kisi } from "../../veri/tipler";
import { CUMA, CUMARTESI, haftaGunu, PAZAR, PERSEMBE } from "../takvim";
import type { AyBilgisi } from "./ay";
import { ucluSikisik } from "./sinir";

type Sayac = Record<number, number>;

export function ilkYerlestirme(A: AyBilgisi): MotorGunu[] {
  const { B, y, m, dim, eczacilar, teknisyenler, taslak, devir, sira, resmiDv, hsDv, cuDv, cmtDv, pazDv, sinir, sonGunEngel } = A;
  const gunTuru = (d: number) => haftaGunu(y, m, d);
  const hazSaat = B.sayi("hazSaat");

  // o ana kadarki sayaçlar (adil dağılım için)
  const dutyCount: Sayac = {}, totalFM: Sayac = {}, weekendCount: Sayac = {}, thursdayCount: Sayac = {}, cuCount: Sayac = {}, resmiCount: Sayac = {};
  const cmtCount: Sayac = {}, pazCount: Sayac = {}, cumaGunCount: Sayac = {};   // cumaGunCount: bu ay tutulan (gerçek) Cuma nöbeti
  const lastDutyDay: Sayac = {};   // en son nöbet tuttuğu gün (sıralı nöbeti önlemek için)
  B.staff.forEach(s => { dutyCount[s.id] = 0; totalFM[s.id] = devir.off[s.id] || 0; weekendCount[s.id] = 0; cuCount[s.id] = 0; thursdayCount[s.id] = 0; resmiCount[s.id] = 0; });
  const say = (id: number, d: number, fazlaMesai: number) => {
    const dw = gunTuru(d);
    dutyCount[id] = (dutyCount[id] || 0) + 1; totalFM[id] = (totalFM[id] || 0) + fazlaMesai; lastDutyDay[id] = d;
    if (dw === CUMARTESI || dw === PAZAR) weekendCount[id] = (weekendCount[id] || 0) + 1;
    if (dw === CUMARTESI) cmtCount[id] = (cmtCount[id] || 0) + 1; else if (dw === PAZAR) pazCount[id] = (pazCount[id] || 0) + 1; else if (dw === CUMA) cumaGunCount[id] = (cumaGunCount[id] || 0) + 1;
    if (B.cumaTipiMi(y, m, d)) cuCount[id] = (cuCount[id] || 0) + 1;
    if (dw === PERSEMBE) thursdayCount[id] = (thursdayCount[id] || 0) + 1;
    if (B.resmiTatilMi(y, m, d)) resmiCount[id] = (resmiCount[id] || 0) + 1;
  };

  // kişinin bu ay d. günden itibaren kalan, kesin yasağı olmayan Cumartesi/Pazar günü sayısı
  const hsKalanOnb: Record<string, number> = {};
  function hsKalan(id: number, d: number) {
    const k = id + "-" + d; if (hsKalanOnb[k] !== undefined) return hsKalanOnb[k];
    let n = 0;
    for (let g = d; g <= dim; g++) { const w = gunTuru(g); if ((w === CUMARTESI || w === PAZAR) && !B.kesinYasak(id, y, m, g)) n++; }
    return (hsKalanOnb[k] = n);
  }

  // Aday havuzunu daralt: kesin yasaklı (izin vb.) kişi istisnasız hariç tutulur; sonra dinlenme + "istemiyor" kuralına
  // uy, hiçbiri kalmazsa sırayla bu kuralları gevşet (ve conflict=true işaretle). Gün türü tercihleri (3 gün ara,
  // Perşembe/hafta sonu, ay aşırı telafi) burada elenmez, sıralamada yumuşak kıstastır (bkz. siraya).
  function adaylar(d: number, pool: Kisi[], dinlenen: Set<number>): { list: Kisi[]; conflict: boolean } {
    let izinsiz = pool.filter(s => !B.kesinYasak(s.id, y, m, d) && !sonGunEngel(s.id, d));
    // kesin kural: ayda en fazla 1 Cumartesi, 1 Pazar; Cuma + Cumartesi + Pazar üçü birden mümkünse olmaz (güçlü tercih)
    {
      const dw = gunTuru(d);
      const sinirda = (s: Kisi) => (dw === CUMARTESI && (cmtCount[s.id] || 0) > 0) || (dw === PAZAR && (pazCount[s.id] || 0) > 0);
      const uclu = (s: Kisi) => {
        const cu = cumaGunCount[s.id] || 0, ct = cmtCount[s.id] || 0, pz = pazCount[s.id] || 0;
        return (dw === CUMARTESI && cu > 0 && pz > 0) || (dw === PAZAR && cu > 0 && ct > 0) || (dw === CUMA && ct > 0 && pz > 0);
      };
      const kesin = izinsiz.filter(s => !sinirda(s)), tercih = kesin.filter(s => !uclu(s));
      if (tercih.length) izinsiz = tercih; else if (kesin.length) izinsiz = kesin;
    }
    const dinlenmis = izinsiz.filter(s => !dinlenen.has(s.id));
    const istekli = dinlenmis.filter(s => B.tercih(s.id, y, m, d) !== "avoid" && !B.izinOncesiMi(s.id, y, m, d));
    if (istekli.length > 0) return { list: istekli, conflict: false };
    if (dinlenmis.length > 0) return { list: dinlenmis, conflict: true };
    const istemiyorDegil = izinsiz.filter(s => B.tercih(s.id, y, m, d) !== "avoid");
    if (istemiyorDegil.length > 0) return { list: istemiyorDegil, conflict: true };
    return { list: izinsiz, conflict: izinsiz.length > 0 };
  }

  // Asıl belirleyici birikmiş toplam fazla mesai (en az olana öncelik), sonra nöbet sayısı; hafta sonu günü ise önce bu
  // ay henüz hafta sonu nöbeti olmayan ve yıllık hafta sonu payı az olan. Bunlardan sonra yalnız eşitlik durumunda devreye
  // giren yumuşak tercihler (istiyor, 3 gün ara, Perşembe/hafta sonu) gelir; hiçbiri saat/hafta sonu eşitliğini bozamaz.
  function siraya(list: Kisi[], d: number): Kisi[] {
    const dw = gunTuru(d);
    const resmiBugun = B.resmiTatilMi(y, m, d), haftaSonu = dw === CUMARTESI || dw === PAZAR, cumaTipi = B.cumaTipiMi(y, m, d);
    const araCezasi = (id: number) => { const last = lastDutyDay[id]; if (last === undefined) return 0; return d - last >= B.sayi("minAra") ? 0 : 1; };
    const persembeCezasi = (id: number) => {
      if (!B.ayar("thuHaftaSonu")) return 0;
      if (dw !== CUMARTESI && dw !== PAZAR) return 0;
      const last = lastDutyDay[id]; if (last === undefined) return 0;
      return gunTuru(last) === PERSEMBE ? 1 : 0;
    };
    // geçen ay Pazar tutan bu ay Cumartesi, Cumartesi tutan Pazar'a öncelikli
    const tur = (id: number) => {
      const pv = devir.prev[id]; if (!pv) return 0;
      if (dw === CUMARTESI) return pv.sun > 0 ? -1 : (pv.sat > 0 ? 1 : 0);
      return pv.sat > 0 ? -1 : (pv.sun > 0 ? 1 : 0);
    };
    return list.slice().sort((a, b) => {
      if (haftaSonu) {
        // bu ay henüz hafta sonu nöbeti olmayan öne (ayda en az 1 hafta sonu)
        const a0 = weekendCount[a.id] > 0 ? 1 : 0, b0 = weekendCount[b.id] > 0 ? 1 : 0;
        if (a0 !== b0) return a0 - b0;
        // ikisi de 0 ise: bu ay kalan uygun hafta sonu günü az olan öne (izne çıkacak olan kaçırmasın)
        if (a0 === 0) { const ak = hsKalan(a.id, d), bk = hsKalan(b.id, d); if (ak !== bk) return ak - bk; }
        // yıl içinde (önceki aylar + bu ay) hafta sonu nöbeti payına göre az olan öne
        const ah = weekendCount[a.id] + (hsDv[a.id] || 0), bh = weekendCount[b.id] + (hsDv[b.id] || 0);
        if (Math.abs(ah - bh) >= 0.5) return ah - bh;
        // aynı gün türü (Cumartesi ya da Pazar) yıl içinde payına göre az olan öne
        const [buAy, dv] = dw === CUMARTESI ? [cmtCount, cmtDv] : [pazCount, pazDv];
        const ag = (buAy[a.id] || 0) + (dv[a.id] || 0), bg = (buAy[b.id] || 0) + (dv[b.id] || 0);
        if (Math.abs(ag - bg) >= 0.5) return ag - bg;
        const ta = tur(a.id), tb = tur(b.id);
        if (ta !== tb) return ta - tb;
      }
      if (dw === PERSEMBE) {
        const at = thursdayCount[a.id] >= B.sayi("maxThu") ? 1 : 0, bt = thursdayCount[b.id] >= B.sayi("maxThu") ? 1 : 0;
        if (at !== bt) return at - bt;
        // geçen ay Perşembe nöbeti almayanlara öncelik
        const pa = (devir.prev[a.id] || { thu: 0 }).thu > 0 ? 1 : 0, pb = (devir.prev[b.id] || { thu: 0 }).thu > 0 ? 1 : 0;
        if (pa !== pb) return pa - pb;
      }
      if (resmiBugun) {
        // resmi tatil nöbeti: yıl içinde en az resmi tatil nöbeti tutana öncelik
        const ra = (resmiDv.off[a.id] || 0) + (resmiCount[a.id] || 0), rb = (resmiDv.off[b.id] || 0) + (resmiCount[b.id] || 0);
        if (Math.abs(ra - rb) > 1e-9) return ra - rb;
      }
      if (cumaTipi) {
        // Cuma: yıl içinde Cuma nöbetini payına göre az tutan öne
        const ac = (cuCount[a.id] || 0) + (cuDv[a.id] || 0), bc = (cuCount[b.id] || 0) + (cuDv[b.id] || 0);
        if (Math.abs(ac - bc) >= 0.5) return ac - bc;
      }
      if (totalFM[a.id] !== totalFM[b.id]) return totalFM[a.id] - totalFM[b.id];
      if (dutyCount[a.id] !== dutyCount[b.id]) return dutyCount[a.id] - dutyCount[b.id];
      if (haftaSonu && weekendCount[a.id] !== weekendCount[b.id]) return weekendCount[a.id] - weekendCount[b.id];
      // "istiyor": eşit ve adil dağıtımın önüne geçmez, yalnız eşitlik hâlinde tercih edilir
      const aw = B.tercih(a.id, y, m, d) === "want" ? 0 : 1, bw = B.tercih(b.id, y, m, d) === "want" ? 0 : 1;
      if (aw !== bw) return aw - bw;
      const ag = araCezasi(a.id), bg = araCezasi(b.id);
      if (ag !== bg) return ag - bg;
      const at = persembeCezasi(a.id), bt = persembeCezasi(b.id);
      if (at !== bt) return at - bt;
      return sira[a.id] - sira[b.id];
    });
  }

  const days: MotorGunu[] = [];
  let oncekiNobetciler = sinir.oncekiSonN.slice();
  for (let d = 1; d <= dim; d++) {
    const tatil = B.tatilMi(y, m, d);
    const fazlaMesai = B.fazlaMesai(y, m, d, dim);
    const kayitli = taslak[d - 1];

    // elle girilip kilitlenmiş gün: dokunma, sadece sayaçları güncelle
    if (kayitli && kayitli.locked) {
      const ids = kayitli.assigned.map(p => p.id);
      ids.forEach(id => say(id, d, fazlaMesai));
      const kilitliPrep = kayitli.prep || [];
      kilitliPrep.forEach(pp => { totalFM[pp.id] = (totalFM[pp.id] || 0) + hazSaat; });
      days.push({ day: d, tatil, conflict: kayitli.conflict || false, fazlaMesai, assigned: kayitli.assigned, prep: kilitliPrep, locked: true });
      oncekiNobetciler = ids;
      continue;
    }

    const dinlenen = new Set(oncekiNobetciler);
    // kilitli günlerde hazırlama personeli olanlar komşu günlerde nöbetçi yazılmasın
    [d - 2, d - 1, d].forEach(ix => { const e = taslak[ix]; if (e && e.locked && e.prep) e.prep.forEach(pp => dinlenen.add(pp.id)); });
    if (d === 1) sinir.oncekiSonH.forEach(id => dinlenen.add(id));
    if (d === dim) sinir.sonrakiIlkN.concat(sinir.sonrakiIlkH).forEach(id => dinlenen.add(id));
    // 5 gün içinde 3 nöbet olmasın: 2 ve 4 gün önce nöbet tutan bu gün dinlenir
    eczacilar.concat(teknisyenler).forEach(s => { if (ucluSikisik(days, sinir, s.id, d - 1)) dinlenen.add(s.id); });
    let conflict = false;

    // eş durumu "istiyor" işaretliler bu güne kesin yazılır
    const zSec = A.esDurumu[d - 1].secilen;   // birlikte yazılamayan istekler düşmüş olarak (ay.ts esDurumuSec)
    const zEcz = zSec.filter(s => eczaciMi(s.role)), zDiger = zSec.filter(s => !eczaciMi(s.role));
    let p1: Kisi | null = null, p2: Kisi | null = null;
    if (zEcz.length) { p1 = zEcz[0]; p2 = zEcz[1] || zDiger[0] || null; }
    else if (zDiger.length >= 2) { p1 = zDiger[0]; p2 = zDiger[1]; conflict = true; }
    else if (zDiger.length === 1) { p2 = zDiger[0]; }
    if (zEcz.length + zDiger.length > 2) conflict = true;
    [p1, p2].forEach(zp => { if (zp && dinlenen.has(zp.id)) conflict = true; });

    if (!p1) {
      const r = adaylar(d, eczacilar, dinlenen);
      conflict = conflict || r.conflict;
      p1 = siraya(r.list, d)[0] || null;
      if (!p1) conflict = true;
    }
    if (!p2) {
      // dışarıdan gelen iki eczacı aynı gün birlikte nöbetçi olmaz (Cuma ve Cumartesi olabilir)
      const ilk = p1, ikiDisaridanOlur = ikiDisaridanSerbestMi(y, m, d);
      const havuz = eczacilar.concat(teknisyenler).filter(s => (!ilk || s.id !== ilk.id) && !(ilk && ilk.role === "nobetci" && s.role === "nobetci" && !ikiDisaridanOlur));
      const r = adaylar(d, havuz, dinlenen);
      conflict = conflict || r.conflict;
      p2 = siraya(r.list, d)[0] || null;
      if (!p2) conflict = true;
    }

    const bugun = [p1, p2].filter((s): s is Kisi => !!s);
    bugun.forEach(s => say(s.id, d, fazlaMesai));
    days.push({ day: d, tatil, conflict, fazlaMesai, locked: false, prep: [], assigned: bugun.map(gorevli) });
    oncekiNobetciler = bugun.map(s => s.id);
  }
  return days;
}
