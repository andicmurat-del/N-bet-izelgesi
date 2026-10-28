<script lang="ts">
  // Servis listesi: zorluk (10 üzerinden), hasta sayısı, çok günlük, hazırlanıyor mu; elle servis ekleme.
  // Değişiklik bugünden sonraki günlerin dağıtımına uygulanır, geçmiş kayıtlar değişmez.
  import { servisler, servisAyariYaz, servisEkle, servisSil, servisAyarlariniSifirla, type ServisBilgisi } from "../../veri/servis.svelte";
  import { SERVIS_ZOR_ESIK } from "../../motor";
  import Ikon from "../ortak/Ikon.svelte";

  const L = $derived(servisler());
  let ara = $state("");
  const gorunen = $derived([...L].sort((a, b) => a.name.localeCompare(b.name, "tr")).filter(s => !ara.trim() || s.name.toLocaleUpperCase("tr").includes(ara.trim().toLocaleUpperCase("tr"))));
  const ozet = $derived({ acik: L.filter(s => s.on).length, yb: L.filter(s => s.on && s.yb).length, cok: L.filter(s => s.on && s.multi).length });

  const sinirla = (v: number, a: number, b: number) => Math.max(a, Math.min(b, Math.round(v) || a));
  function degistir(s: ServisBilgisi, alan: "z" | "h" | "multi" | "on", deger: number | boolean) {
    const y = { name: s.name, z: s.z, h: s.h, multi: s.multi, on: s.on, [alan]: deger };
    y.z = sinirla(y.z, 1, 10); y.h = sinirla(y.h, 0, 999);
    servisAyariYaz(y);
  }

  let yeniAd = $state(""), yeniZ = $state(5), yeniH = $state(10), yeniCok = $state(false), hata = $state(""), durum = $state("");
  function ekle(e: SubmitEvent) {
    e.preventDefault();
    const h = servisEkle(yeniAd, yeniZ, yeniH, yeniCok);
    if (h) { hata = h; return; }
    durum = `${yeniAd.trim().toLocaleUpperCase("tr")} eklendi.${/\sYB$/i.test(yeniAd.trim()) ? " Adı YB ile bittiği için yoğun bakım servisi sayılır." : ""}`;
    yeniAd = ""; yeniCok = false; hata = "";
  }
  let silinecek = $state<string | null>(null), sifirOnay = $state(false);
  function sil(s: ServisBilgisi) { if (silinecek !== s.name) { silinecek = s.name; return; } servisSil(s.name); silinecek = null; durum = `${s.name} silindi; geçmiş kayıtlarda adı kalır.`; }
  function sifirla() { if (!sifirOnay) { sifirOnay = true; return; } servisAyarlariniSifirla(); sifirOnay = false; durum = "Servis ayarları ilk haline döndü."; }
</script>

<p class="aciklama">Zorluk 10 üzerinden puanlanır (1 kolay, 10 en zor); zorluğu {SERVIS_ZOR_ESIK} ve üstü olan servisler <b>zor servis</b> sayılır ve her gün teknikerlere eşit bölünür. Günlük yük = hasta sayısı × zorluk; çok günlük servislerde gün sayısıyla çarpılır. İşareti kaldırılan servis hazırlanmaz. Adı "YB" ile biten servis yoğun bakım sayılır; YB servisleri de kişi başı eşit bölünür. Değişiklik bugünden sonraki günlere uygulanır, geçmiş kayıtlar değişmez.</p>

<div class="ust">
  <span class="rozet notr rakam">{ozet.acik} / {L.length} servis hazırlanıyor · {ozet.yb} YB · {ozet.cok} çok günlük</span>
  <div class="sag">
    <input class="girdi ara" type="search" bind:value={ara} placeholder="Servis ara" aria-label="Servis ara" />
    <button class="dugme sade" onclick={sifirla}>{sifirOnay ? "Evet, ilk haline döndür" : "İlk haline döndür"}</button>
  </div>
</div>
{#if durum}<p class="bant" role="status">{durum}</p>{/if}

<!-- svelte-ignore a11y_no_noninteractive_tabindex (kaydırılan tablo klavyeyle kaydırılabilsin: WCAG 2.1.1) -->
<div class="kart tablo-kap" tabindex="0" role="region" aria-label="Servis listesi">
  <table>
    <thead><tr><th class="sol" scope="col">Servis</th><th scope="col">Zorluk</th><th scope="col">Hasta</th><th scope="col">Çok günlük</th><th scope="col">Günlük yük</th><th scope="col"><span class="gizli">İşlem</span></th></tr></thead>
    <tbody>
      {#each gorunen as s (s.name)}
        <tr class:kapali={!s.on}>
          <th class="sol" scope="row">
            <label class="ad"><input type="checkbox" checked={s.on} onchange={e => degistir(s, "on", e.currentTarget.checked)} aria-label="{s.name} hazırlanıyor" />{s.name}</label>
            {#if s.ekstra}<small class="etk">eklendi</small>{:else if s.z !== s.z0 || s.h !== s.h0 || s.multi !== s.multi0}<small class="etk">değişti</small>{/if}
            {#if s.zor}<small class="etk zor">zor</small>{/if}{#if s.grup}<small class="etk" title="Aynı gruptaki servisler aynı kişiye birlikte verilmez">grup</small>{/if}
          </th>
          <td><input class="girdi sayi" type="number" min="1" max="10" value={s.z} onchange={e => degistir(s, "z", Number(e.currentTarget.value))} aria-label="{s.name} zorluk" /></td>
          <td><input class="girdi sayi" type="number" min="0" max="999" value={s.h} onchange={e => degistir(s, "h", Number(e.currentTarget.value))} aria-label="{s.name} hasta sayısı" /></td>
          <td><input type="checkbox" checked={s.multi} onchange={e => degistir(s, "multi", e.currentTarget.checked)} aria-label="{s.name} çok günlük" /></td>
          <td class="rakam">{s.h * s.z}</td>
          <td>{#if s.ekstra}<button class="dugme kucuk sade tehlike" onclick={() => sil(s)}>{silinecek === s.name ? "Evet, sil" : "Sil"}</button>{/if}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<form class="kart yeni" onsubmit={ekle}>
  <h2>Servis ekle</h2>
  <div class="alanlar">
    <label class="alan genis"><span>Servis adı</span><input class="girdi" bind:value={yeniAd} maxlength="40" placeholder="ör. ONKOLOJİ ya da ÇOCUK YB" /></label>
    <label class="alan"><span>Zorluk (1–10)</span><input class="girdi" type="number" min="1" max="10" bind:value={yeniZ} /></label>
    <label class="alan"><span>Hasta sayısı</span><input class="girdi" type="number" min="0" max="999" bind:value={yeniH} /></label>
    <label class="secim"><input type="checkbox" bind:checked={yeniCok} />Çok günlük</label>
    <button class="dugme ana" type="submit"><Ikon ad="arti" />Ekle</button>
  </div>
  {#if hata}<p class="hata" role="alert">{hata}</p>{/if}
</form>

<style>
  .aciklama { font-size: var(--f-sm); color: var(--yazi-2); margin-bottom: var(--b3); max-width: 90ch; }
  .ust { display: flex; flex-wrap: wrap; gap: var(--b3); align-items: center; justify-content: space-between; margin-bottom: var(--b3); }
  .sag { display: flex; flex-wrap: wrap; gap: var(--b2); }
  .ara { width: 220px; }
  .bant { padding: var(--b2) var(--b4); border-radius: var(--r); margin-bottom: var(--b3); font-size: var(--f-sm); font-weight: 500; background: var(--vurgu-zemin); color: var(--vurgu); }
  .tablo-kap { overflow-x: auto; max-height: 70vh; overflow-y: auto; }
  table { border-collapse: collapse; width: 100%; font-size: var(--f-sm); }
  th, td { padding: 6px 12px; border-bottom: 1px solid var(--cizgi-acik); text-align: center; white-space: nowrap; }
  thead th { position: sticky; top: 0; z-index: 1; background: var(--yuzey-2); font-size: var(--f-xs); color: var(--soluk); font-weight: 600; }
  .sol { text-align: left; }
  tbody th { font-weight: 500; }
  .ad { display: inline-flex; align-items: center; gap: var(--b2); cursor: pointer; }
  input[type="checkbox"] { width: 18px; height: 18px; accent-color: var(--vurgu); }
  .sayi { width: 72px; min-height: 32px; padding: 2px 8px; text-align: center; }
  .etk { margin-left: 6px; font-size: var(--f-xs); color: var(--soluk); font-weight: 600; }
  .etk.zor { color: var(--haz); }
  tr.kapali th, tr.kapali td { color: var(--soluk); }
  tr.kapali .ad { text-decoration: line-through; }
  .gizli { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  .yeni { padding: var(--b4); margin-top: var(--b4); display: grid; gap: var(--b3); }
  .yeni h2 { font-size: var(--f-lg); }
  .alanlar { display: flex; flex-wrap: wrap; gap: var(--b3); align-items: flex-end; }
  .alanlar .alan { width: 130px; }
  .alanlar .genis { width: auto; flex: 1; min-width: 220px; }
  .secim { display: inline-flex; align-items: center; gap: var(--b2); min-height: 40px; cursor: pointer; }
  .hata { color: var(--hata); font-size: var(--f-sm); font-weight: 500; }
  @media (max-width: 480px) { .ara { width: 100%; } .sag { width: 100%; } }
</style>
