<script lang="ts">
  // Onayla öncesi soru: kalan sorunlar (ör. eczacısız gün) ve boş "Onaylayan" ayarı gösterilir; Onayla ile onaylanır.
  // Nöbet çizelgesi, acil eczane ve öğlen nöbet listesinde ortak.
  import Pencere from "./Pencere.svelte";
  import Ikon from "./Ikon.svelte";
  let { acik = $bindable(false), ne, sorunlar = [], onaylayan, onayla }: {
    acik?: boolean; ne: string; sorunlar?: string[]; onaylayan: string; onayla: () => void;
  } = $props();
</script>

<Pencere bind:acik baslik="{ne} onaylansın mı?" altBaslik="Onaylanan liste elle değiştirilemez; değiştirmek için önce onay kaldırılır.">
  {#if sorunlar.length}
    <p>Listede şu sorunlar duruyor:</p>
    {#each sorunlar as t}<p class="kutu hata"><Ikon ad="uyari" boyut={15} /> {t}</p>{/each}
  {/if}
  {#if !onaylayan.trim()}<p class="kutu dikkat"><Ikon ad="uyari" boyut={15} /> Ayarlar'da "Onaylayan" boş: çıktılarda onaylayan adı görünmez.</p>{/if}
  {#if !sorunlar.length && onaylayan.trim()}<p>Onaylayan: <b>{onaylayan}</b></p>{/if}
  {#snippet altlik()}
    <span style="flex:1"></span>
    <button class="dugme" onclick={() => (acik = false)}>Vazgeç</button>
    <button class="dugme ana" onclick={() => { acik = false; onayla(); }}><Ikon ad="tamam" />{sorunlar.length ? "Yine de onayla" : "Onayla"}</button>
  {/snippet}
</Pencere>
