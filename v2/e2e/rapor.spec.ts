// Puantaj ve raporlar: puantaj PDF / Excel, yönetime aylık rapor (tek sayfa, toplamlar), yıllık rapor Excel.
import { test, expect, git, bas, indir, pdfOku, excelMi } from "./yardimci";

test("puantaj PDF'i tek sayfa, Excel", async ({ page, kur }) => {
  await kur();
  await git(page, "gunluk/puantaj");
  const p = await indir(page, () => bas(page, /^PDF$/));
  const { sayfa, metin } = await pdfOku(p.veri);
  expect(sayfa).toBe(1);
  expect(metin[0]).toContain("Kasım 2026 puantaj cetveli");
  expect(excelMi((await indir(page, () => bas(page, /^Excel$/))).veri)).toBe(true);
});

test("aylık rapor: tek sayfa, toplamlar, imza alanları", async ({ page, kur }) => {
  await kur();
  await git(page, "gunluk/raporlar");
  await page.getByRole("tab", { name: "Aylık rapor" }).click();
  await expect(page.locator("main tfoot")).toContainText("22 kişi");
  const p = await indir(page, () => bas(page, "PDF (imzalı)"));
  const { sayfa, metin } = await pdfOku(p.veri);
  expect(sayfa).toBe(1);
  // eczane nöbeti 60 (30 gün × 2), tatilde 18, acil 60, hazırlama 18
  expect(metin[0]).toMatch(/TOPLAM 22 kişi 60 18 60 18 \d+/);
  for (const im of ["Düzenleyen", "Kontrol eden", "Onaylayan"]) expect(metin[0]).toContain(im);
  expect(excelMi((await indir(page, () => bas(page, /^Excel$/))).veri)).toBe(true);
});

test("yıllık rapor Excel'i", async ({ page, kur }) => {
  await kur();
  await git(page, "gunluk/raporlar");
  expect(excelMi((await indir(page, () => bas(page, /^Excel$/))).veri)).toBe(true);
});
