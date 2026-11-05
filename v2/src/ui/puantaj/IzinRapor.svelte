<script lang="ts">
  import Bilgi from "../ortak/Bilgi.svelte";
  // Ay içinde gelişen izin ve rapor: kişi, tür ve tarih aralığı seçilir; puantaja etkisi ve kişinin o aralıktaki
  // nöbet/hazırlama görevleri gösterilir, her görev için yerine geçecek kişi önerilir: kurallara uyanlar arasında yerine
  // tutma sırayla gelir (yıl içinde en az yerine tutan önce). Kaydedilince yerine geçenler çizelgeye ve puantaja işlenir;
  // yıllık eşitlikte görev raporlu / izinli kişinin sayılır (telafi gerekmez).
  import { untrack } from "svelte";
  import { depo, veriAnlik, aydaCalisanlar } from "../../veri/depo.svelte";
  import { yerineAdaylarHesapla } from "../../motor";
  import { izinUygula, izinSil, ayIzinleri, puantajIzgarasi, IZIN_AD, IZIN_KISA, type IzinTuru, type Gorev } from "../../veri/degisim.svelte";
  import { ROL_AD, type Kisi } from "../../veri/tipler";
  import { GUN_KISA, gunMetni, gunSayisi, haftaGunu } from "../../veri/tarih";
  import Ikon from "../ortak/Ikon.svelte";

  // kimler: kayıt girilebilen ve listelenen kişiler (Günlük Eczane / Acil Eczane kadrosu)
  let { kimler = () => true }: { kimler?: (k: Kisi) => boolean } = $props();
  type Kontrol = { engel: string[]; uyari: string[]; bilgi: string[] };
  type Aday = { id: number; ad: string; rol: string; engel: number; uyari: number; yil: number; fm: number; yerine: number; k: Kontrol };

  const y = $derived(depo.yil), m = $derived(depo.ay), dim = $derived(gunSayisi(y, m));
  const SIRA: Record<string, number> = { eczaci: 0, nobetci: 1, teknisyen: 2, destek: 3, servis: 4 };
  const kisiler = $derived(aydaCalisanlar(y, m).filter(k => kimler(k)).sort((a, b) => SIRA[a.role] - SIRA[b.role] || a.name.localeCompare(b.name, "tr")));
  const TURLER: IzinTuru[] = ["R", "YI", "NI", "DI"];

  let tur = $state<IzinTuru>("R");
  let kisi = $state("");
  const bugun = new Date();
  const ilkGun = () => (bugun.getFullYear() === depo.yil && bugun.getMonth() === depo.ay ? bugun.getDate() : 1);
  let bas = $state(ilkGun()), bit = $state(ilkGun());
  let secim = $state<Record<number, string>>({});
  let onayAdimi = $state<string[] | null>(null);
  let durum = $state<{ tur: "tamam" | "hata"; metin: string } | null>(null);
  // ay değişince form sıfırlanır (yalnız ay/yıl izlenir)
  $effect(() => { y; m; untrack(() => { kisi = ""; bas = ilkGun(); bit = bas; durum = null; }); });
  $effect(() => { if (bit < bas) bit = bas; });

  const G = $derived(puantajIzgarasi(y, m));
  const r = $derived(kisi ? G.satirlar.find(x => x.s.id === Number(kisi)) : undefined);
  const sadece = $derived(!!r && (r.s.role === "nobetci" || r.s.role === "destek"));
  const etki = $derived.by(() => {
    if (!r) return null;
    let yaz = 0, mesai = 0; const niKalan: number[] = [], acil: number[] = [], cakisma: { gun: number; gorev: Gorev }[] = [];
    for (let g = bas; g <= bit; g++) {
      const c = r.cells[g - 1], gg = G.gunler[g - 1];
      if (c.acil) { acil.push(g); yaz++; continue; }
      if (c.kod === "N" || c.kod === "H") { cakisma.push({ gun: g, gorev: c.kod }); yaz++; if (!gg.tatil && !sadece) mesai++; }
      else if (c.kod === "NI" && !c.ov) niKalan.push(g);
      else if (!gg.tatil && !sadece) { yaz++; mesai++; }
    }
    const onceki = bas > 1 ? r.cells[bas - 2] : null;
    return { yaz, mesai, niKalan, acil, cakisma, oncekiNobet: onceki?.kod === "N" && tur !== "NI" };
  });
  // her görev için aday listesi (kurallara uyanlar önce)
  const adaylar = $derived.by(() => {
    if (!r || !etki) return [] as { gun: number; gorev: Gorev; l: Aday[] }[];
    const v = veriAnlik();
    return etki.cakisma.map(cz => ({ ...cz, l: yerineAdaylarHesapla(v, y, m, cz.gun, r.s.id, cz.gorev, true) as Aday[] }));
  });
  // varsayılan seçim: ilk kural dışı olmayan aday; kullanıcının geçerli seçimi korunur
  $effect(() => {
    const once = untrack(() => $state.snapshot(secim)) as Record<number, string>, yeni: Record<number, string> = {};
    for (const a of adaylar) {
      const s = once[a.gun], iyi = a.l.find(x => !x.engel) ?? a.l[0];
      yeni[a.gun] = s !== undefined && (s === "0" || a.l.some(x => String(x.id) === s)) ? s : String(iyi?.id ?? 0);
    }
    secim = yeni;
  });
  $effect(() => { kisi; tur; bas; bit; JSON.stringify(secim); onayAdimi = null; });

  const gunAdi = (g: number) => gunMetni(y, m, g);
  // takvimde aralık seçimi: basılı tutup sürükle; ya da önce başlangıca, sonra bitişe dokun
  let suruk = $state(false), capa = 1, tekSecim = false;
  function takvimBas(d: number, e: PointerEvent) {
    if (e.button !== 0) return;
    if (tekSecim && bas === bit && d > bas) { bit = d; tekSecim = false; }
    else { bas = d; bit = d; capa = d; tekSecim = true; }
    suruk = true;
  }
  function takvimGez(d: number) { if (!suruk) return; bas = Math.min(capa, d); bit = Math.max(capa, d); if (d !== capa) tekSecim = false; }
  const KOD_YAZI: Record<string, string> = { N: "Nöbet", H: "Hazırlama", NI: "Nİ", YI: "Yİ", R: "R", DI: "Dİ" };
  const enUygun = (l: Aday[]) => (l.find(x => !x.engel && !x.uyari) ?? l.find(x => !x.engel))?.id;
  function kaydet() {
    if (!r) return;
    const sec = adaylar.map(a => ({ gun: a.gun, gorev: a.gorev, yer: Number(secim[a.gun] ?? 0), aday: a.l.find(x => String(x.id) === secim[a.gun]) }));
    if (!onayAdimi) {
      const sorun: string[] = [];
      const kd = sec.filter(s => s.aday?.engel);
      if (kd.length) sorun.push(`Seçilen yerine geçenlerden bazıları için kural dışı durum var: ${kd.map(s => gunAdi(s.gun)).join(", ")}.`);
      const bos = sec.filter(s => !s.yer);
      if (bos.length) sorun.push(`${bos.map(s => gunAdi(s.gun)).join(", ")} için yerine kimse seçilmedi; görev eksik kalır.`);
      if (sorun.length) { onayAdimi = sorun; return; }
    }
    const adi = r.s.name;
    izinUygula(y, m, r.s.id, tur, bas, bit, sec.map(({ gun, gorev, yer }) => ({ gun, gorev, yer })));
    durum = { tur: "tamam", metin: `${adi}: ${IZIN_AD[tur].toLocaleLowerCase("tr")} kaydedildi${sec.some(s => s.yer) ? "; yerine geçenler çizelgeye ve puantaja işlendi (yıllık eşitlikte görev " + adi + " adına sayılır)." : "."}` };
    kisi = ""; onayAdimi = null;
  }

  const kayitlar = $derived(ayIzinleri(y, m).filter(x => { const k = depo.veri.staff.find(s => s.id === x.id); return !k || kimler(k); }));
  const ad = (id: number) => depo.veri.staff.find(k => k.id === id)?.name ?? "(silinmiş)";
  let silinecek = $state<string | null>(null);
  function kaldir(x: (typeof kayitlar)[number]) {
    const k = `${x.id}-${x.kod}-${x.bas}`;
    if (silinecek !== k) { silinecek = k; return; }
    izinSil(y, m, x.id, x.bas, x.bit, x.kod); silinecek = null;
    durum = { tur: "tamam", metin: `${ad(x.id)}: ${IZIN_AD[x.kod].toLocaleLowerCase("tr")} kaydı kaldırıldı.` };
  }
</script>

<svelte:window onpointerup={() => (suruk = false)} onpointercancel={() => (suruk = false)} />
<div class="duzen">
  <section class="kart panel-blok form" aria-labelledby="izin-baslik">
    <h2 id="izin-baslik">Yeni kayıt</h2>
    <div class="ust-form">
      <label class="alan"><span>Kişi</span>
        <select class="girdi" bind:value={kisi}><option value="">Kişi seçin</option>{#each kisiler as k}<option value={String(k.id)}>{k.name} · {ROL_AD[k.role]}</option>{/each}</select>
      </label>
      <fieldset class="turler">
        <legend>Tür</legend>
        {#each TURLER as t}<label class:secili={tur === t}><input type="radio" name="izin-tur" value={t} bind:group={tur} />{IZIN_AD[t].replace(/ \(.*\)$/, "")}</label>{/each}
      </fieldset>
    </div>
    <p class="ipucu">Takvimde başlangıç gününe dokunup bitiş gününe kadar sürükleyin (ya da önce başlangıca, sonra bitişe dokunun).{r ? " Kişinin görevleri takvimde görünür." : ""}</p>
    <div class="takvim" role="group" aria-label="Tarih aralığı">
      {#each GUN_KISA as d}<div class="bas" aria-hidden="true">{d}</div>{/each}
      {#each { length: haftaGunu(y, m, 1) } as _}<div class="bosluk" aria-hidden="true"></div>{/each}
      {#each G.gunler as g (g.gun)}
        {@const c = r?.cells[g.gun - 1]}
        {@const sec = g.gun >= bas && g.gun <= bit}
        <button class="gun" class:hs={g.tatil} class:sec class:ilk={sec && g.gun === bas} class:son={sec && g.gun === bit}
          aria-pressed={sec} aria-label="{gunAdi(g.gun)}{c && KOD_YAZI[c.kod] ? ', ' + KOD_YAZI[c.kod] : ''}"
          onpointerdown={e => takvimBas(g.gun, e)} onpointerenter={() => takvimGez(g.gun)}
          onkeydown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (tekSecim && bas === bit && g.gun > bas) { bit = g.gun; tekSecim = false; } else { bas = bit = capa = g.gun; tekSecim = true; } } }}>
          <b class="rakam">{g.gun}</b>
          {#if c && KOD_YAZI[c.kod]}<span class="gv k-{c.acil ? 'A' : c.kod}">{c.acil ? "Acil" : KOD_YAZI[c.kod]}</span>{/if}
          {#if sec}<span class="isr">{IZIN_KISA[tur]}</span>{/if}
        </button>
      {/each}
    </div>
  </section>

  <div class="yan">
  <section class="kart panel-blok secim-panel" aria-live="polite">
    <h2>Seçim · {bas === bit ? gunAdi(bas) : `${bas}–${bit}. günler`}<span class="sayi">{bit - bas + 1} gün</span></h2>
    {#if !r}
      <p class="satir notr">Kişiyi ve türü seçip takvimde günleri işaretleyin; puantaja etkisi ve görev çakışmaları burada görünür.</p>
    {:else if etki}
      {#if adaylar.length}<p class="satir uyari ozet-u"><b>{adaylar.length} görev bu aralığa düşüyor</b></p>{/if}
      <p class="satir notr">
        {#if etki.yaz}{etki.yaz} gün puantaja <b>{IZIN_AD[tur]}</b> olarak yazılır.{#if !sadece}{tur === "NI" ? (etki.mesai ? ` Fazla mesaisi ${etki.mesai * 8} saat azalır.` : "") : " Mesai sayıldığı için bu günler fazla mesaiyi düşürmez."}{/if}
        {:else}Bu aralıkta puantaja yazılacak gün yok (tatil ya da nöbet ertesi izin).{/if}
      </p>
      {#if etki.niKalan.length}<p class="satir notr">{etki.niKalan.map(gunAdi).join(", ")} nöbet ertesi izin (Nİ) olarak kalır.</p>{/if}
      {#if etki.oncekiNobet}<p class="satir uyari"><Ikon ad="uyari" boyut={15} />Bir önceki gün nöbetçi: nöbet ertesi izni bu kayıtla çakışabilir.</p>{/if}
      {#if etki.acil.length}<p class="satir uyari"><Ikon ad="uyari" boyut={15} />{etki.acil.map(gunAdi).join(", ")} acil eczane nöbeti var; yerine geçeni Acil Eczane &gt; Acil Eczane Nöbet Listesi'nden seçin.</p>{/if}
    {/if}

    {#each adaylar as a (a.gun)}
      {@const sec = a.l.find(x => String(x.id) === secim[a.gun])}
      {@const iyi = enUygun(a.l)}
      {@const one = [...a.l.filter(x => !x.engel).slice(0, 3)]}
      <div class="cakisma">
        <p><b>{gunAdi(a.gun)}</b> <span class="soluk">{a.gorev === "H" ? "Hazırlama" : "Nöbet"}</span></p>
        <small class="kucuk-bas">Yerine önerilen</small>
        <div class="oneri" role="radiogroup" aria-label="{gunAdi(a.gun)} yerine geçen">
          {#each one as x (x.id)}<button class="ny" class:s={String(x.id) === secim[a.gun]} role="radio" aria-checked={String(x.id) === secim[a.gun]} onclick={() => (secim[a.gun] = String(x.id))}>{x.ad}{x.id === iyi ? " · en uygun" : ""}</button>{/each}
        </div>
        <select class="girdi kucuk-sec" aria-label="Tüm adaylar" onchange={e => (secim[a.gun] = e.currentTarget.value)}>
          {#each a.l as x}<option value={String(x.id)} selected={String(x.id) === secim[a.gun]}>{x.ad} · yıl içinde {x.yerine ? `${x.yerine} kez yerine tuttu` : "yerine tutmadı"}{x.engel ? " · kural dışı" : x.uyari ? " · uyarı var" : ""}</option>{/each}
          <option value="0" selected={secim[a.gun] === "0"}>Şimdilik boş bırak (sonra nöbet değişimiyle ayarlanır)</option>
        </select>
        {#if sec}
          <div class="kontrol">
            {#each sec.k.engel as t}<p class="satir hata"><Ikon ad="uyari" boyut={15} /><span><b>Kural dışı:</b> {t}</span></p>{/each}
            {#each sec.k.uyari as t}<p class="satir uyari"><Ikon ad="uyari" boyut={15} /><span>{t}</span></p>{/each}
            {#if !sec.k.engel.length && !sec.k.uyari.length}<p class="satir tamam"><Ikon ad="tamam" boyut={15} />Kural sorunu yok.</p>{/if}
          </div>
        {:else if secim[a.gun] === "0"}
          <p class="satir uyari"><Ikon ad="uyari" boyut={15} />Bu gün {a.gorev === "H" ? "hazırlama" : "nöbet"} eksik kalır.</p>
        {/if}
      </div>
    {/each}

    {#if onayAdimi}<div class="onay" role="alert">{#each onayAdimi as t}<p>{t}</p>{/each}<p>Yine de kaydetmek için tekrar basın.</p></div>{/if}
    <div class="dugmeler">
      <button class="dugme ana genis" onclick={kaydet} disabled={!r}><Ikon ad="tamam" />{onayAdimi ? "Yine de kaydet" : adaylar.length ? "Kaydet ve yerine yaz" : "Kaydet"}</button>
      {#if kisi}<button class="dugme sade" onclick={() => (kisi = "")}>Temizle</button>{/if}
    </div>
    {#if durum}<p class="durum {durum.tur}" role="status">{durum.metin}</p>{/if}
    <Bilgi baslik="Nasıl çalışır?"><p>Ay içinde gelişen rapor, yıllık izin ve fazla mesai karşılığı nöbet izni buradan girilir. Kişinin o günlerdeki nöbet ve hazırlamaları için yerine geçecek kişi önerilir: yerine tutma sırayla gelir (yıl içinde en az yerine tutan önce). Yıllık eşitlikte görev raporlu / izinli kişinin sayılır; sonradan telafi edilmez.</p></Bilgi>
  </section>

  <section class="kart panel-blok liste" aria-labelledby="kayit-baslik">
    <h2 id="kayit-baslik">Bu ayın kayıtları</h2>
    {#if kayitlar.length}
      <ul>
        {#each kayitlar as x (`${x.id}-${x.kod}-${x.bas}`)}
          {@const k = `${x.id}-${x.kod}-${x.bas}`}
          <li>
            <span class="kod k-{x.kod}">{IZIN_KISA[x.kod]}</span>
            <span class="bilgi"><b>{ad(x.id)}</b><small>{IZIN_AD[x.kod]} · {x.bas === x.bit ? gunAdi(x.bas) : `${x.bas}–${x.bit}. günler`} · {x.gunler.length} gün</small></span>
            <button class="dugme kucuk sade tehlike" onclick={() => kaldir(x)}>{silinecek === k ? "Evet, kaldır" : "Kaldır"}</button>
          </li>
        {/each}
      </ul>
      <p class="aciklama">Kaldırılan kayıtların günleri puantajda yeniden çizelgeden gelir. Yerine yazılan görevler kalır; geri almak için Nöbet değişimi sekmesindeki listeyi kullanın.</p>
    {:else}
      <p class="aciklama">Bu ay için izin ya da rapor kaydı yok.</p>
    {/if}
  </section>
  </div>
</div>

<style>
  .duzen { display: grid; grid-template-columns: minmax(0, 1fr) 400px; gap: var(--b4); align-items: start; }
  .yan { display: grid; gap: var(--b3); align-content: start; }
  .ust-form { display: grid; grid-template-columns: minmax(200px, 280px) 1fr; gap: var(--b3); align-items: end; }
  .ipucu { font-size: var(--f-xs); color: var(--yazi-2); }
  .takvim { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); border-top: 1px solid var(--cizgi-acik); border-left: 1px solid var(--cizgi-acik); user-select: none; touch-action: none; }
  .takvim .bas, .takvim .bosluk, .takvim .gun { border-right: 1px solid var(--cizgi-acik); border-bottom: 1px solid var(--cizgi-acik); }
  .takvim .bas { background: var(--tablo-bas); color: var(--lacivert); font-size: var(--f-xs); font-weight: 700; text-align: center; padding: 5px 0; }
  .takvim .bosluk { background: var(--yuzey-2); }
  .takvim .gun { position: relative; min-height: 64px; padding: 5px 7px; display: flex; flex-direction: column; align-items: flex-start; gap: 3px; background: var(--yuzey); border-top: 0; border-left: 0; border-radius: 0; cursor: pointer; font: inherit; color: var(--yazi); text-align: left; }
  .takvim .gun:hover { box-shadow: inset 0 0 0 2px var(--altin); }
  .takvim .gun:focus-visible { outline: 2px solid var(--odak); outline-offset: -2px; }
  .takvim .gun b { color: var(--lacivert); font-size: var(--f-sm); }
  .takvim .gun.hs { background: var(--hs-zemin); }
  .takvim .gun.sec { background: color-mix(in srgb, var(--tek) 10%, var(--yuzey)); }
  .takvim .gun.ilk { box-shadow: inset 3px 0 0 var(--vurgu); }
  .takvim .gun.son { box-shadow: inset -3px 0 0 var(--vurgu); }
  .takvim .gun.ilk.son { box-shadow: inset 3px 0 0 var(--vurgu), inset -3px 0 0 var(--vurgu); }
  .gv { font-size: 11px; font-weight: 700; padding: 1px 5px; border-radius: 2px; }
  .gv.k-N { background: var(--nobet-hucre); color: #FFFFFF; }
  .gv.k-A { background: var(--acil); color: #FFFFFF; }
  .gv.k-H { background: var(--haz-zemin); color: var(--haz); }
  .gv.k-NI { background: var(--izin-zemin); color: var(--izin); }
  .gv.k-YI { background: var(--ister-zemin); color: var(--ister); }
  .gv.k-R, .gv.k-DI { background: var(--hata-zemin); color: var(--hata); }
  .isr { position: absolute; top: 5px; right: 7px; font-size: 11px; font-weight: 700; color: var(--vurgu); }
  .secim-panel h2 { display: flex; align-items: baseline; gap: var(--b2); }
  .sayi { margin-left: auto; font-size: var(--f-sm); font-weight: 500; color: var(--yazi-2); }
  .ozet-u { display: block; }
  .kucuk-bas { font-size: 11px; font-weight: 700; color: var(--yazi-2); }
  .oneri { display: flex; flex-wrap: wrap; gap: 4px; }
  .ny { border: 1px solid var(--cizgi); background: var(--yuzey); padding: 4px 9px; font: inherit; font-size: var(--f-xs); border-radius: var(--r-kucuk); cursor: pointer; color: var(--yazi); }
  .ny.s { border-color: var(--vurgu); background: var(--vurgu-zemin); color: var(--vurgu); font-weight: 700; }
  .kucuk-sec { font-size: var(--f-xs); min-height: 30px; }
  .soluk { color: var(--yazi-2); }
  .genis { flex: 1; justify-content: center; }
  .kart { padding: 0 var(--b4) var(--b4); display: grid; gap: var(--b3); }
  h2 { font-size: var(--f-lg); }
  .aciklama { font-size: var(--f-sm); color: var(--soluk); }
  fieldset { border: 0; margin: 0; padding: 0; min-width: 0; }
  legend { font-size: var(--f-sm); font-weight: 500; color: var(--yazi-2); margin-bottom: var(--b1); }
  .turler { display: flex; flex-wrap: wrap; gap: var(--b2); }
  .turler legend { width: 100%; }
  .turler label { display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 var(--b3); border: 1px solid var(--cizgi); border-radius: var(--r-kucuk); cursor: pointer; font-weight: 500; }
  .turler label.secili { border-color: var(--vurgu); background: var(--vurgu-zemin); color: var(--vurgu); }
  .turler input { accent-color: var(--vurgu); }
  .iki { display: grid; grid-template-columns: 1fr 1fr; gap: var(--b3); }
  .etki, .kontrol { display: grid; gap: 6px; }
  .satir { display: flex; gap: var(--b2); align-items: flex-start; font-size: var(--f-sm); padding: 6px 10px; border-radius: var(--r-kucuk); }
  .satir :global(svg) { flex: none; margin-top: 2px; }
  .satir.notr { background: var(--yuzey-2); color: var(--yazi-2); display: block; }
  .satir.kucuk { font-size: var(--f-xs); }
  .satir.uyari { background: var(--dikkat-zemin); } .satir.uyari :global(svg) { color: var(--dikkat); }
  .satir.hata { background: var(--hata-zemin); } .satir.hata :global(svg), .satir.hata b { color: var(--hata); }
  .satir.tamam { background: var(--vurgu-zemin); color: var(--vurgu); font-weight: 500; }
  .cakisma { display: grid; gap: var(--b2); padding: var(--b3); border: 1px solid var(--cizgi); border-left: 3px solid var(--izin); border-radius: var(--r-kucuk); }
  .cakisma > p { font-size: var(--f-sm); }
  .onay { padding: var(--b3); border-radius: var(--r-kucuk); background: var(--hata-zemin); color: var(--hata); font-size: var(--f-sm); font-weight: 500; display: grid; gap: 4px; }
  .dugmeler { display: flex; flex-wrap: wrap; gap: var(--b2); }
  .durum { font-size: var(--f-sm); font-weight: 500; padding: var(--b2) var(--b3); border-radius: var(--r-kucuk); }
  .durum.tamam { background: var(--vurgu-zemin); color: var(--vurgu); }
  .durum.hata { background: var(--hata-zemin); color: var(--hata); }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
  li { display: flex; align-items: center; gap: var(--b3); padding: var(--b2) var(--b3); border-radius: var(--r-kucuk); background: var(--yuzey-2); }
  .bilgi { display: grid; flex: 1; min-width: 0; }
  .bilgi small { font-size: var(--f-xs); color: var(--soluk); }
  .kod { display: inline-grid; place-items: center; min-width: 30px; height: 24px; padding: 0 4px; border-radius: 4px; font-weight: 700; font-size: var(--f-xs); }
  .k-R { background: var(--hata-zemin); color: var(--hata); }
  .k-YI { background: var(--ister-zemin); color: var(--ister); }
  .k-NI { background: var(--es-zemin); color: var(--es); }
  .k-DI { background: var(--yuzey); color: var(--yazi-2); box-shadow: inset 0 0 0 1px var(--cizgi); }
  @media (max-width: 1100px) { .duzen { grid-template-columns: 1fr; } }
  @media (pointer: coarse) { .takvim { touch-action: auto; } }
  @media (max-width: 720px) { .ust-form { grid-template-columns: 1fr; } .takvim .gun { min-height: 50px; padding: 3px; } .gv { font-size: 0; width: 8px; height: 8px; padding: 0; border-radius: 50%; } }
  @media (max-width: 480px) { .kart { padding: 0 var(--b4) var(--b4); } .iki { grid-template-columns: 1fr; } }
</style>
