<script lang="ts">
  import { puantajIzgarasi } from "../../veri/degisim.svelte";
  import { ciktiPaketi } from "../../disa/yukle";
  import { depo, veriAnlik, duzKopya, ayCizelgesi, cizelgeKaydet, cizelgeSil, onayla, onayiKaldir, eskimeNedenleri, aydaCalisanlar, resmiTatilMi, arifeMi } from "../../veri/depo.svelte";
  import { arkaPlandaOlustur } from "../../motor/istemci";
  import { acilKadrosunda, uyariSiniflandir } from "../../motor";
  import { cizelgeKitabi } from "../../disa/cizelgeXlsx";
  import { dosyaKaydet, hataMetni } from "../../disa/indir";
  import { AYLAR, GUN_UZUN, ayAdi, gunMetni, haftaGunu } from "../../veri/tarih";
  import type { Gorevli } from "../../veri/tipler";
  import SayfaBasligi from "../ortak/SayfaBasligi.svelte";
  import IslemAlani from "../ortak/IslemAlani.svelte";
  import Ikon from "../ortak/Ikon.svelte";
  import Takvim from "../cizelge/Takvim.svelte";
  import VurguSecici from "../ortak/VurguSecici.svelte";
  import AylikOzet from "../ortak/AylikOzet.svelte";
  import GunPenceresi from "../cizelge/GunPenceresi.svelte";
  import Hazirlama from "./Hazirlama.svelte";
  import Puantaj from "./Puantaj.svelte";
  import Izinler from "./Izinler.svelte";
  import Raporlar from "./Raporlar.svelte";
  import type { GunlukGorunum } from "./sayfaTipleri";
  import OglenNobeti from "../cizelge/OglenNobeti.svelte";
  import OnayListesi from "../cizelge/OnayListesi.svelte";
  import CalismaListesi from "../cizelge/CalismaListesi.svelte";
  import Sekmeler from "../ortak/Sekmeler.svelte";
  import KarsilamaResmi from "../ortak/KarsilamaResmi.svelte";

  // Günlük Eczane: nöbet listesi, çalışma listesi, öğlen nöbeti, hazırlama listesi, puantaj ve izinler alt sekmeleri
  // (acil eczane ayrı sayfada). gorunum dışarıdan da seçilebilir (başka sayfadan gelen bağlantı).
  let { git, gorunum = $bindable("nobet") }: { git: (ad: "cizelge" | "puantaj" | "izinler" | "kisiler" | "ayarlar") => void; gorunum?: GunlukGorunum } = $props();

  const c = $derived(ayCizelgesi(depo.yil, depo.ay));
  // acilde nöbet tutanlar (acil servis personeli, acilde tutan eczacılar) eczane çizelgesine girmez; nöbetleri Acil Eczane'de
  // kişi başı aylık özet (puantajdaki gibi; günlük eczane kadrosu)
  const ozetSatirlari = $derived(c ? (puantajIzgarasi(depo.yil, depo.ay) as { satirlar: { s: { id: number; role: string; acilTutar?: true } }[] }).satirlar.filter(r => !acilKadrosunda(r.s)) as never : []);
  const kisiler = $derived(aydaCalisanlar(depo.yil, depo.ay).filter(k => !acilKadrosunda(k)));
  const nobetci = $derived(kisiler.filter(k => k.role !== "destek"));
  const eczaci = $derived(kisiler.filter(k => k.role === "eczaci" || k.role === "nobetci"));
  const eskime = $derived(c ? eskimeNedenleri(depo.yil, depo.ay) : []);

  // güncel liste: puantajdaki nöbet değişimleri (yerine tutma, takas) işlenmiş hâli; asıl (onaylanan) çizelge ayrı görünümde.
  // Her gün nöbetçiler ve hazırlamacılar puantajdan okunur; değişmeyen kişi yerinde kalır, değişenin yerine yeni gelen yazılır.
  const guncel = $derived.by(() => {
    if (!c) return null;
    const G = puantajIzgarasi(depo.yil, depo.ay) as { satirlar: { s: Gorevli & { acilTutar?: true }; cells: { kod: string; acil?: boolean }[] }[] };
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

  // görünüm: eczane nöbet çizelgesi, günlük çalışma listesi ya da acil servis nöbetleri
  const GORUNUMLER = [
    { ad: "nobet", baslik: "Nöbet Listesi", uzun: "Günlük Eczane Nöbet Listesi", aciklama: "Ayın nöbet ve hafta sonu hazırlama görevleri; nöbet kuralları ve eşitlik kendiliğinden uygulanır." },
    { ad: "liste", baslik: "Aylık Çalışma Listesi", uzun: "Aylık Çalışma Listesi", aciklama: "Puantaja göre her gün onayda, hazırlamada ve izinde olan personel." },
    { ad: "oglen", baslik: "Öğlen Nöbet Listesi", uzun: "Öğlen Nöbet Listesi", aciklama: "Hafta içi öğle arası nöbetçi eczacı ve teknikerler; yıl boyunca eşit dağıtılır." },
    { ad: "onay", baslik: "Onay Listesi", uzun: "Onay Listesi", aciklama: "Haftalık onay masaları ve jokerler: her eczacı hafta boyunca aynı masada, her hafta sıradaki yerde." },
    { ad: "hazirlama", baslik: "Hazırlama Listesi", uzun: "Hazırlama Listesi", aciklama: "O gün çalışan teknikerlere servisler zorluk ve hasta sayısına göre dengeli dağıtılır." },
    { ad: "puantaj", baslik: "Puantaj", uzun: "Puantaj Cetveli", aciklama: "Gerçekleşen çalışma: nöbet, hazırlama, nöbet ertesi izin, yıllık izin ve rapor; fazla mesai hesabı." },
    { ad: "izinler", baslik: "İzinler", uzun: "İzinler ve Tercihler", aciklama: "İzinli günler, nöbet istekleri, eş durumu, resmi tatil ve arife işaretleri." },
    { ad: "raporlar", baslik: "Raporlar", uzun: "Günlük Eczane Raporları", aciklama: "Yıllık fazla mesai, görev dağılımı, denge, öğlen nöbeti ve servis hazırlama (günlük eczane kadrosu)." },
  ] as const;
  const aktif = $derived(GORUNUMLER.find(g => g.ad === gorunum) ?? GORUNUMLER[0]);

  let calisiyor = $state(false);
  let hata = $state("");
  let vurgu = $state<number | null>(null);
  let silOnayi = $state(false);
  let durum = $state("");

  async function olustur(varyasyon = 0) {
    hata = ""; silOnayi = false; calisiyor = true;
    const y = depo.yil, m = depo.ay;
    try {
      const r = await arkaPlandaOlustur(veriAnlik() as any, y, m, varyasyon);
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
  // takvimde güne dokunmak günü seçer (sağdaki "Seçili gün" paneli); dar ekranda düzenleme penceresi doğrudan açılır
  const bugunTarih = new Date();
  let seciliGun = $state<number>(bugunTarih.getFullYear() === depo.yil && bugunTarih.getMonth() === depo.ay ? bugunTarih.getDate() : 1);
  $effect(() => { if (c && seciliGun > c.days.length) seciliGun = 1; });
  function gunAc(d: number) { seciliGun = d; if (innerWidth <= 1100) { acikGun = d; gunAcik = true; } }
  function gunuDuzenle() { acikGun = seciliGun; gunAcik = true; }
  let nobetGorunum = $state<"takvim" | "liste">("liste");
  // liste görünümü: filtre düğmeleri (hafta içi / hafta sonu / değişen / kural esnetilen / elle), kişi seçimi ve ad arama;
  // günler haftalara göre gruplanır
  type Filtre = "tumu" | "hi" | "hs" | "degisen" | "esnek" | "elle";
  let filtre = $state<Filtre>("tumu");
  let kisiF = $state<number | null>(null);
  let ara = $state("");
  type Gun = NonNullable<typeof c>["days"][number];
  const degistiMi = (g: Gun) => goster !== c && !!guncel?.degisen.has(g.day);
  const filtreUy: Record<Filtre, (g: Gun) => boolean> = {
    tumu: () => true, hi: g => !g.tatil, hs: g => g.tatil, degisen: degistiMi, esnek: g => !!g.conflict || g.assigned.length < 2, elle: g => !!g.locked,
  };
  const FILTRELER: [Filtre, string][] = [["tumu", "Tümü"], ["hi", "Hafta içi"], ["hs", "Hafta sonu"], ["degisen", "Değişen"], ["esnek", "Kural esnetilen"], ["elle", "Elle"]];
  const kucuk = (t: string) => t.toLocaleLowerCase("tr-TR");
  const kisiUyar = (g: Gun) => {
    const l = [...g.assigned, ...(g.tatil ? g.prep : [])];
    if (kisiF !== null && !l.some(p => p.id === kisiF)) return false;
    const a = kucuk(ara.trim());
    return !a || l.some(p => kucuk(p.name).includes(a));
  };
  const filtreSayisi = $derived(Object.fromEntries(FILTRELER.map(([f]) => [f, (goster?.days ?? []).filter(g => filtreUy[f](g) && kisiUyar(g)).length])) as Record<Filtre, number>);
  // haftalar (Pazartesi başlar): [hafta no, yarım mı, günler]
  const haftalar = $derived.by(() => {
    if (!goster) return [];
    const ilk = haftaGunu(depo.yil, depo.ay, 1), n = goster.days.length;
    const h: { no: number; yarim: boolean; gunler: Gun[] }[] = [];
    for (const g of goster.days) {
      const w = Math.floor((g.day - 1 + ilk) / 7);
      if (!h[w]) { const bas = w * 7 - ilk + 1; h[w] = { no: w + 1, yarim: bas < 1 || bas + 6 > n, gunler: [] }; }
      if (filtreUy[filtre](g) && kisiUyar(g)) h[w].gunler.push(g);
    }
    return h.filter(x => x.gunler.length);
  });
  const sg = $derived(goster?.days[seciliGun - 1]);
  const eczaciRol = (r: string) => r === "eczaci" || r === "nobetci";
  // özet şerit: nöbet sayısı ve fazla mesai aralığı (eczacı / tekniker; destek hariç)
  const ozet = $derived.by(() => {
    const l = ozetSatirlari as unknown as { s: { role: string }; n: number; fm: number }[];
    const ar = (f: (r: (typeof l)[number]) => boolean, k: "n" | "fm") => { const v = l.filter(f).map(r => r[k]); return v.length ? { mn: Math.min(...v), mx: Math.max(...v) } : null; };
    const e = (r: (typeof l)[number]) => eczaciRol(r.s.role), t = (r: (typeof l)[number]) => r.s.role === "teknisyen";
    return { nE: ar(e, "n"), nT: ar(t, "n"), fE: ar(e, "fm"), fT: ar(t, "fm"), fH: ar(r => e(r) || t(r), "fm") };
  });
  const aralik = (a: { mn: number; mx: number } | null, b = "") => (a ? (a.mn === a.mx ? `${a.mn}` : `${a.mn}–${a.mx}`) + b : "—");
  const fark = (a: { mn: number; mx: number } | null) => (a ? a.mx - a.mn : 0);
  const siniflar = $derived((c?.uyarilar ?? []).map(t => ({ t, ...(uyariSiniflandir(t) as { seviye: "hata" | "uyari" | "bilgi"; baslik: string }) })));

  const ekAd = () => (goster !== c ? "-guncel" : "");
  async function excel() {
    if (!c) return;
    const y = c.year, m = c.month;
    try {
      const blob = cizelgeKitabi(duzKopya(goster) as any, duzKopya(depo.veri.staff) as any, depo.veri.kurum.ad, d => resmiTatilMi(y, m, d));
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
      const blob = cizelgePdf(duzKopya(goster) as any, duzKopya(depo.veri.staff) as any, { kurum: depo.veri.kurum.ad, resmiTatil: d => resmiTatilMi(y, m, d), arife: d => arifeMi(y, m, d) });
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

<SayfaBasligi konum={["Günlük Eczane", aktif.baslik]} baslik={aktif.uzun} aciklama={aktif.aciklama} />

{#if !depo.veri.staff.length}
  <section class="kart karsilama">
    <div class="metin">
      <h2>Nöbet çizelgesine hoş geldiniz</h2>
      <p>Çizelge üç adımda hazırlanır: personeli girin, izinleri ve tatil günlerini işaretleyin, sonra "Çizelgeyi oluştur"a basın. Kurallar (nöbet ertesi izin, hafta sonu sınırları, fazla mesai eşitliği) kendiliğinden uygulanır.</p>
      <ol class="adimlar">
        <li><b>Personel</b><span>Eczacı, tekniker ve destek personeli</span></li>
        <li><b>İzin ve tercihler</b><span>İzinli günler, resmi tatiller, istekler</span></li>
        <li><b>Çizelge</b><span>Oluştur, gözden geçir, onayla</span></li>
      </ol>
      <div class="dugmeler">
        <button class="dugme ana" onclick={() => git("kisiler")}><Ikon ad="kisiler" />Personel ekle</button>
      </div>
    </div>
    <div class="resim"><KarsilamaResmi /></div>
  </section>
{:else}
  <Sekmeler secenekler={GORUNUMLER} bind:secili={gorunum} etiket="Görünüm" telefonSutun={2} />

  {#if gorunum === "raporlar"}
    <Raporlar bolum="gunluk" />
  {:else if gorunum === "hazirlama"}
    <Hazirlama {git} />
  {:else if gorunum === "puantaj"}
    <Puantaj {git} kimler={k => !acilKadrosunda(k)} />
  {:else if gorunum === "izinler"}
    <Izinler {git} kimler={k => !acilKadrosunda(k)} />
  {:else if gorunum === "onay"}
    <OnayListesi />
  {:else if gorunum === "oglen"}
    <OglenNobeti git={ad => (ad === "nobet" ? (gorunum = "nobet") : git(ad))} />
  {:else if gorunum === "liste"}
    {#if c}<CalismaListesi />
    {:else}
      <section class="kart bos-ay">
        <h2>{ayAdi(depo.yil, depo.ay)} çizelgesi henüz yok</h2>
        <p>Çalışma listesi bu ayın nöbet çizelgesi ve puantajından hazırlanır. Önce çizelgeyi oluşturun.</p>
        <div class="dugmeler"><button class="dugme ana" onclick={() => (gorunum = "nobet")}><Ikon ad="takvim" />Günlük Eczane Nöbet Listesi</button></div>
      </section>
    {/if}
  {:else}
    <IslemAlani>
      {#if degisimVar}<div class="secim" role="group" aria-label="Çizelge"><button aria-pressed={cizelgeGorunum === "guncel"} onclick={() => (cizelgeGorunum = "guncel")} title="Nöbet değişimleri işlenmiş liste">Güncel</button><button aria-pressed={cizelgeGorunum === "asil"} onclick={() => (cizelgeGorunum = "asil")} title="Değişimlerden önceki asıl çizelge">{c?.onay ? "Onaylanan" : "Asıl çizelge"}</button></div>{/if}
      {#if c}<div class="secim" role="group" aria-label="Görünüm"><button aria-pressed={nobetGorunum === "takvim"} onclick={() => (nobetGorunum = "takvim")}>Takvim</button><button aria-pressed={nobetGorunum === "liste"} onclick={() => (nobetGorunum = "liste")}>Liste</button></div>{/if}
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
  {#if nobetci.length < 2}<p class="bant dikkat">Çizelge için {AYLAR[depo.ay]} ayında en az 2 nöbetçi (eczacı ya da tekniker) gerekir. <button class="baglanti" onclick={() => git("kisiler")}>Personel ekleyin</button>.</p>
  {:else if !eczaci.length}<p class="bant dikkat">Her gün en az bir eczacı nöbetçi olmalı; personel listesinde eczacı yok.</p>{/if}
  {#if hata}<p class="bant hata" role="alert">{hata}</p>{/if}
  {#if durum}<p class="bant tamam" role="status">{durum}</p>{/if}

  {#if calisiyor}
    <div class="kart calisiyor" role="status" aria-live="polite">
      <span class="donen" aria-hidden="true"></span>
      <div><b>Çizelge hazırlanıyor</b><p>Kurallar ve eşitlik hedefleri için binlerce olasılık deneniyor; birkaç saniye sürer. Uyarısız bir çizelge bulunamazsa farklı başlangıçlarla yeniden aranır ve en az uyarılı olan seçilir; bu durumda yarım dakikaya kadar sürebilir.</p></div>
    </div>
  {/if}

  {#snippet adlar(l: { id: number; name: string }[])}
    {#each l as p, i (p.id)}{i ? ", " : ""}{#if p.id === vurgu}<mark class="vurgu-ad">{p.name}</mark>{:else}{p.name}{/if}{:else}—{/each}
  {/snippet}
  {#if c}
    <div class="nobet-duzen">
      <div class="ana-sutun">
        {#if nobetGorunum === "takvim"}
          <section class="panel" aria-label="Takvim">
            <div class="panel-bas"><h2>{ayAdi(depo.yil, depo.ay)} nöbet takvimi{goster !== c ? " · güncel" : ""}</h2>
              <VurguSecici kisiler={nobetci} bind:vurgu />
              <p class="lejant"><span><span class="gorev ecz">ECZ</span>Eczacı</span><span><span class="gorev tek">TEK</span>Tekniker</span><span><span class="gorev haz">H1</span>Hazırlama</span><span class="kirmizi"><Ikon ad="uyari" boyut={14} />Kural esnetildi</span><span><Ikon ad="kilit" boyut={13} />Elle</span></p></div>
            <Takvim c={goster!} {vurgu} secili={seciliGun} {gunAc} degisen={goster !== c ? guncel?.degisen : undefined} />
          </section>
        {:else}
          <section class="panel" aria-label="Liste">
            <div class="panel-bas"><h2>{ayAdi(depo.yil, depo.ay)} nöbet listesi{goster !== c ? " · güncel" : ""}</h2><VurguSecici kisiler={nobetci} bind:vurgu /></div>
            <div class="filtreler">
              <div class="cipler" role="group" aria-label="Günleri süz">
                {#each FILTRELER as [f, ad]}<button class="cip" aria-pressed={filtre === f} onclick={() => (filtre = f)}>{ad} <span class="rakam">{filtreSayisi[f]}</span></button>{/each}
              </div>
              <div class="ara">
                <select bind:value={kisiF} aria-label="Kişi"><option value={null}>Kişi: Tümü</option>{#each nobetci as k (k.id)}<option value={k.id}>{k.name}</option>{/each}</select>
                <input type="search" bind:value={ara} placeholder="Ad ara" aria-label="Ad ara" />
              </div>
            </div>
            <!-- svelte-ignore a11y_no_noninteractive_tabindex (kaydırılan tablo klavyeyle kaydırılabilsin) -->
            <div class="tablo-kap" tabindex="0" role="region" aria-label="Nöbet listesi tablosu">
              <table class="tablo liste">
                <thead><tr><th>Tarih</th><th>Gün</th><th>Nöbetçi eczacı</th><th>Nöbetçi tekniker</th><th>Hazırlama 1</th><th>Hazırlama 2</th><th>Durum</th></tr></thead>
                <tbody>
                  {#each haftalar as h (h.no)}
                    <tr class="grup"><td colspan="7">{h.no}. hafta{h.yarim ? " (yarım)" : ""}</td></tr>
                    {#each h.gunler as g (g.day)}
                      {@const ec = g.assigned.filter(p => eczaciRol(p.role))}
                      {@const tk = g.assigned.filter(p => !eczaciRol(p.role))}
                      {@const rt = resmiTatilMi(depo.yil, depo.ay, g.day)}
                      <tr class:secili-satir={seciliGun === g.day} class:hs={g.tatil} class:vurgulu={vurgu !== null && (g.assigned.some(p => p.id === vurgu) || (g.tatil && g.prep.some(p => p.id === vurgu)))} onclick={() => gunAc(g.day)}>
                        <td class="rakam"><b>{g.day} {AYLAR[depo.ay]}</b></td>
                        <td>{GUN_UZUN[haftaGunu(depo.yil, depo.ay, g.day)]}</td>
                        <td>{@render adlar(ec)}</td>
                        <td>{@render adlar(tk)}</td>
                        <td>{@render adlar(g.tatil && g.prep[0] ? [g.prep[0]] : [])}</td>
                        <td>{@render adlar(g.tatil && g.prep[1] ? [g.prep[1]] : [])}</td>
                        <td class="durum">
                          {#if degistiMi(g)}<span class="etk degisti">değişti</span>{/if}
                          {#if g.conflict || g.assigned.length < 2}<span class="etk esnek"><Ikon ad="uyari" boyut={12} />kural esnetildi</span>{/if}
                          {#if g.locked}<span class="etk elle"><Ikon ad="kilit" boyut={12} />elle</span>{/if}
                          {#if rt}<span class="etk hsr">resmi tatil</span>{:else if g.tatil}<span class="etk hsr">hafta sonu</span>{/if}
                        </td>
                      </tr>
                    {/each}
                  {:else}
                    <tr><td colspan="7" class="bos-sonuc">Bu süzgece uyan gün yok.</td></tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </section>
        {/if}
      </div>
      <aside class="yan-sutun">
        <section class="panel">
          <div class="panel-bas"><h2>Seçili gün</h2></div>
          {#if sg}
            <div class="panel-ic secili-gun">
              <p class="tarih">{gunMetni(depo.yil, depo.ay, sg.day)}{#if sg.tatil}<span class="rozet bilgi">Tatil</span>{/if}</p>
              <dl>
                <dt>Nöbetçiler</dt>
                <dd>{#each [...sg.assigned].sort((x, y) => Number(eczaciRol(y.role)) - Number(eczaciRol(x.role))) as p}<span class="kisi"><span class="gorev {eczaciRol(p.role) ? 'ecz' : 'tek'}">{eczaciRol(p.role) ? "ECZ" : "TEK"}</span>{p.name}</span>{:else}<span class="yok">Nöbetçi yok</span>{/each}</dd>
                <dt>Hazırlama</dt>
                <dd>{#if sg.tatil}{#each sg.prep as p, i}<span class="kisi"><span class="gorev haz">H{i + 1}</span>{p.name}</span>{:else}<span class="yok">Hazırlamacı yok</span>{/each}{:else}<span class="yok">Hafta içi: hazırlama yok</span>{/if}</dd>
              </dl>
              {#if sg.locked}<p class="not"><Ikon ad="kilit" boyut={13} /> Elle düzenlendi; yeniden oluşturmada korunur.</p>{/if}
              {#if sg.conflict}<p class="not kirmizi"><Ikon ad="uyari" boyut={13} /> Bu günde kural esnetildi.</p>{/if}
              <button class="dugme" onclick={gunuDuzenle}><Ikon ad="karisik" />{c.onay ? "Günü görüntüle" : "Nöbet değişikliği yap"}</button>
            </div>
          {/if}
        </section>
        <section class="panel">
          <div class="panel-bas"><h2>Kural denetimi</h2></div>
          <div class="panel-ic denetim">
            {#each siniflar.filter(u => u.seviye === "hata") as u}<div class="kutu hata"><b>{u.baslik}</b><p>{u.t}</p></div>{/each}
            {#each siniflar.filter(u => u.seviye === "uyari") as u}<div class="kutu dikkat"><b>{u.baslik}</b><p>{u.t}</p></div>{/each}
            {#each siniflar.filter(u => u.seviye === "bilgi") as u}<div class="kutu bilgi"><b>{u.baslik}</b><p>{u.t}</p></div>{/each}
            {#if !siniflar.length}<p class="tamam"><Ikon ad="tamam" boyut={15} /> Tüm kurallar sağlandı.</p>{/if}
          </div>
        </section>
        <section class="panel">
          <div class="panel-bas"><h2>Onay</h2></div>
          <div class="panel-ic">
            <dl class="onay">
              <dt>Durum</dt><dd>{#if c.onay}<span class="rozet tamam">Onaylı</span>{:else}<span class="rozet notr">Taslak</span>{/if}</dd>
              <dt>Onaylayan</dt><dd>{c.onay?.kim || depo.veri.kurum.onaylayan || "—"}</dd>
              <dt>Onay tarihi</dt><dd>{c.onay ? new Date(c.onay.zaman).toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" }) : "—"}</dd>
            </dl>
            <p class="not">{c.onay ? "Onaylı çizelgenin günleri ve o ayın izin işaretleri kilitlidir; ay içinde gelişen izin, rapor ve nöbet değişimleri Puantaj bölümünden girilir." : "Onaylandığında çizelgenin günleri ve o ayın izin işaretleri kilitlenir; değişiklikler Puantaj bölümünden girilir."}</p>
          </div>
        </section>
      </aside>
    </div>
    <div class="ozet-kap"><AylikOzet satirlar={ozetSatirlari} bind:vurgu /></div>
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
  .karsilama { padding: var(--b6); display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: var(--b6); align-items: center; max-width: 1040px; border-top: 3px solid var(--vurgu); }
  .karsilama .metin { display: grid; gap: var(--b4); }
  .karsilama .resim { padding: var(--b3); }
  .karsilama p { color: var(--yazi-2); max-width: 64ch; }
  .adimlar { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--b3); counter-reset: adim; }
  .adimlar li { counter-increment: adim; display: grid; align-content: start; gap: 2px; padding: var(--b3) var(--b4); border: 1px solid var(--cizgi); border-radius: var(--r); background: var(--yuzey-2); }
  .adimlar li::before { content: counter(adim); font-family: var(--yazi-rakam); font-size: var(--f-xs); color: var(--vurgu); font-weight: 600; }
  .adimlar span { font-size: var(--f-sm); color: var(--soluk); }
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
  @media (prefers-reduced-motion: reduce) { .donen { animation: none; border-top-color: var(--vurgu); } }
  .nobet-duzen { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: var(--b4); align-items: start; margin-top: var(--b4); }
  .ozet-kap { margin-top: var(--b5); }
  .ana-sutun { display: grid; gap: var(--b4); min-width: 0; }
  .yan-sutun { display: grid; gap: var(--b3); min-width: 0; }
  .lejant { display: flex; flex-wrap: wrap; gap: var(--b1) var(--b3); font-size: var(--f-xs); color: var(--yazi-2); }
  .lejant > span { display: inline-flex; align-items: center; gap: 5px; }
  .kirmizi { color: var(--hata); }
  .liste tbody tr { cursor: pointer; }
  .liste tbody tr:hover > * { background: var(--vurgu-zemin); }
  .liste tbody tr.vurgulu > * { background: color-mix(in srgb, var(--altin) 16%, var(--yuzey)); }
  .liste tbody tr.vurgulu > :first-child { box-shadow: inset 3px 0 0 var(--altin); }
  .vurgu-ad { background: color-mix(in srgb, var(--altin) 35%, transparent); color: inherit; font-weight: 700; padding: 0 3px; border-radius: 3px; }
  .liste tr.secili-satir > * { box-shadow: inset 0 2px 0 var(--altin), inset 0 -2px 0 var(--altin); }
  .liste td:nth-child(n+3):not(.durum) { min-width: 150px; }
  .liste tr.hs > * { background: color-mix(in srgb, var(--acik-mavi) 14%, var(--yuzey)); }
  .liste tr.grup > td { background: var(--panel-bas); font-weight: 700; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--lacivert); padding-top: 5px; padding-bottom: 5px; cursor: default; }
  .liste tbody tr.grup:hover > * { background: var(--panel-bas); }
  .liste tr.secili-satir > * { background: color-mix(in srgb, var(--altin) 16%, var(--yuzey)); }
  .durum, .liste td:first-child { white-space: nowrap; }
  .etk { display: inline-flex; align-items: center; gap: 3px; font-size: var(--f-xs); font-weight: 600; padding: 1px 6px; border-radius: 2px; margin-right: 4px; }
  .etk.degisti { background: color-mix(in srgb, var(--izin) 14%, var(--yuzey)); color: var(--izin); }
  .etk.esnek { background: var(--hata-zemin); color: var(--hata); }
  .etk.elle { background: var(--yuzey-2); color: var(--yazi-2); }
  .etk.hsr { background: color-mix(in srgb, var(--acik-mavi) 30%, var(--yuzey)); color: var(--lacivert); }
  .bos-sonuc { color: var(--soluk); text-align: center; padding: var(--b4); cursor: default; }
  .filtreler { display: flex; flex-wrap: wrap; gap: var(--b2); align-items: center; justify-content: space-between; padding: var(--b3) var(--b4); border-bottom: 1px solid var(--cizgi); }
  .cipler { display: flex; flex-wrap: wrap; gap: 6px; }
  .cip { border: 1px solid var(--cizgi); background: var(--yuzey); color: var(--yazi); padding: 5px 12px; border-radius: 999px; font-weight: 600; font-size: var(--f-sm); cursor: pointer; min-height: 32px; }
  .cip span { color: var(--yazi-2); font-weight: 500; }
  .cip[aria-pressed="true"] { background: var(--vurgu); border-color: var(--vurgu); color: var(--vurgu-yazi); }
  .cip[aria-pressed="true"] span { color: var(--vurgu-yazi); opacity: .85; }
  .ara { display: flex; gap: 6px; }
  .ara select, .ara input { min-height: 34px; padding: 0 var(--b3); font-size: var(--f-sm); border: 1px solid var(--cizgi); border-radius: var(--r-kucuk); background: var(--yuzey); color: var(--yazi); }
  .ara select:hover, .ara input:hover { border-color: var(--soluk); }
  .ara select:focus-visible, .ara input:focus-visible { outline: none; border-color: var(--vurgu); box-shadow: 0 0 0 3px color-mix(in srgb, var(--vurgu) 22%, transparent); }
  .ara input { width: 180px; }
  .secili-gun { display: grid; gap: var(--b3); }
  .secili-gun .tarih { font-weight: 700; color: var(--lacivert); display: flex; align-items: center; gap: var(--b2); flex-wrap: wrap; }
  dl { margin: 0; display: grid; gap: 4px; }
  dt { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--yazi-2); margin-top: 4px; }
  dd { margin: 0; display: grid; gap: 4px; justify-items: start; }
  dd .kisi { display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: var(--f-sm); }
  .yok { color: var(--soluk); font-size: var(--f-sm); }
  .not { font-size: var(--f-xs); color: var(--yazi-2); display: flex; gap: 4px; align-items: center; }
  .denetim { display: grid; gap: var(--b2); max-height: 440px; overflow-y: auto; }
  .denetim .kutu b { display: block; font-size: var(--f-sm); }
  .denetim .kutu p { font-size: var(--f-xs); color: var(--yazi-2); margin-top: 2px; }
  .denetim .tamam { display: flex; gap: 6px; align-items: center; color: var(--yazi-2); font-size: var(--f-sm); }
  .onay { grid-template-columns: auto 1fr; gap: 6px 12px; align-items: center; margin-bottom: var(--b2); }
  .onay dt { margin: 0; }
  .onay dd { font-size: var(--f-sm); font-weight: 600; }
  .bos-ay { padding: var(--b5); display: grid; gap: var(--b3); max-width: 760px; }
  .bos-ay p { color: var(--yazi-2); }

  @media (max-width: 1100px) {
    .nobet-duzen { grid-template-columns: 1fr; }
    .yan-sutun { grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
  }
  @media (max-width: 720px) {
    .karsilama { padding: var(--b5) var(--b4); grid-template-columns: minmax(0, 1fr); }
    .karsilama .resim { order: -1; max-width: 260px; margin: 0 auto; padding: 0; }
    .adimlar { grid-template-columns: 1fr; }
    .ara { width: 100%; }
    .ara select, .ara input { flex: 1; min-width: 0; width: auto; }
        }
</style>
