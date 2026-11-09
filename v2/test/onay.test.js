// Onay listesi masaları: haftalık sıra (Masa 1 → 3 → 2 → 4 → Joker → 5 → Joker → 6, 9. kişi sona joker), eksik masaya
// joker, kalan 2+ jokerden ilki Masa 7, joker yetmezse hazırlama teknikeri (yıl boyunca sırayla), resmi tatilde liste yok.
import { describe, test, expect } from "vitest";
import { onayHaftasiHesapla, onayDongusu, yerAdi } from "../src/motor";

const staff = [];
for (let i = 1; i <= 9; i++) staff.push({ id: i, name: "E" + i, role: "eczaci", ...(i === 9 ? { acilTutar: true } : {}) });
staff.push({ id: 10, name: "K1", role: "nobetci" });
for (let i = 1; i <= 3; i++) staff.push({ id: 10 + i, name: "T" + i, role: "teknisyen" });
const veri = {
  staff, prefs: {}, manualTatil: { "2026-10-12": true }, arife: { "2026-10-13": true }, settings: {}, schedules: {}, acil: {}, oglen: {},
  puantaj: { "2026-10": { 1: { 10: "YI", 11: "YI" }, 2: { 11: "R" }, 3: { 11: "R" }, 4: { 11: "NI" } } },
  // 9 Kasım haftası: E1 sıranın 1. yerinde (Masa 1), E2 2. (Masa 3) … E9 9. (Joker 3)
  onayMasa: { yerlesim: { "2026-11-09": Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => [i, i - 1])) } },
};
const ad = h => h.ad || null;

describe("onay listesi masaları", () => {
  test("sıra: Masa 1, 3, 2, 4, Joker, 5, Joker, 6; 9. kişi sona joker", () => {
    expect(onayDongusu(8).map(yerAdi)).toEqual(["Masa 1", "Masa 3", "Masa 2", "Masa 4", "Joker 1", "Masa 5", "Joker 2", "Masa 6"]);
    expect(onayDongusu(9).map(yerAdi).at(-1)).toBe("Joker 3");
  });

  const H = onayHaftasiHesapla(veri, 2026, 10, 11);
  test("kemoterapi eczacısı yok; acilde tutan eczacı var", () => {
    expect(H.kisiler.map(k => k.ad)).toEqual(["E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8", "E9"]);
  });

  test("herkes çalışıyor: 6 masa sahibi, 3 jokerden ilki Masa 7, kalan ikisi joker", () => {
    const g = H.gunler[0];   // 9 Kasım
    expect(g.masa.map(ad)).toEqual(["E1", "E3", "E2", "E4", "E6", "E8", "E5"]);
    expect(g.joker.map(ad)).toEqual(["E7", "E9"]);
  });

  test("masa sahibi izinli: ilk joker o masaya oturur, joker görevi sayılır; kalan 2 jokerden ilki Masa 7", () => {
    const g = H.gunler[1];   // 10 Kasım, E1 yıllık izinde
    expect(g.masa[0]).toMatchObject({ ad: "E5" });
    expect(g.masa[0].not).toContain("E1 yerine");
    expect(g.masa[6]).toMatchObject({ ad: "E7" });
    expect(g.joker.map(ad)).toEqual(["E9"]);
  });

  test("joker yetmezse o günün teknikeri oturur; Masa 7 boş", () => {
    const g = H.gunler[2];   // 11 Kasım: E1–E4 yok (izin, rapor, nöbet ertesi)
    expect(g.masa.slice(0, 3).map(ad)).toEqual(["E5", "E7", "E9"]);
    expect(g.masa[3]).toMatchObject({ ad: "T1", tekniker: true });
    expect(g.masa[6].id).toBe(null);
    expect(g.joker).toEqual([]);
    expect(g.uyari).toEqual([]);
  });

  test("resmi tatilde liste yok; arife günü var", () => {
    expect(H.gunler[3].tatil).toBe(true);
    expect(H.gunler[3].masa).toEqual([]);
    expect(H.gunler[4].arife).toBe(true);
    expect(H.gunler[4].masa.slice(0, 6).every(h => h.id)).toBe(true);
  });

  test("sonraki hafta herkes sıradaki yere geçer", () => {
    const S = onayHaftasiHesapla(veri, 2026, 10, 16);
    expect(S.yerlesim.girildi).toBe(false);
    expect(S.kisiler.find(k => k.ad === "E1").yer).toEqual({ tur: "masa", no: 3 });
    expect(S.kisiler.find(k => k.ad === "E9").yer).toEqual({ tur: "masa", no: 1 });
    expect(S.kisiler.find(k => k.ad === "E4").yer).toEqual({ tur: "joker", no: 1 });
  });

  test("tekniker sırası yıl boyunca: masaya oturan tekniker sonraki sefer arkaya geçer", () => {
    const v = JSON.parse(JSON.stringify(veri));
    v.puantaj["2026-10"] = { 1: { 17: "R", 18: "R" }, 2: { 17: "R", 18: "R" }, 3: { 17: "R", 18: "R" }, 4: { 17: "R", 18: "R" } };
    const S = onayHaftasiHesapla(v, 2026, 10, 16);
    const tek = S.gunler.flatMap(g => g.masa.filter(h => h?.tekniker).map(h => h.ad));
    expect(tek).toEqual(["T1", "T2"]);
  });

  test("işten ayrılanın yeri sıradan düşer: en sondaki yerdeki kişi onun yerine geçer, kimsenin yeri değişmez", () => {
    const v = JSON.parse(JSON.stringify(veri)); v.puantaj = {};
    v.staff.find(s => s.id === 2).bitis = "2026-11-13";   // E2 13 Kasım'da ayrılıyor
    const S = onayHaftasiHesapla(v, 2026, 10, 16);
    expect(S.yerlesim.n).toBe(8);
    expect(S.yerlesim.ayrilanlar).toEqual(["E2"]);
    const yer = Object.fromEntries(S.kisiler.map(k => [k.ad, yerAdi(k.yer)]));
    // ilerleyince E2 Masa 2'ye geçecekti; sıranın son yerine (Joker 3) geçecek olan E8 onun yerini alır
    expect(yer.E1).toBe("Masa 3");
    expect(yer.E8).toBe("Masa 2");
    expect(yer.E9).toBe("Masa 1");
    expect(S.kisiler.some(k => k.ad === "E2")).toBe(false);
    expect(S.gunler[0].masa.slice(0, 6).every(h => h.id)).toBe(true);
  });

  test("yeri girilmemiş eczacı ekstra joker olur (teknikerden önce)", () => {
    const v = JSON.parse(JSON.stringify(veri));
    v.staff.push({ id: 50, name: "Yeni", role: "eczaci" });
    const g = onayHaftasiHesapla(v, 2026, 10, 11).gunler[2];   // 11 Kasım: E1–E4 yok
    expect(g.masa[3]).toMatchObject({ ad: "Yeni" });
    expect(g.masa.some(h => h?.tekniker)).toBe(false);
  });

  test("nöbet günü (eczane ya da acil) masada; nöbet ertesi değil", () => {
    const v = JSON.parse(JSON.stringify(veri)); v.puantaj = {};
    v.acil = { "2026-10": { 9: [9] } };   // E9 (acilde tutan) 9 Kasım acil nöbetinde, 10 Kasım nöbet ertesi
    const H2 = onayHaftasiHesapla(v, 2026, 10, 9);
    const oturan = g => [...g.masa, ...g.joker].filter(h => h?.id).map(h => h.ad);
    expect(oturan(H2.gunler[0])).toContain("E9");
    expect(oturan(H2.gunler[1])).not.toContain("E9");
  });

  test("yerleşim girilmeden önceki haftada liste yok", () => {
    expect(onayHaftasiHesapla(veri, 2026, 10, 2).yerlesim).toBe(null);
  });
});
