<script lang="ts">
  import { depo } from "../../veri/depo.svelte";
  import { ayAdi, ayEkle } from "../../veri/tarih";
  import Ikon from "./Ikon.svelte";
  function kaydir(k: number) { const t = ayEkle(depo.yil, depo.ay, k); depo.yil = t.y; depo.ay = t.m; }
</script>

<div class="ay" role="group" aria-label="Ay seçimi">
  <button class="dugme sade" onclick={() => kaydir(-1)} aria-label="Önceki ay"><Ikon ad="sol" /></button>
  <span class="etiket" aria-live="polite">{ayAdi(depo.yil, depo.ay)}</span>
  <button class="dugme sade" onclick={() => kaydir(1)} aria-label="Sonraki ay"><Ikon ad="sag" /></button>
</div>

<style>
  .ay { display: inline-flex; align-items: center; gap: var(--b1); background: var(--yuzey); border: 1px solid var(--cizgi); border-radius: var(--r); padding: 2px; }
  .ay .dugme { min-height: 34px; width: 36px; padding: 0; }
  .etiket { min-width: 128px; text-align: center; font-weight: 600; font-family: var(--yazi-baslik); font-size: var(--f-lg); }
</style>
