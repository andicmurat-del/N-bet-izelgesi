// Erişilebilirlik: her görünümde ve açılan pencerelerde axe-core denetimi (WCAG 2.1 A / AA). Kural dışı öğe kalmamalı.
import AxeBuilder from "@axe-core/playwright";
import { test, expect, git, bas } from "./yardimci";
import type { Page } from "@playwright/test";

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
  "acil/izinler",
  "acil/raporlar",
  "ayarlar/genel",
  "ayarlar/personel",
  "ayarlar/kurallar",
  "ayarlar/gecmis",
  "ayarlar/yardim",
];

// label-content-name-mismatch deneysel bir kuraldır: takvim ve tablo hücresi düğmelerinin ekran okuyucu adı bilerek görünen
// kısaltmalardan daha açıklayıcıdır ("14 Kasım Cumartesi: nöbetçi Ayşe Yılmaz ve Okan Yıldız"; ekranda "14 Cmt Ayşe Y.");
// bu yüzden denetim dışıdır.
async function denetle(page: Page) {
  await page.waitForTimeout(500); // renk geçişleri (düğme seçimi) bitsin: kontrast ara renkte ölçülmesin
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .disableRules(["label-content-name-mismatch"])
    .analyze();
  return r.violations.map(
    v =>
      `${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} öğe: ${v.nodes
        .map(n =>
          n.target
            .join(" ")
            .replace(/\.svelte-[a-z0-9]+/g, "")
            .slice(0, 60),
        )
        .filter((x, i, a) => a.indexOf(x) === i)
        .slice(0, 40)
        .join(" | ")}`,
  );
}

for (const g of GORUNUMLER)
  test("erişilebilirlik: " + g, async ({ page, kur }) => {
    await kur();
    await git(page, g);
    expect(await denetle(page)).toEqual([]);
  });

test("erişilebilirlik: takvim görünümü, resmi tatil işaretleri, puantaj alt görünümleri", async ({ page, kur }) => {
  await kur();
  await git(page, "gunluk/nobet");
  await bas(page, /^Takvim$/);
  expect(await denetle(page)).toEqual([]);
  await git(page, "gunluk/izinler");
  await bas(page, "Resmi tatil ve arife");
  expect(await denetle(page)).toEqual([]);
  await git(page, "gunluk/puantaj");
  for (const g of ["İzin ve rapor", "Nöbet değişimi"]) {
    await bas(page, g);
    expect(await denetle(page), g).toEqual([]);
  }
  await git(page, "ayarlar/personel");
  await page.locator("main button[aria-label$=': düzenle']").first().click();
  expect(await denetle(page)).toEqual([]);
});

test("erişilebilirlik: gün penceresi ve menü", async ({ page, kur }) => {
  await kur();
  await git(page, "gunluk/nobet");
  await page.locator("main tbody tr", { hasText: "14 Kasım" }).first().click();
  await bas(page, "Nöbet değişikliği yap");
  expect(await denetle(page)).toEqual([]);
  await page.keyboard.press("Escape");
  await page.locator("main button[aria-haspopup=menu]", { hasText: "Dışa aktar" }).click();
  expect(await denetle(page)).toEqual([]);
});

test("klavye: menü ok tuşlarıyla gezilir, Escape kapatıp odağı düğmeye döndürür; gün penceresi Escape ile kapanır", async ({
  page,
  kur,
}) => {
  await kur();
  await git(page, "gunluk/nobet");
  const dugme = page.locator("main button[aria-haspopup=menu]", { hasText: "Dışa aktar" });
  await dugme.focus();
  await page.keyboard.press("Enter");
  await expect(dugme).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("[role=menuitem]").first()).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("[role=menuitem]").nth(1)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dugme).toHaveAttribute("aria-expanded", "false");
  await expect(dugme).toBeFocused();
  // tablodaki güne klavyeyle: satırlar tıklanabilir ama yan paneldeki düğme klavyeyle erişilir
  await page.getByRole("button", { name: "Nöbet değişikliği yap" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("dialog[open]")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
});
