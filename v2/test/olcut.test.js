// Çizelge ölçütleri (motor/olcut.ts): ayar önizlemesinin karşılaştırdığı sayılar çizelgeden doğru sayılır.
import { test, expect } from "vitest";
import fs from "fs";
import { cizelgeOlcutleri, degisenGunSayisi } from "../src/motor";
import { veriyiDogrula } from "../src/veri/dogrulama";

const v = veriyiDogrula(JSON.parse(fs.readFileSync(new URL("../e2e/veri/durum.json", import.meta.url), "utf8")));
const sch = v.schedules["2026-10"];

test("örnek ay: uyarı, eşitlik, boş hafta sonu ve kural sayıları", () => {
  const o = cizelgeOlcutleri(v, 2026, 10, { days: sch.days, warnings: sch.uyarilar });
  expect(o.kirmizi).toBe(sch.days.filter(d => d.conflict).length);
  expect(o.haftaSonuToplam % 4).toBe(0); // Kasım 2026: 4 tam hafta sonu
  expect(o.bosHaftaSonu).toBeGreaterThan(0);
  expect(o.bosHaftaSonu).toBeLessThan(o.haftaSonuToplam);
  expect(o.fmFark).toBeGreaterThanOrEqual(0);
  // bir kişiyi Cuma nöbetinden sonra Pazar nöbetine yazınca Cuma→Pazar sayısı artar, değişen gün 1
  const days = JSON.parse(JSON.stringify(sch.days));
  const cuma = days[19].assigned[1]; // 20 Kasım Cuma
  days[21].assigned[1] = cuma; // 22 Kasım Pazar
  const o2 = cizelgeOlcutleri(v, 2026, 10, { days, warnings: sch.uyarilar });
  expect(o2.cumaPazar).toBe(o.cumaPazar + 1);
  expect(degisenGunSayisi(sch.days, days)).toBe(1);
});
