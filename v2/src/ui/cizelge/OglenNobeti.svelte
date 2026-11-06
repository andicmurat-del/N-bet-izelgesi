<script lang="ts">
  import { puantajIzgarasi } from "../../veri/degisim.svelte";
  import { ciktiPaketi } from "../../disa/yukle";
  import IslemAlani from "../ortak/IslemAlani.svelte";
  // Öğlen nöbeti: hafta içi öğle arasında eczanede kalanlar (Pzt–Prş 2 eczacı + 1 tekniker, Cuma 3 eczacı + 2 tekniker).
  // O günün çalışma listesinden (puantaj) yazılır; yıl boyunca toplam ve Cuma sayısı eşit tutulur.
  import { depo, veriAnlik, aydaCalisanlar, ayCizelgesi, oglenAyi, oglenKaydet, oglenAyiniSil, oglenGunuAyarla, resmiTatilMi, arifeMi, listeOnayi, listeyiOnayla, listeOnayiniKaldir } from "../../veri/depo.svelte";
  import { OGLEN_GEREK, oglenGrubu, oglenHesapla, oglenYillikHesapla } from "../../motor";
  import { AYLAR, GUN_UZUN, ayAdi, gunMetni, gunSayisi, haftaGunu, kisaAd } from "../../veri/tarih";
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
  const G = $derived(kayit ? (puantajIzgarasi(y, m) as { satirlar: { s: { id: number }; cells: { kod: string; saat: number }[] }[] }) : null);
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
  const GP = $derived(acik ? (puantajIzgarasi(y, m) as { satirlar: { s: { id: number }; cells: { kod: string; saat: number }[] }[] }) : null);
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
  // seçili haftanın günleri (yalnız hafta içi) ve form satırları (eczacı ve tekniker yerleri)
  const secHafta = $derived(pdfHaftalari[pdfHafta] ?? { bas: 1, bit: 1 });
  const haftaGunleri = $derived(Array.from({ length: secHafta.bit - secHafta.bas + 1 }, (_, i) => secHafta.bas + i).filter(d => haftaGunu(y, m, d) <= 4));
  const satirlar = $derived.by(() => {
    const kac = (g: "e" | "t") => Math.max(0, ...haftaGunleri.map(d => Math.max(kayit?.[d]?.[g].length ?? 0, kayit?.[d] ? (haftaGunu(y, m, d) === 4 ? OGLEN_GEREK.cuma[g] : OGLEN_GEREK.hafta[g]) : 0)));
    return [...Array.from({ length: kac("e") }, (_, i) => ({ g: "e" as const, i })), ...Array.from({ length: kac("t") }, (_, i) => ({ g: "t" as const, i }))];
  });
  const haftaMetni = (h: { bas: number; bit: number }) => h.bas === h.bit ? `${h.bas} ${AYLAR[m]}` : `${h.bas}–${h.bit} ${AYLAR[m]}`;
  async function pdf() {
    durum = "";
    try {
      const { oglenPdf } = await ciktiPaketi();
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
    <div class="haftalar" role="group" aria-label="Hafta">
      {#each pdfHaftalari as h, i}<button class="hafta" aria-pressed={pdfHafta === i} onclick={() => (pdfHafta = i)}><b>{i + 1}. hafta</b><small>{haftaMetni(h)}</small></button>{/each}
    </div>
    <div class="ust-duzen">
      <section class="panel" aria-label="{haftaMetni(secHafta)} öğlen nöbeti">
        <div class="panel-bas"><h2>{haftaMetni(secHafta)} · öğlen nöbeti</h2>
          <p class="lejant"><span><b class="nb">N</b> o günün nöbetçisi</span><span><span class="elle-ornek">Ad</span> elle yazıldı</span><span>Değiştirmek için hücreye dokunun</span></p></div>
        <div class="tablo-kap">
          <table class="form">
            <thead><tr><th class="yer"></th>{#each haftaGunleri as d (d)}<th class:cuma={haftaGunu(y, m, d) === 4} class:bugun={bugunMu(d)}>{d} {AYLAR[m]}<small>{GUN_UZUN[haftaGunu(y, m, d)]}</small></th>{/each}</tr></thead>
            <tbody>
              {#each satirlar as r (r.g + r.i)}
                <tr class={r.g}>
                  <th class="yer" scope="row">{r.i + 1}. <span class="uzun">{r.g === "e" ? "Eczacı" : "Tekniker"}</span><span class="kisa-et">{r.g === "e" ? "Ecz" : "Tek"}</span></th>
                  {#each haftaGunleri as d (d)}
                    {@const k = kayit[d]}
                    {@const dw = haftaGunu(y, m, d)}
                    {@const gerek = dw === 4 ? OGLEN_GEREK.cuma[r.g] : OGLEN_GEREK.hafta[r.g]}
                    {#if !k}
                      <td class="kapali" class:cuma={dw === 4}>{r.g === "e" && r.i === 0 ? bilgi(d) || "—" : ""}</td>
                    {:else}
                      {@const id = k[r.g][r.i]}
                      {#if id === undefined && r.i >= gerek}
                        <td class="kapali" class:cuma={dw === 4}></td>
                      {:else}
                        <td class:cuma={dw === 4} class:sorunlu={id !== undefined && !calisiyor(id, d)}>
                          <button class="hucre" class:elle-kisi={id !== undefined && !k.elle && elleKisi(d, id)} class:elle-gun={!!k.elle} onclick={() => gunAc({ gun: d, dw, e: k.e, t: k.t, elle: elleMi(k) })}
                            aria-label="{gunMetni(y, m, d)}, {r.i + 1}. {r.g === 'e' ? 'eczacı' : 'tekniker'}: {id !== undefined ? ad(id) : 'boş'}">
                            {#if id !== undefined}<span class="ad">{ad(id)}</span><span class="ad-kisa">{kisa(id)}</span>{#if nobetciMi(id, d)}<span class="nb" title="O günün nöbetçisi">N</span>{/if}{:else}<span class="bos-yer">Boş</span>{/if}
                          </button>
                        </td>
                      {/if}
                    {/if}
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>
      <section class="panel" aria-label="Kişi başı dağılım">
        <div class="panel-bas"><h2>Kişi başı dağılım</h2>
          <p class="lejant"><span><i class="kare a"></i>Pzt–Prş</span><span><i class="kare c"></i>Cuma</span><span>bu ay · yıl</span></p></div>
        <div class="panel-ic dagilim">
          {#each [{ ad: "Eczacılar", rol: "eczaci" }, { ad: "Teknikerler", rol: "teknisyen" }] as grup}
            {@const l = ozet.filter(o => o.k.role === grup.rol)}
            {#if l.length}
              <h3>{grup.ad}</h3>
              {#each l as o (o.k.id)}
                <div class="dag" title="{o.k.name}: bu ay {o.ay} (Cuma {o.ayCuma}), yıl {o.top} (Cuma {o.cuma})">
                  <span class="dad">{o.k.name}{#if o.k.cumaMuaf}{" "}<small>Cuma muaf</small>{/if}</span>
                  <span class="kareler" aria-hidden="true">{#each { length: o.ay } as _, j}<i class="kare {j >= o.ay - o.ayCuma ? 'c' : 'a'}"></i>{/each}</span>
                  <b class="rakam">{o.ay}</b><span class="yil rakam">{o.top}</span>
                </div>
              {/each}
            {/if}
          {/each}
        </div>
      </section>
    </div>
  {/if}

  <div class="alt-duzen">
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
        <p>O gün mesaide çalışanlardan yazılır. Herkese haftada bir (kişi yetmezse iki; haftada iki sırayla verilir, herkes bir kez almadan kimse yeniden almaz); yıl boyunca toplam sayı ve Cuma sayısı ayrı ayrı eşit dağıtılır. Eşitlik kişinin çalıştığı günlere göre hesaplanır: yıllık izin ve raporlu günler paydan düşer, izinden dönen fazladan yazılmaz. Mümkünse aynı kişi art arda iki Cuma yazılmaz. Teknikerde Pazartesi–Perşembe Cuma'dan muaf olanlara, Cuma öbürlerine yazılır (muaflar yetmezse öbürleri de); eşitlik iki grubun kendi içinde aranır. Eşitlik bozulmuyorsa o günün nöbetçisine yazılmaz.</p>
        <p>Bir hücreye dokunup kişileri elle değiştirebilirsiniz: yalnız değiştirdiğiniz yerler korunur, "Seçilmedi" yaptığınız yer boş kalır. Sonradan girilen izin ve raporlarda boşalan yerler kendiliğinden doldurulur.</p>
        <button class="baglanti" onclick={() => git("kisiler")}><Ikon ad="kisiler" boyut={16} />Cuma'dan muaf olanları düzenle (Personel)</button>
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
  .haftalar { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: var(--b3); }
  .hafta { display: grid; text-align: left; gap: 1px; padding: 6px 14px; border: 1px solid var(--cizgi); border-radius: var(--r-kucuk); background: var(--yuzey); color: var(--lacivert); cursor: pointer; font: inherit; }
  .hafta b { font-size: var(--f-sm); }
  .hafta small { font-size: var(--f-xs); color: var(--yazi-2); }
  .hafta[aria-pressed="true"] { background: var(--lacivert); border-color: var(--lacivert); color: #fff; }
  .hafta[aria-pressed="true"] small { color: #C9D6E6; }
  .ust-duzen { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: var(--b4); align-items: start; }
  .form { border-collapse: collapse; width: 100%; table-layout: fixed; }
  .form th, .form td { border: 1px solid var(--cizgi); text-align: left; }
  .form thead th { background: var(--tablo-bas); color: var(--lacivert); font-size: var(--f-sm); padding: 8px 12px; }
  .form thead th small { display: block; font-weight: 500; color: var(--yazi-2); font-size: var(--f-xs); }
  .form thead th.cuma { background: color-mix(in srgb, var(--haz) 22%, var(--yuzey)); }
  .form thead th.bugun { box-shadow: inset 0 -3px 0 var(--lacivert); }
  .form th.yer { width: 110px; background: var(--yuzey-2); color: var(--lacivert); font-size: var(--f-xs); font-weight: 700; padding: 8px 12px; }
  .form tr.t th.yer { background: color-mix(in srgb, var(--acik-mavi) 16%, var(--yuzey)); }
  .form td { padding: 0; height: 48px; }
  .form td.cuma { background: color-mix(in srgb, var(--haz) 7%, var(--yuzey)); }
  .form td.kapali { background: var(--yuzey-2); color: var(--soluk); font-size: var(--f-xs); padding: 6px 12px; }
  .form td.sorunlu .ad, .form td.sorunlu .ad-kisa { color: var(--hata); text-decoration: line-through; }
  .hucre { display: flex; align-items: center; gap: 6px; width: 100%; height: 100%; min-height: 48px; padding: 6px 12px; border: 0; background: none; font: inherit; color: var(--yazi); font-weight: 600; font-size: var(--f-sm); text-align: left; cursor: pointer; }
  .hucre:hover { background: var(--vurgu-zemin); }
  .hucre:focus-visible { outline: 2px solid var(--odak); outline-offset: -2px; }
  .hucre .ad { min-width: 0; overflow-wrap: anywhere; }
  .bos-yer { color: var(--hata); font-weight: 600; }
  .elle-kisi .ad, .elle-kisi .ad-kisa, .elle-gun .ad, .elle-gun .ad-kisa, .elle-ornek { text-decoration: underline dotted; text-underline-offset: 3px; }
  .nb { font-size: 10px; font-weight: 700; color: var(--hata); flex: none; }
  .ad-kisa, .kisa-et { display: none; }
  .dagilim { display: grid; gap: 2px; }
  .dagilim h3 { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--yazi-2); margin: 6px 0 2px; }
  .dag { display: grid; grid-template-columns: 175px minmax(0, 1fr) 22px 26px; gap: 8px; align-items: center; font-size: var(--f-sm); padding: 2px 0; }
  .dad { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .dag b { text-align: right; color: var(--lacivert); }
  .yil { text-align: right; color: var(--soluk); font-size: var(--f-xs); }
  .kareler { display: flex; flex-wrap: wrap; gap: 2px; }
  .kare { display: inline-block; width: 14px; height: 11px; }
  .kare.a { background: var(--lacivert); }
  .kare.c { background: var(--haz); }
  .lejant .kare { width: 9px; height: 9px; }
  .lejant { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: var(--f-xs); color: var(--yazi-2); }
  .lejant > span { display: inline-flex; align-items: center; gap: 5px; }
  .alt-duzen { display: grid; grid-template-columns: minmax(280px, 380px) minmax(0, 1fr); gap: var(--b4); margin-top: var(--b4); align-items: start; }
  .ilke { display: grid; gap: var(--b2); font-size: var(--f-sm); color: var(--yazi-2); }
  .baglanti { display: inline-flex; align-items: center; gap: 6px; border: 0; background: none; padding: 0; color: var(--baglanti); font-weight: 600; text-decoration: underline; cursor: pointer; justify-self: start; text-align: left; }
  @media (max-width: 1100px) { .ust-duzen { grid-template-columns: 1fr; } }
  @media (max-width: 960px) { .alt-duzen { grid-template-columns: 1fr; } }
  @media (max-width: 720px) {
    .hafta { padding: 4px 10px; }
    .form th.yer { width: 52px; padding: 6px; font-size: 11px; }
    .uzun { display: none; }
    .kisa-et { display: inline; }
    .form thead th { padding: 6px; font-size: 12px; }
    .form thead th small { display: none; }
    .form td, .hucre { min-height: 40px; height: 40px; }
    .hucre { padding: 4px 6px; font-size: 12px; gap: 2px; }
    .hucre .ad { display: none; }
    .hucre .ad-kisa { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .dag { grid-template-columns: 110px minmax(0, 1fr) 20px 22px; }
  }
  .pdf-hafta { display: inline-flex; gap: var(--b2); align-items: center; }
  .iki { display: grid; grid-template-columns: 1fr 1fr; gap: var(--b3); }
  .alanlar { display: grid; gap: var(--b2); align-content: start; }
  .not { padding: var(--b2) var(--b3); border: 1px solid var(--cizgi-acik); border-radius: var(--r-kucuk); font-size: var(--f-sm); background: var(--yuzey-2); color: var(--yazi-2); }
  .not.hata { background: var(--hata-zemin); color: var(--hata); }
  @media (max-width: 720px) { .iki { grid-template-columns: 1fr; } }
</style>
