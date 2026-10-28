<script lang="ts">
  // Bir günü elle düzenleme: nöbetçiler ve (tatil günüyse) hazırlama. Seçim değiştikçe kurallar anında denetlenir.
  import { gunuDenetle } from "../../motor";
  import { depo, gunuGuncelle, gunKilidiniKaldir, aydaCalisanlar, resmiTatilMi, arifeMi } from "../../veri/depo.svelte";
  import type { AyCizelgesi, Gorevli, Kisi } from "../../veri/tipler";
  import { ROL_AD } from "../../veri/tipler";
  import { gunMetni, isoTarih } from "../../veri/tarih";
  import Pencere from "../ortak/Pencere.svelte";
  import Ikon from "../ortak/Ikon.svelte";

  let { acik = $bindable(false), c, gun }: { acik?: boolean; c: AyCizelgesi; gun: number } = $props();

  const g = $derived(c.days[gun - 1]);
  const onayli = $derived(!!c.onay);
  const iso = $derived(isoTarih(c.year, c.month, gun));
  const calisiyor = (k: Kisi) => !(k.baslangic && iso < k.baslangic) && !(k.bitis && iso > k.bitis);
  const tum = $derived(aydaCalisanlar(c.year, c.month).filter(k => k.role !== "servis" && calisiyor(k)).sort((a, b) => a.name.localeCompare(b.name, "tr")));
  const nobetAday = $derived(tum.filter(k => k.role !== "destek"));
  const hazAday = $derived(tum);

  let n1 = $state(""), n2 = $state(""), h1 = $state(""), h2 = $state("");
  $effect(() => {
    if (!acik) return;
    const ec = [...g.assigned].sort((a, b) => Number(b.role === "eczaci" || b.role === "nobetci") - Number(a.role === "eczaci" || a.role === "nobetci"));
    n1 = String(ec[0]?.id ?? ""); n2 = String(ec[1]?.id ?? "");
    h1 = String(g.prep[0]?.id ?? ""); h2 = String(g.prep[1]?.id ?? "");
  });
  const kisi = (id: string): Gorevli | null => { const k = depo.veri.staff.find(x => String(x.id) === id); return k ? { id: k.id, name: k.name, role: k.role } : null; };
  const nb = $derived([n1, n2].filter(Boolean).map(kisi).filter((x): x is Gorevli => !!x));
  const pr = $derived(g.tatil ? [h1, h2].filter(Boolean).map(kisi).filter((x): x is Gorevli => !!x) : []);
  const ayniKisi = $derived((n1 && n1 === n2) || (h1 && h1 === h2));
  const denetim = $derived(acik && !ayniKisi ? (gunuDenetle($state.snapshot(depo.veri), $state.snapshot(c), gun, nb, pr) as { sev: "hata" | "uyari" | "bilgi"; t: string }[]) : []);
  const hatalar = $derived(denetim.filter(x => x.sev === "hata"));
  const uyarilar = $derived(denetim.filter(x => x.sev === "uyari"));
  const bilgiler = $derived(denetim.filter(x => x.sev === "bilgi"));

  let kuralDisiOnay = $state(false);
  $effect(() => { nb; pr; kuralDisiOnay = false; });
  function kaydet() {
    if (ayniKisi) return;
    if (hatalar.length && !kuralDisiOnay) { kuralDisiOnay = true; return; }
    gunuGuncelle(c.year, c.month, gun, nb, pr);
    acik = false;
  }
  function otomatigeBirak() { gunKilidiniKaldir(c.year, c.month, gun); acik = false; }
  const tur = $derived(resmiTatilMi(c.year, c.month, gun) ? "Resmi tatil" : g.tatil ? "Hafta sonu" : arifeMi(c.year, c.month, gun) ? "Arife (yarım gün)" : "Mesai günü");
</script>

<Pencere bind:acik baslik={gunMetni(c.year, c.month, gun)} altBaslik="{tur} · nöbet fazla mesaisi {g.fazlaMesai} saat">
  {#if onayli}<p class="not bilgi">Bu ay onaylı; günler değiştirilemez. Değiştirmek için önce onayı kaldırın.</p>{/if}
  <fieldset disabled={onayli}>
    <legend>Nöbetçiler</legend>
    <div class="iki">
      {#each [0, 1] as i}
        <label class="alan"><span>{i + 1}. nöbetçi</span>
          {#if i === 0}
            <select class="girdi" bind:value={n1}><option value="">Seçilmedi</option>{#each nobetAday as k}<option value={String(k.id)}>{k.name} · {ROL_AD[k.role]}</option>{/each}</select>
          {:else}
            <select class="girdi" bind:value={n2}><option value="">Seçilmedi</option>{#each nobetAday as k}<option value={String(k.id)}>{k.name} · {ROL_AD[k.role]}</option>{/each}</select>
          {/if}
        </label>
      {/each}
    </div>
  </fieldset>
  {#if g.tatil}
    <fieldset disabled={onayli}>
      <legend>Hazırlama (8 saat)</legend>
      <div class="iki">
        <label class="alan"><span>1. hazırlama</span><select class="girdi" bind:value={h1}><option value="">Seçilmedi</option>{#each hazAday as k}<option value={String(k.id)}>{k.name} · {ROL_AD[k.role]}</option>{/each}</select></label>
        <label class="alan"><span>2. hazırlama</span><select class="girdi" bind:value={h2}><option value="">Seçilmedi</option>{#each hazAday as k}<option value={String(k.id)}>{k.name} · {ROL_AD[k.role]}</option>{/each}</select></label>
      </div>
    </fieldset>
  {/if}

  {#if ayniKisi}<p class="not hata" role="alert">Aynı kişi iki kez seçilemez.</p>{/if}
  {#if !onayli && (hatalar.length || uyarilar.length || bilgiler.length)}
    <div class="denetim" aria-live="polite">
      {#each hatalar as x}<p class="satir hata"><Ikon ad="uyari" boyut={15} /><span><b>Kural dışı:</b> {x.t}</span></p>{/each}
      {#each uyarilar as x}<p class="satir uyari"><Ikon ad="uyari" boyut={15} /><span>{x.t}</span></p>{/each}
      {#each bilgiler as x}<p class="satir bilgi"><Ikon ad="tamam" boyut={15} /><span>{x.t}</span></p>{/each}
    </div>
  {:else if !onayli && !ayniKisi}
    <p class="not tamam"><Ikon ad="tamam" boyut={15} />Kural sorunu yok.</p>
  {/if}
  {#if kuralDisiOnay}<p class="not hata" role="alert">Bu seçimde kural dışı durum var. Yine de kaydetmek için tekrar "Kaydet"e basın.</p>{/if}
  {#if g.locked && !onayli}<p class="kucuk-not">Bu gün elle düzenlendi; çizelge yeniden oluşturulunca korunur.</p>{/if}

  {#snippet altlik()}
    {#if !onayli && g.locked}<button class="dugme sade" onclick={otomatigeBirak}>Otomatiğe bırak</button>{/if}
    <span style="flex:1"></span>
    <button class="dugme" onclick={() => (acik = false)}>{onayli ? "Kapat" : "Vazgeç"}</button>
    {#if !onayli}<button class="dugme ana" onclick={kaydet} disabled={!!ayniKisi}>{kuralDisiOnay ? "Yine de kaydet" : "Kaydet"}</button>{/if}
  {/snippet}
</Pencere>

<style>
  fieldset { border: 0; margin: 0; padding: 0; display: grid; gap: var(--b2); min-width: 0; }
  legend { font-weight: 600; font-size: var(--f-sm); margin-bottom: var(--b2); }
  .iki { display: grid; grid-template-columns: 1fr 1fr; gap: var(--b3); }
  .denetim { display: grid; gap: 6px; }
  .satir { display: flex; gap: var(--b2); align-items: flex-start; font-size: var(--f-sm); padding: 6px 10px; border-radius: var(--r-kucuk); }
  .satir :global(svg) { flex: none; margin-top: 2px; }
  .satir.hata { background: var(--hata-zemin); color: var(--yazi); } .satir.hata :global(svg), .satir.hata b { color: var(--hata); }
  .satir.uyari { background: var(--dikkat-zemin); } .satir.uyari :global(svg) { color: var(--dikkat); }
  .satir.bilgi { background: var(--yuzey-2); color: var(--yazi-2); } .satir.bilgi :global(svg) { color: var(--bilgi); }
  .not { display: flex; gap: var(--b2); align-items: center; padding: var(--b2) var(--b3); border-radius: var(--r-kucuk); font-size: var(--f-sm); font-weight: 500; }
  .not.hata { background: var(--hata-zemin); color: var(--hata); }
  .not.bilgi { background: var(--bilgi-zemin); color: var(--bilgi); }
  .not.tamam { background: var(--vurgu-zemin); color: var(--vurgu); }
  .kucuk-not { font-size: var(--f-xs); color: var(--soluk); }
  @media (max-width: 520px) { .iki { grid-template-columns: 1fr; } }
</style>
