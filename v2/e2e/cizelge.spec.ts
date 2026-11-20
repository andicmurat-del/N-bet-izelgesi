// Günlük eczane nöbet listesi: PDF / Excel, çizelge oluşturma ve onay, elle gün düzeni, paylaşım.
import { test, expect, git, bas, menu, kayit, indir, pdfOku, excelMi, durum } from "./yardimci";

test("nöbet listesi PDF'i (takvim, gün listesi, kişi özeti) ve Excel", async ({ page, kur }) => {
  await kur();
  await git(page, "gunluk/nobet");
  const p = await indir(page, () => menu(page, "Dışa aktar", /^PDF$/));
  expect(p.ad).toBe("nobet-cizelgesi-2026-11.pdf");
  const { sayfa, metin } = await pdfOku(p.veri);
  expect(sayfa).toBe(3);
  expect(metin[0]).toContain("Kasım 2026 Nöbet Çizelgesi");
  expect(metin[0]).toContain("BORA KAYA");
  expect(metin[1]).toContain("01.11.2026");
  expect(metin[2]).toContain("AYŞE YILMAZ");
  const x = await indir(page, () => menu(page, "Dışa aktar", /^Excel$/));
  expect(excelMi(x.veri)).toBe(true);
});

test("çizelge oluşturulur (ilerleme çubuğuyla) ve onaylanır", async ({ page, kur }) => {
  const v = durum();
  v.schedules = {};
  await kur({ veri: v });
  await git(page, "gunluk/nobet");
  await bas(page, "Çizelgeyi oluştur");
  await expect(page.getByRole("progressbar", { name: "Arama ilerlemesi" })).toBeVisible();
  await expect.poll(async () => Object.keys((await kayit(page)).schedules).length, { timeout: 110_000 }).toBe(1);
  const c = (await kayit(page)).schedules["2026-10"];
  expect(c.days).toHaveLength(30);
  c.days.forEach((g: { assigned: unknown[] }) => expect(g.assigned).toHaveLength(2));
  await bas(page, /^Onayla$/);
  await page.locator("dialog[open] button", { hasText: /^Onayla$/ }).click();
  await expect.poll(async () => !!(await kayit(page)).schedules["2026-10"].onay).toBe(true);
});

test("tatil gününde 3 nöbetçi ve elle saat: kaydedilir, puantaja girer", async ({ page, kur }) => {
  await kur();
  await git(page, "gunluk/nobet");
  await bas(page, /^Liste$/);
  await page.locator("main tbody tr", { hasText: "14 Kasım" }).first().click();
  await bas(page, "Nöbet değişikliği yap");
  const d = page.locator("dialog[open]");
  await d.getByLabel("Nöbetçi sayısı").selectOption("3");
  await d.locator(".iki select").nth(2).selectOption({ label: "Selin Uçar · Tekniker" });
  await d.getByLabel("Nöbet fazla mesaisi (saat)").fill("20");
  await d.locator("button", { hasText: /Kaydet$/ }).click();
  if (await d.locator("button", { hasText: "Yine de kaydet" }).count()) await d.locator("button", { hasText: "Yine de kaydet" }).click();
  await expect
    .poll(async () => (await kayit(page)).schedules["2026-10"].days[13])
    .toMatchObject({ nobetSay: 3, fmNobet: 20, locked: true });
  await git(page, "gunluk/puantaj");
  // 14 Kasım Cumartesi: nöbet 24 + (20 − 24) = 20 saat
  await expect(page.getByRole("button", { name: /^20 · Hülya Koç, 14 Kasım/ })).toBeVisible();
});

test("paylaş: ayın listesi ve kişinin görevleri metin olarak", async ({ page, kur }) => {
  await kur();
  await git(page, "gunluk/nobet");
  await menu(page, "Dışa aktar", /^Paylaş$/);
  const t = page.locator("dialog[open] textarea");
  await expect(t).toHaveValue(
    /^\*Kasım 2026 Nöbet Listesi\* · Test Hastanesi \(taslak\)\n1 Paz\*: Bora Kaya, Selin Uçar · Haz\.: Cem Demir, Kaan Polat/,
  );
  await page.locator("dialog[open] select").selectOption({ label: "Ayşe Yılmaz · Eczacı" });
  await expect(t).toHaveValue(/• 4 Kasım Çarşamba: nöbet/);
  await expect(t).toHaveValue(/Toplam: 5 nöbet, 1 hazırlama, \d+ öğlen nöbeti$/);
});

test("zor ay: ek denemeler sürerken 'Burada dur' şimdiye kadarki en iyi çizelgeyi kaydeder", async ({ page, kur }) => {
  // kadronun yarısı ayın ortasında izinli: uyarısız çizelge yok, farklı başlangıçlarla yeniden aranır
  const v = durum();
  v.schedules = {};
  for (const k of v.staff.filter((s: { role: string }) => ["eczaci", "teknisyen"].includes(s.role)).slice(0, 8))
    for (let d = 8; d <= 22; d++) v.prefs[`${k.id}-2026-10-${d}`] = "izinli";
  // tek çekirdek gibi: denemeler sırayla çalışır, ilk arama bitince ek denemeler henüz sürüyordur (çok çekirdekte hepsi
  // aynı anda başlar; ek denemeler ilk aramadan önce biterse beklenecek bir şey kalmaz)
  await page.addInitScript(() => Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 1 }));
  await kur({ veri: v });
  await git(page, "gunluk/nobet");
  await bas(page, "Çizelgeyi oluştur");
  const dur = page.locator("main button", { hasText: "Burada dur" });
  await expect(dur).toBeVisible({ timeout: 110_000 });
  await expect(page.locator("main .ek-durum").first()).toContainText("deneme bitti");
  await dur.click();
  await expect.poll(async () => Object.keys((await kayit(page)).schedules).length, { timeout: 5_000 }).toBe(1);
  await expect(page.getByRole("progressbar", { name: "Arama ilerlemesi" })).toHaveCount(0);
});
