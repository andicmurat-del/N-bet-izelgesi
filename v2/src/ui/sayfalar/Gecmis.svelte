<script lang="ts">
  // Ayarlar > Geçmiş: değişiklik geçmişi (ne zaman, kim, ne değişti) ve günlük otomatik kopyalar (bu tarayıcıda).
  import {
    gunluk,
    kullaniciAyarla,
    gecmisiTemizle,
    gunlukKopyalar,
    gunlukKopyayaDon,
    KOPYA_GUN,
    type KayitTuru,
  } from "../../veri/depo.svelte";
  import Ikon from "../ortak/Ikon.svelte";

  const TUR_AD: Record<KayitTuru, string> = {
    geri: "Geri alma",
    yinele: "Yineleme",
    yukleme: "Yedekten / kopyadan yükleme",
    esitleme: "Başka cihazdan gelen veriler",
  };
  let ad = $state(gunluk.kullanici);
  let ara = $state("");
  let gosterilen = $state(100);
  const kayitlar = $derived(
    gunluk.kayit
      .slice()
      .reverse()
      .filter(k => !ara.trim() || [k.kim, ...k.t].some(x => x.toLocaleLowerCase("tr").includes(ara.trim().toLocaleLowerCase("tr")))),
  );
  const zaman = (z: number) => new Date(z).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });
  const kopyalar = $derived(gunlukKopyalar());
  let soru = $state<"temizle" | string | null>(null);
  let durum = $state("");
  function kopyayaDon(gun: string) {
    durum = gunlukKopyayaDon(gun)
      ? `${gun} kopyasına dönüldü. Önceki hâl için Ayarlar > Genel > "Önceki verilere dön".`
      : "Kopya okunamadı.";
    soru = null;
  }
</script>

<div class="duzen">
  <section class="kart panel-blok">
    <h2>Değişiklik geçmişi</h2>
    <p class="aciklama">
      Her kayıtta neyin değiştiği, ne zaman ve bu cihazda kimin yaptığı yazılır (son 500 kayıt, yalnız bu tarayıcıda). Geri alma, yedekten
      yükleme ve başka cihazdan gelen veriler ayrıca belirtilir.
    </p>
    <div class="satir">
      <label class="alan"
        ><span>Bu cihazda değişiklik yapan</span><input
          class="girdi"
          bind:value={ad}
          maxlength="40"
          placeholder="Ad soyad"
          onchange={() => kullaniciAyarla(ad)}
        /></label
      >
      <label class="alan"
        ><span>Geçmişte ara</span><input class="girdi" type="search" bind:value={ara} placeholder="Ad, ay, liste…" /></label
      >
    </div>
    {#if !kayitlar.length}
      <p class="bos">{gunluk.kayit.length ? "Aramaya uyan kayıt yok." : "Henüz kayıtlı değişiklik yok."}</p>
    {:else}
      <ol class="kayitlar">
        {#each kayitlar.slice(0, gosterilen) as k (k.z + k.t.join())}
          <li>
            <div class="ust">
              <time class="rakam">{zaman(k.z)}</time>
              <span class="kim">{k.kim || "Adsız"}</span>
              {#if k.tur}<span class="rozet bilgi">{TUR_AD[k.tur]}</span>{/if}
            </div>
            <ul>
              {#each k.t as t}<li>{t}</li>{/each}
            </ul>
          </li>
        {/each}
      </ol>
      {#if kayitlar.length > gosterilen}<button class="dugme" onclick={() => (gosterilen += 100)}>Daha eski kayıtlar</button>{/if}
    {/if}
    {#if gunluk.kayit.length}
      {#if soru === "temizle"}
        <div class="bant hata" role="alert">
          Geçmiş silinsin mi? Veriler değişmez, yalnız bu liste silinir.
          <button
            class="dugme kucuk tehlike"
            onclick={() => {
              gecmisiTemizle();
              soru = null;
            }}>Evet, sil</button
          >
          <button class="dugme kucuk" onclick={() => (soru = null)}>Vazgeç</button>
        </div>
      {:else}
        <button class="dugme sade tehlike" onclick={() => (soru = "temizle")}><Ikon ad="sil" />Geçmişi temizle</button>
      {/if}
    {/if}
  </section>

  <section class="kart panel-blok">
    <h2>Günlük otomatik kopyalar</h2>
    <p class="aciklama">
      Her günün ilk değişikliğinden önce verilerin o anki hâli saklanır (son {KOPYA_GUN} gün, yalnız bu tarayıcıda). Yanlışlıkla toplu silme ya
      da yanlış yedek yüklemesinden sonra bir önceki güne dönmek için. Tarayıcı verisi silinirse bunlar da gider: düzenli olarak "Yedek al" ile
      dosya yedeği alın.
    </p>
    {#if durum}<p class="bant tamam" role="status">{durum}</p>{/if}
    {#if !kopyalar.length}
      <p class="bos">Henüz kopya yok; ilk değişiklikte alınır.</p>
    {:else}
      <ul class="kopyalar">
        {#each kopyalar as k (k.gun)}
          <li>
            <span><b class="rakam">{zaman(k.z)}</b><small>{k.kisi} kişi · {k.ay} ay çizelge · {k.kb} KB</small></span>
            {#if soru === k.gun}
              <span class="onay"
                >Bu kopyaya dönülsün mü? <button class="dugme kucuk ana" onclick={() => kopyayaDon(k.gun)}>Evet, dön</button><button
                  class="dugme kucuk"
                  onclick={() => (soru = null)}>Vazgeç</button
                ></span
              >
            {:else}
              <button class="dugme kucuk" onclick={() => (soru = k.gun)}><Ikon ad="geri" boyut={16} />Bu kopyaya dön</button>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>

<style>
  .duzen {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
    gap: var(--b4);
    align-items: start;
  }
  section {
    display: grid;
    gap: var(--b3);
    padding: var(--b4) var(--b5);
  }
  h2 {
    font-size: var(--f-md);
    color: var(--lacivert);
    margin: 0;
  }
  .aciklama {
    font-size: var(--f-sm);
    color: var(--yazi-2);
    max-width: 75ch;
  }
  .satir {
    display: flex;
    flex-wrap: wrap;
    gap: var(--b3);
  }
  .alan {
    display: grid;
    gap: 4px;
    font-size: var(--f-sm);
    font-weight: 600;
    min-width: 220px;
  }
  .bos {
    color: var(--soluk);
    font-size: var(--f-sm);
  }
  .kayitlar {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--b2);
  }
  .kayitlar > li {
    padding: var(--b2) var(--b3);
    border: 1px solid var(--cizgi);
    border-radius: var(--r-kucuk);
  }
  .ust {
    display: flex;
    flex-wrap: wrap;
    gap: var(--b2);
    align-items: center;
    font-size: var(--f-sm);
  }
  .ust time {
    font-weight: 700;
    color: var(--lacivert);
  }
  .kim {
    color: var(--yazi-2);
  }
  .kayitlar ul {
    margin: 4px 0 0;
    padding-left: 1.2em;
    font-size: var(--f-sm);
  }
  .bant {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--b2);
    padding: var(--b2) var(--b3);
    border-radius: var(--r-kucuk);
    font-size: var(--f-sm);
    font-weight: 600;
  }
  .bant.hata {
    background: var(--hata-zemin);
    color: var(--hata);
  }
  .bant.tamam {
    background: var(--vurgu-zemin);
    color: var(--vurgu);
  }
  .kopyalar {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--b2);
  }
  .kopyalar li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--b2);
    padding: var(--b2) var(--b3);
    border: 1px solid var(--cizgi);
    border-radius: var(--r-kucuk);
  }
  .kopyalar span {
    display: grid;
  }
  .kopyalar small {
    color: var(--yazi-2);
    font-size: var(--f-xs);
  }
  .onay {
    display: flex !important;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--b2);
    font-size: var(--f-sm);
  }
  @media (max-width: 1000px) {
    .duzen {
      grid-template-columns: 1fr;
    }
  }
</style>
