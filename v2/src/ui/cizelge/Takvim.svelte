<script lang="ts">
  // Ayın çizelgesi, haftalık form takvimi (ortak stil: stil.css ".ht"): her hafta ayrı blok, solda hafta numarası;
  // her günde tarih başlığı ve görev etiketli satırlar (ECZ / TEK / DES, hazırlama varsa HAZ). Hafta içi günlerde
  // hazırlama satırı yoktur. Hafta sonu başlığı turkuaz, bugün vurgu rengi. Telefonda etiketsiz, kısa adlar.
  import type { AyCizelgesi, Gorevli } from "../../veri/tipler";
  import { GUN_KISA, GUN_UZUN, gunMetni, haftaGunu, kisaAd } from "../../veri/tarih";
  import { depo, resmiTatilMi, arifeMi } from "../../veri/depo.svelte";
  import Ikon from "../ortak/Ikon.svelte";

  let { c, vurgu = null, secili = null, gunAc, degisen }: { c: AyCizelgesi; vurgu?: number | null; secili?: number | null; gunAc: (gun: number) => void; degisen?: Set<number> } = $props();

  type Gun = AyCizelgesi["days"][number];
  const tumAdlar = $derived(depo.veri.staff.map(k => k.name));
  const kisa = (ad: string) => kisaAd(ad, tumAdlar);
  const eczaciMi = (p: Gorevli) => p.role === "eczaci" || p.role === "nobetci";
  const eczaciOnce = (l: Gorevli[]) => [...l].sort((a, b) => Number(eczaciMi(b)) - Number(eczaciMi(a)));
  const etiket = (p: Gorevli) => (eczaciMi(p) ? { s: "ecz", t: "ECZ" } : p.role === "destek" ? { s: "des", t: "DES" } : { s: "tek", t: "TEK" });
  const bugun = new Date();
  const bugunMu = (d: number) => bugun.getFullYear() === c.year && bugun.getMonth() === c.month && bugun.getDate() === d;
  const kisiVar = (g: Gun, id: number) => g.assigned.some(p => p.id === id) || g.prep.some(p => p.id === id);
  const iki = (n: number) => String(n).padStart(2, "0");
  // haftalar (Pazartesi başlar): 7'şer hücre, ay dışı günler boş
  const haftalar = $derived.by(() => {
    const h: (Gun | null)[] = [...Array(haftaGunu(c.year, c.month, 1)).fill(null), ...c.days];
    while (h.length % 7) h.push(null);
    return Array.from({ length: h.length / 7 }, (_, i) => h.slice(i * 7, i * 7 + 7));
  });
</script>

<div class="ht" class:vurgulu={vurgu !== null}>
  <div class="ht-bas" aria-hidden="true"><span></span>{#each GUN_UZUN as g, i}<span class:hs={i >= 5}><span class="g-uzun">{g}</span><span class="g-kisa">{GUN_KISA[i]}</span></span>{/each}</div>
  {#each haftalar as h, w}
    <div class="ht-hafta">
      <div class="ht-no" aria-hidden="true"><b class="rakam">{w + 1}</b><small>HAFTA</small></div>
      {#each h as g, i (i)}
        {#if !g}<div class="ht-bos" aria-hidden="true"></div>
        {:else}
          {@const dw = haftaGunu(c.year, c.month, g.day)}
          {@const rt = resmiTatilMi(c.year, c.month, g.day)}
          {@const ar = arifeMi(c.year, c.month, g.day)}
          {@const eksik = g.assigned.length < 2 || !g.assigned.some(eczaciMi)}
          <button class="ht-gun" class:hs={g.tatil} class:sorun={g.conflict || eksik} class:secili={secili === g.day} class:bugun={bugunMu(g.day)}
            class:vurgu={vurgu !== null && kisiVar(g, vurgu)} class:soluk={vurgu !== null && !kisiVar(g, vurgu)}
            onclick={() => gunAc(g.day)} aria-pressed={secili === g.day}
            aria-label="{gunMetni(c.year, c.month, g.day)}: nöbetçi {g.assigned.map(p => p.name).join(' ve ') || 'yok'}{g.prep.length ? ', hazırlama ' + g.prep.map(p => p.name).join(' ve ') : ''}{g.conflict ? ', kural esnetildi' : ''}{g.locked ? ', elle düzenlendi' : ''}">
            <span class="ht-ust">
              <span class="rakam t-uzun">{iki(g.day)}.{iki(c.month + 1)}.{c.year}</span><span class="rakam t-kisa">{g.day}</span>
              <span class="ht-sag">
                {#if g.conflict || eksik}<span class="sorun-simge" title="Bu günde kural esnetildi, kişi eksik ya da eczacı yok"><Ikon ad="uyari" boyut={13} /></span>{/if}
                {#if degisen?.has(g.day)}<span class="degisti" title="Bu günde nöbet değişimi var">değişti</span>{/if}
                {#if g.locked}<span class="kilit" title="Elle düzenlendi; yeniden oluşturmada korunur"><Ikon ad="kilit" boyut={12} /></span>{/if}
                <span class="gunadi">{rt ? "Resmi tatil" : ar ? "Arife" : GUN_KISA[dw]}</span>
              </span>
            </span>
            {#each eczaciOnce(g.assigned) as p (p.id)}
              {@const e = etiket(p)}
              <span class="ht-satir {e.s}"><span class="ht-et">{e.t}</span><span class="ht-ad"><span class:ben={p.id === vurgu}><span class="ad">{p.name}</span><span class="ad-kisa">{kisa(p.name)}</span></span></span></span>
            {:else}
              <span class="ht-satir yok"><span class="ht-et">—</span><span class="ht-ad"><span><span class="ad">Nöbetçi yok</span><span class="ad-kisa">–</span></span></span></span>
            {/each}
            {#if g.prep.length}
              <span class="ht-satir haz" title={g.prep.map(p => p.name).join(", ")}><span class="ht-et">HAZ</span><span class="ht-ad"><span>{#each g.prep as p, j (p.id)}{j ? ", " : ""}<span class:ben={p.id === vurgu}>{kisa(p.name)}</span>{/each}</span></span></span>
            {/if}
          </button>
        {/if}
      {/each}
    </div>
  {/each}
</div>
