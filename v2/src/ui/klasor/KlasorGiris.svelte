<script lang="ts">
  // Ortak klasör kipinde açılış ekranı: klasör seçimi, kasa kurulumu, giriş, ilk şifre, kurtarma (veri/klasor/oturum.svelte.ts)
  import { onMount } from "svelte";
  import {
    giris,
    girisBaslat,
    klasorSec,
    klasorYoluAc,
    izinVer,
    baskaKlasor,
    kasaKur,
    kodKaydedildi,
    girisYapIste,
    ilkSifreBelirle,
    kurtarmaAc,
    giriseDon,
    kurtar,
    eskiKopyayiKabulEt,
    aktarilabilirVeri,
  } from "../../veri/klasor/oturum.svelte";
  import { masaustuMu } from "../../veri/klasor/dosya";
  import { kullaniciAdiSorunu, sifreSorunu, SIFRE_EN_AZ } from "../../veri/klasor/kasa";
  import { klasorKipiniAyarla } from "../../veri/saklama";
  import { dosyaKaydet } from "../../disa/indir";
  import Amblem from "../ortak/Amblem.svelte";
  import Ikon from "../ortak/Ikon.svelte";

  const masaustu = masaustuMu();
  onMount(() => void girisBaslat());

  let yol = $state(""),
    ad = $state(""),
    kullanici = $state(giris.sonKullanici),
    sifre = $state(""),
    sifre2 = $state(""),
    kod = $state(""),
    kaydettim = $state(false),
    aktar = $state(true),
    yerelSorun = $state("");
  const aktarilabilir = !masaustu && !!aktarilabilirVeri();

  function sifreDenetle(kAdi: string): boolean {
    yerelSorun = sifreSorunu(sifre, kAdi) || (sifre !== sifre2 ? "İki şifre aynı değil." : "");
    return !yerelSorun;
  }
  async function kur(e: SubmitEvent) {
    e.preventDefault();
    yerelSorun = !ad.trim() ? "Adınızı yazın." : kullaniciAdiSorunu(kullanici);
    if (yerelSorun || !sifreDenetle(kullanici)) return;
    await kasaKur({ ad, kullaniciAdi: kullanici, sifre, aktar: aktarilabilir && aktar });
    sifre = sifre2 = "";
  }
  async function gir(e: SubmitEvent) {
    e.preventDefault();
    yerelSorun = "";
    await girisYapIste(kullanici, sifre);
    sifre = "";
  }
  async function yeniSifre(e: SubmitEvent) {
    e.preventDefault();
    if (!sifreDenetle(giris.sonKullanici)) return;
    await ilkSifreBelirle(sifre);
    sifre = sifre2 = "";
  }
  async function kurtarGonder(e: SubmitEvent) {
    e.preventDefault();
    if (!sifreDenetle(kullanici)) return;
    await kurtar(kod, kullanici, sifre);
    sifre = sifre2 = kod = "";
  }
  function kodIndir() {
    void dosyaKaydet(
      "kurtarma-anahtari.txt",
      `Nöbet Çizelgesi Yönetim Sistemi: kasa kurtarma anahtarı\r\nKlasör: ${giris.klasorAdi}\r\nOluşturma: ${new Date().toLocaleString("tr-TR")}\r\n\r\n${giris.kurtarmaKodu}\r\n\r\nBütün şifreler unutulursa sahibin şifresini bu anahtarla yenileyebilirsiniz. Güvenli bir yerde saklayın (kilitli dolap); ortak klasöre koymayın.\r\n`,
      "text/plain",
    ).catch(() => {});
  }
  function kiptenCik() {
    klasorKipiniAyarla(false);
    location.reload();
  }
  const BASLIK: Record<string, string> = {
    hazirlaniyor: "Açılıyor…",
    klasor: "Ortak klasörü seçin",
    izin: "Ortak klasöre bağlanın",
    kur: "Yeni kasa kurun",
    giris: "Giriş",
    kod: "Kurtarma anahtarınızı saklayın",
    sifre: "Kendi şifrenizi belirleyin",
    kurtarma: "Kurtarma anahtarıyla şifre yenileme",
  };
</script>

<main class="kapi">
  <div class="kart panel-blok kutu-giris">
    <div class="marka">
      <span class="logo" aria-hidden="true"><Amblem /></span>
      <div>
        <small>Hastane Eczanesi</small>
        <b>Nöbet Çizelgesi Yönetim Sistemi</b>
      </div>
    </div>
    <h1>{BASLIK[giris.asama]}</h1>
    {#if giris.klasorAdi && giris.asama !== "klasor" && giris.asama !== "hazirlaniyor"}
      <p class="klasor"><Ikon ad="kilit" boyut={16} />Klasör: <b>{giris.klasorAdi}</b></p>
    {/if}
    {#if giris.bilgi}<p class="kutu bilgi" role="status">{giris.bilgi}</p>{/if}
    {#if giris.hata}
      <div class="kutu hata" role="alert">
        <p>{giris.hata}</p>
        {#if giris.eskiKopya}
          <p>
            Yedekten geri dönüyorsanız bu kopyayı yine de açabilirsiniz; bu bilgisayar kasanın daha yeni sürümünü unutur. Yedekten
            dönmüyorsanız açmayın, sahibe haber verin.
          </p>
          <button class="dugme" onclick={eskiKopyayiKabulEt} disabled={giris.mesgul}>Yedekten dönüyorum: yine de aç</button>
        {/if}
      </div>
    {/if}
    {#if yerelSorun}<p class="kutu hata" role="alert">{yerelSorun}</p>{/if}

    {#if giris.asama === "klasor"}
      <p class="aciklama">
        Veriler hastanenin ortak ağ klasöründe (ör. <code>\\sunucu\eczane</code>) şifreli olarak durur; her sorumlu kendi kullanıcı adı ve
        şifresiyle girer. İnternet ve ayrı bir sunucu gerekmez. Tek bilgisayarda çalışacaksanız o bilgisayarda bir klasör de seçebilirsiniz.
      </p>
      <button class="dugme ana" onclick={klasorSec} disabled={giris.mesgul}><Ikon ad="tablo" />Klasör seç</button>
      {#if masaustu}
        <form
          class="satir"
          onsubmit={e => {
            e.preventDefault();
            void klasorYoluAc(yol);
          }}
        >
          <label class="alan"
            ><span>ya da klasörün yolunu yazın</span><input
              class="girdi"
              bind:value={yol}
              placeholder="\\sunucu\eczane"
              spellcheck="false"
            /></label
          >
          <button class="dugme" disabled={giris.mesgul || !yol.trim()}>Aç</button>
        </form>
      {:else}
        <p class="aciklama">
          Tarayıcı, klasöre erişim için izin ister. Program her açılışta (bir düğmeye basınca) izni yeniden sorar. Bu kip yalnız Edge ve
          Chrome'da çalışır; masaüstü uygulaması da aynı klasörü kullanabilir.
        </p>
        <button class="dugme sade" onclick={kiptenCik}>Ortak klasör kipinden çık (verileri yalnız bu tarayıcıda tut)</button>
      {/if}
    {:else if giris.asama === "izin"}
      <p class="aciklama">Tarayıcı, bu klasöre erişim için her açılışta izin ister.</p>
      <div class="dugmeler">
        <button class="dugme ana" onclick={izinVer} disabled={giris.mesgul}>Klasöre bağlan</button>
        <button class="dugme" onclick={baskaKlasor}>Başka klasör seç</button>
      </div>
    {:else if giris.asama === "kur"}
      <p class="aciklama">
        Bu klasörde henüz kasa yok. Kasayı siz kurarsınız ve <b>sahip</b> olursunuz: öteki sorumluları, rollerini ve geçici şifrelerini siz eklersiniz
        (Ayarlar > Geçmiş > Kullanıcılar).
      </p>
      <form class="form" onsubmit={kur}>
        <label class="alan"><span>Adınız soyadınız</span><input class="girdi" bind:value={ad} maxlength="60" autocomplete="name" /></label>
        <label class="alan"
          ><span>Kullanıcı adı</span><input
            class="girdi"
            bind:value={kullanici}
            maxlength="32"
            autocomplete="username"
            spellcheck="false"
          /></label
        >
        <label class="alan"
          ><span>Şifre</span><input class="girdi" type="password" bind:value={sifre} autocomplete="new-password" /><small
            >En az {SIFRE_EN_AZ} karakter. Şifre hiçbir yerde saklanmaz; unutulursa kurtarma anahtarıyla yenilenir.</small
          ></label
        >
        <label class="alan"
          ><span>Şifre (tekrar)</span><input class="girdi" type="password" bind:value={sifre2} autocomplete="new-password" /></label
        >
        {#if aktarilabilir}
          <label class="secim"
            ><input type="checkbox" bind:checked={aktar} /> Bu tarayıcıdaki mevcut verileri kasaya aktar (aktarıldıktan sonra tarayıcıdaki şifresiz
            kopya silinir)</label
          >
        {/if}
        <div class="dugmeler">
          <button class="dugme ana" disabled={giris.mesgul}>{giris.mesgul ? "Kuruluyor…" : "Kasayı kur"}</button>
          <button class="dugme" type="button" onclick={baskaKlasor}>Başka klasör seç</button>
        </div>
      </form>
    {:else if giris.asama === "kod"}
      <p class="aciklama">
        Bütün şifreler unutulursa (ya da sahip görevden ayrılırsa) sahibin şifresi bu anahtarla yenilenir. Yalnız şimdi gösterilir. Yazdırın
        ya da dosyaya kaydedip güvenli bir yerde (kilitli dolap) saklayın; ortak klasöre koymayın.
      </p>
      <p class="kod rakam" aria-label="Kurtarma anahtarı">{giris.kurtarmaKodu}</p>
      <div class="dugmeler">
        <button class="dugme" onclick={kodIndir}><Ikon ad="indir" />Dosyaya kaydet</button>
        <button class="dugme" onclick={() => print()}>Yazdır</button>
      </div>
      <label class="secim"><input type="checkbox" bind:checked={kaydettim} /> Kurtarma anahtarını güvenli bir yere kaydettim</label>
      <button class="dugme ana" disabled={!kaydettim || giris.mesgul} onclick={kodKaydedildi}>Devam</button>
    {:else if giris.asama === "giris"}
      <form class="form" onsubmit={gir}>
        <label class="alan"
          ><span>Kullanıcı adı</span><input
            class="girdi"
            bind:value={kullanici}
            maxlength="32"
            autocomplete="username"
            spellcheck="false"
          /></label
        >
        <label class="alan"
          ><span>Şifre</span><input class="girdi" type="password" bind:value={sifre} autocomplete="current-password" /></label
        >
        <div class="dugmeler">
          <button class="dugme ana" disabled={giris.mesgul || !kullanici.trim() || !sifre}
            >{giris.mesgul ? "Giriş yapılıyor…" : "Giriş yap"}</button
          >
        </div>
      </form>
      <details class="unuttum">
        <summary>Şifremi unuttum</summary>
        <p class="aciklama">
          Kasanın sahibinden (ya da başka bir sahipten) şifrenizi yenilemesini isteyin: Ayarlar > Geçmiş > Kullanıcılar > Şifre yenile.
          Sahibin kendi şifresi unutulduysa kurtarma anahtarıyla yenilenir.
        </p>
        <button class="dugme kucuk" onclick={kurtarmaAc}>Kurtarma anahtarım var</button>
      </details>
      <button class="dugme sade kucuk" onclick={baskaKlasor}>Başka klasör seç</button>
    {:else if giris.asama === "sifre"}
      <p class="aciklama">Sahibin verdiği geçici şifreyle girdiniz. Devam etmek için yalnız sizin bildiğiniz bir şifre belirleyin.</p>
      <form class="form" onsubmit={yeniSifre}>
        <label class="alan"
          ><span>Yeni şifre</span><input class="girdi" type="password" bind:value={sifre} autocomplete="new-password" /><small
            >En az {SIFRE_EN_AZ} karakter.</small
          ></label
        >
        <label class="alan"
          ><span>Yeni şifre (tekrar)</span><input class="girdi" type="password" bind:value={sifre2} autocomplete="new-password" /></label
        >
        <button class="dugme ana" disabled={giris.mesgul}>Şifreyi kaydet ve devam et</button>
      </form>
    {:else if giris.asama === "kurtarma"}
      <p class="aciklama">
        Kurtarma anahtarı kasa kurulurken bir kez gösterilmişti. Yenilenecek kişinin kullanıcı adını ve yeni şifreyi yazın.
      </p>
      <form class="form" onsubmit={kurtarGonder}>
        <label class="alan"
          ><span>Kurtarma anahtarı</span><input
            class="girdi rakam"
            bind:value={kod}
            placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
            spellcheck="false"
          /></label
        >
        <label class="alan"
          ><span>Kullanıcı adı</span><input
            class="girdi"
            bind:value={kullanici}
            maxlength="32"
            autocomplete="username"
            spellcheck="false"
          /></label
        >
        <label class="alan"
          ><span>Yeni şifre</span><input class="girdi" type="password" bind:value={sifre} autocomplete="new-password" /></label
        >
        <label class="alan"
          ><span>Yeni şifre (tekrar)</span><input class="girdi" type="password" bind:value={sifre2} autocomplete="new-password" /></label
        >
        <div class="dugmeler">
          <button class="dugme ana" disabled={giris.mesgul || !kod.trim()}>Şifreyi yenile</button>
          <button class="dugme" type="button" onclick={giriseDon}>Girişe dön</button>
        </div>
      </form>
    {/if}
  </div>
  <p class="alt">Veriler şifreli olarak ortak klasörde durur; bu bilgisayarda kopya kalmaz.</p>
</main>

<style>
  .kapi {
    min-height: 100vh;
    display: grid;
    place-content: center;
    gap: var(--b3);
    padding: var(--b5) var(--b3);
    background: var(--zemin);
  }
  .kutu-giris {
    width: min(520px, 92vw);
    display: grid;
    gap: var(--b3);
  }
  .marka {
    display: flex;
    align-items: center;
    gap: var(--b3);
  }
  .marka .logo {
    width: 44px;
    height: 44px;
    display: inline-flex;
  }
  .marka small {
    display: block;
    color: var(--yazi-2);
    font-size: var(--f-xs);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  h1 {
    margin: 0;
    font-size: var(--f-lg, 1.25rem);
  }
  .klasor {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    font-size: var(--f-sm);
    color: var(--yazi-2);
    word-break: break-all;
  }
  .form {
    display: grid;
    gap: var(--b3);
  }
  .satir {
    display: flex;
    gap: var(--b2);
    align-items: flex-end;
  }
  .satir .alan {
    flex: 1;
  }
  .dugmeler {
    display: flex;
    flex-wrap: wrap;
    gap: var(--b2);
  }
  .secim {
    display: flex;
    gap: var(--b2);
    align-items: flex-start;
    font-size: var(--f-sm);
  }
  .kod {
    margin: 0;
    padding: var(--b3);
    border: 2px dashed var(--cizgi);
    border-radius: var(--r-kucuk);
    font-size: 1.15rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-align: center;
    word-break: break-all;
  }
  .kutu p {
    margin: 0 0 var(--b2);
  }
  .kutu p:last-child {
    margin-bottom: 0;
  }
  .unuttum summary {
    cursor: pointer;
    font-size: var(--f-sm);
  }
  .alt {
    margin: 0;
    text-align: center;
    color: var(--yazi-2);
    font-size: var(--f-xs);
  }
  .aciklama {
    margin: 0;
  }
</style>
