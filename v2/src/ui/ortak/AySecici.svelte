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
  .ay { display: inline-flex; align-items: stretch; background: rgba(255, 255, 255, .1); border: 1px solid rgba(255, 255, 255, .22); border-radius: var(--r-kucuk); }
  .ay .dugme { min-height: 38px; width: 40px; padding: 0; border-radius: 0; color: #FFFFFF; box-shadow: none; }
  .ay .dugme:first-child { border-radius: var(--r-kucuk) 0 0 var(--r-kucuk); } .ay .dugme:last-child { border-radius: 0 var(--r-kucuk) var(--r-kucuk) 0; }
  .ay .dugme:hover:not(:disabled) { background: rgba(255, 255, 255, .14); border-color: transparent; }
  .etiket { display: grid; place-items: center; min-width: 136px; padding: 0 var(--b3); text-align: center; font-weight: 700; font-size: var(--f-md); color: #FFFFFF; font-variant-numeric: tabular-nums; border-inline: 1px solid rgba(255, 255, 255, .16); }
</style>
