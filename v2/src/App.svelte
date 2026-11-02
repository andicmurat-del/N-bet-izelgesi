<script lang="ts">
  import { onMount } from "svelte";
  import { depo, gecmis, geriAl, yinele } from "./veri/depo.svelte";
  import Ikon from "./ui/ortak/Ikon.svelte";
  import Cizelge from "./ui/sayfalar/Cizelge.svelte";
  import AcilEczane from "./ui/sayfalar/AcilEczane.svelte";
  import Raporlar from "./ui/sayfalar/Raporlar.svelte";
  import type { AcilGorunum, GunlukGorunum } from "./ui/sayfalar/sayfaTipleri";
  import Kisiler from "./ui/sayfalar/Kisiler.svelte";
  import Ayarlar from "./ui/sayfalar/Ayarlar.svelte";

  // ana bölümler: Günlük Eczane (nöbet, çalışma, öğlen, hazırlama listeleri, puantaj, izinler), Acil Eczane (nöbet
  // listesi, izinler), raporlar, personel, ayarlar
  const SAYFALAR = [
    { ad: "gunluk", baslik: "Günlük Eczane", kisa: "Günlük", ikon: "takvim" },
    { ad: "acil", baslik: "Acil Eczane", kisa: "Acil", ikon: "acil" },
    { ad: "raporlar", baslik: "Raporlar", ikon: "grafik" },
    { ad: "kisiler", baslik: "Personel", ikon: "kisiler" },
    { ad: "ayarlar", baslik: "Ayarlar", ikon: "ayarlar" },
  ] as const;
  type SayfaAdi = (typeof SAYFALAR)[number]["ad"];
  // telefonun alt menüsünde "Diğer" altında duranlar
  const DIGER: SayfaAdi[] = ["kisiler", "ayarlar"];
  let digerAcik = $state(false);

  // eski bölüm adları (önceki sürümlerin bağlantıları ve sayfa içi düğmeler) Günlük Eczane'nin alt sekmelerine gider
  type Hedef = SayfaAdi | "cizelge" | "puantaj" | "hazirlama" | "izinler";
  const ESKI: Record<string, GunlukGorunum> = { cizelge: "nobet", puantaj: "puantaj", hazirlama: "hazirlama", izinler: "izinler" };
  let gunlukAlt = $state<GunlukGorunum>("nobet"), acilAlt = $state<AcilGorunum>("acil");
  const GUNLUK_ALT: GunlukGorunum[] = ["nobet", "liste", "oglen", "hazirlama", "puantaj", "izinler"];
  const hashOku = (): SayfaAdi => {
    const [h, alt] = location.hash.slice(1).split("/");
    if (ESKI[h]) { gunlukAlt = ESKI[h]; return "gunluk"; }
    if (h === "gunluk" && GUNLUK_ALT.includes(alt as GunlukGorunum)) gunlukAlt = alt as GunlukGorunum;
    if (h === "acil" && (alt === "acil" || alt === "puantaj" || alt === "izinler")) acilAlt = alt;
    return (SAYFALAR.find(s => s.ad === h)?.ad ?? "gunluk") as SayfaAdi;
  };
  let sayfa = $state<SayfaAdi>(hashOku());
  onMount(() => {
    const dinle = () => (sayfa = hashOku());
    addEventListener("hashchange", dinle);
    return () => removeEventListener("hashchange", dinle);
  });
  // geri al / yinele: düğmeler ve Ctrl+Z, Ctrl+Y (Ctrl+Shift+Z); yazı alanındayken tarayıcının kendi geri alması çalışır
  let geriDurum = $state(""), geriZaman: ReturnType<typeof setTimeout> | undefined;
  function bildir(t: string) { geriDurum = t; clearTimeout(geriZaman); geriZaman = setTimeout(() => (geriDurum = ""), 2200); }
  const geri = () => bildir(geriAl() ? "Son değişiklik geri alındı." : "Geri alınacak değişiklik yok.");
  const ileri = () => bildir(yinele() ? "Değişiklik yinelendi." : "Yinelenecek değişiklik yok.");
  function tus(e: KeyboardEvent) {
    if (e.key === "Escape") digerAcik = false;
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const h = e.target as HTMLElement | null;
    if (h && (h.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(h.tagName))) return;
    const k = e.key.toLocaleLowerCase("en");
    if (k === "z" && !e.shiftKey) { e.preventDefault(); geri(); }
    else if (k === "y" || (k === "z" && e.shiftKey)) { e.preventDefault(); ileri(); }
  }

  function git(hedef: Hedef) {
    const ad: SayfaAdi = ESKI[hedef] ? "gunluk" : (hedef as SayfaAdi);
    if (ESKI[hedef]) gunlukAlt = ESKI[hedef];
    sayfa = ad;
    try { history.replaceState(null, "", "#" + ad); } catch { /* çerçeve izin vermezse yalnız durum değişir */ }
    document.getElementById("icerik")?.focus({ preventScroll: true });
    scrollTo({ top: 0 });
  }
</script>

<svelte:window onkeydown={tus} onclick={e => { if (digerAcik && !(e.target as Element).closest?.(".diger-kap")) digerAcik = false; }} />
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
    <div class="geri-al" role="group" aria-label="Geri al">
      <button class="dugme kucuk" onclick={geri} disabled={!gecmis.geri.length} title="Son değişikliği geri al (Ctrl+Z)"><Ikon ad="geri" />Geri al</button>
      <button class="dugme kucuk" onclick={ileri} disabled={!gecmis.ileri.length} title="Geri alınanı yinele (Ctrl+Y)"><Ikon ad="ileri" />Yinele</button>
    </div>
    <p class="not">Veriler yalnız bu tarayıcıda saklanır. Düzenli yedek almayı unutmayın.</p>
  </nav>

  <main id="icerik" tabindex="-1">
    <div class="tel-ust" role="group" aria-label="Geri al">
      <button class="dugme sade kucuk" onclick={geri} disabled={!gecmis.geri.length} aria-label="Son değişikliği geri al"><Ikon ad="geri" />Geri al</button>
      <button class="dugme sade kucuk" onclick={ileri} disabled={!gecmis.ileri.length} aria-label="Geri alınanı yinele"><Ikon ad="ileri" />Yinele</button>
    </div>
    {#if depo.kayitSorunu}<div class="kayit-sorunu" role="alert"><Ikon ad="uyari" />{depo.kayitSorunu}</div>{/if}
    {#if sayfa === "gunluk"}<Cizelge {git} bind:gorunum={gunlukAlt} />
    {:else if sayfa === "acil"}<AcilEczane {git} bind:gorunum={acilAlt} />
    {:else if sayfa === "raporlar"}<Raporlar />
    {:else if sayfa === "kisiler"}<Kisiler />
    {:else}<Ayarlar />{/if}
  </main>

  <p class="geri-durum" role="status" aria-live="polite">{geriDurum}</p>

  <nav class="alt" aria-label="Bölümler">
    {#each SAYFALAR.filter(s => !DIGER.includes(s.ad)) as s}
      <button class:secili={sayfa === s.ad} aria-current={sayfa === s.ad ? "page" : undefined} onclick={() => git(s.ad)}><Ikon ad={s.ikon} boyut={22} /><span>{"kisa" in s ? s.kisa : s.baslik}</span></button>
    {/each}
    <div class="diger-kap">
      <button class:secili={DIGER.includes(sayfa)} aria-expanded={digerAcik} aria-controls="diger-menu" onclick={() => (digerAcik = !digerAcik)}><Ikon ad="diger" boyut={22} /><span>Diğer</span></button>
      {#if digerAcik}
        <div class="diger-menu" id="diger-menu">
          {#each SAYFALAR.filter(s => DIGER.includes(s.ad)) as s}
            <button class:secili={sayfa === s.ad} aria-current={sayfa === s.ad ? "page" : undefined} onclick={() => { digerAcik = false; git(s.ad); }}><Ikon ad={s.ikon} />{s.baslik}</button>
          {/each}
        </div>
      {/if}
    </div>
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
  .geri-al { display: flex; gap: var(--b2); padding: 0 var(--b2); }
  .geri-al .dugme { flex: 1; justify-content: center; }
  .tel-ust { display: none; }
  .geri-durum:empty { display: none; }
  .geri-durum { position: fixed; left: 50%; transform: translateX(-50%); bottom: var(--b5); z-index: 40; max-width: min(480px, calc(100vw - 32px)); padding: var(--b2) var(--b4); border-radius: var(--r); background: var(--yazi); color: var(--yuzey); font-weight: 500; box-shadow: var(--golge); }

  @media (max-width: 860px) {
    .kabuk { grid-template-columns: 1fr; }
    .yan { display: none; }
    .tel-ust { display: flex; justify-content: flex-end; gap: var(--b1); margin: calc(-1 * var(--b2)) 0 var(--b2); }
    .geri-durum { bottom: calc(84px + env(safe-area-inset-bottom, 0px)); }
    main { padding-block: var(--b4) calc(84px + env(safe-area-inset-bottom, 0px)); padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
    .alt { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); position: fixed; left: 0; right: 0; bottom: 0; z-index: 20; background: var(--yuzey); border-top: 1px solid var(--cizgi);
      padding: 6px max(4px, env(safe-area-inset-right, 0px)) calc(6px + env(safe-area-inset-bottom, 0px)) max(4px, env(safe-area-inset-left, 0px)); }
    .alt button { display: grid; justify-items: center; gap: 2px; min-height: 52px; min-width: 0; padding: 0 1px; border: 0; background: transparent; color: var(--soluk); font-size: var(--f-xs); font-weight: 500; border-radius: var(--r); cursor: pointer; }
    .alt button.secili { color: var(--vurgu); background: var(--vurgu-zemin); font-weight: 600; }
    .diger-kap { position: relative; display: grid; }
    .diger-menu { position: absolute; right: 0; bottom: calc(100% + 8px); display: grid; gap: 2px; min-width: 180px; padding: 6px; background: var(--yuzey); border: 1px solid var(--cizgi); border-radius: var(--r); box-shadow: var(--golge); }
    .alt .diger-menu button { display: flex; align-items: center; gap: var(--b2); justify-items: start; min-height: 44px; padding: 0 var(--b3); font-size: var(--f-sm); color: var(--yazi); }
  }
</style>
