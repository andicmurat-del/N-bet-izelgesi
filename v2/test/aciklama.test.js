// "Neden bu kişi?" (motor/aciklama.ts): günün adayları; yazılamayanların güne özgü nedenleri elle düzenleme denetiminden;
// yalnız ayın eşitliğini bozan adaylar ayrı; karşılaştırma sayıları çizelgeyle tutarlı.
import { test, expect } from "vitest";
import fs from "fs";
import { gunAciklamasi } from "../src/motor";
import { veriyiDogrula } from "../src/veri/dogrulama";

const v = veriyiDogrula(JSON.parse(fs.readFileSync(new URL("../e2e/veri/durum.json", import.meta.url), "utf8")));
const sch = v.schedules["2026-10"];
const bul = (l, ad) => l.find(a => a.ad.startsWith(ad));

test("Cumartesi 14 Kasım: görevliler yazılı; komşu gün nöbeti, hafta sonu kuralı ve izin kenarı nedeniyle yazılamayanlar", () => {
  const a = gunAciklamasi(v, sch, 14);
  expect(a.gunTuru).toBe("Cumartesi");
  const g = sch.days[13];
  for (const p of g.assigned) expect(bul(a.nobet, p.name).durum).toBe("yazili");
  for (const p of g.prep) expect(bul(a.hazirlama, p.name).durum).toBe("yazili");
  const cem = bul(a.nobet, "Cem");
  expect(cem.durum).toBe("yazilamaz");
  expect(cem.nedenler.join(" ")).toContain("15. gün de nöbetçi");
  expect(bul(a.nobet, "Bora").nedenler.join(" ")).toContain("yıllık izninin");
  expect(bul(a.nobet, "Kaan").nedenler.join(" ")).toContain("hafta sonu kuralı");
  // engeli yok ama tek başına fazla mesai eşitliğini bozar
  const nihan = bul(a.nobet, "Nihan");
  expect(nihan.durum).toBe("denge");
  expect(nihan.denge.join(" ")).toContain("fazla mesai farkı");
  expect(bul(a.hazirlama, "Tuba").nedenler.join(" ")).toContain("3. hazırlama");
  // sayılar çizelgeyle aynı; sıra: yazılı önce, yazılamaz sonda
  const ec = bul(a.nobet, g.assigned[0].name);
  expect(ec.ayNobet).toBe(sch.days.filter(d => d.assigned.some(p => p.id === ec.id)).length);
  expect(a.nobet[0].durum).toBe("yazili");
  expect(a.nobet[a.nobet.length - 1].durum).toBe("yazilamaz");
  // acil kadrosu ve acil servis personeli aday değil
  expect(bul(a.nobet, "Fatma")).toBeUndefined();
  expect(bul(a.nobet, "Veli")).toBeUndefined();
});

test("izinli gün: izinli kişi yazılamaz, neden izin; hafta içinde hazırlama yok", () => {
  const a = gunAciklamasi(v, sch, 18);
  expect(a.hazirlama).toBeNull();
  const bora = bul(a.nobet, "Bora");
  expect(bora.durum).toBe("yazilamaz");
  expect(bora.nedenler.join(" ")).toMatch(/izin/i);
});
