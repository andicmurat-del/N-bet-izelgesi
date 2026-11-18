<script lang="ts" module>
  import type { IkonAdi } from "./Ikon.svelte";
  /** menüdeki bir seçenek */
  export interface MenuOgesi {
    yazi: string;
    tikla: () => void;
    ikon?: IkonAdi;
    /** fare üstünde açıklama */
    baslik?: string;
    devreDisi?: boolean;
    /** silme gibi geri dönüşü zor işlem (kırmızı) */
    tehlike?: boolean;
  }
</script>

<script lang="ts">
  // Açılır menü: seyrek kullanılan işlemler tek düğmenin altında toplanır (ör. Dışa aktar: PDF, Excel, Paylaş).
  // Dışına dokununca, Escape ile ya da bir seçenek seçilince kapanır; ok tuşlarıyla seçenekler arasında gezilir.
  import Ikon from "./Ikon.svelte";

  let { etiket, ikon, ogeler, devreDisi = false }: { etiket: string; ikon?: IkonAdi; ogeler: MenuOgesi[]; devreDisi?: boolean } = $props();
  let acik = $state(false);
  let kok: HTMLDivElement | undefined = $state();
  const kimlik = "menu-" + Math.random().toString(36).slice(2, 9);

  function ac() {
    acik = !acik;
    if (acik) queueMicrotask(() => kok?.querySelector<HTMLButtonElement>("[role=menuitem]:not(:disabled)")?.focus());
  }
  function sec(o: MenuOgesi) {
    acik = false;
    o.tikla();
  }
  function tus(e: KeyboardEvent) {
    if (!acik) return;
    if (e.key === "Escape") {
      acik = false;
      kok?.querySelector<HTMLButtonElement>("button[aria-haspopup]")?.focus();
      e.stopPropagation();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const l = [...(kok?.querySelectorAll<HTMLButtonElement>("[role=menuitem]:not(:disabled)") ?? [])];
    const i = l.indexOf(document.activeElement as HTMLButtonElement);
    l[(i + (e.key === "ArrowDown" ? 1 : -1) + l.length) % l.length]?.focus();
  }
  $effect(() => {
    if (!acik) return;
    const disari = (e: PointerEvent) => {
      if (kok && !kok.contains(e.target as Node)) acik = false;
    };
    document.addEventListener("pointerdown", disari);
    return () => document.removeEventListener("pointerdown", disari);
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions (tuşlar menünün kendisinde dinlenir) -->
<div class="menu" bind:this={kok} onkeydown={tus}>
  <button class="dugme" aria-haspopup="menu" aria-expanded={acik} aria-controls={kimlik} disabled={devreDisi} onclick={ac}>
    {#if ikon}<Ikon ad={ikon} />{/if}{etiket}<svg class="ok" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
  </button>
  {#if acik}
    <div class="liste" role="menu" id={kimlik} aria-label={etiket}>
      {#each ogeler as o}
        <button role="menuitem" class:tehlike={o.tehlike} disabled={o.devreDisi} title={o.baslik} onclick={() => sec(o)}>
          {#if o.ikon}<Ikon ad={o.ikon} boyut={16} />{/if}{o.yazi}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .menu {
    position: relative;
    display: inline-flex;
  }
  .ok {
    width: 16px;
    height: 16px;
    margin-right: -4px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
  }
  .liste {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    z-index: 30;
    min-width: 200px;
    max-width: min(320px, calc(100vw - 24px));
    display: grid;
    padding: 4px;
    background: var(--yuzey);
    border: 1px solid var(--cizgi);
    border-radius: var(--r);
    box-shadow:
      0 12px 28px -10px rgba(10, 52, 62, 0.32),
      0 1px 3px rgba(10, 52, 62, 0.08);
  }
  .liste button {
    display: flex;
    align-items: center;
    gap: var(--b2);
    min-height: 38px;
    padding: 0 var(--b3);
    border: 0;
    border-radius: var(--r-kucuk);
    background: transparent;
    color: var(--yazi);
    font: inherit;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
  }
  .liste button:hover:not(:disabled),
  .liste button:focus-visible {
    background: var(--vurgu-zemin);
    outline: none;
  }
  .liste button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .liste button.tehlike {
    color: var(--hata);
  }
  .liste button.tehlike:hover:not(:disabled) {
    background: var(--hata-zemin);
  }
</style>
