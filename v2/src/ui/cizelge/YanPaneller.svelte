<script lang="ts">
  // Nöbet Listesi yan sütunu: seçili gün (nöbetçiler, hazırlama, işaretler, düzenleme düğmesi), kural denetimi ve onay.
  import { depo } from "../../veri/depo.svelte";
  import { AYLAR, gunMetni } from "../../veri/tarih";
  import type { AyCizelgesi } from "../../veri/tipler";
  import { uyariGunleri } from "../../veri/uyariGunleri";

  type Sinif = { t: string; seviye: "hata" | "uyari" | "bilgi"; baslik: string };
  /** uyarı başına gösterilen en çok gün düğmesi */
  const GUN_SINIR = 14;
  import Ikon from "../ortak/Ikon.svelte";
  import { onaylayanAdi } from "../../veri/kimlik.svelte";

  let {
    c,
    sg,
    siniflar,
    gunuDuzenle,
    gunAc,
  }: {
    c: AyCizelgesi;
    /** seçili gün (gösterilen çizelgeden) */
    sg: AyCizelgesi["days"][number] | undefined;
    siniflar: Sinif[];
    gunuDuzenle: () => void;
    /** uyarıda geçen güne dokununca: o gün seçilir (dar ekranda gün penceresi açılır) */
    gunAc: (d: number) => void;
  } = $props();
  const eczaciRol = (r: string) => r === "eczaci" || r === "nobetci";
</script>

<aside class="yan-sutun">
  <section class="panel">
    <div class="panel-bas"><h2>Seçili gün</h2></div>
    {#if sg}
      <div class="panel-ic secili-gun">
        <p class="tarih">
          {gunMetni(depo.yil, depo.ay, sg.day)}{#if sg.tatil}<span class="rozet bilgi">Tatil</span>{/if}
        </p>
        <dl>
          <dt>Nöbetçiler</dt>
          <dd>
            {#each [...sg.assigned].sort((x, y) => Number(eczaciRol(y.role)) - Number(eczaciRol(x.role))) as p}<span class="kisi"
                ><span class="gorev {eczaciRol(p.role) ? 'ecz' : 'tek'}">{eczaciRol(p.role) ? "ECZ" : "TEK"}</span>{p.name}</span
              >{:else}<span class="yok">Nöbetçi yok</span>{/each}
          </dd>
          <dt>Hazırlama</dt>
          <dd>
            {#if sg.tatil}{#each sg.prep as p, i}<span class="kisi"><span class="gorev haz">H{i + 1}</span>{p.name}</span>{:else}<span
                  class="yok">Hazırlamacı yok</span
                >{/each}{:else}<span class="yok">Hafta içi: hazırlama yok</span>{/if}
          </dd>
        </dl>
        {#if sg.locked}<p class="not"><Ikon ad="kilit" boyut={13} /> Elle düzenlendi; yeniden oluşturmada korunur.</p>{/if}
        {#if sg.assigned.length && !sg.assigned.some(p => eczaciRol(p.role))}<p class="not kirmizi">
            <Ikon ad="uyari" boyut={13} /> Bu günde nöbette eczacı yok.
          </p>{/if}
        {#if sg.conflict}<p class="not kirmizi"><Ikon ad="uyari" boyut={13} /> Bu günde kural esnetildi.</p>{/if}
        <button class="dugme" onclick={gunuDuzenle}><Ikon ad="karisik" />{c.onay ? "Günü görüntüle" : "Nöbet değişikliği yap"}</button>
      </div>
    {/if}
  </section>
  {#snippet uyari(u: Sinif, sinif: string)}
    {@const gunler = uyariGunleri(u.t, c.month, c.days.length)}
    <div class="kutu {sinif}">
      <details>
        <summary
          ><b>{u.baslik}</b>{#if gunler.length}<span class="gun-say">{gunler.length} gün</span>{/if}</summary
        >
        <p>{u.t}</p>
      </details>
      {#if gunler.length}<div class="gunler" role="group" aria-label="{u.baslik}: günler">
          {#each gunler.slice(0, GUN_SINIR) as d}<button
              class="gun-cip rakam"
              title="{d} {AYLAR[c.month]} gününü aç"
              onclick={() => gunAc(d)}>{d}</button
            >{/each}{#if gunler.length > GUN_SINIR}<span class="fazla">+{gunler.length - GUN_SINIR}</span>{/if}
        </div>{/if}
    </div>
  {/snippet}
  <section class="panel">
    <div class="panel-bas"><h2>Kural denetimi</h2></div>
    <div class="panel-ic denetim">
      {#each siniflar.filter(u => u.seviye === "hata") as u}{@render uyari(u, "hata")}{/each}
      {#each siniflar.filter(u => u.seviye === "uyari") as u}{@render uyari(u, "dikkat")}{/each}
      {#each siniflar.filter(u => u.seviye === "bilgi") as u}{@render uyari(u, "bilgi")}{/each}
      {#if !siniflar.length}<p class="tamam"><Ikon ad="tamam" boyut={15} /> Tüm kurallar sağlandı.</p>{/if}
    </div>
  </section>
  <section class="panel">
    <div class="panel-bas"><h2>Onay</h2></div>
    <div class="panel-ic">
      <dl class="onay">
        <dt>Durum</dt>
        <dd>
          {#if c.onay}<span class="rozet tamam">Onaylı</span>{:else}<span class="rozet notr">Taslak</span>{/if}
        </dd>
        <dt>Onaylayan</dt>
        <dd>{c.onay?.kim || depo.veri.kurum.onaylayan || "—"}</dd>
        {#if onaylayanAdi(c.onay)}<dt>Programda onaylayan</dt>
          <dd>{onaylayanAdi(c.onay)}</dd>{/if}
        <dt>Onay tarihi</dt>
        <dd>{c.onay ? new Date(c.onay.zaman).toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" }) : "—"}</dd>
      </dl>
      <p class="not">
        {c.onay
          ? "Onaylı çizelgenin günleri ve o ayın izin işaretleri kilitlidir; ay içinde gelişen izin, rapor ve nöbet değişimleri Puantaj bölümünden girilir."
          : "Onaylandığında çizelgenin günleri ve o ayın izin işaretleri kilitlenir; değişiklikler Puantaj bölümünden girilir."}
      </p>
    </div>
  </section>
</aside>

<style>
  .yan-sutun {
    display: grid;
    gap: var(--b3);
    min-width: 0;
  }
  .secili-gun {
    display: grid;
    gap: var(--b3);
  }
  .secili-gun .tarih {
    font-weight: 700;
    color: var(--lacivert);
    display: flex;
    align-items: center;
    gap: var(--b2);
    flex-wrap: wrap;
  }
  dl {
    margin: 0;
    display: grid;
    gap: 4px;
  }
  dt {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--yazi-2);
    margin-top: 4px;
  }
  dd {
    margin: 0;
    display: grid;
    gap: 4px;
    justify-items: start;
  }
  dd .kisi {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    font-size: var(--f-sm);
  }
  .yok {
    color: var(--soluk);
    font-size: var(--f-sm);
  }
  .not {
    font-size: var(--f-xs);
    color: var(--yazi-2);
    display: flex;
    gap: 4px;
    align-items: center;
  }
  .denetim {
    display: grid;
    gap: var(--b2);
    max-height: 440px;
    overflow-y: auto;
  }
  .denetim .kutu b {
    font-size: var(--f-sm);
  }
  summary {
    display: flex;
    align-items: center;
    gap: var(--b2);
    cursor: pointer;
    list-style: none;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  summary::before {
    content: "";
    flex: none;
    width: 6px;
    height: 6px;
    border-right: 2px solid currentColor;
    border-bottom: 2px solid currentColor;
    transform: rotate(-45deg);
    transition: transform 0.15s;
  }
  details[open] summary::before {
    transform: rotate(45deg);
  }
  .gun-say {
    margin-left: auto;
    font-size: var(--f-xs);
    font-weight: 600;
    white-space: nowrap;
  }
  .gunler {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 6px;
  }
  .gun-cip {
    min-width: 30px;
    min-height: 28px;
    padding: 0 6px;
    border: 1px solid currentColor;
    border-radius: var(--r-kucuk);
    background: var(--yuzey);
    color: inherit;
    font-size: var(--f-xs);
    font-weight: 700;
    cursor: pointer;
  }
  .gun-cip:hover {
    background: color-mix(in srgb, currentColor 12%, var(--yuzey));
  }
  .fazla {
    align-self: center;
    font-size: var(--f-xs);
  }
  .denetim .kutu p {
    font-size: var(--f-xs);
    color: var(--yazi-2);
    margin-top: 2px;
  }
  .denetim .tamam {
    display: flex;
    gap: 6px;
    align-items: center;
    color: var(--yazi-2);
    font-size: var(--f-sm);
  }
  .onay {
    grid-template-columns: auto 1fr;
    gap: 6px 12px;
    align-items: center;
    margin-bottom: var(--b2);
  }
  .onay dt {
    margin: 0;
  }
  .onay dd {
    font-size: var(--f-sm);
    font-weight: 600;
  }
  @media (max-width: 1100px) {
    .yan-sutun {
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    }
  }
  .kirmizi {
    color: var(--hata);
  }
</style>
