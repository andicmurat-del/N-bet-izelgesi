// Değişiklik geçmişindeki özet satırları (veri/degisiklikOzeti.ts)
import { test, expect } from "vitest";
import fs from "fs";
import { degisiklikOzeti } from "../src/veri/degisiklikOzeti";
import { veriyiDogrula } from "../src/veri/dogrulama";

const ham = JSON.parse(fs.readFileSync(new URL("../e2e/veri/durum.json", import.meta.url), "utf8"));
const once = veriyiDogrula(ham);
const kopya = () => JSON.parse(JSON.stringify(once));

test("değişiklik yoksa boş", () => {
  expect(degisiklikOzeti(once, kopya())).toEqual([]);
});

test("personel, çizelge, izin, puantaj, onay ve ayar değişiklikleri okunur satırlarla", () => {
  const v = kopya();
  v.staff.push({ id: 99, name: "Yeni Kişi", role: "teknisyen" });
  v.staff = v.staff.filter(k => k.id !== 2);
  v.schedules["2026-10"].days[13].assigned = v.schedules["2026-10"].days[13].assigned.slice(0, 1);
  v.prefs["4-2026-10-3"] = "izinli";
  v.prefs["4-2026-11-1"] = "avoid";
  v.puantaj["2026-10"] = { 1: { 5: "R" } };
  v.listeOnay.acil["2026-10"] = { zaman: 1, kim: "" };
  v.settings.minAra = 4;
  expect(degisiklikOzeti(once, v)).toEqual([
    "Personel: Yeni Kişi eklendi",
    "Personel: Bora Kaya silindi",
    "Kasım 2026 nöbet çizelgesi: 1 gün elle değişti",
    "İzin ve tercih işaretleri (Kasım 2026: 1, Aralık 2026: 1)",
    "Kasım 2026 puantajı: 1 hücre",
    "Kasım 2026 acil listesi onaylandı",
    "Ayarlar: minAra",
  ]);
});

test("çizelge oluşturma, onay ve silme", () => {
  const v = kopya();
  v.schedules["2026-10"].onay = { zaman: 5, kim: "" };
  delete v.schedules["2026-11"];
  v.schedules["2026-11"] = { year: 2026, month: 11, days: [], uyarilar: [], olusturma: 1 };
  expect(degisiklikOzeti(once, v)).toEqual(["Kasım 2026 nöbet çizelgesi onaylandı", "Aralık 2026 nöbet çizelgesi oluşturuldu"]);
});

test("gün notları: eklenen not metniyle, silinen sayıyla; doğrulamadan geçer", () => {
  const a = kopya();
  a.notlar = { "2026-10": { 14: [{ id: "n1", z: 5, kimId: "u_1", metin: "Takas konuşuldu" }] } };
  const v = veriyiDogrula(JSON.parse(JSON.stringify(a)));
  expect(v.notlar["2026-10"]["14"]).toEqual([{ id: "n1", z: 5, kimId: "u_1", metin: "Takas konuşuldu" }]);
  expect(degisiklikOzeti(once, v)).toEqual(['14 Kasım 2026 gün notu: "Takas konuşuldu"']);
  const b = JSON.parse(JSON.stringify(v));
  b.notlar = {};
  expect(degisiklikOzeti(v, b)).toEqual(["14 Kasım 2026: 1 gün notu silindi"]);
  // boş metin, bozuk gün atılır; uzun metin kısalır
  const k = veriyiDogrula({
    ...a,
    notlar: {
      "2026-10": {
        40: [{ id: "x", z: 1, metin: "a" }],
        3: [
          { z: 1, metin: " " },
          { z: 2, metin: "x".repeat(900) },
        ],
      },
    },
  });
  expect(Object.keys(k.notlar["2026-10"])).toEqual(["3"]);
  expect(k.notlar["2026-10"]["3"][0].metin.length).toBe(500);
});
