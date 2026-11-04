<script lang="ts">
  // Acil Eczane: acil eczane nöbet listesi, acil kadrosunun puantajı ve izin / tercihleri (yalnız acil kadrosu).
  import { acilKadrosunda } from "../../motor";
  import SayfaBasligi from "../ortak/SayfaBasligi.svelte";
  import Sekmeler from "../ortak/Sekmeler.svelte";
  import AcilServis from "../cizelge/AcilServis.svelte";
  import Izinler from "./Izinler.svelte";
  import Puantaj from "./Puantaj.svelte";
  import type { AcilGorunum } from "./sayfaTipleri";

  let { git, gorunum = $bindable("acil") }: { git: (ad: "cizelge" | "puantaj" | "izinler" | "kisiler" | "ayarlar") => void; gorunum?: AcilGorunum } = $props();
  const GORUNUMLER = [
    { ad: "acil", baslik: "Nöbet Listesi", uzun: "Acil Eczane Nöbet Listesi", aciklama: "Her gün 2 nöbetçi; acil kadrosu arasında eşit dağıtılır, günlük eczane nöbetiyle çakışmaz." },
    { ad: "puantaj", baslik: "Puantaj", uzun: "Acil Eczane Puantajı", aciklama: "Acil kadrosunun gerçekleşen çalışması ve fazla mesai hesabı." },
    { ad: "izinler", baslik: "İzinler", uzun: "İzinler ve Tercihler", aciklama: "Acil kadrosunun izinli günleri ve nöbet tercihleri." },
  ] as const;
  const aktif = $derived(GORUNUMLER.find(g => g.ad === gorunum) ?? GORUNUMLER[0]);
</script>

<SayfaBasligi konum={["Acil Eczane", aktif.baslik]} baslik={aktif.uzun} aciklama={aktif.aciklama} />

<Sekmeler secenekler={GORUNUMLER} bind:secili={gorunum} etiket="Görünüm" telefonSutun={3} />

{#if gorunum === "puantaj"}
  <Puantaj {git} gomulu acil kimler={k => acilKadrosunda(k)} />
{:else if gorunum === "izinler"}
  <Izinler {git} gomulu kimler={k => acilKadrosunda(k)} onayKilidi={false} />
{:else}
  <AcilServis git={() => git("kisiler")} />
{/if}

