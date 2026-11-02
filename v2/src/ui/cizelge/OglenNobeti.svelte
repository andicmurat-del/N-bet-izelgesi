<script lang="ts">
  // Öğlen nöbeti: hafta içi öğle arasında eczanede kalanlar (Pzt–Prş 2 eczacı + 1 tekniker, Cuma 3 eczacı + 2 tekniker).
  // O günün çalışma listesinden (puantaj) yazılır; yıl boyunca toplam ve Cuma sayısı eşit tutulur.
  import { depo, aydaCalisanlar, ayCizelgesi, oglenAyi, oglenKaydet, oglenAyiniSil, oglenGunuAyarla } from "../../veri/depo.svelte";
  import { OGLEN_GEREK, oglenGrubu, oglenHesapla, oglenYillikHesapla, puantajHesapla } from "../../motor";
  import { AYLAR, GUN_UZUN, ayAdi, gunMetni, gunSayisi, haftaGunu } from "../../veri/tarih";
  import { dosyaKaydet, hataMetni } from "../../disa/indir";
  import Pencere from "../ortak/Pencere.svelte";
  import type { Rol } from "../../veri/tipler";
  import Ikon from "../ortak/Ikon.svelte";

  let { git }: { git: (ad: "kisiler" | "nobet") => void } = $props();

  const y = $derived(depo.yil), m = $derived(depo.ay);
  const c = $derived(ayCizelgesi(y, m));
  const kayit = $derived(oglenAyi(y, m));
  const ad = (id: number) => depo.veri.staff.find(k => k.id === id)?.name ?? "(silinmiş kişi)";
  const kisiler = $derived(aydaCalisanlar(y, m).filter(k => oglenGrubu(k.role)));
  let uyarilar = $state<string[]>([]);
  let silOnayi = $state(false);
  $effect(() => { y; m; uyarilar = []; silOnayi = false; });

  function olustur() {
    const r = oglenHesapla($state.snapshot(depo.veri), y, m) as { gunler: { gun: number; e: number[]; t: number[] }[]; uyarilar: string[] };
    oglenKaydet(y, m, r.gunler);
    uyarilar = r.uyarilar;
    silOnayi = false;
  }
  function sil() { if (!silOnayi) { silOnayi = true; return; } oglenAyiniSil(y, m); silOnayi = false; uyarilar = []; }

  // kayıttaki kişiler o gün hâlâ mesaide mi (sonradan izin / rapor girilmiş olabilir); o günün nöbetçileri
  const G = $derived(kayit ? (puantajHesapla($state.snapshot(depo.veri), y, m) as { satirlar: { s: { id: number }; cells: { kod: string; saat: number }[] }[] }) : null);
  const hucre = (id: number, d: number) => G?.satirlar.find(r => r.s.id === id)?.cells[d - 1];
  const calisiyor = (id: number, d: number) => { const h = hucre(id, d); return !!h && (h.kod === "M" || h.kod === "N" || (h.kod.startsWith("S:") && h.saat > 0)); };
  const nobetciMi = (id: number, d: number) => hucre(id, d)?.kod === "N";

  type Satir = { gun: number; dw: number; e: number[]; t: number[]; elle: boolean };
  const haftalar = $derived.by(() => {
    if (!kayit) return [] as Satir[][];
    const out: Satir[][] = []; let cur: Satir[] = [];
    for (let d = 1; d <= gunSayisi(y, m); d++) {
      const dw = haftaGunu(y, m, d);
      if (dw === 0 && cur.length) { out.push(cur); cur = []; }
      const k = kayit[d];
      if (k) cur.push({ gun: d, dw, e: k.e, t: k.t, elle: !!k.elle });
    }
    if (cur.length) out.push(cur);
    return out;
  });
  const sorunlar = $derived(haftalar.flat().flatMap(s => [...s.e, ...s.t].filter(id => !calisiyor(id, s.gun))
    .map(id => `${s.gun} ${AYLAR[m]}: ${ad(id)} o gün artık mesaide değil (izin ya da rapor sonradan girilmiş); yeniden oluşturun ya da bilerek bırakın.`)));

  const yillik = $derived(oglenYillikHesapla($state.snapshot(depo.veri), y, m) as Record<number, { top: number; cuma: number; ay: number; ayCuma: number }>);
  const SIRA: Partial<Record<Rol, number>> = { eczaci: 0, servis: 1, teknisyen: 2 };
  const ozet = $derived(kisiler.slice().sort((a, b) => (SIRA[a.role] ?? 9) - (SIRA[b.role] ?? 9) || a.name.localeCompare(b.name, "tr"))
    .map(k => ({ k, ...(yillik[k.id] ?? { top: 0, cuma: 0, ay: 0, ayCuma: 0 }) })));
  const ROL_KISA: Partial<Record<Rol, string>> = { eczaci: "eczacı", servis: "acil servis eczacısı", teknisyen: "tekniker" };

  // elle düzenleme: bir güne dokunulur, eczacı ve tekniker yerleri seçilir; bu gün otomatik oluşturmada korunur
  let acik = $state(false), gun = $state(1), se = $state<string[]>([]), st = $state<string[]>([]);
  const gerekE = $derived(haftaGunu(y, m, gun) === 4 ? OGLEN_GEREK.cuma.e : OGLEN_GEREK.hafta.e);
  const gerekT = $derived(haftaGunu(y, m, gun) === 4 ? OGLEN_GEREK.cuma.t : OGLEN_GEREK.hafta.t);
  function gunAc(s: Satir) {
    gun = s.gun;
    const n = (l: number[], k: number) => Array.from({ length: Math.max(k, l.length) }, (_, i) => String(l[i] ?? ""));
    se = n(s.e, haftaGunu(y, m, s.gun) === 4 ? OGLEN_GEREK.cuma.e : OGLEN_GEREK.hafta.e);
    st = n(s.t, haftaGunu(y, m, s.gun) === 4 ? OGLEN_GEREK.cuma.t : OGLEN_GEREK.hafta.t);
    acik = true;
  }
  const secenekler = (g: "e" | "t") => kisiler.filter(k => oglenGrubu(k.role) === g).sort((a, b) => a.name.localeCompare(b.name, "tr"));
  const etiket = (id: number) => {
    const k = kisiler.find(x => x.id === id); const n: string[] = [];
    if (!calisiyorG(id, gun)) n.push("o gün çalışmıyor");
    else if (nobetciMiG(id, gun)) n.push("nöbetçi");
    if (k?.cumaMuaf && haftaGunu(y, m, gun) === 4) n.push("Cuma'dan muaf");
    return n.length ? ` (${n.join(", ")})` : "";
  };
  // pencere için puantaj, kayıt olmasa da
  const GP = $derived(acik ? (puantajHesapla($state.snapshot(depo.veri), y, m) as { satirlar: { s: { id: number }; cells: { kod: string; saat: number }[] }[] }) : null);
  const hucreG = (id: number, d: number) => GP?.satirlar.find(r => r.s.id === id)?.cells[d - 1];
  const calisiyorG = (id: number, d: number) => { const h = hucreG(id, d); return !!h && (h.kod === "M" || h.kod === "N" || (h.kod.startsWith("S:") && h.saat > 0)); };
  const nobetciMiG = (id: number, d: number) => hucreG(id, d)?.kod === "N";
  const secE = $derived(se.filter(Boolean).map(Number)), secT = $derived(st.filter(Boolean).map(Number));
  const tekrar = $derived(new Set(secE).size !== secE.length || new Set(secT).size !== secT.length);
  function gunKaydet() { if (tekrar) return; oglenGunuAyarla(y, m, gun, secE, secT, true); acik = false; }
  function otomatik() { const k = kayit?.[gun]; oglenGunuAyarla(y, m, gun, k?.e ?? [], k?.t ?? [], false); acik = false; }

  let durum = $state("");
  async function pdf() {
    durum = "";
    try {
      const { oglenPdf } = await import("../../disa/oglenCikti");
      const blob = oglenPdf({
        y, m, kurum: depo.veri.kurum.ad,
        haftalar: haftalar.map(h => h.map(s => ({ gun: s.gun, dw: s.dw, e: s.e.map(ad), t: s.t.map(ad) }))),
        ozet: ozet.map(o => ({ ad: o.k.name, rol: ROL_KISA[o.k.role] ?? "", ay: o.ay, ayCuma: o.k.cumaMuaf ? null : o.ayCuma, yil: o.top, yilCuma: o.k.cumaMuaf ? null : o.cuma })),
      });
      const ok = await dosyaKaydet(`oglen-nobeti-${y}-${String(m + 1).padStart(2, "0")}.pdf`, blob, "application/pdf");
      durum = ok ? "PDF kaydedildi." : "";
    } catch (e) { durum = hataMetni(e, "PDF oluşturulamadı."); }
  }
</script>

{#if !c}
  <section class="kart bos">
    <h2>{ayAdi(y, m)} çizelgesi henüz yok</h2>
    <p>Öğlen nöbeti o günün çalışma listesinden yazılır: kimin izinli, nöbetçi ya da nöbet ertesi izinli olduğu nöbet çizelgesinden ve puantajdan gelir. Önce bu ayın nöbet çizelgesini oluşturun.</p>
    <div><button class="dugme ana" onclick={() => git("nobet")}><Ikon ad="takvim" />Eczane nöbeti</button></div>
  </section>
{:else}
  <div class="arac">
    <div class="durumlar">
      <span class="rozet notr">Pzt–Prş {OGLEN_GEREK.hafta.e} eczacı + {OGLEN_GEREK.hafta.t} tekniker · Cuma {OGLEN_GEREK.cuma.e} eczacı + {OGLEN_GEREK.cuma.t} tekniker</span>
    </div>
    <div class="dugmeler">
      <button class="dugme ana" onclick={olustur}><Ikon ad={kayit ? "yenile" : "saat"} />{kayit ? "Yeniden oluştur" : "Öğlen nöbetini oluştur"}</button>
      {#if kayit}<button class="dugme" onclick={pdf}><Ikon ad="indir" />PDF</button>{/if}
      {#if kayit}<button class="dugme sade tehlike" onclick={sil}><Ikon ad="sil" />{silOnayi ? "Evet, ayın öğlen nöbetini sil" : "Sil"}</button>{/if}
    </div>
  </div>
  <p class="aciklama">O gün mesaide çalışanlardan yazılır; resmi tatil ve arife günü öğlen nöbeti yoktur. Herkese haftada bir (kişi yetmezse iki); yıl boyunca toplam sayı ve Cuma sayısı ayrı ayrı eşit dağıtılır. Eşitlik bozulmuyorsa o günün nöbetçisine yazılmaz. Cuma'dan muaf eczacılar Personel bölümünde işaretlenir. Bir güne dokunup kişileri elle değiştirebilirsiniz; sonradan girilen izin ve raporlarda boşalan yerler kendiliğinden doldurulur (elle düzenlenen ve geçmiş günler değişmez).</p>
  {#if durum}<p class="bant" role="status">{durum}</p>{/if}

  {#each [...uyarilar, ...sorunlar] as u}<p class="satir"><Ikon ad="uyari" boyut={15} /><span>{u}</span></p>{/each}

  {#if !kayit}
    <section class="kart bos"><p>Bu ay için öğlen nöbeti henüz oluşturulmadı.</p></section>
  {:else}
    <section class="kart tablo-kap" aria-label="{ayAdi(y, m)} öğlen nöbeti">
      <table>
        <thead><tr><th class="sol">Gün</th><th class="sol">Eczacılar</th><th class="sol">Tekniker</th></tr></thead>
        {#each haftalar as h}
          <tbody>
            {#each h as s (s.gun)}
              <tr class:cuma={s.dw === 4} class="tikla" onclick={() => gunAc(s)}>
                <th class="sol"><button class="gun-dugme" onclick={e => { e.stopPropagation(); gunAc(s); }} aria-label="{gunMetni(y, m, s.gun)}: düzenle"><span class="rakam">{s.gun}</span> {GUN_UZUN[s.dw]}</button>{#if s.elle}<small> · elle</small>{/if}</th>
                {#each [s.e, s.t] as l}
                  <td class="sol">
                    {#each l as id, i}<span class:sorun={!calisiyor(id, s.gun)}>{ad(id)}{#if nobetciMi(id, s.gun)}<small> (nöbetçi)</small>{/if}</span>{#if i < l.length - 1}{", "}{/if}{/each}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        {/each}
      </table>
    </section>
  {/if}

  <section class="blok">
    <h2>Kişi başı öğlen nöbeti</h2>
    <p class="aciklama">Eşitlik yıl boyunca: izin vb. nedeniyle bir ay az alan sonraki aylarda tamamlar. Cuma ayrıca sayılır.</p>
    <div class="kart tablo-kap">
      <table>
        <thead><tr><th class="sol">Kişi</th><th>Bu ay</th><th>Bu ay Cuma</th><th>Yıl ({y})</th><th>Yıl Cuma</th></tr></thead>
        <tbody>
          {#each ozet as o (o.k.id)}
            <tr>
              <th class="sol">{o.k.name} <small>{ROL_KISA[o.k.role]}{o.k.cumaMuaf ? " · Cuma'dan muaf" : ""}</small></th>
              <td class="rakam">{o.ay}</td><td class="rakam">{o.k.cumaMuaf ? "–" : o.ayCuma}</td><td class="rakam">{o.top}</td><td class="rakam">{o.k.cumaMuaf ? "–" : o.cuma}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <div><button class="dugme sade" onclick={() => git("kisiler")}><Ikon ad="kisiler" />Cuma'dan muaf olanları düzenle</button></div>
  </section>
{/if}

<Pencere bind:acik baslik={gunMetni(y, m, gun)} altBaslik="Öğlen nöbeti · {gerekE} eczacı + {gerekT} tekniker">
  <div class="iki">
    <div class="alanlar">
      {#each se as _, i}
        <label class="alan"><span>{i + 1}. eczacı</span><select class="girdi" bind:value={se[i]}><option value="">Seçilmedi</option>{#each secenekler("e") as k}<option value={String(k.id)}>{k.name}{etiket(k.id)}</option>{/each}</select></label>
      {/each}
    </div>
    <div class="alanlar">
      {#each st as _, i}
        <label class="alan"><span>{i + 1}. tekniker</span><select class="girdi" bind:value={st[i]}><option value="">Seçilmedi</option>{#each secenekler("t") as k}<option value={String(k.id)}>{k.name}{etiket(k.id)}</option>{/each}</select></label>
      {/each}
    </div>
  </div>
  {#if tekrar}<p class="not hata" role="alert">Aynı kişi iki kez seçilemez.</p>{/if}
  <p class="not">Kaydedilen gün elle düzenlenmiş sayılır: yeniden oluşturma ve otomatik doldurma bu güne dokunmaz.</p>
  {#snippet altlik()}
    {#if kayit?.[gun]?.elle}<button class="dugme sade" onclick={otomatik}>Otomatiğe bırak</button>{/if}
    <span style="flex:1"></span>
    <button class="dugme" onclick={() => (acik = false)}>Vazgeç</button>
    <button class="dugme ana" onclick={gunKaydet} disabled={tekrar}>Kaydet</button>
  {/snippet}
</Pencere>

<style>
  .bos { padding: var(--b5); display: grid; gap: var(--b3); max-width: 760px; }
  .bos p { color: var(--yazi-2); }
  .arac { display: flex; flex-wrap: wrap; gap: var(--b3); align-items: center; justify-content: space-between; margin-bottom: var(--b2); }
  .durumlar, .dugmeler { display: flex; flex-wrap: wrap; gap: var(--b2); align-items: center; }
  .aciklama { font-size: var(--f-sm); color: var(--soluk); margin-bottom: var(--b3); max-width: 80ch; }
  .satir { display: flex; gap: var(--b2); align-items: flex-start; font-size: var(--f-sm); padding: 6px 10px; border-radius: var(--r-kucuk); background: var(--dikkat-zemin); margin-bottom: var(--b2); }
  .satir :global(svg) { flex: none; margin-top: 2px; color: var(--dikkat); }
  .tablo-kap { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; font-size: var(--f-sm); }
  th, td { padding: 8px 12px; border-bottom: 1px solid var(--cizgi-acik); text-align: right; white-space: nowrap; }
  thead th { font-size: var(--f-xs); color: var(--soluk); font-weight: 600; background: var(--yuzey-2); }
  tbody th { font-weight: 500; }
  tbody + tbody tr:first-child > * { border-top: 2px solid var(--cizgi); }
  tr.cuma { background: var(--yuzey-2); }
  .sol { text-align: left; }
  td.sol { white-space: normal; }
  small { color: var(--soluk); font-weight: 400; }
  .sorun { color: var(--hata); text-decoration: line-through; }
  .blok { margin-top: var(--b5); display: grid; gap: var(--b2); }
  .blok h2 { font-size: var(--f-lg); }
  .blok .aciklama { margin-bottom: 0; }
  .bant { padding: var(--b2) var(--b4); border-radius: var(--r); margin-bottom: var(--b3); font-size: var(--f-sm); font-weight: 500; background: var(--vurgu-zemin); color: var(--vurgu); }
  tr.tikla { cursor: pointer; }
  tr.tikla:hover { background: var(--vurgu-zemin); }
  .gun-dugme { all: unset; cursor: pointer; font-weight: 500; }
  .gun-dugme:focus-visible { outline: 2px solid var(--odak); outline-offset: 2px; border-radius: 4px; }
  .iki { display: grid; grid-template-columns: 1fr 1fr; gap: var(--b3); }
  .alanlar { display: grid; gap: var(--b2); align-content: start; }
  .not { padding: var(--b2) var(--b3); border-radius: var(--r-kucuk); font-size: var(--f-sm); background: var(--yuzey-2); color: var(--yazi-2); }
  .not.hata { background: var(--hata-zemin); color: var(--hata); }
  @media (max-width: 720px) { .iki { grid-template-columns: 1fr; } }
</style>
