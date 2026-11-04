<script lang="ts" generics="T extends string">
  // Sayfa içi görünüm seçici: klasör tipi sekmeler. Pasifler gri zeminli, seçili olan beyaz ve üstünde 3 px lacivert
  // çizgi; telefonda yatay kayar.
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
  .sekmeler { display: flex; gap: 2px; margin-bottom: var(--b4); border-bottom: 1px solid var(--cizgi); overflow-x: auto; scrollbar-width: thin; }
  button { display: inline-flex; align-items: center; gap: 6px; min-height: 38px; padding: 0 14px; margin-bottom: -1px; border: 1px solid var(--cizgi); border-bottom-color: var(--cizgi); border-top: 3px solid transparent;
    border-radius: var(--r) var(--r) 0 0; background: var(--panel-bas); color: var(--yazi-2); font-weight: 600; cursor: pointer; white-space: nowrap; flex: none; }
  button:hover { color: var(--lacivert); background: var(--tablo-bas); }
  button.secili { background: var(--yuzey); color: var(--lacivert); border-top-color: var(--lacivert); border-bottom-color: var(--yuzey); }
  button :global(svg) { color: var(--soluk); }
  button.secili :global(svg) { color: var(--lacivert); }
</style>
