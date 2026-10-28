<script lang="ts">
  // Günlük çalışma listesi (puantaja göre): her gün kaç kişi onayda, hazırlamada, destekte; kim izinli.
  // Hafta sonu ve tatilde onaycılar eczane nöbetçileri, hazırlamacılar o günün hazırlamacılarıdır.
  import { depo } from "../../veri/depo.svelte";
  import { calismaListesiHesapla } from "../../motor";
  import { GUN_KISA, GUN_UZUN, gunMetni, haftaGunu } from "../../veri/tarih";
  import { ROL_AD, type Rol } from "../../veri/tipler";
  import Pencere from "../ortak/Pencere.svelte";

  type Kayit = { s: { id: number; name: string; role: Rol }; kod: string; acil: boolean };
  type GunListesi = { gun: number; dw: number; tatil: boolean; onay: Kayit[]; haz: Kayit[]; dst: Kayit[]; gel: Kayit[]; yok: { s: Kayit["s"]; neden: string }[]; toplam: number };

  const y = $derived(depo.yil), m = $derived(depo.ay);
  const L = $derived(calismaListesiHesapla($state.snapshot(depo.veri), y, m) as GunListesi[]);
  const bugun = new Date();
  const bugunMu = (d: number) => bugun.getFullYear() === y && bugun.getMonth() === m && bugun.getDate() === d;

  let acik = $state(false), secili = $state(1);
  const g = $derived(L[secili - 1]);
  const gorev = (k: Kayit, tatil: boolean) => k.kod === "N" ? (k.acil ? "Acil servis nöbeti" : "Nöbetçi") : k.kod === "H" ? "Hazırlama" : tatil ? "" : ROL_AD[k.s.role];
</script>

<p class="aciklama">Puantaja göre her gün çalışanlar. Mesai günlerinde eczacılar onayda, teknikerler hazırlamada; hafta sonu ve tatilde onaycılar eczane nöbetçileri, hazırlamacılar o günün hazırlamacılarıdır. Bir güne dokunup adları görün.</p>

<section class="kart takvim-kutu" aria-label="Çalışma listesi">
  <div class="takvim">
    {#each GUN_KISA as d}<div class="bas" aria-hidden="true">{d}</div>{/each}
    {#each { length: haftaGunu(y, m, 1) } as _}<div class="bosluk" aria-hidden="true"></div>{/each}
    {#each L as x (x.gun)}
      <button class="gun" class:tatil={x.tatil} class:bugun={bugunMu(x.gun)} onclick={() => { secili = x.gun; acik = true; }}
        aria-label="{gunMetni(y, m, x.gun)}: {x.onay.length} {x.tatil ? 'onaycı' : 'onay'}, {x.haz.length} {x.tatil ? 'hazırlamacı' : 'hazırlama'}{x.dst.length ? ', ' + x.dst.length + ' destek' : ''}{x.yok.length ? ', ' + x.yok.length + ' kişi yok' : ''}">
        <span class="ust"><span class="no rakam">{x.gun}</span><span class="gunadi">{GUN_UZUN[x.dw]}</span></span>
        <span class="sayilar">
          <span class="s onay"><i></i>{x.tatil ? "Onaycı" : "Onay"}<b class="rakam">{x.onay.length}</b></span>
          <span class="s haz"><i></i>{x.tatil ? "Hazırlamacı" : "Hazırlama"}<b class="rakam">{x.haz.length}</b></span>
          {#if x.dst.length}<span class="s dst"><i></i>Destek<b class="rakam">{x.dst.length}</b></span>{/if}
          {#if x.yok.length}<span class="s yok"><i></i>Yok<b class="rakam">{x.yok.length}</b></span>{/if}
        </span>
      </button>
    {/each}
  </div>
</section>

{#if g}
  <Pencere bind:acik baslik={gunMetni(y, m, g.gun)} altBaslik="{g.tatil ? 'Hafta sonu / tatil' : 'Mesai günü'} · {g.toplam} kişi çalışıyor">
    {#each [{ ad: g.tatil ? "Onaycılar" : "Onay", l: g.onay, c: "onay" }, { ad: g.tatil ? "Hazırlamacılar" : "Hazırlama", l: g.haz, c: "haz" }, { ad: "Destek", l: g.dst, c: "dst" }, { ad: "Dışarıdan gelen nöbetçi", l: g.gel, c: "onay" }] as grup}
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
  .aciklama { font-size: var(--f-sm); color: var(--soluk); margin-bottom: var(--b3); max-width: 80ch; }
  .takvim-kutu { padding: var(--b3); }
  .takvim { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
  .bas { text-align: center; font-size: var(--f-xs); font-weight: 600; color: var(--soluk); padding-bottom: 2px; }
  .gun { display: flex; flex-direction: column; gap: 6px; min-height: 96px; padding: 8px 9px; text-align: left; border: 1px solid var(--cizgi); border-radius: var(--r-kucuk); background: var(--yuzey); cursor: pointer; min-width: 0; }
  .gun:hover { border-color: var(--soluk); }
  .gun.tatil { background: var(--tatil-zemin); }
  .gun.bugun { box-shadow: inset 0 0 0 2px var(--odak); }
  .ust { display: flex; align-items: center; gap: 6px; }
  .no { font-weight: 600; font-size: var(--f-sm); color: var(--yazi-2); }
  .gunadi { display: none; }
  .sayilar { display: grid; gap: 2px; min-width: 0; }
  .s { display: flex; align-items: center; gap: 6px; font-size: var(--f-xs); color: var(--yazi-2); min-width: 0; }
  .s b { margin-left: auto; font-size: var(--f-sm); color: var(--yazi); }
  .s i, .nokta { width: 8px; height: 8px; border-radius: 2px; flex: none; display: inline-block; }
  .onay i, .nokta.onay { background: var(--ecz); }
  .haz i, .nokta.haz { background: var(--haz); }
  .dst i, .nokta.dst { background: var(--destek); }
  .yok i, .nokta.yok { background: transparent; box-shadow: inset 0 0 0 1.5px var(--soluk); }
  .grup { display: grid; gap: var(--b2); }
  .grup h3 { display: flex; align-items: center; gap: var(--b2); font-size: var(--f-sm); font-weight: 600; }
  .grup h3 .rakam { color: var(--soluk); font-weight: 500; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 4px var(--b3); }
  li { display: grid; padding: 6px 10px; border-radius: var(--r-kucuk); background: var(--yuzey-2); }
  li span { font-weight: 500; }
  li small { font-size: var(--f-xs); color: var(--soluk); }

  @media (max-width: 720px) {
    .takvim-kutu { padding: 0; overflow: hidden; }
    .takvim { grid-template-columns: 1fr; gap: 0; }
    .bas, .bosluk { display: none; }
    .gun { flex-direction: row; align-items: center; min-height: 0; padding: 10px 12px; border-radius: 0; border-width: 0 0 1px; gap: 12px; }
    .ust { flex-direction: column; align-items: flex-start; gap: 0; width: 76px; flex: none; }
    .no { font-size: var(--f-lg); color: var(--yazi); }
    .gunadi { display: block; font-size: var(--f-xs); color: var(--soluk); }
    .sayilar { flex: 1; grid-template-columns: 1fr 1fr; gap: 2px 14px; }
  }
</style>
