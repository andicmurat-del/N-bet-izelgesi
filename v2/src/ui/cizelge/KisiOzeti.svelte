<script lang="ts">
  // Ay içinde kişi başı nöbet, hazırlama ve fazla mesai. Çubuktaki çizgi: nöbetçilerin ortalaması.
  // Bir kişiye dokunmak takvimde onun günlerini vurgular.
  import type { AyCizelgesi, Kisi } from "../../veri/tipler";
  import { ayOzeti } from "../../veri/depo.svelte";
  let { c, kisiler, vurgu = $bindable(null) }: { c: AyCizelgesi; kisiler: Kisi[]; vurgu?: number | null } = $props();

  const o = $derived(ayOzeti(c));
  const satirlar = $derived(kisiler.map(k => ({ k, x: o[k.id] ?? { nobet: 0, hazirlama: 0, fazlaMesai: 0, haftaSonu: 0 } })));
  const nobetciler = $derived(satirlar.filter(s => s.k.role !== "destek"));
  const enCok = $derived(Math.max(1, ...satirlar.map(s => s.x.fazlaMesai)));
  const ort = $derived(nobetciler.length ? nobetciler.reduce((t, s) => t + s.x.fazlaMesai, 0) / nobetciler.length : 0);
  const gruplar = $derived([
    { ad: "Eczacılar", l: satirlar.filter(s => s.k.role === "eczaci" || s.k.role === "nobetci") },
    { ad: "Teknikerler", l: satirlar.filter(s => s.k.role === "teknisyen") },
    { ad: "Destek personeli", l: satirlar.filter(s => s.k.role === "destek") },
  ].filter(g => g.l.length));
</script>

<section class="ozet" aria-label="Kişi özeti">
  <header>
    <h2>Kişiler</h2>
    <p>Sayı: nöbet + hazırlama. Çubuk: fazla mesai; çizgi ortalama ({Math.round(ort)} sa).</p>
  </header>
  {#each gruplar as g}
    <h3>{g.ad}</h3>
    <ul>
      {#each g.l as { k, x } (k.id)}
        <li>
          <button class:secili={vurgu === k.id} aria-pressed={vurgu === k.id} onclick={() => (vurgu = vurgu === k.id ? null : k.id)}
            title="{k.name}: {x.nobet} nöbet, {x.hazirlama} hazırlama, {x.fazlaMesai} saat fazla mesai">
            <span class="isaret {k.role}"></span>
            <span class="ad">{k.name}</span>
            <span class="say rakam">{x.nobet}{x.hazirlama ? ` + ${x.hazirlama}H` : ""}</span>
            <span class="cubuk" aria-hidden="true">
              <i style="width:{(x.fazlaMesai / enCok) * 100}%"></i>
              {#if k.role !== "destek" && nobetciler.length > 1}<u style="left:{(ort / enCok) * 100}%"></u>{/if}
            </span>
            <span class="sa rakam">{x.fazlaMesai} sa</span>
          </button>
        </li>
      {/each}
    </ul>
  {/each}
  {#if vurgu !== null}<button class="dugme kucuk temizle" onclick={() => (vurgu = null)}>Vurgulamayı kaldır</button>{/if}
</section>

<style>
  .ozet { display: grid; gap: var(--b2); }
  header h2 { font-size: var(--f-lg); }
  header p { font-size: var(--f-xs); color: var(--soluk); margin-top: 2px; }
  h3 { font-family: var(--yazi-govde); font-size: var(--f-xs); font-weight: 600; color: var(--soluk); text-transform: uppercase; letter-spacing: .06em; margin-top: var(--b2); }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
  button { display: grid; grid-template-columns: 10px minmax(0, 1fr) auto; grid-template-areas: "i a s" ". c sa"; align-items: center; gap: 2px 8px; width: 100%; padding: 6px 8px; border: 1px solid transparent; border-radius: var(--r-kucuk); background: transparent; cursor: pointer; text-align: left; }
  button:hover { background: var(--yuzey-2); }
  button.secili { background: var(--vurgu-zemin); border-color: color-mix(in srgb, var(--vurgu) 40%, transparent); }
  .isaret { grid-area: i; }
  .ad { grid-area: a; font-weight: 500; font-size: var(--f-sm); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .say { grid-area: s; font-size: var(--f-xs); color: var(--yazi-2); }
  .cubuk { grid-area: c; position: relative; height: 6px; border-radius: 6px; background: var(--cizgi-acik); }
  .cubuk i { position: absolute; inset: 0 auto 0 0; border-radius: 6px; background: var(--ecz); }
  li:has(.teknisyen) .cubuk i { background: var(--tek); }
  li:has(.destek) .cubuk i { background: var(--destek); }
  .cubuk u { position: absolute; top: -3px; bottom: -3px; width: 2px; margin-left: -1px; background: var(--yazi); opacity: .6; border-radius: 1px; }
  .sa { grid-area: sa; font-size: var(--f-xs); color: var(--soluk); }
  .temizle { justify-self: start; margin-top: var(--b2); }
</style>
