<!-- Alt sekmelerin altındaki işlem satırı: açık görünümün düğmeleri buraya taşınır (IslemAlani.svelte, tasi.ts).
     Kimliği sabittir; boşken görünmez. -->
<div class="islem-satiri" id="sayfa-islemleri"></div>

<style>
  .islem-satiri {
    display: flex;
    flex-wrap: wrap;
    gap: var(--b2);
    align-items: center;
    margin-bottom: var(--b4);
  }
  .islem-satiri:empty {
    display: none;
  }
  .islem-satiri :global(.islem-alani) {
    display: contents;
  }
</style>
