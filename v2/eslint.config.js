// ESLint (düz yapılandırma): JavaScript ve TypeScript önerilen kuralları, Svelte bileşenleri. Biçim (girinti, satır
// uzunluğu) Prettier'in işidir; burada yalnız hata olabilecek yazımlar denetlenir. Çalıştırma: npm run lint
import js from "@eslint/js";
import ts from "typescript-eslint";
import svelte from "eslint-plugin-svelte";
import globals from "globals";
import svelteConfig from "./svelte.config.js";

export default ts.config(
  {
    ignores: [
      "dist/",
      "node_modules/",
      "coverage/",
      "playwright-report/",
      "test-results/",
      "test/eski/senaryolar.cjs",
      "masaustu/target/",
      "masaustu/gen/",
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      // kısa koşullu çağrılar (a && b()) ve virgüllü ifadeler bilinçli kullanılıyor
      "@typescript-eslint/no-unused-expressions": ["error", { allowShortCircuit: true, allowTernary: true }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }],
    },
  },
  {
    files: ["**/*.svelte", "**/*.svelte.ts"],
    languageOptions: { parserOptions: { projectService: false, extraFileExtensions: [".svelte"], parser: ts.parser, svelteConfig } },
    rules: {
      // $effect(() => { y; m; ... }): bağımlılığı okumak için yalın ifade (Svelte 5 kalıbı)
      "@typescript-eslint/no-unused-expressions": "off",
      // listeler küçük ve her değişiklikte baştan çizilir; anahtar, yinelenen kayıtta hata verdirir
      "svelte/require-each-key": "off",
      // Map / Set / Date yalnız hesap içinde geçici değişken; ekranın izlemesi gereken durum değil
      "svelte/prefer-svelte-reactivity": "off",
      // {" "}: biçimleyici satır kırarken boşluk kaybolmasın diye bilerek yazılır
      "svelte/no-useless-mustaches": "off",
    },
  },
  {
    // testler düz JavaScript; eski senaryo dosyaları CommonJS
    files: ["test/**/*.js", "scripts/**/*.js", "scripts/**/*.mjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
);
