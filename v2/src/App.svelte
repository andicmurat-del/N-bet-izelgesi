<script lang="ts">
  import { onMount } from "svelte";
  import { depo, gecmis, geriAl, yinele, yedekVerisi } from "./veri/depo.svelte";
  import { dosyaKaydet, hataMetni } from "./disa/indir";
  import { ayAdi } from "./veri/tarih";
  import AySecici from "./ui/ortak/AySecici.svelte";
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
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const h = e.target as HTMLElement | null;
    if (h && (h.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(h.tagName))) return;
    const k = e.key.toLocaleLowerCase("en");
    if (k === "z" && !e.shiftKey) { e.preventDefault(); geri(); }
    else if (k === "y" || (k === "z" && e.shiftKey)) { e.preventDefault(); ileri(); }
  }

  // üst şeritteki "Yedek al": Ayarlar'daki yedekle aynı dosya
  async function yedekAl() {
    const t = new Date(), iki = (n: number) => String(n).padStart(2, "0");
    const ad = `nobet-cizelgesi-yedek-${t.getFullYear()}-${iki(t.getMonth() + 1)}-${iki(t.getDate())}.json`;
    try { if (await dosyaKaydet(ad, yedekVerisi(), "application/json")) bildir("Yedek kaydedildi: " + ad); }
    catch (e) { bildir(hataMetni(e, "Yedek kaydedilemedi.")); }
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

<svelte:window onkeydown={tus} />
<a class="atla" href="#icerik">İçeriğe geç</a>
<div class="kabuk">
  <div class="ust-serit">
    <div class="genislik">
      <span>Hastane Eczanesi · Nöbet ve Puantaj Sistemi</span>
      <span class="sag">Veriler bu bilgisayarda saklanır · <button class="serit-baglanti" onclick={yedekAl}>Yedek al</button></span>
    </div>
  </div>
  <header class="baslik-bandi">
    <div class="genislik">
      <div class="marka">
        <span class="logo" aria-hidden="true"><Ikon ad="hastane" boyut={30} /></span>
        <div>
          <small>{(depo.veri.kurum.ad || "Hastane Eczanesi").toLocaleUpperCase("tr")}</small>
          <b>Nöbet Çizelgesi Yönetim Sistemi</b>
        </div>
      </div>
      <div class="donem"><span>Çalışma dönemi</span><AySecici /></div>
    </div>
  </header>
  <nav class="menu" aria-label="Bölümler">
    <div class="genislik">
      <ul>
        {#each SAYFALAR as s}
          <li><button class:secili={sayfa === s.ad} aria-current={sayfa === s.ad ? "page" : undefined} onclick={() => git(s.ad)}>{s.baslik}</button></li>
        {/each}
      </ul>
      <div class="geri-al" role="group" aria-label="Geri al ve yinele">
        <button onclick={geri} disabled={!gecmis.geri.length} title="Son değişikliği geri al (Ctrl+Z)" aria-label="Son değişikliği geri al"><Ikon ad="geri" /></button>
        <button onclick={ileri} disabled={!gecmis.ileri.length} title="Geri alınanı yinele (Ctrl+Y)" aria-label="Geri alınanı yinele"><Ikon ad="ileri" /></button>
      </div>
    </div>
  </nav>

  <main id="icerik" tabindex="-1">
    {#if depo.kayitSorunu}<div class="kayit-sorunu kutu hata" role="alert"><Ikon ad="uyari" />{depo.kayitSorunu}</div>{/if}
    {#if sayfa === "gunluk"}<Cizelge {git} bind:gorunum={gunlukAlt} />
    {:else if sayfa === "acil"}<AcilEczane {git} bind:gorunum={acilAlt} />
    {:else if sayfa === "raporlar"}<Raporlar />
    {:else if sayfa === "kisiler"}<Kisiler />
    {:else}<Ayarlar />{/if}
  </main>

  <footer class="alt-bilgi">
    <div class="genislik">
      <p class="imza">Bu program, hastane eczanemizin değerli çalışanları için hazırlanmıştır. <b>Ecz. Murat Andiç</b></p>
      <p class="sag">Nöbet Çizelgesi · {ayAdi(depo.yil, depo.ay)}</p>
    </div>
  </footer>

  <p class="geri-durum" role="status" aria-live="polite">{geriDurum}</p>
</div>

<style>
  .atla { position: absolute; left: -999px; top: 8px; z-index: 50; background: var(--yuzey); padding: var(--b2) var(--b3); border-radius: var(--r-kucuk); }
  .atla:focus { left: 8px; }
  .kabuk { display: flex; flex-direction: column; min-height: 100%; }
  /* ortak genişlik: en fazla 1360 px, ortalı; yan boşluk telefonda 16 px */
  .genislik { max-width: 1360px; margin: 0 auto; width: 100%; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
  /* 1. üst şerit */
  .ust-serit { background: var(--serit); color: #C9D6E6; font-size: var(--f-xs); }
  .ust-serit .genislik { display: flex; align-items: center; justify-content: space-between; gap: var(--b3); min-height: 32px; }
  .serit-baglanti { border: 0; background: none; padding: 0; color: #FFFFFF; font-weight: 600; text-decoration: underline; text-underline-offset: 2px; cursor: pointer; font-size: inherit; }
  /* 2. başlık bandı */
  .baslik-bandi { background: var(--yuzey); border-bottom: 1px solid var(--cizgi); }
  .baslik-bandi .genislik { display: flex; align-items: center; justify-content: space-between; gap: var(--b4); flex-wrap: wrap; min-height: 84px; padding-block: 10px; }
  .marka { display: flex; align-items: center; gap: 14px; min-width: 0; }
  .logo { display: grid; place-items: center; width: 52px; height: 52px; border-radius: var(--r-kucuk); background: var(--menu-zemin); color: #FFFFFF; flex: none; }
  .marka small { display: block; font-size: 12px; font-weight: 700; letter-spacing: .08em; color: var(--yazi-2); line-height: 1.3; }
  .marka b { display: block; font-size: 22px; font-weight: 700; color: var(--lacivert); line-height: 1.2; }
  .donem { display: flex; align-items: center; gap: var(--b3); }
  .donem > span { font-size: var(--f-sm); font-weight: 600; color: var(--yazi-2); }
  /* 3. ana menü */
  .menu { background: var(--menu-zemin); position: sticky; top: env(safe-area-inset-top, 0px); z-index: 20; }
  .menu .genislik { display: flex; align-items: stretch; justify-content: space-between; gap: var(--b3); }
  .menu ul { list-style: none; margin: 0; padding: 0; display: flex; overflow-x: auto; scrollbar-width: none; min-width: 0; }
  .menu ul::-webkit-scrollbar { display: none; }
  .menu li button { height: 46px; padding: 0 18px; border: 0; border-bottom: 3px solid transparent; border-top: 3px solid transparent; background: transparent; color: #DCE5F0; font-weight: 600; font-size: var(--f-md); cursor: pointer; white-space: nowrap; }
  .menu li button:hover { background: rgba(255, 255, 255, .08); color: #FFFFFF; }
  .menu li button.secili { background: var(--serit); color: #FFFFFF; border-bottom-color: var(--acik-mavi); }
  .menu li button:focus-visible, .geri-al button:focus-visible { outline: 2px solid var(--acik-mavi); outline-offset: -2px; }
  .geri-al { display: flex; align-items: center; gap: 2px; flex: none; }
  .geri-al button { display: grid; place-items: center; width: 38px; height: 34px; border: 1px solid rgba(255, 255, 255, .25); border-radius: var(--r-kucuk); background: transparent; color: #FFFFFF; cursor: pointer; }
  .geri-al button:hover:not(:disabled) { background: rgba(255, 255, 255, .12); }
  .geri-al button:disabled { opacity: .4; cursor: not-allowed; }
  main { flex: 1; width: 100%; max-width: 1360px; margin: 0 auto; min-width: 0; padding-block: var(--b4) var(--b6); padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); outline: none; }
  .kayit-sorunu { display: flex; gap: var(--b2); align-items: center; margin-bottom: var(--b4); font-weight: 600; }
  /* alt bilgi */
  .alt-bilgi { background: var(--yuzey); border-top: 1px solid var(--cizgi); font-size: var(--f-xs); color: var(--yazi-2); }
  .alt-bilgi .genislik { display: flex; align-items: center; justify-content: space-between; gap: var(--b3); flex-wrap: wrap; min-height: 44px; padding-block: 10px calc(10px + env(safe-area-inset-bottom, 0px)); }
  .alt-bilgi b { color: var(--lacivert); font-weight: 600; }
  .alt-bilgi .sag { margin-left: auto; }
  .geri-durum:empty { display: none; }
  .geri-durum { position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(var(--b5) + env(safe-area-inset-bottom, 0px)); z-index: 40; max-width: min(480px, calc(100vw - 32px)); padding: var(--b2) var(--b4); border-radius: var(--r); background: var(--serit); color: #FFFFFF; font-weight: 600; }

  @media (max-width: 860px) {
    .ust-serit .sag { display: none; }
    .baslik-bandi .genislik { min-height: 0; padding-block: 10px; gap: var(--b2); }
    .logo { width: 40px; height: 40px; }
    .logo :global(svg) { width: 24px; height: 24px; }
    .marka b { font-size: 17px; }
    .donem > span { display: none; }
    .donem { width: 100%; }
    .menu li button { padding: 0 14px; font-size: var(--f-sm); }
    /* imza yalnız masaüstünde */
    .imza { display: none; }
  }
</style>
