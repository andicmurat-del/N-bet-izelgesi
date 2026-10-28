<script lang="ts">
  import { onMount } from "svelte";
  import { depo } from "./veri/depo.svelte";
  import Ikon from "./ui/ortak/Ikon.svelte";
  import Cizelge from "./ui/sayfalar/Cizelge.svelte";
  import Izinler from "./ui/sayfalar/Izinler.svelte";
  import Kisiler from "./ui/sayfalar/Kisiler.svelte";
  import Ayarlar from "./ui/sayfalar/Ayarlar.svelte";

  const SAYFALAR = [
    { ad: "cizelge", baslik: "Çizelge", ikon: "takvim" },
    { ad: "izinler", baslik: "İzin ve tercihler", kisa: "İzinler", ikon: "izin" },
    { ad: "kisiler", baslik: "Personel", ikon: "kisiler" },
    { ad: "ayarlar", baslik: "Ayarlar", ikon: "ayarlar" },
  ] as const;
  type SayfaAdi = (typeof SAYFALAR)[number]["ad"];

  const hashOku = (): SayfaAdi => {
    const h = location.hash.slice(1);
    return (SAYFALAR.find(s => s.ad === h)?.ad ?? "cizelge") as SayfaAdi;
  };
  let sayfa = $state<SayfaAdi>(hashOku());
  onMount(() => {
    const dinle = () => (sayfa = hashOku());
    addEventListener("hashchange", dinle);
    return () => removeEventListener("hashchange", dinle);
  });
  function git(ad: SayfaAdi) {
    sayfa = ad;
    try { history.replaceState(null, "", "#" + ad); } catch { /* çerçeve izin vermezse yalnız durum değişir */ }
    document.getElementById("icerik")?.focus({ preventScroll: true });
    scrollTo({ top: 0 });
  }
</script>

<a class="atla" href="#icerik">İçeriğe geç</a>
<div class="kabuk">
  <nav class="yan" aria-label="Bölümler">
    <div class="marka">
      <span class="logo" aria-hidden="true"><Ikon ad="takvim" boyut={20} /></span>
      <div>
        <b>Nöbet Çizelgesi</b>
        {#if depo.veri.kurum.ad}<small>{depo.veri.kurum.ad}</small>{/if}
      </div>
    </div>
    <ul>
      {#each SAYFALAR as s}
        <li><button class:secili={sayfa === s.ad} aria-current={sayfa === s.ad ? "page" : undefined} onclick={() => git(s.ad)}><Ikon ad={s.ikon} />{s.baslik}</button></li>
      {/each}
    </ul>
    <p class="not">Veriler yalnız bu tarayıcıda saklanır. Düzenli yedek almayı unutmayın.</p>
  </nav>

  <main id="icerik" tabindex="-1">
    {#if depo.kayitSorunu}<div class="kayit-sorunu" role="alert"><Ikon ad="uyari" />{depo.kayitSorunu}</div>{/if}
    {#if sayfa === "cizelge"}<Cizelge {git} />
    {:else if sayfa === "izinler"}<Izinler {git} />
    {:else if sayfa === "kisiler"}<Kisiler />
    {:else}<Ayarlar />{/if}
  </main>

  <nav class="alt" aria-label="Bölümler">
    {#each SAYFALAR as s}
      <button class:secili={sayfa === s.ad} aria-current={sayfa === s.ad ? "page" : undefined} onclick={() => git(s.ad)}><Ikon ad={s.ikon} boyut={22} /><span>{"kisa" in s ? s.kisa : s.baslik}</span></button>
    {/each}
  </nav>
</div>

<style>
  .atla { position: absolute; left: -999px; top: 8px; z-index: 50; background: var(--yuzey); padding: var(--b2) var(--b3); border-radius: var(--r-kucuk); }
  .atla:focus { left: 8px; }
  .kabuk { display: grid; grid-template-columns: 232px minmax(0, 1fr); min-height: 100%; }
  .yan { position: sticky; top: 0; height: 100dvh; display: flex; flex-direction: column; gap: var(--b5); padding: var(--b5) var(--b3); border-right: 1px solid var(--cizgi); background: var(--yuzey); }
  .marka { display: flex; align-items: center; gap: var(--b3); padding: 0 var(--b2); }
  .marka b { font-family: var(--yazi-baslik); font-size: var(--f-lg); display: block; line-height: 1.2; }
  .marka small { color: var(--soluk); font-size: var(--f-xs); display: block; line-height: 1.3; margin-top: 2px; }
  .logo { display: grid; place-items: center; width: 36px; height: 36px; border-radius: var(--r); background: var(--vurgu); color: var(--vurgu-yazi); flex: none; }
  .yan ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
  .yan button { display: flex; align-items: center; gap: var(--b3); width: 100%; min-height: 40px; padding: 0 var(--b3); border: 0; border-radius: var(--r-kucuk); background: transparent; color: var(--yazi-2); font-weight: 500; cursor: pointer; text-align: left; }
  .yan button:hover { background: var(--yuzey-2); color: var(--yazi); }
  .yan button.secili { background: var(--vurgu-zemin); color: var(--vurgu); font-weight: 600; }
  .not { margin-top: auto; font-size: var(--f-xs); color: var(--soluk); padding: 0 var(--b2); }
  main { min-width: 0; padding-block: var(--b5) var(--b6); padding-left: max(var(--b5), env(safe-area-inset-left, 0px)); padding-right: max(var(--b5), env(safe-area-inset-right, 0px)); outline: none; }
  .kayit-sorunu { display: flex; gap: var(--b2); align-items: center; padding: var(--b3) var(--b4); margin-bottom: var(--b4); border-radius: var(--r); background: var(--hata-zemin); color: var(--hata); font-weight: 500; }
  .alt { display: none; }

  @media (max-width: 860px) {
    .kabuk { grid-template-columns: 1fr; }
    .yan { display: none; }
    main { padding-block: var(--b4) calc(84px + env(safe-area-inset-bottom, 0px)); padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
    .alt { display: grid; grid-template-columns: repeat(4, 1fr); position: fixed; left: 0; right: 0; bottom: 0; z-index: 20; background: var(--yuzey); border-top: 1px solid var(--cizgi);
      padding: 6px max(8px, env(safe-area-inset-right, 0px)) calc(6px + env(safe-area-inset-bottom, 0px)) max(8px, env(safe-area-inset-left, 0px)); }
    .alt button { display: grid; justify-items: center; gap: 2px; min-height: 52px; border: 0; background: transparent; color: var(--soluk); font-size: var(--f-xs); font-weight: 500; border-radius: var(--r); cursor: pointer; }
    .alt button.secili { color: var(--vurgu); background: var(--vurgu-zemin); font-weight: 600; }
  }
</style>
