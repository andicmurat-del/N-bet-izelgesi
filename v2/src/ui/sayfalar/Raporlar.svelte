<script lang="ts">
  import Bilgi from "../ortak/Bilgi.svelte";
  // Yıllık raporlar: özet (aylara göre fazla mesai, görev dağılımı), yıllık denge (beklenen paya göre fark), kişi geçmişi,
  // acil eczane ve öğlen nöbeti dağılımı, servis hazırlama.
  import { yillikRaporHesapla, acilKadrosunda } from "../../motor";
  import { depo, veriAnlik } from "../../veri/depo.svelte";
  import { ROL_AD, type Rol } from "../../veri/tipler";
  import { AYLAR } from "../../veri/tarih";
  import { dosyaKaydet, hataMetni } from "../../disa/indir";
  import Ikon from "../ortak/Ikon.svelte";
  import ServisRaporu from "../hazirlama/ServisRaporu.svelte";
  import AcilOglenRaporu from "./AcilOglenRaporu.svelte";
  import type { Rapor } from "../../disa/raporCikti";


  // bolum: Günlük Eczane (eczane kadrosu: denge, öğlen, servis hazırlama) ya da Acil Eczane (acil kadrosu: acil nöbet dağılımı).
  // Her bölümde yalnız o kadronun kişileri görünür.
  let { bolum }: { bolum: "gunluk" | "acil" } = $props();
  let yil = $state(depo.yil);
  let sekme = $state<"ozet" | "denge" | "kisi" | "acil" | "oglen" | "servis">("ozet");
  const acilMi = (k: { id: number; role: string }) => { const st = depo.veri.staff.find(s => s.id === k.id); return st ? acilKadrosunda(st) : k.role === "servis"; };
  const kapsam = (k: { id: number; role: string }) => (bolum === "acil" ? acilMi(k) : !acilMi(k));
  const Ham = $derived(yillikRaporHesapla(veriAnlik(), yil) as Rapor);
  const R = $derived({ ...Ham, V: { ...Ham.V, kisiler: Ham.V.kisiler.filter(kapsam) }, D: bolum === "acil" || !Ham.D ? null : { ...Ham.D, kisiler: Ham.D.kisiler.filter(x => kapsam(x.k)) } } as Rapor);
  const SEKMELER = $derived(bolum === "acil"
    ? [["ozet", "Özet"], ["kisi", "Kişi geçmişi"], ["acil", "Acil eczane nöbeti"]] as const
    : [["ozet", "Özet"], ["denge", "Denge"], ["kisi", "Kişi geçmişi"], ["oglen", "Öğlen nöbeti"], ["servis", "Servis hazırlama"]] as const);
  const nobetci = (r: Rol) => r === "eczaci" || r === "teknisyen" || r === "nobetci" || (bolum === "acil" && r === "servis");
  const duty = $derived(R.V.kisiler.filter(k => nobetci(k.role)));
  const toplamNobet = $derived(duty.reduce((t, k) => t + R.toplam[k.id].nobet, 0));
  const toplamFm = $derived(duty.reduce((t, k) => t + R.toplam[k.id].fm, 0));
  const fmOrt = $derived(duty.length ? toplamFm / duty.length : 0);
  const fmMax = $derived(Math.max(16, ...duty.map(k => R.toplam[k.id].fm)));
  const fmFark = $derived(duty.length ? Math.max(...duty.map(k => R.toplam[k.id].fm)) - Math.min(...duty.map(k => R.toplam[k.id].fm)) : 0);
  const aylikOrt = $derived(R.V.aylar.map(a => { if (!a) return 0; const v = duty.filter(k => a.det[k.id]).map(k => a.det[k.id].fm); return v.length ? v.reduce((t, x) => t + x, 0) / v.length : 0; }));
  const isi = (v: number, ort: number) => Math.abs(v - ort) > 8 ? (v > ort ? "sicak" : "soguk") : "";
  const farkMetni = (d: number, saat?: boolean) => { const r = saat ? Math.round(d) : Math.round(d * 10) / 10; return (r > 0 ? "+" : r < 0 ? "−" : "±") + String(Math.abs(r)).replace(".", ","); };
  const farkSinif = (d: number, saat?: boolean) => { const a = Math.abs(d), s1 = saat ? 8 : 1.5, s2 = saat ? 16 : 2.5; return a <= s1 ? "" : a <= s2 ? "orta" : "kotu"; };

  let kisiId = $state<number | null>(null);
  $effect(() => { if (kisiId === null || !R.V.kisiler.some(k => k.id === kisiId)) kisiId = R.V.kisiler[0]?.id ?? null; });
  const kisi = $derived(R.V.kisiler.find(k => k.id === kisiId) ?? null);

  let durum = $state("");
  async function excel() {
    try {
      const { yillikKitap } = await import("../../disa/raporCikti");
      const blob = yillikKitap(R, depo.veri.kurum.ad);
      durum = (await dosyaKaydet(`yillik-rapor-${bolum === "acil" ? "acil-" : ""}${yil}.xlsx`, blob, blob.type)) ? "Excel dosyası kaydedildi." : "";
    } catch (e) { durum = hataMetni(e, "Dosya oluşturulamadı."); }
  }
</script>

<p class="aciklama ust-not">{bolum === "acil" ? "Acil kadrosunun (acil servis personeli ve acilde nöbet tutan eczacılar) yıllık fazla mesai ve görev dağılımı." : "Günlük eczane kadrosunun yıllık fazla mesai ve görev dağılımı; acil kadrosu Acil Eczane > Raporlar'da."} Rakamlar puantaja göredir (gerçekleşen){bolum === "gunluk" ? "; yıllık denge çizelgeye göre hesaplanır (puantajdaki gönüllü değişimler sayılmaz)" : ""}.</p>
<div class="ust-cubuk">
  <div class="sekmeler" role="tablist" aria-label="Rapor">
    {#each SEKMELER as [ad, baslik]}<button role="tab" aria-selected={sekme === ad} class:secili={sekme === ad} onclick={() => (sekme = ad)}>{baslik}</button>{/each}
  </div>
  <div class="sag-arac">
    <div class="yil" role="group" aria-label="Yıl seçimi">
      <button class="dugme sade" onclick={() => yil--} aria-label="Önceki yıl"><Ikon ad="sol" /></button>
      <span class="rakam">{yil}</span>
      <button class="dugme sade" onclick={() => yil++} aria-label="Sonraki yıl"><Ikon ad="sag" /></button>
    </div>
    {#if R.V.kayitli && (sekme === "ozet" || sekme === "denge" || sekme === "kisi")}<button class="dugme" onclick={excel}><Ikon ad="indir" />Excel</button>{/if}
  </div>
</div>
{#if durum}<p class="bant" role="status">{durum}</p>{/if}

{#if sekme === "servis"}
  <ServisRaporu {yil} />
{:else if sekme === "acil" || sekme === "oglen"}
  <AcilOglenRaporu {yil} goster={sekme} />
{:else if !R.V.kayitli}
  <div class="kart bos"><h2>{yil} yılı için kayıtlı çizelge yok</h2><p>Çizelge oluşturduğunuz aylar burada raporlanır.</p></div>
{:else if sekme === "ozet"}
  <div class="ozet-serit kpi-serit">
    <div class="kpi"><small>Kayıtlı ay</small><b class="rakam">{R.V.kayitli}<span>/ 12</span></b></div>
    <div class="kpi"><small>Toplam nöbet</small><b class="rakam">{toplamNobet}</b><span class="alt">kişi başı {duty.length ? (toplamNobet / duty.length).toFixed(1).replace(".", ",") : 0}</span></div>
    <div class="kpi"><small>Toplam fazla mesai</small><b class="rakam">{toplamFm}<span>sa</span></b><span class="alt">nöbetçi başı {Math.round(fmOrt)} sa</span></div>
    <div class="kpi"><small>Yıllık fark (en çok − en az)</small><b class="rakam">{fmFark}<span>sa</span></b><span class="rozet {fmFark <= 16 ? 'tamam' : fmFark <= 32 ? 'dikkat' : 'hata'}">{fmFark <= 16 ? "Dengeli" : fmFark <= 32 ? "Orta" : "Dengesiz"}</span></div>
  </div>

  <section class="blok panel-blok">
    <h2>Aylara göre fazla mesai (saat)</h2>
    <p class="aciklama">Turuncu: ayın nöbetçi ortalamasının 8 saatten fazla üstü; mavi: altı. Soluk sütunlar: kaydı olmayan aylar.</p>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (kaydırılan tablo klavyeyle kaydırılabilsin: WCAG 2.1.1) -->
    <div class="kart tablo-kap" tabindex="0" role="region" aria-label="Aylara göre fazla mesai">
      <table>
        <thead><tr><th class="sol" scope="col">Ad soyad</th>{#each R.ayKisa as a, i}<th scope="col" class:bos-ay={!R.V.aylar[i]}>{a}</th>{/each}<th scope="col" class="vurgu">Toplam</th><th scope="col">Ay ort.</th><th scope="col" title="Yıllık toplamın nöbetçi ortalamasından sapması (saat)">Fark</th></tr></thead>
        <tbody>
          {#each R.V.kisiler as k (k.id)}
            {@const t = R.toplam[k.id]}
            <tr>
              <th class="sol" scope="row"><span class="isaret {k.role}"></span>{k.name}{#if !k.aktif}<small> (listeden çıkarıldı)</small>{/if}</th>
              {#each R.V.aylar as a, i}
                {#if !a}<td class="bos-ay">–</td>{:else}{@const v = a.det[k.id]?.fm ?? 0}<td class={nobetci(k.role) ? isi(v, aylikOrt[i]) : ""}>{a.det[k.id] ? v : "–"}</td>{/if}
              {/each}
              <td class="vurgu">{t.fm}</td><td>{Math.round(t.fm / R.V.kayitli)}</td><td>{nobetci(k.role) ? farkMetni(t.fm - fmOrt, true) : ""}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>

  <section class="blok panel-blok">
    <h2>Yıllık toplam fazla mesai</h2>
    <div class="kart cubuklar" role="img" aria-label="Nöbetçi başı yıllık fazla mesai; ortalama {Math.round(fmOrt)} saat">
      {#each [...duty].sort((a, b) => R.toplam[b.id].fm - R.toplam[a.id].fm) as k (k.id)}
        <div class="cubuk-satir" title="{k.name}: {R.toplam[k.id].fm} saat ({farkMetni(R.toplam[k.id].fm - fmOrt, true)})">
          <span class="ad">{k.name}</span>
          <span class="iz"><i class={k.role === "teknisyen" ? "tek" : "ecz"} style="width:{(R.toplam[k.id].fm / (fmMax * 1.05)) * 100}%"></i><u style="left:{(fmOrt / (fmMax * 1.05)) * 100}%"></u></span>
          <span class="deger rakam">{R.toplam[k.id].fm}</span>
        </div>
      {/each}
      <p class="lejant"><span><i class="ecz"></i>Eczacı</span><span><i class="tek"></i>Tekniker</span><span><i class="cizgi"></i>Nöbetçi ortalaması ({Math.round(fmOrt)} sa)</span></p>
    </div>
  </section>

  <section class="blok panel-blok">
    <h2>Görev dağılımı (yıl toplamı)</h2>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (kaydırılan tablo klavyeyle kaydırılabilsin: WCAG 2.1.1) -->
    <div class="kart tablo-kap" tabindex="0" role="region" aria-label="Görev dağılımı">
      <table>
        <thead><tr><th class="sol" scope="col">Ad soyad</th><th scope="col">Nöbet</th><th scope="col">Perşembe</th><th scope="col">Cuma</th><th scope="col">Cumartesi</th><th scope="col">Pazar</th><th scope="col">Hazırlama</th><th scope="col">Resmi tatil</th><th scope="col">Yıllık izin</th><th scope="col">Rapor</th></tr></thead>
        <tbody>
          {#each R.V.kisiler as k (k.id)}{@const t = R.toplam[k.id]}
            <tr><th class="sol" scope="row">{k.name}</th><td class="vurgu">{t.nobet}</td><td>{t.thu}</td><td>{t.cu}</td><td>{t.cmt}</td><td>{t.paz}</td><td>{t.prep}</td><td>{t.rt}</td><td>{t.yi}</td><td>{t.rd}</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>
{:else if sekme === "denge" && R.D}
  <section class="blok panel-blok">
    <Bilgi baslik="Tablo nasıl okunur?"><p>Her hücrede yıl toplamı ve kişinin çalıştığı ay sayısına göre beklenen paydan farkı. Nöbet sayısına hazırlama da dahildir. Renkli: fark büyük (sayılarda 1,5'ten, saatte 8'den fazla). Yarım yıl çalışanlar ay sayısıyla birlikte gösterilir.</p></Bilgi>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (kaydırılan tablo klavyeyle kaydırılabilsin: WCAG 2.1.1) -->
    <div class="kart tablo-kap" tabindex="0" role="region" aria-label="Yıllık denge tablosu">
      <table class="denge">
        <thead><tr><th class="sol" scope="col">Ad soyad</th>{#each R.kolonlar as c}<th scope="col">{c.t}{c.saat ? " (sa)" : ""}</th>{/each}</tr></thead>
        <tbody>
          {#each R.D.kisiler as x (x.k.id)}
            <tr>
              <th class="sol" scope="row">{x.k.name}{#if x.kismi}<small> ({x.ay} ay)</small>{/if}</th>
              {#each R.kolonlar as c}<td class={farkSinif(x.fark[c.k], c.saat)}><b>{x.t[c.k]}</b><small>{farkMetni(x.fark[c.k], c.saat)}</small></td>{/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>
{:else if sekme === "kisi" && kisi}
  <section class="blok panel-blok">
    <label class="alan kisi-sec"><span>Kişi</span>
      <select class="girdi" bind:value={kisiId}>{#each R.V.kisiler as k}<option value={k.id}>{k.name} · {ROL_AD[k.role]}{k.aktif ? "" : " (listeden çıkarıldı)"}</option>{/each}</select>
    </label>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (kaydırılan tablo klavyeyle kaydırılabilsin: WCAG 2.1.1) -->
    <div class="kart tablo-kap" tabindex="0" role="region" aria-label="Kişi geçmişi">
      <table>
        <thead><tr><th class="sol" scope="col">Ay</th><th scope="col">Nöbet</th><th scope="col">Perşembe</th><th scope="col">Cuma</th><th scope="col">Cumartesi</th><th scope="col">Pazar</th><th scope="col">Hazırlama</th><th scope="col">Resmi tatil</th><th scope="col">Yıllık izin</th><th scope="col">Rapor</th><th scope="col" class="vurgu">Fazla mesai</th></tr></thead>
        <tbody>
          {#each R.V.aylar as a, i}{#if a && a.det[kisi.id]}{@const d = a.det[kisi.id]}
            <tr><th class="sol" scope="row">{AYLAR[i]}</th><td>{d.nobet}</td><td>{d.thu}</td><td>{d.cu}</td><td>{d.cmt}</td><td>{d.paz}</td><td>{d.prep}</td><td>{d.rt}</td><td>{d.yi}</td><td>{d.rd}</td><td class="vurgu">{d.fm} sa</td></tr>
          {/if}{/each}
          {#if R.toplam[kisi.id]}{@const t = R.toplam[kisi.id]}
            <tr class="toplam"><th class="sol" scope="row">Toplam</th><td>{t.nobet}</td><td>{t.thu}</td><td>{t.cu}</td><td>{t.cmt}</td><td>{t.paz}</td><td>{t.prep}</td><td>{t.rt}</td><td>{t.yi}</td><td>{t.rd}</td><td class="vurgu">{t.fm} sa</td></tr>
          {/if}
        </tbody>
      </table>
    </div>
  </section>
{/if}

<style>
  :where(tbody tr:nth-child(even)) > :where(td, th) { background: var(--yuzey-2); }
  .yil { display: inline-flex; align-items: center; background: var(--yuzey); border: 1px solid var(--cizgi); border-radius: var(--r-kucuk); }
  .yil .dugme { min-height: 34px; width: 36px; padding: 0; }
  .yil span { min-width: 72px; text-align: center; font-weight: 700; color: var(--lacivert); font-size: var(--f-md); }
  .ust-not { margin-bottom: var(--b3); }
  .sag-arac { display: flex; gap: var(--b2); align-items: center; }
  .ust-cubuk { display: flex; flex-wrap: wrap; gap: var(--b3); justify-content: space-between; align-items: flex-end; margin-bottom: var(--b4); }
  .sekmeler { display: flex; gap: 2px; border-bottom: 1px solid var(--cizgi); overflow-x: auto; flex: 1; min-width: 0; }
  .sekmeler button { min-height: 38px; padding: 0 14px; margin-bottom: -1px; border: 1px solid var(--cizgi); border-top: 3px solid transparent; border-radius: var(--r) var(--r) 0 0; background: var(--panel-bas); color: var(--yazi-2); font-weight: 600; cursor: pointer; white-space: nowrap; flex: none; }
  .sekmeler button:hover { color: var(--lacivert); background: var(--tablo-bas); }
  .sekmeler button.secili { background: var(--yuzey); color: var(--lacivert); border-top-color: var(--lacivert); border-bottom-color: var(--yuzey); }
  .bant { padding: var(--b2) var(--b4); border-radius: var(--r); margin-bottom: var(--b3); font-size: var(--f-sm); font-weight: 500; background: var(--vurgu-zemin); color: var(--vurgu); }
  .bos { padding: var(--b5); display: grid; gap: var(--b2); }
  .bos p { color: var(--yazi-2); }
  .kpi-serit { margin-bottom: var(--b4); }
  .kpi b span { font-size: var(--f-sm); color: var(--yazi-2); margin-left: 4px; font-weight: 600; }
  .kpi .rozet { display: inline-flex; width: auto; justify-self: start; }
  .blok { margin-bottom: var(--b4); }
  .aciklama { font-size: var(--f-sm); color: var(--soluk); max-width: 100ch; }
  .tablo-kap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: var(--f-sm); font-variant-numeric: tabular-nums; }
  th, td { padding: 8px 10px; border: 1px solid var(--cizgi-acik); text-align: right; white-space: nowrap; }
  thead th { background: var(--tablo-bas); font-size: var(--f-xs); color: var(--lacivert); font-weight: 700; }
  .sol { text-align: left; }
  tbody th { font-weight: 500; }
  tbody th .isaret { margin-right: 8px; }
  tbody th small { color: var(--soluk); font-weight: 400; }
  .bos-ay { color: var(--soluk); }
  .vurgu { font-weight: 700; color: var(--vurgu); }
  .sicak { background: var(--haz-zemin); color: var(--haz); font-weight: 600; }
  .soguk { background: var(--tek-zemin); color: var(--tek); font-weight: 600; }
  .denge td { line-height: 1.25; }
  .denge td b { display: block; font-weight: 600; }
  .denge td small { color: var(--soluk); font-size: var(--f-xs); }
  .denge td.orta { background: var(--dikkat-zemin); } .denge td.orta small { color: var(--dikkat); }
  .denge td.kotu { background: var(--hata-zemin); } .denge td.kotu small { color: var(--hata); }
  .toplam th, .toplam td { font-weight: 700; border-top: 2px solid var(--cizgi); }
  .kisi-sec { max-width: 420px; }
  .cubuklar { padding: var(--b4); display: grid; gap: 6px; }
  .cubuk-satir { display: grid; grid-template-columns: minmax(110px, 180px) minmax(0, 1fr) 44px; align-items: center; gap: var(--b3); font-size: var(--f-sm); }
  .cubuk-satir .ad { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .iz { position: relative; height: 12px; background: var(--yuzey-2); border: 1px solid var(--cizgi-acik); }
  .iz i { position: absolute; inset: 0 auto 0 0; }
  .ecz { background: var(--ecz); } .tek { background: var(--tek); }
  .iz u { position: absolute; top: -4px; bottom: -4px; width: 2px; margin-left: -1px; background: var(--hata); }
  .deger { text-align: right; color: var(--yazi-2); }
  .lejant { display: flex; flex-wrap: wrap; gap: var(--b4); font-size: var(--f-xs); color: var(--soluk); margin-top: var(--b2); }
  .lejant span { display: inline-flex; align-items: center; gap: 6px; }
  .lejant i { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
  .lejant i.cizgi { width: 2px; height: 14px; background: var(--hata); border-radius: 0; }
</style>
