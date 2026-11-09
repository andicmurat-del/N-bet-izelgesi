<script lang="ts">
  // Servis hazırlama: teknikerlerin günlük servis dağıtımı ve servis listesi ayarları.
  import GunlukDagitim from "../hazirlama/GunlukDagitim.svelte";
  import ServisAyarlari from "../hazirlama/ServisAyarlari.svelte";

  let { git }: { git: (ad: "cizelge" | "kisiler") => void } = $props();
  const GORUNUMLER = [{ ad: "gun", baslik: "Günlük dağıtım", kisa: "Dağıtım", ikon: "katman" }, { ad: "servis", baslik: "Servisler", ikon: "ayarlar" }] as const;
  let gorunum = $state<(typeof GORUNUMLER)[number]["ad"]>("gun");
</script>


<div class="secim gorunum" role="tablist" aria-label="Hazırlama görünümü">
  {#each GORUNUMLER as g}<button role="tab" aria-selected={gorunum === g.ad} onclick={() => (gorunum = g.ad)}>{g.baslik}</button>{/each}
</div>
{#if gorunum === "servis"}<ServisAyarlari />{:else}<GunlukDagitim {git} />{/if}


<style>
  .gorunum { margin-bottom: var(--b3); }
</style>
