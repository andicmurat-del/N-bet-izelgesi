<script lang="ts">
  // Onay listesi masaları: haftalık tablo (satırlarda Pazartesi–Cuma, sütunlarda Masa 1–7 ve jokerler). Yerler her gün
  // program tarafından dağıtılır (kimse önceki gün oturduğu yere oturmaz; yıl boyunca herkes her masaya eşit oturur).
  // Kurallar motor/onayMasa.ts'de.
  import { depo, veriAnlik } from "../../veri/depo.svelte";
  import { onayHaftasiHesapla, ONAY_YERLERI, type OnayHaftasi } from "../../motor";
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
  const jokerSatir = $derived(Math.max(2, ...(H?.gunler ?? []).map(g => g.joker.length)));

  const yerBaslik = (k: string) => (k === "J" ? "Joker" : "Masa " + k);
  // yıl içi masa sayılarında kişi başı en çok − en az (masa 1–6)
  const kisiFark = (say: Record<string, number>) => { const v = ["1", "2", "3", "4", "5", "6"].map(k => say[k] || 0); return Math.max(...v) - Math.min(...v); };

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
  {#if H}<button class="dugme" onclick={pdf}><Ikon ad="indir" />Haftalık PDF</button>{/if}
</IslemAlani>
{#if durum}<p class="bant" role="status">{durum}</p>{/if}

<div class="haftalar" role="group" aria-label="Hafta">
  {#each haftalar as h, i}<button class="hafta" aria-pressed={secili === i} onclick={() => (secili = i)}><b>{i + 1}. hafta</b><small>{haftaMetni(h)}</small></button>{/each}
</div>

<Bilgi baslik="Onay masaları nasıl dağıtılır?"><p>Yerler her gün yeniden dağıtılır; sabit sıra yoktur. O gün çalışan eczacılar (acilde tutanlar dahil, kemoterapi eczacıları hariç; nöbet ertesi, izin, rapor olan yok) Masa 1–6'ya oturur. 7. kişi joker olur; 8 ve daha çok kişide fazlalardan ilki Masa 7'ye oturur, kalanlar joker. Kimse önceki çalıştığı gün oturduğu yere oturmaz, mümkünse aynı hafta içinde de aynı yere ikinci kez oturmaz. Yıl boyunca herkes her masaya (ve jokerliğe) eşit oturur: her gün kişi, yıl içinde en az oturduğu yere yerleştirilir. Cuma hafta sonu listeleriyle birlikte 3 günlük iş olduğundan ayrı sayılır: Cumalar kendi arasında, Pazartesi–Perşembe kendi arasında eşitlenir. İlk 6 masa dolmazsa o günün hazırlama teknikerlerinden biri oturur (yıl boyunca sırayla). Hafta içi, arife dahil; resmi tatilde liste yok.</p></Bilgi>

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
              <tr class:tatil={g.tatil}><th scope="row">{GUN_UZUN[g.dw]}<small>{g.d} {AYLAR[g.m]}{g.arife ? " · arife" : ""}</small></th>
                {#if g.tatil}<td class="tatil" colspan={7 + jokerSatir}>Resmi tatil: onay listesi yok</td>
                {:else}
                  {#each Array.from({ length: 7 }, (_, i) => i) as i}
                    {@const h = g.masa[i]}
                    {#if !h?.id}<td class:bos={i < 6} class:ek={i === 6}>{i < 6 ? "Boş" : "–"}</td>
                    {:else}<td class:yerine={!!h.tekniker} class:ek={i === 6} title={h.not}><b>{h.ad}</b></td>{/if}
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

<style>
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
  .onay td.yerine { background: var(--arife-zemin); }
  .onay td.bos { background: var(--hata-zemin, #fde2e2); color: var(--hata); font-weight: 700; }
  .onay .tatil { background: var(--yuzey-2); color: var(--soluk); }
  .onay .ilk-joker { border-left: 2px solid var(--cizgi); }
  .onay thead th.joker-bas { background: color-mix(in srgb, var(--acik-mavi) 30%, var(--tablo-bas)); }
</style>
