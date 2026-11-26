<script lang="ts">
  import SayfaBasligi from "../ortak/SayfaBasligi.svelte";
  import Bilgi from "../ortak/Bilgi.svelte";
  import {
    depo,
    tumVeriyiSil,
    yedekVerisi,
    yedektenYukle,
    yuklemeOncesineDon,
    yuklemeOncesiVar,
    yedekAlindi,
    yedekIzi,
    AYAR_VARSAYILAN,
    AYAR_SINIR,
  } from "../../veri/depo.svelte";
  import { bulut } from "../../veri/bulut.svelte";
  import { kimlik, yonetimYetkisi, YONETIM_UYARISI } from "../../veri/kimlik.svelte";
  import { dosyaKaydet, hataMetni } from "../../disa/indir";
  import Ikon from "../ortak/Ikon.svelte";
  import Sekmeler from "../ortak/Sekmeler.svelte";
  import IslemSatiri from "../ortak/IslemSatiri.svelte";
  import Kisiler from "./Kisiler.svelte";
  import Kurallar from "./Kurallar.svelte";
  import Yardim from "./Yardim.svelte";
  import Gecmis from "./Gecmis.svelte";
  import AyarOnizleme from "./AyarOnizleme.svelte";
  import { ayarFarklari } from "../../veri/ayarAdlari";
  import type { Ayarlar } from "../../veri/tipler";
  import type { AyarGorunum } from "./sayfaTipleri";

  let { gorunum = $bindable("genel") }: { gorunum?: AyarGorunum } = $props();
  const GORUNUMLER = [
    {
      ad: "genel",
      baslik: "Genel",
      uzun: "Ayarlar",
      aciklama: "Kurum bilgileri, günlük ve acil eczane nöbet kuralları, puantaj ve yedek.",
    },
    {
      ad: "personel",
      baslik: "Personel",
      uzun: "Personel",
      aciklama:
        "Nöbet ve hazırlama tutan herkes. İşe yeni başlayan ya da ayrılan kişinin tarihlerini girin; o tarihlerin dışında görev yazılmaz.",
    },
    {
      ad: "kurallar",
      baslik: "Kurallar",
      uzun: "Kurallar",
      aciklama: "Programın nöbet, liste ve puantaj kuralları; başka bir yapay zekâya ya da yeni çalışana vermek için kopyalanabilir.",
    },
    {
      ad: "gecmis",
      baslik: "Geçmiş",
      uzun: "Değişiklik geçmişi",
      aciklama: "Ne zaman, kim, neyi değiştirdi; günlük otomatik kopyalar ve bir önceki güne dönüş.",
    },
    {
      ad: "yardim",
      baslik: "Yardım",
      uzun: "Nasıl yapılır",
      aciklama: "Programın günlük kullanımı adım adım: ilk kurulum, aylık listeler, haftalık listeler, ay içi izin ve değişimler.",
    },
  ] as const;
  const aktif = $derived(GORUNUMLER.find(g => g.ad === gorunum) ?? GORUNUMLER[0]);

  let durum = $state<{ tur: "tamam" | "hata"; metin: string } | null>(null);
  let silOnayi = $state(false);
  let dosyaGirdi = $state<HTMLInputElement>();

  async function yedekAl() {
    const t = new Date(),
      iki = (n: number) => String(n).padStart(2, "0");
    const ad = `nobet-cizelgesi-yedek-${t.getFullYear()}-${iki(t.getMonth() + 1)}-${iki(t.getDate())}.json`;
    try {
      const ok = await dosyaKaydet(ad, yedekVerisi(), "application/json");
      if (ok) yedekAlindi();
      durum = ok ? { tur: "tamam", metin: `Yedek kaydedildi: ${ad}` } : null;
    } catch (e) {
      durum = { tur: "hata", metin: hataMetni(e, "Yedek kaydedilemedi.") };
    }
  }
  // yedekten yükleme ya da sunucudan alma öncesindeki veri saklıysa geri dönülebilir
  let geriAlinabilir = $state(yuklemeOncesiVar());
  // Geçmiş sekmesinde kopyaya dönülmüş olabilir: Genel'e dönünce yeniden bakılır
  $effect(() => {
    if (gorunum === "genel") geriAlinabilir = yuklemeOncesiVar();
  });
  const sunucuda = $derived(bulut.durum === "esit" || bulut.durum === "gonderiliyor");
  // ayar önizlemesinin tabanı: kullanıcı ayarlara dokunmaya başladığı andaki ayarlar (bekleyen fark yoksa yenilenir;
  // böylece sayfa açıldıktan sonra sunucudan gelen ayarlar fark sayılmaz)
  let acilisAyari = $state<Ayarlar>($state.snapshot(depo.veri.settings) as Ayarlar);
  function ayarTabaniAl() {
    if (!ayarFarklari(acilisAyari, depo.veri.settings).length) acilisAyari = $state.snapshot(depo.veri.settings) as Ayarlar;
  }
  // tüm verileri silme yalnız kasanın sahibinde (ortak klasör kipinde, başka sorumlular da kullanırken)
  const silmeYetkisi = $derived(!kimlik.var || kimlik.rol === "sahip");
  async function dosyaSecildi(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    try {
      const r = yedektenYukle(await f.text());
      if (r.tamam) {
        geriAlinabilir = true;
        durum = {
          tur: r.atlanan ? "hata" : "tamam",
          metin: `Yedek yüklendi: ${depo.veri.staff.length} kişi, ${Object.keys(depo.veri.schedules).length} ay çizelgesi.${r.atlanan ? ` ${r.atlanan} kayıt okunamadı ve atlandı.` : ""}`,
        };
      } else durum = { tur: "hata", metin: r.hata };
    } catch (err) {
      console.error(err);
      durum = { tur: "hata", metin: "Dosya okunamadı." };
    } finally {
      if (dosyaGirdi) dosyaGirdi.value = "";
    }
  }
  function geriDon() {
    durum = yuklemeOncesineDon()
      ? { tur: "tamam", metin: "Önceki verilere dönüldü." }
      : { tur: "hata", metin: "Önceki veriler bulunamadı." };
    geriAlinabilir = false;
  }
  // gelişmiş kurallar
  type SayiAyari = keyof typeof AYAR_SINIR;
  const SAAT_AYARLARI: [SayiAyari, string, string][] = [
    [
      "nobetSuresi",
      "Nöbet süresi",
      "Puantajda nöbet günü bu kadar saat yazılır; fazla mesai bundan o günün ve ertesi günün mesaisi düşülerek bulunur.",
    ],
    ["mesai", "Günlük normal mesai", "Hafta içi normal mesai (arife ayrı)."],
    ["hazSaat", "Hazırlama süresi", "Tatil günü hazırlama görevi."],
  ];
  const OGLEN_AYARLARI: [SayiAyari, string][] = [
    ["oglenHE", "Pazartesi–Perşembe eczacı"],
    ["oglenHT", "Pazartesi–Perşembe tekniker"],
    ["oglenCE", "Cuma eczacı"],
    ["oglenCT", "Cuma tekniker"],
  ];
  function sayiYaz(k: SayiAyari, el: HTMLInputElement) {
    const [a, b, adim] = AYAR_SINIR[k],
      v = Number(el.value.replace(",", "."));
    const n = el.value === "" || !Number.isFinite(v) ? AYAR_VARSAYILAN[k] : Math.round(Math.max(a, Math.min(b, v)) / adim) * adim;
    depo.veri.settings[k] = n;
    el.value = String(n);
  }
  function varsayilanaDon() {
    for (const k of Object.keys(AYAR_SINIR) as SayiAyari[]) depo.veri.settings[k] = AYAR_VARSAYILAN[k];
    depo.veri.settings.thuHaftaSonu = AYAR_VARSAYILAN.thuHaftaSonu;
    depo.veri.settings.cumaEsles = AYAR_VARSAYILAN.cumaEsles;
    depo.veri.settings.hsTopla = AYAR_VARSAYILAN.hsTopla;
  }
  // sayı alanları: boş ya da sınır dışı değer kaydedilmez, sınıra çekilir
  const sinirla = (v: string, a: number, b: number, vars: number) => {
    const n = Math.round(Number(v));
    return v === "" || !Number.isFinite(n) ? vars : Math.max(a, Math.min(b, n));
  };
  function sil() {
    if (!silOnayi) {
      silOnayi = true;
      return;
    }
    tumVeriyiSil();
    silOnayi = false;
    geriAlinabilir = yuklemeOncesiVar();
    durum = {
      tur: "tamam",
      metin: `Tüm veriler silindi.${geriAlinabilir ? ' Yanlışlıkla sildiyseniz "Önceki verilere dön" ile geri alabilirsiniz.' : ""}`,
    };
  }
</script>

<SayfaBasligi konum={["Ayarlar", aktif.baslik]} baslik={aktif.uzun} aciklama={aktif.aciklama} />
<Sekmeler secenekler={GORUNUMLER} bind:secili={gorunum} etiket="Ayarlar" />
<IslemSatiri />

{#if gorunum === "personel"}
  <Kisiler gomulu />
{:else if gorunum === "kurallar"}
  <Kurallar />
{:else if gorunum === "yardim"}
  <Yardim />
{:else if gorunum === "gecmis"}
  <Gecmis />
{:else}
  {#if !yonetimYetkisi()}<p class="bant-yetki" role="note">
      Kurum bilgilerini ve ayarları görüntülüyorsunuz. {YONETIM_UYARISI}
    </p>{/if}
  <div class="bolumler" onfocusin={ayarTabaniAl}>
    <fieldset class="yetki-kap" disabled={!yonetimYetkisi()}>
      <section class="kart panel-blok bolum">
        <h2>Kurum</h2>
        <label class="alan"
          ><span>Kurum adı</span><input
            class="girdi"
            bind:value={depo.veri.kurum.ad}
            maxlength="80"
            placeholder="ör. Şehir Hastanesi Eczanesi"
          /><small>Çıktıların başlığında görünür.</small></label
        >
        <label class="alan"
          ><span>Onaylayan</span><input
            class="girdi"
            bind:value={depo.veri.kurum.onaylayan}
            maxlength="80"
            placeholder="ör. Sorumlu Eczacı Ayşe Yılmaz"
          /><small>Çizelge onaylanınca kayda geçer.</small></label
        >
      </section>

      <section class="kart panel-blok bolum">
        <h2>Günlük eczane nöbet kuralları</h2>
        <p class="aciklama">Günlük Eczane Nöbet Listesi ve hazırlama için.</p>
        <Bilgi baslik="Sabit kurallar"
          ><p>
            Nöbet ertesi gün izin, art arda iki gün nöbet yok, ayda en fazla 1 Cumartesi ve 1 Pazar nöbeti, kişiler arası fazla mesai farkı
            en çok 8 saat, hazırlama farkı en çok 1; yıl boyunca toplam nöbet, Perşembe, Cuma, Cumartesi, Pazar ve resmi tatil ayrı ayrı
            eşit.
          </p></Bilgi
        >
        <label class="alan"
          ><span>İki nöbet arasında önerilen en az gün</span>
          <select class="girdi" bind:value={depo.veri.settings.minAra}
            >{#each [2, 3, 4] as n}<option value={n}>{n} gün{n === AYAR_VARSAYILAN.minAra ? " (önerilen)" : ""}</option>{/each}</select
          >
          <small>Ardışık günler her zaman yasaktır; bu sınır yalnız tercih edilir.</small></label
        >
        <label class="alan"
          ><span>Destek personeli aylık hazırlama sayısı</span>
          <input
            class="girdi"
            type="number"
            min="0"
            max="8"
            value={depo.veri.settings.destekAylik}
            onchange={e => {
              depo.veri.settings.destekAylik = sinirla(e.currentTarget.value, 0, 8, AYAR_VARSAYILAN.destekAylik);
              e.currentTarget.value = String(depo.veri.settings.destekAylik);
            }}
          /></label
        >
      </section>

      <section class="kart panel-blok bolum">
        <h2>Acil eczane nöbet kuralları</h2>
        <p class="aciklama">Acil Eczane Nöbet Listesi için.</p>
        <Bilgi baslik="Sabit kurallar"
          ><p>
            Günde 2 nöbetçi, nöbet ertesi gün izin, art arda iki gün (kadro yetmezse aşağıdaki seçeneğe göre) ve 5 günde 3 nöbet yok, aynı
            ya da komşu günde günlük eczanede görevi olan yazılmaz, mümkünse ayda en fazla 1 Cumartesi ve 1 Pazar; her ay kişiler arası
            fazla mesai farkı mümkün olduğunca en çok 8 saat; yıl boyunca toplam nöbet, Perşembe, Cuma, Cumartesi, Pazar ve resmi tatil ayrı
            ayrı eşit (izinli / raporlu günler paydan düşülür).
          </p></Bilgi
        >
        <label class="alan"
          ><span>İki acil nöbeti arasında önerilen en az gün</span>
          <select class="girdi" bind:value={depo.veri.settings.acilMinAra}
            >{#each [2, 3, 4] as n}<option value={n}>{n} gün{n === AYAR_VARSAYILAN.acilMinAra ? " (önerilen)" : ""}</option>{/each}</select
          >
          <small>Bu sınır yalnız tercih edilir.</small></label
        >
        <label class="secim-satir"
          ><input type="checkbox" bind:checked={depo.veri.settings.acilArdArda} /><span
            ><b>Kadro yetmezse art arda acil nöbeti yazılsın</b><small
              >Açıkken her gün 2 kişi yazılır; kişi yetmezse bazıları art arda iki gün nöbet tutar (uyarılır). Kapalıyken art arda nöbet hiç
              yazılmaz; yetmeyen günler eksik kalır ve söylenir.</small
            ></span
          ></label
        >
      </section>

      <section class="kart panel-blok bolum">
        <h2>Puantaj</h2>
        <p class="aciklama">Günlük eczane ve acil eczane puantajı için.</p>
        <label class="alan"
          ><span>Arife günü normal mesai (saat)</span>
          <input
            class="girdi"
            type="number"
            min="0"
            max="8"
            value={depo.veri.settings.arifeSaat}
            onchange={e => {
              depo.veri.settings.arifeSaat = sinirla(e.currentTarget.value, 0, 8, AYAR_VARSAYILAN.arifeSaat);
              e.currentTarget.value = String(depo.veri.settings.arifeSaat);
            }}
          /></label
        >
      </section>

      <section class="kart panel-blok bolum genis-bolum">
        <h2>Gelişmiş kurallar</h2>
        <p class="aciklama">
          Kurumun çalışma düzeni değişirse. Değişiklik bundan sonra oluşturulan çizelgelere ve puantaja (geçmiş aylar dahil) yansır; mevcut
          çizelgeleri yeniden oluşturmanız gerekebilir.
        </p>
        <details class="gelismis">
          <summary>Gelişmiş kuralları göster</summary>
          <div class="izgara">
            <fieldset>
              <legend>Süreler (saat)</legend>
              {#each SAAT_AYARLARI as [k, ad, not]}
                <label class="alan"
                  ><span>{ad}</span><input
                    class="girdi"
                    type="number"
                    min={AYAR_SINIR[k][0]}
                    max={AYAR_SINIR[k][1]}
                    step={AYAR_SINIR[k][2]}
                    value={depo.veri.settings[k]}
                    onchange={e => sayiYaz(k, e.currentTarget)}
                  /><small>{not} Varsayılan {AYAR_VARSAYILAN[k]}.</small></label
                >
              {/each}
            </fieldset>
            <fieldset>
              <legend>Günlük eczane nöbeti</legend>
              <label class="alan"
                ><span>Kişiye ayda en fazla Perşembe nöbeti</span>
                <select class="girdi" bind:value={depo.veri.settings.maxThu}
                  >{#each [1, 2, 3, 99] as n}<option value={n}
                      >{n === 99 ? "Sınırsız" : n}{n === AYAR_VARSAYILAN.maxThu ? " (varsayılan)" : ""}</option
                    >{/each}</select
                ></label
              >
              <label class="alan"
                ><span>Kişiye ayda en fazla hafta sonu (Cumartesi + Pazar) nöbeti</span>
                <select class="girdi" bind:value={depo.veri.settings.hsUst}
                  >{#each [1, 2, 3, 4] as n}<option value={n}>{n}{n === AYAR_VARSAYILAN.hsUst ? " (varsayılan)" : ""}</option
                    >{/each}</select
                ><small>Ayda en fazla 1 Cumartesi ve 1 Pazar kuralı ayrıca geçerlidir.</small></label
              >
              <label class="secim-satir"
                ><input type="checkbox" bind:checked={depo.veri.settings.thuHaftaSonu} /><span
                  ><b>Perşembe nöbetçisi aynı hafta sonu görev almasın</b><small>Hazırlama yazılmaz, nöbet önerilmez.</small></span
                ></label
              >
              <label class="secim-satir"
                ><input type="checkbox" bind:checked={depo.veri.settings.cumaEsles} /><span
                  ><b>Cuma ile hafta sonu nöbeti eşleşsin</b><small
                    >Hafta sonu nöbeti olana aynı ay Cuma nöbeti de yazılmaya çalışılır.</small
                  ></span
                ></label
              >
              <label class="secim-satir"
                ><input type="checkbox" bind:checked={depo.veri.settings.hsTopla} /><span
                  ><b>Hafta sonu tek kişide toplanabilsin</b><small
                    >Cumartesi hazırlaması yapan, ertesi gün Pazar nöbetini de tutabilir; böylece başkalarının hafta sonu boş kalır.
                    Kapalıysa bu birleşim yalnız kadro yetmezse yazılır (gün kırmızı, uyarılı).</small
                  ></span
                ></label
              >
              <label class="alan"
                ><span>Elle düzenlemede fazla mesai sapma uyarısı (saat)</span><input
                  class="girdi"
                  type="number"
                  min={AYAR_SINIR.fmHedef[0]}
                  max={AYAR_SINIR.fmHedef[1]}
                  value={depo.veri.settings.fmHedef}
                  onchange={e => sayiYaz("fmHedef", e.currentTarget)}
                /><small>Kişinin fazla mesaisi ayın ortalamasından bu kadar saat saparsa gün penceresinde uyarılır.</small></label
              >
            </fieldset>
            <fieldset>
              <legend>Öğlen nöbeti (kişi sayısı)</legend>
              {#each OGLEN_AYARLARI as [k, ad]}
                <label class="alan"
                  ><span>{ad}</span><select class="girdi" bind:value={depo.veri.settings[k]}
                    >{#each Array.from({ length: AYAR_SINIR[k][1] + 1 }, (_, i) => i) as n}<option value={n}
                        >{n}{n === AYAR_VARSAYILAN[k] ? " (varsayılan)" : ""}</option
                      >{/each}</select
                  ></label
                >
              {/each}
              <small class="not">Var olan haftalar kendiliğinden değişmez; "Haftayı yeniden oluştur" ile yeni sayıya göre yazılır.</small>
            </fieldset>
            <fieldset>
              <legend>Puantaj</legend>
              <label class="alan"
                ><span>Nöbet izni hangi dilimden düşülsün</span>
                <select class="girdi" bind:value={depo.veri.settings.niDusum}
                  ><option value={1}>Önce 08:00–20:00 (varsayılan)</option><option value={2}>Önce 20:00–08:00</option></select
                >
                <small>Fazla mesainin gündüz / gece dilimlerine ayrılmasında.</small></label
              >
            </fieldset>
          </div>
          <button class="dugme sade" onclick={varsayilanaDon}>Gelişmiş kuralları varsayılana döndür</button>
        </details>
      </section>
    </fieldset>

    <AyarOnizleme acilis={acilisAyari} />

    <section class="kart panel-blok bolum">
      <h2>Yedek</h2>
      {#if sunucuda}
        <p class="aciklama">
          Veriler ortak klasörde şifreli durur; bütün sorumlular aynı verilerle çalışır. Klasörün kendisi için Ayarlar > Geçmiş > Yedek
          klasörü seçin. "Yedek al" dosyası şifresizdir: kaydettiğiniz yerde koruyun.
        </p>
      {:else}
        <p class="aciklama">
          Veriler yalnız bu tarayıcıda durur. Tarayıcı verisi silinirse kaybolur; düzenli yedek alın. Yedek dosyasıyla başka bir bilgisayara
          da taşıyabilirsiniz.
        </p>
      {/if}
      <div class="dugmeler">
        <button class="dugme ana" onclick={yedekAl}><Ikon ad="indir" />Yedek al</button>
        <button
          class="dugme"
          onclick={() => dosyaGirdi?.click()}
          disabled={!yonetimYetkisi()}
          title={yonetimYetkisi() ? "" : YONETIM_UYARISI}><Ikon ad="yukle" />Yedekten yükle</button
        >
        <input bind:this={dosyaGirdi} type="file" accept=".json,application/json" onchange={dosyaSecildi} hidden />
      </div>
      <p class="aciklama">
        {yedekIzi.son ? `Son yedek: ${new Date(yedekIzi.son).toLocaleDateString("tr-TR")}.` : "Bu tarayıcıdan henüz yedek alınmadı."} Bir haftadır
        yedek alınmadıysa sayfanın üstünde hatırlatılır.
      </p>
      {#if !yonetimYetkisi()}<p class="aciklama"><b>Yedekten yükleme ve önceki verilere dönme:</b> {YONETIM_UYARISI}</p>{/if}
      <p class="aciklama">
        Yedekten yükleme, bu tarayıcıdaki verilerin yerine geçer. Yanlış dosya seçerseniz hemen ardından önceki verilere dönebilirsiniz.
      </p>
      {#if geriAlinabilir}<div>
          <button class="dugme" onclick={geriDon} disabled={!yonetimYetkisi()}
            ><Ikon ad="yenile" />Önceki verilere dön (yükleme, sunucudan alma ya da silme öncesi)</button
          >
        </div>{/if}
    </section>

    <section class="kart panel-blok bolum tehlikeli">
      <h2>Tüm verileri sil</h2>
      <p class="aciklama">
        Personel, izinler, çizelgeler ve ayarlar bu tarayıcıdan{sunucuda ? " ve sunucudan" : ""} silinir. Sayfa açıkken Geri al ile, sayfa yenilendikten
        sonra da bu tarayıcıda "Önceki verilere dön" ile bir kez geri dönülebilir; yine de önce yedek alın.
      </p>
      {#if silmeYetkisi}
        <div class="dugmeler">
          <button class="dugme tehlike" onclick={sil}><Ikon ad="sil" />{silOnayi ? "Evet, hepsini sil" : "Tüm verileri sil"}</button>
          {#if silOnayi}<button class="dugme" onclick={() => (silOnayi = false)}>Vazgeç</button>{/if}
        </div>
      {:else}
        <p class="aciklama"><b>Tüm verileri yalnız sayfanın sahibi silebilir.</b></p>
      {/if}
    </section>
  </div>

  {#if durum}<p class="durum {durum.tur}" role="status">{durum.metin}</p>{/if}
{/if}

<style>
  .yetki-kap {
    display: contents;
  }
  .bant-yetki {
    padding: var(--b2) var(--b3);
    margin-bottom: var(--b3);
    border-radius: var(--r-kucuk);
    background: var(--vurgu-zemin);
    color: var(--vurgu);
    font-size: var(--f-sm);
    font-weight: 600;
  }
  .bolumler {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: var(--b4);
    align-items: start;
  }
  .bolum {
    padding: 0 var(--b4) var(--b4);
    display: grid;
    gap: var(--b4);
  }
  .bolum h2 {
    font-size: var(--f-lg);
  }
  .aciklama {
    font-size: var(--f-sm);
    color: var(--soluk);
  }
  .dugmeler {
    display: flex;
    flex-wrap: wrap;
    gap: var(--b2);
  }
  .tehlikeli h2 {
    color: var(--hata);
  }
  .durum {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    bottom: calc(96px + env(safe-area-inset-bottom, 0px));
    z-index: 30;
    max-width: min(560px, calc(100vw - 32px));
    padding: var(--b3) var(--b4);
    border-radius: var(--r);
    box-shadow: var(--golge);
    font-weight: 500;
  }
  .durum.tamam {
    background: var(--vurgu-zemin);
    color: var(--vurgu);
    border: 1px solid var(--vurgu);
  }
  .durum.hata {
    background: var(--hata-zemin);
    color: var(--hata);
    border: 1px solid var(--hata);
  }
  @media (min-width: 861px) {
    .durum {
      bottom: var(--b5);
    }
  }
  @media (max-width: 420px) {
    .bolumler {
      grid-template-columns: 1fr;
    }
    .bolum {
      padding: 0 var(--b4) var(--b4);
    }
  }
  .genis-bolum {
    grid-column: 1 / -1;
  }
  .gelismis summary {
    cursor: pointer;
    font-weight: 600;
    color: var(--lacivert);
    padding: var(--b2) 0;
  }
  .gelismis[open] summary {
    margin-bottom: var(--b3);
  }
  .izgara {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: var(--b4);
    margin-bottom: var(--b3);
  }
  .izgara fieldset {
    border: 1px solid var(--cizgi);
    border-radius: var(--r-kucuk);
    padding: var(--b3);
    display: grid;
    gap: var(--b3);
    align-content: start;
    min-width: 0;
  }
  .izgara legend {
    font-weight: 600;
    font-size: var(--f-sm);
    padding: 0 4px;
  }
  .secim-satir {
    display: flex;
    gap: var(--b2);
    align-items: flex-start;
    font-size: var(--f-sm);
  }
  .secim-satir input {
    margin-top: 3px;
    width: 18px;
    height: 18px;
    accent-color: var(--vurgu);
    flex: none;
  }
  .secim-satir span {
    display: grid;
    gap: 2px;
  }
  .secim-satir small,
  .not {
    color: var(--soluk);
    font-size: var(--f-xs);
  }
</style>
