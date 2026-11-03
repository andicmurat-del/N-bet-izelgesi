<script lang="ts">
  // Uzun açıklama ve kural metinleri: başlığa dokununca açılır, kapalı başlar (sayfanın üst kısmı listeye kalsın).
  import type { Snippet } from "svelte";
  import Ikon from "./Ikon.svelte";
  let { baslik = "Açıklama", children }: { baslik?: string; children: Snippet } = $props();
</script>

<details class="bilgi">
  <summary><Ikon ad="bilgi" boyut={16} />{baslik}</summary>
  <div class="metin">{@render children()}</div>
</details>

<style>
  .bilgi { max-width: 90ch; margin-bottom: var(--b3); font-size: var(--f-sm); }
  summary { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; cursor: pointer; color: var(--yazi-2); font-weight: 600; list-style: none; border-radius: var(--r-kucuk); }
  summary::-webkit-details-marker { display: none; }
  summary::after { content: ""; width: 6px; height: 6px; margin-left: 2px; border-right: 1.6px solid currentColor; border-bottom: 1.6px solid currentColor; transform: rotate(45deg) translateY(-2px); transition: transform .15s; }
  details[open] summary::after { transform: rotate(-135deg) translateY(-1px); }
  summary:hover { color: var(--yazi); }
  .metin { color: var(--soluk); padding: var(--b1) 0 0 22px; }
  .metin :global(p + p) { margin-top: var(--b2); }
</style>
