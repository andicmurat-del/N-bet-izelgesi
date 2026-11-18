<script lang="ts" module>
  // seçili kişi sekme değişince korunur
  const secim = $state<{ id: number | null }>({ id: null });
  /** takvim hücresindeki bir iş */
  type Is = { tur: "nobet" | "acil" | "haz" | "oglen" | "izin" | "ni" | "istek"; yazi: string };
</script>

<script lang="ts">
  // Günlük Eczane > Kişi Takvimi: bir kişinin ayın bütün görevleri tek takvimde (eczane nöbeti, acil eczane nöbeti,
  // hazırlama, öğlen nöbeti, izin ve rapor, nöbet istekleri). Görevler puantajdan okunur: yapılmış nöbet değişimleri ve
  // ay içi izinler işlenmiş hâlidir. Telefonda yalnız görevli olunan günler liste olarak görünür.
  import { puantajIzgarasi } from "../../veri/degisim.svelte";
  import { aydaCalisanlar, depo, resmiTatilMi, tercihAl } from "../../veri/depo.svelte";
  import { kisiGorevMetni } from "../../veri/paylasim";
  import { AYLAR, GUN_KISA, gunMetni, gunSayisi, haftaGunu, haftaSonuMu } from "../../veri/tarih";
  import { ROL_AD, type Tercih } from "../../veri/tipler";
  import Ikon from "../ortak/Ikon.svelte";

  const y = $derived(depo.yil),
    m = $derived(depo.ay);
  const GRUP_SIRA: Record<string, number> = { eczaci: 0, nobetci: 1, teknisyen: 2, destek: 3, servis: 4 };
  const kisiler = $derived(
    aydaCalisanlar(y, m)
      .slice()
      .sort((a, b) => (GRUP_SIRA[a.role] ?? 9) - (GRUP_SIRA[b.role] ?? 9) || a.name.localeCompare(b.name, "tr")),
  );
  const kisi = $derived(kisiler.find(k => k.id === secim.id) ?? kisiler[0]);
  const satir = $derived(kisi ? puantajIzgarasi(y, m).satirlar.find(r => r.s.id === kisi.id) : undefined);

  const IZIN: Record<string, string> = { YI: "Yıllık izin", R: "Rapor", DI: "Diğer izin" };
  const ISTEK: Partial<Record<Tercih, string>> = {
    want: "Nöbet istiyor",
    avoid: "Nöbet istemiyor",
    esVar: "Eş nöbetçi olsun",
    esYok: "Eş nöbetçi olmasın",
  };
  const gunler = $derived.by(() => {
    const n = gunSayisi(y, m),
      oglen = depo.veri.oglen[`${y}-${m}`] ?? {};
    return Array.from({ length: n }, (_, i) => {
      const d = i + 1,
        l: Is[] = [];
      const h = satir?.cells[i];
      if (h?.kod === "N") l.push(h.acil ? { tur: "acil", yazi: "Acil eczane nöbeti" } : { tur: "nobet", yazi: "Nöbet" });
      else if (h?.kod === "H") l.push({ tur: "haz", yazi: "Hazırlama" });
      else if (h && IZIN[h.kod]) l.push({ tur: "izin", yazi: IZIN[h.kod] });
      else if (h?.kod === "NI") l.push({ tur: "ni", yazi: "Nöbet izni" });
      const og = oglen[d];
      if (kisi && og && (og.e.includes(kisi.id) || og.t.includes(kisi.id))) l.push({ tur: "oglen", yazi: "Öğlen nöbeti" });
      const t = kisi ? tercihAl(kisi.id, y, m, d) : undefined;
      if (t === "izinli" && !l.some(x => x.tur === "izin")) l.push({ tur: "izin", yazi: "İzinli" });
      else if (t && ISTEK[t]) l.push({ tur: "istek", yazi: ISTEK[t]! });
      return { d, dw: haftaGunu(y, m, d), tatil: haftaSonuMu(y, m, d) || resmiTatilMi(y, m, d), isler: l };
    });
  });
  const say = $derived.by(() => {
    const s = { nobet: 0, acil: 0, haz: 0, oglen: 0, izin: 0 };
    for (const g of gunler) for (const x of g.isler) if (x.tur !== "istek" && x.tur !== "ni") s[x.tur]++;
    return s;
  });
  const bugun = new Date();
  const bugunMu = (d: number) => bugun.getFullYear() === y && bugun.getMonth() === m && bugun.getDate() === d;

  // dar ekran: takvim yerine görevli olunan günlerin listesi
  const DAR = "(max-width: 720px)";
  let dar = $state(typeof matchMedia !== "undefined" && matchMedia(DAR).matches);
  $effect(() => {
    const mq = matchMedia(DAR),
      degis = () => (dar = mq.matches);
    mq.addEventListener("change", degis);
    return () => mq.removeEventListener("change", degis);
  });

  let durum = $state("");
  $effect(() => {
    void [y, m, kisi?.id];
    durum = "";
  });
  async function kopyala() {
    if (!kisi) return;
    try {
      await navigator.clipboard.writeText(kisiGorevMetni(depo.veri, y, m, kisi, satir ? satir.cells : []));
      durum = "Görevler metin olarak kopyalandı; mesaja yapıştırabilirsiniz.";
    } catch {
      durum = "Kopyalanamadı; Nöbet Listesi > Dışa aktar > Paylaş ile metni seçip kopyalayın.";
    }
  }
</script>

{#snippet isler(l: Is[])}
  {#each l as x}<span class="is {x.tur}">{x.yazi}</span>{/each}
{/snippet}

{#if !kisi}
  <section class="kart bos">
    <h2>{AYLAR[m]} {y} için personel yok</h2>
    <p>Kişi takvimi için Ayarlar > Personel'den kişi ekleyin.</p>
  </section>
{:else}
  <section class="panel">
    <div class="panel-bas">
      <h2>{kisi.name} · {AYLAR[m]} {y}</h2>
      <div class="sag">
        <select class="girdi" aria-label="Kişi" value={kisi.id} onchange={e => (secim.id = Number(e.currentTarget.value))}>
          {#each kisiler as k (k.id)}<option value={k.id}>{k.name} · {ROL_AD[k.role]}</option>{/each}
        </select>
        <button class="dugme" onclick={kopyala} title="Bu ayki görevleri mesaj metni olarak kopyala"
          ><Ikon ad="liste" />Metni kopyala</button
        >
      </div>
    </div>
    <div class="ozet">
      <span><b class="rakam">{say.nobet}</b> nöbet</span>
      {#if say.acil}<span><b class="rakam">{say.acil}</b> acil nöbeti</span>{/if}
      <span><b class="rakam">{say.haz}</b> hazırlama</span>
      <span><b class="rakam">{say.oglen}</b> öğlen</span>
      <span><b class="rakam">{say.izin}</b> gün izin / rapor</span>
      {#if satir}<span><b class="rakam">{satir.fm}</b> sa fazla mesai</span>{/if}
    </div>
    {#if durum}<p class="bant" role="status">{durum}</p>{/if}

    {#if dar}
      <ul class="gundem">
        {#each gunler.filter(g => g.isler.length) as g (g.d)}
          <li class:tatil={g.tatil} class:bugun={bugunMu(g.d)}>
            <span class="tarih">{gunMetni(y, m, g.d)}</span>
            <span class="liste">{@render isler(g.isler)}</span>
          </li>
        {:else}
          <li class="soluk">Bu ay görev ya da izin yok.</li>
        {/each}
      </ul>
    {:else}
      <div class="takvim" role="grid" aria-label="{kisi.name}, {AYLAR[m]} {y} takvimi">
        {#each GUN_KISA as g}<div class="bas-hucre" role="columnheader">{g}</div>{/each}
        {#each Array.from({ length: gunler[0].dw }) as _, i (i)}<div class="hucre bos-hucre" aria-hidden="true"></div>{/each}
        {#each gunler as g (g.d)}
          <div
            class="hucre"
            class:tatil={g.tatil}
            class:bugun={bugunMu(g.d)}
            class:dolu={g.isler.length}
            role="gridcell"
            aria-label="{gunMetni(y, m, g.d)}: {g.isler.map(x => x.yazi).join(', ') || 'görev yok'}"
          >
            <span class="no rakam">{g.d}</span>
            {@render isler(g.isler)}
          </div>
        {/each}
      </div>
    {/if}
    <p class="lejant">
      <span class="is nobet">Nöbet</span><span class="is acil">Acil eczane nöbeti</span><span class="is haz">Hazırlama</span><span
        class="is oglen">Öğlen nöbeti</span
      ><span class="is izin">İzin / rapor</span><span class="is ni">Nöbet izni</span><span class="is istek">Nöbet isteği</span>
    </p>
  </section>
{/if}

<style>
  .sag {
    display: flex;
    flex-wrap: wrap;
    gap: var(--b2);
    align-items: center;
  }
  .sag select {
    width: auto;
    min-width: 220px;
  }
  .ozet {
    display: flex;
    flex-wrap: wrap;
    gap: var(--b2) var(--b4);
    padding: var(--b3) var(--b4);
    border-bottom: 1px solid var(--cizgi);
    font-size: var(--f-sm);
    color: var(--yazi-2);
  }
  .ozet b {
    color: var(--lacivert);
    font-size: var(--f-md);
  }
  .bant {
    margin: var(--b3) var(--b4) 0;
    padding: var(--b2) var(--b3);
    border-radius: var(--r-kucuk);
    background: var(--vurgu-zemin);
    color: var(--vurgu);
    font-size: var(--f-sm);
    font-weight: 600;
  }
  .takvim {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 4px;
    padding: var(--b3) var(--b4);
  }
  .bas-hucre {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--yazi-2);
    padding: 0 4px;
  }
  .hucre {
    min-height: 84px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 3px;
    padding: 6px;
    border: 1px solid var(--cizgi);
    border-radius: var(--r-kucuk);
    background: var(--yuzey);
  }
  .bos-hucre {
    border-style: dashed;
    background: transparent;
  }
  .hucre.tatil {
    background: color-mix(in srgb, var(--acik-mavi) 14%, var(--yuzey));
  }
  .hucre.bugun {
    border-color: var(--altin);
    box-shadow: inset 0 0 0 1px var(--altin);
  }
  .no {
    font-weight: 700;
    color: var(--lacivert);
    font-size: var(--f-sm);
  }
  .is {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 3px;
    font-size: var(--f-xs);
    font-weight: 600;
    line-height: 1.5;
  }
  .is.nobet {
    background: var(--lacivert);
    color: #fff;
  }
  .is.acil {
    background: var(--hata);
    color: #fff;
  }
  .is.haz {
    background: color-mix(in srgb, var(--haz) 22%, var(--yuzey));
    color: var(--yazi);
  }
  .is.oglen {
    background: var(--vurgu-zemin);
    color: var(--vurgu);
  }
  .is.izin {
    background: color-mix(in srgb, var(--izin) 16%, var(--yuzey));
    color: var(--izin);
  }
  .is.ni,
  .is.istek {
    background: var(--yuzey-2);
    color: var(--yazi-2);
  }
  .gundem {
    list-style: none;
    margin: 0;
    padding: var(--b3);
    display: grid;
    gap: 6px;
  }
  .gundem li {
    display: grid;
    gap: 4px;
    padding: var(--b2) var(--b3);
    border: 1px solid var(--cizgi);
    border-radius: var(--r-kucuk);
  }
  .gundem li.tatil {
    background: color-mix(in srgb, var(--acik-mavi) 14%, var(--yuzey));
  }
  .gundem li.bugun {
    border-color: var(--altin);
  }
  .gundem .tarih {
    font-weight: 700;
    color: var(--lacivert);
    font-size: var(--f-sm);
  }
  .gundem .liste {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .soluk {
    color: var(--soluk);
  }
  .lejant {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 0 var(--b4) var(--b3);
  }
  .bos {
    padding: var(--b5);
    display: grid;
    gap: var(--b2);
    max-width: 760px;
  }
  @media (max-width: 720px) {
    .sag,
    .sag select {
      width: 100%;
    }
  }
</style>
