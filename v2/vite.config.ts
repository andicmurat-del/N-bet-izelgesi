import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { viteSingleFile } from "vite-plugin-singlefile";

// Çıktı tek bir HTML dosyası (dist/index.html): artifact olarak yayımlanır, dış dosya gerektirmez.
export default defineConfig({
  plugins: [svelte(), viteSingleFile()],
  worker: { format: "es" },
  build: { target: "es2022", assetsInlineLimit: 100_000_000 },
  test: { include: ["test/**/*.test.{js,ts}"], testTimeout: 600_000, pool: "threads" },
});
