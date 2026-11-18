<script lang="ts">
  // "Bu ay yapılacaklar": Günlük Eczane sayfasının üstünde ayın iş sırası. Her adımda durum (tamam / başlandı / bekliyor) ve
  // kısa bilgi; adıma dokununca ilgili sekme açılır. Gizlenirse tek satır kalır (seçim bu tarayıcıda hatırlanır).
  import { ayAdimlari, type AdimHedefi } from "../../veri/adimlar.svelte";
  import { KAYIT_ANAHTARI } from "../../veri/dogrulama";
  import { depo } from "../../veri/depo.svelte";
  import { AYLAR } from "../../veri/tarih";
  import Ikon from "../ortak/Ikon.svelte";

  let { git }: { git: (h: AdimHedefi) => void } = $props();
  const GIZLI = KAYIT_ANAHTARI + "-adimlar-gizli";
  let acik = $state(!okuGizli());
  function okuGizli() {
    try {
      const v = localStorage.getItem(GIZLI);
      // seçim yapılmadıysa telefonda kapalı başlar (yer kaplamasın)
      return v === null ? typeof matchMedia !== "undefined" && matchMedia("(max-width: 720px)").matches : v === "1";
    } catch {
      return false;
    }
  }
  function degistir() {
    acik = !acik;
    try {
      localStorage.setItem(GIZLI, acik ? "0" : "1");
    } catch {
      /* yer yoksa yalnız bu oturumda */
    }
  }
  const adimlar = $derived(ayAdimlari(depo.yil, depo.ay));
  const tamamSay = $derived(adimlar.filter(a => a.durum === "tamam").length);
  const siradaki = $derived(adimlar.find(a => a.durum !== "tamam"));
  const DURUM_AD = { tamam: "tamam", kismen: "başlandı", bekliyor: "bekliyor" } as const;
</script>

<section class="ay-adimlari kart" aria-label="Bu ay yapılacaklar">
  <div class="bas">
    <h2>{AYLAR[depo.ay]} {depo.yil} · yapılacaklar</h2>
    <span class="say rakam" class:bitti={!siradaki}>{tamamSay}/{adimlar.length}</span>
    {#if siradaki}<span class="sirada">Sırada: <button class="baglanti" onclick={() => git(siradaki.hedef)}>{siradaki.baslik}</button></span
      >{:else}<span class="sirada"><Ikon ad="tamam" boyut={14} /> Bu ayın işleri tamam</span>{/if}
    <button class="dugme sade kucuk ac" aria-expanded={acik} onclick={degistir}>{acik ? "Gizle" : "Adımları göster"}</button>
  </div>
  {#if acik}
    <ol class="adimlar">
      {#each adimlar as a, i}
        <li>
          <button
            class="adim {a.durum}"
            class:simdi={a === siradaki}
            onclick={() => git(a.hedef)}
            aria-label="{a.baslik}: {DURUM_AD[a.durum]}, {a.ayrinti}"
          >
            <span class="adim-isaret" aria-hidden="true"
              >{#if a.durum === "tamam"}<Ikon ad="tamam" boyut={14} />{:else}{i + 1}{/if}</span
            >
            <span class="metin"><b>{a.baslik}</b><small>{a.ayrinti}</small></span>
          </button>
        </li>
      {/each}
    </ol>
  {/if}
</section>

<style>
  .ay-adimlari {
    padding: var(--b3) var(--b4);
    margin-bottom: var(--b4);
  }
  .bas {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--b2) var(--b3);
  }
  h2 {
    font-size: var(--f-md);
    color: var(--lacivert);
    margin: 0;
  }
  .say {
    padding: 1px 8px;
    border-radius: 999px;
    background: var(--yuzey-2);
    color: var(--yazi-2);
    font-size: var(--f-xs);
    font-weight: 700;
  }
  .say.bitti {
    background: var(--vurgu-zemin);
    color: var(--vurgu);
  }
  .sirada {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: var(--f-sm);
    color: var(--yazi-2);
  }
  .baglanti {
    border: 0;
    background: none;
    padding: 0;
    color: var(--vurgu);
    text-decoration: underline;
    cursor: pointer;
    font: inherit;
    font-weight: 700;
  }
  .ac {
    margin-left: auto;
  }
  .adimlar {
    list-style: none;
    margin: var(--b3) 0 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--b2);
  }
  .adim {
    display: flex;
    align-items: flex-start;
    gap: var(--b2);
    width: 100%;
    height: 100%;
    padding: var(--b2) var(--b3);
    border: 1px solid var(--cizgi);
    border-radius: var(--r-kucuk);
    background: var(--yuzey);
    color: var(--yazi);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .adim:hover {
    border-color: color-mix(in srgb, var(--vurgu) 45%, var(--cizgi));
  }
  .adim.simdi {
    border-color: var(--vurgu);
    box-shadow: 0 0 0 1px var(--vurgu);
  }
  .adim-isaret {
    flex: none;
    display: inline-grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 1px solid var(--cizgi);
    font-size: var(--f-xs);
    font-weight: 700;
    color: var(--yazi-2);
  }
  .tamam .adim-isaret {
    background: var(--vurgu);
    border-color: var(--vurgu);
    color: var(--vurgu-yazi);
  }
  .kismen .adim-isaret {
    border-color: var(--dikkat);
    color: var(--dikkat);
    background: var(--dikkat-zemin);
  }
  .metin {
    display: grid;
    gap: 1px;
    min-width: 0;
  }
  .metin b {
    font-size: var(--f-sm);
  }
  .metin small {
    font-size: var(--f-xs);
    color: var(--yazi-2);
  }
  .tamam .metin b {
    color: var(--yazi-2);
  }
  @media (max-width: 720px) {
    .adimlar {
      grid-template-columns: 1fr 1fr;
    }
  }
</style>
