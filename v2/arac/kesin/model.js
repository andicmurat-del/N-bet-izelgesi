// Kesin kontrol (geliştirme aracı; programa girmez): bir ayın çizelgesini kesin çözücüyle (HiGHS, karma tamsayılı
// doğrusal programlama) karşılaştırır.
//  1) Her ölçütün tek başına olabilecek en iyi değeri: programın kesin kuralları (ve uyarı düzeyindeki kuralları) zorunlu
//     kısıt, ölçüt hedef. Program bu değere ulaşıyorsa o ölçütte kanıtlanmış en iyidir.
//  2) "Hiçbir ölçütü kötüleştirmeden daha iyisi var mı": ölçütler programınkinden kötü olamaz, ağırlıklı toplam küçültülür;
//     bulunan çizelge programın kendi denetimi, bağımsız denetçi ve programın amaç değeriyle (J) ölçülür.
// Model programın kurulum verilerini (yasak günler, eş durumu, ay sınırı, fazla mesai saatleri) motordan alır; programın
// kendi çizelgesinin modele uyduğu ayrıca denetlenir (uymuyorsa model programdan sıkıdır, sonuç geçersizdir).
// Ölçütler motor/olcut.ts'tekilerle aynı tanım. Çalıştırma: npm run kesin-kontrol (arac/kesin/kesin-kontrol.test.js).
import highsYukle from "highs";
import { Baglam, eczaciMi, gorevli } from "../../src/motor/baglam";
import { ayBilgisi, nobetKadrosu } from "../../src/motor/nobet/ay";
import { ilkYerlestirme } from "../../src/motor/nobet/ilkYerlestirme";
import { aramaKur } from "../../src/motor/nobet/kurulum";
import { kurallarKur } from "../../src/motor/nobet/kurallar";
import { amacKur } from "../../src/motor/nobet/amac";
import { hazirlamaAta } from "../../src/motor/nobet/hazirlama";
import { gunleriIsaretle, uyarilariYaz } from "../../src/motor/nobet/uyarilar";
import { cizelgeOlustur, cizelgeOlcutleri } from "../../src/motor";
import { fmKuralKisileri } from "../../src/motor/istatistik";
import { CUMA, CUMARTESI, PAZAR, PERSEMBE } from "../../src/motor/takvim";
import { cizelgeyiDenetle } from "../../test/denetim/bagimsiz";

let highs = null;
const cozucu = async () => (highs ??= await highsYukle());

function kur(veri, y, m) {
  const B = new Baglam(veri);
  const { eczacilar, teknisyenler } = nobetKadrosu(B, y, m);
  const A = ayBilgisi(B, y, m, 0, eczacilar, teknisyenler);
  const days = ilkYerlestirme(A);
  const K = aramaKur(A, days);
  const kural = kurallarKur(K);
  hazirlamaAta(K, kural);
  return { B, A, K, kural };
}

/** programın çizelgesinin ölçütleri ve amaç değeri */
function degerlendir(veri, y, m, gunler) {
  const { K, kural } = kur(veri, y, m);
  K.days.forEach((d, i) => {
    if (d.locked) return;
    d.assigned = gunler[i].assigned.map(p => ({ ...p }));
    d.prep = (gunler[i].prep || []).map(p => ({ ...p }));
  });
  const amac = amacKur(K, kural);
  const j = amac.hesaplaJ();
  K.days.forEach(d => {
    d.assigned = d.assigned.map(gorevli);
    d.prep = d.prep.map(gorevli);
  });
  gunleriIsaretle(K, kural);
  const warnings = uyarilariYaz(K, kural);
  return { j, warnings, days: K.days, olcut: cizelgeOlcutleri(veri, y, m, { days: K.days, warnings }) };
}

function modelKur(veri, y, m, ref) {
  const { B, A, K } = kur(veri, y, m);
  const { days, GUN_SAY: G, gunDow, yasakGun, zorunluGun, staffList, prepAday, destekler, DESTEK_AYLIK, gunFm, gunHz } = K;
  const sinir = A.sinir;
  const kisaAraEsik = K.ayar.minAra;
  const ST = [],
    BIN = new Set(),
    GEN = new Set();
  const v = (t, p, i) => `${t}_${p}_${i}`;
  const NV = {},
    HV = {};
  // değişkenler: nöbet x, hazırlama h (yasak günlerde yok)
  for (const s of staffList)
    for (let i = 0; i < G; i++) {
      const zor = zorunluGun[i].includes(s.id);
      if (!zor && (yasakGun[i][s.id] || A.sonGunEngel(s.id, days[i].day))) continue;
      if (!zor && K.izinOnceGun[i][s.id]) continue; // ertesi gün izne çıkana nöbet (uyarı düzeyi)
      if (!zor && K.prefGun[i][s.id] === "avoid") continue; // "istemiyor" (kesin kural düzeyi)
      NV[s.id + "_" + i] = v("x", s.id, i);
      BIN.add(v("x", s.id, i));
    }
  for (const s of prepAday.concat(destekler))
    for (let i = 0; i < G; i++) {
      if (!days[i].tatil || yasakGun[i][s.id] || K.prefGun[i][s.id] === "avoid") continue;
      HV[s.id + "_" + i] = v("h", s.id, i);
      BIN.add(v("h", s.id, i));
    }
  const X = (id, i) => NV[id + "_" + i],
    H = (id, i) => HV[id + "_" + i];
  const top = l => (l.filter(Boolean).length ? l.filter(Boolean).join(" + ") : "0 dummy");
  const kisit = (ad, ifade, op, sag) => ST.push(` ${ad}: ${ifade} ${op} ${sag}`);
  let n = 0;
  const yeni = () => "c" + n++;
  GEN.add("dummy");
  kisit("sabit0", "dummy", "=", 0);
  // kilitli günler: olduğu gibi
  for (let i = 0; i < G; i++) {
    const dy = days[i];
    if (dy.locked) {
      for (const s of staffList) if (X(s.id, i)) kisit(yeni(), X(s.id, i), "=", dy.assigned.some(p => p.id === s.id) ? 1 : 0);
      for (const s of prepAday.concat(destekler)) if (H(s.id, i)) kisit(yeni(), H(s.id, i), "=", dy.prep.some(p => p.id === s.id) ? 1 : 0);
      continue;
    }
    // günde nöbetçi sayısı, en az bir eczacı
    kisit(yeni(), top(staffList.map(s => X(s.id, i))), "=", dy.nobetSay ?? 2);
    kisit(yeni(), top(staffList.filter(s => eczaciMi(s.role)).map(s => X(s.id, i))), ">=", 1);
    // iki dışarıdan eczacı aynı gün olmaz (Cuma, Cumartesi olabilir)
    if (gunDow[i] !== CUMA && gunDow[i] !== CUMARTESI)
      kisit(yeni(), top(staffList.filter(s => s.role === "nobetci").map(s => X(s.id, i))), "<=", 1);
    // tatil gününde hazırlama sayısı; en az biri eczacı / tekniker
    if (dy.tatil) {
      kisit(yeni(), top(prepAday.concat(destekler).map(s => H(s.id, i))), "=", dy.hazSay ?? 2);
      kisit(yeni(), top(prepAday.map(s => H(s.id, i))), ">=", 1);
    }
    // eş durumu: kesin nöbetçi
    for (const id of zorunluGun[i]) if (X(id, i)) kisit(yeni(), X(id, i), "=", 1);
  }
  const zor = (id, i) => zorunluGun[i]?.includes(id);
  for (const s of staffList) {
    const id = s.id;
    for (let i = 0; i < G; i++) {
      if (!X(id, i)) continue;
      // art arda nöbet
      // eş durumu günü kendisi zorunludur; komşu günlere yine nöbet yazılmaz (iki zorunlu gün art arda ise ikisi de kalır)
      if (i + 1 < G && X(id, i + 1) && !(zor(id, i) && zor(id, i + 1))) kisit(yeni(), `${X(id, i)} + ${X(id, i + 1)}`, "<=", 1);
      // aynı gün hazırlama; nöbet ertesi hazırlama; hazırlama ertesi nöbet (Cumartesi hazırlama + Pazar nöbet serbest)
      if (H(id, i)) kisit(yeni(), `${X(id, i)} + ${H(id, i)}`, "<=", 1);
      if (i + 1 < G && H(id, i + 1)) kisit(yeni(), `${X(id, i)} + ${H(id, i + 1)}`, "<=", 1);
      if (i - 1 >= 0 && H(id, i - 1) && !(K.ayar.hsTopla && gunDow[i - 1] === CUMARTESI))
        kisit(yeni(), `${X(id, i)} + ${H(id, i - 1)}`, "<=", 1);
      // Perşembe nöbeti → aynı hafta sonu hazırlama yok
      if (K.ayar.thuHaftaSonu && gunDow[i] === PERSEMBE)
        for (const k of [2, 3]) if (i + k < G && H(id, i + k)) kisit(yeni(), `${X(id, i)} + ${H(id, i + k)}`, "<=", 1);
    }
    // ay sınırı
    if (
      X(id, 0) &&
      !zor(id, 0) &&
      (sinir.oncekiSonN.includes(id) || (!(K.ayar.hsTopla && gunDow[0] === PAZAR) && sinir.oncekiSonH.includes(id)))
    )
      kisit(yeni(), X(id, 0), "=", 0);
    if (X(id, G - 1) && (sinir.sonrakiIlkN.includes(id) || sinir.sonrakiIlkH.includes(id))) kisit(yeni(), X(id, G - 1), "=", 0);
    // 5 gün içinde 3 nöbet yok (önceki ayın son günleri dahil)
    for (let b = -4; b < G; b++) {
      let sabit = 0;
      const l = [];
      for (const k of [b, b + 2, b + 4]) {
        if (k < 0) sabit += (sinir.oncekiSonGunler[-k] || []).includes(id) ? 1 : 0;
        else if (k < G && X(id, k)) l.push(X(id, k));
      }
      if (l.length && l.length + sabit > 2) kisit(yeni(), l.join(" + "), "<=", 2 - sabit);
    }
    // ayda en fazla 1 Cumartesi, 1 Pazar nöbeti
    for (const dw of [CUMARTESI, PAZAR]) {
      const l = [];
      for (let i = 0; i < G; i++) if (gunDow[i] === dw && X(id, i)) l.push(X(id, i));
      if (l.length > 1) kisit(yeni(), l.join(" + "), "<=", 1);
    }
  }
  for (const s of prepAday.concat(destekler)) {
    const id = s.id;
    for (let i = 0; i < G; i++) {
      if (!H(id, i)) continue;
      if (sinir.oncekiSonN.includes(id) && i === 0) kisit(yeni(), H(id, i), "=", 0);
      // art arda hazırlama (destek hariç)
      if (i + 1 < G && H(id, i + 1)) kisit(yeni(), `${H(id, i)} + ${H(id, i + 1)}`, "<=", 1);
      if (s.role !== "destek" && i === 0 && sinir.oncekiSonH.includes(id)) kisit(yeni(), H(id, i), "=", 0);
      if (s.role !== "destek" && i === G - 1 && sinir.sonrakiIlkH.includes(id)) kisit(yeni(), H(id, i), "=", 0);
      // önceki ayın Perşembe nöbetçisi ayın ilk hafta sonu
      if (K.ayar.thuHaftaSonu && K.oncekiAyPersembe[i]?.has(id)) kisit(yeni(), H(id, i), "=", 0);
    }
  }
  // destek personeli: ayardaki sayı kadar (program tutturabildiyse eşit, yoksa en fazla)
  for (const s of destekler) {
    const l = [];
    for (let i = 0; i < G; i++) if (H(s.id, i)) l.push(H(s.id, i));
    const refSay = ref.days.reduce((t, d) => t + ((d.prep || []).some(p => p.id === s.id) ? 1 : 0), 0);
    if (l.length) kisit(yeni(), l.join(" + "), refSay === DESTEK_AYLIK ? "=" : "<=", refSay === DESTEK_AYLIK ? DESTEK_AYLIK : DESTEK_AYLIK);
  }
  // kişi başı sayılar: nöbet, fazla mesai, hazırlama
  const fmKisi = fmKuralKisileri(B, y, m).map(s => s.id);
  const nS = id => top(Array.from({ length: G }, (_, i) => X(id, i)));
  const fmS = id =>
    [
      ...Array.from({ length: G }, (_, i) => (X(id, i) && gunFm[i] ? `${gunFm[i]} ${X(id, i)}` : null)),
      ...Array.from({ length: G }, (_, i) => (H(id, i) && gunHz[i] ? `${gunHz[i]} ${H(id, i)}` : null)),
    ]
      .filter(Boolean)
      .join(" + ") || "0 dummy";
  const hS = id => top(Array.from({ length: G }, (_, i) => H(id, i)));
  // en çok / en az değişkenleri
  const aralik = (ad, kisiler, f) => {
    GEN.add(ad + "_max");
    GEN.add(ad + "_min");
    for (const id of kisiler) {
      kisit(yeni(), `${f(id)} - ${ad}_max`, "<=", 0);
      kisit(yeni(), `${f(id)} - ${ad}_min`, ">=", 0);
    }
    return `${ad}_max - ${ad}_min`;
  };
  const nobetFark = aralik("nb", fmKisi, nS);
  kisit(yeni(), nobetFark, "<=", 2);
  const fmFark = aralik("fm", fmKisi, fmS);
  // fazla mesai: program yapısal farkı (eczacı az) grup içinde 8 saatle sınırlar
  const eczF = fmKisi.filter(id => eczaciMi(B.kisi(id).role)),
    tekF = fmKisi.filter(id => !eczaciMi(B.kisi(id).role));
  if (ref.olcut.fmFark <= 8) kisit(yeni(), fmFark, "<=", 8);
  else {
    kisit(yeni(), aralik("fme", eczF, fmS), "<=", 8);
    kisit(yeni(), aralik("fmt", tekF, fmS), "<=", 8);
  }
  // hazırlama: eczacı + tekniker farkı en fazla 1; önce teknikerler (yıllık, önceki aylar dahil); ayda en fazla 2
  const prepAdil = prepAday.filter(s => days.some((d, i) => d.tatil && !yasakGun[i][s.id]));
  kisit(
    yeni(),
    aralik(
      "hz",
      prepAdil.map(s => s.id),
      hS,
    ),
    "<=",
    1,
  );
  const onceki = id => K.onceki.prp[K.hIx[id]] || 0;
  for (const e of prepAdil.filter(s => eczaciMi(s.role)))
    for (const t of prepAdil.filter(s => !eczaciMi(s.role)))
      kisit(yeni(), `${hS(e.id)} - ${hS(t.id).replace(/ \+ /g, " - ")}`, "<=", onceki(t.id) - onceki(e.id));
  for (const s of prepAday) kisit(yeni(), hS(s.id), "<=", 2);

  // yıllık Perşembe / Cuma / Cumartesi / Pazar (ve resmi tatil) nöbeti: önceki aylarla birlikte fark en fazla 1 (uyarı düzeyi)
  const tur = [
    ["pe", K.onceki.bPe, i => gunDow[i] === PERSEMBE],
    ["cu", K.onceki.bCu, i => K.cuGunDizi[i]],
    ["cmt", K.onceki.bCmt, i => gunDow[i] === CUMARTESI],
    ["paz", K.onceki.bPaz, i => gunDow[i] === PAZAR],
    ...(K.resmiGunVar ? [["rt", K.onceki.bRt, i => K.resmiGunDizi[i]]] : []),
  ];
  for (const [ad, b, gunMu] of tur) {
    const f = id => {
      const l = Array.from({ length: G }, (_, i) => (gunMu(i) ? X(id, i) : null)).filter(Boolean);
      return l.length ? l.join(" + ") : "0 dummy";
    };
    GEN.add(`y${ad}_max`);
    GEN.add(`y${ad}_min`);
    for (const id of fmKisi) {
      const o = b[K.hIx[id]] || 0;
      kisit(yeni(), `${f(id)} - y${ad}_max`, "<=", -o);
      kisit(yeni(), `${f(id)} - y${ad}_min`, ">=", -o);
    }
    kisit(yeni(), `y${ad}_max - y${ad}_min`, "<=", 1);
  }
  // ayda en az 1 Cumartesi / Pazar nöbeti (uygun günü olana); en fazla HS_SIFIR_IZIN kişi 0 kalabilir
  const sifirlar = [];
  for (const s of staffList) {
    if (!K.hsMusait[K.hIx[s.id]]) continue;
    const l = Array.from({ length: G }, (_, i) => (gunDow[i] === CUMARTESI || gunDow[i] === PAZAR ? X(s.id, i) : null)).filter(Boolean);
    const z = `hz0_${s.id}`;
    BIN.add(z);
    kisit(yeni(), `${l.length ? l.join(" + ") + " + " : ""}${z}`, ">=", 1);
    sifirlar.push(z);
  }
  if (sifirlar.length) kisit(yeni(), sifirlar.join(" + "), "<=", K.HS_SIFIR_IZIN);

  // ölçütler
  const ifade = {};
  ifade.hsSifir = top(sifirlar);
  // dolu hafta sonu (kişi × hafta sonu): en az biri görevliyse 1
  const dolu = [];
  for (let i = 0; i + 1 < G; i++) {
    if (gunDow[i] !== CUMARTESI) continue;
    // herkes: nöbetçiler, hazırlamacılar, destek personeli (motor/olcut.ts ile aynı)
    for (const id of [...new Set([...staffList, ...prepAday, ...destekler].map(k => k.id))]) {
      const vs = [X(id, i), H(id, i), X(id, i + 1), H(id, i + 1)].filter(Boolean);
      if (!vs.length) continue;
      const w = `hs_${id}_${i}`;
      GEN.add(w);
      for (const x of vs) kisit(yeni(), `${w} - ${x}`, ">=", 0);
      kisit(yeni(), w, "<=", 1);
      dolu.push(w);
    }
  }
  ifade.doluHaftaSonu = top(dolu);
  // Cuma → Pazar görev, Perşembe → hafta sonu nöbet, kısa ara: ikisi birden ise 1
  const ve = (ad, a, b) => {
    GEN.add(ad);
    kisit(yeni(), `${ad} - ${a} - ${b}`, ">=", -1);
    kisit(yeni(), ad, ">=", 0);
    return ad;
  };
  const cp = [],
    ph = [],
    ka = [];
  for (const s of staffList) {
    const id = s.id;
    for (let i = 0; i < G; i++) {
      if (!X(id, i)) continue;
      if (gunDow[i] === CUMA && i + 2 < G) {
        if (X(id, i + 2)) cp.push(ve(`cpn_${id}_${i}`, X(id, i), X(id, i + 2)));
        if (H(id, i + 2)) cp.push(ve(`cph_${id}_${i}`, X(id, i), H(id, i + 2)));
      }
      if (gunDow[i] === PERSEMBE)
        for (const k of [2, 3]) if (i + k < G && X(id, i + k)) ph.push(ve(`ph_${id}_${i}_${k}`, X(id, i), X(id, i + k)));
      for (let k = 2; k < kisaAraEsik; k++) if (i + k < G && X(id, i + k)) ka.push(ve(`ka_${id}_${i}_${k}`, X(id, i), X(id, i + k)));
    }
  }
  ifade.cumaPazar = top(cp);
  ifade.persembeHaftaSonu = top(ph);
  ifade.kisaAra = top(ka);
  ifade.fmFark = fmFark;
  ifade.nobetFark = nobetFark;
  const lp = hedef => {
    const s = [
      `Minimize`,
      ` obj: ${hedef}`,
      `Subject To`,
      ...ST,
      `Bounds`,
      ...[...GEN].map(g => ` ${g} >= -1e6`),
      ` dummy = 0`,
      `General`,
      ...[],
      `Binary`,
      ...chunk([...BIN]),
      `End`,
    ];
    return s.join("\n");
  };
  return { lp, ifade, K, X, H, NV, HV, staffList, prepAday, destekler, G, kisit, ST, fmKisi };
}
const chunk = l => {
  const o = [];
  for (let i = 0; i < l.length; i += 20) o.push(" " + l.slice(i, i + 20).join(" "));
  return o;
};

/** bir ifadenin LP katsayılarıyla değerini çözümden hesaplar */
function cozumdenGunler(M, r) {
  const val = n => r.Columns[n]?.Primal ?? 0;
  return M.K.days.map((d, i) => ({
    ...d,
    assigned: M.staffList.filter(s => M.X(s.id, i) && val(M.X(s.id, i)) > 0.5).map(s => ({ id: s.id, name: s.name, role: s.role })),
    prep: M.prepAday
      .concat(M.destekler)
      .filter(s => M.H(s.id, i) && val(M.H(s.id, i)) > 0.5)
      .sort((a, b) => Number(a.role === "destek") - Number(b.role === "destek"))
      .map(s => ({ id: s.id, name: s.name, role: s.role })),
  }));
}

export const OLCUT_ADI = {
  hsSifir: "hafta sonu nöbetsiz kalan",
  doluHaftaSonu: "dolu kişi-hafta sonu",
  cumaPazar: "Cuma nöbetçisine Pazar görevi",
  persembeHaftaSonu: "Perşembe nöbetçisine hafta sonu nöbeti",
  kisaAra: "kısa nöbet arası",
  fmFark: "fazla mesai farkı (saat)",
  nobetFark: "nöbet sayısı farkı",
};
/** ağırlıklar (Pareto adımı): programın öncelik sırasına yakın */
const W = {
  hsSifir: 150000,
  doluHaftaSonu: 60000,
  cumaPazar: 60000,
  persembeHaftaSonu: 60000,
  kisaAra: 3,
  fmFark: 1000,
  nobetFark: 100000,
};

/** Bir ayı inceler. sure: her çözüm için saniye; program: programın çizelgesi (verilmezse cizelgeOlustur ile oluşturulur) */
export async function incele(veri, y, m, { sure = 60, program } = {}) {
  const hs = await cozucu();
  const t0 = Date.now();
  const sez = program ?? cizelgeOlustur(veri, y, m);
  const sezSure = Date.now() - t0;
  const ref = degerlendir(veri, y, m, sez.days);
  const M = modelKur(veri, y, m, ref);
  const o = ref.olcut;
  const sonuc = { y, m, programSure: sezSure, programJ: ref.j, programUyari: o.uyari, modelHatasi: [], olcut: {}, pareto: null };
  const prog = {
    hsSifir: M.staffList.filter(
      st =>
        M.K.hsMusait[M.K.hIx[st.id]] &&
        !sez.days.some((d, i) => (M.K.gunDow[i] === CUMARTESI || M.K.gunDow[i] === PAZAR) && d.assigned.some(p => p.id === st.id)),
    ).length,
    doluHaftaSonu: o.haftaSonuToplam - o.bosHaftaSonu,
    cumaPazar: o.cumaPazar,
    persembeHaftaSonu: o.persembeHaftaSonu,
    kisaAra: o.kisaAra,
    fmFark: o.fmFark,
    nobetFark: o.nobetFark,
  };
  sonuc.modelHatasi = modelUyumu(M, sez.days);
  const coz = (hedef, ek = []) => {
    let lp = M.lp(hedef).replace("Subject To", ["Subject To", ...ek].join("\n"));
    if (ek.length) lp = lp.replace("Bounds", ["Bounds", ...Object.keys(M.ifade).map(k => ` M_${k} >= -1e6`)].join("\n"));
    const t = Date.now();
    const r = hs.solve(lp, { time_limit: sure, mip_rel_gap: 0, output_flag: false });
    return { r, ms: Date.now() - t };
  };
  for (const [k, e] of Object.entries(M.ifade)) {
    const { r, ms } = coz(e);
    sonuc.olcut[k] = {
      program: prog[k],
      enIyi: r.Status === "Optimal" ? Math.round(r.ObjectiveValue * 1000) / 1000 : null,
      bulunan: Number.isFinite(r.ObjectiveValue) ? Math.round(r.ObjectiveValue * 1000) / 1000 : null,
      durum: r.Status,
      ms,
    };
  }
  const ek = Object.entries(M.ifade).flatMap(([k, e], i) => [` q${i}: ${e} - M_${k} = 0`, ` p${i}: M_${k} <= ${prog[k]}`]);
  const { r, ms } = coz(
    Object.keys(M.ifade)
      .map(k => `${W[k]} M_${k}`)
      .join(" + "),
    ek,
  );
  sonuc.pareto = {
    durum: r.Status,
    ms,
    cozucuAgirlikli: r.ObjectiveValue,
    programAgirlikli: Object.entries(prog).reduce((t, [k, x]) => t + W[k] * x, 0),
  };
  if (r.Status === "Optimal" || r.Status === "Time limit reached") {
    const c = degerlendir(veri, y, m, cozumdenGunler(M, r));
    const den = cizelgeyiDenetle(veri, y, m, { days: c.days, warnings: c.warnings }).filter(b => !b.tur.startsWith("bilgi:"));
    Object.assign(sonuc.pareto, {
      j: c.j,
      uyari: c.olcut.uyari,
      denetciBulgusu: den.map(b => b.tur + " " + b.ayrinti),
      olcut: {
        hsSifir: null,
        doluHaftaSonu: c.olcut.haftaSonuToplam - c.olcut.bosHaftaSonu,
        cumaPazar: c.olcut.cumaPazar,
        persembeHaftaSonu: c.olcut.persembeHaftaSonu,
        kisaAra: c.olcut.kisaAra,
        fmFark: c.olcut.fmFark,
        nobetFark: c.olcut.nobetFark,
      },
      // programın kendi ölçüsüyle daha iyi mi: uyarısız ve amaç değeri küçük
      dahaIyi: c.olcut.uyari <= ref.olcut.uyari && !den.length && c.j < ref.j - 1e-6,
      days: c.days,
    });
  }
  return sonuc;
}

/** programın çizelgesi modele uyuyor mu: uymuyorsa çiğnenen kısıtlar (model programdan sıkıdır) */
function modelUyumu(M, gunler) {
  const l = [];
  const deger = {};
  M.K.days.forEach((d, i) => {
    for (const p of gunler[i].assigned) deger[`x_${p.id}_${i}`] = 1;
    for (const p of gunler[i].prep || []) deger[`h_${p.id}_${i}`] = 1;
  });
  for (const k of Object.keys(deger))
    if (!(k.startsWith("x") ? Object.values(M.NV).includes(k) : Object.values(M.HV).includes(k))) l.push("modelde değişkeni yok: " + k);
  for (const c of M.ST) {
    const [, ad, ifd, op, sag] = c.match(/^ (\S+): (.*) (<=|>=|=) (-?[\d.e+]+)$/) || [];
    if (!ad || /_max|_min|hs_|cpn_|cph_|ph_|ka_|hz0_/.test(ifd)) continue;
    let t = 0;
    for (const mm of ifd.matchAll(/([+-]?)\s*(\d+(?:\.\d+)?)?\s*([a-z]\w*)/g))
      t += (mm[1] === "-" ? -1 : 1) * (mm[2] ? Number(mm[2]) : 1) * (deger[mm[3]] || 0);
    const S = Number(sag);
    if (!(op === "<=" ? t <= S + 1e-9 : op === ">=" ? t >= S - 1e-9 : Math.abs(t - S) < 1e-9))
      l.push(`çiğnenen kısıt: ${c.trim()} (değer ${t})`);
  }
  return l;
}

/** sonucun okunur özeti */
export function ozetMetni(ad, s) {
  const satir = [`### ${ad} (${s.y}-${s.m + 1})`, ""];
  satir.push(`Program: ${Math.round(s.programSure / 1000)} sn, uyarı ${s.programUyari}, amaç ${Math.round(s.programJ)}`);
  if (s.modelHatasi.length) satir.push(`**Model programdan sıkı (sonuç geçersiz):** ${s.modelHatasi.slice(0, 3).join("; ")}`);
  satir.push("", "| Ölçüt | Program | Olası en iyi |", "| --- | --- | --- |");
  for (const [k, x] of Object.entries(s.olcut))
    satir.push(
      `| ${OLCUT_ADI[k]} | ${x.program} | ${x.enIyi !== null ? x.enIyi + (x.enIyi === x.program ? " ✓" : "") : `bulunan ${x.bulunan ?? "—"} (${x.durum})`} |`,
    );
  const p = s.pareto;
  satir.push("");
  if (p && p.j !== undefined)
    satir.push(
      `Hiçbir ölçütü kötüleştirmeden: çözücünün çizelgesi uyarı ${p.uyari}, denetçi bulgusu ${p.denetciBulgusu.length}, amaç ${Math.round(p.j)} → ${p.dahaIyi ? `**programdan daha iyi (${Math.round(s.programJ - p.j)})**` : "programdan iyi değil"}`,
    );
  else satir.push(`Hiçbir ölçütü kötüleştirmeden: ${p?.durum}`);
  return satir.join("\n");
}
