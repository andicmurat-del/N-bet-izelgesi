// Kullanım kolaylığı: işlem menüleri ve silme sorusu, "Bu ay yapılacaklar", uyarıdan güne geçiş, onaylı ayda gün
// penceresinden nöbet değişimine geçiş, izinlerde aralık seçimi, kişi takvimi.
import { test, expect, git, bas, menu, kayit, indir, durum } from "./yardimci";

test("Diğer > Çizelgeyi sil: önce sorar; Vazgeç korur, Evet siler", async ({ page, kur }) => {
  await kur();
  await git(page, "gunluk/nobet");
  await menu(page, "Diğer", "Çizelgeyi sil");
  const soru = page.getByRole("alert").filter({ hasText: "silinsin mi" });
  await expect(soru).toBeVisible();
  await soru.getByRole("button", { name: "Vazgeç" }).click();
  await expect(soru).toHaveCount(0);
  expect((await kayit(page)).schedules["2026-10"]).toBeTruthy();
  await menu(page, "Diğer", "Çizelgeyi sil");
  await page.getByRole("alert").getByRole("button", { name: "Evet, sil" }).click();
  expect((await kayit(page)).schedules["2026-10"]).toBeUndefined();
  await expect(page.locator("main button", { hasText: "Çizelgeyi oluştur" })).toBeVisible();
});

test("bu ay yapılacaklar: durumlar, adımdan sekmeye geçiş, çıktı alınınca tamam", async ({ page, kur }) => {
  await kur();
  await git(page, "gunluk/nobet");
  const kutu = page.getByRole("region", { name: "Bu ay yapılacaklar" });
  await expect(kutu).toContainText("3/7");
  await expect(kutu.getByRole("button", { name: /^Nöbet çizelgesi Taslak: onay bekliyor \(başlandı\)$/ })).toBeVisible();
  await kutu.getByRole("button", { name: /^Öğlen nöbeti / }).click();
  await expect(page.locator("h1")).toHaveText("Öğlen Nöbet Listesi");
  await page.getByRole("tab", { name: "Nöbet Listesi", exact: true }).click();
  await indir(page, () => menu(page, "Dışa aktar", /^PDF$/));
  await expect(kutu).toContainText("4/7");
  await expect(kutu.getByRole("button", { name: /^Çıktı .*\(tamam\)$/ })).toBeVisible();
  // gizlenince tek satır kalır ve hatırlanır
  await kutu.getByRole("button", { name: "Gizle" }).click();
  await page.reload();
  await expect(page.getByRole("region", { name: "Bu ay yapılacaklar" }).getByRole("button", { name: "Adımları göster" })).toBeVisible();
});

test("kural uyarısındaki güne dokununca o gün seçilir", async ({ page, kur }) => {
  const v = durum();
  v.schedules["2026-10"].days[9].assigned = v.schedules["2026-10"].days[9].assigned.slice(0, 1);
  await kur({ veri: v });
  await git(page, "gunluk/nobet");
  const uyari = page.locator(".kutu", { hasText: "Eksik nöbetçi" });
  await expect(uyari.locator("details")).not.toHaveAttribute("open", "");
  await uyari.getByRole("button", { name: "10" }).click();
  await expect(page.locator("aside .secili-gun")).toContainText("10 Kasım Salı");
});

test("onaylı ayda gün penceresinden nöbet değişimine geçilir (görev seçili gelir)", async ({ page, kur }) => {
  const v = durum();
  v.schedules["2026-10"].onay = { zaman: Date.parse("2026-11-01T10:00:00"), kim: "Test" };
  await kur({ veri: v });
  await git(page, "gunluk/nobet");
  await page.locator("main tbody tr", { hasText: "14 Kasım" }).first().click();
  await bas(page, "Günü görüntüle");
  const d = page.locator("dialog[open]");
  await d.locator("li", { hasText: "Hülya Koç" }).getByRole("button", { name: "Değişim yap" }).click();
  await expect(page.locator("h1")).toHaveText("Puantaj Cetveli");
  await expect(page.locator(".secili-gorev")).toContainText("14 Kasım Cumartesi · nöbet");
  await expect(page.locator(".secili-gorev")).toContainText("Hülya Koç");
});

test("izinlerde aralık seçimi: başlangıç ve bitiş gününe dokununca aradaki günler işaretlenir", async ({ page, kur }) => {
  await kur();
  await git(page, "gunluk/izinler");
  await bas(page, "Aralık seç");
  await page.getByRole("button", { name: /^Dila Şahin, 3 Kasım/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "bitiş gününe dokunun" })).toBeVisible();
  await page.getByRole("button", { name: /^Dila Şahin, 6 Kasım/ }).click();
  const prefs = (await kayit(page)).prefs;
  for (const g of [3, 4, 5, 6]) expect(prefs["4-2026-10-" + g], g + " Kasım").toBe("izinli");
  expect(prefs["4-2026-10-7"]).not.toBe("izinli");
});

test("kişi takvimi: seçilen kişinin bütün görevleri ve sayıları", async ({ page, kur }) => {
  await kur();
  await git(page, "gunluk/kisi");
  await page.getByLabel("Kişi", { exact: true }).selectOption({ label: "Hülya Koç · Kemoterapi eczacısı" });
  const takvim = page.getByRole("group", { name: /^Hülya Koç, Kasım 2026/ });
  await expect(takvim.getByRole("group", { name: /^14 Kasım Cumartesi: Nöbet/ })).toBeVisible();
  await expect(page.locator(".ozet")).toContainText("5 nöbet");
});

test("değişiklik geçmişi: kim, ne zaman, ne değişti; günlük kopyaya dönüş", async ({ page, kur }) => {
  await kur();
  await git(page, "ayarlar/gecmis");
  await page.getByLabel("Bu cihazda değişiklik yapan").fill("Test Kullanıcı");
  await page.getByLabel("Bu cihazda değişiklik yapan").blur();
  // bir izin işareti ve çizelgenin silinmesi
  await git(page, "gunluk/izinler");
  await page.getByRole("button", { name: /^Dila Şahin, 3 Kasım/ }).click();
  await git(page, "gunluk/nobet");
  await menu(page, "Diğer", "Çizelgeyi sil");
  await page.getByRole("alert").getByRole("button", { name: "Evet, sil" }).click();
  expect((await kayit(page)).schedules["2026-10"]).toBeUndefined();
  await git(page, "ayarlar/gecmis");
  const liste = page.locator("ol.kayitlar");
  await expect(liste).toContainText("Kasım 2026 nöbet çizelgesi silindi");
  await expect(liste).toContainText("İzin ve tercih işaretleri (Kasım 2026: 1)");
  await expect(liste.locator("li").first()).toContainText("Test Kullanıcı");
  // günün ilk değişikliğinden önceki hâl kopyalanmıştı: ona dönülünce çizelge geri gelir
  await page.locator("ul.kopyalar li").first().getByRole("button", { name: "Bu kopyaya dön" }).click();
  await page.getByRole("button", { name: "Evet, dön" }).click();
  expect((await kayit(page)).schedules["2026-10"]).toBeTruthy();
  await expect(liste).toContainText("Yedekten / kopyadan yükleme");
});
