<script lang="ts">
  // Nöbet listesini personele göndermek için metin: ayın tüm listesi ya da bir kişinin bu ayki görevleri (nöbet, acil
  // nöbeti, hazırlama, öğlen nöbeti). Kopyalanır ya da telefonun paylaş menüsüyle (WhatsApp vb.) gönderilir.
  import { depo, aydaCalisanlar, tatilMi } from "../../veri/depo.svelte";
  import { puantajIzgarasi } from "../../veri/degisim.svelte";
  import { ayListesiMetni, kisiGorevMetni } from "../../veri/paylasim";
  import type { AyCizelgesi } from "../../veri/tipler";
  import { ROL_AD } from "../../veri/tipler";
  import Pencere from "../ortak/Pencere.svelte";
  import Ikon from "../ortak/Ikon.svelte";

  let { acik = $bindable(false), c }: { acik?: boolean; c: AyCizelgesi } = $props();
  let kim = $state("tum");
  const kisiler = $derived(
    aydaCalisanlar(c.year, c.month)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "tr")),
  );
  const metin = $derived.by(() => {
    if (kim === "tum") return ayListesiMetni(c, depo.veri.kurum.ad, d => tatilMi(c.year, c.month, d));
    const k = kisiler.find(x => String(x.id) === kim);
    const r = k && puantajIzgarasi(c.year, c.month).satirlar.find(x => x.s.id === k.id);
    return k ? kisiGorevMetni(depo.veri, c.year, c.month, k, r ? r.cells : []) : "";
  });
  const paylasVar = typeof navigator !== "undefined" && typeof navigator.share === "function";
  let durum = $state("");
  $effect(() => {
    kim;
    durum = "";
  });
  async function kopyala() {
    try {
      await navigator.clipboard.writeText(metin);
      durum = "Kopyalandı; mesaja yapıştırabilirsiniz.";
    } catch {
      const a = document.createElement("textarea");
      a.value = metin;
      document.body.appendChild(a);
      a.select();
      try {
        durum = document.execCommand("copy") ? "Kopyalandı; mesaja yapıştırabilirsiniz." : "Kopyalanamadı.";
      } catch {
        durum = "Kopyalanamadı.";
      }
      a.remove();
    }
  }
  async function paylas() {
    try {
      await navigator.share({ text: metin });
      durum = "";
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") durum = "Paylaşılamadı; Kopyala ile deneyin.";
    }
  }
</script>

<Pencere bind:acik baslik="Personelle paylaş" altBaslik="Mesaj olarak gönderilecek metin">
  <label class="alan"
    ><span>Ne paylaşılsın</span>
    <select class="girdi" bind:value={kim}>
      <option value="tum">Ayın tüm nöbet listesi</option>
      <optgroup label="Bir kişinin bu ayki görevleri"
        >{#each kisiler as k}<option value={String(k.id)}>{k.name} · {ROL_AD[k.role]}</option>{/each}</optgroup
      >
    </select>
    <small
      >Kişi seçilirse nöbet değişimleri işlenmiş hâli (puantaja göre) yazılır: nöbet, acil eczane nöbeti, hazırlama ve öğlen nöbeti.</small
    >
  </label>
  <textarea class="girdi metin" readonly rows="14" aria-label="Paylaşılacak metin">{metin}</textarea>
  {#if durum}<p class="durum" role="status">{durum}</p>{/if}
  {#snippet altlik()}
    <span style="flex:1"></span>
    <button class="dugme" onclick={() => (acik = false)}>Kapat</button>
    {#if paylasVar}<button class="dugme" onclick={paylas}>Paylaş…</button>{/if}
    <button class="dugme ana" onclick={kopyala}><Ikon ad="tamam" />Kopyala</button>
  {/snippet}
</Pencere>

<style>
  .metin {
    font-family: inherit;
    font-size: var(--f-sm);
    line-height: 1.45;
    resize: vertical;
    white-space: pre;
    overflow: auto;
    min-height: 220px;
  }
  .durum {
    font-size: var(--f-sm);
    color: var(--vurgu);
  }
</style>
