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
  .ay { display: inline-flex; align-items: stretch; background: var(--yuzey); border: 1px solid var(--cizgi); border-radius: var(--r-kucuk); }
  .ay .dugme { min-height: 36px; width: 38px; padding: 0; border-radius: 0; color: var(--lacivert); }
  .ay .dugme:first-child { border-right: 1px solid var(--cizgi-acik); } .ay .dugme:last-child { border-left: 1px solid var(--cizgi-acik); }
  .etiket { display: grid; place-items: center; min-width: 132px; padding: 0 var(--b3); text-align: center; font-weight: 700; font-size: var(--f-md); color: var(--lacivert); font-variant-numeric: tabular-nums; }
</style>
