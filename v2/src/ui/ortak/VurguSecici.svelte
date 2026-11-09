<script lang="ts">
  // Kişiyi vurgula: seçilen kişinin günleri takvimde / listede işaretlenir (Nöbet Listesi ve Acil Eczane Nöbet Listesi).
  import Ikon from "./Ikon.svelte";
  let { kisiler, vurgu = $bindable(null) }: { kisiler: readonly { id: number; name: string }[]; vurgu?: number | null } = $props();
</script>

<label class="vurgu-sec" class:aktif={vurgu !== null}><Ikon ad="kisiler" boyut={15} />
  <select value={vurgu === null ? "" : String(vurgu)} onchange={e => (vurgu = e.currentTarget.value ? Number(e.currentTarget.value) : null)} aria-label="Kişiyi vurgula">
    <option value="">Kişiyi vurgula</option>{#each kisiler as k (k.id)}<option value={String(k.id)}>{k.name}</option>{/each}
  </select>
  {#if vurgu !== null}<button type="button" class="vurgu-x" onclick={() => (vurgu = null)} aria-label="Vurgulamayı kaldır">×</button>{/if}
</label>

<style>
  .vurgu-sec { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; padding: 0 4px 0 8px; min-height: 34px; border: 1px solid var(--cizgi); border-radius: var(--r-kucuk); background: var(--yuzey); color: var(--yazi-2); }
  .vurgu-sec.aktif { border-color: var(--altin); box-shadow: inset 0 0 0 1px var(--altin); color: var(--yazi); }
  select { border: 0; background: transparent; font: inherit; font-size: var(--f-sm); color: inherit; min-height: 32px; max-width: 180px; cursor: pointer; }
  select:focus-visible { outline: 2px solid var(--odak); outline-offset: 1px; }
  .vurgu-x { border: 0; background: transparent; font-size: 18px; line-height: 1; width: 28px; height: 28px; cursor: pointer; color: var(--yazi-2); border-radius: 50%; }
  .vurgu-x:hover { background: var(--yuzey-2); }
</style>
