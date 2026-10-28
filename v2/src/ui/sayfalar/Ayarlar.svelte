<script lang="ts">
  import { depo, tumVeriyiSil, yedekVerisi, yedektenYukle, AYAR_VARSAYILAN } from "../../veri/depo.svelte";
  import { dosyaKaydet } from "../../disa/indir";
  import Ikon from "../ortak/Ikon.svelte";

  let durum = $state<{ tur: "tamam" | "hata"; metin: string } | null>(null);
  let silOnayi = $state(false);
  let dosyaGirdi: HTMLInputElement;

  async function yedekAl() {
    const t = new Date(), iki = (n: number) => String(n).padStart(2, "0");
    const ad = `nobet-cizelgesi-yedek-${t.getFullYear()}-${iki(t.getMonth() + 1)}-${iki(t.getDate())}.json`;
    try {
      const ok = await dosyaKaydet(ad, yedekVerisi(), "application/json");
      durum = ok ? { tur: "tamam", metin: `Yedek kaydedildi: ${ad}` } : null;
    } catch {
      durum = { tur: "hata", metin: "Yedek kaydedilemedi. Tarayıcı dosya kaydetmeye izin vermedi." };
    }
  }
  async function dosyaSecildi(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    const r = yedektenYukle(await f.text());
    durum = r.tamam ? { tur: "tamam", metin: `Yedek yüklendi: ${depo.veri.staff.length} kişi, ${Object.keys(depo.veri.schedules).length} ay çizelgesi.` } : { tur: "hata", metin: r.hata };
    dosyaGirdi.value = "";
  }
  function sil() {
    if (!silOnayi) { silOnayi = true; return; }
    tumVeriyiSil(); silOnayi = false;
    durum = { tur: "tamam", metin: "Tüm veriler silindi." };
  }
</script>

<header class="sayfa-bas">
  <h1>Ayarlar</h1>
  <p>Kurum bilgileri, çizelge kuralları ve yedek.</p>
</header>

<div class="bolumler">
  <section class="kart bolum">
    <h2>Kurum</h2>
    <label class="alan"><span>Kurum adı</span><input class="girdi" bind:value={depo.veri.kurum.ad} maxlength="80" placeholder="ör. Şehir Hastanesi Eczanesi" /><small>Çıktıların başlığında görünür.</small></label>
    <label class="alan"><span>Onaylayan</span><input class="girdi" bind:value={depo.veri.kurum.onaylayan} maxlength="80" placeholder="ör. Sorumlu Eczacı Ayşe Yılmaz" /><small>Çizelge onaylanınca kayda geçer.</small></label>
  </section>

  <section class="kart bolum">
    <h2>Çizelge kuralları</h2>
    <p class="aciklama">Diğer kurallar sabittir: nöbet ertesi gün izin, ayda en fazla 1 Cumartesi ve 1 Pazar nöbeti, kişiler arası fazla mesai farkı en çok 8 saat, hazırlama farkı en çok 1.</p>
    <label class="alan"><span>İki nöbet arasında önerilen en az gün</span>
      <select class="girdi" bind:value={depo.veri.settings.minAra}>{#each [2, 3, 4] as n}<option value={n}>{n} gün{n === AYAR_VARSAYILAN.minAra ? " (önerilen)" : ""}</option>{/each}</select>
      <small>Ardışık günler her zaman yasaktır; bu sınır yalnız tercih edilir.</small></label>
    <label class="alan"><span>Destek personeli aylık hazırlama sayısı</span>
      <input class="girdi" type="number" min="0" max="8" bind:value={depo.veri.settings.destekAylik} /></label>
    <label class="alan"><span>Arife günü normal mesai (saat)</span>
      <input class="girdi" type="number" min="0" max="8" bind:value={depo.veri.settings.arifeSaat} /></label>
    <fieldset class="alan">
      <legend>Hazırlama eşitliği ile fazla mesai saati çakışırsa</legend>
      <label class="secim"><input type="radio" name="oncelik" value={1} bind:group={depo.veri.settings.cakismaOncelik} />Hazırlama sayıları eşit kalsın (önerilen)</label>
      <label class="secim"><input type="radio" name="oncelik" value={2} bind:group={depo.veri.settings.cakismaOncelik} />Fazla mesai saatleri eşit kalsın</label>
    </fieldset>
  </section>

  <section class="kart bolum">
    <h2>Yedek</h2>
    <p class="aciklama">Veriler yalnız bu tarayıcıda durur. Tarayıcı verisi silinirse kaybolur; düzenli yedek alın. Yedek dosyasıyla başka bir bilgisayara da taşıyabilirsiniz.</p>
    <div class="dugmeler">
      <button class="dugme ana" onclick={yedekAl}><Ikon ad="indir" />Yedek al</button>
      <button class="dugme" onclick={() => dosyaGirdi.click()}><Ikon ad="yukle" />Yedekten yükle</button>
      <input bind:this={dosyaGirdi} type="file" accept=".json,application/json" onchange={dosyaSecildi} hidden />
    </div>
    <p class="aciklama">Yedekten yükleme, bu tarayıcıdaki verilerin yerine geçer.</p>
  </section>

  <section class="kart bolum tehlikeli">
    <h2>Tüm verileri sil</h2>
    <p class="aciklama">Personel, izinler, çizelgeler ve ayarlar bu tarayıcıdan silinir. Geri alınamaz; önce yedek alın.</p>
    <div class="dugmeler">
      <button class="dugme tehlike" onclick={sil}><Ikon ad="sil" />{silOnayi ? "Evet, hepsini sil" : "Tüm verileri sil"}</button>
      {#if silOnayi}<button class="dugme" onclick={() => (silOnayi = false)}>Vazgeç</button>{/if}
    </div>
  </section>
</div>

{#if durum}<p class="durum {durum.tur}" role="status">{durum.metin}</p>{/if}

<style>
  .sayfa-bas { margin-bottom: var(--b5); }
  .sayfa-bas p { color: var(--yazi-2); margin-top: var(--b2); }
  .bolumler { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: var(--b4); align-items: start; }
  .bolum { padding: var(--b5); display: grid; gap: var(--b4); }
  .bolum h2 { font-size: var(--f-lg); }
  .aciklama { font-size: var(--f-sm); color: var(--soluk); }
  fieldset { border: 0; padding: 0; margin: 0; }
  legend { font-size: var(--f-sm); font-weight: 500; color: var(--yazi-2); margin-bottom: var(--b1); }
  .secim { display: flex; align-items: center; gap: var(--b2); min-height: 32px; cursor: pointer; }
  .secim input { width: 18px; height: 18px; accent-color: var(--vurgu); }
  .dugmeler { display: flex; flex-wrap: wrap; gap: var(--b2); }
  .tehlikeli h2 { color: var(--hata); }
  .durum { position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(96px + env(safe-area-inset-bottom, 0px)); z-index: 30; max-width: min(560px, calc(100vw - 32px));
    padding: var(--b3) var(--b4); border-radius: var(--r); box-shadow: var(--golge); font-weight: 500; }
  .durum.tamam { background: var(--vurgu-zemin); color: var(--vurgu); border: 1px solid var(--vurgu); }
  .durum.hata { background: var(--hata-zemin); color: var(--hata); border: 1px solid var(--hata); }
  @media (min-width: 861px) { .durum { bottom: var(--b5); } }
  @media (max-width: 420px) { .bolumler { grid-template-columns: 1fr; } .bolum { padding: var(--b4); } }
</style>
