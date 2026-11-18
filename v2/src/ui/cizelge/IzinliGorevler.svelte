<script lang="ts">
  // Çizelgede görevi olduğu gün görev yazılamaz hâle gelen kişiler (çizelgeden sonra izinli işaretlenen, eş durumu
  // "nöbetçi olmasın", puantajda izin / rapor, izin arası, ayrılış sonrası): her görev için yerine kimin yazılacağı
  // hemen sorulur. Adaylar İzin ve rapor ekranındakiyle aynı sırada (kurallara uyanlar önce, yerine tutma sırası).
  import { yerineAdaylarHesapla } from "../../motor";
  import { Baglam } from "../../motor/baglam";
  import { DURUM_AD } from "../../motor/sabitler";
  import { ayCizelgesi, depo, veriAnlik } from "../../veri/depo.svelte";
  import { goreviYerineYaz, type Gorev } from "../../veri/degisim.svelte";
  import { ROL_AD, type Kisi, type Rol } from "../../veri/tipler";
  import { gunMetni } from "../../veri/tarih";
  import Ikon from "../ortak/Ikon.svelte";

  let { kimler = () => true }: { kimler?: (k: Kisi) => boolean } = $props();
  type Aday = {
    id: number;
    ad: string;
    rol: string;
    engel: number;
    uyari: number;
    yerine: number;
    k: { engel: string[]; uyari: string[] };
  };
  type Satir = { gun: number; gorev: Gorev; id: number; ad: string; neden: string; adaylar: Aday[] };

  const y = $derived(depo.yil),
    m = $derived(depo.ay);
  const satirlar = $derived.by((): Satir[] => {
    const c = ayCizelgesi(y, m);
    if (!c) return [];
    const v = veriAnlik(),
      B = new Baglam(v),
      out: Satir[] = [];
    // görevi bir değişimle zaten başkasına geçmiş olanlar sorulmaz
    const devredilmis = (id: number, gun: number) =>
      depo.veri.degisimler.some(z => z.y === y && z.m === m && z.gun === gun && z.cik === id);
    const neden = (id: number, gun: number): string | null => {
      if (!B.kesinYasak(id, y, m, gun)) return null;
      const d = B.puantajDurumu(id, y, m, gun),
        t = B.tercih(id, y, m, gun),
        k = B.kisi(id);
      if (d) return DURUM_AD[d].toLocaleLowerCase("tr");
      if (t === "izinli") return "izinli";
      if (t === "esYok") return "eş durumu: nöbetçi olmasın";
      if (B.izinArasiMi(id, y, m, gun)) return "izin arasındaki tatil";
      if (B.izinHaftasiKenariMi(id, y, m, gun)) return "yıllık izin haftasının kenarındaki tatil";
      return k ? "çalışma dönemi dışında" : "görev yazılamaz";
    };
    for (const g of c.days) {
      const gorevler: [Gorev, { id: number; name: string; role: Rol }[]][] = [
        ["N", g.assigned],
        ["H", g.prep],
      ];
      for (const [gorev, l] of gorevler)
        for (const p of l) {
          const k = depo.veri.staff.find(s => s.id === p.id);
          if (!k || !kimler(k) || devredilmis(p.id, g.day)) continue;
          const n = neden(p.id, g.day);
          if (!n) continue;
          const adaylar = (yerineAdaylarHesapla(v, y, m, g.day, p.id, gorev, true) as Aday[]).slice(0, 12);
          out.push({ gun: g.day, gorev, id: p.id, ad: p.name, neden: n, adaylar });
        }
    }
    return out;
  });
  // seçimler: satır anahtarı → aday id ("" ise önerilen ilk kurala uyan)
  let secim = $state<Record<string, string>>({});
  const anahtar = (s: Satir) => `${s.gun}-${s.gorev}-${s.id}`;
  const oneri = (s: Satir) => s.adaylar.find(a => !a.engel) ?? s.adaylar[0];
  const secilen = (s: Satir) => s.adaylar.find(a => String(a.id) === secim[anahtar(s)]) ?? oneri(s);
  let durum = $state("");
  function yaz(s: Satir) {
    const a = secilen(s);
    if (!a) return;
    goreviYerineYaz(y, m, s.gun, s.id, a.id, s.gorev);
    durum = `${gunMetni(y, m, s.gun)}: ${s.ad} yerine ${a.ad} yazıldı (çizelge ve puantaj). Değişim geçmişinden geri alınabilir.`;
  }
</script>

{#if satirlar.length}
  <section class="kart izinli" aria-labelledby="izinli-baslik">
    <h2 id="izinli-baslik"><Ikon ad="uyari" boyut={16} />Görevi olduğu gün izinli / yazılamayan kişiler ({satirlar.length})</h2>
    <p class="aciklama">
      Çizelge oluşturulduktan sonra izin, rapor ya da eş durumu girildi. Her görev için yerine birini seçip yazın; seçilen kişi çizelgeye ve
      puantaja işlenir.
    </p>
    <ul>
      {#each satirlar as s (anahtar(s))}
        {@const a = secilen(s)}
        <li>
          <span class="kim"
            ><b>{gunMetni(y, m, s.gun)}</b> · {s.gorev === "N" ? "nöbet" : "hazırlama"} · {s.ad} <small>({s.neden})</small></span
          >
          {#if s.adaylar.length}
            <select
              class="girdi"
              aria-label="{s.ad} yerine"
              value={String(a?.id ?? "")}
              onchange={e => (secim[anahtar(s)] = e.currentTarget.value)}
            >
              {#each s.adaylar as x}<option value={String(x.id)}
                  >{x.ad} · {ROL_AD[x.rol as Rol] ?? x.rol}{x.engel ? " · kural dışı" : x.uyari ? " · uyarı var" : ""}{x.yerine
                    ? ` · yıl içinde ${x.yerine} kez yerine tuttu`
                    : ""}</option
                >{/each}
            </select>
            <button class="dugme ana" onclick={() => yaz(s)}>Yerine yaz</button>
            {#if a && (a.engel || a.uyari)}<small class="not">{[...a.k.engel, ...a.k.uyari].slice(0, 2).join(" ")}</small>{/if}
          {:else}<small>Yerine yazılabilecek kimse yok; günü elle düzenleyin.</small>{/if}
        </li>
      {/each}
    </ul>
    {#if durum}<p class="bant" role="status">{durum}</p>{/if}
  </section>
{:else if durum}
  <p class="bant" role="status">{durum}</p>
{/if}

<style>
  .izinli {
    border-left: 4px solid var(--dikkat);
    padding: var(--b4) var(--b5);
    margin-bottom: var(--b4);
    display: grid;
    gap: var(--b2);
  }
  .izinli h2 {
    display: flex;
    align-items: center;
    gap: var(--b2);
    font-size: var(--f-md);
    margin: 0;
    color: var(--lacivert);
  }
  .izinli h2 :global(svg) {
    color: var(--dikkat);
  }
  .aciklama {
    font-size: var(--f-sm);
    color: var(--soluk);
    margin: 0;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--b2);
  }
  li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--b2) var(--b3);
    padding: var(--b2) 0;
    border-top: 1px solid var(--cizgi);
  }
  .kim {
    flex: 1 1 260px;
    font-size: var(--f-sm);
  }
  .kim small {
    color: var(--soluk);
  }
  select {
    width: auto;
    max-width: 100%;
    flex: 1 1 220px;
  }
  .not {
    flex-basis: 100%;
    color: var(--soluk);
    font-size: var(--f-xs);
  }
</style>
