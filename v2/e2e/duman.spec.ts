// Duman testi: her görünümde (en çok 25) farklı düğmeye basılır, açılan pencere kapatılır; sayfada hata çıkmamalı.
// Silme, yükleme ve uzun süren çizelge oluşturma düğmeleri atlanır (onlar kendi testlerinde).
import { test, git } from "./yardimci";

const ATLA = /^(Yedek al|Yarın hatırlat|Yedekten yükle|Tüm verileri sil|Evet|Sil|Çizelgeyi oluştur|Yeniden oluştur|Farklı dağılım|Nöbet Listesi|Aylık Çalışma Listesi|Öğlen Nöbet Listesi|Onay Listesi|Hazırlama Listesi|Puantaj|İzinler|Raporlar|Genel|Personel|Kurallar|Yardım)$/;
const GORUNUMLER = ["gunluk/nobet", "gunluk/liste", "gunluk/oglen", "gunluk/onay", "gunluk/hazirlama", "gunluk/puantaj", "gunluk/izinler", "gunluk/raporlar",
  "acil/acil", "acil/puantaj", "acil/izinler", "acil/raporlar", "ayarlar/genel", "ayarlar/personel", "ayarlar/kurallar", "ayarlar/yardim"];

for (const g of GORUNUMLER) test("düğmeler: " + g, async ({ page, kur }) => {
  await kur();
  await git(page, g);
  const yazilar = await page.$$eval("main button:not([disabled])", l => l.map(b => (b.textContent || b.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ")));
  const secilen = [...new Set(yazilar)].filter(t => t && !ATLA.test(t)).slice(0, 25);
  for (const t of secilen) {
    if (await page.locator("dialog[open]").count()) await page.keyboard.press("Escape");
    await git(page, g);
    const d = page.locator("main button:not([disabled])").filter({ hasText: t }).first();
    if (!(await d.count()) || !(await d.isVisible())) continue;
    await d.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(150);
  }
  if (await page.locator("dialog[open]").count()) await page.keyboard.press("Escape");
});
