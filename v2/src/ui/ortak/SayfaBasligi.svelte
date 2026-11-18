<script lang="ts">
  // Sayfa başlığı: konum satırı ("Ana sayfa › Günlük Eczane › Puantaj"), 26 px lacivert başlık ve açıklama satırı;
  // altında ince çizgi. Alt sekmelerin işlem düğmeleri sekmelerin altındaki işlem satırındadır (IslemSatiri.svelte).
  let { konum, baslik, aciklama = "" }: { konum: string[]; baslik: string; aciklama?: string } = $props();
</script>

<header class="sayfa-basligi">
  <nav class="konum" aria-label="Konum">
    <span>Ana sayfa</span>{#each konum as k}<span class="ayrac" aria-hidden="true">›</span><span>{k}</span>{/each}
  </nav>
  <div class="satir">
    <div class="metin">
      <h1>{baslik}</h1>
      {#if aciklama}<p>{aciklama}</p>{/if}
    </div>
  </div>
</header>

<style>
  .sayfa-basligi {
    display: grid;
    gap: 4px;
    padding-bottom: var(--b4);
    margin-bottom: var(--b4);
    border-bottom: 1px solid var(--cizgi);
  }
  .konum {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    font-size: var(--f-xs);
    color: var(--yazi-2);
  }
  .konum span:last-child {
    color: var(--vurgu);
    font-weight: 600;
  }
  .ayrac {
    color: var(--soluk);
  }
  .satir {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--b3) var(--b4);
    flex-wrap: wrap;
  }
  .metin {
    min-width: 0;
    max-width: 80ch;
  }
  h1 {
    font-size: var(--f-2xl);
    font-weight: 700;
    color: var(--lacivert);
  }
  p {
    font-size: var(--f-sm);
    color: var(--yazi-2);
    margin-top: 2px;
  }
</style>
