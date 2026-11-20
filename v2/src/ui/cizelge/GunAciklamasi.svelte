<script lang="ts">
  // "Neden bu kişiler?": günün nöbetçi ve hazırlama adayları; kimin yazılabileceği, ötekilerin neden yazılamadığı ve
  // seçilenlerin öbür adaylarla karşılaştırması (motor/aciklama.ts). Açılınca hesaplanır.
  import { gunAciklamasi, type AdayAciklamasi, type AdayDurumu } from "../../motor";
  import { veriAnlik, duzKopya } from "../../veri/depo.svelte";
  import type { AyCizelgesi } from "../../veri/tipler";
  import { ROL_AD } from "../../veri/tipler";

  let { c, gun }: { c: AyCizelgesi; gun: number } = $props();

  let acik = $state(false);
  const sonuc = $derived(acik ? gunAciklamasi(veriAnlik(), duzKopya(c), gun) : null);
  const DURUM: Record<AdayDurumu, string> = {
    yazili: "Yazılı",
    uygun: "Yazılabilirdi",
    uyarili: "Uyarıyla yazılabilirdi",
    denge: "Eşitliği bozar",
    yazilamaz: "Yazılamaz",
  };
  const sayilar = (a: AdayAciklamasi, haz: boolean) =>
    [
      haz ? `bu ay ${a.ayHaz} hazırlama` : `bu ay ${a.ayNobet} nöbet`,
      `${a.ayFm} sa fazla mesai`,
      !haz && a.yilGunTuru !== null && sonuc?.gunTuru ? `yıl içinde ${a.yilGunTuru} ${sonuc.gunTuru}` : "",
      !haz && a.onceki !== null ? `önceki nöbet ${a.onceki} gün önce` : "",
      !haz && a.sonraki !== null ? `sonraki ${a.sonraki} gün sonra` : "",
    ]
      .filter(Boolean)
      .join(" · ");
</script>

{#snippet liste(baslik: string, l: AdayAciklamasi[], haz: boolean)}
  {@const engelli = l.filter(a => a.durum === "yazilamaz")}
  <h4>{baslik}</h4>
  <ul>
    {#each l.filter(a => a.durum !== "yazilamaz") as a (a.id)}
      <li>
        <div class="ust">
          <b>{a.ad}</b><small>{ROL_AD[a.rol as keyof typeof ROL_AD] ?? a.rol}</small><span class="rozet {a.durum}">{DURUM[a.durum]}</span>
        </div>
        <small class="sayi rakam">{sayilar(a, haz)}</small>
        {#if a.durum === "denge" && a.denge.length}<small class="neden">{a.denge[0]}</small>{/if}
        {#each a.nedenler.slice(0, 2) as n}<small class="neden">{n}</small>{/each}
      </li>
    {/each}
  </ul>
  {#if engelli.length}
    <details>
      <summary>Yazılamayanlar ({engelli.length})</summary>
      <ul>
        {#each engelli as a (a.id)}
          <li>
            <div class="ust"><b>{a.ad}</b><small>{ROL_AD[a.rol as keyof typeof ROL_AD] ?? a.rol}</small></div>
            {#each a.nedenler.slice(0, 3) as n}<small class="neden">{n}</small>{/each}
          </li>
        {/each}
      </ul>
    </details>
  {/if}
{/snippet}

<details class="aciklama" bind:open={acik}>
  <summary>Neden bu kişiler? Kimler yazılabilirdi?</summary>
  {#if sonuc}
    <p class="not">
      {#if sonuc.elle}Bu gün elle düzenlendi; seçim sorumlunundur. Aşağıda öteki adayların durumu görünür.
      {:else}Program, kurallara uyan adaylar arasından aylık nöbet ve fazla mesai sayısını, yıllık gün dağılımını eşitleyecek kişiyi seçer.
        "Eşitliği bozar": o gün için engel yok, ama yalnız bu değişiklik ayın fazla mesai farkını 8 saatin üstüne çıkarır; başka günlerin de
        değişmesi gerekir.{/if}
    </p>
    {@render liste("Nöbet", sonuc.nobet, false)}
    {#if sonuc.hazirlama}{@render liste("Hazırlama", sonuc.hazirlama, true)}{/if}
  {/if}
</details>

<style>
  .aciklama {
    border-top: 1px solid var(--cizgi);
    padding-top: var(--b3);
    font-size: var(--f-sm);
  }
  .aciklama > summary {
    font-weight: 600;
    cursor: pointer;
  }
  .not {
    color: var(--yazi-2);
    margin: var(--b2) 0;
  }
  h4 {
    margin: var(--b3) 0 var(--b2);
    font-size: var(--f-sm);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 6px;
  }
  li {
    display: grid;
    gap: 2px;
    padding: 6px var(--b2);
    border-radius: var(--r-kucuk);
    background: var(--yuzey-2);
  }
  .ust {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--b2);
  }
  .ust small,
  .sayi {
    color: var(--yazi-2);
  }
  .neden {
    color: var(--yazi);
  }
  .rozet {
    margin-left: auto;
    font-size: var(--f-xs);
    font-weight: 600;
    padding: 1px 8px;
    border-radius: 999px;
    background: var(--cizgi-acik);
    color: var(--yazi);
  }
  .rozet.yazili {
    background: var(--vurgu-zemin);
    color: var(--vurgu);
  }
  .rozet.uygun {
    background: var(--tek-zemin);
    color: var(--tek);
  }
  .rozet.uyarili,
  .rozet.denge {
    background: var(--haz-zemin);
    color: var(--haz);
  }
  details details {
    margin-top: var(--b2);
  }
  details details summary {
    cursor: pointer;
    color: var(--yazi-2);
  }
  details details ul {
    margin-top: 6px;
  }
</style>
