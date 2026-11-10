<script lang="ts">
  import type { Kisi } from "../../veri/tipler";
  import { depo, tercihAl, tercihAyarla, resmiTatilMi, arifeMi, resmiTatilAyarla, arifeAyarla, aydaCalisanlar, ayCizelgesi } from "../../veri/depo.svelte";
  import { TERCIH_ACIKLAMA, TERCIH_AD, ROL_AD, type Tercih } from "../../veri/tipler";
  import { GUN_KISA, adIcerir, gunMetni, gunSayisi, haftaGunu, haftaSonuMu, isoTarih } from "../../veri/tarih";
  import { veriAnlik } from "../../veri/depo.svelte";
  import { Baglam } from "../../motor/baglam";
  import IslemAlani from "../ortak/IslemAlani.svelte";
  import Ikon from "../ortak/Ikon.svelte";

  // kimler: listelenecek kişiler (o kadronun
  // nöbet tutanları); onayKilidi: eczane çizelgesi onaylıysa işaretler kilitlensin mi (acil listesinde onay yok)
  let { git, kimler = () => true, onayKilidi = true }: {
    git: (ad: "cizelge" | "puantaj" | "izinler" | "kisiler" | "ayarlar") => void; kimler?: (k: Kisi) => boolean; onayKilidi?: boolean;
  } = $props();

  type Mod = "kisi" | "tatil";
  let mod = $state<Mod>("kisi");
  const ARACLAR: (Tercih | "temizle")[] = ["izinli", "want", "avoid", "esVar", "esYok", "temizle"];
  let arac = $state<Tercih | "temizle">("izinli");
  type TatilArac = "resmi" | "arife" | "temizle";
  let tatilArac = $state<TatilArac>("resmi");

  const kisiler = $derived(aydaCalisanlar(depo.yil, depo.ay).filter(k => kimler(k)).sort((a, b) => a.name.localeCompare(b.name, "tr")));

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
    {
      if (tatilArac === "resmi") resmiTatilAyarla(y, m, d, !(resmiTatilMi(y, m, d) && !suruk));
      else if (tatilArac === "arife") arifeAyarla(y, m, d, !(arifeMi(y, m, d) && !suruk));
      else { resmiTatilAyarla(y, m, d, false); arifeAyarla(y, m, d, false); }
    }
  }
  // dokunmatik ekranda parmak sayfayı kaydırabilsin: işaret basınca değil dokunma bitince (click) konur,
  // sürükleyerek işaretleme yalnız fare/kalemde
  let dokunma = false;
  function basla(d: number, e: PointerEvent) { dokunma = e.pointerType === "touch"; if (dokunma || e.button !== 0) return; uygula(d); suruk = true; }
  function tikla(d: number) { if (dokunma) { dokunma = false; uygula(d); } }
  function gez(d: number) { if (suruk) uygula(d); }
  // herkesin tablosu: hücreye dokunmak / sürüklemek o kişinin o gününe seçili işareti koyar
  function uygulaKisi(id: number, d: number) {
    if (onayli) return;
    const k = kisiler.find(x => x.id === id); if (!k || pasifMi(k, d)) return;
    const once = tercihAl(id, depo.yil, depo.ay, d);
    tercihAyarla(id, depo.yil, depo.ay, d, arac === "temizle" || (once === arac && !suruk) ? null : arac);
  }
  function baslaK(id: number, d: number, e: PointerEvent) { dokunma = e.pointerType === "touch"; if (dokunma || e.button !== 0) return; uygulaKisi(id, d); suruk = true; }
  function tiklaK(id: number, d: number) { if (dokunma) { dokunma = false; uygulaKisi(id, d); } }
  function gezK(id: number, d: number) { if (suruk) uygulaKisi(id, d); }
  const pasifMi = (k: Kisi, d: number) => (!!k.baslangic && isoTarih(depo.yil, depo.ay, d) < k.baslangic) || (!!k.bitis && isoTarih(depo.yil, depo.ay, d) > k.bitis);
  const KOD: Record<Tercih, string> = { izinli: "İ", want: "+", avoid: "−", esVar: "E+", esYok: "E−" };
  const GRUP_SIRA: Record<string, number> = { eczaci: 0, nobetci: 1, teknisyen: 2, destek: 3, servis: 4 };
  const GRUP_AD: Record<string, string> = { eczaci: "Eczacılar", nobetci: "Kemoterapi eczacıları", teknisyen: "Teknikerler", destek: "Destek personeli", servis: "Acil servis personeli" };
  const izinliSayisi = (d: number) => kisiler.filter(k => tercihAl(k.id, depo.yil, depo.ay, d) === "izinli").length;
  const izinGun = (id: number) => kisiAyIsaretleri(id).izinli ?? 0;
  function birak() { suruk = false; }

  const kisiAyIsaretleri = (id: number) => {
    const o: Partial<Record<Tercih, number>> = {};
    for (let d = 1; d <= gunSayisi(depo.yil, depo.ay); d++) { const t = tercihAl(id, depo.yil, depo.ay, d); if (t) o[t] = (o[t] ?? 0) + 1; }
    return o;
  };
  const ARAC_AD: Record<Tercih | "temizle", string> = { izinli: "İzinli", want: "Nöbet istiyor", avoid: "Nöbet istemiyor", esVar: "Eş durumu: nöbetçi olsun", esYok: "Eş durumu: nöbetçi olmasın", temizle: "İşareti kaldır" };
  // personel arama ve işaretli gün sayısı
  let ara = $state("");
  const listelenen = $derived(kisiler.filter(k => adIcerir(k.name, ara)));
  const tabloKisiler = $derived(listelenen.slice().sort((a, b) => (GRUP_SIRA[a.role] ?? 9) - (GRUP_SIRA[b.role] ?? 9) || a.name.localeCompare(b.name, "tr")));
  const isaretliGun = (id: number) => Object.values(kisiAyIsaretleri(id)).reduce((t, n) => t + (n ?? 0), 0);
  // izin arasındaki hafta sonu (izin sayılır; çizgili gösterilir) — motorun kendi kuralıyla, yalnız okunur
  const B = $derived(new Baglam(veriAnlik()));
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

  <p class="kutu bilgi kullanim"><Ikon ad="bilgi" boyut={16} /><span>Bir işaret türü seçip {mod === "kisi" ? "tablodaki hücrelere" : "takvimdeki günlere"} dokunun; bilgisayarda fareyle basılı tutup gezdirerek birden çok güne işaretleyebilirsiniz. Aynı işarete yeniden dokunmak kaldırır. Tercihler çizelge oluşturulurken dikkate alınır; çizelge zaten varsa yeniden oluşturun.</span></p>
  {#if onayli}<p class="kutu dikkat onay-not" role="status">Bu ayın çizelgesi onaylı; işaretler değiştirilemez. Değiştirmek için önce Günlük Eczane Nöbet Listesi'nde onayı kaldırın.</p>{/if}

  {#if mod === "kisi"}
    <div class="arac-cubuk" role="radiogroup" aria-label="İşaret">
      {#each ARACLAR as a}
        <button class="arac-d t-{a}" role="radio" aria-checked={arac === a} onclick={() => (arac = a)} title={a === "temizle" ? "Dokunduğunuz günün işareti kalkar" : TERCIH_ACIKLAMA[a]}>{#if a !== "temizle"}<i class="kod k-{a}">{KOD[a]}</i>{:else}<Ikon ad="sil" boyut={15} />{/if}{ARAC_AD[a]}</button>
      {/each}
      <input class="girdi ara-k" type="search" placeholder="Ad ara" aria-label="Personel ara" bind:value={ara} />
    </div>
    {#if arac !== "temizle"}<p class="arac-not2">{TERCIH_ACIKLAMA[arac]}</p>{/if}
    <section class="panel" aria-label="Herkesin izin ve tercihleri">
      <!-- svelte-ignore a11y_no_noninteractive_tabindex (kaydırılan tablo klavyeyle kaydırılabilsin) -->
      <div class="tablo-kap" tabindex="0" role="region" aria-label="İzin ve tercih tablosu">
        <table class="herkes" class:kilitli={onayli}>
          <thead><tr><th class="ad" scope="col">Ad soyad</th>
            {#each gunler.liste as d}<th scope="col" class:hs={haftaSonuMu(depo.yil, depo.ay, d)} class:rt={resmiTatilMi(depo.yil, depo.ay, d)} class:ar={arifeMi(depo.yil, depo.ay, d)} title={gunMetni(depo.yil, depo.ay, d)}><span class="rakam">{d}</span><small>{GUN_KISA[haftaGunu(depo.yil, depo.ay, d)]}</small></th>{/each}
            <th class="top" scope="col">İzin</th><th class="top" scope="col">Tercih</th></tr></thead>
          <tbody>
            {#each tabloKisiler as k, i (k.id)}
              {#if i === 0 || tabloKisiler[i - 1].role !== k.role}<tr class="grup"><th class="ad" scope="rowgroup">{GRUP_AD[k.role] ?? ROL_AD[k.role]}</th><td colspan={gunler.liste.length + 2}></td></tr>{/if}
              <tr>
                <th class="ad" scope="row"><span class="isaret {k.role}"></span>{k.name}</th>
                {#each gunler.liste as d}
                  {@const t = tercihAl(k.id, depo.yil, depo.ay, d)}
                  {@const pasif = pasifMi(k, d)}
                  {@const arasi = !t && B.izinArasiMi(k.id, depo.yil, depo.ay, d)}
                  <td class:hs={haftaSonuMu(depo.yil, depo.ay, d)} class:rt={resmiTatilMi(depo.yil, depo.ay, d)} class:arasi class:pasif>
                    <button disabled={onayli || pasif} onpointerdown={e => baslaK(k.id, d, e)} onclick={() => tiklaK(k.id, d)} onpointerenter={() => gezK(k.id, d)}
                      onkeydown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); uygulaKisi(k.id, d); } }}
                      aria-label="{k.name}, {gunMetni(depo.yil, depo.ay, d)}: {t ? TERCIH_AD[t] : arasi ? 'izin arası' : pasif ? 'dönem dışı' : 'işaret yok'}">{#if t}<i class="kod k-{t}">{KOD[t]}</i>{/if}</button>
                  </td>
                {/each}
                <td class="top rakam">{izinGun(k.id) || "–"}</td><td class="top rakam">{isaretliGun(k.id) - izinGun(k.id) || "–"}</td>
              </tr>
            {:else}<tr><td colspan={gunler.liste.length + 3} class="soluk">Eşleşen kişi yok</td></tr>{/each}
            <tr class="alt"><th class="ad" scope="row">O gün izinli</th>{#each gunler.liste as d}{@const n = izinliSayisi(d)}<td class:cok={n >= 2}>{n || ""}</td>{/each}<td colspan="2"></td></tr>
          </tbody>
        </table>
      </div>
    </section>
    <p class="lejant alt-lejant"><span><i class="kod k-izinli">İ</i>İzinli</span><span><i class="ornek o-arasi"></i>İzin arası (hafta sonu da izin sayılır)</span><span><i class="kod k-want">+</i>Nöbet istiyor</span><span><i class="kod k-avoid">−</i>Nöbet istemiyor</span><span><i class="kod k-esVar">E+</i>Eş nöbetçi olsun</span><span><i class="kod k-esYok">E−</i>Eş nöbetçi olmasın</span><span><i class="ornek o-pasif"></i>Dönem dışı</span></p>
  {:else}
  <div class="duzen">
    <aside class="panel yan">
      <div class="panel-bas"><h2>Tatil günleri</h2></div>
      <p class="panel-ic yan-not">Hafta sonları zaten tatildir. Burada resmi tatil ve bayram günlerini, yarım gün çalışılan arifeleri işaretleyin; nöbet fazla mesaisi ve hazırlama görevleri buna göre hesaplanır.</p>
    </aside>
    <div class="sag-sutun">
      <section class="panel">
        <div class="panel-bas"><h2>İşaret türü</h2></div>
        <div class="panel-ic araclar" role="radiogroup" aria-label="İşaret">
          <label class="arac t-resmi" class:secili={tatilArac === "resmi"}><input type="radio" name="tatil-arac" checked={tatilArac === "resmi"} onchange={() => (tatilArac = "resmi")} />Resmi tatil</label>
          <label class="arac t-arife" class:secili={tatilArac === "arife"}><input type="radio" name="tatil-arac" checked={tatilArac === "arife"} onchange={() => (tatilArac = "arife")} />Arife (yarım gün)</label>
          <label class="arac t-temizle" class:secili={tatilArac === "temizle"}><input type="radio" name="tatil-arac" checked={tatilArac === "temizle"} onchange={() => (tatilArac = "temizle")} />İşareti kaldır</label>
        </div>
      </section>
      <section class="panel" aria-label="Ay takvimi">
        <div class="panel-bas"><h2>Ay takvimi</h2>
          <p class="lejant"><span><i class="ornek o-resmi"></i>Resmi tatil</span><span><i class="ornek o-arife"></i>Arife</span></p></div>
        <div class="izgara" class:kilitli={onayli}>
          {#each GUN_KISA as g, i}<div class="bas" class:hs={i >= 5} aria-hidden="true">{g}</div>{/each}
          {#each { length: gunler.bos } as _}<div class="bosluk" aria-hidden="true"></div>{/each}
          {#each gunler.liste as d}
            {@const y = depo.yil}{@const m = depo.ay}
            {@const rt = resmiTatilMi(y, m, d)}{@const ar = arifeMi(y, m, d)}{@const hs = haftaSonuMu(y, m, d)}
            <button class="gun" class:hs class:rt class:ar disabled={onayli}
              aria-label="{gunMetni(y, m, d)}{rt ? ', resmi tatil' : ''}{ar ? ', arife' : ''}"
              onpointerdown={e => basla(d, e)} onclick={() => tikla(d)} onpointerenter={() => gez(d)}
              onkeydown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); uygula(d); } }}>
              <span class="serit"><b class="rakam">{d}</b><span class="gunadi">{GUN_KISA[haftaGunu(y, m, d)]}</span>{#if rt}<span class="etiket">Resmi tatil</span>{:else if ar}<span class="etiket">Arife</span>{/if}</span>
              <span class="icerik"></span>
            </button>
          {/each}
        </div>
      </section>
    </div>
  </div>
  {/if}
{/if}

<style>
  .bos-durum { padding: var(--b6); display: grid; gap: var(--b3); justify-items: start; }
  .bos-durum p { color: var(--yazi-2); }
  .kullanim { display: flex; gap: var(--b2); align-items: flex-start; margin-bottom: var(--b4); }
  .kullanim :global(svg) { flex: none; margin-top: 2px; color: var(--bilgi); }
  .onay-not { margin-bottom: var(--b4); font-weight: 600; }
  .duzen { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: var(--b4); align-items: start; }
  .yan-not { font-size: var(--f-sm); color: var(--yazi-2); }
  .sag-sutun { display: grid; gap: var(--b3); min-width: 0; }
  .araclar { display: flex; flex-wrap: wrap; gap: var(--b2) var(--b4); }
  .arac { display: inline-flex; align-items: center; gap: 6px; min-height: 30px; font-size: var(--f-sm); font-weight: 600; color: var(--yazi); cursor: pointer; }
  .arac input { width: 16px; height: 16px; accent-color: var(--lacivert); }
  .lejant { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: var(--f-xs); color: var(--yazi-2); }
  .lejant span { display: inline-flex; align-items: center; gap: 5px; }
  .ornek { display: inline-block; width: 14px; height: 12px; border: 1px solid var(--cizgi); }
  .o-arasi { background: repeating-linear-gradient(135deg, var(--izin-zemin) 0 3px, var(--yuzey) 3px 6px); }
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
  /* işaretler: izinli koyu gri, izin arası çizgili, istiyor açık mavi, istemiyor açık turuncu */

  .arac-cubuk { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: var(--b2); }
  .arac-d { display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 4px 12px; border: 1px solid var(--cizgi); border-radius: var(--r-kucuk); background: var(--yuzey); color: var(--yazi); font: inherit; font-size: var(--f-sm); font-weight: 600; cursor: pointer; }
  .arac-d[aria-checked="true"] { border-color: var(--lacivert); box-shadow: inset 0 0 0 1px var(--lacivert); background: var(--vurgu-zemin); }
  .arac-d.t-temizle { color: var(--hata); }
  .ara-k { margin-left: auto; width: 200px; }
  .arac-not2 { font-size: var(--f-xs); color: var(--yazi-2); margin-bottom: var(--b3); }
  .kod { display: inline-grid; place-items: center; min-width: 20px; height: 18px; padding: 0 2px; border-radius: 2px; font-style: normal; font-size: 11px; font-weight: 700; border: 1px solid transparent; }
  .k-izinli { background: var(--izin); color: #FFFFFF; }
  .k-want { background: var(--tek-zemin); color: var(--tek); border-color: var(--tek); }
  .k-avoid { background: var(--haz-zemin); color: var(--haz); border-color: var(--haz); }
  .k-esVar { background: var(--es-zemin); color: var(--es); border-color: var(--es); }
  .k-esYok { background: var(--esyok-zemin); color: var(--esyok); border-color: var(--esyok); }
  .herkes { border-collapse: separate; border-spacing: 0; font-size: var(--f-sm); width: 100%; user-select: none; touch-action: none; }
  .herkes.kilitli { opacity: .7; }
  @media (pointer: coarse) { .herkes, .izgara { touch-action: manipulation; } }
  .herkes th, .herkes td { border-right: 1px solid var(--cizgi-acik); border-bottom: 1px solid var(--cizgi-acik); padding: 0; text-align: center; white-space: nowrap; }
  .herkes thead th { position: sticky; top: 0; z-index: 2; background: var(--tablo-bas); color: var(--lacivert); font-size: var(--f-xs); font-weight: 700; padding: 4px 0; min-width: 24px; }
  .herkes thead th small { display: block; font-size: 11px; font-weight: 600; color: var(--yazi-2); }
  .herkes thead th.hs { background: color-mix(in srgb, var(--acik-mavi) 28%, var(--yuzey)); }
  .herkes thead th.rt { background: color-mix(in srgb, var(--acik-mavi) 45%, var(--yuzey)); }
  .herkes thead th.ar { background: var(--arife-zemin); }
  .herkes .ad { position: sticky; left: 0; z-index: 1; background: var(--yuzey); text-align: left; padding: 0 var(--b3); font-weight: 600; min-width: 150px; }
  .herkes thead .ad { z-index: 3; background: var(--tablo-bas); }
  .herkes .ad .isaret { margin-right: 8px; }
  .herkes tr.grup .ad, .herkes tr.grup td { background: var(--panel-bas); font-size: 11px; color: var(--lacivert); font-weight: 700; text-transform: uppercase; letter-spacing: .06em; padding-block: 4px; }
  .herkes td.hs { background: var(--hs-zemin); }
  .herkes td.rt { background: color-mix(in srgb, var(--acik-mavi) 30%, var(--yuzey)); }
  .herkes td.arasi { background: repeating-linear-gradient(135deg, var(--izin-zemin) 0 4px, var(--yuzey) 4px 8px); }
  .herkes td.pasif { background: var(--yuzey-2); }
  .herkes td button { width: 100%; min-width: 24px; height: 30px; border: 0; background: transparent; cursor: pointer; padding: 0; display: grid; place-items: center; }
  /* telefonda dokunma hedefi en az 28 px */
  @media (max-width: 720px) { .herkes td button, .herkes thead th:not(.ad) { min-width: 28px; } }
  .herkes td button:hover:not(:disabled) { outline: 2px solid var(--altin); outline-offset: -2px; }
  .herkes td button:focus-visible { outline: 2px solid var(--odak); outline-offset: -2px; }
  .herkes td button:disabled { cursor: default; }
  .herkes .top { min-width: 46px; font-weight: 700; color: var(--lacivert); background: var(--yuzey-2); }
  .herkes thead .top { background: var(--tablo-bas); }
  .herkes tr.alt .ad, .herkes tr.alt td { background: var(--panel-bas); font-weight: 700; color: var(--lacivert); height: 28px; }
  .herkes tr.alt td.cok { background: var(--haz-zemin); color: var(--haz); }
  .alt-lejant { margin-top: var(--b2); }
  .alt-lejant .kod { min-width: 18px; height: 16px; font-size: 10px; }
  @media (max-width: 720px) { .ara-k { margin-left: 0; width: 100%; } }
  @media (max-width: 960px) {
    .duzen { grid-template-columns: 1fr; }
  }
  @media (max-width: 720px) {
    .gun { min-height: 58px; }
    .serit { padding: 1px 4px; min-height: 18px; }
    .gunadi, .etiket { display: none; }
    .icerik { padding: 3px 4px; }
  }
</style>
