// Ekran (uçtan uca) testleri: derlenmiş uygulama (dist/index.html, yayımlanan dosyanın aynısı) yerel sunucuda açılır,
// gerçek tarayıcıda düğmelere basılır, indirilen PDF / Excel dosyaları denetlenir. Çalıştırma: npm run e2e
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: "http://localhost:4173", trace: "off", acceptDownloads: true, viewport: { width: 1400, height: 900 } },
  projects: [
    { name: "masaustu", testIgnore: /mobil\.spec/ },
    { name: "telefon", testMatch: /mobil\.spec/, use: { ...devices["iPhone 13"], browserName: "chromium" } },
  ],
  webServer: {
    command: "npx vite build && npx vite preview --port 4173 --strictPort",
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
