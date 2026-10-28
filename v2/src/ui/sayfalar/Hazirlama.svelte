<script lang="ts">
  // Servis hazırlama: teknikerlerin günlük servis dağıtımı ve servis listesi ayarları.
  import AySecici from "../ortak/AySecici.svelte";
  import Sekmeler from "../ortak/Sekmeler.svelte";
  import GunlukDagitim from "../hazirlama/GunlukDagitim.svelte";
  import ServisAyarlari from "../hazirlama/ServisAyarlari.svelte";

  let { git }: { git: (ad: "cizelge" | "kisiler") => void } = $props();
  const GORUNUMLER = [{ ad: "gun", baslik: "Günlük dağıtım", kisa: "Dağıtım", ikon: "katman" }, { ad: "servis", baslik: "Servisler", ikon: "ayarlar" }] as const;
  let gorunum = $state<(typeof GORUNUMLER)[number]["ad"]>("gun");
</script>

<header class="sayfa-bas">
  <div>
    <h1>Servis hazırlama</h1>
    <p>O gün çalışan teknikerlere servisler zorluk ve hasta sayısına göre dengeli dağıtılır; aylar boyunca kişi başı yük, YB ve zor servis sayısı eşitlenir.</p>
  </div>
  <AySecici />
</header>

<Sekmeler secenekler={GORUNUMLER} bind:secili={gorunum} etiket="Hazırlama görünümü" />
{#if gorunum === "servis"}<ServisAyarlari />{:else}<GunlukDagitim {git} />{/if}

<style>
  .sayfa-bas { display: flex; flex-wrap: wrap; gap: var(--b4); align-items: flex-end; justify-content: space-between; margin-bottom: var(--b4); }
  .sayfa-bas > div { max-width: 70ch; }
  .sayfa-bas p { color: var(--yazi-2); margin-top: var(--b2); }
</style>
