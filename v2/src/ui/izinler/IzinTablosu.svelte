<script lang="ts">
  // İzinler > Kişi izinleri ve tercihler: işaret türü düğmeleri, aralık seçimi, herkesin gün gün tablosu.
  import type { Kisi } from "../../veri/tipler";
  import { depo, tercihAl, tercihAyarla, resmiTatilMi, arifeMi } from "../../veri/depo.svelte";
  import { TERCIH_ACIKLAMA, TERCIH_AD, ROL_AD, type Tercih } from "../../veri/tipler";
  import { GUN_KISA, adIcerir, gunMetni, gunSayisi, haftaGunu, haftaSonuMu, isoTarih } from "../../veri/tarih";
  import { veriAnlik } from "../../veri/depo.svelte";
  import { Baglam } from "../../motor/baglam";
  import Ikon from "../ortak/Ikon.svelte";

  let { kisiler, onayli }: { kisiler: Kisi[]; onayli: boolean } = $props();
  const ARACLAR: (Tercih | "temizle")[] = ["izinli", "want", "avoid", "esVar", "esYok", "temizle"];
  let arac = $state<Tercih | "temizle">("izinli");
  const gunler = $derived.by(() => {
    const y = depo.yil,
      m = depo.ay,
      n = gunSayisi(y, m),
      bos = haftaGunu(y, m, 1);
    return { bos, liste: Array.from({ length: n }, (_, i) => i + 1) };
  });

  // sürükleyerek birden çok güne işaret: basılı tutup gezdirilen günler aynı işareti alır (fare / kalem); dokunmatik
  // ekranda parmak sayfayı kaydırabilsin diye işaret dokunma bitince (click) konur
  let suruk = $state(false);
  let dokunma = false;
  function birak() {
    suruk = false;
  }
  // herkesin tablosu: hücreye dokunmak / sürüklemek o kişinin o gününe seçili işareti koyar
  function uygulaKisi(id: number, d: number) {
    if (onayli) return;
    const k = kisiler.find(x => x.id === id);
    if (!k || pasifMi(k, d)) return;
    const once = tercihAl(id, depo.yil, depo.ay, d);
    tercihAyarla(id, depo.yil, depo.ay, d, arac === "temizle" || (once === arac && !suruk) ? null : arac);
  }
  // aralık seçimi (telefonda da): ilk dokunuş başlangıç, ikincisi bitiş; aradaki bütün günler seçili işareti alır
  let aralikModu = $state(false);
  let aralikBas = $state<{ id: number; d: number } | null>(null);
  function aralikTikla(id: number, d: number) {
    if (onayli) return;
    const k = kisiler.find(x => x.id === id);
    if (!k) return;
    if (!aralikBas || aralikBas.id !== id) {
      if (!pasifMi(k, d)) aralikBas = { id, d };
      return;
    }
    const [a, b] = aralikBas.d <= d ? [aralikBas.d, d] : [d, aralikBas.d];
    for (let g = a; g <= b; g++) if (!pasifMi(k, g)) tercihAyarla(id, depo.yil, depo.ay, g, arac === "temizle" ? null : arac);
    aralikBas = null;
  }
  $effect(() => {
    void [depo.yil, depo.ay, aralikModu, arac];
    aralikBas = null;
  });
  function baslaK(id: number, d: number, e: PointerEvent) {
    dokunma = e.pointerType === "touch" || aralikModu;
    if (dokunma || e.button !== 0) return;
    uygulaKisi(id, d);
    suruk = true;
  }
  function tiklaK(id: number, d: number) {
    if (dokunma) {
      dokunma = false;
      if (aralikModu) aralikTikla(id, d);
      else uygulaKisi(id, d);
    }
  }
  function gezK(id: number, d: number) {
    if (suruk) uygulaKisi(id, d);
  }
  const pasifMi = (k: Kisi, d: number) =>
    (!!k.baslangic && isoTarih(depo.yil, depo.ay, d) < k.baslangic) || (!!k.bitis && isoTarih(depo.yil, depo.ay, d) > k.bitis);
  const KOD: Record<Tercih, string> = { izinli: "İ", want: "+", avoid: "−", esVar: "E+", esYok: "E−" };
  const GRUP_SIRA: Record<string, number> = { eczaci: 0, nobetci: 1, teknisyen: 2, destek: 3, servis: 4 };
  const GRUP_AD: Record<string, string> = {
    eczaci: "Eczacılar",
    nobetci: "Kemoterapi eczacıları",
    teknisyen: "Teknikerler",
    destek: "Destek personeli",
    servis: "Acil servis personeli",
  };
  const izinliSayisi = (d: number) => kisiler.filter(k => tercihAl(k.id, depo.yil, depo.ay, d) === "izinli").length;
  const izinGun = (id: number) => kisiAyIsaretleri(id).izinli ?? 0;
  const kisiAyIsaretleri = (id: number) => {
    const o: Partial<Record<Tercih, number>> = {};
    for (let d = 1; d <= gunSayisi(depo.yil, depo.ay); d++) {
      const t = tercihAl(id, depo.yil, depo.ay, d);
      if (t) o[t] = (o[t] ?? 0) + 1;
    }
    return o;
  };
  const ARAC_AD: Record<Tercih | "temizle", string> = {
    izinli: "İzinli",
    want: "Nöbet istiyor",
    avoid: "Nöbet istemiyor",
    esVar: "Eş durumu: nöbetçi olsun",
    esYok: "Eş durumu: nöbetçi olmasın",
    temizle: "İşareti kaldır",
  };
  // personel arama ve işaretli gün sayısı
  let ara = $state("");
  const listelenen = $derived(kisiler.filter(k => adIcerir(k.name, ara)));
  const tabloKisiler = $derived(
    listelenen.slice().sort((a, b) => (GRUP_SIRA[a.role] ?? 9) - (GRUP_SIRA[b.role] ?? 9) || a.name.localeCompare(b.name, "tr")),
  );
  const isaretliGun = (id: number) => Object.values(kisiAyIsaretleri(id)).reduce((t, n) => t + (n ?? 0), 0);
  // izin arasındaki hafta sonu (izin sayılır; çizgili gösterilir) — motorun kendi kuralıyla, yalnız okunur
  const B = $derived(new Baglam(veriAnlik()));
</script>

<svelte:window onpointerup={birak} onpointercancel={birak} />

<div class="arac-cubuk" role="radiogroup" aria-label="İşaret">
  {#each ARACLAR as a}
    <button
      class="arac-d t-{a}"
      role="radio"
      aria-checked={arac === a}
      onclick={() => (arac = a)}
      title={a === "temizle" ? "Dokunduğunuz günün işareti kalkar" : TERCIH_ACIKLAMA[a]}
      >{#if a !== "temizle"}<i class="kod k-{a}">{KOD[a]}</i>{:else}<Ikon ad="sil" boyut={15} />{/if}{ARAC_AD[a]}</button
    >
  {/each}
  <button
    class="arac-d aralik-d"
    aria-pressed={aralikModu}
    onclick={() => (aralikModu = !aralikModu)}
    title="Başlangıç ve bitiş gününe dokunarak aradaki bütün günleri işaretleyin">Aralık seç</button
  >
  <input class="girdi ara-k" type="search" placeholder="Ad ara" aria-label="Personel ara" bind:value={ara} />
</div>
{#if aralikModu}<p class="kutu bilgi aralik-not" role="status">
    {#if aralikBas}{kisiler.find(k => k.id === aralikBas?.id)?.name}, {gunMetni(depo.yil, depo.ay, aralikBas.d)} seçildi: bitiş gününe dokunun
      ({ARAC_AD[arac].toLocaleLowerCase("tr")}).
      <button class="dugme kucuk" onclick={() => (aralikBas = null)}>Vazgeç</button>
    {:else}Aralık seçimi açık: kişinin satırında başlangıç gününe, sonra bitiş gününe dokunun.{/if}
  </p>{/if}
{#if arac !== "temizle"}<p class="arac-not2">{TERCIH_ACIKLAMA[arac]}</p>{/if}
<section class="panel" aria-label="Herkesin izin ve tercihleri">
  <!-- svelte-ignore a11y_no_noninteractive_tabindex (kaydırılan tablo klavyeyle kaydırılabilsin) -->
  <div class="tablo-kap" tabindex="0" role="region" aria-label="İzin ve tercih tablosu">
    <table class="herkes" class:kilitli={onayli}>
      <thead
        ><tr
          ><th class="ad" scope="col">Ad soyad</th>
          {#each gunler.liste as d}<th
              scope="col"
              class:hs={haftaSonuMu(depo.yil, depo.ay, d)}
              class:rt={resmiTatilMi(depo.yil, depo.ay, d)}
              class:ar={arifeMi(depo.yil, depo.ay, d)}
              title={gunMetni(depo.yil, depo.ay, d)}
              ><span class="rakam">{d}</span><small>{GUN_KISA[haftaGunu(depo.yil, depo.ay, d)]}</small></th
            >{/each}
          <th class="top" scope="col">İzin</th><th class="top" scope="col">Tercih</th></tr
        ></thead
      >
      <tbody>
        {#each tabloKisiler as k, i (k.id)}
          {#if i === 0 || tabloKisiler[i - 1].role !== k.role}<tr class="grup"
              ><th class="ad" scope="rowgroup">{GRUP_AD[k.role] ?? ROL_AD[k.role]}</th><td colspan={gunler.liste.length + 2}></td></tr
            >{/if}
          <tr>
            <th class="ad" scope="row"><span class="isaret {k.role}"></span>{k.name}</th>
            {#each gunler.liste as d}
              {@const t = tercihAl(k.id, depo.yil, depo.ay, d)}
              {@const pasif = pasifMi(k, d)}
              {@const arasi = !t && B.izinArasiMi(k.id, depo.yil, depo.ay, d)}
              <td
                class:hs={haftaSonuMu(depo.yil, depo.ay, d)}
                class:rt={resmiTatilMi(depo.yil, depo.ay, d)}
                class:arasi
                class:pasif
                class:aralik-bas={aralikBas?.id === k.id && aralikBas.d === d}
              >
                <button
                  disabled={onayli || pasif}
                  onpointerdown={e => baslaK(k.id, d, e)}
                  onclick={() => tiklaK(k.id, d)}
                  onpointerenter={() => gezK(k.id, d)}
                  onkeydown={e => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (aralikModu) aralikTikla(k.id, d);
                      else uygulaKisi(k.id, d);
                    }
                  }}
                  aria-label="{k.name}, {gunMetni(depo.yil, depo.ay, d)}: {t
                    ? TERCIH_AD[t]
                    : arasi
                      ? 'izin arası'
                      : pasif
                        ? 'dönem dışı'
                        : 'işaret yok'}"
                  >{#if t}<i class="kod k-{t}">{KOD[t]}</i>{/if}</button
                >
              </td>
            {/each}
            <td class="top rakam">{izinGun(k.id) || "–"}</td><td class="top rakam">{isaretliGun(k.id) - izinGun(k.id) || "–"}</td>
          </tr>
        {:else}<tr><td colspan={gunler.liste.length + 3} class="soluk">Eşleşen kişi yok</td></tr>{/each}
        <tr class="alt"
          ><th class="ad" scope="row">O gün izinli</th>{#each gunler.liste as d}{@const n = izinliSayisi(d)}<td class:cok={n >= 2}
              >{n || ""}</td
            >{/each}<td colspan="2"></td></tr
        >
      </tbody>
    </table>
  </div>
</section>
<p class="lejant alt-lejant">
  <span><i class="kod k-izinli">İ</i>İzinli</span><span><i class="ornek o-arasi"></i>İzin arası (hafta sonu da izin sayılır)</span><span
    ><i class="kod k-want">+</i>Nöbet istiyor</span
  ><span><i class="kod k-avoid">−</i>Nöbet istemiyor</span><span><i class="kod k-esVar">E+</i>Eş nöbetçi olsun</span><span
    ><i class="kod k-esYok">E−</i>Eş nöbetçi olmasın</span
  ><span><i class="ornek o-pasif"></i>Dönem dışı</span>
</p>

<style>
  .arac-d.t-temizle {
    color: var(--hata);
  }
  .arac {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 30px;
    font-size: var(--f-sm);
    font-weight: 600;
    color: var(--yazi);
    cursor: pointer;
  }
  .lejant {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    font-size: var(--f-xs);
    color: var(--yazi-2);
  }
  .lejant span {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .ornek {
    display: inline-block;
    width: 14px;
    height: 12px;
    border: 1px solid var(--cizgi);
  }
  .o-arasi {
    background: repeating-linear-gradient(135deg, var(--izin-zemin) 0 3px, var(--yuzey) 3px 6px);
  }
  .o-pasif {
    background: var(--yuzey-2);
    border-style: dashed;
  }
  .bas,
  .bosluk,
  .gun {
    border-right: 1px solid var(--cizgi);
    border-bottom: 1px solid var(--cizgi);
  }
  .bas {
    background: var(--tablo-bas);
    color: var(--lacivert);
    font-size: var(--f-xs);
    font-weight: 700;
    text-align: center;
    padding: 6px 0;
  }
  /* işaretler: izinli koyu gri, izin arası çizgili, istiyor açık mavi, istemiyor açık turuncu */
  .arac-cubuk {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    margin-bottom: var(--b2);
  }
  .arac-d {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 34px;
    padding: 4px 12px;
    border: 1px solid var(--cizgi);
    border-radius: var(--r-kucuk);
    background: var(--yuzey);
    color: var(--yazi);
    font: inherit;
    font-size: var(--f-sm);
    font-weight: 600;
    cursor: pointer;
  }
  .arac-d[aria-checked="true"] {
    border-color: var(--lacivert);
    box-shadow: inset 0 0 0 1px var(--lacivert);
    background: var(--vurgu-zemin);
  }
  .aralik-d[aria-pressed="true"] {
    border-color: var(--vurgu);
    background: var(--vurgu);
    color: var(--vurgu-yazi);
  }
  .aralik-not {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--b2);
    margin-bottom: var(--b2);
  }
  .herkes td.aralik-bas button {
    outline: 3px solid var(--vurgu);
    outline-offset: -3px;
  }
  .ara-k {
    margin-left: auto;
    width: 200px;
  }
  .arac-not2 {
    font-size: var(--f-xs);
    color: var(--yazi-2);
    margin-bottom: var(--b3);
  }
  .kod {
    display: inline-grid;
    place-items: center;
    min-width: 20px;
    height: 18px;
    padding: 0 2px;
    border-radius: 2px;
    font-style: normal;
    font-size: 11px;
    font-weight: 700;
    border: 1px solid transparent;
  }
  .k-izinli {
    background: var(--izin);
    color: #ffffff;
  }
  .k-want {
    background: var(--tek-zemin);
    color: var(--tek);
    border-color: var(--tek);
  }
  .k-avoid {
    background: var(--haz-zemin);
    color: var(--haz);
    border-color: var(--haz);
  }
  .k-esVar {
    background: var(--es-zemin);
    color: var(--es);
    border-color: var(--es);
  }
  .k-esYok {
    background: var(--esyok-zemin);
    color: var(--esyok);
    border-color: var(--esyok);
  }
  .herkes {
    border-collapse: separate;
    border-spacing: 0;
    font-size: var(--f-sm);
    width: 100%;
    user-select: none;
    touch-action: none;
  }
  .herkes.kilitli {
    opacity: 0.7;
  }
  @media (pointer: coarse) {
    .herkes,
    .izgara {
      touch-action: manipulation;
    }
  }
  .herkes th,
  .herkes td {
    border-right: 1px solid var(--cizgi-acik);
    border-bottom: 1px solid var(--cizgi-acik);
    padding: 0;
    text-align: center;
    white-space: nowrap;
  }
  .herkes thead th {
    position: sticky;
    top: 0;
    z-index: 2;
    background: var(--tablo-bas);
    color: var(--lacivert);
    font-size: var(--f-xs);
    font-weight: 700;
    padding: 4px 0;
    min-width: 24px;
  }
  .herkes thead th small {
    display: block;
    font-size: 11px;
    font-weight: 600;
    color: var(--yazi-2);
  }
  .herkes thead th.hs {
    background: color-mix(in srgb, var(--acik-mavi) 28%, var(--yuzey));
  }
  .herkes thead th.rt {
    background: color-mix(in srgb, var(--acik-mavi) 45%, var(--yuzey));
  }
  .herkes thead th.ar {
    background: var(--arife-zemin);
  }
  .herkes .ad {
    position: sticky;
    left: 0;
    z-index: 1;
    background: var(--yuzey);
    text-align: left;
    padding: 0 var(--b3);
    font-weight: 600;
    min-width: 150px;
  }
  .herkes thead .ad {
    z-index: 3;
    background: var(--tablo-bas);
  }
  .herkes .ad .isaret {
    margin-right: 8px;
  }
  .herkes tr.grup .ad,
  .herkes tr.grup td {
    background: var(--panel-bas);
    font-size: 11px;
    color: var(--lacivert);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding-block: 4px;
  }
  .herkes td.hs {
    background: var(--hs-zemin);
  }
  .herkes td.rt {
    background: color-mix(in srgb, var(--acik-mavi) 30%, var(--yuzey));
  }
  .herkes td.arasi {
    background: repeating-linear-gradient(135deg, var(--izin-zemin) 0 4px, var(--yuzey) 4px 8px);
  }
  .herkes td.pasif {
    background: var(--yuzey-2);
  }
  .herkes td button {
    width: 100%;
    min-width: 24px;
    height: 30px;
    border: 0;
    background: transparent;
    cursor: pointer;
    padding: 0;
    display: grid;
    place-items: center;
  }
  /* telefonda dokunma hedefi en az 28 px */
  @media (max-width: 720px) {
    .herkes td button,
    .herkes thead th:not(.ad) {
      min-width: 28px;
    }
  }
  .herkes td button:hover:not(:disabled) {
    outline: 2px solid var(--altin);
    outline-offset: -2px;
  }
  .herkes td button:focus-visible {
    outline: 2px solid var(--odak);
    outline-offset: -2px;
  }
  .herkes td button:disabled {
    cursor: default;
  }
  .herkes .top {
    min-width: 46px;
    font-weight: 700;
    color: var(--lacivert);
    background: var(--yuzey-2);
  }
  .herkes thead .top {
    background: var(--tablo-bas);
  }
  .herkes tr.alt .ad,
  .herkes tr.alt td {
    background: var(--panel-bas);
    font-weight: 700;
    color: var(--lacivert);
    height: 28px;
  }
  .herkes tr.alt td.cok {
    background: var(--haz-zemin);
    color: var(--haz);
  }
  .alt-lejant {
    margin-top: var(--b2);
  }
  .alt-lejant .kod {
    min-width: 18px;
    height: 16px;
    font-size: 10px;
  }
  @media (max-width: 720px) {
    .ara-k {
      margin-left: 0;
      width: 100%;
    }
  }
  .kucuk {
    font-size: var(--f-xs);
  }
</style>
