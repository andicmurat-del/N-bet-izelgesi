<script lang="ts">
  // Yıllık servis hazırlama raporu: kişi başı aylık yük ve servislerin kişilere dağılımı (payına göre renkli).
  import { untrack } from "svelte";
  import { depo } from "../../veri/depo.svelte";
  import { servisYilRaporu, type ServisYilRaporu } from "../../veri/servis.svelte";
  import { dosyaKaydet } from "../../disa/indir";
  import { AYLAR } from "../../veri/tarih";
  import Ikon from "../ortak/Ikon.svelte";

  let { yil }: { yil: number } = $props();
  const AY3 = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  // rapor açılınca (ve yıl değişince) çizelgesi olan ayların dağıtımı güncellenip kaydedilir
  let R = $state<ServisYilRaporu | null>(null);
  $effect(() => { const y = yil; R = untrack(() => servisYilRaporu(y)); });

  const binlik = (v: number) => Math.round(v).toLocaleString("tr-TR");
  const virgul = (v: number) => (Math.round(v * 10) / 10).toLocaleString("tr-TR");
  const GRUPLAR = [["yb", "Yoğun bakım (YB)"], ["cok", "Çok günlük servisler"], ["tek", "Tek günlük servisler"]] as const;
  const SINIF = [["a2", "2+ az"], ["a1", "1 az"], ["d0", "Payına uygun"], ["f1", "1 fazla"], ["f2", "2+ fazla"]] as const;
  const sinif = (f: number) => (f <= -1.999 ? "a2" : f <= -0.999 ? "a1" : f < 0.999 ? "d0" : f < 1.999 ? "f1" : "f2");

  let durum = $state("");
  async function excel() {
    if (!R) return;
    try {
      const { servisYilKitabi } = await import("../../disa/servisCikti");
      const blob = servisYilKitabi(R, yil, depo.veri.kurum.ad);
      durum = (await dosyaKaydet(`servis-raporu-${yil}.xlsx`, blob, blob.type)) ? "Excel dosyası kaydedildi." : "";
    } catch { durum = "Dosya oluşturulamadı."; }
  }
</script>

{#if !R || !R.kayitli}
  <div class="kart bos"><h2>{yil} yılı için servis kaydı yok</h2><p>Nöbet çizelgesi oluşturulan ayların servis dağıtımı burada raporlanır.</p></div>
{:else}
  <div class="ust">
    <p class="aciklama">Kayıtlı ay: {R.kayitli}/12. Ay sütunları kişinin o ayki toplam hazırlama yükü (servisin hasta sayısı × zorluğu; çok günlük servisler gün sayısıyla). Ort. yük: çalıştığı gün başına; Ekip ort.: aynı günlerde ekipte kişi başına düşen yük. Ekip ortalamasından %5'ten fazla sapan ortalama renklidir.</p>
    <button class="dugme" onclick={excel}><Ikon ad="indir" />Excel</button>
  </div>
  {#if durum}<p class="bant" role="status">{durum}</p>{/if}

  <section class="blok">
    <h2>Aylara göre yük</h2>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (kaydırılan tablo klavyeyle kaydırılabilsin: WCAG 2.1.1) -->
    <div class="kart tablo-kap" tabindex="0" role="region" aria-label="Aylara göre servis yükü">
      <table>
        <thead><tr><th class="sol" scope="col">Ad soyad</th>{#each AY3 as a, i}<th scope="col" class:bos-ay={R.bosAy[i]}>{a}</th>{/each}<th scope="col">Gün</th><th scope="col" class="vurgu">Yük</th><th scope="col">Ort. yük</th><th scope="col">Ekip ort.</th></tr></thead>
        <tbody>
          {#each R.kisi as k (k.id)}
            <tr>
              <th class="sol" scope="row">{k.ad}</th>
              {#each k.ay as a, i}<td class:bos-ay={R.bosAy[i]} title={a ? `${AYLAR[i]}: ${a.gun} gün, toplam yük ${binlik(a.l)}` : ""}>{a ? binlik(a.l) : R.bosAy[i] ? "–" : "0"}</td>{/each}
              <td>{k.gun}</td><td class="vurgu">{binlik(k.l)}</td>
              <td class={Math.abs(k.sapma) >= 0.05 ? (k.sapma > 0 ? "fazla" : "eksik") : ""} title="Ekip ortalamasından %{Math.round(k.sapma * 100)}">{k.gun ? binlik(k.l / k.gun) : "–"}</td>
              <td>{k.gun ? binlik(k.fl / k.gun) : "–"}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>

  <section class="blok">
    <h2>Servislerin kişilere dağılımı</h2>
    <p class="aciklama">Her servisi bu yıl kimin kaç kez hazırladığı. Payı, kişinin çalıştığı günlere göre düşen sayıdır; payın bir alt ya da üst tam sayısı dengelidir.</p>
    <p class="lejant" aria-hidden="true"><span>Payından:</span>{#each SINIF as [c, t]}<span class="kutu {c}">{t}</span>{/each}</p>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (kaydırılan tablo klavyeyle kaydırılabilsin: WCAG 2.1.1) -->
    <div class="kart tablo-kap" tabindex="0" role="region" aria-label="Servislerin kişilere dağılımı">
      <table class="matris">
        <thead><tr><th class="sol" scope="col">Servis</th>{#each R.kisi as k (k.id)}<th scope="col">{k.ad}<small>{R.matris.gun[k.id] ?? 0} gün</small></th>{/each}<th scope="col">Toplam</th></tr></thead>
        <tbody>
          {#each GRUPLAR as [g, baslik]}
            {@const L = R.matris.servisler.filter(s => s.grup === g)}
            {#if L.length}
              <tr class="grup"><th class="sol" scope="rowgroup" colspan={R.kisi.length + 2}>{baslik} <small>{L.length} servis</small></th></tr>
              {#each L as s (s.sn)}
                <tr>
                  <th class="sol" scope="row">{s.sn}</th>
                  {#each R.kisi as k (k.id)}
                    {@const x = s.say[k.id] ?? 0}
                    {@const e = s.pay[k.id] ?? 0}
                    <td class={sinif(x - e)} title="{k.ad} · {s.sn}: {x} kez · payı {virgul(e)}">{x}</td>
                  {/each}
                  <td class="vurgu">{R.kisi.reduce((t, k) => t + (s.say[k.id] ?? 0), 0)}</td>
                </tr>
              {/each}
            {/if}
          {/each}
        </tbody>
      </table>
    </div>
  </section>
{/if}

<style>
  .bos { padding: var(--b5); display: grid; gap: var(--b2); }
  .bos p { color: var(--yazi-2); }
  .ust { display: flex; flex-wrap: wrap; gap: var(--b3); justify-content: space-between; align-items: flex-start; margin-bottom: var(--b3); }
  .aciklama { font-size: var(--f-sm); color: var(--soluk); max-width: 90ch; }
  .bant { padding: var(--b2) var(--b4); border-radius: var(--r); margin-bottom: var(--b3); font-size: var(--f-sm); font-weight: 500; background: var(--vurgu-zemin); color: var(--vurgu); }
  .blok { display: grid; gap: var(--b2); margin-bottom: var(--b5); }
  .blok h2 { font-size: var(--f-lg); }
  .tablo-kap { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; font-size: var(--f-sm); }
  th, td { padding: 7px 10px; border-bottom: 1px solid var(--cizgi-acik); text-align: right; white-space: nowrap; }
  thead th { font-size: var(--f-xs); color: var(--soluk); font-weight: 600; background: var(--yuzey-2); }
  thead th small { display: block; font-weight: 500; font-size: var(--f-xs); }
  tbody th { font-weight: 500; }
  .sol { text-align: left; }
  .vurgu { font-weight: 700; color: var(--tek); }
  .bos-ay { color: var(--soluk); }
  td.fazla { color: var(--haz); font-weight: 700; }
  td.eksik { color: var(--bilgi); font-weight: 700; }
  .matris td { text-align: center; min-width: 44px; }
  tr.grup th { background: var(--yuzey-2); font-size: var(--f-xs); text-transform: uppercase; letter-spacing: .04em; color: var(--yazi-2); font-weight: 700; }
  tr.grup small { text-transform: none; letter-spacing: 0; font-weight: 500; color: var(--soluk); font-size: var(--f-xs); }
  .a2 { background: var(--tek-zemin); color: var(--tek); font-weight: 700; box-shadow: inset 0 0 0 1px var(--tek); }
  .a1 { background: var(--tek-zemin); color: var(--tek); }
  .f1 { background: var(--haz-zemin); color: var(--haz); }
  .f2 { background: var(--haz-zemin); color: var(--haz); font-weight: 700; box-shadow: inset 0 0 0 1px var(--haz); }
  .lejant { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: var(--f-xs); color: var(--soluk); }
  .lejant .kutu { padding: 2px 8px; border-radius: 4px; }
  .lejant .d0 { background: var(--yuzey); box-shadow: inset 0 0 0 1px var(--cizgi); color: var(--yazi-2); }
</style>
