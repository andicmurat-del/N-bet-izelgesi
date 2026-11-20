<script lang="ts">
  // Ayar değişikliğinin önizlemesi: bu sayfa açıldığındaki ayarlarla şimdiki ayarlar, seçili ayın çizelgesinde
  // karşılaştırılır (ikisi de baştan, aynı yöntemle oluşturulur; kayıtlı çizelge değişmez). Beğenilmezse ayarlar önceki
  // hâline döndürülür.
  import { arkaPlandaOlustur } from "../../motor/istemci";
  import { cizelgeOlcutleri, degisenGunSayisi, type CizelgeOlcutleri } from "../../motor";
  import { depo, veriAnlik } from "../../veri/depo.svelte";
  import { ayarFarklari } from "../../veri/ayarAdlari";
  import { ayAdi } from "../../veri/tarih";
  import type { Ayarlar } from "../../veri/tipler";
  import Ikon from "../ortak/Ikon.svelte";

  let { acilis }: { acilis: Ayarlar } = $props();

  const farklar = $derived(ayarFarklari(acilis, depo.veri.settings));
  let calisiyor = $state(false),
    oran = $state(0),
    asama = $state(""),
    hata = $state("");
  let sonuc = $state<{ a: CizelgeOlcutleri; b: CizelgeOlcutleri; degisen: number; gun: number; ay: string; imza: string } | null>(null);
  // ayarlar ya da ay değişince eski sonuç gösterilmez
  const imza = $derived(JSON.stringify([depo.veri.settings, depo.yil, depo.ay]));

  async function hesapla() {
    hata = "";
    sonuc = null;
    calisiyor = true;
    oran = 0;
    const y = depo.yil,
      m = depo.ay,
      im = imza;
    const yeni = veriAnlik(),
      eski = { ...yeni, settings: { ...acilis } };
    try {
      asama = "önceki ayarlarla";
      const a = await arkaPlandaOlustur(eski, y, m, 0, i => (oran = i.oran / 2));
      asama = "yeni ayarlarla";
      const b = await arkaPlandaOlustur(yeni, y, m, 0, i => (oran = 0.5 + i.oran / 2));
      if (!a.days || !b.days) {
        hata = (b.warnings[0] || a.warnings[0]) ?? "Çizelge oluşturulamadı.";
        return;
      }
      sonuc = {
        a: cizelgeOlcutleri(eski, y, m, { days: a.days, warnings: a.warnings }),
        b: cizelgeOlcutleri(yeni, y, m, { days: b.days, warnings: b.warnings }),
        degisen: degisenGunSayisi(a.days, b.days),
        gun: b.days.length,
        ay: ayAdi(y, m),
        imza: im,
      };
    } catch (e) {
      hata = "Hesaplanamadı: " + (e as Error).message;
    } finally {
      calisiyor = false;
    }
  }
  function geriDon() {
    depo.veri.settings = { ...acilis };
    sonuc = null;
  }
  type Satir = { ad: string; a: number; b: number; metin?: (x: CizelgeOlcutleri) => string; yuksekIyi?: boolean };
  const satirlar = (r: { a: CizelgeOlcutleri; b: CizelgeOlcutleri }): Satir[] => [
    { ad: "Uyarı", a: r.a.uyari, b: r.b.uyari },
    { ad: "Kırmızı gün (kural esnetildi)", a: r.a.kirmizi, b: r.b.kirmizi },
    { ad: "Fazla mesai farkı (saat)", a: r.a.fmFark, b: r.b.fmFark },
    { ad: "Nöbet sayısı farkı", a: r.a.nobetFark, b: r.b.nobetFark },
    {
      ad: "Boş hafta sonu (kişi × hafta sonu)",
      a: r.a.bosHaftaSonu,
      b: r.b.bosHaftaSonu,
      metin: x => `${x.bosHaftaSonu} / ${x.haftaSonuToplam}`,
      yuksekIyi: true,
    },
    { ad: "Cuma nöbetçisine aynı hafta Pazar görevi", a: r.a.cumaPazar, b: r.b.cumaPazar },
    { ad: "Perşembe nöbetçisine aynı hafta sonu nöbet", a: r.a.persembeHaftaSonu, b: r.b.persembeHaftaSonu },
    { ad: "İki nöbet arası ayardakinden kısa", a: r.a.kisaAra, b: r.b.kisaAra },
  ];
  const yon = (s: Satir) => (s.a === s.b ? "ayni" : s.b > s.a === !!s.yuksekIyi ? "iyi" : "kotu");
  const YON_AD = { ayni: "aynı", iyi: "daha iyi", kotu: "daha kötü" };
</script>

<section class="kart panel-blok bolum onizleme">
  <h2>Ayar değişikliğinin etkisi</h2>
  {#if !farklar.length}
    <p class="aciklama">
      Bir ayarı değiştirince, seçili ayın çizelgesinin önceki ve yeni ayarlarla nasıl çıkacağını burada karşılaştırabilirsiniz (kayıtlı
      çizelge değişmez).
    </p>
  {:else}
    <p class="aciklama">Bu sayfayı açtığınızdan beri değişen ayarlar:</p>
    <ul class="farklar">
      {#each farklar as f (f.k)}<li>{f.metin}</li>{/each}
    </ul>
    <div class="dugmeler">
      <button class="dugme ana" onclick={hesapla} disabled={calisiyor}
        ><Ikon ad="tablo" />{ayAdi(depo.yil, depo.ay)} çizelgesine etkisini gör</button
      >
      <button class="dugme" onclick={geriDon} disabled={calisiyor}><Ikon ad="geri" />Ayarları önceki hâline döndür</button>
    </div>
    {#if calisiyor}
      <p class="aciklama" role="status">Çizelge {asama} oluşturuluyor…</p>
      <div
        class="ilerleme"
        role="progressbar"
        aria-label="Önizleme ilerlemesi"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={Math.round(oran * 100)}
      >
        <span style="width: {Math.round(oran * 100)}%"></span>
      </div>
    {/if}
    {#if hata}<p class="bant hata" role="alert">{hata}</p>{/if}
    {#if sonuc && sonuc.imza === imza}
      <table class="tablo">
        <caption>{sonuc.ay}: önceki ve yeni ayarlarla oluşturulan çizelge · {sonuc.degisen} / {sonuc.gun} günün görevlileri değişir</caption
        >
        <thead
          ><tr
            ><th scope="col">Ölçüt</th><th scope="col">Önceki ayarlarla</th><th scope="col">Yeni ayarlarla</th><th scope="col">Değişim</th
            ></tr
          ></thead
        >
        <tbody>
          {#each satirlar(sonuc) as s (s.ad)}
            <tr>
              <th scope="row">{s.ad}</th>
              <td class="rakam">{s.metin ? s.metin(sonuc.a) : s.a}</td>
              <td class="rakam">{s.metin ? s.metin(sonuc.b) : s.b}</td>
              <td class={yon(s)}>{YON_AD[yon(s)]}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      <p class="aciklama">
        Kayıtlı çizelge değişmedi. Yeni ayarlarla oluşturmak için Günlük Eczane > Nöbet çizelgesi > Yeniden oluştur (onaylı ay yeniden
        oluşturulmaz). Beğenmediyseniz "Ayarları önceki hâline döndür".
      </p>
    {/if}
  {/if}
</section>

<style>
  .onizleme {
    display: grid;
    gap: var(--b3);
  }
  .farklar {
    margin: 0;
    padding-left: 1.2em;
    font-size: var(--f-sm);
  }
  .dugmeler {
    display: flex;
    flex-wrap: wrap;
    gap: var(--b2);
  }
  .ilerleme {
    height: 8px;
    border-radius: 999px;
    background: var(--cizgi-acik);
    overflow: hidden;
  }
  .ilerleme span {
    display: block;
    height: 100%;
    background: var(--vurgu);
    transition: width 0.2s;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--f-sm);
  }
  caption {
    text-align: left;
    font-weight: 600;
    margin-bottom: var(--b2);
  }
  th,
  td {
    padding: 6px var(--b2);
    border-bottom: 1px solid var(--cizgi-acik);
    text-align: left;
  }
  td.iyi {
    color: var(--vurgu);
    font-weight: 600;
  }
  td.kotu {
    color: var(--hata);
    font-weight: 600;
  }
  .bant.hata {
    padding: var(--b2) var(--b3);
    border-radius: var(--r-kucuk);
    background: var(--hata-zemin);
    color: var(--hata);
    font-size: var(--f-sm);
  }
</style>
