<script lang="ts">
  // Ortak klasör kipinde Ayarlar > Geçmiş: giriş yapan, kullanıcılar ve rolleri (sahip yönetir), kendi şifresi, yedek klasörü,
  // kurtarma anahtarı. İşlemler veri/klasor/oturum.svelte.ts'te.
  import { onMount } from "svelte";
  import {
    bakimDurumu,
    cikisYap,
    geciciSifreUret,
    giris,
    kasaDurumu,
    kullaniciAdiniDegistir,
    kullaniciEkle,
    kullaniciRolu,
    kullaniciSifresiniYenile,
    kullaniciyiKaldir,
    kurtarmaAnahtariniYenile,
    sifremiDegistir,
    yedekAl,
    yedekDurumu,
    yedekKlasorunuKaldir,
    yedekKlasoruSec,
    yedekListesi,
    yedektenVeriOku,
    OTURUM_SURE_DK,
  } from "../../veri/klasor/oturum.svelte";
  import { KASA_ROL_ADI, SIFRE_EN_AZ, type KasaRol } from "../../veri/klasor/kasa";
  import { oda } from "../../veri/oda.svelte";
  import { kisiAdi, yonetimYetkisi, YONETIM_UYARISI } from "../../veri/kimlik.svelte";
  import { kaynakBelirt, tumVeriyiDegistir } from "../../veri/depo.svelte";
  import { dosyaKaydet } from "../../disa/indir";
  import Ikon from "../ortak/Ikon.svelte";

  onMount(() => void yedekListesi().catch(() => {}));
  const ROLLER: KasaRol[] = ["katkida", "duzenleyen", "sahip"];
  let durum = $state(""),
    hata = $state(""),
    mesgul = $state(false);
  async function is(f: () => Promise<unknown>, tamam: string) {
    durum = hata = "";
    mesgul = true;
    try {
      await f();
      durum = tamam;
    } catch (e) {
      hata = (e as Error)?.message || "İşlem yapılamadı.";
    } finally {
      mesgul = false;
    }
  }
  const tarih = (z: number) => new Date(z).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });

  // kendi şifresi
  let eski = $state(""),
    yeni = $state(""),
    yeni2 = $state("");
  function sifreKaydet(e: SubmitEvent) {
    e.preventDefault();
    if (yeni !== yeni2) {
      hata = "İki yeni şifre aynı değil.";
      return;
    }
    void is(async () => {
      await sifremiDegistir(eski, yeni);
      eski = yeni = yeni2 = "";
    }, "Şifreniz değiştirildi.");
  }

  // yeni kullanıcı
  let yAd = $state(""),
    yKullanici = $state(""),
    yRol = $state<KasaRol>("katkida"),
    ySifre = $state(geciciSifreUret()),
    eklenen = $state<{ ad: string; kullanici: string; sifre: string } | null>(null);
  function ekle(e: SubmitEvent) {
    e.preventDefault();
    const bilgi = { ad: yAd.trim(), kullanici: yKullanici.trim(), sifre: ySifre };
    void is(async () => {
      await kullaniciEkle({ ad: yAd, kullaniciAdi: yKullanici, sifre: ySifre, rol: yRol });
      eklenen = bilgi;
      yAd = yKullanici = "";
      yRol = "katkida";
      ySifre = geciciSifreUret();
    }, `${bilgi.ad} eklendi.`);
  }
  // satır işlemleri
  let sifreYenilenen = $state<{ id: string; sifre: string } | null>(null),
    kaldirilacak = $state<string | null>(null),
    adDuzenlenen = $state<{ id: string; ad: string } | null>(null);
  function sifreYenile(id: string) {
    const s = geciciSifreUret();
    void is(async () => {
      await kullaniciSifresiniYenile(id, s);
      sifreYenilenen = { id, sifre: s };
    }, "Şifre yenilendi; geçici şifreyi kişiye iletin.");
  }

  // kurtarma anahtarı
  let yeniKod = $state("");
  function kodYenile() {
    void is(async () => {
      yeniKod = await kurtarmaAnahtariniYenile();
    }, "Yeni kurtarma anahtarı oluşturuldu; eskisi artık geçersiz.");
  }
  function kodIndir() {
    void dosyaKaydet(
      "kurtarma-anahtari.txt",
      `Nöbet Çizelgesi Yönetim Sistemi: kasa kurtarma anahtarı\r\nKlasör: ${giris.klasorAdi}\r\nOluşturma: ${new Date().toLocaleString("tr-TR")}\r\n\r\n${yeniKod}\r\n\r\nGüvenli bir yerde saklayın; ortak klasöre koymayın.\r\n`,
      "text/plain",
    ).catch(() => {});
  }

  // yedekten dönüş
  let donulecek = $state<string | null>(null),
    donusSifre = $state("");
  function yedektenDon(e: SubmitEvent) {
    e.preventDefault();
    const gun = donulecek!;
    void is(async () => {
      const v = await yedektenVeriOku(gun, donusSifre);
      kaynakBelirt("yukleme");
      tumVeriyiDegistir(v);
      donulecek = null;
      donusSifre = "";
    }, `${gun} yedeğindeki verilere dönüldü; değişiklik ortak klasöre yazılır ve geçmişe girer. Önceki hâl için Ayarlar > Genel > "Önceki verilere dön".`);
  }
</script>

<section class="kart panel-blok kullanicilar">
  <h2>Kullanıcılar ve yetki</h2>
  <p>
    Giriş yapan: <b>{giris.ad}</b> ({kasaDurumu.kullaniciAdi}) · {kasaDurumu.rol
      ? KASA_ROL_ADI[kasaDurumu.rol]
      : ""}{#if oda.digerleri.length}
      · Şu an açık: {oda.digerleri.map(d => kisiAdi(d.id)).join(", ")}{/if}
  </p>
  <p class="aciklama">
    Veriler ortak klasörde (<b>{giris.klasorAdi}</b>) şifreli durur; her sorumlu kendi kullanıcı adı ve şifresiyle girer. Her kayıt yazanın
    anahtarıyla imzalanır: kimin ne değiştirdiği girişten gelir, başkası adına kayıt yazılamaz. {OTURUM_SURE_DK} dakika işlem yapılmazsa oturum
    kapanır.
  </p>
  <ul class="roller">
    <li><b>Sorumlu:</b> çizelge, izin, puantaj, acil / öğlen / onay listeleri, gün notları.</li>
    <li><b>Baş sorumlu:</b> ayrıca personel, ayarlar, kurum bilgileri, servis listesi; yedekten yükleme ve kopyaya dönme.</li>
    <li>
      <b>Sahip:</b> hepsi; ayrıca kullanıcıları ekler, rollerini değiştirir, şifrelerini yeniler, kaldırır. Birden çok sahip olabilir.
    </li>
  </ul>
  <div class="dugmeler">
    <button class="dugme" onclick={() => cikisYap("Oturum kapatıldı.")}><Ikon ad="kapat" />Oturumu kapat</button>
  </div>

  {#if durum}<p class="kutu bilgi" role="status">{durum}</p>{/if}
  {#if hata}<p class="kutu hata" role="alert">{hata}</p>{/if}
  {#if bakimDurumu.calisiyor}
    <p class="aciklama" role="status">Kayıtlar yeni anahtar ve imzayla yenileniyor… %{Math.round(bakimDurumu.oran * 100)}</p>
  {:else if bakimDurumu.sonuc}<p class="aciklama" role="status">{bakimDurumu.sonuc}</p>{/if}

  <table class="tablo">
    <caption>Kullanıcılar</caption>
    <thead
      ><tr
        ><th scope="col">Ad</th><th scope="col">Kullanıcı adı</th><th scope="col">Rol</th>{#if kasaDurumu.sahip}<th scope="col">İşlem</th
          >{/if}</tr
      ></thead
    >
    <tbody>
      {#each kasaDurumu.kisiler.filter(k => k.durum === "aktif") as k (k.id)}
        <tr>
          <th scope="row">
            {#if adDuzenlenen?.id === k.id}
              <form
                class="satir"
                onsubmit={e => {
                  e.preventDefault();
                  const a = adDuzenlenen!;
                  void is(async () => {
                    await kullaniciAdiniDegistir(a.id, a.ad);
                    adDuzenlenen = null;
                  }, "Ad değiştirildi.");
                }}
              >
                <input class="girdi" bind:value={adDuzenlenen.ad} maxlength="60" aria-label="Ad" />
                <button class="dugme kucuk" disabled={mesgul}>Kaydet</button>
                <button class="dugme kucuk sade" type="button" onclick={() => (adDuzenlenen = null)}>Vazgeç</button>
              </form>
            {:else}{k.ad}{#if k.id === kasaDurumu.benId}
                (siz){/if}{/if}
          </th>
          <td>{k.kullaniciAdi}</td>
          <td>
            {#if kasaDurumu.sahip}
              <select
                class="girdi"
                aria-label="{k.ad} rolü"
                value={k.rol}
                disabled={mesgul}
                onchange={e => {
                  const r = e.currentTarget.value as KasaRol;
                  void is(() => kullaniciRolu(k.id, r), `${k.ad}: ${KASA_ROL_ADI[r]}.`);
                }}
                >{#each ROLLER as r}<option value={r}>{KASA_ROL_ADI[r]}</option>{/each}</select
              >
            {:else}{KASA_ROL_ADI[k.rol]}{/if}
          </td>
          {#if kasaDurumu.sahip}
            <td class="islem">
              <button class="dugme kucuk" onclick={() => (adDuzenlenen = { id: k.id, ad: k.ad })} disabled={mesgul}>Adı</button>
              {#if k.id !== kasaDurumu.benId}
                <button class="dugme kucuk" onclick={() => sifreYenile(k.id)} disabled={mesgul}>Şifre yenile</button>
                {#if kaldirilacak === k.id}
                  <span class="onay"
                    >{k.ad} kaldırılsın mı?
                    <button
                      class="dugme kucuk tehlike"
                      disabled={mesgul}
                      onclick={() => {
                        kaldirilacak = null;
                        void is(() => kullaniciyiKaldir(k.id), `${k.ad} kaldırıldı; veri anahtarı yenilendi.`);
                      }}>Kaldır</button
                    ><button class="dugme kucuk sade" onclick={() => (kaldirilacak = null)}>Vazgeç</button></span
                  >
                {:else}<button class="dugme kucuk" onclick={() => (kaldirilacak = k.id)} disabled={mesgul}>Kaldır</button>{/if}
              {/if}
              {#if sifreYenilenen?.id === k.id}
                <p class="gecici">Geçici şifre: <b class="rakam">{sifreYenilenen.sifre}</b> (kişi ilk girişte kendi şifresini belirler)</p>
              {/if}
            </td>
          {/if}
        </tr>
      {/each}
    </tbody>
  </table>
  {#if kasaDurumu.kisiler.some(k => k.durum === "kaldirildi")}
    <p class="aciklama">
      Kaldırılanlar: {kasaDurumu.kisiler
        .filter(k => k.durum === "kaldirildi")
        .map(k => k.ad)
        .join(", ")} (geçmişteki kayıtları ve adları kalır; giremezler).
    </p>
  {/if}

  {#if kasaDurumu.sahip}
    <details class="blok">
      <summary>Kullanıcı ekle</summary>
      <form class="form" onsubmit={ekle}>
        <label class="alan"><span>Adı soyadı</span><input class="girdi" bind:value={yAd} maxlength="60" /></label>
        <label class="alan"
          ><span>Kullanıcı adı</span><input class="girdi" bind:value={yKullanici} maxlength="32" spellcheck="false" /></label
        >
        <label class="alan"
          ><span>Rol</span><select class="girdi" bind:value={yRol}
            >{#each ROLLER as r}<option value={r}>{KASA_ROL_ADI[r]}</option>{/each}</select
          ></label
        >
        <label class="alan"
          ><span>Geçici şifre</span><input class="girdi rakam" bind:value={ySifre} spellcheck="false" /><small
            >Kişiye iletin; ilk girişte kendi şifresini belirler. En az {SIFRE_EN_AZ} karakter.</small
          ></label
        >
        <div class="dugmeler">
          <button class="dugme ana" disabled={mesgul || !yAd.trim() || !yKullanici.trim()}><Ikon ad="arti" />Ekle</button>
        </div>
      </form>
      {#if eklenen}
        <p class="kutu bilgi">
          {eklenen.ad}: kullanıcı adı <b>{eklenen.kullanici}</b>, geçici şifre <b class="rakam">{eklenen.sifre}</b>. Programı açınca aynı
          ortak klasörü seçip bu bilgilerle girer.
        </p>
      {/if}
    </details>
    <p class="aciklama">
      Görevden ayrılanı kaldırın: girişi hemen kapanır, açık oturumu birkaç saniyede kapanır ve veri anahtarı yenilenir (eski bir kasa
      kopyası saklamış olsa da bundan sonraki verileri açamaz). Şifresi başkasının eline geçtiyse de kaldırıp yeniden ekleyin. Ortak
      klasörün Windows paylaşım izninden de çıkarın: programdaki şifreleme verileri okumayı engeller, klasördeki dosyaları silmeyi
      engellemez.
    </p>
  {/if}

  <details class="blok">
    <summary>Şifremi değiştir</summary>
    <form class="form" onsubmit={sifreKaydet}>
      <label class="alan"
        ><span>Şu anki şifre</span><input class="girdi" type="password" bind:value={eski} autocomplete="current-password" /></label
      >
      <label class="alan"
        ><span>Yeni şifre</span><input class="girdi" type="password" bind:value={yeni} autocomplete="new-password" /></label
      >
      <label class="alan"
        ><span>Yeni şifre (tekrar)</span><input class="girdi" type="password" bind:value={yeni2} autocomplete="new-password" /></label
      >
      <div class="dugmeler"><button class="dugme ana" disabled={mesgul || !eski || !yeni}>Şifreyi değiştir</button></div>
    </form>
  </details>
</section>

<section class="kart panel-blok">
  <h2>Yedek klasörü (bu bilgisayar)</h2>
  <p class="aciklama">
    Ortak klasör her gün bir kez (bu bilgisayarda ilk girişte) seçtiğiniz başka bir klasöre kopyalanır: USB bellek ya da başka bir ağ
    klasörü. Kopyalar şifrelidir; son 30 gün tutulur. Ortak klasör bozulur ya da silinirse yedekten dönülür.
  </p>
  {#if yedekDurumu.hedef}
    <p>
      Yedek klasörü: <b>{yedekDurumu.hedef}</b>{#if yedekDurumu.liste[0]}
        · son yedek: {tarih(yedekDurumu.liste[0].z)} ({yedekDurumu.liste[0].dosya} dosya){/if}
    </p>
  {:else}<p>Bu bilgisayarda yedek klasörü seçilmedi.</p>{/if}
  {#if yedekDurumu.hata}<p class="kutu hata" role="alert">{yedekDurumu.hata}</p>{/if}
  <div class="dugmeler">
    <button class="dugme" onclick={yedekKlasoruSec} disabled={yedekDurumu.calisiyor}
      >{yedekDurumu.hedef ? "Yedek klasörünü değiştir" : "Yedek klasörü seç"}</button
    >
    {#if yedekDurumu.hedef}
      <button class="dugme" onclick={() => yedekAl(true)} disabled={yedekDurumu.calisiyor}
        ><Ikon ad="indir" />{yedekDurumu.calisiyor ? "Yedekleniyor…" : "Şimdi yedekle"}</button
      >
      <button class="dugme sade" onclick={yedekKlasorunuKaldir}>Yedeklemeyi kapat</button>
    {/if}
  </div>
  {#if yedekDurumu.liste.length}
    <details class="blok">
      <summary>Yedekler ({yedekDurumu.liste.length})</summary>
      <ul class="yedekler">
        {#each yedekDurumu.liste as y (y.gun)}
          <li>
            <span>{y.gun} · {tarih(y.z)} · {y.dosya} dosya</span>
            {#if donulecek === y.gun}
              <form class="satir" onsubmit={yedektenDon}>
                <input
                  class="girdi"
                  type="password"
                  bind:value={donusSifre}
                  placeholder="O günkü şifreniz"
                  aria-label="{y.gun} yedeği için şifreniz"
                  autocomplete="current-password"
                />
                <button class="dugme kucuk ana" disabled={mesgul || !donusSifre}>Bu yedeğe dön</button>
                <button class="dugme kucuk sade" type="button" onclick={() => (donulecek = null)}>Vazgeç</button>
              </form>
            {:else}
              <button
                class="dugme kucuk"
                disabled={!yonetimYetkisi()}
                title={yonetimYetkisi() ? "" : YONETIM_UYARISI}
                onclick={() => {
                  donulecek = y.gun;
                  donusSifre = "";
                }}><Ikon ad="geri" boyut={16} />Bu yedekteki verilere dön</button
              >
            {/if}
          </li>
        {/each}
      </ul>
      <p class="aciklama">
        Yedekteki kasa o günkü hâliyle açılır: kendi kullanıcı adınız ve o günkü şifrenizle. Dönüş de bir değişikliktir: herkes için geçerli
        olur ve geçmişe girer. Ortak klasör tümüyle kaybolduysa yedek klasörünün içindekileri yeni bir ortak klasöre kopyalayıp programda o
        klasörü seçin.
      </p>
    </details>
  {/if}
</section>

{#if kasaDurumu.sahip}
  <section class="kart panel-blok">
    <h2>Kurtarma anahtarı</h2>
    <p class="aciklama">
      Bütün sahiplerin şifresi unutulursa sahibin şifresi kurtarma anahtarıyla yenilenir (giriş ekranında "Şifremi unuttum"). Anahtar
      kaybolduysa ya da başkasının eline geçtiyse yenileyin: eskisi geçersiz olur.
    </p>
    {#if yeniKod}
      <p class="kod rakam">{yeniKod}</p>
      <div class="dugmeler">
        <button class="dugme" onclick={kodIndir}><Ikon ad="indir" />Dosyaya kaydet</button>
        <button class="dugme sade" onclick={() => (yeniKod = "")}>Kaydettim, gizle</button>
      </div>
    {:else}<button class="dugme" onclick={kodYenile} disabled={mesgul}>Yeni kurtarma anahtarı oluştur</button>{/if}
  </section>
{/if}

<style>
  .kullanicilar {
    display: grid;
    gap: var(--b3);
  }
  .roller {
    margin: 0;
    padding-left: 1.2em;
    font-size: var(--f-sm);
  }
  .dugmeler {
    display: flex;
    flex-wrap: wrap;
    gap: var(--b2);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--f-sm);
  }
  caption {
    text-align: left;
    font-weight: 600;
    margin-bottom: var(--b2);
  }
  th,
  td {
    padding: 6px var(--b2);
    border-bottom: 1px solid var(--cizgi-acik);
    text-align: left;
    vertical-align: top;
  }
  .islem {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .onay {
    display: inline-flex;
    gap: 6px;
    align-items: center;
  }
  .gecici {
    margin: 4px 0 0;
    flex-basis: 100%;
  }
  .form {
    display: grid;
    gap: var(--b3);
    margin-top: var(--b3);
  }
  .satir {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .blok summary {
    cursor: pointer;
    font-weight: 600;
  }
  .yedekler {
    list-style: none;
    margin: var(--b2) 0;
    padding: 0;
    display: grid;
    gap: 6px;
    font-size: var(--f-sm);
  }
  .yedekler li {
    display: flex;
    flex-wrap: wrap;
    gap: var(--b2);
    align-items: center;
    justify-content: space-between;
  }
  .kod {
    padding: var(--b3);
    border: 2px dashed var(--cizgi);
    border-radius: var(--r-kucuk);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-align: center;
  }
</style>
