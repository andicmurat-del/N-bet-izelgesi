<script lang="ts">
  // Acil Eczane: acil eczane nöbet listesi ve acilde nöbet tutanların izin ve tercihleri (yalnız acil kadrosu).
  import { depo } from "../../veri/depo.svelte";
  import { acilKadrosunda } from "../../motor";
  import AySecici from "../ortak/AySecici.svelte";
  import Sekmeler from "../ortak/Sekmeler.svelte";
  import AcilServis from "../cizelge/AcilServis.svelte";
  import Izinler from "./Izinler.svelte";
  import type { AcilGorunum } from "./sayfaTipleri";

  let { git, gorunum = $bindable("acil") }: { git: (ad: "cizelge" | "puantaj" | "izinler" | "kisiler" | "ayarlar") => void; gorunum?: AcilGorunum } = $props();
  const GORUNUMLER = [{ ad: "acil", baslik: "Acil Eczane Nöbet Listesi", ikon: "acil" }, { ad: "izinler", baslik: "İzinler", ikon: "izin" }] as const;
</script>

<header class="sayfa-bas">
  <div class="baslik">
    <h1>Acil Eczane</h1>
    {#if depo.veri.kurum.ad}<p>{depo.veri.kurum.ad}</p>{/if}
  </div>
  <AySecici />
</header>

<Sekmeler secenekler={GORUNUMLER} bind:secili={gorunum} etiket="Görünüm" telefonSutun={2} />

{#if gorunum === "izinler"}
  <Izinler {git} gomulu kimler={k => acilKadrosunda(k)} onayKilidi={false} />
{:else}
  <AcilServis git={() => git("kisiler")} />
{/if}

<style>
  .sayfa-bas { display: flex; flex-wrap: wrap; gap: var(--b4); align-items: flex-end; justify-content: space-between; margin-bottom: var(--b4); }
  .baslik p { color: var(--soluk); margin-top: 2px; }
</style>
