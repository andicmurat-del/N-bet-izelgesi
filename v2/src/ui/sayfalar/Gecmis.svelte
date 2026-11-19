<script lang="ts">
  // Ayarlar > Geçmiş: kullanıcılar ve yetki, değişiklik geçmişi (ne zaman, kim, ne değişti) ve günlük otomatik kopyalar.
  // claude.ai'de açılınca geçmiş ve kopyalar sunucudadır (bütün sorumlular, kimlik claude.ai girişinden); değilse yalnız bu
  // tarayıcıdadır.
  import { onMount } from "svelte";
  import {
    gunluk,
    kullaniciAyarla,
    gecmisiTemizle,
    gunlukKopyalar,
    gunlukKopyayaDon,
    KOPYA_GUN,
    type KayitTuru,
  } from "../../veri/depo.svelte";
  import { kimlik, kisiAdi, adlariCoz, ROL_ADI } from "../../veri/kimlik.svelte";
  import { sunucuGecmis, sunucuGecmisiYukle } from "../../veri/sunucuGecmis.svelte";
  import { sunucuKopyaListesi, sunucuKopyasinaDon } from "../../veri/bulut.svelte";
  import { SUNUCU_KOPYA_GUN, type SunucuKopyasi } from "../../veri/sunucuKopya";
  import { oda } from "../../veri/oda.svelte";
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
  // kaynak: sunucu (bütün sorumlular) ya da bu tarayıcı
  let kaynak = $state<"sunucu" | "yerel">(sunucuGecmis.acik ? "sunucu" : "yerel");
  const sunucuda = $derived(kaynak === "sunucu" && sunucuGecmis.acik);
  type Satir = { z: number; kim: string; t: string[]; tur?: KayitTuru };
  const hepsi = $derived<Satir[]>(
    sunucuda
      ? sunucuGecmis.kayit.map(k => ({ z: k.z, kim: kisiAdi(k.kim), t: k.t, ...(k.tur ? { tur: k.tur } : {}) }))
      : gunluk.kayit.slice().reverse(),
  );
  const kayitlar = $derived(
    hepsi.filter(k => !ara.trim() || [k.kim, ...k.t].some(x => x.toLocaleLowerCase("tr").includes(ara.trim().toLocaleLowerCase("tr")))),
  );
  // ekrandaki kişilerin adları claude.ai'den çözülür
  $effect(() => {
    void adlariCoz(sunucuGecmis.kayit.map(k => k.kim));
  });
  const zaman = (z: number) => new Date(z).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });
  const kopyalar = $derived(gunlukKopyalar());
  let sunucuKopyalari = $state<SunucuKopyasi[]>([]);
  $effect(() => {
    void adlariCoz(sunucuKopyalari.map(k => k.kim).filter((x): x is string => !!x));
  });
  async function sunucuKopyalariniOku() {
    try {
      sunucuKopyalari = await sunucuKopyaListesi();
    } catch {
      sunucuKopyalari = [];
    }
  }
  onMount(() => {
    if (sunucuGecmis.acik) {
      void sunucuGecmisiYukle();
      void sunucuKopyalariniOku();
    }
  });
  let soru = $state<"temizle" | string | null>(null);
  let durum = $state("");
  function kopyayaDon(gun: string) {
    durum = gunlukKopyayaDon(gun)
      ? `${gun} kopyasına dönüldü. Önceki hâl için Ayarlar > Genel > "Önceki verilere dön".`
      : "Kopya okunamadı.";
    soru = null;
  }
  async function sunucuKopyayaDon(gun: string) {
    soru = null;
    durum = (await sunucuKopyasinaDon(gun).catch(() => false))
      ? `Sunucudaki ${gun} kopyasına dönüldü; değişiklik sunucuya yazılır ve geçmişe girer. Önceki hâl için Ayarlar > Genel > "Önceki verilere dön".`
      : "Kopya okunamadı.";
  }
</script>

<div class="duzen">
  {#if kimlik.var}
    <section class="kart panel-blok kullanicilar">
      <h2>Kullanıcılar ve yetki</h2>
      <p>
        Giriş yapan: <b>{kimlik.ad || "Adı görünmeyen kullanıcı"}</b> · {kimlik.rol ? ROL_ADI[kimlik.rol] : ""}{#if oda.digerleri.length}
          · Şu an açık: {oda.digerleri.map(d => kisiAdi(d.id)).join(", ")}{/if}
      </p>
      <p class="aciklama">
        Program yalnız sorumlularla paylaşılır; giriş ve kimlik doğrulamayı claude.ai yapar. Yetki, sayfanın claude.ai'deki paylaşım
        düzeyinden gelir ve sunucuda uygulanır: verileri okuyup değiştirmek için en az <b>Contributor</b> düzeyi gerekir; Viewer ve Commenter
        verilere erişemez.
      </p>
      {#if kimlik.rol === "sahip"}
        <p class="aciklama">
          Sorumlu eklemek için claude.ai'de bu sayfanın <b>Paylaş</b> menüsünden kişiyi ekleyin: kurumunuzun (Team / Enterprise) üyesiyse
          <b>Contributor</b> verin; kurum dışından e-postayla davet ediyorsanız veri yazabilmesi için <b>Editor</b> gerekir. Editor sayfanın yeni
          sürümünü de yayımlayabildiğinden (kuralları değiştirebilir) mümkünse Contributor tercih edin. Görevden ayrılanı paylaşımdan çıkarın;
          geçmişteki kayıtları silinmez. Tüm verileri silme yalnız sizde.
        </p>
      {/if}
    </section>
  {/if}
  <section class="kart panel-blok">
    <h2>Değişiklik geçmişi</h2>
    {#if sunucuGecmis.acik}
      <p class="aciklama">
        Her değişiklikte neyin değiştiği, ne zaman ve kimin yaptığı yazılır. Kişi claude.ai girişinden gelir; herkes yalnız kendi kaydını
        yazabilir, kimse (sayfanın sahibi dahil) başkasının kaydını değiştiremez ya da silemez. Bütün sorumluların kayıtları sunucuda, her
        cihazda aynıdır.
      </p>
      <div class="secim" role="group" aria-label="Geçmişin kaynağı">
        <button class="dugme kucuk" class:ana={kaynak === "sunucu"} aria-pressed={kaynak === "sunucu"} onclick={() => (kaynak = "sunucu")}
          >Bütün sorumlular (sunucu)</button
        >
        <button class="dugme kucuk" class:ana={kaynak === "yerel"} aria-pressed={kaynak === "yerel"} onclick={() => (kaynak = "yerel")}
          >Bu tarayıcı</button
        >
        {#if sunucuda}<button
            class="dugme kucuk sade"
            onclick={() => sunucuGecmisiYukle(sunucuGecmis.tumu)}
            disabled={sunucuGecmis.yukleniyor}><Ikon ad="yenile" boyut={16} />Yenile</button
          >{/if}
      </div>
      {#if sunucuGecmis.hata}<p class="bant hata" role="alert">{sunucuGecmis.hata}</p>{/if}
    {:else}
      <p class="aciklama">
        Her kayıtta neyin değiştiği, ne zaman ve bu cihazda kimin yaptığı yazılır (son 500 kayıt, yalnız bu tarayıcıda). Geri alma, yedekten
        yükleme ve başka cihazdan gelen veriler ayrıca belirtilir. Sayfa claude.ai'de açılınca geçmiş, giriş yapan kişiyle birlikte sunucuda
        tutulur.
      </p>
    {/if}
    <div class="satir">
      {#if !sunucuda && !kimlik.var}
        <label class="alan"
          ><span>Bu cihazda değişiklik yapan</span><input
            class="girdi"
            bind:value={ad}
            maxlength="40"
            placeholder="Ad soyad"
            onchange={() => kullaniciAyarla(ad)}
          /></label
        >
      {/if}
      <label class="alan"
        ><span>Geçmişte ara</span><input class="girdi" type="search" bind:value={ara} placeholder="Ad, ay, liste…" /></label
      >
    </div>
    {#if sunucuda && sunucuGecmis.yukleniyor && !kayitlar.length}
      <p class="bos">Sunucudan okunuyor…</p>
    {:else if !kayitlar.length}
      <p class="bos">{hepsi.length ? "Aramaya uyan kayıt yok." : "Henüz kayıtlı değişiklik yok."}</p>
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
      {#if kayitlar.length > gosterilen}<button class="dugme" onclick={() => (gosterilen += 100)}>Daha eski kayıtlar</button>
      {:else if sunucuda && !sunucuGecmis.tumu}<button
          class="dugme"
          onclick={() => sunucuGecmisiYukle(true)}
          disabled={sunucuGecmis.yukleniyor}>Daha eski aylar</button
        >{/if}
    {/if}
    {#if !sunucuda && gunluk.kayit.length}
      {#if soru === "temizle"}
        <div class="bant hata" role="alert">
          Bu tarayıcıdaki geçmiş silinsin mi? Veriler{sunucuGecmis.acik ? " ve sunucudaki geçmiş" : ""} değişmez, yalnız bu liste silinir.
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
        <button class="dugme sade tehlike" onclick={() => (soru = "temizle")}
          ><Ikon ad="sil" />{sunucuGecmis.acik ? "Bu tarayıcıdaki geçmişi temizle" : "Geçmişi temizle"}</button
        >
      {/if}
    {/if}
  </section>

  <section class="kart panel-blok">
    <h2>Günlük otomatik kopyalar</h2>
    <p class="aciklama">
      Her günün ilk değişikliğinden önce verilerin o anki hâli saklanır (bu tarayıcıda son {KOPYA_GUN} gün{sunucuGecmis.acik
        ? "; sunucuda da bütün sorumlular için"
        : ""}). Yanlışlıkla toplu silme ya da yanlış yedek yüklemesinden sonra bir önceki güne dönmek için. Tarayıcı verisi silinirse bunlar
      da gider: düzenli olarak "Yedek al" ile dosya yedeği alın.
    </p>
    {#if durum}<p class="bant tamam" role="status">{durum}</p>{/if}
    {#if sunucuGecmis.acik}
      <h3>Sunucuda (bütün sorumlular, son {SUNUCU_KOPYA_GUN} gün)</h3>
      {#if !sunucuKopyalari.length}
        <p class="bos">Henüz kopya yok; günün ilk değişikliğinde alınır.</p>
      {:else}
        <ul class="kopyalar">
          {#each sunucuKopyalari as k (k.gun)}
            <li>
              <span
                ><b class="rakam">{zaman(k.z)}</b><small
                  >{k.kb} KB{k.kim ? ` · kopyayı alan: ${kisiAdi(k.kim)}` : ""} · o günün ilk değişikliğinden önceki hâl</small
                ></span
              >
              {#if soru === "s:" + k.gun}
                <span class="onay"
                  >Herkes için bu kopyaya dönülsün mü? <button class="dugme kucuk ana" onclick={() => sunucuKopyayaDon(k.gun)}
                    >Evet, dön</button
                  ><button class="dugme kucuk" onclick={() => (soru = null)}>Vazgeç</button></span
                >
              {:else}
                <button class="dugme kucuk" onclick={() => (soru = "s:" + k.gun)}><Ikon ad="geri" boyut={16} />Bu kopyaya dön</button>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
      <h3>Bu tarayıcıda</h3>
    {/if}
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
  .kullanicilar {
    grid-column: 1 / -1;
  }
  .kullanicilar p {
    margin: 0;
    font-size: var(--f-sm);
  }
  .secim {
    display: flex;
    flex-wrap: wrap;
    gap: var(--b2);
  }
  h3 {
    font-size: var(--f-sm);
    margin: var(--b2) 0 0;
    color: var(--yazi-2);
  }
  @media (max-width: 1000px) {
    .duzen {
      grid-template-columns: 1fr;
    }
  }
</style>
