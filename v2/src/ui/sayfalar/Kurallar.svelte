<script lang="ts">
  // Ayarlar > Kurallar: programın tüm kuralları (veri/kurallarMetni.ts) okunur biçimde; başka bir yapay zekâya vermek
  // için metin olarak kopyalanır ya da .md dosyası olarak indirilir.
  import { depo } from "../../veri/depo.svelte";
  import { kurallarMetni } from "../../veri/kurallarMetni";
  import { dosyaKaydet, hataMetni } from "../../disa/indir";
  import Ikon from "../ortak/Ikon.svelte";

  const metin = $derived(kurallarMetni(depo.veri.settings));
  let durum = $state("");

  async function kopyala() {
    try { await navigator.clipboard.writeText(metin); durum = "Kurallar panoya kopyalandı."; }
    catch { durum = "Kopyalanamadı; \"İndir\" ile dosya olarak alın."; }
  }
  async function indir() {
    try { durum = (await dosyaKaydet("eczane-kurallari.md", metin, "text/markdown")) ? "Kurallar dosyası kaydedildi." : ""; }
    catch (e) { durum = hataMetni(e, "Dosya kaydedilemedi."); }
  }

  // küçük Markdown çevirici: başlık, paragraf, madde (iç içe), numaralı madde, tablo; satır içi kalın ve kod
  const kac = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const satirIci = (s: string) => kac(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  function html(md: string): string {
    const L = md.split("\n"), out: string[] = [];
    let i = 0;
    while (i < L.length) {
      const s = L[i];
      if (!s.trim()) { i++; continue; }
      const h = /^(#{1,3}) (.*)$/.exec(s);
      if (h) { const n = h[1].length + 1; out.push(`<h${n}>${satirIci(h[2])}</h${n}>`); i++; continue; }
      if (s.startsWith("|")) {
        const r: string[][] = [];
        while (i < L.length && L[i].startsWith("|")) { r.push(L[i].slice(1, -1).split(" | ").map(x => x.trim())); i++; }
        const [bas, , ...gov] = r;
        out.push(`<div class="tablo-kap"><table><thead><tr>${bas.map(x => `<th>${satirIci(x)}</th>`).join("")}</tr></thead><tbody>${gov.map(rr => `<tr>${rr.map(x => `<td>${satirIci(x)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
        continue;
      }
      if (/^\s*- /.test(s)) {
        let ul = "<ul>", ic = false;
        while (i < L.length && /^\s*- /.test(L[i])) {
          const alt = /^\s{2,}- /.test(L[i]), t = satirIci(L[i].replace(/^\s*- /, ""));
          if (alt && !ic) { ul = ul.replace(/<\/li>$/, "") + "<ul>"; ic = true; }
          else if (!alt && ic) { ul += "</ul></li>"; ic = false; }
          ul += `<li>${t}</li>`; i++;
        }
        out.push(ul + (ic ? "</ul></li>" : "") + "</ul>");
        continue;
      }
      if (/^\d+\. /.test(s)) {
        const l: string[] = [];
        while (i < L.length && /^\d+\. /.test(L[i])) { l.push(`<li>${satirIci(L[i].replace(/^\d+\. /, ""))}</li>`); i++; }
        out.push(`<ol>${l.join("")}</ol>`);
        continue;
      }
      const p: string[] = [];
      while (i < L.length && L[i].trim() && !/^(#|\||\s*- |\d+\. )/.test(L[i])) { p.push(L[i]); i++; }
      out.push(`<p>${satirIci(p.join(" "))}</p>`);
    }
    return out.join("\n");
  }
</script>

<section class="kart panel-blok ust">
  <div>
    <h2>Programın kuralları</h2>
    <p class="aciklama">Nöbet, hazırlama, acil eczane, onay listesi, öğlen nöbeti, servis hazırlama ve puantaj kuralları; öncelik sırası, ağırlıklar ve yedek dosyasının yapısı. Başka bir yapay zekâdan yardım alırken bu metni verin. Ağırlıklar programın kendisinden okunur, kurallar değişince metin de güncel kalır.</p>
  </div>
  <div class="dugmeler">
    <button class="dugme ana" onclick={kopyala}><Ikon ad="liste" />Metni kopyala</button>
    <button class="dugme" onclick={indir}><Ikon ad="indir" />İndir (.md)</button>
  </div>
  {#if durum}<p class="bant" role="status">{durum}</p>{/if}
</section>

<article class="kart panel-blok metin">{@html html(metin)}</article>

<style>
  .ust { padding: var(--b4); display: grid; gap: var(--b3); margin-bottom: var(--b4); }
  .ust h2 { font-size: var(--f-lg); }
  .aciklama { font-size: var(--f-sm); color: var(--soluk); max-width: 900px; }
  .dugmeler { display: flex; flex-wrap: wrap; gap: var(--b2); }
  .bant { padding: var(--b2) var(--b4); border-radius: var(--r); font-size: var(--f-sm); font-weight: 600; background: var(--vurgu-zemin); color: var(--vurgu); }
  .metin { padding: var(--b4) var(--b5); max-width: 1100px; font-size: var(--f-sm); line-height: 1.6; color: var(--yazi); }
  .metin :global(h2) { font-size: var(--f-xl, 1.4rem); color: var(--lacivert); margin: 0 0 var(--b3); }
  .metin :global(h3) { font-size: var(--f-lg); color: var(--lacivert); margin: var(--b5) 0 var(--b2); padding-top: var(--b3); border-top: 1px solid var(--cizgi-acik); }
  .metin :global(h4) { font-size: var(--f-md, 1rem); color: var(--lacivert); margin: var(--b4) 0 var(--b2); }
  .metin :global(p), .metin :global(ul), .metin :global(ol) { margin: 0 0 var(--b3); }
  .metin :global(ul), .metin :global(ol) { padding-left: 1.4em; }
  .metin :global(li) { margin: 2px 0; }
  .metin :global(code) { font-size: .92em; background: var(--yuzey-2); padding: 1px 5px; border-radius: 4px; }
  .metin :global(.tablo-kap) { overflow-x: auto; margin: 0 0 var(--b4); }
  .metin :global(table) { border-collapse: collapse; min-width: 520px; width: 100%; }
  .metin :global(th), .metin :global(td) { border: 1px solid var(--cizgi-acik); padding: 6px 10px; text-align: left; vertical-align: top; }
  .metin :global(th) { background: var(--tablo-bas); color: var(--lacivert); font-weight: 700; }
  .metin :global(td:nth-child(2)) { white-space: nowrap; font-variant-numeric: tabular-nums; }
  @media (max-width: 720px) { .metin { padding: var(--b3); } }
</style>
