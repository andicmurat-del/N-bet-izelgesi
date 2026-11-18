// Telefon görünümü (iPhone 13): hiçbir sayfa yatay taşmaz, gün penceresi ekrana sığar.
import { test, expect, git, bas } from "./yardimci";

const GORUNUMLER = [
  "gunluk/nobet",
  "gunluk/liste",
  "gunluk/oglen",
  "gunluk/onay",
  "gunluk/hazirlama",
  "gunluk/puantaj",
  "gunluk/izinler",
  "gunluk/kisi",
  "gunluk/raporlar",
  "acil/acil",
  "acil/puantaj",
  "ayarlar/genel",
  "ayarlar/personel",
  "ayarlar/kurallar",
  "ayarlar/yardim",
];

test("sayfalar yatay taşmaz", async ({ page, kur }) => {
  await kur();
  for (const g of GORUNUMLER) {
    await git(page, g);
    const [sw, w] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(sw, g).toBeLessThanOrEqual(w);
  }
});

test("gün penceresi ekrana sığar", async ({ page, kur }) => {
  await kur();
  await git(page, "gunluk/nobet");
  await page.getByText("14 Kasım", { exact: false }).first().click();
  if (!(await page.locator("dialog[open]").count())) await bas(page, "Nöbet değişikliği yap");
  const d = page.locator("dialog[open]");
  await d.getByLabel("Nöbetçi sayısı").selectOption("3");
  const [sw, w] = await d.evaluate(e => [e.scrollWidth, e.clientWidth]);
  expect(sw).toBeLessThanOrEqual(w);
});

test("nöbet listesi telefonda gün kartlarıyla; karta dokununca gün penceresi açılır", async ({ page, kur }) => {
  await kur();
  await git(page, "gunluk/nobet");
  await expect(page.locator("main table.liste")).toHaveCount(0);
  await expect(page.locator("main button.gun-kart")).toHaveCount(30);
  const kart = page.locator("main button.gun-kart", { hasText: "14 Kasım" });
  await expect(kart).toContainText("Hülya Koç");
  await expect(kart).toContainText("Ayşe Yılmaz");
  await kart.click();
  await expect(page.locator("dialog[open]")).toBeVisible();
});
