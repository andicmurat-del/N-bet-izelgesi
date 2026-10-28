<script lang="ts">
  import { depo, ayCizelgesi, cizelgeKaydet, cizelgeSil, onayla, onayiKaldir, eskimeNedenleri, aydaCalisanlar, ornekKadroYukle, tumVeriyiSil, resmiTatilMi, arifeMi } from "../../veri/depo.svelte";
  import { arkaPlandaOlustur } from "../../motor/istemci";
  import { uyariSiniflandir } from "../../motor";
  import { cizelgeKitabi } from "../../disa/cizelgeXlsx";
  import { dosyaKaydet, hataMetni } from "../../disa/indir";
  import { AYLAR, ayAdi } from "../../veri/tarih";
  import AySecici from "../ortak/AySecici.svelte";
  import Ikon from "../ortak/Ikon.svelte";
  import Takvim from "../cizelge/Takvim.svelte";
  import Uyarilar from "../cizelge/Uyarilar.svelte";
  import KisiOzeti from "../cizelge/KisiOzeti.svelte";
  import GunPenceresi from "../cizelge/GunPenceresi.svelte";
  import AcilServis from "../cizelge/AcilServis.svelte";
  import CalismaListesi from "../cizelge/CalismaListesi.svelte";
  import Sekmeler from "../ortak/Sekmeler.svelte";

  let { git }: { git: (ad: "cizelge" | "puantaj" | "izinler" | "kisiler" | "ayarlar") => void } = $props();

  const c = $derived(ayCizelgesi(depo.yil, depo.ay));
  // acil servis eczacıları eczane çizelgesine girmez; onların nöbetleri Acil servis görünümündedir
  const kisiler = $derived(aydaCalisanlar(depo.yil, depo.ay).filter(k => k.role !== "servis"));
  const nobetci = $derived(kisiler.filter(k => k.role !== "destek"));
  const eczaci = $derived(kisiler.filter(k => k.role === "eczaci" || k.role === "nobetci"));
  const eskime = $derived(c ? eskimeNedenleri(depo.yil, depo.ay) : []);

  // görünüm: eczane nöbet çizelgesi, günlük çalışma listesi ya da acil servis nöbetleri
  const GORUNUMLER = [{ ad: "nobet", baslik: "Eczane nöbeti", kisa: "Nöbet", ikon: "takvim" }, { ad: "liste", baslik: "Çalışma listesi", kisa: "Liste", ikon: "liste" }, { ad: "acil", baslik: "Acil servis", kisa: "Acil", ikon: "acil" }] as const;
  let gorunum = $state<(typeof GORUNUMLER)[number]["ad"]>("nobet");

  let calisiyor = $state(false);
  let hata = $state("");
  let vurgu = $state<number | null>(null);
  let silOnayi = $state(false);
  let durum = $state("");

  async function olustur(varyasyon = 0) {
    hata = ""; silOnayi = false; calisiyor = true;
    const y = depo.yil, m = depo.ay;
    try {
      const r = await arkaPlandaOlustur($state.snapshot(depo.veri) as any, y, m, varyasyon);
      if (!r.days) { hata = r.warnings[0] ?? "Çizelge oluşturulamadı."; return; }
      cizelgeKaydet(y, m, r.days, r.warnings);
    } catch (e) {
      hata = "Çizelge oluşturulurken bir sorun çıktı: " + (e as Error).message;
    } finally {
      calisiyor = false;
    }
  }

  const sayilar = $derived.by(() => {
    if (!c) return null;
    const dolu = c.days.filter(g => g.assigned.length >= 2).length;
    const s = { hata: 0, uyari: 0, bilgi: 0 };
    for (const t of c.uyarilar) s[(uyariSiniflandir(t) as { seviye: keyof typeof s }).seviye]++;
    const elle = c.days.filter(g => g.locked).length;
    return { dolu, gun: c.days.length, ...s, elle };
  });

  let gunAcik = $state(false);
  let acikGun = $state(1);
  function gunAc(d: number) { acikGun = d; gunAcik = true; }

  async function excel() {
    if (!c) return;
    const y = c.year, m = c.month;
    try {
      const blob = cizelgeKitabi($state.snapshot(c) as any, $state.snapshot(depo.veri.staff) as any, depo.veri.kurum.ad, d => resmiTatilMi(y, m, d));
      const ok = await dosyaKaydet(`nobet-cizelgesi-${y}-${String(m + 1).padStart(2, "0")}.xlsx`, blob, blob.type);
      durum = ok ? "Excel dosyası kaydedildi." : "";
    } catch (e) { durum = hataMetni(e, "Dosya kaydedilemedi."); }
  }
  let pdfHazirlaniyor = $state(false);
  async function pdf() {
    if (!c) return;
    const y = c.year, m = c.month;
    pdfHazirlaniyor = true; durum = "";
    try {
      const { cizelgePdf } = await import("../../disa/cizelgePdf");
      const blob = cizelgePdf($state.snapshot(c) as any, $state.snapshot(depo.veri.staff) as any, { kurum: depo.veri.kurum.ad, resmiTatil: d => resmiTatilMi(y, m, d), arife: d => arifeMi(y, m, d) });
      const ok = await dosyaKaydet(`nobet-cizelgesi-${y}-${String(m + 1).padStart(2, "0")}.pdf`, blob, "application/pdf");
      durum = ok ? "PDF kaydedildi." : "";
    } catch (e) { durum = hataMetni(e, "PDF oluşturulamadı."); }
    finally { pdfHazirlaniyor = false; }
  }
  function sil() {
    if (!silOnayi) { silOnayi = true; return; }
    cizelgeSil(depo.yil, depo.ay); silOnayi = false;
  }
  const onayMetni = $derived(c?.onay ? new Date(c.onay.zaman).toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" }) + (c.onay.kim ? " · " + c.onay.kim : "") : "");
</script>

<header class="sayfa-bas">
  <div class="baslik">
    <h1>Nöbet çizelgesi</h1>
    {#if depo.veri.kurum.ad}<p>{depo.veri.kurum.ad}</p>{/if}
  </div>
  <AySecici />
</header>

{#if depo.veri.ornek}
  <div class="ornek-serit" role="note">
    <span><b>Örnek kadroyla deniyorsunuz.</b> Kişiler ve çizelgeler örnektir. Kendi personelinizi girmeden önce örnek verileri silin.</span>
    <button class="dugme kucuk" onclick={tumVeriyiSil}>Örnek verileri sil</button>
  </div>
{/if}

{#if !depo.veri.staff.length}
  <section class="kart karsilama">
    <h2>Nöbet çizelgesine hoş geldiniz</h2>
    <p>Çizelge üç adımda hazırlanır: personeli girin, izinleri ve tatil günlerini işaretleyin, sonra "Çizelgeyi oluştur"a basın. Kurallar (nöbet ertesi izin, hafta sonu sınırları, fazla mesai eşitliği) kendiliğinden uygulanır.</p>
    <ol class="adimlar">
      <li><b>Personel</b><span>Eczacı, tekniker ve destek personeli</span></li>
      <li><b>İzin ve tercihler</b><span>İzinli günler, resmi tatiller, istekler</span></li>
      <li><b>Çizelge</b><span>Oluştur, gözden geçir, onayla</span></li>
    </ol>
    <div class="dugmeler">
      <button class="dugme ana" onclick={() => git("kisiler")}><Ikon ad="kisiler" />Personel ekle</button>
      <button class="dugme" onclick={ornekKadroYukle}>Örnek kadroyla dene</button>
    </div>
  </section>
{:else}
  <Sekmeler secenekler={GORUNUMLER} bind:secili={gorunum} etiket="Görünüm" />

  {#if gorunum === "acil"}
    <AcilServis {git} />
  {:else if gorunum === "liste"}
    {#if c}<CalismaListesi />
    {:else}
      <section class="kart bos-ay">
        <h2>{ayAdi(depo.yil, depo.ay)} çizelgesi henüz yok</h2>
        <p>Çalışma listesi bu ayın nöbet çizelgesi ve puantajından hazırlanır. Önce çizelgeyi oluşturun.</p>
        <div class="dugmeler"><button class="dugme ana" onclick={() => (gorunum = "nobet")}><Ikon ad="takvim" />Eczane nöbeti</button></div>
      </section>
    {/if}
  {:else}
  <div class="arac-cubugu">
    <div class="durumlar">
      {#if c}
        {#if c.onay}<span class="rozet tamam"><Ikon ad="tamam" boyut={14} />Onaylı</span>{:else}<span class="rozet notr">Taslak</span>{/if}
        {#if sayilar}
          <span class="rozet notr rakam">{sayilar.dolu}/{sayilar.gun} gün dolu</span>
          {#if sayilar.hata}<span class="rozet hata rakam">{sayilar.hata} kural sağlanamadı</span>{/if}
          {#if sayilar.uyari}<span class="rozet dikkat rakam">{sayilar.uyari} dikkat</span>{/if}
          {#if sayilar.elle}<span class="rozet notr rakam"><Ikon ad="kilit" boyut={13} />{sayilar.elle} gün elle</span>{/if}
        {/if}
      {:else}
        <span class="rozet notr">{ayAdi(depo.yil, depo.ay)} için çizelge yok</span>
      {/if}
    </div>
    <div class="dugmeler">
      {#if !c}
        <button class="dugme ana" onclick={() => olustur()} disabled={calisiyor || nobetci.length < 2}><Ikon ad="takvim" />Çizelgeyi oluştur</button>
      {:else if !c.onay}
        <button class="dugme" onclick={() => olustur()} disabled={calisiyor} title="Elle düzenlenen günler korunur"><Ikon ad="yenile" />Yeniden oluştur</button>
        <button class="dugme" onclick={() => olustur(1 + Math.floor(Math.random() * 9999))} disabled={calisiyor} title="Aynı kurallarla farklı bir dağılım"><Ikon ad="karisik" />Farklı dağılım</button>
        <button class="dugme ana" onclick={() => onayla(depo.yil, depo.ay)} disabled={calisiyor}><Ikon ad="tamam" />Onayla</button>
      {:else}
        <button class="dugme" onclick={() => onayiKaldir(depo.yil, depo.ay)}>Onayı kaldır</button>
      {/if}
      {#if c}
        <button class="dugme" onclick={pdf} disabled={calisiyor || pdfHazirlaniyor}><Ikon ad="indir" />{pdfHazirlaniyor ? "Hazırlanıyor…" : "PDF"}</button>
        <button class="dugme" onclick={excel} disabled={calisiyor}><Ikon ad="indir" />Excel</button>
      {/if}
      {#if c && !c.onay}<button class="dugme sade tehlike" onclick={sil} disabled={calisiyor}><Ikon ad="sil" />{silOnayi ? "Evet, sil" : "Sil"}</button>{/if}
    </div>
  </div>

  {#if c?.onay}<p class="bant bilgi">Onaylandı: {onayMetni}. Onaylı çizelgenin günleri ve o ayın izin işaretleri kilitlidir; ay içinde gelişen izin, rapor ve nöbet değişimleri Puantaj bölümünden girilir.</p>{/if}
  {#if eskime.length}<p class="bant dikkat"><Ikon ad="uyari" boyut={16} />{eskime.join(" ")} Çizelgeyi yeniden oluşturmanız önerilir.</p>{/if}
  {#if nobetci.length < 2}<p class="bant dikkat">Çizelge için {AYLAR[depo.ay]} ayında en az 2 nöbetçi (eczacı ya da tekniker) gerekir. <button class="baglanti" onclick={() => git("kisiler")}>Personel ekleyin</button>.</p>
  {:else if !eczaci.length}<p class="bant dikkat">Her gün en az bir eczacı nöbetçi olmalı; personel listesinde eczacı yok.</p>{/if}
  {#if hata}<p class="bant hata" role="alert">{hata}</p>{/if}
  {#if durum}<p class="bant tamam" role="status">{durum}</p>{/if}

  {#if calisiyor}
    <div class="kart calisiyor" role="status" aria-live="polite">
      <span class="donen" aria-hidden="true"></span>
      <div><b>Çizelge hazırlanıyor</b><p>Kurallar ve eşitlik hedefleri için binlerce olasılık deneniyor; birkaç saniye sürer.</p></div>
    </div>
  {/if}

  {#if c}
    <div class="duzen">
      <div class="ana-sutun">
        <section class="kart takvim-kutu" aria-label="Takvim">
          <Takvim {c} {vurgu} {gunAc} />
          <p class="lejant"><span><span class="isaret eczaci"></span>Eczacı</span><span><span class="isaret teknisyen"></span>Tekniker</span><span><b class="h">H1 / H2</b> Hazırlama</span><span class="kirmizi"><Ikon ad="uyari" boyut={14} /> Kural esnetildi</span><span><Ikon ad="kilit" boyut={13} /> Elle düzenlendi</span></p>
        </section>
        {#if c.uyarilar.length}
          <section class="uyari-bolum"><h2>Uyarılar</h2><Uyarilar metinler={c.uyarilar} /></section>
        {/if}
      </div>
      <aside class="kart yan"><KisiOzeti {c} kisiler={kisiler} bind:vurgu /></aside>
    </div>
    <GunPenceresi bind:acik={gunAcik} {c} gun={acikGun} />
  {:else if !calisiyor}
    <section class="kart bos-ay">
      <h2>{ayAdi(depo.yil, depo.ay)} çizelgesi henüz yok</h2>
      <p>Oluşturmadan önce bu ayın izinlerini ve resmi tatillerini işaretleyin. Önceki ayların çizelgeleri varsa yıllık eşitlik (hafta sonu, Cuma, Perşembe, resmi tatil) onlara göre sağlanır.</p>
      <div class="dugmeler">
        <button class="dugme" onclick={() => git("izinler")}><Ikon ad="izin" />İzin ve tatilleri işaretle</button>
      </div>
    </section>
  {/if}
  {/if}
{/if}

<style>
  .sayfa-bas { display: flex; flex-wrap: wrap; gap: var(--b4); align-items: flex-end; justify-content: space-between; margin-bottom: var(--b4); }
  .baslik p { color: var(--soluk); margin-top: 2px; }
  .ornek-serit { display: flex; flex-wrap: wrap; align-items: center; gap: var(--b3); justify-content: space-between; padding: var(--b3) var(--b4); margin-bottom: var(--b4); border-radius: var(--r); background: var(--dikkat-zemin); color: var(--yazi); border: 1px dashed var(--dikkat); font-size: var(--f-sm); }
  .karsilama { padding: var(--b6); display: grid; gap: var(--b4); max-width: 760px; }
  .karsilama p { color: var(--yazi-2); max-width: 64ch; }
  .adimlar { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--b3); counter-reset: adim; }
  .adimlar li { counter-increment: adim; display: grid; align-content: start; gap: 2px; padding: var(--b3) var(--b4); border: 1px solid var(--cizgi); border-radius: var(--r); background: var(--yuzey-2); }
  .adimlar li::before { content: counter(adim); font-family: var(--yazi-rakam); font-size: var(--f-xs); color: var(--vurgu); font-weight: 600; }
  .adimlar span { font-size: var(--f-sm); color: var(--soluk); }
  .arac-cubugu { display: flex; flex-wrap: wrap; gap: var(--b3); align-items: center; justify-content: space-between; margin-bottom: var(--b3); }
  .durumlar, .dugmeler { display: flex; flex-wrap: wrap; gap: var(--b2); align-items: center; }
  .bant { display: flex; align-items: center; gap: var(--b2); flex-wrap: wrap; padding: var(--b2) var(--b4); border-radius: var(--r); margin-bottom: var(--b3); font-size: var(--f-sm); font-weight: 500; }
  .bant.bilgi { background: var(--bilgi-zemin); color: var(--bilgi); }
  .bant.dikkat { background: var(--dikkat-zemin); color: var(--dikkat); }
  .bant.hata { background: var(--hata-zemin); color: var(--hata); }
  .bant.tamam { background: var(--vurgu-zemin); color: var(--vurgu); }
  .baglanti { border: 0; background: none; padding: 0; color: inherit; text-decoration: underline; cursor: pointer; font-weight: 600; }
  .calisiyor { display: flex; gap: var(--b4); align-items: center; padding: var(--b4) var(--b5); margin-bottom: var(--b3); }
  .calisiyor p { color: var(--soluk); font-size: var(--f-sm); }
  .donen { width: 28px; height: 28px; border-radius: 50%; border: 3px solid var(--cizgi); border-top-color: var(--vurgu); animation: don 0.9s linear infinite; flex: none; }
  @keyframes don { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .donen { animation: none; border-top-color: var(--vurgu); } }
  .duzen { display: grid; grid-template-columns: minmax(0, 1fr) 290px; gap: var(--b4); align-items: start; }
  .ana-sutun { display: grid; gap: var(--b4); min-width: 0; }
  .takvim-kutu { padding: var(--b3); display: grid; gap: var(--b3); }
  .lejant { display: flex; flex-wrap: wrap; gap: var(--b2) var(--b4); font-size: var(--f-xs); color: var(--soluk); padding: 0 var(--b1); }
  .lejant > span { display: inline-flex; align-items: center; gap: 6px; }
  .lejant .h { color: var(--haz); }
  .lejant .kirmizi { color: var(--hata); }
  .uyari-bolum { display: grid; gap: var(--b2); }
  .uyari-bolum h2 { font-size: var(--f-lg); }
  .yan { padding: var(--b4); position: sticky; top: var(--b4); max-height: calc(100dvh - 32px); overflow-y: auto; }
  .bos-ay { padding: var(--b5); display: grid; gap: var(--b3); max-width: 760px; }
  .bos-ay p { color: var(--yazi-2); }

  @media (max-width: 1100px) {
    .duzen { grid-template-columns: 1fr; }
    .yan { position: static; max-height: none; }
  }
  @media (max-width: 720px) {
    .takvim-kutu { padding: 0; overflow: hidden; }
    .lejant { padding: var(--b2) var(--b3) var(--b3); }
    .karsilama { padding: var(--b5) var(--b4); }
    .adimlar { grid-template-columns: 1fr; }
    .arac-cubugu .dugmeler { width: 100%; }
        }
</style>
