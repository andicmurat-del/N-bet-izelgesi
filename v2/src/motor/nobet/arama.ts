// 3. adım: yerel arama. Açgözlü çizelge, kilitli olmayan günlerde aşağıdaki hamlelerle amaç değeri düşmeyene kadar
// iyileştirilir (her turda en iyi hamle uygulanır). Kesin kurallar (kurallar.ts) her hamlede korunur. Sonra küçük
// rastgele bozmalar + yeniden iyileştirme (yinelemeli yerel arama) ile daha iyi çizelge aranır.
import { gorevli, hazirlamaRol } from "../baglam";
import type { Gorevli, Kisi } from "../../veri/tipler";
import { AGIRLIK, HAZ_SAYISI } from "../sabitler";
import { CUMARTESI } from "../takvim";
import type { Amac } from "./amac";
import type { Kurallar } from "./kurallar";
import type { AramaKurulumu } from "./kurulum";

/** boş hazırlama yeri (hamle 3 için; rolü destek değil) */
const BOS_YER = { id: -1, role: "" };

/** en iyi hamle: uygulanması için gereken bilgi */
type Hamle =
  | { tip: "kisi"; i: number; a: Gorevli; b: Kisi }                                   // nöbetçiyi değiştir
  | { tip: "takas"; i: number; k: number; a: Gorevli; b: Gorevli }                    // iki günün nöbetçilerini takas et
  | { tip: "hazKisi"; i: number; slot: number; b: Kisi }                              // hazırlama personelini değiştir
  | { tip: "hazTakas"; i: number; k: number; si: number; sk: number }                 // iki günün hazırlamacılarını takas et
  | { tip: "destekEkle"; i: number; b: Kisi }                                         // destek personeli ekle
  | { tip: "resmiHaz"; i: number; k: number; slot: number; b: Kisi; c: Kisi }        // resmi tatil hazırlaması için komşu nöbeti devret
  | { tip: "resmiNobet"; i: number; k: number; a: Gorevli; b: Kisi; c: Kisi }        // resmi tatil nöbeti için komşu nöbeti devret
  | { tip: "nobetHaz"; i: number; a: Gorevli; slot: number; pid: number }             // aynı gün nöbet ↔ hazırlama
  | { tip: "hazNobet"; i: number; k: number; slot: number; aId: number; bId: number }; // hazırlamayı ver, nöbet al

export function yerelArama(K: AramaKurulumu, kural: Kurallar, amac: Amac, simdi: () => number): void {
  const { A, days, staffList, tumHavuz, destekler, destekVar, degisimHavuzu, ayniTur, resmiGunVar, resmiGunDizi, hIx, gunDow } = K;
  const { zorunluMu, gunGecerli, temelUygun, prepUygun, tatilGunu, yasak, gundeVar, persembeNobetliMi } = kural;
  const { hesaplaJ, tabanKur, jDelta, tabanIhlalli } = amac;
  // hamle sonrası gün kurallara uyuyor mu; gün zaten ihlalliyse temel kurallar korunarak hamle denenebilir (ihlali tek
  // kişiyle gidermek her zaman mümkün değil, ör. aynı iki kişi art arda iki gün): ihlal sayısını amaç fonksiyonu tartar,
  // artıran hamle seçilmez
  const uygunGun = (i: number) => gunGecerli(i) || (tabanIhlalli(i) && temelUygun(i));
  const bul = (id: number) => staffList.find(s => s.id === id)!;
  const havuzdanBul = (id: number) => tumHavuz.find(s => s.id === id);
  // görevli nesneleri kaynak nesne başına bir kez oluşturulur (her aday hamlede yeni nesne oluşmasın)
  const nesneler = new Map<object, Gorevli>();
  const gn = (s: Kisi | Gorevli) => { let o = nesneler.get(s); if (!o) { o = gorevli(s); nesneler.set(s, o); } return o; };

  let J = hesaplaJ();

  /** en iyi hamleyi uygula */
  function uygula(h: Hamle) {
    switch (h.tip) {
      case "hazNobet": {
        const aOb = gn(bul(h.aId)), bOb = gn(havuzdanBul(h.bId) || bul(h.bId));
        days[h.k].assigned = days[h.k].assigned.map(p => (p.id === h.bId ? aOb : p));
        const liste = days[h.i].prep;
        days[h.i].prep = h.slot < liste.length ? liste.map((pp, ix) => (ix === h.slot ? bOb : pp)) : liste.concat([bOb]);
        break;
      }
      case "nobetHaz": {
        const dI = days[h.i], pOb = gn(bul(h.pid)), aOb = gn(h.a);
        dI.assigned = dI.assigned.map(p => (p.id === h.a.id ? pOb : p));
        dI.prep = dI.prep.map((q, ix) => (ix === h.slot ? aOb : q));
        break;
      }
      case "resmiNobet": {
        const bOb = gn(bul(h.b.id)), cOb = gn(bul(h.c.id));
        days[h.k].assigned = days[h.k].assigned.map(p => (p.id === h.b.id ? cOb : p));
        days[h.i].assigned = days[h.i].assigned.map(p => (p.id === h.a.id ? bOb : p));
        break;
      }
      case "resmiHaz": {
        const bOb = gn(havuzdanBul(h.b.id) || h.b), cOb = gn(bul(h.c.id));
        days[h.k].assigned = days[h.k].assigned.map(p => (p.id === h.b.id ? cOb : p));
        days[h.i].prep = days[h.i].prep.map((pp, ix) => (ix === h.slot ? bOb : pp));
        break;
      }
      case "destekEkle": {
        const lst = days[h.i].prep, nb = gn(havuzdanBul(h.b.id)!);
        days[h.i].prep = lst.length < HAZ_SAYISI ? lst.concat([nb]) : lst.map((pp, ix) => (ix === lst.length - 1 ? nb : pp));
        break;
      }
      case "hazKisi": {
        const liste = days[h.i].prep, nb = gn(havuzdanBul(h.b.id)!);
        days[h.i].prep = h.slot < liste.length ? liste.map((pp, ix) => (ix === h.slot ? nb : pp)) : liste.concat([nb]);
        break;
      }
      case "hazTakas": {
        const li = days[h.i].prep, lk = days[h.k].prep, pa = li[h.si], pb = lk[h.sk];
        days[h.i].prep = li.map((pp, ix) => (ix === h.si ? pb : pp));
        days[h.k].prep = lk.map((pp, ix) => (ix === h.sk ? pa : pp));
        break;
      }
      case "kisi": {
        const dy = days[h.i], b = bul(h.b.id);
        dy.assigned = dy.assigned.map(p => (p.id === h.a.id ? gn(b) : p));
        break;
      }
      case "takas": {
        const ei = days[h.i].assigned, ek = days[h.k].assigned;
        days[h.i].assigned = ei.map(p => (p.id === h.a.id ? h.b : p));
        days[h.k].assigned = ek.map(p => (p.id === h.b.id ? h.a : p));
        break;
      }
    }
  }

  /** her turda bütün hamleleri dene, en iyisini uygula; iyileşme kalmayınca dur */
  function inis() {
    for (let tur = 0; tur < 400; tur++) {
      let enIyiJ = J, enIyi: Hamle | null = null;
      // aday hamle şimdiye kadarkinden iyi mi (iyiyse en iyi değer güncellenir; hamle kaydı yalnız o zaman oluşturulur)
      const iyiMi = (j2: number) => { if (j2 < enIyiJ - 1e-9) { enIyiJ = j2; return true; } return false; };
      tabanKur();
      // 1) bir nöbetçiyi başka biriyle değiştir
      for (let i = 0; i < days.length; i++) {
        const dy = days[i];
        if (dy.locked) continue;
        const eski = dy.assigned;
        for (const a of eski) {
          if (zorunluMu(a.id, i)) continue;
          for (const b of staffList) {
            if (b.id === a.id || eski.some(p => p.id === b.id)) continue;
            dy.assigned = eski.map(p => (p.id === a.id ? gn(b) : p));
            if (uygunGun(i) && iyiMi(jDelta(i, -1, true))) enIyi = { tip: "kisi", i, a, b };
            dy.assigned = eski;
          }
        }
      }
      // 2) iki günün nöbetçilerini takas et
      for (let i = 0; i < days.length; i++) {
        if (days[i].locked) continue;
        for (let k = i + 1; k < days.length; k++) {
          if (days[k].locked) continue;
          const ei = days[i].assigned, ek = days[k].assigned;
          for (const a of ei) {
            if (ek.some(p => p.id === a.id) || zorunluMu(a.id, i)) continue;
            for (const b of ek) {
              if (ei.some(p => p.id === b.id) || zorunluMu(b.id, k)) continue;
              days[i].assigned = ei.map(p => (p.id === a.id ? b : p));
              days[k].assigned = ek.map(p => (p.id === b.id ? a : p));
              if (uygunGun(i) && uygunGun(k) && iyiMi(jDelta(i, k, true))) enIyi = { tip: "takas", i, k, a, b };
              days[i].assigned = ei; days[k].assigned = ek;
            }
          }
        }
      }
      // 3) bir hazırlama personelini (belirli bir yerde) değiştir; boş kalmış yer varsa (ilk yerleştirmede kimse uygun
      //    değildi) oraya da yazmayı dene
      for (let i = 0; i < days.length; i++) {
        if (days[i].locked || !tatilGunu(i)) continue;
        const eskiListe = days[i].prep, yerSay = eskiListe.length + (eskiListe.length < HAZ_SAYISI ? 1 : 0);
        for (let slot = 0; slot < yerSay; slot++) {
          const eskiP = slot < eskiListe.length ? eskiListe[slot] : BOS_YER;
          for (const b of degisimHavuzu(eskiP, slot)) {
            if (b.id === eskiP.id || eskiListe.some((pp, ix) => ix !== slot && pp.id === b.id)) continue;
            days[i].prep = slot < eskiListe.length ? eskiListe.map((pp, ix) => (ix === slot ? gn(b) : pp)) : eskiListe.concat([gn(b)]);
            if (prepUygun(b.id, i) && iyiMi(jDelta(i, -1, false))) enIyi = { tip: "hazKisi", i, slot, b };
            days[i].prep = eskiListe;
          }
        }
      }
      // 4) iki günün hazırlama personelini (yer yere) takas et
      for (let i = 0; i < days.length; i++) {
        if (days[i].locked || !tatilGunu(i) || !days[i].prep.length) continue;
        for (let k = i + 1; k < days.length; k++) {
          if (days[k].locked || !tatilGunu(k) || !days[k].prep.length) continue;
          for (let si = 0; si < days[i].prep.length; si++) {
            for (let sk = 0; sk < days[k].prep.length; sk++) {
              const pa = days[i].prep[si], pb = days[k].prep[sk];
              if (pa.id === pb.id || (!ayniTur(pa, pb) && !(si === 1 && sk === 1))) continue;
              if (days[i].prep.some((pp, ix) => ix !== si && pp.id === pb.id)) continue;
              if (days[k].prep.some((pp, ix) => ix !== sk && pp.id === pa.id)) continue;
              const eskiI = days[i].prep, eskiK = days[k].prep;
              days[i].prep = eskiI.map((pp, ix) => (ix === si ? pb : pp));
              days[k].prep = eskiK.map((pp, ix) => (ix === sk ? pa : pp));
              if (prepUygun(pb.id, i) && prepUygun(pa.id, k) && iyiMi(jDelta(i, k, false))) enIyi = { tip: "hazTakas", i, k, si, sk };
              days[i].prep = eskiI; days[k].prep = eskiK;
            }
          }
        }
      }
      // 5) destek yeri boş olan tatil gününe destek personeli ekle
      if (destekVar) {
        for (let i = 0; i < days.length; i++) {
          if (days[i].locked || !tatilGunu(i)) continue;
          if (days[i].prep.some(pp => pp.role === "destek")) continue;
          const eskiL = days[i].prep;
          for (const b of destekler) {
            if (eskiL.some(pp => pp.id === b.id)) continue;
            days[i].prep = eskiL.length < HAZ_SAYISI ? eskiL.concat([gn(b)]) : eskiL.map((pp, ix) => (ix === eskiL.length - 1 ? gn(b) : pp));
            if (prepUygun(b.id, i) && iyiMi(jDelta(i, -1, false))) enIyi = { tip: "destekEkle", i, b };
            days[i].prep = eskiL;
          }
        }
      }
      // 6) hazırlamaya b yazılamıyor, çünkü b komşu günde (boş yer için: ya da o haftanın Perşembesinde) nöbetçi:
      //    o nöbeti c'ye devredip b'yi hazırlamaya almayı dene. Resmi tatilde dolu yerler için de (nöbet ve hazırlama
      //    gün sayısı ayrı ayrı eşitlenebilsin); diğer tatil günlerinde yalnız boş kalan yer için (tek hamleyle
      //    doldurulamayan hazırlama yeri)
      for (let i = 0; i < days.length; i++) {
        if (days[i].locked || !tatilGunu(i)) continue;
        const eskiListe = days[i].prep, bos = eskiListe.length < HAZ_SAYISI;
        if (!bos && !resmiGunDizi[i]) continue;
        for (let slot = resmiGunDizi[i] ? 0 : eskiListe.length; slot < eskiListe.length + (bos ? 1 : 0); slot++) {
          const pa = slot < eskiListe.length ? eskiListe[slot] : BOS_YER;
          for (const b of degisimHavuzu(pa, slot)) {
            if (b.id === pa.id || eskiListe.some(pp => pp.id === b.id) || yasak(b.id, i) || gundeVar(i, b.id)) continue;
            const aday = [i - 1, i + 1];
            if (pa === BOS_YER && persembeNobetliMi(b.id, i)) aday.push(i - (gunDow[i] === CUMARTESI ? 2 : 3));
            const kl = aday.filter(k => k >= 0 && k < days.length && gundeVar(k, b.id));
            if (kl.length !== 1) continue;
            const k = kl[0];
            if (days[k].locked || zorunluMu(b.id, k)) continue;
            const eskiK = days[k].assigned;
            for (const c of staffList) {
              if (c.id === b.id || eskiK.some(p => p.id === c.id)) continue;
              days[k].assigned = eskiK.map(p => (p.id === b.id ? gn(c) : p));
              days[i].prep = slot < eskiListe.length ? eskiListe.map((pp, ix) => (ix === slot ? gn(b) : pp)) : eskiListe.concat([gn(b)]);
              const cHazirlamada = days[i].prep.some(pp => pp.id === c.id) || (k - 1 >= 0 && (days[k - 1].prep || []).some(pp => pp.id === c.id)) || (k + 1 < days.length && (days[k + 1].prep || []).some(pp => pp.id === c.id));
              if (uygunGun(k) && prepUygun(b.id, i) && !cHazirlamada && iyiMi(jDelta(i, k, true))) enIyi = { tip: "resmiHaz", i, k, slot, b, c };
              days[k].assigned = eskiK; days[i].prep = eskiListe;
            }
          }
        }
      }
      // 7) resmi tatil nöbeti: b komşu günde nöbetçi olduğu için resmi tatil nöbetine geçemiyorsa, komşu
      //    gündeki nöbetini c'ye devredip resmi tatil gününde a'nın yerine b'yi yazmayı dene
      if (resmiGunVar) {
        for (let i = 0; i < days.length; i++) {
          if (days[i].locked || !resmiGunDizi[i]) continue;
          const eskiI = days[i].assigned;
          for (const a of eskiI) {
            if (zorunluMu(a.id, i)) continue;
            for (const b of staffList) {
              if (eskiI.some(p => p.id === b.id) || yasak(b.id, i)) continue;
              const kl = [i - 1, i + 1].filter(k => k >= 0 && k < days.length && gundeVar(k, b.id));
              if (kl.length !== 1) continue;
              const k = kl[0];
              if (days[k].locked || zorunluMu(b.id, k)) continue;
              const eskiK = days[k].assigned;
              for (const c of staffList) {
                if (c.id === b.id || eskiK.some(p => p.id === c.id)) continue;
                days[k].assigned = eskiK.map(p => (p.id === b.id ? gn(c) : p));
                days[i].assigned = eskiI.map(p => (p.id === a.id ? gn(b) : p));
                if (uygunGun(i) && uygunGun(k) && iyiMi(jDelta(i, k, true))) enIyi = { tip: "resmiNobet", i, k, a, b, c };
                days[k].assigned = eskiK; days[i].assigned = eskiI;
              }
            }
          }
        }
      }
      // 8) resmi tatil gününde aynı günün nöbetçisi ile hazırlama personelinin görevlerini değiştir
      //    (nöbet sayısı fazla olan hazırlamaya, hazırlaması fazla olan nöbete geçebilsin)
      if (resmiGunVar) {
        for (let i = 0; i < days.length; i++) {
          if (days[i].locked || !resmiGunDizi[i] || !tatilGunu(i)) continue;
          const eA = days[i].assigned, eP = days[i].prep;
          for (const a of eA) {
            if (zorunluMu(a.id, i) || hIx[a.id] === undefined) continue;
            for (let slot = 0; slot < eP.length; slot++) {
              const pp = eP[slot];
              if (pp.role === "destek" || !hazirlamaRol(a.role) || !staffList.some(s => s.id === pp.id)) continue;
              days[i].assigned = eA.map(p => (p.id === a.id ? gn(bul(pp.id)) : p));
              days[i].prep = eP.map((q, ix) => (ix === slot ? gn(a) : q));
              if (uygunGun(i) && prepUygun(a.id, i) && iyiMi(jDelta(i, -1, true))) enIyi = { tip: "nobetHaz", i, a, slot, pid: pp.id };
              days[i].assigned = eA; days[i].prep = eP;
            }
          }
        }
      }
      // 9) hazırlamayı a'dan b'ye ver, karşılığında b'nin bir nöbetini a'ya ver (fazla mesai saatleri korunurken
      //    hazırlama sayıları eşitlenebilsin; fazla mesai kesin kuralı tek adımlık değişimlere izin vermediğinde gerekir)
      for (let i = 0; i < days.length; i++) {
        if (days[i].locked || !tatilGunu(i)) continue;
        const eP = days[i].prep;
        for (let slot = 0; slot < eP.length; slot++) {
          const pa = eP[slot];
          if (pa.role === "destek" || hIx[pa.id] === undefined) continue;
          const aS = staffList.find(s => s.id === pa.id); if (!aS) continue;
          for (const b of degisimHavuzu(pa, slot)) {
            if (b.id === pa.id || b.role === "destek" || eP.some(pp => pp.id === b.id) || hIx[b.id] === undefined) continue;
            for (let k = 0; k < days.length; k++) {
              if (k === i || days[k].locked) continue;
              const eK = days[k].assigned;
              if (!eK.some(p => p.id === b.id) || eK.some(p => p.id === pa.id) || zorunluMu(b.id, k)) continue;
              days[k].assigned = eK.map(p => (p.id === b.id ? gn(aS) : p));
              days[i].prep = eP.map((pp, ix) => (ix === slot ? gn(b) : pp));
              if (uygunGun(k) && prepUygun(b.id, i) && iyiMi(jDelta(i, k, true))) enIyi = { tip: "hazNobet", i, k, slot, aId: pa.id, bId: b.id };
              days[k].assigned = eK; days[i].prep = eP;
            }
          }
        }
      }
      const secilen = enIyi as Hamle | null;   // iyiMi() ile birlikte atanır
      if (!secilen) break;
      uygula(secilen);
      J = enIyiJ;
    }
  }
  inis();

  // yinelemeli yerel arama: küçük rastgele bozmalar + tekrar iyileştirme; daha iyi sonuç bulunursa saklanır
  // (~2.5 sn; uyarı kalmışsa uyarısız çizelge için en fazla ~8 sn)
  const kopyala = () => days.map(dy => ({ a: dy.assigned.slice(), p: dy.prep.slice() }));
  const geriYukle = (k: { a: Gorevli[]; p: Gorevli[] }[]) => days.forEach((dy, i) => { dy.assigned = k[i].a.slice(); dy.prep = k[i].p.slice(); });
  let enIyiKopya = kopyala();
  let enIyiToplamJ = J;
  let tohum = 12345 + A.varyasyon * 7919;
  const rnd = () => { tohum = (tohum * 1103515245 + 12345) & 0x7fffffff; return tohum / 0x7fffffff; };
  const bitis = simdi() + 2500, bitisUzun = simdi() + 8000;
  const acikGunler: number[] = [];
  days.forEach((dy, i) => { if (!dy.locked) acikGunler.push(i); });
  let denemeSayisi = 0;
  while (acikGunler.length > 2 && ((simdi() < bitis && denemeSayisi < 60) || (enIyiToplamJ >= AGIRLIK.UYARI && simdi() < bitisUzun && denemeSayisi < 600))) {
    denemeSayisi++;
    // birkaç nöbetçiyi rastgele değiştir
    const bozulacak = 3 + Math.floor(rnd() * 4);
    for (let z = 0; z < bozulacak; z++) {
      const i = acikGunler[Math.floor(rnd() * acikGunler.length)];
      const dy = days[i];
      if (!dy.assigned.length) continue;
      const a = dy.assigned[Math.floor(rnd() * dy.assigned.length)];
      const b = staffList[Math.floor(rnd() * staffList.length)];
      if (zorunluMu(a.id, i) || b.id === a.id || dy.assigned.some(p => p.id === b.id)) continue;
      const eski = dy.assigned;
      dy.assigned = eski.map(p => (p.id === a.id ? gn(b) : p));
      if (!gunGecerli(i)) dy.assigned = eski;
    }
    // iki hazırlama yerini rastgele değiştir
    for (let z = 0; z < 2; z++) {
      const adaylarGun = acikGunler.filter(i => tatilGunu(i) && days[i].prep.length > 0);
      if (!adaylarGun.length) break;
      const i = adaylarGun[Math.floor(rnd() * adaylarGun.length)];
      const slot = Math.floor(rnd() * days[i].prep.length);
      const havuzB = degisimHavuzu(days[i].prep[slot], slot);
      const b = havuzB[Math.floor(rnd() * havuzB.length)];
      if (days[i].prep.some((pp, ix) => ix !== slot && pp.id === b.id)) continue;
      const eskiListe = days[i].prep;
      days[i].prep = eskiListe.map((pp, ix) => (ix === slot ? gn(b) : pp));
      if (!prepUygun(b.id, i)) days[i].prep = eskiListe;
    }
    J = hesaplaJ();
    inis();
    if (J < enIyiToplamJ - 1e-9) { enIyiToplamJ = J; enIyiKopya = kopyala(); }
    else { geriYukle(enIyiKopya); J = enIyiToplamJ; }
  }
  geriYukle(enIyiKopya);

  // onarım: ilk yerleştirmede "başka kimse yok" diye kural esnetilerek yazılmış hazırlamalar (art arda hazırlama,
  // komşu gün nöbeti) sonradan uygun biri bulunursa ona verilir (en az bozan seçilir)
  for (let tur = 0; tur < 3; tur++) {
    let degisti = false;
    for (let i = 0; i < days.length; i++) {
      if (days[i].locked || !tatilGunu(i)) continue;
      for (let slot = 0; slot < days[i].prep.length; slot++) {
        const pp = days[i].prep[slot];
        if (prepUygun(pp.id, i)) continue;
        const eski = days[i].prep; let enIyiB: Kisi | null = null, enIyiJ2 = Infinity;
        tabanKur();
        for (const b of degisimHavuzu(pp, slot)) {
          if (b.id === pp.id || eski.some(q => q.id === b.id)) continue;
          days[i].prep = eski.map((q, ix) => (ix === slot ? gn(b) : q));
          if (prepUygun(b.id, i)) { const j2 = jDelta(i, -1, false); if (j2 < enIyiJ2) { enIyiJ2 = j2; enIyiB = b; } }
          days[i].prep = eski;
        }
        if (enIyiB) { const sec = enIyiB; days[i].prep = eski.map((q, ix) => (ix === slot ? gn(sec) : q)); degisti = true; }
      }
    }
    if (!degisti) break;
  }
}
