<script lang="ts">
  // Servis hazırlama: teknikerlerin günlük servis dağıtımı ve servis listesi ayarları.
  import Sekmeler from "../ortak/Sekmeler.svelte";
  import GunlukDagitim from "../hazirlama/GunlukDagitim.svelte";
  import ServisAyarlari from "../hazirlama/ServisAyarlari.svelte";

  // gomulu: Günlük Eczane sayfasının alt sekmesi olarak (başlık ve ay seçici üst sayfada)
  let { git, gomulu = false }: { git: (ad: "cizelge" | "kisiler") => void; gomulu?: boolean } = $props();
  const GORUNUMLER = [{ ad: "gun", baslik: "Günlük dağıtım", kisa: "Dağıtım", ikon: "katman" }, { ad: "servis", baslik: "Servisler", ikon: "ayarlar" }] as const;
  let gorunum = $state<(typeof GORUNUMLER)[number]["ad"]>("gun");
</script>


<Sekmeler secenekler={GORUNUMLER} bind:secili={gorunum} etiket="Hazırlama görünümü" />
{#if gorunum === "servis"}<ServisAyarlari />{:else}<GunlukDagitim {git} />{/if}

