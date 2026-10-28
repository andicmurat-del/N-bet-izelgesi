// Altın kayıt: motorun tüm dışa açık işlevlerinin zengin bir senaryodaki çıktısı (test/altin/senaryo.js) kayıtla
// (test/altin/beklenen.json, çıktıların özeti) birebir aynı olmalı. Motor yeniden düzenlenirken davranışın hiç
// değişmediğinin güvencesidir. Bilerek yapılan bir davranış değişikliğinden sonra: ALTIN_YAZ=1 npx vitest run test/altin.test.js
// Farkı görmek için ALTIN_DOK=<klasör> verilirse her çıktı o klasöre tam JSON olarak yazılır (iki çalıştırma karşılaştırılır).
import { describe, test, expect, afterAll } from "vitest";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import * as M from "../src/motor";
import { veriKur, AYARLAR, AYLAR, darVeri } from "./altin/senaryo.js";

const KAYIT_YOLU = path.join(path.dirname(new URL(import.meta.url).pathname), "altin", "beklenen.json");
const YAZ = !!process.env.ALTIN_YAZ, DOK = process.env.ALTIN_DOK;
const kayit = YAZ ? {} : JSON.parse(fs.readFileSync(KAYIT_YOLU, "utf8"));
const kopya = o => JSON.parse(JSON.stringify(o));
// servis kayıtlarındaki zaman damgaları (z: Date.now()) çalıştırmaya göre değişir; karşılaştırmaya girmez
const metin = v => JSON.stringify(v, (k, x) => (k === "z" && typeof x === "number" && x > 1e11 ? undefined : x));

function kontrol(ad, deger) {
  const m = metin(deger), ozet = crypto.createHash("sha1").update(m).digest("hex");
  if (DOK) { fs.mkdirSync(DOK, { recursive: true }); fs.writeFileSync(path.join(DOK, ad.replace(/[\/ ]/g, "_") + ".json"), m); }
  if (YAZ) { kayit[ad] = ozet; return; }
  expect(ozet, ad + " değişti").toBe(kayit[ad]);
}
afterAll(() => { if (YAZ) fs.writeFileSync(KAYIT_YOLU, JSON.stringify(kayit, null, 1) + "\n"); });

const SAAT = { saat: () => 0 };   // arama süreyle değil deneme sayısıyla biter: her makinede aynı sonuç

test("sabitler", () => {
  kontrol("sabitler", { AGIRLIK: M.AGIRLIK, FM_MAX_FARK: M.FM_MAX_FARK, AYAR_VARSAYILAN: M.AYAR_VARSAYILAN, PUANTAJ_KODLARI: M.PUANTAJ_KODLARI, SERVIS_ZOR_ESIK: M.SERVIS_ZOR_ESIK });
});

for (const [takim, ayar] of Object.entries(AYARLAR)) {
  describe("zengin senaryo, " + takim + " ayarlar", () => {
    const veri = veriKur();
    veri.settings = { ...ayar };
    const id = ad => veri.staff.find(s => s.name.startsWith(ad)).id;
    const kisi = ad => { const s = veri.staff.find(x => x.name.startsWith(ad)); return { id: s.id, name: s.name, role: s.role }; };
    const uyarilar = [];

    for (const [y, m] of AYLAR) {
      test(`çizelge ${y}-${m + 1}`, () => {
        const k = y + "-" + m;
        if (k === "2026-1") {
          // Şubat: elle girilip kilitlenmiş iki gün (biri hafta sonu, hazırlamasıyla birlikte)
          const gunler = Array.from({ length: 28 }, (_, i) => ({ day: i + 1, tatil: false, conflict: false, fazlaMesai: 0, assigned: [], prep: [], locked: false }));
          gunler[4] = { ...gunler[4], assigned: [kisi("Cem"), kisi("Kaan")], locked: true };
          gunler[13] = { ...gunler[13], tatil: true, assigned: [kisi("Bora"), kisi("Gül")], prep: [kisi("Hakan"), kisi("Mert")], locked: true };
          veri.schedules[k] = { year: y, month: m, days: gunler, uyarilar: [], olusturma: 0 };
        }
        const once = kopya(veri);
        const r = M.cizelgeOlustur(veri, y, m, SAAT);
        expect(veri, "motor girdiyi değiştirmemeli").toEqual(once);
        kontrol(`${takim}/cizelge/${k}`, r);
        uyarilar.push(...r.warnings);
        veri.schedules[k] = { year: y, month: m, days: r.days, uyarilar: r.warnings, olusturma: 0 };
      });
    }

    test("farklı dağılım (varyasyon)", () => {
      const v = kopya(veri); delete v.schedules["2026-2"];
      kontrol(`${takim}/varyasyon`, M.cizelgeOlustur(v, 2026, 2, { ...SAAT, varyasyon: 3 }));
    });

    test("puantaj ve çalışma listesi", () => {
      for (const [y, m] of AYLAR) {
        kontrol(`${takim}/puantaj/${y}-${m}`, M.puantajHesapla(veri, y, m));
        kontrol(`${takim}/calisma/${y}-${m}`, M.calismaListesiHesapla(veri, y, m));
      }
      // ay sınırı: Nisan'ın çizelgesi yok, puantaj yine de hesaplanır
      kontrol(`${takim}/puantaj/2026-3`, M.puantajHesapla(veri, 2026, 3));
    });

    test("gün denetimi (elle düzenleme)", () => {
      const sonuc = [];
      for (const [y, m] of AYLAR.slice(1)) {
        const sch = veri.schedules[y + "-" + m];
        for (const gun of [1, 2, 7, 13, 14, 20, 21, sch.days.length]) {
          const g = sch.days[gun - 1];
          sonuc.push(M.gunuDenetle(veri, sch, gun, g.assigned, g.prep || []));
          // ikinci nöbetçinin yerine başka biri, hazırlamaya nöbetçi
          const yeni = [g.assigned[0], kisi(gun % 2 ? "Irmak" : "Fikret")].filter(Boolean);
          sonuc.push(M.gunuDenetle(veri, sch, gun, yeni, [kisi("Hakan"), kisi("Nur")]));
          sonuc.push(M.gunuDenetle(veri, sch, gun, [kisi("Gül")], [g.assigned[0]].filter(Boolean)));
        }
      }
      kontrol(`${takim}/gunuDenetle`, sonuc);
    });

    test("nöbet değişimi denetimi ve yerine adaylar", () => {
      const sonuc = [];
      for (const [y, m] of AYLAR.slice(1)) {
        const sch = veri.schedules[y + "-" + m];
        for (const gun of [3, 8, 14, 22, sch.days.length]) {
          const g = sch.days[gun - 1], cik = g.assigned[0].id, cik2 = g.assigned[1] && g.assigned[1].id;
          for (const yer of [id("Ayşe"), id("Irmak"), id("Mert"), id("Fikret"), cik2]) {
            sonuc.push(M.degisimDenetle(veri, { y, m, gorev: "N", tur: "devir", gun, cik, yer }));
          }
          const g2 = sch.days[(gun + 4) % sch.days.length];
          const yer2 = g2.assigned.find(p => p.id !== cik);
          if (yer2) sonuc.push(M.degisimDenetle(veri, { y, m, gorev: "N", tur: "takas", gun, cik, yer: yer2.id, gun2: g2.day, gorev2: "N" }));
          if (g.prep && g.prep.length) {
            sonuc.push(M.degisimDenetle(veri, { y, m, gorev: "H", tur: "devir", gun, cik: g.prep[0].id, yer: id("Lale") }));
            sonuc.push(M.degisimDenetle(veri, { y, m, gorev: "H", tur: "takas", gun, cik: g.prep[0].id, yer: cik, gun2: gun, gorev2: "N" }));
          }
          sonuc.push(M.yerineAdaylarHesapla(veri, y, m, gun, cik, "N"));
          if (g.prep && g.prep.length) sonuc.push(M.yerineAdaylarHesapla(veri, y, m, gun, g.prep[0].id, "H"));
        }
      }
      sonuc.push(M.degisimDenetle(veri, { y: 2026, m: 0, gorev: "N", tur: "devir", gun: 40, cik: 1, yer: 2 }));
      sonuc.push(M.degisimDenetle(veri, { y: 2026, m: 0, gorev: "N", tur: "takas", gun: 5, cik: 1, yer: 2 }));
      sonuc.push(M.degisimDenetle(veri, { y: 2026, m: 0, gorev: "N", tur: "devir", gun: 5, cik: 3, yer: 3 }));
      kontrol(`${takim}/degisim`, sonuc);
    });

    test("acil servis denetimi", () => {
      const sonuc = [];
      for (const g of [4, 5, 6, 7, 17, 18, 31]) {
        for (const ids of [[id("Oya")], [id("Ece"), id("Oya")], [id("Cem"), id("Cem")], [id("Dila")], [id("Bora"), id("Ayşe")]]) sonuc.push(M.acilDenetle(veri, 2026, 0, g, ids));
      }
      kontrol(`${takim}/acil`, sonuc);
    });

    test("yıllık rapor ve uyarı sınıfları", () => {
      kontrol(`${takim}/yillik/2026`, M.yillikRaporHesapla(veri, 2026));
      kontrol(`${takim}/yillik/2025`, M.yillikRaporHesapla(veri, 2025));
      kontrol(`${takim}/uyariSinif`, uyarilar.map(u => M.uyariSiniflandir(u)));
    });

    test("servis hazırlama", () => {
      const sonuc = [];
      veri.servisAyar = takim === "farkli"
        ? { svc: { "TBC": { z: 9, h: 4, multi: true, on: true }, "GÖZ": { z: 1, h: 2, multi: false, on: false } }, ekstra: [{ name: "YENİ YB", z: 8, h: 6, multi: false }] }
        : {};
      veri.servisKayit = {};
      sonuc.push(M.servisListesi(veri));
      for (const [y, m] of AYLAR) {
        const r = M.servisAyHesapla(veri, y, m, {}, 20260115);
        sonuc.push(r);
        if (r.kayit) veri.servisKayit[y + "-" + m] = r.kayit;
      }
      // olmayan ay: çizelgesi yok
      sonuc.push(M.servisAyHesapla(veri, 2026, 5, {}, 20260115));
      for (const d of [2, 9, 15, 16, 20, 27]) sonuc.push(M.servisGunu(veri, 2026, 0, d, 20260115));
      const islem = i => { const R = M.servisIslem(veri, 2026, 0, i, 20260115); sonuc.push(R); veri.servisKayit["2026-0"] = R; };
      const g20 = veri.servisKayit["2026-0"].gun[20], sn = Object.keys(g20.a)[0], hedef = g20.k.find(k => k !== g20.a[sn]);
      sonuc.push(M.servisAtamaAdaylari(veri, 2026, 0, 20, sn, 20260115));
      islem({ tur: "kisi", gun: 16, id: veri.servisKayit["2026-0"].gun[16].k[0] });
      islem({ tur: "karistir", gun: 21 });
      islem({ tur: "ngun", gun: 23, n: 2 });
      islem({ tur: "ata", gun: 20, sn, hedef, karsilik: null });
      islem({ tur: "oto", gun: 20, sn });
      islem({ tur: "ata", gun: 22, sn: Object.keys(veri.servisKayit["2026-0"].gun[22].a)[1], hedef: veri.servisKayit["2026-0"].gun[22].k[1], karsilik: null });
      islem({ tur: "ataSifirla", gun: 22 });
      islem({ tur: "yeniden", gun: 26 });
      sonuc.push(M.servisIslem(veri, 2025, 11, { tur: "olustur" }, 20260115));
      sonuc.push(M.servisYillik(veri, 2026, 20260115));
      sonuc.push(M.servisYillik(veri, 2025, 20260301));
      kontrol(`${takim}/servis`, sonuc);
    });
  });
}

describe("dar kadro (kurallar tutmaz)", () => {
  test("Nisan 2026", () => {
    const v = darVeri();
    const r = M.cizelgeOlustur(v, 2026, 3, SAAT);
    kontrol("dar/cizelge/2026-3", r);
    v.schedules["2026-3"] = { year: 2026, month: 3, days: r.days };
    kontrol("dar/puantaj/2026-3", M.puantajHesapla(v, 2026, 3));
    kontrol("dar/uyariSinif", r.warnings.map(u => M.uyariSiniflandir(u)));
  });
  test("tek kişilik kadro", () => {
    kontrol("dar/yetersiz", M.cizelgeOlustur({ staff: [{ id: 1, name: "E", role: "eczaci" }] }, 2026, 3, SAAT));
  });
});
