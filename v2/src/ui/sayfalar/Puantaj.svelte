<script lang="ts">
  // Aylık puantaj cetveli: çizelgeden gelen nöbet/hazırlama, nöbet ertesi izin ve izinler; hücre elle değiştirilebilir.
  import { puantajHesapla } from "../../motor";
  import { depo, veriAnlik, duzKopya, ayCizelgesi, puantajKoduAyarla, puantajElleKodu } from "../../veri/depo.svelte";
  import type { Kisi, PuantajKodu } from "../../veri/tipler";
  import { ROL_AD } from "../../veri/tipler";
  import { GUN_KISA, gunMetni } from "../../veri/tarih";
  import { dosyaKaydet, hataMetni } from "../../disa/indir";
  import { KOD_AD, kodMetni, type Izgara, type PuantajSatiri } from "../../disa/puantajTipleri";
  import Ikon from "../ortak/Ikon.svelte";
  import Pencere from "../ortak/Pencere.svelte";
  import IslemAlani from "../ortak/IslemAlani.svelte";
  import IzinRapor from "../puantaj/IzinRapor.svelte";
  import NobetDegisimi from "../puantaj/NobetDegisimi.svelte";
  import AylikOzet from "../ortak/AylikOzet.svelte";

  // gomulu: Günlük Eczane / Acil Eczane sayfasının alt sekmesi olarak (başlık ve ay seçici üst sayfada).
  // kimler: cetvelde ve izin/rapor kaydında görünen kişiler (o bölümün kadrosu); acil: Acil Eczane puantajı
  // (eczane nöbet değişimi sekmesi yok; acil nöbeti Acil Eczane Nöbet Listesi'nden değiştirilir)
  let { git, gomulu = false, kimler = () => true, acil = false }: {
    git: (ad: "cizelge" | "puantaj" | "izinler" | "kisiler" | "ayarlar") => void; gomulu?: boolean; kimler?: (k: Kisi) => boolean; acil?: boolean;
  } = $props();

  const TUM_GORUNUMLER = [{ ad: "cetvel", baslik: "Cetvel", ikon: "tablo" }, { ad: "izin", baslik: "İzin ve rapor", kisa: "İzin", ikon: "izin" }, { ad: "degisim", baslik: "Nöbet değişimi", kisa: "Değişim", ikon: "karisik" }] as const;
  const GORUNUMLER = $derived(acil ? TUM_GORUNUMLER.filter(g => g.ad !== "degisim") : TUM_GORUNUMLER);
  let gorunum = $state<(typeof TUM_GORUNUMLER)[number]["ad"]>("cetvel");

  const c = $derived(ayCizelgesi(depo.yil, depo.ay));
  const G = $derived.by(() => { const t = puantajHesapla(veriAnlik(), depo.yil, depo.ay) as Izgara; return { ...t, satirlar: t.satirlar.filter(r => kimler(r.s as Kisi)) }; });
  const elleSayisi = $derived(Object.values(depo.veri.puantaj[`${depo.yil}-${depo.ay}`] ?? {}).reduce((t, a) => t + Object.keys(a).length, 0));

  // özet şerit: fazla mesai aralığı (eczacı / tekniker ya da acil servis), toplam nöbet
  const aralik = (f: (r: PuantajSatiri) => boolean) => { const v = G.satirlar.filter(f).map(r => r.fm); return v.length ? (Math.min(...v) === Math.max(...v) ? `${v[0]} sa` : `${Math.min(...v)}–${Math.max(...v)} sa`) : "—"; };
  const fmEcz = $derived(aralik(r => r.s.role === "eczaci" || r.s.role === "nobetci"));
  const fmTek = $derived(aralik(r => (acil ? r.s.role === "servis" : r.s.role === "teknisyen")));
  const toplamNobet = $derived(G.satirlar.reduce((t, r) => t + r.n, 0));
  const grupAd: Record<string, string> = { eczaci: "Eczacılar", nobetci: "Kemoterapi eczacıları", teknisyen: "Teknikerler", destek: "Destek personeli", servis: "Acil servis personeli" };

  // hücre düzenleme
  let acik = $state(false);
  let secili = $state<{ id: number; ad: string; gun: number; otomatik: string; simdiki: string } | null>(null);
  let yeniKod = $state<PuantajKodu | "">("");
  function hucreAc(r: PuantajSatiri, i: number) {
    const gun = i + 1, elle = puantajElleKodu(depo.yil, depo.ay, r.s.id, gun);
    // elle kod kaldırılınca çıkacak kod: kayıt geçici kaldırılıp hesaplanır
    const v = duzKopya(depo.veri);
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
      const ad = `${acil ? "acil-" : ""}puantaj-${depo.yil}-${String(depo.ay + 1).padStart(2, "0")}.${tur}`;
      const blob = tur === "xlsx" ? m.puantajKitabi(G, depo.yil, depo.ay, depo.veri.kurum.ad, acil) : m.puantajPdf(G, depo.yil, depo.ay, depo.veri.kurum.ad, c?.onay ?? null);
      durum = (await dosyaKaydet(ad, blob, blob.type || "application/pdf")) ? (tur === "pdf" ? "PDF" : "Excel dosyası") + " kaydedildi." : "";
    } catch (e) { durum = hataMetni(e, "Dosya oluşturulamadı."); }
  }
</script>


{#if !G.satirlar.length}
  <div class="kart bos"><h2>Bu ayda çalışan personel yok</h2><button class="dugme ana" onclick={() => git("kisiler")}>Personel ekle</button></div>
{:else}
  <IslemAlani>
    <div class="secim" role="tablist" aria-label="Puantaj görünümü">
      {#each GORUNUMLER as g}<button role="tab" aria-selected={gorunum === g.ad} onclick={() => (gorunum = g.ad)}>{g.baslik}</button>{/each}
    </div>
    <button class="dugme" onclick={() => disaAktar("pdf")}><Ikon ad="indir" />PDF</button>
    <button class="dugme" onclick={() => disaAktar("xlsx")}><Ikon ad="indir" />Excel</button>
  </IslemAlani>
  {#if durum}<p class="bant" role="status">{durum}</p>{/if}
  {#if gorunum === "izin"}<IzinRapor {kimler} />
  {:else if gorunum === "degisim"}<NobetDegisimi />
  {:else}
  <div class="ozet-serit">
    <div><small>Aylık normal mesai</small><b>{G.mesaiToplam} sa</b><span>Çalışma günleri × günlük mesai</span></div>
    <div><small>Fazla mesai · eczacı</small><b>{fmEcz}</b><span>Kişiler arası aralık</span></div>
    <div><small>Fazla mesai · {acil ? "acil servis" : "tekniker"}</small><b>{fmTek}</b><span>Kişiler arası aralık</span></div>
    <div><small>Toplam nöbet</small><b>{toplamNobet}</b><span>{elleSayisi ? elleSayisi + " hücre elle değiştirildi" : "Elle değiştirilen hücre yok"}</span></div>
  </div>
  {#if !c}<p class="kutu dikkat uyari-satir">Bu ayın çizelgesi yok: nöbetler boş görünür.</p>{/if}

  <section class="panel cetvel-panel">
    <div class="panel-bas"><h2>Puantaj cetveli</h2>
      <p class="lejant">
        <span><i class="k">8</i>Mesai</span><span><i class="k k-N">24</i>Nöbet</span><span><i class="k k-N acil">24</i>Acil nöbet</span><span><i class="k k-H">8</i>Hazırlama</span>
        <span><i class="k k-NI">Nİ</i>Nöbet izni</span><span><i class="k k-YI">Yİ</i>Yıllık izin</span><span><i class="k k-R">R</i>Rapor</span>
        <span><i class="k k-P">–</i>Dönem dışı</span><span><i class="k hs-ornek"></i>Hafta sonu</span><span><i class="k ov-ornek"></i>Elle</span>
      </p>
    </div>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex (kaydırılan tablo klavyeyle kaydırılabilsin: WCAG 2.1.1) -->

  <div class="tablo-kap" tabindex="0" role="region" aria-label="Puantaj cetveli">
    <table class="cetvel">
      <thead>
        <tr>
          <th class="ad" scope="col">Ad soyad</th>
          {#each G.gunler as g}<th scope="col" class:tatil={g.tatil} class:arife={g.arife} title={gunMetni(depo.yil, depo.ay, g.gun)}><span class="rakam">{g.gun}</span><small>{GUN_KISA[g.dw]}</small></th>{/each}
          <th class="ozet ilk" scope="col">Toplam</th><th class="ozet" scope="col">Aylık</th><th class="ozet fm" scope="col">Fazla mesai</th><th class="ozet" scope="col">08–20</th><th class="ozet" scope="col">20–08</th>
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
                <button onclick={() => hucreAc(r, i)} aria-label="{r.s.name}, {gunMetni(depo.yil, depo.ay, g.gun)}: {h.acil ? 'Acil eczane nöbeti (24 saat)' : (KOD_AD[h.kod] ?? h.kod)}{h.ov ? ' (elle)' : ''}">{kodMetni(h.kod, h.saat, g.arife)}</button>
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
  <div class="imzalar">
    {#each ["Düzenleyen", "Kontrol eden", "Onaylayan"] as unvan}
      <div class="imza"><b>{unvan}</b><span>Adı soyadı: ..............................</span><span>İmza:</span></div>
    {/each}
  </div>
  </section>

  <section class="aylik-kap">
    <AylikOzet satirlar={G.satirlar} hazirlama={!acil} />
    <p class="dipnot">Fazla mesai = toplam çalışma (yıllık izin ve rapor günleri o günün mesaisi kadar sayılır) − aylık normal mesai. Ayın son günü tutulan nöbetin ertesi gün izni bu aydan düşülür. Nöbet ertesi izin (Nİ) önce o günün 08:00-20:00 diliminden düşülür; bu dilim yetmezse kalanı 20:00-08:00 diliminden düşülür. Kemoterapi eczacısında nöbet günü ve ertesi günün mesaisi düşülür; destek personelinde hazırlama saatleri aynen yazılır.</p>
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
  .bos { padding: var(--b5); display: grid; gap: var(--b3); justify-items: start; }
  .bant { padding: var(--b2) var(--b4); border: 1px solid var(--cizgi); border-radius: var(--r); margin-bottom: var(--b3); font-size: var(--f-sm); font-weight: 600; background: var(--vurgu-zemin); color: var(--vurgu); }
  .uyari-satir { margin-top: var(--b3); font-weight: 600; }
  .cetvel-panel { margin-top: var(--b4); }
  .lejant { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: var(--f-xs); color: var(--yazi-2); }
  .lejant span { display: inline-flex; align-items: center; gap: 5px; }
  .k { display: inline-grid; place-items: center; min-width: 24px; height: 18px; padding: 0 3px; border-radius: 2px; font-style: normal; font-weight: 700; font-size: 11px; border: 1px solid var(--cizgi); background: var(--yuzey); color: var(--yazi-2); }
  .hs-ornek { background: var(--hs-zemin); }
  .ov-ornek { position: relative; }
  .ov-ornek::after { content: ""; position: absolute; top: 0; right: 0; border-top: 7px solid var(--altin); border-left: 7px solid transparent; }
  .tablo-kap { overflow-x: auto; }
  table { border-collapse: separate; border-spacing: 0; font-size: var(--f-sm); }
  .cetvel th, .cetvel td { border-right: 1px solid var(--cizgi-acik); border-bottom: 1px solid var(--cizgi-acik); padding: 0; text-align: center; white-space: nowrap; }
  .cetvel thead th { position: sticky; top: 0; z-index: 2; background: var(--tablo-bas); color: var(--lacivert); font-weight: 700; font-size: var(--f-xs); padding: 4px 0; min-width: 28px; }
  .cetvel thead th small { display: block; font-size: 11px; font-weight: 600; color: var(--yazi-2); }
  .cetvel thead th.tatil { background: color-mix(in srgb, var(--acik-mavi) 28%, var(--yuzey)); }
  .cetvel thead th.arife { background: var(--arife-zemin); }
  .cetvel .ad { position: sticky; left: 0; z-index: 1; background: var(--yuzey); text-align: left; padding: 0 var(--b3); font-weight: 600; min-width: 160px; }
  .cetvel tbody tr:nth-child(even) .ad { background: var(--yuzey-2); }
  .cetvel thead .ad { z-index: 3; background: var(--tablo-bas); }
  .cetvel .ad .isaret { margin-right: 8px; }
  .cetvel tr.grup .ad, .cetvel tr.grup td { background: var(--panel-bas); font-size: 11px; color: var(--lacivert); font-weight: 700; text-transform: uppercase; letter-spacing: .06em; padding-block: 4px; }
  .cetvel td.tatil { background: var(--hs-zemin); }
  .cetvel td { position: relative; }
  .cetvel td button { width: 100%; min-width: 28px; height: 30px; border: 0; background: transparent; cursor: pointer; font-variant-numeric: tabular-nums; color: inherit; font-weight: inherit; }
  .cetvel td button:hover { outline: 2px solid var(--altin); outline-offset: -2px; }
  .cetvel td.ov::after { content: ""; position: absolute; top: 0; right: 0; border-top: 7px solid var(--altin); border-left: 7px solid transparent; pointer-events: none; }
  .k-N { background: var(--nobet-hucre) !important; color: #FFFFFF; font-weight: 700; }
  .k-N.acil { background: var(--acil) !important; color: #FFFFFF; }
  .k-H { background: var(--haz-zemin) !important; color: var(--haz); font-weight: 700; }
  .k-NI { background: var(--izin-zemin) !important; color: var(--izin); font-weight: 700; }
  .k-YI { background: var(--tek-zemin) !important; color: var(--tek); font-weight: 700; }
  .k-R, .k-DI { background: var(--hata-zemin) !important; color: var(--hata); font-weight: 700; }
  .k-P { color: var(--soluk); }
  .ozet { padding: 0 var(--b2) !important; min-width: 52px; text-align: right !important; font-weight: 600; }
  .ozet.ilk { border-left: 2px solid var(--cizgi); }
  thead .ozet { background: var(--tablo-bas); }
  .ozet.fm { font-weight: 700; color: var(--lacivert); background: var(--vurgu-zemin); }
  thead .ozet.fm { background: color-mix(in srgb, var(--acik-mavi) 35%, var(--yuzey)); }
  .soluk { color: var(--yazi-2); }
  .imzalar { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-top: 1px solid var(--cizgi); }
  .imza { display: grid; gap: 10px; padding: var(--b4) var(--b4) var(--b5); border-left: 1px solid var(--cizgi-acik); font-size: var(--f-sm); color: var(--yazi-2); }
  .imza:first-child { border-left: 0; }
  .imza b { font-size: 12px; letter-spacing: .06em; text-transform: uppercase; color: var(--lacivert); }
  .aylik-kap { margin-top: var(--b5); display: grid; gap: var(--b2); }
  .dipnot { font-size: var(--f-xs); color: var(--yazi-2); max-width: 100ch; }
  @media (max-width: 720px) { .imzalar { grid-template-columns: 1fr; } .imza { border-left: 0; border-top: 1px solid var(--cizgi-acik); } }
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
