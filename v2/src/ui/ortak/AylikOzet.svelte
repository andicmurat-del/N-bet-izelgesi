<script lang="ts">
  // Ayın kişi başı özeti (puantajdaki gibi): nöbet, Perşembe, Cuma, Cumartesi, Pazar, hazırlama, resmi tatil, yıllık izin,
  // rapor, fazla mesai. Puantaj, Günlük Eczane Nöbet Listesi ve Acil Eczane Nöbet Listesi aynı tabloyu kullanır.
  // vurgu verilirse satıra dokunmak o kişinin günlerini takvimde vurgular.
  import { ROL_AD, type Rol } from "../../veri/tipler";

  type Satir = { s: { id: number; name: string; role: Rol }; n: number; thu: number; cu: number; cmt: number; paz: number; h: number; rt: number; yi: number; rd: number; fm: number };
  let { satirlar, baslik = "Aylık özet", hazirlama = true, vurgu = $bindable(undefined) }: {
    satirlar: Satir[]; baslik?: string; hazirlama?: boolean; vurgu?: number | null;
  } = $props();
  const secilebilir = $derived(vurgu !== undefined);
  const sec = (id: number) => { if (secilebilir) vurgu = vurgu === id ? null : id; };
</script>

<section class="aylik">
  <h2>{baslik}</h2>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex (kaydırılan tablo klavyeyle kaydırılabilsin: WCAG 2.1.1) -->
  <div class="kart tablo-kap" tabindex="0" role="region" aria-label={baslik}>
    <table class="ozet-tablo">
      <thead><tr><th scope="col">Ad soyad</th><th scope="col">Görev</th><th scope="col">Nöbet</th><th scope="col">Perşembe</th><th scope="col">Cuma</th><th scope="col">Cumartesi</th><th scope="col">Pazar</th>{#if hazirlama}<th scope="col">Hazırlama</th>{/if}<th scope="col">Resmi tatil</th><th scope="col">Yıllık izin</th><th scope="col">Rapor</th><th scope="col">Fazla mesai</th></tr></thead>
      <tbody>
        {#each satirlar as r (r.s.id)}
          <tr class:secili={secilebilir && vurgu === r.s.id}>
            <th scope="row">
              {#if secilebilir}<button class="ad" aria-pressed={vurgu === r.s.id} onclick={() => sec(r.s.id)} title="Takvimde günlerini vurgula"><span class="isaret {r.s.role}"></span>{r.s.name}</button>
              {:else}<span class="isaret {r.s.role}"></span>{r.s.name}{/if}
            </th>
            <td class="sol">{ROL_AD[r.s.role]}</td><td>{r.n}</td><td>{r.thu}</td><td>{r.cu}</td><td>{r.cmt}</td><td>{r.paz}</td>{#if hazirlama}<td>{r.h}</td>{/if}<td>{r.rt}</td><td>{r.yi}</td><td>{r.rd}</td><td class="fm">{r.fm} sa</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  {#if secilebilir && vurgu !== null}<div><button class="dugme kucuk" onclick={() => (vurgu = null)}>Vurgulamayı kaldır</button></div>{/if}
</section>

<style>
  .aylik { display: grid; gap: var(--b2); }
  .aylik h2 { font-size: var(--f-lg); }
  .tablo-kap { overflow-x: auto; }
  .ozet-tablo { width: 100%; border-collapse: collapse; font-size: var(--f-sm); }
  .ozet-tablo th, .ozet-tablo td { padding: 8px 12px; border-bottom: 1px solid var(--cizgi-acik); text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .ozet-tablo thead th { background: var(--yuzey-2); font-size: var(--f-xs); color: var(--yazi-2); font-weight: 600; }
  .ozet-tablo tbody th, .ozet-tablo .sol, .ozet-tablo thead th:first-child, .ozet-tablo thead th:nth-child(2) { text-align: left; }
  .ozet-tablo tbody th { font-weight: 500; }
  .ozet-tablo .fm { font-weight: 700; color: var(--vurgu); }
  .ozet-tablo tbody tr:last-child > * { border-bottom: 0; }
  .ozet-tablo tr.secili > * { background: var(--vurgu-zemin); }
  .isaret { margin-right: 8px; }
  button.ad { display: inline-flex; align-items: center; border: 0; background: none; padding: 0; font: inherit; color: inherit; cursor: pointer; text-align: left; }
  button.ad:hover { text-decoration: underline; }
</style>
