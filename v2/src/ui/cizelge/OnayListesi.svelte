<script lang="ts">
  // Onay listesi masaları: haftalık tablo (satırlarda Pazartesi–Cuma, sütunlarda Masa 1–7 ve jokerler). Yerleşim bir hafta
  // için girilir, sonraki haftalar sırayla kendiliğinden ilerler (Masa 1 → 3 → 2 → 4 → Joker → 5 → Joker → 6).
  // Kurallar motor/onayMasa.ts'de.
  import { depo, veriAnlik, onayYerlesimiAyarla } from "../../veri/depo.svelte";
  import { onayHaftasiHesapla, onayDongusu, yerAdi, type OnayHaftasi, type Yer } from "../../motor";
  import { AYLAR, GUN_UZUN } from "../../veri/tarih";
  import { ciktiPaketi } from "../../disa/yukle";
  import { dosyaKaydet, hataMetni } from "../../disa/indir";
  import IslemAlani from "../ortak/IslemAlani.svelte";
  import Bilgi from "../ortak/Bilgi.svelte";
  import Ikon from "../ortak/Ikon.svelte";

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
  const capaMetni = $derived(H?.yerlesim ? (() => { const [a, b, c] = H.yerlesim.capa.split("-").map(Number); return `${c} ${AYLAR[b - 1]} ${a}`; })() : "");
  const jokerSatir = $derived(Math.max(2, ...(H?.gunler ?? []).map(g => g.joker.length)));

  // yerleşim girişi: her eczacıya sıradaki yer; aynı yer iki kişiye verilemez
  let duzenle = $state(false);
  let secim = $state<Record<number, string>>({});
  const n = $derived(Math.max(8, H?.kisiler.length ?? 0));
  const dongu = $derived(onayDongusu(n));
  function duzenlemeyiAc() {
    secim = Object.fromEntries((H?.kisiler ?? []).map(k => [k.id, H?.yerlesim && H.yerlesim.yer[k.id] !== undefined ? String(H.yerlesim.yer[k.id]) : ""]));
    duzenle = true;
  }
  $effect(() => { secili; y; m; duzenle = false; });
  const cakisan = $derived.by(() => { const say: Record<string, number> = {}; Object.values(secim).forEach(v => { if (v) say[v] = (say[v] || 0) + 1; }); return new Set(Object.keys(say).filter(k => say[k] > 1)); });
  const bosKalan = $derived((H?.kisiler ?? []).filter(k => !secim[k.id]).length);
  function kaydet() {
    if (!H || cakisan.size) return;
    const yer: Record<number, number> = {};
    for (const [id, v] of Object.entries(secim)) if (v) yer[Number(id)] = Number(v);
    onayYerlesimiAyarla(H.pzt, yer);
    duzenle = false;
  }
  function girisiKaldir() { if (H) onayYerlesimiAyarla(H.pzt, null); duzenle = false; }
  const yerKisa = (yer: Yer | null) => (yer ? yerAdi(yer) : "Sırada değil");

  let durum = $state("");
  async function pdf() {
    if (!H?.yerlesim || !hafta) return;
    try {
      const { onayPdf } = await ciktiPaketi();
      const g = H.gunler;
      const satirlar = [
        ...Array.from({ length: 7 }, (_, i) => ({ yer: `Masa ${i + 1}`, hucre: g.map(x => ({ ad: x.masa[i]?.ad ?? "", yerine: !!x.masa[i]?.not?.includes("yerine"), bos: !x.tatil && i < 6 && !x.masa[i]?.id })) })),
        ...Array.from({ length: jokerSatir }, (_, i) => ({ yer: `Joker ${i + 1}`, hucre: g.map(x => ({ ad: x.joker[i]?.ad ?? "" })) })),
      ];
      const blob = onayPdf({
        kurum: depo.veri.kurum.ad, donem: `${haftaMetni(hafta)} ${hafta.gunler[4][0]}`,
        gunler: g.map(x => ({ baslik: `${GUN_UZUN[x.dw]} ${x.d} ${AYLAR[x.m]}${x.arife ? " (arife)" : ""}`, tatil: x.tatil })),
        satirlar, notlar: ["Masaya oturan o masanın listelerini onaylar. Joker, eksik masaya oturduğunda joker görevini yapmış sayılır."],
      });
      durum = (await dosyaKaydet(`onay-listesi-${H.pzt}.pdf`, blob, "application/pdf")) ? "PDF kaydedildi." : "";
    } catch (e) { durum = hataMetni(e, "PDF oluşturulamadı."); }
  }
</script>

<IslemAlani>
  {#if H?.yerlesim}<button class="dugme" onclick={pdf}><Ikon ad="indir" />Haftalık PDF</button>{/if}
  {#if H && !duzenle}<button class="dugme" onclick={duzenlemeyiAc}><Ikon ad="duzenle" />{H.yerlesim ? "Bu haftanın yerleşimini düzenle" : "Yerleşimi gir"}</button>{/if}
</IslemAlani>
{#if durum}<p class="bant" role="status">{durum}</p>{/if}

<div class="haftalar" role="group" aria-label="Hafta">
  {#each haftalar as h, i}<button class="hafta" aria-pressed={secili === i} onclick={() => (secili = i)}><b>{i + 1}. hafta</b><small>{haftaMetni(h)}</small></button>{/each}
</div>

<Bilgi baslik="Onay masaları nasıl dağıtılır?"><p>Her eczacı (acilde tutanlar dahil, kemoterapi eczacıları hariç) hafta boyunca aynı yerde oturur, her hafta sıradaki yere geçer: Masa 1 → Masa 3 → Masa 2 → Masa 4 → Joker → Masa 5 → Joker → Masa 6 (9. kişi sona joker olarak eklenir). O gün çalışmayanın (nöbet ertesi, izin, rapor) masasına sıradaki joker oturur; joker görevini yapmış sayılır. Jokerler eksik masaları doldurduktan sonra 2 ya da daha çok joker kalırsa ilki Masa 7'ye oturur, kalanlar joker olarak kalır. İlk 6 masa yine dolmazsa o günün hazırlama teknikerlerinden biri oturur (yıl boyunca sırayla). Hafta içi, arife dahil; resmi tatilde liste yok.</p></Bilgi>

{#if H}
  {#if duzenle}
    <section class="panel" aria-label="Haftanın yerleşimi">
      <div class="panel-bas"><h2>{haftaMetni(hafta)} yerleşimi</h2></div>
      <div class="panel-ic form">
        <p class="aciklama">Bu hafta kimin hangi yerde oturduğunu seçin. Sonraki haftalar bu yerleşimden sırayla ilerler; kadro değişirse ilgili haftada yeniden düzenleyin.</p>
        <div class="kisiler">
          {#each H.kisiler as k (k.id)}
            <label class="kisi" class:cakisma={!!secim[k.id] && cakisan.has(secim[k.id])}><span>{k.ad}</span>
              <select bind:value={secim[k.id]} aria-label="{k.ad} yeri">
                <option value="">Sırada değil</option>
                {#each dongu as yer, i}<option value={String(i)}>{yerAdi(yer)}</option>{/each}
              </select>
            </label>
          {/each}
        </div>
        {#if cakisan.size}<p class="satir hata" role="alert"><Ikon ad="uyari" boyut={15} />Aynı yer birden çok kişiye verilmiş.</p>{/if}
        {#if bosKalan}<p class="satir uyari"><Ikon ad="uyari" boyut={15} />{bosKalan} kişi sırada değil; bu kişiler masaya oturmaz.</p>{/if}
        <div class="dugmeler">
          <button class="dugme ana" onclick={kaydet} disabled={!!cakisan.size}><Ikon ad="tamam" />Kaydet</button>
          {#if H.yerlesim?.girildi}<button class="dugme sade" onclick={girisiKaldir}>Bu haftanın girişini kaldır</button>{/if}
          <button class="dugme sade" onclick={() => (duzenle = false)}>Vazgeç</button>
        </div>
      </div>
    </section>
  {:else if !H.yerlesim}
    <section class="kart bos"><h2>Yerleşim henüz girilmedi</h2><p>Onay listesinin başlaması için bir haftada kimin hangi masada ya da joker olduğunu bir kez girin; sonraki haftalar sırayla kendiliğinden ilerler.</p>
      <button class="dugme ana" onclick={duzenlemeyiAc}><Ikon ad="duzenle" />Yerleşimi gir</button></section>
  {:else}
    <p class="aciklama">{H.yerlesim.girildi ? "Bu haftanın yerleşimi elle girildi." : `Yerleşim ${capaMetni} haftasından sırayla ilerliyor.`}</p>
    {#if H.sirasiz.length}<p class="bant dikkat"><Ikon ad="uyari" boyut={16} />{H.sirasiz.join(", ")} sırada değil (yeni gelen olabilir). "Bu haftanın yerleşimini düzenle" ile yerini seçin.</p>{/if}
    {#each H.gunler.filter(g => g.uyari.length) as g}<p class="bant hata">{g.d} {AYLAR[g.m]}: {g.uyari.join(" ")}</p>{/each}
    <section class="panel" aria-label="{haftaMetni(hafta)} onay listesi masaları">
      <div class="panel-bas"><h2>{haftaMetni(hafta)} onay masaları</h2>
        <p class="lejant"><span><i class="ornek o-joker"></i>Joker ya da tekniker yerine oturdu</span><span><i class="ornek o-bos"></i>Boş masa</span></p></div>
      <div class="tablo-kap">
        <table class="onay">
          <thead><tr><th>Gün</th>{#each Array.from({ length: 7 }, (_, i) => i) as i}<th class:ek={i === 6}>Masa {i + 1}</th>{/each}{#each Array.from({ length: jokerSatir }, (_, i) => i) as i}<th class="joker-bas" class:ilk-joker={i === 0}>Joker {i + 1}</th>{/each}</tr></thead>
          <tbody>
            {#each H.gunler as g}
              <tr class:tatil={g.tatil}><th scope="row">{GUN_UZUN[g.dw]}<small>{g.d} {AYLAR[g.m]}{g.arife ? " · arife" : ""}</small></th>
                {#if g.tatil}<td class="tatil" colspan={7 + jokerSatir}>Resmi tatil: onay listesi yok</td>
                {:else}
                  {#each Array.from({ length: 7 }, (_, i) => i) as i}
                    {@const h = g.masa[i]}
                    {#if !h?.id}<td class:bos={i < 6} class:ek={i === 6}>{i < 6 ? "Boş" : "–"}</td>
                    {:else}<td class:yerine={!!h.not?.includes("yerine")} class:ek={i === 6} title={h.not}><b>{h.ad}</b></td>{/if}
                  {/each}
                  {#each Array.from({ length: jokerSatir }, (_, i) => i) as i}
                    {@const h = g.joker[i]}
                    {#if !h}<td class="joker" class:ilk-joker={i === 0}>–</td>{:else}<td class="joker" class:ilk-joker={i === 0}><b>{h.ad}</b></td>{/if}
                  {/each}
                {/if}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
    <section class="panel" aria-label="Bu haftanın yerleri">
      <div class="panel-bas"><h2>Bu haftanın yerleri</h2></div>
      <ul class="yerler">{#each H.kisiler as k (k.id)}<li class:yok={!k.yer}><span>{k.ad}</span><b>{yerKisa(k.yer)}</b></li>{/each}</ul>
    </section>
  {/if}
{/if}

<style>
  .haftalar { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: var(--b3); }
  .hafta { display: grid; text-align: left; gap: 1px; padding: 6px 14px; border: 1px solid var(--cizgi); border-radius: var(--r-kucuk); background: var(--yuzey); color: var(--lacivert); cursor: pointer; font: inherit; }
  .hafta b { font-size: var(--f-sm); }
  .hafta small { font-size: var(--f-xs); color: var(--yazi-2); }
  .hafta[aria-pressed="true"] { background: var(--vurgu); border-color: var(--vurgu); color: var(--vurgu-yazi); }
  .hafta[aria-pressed="true"] small { color: var(--vurgu-yazi); opacity: .85; }
  .aciklama { font-size: var(--f-sm); color: var(--yazi-2); margin: var(--b2) 0 var(--b3); }
  .bant { padding: var(--b2) var(--b4); border-radius: var(--r); margin-bottom: var(--b3); font-size: var(--f-sm); font-weight: 600; display: flex; gap: 8px; align-items: center; background: var(--vurgu-zemin); color: var(--vurgu); }
  .bant.dikkat { background: var(--dikkat-zemin); color: var(--dikkat); }
  .bant.hata { background: var(--hata-zemin, #fde2e2); color: var(--hata); }
  .bos { padding: var(--b5); display: grid; gap: var(--b3); justify-items: start; }
  .bos p { color: var(--yazi-2); }
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
  .onay tbody th { text-align: left; color: var(--lacivert); background: var(--panel-bas); white-space: nowrap; width: 110px; position: sticky; left: 0; z-index: 1; }
  .onay td b { display: block; font-weight: 600; }
  .onay td.yerine { background: var(--arife-zemin); }
  .onay td.bos { background: var(--hata-zemin, #fde2e2); color: var(--hata); font-weight: 700; }
  .onay .tatil { background: var(--yuzey-2); color: var(--soluk); }
  .onay .ilk-joker { border-left: 2px solid var(--cizgi); }
  .onay thead th.joker-bas { background: color-mix(in srgb, var(--acik-mavi) 30%, var(--tablo-bas)); }
  .yerler { list-style: none; margin: 0; padding: var(--b3) var(--b4); display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 6px 16px; }
  .yerler li { display: flex; justify-content: space-between; gap: 8px; font-size: var(--f-sm); padding: 4px 0; border-bottom: 1px dashed var(--cizgi-acik); }
  .yerler li b { color: var(--lacivert); }
  .yerler li.yok b { color: var(--dikkat); }
  .form .kisiler { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 8px 16px; margin-bottom: var(--b3); }
  .kisi { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: var(--f-sm); font-weight: 600; padding: 4px 8px; border: 1px solid var(--cizgi-acik); border-radius: var(--r-kucuk); }
  .kisi.cakisma { border-color: var(--hata); background: var(--hata-zemin, #fde2e2); }
  .kisi select { min-height: 32px; border: 1px solid var(--cizgi); border-radius: var(--r-kucuk); background: var(--yuzey); font: inherit; font-weight: 500; }
  .satir { display: flex; gap: 6px; align-items: center; font-size: var(--f-sm); margin-bottom: var(--b2); }
  .satir.hata { color: var(--hata); }
  .satir.uyari { color: var(--dikkat); }
  .dugmeler { display: flex; flex-wrap: wrap; gap: var(--b2); }
</style>
