<script lang="ts">
  // Onay listesi masaları: haftalık tablo (satırlarda Pazartesi–Cuma, sütunlarda Masa 1–7 ve jokerler). Yerler her gün
  // program tarafından dağıtılır (kimse önceki gün oturduğu yere oturmaz; yıl boyunca herkes her masaya eşit oturur).
  // Kurallar motor/onayMasa.ts'de.
  import { depo, veriAnlik, onayGunuAyarla, haftaOnayi, haftayiOnayla, haftaOnayiniKaldir } from "../../veri/depo.svelte";
  import { onayHaftasiHesapla, ONAY_YERLERI, type OnayHaftasi, type OnayGunu } from "../../motor";
  import { AYLAR, GUN_UZUN } from "../../veri/tarih";
  import { ciktiPaketi } from "../../disa/yukle";
  import { dosyaKaydet, hataMetni } from "../../disa/indir";
  import IslemAlani from "../ortak/IslemAlani.svelte";
  import Bilgi from "../ortak/Bilgi.svelte";
  import Ikon from "../ortak/Ikon.svelte";
  import Pencere from "../ortak/Pencere.svelte";
  import OnaySorusu from "../ortak/OnaySorusu.svelte";

  type Gun = [number, number, number];
  const kaydir = (y: number, m: number, d: number, k: number): Gun => { const t = new Date(y, m, d + k); return [t.getFullYear(), t.getMonth(), t.getDate()]; };
  const y = $derived(depo.yil), m = $derived(depo.ay);
  // ayın haftaları (Pazartesi–Cuma; ay başı / sonu yarım hafta da haftanın tamamıyla gösterilir)
  const haftalar = $derived.by(() => {
    const out: { pzt: Gun; gunler: Gun[] }[] = [];
    const son = new Date(y, m + 1, 0).getDate();
    for (let d = 1; d <= son; d++) {
      const dw = (new Date(y, m, d).getDay() + 6) % 7;
      if (dw > 4) continue;
      if (!out.length || dw === 0) { const p = kaydir(y, m, d, -dw); out.push({ pzt: p, gunler: [0, 1, 2, 3, 4].map(i => kaydir(p[0], p[1], p[2], i)) }); }
    }
    return out;
  });
  let secili = $state(0);
  $effect(() => { y; m; const b = new Date(); const g = b.getFullYear() === y && b.getMonth() === m ? b.getDate() : 0;
    const i = haftalar.findIndex(h => h.gunler.some(([a, bb, c]) => a === y && bb === m && c >= g - 2 && c <= g)); secili = i >= 0 ? i : 0; });
  const hafta = $derived(haftalar[secili] ?? haftalar[0]);
  const H = $derived(hafta ? (onayHaftasiHesapla(veriAnlik(), ...hafta.pzt) as OnayHaftasi) : null);
  const tarih = ([a, b, c]: Gun) => `${c} ${AYLAR[b]}${a !== y ? " " + a : ""}`;
  const haftaMetni = (h: { gunler: Gun[] }) => { const a = h.gunler[0], b = h.gunler[4]; return a[1] === b[1] ? `${a[2]}–${b[2]} ${AYLAR[b[1]]}` : `${tarih(a)} – ${tarih(b)}`; };
  // haftalık onay: onaylanan hafta elle değiştirilemez (sonradan girilen izin / rapor yine yerleri değiştirir); öğlen
  // nöbeti, haftanın onay listesi onaylanmadan oluşturulmaz; onay kalkarsa haftanın öğlen nöbeti de silinir
  const onay = $derived(hafta ? haftaOnayi("onay", ...hafta.pzt) : undefined);
  const onayMetni = $derived(onay ? (onay.zaman > 1 ? new Date(onay.zaman).toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" }) : "önceki sürümde") + (onay.kim ? " · " + onay.kim : "") : "");
  const oglenVar = $derived(!!hafta && hafta.gunler.some(([a, b, c]) => depo.veri.oglen[`${a}-${b}`]?.[c]));
  let onaySor = $state(false), kaldirSor = $state(false);
  function onayiKaldir() { if (oglenVar) { kaldirSor = true; return; } if (hafta) haftaOnayiniKaldir("onay", ...hafta.pzt); }
  const jokerSatir = $derived(Math.max(2, ...(H?.gunler ?? []).map(g => g.joker.length)));

  const yerBaslik = (k: string) => (k === "J" ? "Joker" : "Masa " + k);
  // yıl içi masa sayılarında kişi başı en çok − en az (masa 1–6)
  const kisiFark = (say: Record<string, number>) => { const v = ["1", "2", "3", "4", "5", "6"].map(k => say[k] || 0); return Math.max(...v) - Math.min(...v); };

  // elle yer değiştirme: tablodaki bir kişiye dokunulur, o gün oturan başka biriyle yeri değiştirilir; gün elle kaydedilir
  let degisAcik = $state(false);
  let degis = $state<{ g: OnayGunu; id: number; ad: string; yer: string } | null>(null);
  const isoGun = (g: OnayGunu) => `${g.y}-${String(g.m + 1).padStart(2, "0")}-${String(g.d).padStart(2, "0")}`;
  /** günün eczacı yerleri: kişi id → yer ("1"–"7", "J"); tekniker hariç */
  const gunYerleri = (g: OnayGunu) => {
    const l: Record<number, string> = {};
    g.masa.forEach((h, i) => { if (h.id && !h.tekniker) l[h.id] = String(i + 1); });
    g.joker.forEach(h => { if (h.id) l[h.id] = "J"; });
    return l;
  };
  const digerleri = $derived(degis ? Object.entries(gunYerleri(degis.g)).filter(([id]) => Number(id) !== degis!.id).map(([id, yer]) => ({ id: Number(id), yer, ad: [...degis!.g.masa, ...degis!.g.joker].find(h => h.id === Number(id))?.ad ?? "" })) : []);
  function degisAc(g: OnayGunu, id: number, ad: string, yer: string) { if (onay) return; degis = { g, id, ad, yer }; degisAcik = true; }
  function degistir(baska: { id: number; yer: string }) {
    if (!degis) return;
    const l = gunYerleri(degis.g);
    l[baska.id] = degis.yer; l[degis.id] = baska.yer;
    onayGunuAyarla(isoGun(degis.g), l);
    degisAcik = false;
  }
  function otomatigeBirak() { if (degis) onayGunuAyarla(isoGun(degis.g), null); degisAcik = false; }

  let durum = $state("");
  async function pdf() {
    if (!H || !hafta) return;
    try {
      const { onayPdf } = await ciktiPaketi();
      const g = H.gunler;
      const satirlar = [
        ...Array.from({ length: 7 }, (_, i) => ({ yer: `Masa ${i + 1}`, hucre: g.map(x => ({ ad: x.masa[i]?.ad ?? "", yerine: !!x.masa[i]?.tekniker, bos: !x.tatil && i < 6 && !x.masa[i]?.id })) })),
        ...Array.from({ length: jokerSatir }, (_, i) => ({ yer: `Joker ${i + 1}`, hucre: g.map(x => ({ ad: x.joker[i]?.ad ?? "" })) })),
      ];
      const blob = onayPdf({
        kurum: depo.veri.kurum.ad, donem: `${haftaMetni(hafta)} ${hafta.gunler[4][0]}`,
        gunler: g.map(x => ({ baslik: `${GUN_UZUN[x.dw]} ${x.d} ${AYLAR[x.m]}${x.arife ? " (arife)" : ""}`, tatil: x.tatil })),
        satirlar, notlar: ["Masaya oturan o masanın listelerini onaylar. Renkli hücre: eczacı yetmediği için masaya oturan hazırlama teknikeri."],
      });
      durum = (await dosyaKaydet(`onay-listesi-${H.pzt}.pdf`, blob, "application/pdf")) ? "PDF kaydedildi." : "";
    } catch (e) { durum = hataMetni(e, "PDF oluşturulamadı."); }
  }
</script>

<IslemAlani>
  {#if H}
    {#if onay}<button class="dugme" onclick={onayiKaldir}>Onayı kaldır</button>
    {:else}<button class="dugme ana" onclick={() => (onaySor = true)}><Ikon ad="tamam" />Haftayı onayla</button>{/if}
  {/if}
  {#if H}<button class="dugme" onclick={pdf}><Ikon ad="indir" />Haftalık PDF</button>{/if}
</IslemAlani>
{#if durum}<p class="bant" role="status">{durum}</p>{/if}
{#if onay}<p class="bant bilgi">Bu hafta onaylandı: {onayMetni}. Onaylı hafta elle değiştirilemez; sonradan girilen izin ve raporlar yerleri yine değiştirir. Öğlen nöbeti bu haftanın onayından sonra yazılabilir.</p>
{:else if H}<p class="bant">Bu hafta onaylanmadı. Öğlen nöbeti, haftanın onay listesi onaylandıktan sonra yazılabilir.</p>{/if}

<div class="haftalar" role="group" aria-label="Hafta">
  {#each haftalar as h, i}<button class="hafta" aria-pressed={secili === i} onclick={() => (secili = i)}><b>{i + 1}. hafta{#if haftaOnayi("onay", ...h.pzt)}{" "}<Ikon ad="tamam" boyut={13} />{/if}</b><small>{haftaMetni(h)}{haftaOnayi("onay", ...h.pzt) ? " · onaylı" : ""}</small></button>{/each}
</div>

<Bilgi baslik="Onay masaları nasıl dağıtılır?"><p>Yerler her gün yeniden dağıtılır; sabit sıra yoktur. O gün çalışan eczacılar (acilde tutanlar dahil, kemoterapi eczacıları hariç; nöbet ertesi, izin, rapor olan yok) Masa 1–6'ya oturur. 7. kişi joker olur; 8 ve daha çok kişide fazlalardan ilki Masa 7'ye oturur, kalanlar joker. Kimse önceki çalıştığı gün oturduğu yere oturmaz, mümkünse aynı hafta içinde de aynı yere ikinci kez oturmaz. Yıl boyunca herkes her masaya (ve jokerliğe) eşit oturur: her gün kişi, yıl içinde en az oturduğu yere yerleştirilir. Cuma hafta sonu listeleriyle birlikte 3 günlük iş olduğundan ayrı sayılır: Cumalar kendi arasında, Pazartesi–Perşembe kendi arasında eşitlenir. İlk 6 masa dolmazsa o günün hazırlama teknikerlerinden biri oturur (yıl boyunca sırayla). Tablodaki bir kişiye dokunarak o gün başka biriyle yerini değiştirebilirsiniz; gün elle kaydedilir. Liste haftalık onaylanır; öğlen nöbeti, haftanın onay listesi onaylandıktan sonra yazılır. Hafta içi, arife dahil; resmi tatilde liste yok.</p></Bilgi>

{#if H}
    {#each H.gunler.filter(g => g.uyari.length) as g}<p class="bant hata">{g.d} {AYLAR[g.m]}: {g.uyari.join(" ")}</p>{/each}
    <section class="panel" aria-label="{haftaMetni(hafta)} onay listesi masaları">
      <div class="panel-bas"><h2>{haftaMetni(hafta)} onay masaları</h2>
        <p class="lejant"><span><i class="ornek o-joker"></i>Tekniker oturdu</span><span><i class="ornek o-bos"></i>Boş masa</span></p></div>
      <div class="tablo-kap">
        <table class="onay">
          <thead><tr><th>Gün</th>{#each Array.from({ length: 7 }, (_, i) => i) as i}<th class:ek={i === 6}>Masa {i + 1}</th>{/each}{#each Array.from({ length: jokerSatir }, (_, i) => i) as i}<th class="joker-bas" class:ilk-joker={i === 0}>Joker {i + 1}</th>{/each}</tr></thead>
          <tbody>
            {#each H.gunler as g}
              <tr class:tatil={g.tatil}><th scope="row">{GUN_UZUN[g.dw]}<small>{g.d} {AYLAR[g.m]}{g.arife ? " · arife" : ""}{g.elle ? " · elle" : ""}</small></th>
                {#if g.tatil}<td class="tatil" colspan={7 + jokerSatir}>Resmi tatil: onay listesi yok</td>
                {:else}
                  {#each Array.from({ length: 7 }, (_, i) => i) as i}
                    {@const h = g.masa[i]}
                    {#if !h?.id}<td class:bos={i < 6} class:ek={i === 6}>{i < 6 ? "Boş" : "–"}</td>
                    {:else}<td class:yerine={!!h.tekniker} class:ek={i === 6} title={h.not}>{#if h.tekniker}<b>{h.ad}</b>{:else if onay}<b>{h.ad}</b>{:else}<button class="kisi-d" onclick={() => degisAc(g, h.id!, h.ad, String(i + 1))} aria-label="{h.ad}, Masa {i + 1}: yer değiştir"><b>{h.ad}</b></button>{/if}</td>{/if}
                  {/each}
                  {#each Array.from({ length: jokerSatir }, (_, i) => i) as i}
                    {@const h = g.joker[i]}
                    {#if !h}<td class="joker" class:ilk-joker={i === 0}>–</td>{:else if onay}<td class="joker" class:ilk-joker={i === 0}><b>{h.ad}</b></td>{:else}<td class="joker" class:ilk-joker={i === 0}><button class="kisi-d" onclick={() => degisAc(g, h.id!, h.ad, "J")} aria-label="{h.ad}, joker: yer değiştir"><b>{h.ad}</b></button></td>{/if}
                  {/each}
                {/if}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
    <section class="panel" aria-label="Yıl içinde masa sayıları">
      <div class="panel-bas"><h2>{hafta.gunler[4][0]} yılında oturulan gün (bu hafta dahil; altında Cuma sayısı)</h2></div>
      <div class="tablo-kap">
        <table class="onay sayilar">
          <thead><tr><th>Eczacı</th>{#each ONAY_YERLERI as k}<th>{yerBaslik(k)}</th>{/each}<th>Masa 1–6 farkı</th></tr></thead>
          <tbody>{#each H.kisiler as k (k.id)}<tr><th scope="row">{k.ad}</th>{#each ONAY_YERLERI as y2}<td>{k.say[y2]}<small class="cuma">Cuma {k.cuma[y2]}</small></td>{/each}<td><b>{kisiFark(k.say)}</b><small class="cuma">Cuma {kisiFark(k.cuma)}</small></td></tr>{/each}</tbody>
        </table>
      </div>
    </section>
{/if}


{#if degis}
  <Pencere bind:acik={degisAcik} baslik="{degis.ad} · {degis.yer === 'J' ? 'Joker' : 'Masa ' + degis.yer}" altBaslik="{degis.g.d} {AYLAR[degis.g.m]} {GUN_UZUN[degis.g.dw]} · yerini kiminle değiştirsin?">
    <ul class="degis-l">
      {#each digerleri as o (o.id)}<li><button class="dugme" onclick={() => degistir(o)}><span>{o.ad}</span><small>{o.yer === "J" ? "Joker" : "Masa " + o.yer}</small></button></li>{/each}
    </ul>
    <p class="aciklama-k">Değiştirilen gün elle kaydedilir; eşitlikte gerçekte oturulan yer sayılır, sonraki günler buna göre dengelenir.</p>
    {#snippet altlik()}
      {#if degis?.g.elle}<button class="dugme sade" onclick={otomatigeBirak}>Günü otomatiğe bırak</button>{/if}
      <span style="flex:1"></span>
      <button class="dugme" onclick={() => (degisAcik = false)}>Vazgeç</button>
    {/snippet}
  </Pencere>
{/if}
{#if hafta}
  <OnaySorusu bind:acik={onaySor} ne="{haftaMetni(hafta)} onay listesi" sorunlar={(H?.gunler ?? []).flatMap(g => g.uyari.map(u => `${g.d} ${AYLAR[g.m]}: ${u}`))} onaylayan={depo.veri.kurum.onaylayan} onayla={() => haftayiOnayla("onay", ...hafta.pzt)} />
  <Pencere bind:acik={kaldirSor} baslik="Onay kaldırılsın mı?" altBaslik="{haftaMetni(hafta)} onay listesi">
    <p>Bu haftanın öğlen nöbeti yazılmış. Onay listesinin onayı kalkınca haftanın öğlen nöbeti de (onaylıysa onayıyla birlikte) silinir; onay listesini yeniden onaylayıp öğlen nöbetini yeniden oluşturmanız gerekir.</p>
    {#snippet altlik()}
      <span style="flex:1"></span>
      <button class="dugme" onclick={() => (kaldirSor = false)}>Vazgeç</button>
      <button class="dugme tehlike" onclick={() => { kaldirSor = false; haftaOnayiniKaldir("onay", ...hafta.pzt); }}>Onayı kaldır, öğlen nöbetini sil</button>
    {/snippet}
  </Pencere>
{/if}
<style>
  .bant.bilgi { background: var(--bilgi-zemin); color: var(--bilgi); }
  .haftalar { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: var(--b3); }
  .hafta { display: grid; text-align: left; gap: 1px; padding: 6px 14px; border: 1px solid var(--cizgi); border-radius: var(--r-kucuk); background: var(--yuzey); color: var(--lacivert); cursor: pointer; font: inherit; }
  .hafta b { font-size: var(--f-sm); }
  .hafta small { font-size: var(--f-xs); color: var(--yazi-2); }
  .hafta[aria-pressed="true"] { background: var(--vurgu); border-color: var(--vurgu); color: var(--vurgu-yazi); }
  .hafta[aria-pressed="true"] small { color: var(--vurgu-yazi); opacity: .85; }
  .bant { padding: var(--b2) var(--b4); border-radius: var(--r); margin-bottom: var(--b3); font-size: var(--f-sm); font-weight: 600; display: flex; gap: 8px; align-items: center; background: var(--vurgu-zemin); color: var(--vurgu); }
  .bant.hata { background: var(--hata-zemin, #fde2e2); color: var(--hata); }
  .panel { margin-bottom: var(--b4); }
  .lejant { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: var(--f-xs); color: var(--yazi-2); }
  .lejant span { display: inline-flex; align-items: center; gap: 5px; }
  .ornek { display: inline-block; width: 14px; height: 12px; border: 1px solid var(--cizgi); }
  .o-joker { background: var(--arife-zemin); }
  .o-bos { background: var(--hata-zemin, #fde2e2); border-color: var(--hata); }
  .tablo-kap { overflow-x: auto; }
  .onay { width: 100%; min-width: 900px; table-layout: fixed; border-collapse: collapse; font-size: var(--f-sm); }
  .onay th, .onay td { border-bottom: 1px solid var(--cizgi-acik); border-right: 1px solid var(--cizgi-acik); padding: 8px 10px; text-align: center; vertical-align: middle; }
  .onay thead th { background: var(--tablo-bas); color: var(--lacivert); font-weight: 700; }
  .onay tbody th small { display: block; font-weight: 500; color: var(--yazi-2); font-size: var(--f-xs); }
  .onay thead th:first-child { width: 110px; }
  .onay.sayilar { min-width: 640px; }
  .onay .cuma { display: block; font-size: var(--f-xs); color: var(--yazi-2); }
  .onay tbody th { text-align: left; color: var(--lacivert); background: var(--panel-bas); white-space: nowrap; width: 110px; position: sticky; left: 0; z-index: 1; }
  .onay td b { display: block; font-weight: 600; }
  .kisi-d { border: 0; background: transparent; font: inherit; color: inherit; cursor: pointer; width: 100%; min-height: 32px; padding: 2px; border-radius: var(--r-kucuk); }
  .kisi-d:hover { outline: 2px solid var(--altin); outline-offset: -2px; }
  .kisi-d:focus-visible { outline: 2px solid var(--odak); outline-offset: -2px; }
  .degis-l { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px; }
  .degis-l .dugme { width: 100%; justify-content: space-between; }
  .degis-l small { color: var(--yazi-2); }
  .aciklama-k { font-size: var(--f-sm); color: var(--yazi-2); margin-top: var(--b3); }
  .onay td.yerine { background: var(--arife-zemin); }
  .onay td.bos { background: var(--hata-zemin, #fde2e2); color: var(--hata); font-weight: 700; }
  .onay .tatil { background: var(--yuzey-2); color: var(--soluk); }
  .onay .ilk-joker { border-left: 2px solid var(--cizgi); }
  .onay thead th.joker-bas { background: color-mix(in srgb, var(--acik-mavi) 30%, var(--tablo-bas)); }
</style>
