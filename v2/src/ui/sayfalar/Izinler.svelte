<script lang="ts">
  import type { Kisi } from "../../veri/tipler";
  import { depo, tercihAl, tercihAyarla, resmiTatilMi, arifeMi, resmiTatilAyarla, arifeAyarla, aydaCalisanlar, ayCizelgesi } from "../../veri/depo.svelte";
  import { TERCIH_ACIKLAMA, TERCIH_AD, ROL_AD, type Tercih } from "../../veri/tipler";
  import { GUN_KISA, GUN_UZUN, kisaAd, gunMetni, gunSayisi, haftaGunu, haftaSonuMu, isoTarih } from "../../veri/tarih";
  import { veriAnlik } from "../../veri/depo.svelte";
  import { Baglam } from "../../motor/baglam";
  import IslemAlani from "../ortak/IslemAlani.svelte";
  import Ikon from "../ortak/Ikon.svelte";

  // kimler: listelenecek kişiler (o kadronun
  // nöbet tutanları); onayKilidi: eczane çizelgesi onaylıysa işaretler kilitlensin mi (acil listesinde onay yok)
  let { git, kimler = () => true, onayKilidi = true }: {
    git: (ad: "cizelge" | "puantaj" | "izinler" | "kisiler" | "ayarlar") => void; kimler?: (k: Kisi) => boolean; onayKilidi?: boolean;
  } = $props();

  type Mod = "kisi" | "tatil";
  let mod = $state<Mod>("kisi");
  const ARACLAR: (Tercih | "temizle")[] = ["izinli", "want", "avoid", "esVar", "esYok", "temizle"];
  let arac = $state<Tercih | "temizle">("izinli");
  type TatilArac = "resmi" | "arife" | "temizle";
  let tatilArac = $state<TatilArac>("resmi");

  const kisiler = $derived(aydaCalisanlar(depo.yil, depo.ay).filter(k => kimler(k)).sort((a, b) => a.name.localeCompare(b.name, "tr")));

  const onayli = $derived(onayKilidi && !!ayCizelgesi(depo.yil, depo.ay)?.onay);
  const gunler = $derived.by(() => {
    const y = depo.yil, m = depo.ay, n = gunSayisi(y, m), bos = haftaGunu(y, m, 1);
    return { bos, liste: Array.from({ length: n }, (_, i) => i + 1) };
  });

  // sürükleyerek birden çok güne işaret: basılı tutup gezdirilen günler aynı işareti alır
  let suruk = $state(false);
  function uygula(d: number) {
    if (onayli) return;
    const y = depo.yil, m = depo.ay;
    {
      if (tatilArac === "resmi") resmiTatilAyarla(y, m, d, !(resmiTatilMi(y, m, d) && !suruk));
      else if (tatilArac === "arife") arifeAyarla(y, m, d, !(arifeMi(y, m, d) && !suruk));
      else { resmiTatilAyarla(y, m, d, false); arifeAyarla(y, m, d, false); }
    }
  }
  // dokunmatik ekranda parmak sayfayı kaydırabilsin: işaret basınca değil dokunma bitince (click) konur,
  // sürükleyerek işaretleme yalnız fare/kalemde
  let dokunma = false;
  function basla(d: number, e: PointerEvent) { dokunma = e.pointerType === "touch"; if (dokunma || e.button !== 0) return; uygula(d); suruk = true; }
  function tikla(d: number) { if (dokunma) { dokunma = false; uygula(d); } }
  function gez(d: number) { if (suruk) uygula(d); }
  // kişi takvimi: güne dokunmak / sürüklemek seçili kişinin o gününe seçili işareti koyar
  function uygulaKisi(id: number, d: number) {
    if (onayli) return;
    const k = kisiler.find(x => x.id === id); if (!k || pasifMi(k, d)) return;
    const once = tercihAl(id, depo.yil, depo.ay, d);
    tercihAyarla(id, depo.yil, depo.ay, d, arac === "temizle" || (once === arac && !suruk) ? null : arac);
  }
  function baslaK(id: number, d: number, e: PointerEvent) { dokunma = e.pointerType === "touch"; if (dokunma || e.button !== 0) return; uygulaKisi(id, d); suruk = true; }
  function tiklaK(id: number, d: number) { if (dokunma) { dokunma = false; uygulaKisi(id, d); } }
  function gezK(id: number, d: number) { if (suruk) uygulaKisi(id, d); }
  const pasifMi = (k: Kisi, d: number) => (!!k.baslangic && isoTarih(depo.yil, depo.ay, d) < k.baslangic) || (!!k.bitis && isoTarih(depo.yil, depo.ay, d) > k.bitis);
  const KOD: Record<Tercih, string> = { izinli: "İ", want: "+", avoid: "−", esVar: "E+", esYok: "E−" };
  const GRUP_SIRA: Record<string, number> = { eczaci: 0, nobetci: 1, teknisyen: 2, destek: 3, servis: 4 };
  const GRUP_AD: Record<string, string> = { eczaci: "Eczacılar", nobetci: "Kemoterapi eczacıları", teknisyen: "Teknikerler", destek: "Destek personeli", servis: "Acil servis personeli" };
  const izinliSayisi = (d: number) => kisiler.filter(k => tercihAl(k.id, depo.yil, depo.ay, d) === "izinli").length;
  const izinGun = (id: number) => kisiAyIsaretleri(id).izinli ?? 0;
  function birak() { suruk = false; }
  const iki = (n: number) => String(n).padStart(2, "0");
  // haftalık bloklar (7'şer hücre, ay dışı günler boş)
  const haftalar = $derived.by(() => {
    const h: (number | null)[] = [...Array(gunler.bos).fill(null), ...gunler.liste];
    while (h.length % 7) h.push(null);
    return Array.from({ length: h.length / 7 }, (_, i) => h.slice(i * 7, i * 7 + 7));
  });

  const kisiAyIsaretleri = (id: number) => {
    const o: Partial<Record<Tercih, number>> = {};
    for (let d = 1; d <= gunSayisi(depo.yil, depo.ay); d++) { const t = tercihAl(id, depo.yil, depo.ay, d); if (t) o[t] = (o[t] ?? 0) + 1; }
    return o;
  };
  const ARAC_AD: Record<Tercih | "temizle", string> = { izinli: "İzinli", want: "Nöbet istiyor", avoid: "Nöbet istemiyor", esVar: "Eş durumu: nöbetçi olsun", esYok: "Eş durumu: nöbetçi olmasın", temizle: "İşareti kaldır" };
  // kişi seçicinin sırası (gruplara göre) ve işaretli gün sayısı
  const tabloKisiler = $derived(kisiler.slice().sort((a, b) => (GRUP_SIRA[a.role] ?? 9) - (GRUP_SIRA[b.role] ?? 9) || a.name.localeCompare(b.name, "tr")));
  const isaretliGun = (id: number) => Object.values(kisiAyIsaretleri(id)).reduce((t, n) => t + (n ?? 0), 0);
  // kişi izinleri takvimi: seçilen kişinin işaretleri günlere konur, her günde o günün tüm işaretleri görünür
  let seciliId = $state<number | null>(null);
  $effect(() => { if (!kisiler.some(k => k.id === seciliId)) seciliId = kisiler[0]?.id ?? null; });
  const secili = $derived(kisiler.find(k => k.id === seciliId) ?? null);
  const tumAdlar = $derived(depo.veri.staff.map(k => k.name));
  // o günün işaretleri (seçili kişi önce, sonra ad sırası)
  const gunIsaretleri = (d: number) => kisiler.map(k => ({ k, t: tercihAl(k.id, depo.yil, depo.ay, d) })).filter((x): x is { k: Kisi; t: Tercih } => !!x.t)
    .sort((a, b) => Number(b.k.id === seciliId) - Number(a.k.id === seciliId) || a.k.name.localeCompare(b.k.name, "tr"));
  function baslaT(d: number, e: PointerEvent) { if (seciliId !== null) baslaK(seciliId, d, e); }
  function tiklaT(d: number) { if (seciliId !== null) tiklaK(seciliId, d); }
  function gezT(d: number) { if (seciliId !== null) gezK(seciliId, d); }
  // izin arasındaki hafta sonu (izin sayılır; çizgili gösterilir) — motorun kendi kuralıyla, yalnız okunur
  const B = $derived(new Baglam(veriAnlik()));
</script>

<svelte:window onpointerup={birak} onpointercancel={birak} />

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

  <p class="kutu bilgi kullanim"><Ikon ad="bilgi" boyut={16} /><span>{mod === "kisi" ? "Kişiyi ve işaret türünü seçip takvimdeki günlere" : "Bir işaret türü seçip takvimdeki günlere"} dokunun; bilgisayarda fareyle basılı tutup gezdirerek birden çok güne işaretleyebilirsiniz. Aynı işarete yeniden dokunmak kaldırır. Tercihler çizelge oluşturulurken dikkate alınır; çizelge zaten varsa yeniden oluşturun.</span></p>
  {#if onayli}<p class="kutu dikkat onay-not" role="status">Bu ayın çizelgesi onaylı; işaretler değiştirilemez. Değiştirmek için önce Günlük Eczane Nöbet Listesi'nde onayı kaldırın.</p>{/if}

  {#if mod === "kisi"}
    <div class="arac-cubuk" role="radiogroup" aria-label="İşaret">
      {#each ARACLAR as a}
        <button class="arac-d t-{a}" role="radio" aria-checked={arac === a} onclick={() => (arac = a)} title={a === "temizle" ? "Dokunduğunuz günün işareti kalkar" : TERCIH_ACIKLAMA[a]}>{#if a !== "temizle"}<i class="kod k-{a}">{KOD[a]}</i>{:else}<Ikon ad="sil" boyut={15} />{/if}{ARAC_AD[a]}</button>
      {/each}
    </div>
    {#if arac !== "temizle"}<p class="arac-not2">{TERCIH_ACIKLAMA[arac]}</p>{/if}
    <section class="panel" aria-label="İzin ve tercih takvimi">
      <div class="panel-bas kisi-bas">
        <label class="kisi-sec"><span>Kişi</span>
          <select class="girdi" bind:value={seciliId}>
            {#each tabloKisiler as k, i (k.id)}
              {#if i === 0 || tabloKisiler[i - 1].role !== k.role}<option disabled>── {GRUP_AD[k.role] ?? ROL_AD[k.role]} ──</option>{/if}
              <option value={k.id}>{k.name}</option>
            {/each}
          </select>
        </label>
        {#if secili}<p class="kisi-sayi">Bu ay: <b class="rakam">{izinGun(secili.id)}</b> gün izin · <b class="rakam">{isaretliGun(secili.id) - izinGun(secili.id)}</b> tercih</p>{/if}
      </div>
      <div class="ht izin-ht tercih-ht" class:kilitli={onayli}>
        <div class="ht-bas" aria-hidden="true"><span></span>{#each GUN_UZUN as g, i}<span class:hs={i >= 5}><span class="g-uzun">{g}</span><span class="g-kisa">{GUN_KISA[i]}</span></span>{/each}</div>
        {#each haftalar as h, w}
        <div class="ht-hafta">
        <div class="ht-no" aria-hidden="true"><b class="rakam">{w + 1}</b><small>HAFTA</small></div>
        {#each h as d, hi (hi)}
        {#if d === null}<div class="ht-bos" aria-hidden="true"></div>
        {:else}
          {@const y = depo.yil}{@const m = depo.ay}
          {@const rt = resmiTatilMi(y, m, d)}{@const ar = arifeMi(y, m, d)}{@const hs = haftaSonuMu(y, m, d)}
          {@const t = secili ? tercihAl(secili.id, y, m, d) : null}
          {@const pasif = !!secili && pasifMi(secili, d)}
          {@const arasi = !!secili && !t && B.izinArasiMi(secili.id, y, m, d)}
          {@const l = gunIsaretleri(d)}
          {@const nIzin = izinliSayisi(d)}
          <button class="ht-gun gun" class:hs class:rt class:ar class:arasi class:pasif class:isaretli={!!t} disabled={onayli || pasif || !secili}
            aria-label="{gunMetni(y, m, d)}{secili ? ', ' + secili.name + ': ' + (t ? TERCIH_AD[t] : arasi ? 'izin arası' : pasif ? 'dönem dışı' : 'işaret yok') : ''}{l.length ? '. O gün: ' + l.map(x => x.k.name + ' ' + TERCIH_AD[x.t]).join(', ') : ''}"
            onpointerdown={e => baslaT(d, e)} onclick={() => tiklaT(d)} onpointerenter={() => gezT(d)}
            onkeydown={e => { if ((e.key === "Enter" || e.key === " ") && secili) { e.preventDefault(); uygulaKisi(secili.id, d); } }}>
            <span class="ht-ust"><span class="rakam t-uzun">{iki(d)}.{iki(m + 1)}.{y}</span><span class="rakam t-kisa">{d}</span>
              <span class="ht-sag">{#if nIzin}<span class="izin-say" class:cok={nIzin >= 2} title="O gün izinli kişi sayısı">{nIzin} izinli</span>{/if}<span class="gunadi">{rt ? "Resmi tatil" : ar ? "Arife" : GUN_KISA[haftaGunu(y, m, d)]}</span></span></span>
            <span class="isaretler">
              {#if t}<span class="benim"><i class="kod k-{t}">{KOD[t]}</i><span class="ad-uzun">{TERCIH_AD[t]}</span></span>{:else if arasi}<span class="benim soluk-y">izin arası</span>{:else if pasif}<span class="benim soluk-y">dönem dışı</span>{/if}
              {#each l.filter(x => x.k.id !== seciliId).slice(0, 4) as x (x.k.id)}<span class="baskasi"><i class="kod k-{x.t}">{KOD[x.t]}</i><span class="kisa-ad">{kisaAd(x.k.name, tumAdlar)}</span></span>{/each}
              {#if l.filter(x => x.k.id !== seciliId).length > 4}<span class="baskasi fazla">+{l.filter(x => x.k.id !== seciliId).length - 4}</span>{/if}
            </span>
          </button>
        {/if}
        {/each}
        </div>
        {/each}
      </div>
    </section>
    <p class="lejant alt-lejant"><span><i class="kod k-izinli">İ</i>İzinli</span><span><i class="ornek o-arasi"></i>İzin arası (hafta sonu da izin sayılır)</span><span><i class="kod k-want">+</i>Nöbet istiyor</span><span><i class="kod k-avoid">−</i>Nöbet istemiyor</span><span><i class="kod k-esVar">E+</i>Eş nöbetçi olsun</span><span><i class="kod k-esYok">E−</i>Eş nöbetçi olmasın</span><span><i class="ornek o-pasif"></i>Dönem dışı</span></p>
  {:else}
  <div class="duzen">
    <aside class="panel yan">
      <div class="panel-bas"><h2>Tatil günleri</h2></div>
      <p class="panel-ic yan-not">Hafta sonları zaten tatildir. Burada resmi tatil ve bayram günlerini, yarım gün çalışılan arifeleri işaretleyin; nöbet fazla mesaisi ve hazırlama görevleri buna göre hesaplanır.</p>
    </aside>
    <div class="sag-sutun">
      <section class="panel">
        <div class="panel-bas"><h2>İşaret türü</h2></div>
        <div class="panel-ic araclar" role="radiogroup" aria-label="İşaret">
          <label class="arac t-resmi" class:secili={tatilArac === "resmi"}><input type="radio" name="tatil-arac" checked={tatilArac === "resmi"} onchange={() => (tatilArac = "resmi")} />Resmi tatil</label>
          <label class="arac t-arife" class:secili={tatilArac === "arife"}><input type="radio" name="tatil-arac" checked={tatilArac === "arife"} onchange={() => (tatilArac = "arife")} />Arife (yarım gün)</label>
          <label class="arac t-temizle" class:secili={tatilArac === "temizle"}><input type="radio" name="tatil-arac" checked={tatilArac === "temizle"} onchange={() => (tatilArac = "temizle")} />İşareti kaldır</label>
        </div>
      </section>
      <section class="panel" aria-label="Ay takvimi">
        <div class="panel-bas"><h2>Ay takvimi</h2>
          <p class="lejant"><span><i class="ornek o-resmi"></i>Resmi tatil</span><span><i class="ornek o-arife"></i>Arife</span></p></div>
        <div class="ht izin-ht tatil-ht" class:kilitli={onayli}>
        <div class="ht-bas" aria-hidden="true"><span></span>{#each GUN_UZUN as g, i}<span class:hs={i >= 5}><span class="g-uzun">{g}</span><span class="g-kisa">{GUN_KISA[i]}</span></span>{/each}</div>
        {#each haftalar as h, w}
        <div class="ht-hafta">
        <div class="ht-no" aria-hidden="true"><b class="rakam">{w + 1}</b><small>HAFTA</small></div>
        {#each h as d, hi (hi)}
        {#if d === null}<div class="ht-bos" aria-hidden="true"></div>
        {:else}
            {@const y = depo.yil}{@const m = depo.ay}
            {@const rt = resmiTatilMi(y, m, d)}{@const ar = arifeMi(y, m, d)}{@const hs = haftaSonuMu(y, m, d)}
            <button class="ht-gun gun" class:hs class:rt class:ar disabled={onayli}
              aria-label="{gunMetni(y, m, d)}{rt ? ', resmi tatil' : ''}{ar ? ', arife' : ''}"
              onpointerdown={e => basla(d, e)} onclick={() => tikla(d)} onpointerenter={() => gez(d)}
              onkeydown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); uygula(d); } }}>
              <span class="ht-ust"><span class="rakam t-uzun">{iki(d)}.{iki(m + 1)}.{y}</span><span class="rakam t-kisa">{d}</span><span class="ht-sag"><span class="gunadi">{GUN_KISA[haftaGunu(y, m, d)]}</span></span></span>
              <span class="tatil-ic">{rt ? "Resmi tatil" : ar ? "Arife (yarım gün)" : ""}</span>
            </button>
          {/if}
          {/each}
          </div>
          {/each}
        </div>
      </section>
    </div>
  </div>
  {/if}
{/if}

<style>
  .bos-durum { padding: var(--b6); display: grid; gap: var(--b3); justify-items: start; }
  .bos-durum p { color: var(--yazi-2); }
  .kullanim { display: flex; gap: var(--b2); align-items: flex-start; margin-bottom: var(--b4); }
  .kullanim :global(svg) { flex: none; margin-top: 2px; color: var(--bilgi); }
  .onay-not { margin-bottom: var(--b4); font-weight: 600; }
  .duzen { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: var(--b4); align-items: start; }
  .yan-not { font-size: var(--f-sm); color: var(--yazi-2); }
  .sag-sutun { display: grid; gap: var(--b3); min-width: 0; }
  .araclar { display: flex; flex-wrap: wrap; gap: var(--b2) var(--b4); }
  .arac { display: inline-flex; align-items: center; gap: 6px; min-height: 30px; font-size: var(--f-sm); font-weight: 600; color: var(--yazi); cursor: pointer; }
  .arac input { width: 16px; height: 16px; accent-color: var(--lacivert); }
  .lejant { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: var(--f-xs); color: var(--yazi-2); }
  .lejant span { display: inline-flex; align-items: center; gap: 5px; }
  .ornek { display: inline-block; width: 14px; height: 12px; border: 1px solid var(--cizgi); }
  .o-arasi { background: repeating-linear-gradient(135deg, var(--izin-zemin) 0 3px, var(--yuzey) 3px 6px); }
  .o-pasif { background: var(--yuzey-2); border-style: dashed; }
  .o-resmi { background: var(--hs-zemin); border-color: var(--lacivert); }
  .o-arife { background: var(--arife-zemin); border-color: var(--arife); }
  /* işaretler: izinli koyu gri, izin arası çizgili, istiyor açık mavi, istemiyor açık turuncu */

  .arac-cubuk { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: var(--b2); }
  .arac-d { display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 4px 12px; border: 1px solid var(--cizgi); border-radius: var(--r-kucuk); background: var(--yuzey); color: var(--yazi); font: inherit; font-size: var(--f-sm); font-weight: 600; cursor: pointer; }
  .arac-d[aria-checked="true"] { border-color: var(--lacivert); box-shadow: inset 0 0 0 1px var(--lacivert); background: var(--vurgu-zemin); }
  .arac-d.t-temizle { color: var(--hata); }
  .arac-not2 { font-size: var(--f-xs); color: var(--yazi-2); margin-bottom: var(--b3); }
  .kod { display: inline-grid; place-items: center; min-width: 20px; height: 18px; padding: 0 2px; border-radius: 2px; font-style: normal; font-size: 11px; font-weight: 700; border: 1px solid transparent; }
  .k-izinli { background: var(--izin); color: #FFFFFF; }
  .k-want { background: var(--tek-zemin); color: var(--tek); border-color: var(--tek); }
  .k-avoid { background: var(--haz-zemin); color: var(--haz); border-color: var(--haz); }
  .k-esVar { background: var(--es-zemin); color: var(--es); border-color: var(--es); }
  .k-esYok { background: var(--esyok-zemin); color: var(--esyok); border-color: var(--esyok); }

  /* telefonda dokunma hedefi en az 28 px */
  .alt-lejant { margin-top: var(--b2); }
  /* takvim: haftalık form (ortak stil .ht); buradakiler işaretleme ve işaret görünümü */
  .izin-ht { user-select: none; touch-action: none; }
  .izin-ht.kilitli { opacity: .7; }
  @media (pointer: coarse) { .izin-ht { touch-action: manipulation; } }
  .tercih-ht .gun { min-height: 108px; }
  .tatil-ht .gun { min-height: 78px; }
  .gun:hover:not(:disabled) { box-shadow: inset 0 0 0 2px var(--vurgu); }
  .gun:disabled { cursor: default; }
  .gun.rt { background: color-mix(in srgb, var(--acik-mavi) 22%, var(--yuzey)); }
  .gun.rt .ht-ust { background: color-mix(in srgb, var(--acik-mavi) 60%, var(--yuzey)); }
  .gun.ar { background: var(--arife-zemin); }
  .gun.isaretli { box-shadow: inset 3px 0 0 var(--lacivert); }
  .gun.arasi { background: repeating-linear-gradient(135deg, var(--izin-zemin) 0 4px, var(--yuzey) 4px 8px); }
  .gun.pasif { background: var(--yuzey-2); }
  .tatil-ic { padding: 8px; font-size: var(--f-sm); font-weight: 700; color: var(--lacivert); }
  .kisi-bas { display: flex; flex-wrap: wrap; align-items: center; gap: var(--b2) var(--b4); }
  .kisi-sec { display: inline-flex; align-items: center; gap: var(--b2); font-size: var(--f-sm); font-weight: 700; color: var(--lacivert); }
  .kisi-sec select { min-width: 220px; min-height: 36px; }
  .kisi-sayi { font-size: var(--f-sm); color: var(--yazi-2); }
  .kisi-sayi b { color: var(--lacivert); }
  .izin-say { font-size: 11px; font-weight: 700; color: var(--yazi-2); white-space: nowrap; }
  .izin-say.cok { color: var(--haz); }
  .isaretler { display: grid; gap: 2px; align-content: start; padding: 5px 8px 6px; min-width: 0; }
  .benim { display: flex; align-items: center; gap: 5px; font-size: 13px; font-weight: 700; color: var(--lacivert); margin-bottom: 2px; }
  .soluk-y { font-size: var(--f-xs); font-weight: 600; color: var(--soluk); }
  .baskasi { display: flex; align-items: center; gap: 4px; font-size: 11.5px; color: var(--yazi-2); min-width: 0; }
  .baskasi .kod { min-width: 18px; height: 15px; font-size: 9.5px; }
  .kisa-ad { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .fazla { font-weight: 700; color: var(--soluk); }
  .alt-lejant .kod { min-width: 18px; height: 16px; font-size: 10px; }
  @media (max-width: 720px) {
    .kisi-sec { width: 100%; } .kisi-sec select { flex: 1; min-width: 0; }
    .isaretler { padding: 2px 3px 3px; gap: 1px; }
    .benim .ad-uzun, .izin-say { display: none; }
    .baskasi { font-size: 10px; gap: 2px; }
    .baskasi .kod { min-width: 14px; height: 13px; font-size: 8.5px; padding: 0 1px; }
  }
  @media (max-width: 960px) {
    .duzen { grid-template-columns: 1fr; }
  }
  @media (max-width: 720px) {
    .tercih-ht .gun { min-height: 66px; }
    .tatil-ht .gun { min-height: 54px; }
    .tatil-ic { padding: 3px; font-size: 10px; }
  }
</style>
