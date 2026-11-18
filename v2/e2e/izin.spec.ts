// İzin girilince "yerine kim" ve resmi tatillerin kendiliğinden işaretlenmesi.
import { test, expect, git, bas, kayit, durum } from "./yardimci";

test("çizelgeden sonra izinli işaretlenen görevlinin yerine yazılır", async ({ page, kur }) => {
  await kur();
  await git(page, "gunluk/izinler");
  // 21 Kasım'da Dila'nın eş durumu "nöbetçi olsun" işaretli; "İzinli" aracı onun yerine izin yazar
  await page.getByRole("button", { name: /^Dila Şahin, 21 Kasım Cumartesi/ }).click();
  const panel = page.locator("section.izinli");
  await expect(panel).toContainText("21 Kasım Cumartesi · nöbet · Dila Şahin (izinli)");
  await panel.locator("button", { hasText: "Yerine yaz" }).first().click();
  await expect(panel).toHaveCount(0);
  const v = await kayit(page);
  expect(v.schedules["2026-10"].days[20].assigned.map((p: { id: number }) => p.id)).not.toContain(4);
  expect(v.degisimler).toHaveLength(1);
  expect(v.degisimler[0]).toMatchObject({ cik: 4, gun: 21, zorunlu: true, sebep: "YI" });
});

test("resmi tatiller yıl ilk açılınca kendiliğinden işaretlenir", async ({ page, kur }) => {
  const v = durum(); v.manualTatil = {}; v.arife = {}; delete v.tatilYillari;
  await kur({ veri: v });
  await page.getByRole("button", { name: "Sonraki ay" }).click();
  await page.getByRole("button", { name: "Sonraki ay" }).click();
  await expect.poll(async () => (await kayit(page)).tatilYillari).toMatchObject({ "2026": true, "2027": true });
  const k = await kayit(page);
  for (const g of ["2027-0-1", "2027-2-9", "2027-2-10", "2027-2-11", "2027-4-16", "2027-4-19", "2027-9-29"]) expect(k.manualTatil[g]).toBe(true);
  expect(k.arife["2027-2-8"]).toBe(true);
  expect(k.arife["2027-4-15"]).toBeUndefined();   // Kurban arifesi Cumartesi: mesai yok
  await git(page, "gunluk/izinler");
  await bas(page, "Resmi tatil ve arife");
  await expect(page.locator(".tatil-liste li").first()).toContainText("Yılbaşı");
});
