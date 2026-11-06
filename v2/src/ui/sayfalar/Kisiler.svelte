<script lang="ts">
  import SayfaBasligi from "../ortak/SayfaBasligi.svelte";
  import { depo, kisiEkle, kisiGuncelle, kisiSil, onayliGoreviVar } from "../../veri/depo.svelte";
  import { ROL_ACIKLAMA, ROL_AD, type Kisi, type Rol } from "../../veri/tipler";
  import { AYLAR, gorunenAd } from "../../veri/tarih";
  import Ikon from "../ortak/Ikon.svelte";
  import Pencere from "../ortak/Pencere.svelte";

  // gomulu: Ayarlar > Personel sekmesi olarak (başlık üst sayfada)
  let { gomulu = false }: { gomulu?: boolean } = $props();
  const ROLLER: Rol[] = ["eczaci", "teknisyen", "destek", "nobetci", "servis"];
  let yeniAd = $state("");
  let yeniRol = $state<Rol>("eczaci");
  let ekleHata = $state("");

  function ekle(e: SubmitEvent) {
    e.preventDefault();
    const ad = yeniAd.trim();
    if (!ad) { ekleHata = "Ad soyad yazın."; return; }
    if (depo.veri.staff.some(k => k.name.toLocaleLowerCase("tr") === ad.toLocaleLowerCase("tr"))) { ekleHata = "Bu adda bir kişi zaten var."; return; }
    kisiEkle(gorunenAd(ad), yeniRol);
    yeniAd = ""; ekleHata = "";
  }

  const gruplar = $derived(ROLLER.map(r => ({ rol: r, kisiler: depo.veri.staff.filter(k => k.role === r).sort((a, b) => a.name.localeCompare(b.name, "tr")) })));

  // düzenleme penceresi
  let duzenleAcik = $state(false);
  let duzenlenen = $state<Kisi | null>(null);
  let dAd = $state(""), dRol = $state<Rol>("eczaci"), dBas = $state(""), dBit = $state(""), dCuma = $state(false), dAcil = $state(false), dHata = $state("");
  function duzenle(k: Kisi) {
    duzenlenen = k; dAd = k.name; dRol = k.role; dBas = k.baslangic ?? ""; dBit = k.bitis ?? ""; dCuma = !!k.cumaMuaf; dAcil = !!k.acilTutar; dHata = ""; silOnayi = false;
    duzenleAcik = true;
  }
  function kaydet() {
    if (!duzenlenen) return;
    const ad = dAd.trim();
    if (!ad) { dHata = "Ad soyad boş olamaz."; return; }
    if (dBas && dBit && dBit < dBas) { dHata = "Ayrılış tarihi işe başlama tarihinden önce olamaz."; return; }
    kisiGuncelle(duzenlenen.id, { name: gorunenAd(ad), role: dRol, baslangic: dBas || undefined, bitis: dBit || undefined, cumaMuaf: dCuma && (dRol === "eczaci" || dRol === "teknisyen") ? true : undefined, acilTutar: dAcil && (dRol === "eczaci" || dRol === "nobetci") ? true : undefined });
    duzenleAcik = false;
  }
  let silOnayi = $state(false);
  const onayliAylar = $derived(duzenlenen ? onayliGoreviVar(duzenlenen.id) : []);
  function sil() {
    if (!duzenlenen) return;
    if (!silOnayi) { silOnayi = true; return; }
    if (!kisiSil(duzenlenen.id)) return;   // onaylı aylarda kaydı var: silinmez
    duzenleAcik = false;
  }
  // hızlı anahtarlar: Cuma muafı (eczacı, tekniker) ve acil eczane nöbeti (eczacı, kemoterapi eczacısı)
  const cumaOlur = (r: Rol) => r === "eczaci" || r === "teknisyen";
  const acilOlur = (r: Rol) => r === "eczaci" || r === "nobetci";
  // sürükle-bırak: kişiyi başka görev sütununa bırakmak görevini değiştirir (geri al ile dönülür)
  let surukId = $state<number | null>(null), hedefRol = $state<Rol | null>(null);
  function birak(r: Rol) {
    const k = depo.veri.staff.find(x => x.id === surukId);
    if (k && k.role !== r) kisiGuncelle(k.id, { role: r, cumaMuaf: k.cumaMuaf && cumaOlur(r) ? true : undefined });
    surukId = null; hedefRol = null;
  }
  const tarihMetni = (t?: string) => { if (!t) return ""; const [y, m, d] = t.split("-").map(Number); return `${d} ${AYLAR[m - 1]} ${y}`; };
</script>

{#if !gomulu}<SayfaBasligi konum={["Personel"]} baslik="Personel" aciklama="Nöbet ve hazırlama tutan herkes. İşe yeni başlayan ya da ayrılan kişinin tarihlerini girin; o tarihlerin dışında görev yazılmaz." />{/if}

<form class="kart ekle" onsubmit={ekle}>
  <label class="alan ad"><span>Ad soyad</span><input class="girdi" bind:value={yeniAd} maxlength="60" autocomplete="off" placeholder="ör. Zeynep Demir" /></label>
  <label class="alan"><span>Görev</span>
    <select class="girdi" bind:value={yeniRol}>{#each ROLLER as r}<option value={r}>{ROL_AD[r]}</option>{/each}</select>
  </label>
  <button class="dugme ana" type="submit"><Ikon ad="arti" />Ekle</button>
  <p class="aciklama">{ROL_ACIKLAMA[yeniRol]}</p>
  {#if ekleHata}<p class="hata" role="alert">{ekleHata}</p>{/if}
</form>

<p class="ipucu ust">Kişiyi ⋮⋮ tutamağından başka bir görev sütununa sürükleyerek görevini değiştirin; anahtarlarla özel durumları açıp kapatın. Ad ve tarihler için ✎.</p>
<div class="gruplar">
  {#each gruplar as g}
    {#if g.kisiler.length || g.rol === "eczaci" || g.rol === "teknisyen"}
      <section class="panel grup" class:hedef={hedefRol === g.rol} aria-label={ROL_AD[g.rol]}
        ondragover={e => { if (surukId !== null) { e.preventDefault(); hedefRol = g.rol; } }}
        ondragleave={() => { if (hedefRol === g.rol) hedefRol = null; }}
        ondrop={e => { e.preventDefault(); birak(g.rol); }}>
        <div class="panel-bas"><h2><span class="isaret {g.rol}"></span>{ROL_AD[g.rol]}</h2><span class="sayi rakam">{g.kisiler.length}</span></div>
        {#if g.kisiler.length}
          <ul>
            {#each g.kisiler as k (k.id)}
              <li class:suruklenen={surukId === k.id}>
                <span class="tutamak" draggable="true" role="button" tabindex="-1" aria-label="{k.name}: sürükleyerek görevini değiştir" title="Sürükleyerek görevini değiştirin"
                  ondragstart={e => { surukId = k.id; e.dataTransfer?.setData("text/plain", String(k.id)); }} ondragend={() => { surukId = null; hedefRol = null; }}>⋮⋮</span>
                <div class="kim">
                  <b>{k.name}</b>
                  {#if k.baslangic || k.bitis}<small>{k.baslangic ? "Başlangıç " + tarihMetni(k.baslangic) : ""}{k.baslangic && k.bitis ? " · " : ""}{k.bitis ? "Ayrılış " + tarihMetni(k.bitis) : ""}</small>{/if}
                </div>
                {#if cumaOlur(k.role)}
                  <label class="anahtar" title="Öğlen nöbetinde Cuma'dan muaf"><input type="checkbox" checked={!!k.cumaMuaf} onchange={e => kisiGuncelle(k.id, { cumaMuaf: e.currentTarget.checked ? true : undefined })} /><i aria-hidden="true"></i>Cuma muaf</label>
                {/if}
                {#if acilOlur(k.role)}
                  <label class="anahtar" title="Eczane nöbeti yerine acil eczane nöbeti tutar"><input type="checkbox" checked={!!k.acilTutar} onchange={e => kisiGuncelle(k.id, { acilTutar: e.currentTarget.checked ? true : undefined })} /><i aria-hidden="true"></i>Acilde</label>
                {/if}
                <button class="dugme sade kucuk duz" onclick={() => duzenle(k)} aria-label="{k.name}: düzenle" title="Ad, görev ve tarihler"><Ikon ad="duzenle" /></button>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="bos">{surukId !== null ? "Buraya bırakın" : `Henüz ${ROL_AD[g.rol].toLocaleLowerCase("tr")} eklenmedi.`}</p>
        {/if}
      </section>
    {/if}
  {/each}
</div>
<p class="ipucu">Destek personeli, kemoterapi eczacısı ya da acil servis personeli eklediğinizde kendi grupları burada görünür.</p>

<Pencere bind:acik={duzenleAcik} baslik={duzenlenen ? duzenlenen.name : ""} altBaslik="Bilgileri düzenle">
  <label class="alan"><span>Ad soyad</span><input class="girdi" bind:value={dAd} maxlength="60" /></label>
  <label class="alan"><span>Görev</span><select class="girdi" bind:value={dRol}>{#each ROLLER as r}<option value={r}>{ROL_AD[r]}</option>{/each}</select><small>{ROL_ACIKLAMA[dRol]}</small></label>
  <div class="iki">
    <label class="alan"><span>İşe başlama</span><input class="girdi" type="date" bind:value={dBas} /><small>Boş: her zaman çalışıyor</small></label>
    <label class="alan"><span>Ayrılış (son gün)</span><input class="girdi" type="date" bind:value={dBit} /><small>Ayrılan kişiyi silmek yerine bu tarihi girin</small></label>
  </div>
  {#if dRol === "eczaci" || dRol === "teknisyen"}
    <label class="secim"><input type="checkbox" bind:checked={dCuma} /><span>Cuma günleri öğlen nöbeti tutmaz (Cuma'dan muaf)</span></label>
  {/if}
  {#if dRol === "eczaci" || dRol === "nobetci"}
    <fieldset class="yer">
      <legend>Nöbet tuttuğu yer</legend>
      <label class="secim"><input type="radio" name="nobetYeri" checked={!dAcil} onchange={() => (dAcil = false)} /><span>Günlük eczane</span></label>
      <label class="secim"><input type="radio" name="nobetYeri" checked={dAcil} onchange={() => (dAcil = true)} /><span>Acil eczane</span></label>
    </fieldset>
  {/if}
  {#if dHata}<p class="hata" role="alert">{dHata}</p>{/if}
  {#if silOnayi}
    <div class="sil-uyari" role="alert">
      {#if onayliAylar.length}
        <b>Bu kişi silinemez:</b> onaylı aylarda kaydı var ({onayliAylar.map(k => { const [y, m] = k.split("-").map(Number); return `${AYLAR[m]} ${y}`; }).join(", ")}). Onaylı kayıtlar korunur. Kişi ayrıldıysa ayrılış tarihini girin; sonraki çizelgelere yazılmaz.
      {:else}
        <b>{duzenlenen?.name} silinsin mi?</b> İzin işaretleri ve onaysız aylardaki görevleri de silinir.
      {/if}
    </div>
  {/if}
  {#snippet altlik()}
    {#if !(silOnayi && onayliAylar.length)}<button class="dugme tehlike" onclick={sil}><Ikon ad="sil" />{silOnayi ? "Evet, sil" : "Sil"}</button>{/if}
    <span style="flex:1"></span>
    <button class="dugme" onclick={() => (duzenleAcik = false)}>Vazgeç</button>
    <button class="dugme ana" onclick={kaydet}>Kaydet</button>
  {/snippet}
</Pencere>

<style>
  .ekle { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) auto; gap: var(--b3); align-items: end; padding: var(--b4); margin-bottom: var(--b5); }
  .ekle .aciklama { grid-column: 1 / -1; font-size: var(--f-sm); color: var(--soluk); }
  .hata { grid-column: 1 / -1; color: var(--hata); font-size: var(--f-sm); font-weight: 500; }
  .gruplar { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: var(--b4); align-items: start; }
  .grup.hedef { box-shadow: 0 0 0 3px var(--altin); }
  .grup h2 { display: flex; align-items: center; gap: var(--b2); }
  .sayi { margin-left: auto; font-size: var(--f-sm); color: var(--soluk); font-weight: 600; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; }
  li { display: flex; align-items: center; gap: var(--b2); padding: 6px var(--b3); border-top: 1px solid var(--cizgi-acik); }
  li:first-child { border-top: 0; }
  li.suruklenen { opacity: .45; }
  .tutamak { color: var(--soluk); cursor: grab; font-size: 12px; letter-spacing: -2px; padding: 4px 2px; user-select: none; }
  .anahtar { display: inline-flex; align-items: center; gap: 5px; font-size: var(--f-xs); font-weight: 600; color: var(--soluk); cursor: pointer; white-space: nowrap; }
  .anahtar input { position: absolute; opacity: 0; width: 1px; height: 1px; }
  .anahtar i { position: relative; width: 28px; height: 16px; border-radius: 8px; background: var(--cizgi); transition: background .15s; flex: none; }
  .anahtar i::after { content: ""; position: absolute; left: 2px; top: 2px; width: 12px; height: 12px; border-radius: 50%; background: #FFFFFF; transition: left .15s; }
  .anahtar:has(input:checked) { color: var(--lacivert); }
  .anahtar:has(input:checked) i { background: var(--lacivert); }
  .anahtar:has(input:checked) i::after { left: 14px; }
  .anahtar:has(input:focus-visible) i { outline: 2px solid var(--odak); outline-offset: 2px; }
  .duz { padding: 4px 6px; }
  .ust { margin: 0 0 var(--b3); }
  .bos { padding: var(--b3) var(--b4); }
  .kim { flex: 1; min-width: 0; }
  .kim b { font-weight: 500; display: block; }
  .kim small { color: var(--soluk); font-size: var(--f-xs); }
  .bos { color: var(--soluk); font-size: var(--f-sm); }
  .ipucu { margin-top: var(--b4); font-size: var(--f-sm); color: var(--soluk); }
  .iki { display: grid; grid-template-columns: 1fr 1fr; gap: var(--b3); }
  .sil-uyari { background: var(--hata-zemin); color: var(--yazi); border-radius: var(--r); padding: var(--b3) var(--b4); font-size: var(--f-sm); }
  .sil-uyari b { color: var(--hata); }
  @media (max-width: 640px) {
    .ekle { grid-template-columns: 1fr; }
    .iki { grid-template-columns: 1fr; }
  }
  .secim { display: flex; align-items: center; gap: var(--b2); min-height: 32px; cursor: pointer; font-size: var(--f-sm); }
  .secim input { width: 18px; height: 18px; accent-color: var(--vurgu); }
  .yer { border: 0; padding: 0; margin: 0; display: grid; gap: 2px; }
  .yer legend { font-size: var(--f-sm); font-weight: 600; color: var(--yazi-2); margin-bottom: 2px; }
</style>
