<script lang="ts">
  import type { Kisi } from "../../veri/tipler";
  import { depo, tercihAl, tercihAyarla, resmiTatilMi, arifeMi, resmiTatilAyarla, arifeAyarla, aydaCalisanlar, ayCizelgesi } from "../../veri/depo.svelte";
  import { TERCIH_ACIKLAMA, TERCIH_AD, ROL_AD, type Tercih } from "../../veri/tipler";
  import { GUN_KISA, gunMetni, gunSayisi, haftaGunu, haftaSonuMu, isoTarih } from "../../veri/tarih";
  import { veriAnlik } from "../../veri/depo.svelte";
  import { Baglam } from "../../motor/baglam";
  import IslemAlani from "../ortak/IslemAlani.svelte";
  import Ikon from "../ortak/Ikon.svelte";

  // gomulu: Günlük Eczane / Acil Eczane sayfasının alt sekmesi olarak; kimler: listelenecek kişiler (o kadronun
  // nöbet tutanları); onayKilidi: eczane çizelgesi onaylıysa işaretler kilitlensin mi (acil listesinde onay yok)
  let { git, gomulu = false, kimler = () => true, onayKilidi = true }: {
    git: (ad: "cizelge" | "puantaj" | "izinler" | "kisiler" | "ayarlar") => void; gomulu?: boolean; kimler?: (k: Kisi) => boolean; onayKilidi?: boolean;
  } = $props();

  type Mod = "kisi" | "tatil";
  let mod = $state<Mod>("kisi");
  const ARACLAR: (Tercih | "temizle")[] = ["izinli", "want", "avoid", "esVar", "esYok", "temizle"];
  let arac = $state<Tercih | "temizle">("izinli");
  type TatilArac = "resmi" | "arife" | "temizle";
  let tatilArac = $state<TatilArac>("resmi");

  const kisiler = $derived(aydaCalisanlar(depo.yil, depo.ay).filter(k => kimler(k)).sort((a, b) => a.name.localeCompare(b.name, "tr")));
  let seciliId = $state<number | null>(null);
  $effect(() => { if (seciliId === null || !kisiler.some(k => k.id === seciliId)) seciliId = kisiler[0]?.id ?? null; });
  const secili = $derived(kisiler.find(k => k.id === seciliId) ?? null);

  const onayli = $derived(onayKilidi && !!ayCizelgesi(depo.yil, depo.ay)?.onay);
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
  const kisaltma: Record<Tercih, string> = { izinli: "İzinli", want: "İstiyor", avoid: "İstemiyor", esVar: "Eş +", esYok: "Eş −" };
  const ARAC_AD: Record<Tercih | "temizle", string> = { izinli: "İzinli", want: "Nöbet istiyor", avoid: "Nöbet istemiyor", esVar: "Eş durumu: nöbetçi olsun", esYok: "Eş durumu: nöbetçi olmasın", temizle: "İşareti kaldır" };
  // personel arama ve işaretli gün sayısı
  let ara = $state("");
  const listelenen = $derived(kisiler.filter(k => k.name.toLocaleLowerCase("tr").includes(ara.trim().toLocaleLowerCase("tr"))));
  const isaretliGun = (id: number) => Object.values(kisiAyIsaretleri(id)).reduce((t, n) => t + (n ?? 0), 0);
  // izin arasındaki hafta sonu (izin sayılır; çizgili gösterilir) — motorun kendi kuralıyla, yalnız okunur
  const B = $derived(new Baglam(veriAnlik()));
  const izinArasi = (d: number) => !!secili && B.tercih(secili.id, depo.yil, depo.ay, d) !== "izinli" && B.izinArasiMi(secili.id, depo.yil, depo.ay, d);
  function isaretleriTemizle() {
    if (!secili || onayli) return;
    for (let d = 1; d <= gunSayisi(depo.yil, depo.ay); d++) if (tercihAl(secili.id, depo.yil, depo.ay, d)) tercihAyarla(secili.id, depo.yil, depo.ay, d, null);
  }
</script>

<svelte:window onpointerup={birak} onpointercancel={birak} />

{#if !depo.veri.staff.length}
  <div class="kart bos-durum">
    <h2>Önce personel ekleyin</h2>
    <p>İzin ve tercih işaretlemek için personel listesinde en az bir kişi olmalı.</p>
    <button class="dugme ana" onclick={() => git("kisiler")}>Personel ekle</button>
  </div>
{:else}
  <IslemAlani>
    <div class="secim" role="tablist" aria-label="İşaret türü">
      <button role="tab" aria-selected={mod === "kisi"} onclick={() => (mod = "kisi")}>Kişi izinleri ve tercihler</button>
      <button role="tab" aria-selected={mod === "tatil"} onclick={() => (mod = "tatil")}>Resmi tatil ve arife</button>
    </div>
  </IslemAlani>

  <p class="kutu bilgi kullanim"><Ikon ad="bilgi" boyut={16} /><span>Bir işaret türü seçip takvimdeki günlere dokunun; basılı tutup gezdirerek birden çok güne işaretleyebilirsiniz. Aynı işarete yeniden dokunmak kaldırır. Tercihler çizelge oluşturulurken dikkate alınır; çizelge zaten varsa yeniden oluşturun.</span></p>
  {#if onayli}<p class="kutu dikkat onay-not" role="status">Bu ayın çizelgesi onaylı; işaretler değiştirilemez. Değiştirmek için önce Günlük Eczane Nöbet Listesi'nde onayı kaldırın.</p>{/if}

  <div class="duzen">
    <aside class="panel yan">
      {#if mod === "kisi"}
        <div class="panel-bas"><h2>Personel</h2><span class="sayi">{kisiler.length} kişi</span></div>
        <div class="arama"><input class="girdi" type="search" placeholder="Ad ara" aria-label="Personel ara" bind:value={ara} /></div>
        <div class="kisi-liste">
          <table class="tablo">
            <thead><tr><th>Ad soyad</th><th class="sag">İşaretli gün</th></tr></thead>
            <tbody>
              {#each listelenen as k (k.id)}
                <tr class:secili={k.id === seciliId}>
                  <td><button class="kisi-btn" aria-pressed={k.id === seciliId} onclick={() => (seciliId = k.id)}><span class="isaret {k.role}"></span>{k.name}</button></td>
                  <td class="sag">{isaretliGun(k.id) || "—"}</td>
                </tr>
              {:else}<tr><td colspan="2" class="soluk">Eşleşen kişi yok</td></tr>{/each}
            </tbody>
          </table>
        </div>
      {:else}
        <div class="panel-bas"><h2>Tatil günleri</h2></div>
        <p class="panel-ic yan-not">Hafta sonları zaten tatildir. Burada resmi tatil ve bayram günlerini, yarım gün çalışılan arifeleri işaretleyin; nöbet fazla mesaisi ve hazırlama görevleri buna göre hesaplanır.</p>
      {/if}
    </aside>

    <div class="sag-sutun">
      {#if mod === "kisi" && secili}
        {@const say = kisiAyIsaretleri(secili.id)}
        <section class="panel">
          <div class="panel-bas"><h2>Seçili personel</h2>
            <button class="dugme kucuk" onclick={isaretleriTemizle} disabled={onayli || !isaretliGun(secili.id)}><Ikon ad="sil" boyut={15} />İşaretleri temizle</button></div>
          <div class="panel-ic secili-kisi">
            <p class="ad"><span class="isaret {secili.role}"></span><b>{secili.name}</b><span class="soluk">{ROL_AD[secili.role]}</span></p>
            <p class="ozet">{#each Object.entries(say) as [t, n]}<span class="tercih t-{t}">{TERCIH_AD[t as Tercih]}: {n} gün</span>{:else}<span class="soluk">Bu ay işaret yok.</span>{/each}</p>
          </div>
        </section>
      {/if}
      <section class="panel">
        <div class="panel-bas"><h2>İşaret türü</h2></div>
        <div class="panel-ic araclar" role="radiogroup" aria-label="İşaret">
          {#if mod === "kisi"}
            {#each ARACLAR as a}
              <label class="arac t-{a}" class:secili={arac === a} title={a === "temizle" ? "Dokunduğunuz günün işareti kalkar" : TERCIH_ACIKLAMA[a]}><input type="radio" name="arac" checked={arac === a} onchange={() => (arac = a)} />{ARAC_AD[a]}</label>
            {/each}
          {:else}
            <label class="arac t-resmi" class:secili={tatilArac === "resmi"}><input type="radio" name="tatil-arac" checked={tatilArac === "resmi"} onchange={() => (tatilArac = "resmi")} />Resmi tatil</label>
            <label class="arac t-arife" class:secili={tatilArac === "arife"}><input type="radio" name="tatil-arac" checked={tatilArac === "arife"} onchange={() => (tatilArac = "arife")} />Arife (yarım gün)</label>
            <label class="arac t-temizle" class:secili={tatilArac === "temizle"}><input type="radio" name="tatil-arac" checked={tatilArac === "temizle"} onchange={() => (tatilArac = "temizle")} />İşareti kaldır</label>
          {/if}
        </div>
        {#if mod === "kisi" && arac !== "temizle"}<p class="arac-not">{TERCIH_ACIKLAMA[arac]}</p>{/if}
      </section>

      <section class="panel" aria-label="Ay takvimi">
        <div class="panel-bas"><h2>{mod === "kisi" && secili ? secili.name + " · " : ""}Ay takvimi</h2>
          <p class="lejant">{#if mod === "kisi"}<span><i class="ornek o-izin"></i>İzinli</span><span><i class="ornek o-arasi"></i>İzin arası</span><span><i class="ornek o-ister"></i>İstiyor</span><span><i class="ornek o-istemez"></i>İstemiyor</span><span><i class="ornek o-pasif"></i>Dönem dışı</span>{:else}<span><i class="ornek o-resmi"></i>Resmi tatil</span><span><i class="ornek o-arife"></i>Arife</span>{/if}</p></div>
        <div class="izgara" class:kilitli={onayli}>
          {#each GUN_KISA as g, i}<div class="bas" class:hs={i >= 5} aria-hidden="true">{g}</div>{/each}
          {#each { length: gunler.bos } as _}<div class="bosluk" aria-hidden="true"></div>{/each}
          {#each gunler.liste as d}
            {@const y = depo.yil}{@const m = depo.ay}
            {@const t = mod === "kisi" && secili ? tercihAl(secili.id, y, m, d) : undefined}
            {@const rt = resmiTatilMi(y, m, d)}{@const ar = arifeMi(y, m, d)}{@const hs = haftaSonuMu(y, m, d)}
            {@const arasi = mod === "kisi" && izinArasi(d)}
            <button class="gun t-{t ?? 'yok'}" class:hs class:rt class:ar class:arasi class:pasif={mod === "kisi" && aktifDegil(d)} disabled={onayli}
              aria-label="{gunMetni(y, m, d)}{rt ? ', resmi tatil' : ''}{ar ? ', arife' : ''}{t ? ', ' + TERCIH_AD[t] : ''}{arasi ? ', izin arası' : ''}"
              onpointerdown={e => basla(d, e)} onpointerenter={() => gez(d)}
              onkeydown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); uygula(d); } }}>
              <span class="serit"><b class="rakam">{d}</b><span class="gunadi">{GUN_KISA[haftaGunu(y, m, d)]}</span>{#if rt}<span class="etiket">Resmi tatil</span>{:else if ar}<span class="etiket">Arife</span>{/if}</span>
              <span class="icerik">{#if t}<span class="tercih">{kisaltma[t]}</span>{:else if arasi}<span class="tercih">İzin arası</span>{/if}</span>
            </button>
          {/each}
        </div>
      </section>
    </div>
  </div>
{/if}

<style>
  .bos-durum { padding: var(--b6); display: grid; gap: var(--b3); justify-items: start; }
  .bos-durum p { color: var(--yazi-2); }
  .kullanim { display: flex; gap: var(--b2); align-items: flex-start; margin-bottom: var(--b4); }
  .kullanim :global(svg) { flex: none; margin-top: 2px; color: var(--bilgi); }
  .onay-not { margin-bottom: var(--b4); font-weight: 600; }
  .duzen { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: var(--b4); align-items: start; }
  .yan { position: sticky; top: 58px; max-height: calc(100dvh - 72px); display: flex; flex-direction: column; overflow: hidden; }
  .sayi { font-size: var(--f-xs); color: var(--yazi-2); font-weight: 600; }
  .arama { padding: var(--b2) var(--b3); border-bottom: 1px solid var(--cizgi-acik); }
  .kisi-liste { overflow-y: auto; min-height: 0; }
  .kisi-liste .tablo { border: 0; }
  .kisi-liste .tablo th, .kisi-liste .tablo td { border-left: 0; border-right: 0; }
  .kisi-liste tr.secili > * { background: var(--secili-satir) !important; font-weight: 700; }
  .kisi-btn { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 28px; border: 0; background: none; padding: 0; text-align: left; cursor: pointer; color: inherit; font: inherit; }
  .kisi-btn:hover { color: var(--baglanti); text-decoration: underline; }
  .yan-not { font-size: var(--f-sm); color: var(--yazi-2); }
  .sag-sutun { display: grid; gap: var(--b3); min-width: 0; }
  .secili-kisi { display: grid; gap: var(--b2); }
  .secili-kisi .ad { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: var(--f-md); }
  .secili-kisi .ad b { color: var(--lacivert); }
  .secili-kisi .ozet { display: flex; flex-wrap: wrap; gap: 6px; }
  .secili-kisi .tercih { font-size: var(--f-xs); }
  .soluk { color: var(--soluk); font-size: var(--f-sm); }
  .araclar { display: flex; flex-wrap: wrap; gap: var(--b2) var(--b4); }
  .arac { display: inline-flex; align-items: center; gap: 6px; min-height: 30px; font-size: var(--f-sm); font-weight: 600; color: var(--yazi); cursor: pointer; }
  .arac input { width: 16px; height: 16px; accent-color: var(--lacivert); }
  .arac-not { padding: 0 var(--b4) var(--b3); font-size: var(--f-xs); color: var(--yazi-2); }
  .lejant { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: var(--f-xs); color: var(--yazi-2); }
  .lejant span { display: inline-flex; align-items: center; gap: 5px; }
  .ornek { display: inline-block; width: 14px; height: 12px; border: 1px solid var(--cizgi); }
  .o-izin { background: var(--izin); border-color: var(--izin); }
  .o-arasi { background: repeating-linear-gradient(135deg, var(--izin-zemin) 0 3px, var(--yuzey) 3px 6px); }
  .o-ister { background: var(--tek-zemin); border-color: var(--tek); }
  .o-istemez { background: var(--haz-zemin); border-color: var(--haz); }
  .o-pasif { background: var(--yuzey-2); border-style: dashed; }
  .o-resmi { background: var(--hs-zemin); border-color: var(--lacivert); }
  .o-arife { background: var(--arife-zemin); border-color: var(--arife); }
  .izgara { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); user-select: none; touch-action: none; }
  .izgara.kilitli { opacity: .7; }
  .bas, .bosluk, .gun { border-right: 1px solid var(--cizgi); border-bottom: 1px solid var(--cizgi); }
  .izgara > :nth-child(7n) { border-right: 0; }
  .bas { background: var(--tablo-bas); color: var(--lacivert); font-size: var(--f-xs); font-weight: 700; text-align: center; padding: 6px 0; }
  .bosluk { background: var(--yuzey-2); }
  .gun { position: relative; min-height: 84px; display: flex; flex-direction: column; padding: 0; border-top: 0; border-left: 0; border-radius: 0; background: var(--yuzey); cursor: pointer; text-align: left; color: var(--yazi); }
  .gun:hover:not(:disabled) { box-shadow: inset 0 0 0 2px var(--altin); }
  .gun:focus-visible { outline: 2px solid var(--odak); outline-offset: -2px; }
  .serit { display: flex; align-items: center; gap: 6px; min-height: 24px; padding: 2px 8px; background: var(--panel-bas); border-bottom: 1px solid var(--cizgi-acik); font-size: var(--f-xs); color: var(--yazi-2); width: 100%; }
  .serit b { font-size: var(--f-sm); color: var(--lacivert); }
  .gun.hs .serit { background: color-mix(in srgb, var(--acik-mavi) 28%, var(--yuzey)); }
  .gun.rt { background: var(--hs-zemin); } .gun.rt .serit { background: color-mix(in srgb, var(--acik-mavi) 45%, var(--yuzey)); }
  .gun.ar { background: var(--arife-zemin); }
  .etiket { font-weight: 700; color: var(--lacivert); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .icerik { flex: 1; display: flex; align-items: flex-end; padding: 6px 8px; }
  .tercih { font-size: var(--f-xs); font-weight: 700; padding: 1px 6px; border-radius: 2px; border: 1px solid transparent; }
  /* işaretler: izinli koyu gri, izin arası çizgili, istiyor açık mavi, istemiyor açık turuncu */
  .gun.t-izinli { background: var(--izin); color: #FFFFFF; } .gun.t-izinli .serit { background: color-mix(in srgb, var(--izin) 85%, #000); color: #FFFFFF; } .gun.t-izinli .serit b { color: #FFFFFF; }
  .gun.arasi { background: repeating-linear-gradient(135deg, var(--izin-zemin) 0 6px, var(--yuzey) 6px 12px); }
  .gun.t-want { background: var(--tek-zemin); box-shadow: inset 0 0 0 2px var(--tek); }
  .gun.t-avoid { background: var(--haz-zemin); box-shadow: inset 0 0 0 2px var(--haz); }
  .gun.t-esVar { background: var(--es-zemin); box-shadow: inset 0 0 0 2px var(--es); }
  .gun.t-esYok { background: var(--esyok-zemin); box-shadow: inset 0 0 0 2px var(--esyok); }
  .gun.pasif { background: var(--yuzey-2); color: var(--soluk); } .gun.pasif .icerik::after { content: "Dönem dışı"; font-size: var(--f-xs); }
  .tercih.t-izinli, .secili-kisi .t-izinli { background: var(--izin); color: #FFFFFF; }
  .tercih.t-want, .secili-kisi .t-want { background: var(--tek-zemin); color: var(--tek); border-color: var(--tek); }
  .tercih.t-avoid, .secili-kisi .t-avoid { background: var(--haz-zemin); color: var(--haz); border-color: var(--haz); }
  .tercih.t-esVar, .secili-kisi .t-esVar { background: var(--es-zemin); color: var(--es); border-color: var(--es); }
  .tercih.t-esYok, .secili-kisi .t-esYok { background: var(--esyok-zemin); color: var(--esyok); border-color: var(--esyok); }
  .gun .tercih { background: transparent; border: 0; padding: 0; color: inherit; font-size: var(--f-sm); }
  .gun.arasi .tercih { color: var(--izin); }

  @media (max-width: 960px) {
    .duzen { grid-template-columns: 1fr; }
    .yan { position: static; max-height: 320px; }
  }
  @media (max-width: 720px) {
    .gun { min-height: 58px; }
    .serit { padding: 1px 4px; min-height: 18px; }
    .gunadi, .etiket { display: none; }
    .icerik { padding: 3px 4px; }
    .gun .tercih { font-size: 10px; }
  }
</style>
