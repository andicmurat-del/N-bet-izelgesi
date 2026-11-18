<script lang="ts">
  // Günlük Eczane sayfası: alt sekmeler (görünümler) ve her görünümün bileşeni. Nöbet listesi: ../cizelge/NobetListesi.svelte.
  import { depo, ayCizelgesi } from "../../veri/depo.svelte";
  import { acilKadrosunda } from "../../motor";
  import { ayAdi } from "../../veri/tarih";
  import SayfaBasligi from "../ortak/SayfaBasligi.svelte";
  import Ikon from "../ortak/Ikon.svelte";
  import Hazirlama from "./Hazirlama.svelte";
  import Puantaj from "./Puantaj.svelte";
  import Izinler from "./Izinler.svelte";
  import Raporlar from "./Raporlar.svelte";
  import type { GunlukGorunum } from "./sayfaTipleri";
  import OglenNobeti from "../cizelge/OglenNobeti.svelte";
  import OnayListesi from "../cizelge/OnayListesi.svelte";
  import CalismaListesi from "../cizelge/CalismaListesi.svelte";
  import NobetListesi from "../cizelge/NobetListesi.svelte";
  import Sekmeler from "../ortak/Sekmeler.svelte";
  import KarsilamaResmi from "../ortak/KarsilamaResmi.svelte";

  // Günlük Eczane: nöbet listesi, çalışma listesi, öğlen nöbeti, hazırlama listesi, puantaj ve izinler alt sekmeleri
  // (acil eczane ayrı sayfada). gorunum dışarıdan da seçilebilir (başka sayfadan gelen bağlantı).
  let {
    git,
    gorunum = $bindable("nobet"),
  }: { git: (ad: "cizelge" | "puantaj" | "izinler" | "kisiler" | "ayarlar") => void; gorunum?: GunlukGorunum } = $props();

  const c = $derived(ayCizelgesi(depo.yil, depo.ay));

  // görünüm: eczane nöbet çizelgesi, günlük çalışma listesi ya da acil servis nöbetleri
  const GORUNUMLER = [
    {
      ad: "nobet",
      baslik: "Nöbet Listesi",
      uzun: "Günlük Eczane Nöbet Listesi",
      aciklama: "Ayın nöbet ve hafta sonu hazırlama görevleri; nöbet kuralları ve eşitlik kendiliğinden uygulanır.",
    },
    {
      ad: "liste",
      baslik: "Aylık Çalışma Listesi",
      uzun: "Aylık Çalışma Listesi",
      aciklama: "Puantaja göre her gün onayda, hazırlamada ve izinde olan personel.",
    },
    {
      ad: "oglen",
      baslik: "Öğlen Nöbet Listesi",
      uzun: "Öğlen Nöbet Listesi",
      aciklama: "Hafta içi öğle arası nöbetçi eczacı ve teknikerler; yıl boyunca eşit dağıtılır.",
    },
    {
      ad: "onay",
      baslik: "Onay Listesi",
      uzun: "Onay Listesi",
      aciklama: "Haftalık onay masaları ve jokerler: yerler her gün değişir, yıl boyunca herkes her masaya eşit oturur.",
    },
    {
      ad: "hazirlama",
      baslik: "Hazırlama Listesi",
      uzun: "Hazırlama Listesi",
      aciklama: "O gün çalışan teknikerlere servisler zorluk ve hasta sayısına göre dengeli dağıtılır.",
    },
    {
      ad: "puantaj",
      baslik: "Puantaj",
      uzun: "Puantaj Cetveli",
      aciklama: "Gerçekleşen çalışma: nöbet, hazırlama, nöbet ertesi izin, yıllık izin ve rapor; fazla mesai hesabı.",
    },
    {
      ad: "izinler",
      baslik: "İzinler",
      uzun: "İzinler ve Tercihler",
      aciklama: "İzinli günler, nöbet istekleri, eş durumu, resmi tatil ve arife işaretleri.",
    },
    {
      ad: "raporlar",
      baslik: "Raporlar",
      uzun: "Günlük Eczane Raporları",
      aciklama: "Yıllık fazla mesai, görev dağılımı, denge, öğlen nöbeti ve servis hazırlama (günlük eczane kadrosu).",
    },
  ] as const;
  const aktif = $derived(GORUNUMLER.find(g => g.ad === gorunum) ?? GORUNUMLER[0]);
</script>

<SayfaBasligi konum={["Günlük Eczane", aktif.baslik]} baslik={aktif.uzun} aciklama={aktif.aciklama} />

{#if !depo.veri.staff.length}
  <section class="kart karsilama">
    <div class="metin">
      <h2>Nöbet çizelgesine hoş geldiniz</h2>
      <p>
        Çizelge üç adımda hazırlanır: personeli girin, izinleri ve tatil günlerini işaretleyin, sonra "Çizelgeyi oluştur"a basın. Kurallar
        (nöbet ertesi izin, hafta sonu sınırları, fazla mesai eşitliği) kendiliğinden uygulanır.
      </p>
      <ol class="adimlar">
        <li><b>Personel</b><span>Eczacı, tekniker ve destek personeli</span></li>
        <li><b>İzin ve tercihler</b><span>İzinli günler, resmi tatiller, istekler</span></li>
        <li><b>Çizelge</b><span>Oluştur, gözden geçir, onayla</span></li>
      </ol>
      <div class="dugmeler">
        <button class="dugme ana" onclick={() => git("kisiler")}><Ikon ad="kisiler" />Personel ekle</button>
      </div>
    </div>
    <div class="resim"><KarsilamaResmi /></div>
  </section>
{:else}
  <Sekmeler secenekler={GORUNUMLER} bind:secili={gorunum} etiket="Görünüm" telefonSutun={2} />

  {#if gorunum === "raporlar"}
    <Raporlar bolum="gunluk" />
  {:else if gorunum === "hazirlama"}
    <Hazirlama {git} />
  {:else if gorunum === "puantaj"}
    <Puantaj {git} kimler={k => !acilKadrosunda(k)} />
  {:else if gorunum === "izinler"}
    <Izinler {git} kimler={k => !acilKadrosunda(k)} />
  {:else if gorunum === "onay"}
    <OnayListesi />
  {:else if gorunum === "oglen"}
    <OglenNobeti git={ad => (ad === "nobet" || ad === "onay" ? (gorunum = ad) : git(ad))} />
  {:else if gorunum === "liste"}
    {#if c}<CalismaListesi />
    {:else}
      <section class="kart bos-ay">
        <h2>{ayAdi(depo.yil, depo.ay)} çizelgesi henüz yok</h2>
        <p>Çalışma listesi bu ayın nöbet çizelgesi ve puantajından hazırlanır. Önce çizelgeyi oluşturun.</p>
        <div class="dugmeler">
          <button class="dugme ana" onclick={() => (gorunum = "nobet")}><Ikon ad="takvim" />Günlük Eczane Nöbet Listesi</button>
        </div>
      </section>
    {/if}
  {:else}
    <NobetListesi {git} />
  {/if}
{/if}

<style>
  .karsilama {
    padding: var(--b6);
    display: grid;
    grid-template-columns: minmax(0, 1fr) 300px;
    gap: var(--b6);
    align-items: center;
    max-width: 1040px;
    border-top: 3px solid var(--vurgu);
  }
  .karsilama .metin {
    display: grid;
    gap: var(--b4);
  }
  .karsilama .resim {
    padding: var(--b3);
  }
  .karsilama p {
    color: var(--yazi-2);
    max-width: 64ch;
  }
  .adimlar {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--b3);
    counter-reset: adim;
  }
  .adimlar li {
    counter-increment: adim;
    display: grid;
    align-content: start;
    gap: 2px;
    padding: var(--b3) var(--b4);
    border: 1px solid var(--cizgi);
    border-radius: var(--r);
    background: var(--yuzey-2);
  }
  .adimlar li::before {
    content: counter(adim);
    font-family: var(--yazi-rakam);
    font-size: var(--f-xs);
    color: var(--vurgu);
    font-weight: 600;
  }
  .adimlar span {
    font-size: var(--f-sm);
    color: var(--soluk);
  }
  .dugmeler {
    display: flex;
    flex-wrap: wrap;
    gap: var(--b2);
    align-items: center;
  }
  .bos-ay {
    padding: var(--b5);
    display: grid;
    gap: var(--b3);
    max-width: 760px;
  }
  .bos-ay p {
    color: var(--yazi-2);
  }
  @media (max-width: 720px) {
    .karsilama {
      padding: var(--b5) var(--b4);
      grid-template-columns: minmax(0, 1fr);
    }
    .karsilama .resim {
      order: -1;
      max-width: 260px;
      margin: 0 auto;
      padding: 0;
    }
    .adimlar {
      grid-template-columns: 1fr;
    }
  }
</style>
