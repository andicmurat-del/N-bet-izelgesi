<script lang="ts">
  // Günlük çalışma listesi (puantaja göre): her gün kaç kişi onayda, hazırlamada, destekte; kim izinli.
  // Hafta sonu ve tatilde onaycılar eczane nöbetçileri, hazırlamacılar o günün hazırlamacılarıdır.
  import { depo, veriAnlik } from "../../veri/depo.svelte";
  import { calismaListesiHesapla } from "../../motor";
  import { GUN_KISA, GUN_UZUN, gunMetni, haftaGunu } from "../../veri/tarih";
  import { ROL_AD, type Rol } from "../../veri/tipler";
  import Pencere from "../ortak/Pencere.svelte";

  type Kayit = { s: { id: number; name: string; role: Rol }; kod: string; acil: boolean };
  type GunListesi = { gun: number; dw: number; tatil: boolean; onay: Kayit[]; haz: Kayit[]; dst: Kayit[]; gel: Kayit[]; yok: { s: Kayit["s"]; neden: string }[]; toplam: number };

  const y = $derived(depo.yil), m = $derived(depo.ay);
  const L = $derived(calismaListesiHesapla(veriAnlik(), y, m) as GunListesi[]);
  const bugun = new Date();
  const bugunMu = (d: number) => bugun.getFullYear() === y && bugun.getMonth() === m && bugun.getDate() === d;

  let acik = $state(false), secili = $state(1);
  const g = $derived(L[secili - 1]);
  const gorev = (k: Kayit, tatil: boolean) => k.kod === "N" ? (k.acil ? "Acil eczane nöbeti" : "Nöbetçi") : k.kod === "H" ? "Hazırlama" : tatil ? "" : ROL_AD[k.s.role];
</script>

<div class="kutu bilgi aciklama-kutu">
  <p><b>Onay:</b> mesai gününde onayda çalışan eczacılar; hafta sonu ve tatilde <b>Onaycı</b> o günün eczane nöbetçileridir.</p>
  <p><b>Hazırlama:</b> mesai gününde hazırlamada çalışan teknikerler; hafta sonu ve tatilde <b>Hazırlamacı</b> o günün hazırlama görevlileridir.</p>
  <p><b>Yok:</b> izinli, raporlu ya da nöbet ertesi izinde olanlar. Adları görmek için güne dokunun.</p>
</div>

<section class="panel" aria-label="Çalışma listesi">
  <div class="panel-bas"><h2>Günlük çalışan sayıları</h2>
    <p class="lejant" aria-hidden="true"><span class="s onay"><i></i>Onay / onaycı</span><span class="s haz"><i></i>Hazırlama</span><span class="s dst"><i></i>Destek</span><span class="s yok"><i></i>Yok</span></p></div>
  <div class="takvim">
    {#each GUN_KISA as d, i}<div class="bas" aria-hidden="true">{d}</div>{/each}
    {#each { length: haftaGunu(y, m, 1) } as _}<div class="bosluk" aria-hidden="true"></div>{/each}
    {#each L as x (x.gun)}
      <button class="gun" class:hs={x.tatil} class:bugun={bugunMu(x.gun)} onclick={() => { secili = x.gun; acik = true; }}
        aria-label="{gunMetni(y, m, x.gun)}: {x.onay.length} {x.tatil ? 'onaycı' : 'onay'}, {x.haz.length} {x.tatil ? 'hazırlamacı' : 'hazırlama'}{x.dst.length ? ', ' + x.dst.length + ' destek' : ''}{x.yok.length ? ', ' + x.yok.length + ' kişi yok' : ''}">
        <span class="serit"><b class="rakam">{x.gun}</b><span class="gunadi">{GUN_KISA[x.dw]}</span></span>
        <span class="sayilar">
          <span class="s onay"><i></i><span class="etk">{x.tatil ? "Onaycı" : "Onay"}</span><b class="rakam">{x.onay.length}</b></span>
          <span class="s haz"><i></i><span class="etk">{x.tatil ? "Hazırlamacı" : "Hazırlama"}</span><b class="rakam">{x.haz.length}</b></span>
          {#if x.dst.length}<span class="s dst"><i></i><span class="etk">Destek</span><b class="rakam">{x.dst.length}</b></span>{/if}
          <span class="s yok"><i></i><span class="etk">Yok</span><b class="rakam">{x.yok.length}</b></span>
        </span>
      </button>
    {/each}
  </div>
</section>

{#if g}
  <Pencere bind:acik baslik={gunMetni(y, m, g.gun)} altBaslik="{g.tatil ? 'Hafta sonu / tatil' : 'Mesai günü'} · {g.toplam} kişi çalışıyor">
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
        <h3><span class="nokta yok"></span>Çalışmayanlar<span class="rakam">{g.yok.length}</span></h3>
        <ul>{#each g.yok as k}<li><span>{k.s.name}</span><small>{k.neden}</small></li>{/each}</ul>
      </section>
    {/if}
    {#snippet altlik()}<span style="flex:1"></span><button class="dugme" onclick={() => (acik = false)}>Kapat</button>{/snippet}
  </Pencere>
{/if}

<style>
  .aciklama-kutu { display: grid; gap: 2px; margin-bottom: var(--b4); }
  .takvim { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
  .bas, .bosluk, .gun { border-right: 1px solid var(--cizgi); border-bottom: 1px solid var(--cizgi); }
  .bas:nth-child(7n), .takvim > :nth-child(7n) { border-right: 0; }
  .bas { background: var(--tablo-bas); color: var(--lacivert); font-size: var(--f-xs); font-weight: 700; text-align: center; padding: 6px 0; }
  .bosluk { background: var(--yuzey-2); }
  .gun { display: flex; flex-direction: column; min-height: 100px; padding: 0; text-align: left; border-top: 0; border-left: 0; border-radius: 0; background: var(--yuzey); cursor: pointer; min-width: 0; }
  .gun:hover { background: var(--yuzey-2); }
  .gun:focus-visible { outline: 2px solid var(--odak); outline-offset: -2px; }
  .serit { display: flex; align-items: center; gap: 6px; min-height: 24px; padding: 2px 8px; background: var(--panel-bas); border-bottom: 1px solid var(--cizgi-acik); font-size: var(--f-xs); color: var(--yazi-2); }
  .gun.hs .serit { background: color-mix(in srgb, var(--acik-mavi) 28%, var(--yuzey)); color: var(--lacivert); }
  .serit b { font-size: var(--f-sm); color: var(--lacivert); }
  .gun.bugun .serit b { text-decoration: underline; text-underline-offset: 3px; }
  .sayilar { display: grid; gap: 2px; padding: 6px 8px 8px; min-width: 0; }
  .s { display: flex; align-items: center; gap: 6px; font-size: var(--f-xs); color: var(--yazi-2); min-width: 0; }
  .s b { margin-left: auto; font-size: var(--f-sm); color: var(--lacivert); font-weight: 700; text-align: right; min-width: 2ch; }
  .s i, .nokta { width: 8px; height: 8px; border-radius: 1px; flex: none; display: inline-block; }
  .onay i, .nokta.onay { background: var(--lacivert); }
  .haz i, .nokta.haz { background: var(--haz); }
  .dst i, .nokta.dst { background: var(--destek); }
  .yok i, .nokta.yok { background: transparent; box-shadow: inset 0 0 0 1.5px var(--soluk); }
  .lejant { display: flex; flex-wrap: wrap; gap: 4px 12px; }
  .grup { display: grid; gap: var(--b2); }
  .grup h3 { display: flex; align-items: center; gap: var(--b2); font-size: var(--f-sm); font-weight: 700; }
  .grup h3 .rakam { color: var(--soluk); font-weight: 600; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 4px var(--b3); }
  li { display: grid; padding: 6px 10px; border: 1px solid var(--cizgi-acik); border-radius: var(--r-kucuk); background: var(--yuzey-2); }
  li span { font-weight: 600; }
  li small { font-size: var(--f-xs); color: var(--soluk); }
  @media (max-width: 720px) {
    .bas { font-size: 11px; padding: 4px 0; }
    .gun { min-height: 70px; }
    .serit { padding: 1px 4px; min-height: 18px; }
    .gunadi { display: none; }
    .sayilar { padding: 3px 4px 4px; }
    .s { gap: 4px; }
    .s .etk { display: none; }
    .s b { font-size: 12px; }
  }
</style>
