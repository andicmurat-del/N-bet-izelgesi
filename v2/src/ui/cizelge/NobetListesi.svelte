<script lang="ts" module>
  // Sekme ya da sayfa değişince bileşen yeniden kurulur: süren arama (ilerlemesiyle) ve takvim / liste seçimi korunur;
  // arama sürerken dönülen sayfada düğmeler yine kapalıdır.
  const kalici = $state({ calisiyor: false, ilerleme: { oran: 0, ek: false }, nobetGorunum: "liste" as "takvim" | "liste" });
</script>

<script lang="ts">
  // Günlük Eczane > Nöbet Listesi: çizelgeyi oluşturma, onay, PDF / Excel / paylaşım, özet şerit, takvim ya da liste
  // görünümü, seçili gün, kural denetimi ve onay panelleri, aylık özet.
  import { puantajIzgarasi } from "../../veri/degisim.svelte";
  import { ciktiPaketi } from "../../disa/yukle";
  import { depo, veriAnlik, duzKopya, saatleriGuncelle, ayCizelgesi, cizelgeKaydet, cizelgeSil, onayla, onayiKaldir, eskimeNedenleri, aydaCalisanlar, resmiTatilMi, arifeMi } from "../../veri/depo.svelte";
  import { arkaPlandaOlustur } from "../../motor/istemci";
  import IzinliGorevler from "./IzinliGorevler.svelte";
  import Paylas from "./Paylas.svelte";
  import { acilKadrosunda, canliDenetimHesapla, uyariSiniflandir } from "../../motor";
  import { cizelgeKitabi } from "../../disa/cizelgeXlsx";
  import { dosyaKaydet, hataMetni } from "../../disa/indir";
  import { AYLAR, ayAdi } from "../../veri/tarih";
  import type { Gorevli } from "../../veri/tipler";
  import IslemAlani from "../ortak/IslemAlani.svelte";
  import Ikon from "../ortak/Ikon.svelte";
  import Takvim from "./Takvim.svelte";
  import VurguSecici from "../ortak/VurguSecici.svelte";
  import AylikOzet from "../ortak/AylikOzet.svelte";
  import GunPenceresi from "./GunPenceresi.svelte";
  import OnaySorusu from "../ortak/OnaySorusu.svelte";
  import NobetTablosu, { type Filtre } from "./NobetTablosu.svelte";
  import YanPaneller from "./YanPaneller.svelte";

  let { git }: { git: (ad: "cizelge" | "puantaj" | "izinler" | "kisiler" | "ayarlar") => void } = $props();


  const c = $derived(ayCizelgesi(depo.yil, depo.ay));
  // acilde nöbet tutanlar (acil servis personeli, acilde tutan eczacılar) eczane çizelgesine girmez; nöbetleri Acil Eczane'de
  // kişi başı aylık özet (puantajdaki gibi; günlük eczane kadrosu)
  const ozetSatirlari = $derived(c ? puantajIzgarasi(depo.yil, depo.ay).satirlar.filter(r => !acilKadrosunda(r.s)) : []);
  const kisiler = $derived(aydaCalisanlar(depo.yil, depo.ay).filter(k => !acilKadrosunda(k)));
  const nobetci = $derived(kisiler.filter(k => k.role !== "destek"));
  const eczaci = $derived(kisiler.filter(k => k.role === "eczaci" || k.role === "nobetci"));
  const eskime = $derived(c ? eskimeNedenleri(depo.yil, depo.ay) : []);

  // güncel liste: puantajdaki nöbet değişimleri (yerine tutma, takas) işlenmiş hâli; asıl (onaylanan) çizelge ayrı görünümde.
  // Her gün nöbetçiler ve hazırlamacılar puantajdan okunur; değişmeyen kişi yerinde kalır, değişenin yerine yeni gelen yazılır.
  const guncel = $derived.by(() => {
    if (!c) return null;
    const G = puantajIzgarasi(depo.yil, depo.ay);
    const gorevli = (s: Gorevli): Gorevli => ({ id: s.id, name: s.name, role: s.role });
    const sirala = (eski: Gorevli[], yeni: Gorevli[]) => {
      const idler = new Set(yeni.map(k => k.id)), kalan = yeni.filter(k => !eski.some(p => p.id === k.id));
      const l = eski.map(p => (idler.has(p.id) ? p : kalan.shift())).filter((p): p is Gorevli => !!p);
      return [...l, ...kalan];
    };
    const degisen = new Set<number>();
    const days = c.days.map(g => {
      const N: Gorevli[] = [], H: Gorevli[] = [];
      for (const r of G.satirlar) {
        const h = r.cells[g.day - 1]; if (!h) continue;
        if (h.kod === "N" && !h.acil && !acilKadrosunda(r.s)) N.push(gorevli(r.s)); else if (h.kod === "H") H.push(gorevli(r.s));
      }
      const ayni = (a: Gorevli[], b: Gorevli[]) => a.length === b.length && a.every(p => b.some(q => q.id === p.id));
      if (ayni(g.assigned, N) && ayni(g.prep, H)) return g;
      degisen.add(g.day);
      return { ...g, assigned: sirala(g.assigned, N), prep: sirala(g.prep, H) };
    });
    return { c: { ...c, days }, degisen };
  });
  let cizelgeGorunum = $state<"guncel" | "asil">("guncel");
  const degisimVar = $derived(!!guncel && guncel.degisen.size > 0);
  // ekranda ve çıktıda (PDF / Excel) açık olan görünüm
  const goster = $derived(degisimVar && cizelgeGorunum === "guncel" ? guncel!.c : c);

  let hata = $state("");
  let vurgu = $state<number | null>(null);
  let silOnayi = $state(false);
  let durum = $state("");

  async function olustur(varyasyon = 0) {
    hata = ""; silOnayi = false; kalici.calisiyor = true; kalici.ilerleme = { oran: 0, ek: false };
    const y = depo.yil, m = depo.ay;
    try {
      const r = await arkaPlandaOlustur(veriAnlik(), y, m, varyasyon, i => (kalici.ilerleme = i));
      if (!r.days) { hata = r.warnings[0] ?? "Çizelge oluşturulamadı."; return; }
      if (!cizelgeKaydet(y, m, r.days, r.warnings)) hata = "Bu ay onaylandığı için yeni çizelge kaydedilmedi.";
    } catch (e) {
      hata = "Çizelge oluşturulurken bir sorun çıktı: " + (e as Error).message;
    } finally {
      kalici.calisiyor = false;
    }
  }

  const sayilar = $derived.by(() => {
    if (!c) return null;
    const dolu = c.days.filter(g => g.assigned.length >= (g.nobetSay ?? 2)).length;
    const s = { hata: 0, uyari: 0, bilgi: 0 };
    for (const u of siniflar) s[u.seviye]++;
    const elle = c.days.filter(g => g.locked).length;
    return { dolu, gun: c.days.length, ...s, elle };
  });

  let gunAcik = $state(false);
  let paylasAcik = $state(false);
  let onaySor = $state(false);
  let acikGun = $state(1);
  // takvimde güne dokunmak günü seçer (sağdaki "Seçili gün" paneli); dar ekranda düzenleme penceresi doğrudan açılır
  const bugunTarih = new Date();
  let seciliGun = $state<number>(bugunTarih.getFullYear() === depo.yil && bugunTarih.getMonth() === depo.ay ? bugunTarih.getDate() : 1);
  $effect(() => { if (c && seciliGun > c.days.length) seciliGun = 1; });
  function gunAc(d: number) { seciliGun = d; if (innerWidth <= 1100) { acikGun = d; gunAcik = true; } }
  function gunuDuzenle() { acikGun = seciliGun; gunAcik = true; }
  // liste görünümünün süzgeçleri (takvim / liste arasında geçince korunur)
  let filtre = $state<Filtre>("tumu");
  let kisiF = $state<number | null>(null);
  let ara = $state("");
  const sg = $derived(goster?.days[seciliGun - 1]);
  const eczaciRol = (r: string) => r === "eczaci" || r === "nobetci";
  // özet şerit: nöbet sayısı ve fazla mesai aralığı (eczacı / tekniker; destek hariç)
  const ozet = $derived.by(() => {
    const l = ozetSatirlari;
    const ar = (f: (r: (typeof l)[number]) => boolean, k: "n" | "fm") => { const v = l.filter(f).map(r => r[k]); return v.length ? { mn: Math.min(...v), mx: Math.max(...v) } : null; };
    const e = (r: (typeof l)[number]) => eczaciRol(r.s.role), t = (r: (typeof l)[number]) => r.s.role === "teknisyen";
    return { nE: ar(e, "n"), nT: ar(t, "n"), fE: ar(e, "fm"), fT: ar(t, "fm"), fH: ar(r => e(r) || t(r), "fm") };
  });
  const aralik = (a: { mn: number; mx: number } | null, b = "") => (a ? (a.mn === a.mx ? `${a.mn}` : `${a.mn}–${a.mx}`) + b : "—");
  const fark = (a: { mn: number; mx: number } | null) => (a ? a.mx - a.mn : 0);
  // oluşturma uyarıları + çizelgenin o anki hâlinin denetimi (elle düzenleme, "Otomatiğe bırak" sonrası eczacısız / eksik
  // gün, karşılanmayan nöbet isteği); elle günün eczacısız uyarısı canlı denetimde zaten var
  const canli = $derived(c ? (canliDenetimHesapla(veriAnlik(), duzKopya(c))) : []);
  const siniflar = $derived([...canli, ...(c?.uyarilar ?? []).filter(t => !/elle atadığınız nöbette eczacı yok/.test(t))]
    .map(t => ({ t, ...(uyariSiniflandir(t) as { seviye: "hata" | "uyari" | "bilgi"; baslik: string }) })));

  const ekAd = () => (goster !== c ? "-guncel" : "");
  async function excel() {
    if (!c) return;
    const y = c.year, m = c.month;
    try {
      const blob = cizelgeKitabi(saatleriGuncelle(duzKopya(goster)!), duzKopya(depo.veri.staff), depo.veri.kurum.ad, d => resmiTatilMi(y, m, d), depo.veri.settings.hazSaat);
      const ok = await dosyaKaydet(`nobet-cizelgesi-${y}-${String(m + 1).padStart(2, "0")}${ekAd()}.xlsx`, blob, blob.type);
      durum = ok ? "Excel dosyası kaydedildi." : "";
    } catch (e) { durum = hataMetni(e, "Dosya kaydedilemedi."); }
  }
  let pdfHazirlaniyor = $state(false);
  async function pdf() {
    if (!c) return;
    const y = c.year, m = c.month;
    pdfHazirlaniyor = true; durum = "";
    try {
      const { cizelgePdf } = await ciktiPaketi();
      const blob = cizelgePdf(saatleriGuncelle(duzKopya(goster)!), duzKopya(depo.veri.staff), { kurum: depo.veri.kurum.ad, resmiTatil: d => resmiTatilMi(y, m, d), arife: d => arifeMi(y, m, d), nobetSuresi: depo.veri.settings.nobetSuresi, hazSaat: depo.veri.settings.hazSaat });
      const ok = await dosyaKaydet(`nobet-cizelgesi-${y}-${String(m + 1).padStart(2, "0")}${ekAd()}.pdf`, blob, "application/pdf");
      durum = ok ? "PDF kaydedildi." : "";
    } catch (e) { durum = hataMetni(e, "PDF oluşturulamadı."); }
    finally { pdfHazirlaniyor = false; }
  }
  function sil() {
    if (!silOnayi) { silOnayi = true; return; }
    cizelgeSil(depo.yil, depo.ay); silOnayi = false;
  }
</script>

<IslemAlani>
  {#if degisimVar}<div class="secim" role="group" aria-label="Çizelge"><button aria-pressed={cizelgeGorunum === "guncel"} onclick={() => (cizelgeGorunum = "guncel")} title="Nöbet değişimleri işlenmiş liste">Güncel</button><button aria-pressed={cizelgeGorunum === "asil"} onclick={() => (cizelgeGorunum = "asil")} title="Değişimlerden önceki asıl çizelge">{c?.onay ? "Onaylanan" : "Asıl çizelge"}</button></div>{/if}
  {#if c}<div class="secim" role="group" aria-label="Görünüm"><button aria-pressed={kalici.nobetGorunum === "takvim"} onclick={() => (kalici.nobetGorunum = "takvim")}>Takvim</button><button aria-pressed={kalici.nobetGorunum === "liste"} onclick={() => (kalici.nobetGorunum = "liste")}>Liste</button></div>{/if}
  {#if !c}
    <button class="dugme ana" onclick={() => olustur()} disabled={kalici.calisiyor || nobetci.length < 2}><Ikon ad="takvim" />Çizelgeyi oluştur</button>
  {:else if !c.onay}
    <button class="dugme" onclick={() => olustur()} disabled={kalici.calisiyor} title="Elle düzenlenen günler korunur"><Ikon ad="yenile" />Yeniden oluştur</button>
    <button class="dugme" onclick={() => olustur(1 + Math.floor(Math.random() * 9999))} disabled={kalici.calisiyor} title="Aynı kurallarla farklı bir dağılım"><Ikon ad="karisik" />Farklı dağılım</button>
    <button class="dugme ana" onclick={() => (onaySor = true)} disabled={kalici.calisiyor}><Ikon ad="tamam" />Onayla</button>
  {:else}
    <button class="dugme" onclick={() => onayiKaldir(depo.yil, depo.ay)}>Onayı kaldır</button>
  {/if}
  {#if c}
    <button class="dugme" onclick={pdf} disabled={kalici.calisiyor || pdfHazirlaniyor}><Ikon ad="indir" />{pdfHazirlaniyor ? "Hazırlanıyor…" : "PDF"}</button>
    <button class="dugme" onclick={excel} disabled={kalici.calisiyor}><Ikon ad="indir" />Excel</button>
    <button class="dugme" onclick={() => (paylasAcik = true)} disabled={kalici.calisiyor} title="Tüm listeyi ya da bir kişinin nöbetlerini mesaj olarak gönderin">Paylaş</button>
  {/if}
  {#if c && !c.onay}<button class="dugme sade tehlike" onclick={sil} disabled={kalici.calisiyor}><Ikon ad="sil" />{silOnayi ? "Evet, sil" : "Sil"}</button>{/if}
</IslemAlani>
{#if c && sayilar}
<div class="ozet-serit">
  <div><small>Doluluk</small><b>{sayilar.dolu}/{sayilar.gun} gün</b><span>{sayilar.elle ? sayilar.elle + " gün elle düzenlendi" : "Elle düzenlenen gün yok"}</span></div>
  <div><small>Nöbet sayısı farkı</small><b>{Math.max(fark(ozet.nE), fark(ozet.nT))}</b><span>Eczacı {aralik(ozet.nE)} · Tekniker {aralik(ozet.nT)}</span></div>
  <div><small>Fazla mesai farkı</small><b>{fark(ozet.fH)} sa</b><span>Eczacı {aralik(ozet.fE, " sa")} · Tekniker {aralik(ozet.fT, " sa")}</span></div>
  <div><small>Onay durumu</small><b>{#if c.onay}<span class="rozet tamam"><Ikon ad="tamam" boyut={14} />Onaylı</span>{:else}<span class="rozet notr">Taslak</span>{/if}</b>
    <span>{sayilar.hata ? sayilar.hata + " kural sağlanamadı" : "Kurallar sağlandı"}{sayilar.uyari ? " · " + sayilar.uyari + " dikkat" : ""}</span></div>
</div>
{/if}
{#if degisimVar}<p class="bant bilgi"><Ikon ad="bilgi" boyut={16} />{cizelgeGorunum === "guncel" ? `Güncel liste gösteriliyor: nöbet değişimleri ve puantajdaki değişiklikler işlendi; değişen ${guncel!.degisen.size} gün işaretli. Değişimlerden önceki çizelge "${c?.onay ? "Onaylanan" : "Asıl çizelge"}" görünümünde.` : `${c?.onay ? "Onaylanan" : "Asıl"} çizelge gösteriliyor (değişimlerden önceki hâli). Değişimler "Güncel" görünümünde.`}</p>{/if}
{#if eskime.length}<p class="bant dikkat"><Ikon ad="uyari" boyut={16} />{eskime.join(" ")} Çizelgeyi yeniden oluşturmanız önerilir.</p>{/if}
{#if c && !kalici.calisiyor}<IzinliGorevler />{/if}
{#if nobetci.length < 2}<p class="bant dikkat">Çizelge için {AYLAR[depo.ay]} ayında en az 2 nöbetçi (eczacı ya da tekniker) gerekir. <button class="baglanti" onclick={() => git("kisiler")}>Personel ekleyin</button>.</p>
{:else if !eczaci.length}<p class="bant dikkat">Her gün en az bir eczacı nöbetçi olmalı; personel listesinde eczacı yok.</p>{/if}
{#if hata}<p class="bant hata" role="alert">{hata}</p>{/if}
{#if durum}<p class="bant tamam" role="status">{durum}</p>{/if}

{#if kalici.calisiyor}
<div class="kart calisiyor" role="status" aria-live="polite">
  <span class="donen" aria-hidden="true"></span>
  <div class="ilerleme-kutu"><b>Çizelge hazırlanıyor{kalici.ilerleme.ek ? " · farklı başlangıçlarla yeniden aranıyor" : ""}</b><p>Kurallar ve eşitlik hedefleri için binlerce olasılık deneniyor. Uyarısız bir çizelge bulunamazsa farklı başlangıçlarla yeniden aranır ve en az uyarılı olan seçilir. Aynı bilgilerle her bilgisayarda aynı çizelge çıkar; yavaş bilgisayarda yalnız biraz daha uzun sürer.</p>
    <div class="ilerleme" role="progressbar" aria-label="Arama ilerlemesi" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(kalici.ilerleme.oran * 100)}><span style="width: {Math.round(kalici.ilerleme.oran * 100)}%"></span></div></div>
</div>
{/if}

{#if c}
<div class="nobet-duzen">
  <div class="ana-sutun">
    {#if kalici.nobetGorunum === "takvim"}
      <section class="panel" aria-label="Takvim">
        <div class="panel-bas"><h2>{ayAdi(depo.yil, depo.ay)} nöbet takvimi{goster !== c ? " · güncel" : ""}</h2>
          <VurguSecici kisiler={nobetci} bind:vurgu />
          <p class="lejant"><span class="lj-ecz">Eczacı</span><span class="lj-tek">Tekniker</span><span class="lj-haz">Haz. Hazırlama</span><span class="kirmizi"><Ikon ad="uyari" boyut={14} />Kural esnetildi</span><span><Ikon ad="kilit" boyut={13} />Elle</span></p></div>
        <Takvim c={goster!} {vurgu} secili={seciliGun} {gunAc} degisen={goster !== c ? guncel?.degisen : undefined} />
      </section>
    {:else}
      <NobetTablosu gunler={goster!} degisen={goster !== c ? guncel?.degisen : undefined} baslikEk={goster !== c ? " · güncel" : ""} {nobetci} {seciliGun} {gunAc} bind:vurgu bind:filtre bind:kisiF bind:ara />
    {/if}
  </div>
  <YanPaneller {c} {sg} {siniflar} {gunuDuzenle} />
</div>
<div class="ozet-kap"><AylikOzet satirlar={ozetSatirlari} bind:vurgu /></div>
<GunPenceresi bind:acik={gunAcik} {c} gun={acikGun} />
{#if goster}<Paylas bind:acik={paylasAcik} c={goster} />{/if}
<OnaySorusu bind:acik={onaySor} ne="Nöbet çizelgesi" sorunlar={siniflar.filter(u => u.seviye === "hata").map(u => u.t)} onaylayan={depo.veri.kurum.onaylayan} onayla={() => onayla(depo.yil, depo.ay)} />
{:else if !kalici.calisiyor}
<section class="kart bos-ay">
  <h2>{ayAdi(depo.yil, depo.ay)} çizelgesi henüz yok</h2>
  <p>Oluşturmadan önce bu ayın izinlerini ve resmi tatillerini işaretleyin. Önceki ayların çizelgeleri varsa yıllık eşitlik (hafta sonu, Cuma, Perşembe, resmi tatil) onlara göre sağlanır.</p>
  <div class="dugmeler">
    <button class="dugme" onclick={() => git("izinler")}><Ikon ad="izin" />İzin ve tatilleri işaretle</button>
  </div>
</section>
{/if}

<style>
  .dugmeler { display: flex; flex-wrap: wrap; gap: var(--b2); align-items: center; }
  .bant { display: flex; align-items: center; gap: var(--b2); flex-wrap: wrap; padding: var(--b2) var(--b4); border: 1px solid var(--cizgi); border-radius: var(--r); margin-bottom: var(--b3); font-size: var(--f-sm); font-weight: 600; }
  .bant.dikkat { background: var(--dikkat-zemin); color: var(--dikkat); }
  .bant.hata { background: var(--hata-zemin); color: var(--hata); }
  .bant.tamam { background: var(--vurgu-zemin); color: var(--vurgu); }
  .bant.bilgi { background: var(--bilgi-zemin, #EEF5FC); color: var(--lacivert); font-weight: 500; }
  .baglanti { border: 0; background: none; padding: 0; color: inherit; text-decoration: underline; cursor: pointer; font-weight: 600; }
  .calisiyor { display: flex; gap: var(--b4); align-items: center; padding: var(--b4) var(--b5); margin-bottom: var(--b3); }
  .calisiyor p { color: var(--soluk); font-size: var(--f-sm); }
  .donen { width: 28px; height: 28px; border-radius: 50%; border: 3px solid var(--cizgi); border-top-color: var(--vurgu); animation: don 0.9s linear infinite; flex: none; }
  @keyframes don { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) {
    .donen { animation: none; border-top-color: var(--vurgu);}
  }
  .nobet-duzen { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: var(--b4); align-items: start; margin-top: var(--b4); }
  .ozet-kap { margin-top: var(--b5); }
  .ana-sutun { display: grid; gap: var(--b4); min-width: 0; }
  .lejant { display: flex; flex-wrap: wrap; gap: var(--b1) var(--b3); font-size: var(--f-xs); color: var(--yazi-2); }
  .lejant > span { display: inline-flex; align-items: center; gap: 5px; }
  .kirmizi { color: var(--hata); }
  .lj-ecz { font-weight: 700; color: var(--lacivert); }
  .lj-tek { font-weight: 600; color: var(--tek); }
  .lj-haz { color: var(--haz); }
  .bos-ay { padding: var(--b5); display: grid; gap: var(--b3); max-width: 760px; }
  .bos-ay p { color: var(--yazi-2); }
  @media (max-width: 1100px) {
    .nobet-duzen { grid-template-columns: 1fr;}
  }
  .ilerleme-kutu { flex: 1; min-width: 0; }
  .ilerleme { height: 6px; border-radius: 3px; background: var(--yuzey-2); overflow: hidden; margin-top: var(--b2); }
  .ilerleme span { display: block; height: 100%; background: var(--vurgu); transition: width .3s; }
</style>
