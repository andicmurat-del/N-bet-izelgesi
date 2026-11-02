<script lang="ts">
  // Raporlar > Acil ve öğlen: yılın acil eczane nöbeti ve öğlen nöbeti dağılımı (kişi başı ay ay, yıl toplamı;
  // acilde hafta sonu / tatil, öğlende Cuma ayrıca). Eşitliği yıl boyunca görmek için.
  import { acilOglenRaporuHesapla } from "../../motor";
  import { depo } from "../../veri/depo.svelte";
  import { ROL_AD, type Rol } from "../../veri/tipler";
  import { AYLAR } from "../../veri/tarih";

  let { yil }: { yil: number } = $props();
  type Satir = { id: number; ad: string; rol: string; aylar: number[]; top: number; tatil?: number; cuma?: number };
  const R = $derived(acilOglenRaporuHesapla($state.snapshot(depo.veri), yil) as { acil: Satir[]; oglen: Satir[]; acilAylar: boolean[]; oglenAylar: boolean[] });
  const ay3 = AYLAR.map(a => a.slice(0, 3));
  const fark = (l: Satir[], k: "top" | "tatil" | "cuma") => (l.length ? Math.max(...l.map(x => x[k] ?? 0)) - Math.min(...l.map(x => x[k] ?? 0)) : 0);
  const bolumler = $derived([
    { baslik: "Acil eczane nöbeti", l: R.acil, aylar: R.acilAylar, ek: "tatil" as const, ekAd: "Hafta sonu / tatil",
      bos: "Bu yıl acil eczane nöbet listesi yok.", not: "Acil kadrosu: acil servis personeli ve \"Acilde nöbet tutar\" işaretli eczacılar. Eşitlik yıl boyunca: izin vb. nedeniyle bir ay az tutan sonraki aylarda tamamlar." },
    { baslik: "Öğlen nöbeti", l: R.oglen, aylar: R.oglenAylar, ek: "cuma" as const, ekAd: "Cuma",
      bos: "Bu yıl öğlen nöbet listesi yok.", not: "Eczacılar ve teknikerler. Cuma ayrıca sayılır; Cuma'dan muaf olanlarda Cuma sayısı 0'dır." },
  ]);
</script>

{#each bolumler as b (b.baslik)}
  <section class="blok">
    <h2>{b.baslik}</h2>
    {#if !b.aylar.some(Boolean)}
      <div class="kart bos"><p>{b.bos}</p></div>
    {:else}
      <p class="aciklama">{b.not} En çok − en az: toplamda <b class="rakam">{fark(b.l, "top")}</b>, {b.ekAd.toLocaleLowerCase("tr")} için <b class="rakam">{fark(b.l, b.ek)}</b>. Soluk sütunlar: listesi olmayan aylar.</p>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex (kaydırılan tablo klavyeyle kaydırılabilsin: WCAG 2.1.1) -->
      <div class="kart tablo-kap" tabindex="0" role="region" aria-label="{yil} {b.baslik.toLocaleLowerCase('tr')} dağılımı">
        <table>
          <thead><tr><th class="sol" scope="col">Kişi</th>{#each ay3 as a, i}<th scope="col" class:bos-ay={!b.aylar[i]}>{a}</th>{/each}<th scope="col">Yıl</th><th scope="col">{b.ekAd}</th></tr></thead>
          <tbody>
            {#each b.l as s (s.id)}
              <tr>
                <th class="sol" scope="row">{s.ad} <small>{ROL_AD[s.rol as Rol] ?? ""}</small></th>
                {#each s.aylar as n, i}<td class:bos-ay={!b.aylar[i]}>{b.aylar[i] ? n : "–"}</td>{/each}
                <td class="vurgu">{s.top}</td><td>{s[b.ek] ?? 0}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>
{/each}

<style>
  .blok { display: grid; gap: var(--b2); margin-bottom: var(--b5); }
  .blok h2 { font-size: var(--f-lg); }
  .aciklama { font-size: var(--f-sm); color: var(--soluk); max-width: 100ch; }
  .bos { padding: var(--b4); color: var(--yazi-2); }
  .tablo-kap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: var(--f-sm); font-variant-numeric: tabular-nums; }
  th, td { padding: 8px 10px; border-bottom: 1px solid var(--cizgi-acik); text-align: right; white-space: nowrap; }
  thead th { font-size: var(--f-xs); color: var(--soluk); font-weight: 600; background: var(--yuzey-2); }
  tbody th { font-weight: 500; }
  tbody th small { color: var(--soluk); font-weight: 400; }
  .sol { text-align: left; }
  .bos-ay { color: var(--soluk); opacity: .6; }
  .vurgu { font-weight: 600; }
  tbody tr:last-child > * { border-bottom: 0; }
</style>
