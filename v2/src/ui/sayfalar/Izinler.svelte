<script lang="ts">
  import { depo, tercihAl, tercihAyarla, resmiTatilMi, arifeMi, resmiTatilAyarla, arifeAyarla, aydaCalisanlar, ayCizelgesi } from "../../veri/depo.svelte";
  import { TERCIH_ACIKLAMA, TERCIH_AD, ROL_AD, type Tercih } from "../../veri/tipler";
  import { GUN_KISA, gunMetni, gunSayisi, haftaGunu, haftaSonuMu, isoTarih } from "../../veri/tarih";
  import AySecici from "../ortak/AySecici.svelte";

  let { git }: { git: (ad: "cizelge" | "puantaj" | "izinler" | "kisiler" | "ayarlar") => void } = $props();

  type Mod = "kisi" | "tatil";
  let mod = $state<Mod>("kisi");
  const ARACLAR: (Tercih | "temizle")[] = ["izinli", "want", "avoid", "esVar", "esYok", "temizle"];
  let arac = $state<Tercih | "temizle">("izinli");
  type TatilArac = "resmi" | "arife" | "temizle";
  let tatilArac = $state<TatilArac>("resmi");

  const kisiler = $derived(aydaCalisanlar(depo.yil, depo.ay).sort((a, b) => a.name.localeCompare(b.name, "tr")));
  let seciliId = $state<number | null>(null);
  $effect(() => { if (seciliId === null || !kisiler.some(k => k.id === seciliId)) seciliId = kisiler[0]?.id ?? null; });
  const secili = $derived(kisiler.find(k => k.id === seciliId) ?? null);

  const onayli = $derived(!!ayCizelgesi(depo.yil, depo.ay)?.onay);
  const gunler = $derived.by(() => {
    const y = depo.yil, m = depo.ay, n = gunSayisi(y, m), bos = haftaGunu(y, m, 1);
    return { bos, liste: Array.from({ length: n }, (_, i) => i + 1) };
  });

  // sürükleyerek birden çok güne işaret: basılı tutup gezdirilen günler aynı işareti alır
  let suruk = $state(false);
  function uygula(d: number) {
    if (onayli) return;
    const y = depo.yil, m = depo.ay;
    if (mod === "kisi") {
      if (!secili) return;
      const once = tercihAl(secili.id, y, m, d);
      tercihAyarla(secili.id, y, m, d, arac === "temizle" || once === arac && !suruk ? null : arac);
    } else {
      if (tatilArac === "resmi") resmiTatilAyarla(y, m, d, !(resmiTatilMi(y, m, d) && !suruk));
      else if (tatilArac === "arife") arifeAyarla(y, m, d, !(arifeMi(y, m, d) && !suruk));
      else { resmiTatilAyarla(y, m, d, false); arifeAyarla(y, m, d, false); }
    }
  }
  function basla(d: number, e: PointerEvent) { if (e.button !== 0) return; uygula(d); suruk = true; }
  function gez(d: number) { if (suruk) uygula(d); }
  function birak() { suruk = false; }

  const kisiAyIsaretleri = (id: number) => {
    const o: Partial<Record<Tercih, number>> = {};
    for (let d = 1; d <= gunSayisi(depo.yil, depo.ay); d++) { const t = tercihAl(id, depo.yil, depo.ay, d); if (t) o[t] = (o[t] ?? 0) + 1; }
    return o;
  };
  const aktifDegil = (d: number) => !!secili && ((secili.baslangic && isoTarih(depo.yil, depo.ay, d) < secili.baslangic) || (secili.bitis && isoTarih(depo.yil, depo.ay, d) > secili.bitis));
  const kisaltma: Record<Tercih, string> = { izinli: "İzin", want: "İster", avoid: "İstemez", esVar: "Eş +", esYok: "Eş −" };
</script>

<svelte:window onpointerup={birak} onpointercancel={birak} />

<header class="sayfa-bas">
  <div>
    <h1>İzin ve tercihler</h1>
    <p>Bir işaret seçip takvimdeki günlere dokunun; basılı tutup gezdirerek birden çok güne işaretleyebilirsiniz. Aynı işarete yeniden dokunmak kaldırır.</p>
  </div>
  <AySecici />
</header>

{#if !depo.veri.staff.length}
  <div class="kart bos-durum">
    <h2>Önce personel ekleyin</h2>
    <p>İzin ve tercih işaretlemek için personel listesinde en az bir kişi olmalı.</p>
    <button class="dugme ana" onclick={() => git("kisiler")}>Personel ekle</button>
  </div>
{:else}
  <div class="sekmeler" role="tablist" aria-label="İşaret türü">
    <button role="tab" aria-selected={mod === "kisi"} class:secili={mod === "kisi"} onclick={() => (mod = "kisi")}>Kişi izinleri ve tercihleri</button>
    <button role="tab" aria-selected={mod === "tatil"} class:secili={mod === "tatil"} onclick={() => (mod = "tatil")}>Resmi tatil ve arife</button>
  </div>

  {#if onayli}<p class="onay-not" role="status">Bu ayın çizelgesi onaylı; işaretler değiştirilemez. Değiştirmek için önce Çizelge'de onayı kaldırın.</p>{/if}

  <div class="duzen">
    <aside class="kart yan">
      {#if mod === "kisi"}
        <h2 class="yan-bas">Kişi</h2>
        <ul class="kisiler">
          {#each kisiler as k (k.id)}
            {@const say = kisiAyIsaretleri(k.id)}
            <li>
              <button class:secili={k.id === seciliId} aria-pressed={k.id === seciliId} onclick={() => (seciliId = k.id)}>
                <span class="isaret {k.role}"></span>
                <span class="ad">{k.name}</span>
                <span class="sayilar">{#each Object.entries(say) as [t, n]}<i class="t-{t}" title="{TERCIH_AD[t as Tercih]}: {n} gün">{n}</i>{/each}</span>
              </button>
            </li>
          {/each}
        </ul>
      {:else}
        <h2 class="yan-bas">Tatil günleri</h2>
        <p class="yan-not">Hafta sonları zaten tatildir. Burada resmi tatil ve bayram günlerini, yarım gün çalışılan arifeleri işaretleyin; nöbet fazla mesaisi ve hazırlama görevleri buna göre hesaplanır.</p>
      {/if}
    </aside>

    <section class="kart takvim-kutu" aria-label="Ay takvimi">
      <div class="araclar" role="radiogroup" aria-label="İşaret">
        {#if mod === "kisi"}
          {#each ARACLAR as a}
            <button role="radio" aria-checked={arac === a} class="arac t-{a}" class:secili={arac === a} onclick={() => (arac = a)} title={a === "temizle" ? "İşareti kaldır" : TERCIH_ACIKLAMA[a]}>{a === "temizle" ? "Temizle" : TERCIH_AD[a]}</button>
          {/each}
        {:else}
          <button role="radio" aria-checked={tatilArac === "resmi"} class="arac t-resmi" class:secili={tatilArac === "resmi"} onclick={() => (tatilArac = "resmi")}>Resmi tatil</button>
          <button role="radio" aria-checked={tatilArac === "arife"} class="arac t-arife" class:secili={tatilArac === "arife"} onclick={() => (tatilArac = "arife")}>Arife (yarım gün)</button>
          <button role="radio" aria-checked={tatilArac === "temizle"} class="arac t-temizle" class:secili={tatilArac === "temizle"} onclick={() => (tatilArac = "temizle")}>Temizle</button>
        {/if}
      </div>
      {#if mod === "kisi" && secili}
        <p class="secili-kisi"><span class="isaret {secili.role}"></span><b>{secili.name}</b> · {ROL_AD[secili.role]} · <span class="soluk">{arac === "temizle" ? "dokunduğunuz günün işareti kalkar" : TERCIH_ACIKLAMA[arac]}</span></p>
      {/if}

      <div class="izgara" class:kilitli={onayli}>
        {#each GUN_KISA as g}<div class="bas" aria-hidden="true">{g}</div>{/each}
        {#each { length: gunler.bos } as _}<div class="bosluk" aria-hidden="true"></div>{/each}
        {#each gunler.liste as d}
          {@const y = depo.yil}{@const m = depo.ay}
          {@const t = mod === "kisi" && secili ? tercihAl(secili.id, y, m, d) : undefined}
          {@const rt = resmiTatilMi(y, m, d)}{@const ar = arifeMi(y, m, d)}{@const hs = haftaSonuMu(y, m, d)}
          <button class="gun" class:hs class:rt class:ar class:pasif={mod === "kisi" && aktifDegil(d)} disabled={onayli}
            aria-label="{gunMetni(y, m, d)}{rt ? ', resmi tatil' : ''}{ar ? ', arife' : ''}{t ? ', ' + TERCIH_AD[t] : ''}"
            onpointerdown={e => basla(d, e)} onpointerenter={() => gez(d)}
            onkeydown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); uygula(d); } }}>
            <span class="no rakam">{d}</span>
            {#if rt}<span class="etiket resmi">Resmi tatil</span>{:else if ar}<span class="etiket arife">Arife</span>{/if}
            {#if t}<span class="tercih t-{t}">{kisaltma[t]}</span>{/if}
          </button>
        {/each}
      </div>
      {#if mod === "kisi"}
        <p class="dipnot">Çizgili günler: kişi o tarihte çalışmıyor (işe başlama / ayrılış). Tercihler çizelge oluşturulurken dikkate alınır; çizelge zaten varsa yeniden oluşturun.</p>
      {/if}
    </section>
  </div>
{/if}

<style>
  .sayfa-bas { display: flex; flex-wrap: wrap; gap: var(--b4); align-items: flex-end; justify-content: space-between; margin-bottom: var(--b5); }
  .sayfa-bas > div { max-width: 64ch; }
  .sayfa-bas p { color: var(--yazi-2); margin-top: var(--b2); }
  .bos-durum { padding: var(--b6); display: grid; gap: var(--b3); justify-items: start; }
  .bos-durum p { color: var(--yazi-2); }
  .sekmeler { display: inline-flex; gap: 2px; padding: 3px; background: var(--yuzey); border: 1px solid var(--cizgi); border-radius: var(--r); margin-bottom: var(--b4); flex-wrap: wrap; }
  .sekmeler button { min-height: 34px; padding: 0 var(--b4); border: 0; border-radius: var(--r-kucuk); background: transparent; color: var(--yazi-2); font-weight: 500; cursor: pointer; }
  .sekmeler button.secili { background: var(--vurgu-zemin); color: var(--vurgu); font-weight: 600; }
  .onay-not { background: var(--bilgi-zemin); color: var(--bilgi); padding: var(--b3) var(--b4); border-radius: var(--r); margin-bottom: var(--b4); font-weight: 500; }
  .duzen { display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: var(--b4); align-items: start; }
  .yan { padding: var(--b4); position: sticky; top: var(--b4); max-height: calc(100dvh - 32px); overflow-y: auto; }
  .yan-bas { font-size: var(--f-md); margin-bottom: var(--b2); }
  .yan-not { font-size: var(--f-sm); color: var(--yazi-2); }
  .kisiler { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
  .kisiler button { display: flex; align-items: center; gap: var(--b2); width: 100%; min-height: 38px; padding: 0 var(--b2); border: 1px solid transparent; border-radius: var(--r-kucuk); background: transparent; cursor: pointer; text-align: left; }
  .kisiler button:hover { background: var(--yuzey-2); }
  .kisiler button.secili { background: var(--vurgu-zemin); border-color: color-mix(in srgb, var(--vurgu) 35%, transparent); font-weight: 600; }
  .kisiler .ad { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sayilar { display: inline-flex; gap: 3px; }
  .sayilar i { font-style: normal; font-size: var(--f-xs); font-weight: 600; min-width: 20px; text-align: center; padding: 0 4px; border-radius: 4px; }
  .takvim-kutu { padding: var(--b4); display: grid; gap: var(--b3); min-width: 0; }
  .araclar { display: flex; flex-wrap: wrap; gap: var(--b2); }
  .arac { min-height: 34px; padding: 0 var(--b3); border-radius: 999px; border: 1.5px solid var(--cizgi); background: var(--yuzey); cursor: pointer; font-weight: 500; font-size: var(--f-sm); }
  .arac.secili { border-color: currentColor; font-weight: 600; }
  .secili-kisi { font-size: var(--f-sm); display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
  .soluk { color: var(--soluk); }
  .izgara { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; user-select: none; touch-action: none; }
  .izgara.kilitli { opacity: .7; }
  .bas { text-align: center; font-size: var(--f-xs); font-weight: 600; color: var(--soluk); padding-bottom: 2px; }
  .gun { position: relative; min-height: 72px; display: flex; flex-direction: column; align-items: flex-start; gap: 3px; padding: 6px 8px; border: 1px solid var(--cizgi); border-radius: var(--r-kucuk); background: var(--yuzey); cursor: pointer; text-align: left; }
  .gun:hover:not(:disabled) { border-color: var(--soluk); }
  .gun.hs { background: var(--tatil-zemin); }
  .gun.rt { background: var(--tatil-zemin); border-color: color-mix(in srgb, var(--tatil) 45%, var(--cizgi)); }
  .gun.ar { background: var(--arife-zemin); }
  .gun.pasif { background-image: repeating-linear-gradient(135deg, transparent 0 6px, var(--cizgi-acik) 6px 8px); }
  .no { font-weight: 600; font-size: var(--f-sm); color: var(--yazi-2); }
  .etiket { font-size: var(--f-xs); font-weight: 600; }
  .etiket.resmi { color: var(--tatil); } .etiket.arife { color: var(--arife); }
  .tercih { font-size: var(--f-xs); font-weight: 600; padding: 1px 6px; border-radius: 4px; margin-top: auto; }
  .t-izinli { color: var(--izin); } .tercih.t-izinli, .sayilar .t-izinli { background: var(--izin-zemin); }
  .t-want { color: var(--ister); } .tercih.t-want, .sayilar .t-want { background: var(--ister-zemin); }
  .t-avoid { color: var(--istemez); } .tercih.t-avoid, .sayilar .t-avoid { background: var(--istemez-zemin); }
  .t-esVar { color: var(--es); } .tercih.t-esVar, .sayilar .t-esVar { background: var(--es-zemin); }
  .t-esYok { color: var(--esyok); } .tercih.t-esYok, .sayilar .t-esYok { background: var(--esyok-zemin); }
  .t-temizle { color: var(--yazi-2); }
  .t-resmi { color: var(--tatil); } .t-arife { color: var(--arife); }
  .arac.secili.t-izinli { background: var(--izin-zemin); } .arac.secili.t-want { background: var(--ister-zemin); } .arac.secili.t-avoid { background: var(--istemez-zemin); }
  .arac.secili.t-esVar { background: var(--es-zemin); } .arac.secili.t-esYok { background: var(--esyok-zemin); } .arac.secili.t-resmi { background: var(--tatil-zemin); } .arac.secili.t-arife { background: var(--arife-zemin); }
  .arac.secili.t-temizle { background: var(--yuzey-2); }
  .dipnot { font-size: var(--f-xs); color: var(--soluk); }

  @media (max-width: 860px) {
    .duzen { grid-template-columns: 1fr; }
    .yan { position: static; max-height: none; }
    .kisiler { grid-auto-flow: column; grid-auto-columns: max-content; overflow-x: auto; padding-bottom: 4px; }
    .kisiler button { border-color: var(--cizgi); border-radius: 999px; padding: 0 var(--b3); }
    .gun { min-height: 56px; padding: 4px 5px; }
    .etiket { display: none; }
    .gun.rt .no::after { content: " RT"; color: var(--tatil); font-size: var(--f-xs); }
    .gun.ar .no::after { content: " A"; color: var(--arife); font-size: var(--f-xs); }
    .izgara { gap: 4px; }
  }
</style>
