<script lang="ts">
  // Sayfa başlığı: konum satırı ("Ana sayfa › Günlük Eczane › Puantaj"), 24 px lacivert başlık, açıklama satırı ve
  // sağda işlem düğmeleri; altında 2 px lacivert çizgi. Alt sekmeler kendi düğmelerini başlığın işlem alanına taşır
  // (bkz. tasi.ts); bu yüzden işlem alanının kimliği sabittir.
  import type { Snippet } from "svelte";
  let { konum, baslik, aciklama = "", islemler }: { konum: string[]; baslik: string; aciklama?: string; islemler?: Snippet } = $props();
</script>

<header class="sayfa-basligi">
  <nav class="konum" aria-label="Konum"><span>Ana sayfa</span>{#each konum as k}<span class="ayrac" aria-hidden="true">›</span><span>{k}</span>{/each}</nav>
  <div class="satir">
    <div class="metin">
      <h1>{baslik}</h1>
      {#if aciklama}<p>{aciklama}</p>{/if}
    </div>
    <div class="islemler" id="sayfa-islemleri">{@render islemler?.()}</div>
  </div>
</header>

<style>
  .sayfa-basligi { display: grid; gap: 4px; padding-bottom: 12px; margin-bottom: var(--b4); border-bottom: 2px solid var(--lacivert); }
  .konum { display: flex; flex-wrap: wrap; gap: 6px; font-size: var(--f-xs); color: var(--yazi-2); }
  .konum span:last-child { color: var(--lacivert); font-weight: 600; }
  .ayrac { color: var(--soluk); }
  .satir { display: flex; align-items: flex-end; justify-content: space-between; gap: var(--b3) var(--b4); flex-wrap: wrap; }
  .metin { min-width: 0; max-width: 80ch; }
  h1 { font-size: 24px; font-weight: 700; color: var(--lacivert); }
  p { font-size: var(--f-sm); color: var(--yazi-2); margin-top: 2px; }
  .islemler { display: flex; flex-wrap: wrap; gap: var(--b2); align-items: center; }
  .islemler:empty { display: none; }
  .islemler :global(.islem-alani) { display: contents; }
</style>
