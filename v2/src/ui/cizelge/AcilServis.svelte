<script lang="ts">
  // Acil servis nöbet çizelgesi: acil servis eczacılarının nöbetleri elle girilir (günde en çok 2 kişi).
  // Puantajda bu günler nöbet (24 saat) sayılır; ertesi gün mesai günüyse nöbet izni (Nİ), tatilse çalışılmadı (B) yazılır.
  import { depo, aydaCalisanlar, acilGunu, acilGunuAyarla, acilAyiniSil, resmiTatilMi, tatilMi } from "../../veri/depo.svelte";
  import { acilDenetle } from "../../motor/cizelge.js";
  import { dosyaKaydet, hataMetni } from "../../disa/indir";
  import { GUN_KISA, GUN_UZUN, gunMetni, gunSayisi, haftaGunu, ayAdi } from "../../veri/tarih";
  import Ikon from "../ortak/Ikon.svelte";
  import Pencere from "../ortak/Pencere.svelte";

  let { git }: { git: (ad: "kisiler") => void } = $props();

  const y = $derived(depo.yil), m = $derived(depo.ay);
  const adaylar = $derived(aydaCalisanlar(y, m).filter(k => k.role === "servis").sort((a, b) => a.name.localeCompare(b.name, "tr")));
  const gunler = $derived(Array.from({ length: gunSayisi(y, m) }, (_, i) => i + 1));
  const ad = (id: number) => depo.veri.staff.find(k => k.id === id)?.name ?? "(silinmiş kişi)";
  const dolu = $derived(gunler.filter(g => acilGunu(y, m, g).length).length);
  const ozet = $derived.by(() => {
    const o = new Map<number, number[]>();
    for (const g of gunler) for (const id of acilGunu(y, m, g)) o.set(id, [...(o.get(id) ?? []), g]);
    return [...o.entries()].map(([id, l]) => ({ id, ad: ad(id), gunler: l, tatil: l.filter(g => tatilMi(y, m, g)).length })).sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
  });
  const bugun = new Date();
  const bugunMu = (d: number) => bugun.getFullYear() === y && bugun.getMonth() === m && bugun.getDate() === d;

  // gün penceresi
  let acik = $state(false), gun = $state(1), s1 = $state(""), s2 = $state("");
  function gunAc(g: number) { const l = acilGunu(y, m, g); gun = g; s1 = String(l[0] ?? ""); s2 = String(l[1] ?? ""); acik = true; }
  const secim = $derived([s1, s2].filter(Boolean).map(Number));
  const ayni = $derived(!!s1 && s1 === s2);
  const denetim = $derived(acik ? (acilDenetle($state.snapshot(depo.veri), y, m, gun, secim) as { sev: "hata" | "uyari"; t: string }[]).filter(x => x.sev !== "hata") : []);
  // seçenekler: o gün çalışma dönemi içinde olan acil servis eczacıları
  const gunAday = $derived(adaylar.filter(k => { const t = `${y}-${String(m + 1).padStart(2, "0")}-${String(gun).padStart(2, "0")}`; return !(k.baslangic && t < k.baslangic) && !(k.bitis && t > k.bitis); }));
  function kaydet() { if (ayni) return; acilGunuAyarla(y, m, gun, secim); acik = false; }
  function temizle() { acilGunuAyarla(y, m, gun, []); acik = false; }

  let silOnayi = $state(false), durum = $state("");
  $effect(() => { y; m; silOnayi = false; durum = ""; });
  function sil() { if (!silOnayi) { silOnayi = true; return; } acilAyiniSil(y, m); silOnayi = false; }
  const dosyaAdi = (uz: string) => `acil-servis-${y}-${String(m + 1).padStart(2, "0")}.${uz}`;
  async function cikti(tur: "xlsx" | "pdf") {
    durum = "";
    try {
      const { acilKitabi, acilPdf } = await import("../../disa/acilCikti");
      const veri = { y, m, kurum: depo.veri.kurum.ad, gunler: gunler.map(g => ({ gun: g, dw: haftaGunu(y, m, g), tatil: tatilMi(y, m, g), resmi: resmiTatilMi(y, m, g), adlar: acilGunu(y, m, g).map(ad) })), ozet };
      const blob = tur === "xlsx" ? acilKitabi(veri) : acilPdf(veri);
      const ok = await dosyaKaydet(dosyaAdi(tur), blob, tur === "pdf" ? "application/pdf" : blob.type);
      durum = ok ? (tur === "pdf" ? "PDF kaydedildi." : "Excel dosyası kaydedildi.") : "";
    } catch (e) { durum = hataMetni(e, "Dosya oluşturulamadı."); }
  }
</script>

{#if !adaylar.length && !dolu}
  <section class="kart bos">
    <h2>Acil servis eczacısı yok</h2>
    <p>Acil servis nöbetleri bu çizelgede elle girilir. Önce Personel bölümünde görevi "Acil servis eczacısı" olan kişileri ekleyin. Bu kişiler eczane nöbet çizelgesine yazılmaz; puantajda acil nöbetleri 24 saat, ertesi mesai günü nöbet izni olarak işlenir.</p>
    <div><button class="dugme ana" onclick={() => git("kisiler")}><Ikon ad="kisiler" />Personel ekle</button></div>
  </section>
{:else}
  <div class="arac">
    <div class="durumlar">
      <span class="rozet notr rakam">{dolu}/{gunler.length} gün girildi</span>
      <span class="rozet notr rakam">{adaylar.length} acil servis eczacısı</span>
    </div>
    <div class="dugmeler">
      {#if dolu}
        <button class="dugme" onclick={() => cikti("pdf")}><Ikon ad="indir" />PDF</button>
        <button class="dugme" onclick={() => cikti("xlsx")}><Ikon ad="indir" />Excel</button>
        <button class="dugme sade tehlike" onclick={sil}><Ikon ad="sil" />{silOnayi ? "Evet, ayın acil nöbetlerini sil" : "Sil"}</button>
      {/if}
    </div>
  </div>
  <p class="aciklama">Bir güne dokunup o günün acil servis nöbetçilerini seçin (en çok 2 kişi). Puantajda bu günler nöbet (24 saat) sayılır; ertesi gün mesai günüyse nöbet izni yazılır.</p>
  {#if durum}<p class="bant" role="status">{durum}</p>{/if}

  <section class="kart takvim-kutu" aria-label="{ayAdi(y, m)} acil servis nöbetleri">
    <div class="takvim">
      {#each GUN_KISA as g}<div class="bas" aria-hidden="true">{g}</div>{/each}
      {#each { length: haftaGunu(y, m, 1) } as _}<div class="bosluk" aria-hidden="true"></div>{/each}
      {#each gunler as g (g)}
        {@const l = acilGunu(y, m, g)}
        <button class="gun" class:tatil={tatilMi(y, m, g)} class:bugun={bugunMu(g)} class:dolu={l.length} onclick={() => gunAc(g)}
          aria-label="{gunMetni(y, m, g)}: acil servis nöbetçisi {l.map(ad).join(' ve ') || 'yok'}">
          <span class="ust"><span class="no rakam">{g}</span><span class="gunadi">{GUN_UZUN[haftaGunu(y, m, g)]}</span>{#if resmiTatilMi(y, m, g)}<span class="etiket">Resmi tatil</span>{/if}</span>
          <span class="kisiler">
            {#each l as id}<span class="kisi"><span class="isaret servis"></span>{ad(id)}</span>{:else}<span class="yok">Nöbetçi yok</span>{/each}
          </span>
        </button>
      {/each}
    </div>
  </section>

  <section class="blok">
    <h2>Kişi özeti</h2>
    {#if ozet.length}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex (kaydırılan tablo klavyeyle kaydırılabilsin: WCAG 2.1.1) -->
      <div class="kart tablo-kap" tabindex="0" role="region" aria-label="Acil servis kişi özeti">
        <table>
          <thead><tr><th class="sol" scope="col">Ad soyad</th><th scope="col">Nöbet</th><th scope="col">Hafta sonu / tatil</th><th class="sol" scope="col">Nöbet günleri</th></tr></thead>
          <tbody>
            {#each ozet as o (o.id)}<tr><th class="sol" scope="row">{o.ad}</th><td class="rakam vurgu">{o.gunler.length}</td><td class="rakam">{o.tatil}</td><td class="sol rakam">{o.gunler.join(", ")}</td></tr>{/each}
          </tbody>
        </table>
      </div>
    {:else}
      <p class="aciklama">Bu ay için henüz acil servis nöbeti girilmedi.</p>
    {/if}
  </section>
{/if}

<Pencere bind:acik baslik={gunMetni(y, m, gun)} altBaslik="Acil servis nöbeti · en çok 2 kişi">
  {#if !gunAday.length}<p class="not">Bu gün çalışan acil servis eczacısı yok.</p>{/if}
  <div class="iki">
    <label class="alan"><span>1. nöbetçi</span><select class="girdi" bind:value={s1}><option value="">Seçilmedi</option>{#each gunAday as k}<option value={String(k.id)}>{k.name}</option>{/each}</select></label>
    <label class="alan"><span>2. nöbetçi</span><select class="girdi" bind:value={s2}><option value="">Seçilmedi</option>{#each gunAday as k}<option value={String(k.id)}>{k.name}</option>{/each}</select></label>
  </div>
  {#if ayni}<p class="not hata" role="alert">Aynı kişi iki kez seçilemez.</p>
  {:else if denetim.length}
    <div class="denetim" aria-live="polite">{#each denetim as x}<p class="satir"><Ikon ad="uyari" boyut={15} /><span>{x.t}</span></p>{/each}</div>
  {/if}
  {#snippet altlik()}
    {#if acilGunu(y, m, gun).length}<button class="dugme sade" onclick={temizle}>Günü temizle</button>{/if}
    <span style="flex:1"></span>
    <button class="dugme" onclick={() => (acik = false)}>Vazgeç</button>
    <button class="dugme ana" onclick={kaydet} disabled={ayni}>Kaydet</button>
  {/snippet}
</Pencere>

<style>
  .bos { padding: var(--b5); display: grid; gap: var(--b3); max-width: 760px; }
  .bos p { color: var(--yazi-2); }
  .arac { display: flex; flex-wrap: wrap; gap: var(--b3); align-items: center; justify-content: space-between; margin-bottom: var(--b2); }
  .durumlar, .dugmeler { display: flex; flex-wrap: wrap; gap: var(--b2); align-items: center; }
  .aciklama { font-size: var(--f-sm); color: var(--soluk); margin-bottom: var(--b3); max-width: 80ch; }
  .bant { padding: var(--b2) var(--b4); border-radius: var(--r); margin-bottom: var(--b3); font-size: var(--f-sm); font-weight: 500; background: var(--vurgu-zemin); color: var(--vurgu); }
  .takvim-kutu { padding: var(--b3); }
  .takvim { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
  .bas { text-align: center; font-size: var(--f-xs); font-weight: 600; color: var(--soluk); padding-bottom: 2px; }
  .gun { display: flex; flex-direction: column; gap: 6px; min-height: 84px; padding: 8px 9px; text-align: left; border: 1px solid var(--cizgi); border-radius: var(--r-kucuk); background: var(--yuzey); cursor: pointer; min-width: 0; }
  .gun:hover { border-color: var(--soluk); }
  .gun.tatil { background: var(--tatil-zemin); }
  .gun.dolu { border-left: 3px solid var(--acil); }
  .gun.bugun { box-shadow: inset 0 0 0 2px var(--odak); }
  .ust { display: flex; align-items: center; gap: 6px; }
  .no { font-weight: 600; font-size: var(--f-sm); color: var(--yazi-2); }
  .gunadi { display: none; }
  .etiket { font-size: var(--f-xs); font-weight: 600; color: var(--tatil); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .kisiler { display: grid; gap: 2px; min-width: 0; }
  .kisi { display: flex; align-items: baseline; gap: 6px; font-size: 13px; font-weight: 500; overflow-wrap: anywhere; min-width: 0; }
  .kisi .isaret { transform: translateY(-1px) rotate(45deg) scale(.85); }
  .yok { font-size: var(--f-xs); color: var(--soluk); }
  .blok { margin-top: var(--b5); display: grid; gap: var(--b2); }
  .blok h2 { font-size: var(--f-lg); }
  .tablo-kap { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; font-size: var(--f-sm); }
  th, td { padding: 8px 12px; border-bottom: 1px solid var(--cizgi-acik); text-align: right; white-space: nowrap; }
  thead th { font-size: var(--f-xs); color: var(--soluk); font-weight: 600; background: var(--yuzey-2); }
  tbody th { font-weight: 500; }
  .sol { text-align: left; }
  td.sol { white-space: normal; }
  .vurgu { font-weight: 600; color: var(--acil); }
  tbody tr:last-child > * { border-bottom: 0; }
  .iki { display: grid; grid-template-columns: 1fr 1fr; gap: var(--b3); }
  .denetim { display: grid; gap: 6px; }
  .satir { display: flex; gap: var(--b2); align-items: flex-start; font-size: var(--f-sm); padding: 6px 10px; border-radius: var(--r-kucuk); background: var(--dikkat-zemin); }
  .satir :global(svg) { flex: none; margin-top: 2px; color: var(--dikkat); }
  .not { padding: var(--b2) var(--b3); border-radius: var(--r-kucuk); font-size: var(--f-sm); font-weight: 500; background: var(--yuzey-2); color: var(--yazi-2); }
  .not.hata { background: var(--hata-zemin); color: var(--hata); }

  @media (max-width: 720px) {
    .takvim-kutu { padding: 0; overflow: hidden; }
    .takvim { grid-template-columns: 1fr; gap: 0; }
    .bas, .bosluk { display: none; }
    .gun { flex-direction: row; align-items: center; min-height: 0; padding: 10px 12px; border-radius: 0; border-width: 0 0 1px; gap: 12px; }
    .gun.dolu { border-left-width: 3px; }
    .ust { flex-direction: column; align-items: flex-start; gap: 0; width: 76px; flex: none; }
    .no { font-size: var(--f-lg); color: var(--yazi); }
    .gunadi { display: block; font-size: var(--f-xs); color: var(--soluk); }
    .kisiler { flex: 1; }
    .kisi { font-size: var(--f-sm); }
    .iki { grid-template-columns: 1fr; }
  }
</style>
