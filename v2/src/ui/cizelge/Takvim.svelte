<script lang="ts">
  // Ayın çizelgesi: kenarlıklı 7 sütunlu ızgara. Her günün üstünde tarih şeridi (hafta sonu açık mavi), nöbetçiler
  // görev etiketiyle (ECZ / TEK), hafta sonu hazırlamacılar kesik çizginin altında (H1 / H2). Seçili gün altın sarısı
  // çerçeveli. Telefonda dar hücrelerde kısa adlar.
  import type { AyCizelgesi, Gorevli } from "../../veri/tipler";
  import { GUN_KISA, gunMetni, haftaGunu, kisaAd } from "../../veri/tarih";
  import { depo, resmiTatilMi, arifeMi } from "../../veri/depo.svelte";
  import Ikon from "../ortak/Ikon.svelte";

  let { c, vurgu = null, secili = null, gunAc, degisen }: { c: AyCizelgesi; vurgu?: number | null; secili?: number | null; gunAc: (gun: number) => void; degisen?: Set<number> } = $props();

  const bos = $derived(haftaGunu(c.year, c.month, 1));
  const tumAdlar = $derived(depo.veri.staff.map(k => k.name));
  const kisa = (ad: string) => kisaAd(ad, tumAdlar);
  const eczaciMi = (p: Gorevli) => p.role === "eczaci" || p.role === "nobetci";
  const eczaciOnce = (l: Gorevli[]) => [...l].sort((a, b) => Number(eczaciMi(b)) - Number(eczaciMi(a)));
  const etiket = (p: Gorevli) => (eczaciMi(p) ? { s: "ecz", t: "ECZ" } : p.role === "destek" ? { s: "des", t: "DES" } : { s: "tek", t: "TEK" });
  const bugun = new Date();
  const bugunMu = (d: number) => bugun.getFullYear() === c.year && bugun.getMonth() === c.month && bugun.getDate() === d;
  const kisiVar = (g: AyCizelgesi["days"][number], id: number) => g.assigned.some(p => p.id === id) || g.prep.some(p => p.id === id);
</script>

<div class="takvim" class:vurgulu={vurgu !== null}>
  {#each GUN_KISA as g, i}<div class="bas" class:hs={i >= 5} aria-hidden="true">{g}</div>{/each}
  {#each { length: bos } as _}<div class="bosluk" aria-hidden="true"></div>{/each}
  {#each c.days as g (g.day)}
    {@const dw = haftaGunu(c.year, c.month, g.day)}
    {@const rt = resmiTatilMi(c.year, c.month, g.day)}
    {@const ar = arifeMi(c.year, c.month, g.day)}
    {@const eksik = g.assigned.length < 2}
    <button class="gun" class:hs={g.tatil} class:sorun={g.conflict || eksik} class:secili={secili === g.day} class:bugun={bugunMu(g.day)}
      class:vurgu={vurgu !== null && kisiVar(g, vurgu)} class:soluk={vurgu !== null && !kisiVar(g, vurgu)}
      onclick={() => gunAc(g.day)} aria-pressed={secili === g.day}
      aria-label="{gunMetni(c.year, c.month, g.day)}: nöbetçi {g.assigned.map(p => p.name).join(' ve ') || 'yok'}{g.prep.length ? ', hazırlama ' + g.prep.map(p => p.name).join(' ve ') : ''}{g.conflict ? ', kural esnetildi' : ''}{g.locked ? ', elle düzenlendi' : ''}">
      <span class="serit">
        <b class="rakam">{g.day}</b><span class="gunadi">{GUN_KISA[dw]}</span>
        {#if rt}<span class="etiket">Resmi tatil</span>{:else if ar}<span class="etiket">Arife</span>{/if}
        <span class="simgeler">
          {#if g.conflict || eksik}<span class="sorun-simge" title="Bu günde kural esnetildi ya da kişi eksik"><Ikon ad="uyari" boyut={14} /></span>{/if}
          {#if degisen?.has(g.day)}<span class="degisti" title="Bu günde nöbet değişimi var">değişti</span>{/if}
          {#if g.locked}<span class="kilit" title="Elle düzenlendi; yeniden oluşturmada korunur"><Ikon ad="kilit" boyut={13} /></span>{/if}
        </span>
      </span>
      <span class="kisiler">
        {#each eczaciOnce(g.assigned) as p}
          {@const e = etiket(p)}
          <span class="kisi" class:ben={p.id === vurgu}><span class="gorev {e.s}">{e.t}</span><span class="ad">{p.name}</span><span class="ad-kisa">{kisa(p.name)}</span></span>
        {/each}
        {#if g.prep.length}
          <span class="haz-ayrac" aria-hidden="true"></span>
          {#each g.prep as p, i}
            <span class="kisi" class:ben={p.id === vurgu}><span class="gorev haz">H{i + 1}</span><span class="ad">{p.name}</span><span class="ad-kisa">{kisa(p.name)}</span></span>
          {/each}
        {/if}
      </span>
    </button>
  {/each}
</div>

<style>
  .takvim { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); border-top: 1px solid var(--cizgi); border-left: 1px solid var(--cizgi); }
  .bas, .bosluk, .gun { border-right: 1px solid var(--cizgi); border-bottom: 1px solid var(--cizgi); }
  .bas { background: var(--tablo-bas); color: var(--lacivert); font-size: var(--f-xs); font-weight: 700; text-align: center; padding: 6px 0; letter-spacing: .03em; }
  .bosluk { background: var(--yuzey-2); }
  .gun { display: flex; flex-direction: column; min-height: 112px; padding: 0; text-align: left; background: var(--yuzey); cursor: pointer; min-width: 0; border-top: 0; border-left: 0; border-radius: 0; position: relative; transition: opacity .15s; }
  .gun:hover { background: var(--yuzey-2); }
  .gun:focus-visible { outline: 2px solid var(--odak); outline-offset: -2px; }
  .serit { display: flex; align-items: center; gap: 6px; min-height: 24px; padding: 2px 8px; background: var(--panel-bas); border-bottom: 1px solid var(--cizgi-acik); font-size: var(--f-xs); color: var(--yazi-2); }
  .gun.hs .serit { background: color-mix(in srgb, var(--acik-mavi) 28%, var(--yuzey)); color: var(--lacivert); }
  .serit b { font-size: var(--f-sm); color: var(--lacivert); }
  .etiket { font-weight: 700; color: var(--lacivert); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .simgeler { margin-left: auto; display: inline-flex; gap: 3px; align-items: center; }
  .sorun-simge { color: var(--hata); display: inline-flex; }
  .kilit { color: var(--soluk); display: inline-flex; }
  .gun.sorun .serit { box-shadow: inset 0 -2px 0 var(--hata); }
  .gun.bugun .serit b { text-decoration: underline; text-underline-offset: 3px; }
  .gun.secili { box-shadow: inset 0 0 0 3px var(--altin); z-index: 1; }
  .kisiler { display: grid; gap: 3px; padding: 6px 8px 8px; min-width: 0; }
  .kisi { display: flex; align-items: center; gap: 6px; font-size: 13px; line-height: 1.3; min-width: 0; border-radius: 2px; }
  .ad { min-width: 0; overflow-wrap: anywhere; font-weight: 600; color: var(--yazi); }
  .haz-ayrac { border-top: 1px dashed var(--cizgi); margin: 2px 0 1px; }
  .haz-ayrac ~ .kisi .ad { font-weight: 400; color: var(--yazi-2); }
  .vurgulu .gun.soluk { opacity: .38; }
  .vurgulu .gun.vurgu { box-shadow: inset 0 0 0 2px var(--lacivert); }
  .ben { background: var(--vurgu-zemin); box-shadow: 0 0 0 2px var(--vurgu-zemin); }
  .ad-kisa { display: none; }
  .degisti { font-size: var(--f-xs); font-weight: 700; color: var(--izin); white-space: nowrap; }
  @media (max-width: 720px) {
    .bas { font-size: 11px; padding: 4px 0; }
    .gun { min-height: 76px; }
    .serit { padding: 1px 3px; gap: 2px; min-height: 18px; }
    .serit b { font-size: 12px; }
    .gunadi, .etiket { display: none; }
    .simgeler :global(svg) { width: 11px; height: 11px; }
    .degisti { font-size: 0; width: 6px; height: 6px; border-radius: 50%; background: var(--izin); }
    .kisiler { padding: 3px 3px 4px; gap: 1px; }
    .kisi { font-size: 10.5px; gap: 2px; }
    .gorev { min-width: 0; width: 5px; height: 12px; padding: 0; font-size: 0; }
    .ad { display: none; }
    .ad-kisa { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
  }
</style>
