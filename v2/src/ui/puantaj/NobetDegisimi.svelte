<script lang="ts">
  // Nöbet değişimi: takvimde bir görev (nöbet ya da hazırlama) seçilir; yerine tutacak kişi seçilir ya da
  // karşılıklı takas için ikinci görev seçilir. Kurallar varsayımsal puantajla denetlenir. Değişim yalnız puantaja
  // yansır; yıllık denge çizelgeye göre kalır. Bu ayın değişimleri listelenir, geri alınabilir.
  import { tick, untrack } from "svelte";
  import { depo, ayCizelgesi } from "../../veri/depo.svelte";
  import { degisimDenetle, yerineAdaylarHesapla } from "../../motor/cizelge.js";
  import { degisimUygula, degisimGeriAl, ayDegisimleri, puantajIzgarasi, IZIN_AD, type Gorev, type DegisimIstegi, type IzinTuru } from "../../veri/degisim.svelte";
  import { GUN_KISA, GUN_UZUN, gunMetni, haftaGunu } from "../../veri/tarih";
  import Ikon from "../ortak/Ikon.svelte";

  type Kontrol = { engel: string[]; uyari: string[]; bilgi: string[] };
  type Aday = { id: number; ad: string; engel: number; uyari: number; yil: number; k: Kontrol };
  type Secim = { id: number; gun: number; kod: Gorev };

  const y = $derived(depo.yil), m = $derived(depo.ay);
  const cizelgeVar = $derived(!!ayCizelgesi(y, m)?.days.some(g => g.assigned.length));
  const G = $derived(puantajIzgarasi(y, m));
  const gorevliler = (gun: number) => {
    const N: { id: number; ad: string; rol: string }[] = [], H: typeof N = [];
    for (const r of G.satirlar) { const c = r.cells[gun - 1]; if (c?.kod === "N" && !c.acil) N.push({ id: r.s.id, ad: r.s.name, rol: r.s.role }); else if (c?.kod === "H") H.push({ id: r.s.id, ad: r.s.name, rol: r.s.role }); }
    N.sort((a, b) => Number(b.rol === "eczaci" || b.rol === "nobetci") - Number(a.rol === "eczaci" || a.rol === "nobetci"));
    return { N, H };
  };
  const degisenGunler = $derived(new Set(ayDegisimleri(y, m).map(z => z.gun)));
  const bugun = new Date();
  const bugunMu = (d: number) => bugun.getFullYear() === y && bugun.getMonth() === m && bugun.getDate() === d;
  const ad = (id: number) => depo.veri.staff.find(k => k.id === id)?.name ?? "(silinmiş)";
  const gorevAdi = (k: Gorev) => (k === "H" ? "hazırlama" : "nöbet");

  let tur = $state<"devir" | "takas">("devir");
  let s1 = $state<Secim | null>(null), s2 = $state<Secim | null>(null);
  let yer = $state("");
  let not = $state("");
  let onayAdimi = $state(false);
  let durum = $state<{ tur: "tamam" | "hata"; metin: string } | null>(null);
  const temizle = () => { s1 = null; s2 = null; yer = ""; not = ""; onayAdimi = false; };
  $effect(() => { y; m; tur; untrack(temizle); });
  const ayni = (a: Secim | null, b: Secim) => !!a && a.id === b.id && a.gun === b.gun && a.kod === b.kod;
  function sec(x: Secim) {
    durum = null; onayAdimi = false;
    if (ayni(s1, x)) { temizle(); return; }
    if (ayni(s2, x)) { s2 = null; return; }
    if (tur === "devir" || !s1 || s1.id === x.id) { s1 = x; s2 = null; yer = ""; }
    else s2 = x;
    // dar ekranda panel takvimin altında kalır: seçimden sonra görünür yapılır
    if (innerWidth <= 1100) tick().then(() => panel?.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }));
  }
  let panel = $state<HTMLElement>();

  const adaylar = $derived(tur === "devir" && s1 ? (yerineAdaylarHesapla($state.snapshot(depo.veri), y, m, s1.gun, s1.id, s1.kod) as Aday[]) : []);
  $effect(() => { if (tur === "devir" && s1 && !adaylar.some(a => String(a.id) === yer)) yer = String((adaylar.find(a => !a.engel) ?? adaylar[0])?.id ?? ""); });
  const istek = $derived.by((): DegisimIstegi | null => {
    if (!s1) return null;
    if (tur === "devir") return yer ? { y, m, gorev: s1.kod, tur, gun: s1.gun, cik: s1.id, yer: Number(yer) } : null;
    return s2 ? { y, m, gorev: s1.kod, gorev2: s2.kod, tur, gun: s1.gun, cik: s1.id, yer: s2.id, gun2: s2.gun } : null;
  });
  const ayniGun = $derived(tur === "takas" && !!s1 && !!s2 && s1.gun === s2.gun);
  const kontrol = $derived(istek && !ayniGun ? (degisimDenetle($state.snapshot(depo.veri), istek) as Kontrol) : null);
  $effect(() => { istek; onayAdimi = false; });

  function uygula() {
    if (!istek || ayniGun) return;
    if (kontrol?.engel.length && !onayAdimi) { onayAdimi = true; return; }
    degisimUygula({ ...istek, not: not.trim() });
    durum = { tur: "tamam", metin: tur === "takas" ? "Karşılıklı takas puantaja işlendi." : "Değişim puantaja işlendi." };
    temizle();
  }

  // bu ayın değişimleri (takasın iki yarısı tek satır)
  const satirlar = $derived.by(() => {
    const L = [...ayDegisimleri(y, m)].reverse(), goruldu = new Set<string>(), out: { id: number; metin: string; tur: string; zaman: number; not?: string }[] = [];
    for (const x of L) {
      if (x.grup) {
        if (goruldu.has(x.grup)) continue;
        goruldu.add(x.grup);
        const [a, b = a] = L.filter(z => z.grup === x.grup).sort((p, q) => p.gun - q.gun);
        out.push({ id: x.id, metin: `${a.gun}. gün ${a.cikAd} (${gorevAdi(a.yerYeni)}) ↔ ${b.gun}. gün ${b.cikAd} (${gorevAdi(b.yerYeni)})`, tur: "Karşılıklı takas", zaman: x.zaman, not: x.not });
      } else out.push({ id: x.id, metin: `${x.gun}. gün: ${x.cikAd} yerine ${x.yerAd} (${gorevAdi(x.yerYeni)})`, tur: x.sebep ? `${IZIN_AD[x.sebep as IzinTuru]?.replace(/ \(.*\)$/, "") ?? "İzin"} nedeniyle${x.zorunlu ? ", çizelgeye işlendi" : ""}` : "Yerine tutma", zaman: x.zaman, not: x.not });
    }
    return out;
  });
  let geriOnay = $state<{ id: number; metin: string } | null>(null);
  function geriAl(id: number) {
    const sonuc = degisimGeriAl(id, geriOnay?.id === id);
    if (sonuc.tamam) { geriOnay = null; durum = { tur: "tamam", metin: "Değişim geri alındı." }; return; }
    if (sonuc.onay) { geriOnay = { id, metin: sonuc.onay }; return; }
    geriOnay = null; durum = { tur: "hata", metin: sonuc.hata ?? "Geri alınamadı." };
  }
  const zaman = (t: number) => new Date(t).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
</script>

{#if !cizelgeVar}
  <section class="kart bos"><h2>Bu ayın çizelgesi yok</h2><p>Nöbet değişimi oluşturulmuş çizelge üzerinde yapılır.</p></section>
{:else}
  <div class="ust">
    <fieldset class="turler">
      <legend class="gizli">Değişim türü</legend>
      <label class:secili={tur === "devir"}><input type="radio" name="dg-tur" value="devir" bind:group={tur} />Yerine tutma</label>
      <label class:secili={tur === "takas"}><input type="radio" name="dg-tur" value="takas" bind:group={tur} />Karşılıklı takas</label>
    </fieldset>
    <p class="adim" aria-live="polite">{tur === "devir" ? (s1 ? "Yerine tutacak kişiyi seçin." : "Takvimde devredilecek nöbete ya da hazırlamaya dokunun.") : !s1 ? "Takvimde takas edilecek ilk görevi seçin." : !s2 ? "Şimdi karşılığında alınacak görevi seçin (başka bir kişinin)." : "Kuralları kontrol edip uygulayın."}</p>
  </div>
  <p class="aciklama">Değişimler yalnız puantaja yansır; yıllık denge çizelgeye göre hesaplandığı için kimsenin sonraki aylardaki payı değişmez. Nöbet ile nöbet, hazırlama ile hazırlama ya da nöbet ile hazırlama takas edilebilir.</p>

  <div class="duzen">
    <section class="kart takvim-kutu" aria-label="Görevler">
      <div class="takvim">
        {#each GUN_KISA as d}<div class="bas" aria-hidden="true">{d}</div>{/each}
        {#each { length: haftaGunu(y, m, 1) } as _}<div class="bosluk" aria-hidden="true"></div>{/each}
        {#each G.gunler as g (g.gun)}
          {@const gr = gorevliler(g.gun)}
          <div class="gun" class:tatil={g.tatil} class:bugun={bugunMu(g.gun)}>
            <span class="gun-ust"><span class="no rakam">{g.gun}</span><span class="gunadi">{GUN_UZUN[g.dw]}</span>{#if degisenGunler.has(g.gun)}<span class="degisti" title="Bu günde değişim var">değişti</span>{/if}</span>
            <span class="cipler">
              {#each gr.N as p}
                {@const x = { id: p.id, gun: g.gun, kod: "N" as Gorev }}
                <button class="cip" class:sec1={ayni(s1, x)} class:sec2={ayni(s2, x)} aria-pressed={ayni(s1, x) || ayni(s2, x)} onclick={() => sec(x)} aria-label="{p.ad}, {gunMetni(y, m, g.gun)} nöbet"><span class="isaret {p.rol}"></span>{p.ad}</button>
              {/each}
              {#each gr.H as p, i}
                {@const x = { id: p.id, gun: g.gun, kod: "H" as Gorev }}
                <button class="cip h" class:sec1={ayni(s1, x)} class:sec2={ayni(s2, x)} aria-pressed={ayni(s1, x) || ayni(s2, x)} onclick={() => sec(x)} aria-label="{p.ad}, {gunMetni(y, m, g.gun)} hazırlama"><b>H{i + 1}</b>{p.ad}</button>
              {/each}
            </span>
          </div>
        {/each}
      </div>
    </section>

    <aside class="kart panel" aria-label="Değişim" bind:this={panel}>
      {#if !s1}
        <p class="bos-panel"><b>{tur === "devir" ? "Yerine tutma" : "Karşılıklı takas"}</b><br />{tur === "devir" ? "Takvimde bir kişinin nöbetine ya da hazırlamasına (H) dokunun, sonra yerine tutacak kişiyi seçin." : "Takvimde iki görev seçin: ilki bir kişinin, ikincisi başka bir kişinin görevi. İki kişi görevlerini karşılıklı değiştirir."}</p>
      {:else}
        <div class="secilen"><span class="etiket sec1">{ad(s1.id)}</span><span>{gunMetni(y, m, s1.gun)} · {gorevAdi(s1.kod)}</span></div>
        {#if tur === "devir"}
          <label class="alan"><span>Yerine {s1.kod === "H" ? "hazırlama yapacak" : "nöbet tutacak"}</span>
            <select class="girdi" onchange={e => (yer = e.currentTarget.value)}>
              {#each adaylar as a}<option value={String(a.id)} selected={String(a.id) === yer}>{a.ad} · yıl içinde {a.yil} {gorevAdi(s1.kod)}{a.engel ? " · kural dışı" : a.uyari ? " · uyarı var" : ""}</option>{:else}<option value="">Uygun kişi yok</option>{/each}
            </select>
          </label>
        {:else if s2}
          <div class="ok" aria-hidden="true">⇅</div>
          <div class="secilen"><span class="etiket sec2">{ad(s2.id)}</span><span>{gunMetni(y, m, s2.gun)} · {gorevAdi(s2.kod)}</span></div>
          <p class="aciklama">{ad(s2.id)}, {s1.gun}. günün {gorevAdi(s1.kod)} görevini; {ad(s1.id)}, {s2.gun}. günün {gorevAdi(s2.kod)} görevini alır.</p>
        {:else}
          <p class="bos-panel">Şimdi karşılığında alınacak görevi seçin: başka bir kişinin nöbeti ya da hazırlaması.</p>
        {/if}

        {#if istek}
          <label class="alan"><span>Not (isteğe bağlı)</span><input class="girdi" bind:value={not} maxlength="160" placeholder="ör. kişisel mazeret" /></label>
          <div class="kontrol" aria-live="polite">
            {#if ayniGun}<p class="satir hata"><Ikon ad="uyari" boyut={15} /><span><b>Kural dışı:</b> Aynı günün iki görevi takas edilemez. Farklı bir gün seçin ya da yerine tutma kullanın.</span></p>
            {:else if kontrol}
              {#each kontrol.engel as t}<p class="satir hata"><Ikon ad="uyari" boyut={15} /><span><b>Kural dışı:</b> {t}</span></p>{/each}
              {#each kontrol.uyari as t}<p class="satir uyari"><Ikon ad="uyari" boyut={15} /><span>{t}</span></p>{/each}
              {#if !kontrol.engel.length && !kontrol.uyari.length}<p class="satir tamam"><Ikon ad="tamam" boyut={15} />Kural sorunu yok.</p>{/if}
              {#each kontrol.bilgi as t}<p class="satir notr">{t}</p>{/each}
            {/if}
          </div>
        {/if}
        {#if onayAdimi}<p class="onay" role="alert">Bu değişimde kural dışı durum var. Yine de uygulamak için tekrar basın.</p>{/if}
        <div class="dugmeler">
          <button class="dugme ana" onclick={uygula} disabled={!istek || ayniGun}><Ikon ad="tamam" />{onayAdimi ? "Yine de uygula" : "Değişimi uygula"}</button>
          <button class="dugme sade" onclick={temizle}>Vazgeç</button>
        </div>
      {/if}
      {#if durum}<p class="durum {durum.tur}" role="status">{durum.metin}</p>{/if}
    </aside>
  </div>

  <section class="blok" aria-labelledby="dg-liste">
    <h2 id="dg-liste">Bu ayın değişimleri</h2>
    {#if satirlar.length}
      <ul>
        {#each satirlar as s (s.id)}
          <li>
            <span class="bilgi"><b>{s.metin}</b><small>{s.tur} · {zaman(s.zaman)}{s.not ? ` · ${s.not}` : ""}</small>
              {#if geriOnay?.id === s.id}<small class="uyari-metin">{geriOnay.metin}</small>{/if}</span>
            <button class="dugme kucuk" onclick={() => geriAl(s.id)}><Ikon ad="yenile" boyut={15} />{geriOnay?.id === s.id ? "Evet, geri al" : "Geri al"}</button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="aciklama">Bu ay için değişim yok.</p>
    {/if}
  </section>
{/if}

<style>
  .bos { padding: var(--b5); display: grid; gap: var(--b2); }
  .bos p { color: var(--yazi-2); }
  .ust { display: flex; flex-wrap: wrap; gap: var(--b3); align-items: center; margin-bottom: var(--b2); }
  .gizli { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  fieldset { border: 0; margin: 0; padding: 0; }
  .turler { display: flex; flex-wrap: wrap; gap: var(--b2); }
  .turler label { display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 var(--b3); border: 1px solid var(--cizgi); border-radius: var(--r-kucuk); cursor: pointer; font-weight: 500; background: var(--yuzey); }
  .turler label.secili { border-color: var(--vurgu); background: var(--vurgu-zemin); color: var(--vurgu); }
  .turler input { accent-color: var(--vurgu); }
  .adim { font-size: var(--f-sm); font-weight: 500; color: var(--yazi-2); }
  .aciklama { font-size: var(--f-sm); color: var(--soluk); margin-bottom: var(--b3); max-width: 90ch; }
  .duzen { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: var(--b4); align-items: start; }
  .takvim-kutu { padding: var(--b3); }
  .takvim { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
  .bas { text-align: center; font-size: var(--f-xs); font-weight: 600; color: var(--soluk); padding-bottom: 2px; }
  .gun { display: flex; flex-direction: column; gap: 4px; min-height: 96px; padding: 6px; border: 1px solid var(--cizgi); border-radius: var(--r-kucuk); background: var(--yuzey); min-width: 0; }
  .gun.tatil { background: var(--tatil-zemin); }
  .gun.bugun { box-shadow: inset 0 0 0 2px var(--odak); }
  .gun-ust { display: flex; align-items: center; gap: 6px; padding: 0 2px; }
  .no { font-weight: 600; font-size: var(--f-sm); color: var(--yazi-2); }
  .gunadi { display: none; }
  .degisti { margin-left: auto; font-size: var(--f-xs); font-weight: 600; color: var(--izin); }
  .cipler { display: grid; gap: 3px; min-width: 0; }
  .cip { display: flex; align-items: center; gap: 5px; min-height: 26px; padding: 2px 6px; border: 1px solid transparent; border-radius: 6px; background: var(--yuzey-2); color: var(--yazi); font-size: 13px; font-weight: 500; text-align: left; cursor: pointer; min-width: 0; overflow-wrap: anywhere; }
  .gun.tatil .cip { background: var(--yuzey); }
  .cip:hover { border-color: var(--soluk); }
  .cip.h { color: var(--yazi-2); }
  .cip.h b { font-size: var(--f-xs); color: var(--haz); flex: none; }
  .cip.sec1 { border-color: var(--vurgu); background: var(--vurgu-zemin); box-shadow: inset 0 0 0 1px var(--vurgu); }
  .cip.sec2 { border-color: var(--izin); background: var(--izin-zemin); box-shadow: inset 0 0 0 1px var(--izin); }
  .panel { padding: var(--b4); display: grid; gap: var(--b3); position: sticky; top: var(--b4); scroll-margin-top: var(--b4); }
  .bos-panel { font-size: var(--f-sm); color: var(--yazi-2); }
  .secilen { display: grid; gap: 2px; font-size: var(--f-sm); color: var(--yazi-2); }
  .etiket { justify-self: start; padding: 2px 8px; border-radius: 6px; font-weight: 600; color: var(--yazi); }
  .etiket.sec1 { background: var(--vurgu-zemin); box-shadow: inset 0 0 0 1px var(--vurgu); }
  .etiket.sec2 { background: var(--izin-zemin); box-shadow: inset 0 0 0 1px var(--izin); }
  .ok { font-size: 20px; color: var(--soluk); line-height: 1; }
  .kontrol { display: grid; gap: 6px; }
  .satir { display: flex; gap: var(--b2); align-items: flex-start; font-size: var(--f-sm); padding: 6px 10px; border-radius: var(--r-kucuk); }
  .satir :global(svg) { flex: none; margin-top: 2px; }
  .satir.notr { background: var(--yuzey-2); color: var(--yazi-2); font-size: var(--f-xs); }
  .satir.uyari { background: var(--dikkat-zemin); } .satir.uyari :global(svg) { color: var(--dikkat); }
  .satir.hata { background: var(--hata-zemin); } .satir.hata :global(svg), .satir.hata b { color: var(--hata); }
  .satir.tamam { background: var(--vurgu-zemin); color: var(--vurgu); font-weight: 500; }
  .onay { padding: var(--b2) var(--b3); border-radius: var(--r-kucuk); background: var(--hata-zemin); color: var(--hata); font-size: var(--f-sm); font-weight: 500; }
  .dugmeler { display: flex; flex-wrap: wrap; gap: var(--b2); }
  .durum { font-size: var(--f-sm); font-weight: 500; padding: var(--b2) var(--b3); border-radius: var(--r-kucuk); }
  .durum.tamam { background: var(--vurgu-zemin); color: var(--vurgu); }
  .durum.hata { background: var(--hata-zemin); color: var(--hata); }
  .blok { margin-top: var(--b5); display: grid; gap: var(--b2); }
  .blok h2 { font-size: var(--f-lg); }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
  li { display: flex; align-items: center; gap: var(--b3); padding: var(--b2) var(--b3); border-radius: var(--r-kucuk); background: var(--yuzey); border: 1px solid var(--cizgi); }
  .bilgi { display: grid; flex: 1; min-width: 0; }
  .bilgi small { font-size: var(--f-xs); color: var(--soluk); }
  .bilgi .uyari-metin { color: var(--dikkat); font-weight: 500; }

  @media (max-width: 1100px) { .duzen { grid-template-columns: 1fr; } .panel { position: static; } }
  @media (max-width: 720px) {
    .takvim-kutu { padding: 0; overflow: hidden; }
    .takvim { grid-template-columns: 1fr; gap: 0; }
    .bas, .bosluk { display: none; }
    .gun { flex-direction: row; align-items: flex-start; min-height: 0; padding: 10px 12px; border-radius: 0; border-width: 0 0 1px; gap: 12px; }
    .gun-ust { flex-direction: column; align-items: flex-start; gap: 0; width: 76px; flex: none; }
    .no { font-size: var(--f-lg); color: var(--yazi); }
    .gunadi { display: block; font-size: var(--f-xs); color: var(--soluk); }
    .degisti { margin: 2px 0 0; }
    .cipler { flex: 1; grid-template-columns: 1fr 1fr; }
    .cip { font-size: var(--f-sm); }
  }
  @media (max-width: 380px) { .cipler { grid-template-columns: 1fr; } }
</style>
