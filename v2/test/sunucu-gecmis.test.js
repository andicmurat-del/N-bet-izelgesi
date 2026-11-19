// Sunucudaki değişiklik geçmişi (src/veri/sunucuGecmis.svelte.ts): her sorumlunun kayıtları kendi kimliğinin altında, ay ay
// tek belgede; art arda aynı değişiklik tek kayıt; başka cihazdan gelen veri kaydedilmez; bütün sorumlular birlikte okunur.
import { describe, test, expect, beforeEach } from "vitest";
import {
  sunucuGecmis,
  sunucuGecmisBaslat,
  sunucuyaKaydet,
  sunucuGecmisiYaz,
  sunucuGecmisiYukle,
  sunucuGecmisiSifirla,
} from "../src/veri/sunucuGecmis.svelte.ts";
import { gunlukSunucuKopyasi, sunucuKopyalari, sunucuKopyasiOku, sunucuKopyaSifirla } from "../src/veri/sunucuKopya.ts";
import { sahteDb } from "./sahte/db.js";

const Z = new Date(2026, 10, 19, 10, 0).getTime();
let db;
beforeEach(() => {
  sunucuGecmisiSifirla();
  sunucuKopyaSifirla();
  db = sahteDb();
});

describe("sunucu geçmişi", () => {
  test("kayıt kişinin kendi kimliğinin altına, ayın belgesine yazılır; art arda aynı değişiklik birleşir", async () => {
    sunucuGecmisBaslat(db, "u_ayse");
    sunucuyaKaydet({ z: Z, kim: "", t: ["Kasım 2026 nöbet çizelgesi: 1 gün elle değişti"] }, false);
    sunucuyaKaydet({ z: Z + 5000, kim: "", t: ["Kasım 2026 nöbet çizelgesi: 1 gün elle değişti"] }, true);
    sunucuyaKaydet({ z: Z + 9000, kim: "", t: ["Personel: Dila eklendi"] }, false);
    sunucuyaKaydet({ z: Z + 9500, kim: "", t: ["öbür cihazdan"], tur: "esitleme" }, false);
    await sunucuGecmisiYaz();
    expect(db.belgeler.has("gecmis/u_ayse")).toBe(true);
    const b = db.belgeler.get("gecmis/u_ayse/aylar/2026-11");
    expect(b.ay).toBe("2026-11");
    expect(b.k.map(k => [k.z, k.t[0]])).toEqual([
      [Z + 5000, "Kasım 2026 nöbet çizelgesi: 1 gün elle değişti"],
      [Z + 9000, "Personel: Dila eklendi"],
    ]);
  });
  test("ay belgesi dolunca yeni belgeye geçilir", async () => {
    sunucuGecmisBaslat(db, "u_ayse");
    const uzun = "x".repeat(4000);
    for (let i = 0; i < 60; i++) sunucuyaKaydet({ z: Z + i, kim: "", t: [uzun + i] }, false);
    await sunucuGecmisiYaz();
    const ids = [...db.belgeler.keys()].filter(k => k.startsWith("gecmis/u_ayse/aylar/")).sort();
    expect(ids).toEqual(["gecmis/u_ayse/aylar/2026-11", "gecmis/u_ayse/aylar/2026-11.2"]);
    for (const k of ids) expect(JSON.stringify(db.belgeler.get(k)).length).toBeLessThan(256 * 1024);
    const n = ids.reduce((a, k) => a + db.belgeler.get(k).k.length, 0);
    expect(n).toBe(60);
  });
  test("bütün sorumluların kayıtları birlikte, yeniden eskiye okunur", async () => {
    await db.doc("gecmis/u_mehmet").set({ ilk: Z });
    await db
      .collection("gecmis/u_mehmet/aylar")
      .doc("2026-11")
      .set({ ay: "2026-11", n: 1, bas: Z + 1, k: [{ z: Z + 1, t: ["Mehmet'in değişikliği"] }] });
    sunucuGecmisBaslat(db, "u_ayse");
    sunucuyaKaydet({ z: Z + 2, kim: "", t: ["Ayşe'nin değişikliği"], tur: "geri" }, false);
    await sunucuGecmisiYaz();
    await sunucuGecmisiYukle();
    expect(sunucuGecmis.kayit.map(k => [k.kim, k.t[0], k.tur])).toEqual([
      ["u_ayse", "Ayşe'nin değişikliği", "geri"],
      ["u_mehmet", "Mehmet'in değişikliği", undefined],
    ]);
  });
});

describe("sunucudaki günlük kopyalar", () => {
  const p = { ana: '{"staff":[]}', aylar: { "2026-10": '{"schedules":{}}' } };
  test("günde bir kopya alınır, geri okunur; eski kopyalar silinir", async () => {
    await gunlukSunucuKopyasi(db, { ana: "eski", aylar: {} }, "u_ayse", new Date(2026, 10, 1));
    sunucuKopyaSifirla();
    await gunlukSunucuKopyasi(db, p, "u_ayse", new Date(2026, 10, 19));
    await gunlukSunucuKopyasi(db, { ana: "ikinci", aylar: {} }, "u_ayse", new Date(2026, 10, 19, 15));
    const l = await sunucuKopyalari(db);
    expect(l.map(k => [k.gun, k.kim])).toEqual([["2026-11-19", "u_ayse"]]);
    expect(await sunucuKopyasiOku(db, "2026-11-19")).toEqual(p);
    expect(db.belgeler.has("kopyalar/2026-11-01")).toBe(false);
  });
});
