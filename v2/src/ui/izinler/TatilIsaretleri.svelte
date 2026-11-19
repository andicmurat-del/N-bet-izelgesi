<script lang="ts">
  // İzinler > Resmi tatil ve arife: yılın resmi tatilleri listesi, kendiliğinden işaretleme ayarı ve ay takvimi.
  import { depo, resmiTatilMi, arifeMi, resmiTatilAyarla, arifeAyarla, resmiTatilleriIsaretle } from "../../veri/depo.svelte";
  import { AYLAR, GUN_KISA, gunMetni, gunSayisi, haftaGunu, haftaSonuMu } from "../../veri/tarih";
  import { TATIL_TABLO_YILLARI, diniBayramlarVar, tatilAdi, yilinTatilleri } from "../../veri/resmiTatiller";

  let { onayli }: { onayli: boolean } = $props();
  type TatilArac = "resmi" | "arife" | "temizle";
  let tatilArac = $state<TatilArac>("resmi");
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
  function uygula(d: number) {
    if (onayli) return;
    const y = depo.yil,
      m = depo.ay;
    {
      if (tatilArac === "resmi") resmiTatilAyarla(y, m, d, !(resmiTatilMi(y, m, d) && !suruk));
      else if (tatilArac === "arife") arifeAyarla(y, m, d, !(arifeMi(y, m, d) && !suruk));
      else {
        resmiTatilAyarla(y, m, d, false);
        arifeAyarla(y, m, d, false);
      }
    }
  }
  function basla(d: number, e: PointerEvent) {
    dokunma = e.pointerType === "touch";
    if (dokunma || e.button !== 0) return;
    uygula(d);
    suruk = true;
  }
  function tikla(d: number) {
    if (dokunma) {
      dokunma = false;
      uygula(d);
    }
  }
  function gez(d: number) {
    if (suruk) uygula(d);
  }
  // yılın resmi tatillerini elle işaretleme (çizelgesi olan geçmiş aylar dahil; onaylı aylar hariç)
  let tatilDurum = $state("");
  function yiliIsaretle() {
    const r = resmiTatilleriIsaretle(depo.yil);
    tatilDurum =
      (r.isaretlenen ? `${r.isaretlenen} gün işaretlendi.` : "Bütün tatiller zaten işaretli.") +
      (r.atlananAylar.length ? ` Onaylı aylara dokunulmadı: ${r.atlananAylar.map(m => AYLAR[m]).join(", ")}.` : "");
  }
  $effect(() => {
    depo.yil;
    tatilDurum = "";
  });
</script>

<svelte:window onpointerup={birak} onpointercancel={birak} />

<div class="duzen">
  <aside class="panel yan">
    <div class="panel-bas"><h2>Tatil günleri</h2></div>
    <p class="panel-ic yan-not">
      Hafta sonları zaten tatildir. Burada resmi tatil ve bayram günlerini, yarım gün çalışılan arifeleri işaretleyin; nöbet fazla mesaisi
      ve hazırlama görevleri buna göre hesaplanır.
    </p>
    <div class="panel-ic tatil-liste">
      <h3>{depo.yil} resmi tatilleri</h3>
      {#if !diniBayramlarVar(depo.yil)}<p class="yan-not">
          Dini bayram tarihleri {TATIL_TABLO_YILLARI[0]}–{TATIL_TABLO_YILLARI[1]} için kayıtlı; bu yıl yalnız sabit tatiller listelenir.
        </p>{/if}
      <ul>
        {#each yilinTatilleri(depo.yil) as t}
          {@const isaretli = t.arife ? arifeMi(t.y, t.m, t.d) : resmiTatilMi(t.y, t.m, t.d)}
          {@const gecersiz = t.arife && haftaSonuMu(t.y, t.m, t.d)}
          <li class:ay={t.m === depo.ay}>
            <span class="tarih rakam">{t.d} {AYLAR[t.m].slice(0, 3)}</span><span class="ad">{t.ad}</span><span
              class="durum"
              class:var={isaretli}
              title={gecersiz ? "Arife hafta sonuna denk geliyor (mesai yok)" : isaretli ? "İşaretli" : "İşaretli değil"}
              >{gecersiz ? "–" : isaretli ? "✓" : "○"}</span
            >
          </li>
        {/each}
      </ul>
      <label class="secim-satir"
        ><input type="checkbox" bind:checked={depo.veri.settings.tatilOtomatik} /><span
          >Her yıl kendiliğinden işaretle <small
            >Yıl ilk açılınca; onaylı aylara ve çizelgesi olan geçmiş aylara dokunmaz. Sonradan kaldırdığınız gün yeniden işaretlenmez.</small
          ></span
        ></label
      >
      <button class="dugme" onclick={yiliIsaretle}>{depo.yil} tatillerini şimdi işaretle</button>
      {#if tatilDurum}<p class="yan-not" role="status">{tatilDurum}</p>{/if}
      <p class="yan-not kucuk">
        Dini bayramlar Hicri takvimle (Ümmü'l-Kurâ) hesaplandı; 2019–2026 arasında Diyanet'in ilan ettiği tarihlerle aynıdır. İleriki bir
        yılda ilan bir gün farklı olursa günü takvimden elle düzeltin.
      </p>
    </div>
  </aside>
  <div class="sag-sutun">
    <section class="panel">
      <div class="panel-bas"><h2>İşaret türü</h2></div>
      <div class="panel-ic araclar" role="radiogroup" aria-label="İşaret">
        <label class="arac t-resmi" class:secili={tatilArac === "resmi"}
          ><input type="radio" name="tatil-arac" checked={tatilArac === "resmi"} onchange={() => (tatilArac = "resmi")} />Resmi tatil</label
        >
        <label class="arac t-arife" class:secili={tatilArac === "arife"}
          ><input type="radio" name="tatil-arac" checked={tatilArac === "arife"} onchange={() => (tatilArac = "arife")} />Arife (yarım gün)</label
        >
        <label class="arac t-temizle" class:secili={tatilArac === "temizle"}
          ><input type="radio" name="tatil-arac" checked={tatilArac === "temizle"} onchange={() => (tatilArac = "temizle")} />İşareti kaldır</label
        >
      </div>
    </section>
    <section class="panel" aria-label="Ay takvimi">
      <div class="panel-bas">
        <h2>Ay takvimi</h2>
        <p class="lejant"><span><i class="ornek o-resmi"></i>Resmi tatil</span><span><i class="ornek o-arife"></i>Arife</span></p>
      </div>
      <div class="izgara" class:kilitli={onayli}>
        {#each GUN_KISA as g, i}<div class="bas" class:hs={i >= 5} aria-hidden="true">{g}</div>{/each}
        {#each { length: gunler.bos } as _}<div class="bosluk" aria-hidden="true"></div>{/each}
        {#each gunler.liste as d}
          {@const y = depo.yil}{@const m = depo.ay}
          {@const rt = resmiTatilMi(y, m, d)}{@const ar = arifeMi(y, m, d)}{@const hs = haftaSonuMu(y, m, d)}
          <button
            class="gun"
            class:hs
            class:rt
            class:ar
            disabled={onayli}
            aria-label="{gunMetni(y, m, d)}{rt ? ', resmi tatil' : ''}{ar ? ', arife' : ''}"
            onpointerdown={e => basla(d, e)}
            onclick={() => tikla(d)}
            onpointerenter={() => gez(d)}
            onkeydown={e => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                uygula(d);
              }
            }}
          >
            <span class="serit"
              ><b class="rakam">{d}</b><span class="gunadi">{GUN_KISA[haftaGunu(y, m, d)]}</span>{#if rt}<span
                  class="etiket"
                  title={tatilAdi(y, m, d) ?? ""}>{tatilAdi(y, m, d) ?? "Resmi tatil"}</span
                >{:else if ar}<span class="etiket" title={tatilAdi(y, m, d) ?? ""}>Arife</span>{/if}</span
            >
            <span class="icerik"></span>
          </button>
        {/each}
      </div>
    </section>
  </div>
</div>

<style>
  .duzen {
    display: grid;
    grid-template-columns: 300px minmax(0, 1fr);
    gap: var(--b4);
    align-items: start;
  }
  .yan-not {
    font-size: var(--f-sm);
    color: var(--yazi-2);
  }
  .sag-sutun {
    display: grid;
    gap: var(--b3);
    min-width: 0;
  }
  .araclar {
    display: flex;
    flex-wrap: wrap;
    gap: var(--b2) var(--b4);
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
  .arac input {
    width: 16px;
    height: 16px;
    accent-color: var(--lacivert);
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
  .o-resmi {
    background: var(--hs-zemin);
    border-color: var(--lacivert);
  }
  .o-arife {
    background: var(--arife-zemin);
    border-color: var(--arife);
  }
  .izgara {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    user-select: none;
    touch-action: none;
  }
  .izgara.kilitli {
    opacity: 0.7;
  }
  .bas,
  .bosluk,
  .gun {
    border-right: 1px solid var(--cizgi);
    border-bottom: 1px solid var(--cizgi);
  }
  .izgara > :nth-child(7n) {
    border-right: 0;
  }
  .bas {
    background: var(--tablo-bas);
    color: var(--lacivert);
    font-size: var(--f-xs);
    font-weight: 700;
    text-align: center;
    padding: 6px 0;
  }
  .bosluk {
    background: var(--yuzey-2);
  }
  .gun {
    position: relative;
    min-height: 84px;
    display: flex;
    flex-direction: column;
    padding: 0;
    border-top: 0;
    border-left: 0;
    border-radius: 0;
    background: var(--yuzey);
    cursor: pointer;
    text-align: left;
    color: var(--yazi);
  }
  .gun:hover:not(:disabled) {
    box-shadow: inset 0 0 0 2px var(--altin);
  }
  .gun:focus-visible {
    outline: 2px solid var(--odak);
    outline-offset: -2px;
  }
  .serit {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 24px;
    padding: 2px 8px;
    background: var(--panel-bas);
    border-bottom: 1px solid var(--cizgi-acik);
    font-size: var(--f-xs);
    color: var(--yazi-2);
    width: 100%;
  }
  .serit b {
    font-size: var(--f-sm);
    color: var(--lacivert);
  }
  .gun.hs .serit {
    background: color-mix(in srgb, var(--acik-mavi) 28%, var(--yuzey));
  }
  .gun.rt {
    background: var(--hs-zemin);
  }
  .gun.rt .serit {
    background: color-mix(in srgb, var(--acik-mavi) 45%, var(--yuzey));
  }
  .gun.ar {
    background: var(--arife-zemin);
  }
  .etiket {
    font-weight: 700;
    color: var(--lacivert);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .icerik {
    flex: 1;
    display: flex;
    align-items: flex-end;
    padding: 6px 8px;
  }
  /* işaretler: izinli koyu gri, izin arası çizgili, istiyor açık mavi, istemiyor açık turuncu */
  @media (pointer: coarse) {
    .izgara {
      touch-action: manipulation;
    }
  }
  /* telefonda dokunma hedefi en az 28 px */
  @media (max-width: 960px) {
    .duzen {
      grid-template-columns: 1fr;
    }
  }
  @media (max-width: 720px) {
    .gun {
      min-height: 58px;
    }
    .serit {
      padding: 1px 4px;
      min-height: 18px;
    }
    .gunadi,
    .etiket {
      display: none;
    }
    .icerik {
      padding: 3px 4px;
    }
  }
  .tatil-liste {
    display: grid;
    gap: var(--b2);
    border-top: 1px solid var(--cizgi);
  }
  .tatil-liste h3 {
    font-size: var(--f-sm);
    margin: var(--b2) 0 0;
    color: var(--lacivert);
  }
  .tatil-liste ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 2px;
    font-size: var(--f-xs);
  }
  .tatil-liste li {
    display: grid;
    grid-template-columns: 52px 1fr 18px;
    gap: var(--b2);
    padding: 3px 4px;
    border-radius: 4px;
  }
  .tatil-liste li.ay {
    background: var(--vurgu-zemin);
  }
  .tatil-liste .tarih {
    color: var(--yazi-2);
  }
  .tatil-liste .durum {
    text-align: center;
    color: var(--soluk);
  }
  .tatil-liste .durum.var {
    color: var(--vurgu);
    font-weight: 700;
  }
  .secim-satir {
    display: flex;
    gap: var(--b2);
    align-items: flex-start;
    font-size: var(--f-sm);
  }
  .secim-satir input {
    margin-top: 3px;
    width: 16px;
    height: 16px;
    accent-color: var(--vurgu);
    flex: none;
  }
  .secim-satir small {
    display: block;
    color: var(--soluk);
    font-size: var(--f-xs);
  }
  .kucuk {
    font-size: var(--f-xs);
  }
</style>
