// Ekran testlerinin ortak hazırlığı: örnek veri (e2e/veri/durum.json: 22 kişi, Kasım 2026 nöbet çizelgesi, acil
// listesi, onay listesi ve öğlen haftaları, servis dağıtımı), sabit tarih (17 Kasım 2026), sayfa hatalarının toplanması,
// indirilen dosyaların okunması (PDF metni ve sayfa sayısı).
import { test as temel, expect, type Page, type Download } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

export const DURUM = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "veri/durum.json"), "utf8"));
export const ANAHTAR = "nobet-cizelgesi-v2";
/** örnek verinin bir kopyası (testte değiştirilebilir) */
export const durum = () => JSON.parse(JSON.stringify(DURUM));

type Kurulum = { veri?: unknown; tarih?: string };
/** her test: sayfa hataları (yakalanmayan hata, konsol hatası) test sonunda boş olmalı */
export const test = temel.extend<{ hatalar: string[]; kur: (k?: Kurulum) => Promise<void> }>({
  hatalar: async ({ page }, use) => {
    const l: string[] = [];
    page.on("pageerror", e => l.push("sayfa hatası: " + e.message));
    page.on("console", m => { if (m.type() === "error") l.push("konsol: " + m.text()); });
    await use(l);
    expect(l, "sayfada hata çıkmamalı").toEqual([]);
  },
  kur: async ({ page, hatalar }, use) => {
    void hatalar;
    await use(async (k: Kurulum = {}) => {
      // tarih sabit: öğlen onarımı, yedek hatırlatması ve açılış ayı her gün aynı davransın
      await page.clock.setFixedTime(new Date(k.tarih ?? "2026-11-17T09:00:00"));
      await page.addInitScript(([anahtar, v]) => {
        if (sessionStorage.getItem("e2e-kuruldu")) return;
        sessionStorage.setItem("e2e-kuruldu", "1");
        if (v) localStorage.setItem(anahtar, v);
        localStorage.setItem(anahtar + "-yedek", JSON.stringify({ son: Date.now() }));   // yedek hatırlatması çıkmasın
      }, [ANAHTAR, k.veri === null ? "" : JSON.stringify(k.veri ?? DURUM)] as const);
      await page.goto("/");
      await expect(page.locator("main")).toBeVisible();
    });
  },
});
export { expect };

/** sayfa içi adrese gider (#gunluk/nobet gibi) */
export async function git(page: Page, adres: string) {
  await page.evaluate(a => (location.hash = a), adres);
  await page.waitForTimeout(250);
}
/** main içinde yazısı eşleşen ilk etkin düğmeye basar */
export async function bas(page: Page, yazi: string | RegExp, kok = "main") {
  await page.locator(`${kok} button:not([disabled])`, { hasText: yazi }).first().click();
}
/** tarayıcıya kaydedilen veri (kayıt 150 ms gecikmeli yazılır) */
export async function kayit(page: Page) {
  await page.waitForTimeout(400);
  return page.evaluate(a => JSON.parse(localStorage.getItem(a) || "null"), ANAHTAR);
}
/** düğmeye basıp indirilen dosyayı alır */
export async function indir(page: Page, tetik: () => Promise<unknown>): Promise<{ ad: string; veri: Buffer }> {
  const [d] = await Promise.all([page.waitForEvent("download"), tetik()]) as [Download, unknown];
  const yol = await d.path();
  return { ad: d.suggestedFilename(), veri: fs.readFileSync(yol!) };
}
/** PDF: sayfa sayısı ve sayfa sayfa metin */
export async function pdfOku(veri: Buffer): Promise<{ sayfa: number; metin: string[] }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(veri), useSystemFonts: false, disableFontFace: true }).promise;
  const metin: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const s = await doc.getPage(i), t = await s.getTextContent();
    metin.push(t.items.map(x => ("str" in x ? x.str : "")).join(" ").replace(/\s+/g, " "));
  }
  return { sayfa: doc.numPages, metin };
}
/** Excel dosyası (zip) mı */
export const excelMi = (b: Buffer) => b.subarray(0, 2).toString() === "PK" && b.includes(Buffer.from("xl/workbook.xml"));
