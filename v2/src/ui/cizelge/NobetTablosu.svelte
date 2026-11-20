<script lang="ts" module>
  /** liste görünümünün süzgeci: tümü, hafta içi, hafta sonu, değişen, kural esnetilen, elle düzenlenen */
  export type Filtre = "tumu" | "hi" | "hs" | "degisen" | "esnek" | "elle";
</script>

<script lang="ts">
  // Nöbet Listesi > Liste: süzgeç düğmeleri (hafta içi / hafta sonu / değişen / kural esnetilen / elle), kişi seçimi ve ad
  // arama; günler haftalara göre gruplanır. Satıra dokunmak günü seçer.
  import { depo, resmiTatilMi, notluGunler } from "../../veri/depo.svelte";
  import { AYLAR, GUN_UZUN, adIcerir, ayAdi, haftaGunu } from "../../veri/tarih";
  import type { AyCizelgesi, Kisi } from "../../veri/tipler";
  import Ikon from "../ortak/Ikon.svelte";
  import VurguSecici from "../ortak/VurguSecici.svelte";

  type Gun = AyCizelgesi["days"][number];
  let {
    gunler,
    degisen,
    baslikEk,
    nobetci,
    seciliGun,
    gunAc,
    vurgu = $bindable(),
    filtre = $bindable(),
    kisiF = $bindable(),
    ara = $bindable(),
  }: {
    /** gösterilen çizelge (asıl ya da nöbet değişimleri işlenmiş güncel hâli) */
    gunler: AyCizelgesi;
    /** güncel listede değişen günler */
    degisen?: Set<number>;
    baslikEk: string;
    nobetci: Kisi[];
    seciliGun: number;
    gunAc: (d: number) => void;
    vurgu: number | null;
    filtre: Filtre;
    kisiF: number | null;
    ara: string;
  } = $props();
  const eczaciRol = (r: string) => r === "eczaci" || r === "nobetci";
  // dar ekran (telefon): tablo yerine gün kartları
  const DAR = "(max-width: 720px)";
  let dar = $state(typeof matchMedia !== "undefined" && matchMedia(DAR).matches);
  $effect(() => {
    const mq = matchMedia(DAR),
      degis = () => (dar = mq.matches);
    mq.addEventListener("change", degis);
    return () => mq.removeEventListener("change", degis);
  });
  const degistiMi = (g: Gun) => !!degisen?.has(g.day);
  const notSay = $derived(notluGunler(depo.yil, depo.ay));
  const filtreUy: Record<Filtre, (g: Gun) => boolean> = {
    tumu: () => true,
    hi: g => !g.tatil,
    hs: g => g.tatil,
    degisen: degistiMi,
    esnek: g => !!g.conflict || g.assigned.length < 2 || !g.assigned.some(p => eczaciRol(p.role)),
    elle: g => !!g.locked,
  };
  const FILTRELER: [Filtre, string][] = [
    ["tumu", "Tümü"],
    ["hi", "Hafta içi"],
    ["hs", "Hafta sonu"],
    ["degisen", "Değişen"],
    ["esnek", "Kural esnetilen"],
    ["elle", "Elle"],
  ];
  const kisiUyar = (g: Gun) => {
    const l = [...g.assigned, ...(g.tatil ? g.prep : [])];
    if (kisiF !== null && !l.some(p => p.id === kisiF)) return false;
    return !ara.trim() || l.some(p => adIcerir(p.name, ara));
  };
  const filtreSayisi = $derived(
    Object.fromEntries(FILTRELER.map(([f]) => [f, gunler.days.filter(g => filtreUy[f](g) && kisiUyar(g)).length])) as Record<
      Filtre,
      number
    >,
  );
  // haftalar (Pazartesi başlar): [hafta no, yarım mı, günler]
  const haftalar = $derived.by(() => {
    const ilk = haftaGunu(depo.yil, depo.ay, 1),
      n = gunler.days.length;
    const h: { no: number; yarim: boolean; gunler: Gun[] }[] = [];
    for (const g of gunler.days) {
      const w = Math.floor((g.day - 1 + ilk) / 7);
      if (!h[w]) {
        const bas = w * 7 - ilk + 1;
        h[w] = { no: w + 1, yarim: bas < 1 || bas + 6 > n, gunler: [] };
      }
      if (filtreUy[filtre](g) && kisiUyar(g)) h[w].gunler.push(g);
    }
    return h.filter(x => x.gunler.length);
  });
</script>

{#snippet adlar(l: { id: number; name: string }[])}
  {#each l as p, i (p.id)}{i ? ", " : ""}{#if p.id === vurgu}<mark class="vurgu-ad">{p.name}</mark>{:else}{p.name}{/if}{:else}—{/each}
{/snippet}
{#snippet etiketler(g: Gun, rt: boolean)}
  {#if degistiMi(g)}<span class="etk degisti">değişti</span>{/if}
  {#if g.assigned.length && !g.assigned.some(p => eczaciRol(p.role))}<span class="etk esnek"><Ikon ad="uyari" boyut={12} />eczacı yok</span
    >{:else if g.conflict || g.assigned.length < (g.nobetSay ?? 2)}<span class="etk esnek"
      ><Ikon ad="uyari" boyut={12} />kural esnetildi</span
    >{/if}
  {#if g.locked}<span class="etk elle"><Ikon ad="kilit" boyut={12} />elle</span>{/if}
  {#if g.fmNobet !== undefined || g.fmHaz !== undefined}<span class="etk elle" title="Fazla mesai elle yazıldı"
      >{g.fmNobet !== undefined ? `nöbet ${g.fmNobet} sa` : ""}{g.fmNobet !== undefined && g.fmHaz !== undefined ? " · " : ""}{g.fmHaz !==
      undefined
        ? `haz. ${g.fmHaz} sa`
        : ""}</span
    >{/if}
  {#if rt}<span class="etk hsr">resmi tatil</span>{:else if g.tatil}<span class="etk hsr">hafta sonu</span>{/if}
{/snippet}
<section class="panel" aria-label="Liste">
  <div class="panel-bas">
    <h2>{ayAdi(depo.yil, depo.ay)} nöbet listesi{baslikEk}</h2>
    <VurguSecici kisiler={nobetci} bind:vurgu />
  </div>
  <div class="filtreler">
    <div class="cipler" role="group" aria-label="Günleri süz">
      {#each FILTRELER as [f, ad]}<button class="cip" aria-pressed={filtre === f} onclick={() => (filtre = f)}
          >{ad} <span class="rakam">{filtreSayisi[f]}</span></button
        >{/each}
    </div>
    <div class="ara">
      <select bind:value={kisiF} aria-label="Kişi"
        ><option value={null}>Kişi: Tümü</option>{#each nobetci as k (k.id)}<option value={k.id}>{k.name}</option>{/each}</select
      >
      <input type="search" bind:value={ara} placeholder="Ad ara" aria-label="Ad ara" />
    </div>
  </div>
  {#if dar}
    <!-- telefonda: her gün bir kart (tablo yana kaymasın; bütün görevliler görünsün) -->
    <div class="kartlar">
      {#each haftalar as h (h.no)}
        <h3 class="hafta">{h.no}. hafta{h.yarim ? " (yarım)" : ""}</h3>
        {#each h.gunler as g (g.day)}
          {@const rt = resmiTatilMi(depo.yil, depo.ay, g.day)}
          {@const sirali = [...g.assigned].sort((x, y) => Number(eczaciRol(y.role)) - Number(eczaciRol(x.role)))}
          <button
            class="gun-kart"
            class:secili-kart={seciliGun === g.day}
            class:hs={g.tatil}
            class:vurgulu={vurgu !== null && (g.assigned.some(p => p.id === vurgu) || (g.tatil && g.prep.some(p => p.id === vurgu)))}
            onclick={() => gunAc(g.day)}
          >
            <span class="kart-bas"
              ><b class="rakam">{g.day} {AYLAR[depo.ay]}</b>
              <span class="gun-adi">{GUN_UZUN[haftaGunu(depo.yil, depo.ay, g.day)]}</span>{#if notSay[g.day]}<span
                  class="not-simge"
                  title="{notSay[g.day]} not"><Ikon ad="not" boyut={14} /><span class="gizli-yazi">{notSay[g.day]} not</span></span
                >{/if}</span
            >
            <span class="kart-gorev">
              {#each sirali as p (p.id)}<span class="kisi"
                  ><span class="gorev {eczaciRol(p.role) ? 'ecz' : 'tek'}">{eczaciRol(p.role) ? "ECZ" : "TEK"}</span
                  >{#if p.id === vurgu}<mark class="vurgu-ad">{p.name}</mark>{:else}{p.name}{/if}</span
                >{:else}<span class="yok">Nöbetçi yok</span>{/each}
            </span>
            {#if g.tatil}<span class="kart-gorev">
                {#each g.prep as p, i (p.id)}<span class="kisi"
                    ><span class="gorev haz">H{i + 1}</span>{#if p.id === vurgu}<mark class="vurgu-ad">{p.name}</mark
                      >{:else}{p.name}{/if}</span
                  >{:else}<span class="yok">Hazırlamacı yok</span>{/each}
              </span>{/if}
            <span class="kart-etiket">{@render etiketler(g, rt)}</span>
          </button>
        {/each}
      {:else}
        <p class="bos-sonuc">Bu süzgece uyan gün yok.</p>
      {/each}
    </div>
  {:else}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (kaydırılan tablo klavyeyle kaydırılabilsin) -->
    <div class="tablo-kap" tabindex="0" role="region" aria-label="Nöbet listesi tablosu">
      <table class="tablo liste">
        <thead
          ><tr
            ><th>Tarih</th><th>Gün</th><th>Nöbetçi eczacı</th><th>Nöbetçi tekniker</th><th>Hazırlama 1</th><th>Hazırlama 2</th><th>Durum</th
            ></tr
          ></thead
        >
        <tbody>
          {#each haftalar as h (h.no)}
            <tr class="grup"><td colspan="7">{h.no}. hafta{h.yarim ? " (yarım)" : ""}</td></tr>
            {#each h.gunler as g (g.day)}
              {@const ec = g.assigned.filter(p => eczaciRol(p.role))}
              {@const tk = g.assigned.filter(p => !eczaciRol(p.role))}
              {@const rt = resmiTatilMi(depo.yil, depo.ay, g.day)}
              <tr
                class:secili-satir={seciliGun === g.day}
                class:hs={g.tatil}
                class:vurgulu={vurgu !== null && (g.assigned.some(p => p.id === vurgu) || (g.tatil && g.prep.some(p => p.id === vurgu)))}
                onclick={() => gunAc(g.day)}
              >
                <td class="rakam"
                  ><button
                    class="gun-ac"
                    onclick={e => {
                      e.stopPropagation();
                      gunAc(g.day);
                    }}
                    ><b>{g.day} {AYLAR[depo.ay]}</b>{#if notSay[g.day]}<span class="not-simge" title="{notSay[g.day]} not"
                        ><Ikon ad="not" boyut={14} /><span class="gizli-yazi">{notSay[g.day]} not</span></span
                      >{/if}</button
                  ></td
                >
                <td>{GUN_UZUN[haftaGunu(depo.yil, depo.ay, g.day)]}</td>
                <td>{@render adlar(ec)}</td>
                <td>{@render adlar(tk)}</td>
                <td>{@render adlar(g.tatil && g.prep[0] ? [g.prep[0]] : [])}</td>
                <td>{@render adlar(g.tatil ? g.prep.slice(1) : [])}</td>
                <td class="durum">
                  {@render etiketler(g, rt)}
                </td>
              </tr>
            {/each}
          {:else}
            <tr><td colspan="7" class="bos-sonuc">Bu süzgece uyan gün yok.</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>

<style>
  .not-simge {
    color: var(--baglanti);
    display: inline-flex;
    vertical-align: middle;
    margin-left: 4px;
  }
  /* tarih hücresindeki düğme: görünüşte düz yazı, klavyeyle güne erişim için */
  .gun-ac {
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: inherit;
    cursor: pointer;
  }
  .gun-ac:focus-visible {
    outline: 2px solid var(--odak);
    outline-offset: 2px;
  }
  .kartlar {
    display: grid;
    gap: var(--b2);
    padding: var(--b3);
  }
  .hafta {
    margin: var(--b2) 0 0;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--lacivert);
  }
  .hafta:first-child {
    margin-top: 0;
  }
  .gun-kart {
    display: grid;
    gap: 6px;
    width: 100%;
    padding: var(--b3);
    border: 1px solid var(--cizgi);
    border-radius: var(--r);
    background: var(--yuzey);
    color: var(--yazi);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .gun-kart.hs {
    background: color-mix(in srgb, var(--acik-mavi) 14%, var(--yuzey));
  }
  .gun-kart.vurgulu {
    background: color-mix(in srgb, var(--altin) 16%, var(--yuzey));
    box-shadow: inset 3px 0 0 var(--altin);
  }
  .gun-kart.secili-kart {
    border-color: var(--altin);
    box-shadow: 0 0 0 1px var(--altin);
  }
  .kart-bas {
    display: flex;
    align-items: baseline;
    gap: 6px;
    color: var(--lacivert);
  }
  .gun-adi {
    color: var(--yazi-2);
    font-size: var(--f-sm);
  }
  .kart-gorev {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
  }
  .kisi {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    font-size: var(--f-sm);
  }
  .yok {
    color: var(--soluk);
    font-size: var(--f-sm);
  }
  .kart-etiket:empty {
    display: none;
  }
  .liste tbody tr {
    cursor: pointer;
  }
  .liste tbody tr:hover > * {
    background: var(--vurgu-zemin);
  }
  .liste tbody tr.vurgulu > * {
    background: color-mix(in srgb, var(--altin) 16%, var(--yuzey));
  }
  .liste tbody tr.vurgulu > :first-child {
    box-shadow: inset 3px 0 0 var(--altin);
  }
  .vurgu-ad {
    background: color-mix(in srgb, var(--altin) 35%, transparent);
    color: inherit;
    font-weight: 700;
    padding: 0 3px;
    border-radius: 3px;
  }
  .liste tr.secili-satir > * {
    box-shadow:
      inset 0 2px 0 var(--altin),
      inset 0 -2px 0 var(--altin);
  }
  .liste td:nth-child(n + 3):not(.durum) {
    min-width: 150px;
  }
  .liste tr.hs > * {
    background: color-mix(in srgb, var(--acik-mavi) 14%, var(--yuzey));
  }
  .liste tr.grup > td {
    background: var(--panel-bas);
    font-weight: 700;
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--lacivert);
    padding-top: 5px;
    padding-bottom: 5px;
    cursor: default;
  }
  .liste tbody tr.grup:hover > * {
    background: var(--panel-bas);
  }
  .liste tr.secili-satir > * {
    background: color-mix(in srgb, var(--altin) 16%, var(--yuzey));
  }
  .durum,
  .liste td:first-child {
    white-space: nowrap;
  }
  .etk {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: var(--f-xs);
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 2px;
    margin-right: 4px;
  }
  .etk.degisti {
    background: color-mix(in srgb, var(--izin) 14%, var(--yuzey));
    color: var(--izin);
  }
  .etk.esnek {
    background: var(--hata-zemin);
    color: var(--hata);
  }
  .etk.elle {
    background: var(--yuzey-2);
    color: var(--yazi-2);
  }
  .etk.hsr {
    background: color-mix(in srgb, var(--acik-mavi) 30%, var(--yuzey));
    color: var(--lacivert);
  }
  .bos-sonuc {
    color: var(--soluk);
    text-align: center;
    padding: var(--b4);
    cursor: default;
  }
  .filtreler {
    display: flex;
    flex-wrap: wrap;
    gap: var(--b2);
    align-items: center;
    justify-content: space-between;
    padding: var(--b3) var(--b4);
    border-bottom: 1px solid var(--cizgi);
  }
  .cipler {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .cip {
    border: 1px solid var(--cizgi);
    background: var(--yuzey);
    color: var(--yazi);
    padding: 5px 12px;
    border-radius: 999px;
    font-weight: 600;
    font-size: var(--f-sm);
    cursor: pointer;
    min-height: 32px;
  }
  .cip span {
    color: var(--yazi-2);
    font-weight: 500;
  }
  .cip[aria-pressed="true"] {
    background: var(--vurgu);
    border-color: var(--vurgu);
    color: var(--vurgu-yazi);
  }
  .cip[aria-pressed="true"] span {
    color: var(--vurgu-yazi);
    opacity: 0.85;
  }
  .ara {
    display: flex;
    gap: 6px;
  }
  .ara select,
  .ara input {
    min-height: 34px;
    padding: 0 var(--b3);
    font-size: var(--f-sm);
    border: 1px solid var(--cizgi);
    border-radius: var(--r-kucuk);
    background: var(--yuzey);
    color: var(--yazi);
  }
  .ara select:hover,
  .ara input:hover {
    border-color: var(--soluk);
  }
  .ara select:focus-visible,
  .ara input:focus-visible {
    outline: none;
    border-color: var(--vurgu);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--vurgu) 22%, transparent);
  }
  .ara input {
    width: 180px;
  }
  @media (max-width: 720px) {
    .ara {
      width: 100%;
    }
    .ara select,
    .ara input {
      flex: 1;
      min-width: 0;
      width: auto;
    }
  }
</style>
