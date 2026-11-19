<script lang="ts">
  import type { Kisi } from "../../veri/tipler";
  import { depo, aydaCalisanlar, ayCizelgesi } from "../../veri/depo.svelte";
  import IslemAlani from "../ortak/IslemAlani.svelte";
  import Ikon from "../ortak/Ikon.svelte";
  import IzinliGorevler from "../cizelge/IzinliGorevler.svelte";
  import IzinTablosu from "../izinler/IzinTablosu.svelte";
  import TatilIsaretleri from "../izinler/TatilIsaretleri.svelte";

  // kimler: listelenecek kişiler (o kadronun
  // nöbet tutanları); onayKilidi: eczane çizelgesi onaylıysa işaretler kilitlensin mi (acil listesinde onay yok)
  let {
    git,
    kimler = () => true,
    onayKilidi = true,
  }: {
    git: (ad: "cizelge" | "puantaj" | "izinler" | "kisiler" | "ayarlar") => void;
    kimler?: (k: Kisi) => boolean;
    onayKilidi?: boolean;
  } = $props();

  type Mod = "kisi" | "tatil";
  let mod = $state<Mod>("kisi");
  const kisiler = $derived(
    aydaCalisanlar(depo.yil, depo.ay)
      .filter(k => kimler(k))
      .sort((a, b) => a.name.localeCompare(b.name, "tr")),
  );

  const onayli = $derived(onayKilidi && !!ayCizelgesi(depo.yil, depo.ay)?.onay);
</script>

{#if !depo.veri.staff.length}
  <div class="kart bos-durum">
    <h2>Önce personel ekleyin</h2>
    <p>İzin ve tercih işaretlemek için personel listesinde en az bir kişi olmalı.</p>
    <button class="dugme ana" onclick={() => git("kisiler")}>Personel ekle</button>
  </div>
{:else}
  <IslemAlani>
    <div class="secim" role="tablist" aria-label="İşaret türü">
      <button role="tab" aria-selected={mod === "kisi"} onclick={() => (mod = "kisi")}>Kişi izinleri ve tercihler</button>
      <button role="tab" aria-selected={mod === "tatil"} onclick={() => (mod = "tatil")}>Resmi tatil ve arife</button>
    </div>
  </IslemAlani>

  <p class="kutu bilgi kullanim">
    <Ikon ad="bilgi" boyut={16} /><span
      >Bir işaret türü seçip {mod === "kisi" ? "tablodaki hücrelere" : "takvimdeki günlere"} dokunun; bilgisayarda fareyle basılı tutup gezdirerek
      birden çok güne işaretleyebilirsiniz; telefonda "Aralık seç" ile başlangıç ve bitiş gününe dokunun. Aynı işarete yeniden dokunmak kaldırır.
      Tercihler çizelge oluşturulurken dikkate alınır. Çizelge zaten varsa, görevli olduğu güne izin girilen kişinin yerine kimin yazılacağı burada
      sorulur.</span
    >
  </p>
  {#if onayli}<p class="kutu dikkat onay-not" role="status">
      Bu ayın çizelgesi onaylı; işaretler değiştirilemez. Değiştirmek için önce Günlük Eczane Nöbet Listesi'nde onayı kaldırın.
    </p>{/if}
  <IzinliGorevler {kimler} />

  {#if mod === "kisi"}
    <IzinTablosu {kisiler} {onayli} />
  {:else}
    <TatilIsaretleri {onayli} />
  {/if}
{/if}

<style>
  .bos-durum {
    padding: var(--b6);
    display: grid;
    gap: var(--b3);
    justify-items: start;
  }
  .bos-durum p {
    color: var(--yazi-2);
  }
  .kullanim {
    display: flex;
    gap: var(--b2);
    align-items: flex-start;
    margin-bottom: var(--b4);
  }
  .kullanim :global(svg) {
    flex: none;
    margin-top: 2px;
    color: var(--bilgi);
  }
  .onay-not {
    margin-bottom: var(--b4);
    font-weight: 600;
  }
  /* işaretler: izinli koyu gri, izin arası çizgili, istiyor açık mavi, istemiyor açık turuncu */
  /* telefonda dokunma hedefi en az 28 px */
</style>
