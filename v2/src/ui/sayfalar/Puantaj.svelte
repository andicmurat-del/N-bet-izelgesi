<script lang="ts">
  // Aylık puantaj cetveli: çizelgeden gelen nöbet/hazırlama, nöbet ertesi izin ve izinler; hücre elle değiştirilebilir.
  import { puantajHesapla } from "../../motor/cizelge.js";
  import { depo, ayCizelgesi, puantajKoduAyarla, puantajElleKodu } from "../../veri/depo.svelte";
  import type { PuantajKodu } from "../../veri/tipler";
  import { ROL_AD } from "../../veri/tipler";
  import { GUN_KISA, gunMetni } from "../../veri/tarih";
  import { dosyaKaydet } from "../../disa/indir";
  import { KOD_AD, kodMetni, type Izgara, type PuantajSatiri } from "../../disa/puantajTipleri";
  import AySecici from "../ortak/AySecici.svelte";
  import Ikon from "../ortak/Ikon.svelte";
  import Pencere from "../ortak/Pencere.svelte";
  import Sekmeler from "../ortak/Sekmeler.svelte";
  import IzinRapor from "../puantaj/IzinRapor.svelte";
  import NobetDegisimi from "../puantaj/NobetDegisimi.svelte";

  let { git }: { git: (ad: "cizelge" | "puantaj" | "izinler" | "kisiler" | "ayarlar") => void } = $props();

  const GORUNUMLER = [{ ad: "cetvel", baslik: "Cetvel", ikon: "tablo" }, { ad: "izin", baslik: "İzin ve rapor", kisa: "İzin", ikon: "izin" }, { ad: "degisim", baslik: "Nöbet değişimi", kisa: "Değişim", ikon: "karisik" }] as const;
  let gorunum = $state<(typeof GORUNUMLER)[number]["ad"]>("cetvel");

  const c = $derived(ayCizelgesi(depo.yil, depo.ay));
  const G = $derived(puantajHesapla($state.snapshot(depo.veri), depo.yil, depo.ay) as Izgara);
  const elleSayisi = $derived(Object.values(depo.veri.puantaj[`${depo.yil}-${depo.ay}`] ?? {}).reduce((t, a) => t + Object.keys(a).length, 0));

  const grupAd: Record<string, string> = { eczaci: "Eczacılar", nobetci: "Dışarıdan nöbetçi eczacılar", teknisyen: "Teknikerler", destek: "Destek personeli", servis: "Acil servis eczacıları" };

  // hücre düzenleme
  let acik = $state(false);
  let secili = $state<{ id: number; ad: string; gun: number; otomatik: string; simdiki: string } | null>(null);
  let yeniKod = $state<PuantajKodu | "">("");
  function hucreAc(r: PuantajSatiri, i: number) {
    const gun = i + 1, elle = puantajElleKodu(depo.yil, depo.ay, r.s.id, gun);
    // elle kod kaldırılınca çıkacak kod: kayıt geçici kaldırılıp hesaplanır
    const v = $state.snapshot(depo.veri);
    if (elle) delete v.puantaj[`${depo.yil}-${depo.ay}`][r.s.id][gun];
    const oto = (puantajHesapla(v, depo.yil, depo.ay) as Izgara).satirlar.find(x => x.s.id === r.s.id)?.cells[i].kod ?? "";
    secili = { id: r.s.id, ad: r.s.name, gun, otomatik: oto, simdiki: r.cells[i].kod };
    yeniKod = elle ?? "";
    acik = true;
  }
  function kaydet() {
    if (!secili) return;
    puantajKoduAyarla(depo.yil, depo.ay, secili.id, secili.gun, yeniKod === "" || yeniKod === secili.otomatik ? null : yeniKod);
    acik = false;
  }
  const SECENEKLER: PuantajKodu[] = ["M", "N", "H", "NI", "YI", "R", "DI", "B"];

  let durum = $state("");
  async function disaAktar(tur: "xlsx" | "pdf") {
    durum = "";
    try {
      const m = await import("../../disa/puantajCikti");
      const ad = `puantaj-${depo.yil}-${String(depo.ay + 1).padStart(2, "0")}.${tur}`;
      const blob = tur === "xlsx" ? m.puantajKitabi(G, depo.yil, depo.ay, depo.veri.kurum.ad) : m.puantajPdf(G, depo.yil, depo.ay, depo.veri.kurum.ad, c?.onay ?? null);
      durum = (await dosyaKaydet(ad, blob, blob.type || "application/pdf")) ? (tur === "pdf" ? "PDF" : "Excel dosyası") + " kaydedildi." : "";
    } catch { durum = "Dosya oluşturulamadı."; }
  }
</script>

<header class="sayfa-bas">
  <div>
    <h1>Puantaj</h1>
    <p>Gerçekleşen çalışma: çizelgedeki nöbet ve hazırlamalar, nöbet ertesi izinler, yıllık izin ve raporlar. Ay içinde gelişen izin ve raporları, nöbet değişimlerini ilgili sekmeden girin; tek bir günü değiştirmek için cetveldeki hücreye dokunun.</p>
  </div>
  <AySecici />
</header>

{#if !G.satirlar.length}
  <div class="kart bos"><h2>Bu ayda çalışan personel yok</h2><button class="dugme ana" onclick={() => git("kisiler")}>Personel ekle</button></div>
{:else}
  <Sekmeler secenekler={GORUNUMLER} bind:secili={gorunum} etiket="Puantaj görünümü" />
  {#if gorunum === "izin"}<IzinRapor />
  {:else if gorunum === "degisim"}<NobetDegisimi />
  {:else}
  <div class="arac-cubugu">
    <div class="durumlar">
      {#if !c}<span class="rozet dikkat">Bu ayın çizelgesi yok: nöbetler boş görünür</span>{/if}
      {#if elleSayisi}<span class="rozet notr rakam">{elleSayisi} hücre elle değiştirildi</span>{/if}
      <span class="rozet notr rakam">Aylık normal mesai {G.mesaiToplam} sa</span>
    </div>
    <div class="dugmeler">
      <button class="dugme" onclick={() => disaAktar("pdf")}><Ikon ad="indir" />PDF</button>
      <button class="dugme" onclick={() => disaAktar("xlsx")}><Ikon ad="indir" />Excel</button>
    </div>
  </div>
  {#if durum}<p class="bant" role="status">{durum}</p>{/if}

  <p class="lejant">
    <span><i class="k">8</i>Normal mesai</span><span><i class="k k-N">24</i>Nöbet</span><span><i class="k k-N acil">24</i>Acil servis nöbeti</span><span><i class="k k-H">8</i>Hazırlama</span>
    <span><i class="k k-NI">Nİ</i>Nöbet izni</span><span><i class="k k-YI">Yİ</i>Yıllık izin</span><span><i class="k k-R">R</i>Rapor</span>
    <span><i class="k k-P">–</i>Çalışma dönemi dışında</span><span><i class="k ov-ornek"></i>Elle değiştirildi</span>
  </p>

  <!-- svelte-ignore a11y_no_noninteractive_tabindex (kaydırılan tablo klavyeyle kaydırılabilsin: WCAG 2.1.1) -->

  <div class="kart tablo-kap" tabindex="0" role="region" aria-label="Puantaj cetveli">
    <table class="cetvel">
      <thead>
        <tr>
          <th class="ad" scope="col">Ad soyad</th>
          {#each G.gunler as g}<th scope="col" class:tatil={g.tatil} class:arife={g.arife} title={gunMetni(depo.yil, depo.ay, g.gun)}><span class="rakam">{g.gun}</span><small>{GUN_KISA[g.dw]}</small></th>{/each}
          <th class="ozet ilk" scope="col">Toplam</th><th class="ozet" scope="col">Aylık</th><th class="ozet fm" scope="col">Fazla mesai</th><th class="ozet" scope="col">08-20</th><th class="ozet" scope="col">20-08</th>
        </tr>
      </thead>
      <tbody>
        {#each G.satirlar as r, si (r.s.id)}
          {#if si === 0 || G.satirlar[si - 1].s.role !== r.s.role}
            <tr class="grup"><th class="ad" scope="rowgroup">{grupAd[r.s.role]}</th><td colspan={G.gunler.length + 5}></td></tr>
          {/if}
          <tr>
            <th class="ad" scope="row"><span class="isaret {r.s.role}"></span>{r.s.name}</th>
            {#each r.cells as h, i}
              {@const g = G.gunler[i]}
              <td class="k-{h.kod}" class:tatil={g.tatil} class:ov={h.ov} class:acil={h.acil}>
                <button onclick={() => hucreAc(r, i)} aria-label="{r.s.name}, {gunMetni(depo.yil, depo.ay, g.gun)}: {h.acil ? 'Acil servis nöbeti (24 saat)' : (KOD_AD[h.kod] ?? h.kod)}{h.ov ? ' (elle)' : ''}">{kodMetni(h.kod, h.saat, g.arife)}</button>
              </td>
            {/each}
            <td class="ozet ilk rakam">{r.toplam}</td>
            <td class="ozet rakam">{r.aylik ?? "–"}</td>
            <td class="ozet fm rakam">{r.fm}</td>
            <td class="ozet rakam soluk">{r.fmGunduz}</td>
            <td class="ozet rakam soluk">{r.fmGece}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <section class="aylik">
    <h2>Aylık özet</h2>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (kaydırılan tablo klavyeyle kaydırılabilsin: WCAG 2.1.1) -->
    <div class="kart tablo-kap" tabindex="0" role="region" aria-label="Aylık özet">
      <table class="ozet-tablo">
        <thead><tr><th scope="col">Ad soyad</th><th scope="col">Görev</th><th scope="col">Nöbet</th><th scope="col">Perşembe</th><th scope="col">Cuma</th><th scope="col">Cumartesi</th><th scope="col">Pazar</th><th scope="col">Hazırlama</th><th scope="col">Resmi tatil</th><th scope="col">Yıllık izin</th><th scope="col">Rapor</th><th scope="col">Fazla mesai</th></tr></thead>
        <tbody>
          {#each G.satirlar as r (r.s.id)}
            <tr><th scope="row">{r.s.name}</th><td class="sol">{ROL_AD[r.s.role]}</td><td>{r.n}</td><td>{r.thu}</td><td>{r.cu}</td><td>{r.cmt}</td><td>{r.paz}</td><td>{r.h}</td><td>{r.rt}</td><td>{r.yi}</td><td>{r.rd}</td><td class="fm">{r.fm} sa</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="dipnot">Fazla mesai = toplam çalışma (yıllık izin ve rapor günleri o günün mesaisi kadar sayılır) − aylık normal mesai. Ayın son günü tutulan nöbetin ertesi gün izni bu aydan düşülür. Dışarıdan nöbetçi eczacıda nöbet günü ve ertesi günün mesaisi düşülür; destek personelinde hazırlama saatleri aynen yazılır.</p>
  </section>
  {/if}
{/if}

{#if secili}
  <Pencere bind:acik baslik={secili.ad} altBaslik="{gunMetni(depo.yil, depo.ay, secili.gun)} · şu an: {KOD_AD[secili.simdiki] ?? secili.simdiki}">
    <fieldset class="secenekler">
      <legend>Bu günün kodu</legend>
      <label class="secenek"><input type="radio" name="kod" value="" bind:group={yeniKod} /><span><b>Otomatik</b><small>Çizelgeye göre: {KOD_AD[secili.otomatik] ?? "boş"}</small></span></label>
      {#each SECENEKLER as k}
        <label class="secenek"><input type="radio" name="kod" value={k} bind:group={yeniKod} /><span><b>{KOD_AD[k]}</b></span></label>
      {/each}
    </fieldset>
    <p class="not">Puantaj gerçekleşeni gösterir; çizelge değişmez. Yıllık izin, rapor ve diğer izin girilen günlere, çizelge yeniden oluşturulursa görev yazılmaz.</p>
    {#snippet altlik()}
      <button class="dugme" onclick={() => (acik = false)}>Vazgeç</button>
      <button class="dugme ana" onclick={kaydet}>Kaydet</button>
    {/snippet}
  </Pencere>
{/if}

<style>
  .sayfa-bas { display: flex; flex-wrap: wrap; gap: var(--b4); align-items: flex-end; justify-content: space-between; margin-bottom: var(--b4); }
  .sayfa-bas > div { max-width: 70ch; }
  .sayfa-bas p { color: var(--yazi-2); margin-top: var(--b2); }
  .bos { padding: var(--b5); display: grid; gap: var(--b3); justify-items: start; }
  .arac-cubugu { display: flex; flex-wrap: wrap; gap: var(--b3); align-items: center; justify-content: space-between; margin-bottom: var(--b3); }
  .durumlar, .dugmeler { display: flex; flex-wrap: wrap; gap: var(--b2); align-items: center; }
  .bant { padding: var(--b2) var(--b4); border-radius: var(--r); margin-bottom: var(--b3); font-size: var(--f-sm); font-weight: 500; background: var(--vurgu-zemin); color: var(--vurgu); }
  .lejant { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: var(--f-xs); color: var(--soluk); margin-bottom: var(--b3); }
  .lejant span { display: inline-flex; align-items: center; gap: 6px; }
  .k { display: inline-grid; place-items: center; min-width: 26px; height: 20px; padding: 0 4px; border-radius: 4px; font-style: normal; font-weight: 600; border: 1px solid var(--cizgi); background: var(--yuzey); color: var(--yazi-2); }
  .ov-ornek { position: relative; }
  .ov-ornek::after { content: ""; position: absolute; top: 0; right: 0; border-top: 7px solid var(--odak); border-left: 7px solid transparent; }
  .tablo-kap { overflow-x: auto; }
  table { border-collapse: separate; border-spacing: 0; font-size: var(--f-sm); }
  .cetvel th, .cetvel td { border-right: 1px solid var(--cizgi-acik); border-bottom: 1px solid var(--cizgi-acik); padding: 0; text-align: center; white-space: nowrap; }
  .cetvel thead th { position: sticky; top: 0; z-index: 2; background: var(--yuzey-2); font-weight: 600; font-size: var(--f-xs); padding: 4px 0; min-width: 32px; }
  .cetvel thead th small { display: block; font-size: var(--f-xs); font-weight: 500; color: var(--soluk); }
  .cetvel thead th.tatil { background: var(--tatil-zemin); color: var(--tatil); }
  .cetvel thead th.arife { background: var(--arife-zemin); }
  .cetvel .ad { position: sticky; left: 0; z-index: 1; background: var(--yuzey); text-align: left; padding: 0 var(--b3); font-weight: 500; min-width: 170px; }
  .cetvel thead .ad { z-index: 3; background: var(--yuzey-2); }
  .cetvel .ad .isaret { margin-right: 8px; }
  .cetvel tr.grup .ad, .cetvel tr.grup td { background: var(--yuzey-2); font-size: var(--f-xs); color: var(--soluk); font-weight: 600; text-transform: uppercase; letter-spacing: .05em; padding-block: 4px; }
  .cetvel td.tatil { background: var(--tatil-zemin); }
  .cetvel td { position: relative; }
  .cetvel td button { width: 100%; min-width: 32px; height: 30px; border: 0; background: transparent; cursor: pointer; font-variant-numeric: tabular-nums; color: inherit; font-weight: inherit; }
  .cetvel td button:hover { outline: 2px solid var(--odak); outline-offset: -2px; }
  .cetvel td.ov::after { content: ""; position: absolute; top: 0; right: 0; border-top: 7px solid var(--odak); border-left: 7px solid transparent; pointer-events: none; }
  .k-N { background: var(--izin-zemin) !important; color: var(--izin); font-weight: 700; }
  .k-N.acil { background: var(--acil-zemin) !important; color: var(--acil); }
  .k-H { background: var(--haz-zemin) !important; color: var(--haz); font-weight: 600; }
  .k-NI { background: var(--es-zemin) !important; color: var(--es); font-weight: 600; }
  .k-YI { background: var(--ister-zemin) !important; color: var(--ister); font-weight: 600; }
  .k-R, .k-DI { background: var(--istemez-zemin) !important; color: var(--istemez); font-weight: 700; }
  .k-P { color: var(--soluk); }
  .ozet { padding: 0 var(--b3) !important; min-width: 64px; text-align: right !important; font-weight: 500; }
  .ozet.ilk { border-left: 2px solid var(--cizgi); }
  .ozet.fm { font-weight: 700; color: var(--vurgu); }
  .soluk { color: var(--soluk); }
  .aylik { margin-top: var(--b5); display: grid; gap: var(--b2); }
  .aylik h2 { font-size: var(--f-lg); }
  .ozet-tablo { width: 100%; }
  .ozet-tablo th, .ozet-tablo td { padding: 8px 12px; border-bottom: 1px solid var(--cizgi-acik); text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .ozet-tablo thead th { background: var(--yuzey-2); font-size: var(--f-xs); color: var(--yazi-2); }
  .ozet-tablo tbody th, .ozet-tablo .sol, .ozet-tablo thead th:first-child, .ozet-tablo thead th:nth-child(2) { text-align: left; }
  .ozet-tablo tbody th { font-weight: 500; }
  .ozet-tablo .fm { font-weight: 700; color: var(--vurgu); }
  .dipnot { font-size: var(--f-xs); color: var(--soluk); max-width: 100ch; }
  .secenekler { border: 0; padding: 0; margin: 0; display: grid; gap: 4px; }
  legend { font-weight: 600; font-size: var(--f-sm); margin-bottom: var(--b2); }
  .secenek { display: flex; gap: var(--b3); align-items: center; padding: 8px 10px; border: 1px solid var(--cizgi); border-radius: var(--r-kucuk); cursor: pointer; }
  .secenek:has(input:checked) { border-color: var(--vurgu); background: var(--vurgu-zemin); }
  .secenek input { width: 18px; height: 18px; accent-color: var(--vurgu); flex: none; }
  .secenek span { display: grid; }
  .secenek b { font-weight: 500; }
  .secenek small { font-size: var(--f-xs); color: var(--soluk); }
  .not { font-size: var(--f-sm); color: var(--soluk); }
</style>
