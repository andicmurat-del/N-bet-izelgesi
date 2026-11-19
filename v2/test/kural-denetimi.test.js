// Kuralların doğruluğu: motorun ürettiği listeler yazılı kurallardan bağımsız bir denetçiyle (test/denetim/bagimsiz.js)
// rastgele senaryolarda denetlenir: günlük eczane çizelgesi, acil eczane listesi, öğlen nöbeti, onay listesi masaları.
// Her kesin kural ihlali gün üzerinde işaretli ya da uyarıda söylenmiş olmalı.
//   N=100 npx vitest run test/kural-denetimi.test.js     (TAM=1: tam arama; BILGI=1: bilgi bulgularını da göster)
import { test, expect } from "vitest";
import * as M from "../src/motor";
import { senaryo, hizli, rngOf } from "./tarama/ortak";
import {
  cizelgeyiDenetle,
  acilListesiniDenetle,
  oglenNobetiniDenetle,
  onayListesiniDenetle,
  gunIhlalleri,
  gunSayisi,
  haftaGunu,
} from "./denetim/bagimsiz";

const N = Number(process.env.N || 24);
const BILGI = process.env.BILGI;

// her zaman denenen senaryolar: denetçinin daha önce hata bulduğu durumlar (hazırlamada iki destek personeli: 77, 89, 121;
// izin kenarındaki günde acil eş durumu isteği: 134; elle düzenlemede çalışma dönemi dışına hazırlama: 12)
const SENARYOLAR = Array.from({ length: N }, (_, i) => i + 1);
for (const s of [12, 77, 89, 121, 134]) if (!SENARYOLAR.includes(s)) SENARYOLAR.push(s);

const ozet = {};
for (const s of SENARYOLAR)
  test(
    "senaryo " + s,
    () => {
      const gercekci = s % 2 === 0;
      const { y, m0, veri } = senaryo(1000 + s, gercekci ? { eczaci: [6, 8], teknisyen: [4, 8] } : {});
      // acil kadrosu: bazı eczacılar acilde tutar, acil servis personeli
      const r = rngOf(s * 7919 + 13);
      veri.staff.forEach(st => {
        if ((st.role === "eczaci" || st.role === "nobetci") && r() < 0.2) st.acilTutar = true;
        if (r() < 0.1) st.cumaMuaf = true;
      });
      let id = Math.max(...veri.staff.map(x => x.id)) + 1;
      for (let i = Math.floor(r() * 5); i > 0; i--) veri.staff.push({ id: id++, name: "Acil" + id, role: "servis" });
      veri.acil = {};
      veri.oglen = {};
      if (r() < 0.3) veri.settings.acilArdArda = false;
      if (r() < 0.3) veri.settings.hsTopla = false;
      const bulgu = [];
      const kaydet = l =>
        l.forEach(b => {
          ozet[b.tur] = (ozet[b.tur] ?? 0) + 1;
          if (!b.tur.startsWith("bilgi:") || BILGI) bulgu.push(`${b.yer} ${b.tur}: ${b.ayrinti}`);
        });
      for (const m of [m0, m0 + 1]) {
        const c = M.cizelgeOlustur(veri, y, m, hizli());
        if (!c.days) break;
        kaydet(cizelgeyiDenetle(veri, y, m, c));
        veri.schedules[y + "-" + m] = { year: y, month: m, days: c.days, uyarilar: c.warnings };
        // elle düzenleme denetimi (gün penceresi): bağımsız denetçinin bulduğu kesin kural ihlali "hata" olarak söylenmeli
        const sch = veri.schedules[y + "-" + m];
        const havuz = veri.staff.filter(
          k => ["eczaci", "teknisyen", "nobetci"].includes(k.role) && !(k.acilTutar && k.role !== "teknisyen"),
        );
        const gor = k => ({ id: k.id, name: k.name, role: k.role });
        for (let j = 0; j < 12 && havuz.length > 2; j++) {
          const d = 1 + Math.floor(r() * sch.days.length),
            g = sch.days[d - 1];
          const nb = [...g.assigned],
            pr = [...(g.prep ?? [])];
          const yeni = havuz[Math.floor(r() * havuz.length)];
          if (r() < 0.7 || !pr.length) {
            if (nb.some(p => p.id === yeni.id)) continue;
            nb[Math.floor(r() * Math.max(1, nb.length))] = gor(yeni);
          } else {
            if (pr.some(p => p.id === yeni.id)) continue;
            pr[Math.floor(r() * pr.length)] = gor(yeni);
          }
          const days2 = sch.days.map((x, i) => (i === d - 1 ? { ...x, assigned: nb, prep: pr } : x));
          const ihlal = gunIhlalleri(veri, y, m, days2, d);
          const den = M.gunuDenetle(veri, sch, d, nb, pr);
          const hata = den.filter(b => b.sev === "hata");
          ozet["elle: denenen"] = (ozet["elle: denenen"] ?? 0) + 1;
          if (ihlal.length && !hata.length)
            kaydet([
              {
                tur: "elle: kesin ihlal hata olarak söylenmedi",
                yer: `${y}-${m + 1}-${d}`,
                ayrinti: ihlal.join("; ") + " | " + den.map(b => b.sev + ":" + b.t).join(" / "),
              },
            ]);
          if (!ihlal.length && hata.length)
            kaydet([
              {
                tur: "bilgi: elle hata, bağımsız denetçi ihlal görmedi",
                yer: `${y}-${m + 1}-${d}`,
                ayrinti: hata.map(b => b.t).join(" / "),
              },
            ]);
        }
        const a = M.acilHesapla(veri, y, m);
        kaydet(acilListesiniDenetle(veri, y, m, a));
        veri.acil[y + "-" + m] = Object.fromEntries(a.gunler.filter(g => g.ids.length).map(g => [g.gun, g.ids]));
        const P = M.puantajHesapla(veri, y, m);
        const o = M.oglenHesapla(veri, y, m);
        kaydet(oglenNobetiniDenetle(veri, y, m, o, P, d => M.onayHaftasiHesapla(veri, y, m, d).gunler.find(z => z.m === m && z.d === d)));
        veri.oglen[y + "-" + m] = Object.fromEntries(o.gunler.map(g => [g.gun, { e: g.e, t: g.t }]));
        const haftalar = [];
        for (let d = 1; d <= gunSayisi(y, m); d++)
          if (haftaGunu(y, m, d) === 0 || d === 1) haftalar.push(M.onayHaftasiHesapla(veri, y, m, d));
        const izgara = {};
        kaydet(onayListesiniDenetle(veri, haftalar, (yy, mm) => (izgara[yy + "-" + mm] ??= M.puantajHesapla(veri, yy, mm))));
      }
      if (bulgu.length) console.log("SENARYO " + s + ":\n  " + bulgu.slice(0, 15).join("\n  "));
      expect(bulgu).toEqual([]);
    },
    120000,
  );

test("özet", () => {
  console.log("BULGU ÖZETİ", JSON.stringify(ozet, null, 1));
});
