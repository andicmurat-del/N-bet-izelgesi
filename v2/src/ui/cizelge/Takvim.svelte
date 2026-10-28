<script lang="ts">
  // Ayın çizelgesi: masaüstünde 7 sütunlu ay ızgarası, telefonda gün gün liste (aynı öğeler, farklı yerleşim).
  import type { AyCizelgesi, Gorevli } from "../../veri/tipler";
  import { GUN_KISA, GUN_UZUN, gunMetni, haftaGunu } from "../../veri/tarih";
  import { resmiTatilMi, arifeMi } from "../../veri/depo.svelte";
  import Ikon from "../ortak/Ikon.svelte";

  let { c, vurgu = null, gunAc }: { c: AyCizelgesi; vurgu?: number | null; gunAc: (gun: number) => void } = $props();

  const bos = $derived(haftaGunu(c.year, c.month, 1));
  const eczaciOnce = (l: Gorevli[]) => [...l].sort((a, b) => Number(b.role === "eczaci" || b.role === "nobetci") - Number(a.role === "eczaci" || a.role === "nobetci"));
  const bugun = new Date();
  const bugunMu = (d: number) => bugun.getFullYear() === c.year && bugun.getMonth() === c.month && bugun.getDate() === d;
  const kisiVar = (g: AyCizelgesi["days"][number], id: number) => g.assigned.some(p => p.id === id) || g.prep.some(p => p.id === id);
</script>

<div class="takvim" class:vurgulu={vurgu !== null}>
  {#each GUN_KISA as g}<div class="bas" aria-hidden="true">{g}</div>{/each}
  {#each { length: bos } as _}<div class="bosluk" aria-hidden="true"></div>{/each}
  {#each c.days as g (g.day)}
    {@const dw = haftaGunu(c.year, c.month, g.day)}
    {@const rt = resmiTatilMi(c.year, c.month, g.day)}
    {@const ar = arifeMi(c.year, c.month, g.day)}
    {@const eksik = g.assigned.length < 2}
    <button class="gun" class:tatil={g.tatil} class:sorun={g.conflict || eksik} class:bugun={bugunMu(g.day)}
      class:vurgu={vurgu !== null && kisiVar(g, vurgu)} class:soluk={vurgu !== null && !kisiVar(g, vurgu)}
      onclick={() => gunAc(g.day)}
      aria-label="{gunMetni(c.year, c.month, g.day)}: nöbetçi {g.assigned.map(p => p.name).join(' ve ') || 'yok'}{g.prep.length ? ', hazırlama ' + g.prep.map(p => p.name).join(' ve ') : ''}{g.conflict ? ', kural esnetildi' : ''}{g.locked ? ', elle düzenlendi' : ''}">
      <span class="ust">
        <span class="no rakam">{g.day}</span>
        <span class="gunadi">{GUN_UZUN[dw]}</span>
        {#if rt}<span class="etiket resmi">Resmi tatil</span>{:else if ar}<span class="etiket arife">Arife</span>{/if}
        <span class="simgeler">
          {#if g.conflict || eksik}<span class="sorun-simge" title="Bu günde kural esnetildi ya da kişi eksik"><Ikon ad="uyari" boyut={15} /></span>{/if}
          {#if g.locked}<span class="kilit" title="Elle düzenlendi; yeniden oluşturmada korunur"><Ikon ad="kilit" boyut={14} /></span>{/if}
        </span>
      </span>
      <span class="kisiler">
        {#each eczaciOnce(g.assigned) as p}
          <span class="nobetci" class:ben={p.id === vurgu}><span class="isaret {p.role}"></span><span class="ad">{p.name}</span></span>
        {/each}
        {#each g.prep as p, i}
          <span class="haz" class:ben={p.id === vurgu}><b>H{i + 1}</b><span class="ad">{p.name}</span></span>
        {/each}
      </span>
    </button>
  {/each}
</div>

<style>
  .takvim { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
  .bas { text-align: center; font-size: var(--f-xs); font-weight: 600; color: var(--soluk); padding-bottom: 2px; }
  .gun { display: flex; flex-direction: column; gap: 6px; min-height: 108px; padding: 8px 9px; text-align: left; border: 1px solid var(--cizgi); border-radius: var(--r-kucuk); background: var(--yuzey); cursor: pointer; min-width: 0; transition: opacity .15s, border-color .12s; }
  .gun:hover { border-color: var(--soluk); }
  .gun.tatil { background: var(--tatil-zemin); }
  .gun.bugun { box-shadow: inset 0 0 0 2px var(--odak); }
  .gun.sorun { border-color: var(--hata); }
  .vurgulu .gun.soluk { opacity: .38; }
  .vurgulu .gun.vurgu { border-color: var(--vurgu); box-shadow: inset 0 0 0 1px var(--vurgu); }
  .ust { display: flex; align-items: center; gap: 6px; min-height: 18px; }
  .no { font-weight: 600; font-size: var(--f-sm); color: var(--yazi-2); }
  .gunadi { display: none; }
  .etiket { font-size: var(--f-xs); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .etiket.resmi { color: var(--tatil); } .etiket.arife { color: var(--arife); }
  .simgeler { margin-left: auto; display: inline-flex; gap: 3px; align-items: center; }
  .sorun-simge { color: var(--hata); display: inline-flex; }
  .kilit { color: var(--soluk); display: inline-flex; }
  .kisiler { display: grid; gap: 2px; min-width: 0; }
  .nobetci, .haz { display: flex; align-items: baseline; gap: 6px; font-size: 13px; line-height: 1.3; min-width: 0; border-radius: 4px; }
  .nobetci .isaret { transform: translateY(-1px); }
  .nobetci .ad { font-weight: 500; }
  .ad { min-width: 0; overflow-wrap: anywhere; }
  .haz { color: var(--yazi-2); }
  .haz b { font-size: var(--f-xs); color: var(--haz); font-weight: 600; flex: none; }
  .ben { background: var(--vurgu-zemin); box-shadow: 0 0 0 2px var(--vurgu-zemin); }

  /* telefon: gün gün liste */
  @media (max-width: 720px) {
    .takvim { grid-template-columns: 1fr; gap: 0; }
    .bas, .bosluk { display: none; }
    .gun { flex-direction: row; align-items: flex-start; min-height: 0; padding: 10px 12px; border-radius: 0; border-width: 0 0 1px; gap: 12px; }
    .gun:first-of-type { border-top-left-radius: var(--r); border-top-right-radius: var(--r); }
    .gun.sorun { border-left: 3px solid var(--hata); border-bottom-color: var(--cizgi); }
    .ust { flex-direction: column; align-items: flex-start; gap: 0; width: 76px; flex: none; }
    .no { font-size: var(--f-lg); color: var(--yazi); }
    .gunadi { display: block; font-size: var(--f-xs); color: var(--soluk); }
    .simgeler { margin: 2px 0 0; }
    .kisiler { flex: 1; grid-template-columns: 1fr 1fr; gap: 2px 10px; }
    .nobetci, .haz { font-size: var(--f-sm); }
  }
  @media (max-width: 380px) { .kisiler { grid-template-columns: 1fr; } }
</style>
