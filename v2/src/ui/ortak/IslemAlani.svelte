<script lang="ts">
  // Alt sekmenin işlem düğmelerini sayfa başlığının işlem alanına taşır. Dış kap yerinde kalır (Svelte bloğun sınırını
  // ondan bilir); yalnız iç öğe taşınır ve bileşen kapanınca kaldırılır.
  import type { Snippet } from "svelte";
  import { tasi } from "./tasi";
  let { children }: { children: Snippet } = $props();
</script>

<div class="kap"><div class="islem-alani" use:tasi>{@render children()}</div></div>

<style>
  .kap { display: none; }
  .islem-alani { display: flex; flex-wrap: wrap; gap: var(--b2); align-items: center; }
</style>
