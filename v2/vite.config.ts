import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { viteSingleFile } from "vite-plugin-singlefile";
import { build, type Plugin } from "vite";

// Çıktı paketi (PDF / Excel: jsPDF ve gömülü yazı tipi) ayrı derlenir; ilk çıktı isteğinde çalıştırılır
// (src/disa/yukle.ts). Derlemede HTML'e çalıştırılmayan bir <script type="text/plain"> olarak eklenir: tarayıcı açılışta
// bu yarım MB'lık kodu ne çözümler ne de ana betiğin içinde dizgi olarak taşır. Geliştirme sunucusunda metin olarak
// içe aktarılır.
function ciktiPaketi(): Plugin {
  const ID = "virtual:cikti-paketi", RID = "\0" + ID;
  let derleme = false, kod = "";
  return {
    name: "cikti-paketi",
    configResolved: c => { derleme = c.command === "build"; },
    resolveId: id => (id === ID ? RID : null),
    async load(id) {
      if (id !== RID) return null;
      const r = await build({
        configFile: false, logLevel: "warn",
        build: {
          write: false, target: "es2022", assetsInlineLimit: 100_000_000, minify: true,
          lib: { entry: new URL("./src/disa/paket.ts", import.meta.url).pathname, formats: ["iife"], name: "__ciktiPaketi", fileName: () => "cikti.js" },
          rollupOptions: { external: ["html2canvas", "dompurify", "canvg"], output: { globals: { html2canvas: "html2canvas", dompurify: "DOMPurify", canvg: "canvg" } } },
        },
      });
      const cikti = (Array.isArray(r) ? r[0] : r) as { output: { type: string; code?: string }[] };
      // HTML içine gömüleceği için "</script" kaçırılır (JS'de <\/script aynı anlama gelir)
      kod = cikti.output.find(o => o.type === "chunk")!.code!.replace(/<\/(script)/gi, "<\\/$1");
      return "export default " + JSON.stringify(derleme ? "" : kod);
    },
    transformIndexHtml: {
      order: "post",
      handler: html => (derleme && kod ? html.replace("</body>", () => `<script type="text/plain" id="cikti-paketi">${kod}</script></body>`) : html),
    },
  };
}

// Çıktı tek bir HTML dosyası (dist/index.html): artifact olarak yayımlanır, dış dosya gerektirmez.
export default defineConfig({
  plugins: [svelte(), ciktiPaketi(), viteSingleFile()],
  worker: { format: "es" },
  build: {
    target: "es2022",
    assetsInlineLimit: 100_000_000,
    // jsPDF'in isteğe bağlı eklentileri (HTML'den görüntü, SVG) kullanılmıyor; pakete girmesin
    rollupOptions: { external: ["html2canvas", "dompurify", "canvg"] },
  },
  test: { include: ["test/**/*.test.{js,ts}"], testTimeout: 600_000, pool: "threads" },
});
