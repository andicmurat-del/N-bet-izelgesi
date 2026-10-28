<script lang="ts">
  import { depo, kisiEkle, kisiGuncelle, kisiSil, onayliGoreviVar } from "../../veri/depo.svelte";
  import { ROL_ACIKLAMA, ROL_AD, type Kisi, type Rol } from "../../veri/tipler";
  import { AYLAR, gorunenAd } from "../../veri/tarih";
  import Ikon from "../ortak/Ikon.svelte";
  import Pencere from "../ortak/Pencere.svelte";

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
  let dAd = $state(""), dRol = $state<Rol>("eczaci"), dBas = $state(""), dBit = $state(""), dHata = $state("");
  function duzenle(k: Kisi) {
    duzenlenen = k; dAd = k.name; dRol = k.role; dBas = k.baslangic ?? ""; dBit = k.bitis ?? ""; dHata = ""; silOnayi = false;
    duzenleAcik = true;
  }
  function kaydet() {
    if (!duzenlenen) return;
    const ad = dAd.trim();
    if (!ad) { dHata = "Ad soyad boş olamaz."; return; }
    if (dBas && dBit && dBit < dBas) { dHata = "Ayrılış tarihi işe başlama tarihinden önce olamaz."; return; }
    kisiGuncelle(duzenlenen.id, { name: gorunenAd(ad), role: dRol, baslangic: dBas || undefined, bitis: dBit || undefined });
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
  const tarihMetni = (t?: string) => { if (!t) return ""; const [y, m, d] = t.split("-").map(Number); return `${d} ${AYLAR[m - 1]} ${y}`; };
</script>

<header class="sayfa-bas">
  <div>
    <h1>Personel</h1>
    <p>Nöbet ve hazırlama tutan herkes. İşe yeni başlayan ya da ayrılan kişinin tarihlerini girin; o tarihlerin dışında görev yazılmaz.</p>
  </div>
</header>

<form class="kart ekle" onsubmit={ekle}>
  <label class="alan ad"><span>Ad soyad</span><input class="girdi" bind:value={yeniAd} maxlength="60" autocomplete="off" placeholder="ör. Zeynep Demir" /></label>
  <label class="alan"><span>Görev</span>
    <select class="girdi" bind:value={yeniRol}>{#each ROLLER as r}<option value={r}>{ROL_AD[r]}</option>{/each}</select>
  </label>
  <button class="dugme ana" type="submit"><Ikon ad="arti" />Ekle</button>
  <p class="aciklama">{ROL_ACIKLAMA[yeniRol]}</p>
  {#if ekleHata}<p class="hata" role="alert">{ekleHata}</p>{/if}
</form>

<div class="gruplar">
  {#each gruplar as g}
    {#if g.kisiler.length || g.rol === "eczaci" || g.rol === "teknisyen"}
      <section class="kart grup">
        <h2><span class="isaret {g.rol}"></span>{ROL_AD[g.rol]}<span class="sayi rakam">{g.kisiler.length}</span></h2>
        {#if g.kisiler.length}
          <ul>
            {#each g.kisiler as k (k.id)}
              <li>
                <div class="kim">
                  <b>{k.name}</b>
                  {#if k.baslangic || k.bitis}<small>{k.baslangic ? "Başlangıç " + tarihMetni(k.baslangic) : ""}{k.baslangic && k.bitis ? " · " : ""}{k.bitis ? "Ayrılış " + tarihMetni(k.bitis) : ""}</small>{/if}
                </div>
                <button class="dugme sade kucuk" onclick={() => duzenle(k)} aria-label="{k.name}: düzenle"><Ikon ad="duzenle" />Düzenle</button>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="bos">Henüz {ROL_AD[g.rol].toLocaleLowerCase("tr")} eklenmedi.</p>
        {/if}
      </section>
    {/if}
  {/each}
</div>
<p class="ipucu">Destek personeli ya da dışarıdan nöbetçi eczacı eklediğinizde kendi grupları burada görünür.</p>

<Pencere bind:acik={duzenleAcik} baslik={duzenlenen ? duzenlenen.name : ""} altBaslik="Bilgileri düzenle">
  <label class="alan"><span>Ad soyad</span><input class="girdi" bind:value={dAd} maxlength="60" /></label>
  <label class="alan"><span>Görev</span><select class="girdi" bind:value={dRol}>{#each ROLLER as r}<option value={r}>{ROL_AD[r]}</option>{/each}</select><small>{ROL_ACIKLAMA[dRol]}</small></label>
  <div class="iki">
    <label class="alan"><span>İşe başlama</span><input class="girdi" type="date" bind:value={dBas} /><small>Boş: her zaman çalışıyor</small></label>
    <label class="alan"><span>Ayrılış (son gün)</span><input class="girdi" type="date" bind:value={dBit} /><small>Ayrılan kişiyi silmek yerine bu tarihi girin</small></label>
  </div>
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
  .sayfa-bas { margin-bottom: var(--b5); }
  .sayfa-bas p { color: var(--yazi-2); max-width: 64ch; margin-top: var(--b2); }
  .ekle { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) auto; gap: var(--b3); align-items: end; padding: var(--b4); margin-bottom: var(--b5); }
  .ekle .aciklama { grid-column: 1 / -1; font-size: var(--f-sm); color: var(--soluk); }
  .hata { grid-column: 1 / -1; color: var(--hata); font-size: var(--f-sm); font-weight: 500; }
  .gruplar { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: var(--b4); align-items: start; }
  .grup { padding: var(--b4); }
  .grup h2 { display: flex; align-items: center; gap: var(--b2); font-size: var(--f-lg); margin-bottom: var(--b3); }
  .sayi { margin-left: auto; font-family: var(--yazi-govde); font-size: var(--f-sm); color: var(--soluk); font-weight: 500; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; }
  li { display: flex; align-items: center; gap: var(--b3); padding: var(--b2) 0; border-top: 1px solid var(--cizgi-acik); }
  li:first-child { border-top: 0; }
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
</style>
