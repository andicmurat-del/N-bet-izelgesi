<script lang="ts">
  // Öğlen Nöbet Listesi > Kişi başı dağılım: bu ayki öğlen nöbetleri (Pazartesi–Perşembe / Cuma) ve yıl toplamı.
  import type { Kisi } from "../../veri/tipler";
  let { ozet, ay }: { ozet: { k: Kisi; top: number; cuma: number; ay: number; ayCuma: number }[]; ay: string } = $props();
</script>

<section class="panel" aria-label="Kişi başı dağılım">
  <div class="panel-bas">
    <h2>Kişi başı dağılım</h2>
    <p class="lejant">
      <span><i class="kare a"></i>Pzt–Prş</span><span><i class="kare c"></i>Cuma</span><span>{ay} · yıl</span>
    </p>
  </div>
  <div class="panel-ic dagilim">
    {#each [{ ad: "Eczacılar", rol: "eczaci" }, { ad: "Teknikerler", rol: "teknisyen" }] as grup}
      {@const l = ozet.filter(o => o.k.role === grup.rol)}
      {#if l.length}
        <h3>{grup.ad}</h3>
        {#each l as o (o.k.id)}
          <div class="dag" title="{o.k.name}: bu ay {o.ay} (Cuma {o.ayCuma}), yıl {o.top} (Cuma {o.cuma})">
            <span class="dad"
              >{o.k.name}{#if o.k.cumaMuaf}{" "}<small>Cuma muaf</small>{/if}</span
            >
            <span class="kareler" aria-hidden="true"
              >{#each { length: o.ay } as _, j}<i class="kare {j >= o.ay - o.ayCuma ? 'c' : 'a'}"></i>{/each}</span
            >
            <b class="rakam">{o.ay}</b><span class="yil rakam">{o.top}</span>
          </div>
        {/each}
      {/if}
    {/each}
  </div>
</section>

<style>
  small {
    color: var(--soluk);
    font-weight: 400;
    font-size: var(--f-xs);
  }
  .dagilim {
    display: grid;
    gap: 2px;
  }
  .dagilim h3 {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--yazi-2);
    margin: 6px 0 2px;
  }
  .dag {
    display: grid;
    grid-template-columns: 175px minmax(0, 1fr) 22px 26px;
    gap: 8px;
    align-items: center;
    font-size: var(--f-sm);
    padding: 2px 0;
  }
  .dad {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .dag b {
    text-align: right;
    color: var(--lacivert);
  }
  .yil {
    text-align: right;
    color: var(--soluk);
    font-size: var(--f-xs);
  }
  .kareler {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
  }
  .kare {
    display: inline-block;
    width: 14px;
    height: 11px;
  }
  .kare.a {
    background: var(--vurgu);
  }
  .kare.c {
    background: var(--haz);
  }
  .lejant .kare {
    width: 9px;
    height: 9px;
  }
  .lejant {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    font-size: var(--f-xs);
    color: var(--yazi-2);
  }
  .lejant > span {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  @media (max-width: 720px) {
    .dag {
      grid-template-columns: 110px minmax(0, 1fr) 20px 22px;
    }
  }
</style>
