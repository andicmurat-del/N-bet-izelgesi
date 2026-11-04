<script lang="ts">
  import IslemAlani from "../ortak/IslemAlani.svelte";
  // Öğlen nöbeti: hafta içi öğle arasında eczanede kalanlar (Pzt–Prş 2 eczacı + 1 tekniker, Cuma 3 eczacı + 2 tekniker).
  // O günün çalışma listesinden (puantaj) yazılır; yıl boyunca toplam ve Cuma sayısı eşit tutulur.
  import { depo, veriAnlik, aydaCalisanlar, ayCizelgesi, oglenAyi, oglenKaydet, oglenAyiniSil, oglenGunuAyarla, resmiTatilMi, arifeMi, listeOnayi, listeyiOnayla, listeOnayiniKaldir } from "../../veri/depo.svelte";
  import { OGLEN_GEREK, oglenGrubu, oglenHesapla, oglenYillikHesapla, puantajHesapla } from "../../motor";
  import { AYLAR, GUN_KISA, ayAdi, gunMetni, gunSayisi, haftaGunu, kisaAd } from "../../veri/tarih";
  import { dosyaKaydet, hataMetni } from "../../disa/indir";
  import Pencere from "../ortak/Pencere.svelte";
  import type { Rol } from "../../veri/tipler";
  import Ikon from "../ortak/Ikon.svelte";

  let { git }: { git: (ad: "kisiler" | "nobet") => void } = $props();

  const y = $derived(depo.yil), m = $derived(depo.ay);
  const c = $derived(ayCizelgesi(y, m));
  const kayit = $derived(oglenAyi(y, m));
  // onaylı ay: yeniden oluşturma, silme ve elle değiştirme yok; sonradan girilen izin / rapor yine kendiliğinden onarılır
  const onay = $derived(listeOnayi("oglen", y, m));
  const onayMetni = $derived(onay ? new Date(onay.zaman).toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" }) + (onay.kim ? " · " + onay.kim : "") : "");
  const ad = (id: number) => depo.veri.staff.find(k => k.id === id)?.name ?? "(silinmiş kişi)";
  const kisa = (id: number) => kisaAd(ad(id), depo.veri.staff.map(k => k.name));
  const gunlerTum = $derived(Array.from({ length: gunSayisi(y, m) }, (_, i) => i + 1));
  const bilgi = (d: number) => (resmiTatilMi(y, m, d) ? "Resmi tatil" : arifeMi(y, m, d) ? "Arife" : "");
  const bugun = new Date();
  const bugunMu = (d: number) => bugun.getFullYear() === y && bugun.getMonth() === m && bugun.getDate() === d;
  const kisiler = $derived(aydaCalisanlar(y, m).filter(k => oglenGrubu(k.role)));
  let uyarilar = $state<string[]>([]);
  let silOnayi = $state(false);
  $effect(() => { y; m; uyarilar = []; silOnayi = false; });

  function olustur() {
    const r = oglenHesapla(veriAnlik(), y, m) as { gunler: { gun: number; e: number[]; t: number[] }[]; uyarilar: string[] };
    oglenKaydet(y, m, r.gunler);
    uyarilar = r.uyarilar;
    silOnayi = false;
  }
  function sil() { if (!silOnayi) { silOnayi = true; return; } oglenAyiniSil(y, m); silOnayi = false; uyarilar = []; }

  // kayıttaki kişiler o gün hâlâ mesaide mi (sonradan izin / rapor girilmiş olabilir); o günün nöbetçileri
  const G = $derived(kayit ? (puantajHesapla(veriAnlik(), y, m) as { satirlar: { s: { id: number }; cells: { kod: string; saat: number }[] }[] }) : null);
  const hucre = (id: number, d: number) => G?.satirlar.find(r => r.s.id === id)?.cells[d - 1];
  const calisiyor = (id: number, d: number) => { const h = hucre(id, d); return !!h && (h.kod === "M" || h.kod === "N" || (h.kod.startsWith("S:") && h.saat > 0)); };
  const nobetciMi = (id: number, d: number) => hucre(id, d)?.kod === "N";

  type Satir = { gun: number; dw: number; e: number[]; t: number[]; elle: boolean };
  // gün elle düzenlendi mi (günün tamamı ya da bazı yerleri) ve hangi kişiler elle yazıldı
  const elleMi = (k: { elle?: true; sabit?: unknown } | undefined) => !!k && (!!k.elle || !!k.sabit);
  const elleKisi = (d: number, id: number) => { const k = kayit?.[d]; return !!k && (!!k.elle || !!k.sabit?.e.includes(id) || !!k.sabit?.t.includes(id)); };
  const haftalar = $derived.by(() => {
    if (!kayit) return [] as Satir[][];
    const out: Satir[][] = []; let cur: Satir[] = [];
    for (let d = 1; d <= gunSayisi(y, m); d++) {
      const dw = haftaGunu(y, m, d);
      if (dw === 0 && cur.length) { out.push(cur); cur = []; }
      const k = kayit[d];
      if (k) cur.push({ gun: d, dw, e: k.e, t: k.t, elle: elleMi(k) });
    }
    if (cur.length) out.push(cur);
    return out;
  });
  const sorunlar = $derived(haftalar.flat().flatMap(s => [...s.e, ...s.t].filter(id => !calisiyor(id, s.gun))
    .map(id => `${s.gun} ${AYLAR[m]}: ${ad(id)} o gün artık mesaide değil (izin ya da rapor sonradan girilmiş); yeniden oluşturun ya da bilerek bırakın.`)));

  const yillik = $derived(oglenYillikHesapla(veriAnlik(), y, m) as Record<number, { top: number; cuma: number; ay: number; ayCuma: number }>);
  const SIRA: Partial<Record<Rol, number>> = { eczaci: 0, teknisyen: 1 };
  const ozet = $derived(kisiler.slice().sort((a, b) => (SIRA[a.role] ?? 9) - (SIRA[b.role] ?? 9) || a.name.localeCompare(b.name, "tr"))
    .map(k => ({ k, ...(yillik[k.id] ?? { top: 0, cuma: 0, ay: 0, ayCuma: 0 }) })));
  const ROL_KISA: Partial<Record<Rol, string>> = { eczaci: "eczacı", teknisyen: "tekniker" };

  // elle düzenleme: bir güne dokunulur, eczacı ve tekniker yerleri seçilir; bu gün otomatik oluşturmada korunur
  let acik = $state(false), gun = $state(1), se = $state<string[]>([]), st = $state<string[]>([]);
  // pencere açıldığındaki yerler: kaydederken hangi yerin elle değiştirildiği bunlarla karşılaştırılır
  let seIlk: string[] = [], stIlk: string[] = [];
  const gerekE = $derived(haftaGunu(y, m, gun) === 4 ? OGLEN_GEREK.cuma.e : OGLEN_GEREK.hafta.e);
  const gerekT = $derived(haftaGunu(y, m, gun) === 4 ? OGLEN_GEREK.cuma.t : OGLEN_GEREK.hafta.t);
  function gunAc(s: Satir) {
    gun = s.gun;
    const n = (l: number[], k: number) => Array.from({ length: Math.max(k, l.length) }, (_, i) => String(l[i] ?? ""));
    se = n(s.e, haftaGunu(y, m, s.gun) === 4 ? OGLEN_GEREK.cuma.e : OGLEN_GEREK.hafta.e);
    st = n(s.t, haftaGunu(y, m, s.gun) === 4 ? OGLEN_GEREK.cuma.t : OGLEN_GEREK.hafta.t);
    seIlk = se.slice(); stIlk = st.slice();
    acik = true;
  }
  const secenekler = (g: "e" | "t") => kisiler.filter(k => oglenGrubu(k.role) === g).sort((a, b) => a.name.localeCompare(b.name, "tr"));
  const etiket = (id: number) => {
    const k = kisiler.find(x => x.id === id); const n: string[] = [];
    if (!calisiyorG(id, gun)) n.push("o gün çalışmıyor");
    else if (nobetciMiG(id, gun)) n.push("nöbetçi");
    if (k?.cumaMuaf && haftaGunu(y, m, gun) === 4) n.push("Cuma'dan muaf");
    return n.length ? ` (${n.join(", ")})` : "";
  };
  // pencere için puantaj, kayıt olmasa da
  const GP = $derived(acik ? (puantajHesapla(veriAnlik(), y, m) as { satirlar: { s: { id: number }; cells: { kod: string; saat: number }[] }[] }) : null);
  const hucreG = (id: number, d: number) => GP?.satirlar.find(r => r.s.id === id)?.cells[d - 1];
  const calisiyorG = (id: number, d: number) => { const h = hucreG(id, d); return !!h && (h.kod === "M" || h.kod === "N" || (h.kod.startsWith("S:") && h.saat > 0)); };
  const nobetciMiG = (id: number, d: number) => hucreG(id, d)?.kod === "N";
  const secE = $derived(se.filter(Boolean).map(Number)), secT = $derived(st.filter(Boolean).map(Number));
  const tekrar = $derived(new Set(secE).size !== secE.length || new Set(secT).size !== secT.length);
  /** Elle yerler: bu pencerede değiştirilen her yer (kişi seçildiyse o kişi, "Seçilmedi" yapıldıysa boş yer) ve daha
   *  önce elle belirlenip dokunulmayan yerler. Değiştirilmeyen öteki yerleri yeniden oluşturma yeniden yazabilir. */
  function elleYerler(g: "e" | "t", sec: string[], ilk: string[]) {
    const k = kayit?.[gun], once = k?.elle ? k[g] : k?.sabit?.[g] ?? [];
    let oncekiBos = k?.elle ? Math.max(0, ilk.length - k[g].length) : (g === "e" ? k?.sabit?.be : k?.sabit?.bt) ?? 0;
    const kisi: number[] = []; let bos = 0;
    sec.forEach((v, i) => {
      if (v !== ilk[i]) { if (v) kisi.push(Number(v)); else bos++; }
      else if (v && once.includes(Number(v))) kisi.push(Number(v));
      else if (!v && oncekiBos > 0) { bos++; oncekiBos--; }
    });
    return { kisi, bos };
  }
  function gunKaydet() {
    if (tekrar || onay) return;
    const E = elleYerler("e", se, seIlk), T = elleYerler("t", st, stIlk);
    const sb = E.kisi.length || T.kisi.length || E.bos || T.bos ? { e: E.kisi, t: T.kisi, ...(E.bos ? { be: E.bos } : {}), ...(T.bos ? { bt: T.bos } : {}) } : null;
    oglenGunuAyarla(y, m, gun, secE, secT, sb);
    acik = false;
  }
  function otomatik() { if (onay) return; const k = kayit?.[gun]; oglenGunuAyarla(y, m, gun, k?.e ?? [], k?.t ?? [], null); acik = false; }

  let durum = $state("");
  // haftalık PDF: ayın hafta içi günleri haftalara bölünür (Pzt–Cuma); seçilen hafta tek sayfa
  const pdfHaftalari = $derived.by(() => {
    const out: { bas: number; bit: number }[] = [];
    for (let d = 1; d <= gunSayisi(y, m); d++) {
      const dw = haftaGunu(y, m, d);
      if (dw > 4) continue;
      if (!out.length || dw === 0) out.push({ bas: d, bit: d }); else out[out.length - 1].bit = d;
    }
    return out;
  });
  let pdfHafta = $state(0);
  $effect(() => { y; m; const b = new Date(); const g = b.getFullYear() === y && b.getMonth() === m ? b.getDate() : 0;
    const i = pdfHaftalari.findIndex(h => g >= h.bas && g <= h.bit + 2); pdfHafta = i >= 0 ? i : 0; });
  const haftaMetni = (h: { bas: number; bit: number }) => h.bas === h.bit ? `${h.bas} ${AYLAR[m]}` : `${h.bas}–${h.bit} ${AYLAR[m]}`;
  async function pdf() {
    durum = "";
    try {
      const { oglenPdf } = await import("../../disa/oglenCikti");
      const h = pdfHaftalari[pdfHafta];
      const blob = oglenPdf({
        y, m, kurum: depo.veri.kurum.ad, donem: haftaMetni(h) + " " + y,
        haftalar: haftalar.map(w => w.filter(s => s.gun >= h.bas && s.gun <= h.bit).map(s => ({ gun: s.gun, dw: s.dw, e: s.e.map(ad), t: s.t.map(ad) }))).filter(w => w.length),
        ozet: [],
      });
      const ok = await dosyaKaydet(`oglen-nobeti-${y}-${String(m + 1).padStart(2, "0")}-${String(h.bas).padStart(2, "0")}.pdf`, blob, "application/pdf");
      durum = ok ? "PDF kaydedildi." : "";
    } catch (e) { durum = hataMetni(e, "PDF oluşturulamadı."); }
  }
</script>

{#if !c}
  <section class="kart bos">
    <h2>{ayAdi(y, m)} çizelgesi henüz yok</h2>
    <p>Öğlen nöbeti o günün çalışma listesinden yazılır: kimin izinli, nöbetçi ya da nöbet ertesi izinli olduğu nöbet çizelgesinden ve puantajdan gelir. Önce bu ayın nöbet çizelgesini oluşturun.</p>
    <div><button class="dugme ana" onclick={() => git("nobet")}><Ikon ad="takvim" />Günlük Eczane Nöbet Listesi</button></div>
  </section>
{:else}
  <IslemAlani>
      {#if onay}
        <button class="dugme" onclick={() => listeOnayiniKaldir("oglen", y, m)}>Onayı kaldır</button>
      {:else}
        <button class="dugme{kayit ? '' : ' ana'}" onclick={olustur}><Ikon ad={kayit ? "yenile" : "saat"} />{kayit ? "Yeniden oluştur" : "Öğlen nöbetini oluştur"}</button>
        {#if kayit}<button class="dugme ana" onclick={() => listeyiOnayla("oglen", y, m)}><Ikon ad="tamam" />Onayla</button>{/if}
      {/if}
      {#if kayit && pdfHaftalari.length}
        <span class="pdf-hafta">
          <select class="girdi" bind:value={pdfHafta} aria-label="PDF için hafta">{#each pdfHaftalari as h, i}<option value={i}>{haftaMetni(h)}</option>{/each}</select>
          <button class="dugme" onclick={pdf}><Ikon ad="indir" />Haftalık PDF</button>
        </span>
      {/if}
      {#if kayit && !onay}<button class="dugme sade tehlike" onclick={sil}><Ikon ad="sil" />{silOnayi ? "Evet, ayın öğlen nöbetini sil" : "Sil"}</button>{/if}
  </IslemAlani>
  {#if onay}<p class="bant bilgi">Onaylandı: {onayMetni}. Onaylı liste kilitlidir; yeniden oluşturulmaz ve elle değiştirilmez. Sonradan girilen izin ve raporlarda boşalan yerler yine kendiliğinden doldurulur.</p>{/if}
  {#if durum}<p class="bant" role="status">{durum}</p>{/if}

  {#each [...uyarilar, ...sorunlar] as u}<p class="satir kutu dikkat"><Ikon ad="uyari" boyut={15} /><span>{u}</span></p>{/each}

  {#if !kayit}
    <p class="kutu dikkat bilgi-kutu"><Ikon ad="bilgi" boyut={16} /><span>{ayAdi(y, m)} için öğlen nöbeti henüz oluşturulmadı. Başlıktaki "Öğlen nöbetini oluştur" düğmesiyle hazırlayın.</span></p>
  {:else}
    <section class="panel" aria-label="{ayAdi(y, m)} öğlen nöbeti">
      <div class="panel-bas"><h2>{ayAdi(y, m)} öğlen nöbeti</h2>
        <p class="lejant"><span><span class="gorev ecz">ECZ</span>Eczacı</span><span><span class="gorev tek">TEK</span>Tekniker</span><span><b class="nb">N</b> o günün nöbetçisi</span><span><span class="elle-ornek">Ad</span> elle yazıldı</span></p></div>
      <div class="takvim">
        {#each GUN_KISA.slice(0, 5) as g}<div class="bas" aria-hidden="true">{g}</div>{/each}
        {#each { length: haftaGunu(y, m, 1) <= 4 ? haftaGunu(y, m, 1) : 0 } as _}<div class="bosluk" aria-hidden="true"></div>{/each}
        {#each gunlerTum.filter(d => haftaGunu(y, m, d) <= 4) as d (d)}
          {@const k = kayit[d]}
          {@const dw = haftaGunu(y, m, d)}
          {#if k}
            {@const s = { gun: d, dw, e: k.e, t: k.t, elle: elleMi(k) }}
            <button class="gun" class:cuma={dw === 4} class:sorunlu={[...k.e, ...k.t].some(id => !calisiyor(id, d))} class:bugun={bugunMu(d)} onclick={() => gunAc(s)}
              aria-label="{gunMetni(y, m, d)}: eczacı {k.e.map(ad).join(', ') || 'yok'}; tekniker {k.t.map(ad).join(', ') || 'yok'}{elleMi(k) ? ', elle düzenlendi' : ''}">
              <span class="serit"><b class="rakam">{d}</b><span class="gunadi">{GUN_KISA[dw]}</span>{#if elleMi(k)}<span class="elle" title="Elle düzenlendi (işaretli kişiler yeniden oluşturmada korunur)">elle</span>{/if}</span>
              <span class="kisiler">
                {#each k.e as id}<span class="kisi" class:sorun={!calisiyor(id, d)} class:elle-kisi={!k.elle && elleKisi(d, id)}><span class="gorev ecz">ECZ</span><span class="ad">{ad(id)}</span><span class="ad-kisa">{kisa(id)}</span>{#if nobetciMi(id, d)}<span class="nb" title="O günün nöbetçisi">N</span>{/if}</span>{/each}
                {#each k.t as id}<span class="kisi" class:sorun={!calisiyor(id, d)} class:elle-kisi={!k.elle && elleKisi(d, id)}><span class="gorev tek">TEK</span><span class="ad">{ad(id)}</span><span class="ad-kisa">{kisa(id)}</span>{#if nobetciMi(id, d)}<span class="nb" title="O günün nöbetçisi">N</span>{/if}</span>{/each}
              </span>
            </button>
          {:else}
            <div class="gun bos-gun" aria-hidden="true"><span class="serit"><b class="rakam">{d}</b><span class="gunadi">{GUN_KISA[dw]}</span></span><span class="yok">{bilgi(d)}</span></div>
          {/if}
        {/each}
      </div>
    </section>
  {/if}

  <div class="alt-duzen">
    <div class="sol-sutun">
      <section class="panel">
        <div class="panel-bas"><h2>Öğlen nöbeti kuralları</h2></div>
        <table class="tablo">
          <thead><tr><th>Gün</th><th class="sag">Eczacı</th><th class="sag">Tekniker</th></tr></thead>
          <tbody>
            <tr><td>Pazartesi – Perşembe</td><td class="sag">{OGLEN_GEREK.hafta.e}</td><td class="sag">{OGLEN_GEREK.hafta.t}</td></tr>
            <tr><td>Cuma</td><td class="sag">{OGLEN_GEREK.cuma.e}</td><td class="sag">{OGLEN_GEREK.cuma.t}</td></tr>
            <tr><td>Resmi tatil ve arife</td><td class="sag">—</td><td class="sag">—</td></tr>
          </tbody>
        </table>
      </section>
      <section class="panel">
        <div class="panel-bas"><h2>Eşitlik ilkesi</h2></div>
        <div class="panel-ic ilke">
          <p>O gün mesaide çalışanlardan yazılır. Herkese haftada bir (kişi yetmezse iki; haftada iki sırayla verilir, herkes bir kez almadan kimse yeniden almaz); yıl boyunca toplam sayı ve Cuma sayısı ayrı ayrı eşit dağıtılır. İzin vb. nedeniyle bir ay az alan sonraki aylarda tamamlar. Mümkünse aynı kişi art arda iki Cuma yazılmaz. Eşitlik bozulmuyorsa o günün nöbetçisine yazılmaz.</p>
          <p>Bir güne dokunup kişileri elle değiştirebilirsiniz: yalnız değiştirdiğiniz yerler korunur, "Seçilmedi" yaptığınız yer boş kalır. Sonradan girilen izin ve raporlarda boşalan yerler kendiliğinden doldurulur.</p>
          <button class="baglanti" onclick={() => git("kisiler")}><Ikon ad="kisiler" boyut={16} />Cuma'dan muaf olanları düzenle (Personel)</button>
        </div>
      </section>
    </div>
    <section class="panel">
      <div class="panel-bas"><h2>Kişi başı öğlen nöbeti</h2></div>
      <div class="tablo-kap">
        <table class="tablo kisi-tablo">
          <thead><tr><th class="sag">Sıra</th><th>Ad soyad</th><th class="sag">Bu ay</th><th class="sag">Bu ay Cuma</th><th class="sag">Yıl toplam</th><th class="sag">Yıl Cuma</th></tr></thead>
          <tbody>
            {#each [{ ad: "Eczacılar", rol: "eczaci" }, { ad: "Teknikerler", rol: "teknisyen" }] as grup}
              {@const l = ozet.filter(o => o.k.role === grup.rol)}
              {#if l.length}
                <tr class="grup-satir"><td colspan="6">{grup.ad}</td></tr>
                {#each l as o, i (o.k.id)}
                  <tr>
                    <td class="sag">{i + 1}</td>
                    <td>{o.k.name}{#if o.k.cumaMuaf}{" "}<small>Cuma'dan muaf</small>{/if}</td>
                    <td class="sag">{o.ay}</td><td class="sag">{o.k.cumaMuaf ? "–" : o.ayCuma}</td><td class="sag">{o.top}</td><td class="sag">{o.k.cumaMuaf ? "–" : o.cuma}</td>
                  </tr>
                {/each}
              {/if}
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  </div>
{/if}

<Pencere bind:acik baslik={gunMetni(y, m, gun)} altBaslik="Öğlen nöbeti · {gerekE} eczacı + {gerekT} tekniker{onay ? ' · onaylı liste' : ''}">
  <div class="iki">
    <div class="alanlar">
      {#each se as _, i}
        <label class="alan"><span>{i + 1}. eczacı</span><select class="girdi" disabled={!!onay} bind:value={se[i]}><option value="">Seçilmedi</option>{#each secenekler("e") as k}<option value={String(k.id)}>{k.name}{etiket(k.id)}</option>{/each}</select></label>
      {/each}
    </div>
    <div class="alanlar">
      {#each st as _, i}
        <label class="alan"><span>{i + 1}. tekniker</span><select class="girdi" disabled={!!onay} bind:value={st[i]}><option value="">Seçilmedi</option>{#each secenekler("t") as k}<option value={String(k.id)}>{k.name}{etiket(k.id)}</option>{/each}</select></label>
      {/each}
    </div>
  </div>
  {#if tekrar}<p class="not hata" role="alert">Aynı kişi iki kez seçilemez.</p>{/if}
  <p class="not">{onay ? "Liste onaylı: değiştirmek için önce onayı kaldırın." : "Değiştirdiğiniz yerler elle sayılır: yeniden oluşturma ve otomatik doldurma yalnız öteki yerleri değiştirir. \"Seçilmedi\" yaptığınız yer boş kalır."}</p>
  {#snippet altlik()}
    {#if elleMi(kayit?.[gun]) && !onay}<button class="dugme sade" onclick={otomatik}>Otomatiğe bırak</button>{/if}
    <span style="flex:1"></span>
    {#if onay}<button class="dugme" onclick={() => (acik = false)}>Kapat</button>
    {:else}
      <button class="dugme" onclick={() => (acik = false)}>Vazgeç</button>
      <button class="dugme ana" onclick={gunKaydet} disabled={tekrar}>Kaydet</button>
    {/if}
  {/snippet}
</Pencere>

<style>
  .bos { padding: var(--b5); display: grid; gap: var(--b3); max-width: 760px; }
  .bos p { color: var(--yazi-2); }
  .satir { display: flex; gap: var(--b2); align-items: flex-start; margin-bottom: var(--b2); }
  .satir :global(svg) { flex: none; margin-top: 2px; }
  .bilgi-kutu { display: flex; gap: var(--b2); align-items: center; margin-bottom: var(--b4); font-weight: 600; }
  small { color: var(--soluk); font-weight: 400; font-size: var(--f-xs); }
  .bant { padding: var(--b2) var(--b4); border: 1px solid var(--cizgi); border-radius: var(--r); margin-bottom: var(--b3); font-size: var(--f-sm); font-weight: 600; background: var(--vurgu-zemin); color: var(--vurgu); }
  .bant.bilgi { background: var(--bilgi-zemin); color: var(--bilgi); }
  /* yalnız hafta içi (Pzt–Cuma): kenarlıklı 5 sütun, adlara daha çok yer */
  .takvim { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); }
  .bas, .bosluk, .gun { border-right: 1px solid var(--cizgi); border-bottom: 1px solid var(--cizgi); }
  .takvim > :nth-child(5n) { border-right: 0; }
  .bas { background: var(--tablo-bas); color: var(--lacivert); font-size: var(--f-xs); font-weight: 700; text-align: center; padding: 6px 0; }
  .bosluk { background: var(--yuzey-2); }
  .gun { display: flex; flex-direction: column; min-height: 104px; padding: 0; text-align: left; border-top: 0; border-left: 0; border-radius: 0; background: var(--yuzey); min-width: 0; font: inherit; color: inherit; }
  button.gun { cursor: pointer; }
  button.gun:hover { background: var(--yuzey-2); }
  button.gun:focus-visible { outline: 2px solid var(--odak); outline-offset: -2px; }
  .serit { display: flex; align-items: center; gap: 6px; min-height: 24px; padding: 2px 8px; background: var(--panel-bas); border-bottom: 1px solid var(--cizgi-acik); font-size: var(--f-xs); color: var(--yazi-2); }
  .serit b { font-size: var(--f-sm); color: var(--lacivert); }
  .gun.cuma .serit { background: color-mix(in srgb, var(--acik-mavi) 18%, var(--yuzey)); }
  .gun.sorunlu .serit { box-shadow: inset 0 -2px 0 var(--hata); }
  .gun.bugun .serit b { text-decoration: underline; text-underline-offset: 3px; }
  .bos-gun { background: var(--yuzey-2); }
  .elle { margin-left: auto; font-size: 11px; font-weight: 700; color: var(--yazi-2); }
  .elle-kisi .ad, .elle-kisi .ad-kisa, .elle-ornek { text-decoration: underline dotted; text-underline-offset: 3px; }
  .kisiler { display: grid; gap: 3px; padding: 6px 8px 8px; min-width: 0; }
  .kisi { display: flex; align-items: center; gap: 6px; font-size: 13px; line-height: 1.3; font-weight: 600; min-width: 0; }
  .kisi .ad { min-width: 0; overflow-wrap: anywhere; }
  .kisi.sorun { color: var(--hata); text-decoration: line-through; }
  .nb { font-size: 10px; font-weight: 700; color: var(--hata); flex: none; }
  .yok { font-size: var(--f-xs); color: var(--soluk); padding: 6px 8px; }
  .ad-kisa { display: none; }
  .lejant { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: var(--f-xs); color: var(--yazi-2); }
  .lejant > span { display: inline-flex; align-items: center; gap: 5px; }
  .alt-duzen { display: grid; grid-template-columns: minmax(280px, 380px) minmax(0, 1fr); gap: var(--b4); margin-top: var(--b4); align-items: start; }
  .sol-sutun { display: grid; gap: var(--b4); }
  .ilke { display: grid; gap: var(--b2); font-size: var(--f-sm); color: var(--yazi-2); }
  .baglanti { display: inline-flex; align-items: center; gap: 6px; border: 0; background: none; padding: 0; color: var(--baglanti); font-weight: 600; text-decoration: underline; cursor: pointer; justify-self: start; text-align: left; }
  .kisi-tablo td { white-space: nowrap; }
  @media (max-width: 960px) { .alt-duzen { grid-template-columns: 1fr; } }
  @media (max-width: 720px) {
    .bas { font-size: 11px; padding: 4px 0; }
    .gun { min-height: 70px; }
    .serit { padding: 1px 4px; min-height: 18px; }
    .gunadi { display: none; }
    .elle { font-size: 9px; }
    .kisiler { gap: 1px; padding: 3px 3px 4px; }
    .kisi { font-size: 11px; gap: 2px; line-height: 1.2; }
    .kisi .gorev { display: none; }
    .nb { font-size: 8px; }
    .yok { font-size: 9px; }
  }
  .pdf-hafta { display: inline-flex; gap: var(--b2); align-items: center; }
  .pdf-hafta select { width: auto; min-width: 9.5em; }
  .iki { display: grid; grid-template-columns: 1fr 1fr; gap: var(--b3); }
  .alanlar { display: grid; gap: var(--b2); align-content: start; }
  .not { padding: var(--b2) var(--b3); border: 1px solid var(--cizgi-acik); border-radius: var(--r-kucuk); font-size: var(--f-sm); background: var(--yuzey-2); color: var(--yazi-2); }
  .not.hata { background: var(--hata-zemin); color: var(--hata); }
  @media (max-width: 720px) { .iki { grid-template-columns: 1fr; } }
</style>
