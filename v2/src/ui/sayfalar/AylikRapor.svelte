<script lang="ts">
  // Raporlar > Aylık rapor: yönetime sunulacak tek sayfalık özet (üstteki çalışma döneminin ayı). Kişi başı eczane
  // nöbeti, acil nöbeti, hazırlama, öğlen nöbeti, izinler ve fazla mesai; puantaja göre (gerçekleşen). PDF imza alanlı.
  import { untrack } from "svelte";
  import { aylikRaporHesapla, type AylikRaporSatiri } from "../../motor";
  import { ciktiPaketi } from "../../disa/yukle";
  import { dosyaKaydet, hataMetni } from "../../disa/indir";
  import { depo, veriAnlik, ayCizelgesi, listeOnayi } from "../../veri/depo.svelte";
  import { ROL_AD, type Onay, type Rol } from "../../veri/tipler";
  import Ikon from "../ortak/Ikon.svelte";

  let { bolum }: { bolum: "gunluk" | "acil" } = $props();
  type Kapsam = "tum" | "gunluk" | "acil";
  // ilk kapsam bölüme göre (sonra kullanıcı seçer)
  let kapsam = $state<Kapsam>(untrack(() => bolum) === "acil" ? "acil" : "tum");
  const KAPSAM_AD: Record<Kapsam, string> = { tum: "Tüm personel", gunluk: "Günlük eczane kadrosu", acil: "Acil eczane kadrosu" };

  const R = $derived(aylikRaporHesapla(veriAnlik(), depo.yil, depo.ay) as { ay: string; mesaiGun: number; mesaiToplam: number; satirlar: AylikRaporSatiri[] });
  const satirlar = $derived(R.satirlar.filter(s => kapsam === "tum" || (kapsam === "acil") === s.acilKadro));
  const topla = (k: keyof AylikRaporSatiri) => satirlar.reduce((t, s) => t + (Number(s[k]) || 0), 0);
  const onayMetni = (ad: string, o: Onay | undefined, var_: boolean) => (!var_ ? `${ad}: yok` : o ? `${ad}: onaylandı ${new Date(o.zaman).toLocaleDateString("tr-TR")}${o.kim ? " · " + o.kim : ""}` : `${ad}: onaylanmadı`);
  const onaylar = $derived([
    ...(kapsam !== "acil" ? [onayMetni("Nöbet çizelgesi", ayCizelgesi(depo.yil, depo.ay)?.onay, !!ayCizelgesi(depo.yil, depo.ay))] : []),
    ...(kapsam !== "gunluk" ? [onayMetni("Acil listesi", listeOnayi("acil", depo.yil, depo.ay), !!depo.veri.acil[`${depo.yil}-${depo.ay}`])] : []),
  ]);
  // imza alanları: düzenleyen, kontrol eden boş; onaylayan Ayarlar'daki ad
  const imzalar = $derived([{ unvan: "Düzenleyen", ad: "" }, { unvan: "Kontrol eden", ad: "" }, { unvan: "Onaylayan", ad: depo.veri.kurum.onaylayan }]);
  const veri = () => ({ kurum: depo.veri.kurum.ad, ay: R.ay, kapsam: KAPSAM_AD[kapsam], mesaiGun: R.mesaiGun, mesaiToplam: R.mesaiToplam, onaylar, satirlar, imzalar });

  let durum = $state(""), hazirlaniyor = $state(false);
  const dosyaAdi = (uz: string) => `aylik-rapor-${kapsam === "tum" ? "" : kapsam + "-"}${depo.yil}-${String(depo.ay + 1).padStart(2, "0")}.${uz}`;
  async function pdf() {
    hazirlaniyor = true; durum = "";
    try {
      const blob = (await ciktiPaketi()).aylikRaporPdf(veri());
      durum = (await dosyaKaydet(dosyaAdi("pdf"), blob, "application/pdf")) ? "PDF kaydedildi." : "";
    } catch (e) { durum = hataMetni(e, "PDF oluşturulamadı."); }
    finally { hazirlaniyor = false; }
  }
  async function excel() {
    durum = "";
    try {
      const blob = (await ciktiPaketi()).aylikRaporKitabi(veri());
      durum = (await dosyaKaydet(dosyaAdi("xlsx"), blob, blob.type)) ? "Excel dosyası kaydedildi." : "";
    } catch (e) { durum = hataMetni(e, "Dosya oluşturulamadı."); }
  }
  const sy = (n: number) => (Number.isInteger(n) ? String(n) : String(n).replace(".", ","));
</script>

<div class="ust">
  <div>
    <h2>{R.ay} aylık nöbet ve fazla mesai raporu</h2>
    <p class="aciklama">Ay, üstteki çalışma döneminden. Puantaja göre (gerçekleşen): nöbet değişimleri ve izinler işlenmiş. {R.mesaiGun} mesai günü, aylık normal çalışma {sy(R.mesaiToplam)} saat. {onaylar.join(" · ")}</p>
  </div>
  <div class="araclar">
    <label class="alan kucuk"><span>Kapsam</span>
      <select class="girdi" bind:value={kapsam}>{#each Object.entries(KAPSAM_AD) as [k, ad]}<option value={k}>{ad}</option>{/each}</select></label>
    <button class="dugme ana" onclick={pdf} disabled={hazirlaniyor || !satirlar.length}><Ikon ad="indir" />{hazirlaniyor ? "Hazırlanıyor…" : "PDF (imzalı)"}</button>
    <button class="dugme" onclick={excel} disabled={!satirlar.length}><Ikon ad="indir" />Excel</button>
  </div>
</div>
{#if durum}<p class="bant" role="status">{durum}</p>{/if}

{#if !satirlar.length}
  <div class="kart bos"><h2>Bu ay için kayıt yok</h2><p>Personel ve puantaj olan aylar raporlanır.</p></div>
{:else}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex (kaydırılan tablo klavyeyle kaydırılabilsin) -->
  <div class="kart tablo-kap" tabindex="0" role="region" aria-label="{R.ay} aylık rapor">
    <table>
      <thead><tr>
        <th class="sol" scope="col">Ad soyad</th><th class="sol" scope="col">Görev</th>
        <th scope="col">Eczane nöbeti</th><th scope="col" title="Hafta sonu / resmi tatile düşen eczane nöbeti">Tatilde</th><th scope="col">Acil nöbeti</th><th scope="col">Hazırlama</th><th scope="col">Öğlen</th>
        <th scope="col">Yıllık izin</th><th scope="col">Rapor</th><th scope="col">Diğer izin</th><th scope="col" title="Puantaja elle girilen, fazla mesai karşılığı izin">Nöbet izni</th>
        <th scope="col">Toplam (sa)</th><th scope="col">Aylık (sa)</th><th scope="col" class="vurgu">Fazla mesai</th><th scope="col">08–20</th><th scope="col">20–08</th>
      </tr></thead>
      <tbody>
        {#each satirlar as s (s.id)}
          <tr>
            <th class="sol" scope="row"><span class="isaret {s.rol}"></span>{s.ad}</th><td class="sol">{ROL_AD[s.rol as Rol] ?? s.rol}</td>
            <td>{s.nobet}</td><td>{s.tatilNobet}</td><td>{s.acil}</td><td>{s.haz}</td><td>{s.oglen}</td>
            <td>{s.yi}</td><td>{s.rapor}</td><td>{s.di}</td><td>{s.ni}</td>
            <td>{sy(s.toplam)}</td><td>{s.aylik === null ? "–" : sy(s.aylik)}</td><td class="vurgu">{sy(s.fm)}</td><td>{sy(s.gunduz)}</td><td>{sy(s.gece)}</td>
          </tr>
        {/each}
      </tbody>
      <tfoot><tr>
        <th class="sol" scope="row">Toplam</th><td class="sol">{satirlar.length} kişi</td>
        <td>{topla("nobet")}</td><td>{topla("tatilNobet")}</td><td>{topla("acil")}</td><td>{topla("haz")}</td><td>{topla("oglen")}</td>
        <td>{topla("yi")}</td><td>{topla("rapor")}</td><td>{topla("di")}</td><td>{topla("ni")}</td>
        <td>{sy(topla("toplam"))}</td><td></td><td class="vurgu">{sy(topla("fm"))}</td><td>{sy(topla("gunduz"))}</td><td>{sy(topla("gece"))}</td>
      </tr></tfoot>
    </table>
  </div>
  <p class="aciklama alt">PDF tek sayfadır (A4 yatay) ve altında Düzenleyen, Kontrol eden ve Onaylayan imza alanları bulunur; onaylayanın adı Ayarlar > Genel'den gelir.</p>
{/if}

<style>
  .ust { display: flex; flex-wrap: wrap; gap: var(--b3) var(--b5); justify-content: space-between; align-items: flex-end; margin-bottom: var(--b3); }
  .ust h2 { font-size: var(--f-lg); margin: 0 0 4px; color: var(--lacivert); }
  .aciklama { font-size: var(--f-sm); color: var(--soluk); margin: 0; max-width: 80ch; }
  .aciklama.alt { margin-top: var(--b3); }
  .araclar { display: flex; flex-wrap: wrap; gap: var(--b2); align-items: flex-end; }
  .alan.kucuk { min-width: 200px; }
  .tablo-kap { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; font-size: var(--f-sm); white-space: nowrap; }
  th, td { padding: 6px 8px; border-bottom: 1px solid var(--cizgi); text-align: center; font-variant-numeric: tabular-nums; }
  thead th { font-size: var(--f-xs); color: var(--yazi-2); background: var(--tablo-bas); position: sticky; top: 0; }
  .sol { text-align: left; }
  .vurgu { font-weight: 700; color: var(--lacivert); }
  tfoot th, tfoot td { font-weight: 700; background: var(--yuzey-2); border-top: 2px solid var(--cizgi); }
  .isaret { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 6px; vertical-align: middle; }
  .bos { padding: var(--b5); }
</style>
