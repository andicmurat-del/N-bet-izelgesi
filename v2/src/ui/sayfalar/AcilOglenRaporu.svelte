<script lang="ts">
  import Bilgi from "../ortak/Bilgi.svelte";
  // Raporlar > Acil ve öğlen: yılın acil eczane nöbeti ve öğlen nöbeti dağılımı (kişi başı ay ay, yıl toplamı;
  // acilde hafta sonu / tatil, öğlende Cuma ayrıca). Eşitliği yıl boyunca görmek için.
  import { acilOglenRaporuHesapla } from "../../motor";
  import { veriAnlik } from "../../veri/depo.svelte";
  import { ROL_AD, type Rol } from "../../veri/tipler";
  import { AYLAR } from "../../veri/tarih";
  import { ciktiPaketi } from "../../disa/yukle";
  import { dosyaKaydet, hataMetni } from "../../disa/indir";
  import { depo } from "../../veri/depo.svelte";
  import Ikon from "../ortak/Ikon.svelte";

  let { yil, goster }: { yil: number; goster: "acil" | "oglen" } = $props();
  type Satir = { id: number; ad: string; rol: string; aylar: number[]; top: number; tatil?: number; cuma?: number; pe?: number; cu?: number; cmt?: number; paz?: number; resmi?: number };
  type Ek = "tatil" | "cuma" | "pe" | "cu" | "cmt" | "paz" | "resmi";
  const R = $derived(acilOglenRaporuHesapla(veriAnlik(), yil) as { acil: Satir[]; oglen: Satir[]; acilAylar: boolean[]; oglenAylar: boolean[] });
  const ay3 = AYLAR.map(a => a.slice(0, 3));
  const fark = (l: Satir[], k: "top" | Ek) => (l.length ? Math.max(...l.map(x => x[k] ?? 0)) - Math.min(...l.map(x => x[k] ?? 0)) : 0);
  const bolumler = $derived([
    { baslik: "Acil eczane nöbeti", l: R.acil, aylar: R.acilAylar, ekler: [["pe", "Prş"], ["cu", "Cuma"], ["cmt", "Cmt"], ["paz", "Paz"], ["resmi", "Resmi tatil"]] as [Ek, string][],
      bos: "Bu yıl acil eczane nöbet listesi yok.", not: "Acil kadrosu: acil servis personeli ile nöbet yeri \"Acil eczane\" olan eczacılar ve kemoterapi eczacıları. Eşitlik yıl boyunca ve günlük eczanedeki gibi: toplam ile Perşembe, Cuma, Cumartesi, Pazar ve resmi tatil ayrı ayrı; herkesin payı yazılabildiği gün sayısına göredir; izinli / raporlu günler düşülür, telafi istenmez (izinli ay az görünür)." },
    { baslik: "Öğlen nöbeti", l: R.oglen, aylar: R.oglenAylar, ekler: [["cuma", "Cuma"]] as [Ek, string][],
      bos: "Bu yıl öğlen nöbet listesi yok.", not: "Eczacılar ve teknikerler. Cuma ayrıca sayılır; Cuma'dan muaf olanlarda Cuma sayısı 0'dır." },
  ]);
  let durum = $state("");
  async function excel(b: (typeof bolumler)[number]) {
    try {
      const { dagilimKitap } = await ciktiPaketi();
      const blob = dagilimKitap(b.baslik, yil, depo.veri.kurum.ad, ay3, b.aylar, b.l.map(s => ({ ad: s.ad, rol: s.rol, aylar: s.aylar, top: s.top, ek: b.ekler.map(([k]) => s[k] ?? 0) })), b.ekler.map(([, a]) => a));
      durum = (await dosyaKaydet(`${goster === "acil" ? "acil" : "oglen"}-nobeti-${yil}.xlsx`, blob, blob.type)) ? "Excel dosyası kaydedildi." : "";
    } catch (e) { durum = hataMetni(e, "Dosya oluşturulamadı."); }
  }
</script>

{#each bolumler.filter((_, i) => (goster === "acil" ? i === 0 : i === 1)) as b (b.baslik)}
  <section class="blok panel-blok">
    <h2>{b.baslik}</h2>
    {#if !b.aylar.some(Boolean)}
      <div class="kart bos"><p>{b.bos}</p></div>
    {:else}
      <div class="ust"><Bilgi baslik="Açıklama"><p>{b.not}</p></Bilgi><button class="dugme" onclick={() => excel(b)}><Ikon ad="indir" />Excel</button></div>
      {#if durum}<p class="bant" role="status">{durum}</p>{/if}
      <p class="aciklama">En çok − en az: toplamda <b class="rakam">{fark(b.l, "top")}</b>{#each b.ekler as [k, a]}, {a} <b class="rakam">{fark(b.l, k)}</b>{/each}. Soluk sütunlar: listesi olmayan aylar.</p>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex (kaydırılan tablo klavyeyle kaydırılabilsin: WCAG 2.1.1) -->
      <div class="kart tablo-kap" tabindex="0" role="region" aria-label="{yil} {b.baslik.toLocaleLowerCase('tr')} dağılımı">
        <table>
          <thead><tr><th class="sol" scope="col">Kişi</th>{#each ay3 as a, i}<th scope="col" class:bos-ay={!b.aylar[i]}>{a}</th>{/each}<th scope="col">Yıl</th>{#each b.ekler as [, a]}<th scope="col">{a}</th>{/each}</tr></thead>
          <tbody>
            {#each b.l as s (s.id)}
              <tr>
                <th class="sol" scope="row">{s.ad} <small>{ROL_AD[s.rol as Rol] ?? ""}</small></th>
                {#each s.aylar as n, i}<td class:bos-ay={!b.aylar[i]}>{b.aylar[i] ? n : "–"}</td>{/each}
                <td class="vurgu">{s.top}</td>{#each b.ekler as [k]}<td>{s[k] ?? 0}</td>{/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>
{/each}

<style>
  :where(tbody tr:nth-child(even)) > :where(td, th) { background: var(--yuzey-2); }
  .blok { margin-bottom: var(--b4); }
  .bant { padding: var(--b2) var(--b4); border-radius: var(--r); margin-bottom: var(--b3); font-size: var(--f-sm); font-weight: 500; background: var(--vurgu-zemin); color: var(--vurgu); }
  .ust { display: flex; gap: var(--b3); align-items: flex-start; justify-content: space-between; flex-wrap: wrap; }
  .aciklama { font-size: var(--f-sm); color: var(--soluk); max-width: 100ch; }
  .bos { padding: var(--b4); color: var(--yazi-2); }
  .tablo-kap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: var(--f-sm); font-variant-numeric: tabular-nums; }
  th, td { padding: 8px 10px; border: 1px solid var(--cizgi-acik); text-align: right; white-space: nowrap; }
  thead th { font-size: var(--f-xs); color: var(--lacivert); font-weight: 700; background: var(--tablo-bas); }
  tbody th { font-weight: 500; }
  tbody th small { color: var(--soluk); font-weight: 400; }
  .sol { text-align: left; }
  .bos-ay { color: var(--soluk); opacity: .6; }
  .vurgu { font-weight: 600; }
  tbody tr:last-child > * { border-bottom: 0; }
</style>
