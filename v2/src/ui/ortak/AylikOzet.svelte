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

<section class="aylik panel">
  <div class="panel-bas"><h2>{baslik}</h2>{#if secilebilir}<span class="ipucu">Ada dokunun: kişinin günleri takvimde vurgulanır</span>{/if}</div>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex (kaydırılan tablo klavyeyle kaydırılabilsin: WCAG 2.1.1) -->
  <div class="tablo-kap" tabindex="0" role="region" aria-label={baslik}>
    <table class="tablo ozet-tablo">
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
  {#if secilebilir && vurgu !== null}<div class="alt"><button class="dugme kucuk" onclick={() => (vurgu = null)}>Vurgulamayı kaldır</button></div>{/if}
</section>

<style>
  .ipucu { font-size: var(--f-xs); color: var(--yazi-2); }
  .ozet-tablo th, .ozet-tablo td { text-align: right; white-space: nowrap; }
  .ozet-tablo tbody th, .ozet-tablo .sol, .ozet-tablo thead th:first-child, .ozet-tablo thead th:nth-child(2) { text-align: left; }
  .ozet-tablo tbody th { font-weight: 600; }
  .ozet-tablo .fm { font-weight: 700; color: var(--lacivert); }
  .ozet-tablo tr.secili > * { background: var(--secili-satir) !important; }
  .isaret { margin-right: 8px; }
  button.ad { display: inline-flex; align-items: center; border: 0; background: none; padding: 0; font: inherit; color: inherit; cursor: pointer; text-align: left; }
  button.ad:hover { text-decoration: underline; color: var(--baglanti); }
  .alt { padding: var(--b2) var(--b4); border-top: 1px solid var(--cizgi-acik); }
</style>
