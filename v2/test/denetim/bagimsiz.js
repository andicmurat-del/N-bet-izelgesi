// Yazılı kurallardan (src/veri/kurallarMetni.ts, "Günlük eczane nöbet çizelgesi") bağımsız denetçi: motorun hiçbir kodunu
// kullanmaz; takvim, izin, yasak gün ve kurallar burada baştan yazılmıştır. Motorun çizelgesinde her kesin kural ihlali
// ya gün üzerinde kırmızı işaretli (conflict) ya da uyarılarda adıyla söylenmiş olmalıdır; uyarı da gerçek bir duruma
// dayanmalıdır. Dönen bulgular { tur, yer, ayrinti } biçimindedir (tur: kuralın kısa adı).

export const gunSayisi = (y, m) => new Date(y, m + 1, 0).getDate();
/** Pazartesi 0 … Pazar 6 */
export const haftaGunu = (y, m, d) => (new Date(y, m, d).getDay() + 6) % 7;
const kaydir = (y, m, d, k) => {
  const t = new Date(y, m, d + k);
  return [t.getFullYear(), t.getMonth(), t.getDate()];
};
const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const NOBETCI = ["eczaci", "teknisyen", "nobetci"];
const eczaciRol = r => r === "eczaci" || r === "nobetci";
const IZIN_HAFTA_GUN = 5;
const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

/** veri üzerinde takvim ve kişi bilgisi */
export function takvim(veri) {
  const tatil = (y, m, d) => haftaGunu(y, m, d) >= 5 || !!veri.manualTatil?.[`${y}-${m}-${d}`];
  const arife = (y, m, d) => !tatil(y, m, d) && !!veri.arife?.[`${y}-${m}-${d}`];
  const tercih = (id, y, m, d) => veri.prefs?.[`${id}-${y}-${m}-${d}`];
  const izinli = (id, y, m, d) => tercih(id, y, m, d) === "izinli";
  const elleKod = (id, y, m, d) => veri.puantaj?.[`${y}-${m}`]?.[id]?.[d];
  const kisi = id => veri.staff.find(s => s.id === id);
  const donemde = (s, y, m, d) => !(s.baslangic && iso(y, m, d) < s.baslangic) && !(s.bitis && iso(y, m, d) > s.bitis);
  // iki izinli gün arasındaki tatil: iki yönde de tatil günleri geçilince izinli güne varılır
  const izinArasi = (id, y, m, d) => {
    if (!tatil(y, m, d) || izinli(id, y, m, d)) return false;
    const yon = k => {
      for (let j = 1; j <= 7; j++) {
        const g = kaydir(y, m, d, k * j);
        if (izinli(id, ...g)) return true;
        if (!tatil(...g)) return false;
      }
      return false;
    };
    return yon(-1) && yon(1);
  };
  // en az 5 iş günü süren iznin hemen önündeki / arkasındaki tatil
  const haftaKenari = (id, y, m, d) => {
    if (!tatil(y, m, d) || izinli(id, y, m, d)) return false;
    const blok = k => {
      let j = 1;
      while (j <= 10 && tatil(...kaydir(y, m, d, k * j))) {
        if (izinli(id, ...kaydir(y, m, d, k * j))) return 0;
        j++;
      }
      if (!izinli(id, ...kaydir(y, m, d, k * j))) return 0;
      let n = 0;
      for (let t = 0; t < 40; t++, j++) {
        const g = kaydir(y, m, d, k * j);
        if (tatil(...g)) continue;
        if (!izinli(id, ...g)) break;
        n++;
      }
      return n;
    };
    return blok(1) >= IZIN_HAFTA_GUN || blok(-1) >= IZIN_HAFTA_GUN;
  };
  /** kural 2: görev yazılamayan gün ve nedeni (yoksa null) */
  const yasakNeden = (id, y, m, d) => {
    const s = kisi(id);
    if (!s) return "kişi yok";
    if (!donemde(s, y, m, d)) return "çalışma dönemi dışı";
    const t = tercih(id, y, m, d);
    if (t === "izinli") return "izinli";
    if (t === "esYok") return "eş durumu olmasın";
    const k = elleKod(id, y, m, d);
    if (["YI", "R", "NI", "DI"].includes(k)) return "puantajda " + k;
    if (izinArasi(id, y, m, d)) return "iki izin arası tatil";
    if (haftaKenari(id, y, m, d)) return "uzun izin kenarındaki hafta sonu";
    return null;
  };
  /** gerçekte tutulan görevler: çizelge + puantajdaki elle kodlar (ay sınırı kuralları için) */
  const gercek = (y, m, d) => {
    const g = veri.schedules?.[`${y}-${m}`]?.days?.[d - 1];
    const N = new Set((g?.assigned ?? []).map(p => p.id)),
      H = new Set((g?.prep ?? []).map(p => p.id));
    for (const [id, gunler] of Object.entries(veri.puantaj?.[`${y}-${m}`] ?? {})) {
      const k = gunler?.[d];
      if (!k) continue;
      N.delete(Number(id));
      H.delete(Number(id));
      if (k === "N") N.add(Number(id));
      else if (k === "H") H.add(Number(id));
    }
    return { N, H };
  };
  return { tatil, arife, tercih, izinli, kisi, donemde, yasakNeden, gercek };
}

/** ayın çizelgesini (motorun sonucu: days, warnings) yazılı kurallara göre denetler */
export function cizelgeyiDenetle(veri, y, m, sonuc) {
  const T = takvim(veri),
    dim = gunSayisi(y, m),
    bulgu = [];
  const ekle = (tur, d, ayrinti) => bulgu.push({ tur, yer: `${y}-${m + 1}-${d ?? "*"}`, ayrinti });
  const days = sonuc.days;
  if (!days) return bulgu;
  const uyari = sonuc.warnings.join("\n");
  // görev: ay içi bu çizelgeden, ay dışı kayıtlı çizelge + puantajdan
  const gorev = (yy, mm, dd) => {
    if (yy === y && mm === m)
      return { N: new Set(days[dd - 1].assigned.map(p => p.id)), H: new Set((days[dd - 1].prep ?? []).map(p => p.id)) };
    return T.gercek(yy, mm, dd);
  };
  const g = (d, k) => gorev(...kaydir(y, m, d, k));
  const zorunlu = (id, d) => T.tercih(id, y, m, d) === "esVar";

  for (let d = 1; d <= dim; d++) {
    const gun = days[d - 1];
    if (gun.locked) continue;
    const ihlal = [],
      N = gun.assigned,
      H = gun.prep ?? [];
    const dw = haftaGunu(y, m, d);
    // 1: günde 2 nöbetçi, en az biri eczacı
    if (N.length < (gun.nobetSay ?? 2)) ihlal.push("1: nöbetçi eksik");
    if (N.length && !N.some(p => eczaciRol(p.role))) ihlal.push("1: eczacı yok");
    for (const p of N) {
      const s = T.kisi(p.id);
      if (!s || !NOBETCI.includes(s.role)) ihlal.push("rol: " + p.name);
      const yn = T.yasakNeden(p.id, y, m, d);
      if (yn) ihlal.push(`2: ${p.name} nöbet (${yn})`);
      if (zorunlu(p.id, d)) continue;
      // 3: komşu günlerde nöbet / hazırlama yok (ay sınırı dahil)
      for (const k of [-1, 1]) if (g(d, k).N.has(p.id)) ihlal.push(`3: ${p.name} art arda nöbet`);
      // aynı gün hazırlama ve ertesi gün hazırlama (hazırlamacı önceki gün nöbetçi olamaz); önceki gün hazırlama ise
      // kuralın esneyebilen kısmıdır (aşağıda, uyarıda söylenmeli)
      for (const k of [0, 1]) if (g(d, k).H.has(p.id)) ihlal.push(`3/5: ${p.name} nöbet + hazırlama (${k ? "ertesi gün" : "aynı gün"})`);
      // 4: 5 günde 3 nöbet
      const v = k => g(d, k).N.has(p.id);
      if ((v(-2) && v(-4)) || (v(-2) && v(2)) || (v(2) && v(4))) ihlal.push(`4: ${p.name} 5 günde 3 nöbet`);
      // 7: Perşembe nöbetçisine aynı hafta sonu hazırlama
      if (dw === 3 && (g(d, 2).H.has(p.id) || g(d, 3).H.has(p.id))) ihlal.push(`7: ${p.name} Perşembe + hafta sonu hazırlama`);
      // 10: ayrılan son gününde, ertesi gün mesai günüyse nöbet yok
      if (s?.bitis === iso(y, m, d) && !T.tatil(...kaydir(y, m, d, 1))) ihlal.push(`10: ${p.name} son gününde nöbet`);
    }
    // 8: iki kemoterapi eczacısı aynı gün (Cuma ve Cumartesi olabilir)
    if (N.filter(p => p.role === "nobetci").length > 1 && dw !== 4 && dw !== 5 && !N.every(p => zorunlu(p.id, d)))
      ihlal.push("8: iki kemoterapi eczacısı");
    // hazırlama
    if (T.tatil(y, m, d) && H.length < (gun.hazSay ?? 2)) ihlal.push("hazırlama eksik");
    for (const p of H) {
      const yn = T.yasakNeden(p.id, y, m, d);
      if (yn) ihlal.push(`2: ${p.name} hazırlama (${yn})`);
      // 5: hazırlamacı aynı gün ve önceki gün nöbetçi olamaz
      if (g(d, -1).N.has(p.id)) ihlal.push(`5: ${p.name} önceki gün nöbetçi`);
      // 6: art arda iki gün hazırlama
      for (const k of [-1, 1]) if (g(d, k).H.has(p.id)) ihlal.push(`6: ${p.name} art arda hazırlama`);
      // 7 (hazırlama tarafı): o haftanın Perşembesinde nöbet
      if (dw >= 5 && g(d, -(dw - 3)).N.has(p.id)) ihlal.push(`7: ${p.name} Perşembe nöbetçisine hafta sonu hazırlama`);
    }
    // hazırlamanın 1. yeri eczacı / tekniker, 2. yer önce destek personeli
    if (H[0]?.role === "destek") ihlal.push("hazırlama 1. yeri destek personelinde: " + H.map(p => p.name + "/" + p.role).join(","));
    // ertesi gün nöbet (5'in esneyen kısmı): uyarıda söylenmeli
    if (ihlal.length && !gun.conflict) ekle("işaretsiz ihlal", d, ihlal.join("; "));
    // (Ayarlar açıksa Cumartesi hazırlaması + Pazar nöbeti serbest: hafta sonu tek kişide toplanır)
    const hsTopla = veri.settings?.hsTopla !== false;
    for (const p of H)
      if (!(hsTopla && dw === 5) && g(d, 1).N.has(p.id) && !uyari.includes(`${p.name} (${d} `) && !gun.conflict)
        ekle("5: hazırlama ertesi nöbet söylenmedi", d, p.name);
    if (hsTopla && dw === 5) for (const p of H) if (g(d, 1).N.has(p.id)) ekle("bilgi: Cumartesi hazırlaması + Pazar nöbeti", d, p.name);
    // puantajda girilen iki izin (Yİ / R / Dİ) arasında kalan tatile görev (yazılı kural "iki izin arası tatil")
    if (T.tatil(y, m, d))
      for (const p of [...N, ...H]) {
        const izin = (yy, mm, dd) => T.izinli(p.id, yy, mm, dd) || ["YI", "R", "DI"].includes(veri.puantaj?.[`${yy}-${mm}`]?.[p.id]?.[dd]);
        const yon = k => {
          for (let j = 1; j <= 7; j++) {
            const gg = kaydir(y, m, d, k * j);
            if (izin(...gg)) return true;
            if (!T.tatil(...gg)) return false;
          }
          return false;
        };
        if (!T.yasakNeden(p.id, y, m, d) && yon(-1) && yon(1)) ekle("bilgi: puantaj izinleri arasındaki tatile görev", d, p.name);
      }
    // metinde "yazılmaz" denen ama motorda tercih olan kurallar (bilgi)
    for (const p of H) if (dw === 6 && g(d, -2).N.has(p.id)) ekle("bilgi: Cuma nöbetçisine aynı hafta Pazar hazırlaması", d, p.name);
    for (const p of N) if (dw === 6 && g(d, -2).N.has(p.id)) ekle("bilgi: Cuma nöbetçisine aynı hafta Pazar nöbeti", d, p.name);
    for (const p of [...N, ...H])
      if (T.tercih(p.id, y, m, d) === "avoid" && !gun.conflict && !sonuc.warnings.some(u => u.includes(p.name) && u.includes(String(d))))
        ekle("bilgi: istemiyor gününe görev, uyarı yok", d, p.name);
  }

  // ay geneli kurallar: ihlal varsa uyarı olmalı
  const sayac = {};
  // günlük eczane nöbetçileri (acil kadrosu eczane nöbeti tutmaz)
  const kisiler = veri.staff.filter(s => NOBETCI.includes(s.role) && !(s.acilTutar && (s.role === "eczaci" || s.role === "nobetci")));
  for (const s of veri.staff) sayac[s.id] = { n: 0, h: 0, fm: 0, cmt: 0, paz: 0 };
  days.forEach((gun, i) => {
    const dw = haftaGunu(y, m, i + 1);
    for (const p of gun.assigned) {
      const c = sayac[p.id];
      if (!c) continue;
      c.n++;
      c.fm += gun.fazlaMesai;
      if (dw === 5) c.cmt++;
      if (dw === 6) c.paz++;
    }
    for (const p of gun.prep ?? [])
      if (sayac[p.id]) {
        sayac[p.id].h++;
        sayac[p.id].fm += gun.fmHaz ?? veri.settings?.hazSaat ?? 8;
      }
  });
  // 9: destek sınırı (kesin; uyarı da kabul edilmez)
  const destekAylik = veri.settings?.destekAylik ?? 2;
  for (const s of veri.staff.filter(x => x.role === "destek"))
    if (sayac[s.id].h > destekAylik && !days.some(gn => gn.locked && (gn.prep ?? []).some(p => p.id === s.id)))
      ekle("9: destek sınırı aşıldı", null, `${s.name} ${sayac[s.id].h}`);
  // 12: ayda en fazla 1 Cumartesi, 1 Pazar
  for (const s of kisiler)
    if ((sayac[s.id].cmt > 1 || sayac[s.id].paz > 1) && !/Hafta sonu kuralı esnetildi/.test(uyari))
      ekle("12: hafta sonu sınırı söylenmedi", null, `${s.name} Cmt ${sayac[s.id].cmt} Paz ${sayac[s.id].paz}`);
  // 11: fazla mesai farkı ≤ 8 saat — ayın tamamında çalışan nöbetçiler arasında
  const tamAy = kisiler.filter(s => T.donemde(s, y, m, 1) && T.donemde(s, y, m, dim));
  if (tamAy.length > 1) {
    const v = tamAy.map(s => sayac[s.id].fm),
      fark = Math.max(...v) - Math.min(...v);
    if (fark > 8 && !/fazla mesai farkı/i.test(uyari)) ekle("11: fazla mesai farkı söylenmedi", null, `${fark} saat`);
    if (fark <= 8 && /KESİN KURAL sağlanamadı: fazla mesai farkı/.test(uyari))
      ekle("11: gereksiz fazla mesai uyarısı", null, `${fark} saat`);
    const n = tamAy.map(s => sayac[s.id].n),
      nf = Math.max(...n) - Math.min(...n);
    // fark eczacı / tekniker sayısından kaynaklanıyorsa (her gün bir eczacı) kadro açıklaması yeterlidir
    if (nf > 2 && !/Nöbet sayısı farkı|nöbet sayısı farkı|Eczacı sayısı/.test(uyari))
      ekle("öncelik 2: nöbet farkı > 2 söylenmedi", null, `${nf}`);
  }
  // eş durumu "olsun": yazılmadıysa uyarı
  for (let d = 1; d <= dim; d++) {
    if (days[d - 1].locked) continue;
    for (const s of kisiler)
      if (
        zorunlu(s.id, d) &&
        T.donemde(s, y, m, d) &&
        !days[d - 1].assigned.some(p => p.id === s.id) &&
        !uyari.includes(`${d}. gün ${s.name} için eş durumu`)
      )
        ekle("eş durumu karşılanmadı, söylenmedi", d, s.name);
  }
  return bulgu;
}

const acilKadrosu = s => s.role === "servis" || ((s.role === "eczaci" || s.role === "nobetci") && !!s.acilTutar);

/** acil eczane listesi (acilHesapla sonucu) — yazılı kurallar: "2. Acil eczane nöbet listesi" */
export function acilListesiniDenetle(veri, y, m, sonuc) {
  const T = takvim(veri),
    dim = gunSayisi(y, m),
    bulgu = [];
  const ekle = (tur, d, ayrinti) => bulgu.push({ tur, yer: `${y}-${m + 1}-${d ?? "*"}`, ayrinti });
  const uyari = sonuc.uyarilar.join("\n");
  const ad = id => T.kisi(id)?.name ?? String(id);
  const listede = (yy, mm, dd) => {
    if (yy === y && mm === m) return new Set(sonuc.gunler[dd - 1]?.ids ?? []);
    return new Set(veri.acil?.[`${yy}-${mm}`]?.[dd] ?? []);
  };
  const elle = d => !!sonuc.gunler[d - 1]?.elle;
  const ardArdaSerbest = veri.settings?.acilArdArda !== false;
  const hs = {};
  for (let d = 1; d <= dim; d++) {
    const ids = sonuc.gunler[d - 1]?.ids ?? [];
    if (ids.length > 2 || new Set(ids).size !== ids.length) ekle("acil: günde 2 kişi", d, ids.join(","));
    const dw = haftaGunu(y, m, d);
    for (const id of ids) {
      const s = T.kisi(id);
      if (!s || !acilKadrosu(s)) ekle("acil: kadro dışı kişi", d, ad(id));
      if (dw >= 5) (hs[id] ??= { cmt: 0, paz: 0 })[dw === 5 ? "cmt" : "paz"]++;
      if (elle(d)) continue;
      const yn = T.yasakNeden(id, y, m, d);
      if (yn && T.tercih(id, y, m, d) !== "esVar") ekle("acil: yasak güne nöbet", d, `${ad(id)} (${yn})`);
      // aynı / komşu gün eczane görevi
      for (const k of [-1, 0, 1]) {
        const G = T.gercek(...kaydir(y, m, d, k));
        if (G.N.has(id) || G.H.has(id)) ekle("acil: eczane görevinin yanında", d, `${ad(id)} (${k})`);
      }
      if (listede(...kaydir(y, m, d, -1)).has(id)) {
        if (!ardArdaSerbest) ekle("acil: art arda (ayar kapalı)", d, ad(id));
        else if (!uyari.includes(`${ad(id)}: ${d - 1} ve ${d} `) && !/acil kadrosu yetmiyor; \d+ kez art arda/.test(uyari) && d > 1)
          ekle("acil: art arda söylenmedi", d, ad(id));
      }
      const v = k => listede(...kaydir(y, m, d, k)).has(id);
      // 5 günde 3: kadro yetmediğinde uyarıyla yazılabilir
      if (
        ((v(-2) && v(2)) || (v(2) && v(4)) || (v(-2) && v(-4))) &&
        !sonuc.uyarilar.some(u => u.startsWith(`${ad(id)}: `) && u.includes("5 günde 3")) &&
        !/kez 5 günde 3 acil nöbeti yazıldı/.test(uyari)
      )
        ekle("acil: 5 günde 3 nöbet söylenmedi", d, ad(id));
      if (T.tercih(id, y, m, d) === "avoid" && !uyari.includes(`${d} ${AYLAR[m]}: ${ad(id)} nöbet istemiyordu`))
        ekle("acil: istemiyor, söylenmedi", d, ad(id));
    }
    if (!elle(d))
      for (const s of veri.staff.filter(acilKadrosu))
        if (
          T.tercih(s.id, y, m, d) === "esVar" &&
          T.donemde(s, y, m, d) &&
          !ids.includes(s.id) &&
          !uyari.includes(`${d} ${AYLAR[m]}: ${s.name} için eş durumu`)
        )
          ekle("acil: eş durumu, söylenmedi", d, s.name);
    if (ids.length < 2 && !uyari.includes(`${d} ${AYLAR[m]}`)) ekle("acil: eksik gün, söylenmedi", d, ids.length);
  }
  // ayda en fazla 1 Cumartesi / 1 Pazar: aşıldıysa kişinin adıyla söylenmeli
  for (const [id, h] of Object.entries(hs))
    if (
      (h.cmt > 1 || h.paz > 1) &&
      !sonuc.uyarilar.some(u => u.includes("ayda en fazla 1 Cumartesi / 1 Pazar") && u.includes(ad(Number(id)) + " ("))
    )
      ekle("acil: hafta sonu sınırı aşıldı, söylenmedi", null, `${ad(Number(id))} ${h.cmt}/${h.paz}`);
  return bulgu;
}

/** öğlen nöbeti (oglenHesapla sonucu) — "4. Öğlen nöbeti"; P: puantajHesapla sonucu (o gün mesaide olanlar) */
export function oglenNobetiniDenetle(veri, y, m, sonuc, P, onayGunu) {
  const T = takvim(veri),
    bulgu = [];
  const ekle = (tur, d, ayrinti) => bulgu.push({ tur, yer: `${y}-${m + 1}-${d ?? "*"}`, ayrinti });
  const st = veri.settings ?? {};
  const hucre = (id, d) => P.satirlar.find(r => r.s.id === id)?.cells[d - 1];
  const mesaide = (id, d) => ["M", "N"].includes(hucre(id, d)?.kod);
  const gunler = new Map(sonuc.gunler.map(g => [g.gun, g]));
  for (let d = 1; d <= gunSayisi(y, m); d++) {
    const ogGunu = haftaGunu(y, m, d) <= 4 && !T.tatil(y, m, d) && !T.arife(y, m, d);
    const g = gunler.get(d);
    if (!ogGunu) {
      if (g && (g.e.length || g.t.length)) ekle("öğlen: tatil / arife gününe öğlen", d, "");
      continue;
    }
    if (!g) {
      ekle("öğlen: gün eksik", d, "");
      continue;
    }
    const cuma = haftaGunu(y, m, d) === 4;
    for (const [grup, l, rol] of [
      ["eczacı", g.e, "eczaci"],
      ["tekniker", g.t, "teknisyen"],
    ]) {
      for (const id of l) {
        const s = T.kisi(id);
        if (s?.role !== rol) ekle("öğlen: gruba uymayan rol", d, `${grup} ${s?.name} ${s?.role}`);
        if (g.elle) continue;
        if (!mesaide(id, d)) ekle("öğlen: mesaide değil", d, `${s?.name} ${hucre(id, d)?.kod}`);
        if (cuma && s?.cumaMuaf) ekle("öğlen: Cuma'dan muaf Cuma'ya yazıldı", d, s.name);
      }
      if (g.elle) continue;
      const gerek = cuma
        ? rol === "eczaci"
          ? (st.oglenCE ?? 3)
          : (st.oglenCT ?? 2)
        : rol === "eczaci"
          ? (st.oglenHE ?? 2)
          : (st.oglenHT ?? 1);
      const aday = veri.staff.filter(s => s.role === rol && mesaide(s.id, d) && !(cuma && s.cumaMuaf)).length;
      if (l.length < Math.min(gerek, aday)) ekle("öğlen: kişi sayısı eksik", d, `${grup} ${l.length}/${gerek} (aday ${aday})`);
      if (l.length > gerek) ekle("öğlen: kişi sayısı fazla", d, `${grup} ${l.length}/${gerek}`);
    }
    // Cuma masa kuralı: Masa 1, 2, 7 ve jokerlerdeki eczacılardan en az 2'si masada kalır; tutmazsa söylenir
    const og = cuma && onayGunu && !g.elle ? onayGunu(d) : null;
    if (og) {
      const grup = [og.masa[0], og.masa[1], og.masa[6], ...og.joker].filter(h => h?.id && !h.tekniker).map(h => h.id);
      const giden = g.e.filter(id => grup.includes(id));
      if (giden.length > Math.max(0, grup.length - 2) && !sonuc.uyarilar.some(u => u.startsWith(`${d} `) && u.includes("Cuma masa kuralı")))
        ekle("öğlen: Cuma masa kuralı tutmadı, söylenmedi", d, giden.map(id => T.kisi(id)?.name).join(","));
    }
  }
  return bulgu;
}

/** onay listesi masaları (onayHaftasiHesapla sonuçları, sırayla) — "3. Onay listesi masaları" */
export function onayListesiniDenetle(veri, haftalar, P) {
  const T = takvim(veri),
    bulgu = [],
    son = {};
  const ekle = (tur, g, ayrinti) => bulgu.push({ tur, yer: `${g.y}-${g.m + 1}-${g.d}`, ayrinti });
  for (const H of haftalar)
    for (const g of H.gunler) {
      const kisiler = [...g.masa, ...g.joker].filter(h => h.id !== null && !h.tekniker).map(h => h.id);
      if (g.tatil) {
        if (kisiler.length) ekle("onay: resmi tatilde liste", g, "");
        continue;
      }
      if (haftaGunu(g.y, g.m, g.d) > 4) continue;
      const satir = id => P(g.y, g.m).satirlar.find(r => r.s.id === id)?.cells[g.d - 1];
      const calisan = veri.staff
        .filter(s => s.role === "eczaci" && T.donemde(s, g.y, g.m, g.d) && ["M", "N"].includes(satir(s.id)?.kod))
        .map(s => s.id);
      const a = [...kisiler].sort((p, q) => p - q).join(","),
        b = [...calisan].sort((p, q) => p - q).join(",");
      if (a !== b) ekle("onay: masadakiler o gün çalışan eczacılar değil", g, `masada ${a} / çalışan ${b}`);
      const n = calisan.length,
        dolu = g.masa.slice(0, 6).filter(h => h.id !== null).length;
      if (n >= 6 && dolu < 6) ekle("onay: ilk 6 masa dolmadı", g, `${dolu}/6`);
      if (n >= 8 && !g.masa[6]?.id) ekle("onay: 8+ kişide Masa 7 boş", g, n);
      // ilk 6 masa dolmazsa o günün hazırlama teknikerlerinden biri oturur
      const tek = [...g.masa, ...g.joker].filter(h => h.tekniker).length;
      if (n >= 6 && tek) ekle("onay: masa doluyken tekniker oturdu", g, tek);
      if (n < 6 && tek > 6 - n) ekle("onay: boş masadan çok tekniker", g, tek);
      if (n === 7 && g.masa[6]?.id) ekle("onay: 7 kişide 7. kişi joker olmalı", g, "");
      if (!g.elle)
        [...g.masa.map((h, i) => [h, String(i + 1)]), ...g.joker.map(h => [h, "J"])].forEach(([h, yer]) => {
          if (h.id === null || h.tekniker) return;
          if (son[h.id] === yer) ekle("onay: önceki çalıştığı günle aynı yer", g, `${T.kisi(h.id)?.name} ${yer}`);
        });
      [...g.masa.map((h, i) => [h, String(i + 1)]), ...g.joker.map(h => [h, "J"])].forEach(([h, yer]) => {
        if (h.id !== null && !h.tekniker) son[h.id] = yer;
      });
    }
  return bulgu;
}

/** elle düzenlenen bir günün (d) kesin kural ihlalleri: öbür günler olduğu gibi kabul edilir */
export function gunIhlalleri(veri, y, m, days, d) {
  const kopya = days.map((g, i) => ({ ...g, locked: i !== d - 1, conflict: false }));
  return cizelgeyiDenetle(veri, y, m, { days: kopya, warnings: [] })
    .filter(b => b.tur === "işaretsiz ihlal" && b.yer === `${y}-${m + 1}-${d}`)
    .flatMap(b => b.ayrinti.split("; "));
}
