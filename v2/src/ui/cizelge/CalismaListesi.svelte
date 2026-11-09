<script lang="ts">
  // Günlük çalışma listesi (puantaja göre): her gün kaç kişi onayda, hazırlamada, destekte; kim izinli.
  // Hafta sonu ve tatilde onaycılar eczane nöbetçileri, hazırlamacılar o günün hazırlamacılarıdır.
  import { depo, veriAnlik } from "../../veri/depo.svelte";
  import { calismaListesiHesapla } from "../../motor";
  import { GUN_KISA, gunMetni, haftaGunu } from "../../veri/tarih";
  import { ROL_AD, type Rol } from "../../veri/tipler";
  import Pencere from "../ortak/Pencere.svelte";

  type Kayit = { s: { id: number; name: string; role: Rol }; kod: string; acil: boolean };
  type GunListesi = { gun: number; dw: number; tatil: boolean; onay: Kayit[]; haz: Kayit[]; dst: Kayit[]; gel: Kayit[]; yok: { s: Kayit["s"]; neden: string }[]; toplam: number };

  const y = $derived(depo.yil), m = $derived(depo.ay);
  const L = $derived(calismaListesiHesapla(veriAnlik(), y, m) as GunListesi[]);
  const bugun = new Date();
  const bugunMu = (d: number) => bugun.getFullYear() === y && bugun.getMonth() === m && bugun.getDate() === d;

  let acik = $state(false);
  // ilk açılışta bugün (bu aydaysa ve hafta içiyse), değilse ayın ilk iş günü seçili
  const ilkGun = () => { const d = bugun.getFullYear() === y && bugun.getMonth() === m ? bugun.getDate() : 0; return L.find(x => x.gun === d && x.dw <= 4)?.gun ?? L.find(x => x.dw <= 4)?.gun ?? 1; };
  let secili = $state(1);
  $effect.pre(() => { if (!L.some(x => x.gun === secili && x.dw <= 4)) secili = ilkGun(); });
  // geniş ekranda güne dokunmak sağdaki paneli günceller; dar ekranda pencere açılır
  function gunAc(d: number) { secili = d; if (innerWidth <= 1100) acik = true; }
  const g = $derived(L[secili - 1]);
  const gorev = (k: Kayit, tatil: boolean) => k.kod === "N" ? (k.acil ? "Acil eczane nöbeti" : "Nöbetçi") : k.kod === "H" ? "Hazırlama" : tatil ? "" : ROL_AD[k.s.role];
</script>

<div class="duzen">
<section class="panel" aria-label="Çalışma listesi">
  <div class="panel-bas"><h2>Günlük çalışan sayıları · hafta içi</h2>
    <p class="lejant" aria-hidden="true"><span class="s onay"><i></i>Onay</span><span class="s haz"><i></i>Hazırlama</span><span class="s dst"><i></i>Destek</span><span class="s yok"><i></i>Yok</span></p></div>
  <div class="takvim">
    <!-- yalnız hafta içi: Cumartesi ve Pazar gösterilmez -->
    {#each GUN_KISA.slice(0, 5) as d}<div class="bas" aria-hidden="true">{d}</div>{/each}
    {#each { length: haftaGunu(y, m, 1) <= 4 ? haftaGunu(y, m, 1) : 0 } as _}<div class="bosluk" aria-hidden="true"></div>{/each}
    {#each L.filter(x => x.dw <= 4) as x (x.gun)}
      <button class="gun" class:hs={x.tatil} class:bugun={bugunMu(x.gun)} class:secili={secili === x.gun} aria-pressed={secili === x.gun} onclick={() => gunAc(x.gun)}
        aria-label="{gunMetni(y, m, x.gun)}{x.tatil ? ': resmi tatil' : ''}: {x.onay.length} {x.tatil ? 'onaycı' : 'onay'}, {x.haz.length} {x.tatil ? 'hazırlamacı' : 'hazırlama'}{x.dst.length ? ', ' + x.dst.length + ' destek' : ''}{x.yok.length ? ', ' + x.yok.length + ' kişi yok' : ''}">
        <span class="serit"><b class="rakam">{x.gun}</b><span class="gunadi">{GUN_KISA[x.dw]}</span>{#if x.tatil}<span class="tatil">Resmi tatil</span>{/if}</span>
        {#if !x.tatil}
          <span class="cubuk" aria-hidden="true"><i class="onay" style="flex:{x.onay.length}"></i><i class="haz" style="flex:{x.haz.length}"></i>{#if x.dst.length}<i class="dst" style="flex:{x.dst.length}"></i>{/if}<i class="yok" style="flex:{x.yok.length}"></i></span>
          <span class="sayilar">
            <span class="s onay" title="Onay"><i></i><b class="rakam">{x.onay.length}</b></span>
            <span class="s haz" title="Hazırlama"><i></i><b class="rakam">{x.haz.length}</b></span>
            {#if x.dst.length}<span class="s dst" title="Destek"><i></i><b class="rakam">{x.dst.length}</b></span>{/if}
            <span class="s yok" title="Yok"><i></i><b class="rakam">{x.yok.length}</b></span>
          </span>
        {/if}
      </button>
    {/each}
  </div>
</section>
<aside class="panel yan" aria-label="Seçili gün">
  <div class="panel-bas"><h2>Seçili gün · {g ? gunMetni(y, m, g.gun) : ""}</h2></div>
  {#if g}<div class="panel-ic">{@render liste(g)}</div>{/if}
</aside>
</div>

{#snippet liste(g: GunListesi)}
  {#each [{ ad: g.tatil ? "Onaycılar" : "Onay", l: g.onay, c: "onay" }, { ad: g.tatil ? "Hazırlamacılar" : "Hazırlama", l: g.haz, c: "haz" }, { ad: "Destek", l: g.dst, c: "dst" }, { ad: "Kemoterapi eczacısı (nöbetçi)", l: g.gel, c: "onay" }] as grup}
    {#if grup.l.length}
      <section class="grup">
        <h3><span class="nokta {grup.c}"></span>{grup.ad}<span class="rakam">{grup.l.length}</span></h3>
        <ul>{#each grup.l as k}<li><span>{k.s.name}</span><small>{gorev(k, g.tatil)}</small></li>{/each}</ul>
      </section>
    {/if}
  {/each}
  {#if g.yok.length}
    <section class="grup">
      <h3><span class="nokta yok"></span>Yok<span class="rakam">{g.yok.length}</span></h3>
      <ul>{#each g.yok as k}<li><span>{k.s.name}</span><small>{k.neden}</small></li>{/each}</ul>
    </section>
  {/if}
{/snippet}

{#if g}
  <Pencere bind:acik baslik={gunMetni(y, m, g.gun)} altBaslik="{g.tatil ? 'Hafta sonu / tatil' : 'Mesai günü'} · {g.toplam} kişi çalışıyor">
    {@render liste(g)}
    {#snippet altlik()}<span style="flex:1"></span><button class="dugme" onclick={() => (acik = false)}>Kapat</button>{/snippet}
  </Pencere>
{/if}

<style>
  .duzen { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: var(--b4); align-items: start; }
  .takvim { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); }
  .bas, .bosluk, .gun { border-right: 1px solid var(--cizgi); border-bottom: 1px solid var(--cizgi); }
  .takvim > :nth-child(5n) { border-right: 0; }
  .bas { background: var(--tablo-bas); color: var(--lacivert); font-size: var(--f-xs); font-weight: 700; text-align: center; padding: 6px 0; }
  .bosluk { background: var(--yuzey-2); }
  .gun { display: flex; flex-direction: column; width: 100%; min-height: 96px; padding: 0; text-align: left; border-top: 0; border-left: 0; border-radius: 0; background: var(--yuzey); cursor: pointer; min-width: 0; position: relative; }
  .gun:hover { background: var(--yuzey-2); }
  .gun:focus-visible { outline: 2px solid var(--odak); outline-offset: -2px; }
  .gun.secili { box-shadow: inset 0 0 0 3px var(--altin); z-index: 1; }
  .serit { display: flex; align-items: center; gap: 6px; min-height: 24px; padding: 2px 8px; background: var(--panel-bas); border-bottom: 1px solid var(--cizgi-acik); font-size: var(--f-xs); color: var(--yazi-2); }
  .gun.hs { background: color-mix(in srgb, var(--acik-mavi) 12%, var(--yuzey)); }
  .gun.hs .serit { background: color-mix(in srgb, var(--acik-mavi) 28%, var(--yuzey)); color: var(--lacivert); }
  .serit b { font-size: var(--f-sm); color: var(--lacivert); }
  .tatil { margin-left: auto; font-weight: 700; color: var(--lacivert); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .gun.bugun .serit b { text-decoration: underline; text-underline-offset: 3px; }
  .cubuk { display: flex; gap: 1px; height: 10px; margin: 12px 10px 6px; }
  .cubuk i { display: block; min-width: 0; }
  .cubuk .yok { background: var(--cizgi); box-shadow: none; }
  .sayilar { display: flex; flex-wrap: wrap; gap: 2px 12px; padding: 0 10px 8px; min-width: 0; }
  .s { display: flex; align-items: center; gap: 5px; font-size: var(--f-xs); color: var(--yazi-2); min-width: 0; }
  .s b { font-size: var(--f-sm); color: var(--lacivert); font-weight: 700; }
  .s i, .nokta { width: 8px; height: 8px; border-radius: 1px; flex: none; display: inline-block; }
  .onay, .nokta.onay { background: var(--vurgu); }
  .haz, .nokta.haz { background: var(--haz); }
  .dst, .nokta.dst { background: var(--destek); }
  .s.onay, .s.haz, .s.dst, .s.yok { background: none; }
  .s.onay i { background: var(--vurgu); }
  .s.haz i { background: var(--haz); }
  .s.dst i { background: var(--destek); }
  .s.yok i, .nokta.yok { background: var(--cizgi); }
  .lejant { display: flex; flex-wrap: wrap; gap: 4px 12px; }
  .yan .panel-ic { display: grid; gap: var(--b3); max-height: 720px; overflow-y: auto; }
  .grup { display: grid; gap: var(--b2); }
  .grup h3 { display: flex; align-items: center; gap: var(--b2); font-size: var(--f-sm); font-weight: 700; color: var(--lacivert); }
  .grup h3 .rakam { margin-left: auto; color: var(--soluk); font-weight: 600; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 4px var(--b3); }
  .yan ul { grid-template-columns: 1fr; gap: 0; }
  li { display: grid; padding: 6px 10px; border: 1px solid var(--cizgi-acik); border-radius: var(--r-kucuk); background: var(--yuzey-2); }
  .yan li { display: flex; justify-content: space-between; gap: 8px; padding: 4px 0; border: 0; border-bottom: 1px solid var(--cizgi-acik); border-radius: 0; background: none; font-size: var(--f-sm); }
  li span { font-weight: 600; }
  .yan li span { font-weight: 500; }
  li small { font-size: var(--f-xs); color: var(--soluk); }
  @media (max-width: 1100px) {
    .duzen { grid-template-columns: 1fr; }
    .yan { display: none; }
  }
  @media (max-width: 720px) {
    .bas { font-size: 11px; padding: 4px 0; }
    .gun { min-height: 70px; }
    .serit { padding: 1px 4px; min-height: 18px; }
    .gunadi { display: none; }
    .tatil { font-size: 10.5px; }
    .cubuk { margin: 6px 4px 4px; height: 6px; }
    .sayilar { padding: 0 4px 4px; gap: 1px 6px; }
    .s { gap: 3px; }
    .s b { font-size: 12px; }
  }
</style>
