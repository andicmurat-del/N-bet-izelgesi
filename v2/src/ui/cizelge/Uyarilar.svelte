<script lang="ts">
  import { uyariSiniflandir } from "../../motor/cizelge.js";
  import Ikon from "../ortak/Ikon.svelte";
  let { metinler }: { metinler: string[] } = $props();
  const SIRA = { hata: 0, uyari: 1, bilgi: 2 } as const;
  const AD = { hata: "Kural sağlanamadı", uyari: "Dikkat", bilgi: "Bilgi" } as const;
  const liste = $derived(metinler.map(t => ({ t, ...uyariSiniflandir(t) as { seviye: "hata" | "uyari" | "bilgi"; baslik: string } })).sort((a, b) => SIRA[a.seviye] - SIRA[b.seviye]));
</script>

{#if liste.length}
  <section class="uyarilar" aria-label="Uyarılar">
    {#each liste as u}
      <details class="uyari {u.seviye}" open={u.seviye === "hata"}>
        <summary>
          <span class="simge"><Ikon ad={u.seviye === "bilgi" ? "tamam" : "uyari"} boyut={16} /></span>
          <b>{u.baslik}</b>
          <span class="rozet {u.seviye === 'hata' ? 'hata' : u.seviye === 'uyari' ? 'dikkat' : 'bilgi'}">{AD[u.seviye]}</span>
        </summary>
        <p>{u.t}</p>
      </details>
    {/each}
  </section>
{/if}

<style>
  .uyarilar { display: grid; gap: var(--b2); }
  .uyari { border: 1px solid var(--cizgi); border-left-width: 4px; border-radius: var(--r-kucuk); background: var(--yuzey); }
  .uyari.hata { border-left-color: var(--hata); }
  .uyari.uyari { border-left-color: var(--dikkat); }
  .uyari.bilgi { border-left-color: var(--bilgi); }
  summary { display: flex; align-items: center; gap: var(--b2); padding: var(--b2) var(--b3); cursor: pointer; list-style: none; min-height: 40px; }
  summary::-webkit-details-marker { display: none; }
  summary b { flex: 1; font-weight: 600; font-size: var(--f-sm); }
  .simge { display: inline-flex; }
  .hata .simge { color: var(--hata); } .uyari .simge { color: var(--dikkat); } .bilgi .simge { color: var(--bilgi); }
  p { padding: 0 var(--b3) var(--b3) 36px; font-size: var(--f-sm); color: var(--yazi-2); }
</style>
