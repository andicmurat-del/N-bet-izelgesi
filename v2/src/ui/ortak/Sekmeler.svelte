<script lang="ts" generics="T extends string">
  // Sayfa içi görünüm seçici: alt çizgili sekmeler. Seçili sekme mavi ve altında 3 px çizgi; telefonda yatay kayar.
  import Ikon from "./Ikon.svelte";
  type Secenek = { ad: T; baslik: string; kisa?: string; ikon?: string };
  // telefonSutun: eski düzenden kalan seçenek (artık sekmeler telefonda yatay kayar)
  let { secenekler, secili = $bindable(), etiket }: { secenekler: readonly Secenek[]; secili: T; etiket: string; telefonSutun?: number } = $props();
</script>

<div class="sekmeler" role="tablist" aria-label={etiket}>
  {#each secenekler as s}
    <button role="tab" aria-selected={secili === s.ad} class:secili={secili === s.ad} onclick={() => (secili = s.ad)}>
      {#if s.ikon}<Ikon ad={s.ikon as any} boyut={16} />{/if}<span>{s.baslik}</span>
    </button>
  {/each}
</div>

<style>
  .sekmeler { display: flex; gap: var(--b1); margin-bottom: var(--b4); border-bottom: 1px solid var(--cizgi); overflow-x: auto; scrollbar-width: thin; }
  button { display: inline-flex; align-items: center; gap: 7px; min-height: 42px; padding: 0 16px; margin-bottom: -1px; border: 0; border-bottom: 3px solid transparent;
    border-radius: var(--r-kucuk) var(--r-kucuk) 0 0; background: transparent; color: var(--yazi-2); font-weight: 600; cursor: pointer; white-space: nowrap; flex: none; transition: background .14s, color .14s; }
  button:hover { color: var(--lacivert); background: var(--yuzey-2); }
  button.secili { color: var(--vurgu); border-bottom-color: var(--vurgu); background: transparent; }
  button :global(svg) { color: var(--soluk); }
  button.secili :global(svg) { color: var(--vurgu); }
</style>
