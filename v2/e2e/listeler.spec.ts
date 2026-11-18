// Öğlen nöbeti, onay listesi, acil eczane ve hazırlama listesi çıktıları.
import { test, expect, git, bas, indir, pdfOku, excelMi } from "./yardimci";

test("öğlen nöbeti haftalık PDF'i tek sayfa", async ({ page, kur }) => {
  await kur();
  await git(page, "gunluk/oglen");
  await bas(page, "3. hafta");
  const p = await indir(page, () => bas(page, "Haftalık PDF"));
  const { sayfa, metin } = await pdfOku(p.veri);
  expect(sayfa).toBe(1);
  expect(metin[0]).toContain("16 Pazartesi");
  expect(metin[0]).toContain("20 Cuma");
});

test("onay listesi haftalık PDF'i tek sayfa", async ({ page, kur }) => {
  await kur();
  await git(page, "gunluk/onay");
  await bas(page, "3. hafta");
  const p = await indir(page, () => bas(page, "Haftalık PDF"));
  const { sayfa, metin } = await pdfOku(p.veri);
  expect(sayfa).toBe(1);
  expect(metin[0]).toContain("onay listesi masaları");
  expect(metin[0]).toContain("Masa 1");
});

test("acil eczane listesi PDF'i ve Excel'i", async ({ page, kur }) => {
  await kur();
  await git(page, "acil/acil");
  const p = await indir(page, () => bas(page, /^PDF$/));
  const { metin } = await pdfOku(p.veri);
  expect(metin.join(" ")).toContain("Kasım 2026 acil eczane nöbet listesi");
  expect(metin.join(" ")).toContain("FATMA ÖZTÜRK");
  const x = await indir(page, () => bas(page, /^Excel$/));
  expect(excelMi(x.veri)).toBe(true);
});

test("hazırlama listesi PDF'leri (tek sayfa, kişi başı, toplu)", async ({ page, kur }) => {
  await kur();
  await git(page, "gunluk/hazirlama");
  for (const [tur, sayfa] of [["tek", 1], ["toplu", 1], ["kisi", 8]] as const) {
    await bas(page, /^PDF$/);
    await page.locator(`dialog[open] input[value="${tur}"]`).check();
    const p = await indir(page, () => page.locator("dialog[open] button", { hasText: "PDF oluştur" }).click());
    expect((await pdfOku(p.veri)).sayfa, tur).toBe(sayfa);
  }
});
