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
