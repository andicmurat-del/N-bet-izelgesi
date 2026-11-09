<script lang="ts">
  import Bilgi from "../ortak/Bilgi.svelte";
  // Nöbet değişimi (yerine tutma): takvimde bir görev seçilir (günlük eczanede nöbet ya da hazırlama, acil eczanede
  // acil nöbeti), yerine tutacak kişi seçilir. Kurallar varsayımsal puantajla denetlenir. Değişim yalnız puantaja
  // yansır; yıllık denge çizelgeye / acil listesine göre kalır. Bu ayın değişimleri listelenir, geri alınabilir
  // (eskiden yapılmış karşılıklı takaslar da geçmişte görünür ve geri alınabilir).
  import { tick, untrack } from "svelte";
  import { depo, veriAnlik, ayCizelgesi } from "../../veri/depo.svelte";
  import { acilDegisimDenetle, acilYerineAdaylarHesapla, degisimDenetle, yerineAdaylarHesapla } from "../../motor";
  import { degisimUygula, degisimGeriAl, ayDegisimleri, puantajIzgarasi, IZIN_AD, type Gorev, type DegisimIstegi, type IzinTuru } from "../../veri/degisim.svelte";
  import { GUN_KISA, gunMetni, haftaGunu, kisaAd } from "../../veri/tarih";
  import Ikon from "../ortak/Ikon.svelte";

  type Kontrol = { engel: string[]; uyari: string[]; bilgi: string[] };
  type Aday = { id: number; ad: string; engel: number; uyari: number; yil: number; k: Kontrol };
  type Secim = { id: number; gun: number; kod: Gorev };

  // acil: Acil Eczane puantajında; yalnız acil nöbetleri ve acil kadrosu
  let { acil = false }: { acil?: boolean } = $props();
  const y = $derived(depo.yil), m = $derived(depo.ay);
  const cizelgeVar = $derived(acil ? Object.values(depo.veri.acil[`${y}-${m}`] ?? {}).some(l => l.length) : !!ayCizelgesi(y, m)?.days.some(g => g.assigned.length));
  const G = $derived(puantajIzgarasi(y, m));
  const gorevliler = (gun: number) => {
    const N: { id: number; ad: string; rol: string }[] = [], H: typeof N = [];
    for (const r of G.satirlar) { const c = r.cells[gun - 1]; if (c?.kod === "N" && c.acil === acil) N.push({ id: r.s.id, ad: r.s.name, rol: r.s.role }); else if (!acil && c?.kod === "H") H.push({ id: r.s.id, ad: r.s.name, rol: r.s.role }); }
    N.sort((a, b) => Number(b.rol === "eczaci" || b.rol === "nobetci") - Number(a.rol === "eczaci" || a.rol === "nobetci"));
    return { N, H };
  };
  // değişimin hangi listeye ait olduğu: acil kadrosuna yapılan nöbet değişimi acil listesindedir
  const acilKisi = (id: number) => { const k = depo.veri.staff.find(s => s.id === id); return !!k && (k.role === "servis" || ((k.role === "eczaci" || k.role === "nobetci") && !!k.acilTutar)); };
  const buListede = (z: { yer: number; gorev?: string; yerYeni?: string; sebep?: string }) => acil ? !z.sebep && z.yerYeni === "N" && acilKisi(z.yer) : !(z.yerYeni === "N" && acilKisi(z.yer) && !z.sebep);
  const degisenGunler = $derived(new Set(ayDegisimleri(y, m).filter(buListede).map(z => z.gun)));
  const bugun = new Date();
  const bugunMu = (d: number) => bugun.getFullYear() === y && bugun.getMonth() === m && bugun.getDate() === d;
  const tumAdlar = $derived(depo.veri.staff.map(k => k.name));
  const kisa = (a: string) => kisaAd(a, tumAdlar);
  const ad = (id: number) => depo.veri.staff.find(k => k.id === id)?.name ?? "(silinmiş)";
  const gorevAdi = (k: Gorev) => (k === "H" ? "hazırlama" : "nöbet");

  let s1 = $state<Secim | null>(null);
  let yer = $state("");
  let not = $state("");
  let onayAdimi = $state(false);
  let durum = $state<{ tur: "tamam" | "hata"; metin: string } | null>(null);
  const temizle = () => { s1 = null; yer = ""; not = ""; onayAdimi = false; };
  $effect(() => { y; m; untrack(temizle); });
  const ayni = (a: Secim | null, b: Secim) => !!a && a.id === b.id && a.gun === b.gun && a.kod === b.kod;
  function sec(x: Secim) {
    durum = null; onayAdimi = false;
    if (ayni(s1, x)) { temizle(); return; }
    s1 = x; yer = "";
    // dar ekranda panel takvimin altında kalır: seçimden sonra görünür yapılır
    if (innerWidth <= 1100) tick().then(() => panel?.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }));
  }
  let panel = $state<HTMLElement>();

  const adaylar = $derived(s1 ? ((acil ? acilYerineAdaylarHesapla(veriAnlik(), y, m, s1.gun, s1.id) : yerineAdaylarHesapla(veriAnlik(), y, m, s1.gun, s1.id, s1.kod)) as Aday[]) : []);
  $effect(() => { if (s1 && !adaylar.some(a => String(a.id) === yer)) yer = String((adaylar.find(a => !a.engel) ?? adaylar[0])?.id ?? ""); });
  const enUygun = $derived((adaylar.find(a => !a.engel && !a.uyari) ?? adaylar.find(a => !a.engel))?.id);
  const istek = $derived.by((): DegisimIstegi | null => {
    if (!s1) return null;
    return yer ? { y, m, gorev: s1.kod, tur: "devir", gun: s1.gun, cik: s1.id, yer: Number(yer) } : null;
  });
  const kontrol = $derived(istek ? ((acil ? acilDegisimDenetle(veriAnlik(), y, m, istek.gun, istek.cik, istek.yer) : degisimDenetle(veriAnlik(), istek)) as Kontrol) : null);
  $effect(() => { istek; onayAdimi = false; });

  function uygula() {
    if (!istek) return;
    if (kontrol?.engel.length && !onayAdimi) { onayAdimi = true; return; }
    degisimUygula({ ...istek, not: not.trim() });
    durum = { tur: "tamam", metin: "Değişim puantaja işlendi." };
    temizle();
  }

  // bu ayın değişimleri (takasın iki yarısı tek satır)
  const satirlar = $derived.by(() => {
    const L = [...ayDegisimleri(y, m)].filter(buListede).reverse(), goruldu = new Set<string>(), out: { id: number; metin: string; tur: string; zaman: number; not?: string }[] = [];
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
    <p class="adim" aria-live="polite">{s1 ? "Yerine tutacak kişiyi seçin." : acil ? "Takvimde devredilecek acil nöbetine dokunun." : "Takvimde devredilecek nöbete ya da hazırlamaya dokunun."}</p>
  </div>
  <Bilgi baslik="Nasıl çalışır?"><p>Bir kişinin {acil ? "acil nöbetini" : "nöbetini ya da hazırlamasını"} başka biri tutar. Değişimler yalnız puantaja yansır; yıllık denge {acil ? "acil nöbet listesine" : "çizelgeye"} göre hesaplandığı için kimsenin sonraki aylardaki payı değişmez.</p></Bilgi>

  <div class="duzen">
    <section class="panel-blok takvim-kutu" aria-label="Görevler">
      <div class="takvim">
        {#each GUN_KISA as d}<div class="bas" aria-hidden="true">{d}</div>{/each}
        {#each { length: haftaGunu(y, m, 1) } as _}<div class="bosluk" aria-hidden="true"></div>{/each}
        {#each G.gunler as g (g.gun)}
          {@const gr = gorevliler(g.gun)}
          <div class="gun" class:hs={g.tatil} class:bugun={bugunMu(g.gun)}>
            <span class="serit"><b class="rakam">{g.gun}</b><span class="gunadi">{GUN_KISA[g.dw]}</span>{#if degisenGunler.has(g.gun)}<span class="degisti" title="Bu günde değişim var">değişti</span>{/if}</span>
            <span class="cipler">
              {#each gr.N as p}
                {@const x = { id: p.id, gun: g.gun, kod: "N" as Gorev }}
                <button class="cip" class:sec1={ayni(s1, x)} aria-pressed={ayni(s1, x)} onclick={() => sec(x)} aria-label="{p.ad}, {gunMetni(y, m, g.gun)} nöbet"><span class="gorev {p.rol === 'teknisyen' || p.rol === 'servis' ? 'tek' : p.rol === 'destek' ? 'des' : 'ecz'}">{p.rol === "teknisyen" ? "TEK" : p.rol === "servis" ? "SRV" : p.rol === "destek" ? "DES" : "ECZ"}</span><span class="ad">{p.ad}</span><span class="ad-kisa">{kisa(p.ad)}</span></button>
              {/each}
              {#each gr.H as p, i}
                {@const x = { id: p.id, gun: g.gun, kod: "H" as Gorev }}
                <button class="cip h" class:sec1={ayni(s1, x)} aria-pressed={ayni(s1, x)} onclick={() => sec(x)} aria-label="{p.ad}, {gunMetni(y, m, g.gun)} hazırlama"><span class="gorev haz">H{i + 1}</span><span class="ad">{p.ad}</span><span class="ad-kisa">{kisa(p.ad)}</span></button>
              {/each}
            </span>
          </div>
        {/each}
      </div>
    </section>

    <div class="yan">
    <aside class="kart panel" aria-label="Değişim" bind:this={panel}>
      {#if !s1}
        <p class="bos-panel"><b>Yerine tutma</b><br />{acil ? "Takvimde bir kişinin acil nöbetine dokunun, sonra yerine tutacak kişiyi seçin." : "Takvimde bir kişinin nöbetine ya da hazırlamasına (H) dokunun, sonra yerine tutacak kişiyi seçin."}</p>
      {:else}
        <div class="secili-gorev"><b>{gunMetni(y, m, s1.gun)} · {gorevAdi(s1.kod)}</b><span>{ad(s1.id)}</span></div>
          <div class="adaylar-bas">Yerine {s1.kod === "H" ? "hazırlama yapabilecekler" : "tutabilecekler"}</div>
          <div class="adaylar" role="radiogroup" aria-label="Yerine tutacak kişi">
            {#each adaylar as a (a.id)}
              <button class="aday" class:s={String(a.id) === yer} class:kot={!!a.engel} role="radio" aria-checked={String(a.id) === yer} onclick={() => (yer = String(a.id))}>
                <span class="av" aria-hidden="true">{a.ad.split(" ").map(x => x[0]).join("").slice(0, 2).toLocaleUpperCase("tr")}</span>
                <b>{a.ad}</b>
                <small>{a.engel ? "Kural dışı" : a.uyari ? "Uyarı var" : a.id === enUygun ? "En uygun" : "Uygun"} · yıl {a.yil} {acil ? "acil nöbeti" : gorevAdi(s1.kod)}</small>
              </button>
            {:else}<p class="bos-panel">Uygun kişi yok.</p>{/each}
          </div>

        {#if istek}
          <label class="alan"><span>Not (isteğe bağlı)</span><input class="girdi" bind:value={not} maxlength="160" placeholder="ör. kişisel mazeret" /></label>
          <div class="kontrol" aria-live="polite">
            {#if kontrol}
              {#each kontrol.engel as t}<p class="satir hata"><Ikon ad="uyari" boyut={15} /><span><b>Kural dışı:</b> {t}</span></p>{/each}
              {#each kontrol.uyari as t}<p class="satir uyari"><Ikon ad="uyari" boyut={15} /><span>{t}</span></p>{/each}
              {#if !kontrol.engel.length && !kontrol.uyari.length}<p class="satir tamam"><Ikon ad="tamam" boyut={15} />Kural sorunu yok.</p>{/if}
              {#each kontrol.bilgi as t}<p class="satir notr">{t}</p>{/each}
            {/if}
          </div>
        {/if}
        {#if onayAdimi}<p class="onay" role="alert">Bu değişimde kural dışı durum var. Yine de uygulamak için tekrar basın.</p>{/if}
        <div class="dugmeler">
          <button class="dugme ana genis" onclick={uygula} disabled={!istek}><Ikon ad="tamam" />{onayAdimi ? "Yine de uygula" : "Yerine yaz"}</button>
          <button class="dugme sade" onclick={temizle}>Vazgeç</button>
        </div>
      {/if}
      {#if durum}<p class="durum {durum.tur}" role="status">{durum.metin}</p>{/if}
    </aside>
    <section class="kart gecmis" aria-labelledby="dg-liste">
      <h2 id="dg-liste">Değişim geçmişi</h2>
      {#if satirlar.length}
        <ul class="tl">
          {#each satirlar as s (s.id)}
            <li class:izin={s.tur !== "Yerine tutma" && s.tur !== "Karşılıklı takas"}>
              <i aria-hidden="true"></i>
              <span class="bilgi"><small class="zm">{zaman(s.zaman)} · {s.tur}</small><b>{s.metin}</b>{#if s.not}<small>{s.not}</small>{/if}
                {#if geriOnay?.id === s.id}<small class="uyari-metin">{geriOnay.metin}</small>{/if}</span>
              <button class="geri" onclick={() => geriAl(s.id)}>{geriOnay?.id === s.id ? "Evet, geri al" : "Geri al"}</button>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="aciklama">Bu ay için değişim yok.</p>
      {/if}
    </section>
    </div>
  </div>

{/if}

<style>
  .bos { padding: var(--b5); display: grid; gap: var(--b2); }
  .bos p { color: var(--yazi-2); }
  .ust { display: flex; flex-wrap: wrap; gap: var(--b3); align-items: center; margin-bottom: var(--b2); }
  .adim { font-size: var(--f-sm); font-weight: 500; color: var(--yazi-2); }
  .aciklama { font-size: var(--f-sm); color: var(--soluk); margin-bottom: var(--b3); max-width: 90ch; }
  .duzen { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: var(--b4); align-items: start; }
  .takvim-kutu { padding: 0 !important; overflow: hidden; }
  .takvim { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
  .bas, .bosluk, .gun { border-right: 1px solid var(--cizgi); border-bottom: 1px solid var(--cizgi); }
  .bas:nth-child(7n), .gun:nth-child(7n) { border-right: 0; }
  .bas { background: var(--tablo-bas); color: var(--lacivert); font-size: var(--f-xs); font-weight: 700; text-align: center; padding: 6px 0; letter-spacing: .03em; }
  .bosluk { background: var(--yuzey-2); }
  .gun { display: flex; flex-direction: column; min-height: 112px; background: var(--yuzey); min-width: 0; }
  .serit { display: flex; align-items: center; gap: 6px; min-height: 24px; padding: 2px 8px; background: var(--panel-bas); border-bottom: 1px solid var(--cizgi-acik); font-size: var(--f-xs); color: var(--yazi-2); }
  .gun.hs .serit { background: color-mix(in srgb, var(--acik-mavi) 28%, var(--yuzey)); color: var(--lacivert); }
  .serit b { font-size: var(--f-sm); color: var(--lacivert); }
  .gun.bugun .serit b { text-decoration: underline; text-underline-offset: 3px; }
  .degisti { margin-left: auto; font-size: var(--f-xs); font-weight: 700; color: var(--izin); white-space: nowrap; }
  .cipler { display: grid; gap: 3px; padding: 6px 6px 8px; min-width: 0; }
  .cip { display: flex; align-items: center; gap: 6px; min-height: 26px; padding: 2px 4px; border: 1px solid transparent; border-radius: var(--r-kucuk); background: transparent; color: var(--yazi); font-size: 13px; text-align: left; cursor: pointer; min-width: 0; }
  .cip:hover { background: var(--yuzey-2); border-color: var(--cizgi); }
  .cip .ad { min-width: 0; overflow-wrap: anywhere; font-weight: 600; }
  .cip.h .ad { font-weight: 400; color: var(--yazi-2); }
  .cip:not(.h) + .cip.h { margin-top: 3px; border-top: 1px dashed var(--cizgi); border-top-left-radius: 0; border-top-right-radius: 0; }
  .cip.sec1 { border-color: var(--vurgu); background: var(--vurgu-zemin); box-shadow: inset 0 0 0 1px var(--vurgu); }
  .ad-kisa { display: none; }
  .duzen { grid-template-columns: minmax(0, 1fr) 340px; }
  .yan { display: grid; gap: var(--b3); align-content: start; }
  .panel { padding: var(--b4); display: grid; gap: var(--b3); scroll-margin-top: var(--b4); }
  .secili-gorev { display: grid; gap: 2px; padding: var(--b2) var(--b3); background: var(--secili-satir); border: 1px solid color-mix(in srgb, var(--altin) 45%, var(--yuzey)); }
  .secili-gorev b { color: var(--lacivert); }
  .secili-gorev span { font-size: var(--f-sm); }
  .adaylar-bas { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--yazi-2); }
  .adaylar { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; max-height: 320px; overflow-y: auto; }
  .aday { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 0 8px; align-items: center; padding: 7px 8px; border: 1px solid var(--cizgi); border-radius: var(--r-kucuk); background: var(--yuzey); text-align: left; cursor: pointer; color: var(--yazi); font: inherit; }
  .aday:hover { border-color: var(--lacivert); }
  .aday:focus-visible { outline: 2px solid var(--odak); outline-offset: 1px; }
  .aday .av { grid-row: span 2; width: 30px; height: 30px; border-radius: 50%; background: var(--vurgu); color: var(--vurgu-yazi); display: grid; place-items: center; font-size: 11px; font-weight: 700; }
  .aday b { font-size: var(--f-sm); color: var(--lacivert); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .aday small { font-size: 11px; color: var(--yazi-2); }
  .aday.s { border-color: var(--vurgu); background: var(--vurgu-zemin); box-shadow: inset 0 0 0 1px var(--vurgu); }
  .aday.kot { opacity: .55; }
  .genis { flex: 1; justify-content: center; }
  .gecmis { padding: 0 var(--b4) var(--b4); display: grid; gap: var(--b2); }
  .gecmis h2 { font-size: var(--f-lg); }
  .tl { gap: 0; }
  .tl li { display: grid; grid-template-columns: 12px minmax(0, 1fr) auto; gap: var(--b2); align-items: start; padding: var(--b2) 0; border: 0; border-bottom: 1px solid var(--cizgi-acik); border-radius: 0; background: none; }
  .tl li:last-child { border-bottom: 0; }
  .tl i { width: 10px; height: 10px; border-radius: 50%; background: var(--vurgu); margin-top: 5px; }
  .tl li.izin i { background: var(--hata); }
  .tl .bilgi b { font-weight: 500; font-size: var(--f-sm); }
  .tl .zm { font-weight: 700; color: var(--lacivert); }
  .geri { border: 0; background: none; padding: 2px 0; color: var(--baglanti); font: inherit; font-size: var(--f-xs); font-weight: 700; cursor: pointer; white-space: nowrap; }
  .geri:hover { text-decoration: underline; }
  .bos-panel { font-size: var(--f-sm); color: var(--yazi-2); }
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
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
  li { display: flex; align-items: center; gap: var(--b3); padding: var(--b2) var(--b3); border-radius: var(--r-kucuk); background: var(--yuzey); border: 1px solid var(--cizgi); }
  .bilgi { display: grid; flex: 1; min-width: 0; }
  .bilgi small { font-size: var(--f-xs); color: var(--soluk); }
  .bilgi .uyari-metin { color: var(--dikkat); font-weight: 500; }

  @media (max-width: 1100px) { .duzen { grid-template-columns: 1fr; } }
  @media (max-width: 720px) {
    .bas { font-size: 11px; padding: 4px 0; }
    .gun { min-height: 76px; }
    .serit { padding: 1px 3px; gap: 2px; min-height: 18px; }
    .serit b { font-size: 12px; }
    .gunadi { display: none; }
    .degisti { font-size: 0; width: 6px; height: 6px; border-radius: 50%; background: var(--izin); }
    .cipler { padding: 3px 2px 4px; gap: 2px; }
    .cip { font-size: 10.5px; gap: 2px; min-height: 24px; padding: 1px 2px; }
    .cip .gorev { min-width: 0; width: 5px; height: 12px; padding: 0; font-size: 0; }
    .cip .ad { display: none; }
    .ad-kisa { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
    .cip.h .ad-kisa { font-weight: 400; }
  }
</style>
