// Verinin korunması: yedek al / sil / önceki verilere dön / yedekten yükle, geri al ve yinele.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, expect, git, bas, kayit, indir } from "./yardimci";

test("yedek al, tümünü sil, önceki verilere dön, yedekten yükle", async ({ page, kur }) => {
  await kur();
  await git(page, "ayarlar/genel");
  const y = await indir(page, () => bas(page, /^Yedek al$/));
  const yedek = JSON.parse(y.veri.toString());
  expect(yedek.uygulama).toBe("nobet-cizelgesi-v2");
  await bas(page, "Tüm verileri sil"); await bas(page, "Evet, hepsini sil");
  await expect.poll(async () => (await kayit(page)).staff.length).toBe(0);
  await bas(page, "Önceki verilere dön");
  await expect.poll(async () => (await kayit(page)).staff.length).toBe(22);
  await bas(page, "Tüm verileri sil"); await bas(page, "Evet, hepsini sil");
  // dosya yolu ASCII olmalı: Playwright Türkçe harfli yoldaki dosyayı seçimde sessizce boş geçiyor
  const dosya = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "yedek-")), "yedek.json");
  fs.writeFileSync(dosya, y.veri);
  await page.locator('main input[type="file"]').setInputFiles(dosya);
  await expect.poll(async () => await kayit(page)).toEqual(yedek.veri);
  await page.reload();
  await expect.poll(async () => (await kayit(page)).staff.length).toBe(22);
});

test("geri al ve yinele (Ctrl+Z / Ctrl+Y)", async ({ page, kur }) => {
  await kur();
  await git(page, "gunluk/izinler");
  const hucre = page.getByRole("button", { name: /^Ece Çelik, 9 Kasım Pazartesi/ });
  await hucre.click();
  await expect.poll(async () => (await kayit(page)).prefs["5-2026-10-9"]).toBe("izinli");
  await page.waitForTimeout(500);
  await page.keyboard.press("Control+z");
  await expect.poll(async () => (await kayit(page)).prefs["5-2026-10-9"]).toBeUndefined();
  await page.keyboard.press("Control+y");
  await expect.poll(async () => (await kayit(page)).prefs["5-2026-10-9"]).toBe("izinli");
});
