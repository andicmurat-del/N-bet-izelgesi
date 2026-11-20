// Sunucuda saklama biçimi ve eşitleme kararı (src/veri/bulutBicim.ts): veri belgelere bölünüp geri kurulunca aynı kalır;
// hiçbir durumda dolu ve değişmiş bir taraf sorulmadan ezilmez.
import { describe, test, expect } from "vitest";
import {
  parcala,
  birlestir,
  parcalarAyni,
  ozet,
  bosMu,
  eslemeKarari,
  BELGE_SINIRI,
  bolumOzetleri,
  ucluBirlestir,
  kararliJson,
  bolumAdi,
} from "../src/veri/bulutBicim.ts";
import { veriyiDogrula, guvenliJson, bosVeri } from "../src/veri/depo.svelte.ts";
import { cizelgeOlustur, acilHesapla, oglenHesapla } from "../src/motor";
import { veriKur } from "./altin/senaryo.js";
import { hizli } from "./tarama/ortak.js";

function doluVeri() {
  const v = veriyiDogrula(veriKur());
  for (const m of [0, 1]) {
    const r = cizelgeOlustur(v, 2026, m, hizli());
    v.schedules[`2026-${m}`] = { year: 2026, month: m, days: r.days, uyarilar: r.warnings, olusturma: 1 };
    v.acil[`2026-${m}`] = Object.fromEntries(
      acilHesapla(v, 2026, m)
        .gunler.filter(g => g.ids.length)
        .map(g => [g.gun, g.ids]),
    );
    v.oglen[`2026-${m}`] = Object.fromEntries(oglenHesapla(v, 2026, m).gunler.map(g => [g.gun, { e: g.e, t: g.t }]));
  }
  v.kurum.ad = 'Şehir Hastanesi "Eczane"';
  return veriyiDogrula(JSON.parse(JSON.stringify(v)));
}

describe("sunucu belgeleri", () => {
  const v = doluVeri(),
    p = parcala(v);
  test("veri ortak bölüm ve ay belgelerine bölünür, geri kurulunca aynıdır", () => {
    expect(Object.keys(p.aylar).sort()).toEqual(["2025-11", "2026-0", "2026-1"].filter(k => k in p.aylar).sort());
    expect(Object.keys(p.aylar)).toContain("2026-0");
    expect(JSON.parse(p.ana).schedules).toBeUndefined();
    // personel, ayarlar, kurum, servis ayarları yönetim belgesinde (yalnız baş sorumlu yazar)
    expect(JSON.parse(p.ana).staff).toBeUndefined();
    expect(JSON.parse(p.yonetim).staff.length).toBe(v.staff.length);
    expect(Object.keys(JSON.parse(p.yonetim)).sort()).toEqual(["kurum", "servisAyar", "settings", "staff"]);
    expect(veriyiDogrula(birlestir(p, guvenliJson))).toEqual(v);
  });
  test("eski biçim (yönetim belgesi yok) okunur ve yazılabilir; yönetim belgesi varsa ondaki geçerlidir", () => {
    const eski = parcala(v, false);
    expect(eski.yonetim).toBeUndefined();
    expect(JSON.parse(eski.ana).staff.length).toBe(v.staff.length);
    expect(veriyiDogrula(birlestir(eski, guvenliJson))).toEqual(v);
    // ana belgeye sonradan yazılmış personel, yönetim belgesindekini geçemez
    const sahte = { ...p, ana: JSON.stringify({ ...JSON.parse(p.ana), staff: [] }) };
    expect(veriyiDogrula(birlestir(sahte, guvenliJson)).staff.length).toBe(v.staff.length);
    expect(ozet(eski)).not.toBe(ozet(p));
  });
  test("boş veri de gidip gelir; ay belgesi olmaz", () => {
    const b = parcala(bosVeri());
    expect(b.aylar).toEqual({});
    expect(veriyiDogrula(birlestir(b, guvenliJson))).toEqual(bosVeri());
    expect(bosMu(bosVeri())).toBe(true);
    expect(bosMu(v)).toBe(false);
  });
  test("ay anahtarı olmayan ya da bozuk belge veriyi bozmaz", () => {
    const k = {
      ana: p.ana,
      aylar: {
        ...p.aylar,
        x: '{"schedules":1}',
        "2026-5": "[1,2]",
        "2026-6": '{"__proto__":{"kirli":1},"puantaj":{"__proto__":{"kirli":"M"}}}',
      },
    };
    expect(veriyiDogrula(birlestir(k, guvenliJson)).schedules).toEqual(v.schedules);
    expect({}.kirli).toBeUndefined();
  });
  test("özet içerikle değişir, sırayla değişmez", () => {
    const ters = { ana: p.ana, yonetim: p.yonetim, aylar: Object.fromEntries(Object.entries(p.aylar).reverse()) };
    expect(ozet(ters)).toBe(ozet(p));
    expect(parcalarAyni(ters, p)).toBe(true);
    const v2 = JSON.parse(JSON.stringify(v));
    v2.kurum.ad = "B";
    expect(ozet(parcala(v2))).not.toBe(ozet(p));
    expect(parcalarAyni(parcala(v2), p)).toBe(false);
  });
  test("iki aylık dolu veri belge sınırının çok altında", () => {
    for (const t of [p.ana, ...Object.values(p.aylar)]) expect(JSON.stringify(t).length).toBeLessThan(BELGE_SINIRI / 4);
  });
});

describe("eşitleme kararı", () => {
  const iz = { z: 5, ozet: "a" };
  const k = o => eslemeKarari({ sunucuZ: 5, sunucuAyni: false, iz, yerelOzet: "a", yerelBos: false, ...o });
  test("sunucu boş: dolu cihaz gönderir, boş cihaz bekler", () => {
    expect(k({ sunucuZ: null, iz: null })).toBe("gonder");
    expect(k({ sunucuZ: null, iz: null, yerelBos: true })).toBe("ayni");
  });
  test("iki taraf aynıysa bir şey yapılmaz", () => {
    expect(k({ sunucuAyni: true, iz: null })).toBe("ayni");
    expect(k({})).toBe("ayni");
  });
  test("yalnız bu cihaz değiştiyse gönderilir, yalnız sunucu değiştiyse alınır", () => {
    expect(k({ yerelOzet: "b" })).toBe("gonder");
    expect(k({ sunucuZ: 6 })).toBe("al");
  });
  test("ikisi de değiştiyse sorulur; hiç eşitlenmemiş dolu cihaz da sorar", () => {
    expect(k({ sunucuZ: 6, yerelOzet: "b" })).toBe("sor");
    expect(k({ iz: null })).toBe("sor");
  });
  test("hiç eşitlenmemiş boş cihaz sunucudakini alır", () => {
    expect(k({ iz: null, yerelBos: true, yerelOzet: "bos" })).toBe("al");
  });
  test("eşitlenmiş cihazda tüm verinin silinmesi bir değişikliktir: sunucudaki geri gelmez", () => {
    expect(k({ yerelBos: true, yerelOzet: "bos" })).toBe("gonder");
    expect(k({ yerelBos: true, yerelOzet: "bos", sunucuZ: 6 })).toBe("sor");
  });
});

describe("bölüm bölüm birleştirme (birden çok sorumlu)", () => {
  const taban = doluVeri();
  const tabanOzet = bolumOzetleri(taban);
  const kopya = () => JSON.parse(JSON.stringify(taban));
  test("anahtar sırası farklı olsa da aynı içerik aynı özeti verir", () => {
    const v = kopya();
    v.prefs = Object.fromEntries(Object.entries(v.prefs).reverse());
    v.kurum = { onaylayan: v.kurum.onaylayan, ad: v.kurum.ad };
    expect(bolumOzetleri(v)).toEqual(tabanOzet);
    expect(kararliJson({ b: 1, a: [1, { d: 2, c: 3 }] })).toBe('{"a":[1,{"c":3,"d":2}],"b":1}');
  });
  test("farklı bölümlerdeki değişiklikler kendiliğinden birleşir", () => {
    const yerel = kopya(),
      sunucu = kopya();
    yerel.schedules["2026-0"].days[3].assigned = []; // bu cihaz: Ocak çizelgesi
    sunucu.prefs["99-2026-1-5"] = "izinli"; // öbür sorumlu: izinler
    sunucu.puantaj["2026-0"] = { 1: { 4: "R" } }; // öbür sorumlu: Ocak puantajı (çizelgeden ayrı bölüm)
    const b = ucluBirlestir(tabanOzet, yerel, sunucu);
    expect(b.catisan).toEqual([]);
    expect(b.yerelden).toEqual(["schedules/2026-0"]);
    expect(b.sunucudan.sort()).toEqual(["prefs", "puantaj/2026-0"]);
    const v = veriyiDogrula(b.sonuc);
    expect(v.schedules["2026-0"].days[3].assigned).toEqual([]);
    expect(v.prefs["99-2026-1-5"]).toBe("izinli");
    expect(v.puantaj["2026-0"]).toEqual({ 1: { 4: "R" } });
  });
  test("aynı bölüm iki tarafta farklı değiştiyse çatışmadır; seçilen taraf alınır, ötekiler yine birleşir", () => {
    const yerel = kopya(),
      sunucu = kopya();
    yerel.kurum.ad = "Bu cihaz";
    sunucu.kurum.ad = "Öbür sorumlu";
    sunucu.manualTatil["2026-1-9"] = true;
    const b = ucluBirlestir(tabanOzet, yerel, sunucu);
    expect(b.catisan).toEqual(["kurum"]);
    expect(veriyiDogrula(b.sonuc).kurum.ad).toBe("Öbür sorumlu");
    const y = ucluBirlestir(tabanOzet, yerel, sunucu, "yerel");
    expect(veriyiDogrula(y.sonuc).kurum.ad).toBe("Bu cihaz");
    expect(veriyiDogrula(y.sonuc).manualTatil["2026-1-9"]).toBe(true);
    expect(bolumAdi("kurum", ["Ocak"])).toBe("kurum bilgileri");
  });
  test("iki taraf aynı değişikliği yaptıysa çatışma yok", () => {
    const yerel = kopya(),
      sunucu = kopya();
    yerel.prefs["7-2026-1-3"] = "avoid";
    sunucu.prefs["7-2026-1-3"] = "avoid";
    expect(ucluBirlestir(tabanOzet, yerel, sunucu).catisan).toEqual([]);
  });
  test("bir tarafta silinen ay kaydı silinmiş kalır; öbür tarafta eklenen ay gelir", () => {
    const yerel = kopya(),
      sunucu = kopya();
    delete yerel.schedules["2026-1"];
    sunucu.acil["2026-5"] = { 3: [1] };
    const b = ucluBirlestir(tabanOzet, yerel, sunucu);
    expect(b.catisan).toEqual([]);
    const v = veriyiDogrula(b.sonuc);
    expect(v.schedules["2026-1"]).toBeUndefined();
    expect(v.acil["2026-5"]).toEqual({ 3: [1] });
    expect(bolumAdi("schedules/2026-5", ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran"])).toBe("Haziran 2026 nöbet çizelgesi");
  });
});
