<script lang="ts">
  // Bir günü elle düzenleme: nöbetçiler ve (tatil günüyse) hazırlama. Seçim değiştikçe kurallar anında denetlenir.
  // Her gün nöbetçi sayısı ve nöbet fazla mesaisi, tatil gününde ayrıca hazırlama sayısı ve saati elle belirlenebilir.
  import { gunuDenetle, acilKadrosunda } from "../../motor";
  import { Baglam } from "../../motor/baglam";
  import {
    depo,
    veriAnlik,
    duzKopya,
    gunuGuncelle,
    gunKilidiniKaldir,
    aydaCalisanlar,
    resmiTatilMi,
    arifeMi,
    gunNotlari,
    notEkle,
    notSil,
    notSilinebilir,
    notYazari,
  } from "../../veri/depo.svelte";
  import { NOT_SINIRI } from "../../veri/dogrulama";
  import type { AyCizelgesi, GunDuzeni, Gorevli, Kisi } from "../../veri/tipler";
  import { ROL_AD } from "../../veri/tipler";
  import { gunMetni, gunSayisi, isoTarih } from "../../veri/tarih";
  import Pencere from "../ortak/Pencere.svelte";
  import Ikon from "../ortak/Ikon.svelte";
  import { puantajIzgarasi, type Gorev } from "../../veri/degisim.svelte";
  import GunAciklamasi from "./GunAciklamasi.svelte";

  let {
    acik = $bindable(false),
    c,
    gun,
    degisimeGit,
  }: {
    acik?: boolean;
    c: AyCizelgesi;
    gun: number;
    /** onaylı ayda: seçilen görev için Puantaj > Nöbet değişimi açılır */
    degisimeGit?: (s: { gun: number; id: number; kod: Gorev }) => void;
  } = $props();

  const g = $derived(c.days[gun - 1]);
  const onayli = $derived(!!c.onay);
  // onaylı ayda günün o anki görevlileri (puantaja göre: yapılmış değişimler işlenmiş)
  const guncelGorevliler = $derived.by(() => {
    if (!onayli || !degisimeGit) return [];
    const l: { id: number; ad: string; kod: Gorev }[] = [];
    for (const r of puantajIzgarasi(c.year, c.month).satirlar) {
      const h = r.cells[gun - 1];
      if (!h || acilKadrosunda(r.s)) continue;
      if ((h.kod === "N" && !h.acil) || h.kod === "H") l.push({ id: r.s.id, ad: r.s.name, kod: h.kod });
    }
    return l.sort((a, b) => (a.kod === b.kod ? 0 : a.kod === "N" ? -1 : 1));
  });
  const iso = $derived(isoTarih(c.year, c.month, gun));
  const calisiyor = (k: Kisi) => !(k.baslangic && iso < k.baslangic) && !(k.bitis && iso > k.bitis);
  const tum = $derived(
    aydaCalisanlar(c.year, c.month)
      .filter(k => !acilKadrosunda(k) && calisiyor(k))
      .sort((a, b) => a.name.localeCompare(b.name, "tr")),
  );
  const nobetAday = $derived(tum.filter(k => k.role !== "destek"));
  const hazAday = $derived(tum);
  /** takvime göre (elle yazılmazsa) nöbet fazla mesaisi ve hazırlama saati */
  const otoFm = $derived(new Baglam(veriAnlik()).fazlaMesai(c.year, c.month, gun, gunSayisi(c.year, c.month)));
  const OTO_HAZ = $derived(depo.veri.settings.hazSaat);
  const SAYILAR_N = [1, 2, 3, 4],
    SAYILAR_H = [0, 1, 2, 3, 4];

  // seçimler: nöbetçiler (eczacılar önce) ve hazırlama; tatil gününde sayı ve saatler
  let ns = $state<string[]>([]),
    hs = $state<string[]>([]);
  let nSay = $state(2),
    hSay = $state(2),
    fmN = $state(""),
    fmH = $state("");
  $effect(() => {
    if (!acik) return;
    const ec = [...g.assigned].sort(
      (a, b) => Number(b.role === "eczaci" || b.role === "nobetci") - Number(a.role === "eczaci" || a.role === "nobetci"),
    );
    // yerel değişkenlerle: bu etki yalnız pencere açılınca (ve gün değişince) çalışsın, sayı seçimine bağlanmasın
    const n = g.nobetSay ?? Math.max(2, ec.length),
      h = g.hazSay ?? Math.max(2, g.prep.length);
    nSay = n;
    hSay = h;
    ns = Array.from({ length: n }, (_, i) => String(ec[i]?.id ?? ""));
    hs = Array.from({ length: h }, (_, i) => String(g.prep[i]?.id ?? ""));
    fmN = g.fmNobet !== undefined ? String(g.fmNobet) : "";
    fmH = g.fmHaz !== undefined ? String(g.fmHaz) : "";
  });
  // sayı değişince seçim listesi uzar / kısalır (seçili kişiler yerinde kalır)
  function sayiAyarla(l: string[], n: number) {
    return Array.from({ length: n }, (_, i) => l[i] ?? "");
  }
  $effect(() => {
    if (ns.length !== nSay) ns = sayiAyarla(ns, nSay);
  });
  $effect(() => {
    if (hs.length !== hSay) hs = sayiAyarla(hs, hSay);
  });

  const kisi = (id: string): Gorevli | null => {
    const k = depo.veri.staff.find(x => String(x.id) === id);
    return k ? { id: k.id, name: k.name, role: k.role } : null;
  };
  const liste = (l: string[]) =>
    l
      .filter(Boolean)
      .map(kisi)
      .filter((x): x is Gorevli => !!x);
  const nb = $derived(liste(ns));
  const pr = $derived(g.tatil ? liste(hs) : []);
  const tekrarVar = (l: string[]) => {
    const d = l.filter(Boolean);
    return new Set(d).size !== d.length;
  };
  const ayniKisi = $derived(tekrarVar(ns) || (g.tatil && tekrarVar(hs)));
  // saat alanları: boş = takvimden; 0–48 saat (yarım saat olabilir)
  const saatOku = (t: string): number | undefined | null => {
    const x = t.trim().replace(",", ".");
    if (!x) return undefined;
    const v = Number(x);
    return Number.isFinite(v) && v >= 0 && v <= 48 ? Math.round(v * 2) / 2 : null;
  };
  const fmNobet = $derived(saatOku(fmN)),
    fmHaz = $derived(saatOku(fmH));
  const saatHatasi = $derived(fmNobet === null || (g.tatil && fmHaz === null));
  /** günün yeni düzeni: nöbetçi sayısı ve nöbet fazla mesaisi her gün; hazırlama sayısı ve saati yalnız tatil gününde */
  const duzen = $derived<GunDuzeni | null>(
    !saatHatasi
      ? {
          ...(nSay !== 2 ? { nobetSay: nSay } : {}),
          ...(typeof fmNobet === "number" ? { fmNobet } : {}),
          ...(g.tatil && hSay !== 2 ? { hazSay: hSay } : {}),
          ...(g.tatil && typeof fmHaz === "number" ? { fmHaz } : {}),
        }
      : null,
  );
  const gosterFm = $derived(typeof fmNobet === "number" ? fmNobet : otoFm);
  const denetim = $derived(acik && !ayniKisi && !saatHatasi ? gunuDenetle(veriAnlik(), duzKopya(c), gun, nb, pr, duzen) : []);
  const hatalar = $derived(denetim.filter(x => x.sev === "hata"));
  const uyarilar = $derived(denetim.filter(x => x.sev === "uyari"));
  const bilgiler = $derived(denetim.filter(x => x.sev === "bilgi"));
  const elleDuzen = $derived(g.nobetSay !== undefined || g.hazSay !== undefined || g.fmNobet !== undefined || g.fmHaz !== undefined);

  let kuralDisiOnay = $state(false);
  $effect(() => {
    nb;
    pr;
    duzen;
    kuralDisiOnay = false;
  });
  function kaydet() {
    if (ayniKisi || saatHatasi) return;
    if (hatalar.length && !kuralDisiOnay) {
      kuralDisiOnay = true;
      return;
    }
    gunuGuncelle(c.year, c.month, gun, nb, pr, duzen);
    acik = false;
  }
  function otomatigeBirak() {
    gunKilidiniKaldir(c.year, c.month, gun);
    acik = false;
  }
  // gün notları (sorumlular arası; onaylı ayda da yazılır)
  const notlar = $derived(gunNotlari(c.year, c.month, gun));
  let yeniNot = $state("");
  $effect(() => {
    if (acik) yeniNot = "";
  });
  function notuEkle() {
    if (notEkle(c.year, c.month, gun, yeniNot)) yeniNot = "";
  }
  const notZamani = (z: number) => new Date(z).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });
  const tur = $derived(
    resmiTatilMi(c.year, c.month, gun)
      ? "Resmi tatil"
      : g.tatil
        ? "Hafta sonu"
        : arifeMi(c.year, c.month, gun)
          ? "Arife (yarım gün)"
          : "Mesai günü",
  );
</script>

<Pencere
  bind:acik
  baslik={gunMetni(c.year, c.month, gun)}
  altBaslik="{tur} · nöbet fazla mesaisi {gosterFm} saat{typeof fmNobet === 'number' ? ' (elle)' : ''}"
>
  {#if onayli}
    <p class="not bilgi">
      Bu ay onaylı; çizelgenin günleri değiştirilemez.{degisimeGit
        ? " Ay içindeki değişiklik (yerine tutma, takas) için görevi seçin:"
        : " Değiştirmek için önce onayı kaldırın."}
    </p>
    {#if guncelGorevliler.length}
      <ul class="degisim-listesi">
        {#each guncelGorevliler as k (k.id + k.kod)}
          <li>
            <span><b>{k.ad}</b> · {k.kod === "N" ? "nöbet" : "hazırlama"}</span>
            <button
              class="dugme kucuk"
              onclick={() => {
                acik = false;
                degisimeGit?.({ gun, id: k.id, kod: k.kod });
              }}><Ikon ad="karisik" boyut={16} />Değişim yap</button
            >
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
  <fieldset disabled={onayli}>
    <legend class="bas"
      ><span>Nöbetçiler</span>
      <label class="sayi"
        ><span>Sayı</span><select class="girdi" bind:value={nSay} aria-label="Nöbetçi sayısı"
          >{#each SAYILAR_N as n}<option value={n}>{n}</option>{/each}</select
        ></label
      >
    </legend>
    <div class="iki">
      {#each ns as _, i (i)}
        <label class="alan"
          ><span>{i + 1}. nöbetçi</span>
          <select class="girdi" bind:value={ns[i]}
            ><option value="">Seçilmedi</option>{#each nobetAday as k}<option value={String(k.id)}>{k.name} · {ROL_AD[k.role]}</option
              >{/each}</select
          >
        </label>
      {/each}
    </div>
  </fieldset>
  {#if g.tatil}
    <fieldset disabled={onayli}>
      <legend class="bas"
        ><span>Hazırlama ({typeof fmHaz === "number" ? fmHaz : OTO_HAZ} saat)</span>
        <label class="sayi"
          ><span>Sayı</span><select class="girdi" bind:value={hSay} aria-label="Hazırlama sayısı"
            >{#each SAYILAR_H as n}<option value={n}>{n}</option>{/each}</select
          ></label
        >
      </legend>
      {#if hs.length}
        <div class="iki">
          {#each hs as _, i (i)}
            <label class="alan"
              ><span>{i + 1}. hazırlama</span><select class="girdi" bind:value={hs[i]}
                ><option value="">Seçilmedi</option>{#each hazAday as k}<option value={String(k.id)}>{k.name} · {ROL_AD[k.role]}</option
                  >{/each}</select
              ></label
            >
          {/each}
        </div>
      {:else}<p class="kucuk-not">Bu gün hazırlama yok.</p>{/if}
    </fieldset>
  {/if}
  <fieldset disabled={onayli}>
    <legend>Fazla mesai (bu gün)</legend>
    <div class="iki">
      <label class="alan"
        ><span>Nöbet fazla mesaisi (saat)</span><input
          class="girdi"
          inputmode="decimal"
          bind:value={fmN}
          placeholder="{otoFm} (takvimden)"
          aria-invalid={fmNobet === null}
        /></label
      >
      {#if g.tatil}<label class="alan"
          ><span>Hazırlama saati</span><input
            class="girdi"
            inputmode="decimal"
            bind:value={fmH}
            placeholder="{OTO_HAZ} (varsayılan)"
            aria-invalid={fmHaz === null}
          /></label
        >{/if}
    </div>
    <p class="kucuk-not">
      Boş bırakılırsa takvimden hesaplanır. Yazılan saat bu günün her nöbetçisine{g.tatil ? " / hazırlamacısına" : ""} yazılır; puantaja, raporlara
      ve eşitlik hesabına bu saat girer (puantajda o günün nöbet saati buna göre ayarlanır, ertesi günün nöbet izni yine düşülür).
    </p>
  </fieldset>

  {#if ayniKisi}<p class="not hata" role="alert">Aynı kişi iki kez seçilemez.</p>{/if}
  {#if saatHatasi}<p class="not hata" role="alert">Saat 0 ile 48 arasında bir sayı olmalı (boş: takvimden).</p>{/if}
  {#if !onayli && (hatalar.length || uyarilar.length || bilgiler.length)}
    <!-- önemli olan önde: kural dışı durumların hepsi, en çok 3 uyarı; kalan uyarılar ve bilgiler "Ayrıntılar" altında -->
    <div class="denetim" aria-live="polite">
      {#each hatalar as x}<p class="satir hata"><Ikon ad="uyari" boyut={15} /><span><b>Kural dışı:</b> {x.t}</span></p>{/each}
      {#each uyarilar.slice(0, 3) as x}<p class="satir uyari"><Ikon ad="uyari" boyut={15} /><span>{x.t}</span></p>{/each}
      {#if uyarilar.length > 3 || bilgiler.length}
        <details class="ayrinti">
          <summary
            >Ayrıntılar ({uyarilar.length - Math.min(3, uyarilar.length) + bilgiler.length}){uyarilar.length > 3
              ? ` · ${uyarilar.length - 3} uyarı daha`
              : ""}</summary
          >
          {#each uyarilar.slice(3) as x}<p class="satir uyari"><Ikon ad="uyari" boyut={15} /><span>{x.t}</span></p>{/each}
          {#each bilgiler as x}<p class="satir bilgi"><Ikon ad="tamam" boyut={15} /><span>{x.t}</span></p>{/each}
        </details>
      {/if}
    </div>
  {:else if !onayli && !ayniKisi && !saatHatasi}
    <p class="not tamam"><Ikon ad="tamam" boyut={15} />Kural sorunu yok.</p>
  {/if}
  {#if kuralDisiOnay}<p class="not hata" role="alert">
      Bu seçimde kural dışı durum var. Yine de kaydetmek için tekrar "Kaydet"e basın.
    </p>{/if}
  {#if g.locked && !onayli}<p class="kucuk-not">
      Bu gün elle düzenlendi; çizelge yeniden oluşturulunca korunur.{elleDuzen
        ? ' Sayılar ve saatler de elle belirlendi; "Otomatiğe bırak" bunları da kaldırır.'
        : ""}
    </p>{/if}

  {#if acik}<GunAciklamasi {c} {gun} />{/if}

  <section class="notlar" aria-label="Gün notları">
    <h3>Notlar{notlar.length ? ` (${notlar.length})` : ""}</h3>
    {#if notlar.length}
      <ul>
        {#each notlar as n (n.id)}
          <li>
            <div class="not-ust">
              <b>{notYazari(n)}</b><small class="rakam">{notZamani(n.z)}</small>
              {#if notSilinebilir(n)}<button
                  class="dugme kucuk sade"
                  onclick={() => notSil(c.year, c.month, gun, n.id)}
                  aria-label="Notu sil"><Ikon ad="sil" boyut={14} />Sil</button
                >{/if}
            </div>
            <p>{n.metin}</p>
          </li>
        {/each}
      </ul>
    {/if}
    <div class="not-ekle">
      <textarea
        class="girdi"
        rows="2"
        maxlength={NOT_SINIRI}
        bind:value={yeniNot}
        placeholder="Bu güne not bırakın (ör. takas konuşuldu, bu gün değişmesin); bütün sorumlular görür"
        aria-label="Yeni not"
      ></textarea>
      <button class="dugme kucuk" onclick={notuEkle} disabled={!yeniNot.trim()}><Ikon ad="arti" boyut={16} />Not ekle</button>
    </div>
  </section>

  {#snippet altlik()}
    {#if !onayli && g.locked}<button class="dugme sade" onclick={otomatigeBirak}>Otomatiğe bırak</button>{/if}
    <span style="flex:1"></span>
    <button class="dugme" onclick={() => (acik = false)}>{onayli ? "Kapat" : "Vazgeç"}</button>
    {#if !onayli}<button class="dugme ana" onclick={kaydet} disabled={!!ayniKisi || !!saatHatasi}
        >{kuralDisiOnay ? "Yine de kaydet" : "Kaydet"}</button
      >{/if}
  {/snippet}
</Pencere>

<style>
  .notlar {
    display: grid;
    gap: var(--b2);
    border-top: 1px solid var(--cizgi);
    padding-top: var(--b3);
  }
  .notlar h3 {
    font-size: var(--f-sm);
    margin: 0;
  }
  .notlar ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--b2);
  }
  .notlar li {
    padding: var(--b2) var(--b3);
    border-radius: var(--r-kucuk);
    background: var(--yuzey-2);
    font-size: var(--f-sm);
  }
  .notlar li p {
    margin: 2px 0 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .not-ust {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--b2);
  }
  .not-ust small {
    color: var(--yazi-2);
  }
  .not-ust button {
    margin-left: auto;
  }
  .not-ekle {
    display: grid;
    gap: var(--b2);
    justify-items: start;
  }
  .not-ekle textarea {
    width: 100%;
    resize: vertical;
  }
  fieldset {
    border: 0;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--b2);
    min-width: 0;
  }
  legend {
    font-weight: 600;
    font-size: var(--f-sm);
    margin-bottom: var(--b2);
  }
  .bas {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--b3);
    width: 100%;
  }
  .sayi {
    display: flex;
    align-items: center;
    gap: var(--b2);
    font-size: var(--f-sm);
    color: var(--yazi-2);
  }
  .sayi select {
    width: auto;
    min-width: 64px;
  }
  .iki {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--b3);
  }
  .denetim {
    display: grid;
    gap: 6px;
  }
  .ayrinti {
    display: grid;
    gap: 6px;
  }
  .ayrinti summary {
    cursor: pointer;
    font-size: var(--f-sm);
    color: var(--yazi-2);
    padding: 4px 2px;
  }
  .ayrinti[open] summary {
    margin-bottom: 6px;
  }
  .satir {
    display: flex;
    gap: var(--b2);
    align-items: flex-start;
    font-size: var(--f-sm);
    padding: 6px 10px;
    border-radius: var(--r-kucuk);
  }
  .satir :global(svg) {
    flex: none;
    margin-top: 2px;
  }
  .satir.hata {
    background: var(--hata-zemin);
    color: var(--yazi);
  }
  .satir.hata :global(svg),
  .satir.hata b {
    color: var(--hata);
  }
  .satir.uyari {
    background: var(--dikkat-zemin);
  }
  .satir.uyari :global(svg) {
    color: var(--dikkat);
  }
  .satir.bilgi {
    background: var(--yuzey-2);
    color: var(--yazi-2);
  }
  .satir.bilgi :global(svg) {
    color: var(--bilgi);
  }
  .not {
    display: flex;
    gap: var(--b2);
    align-items: center;
    padding: var(--b2) var(--b3);
    border-radius: var(--r-kucuk);
    font-size: var(--f-sm);
    font-weight: 500;
  }
  .not.hata {
    background: var(--hata-zemin);
    color: var(--hata);
  }
  .degisim-listesi {
    list-style: none;
    margin: 0 0 var(--b3);
    padding: 0;
    display: grid;
    gap: 6px;
  }
  .degisim-listesi li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--b2);
    padding: 6px var(--b3);
    border: 1px solid var(--cizgi);
    border-radius: var(--r-kucuk);
    font-size: var(--f-sm);
  }
  .not.bilgi {
    background: var(--bilgi-zemin);
    color: var(--bilgi);
  }
  .not.tamam {
    background: var(--vurgu-zemin);
    color: var(--vurgu);
  }
  .kucuk-not {
    font-size: var(--f-xs);
    color: var(--soluk);
  }
  @media (max-width: 520px) {
    .iki {
      grid-template-columns: 1fr;
    }
  }
</style>
