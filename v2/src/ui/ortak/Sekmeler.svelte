<script lang="ts" generics="T extends string">
  // Sayfa içi görünüm seçici (sekme çubuğu). Telefonda eşit genişlikte; varsa kısa adlar gösterilir.
  import Ikon from "./Ikon.svelte";
  type Secenek = { ad: T; baslik: string; kisa?: string; ikon?: string };
  // telefonSutun: uzun adlı sekmeler telefonda kaç sütunda dizilsin (varsayılan: hepsi tek satırda)
  let { secenekler, secili = $bindable(), etiket, telefonSutun }: { secenekler: readonly Secenek[]; secili: T; etiket: string; telefonSutun?: number } = $props();
</script>

<div class="sekmeler" role="tablist" aria-label={etiket} style="--n:{telefonSutun ?? secenekler.length}" class:sarili={!!telefonSutun}>
  {#each secenekler as s}
    <button role="tab" aria-label={s.baslik} aria-selected={secili === s.ad} class:secili={secili === s.ad} onclick={() => (secili = s.ad)}>
      {#if s.ikon}<Ikon ad={s.ikon as any} boyut={16} />{/if}<span class="uzun">{s.baslik}</span><span class="kisa">{s.kisa ?? s.baslik}</span>
    </button>
  {/each}
</div>

<style>
  .sekmeler { display: inline-flex; gap: 2px; padding: 3px; margin-bottom: var(--b4); background: var(--yuzey); border: 1px solid var(--cizgi); border-radius: var(--r); max-width: 100%; overflow-x: auto; }
  button { display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 0 var(--b3); border: 0; border-radius: var(--r-kucuk); background: transparent; color: var(--yazi-2); font-weight: 500; cursor: pointer; white-space: nowrap; }
  button:hover { color: var(--yazi); background: var(--yuzey-2); }
  button.secili { background: var(--vurgu-zemin); color: var(--vurgu); font-weight: 600; }
  .kisa { display: none; }
  @media (max-width: 720px) {
    .sekmeler { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); width: 100%; }
    button { justify-content: center; padding: 0 var(--b2); }
    .uzun { display: none; } .kisa { display: inline; }
    .sarili button { justify-content: flex-start; white-space: normal; text-align: left; line-height: 1.2; padding: 6px var(--b2); font-size: var(--f-sm); }
  }
</style>
