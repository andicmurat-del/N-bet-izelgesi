<script lang="ts">
  // Ekranın ortasında açılan pencere (<dialog>): Esc ve dışarı tıklama kapatır, odak pencerede kalır.
  import type { Snippet } from "svelte";
  import Ikon from "./Ikon.svelte";
  let { acik = $bindable(false), baslik, altBaslik = "", genis = false, children, altlik }: {
    acik?: boolean; baslik: string; altBaslik?: string; genis?: boolean; children: Snippet; altlik?: Snippet;
  } = $props();
  let dlg: HTMLDialogElement;
  $effect(() => {
    if (!dlg) return;
    if (acik && !dlg.open) dlg.showModal();
    if (!acik && dlg.open) dlg.close();
  });
</script>

<dialog bind:this={dlg} class:genis onclose={() => (acik = false)} onclick={e => { if (e.target === dlg) acik = false; }} aria-labelledby="pencere-baslik">
  {#if acik}
    <div class="ic">
      <header>
        <div>
          <h2 id="pencere-baslik">{baslik}</h2>
          {#if altBaslik}<p class="alt">{altBaslik}</p>{/if}
        </div>
        <button class="dugme sade kapat" onclick={() => (acik = false)} aria-label="Kapat"><Ikon ad="kapat" /></button>
      </header>
      <div class="govde">{@render children()}</div>
      {#if altlik}<footer>{@render altlik()}</footer>{/if}
    </div>
  {/if}
</dialog>

<style>
  dialog { padding: 0; border: 1px solid var(--cizgi); border-radius: var(--r-buyuk); background: var(--yuzey); color: var(--yazi); width: min(560px, calc(100vw - 24px)); max-height: calc(100dvh - 32px); box-shadow: 0 20px 60px rgba(0,0,0,.25); }
  dialog.genis { width: min(820px, calc(100vw - 24px)); }
  dialog::backdrop { background: var(--perde); }
  .ic { display: flex; flex-direction: column; max-height: calc(100dvh - 34px); }
  header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--b3); padding: var(--b4) var(--b4) var(--b3) var(--b5); border-bottom: 1px solid var(--cizgi-acik); }
  h2 { font-size: var(--f-xl); }
  .alt { color: var(--soluk); font-size: var(--f-sm); margin-top: 2px; }
  .kapat { min-height: 36px; width: 36px; padding: 0; }
  .govde { padding: var(--b4) var(--b5); overflow-y: auto; display: grid; gap: var(--b4); }
  footer { display: flex; flex-wrap: wrap; gap: var(--b2); justify-content: flex-end; padding: var(--b3) var(--b5) var(--b4); border-top: 1px solid var(--cizgi-acik); }
  @media (max-width: 560px) { .govde { padding: var(--b4); } header { padding-left: var(--b4); } footer { padding-inline: var(--b4); } }
</style>
