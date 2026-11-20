// Kesin kontrol (geliştirme aracı) için ayrı yapılandırma: npm test'e girmez (yavaş). npm run kesin-kontrol
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["arac/kesin/**/*.test.js"],
    testTimeout: 3_600_000,
    fileParallelism: false,
  },
});
