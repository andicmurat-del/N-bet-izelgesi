<script lang="ts">
  // Ayın çizelgesi: koyu petrol çerçeveli 7 sütunlu ızgara. Günün rakamı hücrenin arka planında büyük ve silik; üstte
  // küçük tarih ve işaretler; nöbetçi adları ortada (eczacı koyu, tekniker açık petrol, destek gri), hafta sonu
  // hazırlamacılar altta turuncu. Hafta sonu altın şeritli. Seçili gün altın sarısı çerçeveli. Telefonda kısa adlar.
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
  {#each GUN_KISA as g, i}<div class="bas" class:hs={i >= 5} aria-hidden="true">{g.toLocaleUpperCase("tr")}</div>{/each}
  {#each { length: bos } as _}<div class="bosluk" aria-hidden="true"></div>{/each}
  {#each c.days as g (g.day)}
    {@const dw = haftaGunu(c.year, c.month, g.day)}
    {@const rt = resmiTatilMi(c.year, c.month, g.day)}
    {@const ar = arifeMi(c.year, c.month, g.day)}
    {@const eksik = g.assigned.length < 2 || !g.assigned.some(p => p.role === "eczaci" || p.role === "nobetci")}
    <button class="gun" class:hs={g.tatil} class:rt class:sorun={g.conflict || eksik} class:secili={secili === g.day} class:bugun={bugunMu(g.day)}
      class:vurgu={vurgu !== null && kisiVar(g, vurgu)} class:soluk={vurgu !== null && !kisiVar(g, vurgu)}
      onclick={() => gunAc(g.day)} aria-pressed={secili === g.day}
      aria-label="{gunMetni(c.year, c.month, g.day)}: nöbetçi {g.assigned.map(p => p.name).join(' ve ') || 'yok'}{g.prep.length ? ', hazırlama ' + g.prep.map(p => p.name).join(' ve ') : ''}{g.conflict ? ', kural esnetildi' : ''}{g.locked ? ', elle düzenlendi' : ''}">
      <span class="dev rakam" aria-hidden="true">{g.day}</span>
      <span class="ust">
        <b class="rakam">{g.day}</b><span class="gunadi">{GUN_KISA[dw]}</span>
        {#if rt}<span class="etiket">Resmi tatil</span>{:else if ar}<span class="etiket">Arife</span>{/if}
        <span class="simgeler">
          {#if g.conflict || eksik}<span class="sorun-simge" title="Bu günde kural esnetildi, kişi eksik ya da eczacı yok"><Ikon ad="uyari" boyut={14} /></span>{/if}
          {#if degisen?.has(g.day)}<span class="degisti" title="Bu günde nöbet değişimi var">değişti</span>{/if}
          {#if g.locked}<span class="kilit" title="Elle düzenlendi; yeniden oluşturmada korunur"><Ikon ad="kilit" boyut={13} /></span>{/if}
        </span>
      </span>
      <span class="kisiler">
        {#each eczaciOnce(g.assigned) as p}
          {@const e = etiket(p)}
          <span class="kisi {e.s}" class:ben={p.id === vurgu}><span class="ad">{p.name}</span><span class="ad-kisa">{kisa(p.name)}</span></span>
        {/each}
      </span>
      {#if g.prep.length}
        <span class="haz"><span class="haz-et">Haz.</span>{#each g.prep as p, i}{i ? ", " : ""}<span class:ben={p.id === vurgu}><span class="ad">{p.name}</span><span class="ad-kisa">{kisa(p.name)}</span></span>{/each}</span>
      {/if}
    </button>
  {/each}
  {#each { length: (7 - ((bos + c.days.length) % 7)) % 7 } as _}<div class="bosluk" aria-hidden="true"></div>{/each}
</div>

<style>
  /* koyu petrol çerçeve: hücreler arası 1 px boşluktan çerçeve rengi görünür */
  .takvim { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 1px; background: color-mix(in srgb, var(--serit) 82%, var(--acik-mavi)); border: 1px solid var(--serit); }
  .bas { background: var(--serit); color: #9FC7CE; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-align: center; padding: 8px 0; }
  .bosluk { background: color-mix(in srgb, var(--yuzey-2) 70%, var(--yuzey)); }
  .gun { position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 2px; min-height: 116px; padding: 8px 10px 10px; text-align: left; background: var(--yuzey); cursor: pointer; min-width: 0; border: 0; border-radius: 0; transition: opacity .15s; }
  .gun > :not(.dev) { position: relative; }
  .gun:hover { background: color-mix(in srgb, var(--vurgu-zemin) 45%, var(--yuzey)); }
  .gun:focus-visible { outline: 2px solid var(--odak); outline-offset: -2px; }
  .gun.hs { background: color-mix(in srgb, var(--altin) 7%, var(--yuzey)); }
  .gun.hs::before { content: ""; position: absolute; inset: 0 0 auto 0; height: 3px; background: var(--altin); }
  .gun.rt { background: color-mix(in srgb, var(--acik-mavi) 16%, var(--yuzey)); }
  .dev { position: absolute; right: 6px; bottom: -12px; font-size: 64px; font-weight: 800; line-height: 1; color: color-mix(in srgb, var(--lacivert) 7%, transparent); pointer-events: none; }
  .ust { display: flex; align-items: center; gap: 5px; min-height: 18px; font-size: 11px; font-weight: 700; color: var(--soluk); }
  .ust b { font-size: 11px; color: var(--soluk); }
  .gun.bugun .ust b { color: var(--vurgu-yazi); background: var(--vurgu); border-radius: 999px; padding: 0 6px; }
  .etiket { color: var(--lacivert); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .simgeler { margin-left: auto; display: inline-flex; gap: 3px; align-items: center; }
  .sorun-simge { color: var(--hata); display: inline-flex; }
  .kilit { color: var(--soluk); display: inline-flex; }
  .gun.sorun { box-shadow: inset 0 -3px 0 var(--hata); }
  .gun.secili { box-shadow: inset 0 0 0 3px var(--altin); z-index: 1; }
  .kisiler { display: grid; gap: 1px; min-width: 0; margin-top: 2px; }
  .kisi { min-width: 0; line-height: 1.25; border-radius: 3px; }
  .kisi.ecz { font-size: 15px; font-weight: 700; color: var(--lacivert); }
  .kisi.tek { font-size: 13.5px; font-weight: 600; color: var(--tek); }
  .kisi.des { font-size: 13.5px; font-weight: 600; color: var(--destek); }
  .ad { overflow-wrap: anywhere; }
  .haz { margin-top: auto; padding-top: 4px; font-size: 11.5px; color: var(--haz); line-height: 1.3; }
  .haz-et { font-weight: 700; margin-right: 4px; }
  .vurgulu .gun.soluk { opacity: .38; }
  .vurgulu .gun.vurgu { box-shadow: inset 0 0 0 2px var(--lacivert); }
  .ben { background: var(--vurgu-zemin); box-shadow: 0 0 0 2px var(--vurgu-zemin); }
  .ad-kisa { display: none; }
  .degisti { font-size: 11px; font-weight: 700; color: var(--izin); white-space: nowrap; }
  @media (max-width: 720px) {
    .bas { font-size: 10px; letter-spacing: .04em; padding: 5px 0; }
    .gun { min-height: 84px; padding: 4px 4px 5px; }
    .dev { font-size: 38px; bottom: -8px; right: 2px; }
    .ust { gap: 2px; min-height: 14px; }
    .gunadi, .etiket { display: none; }
    .simgeler :global(svg) { width: 11px; height: 11px; }
    .degisti { font-size: 0; width: 6px; height: 6px; border-radius: 50%; background: var(--izin); }
    .kisi.ecz { font-size: 11.5px; }
    .kisi.tek, .kisi.des { font-size: 11px; }
    .ad { display: none; }
    .ad-kisa { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .haz { font-size: 10px; padding-top: 2px; }
    .haz .ad-kisa { display: inline; }
    .haz-et { display: none; }
  }
</style>
