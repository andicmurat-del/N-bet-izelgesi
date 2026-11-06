<script lang="ts">
  import { ciktiPaketi } from "../../disa/yukle";
  // Günün servis dağıtımı: o gün çalışan teknikerler (puantajdan) servislere zorluk × hasta sayısına göre dengeli
  // dağıtılır. Kişi dağıtımdan çıkarılabilir, gün yeniden karıştırılabilir, bir servis elle başka teknikere verilebilir.
  // Geçmiş günler kendiliğinden değişmez; değiştirilirse sonraki günler de yeniden dengelenir.
  import { untrack } from "svelte";
  import { depo, veriAnlik, tatilMi } from "../../veri/depo.svelte";
  import { servisGunu, servisAtamaAdaylari } from "../../motor";
  import { servisAyiniGuncelle, servisAyiOnbellekte, servisIslemYap, type ServisIslemi } from "../../veri/servis.svelte";
  import { dosyaKaydet, hataMetni } from "../../disa/indir";
  import { AYLAR, GUN_UZUN, gunSayisi, haftaGunu } from "../../veri/tarih";
  import Ikon from "../ortak/Ikon.svelte";
  import Pencere from "../ortak/Pencere.svelte";
  import IslemAlani from "../ortak/IslemAlani.svelte";

  let { git }: { git: (ad: "cizelge" | "kisiler") => void } = $props();

  type Kalem = { name: string; multi: boolean; l: number; zor: boolean };
  type GunVerisi = {
    tatil: boolean; gecmis: boolean; teknikerVar: boolean; oto: number; n: number; bayat: boolean;
    kisiler: { id: number; name: string; on: boolean; oto: boolean; elle: boolean; etiket: string }[];
    ata: Record<string, number>;
    sonuc: { kisi: { id: number; name: string; items: Kalem[]; total: number; w: number; yb: number; zr: number }[]; svcs: Kalem[]; n: number } | null;
  };
  type Aday = { id: number; ad: string; karsilik: string | null; uyari: string[]; servis: number; yb: number; yuk: number };

  const y = $derived(depo.yil), m = $derived(depo.ay);
  const isGunleri = $derived(Array.from({ length: gunSayisi(y, m) }, (_, i) => i + 1).filter(d => !tatilMi(y, m, d)));
  const bugun = new Date();
  const gecmisAy = $derived(new Date(y, m + 1, 0) < new Date(bugun.getFullYear(), bugun.getMonth(), bugun.getDate()));
  const varsayilan = () => { const l = isGunleri; const b = bugun.getFullYear() === y && bugun.getMonth() === m ? l.find(d => d >= bugun.getDate()) : undefined; return b ?? l[0] ?? 1; };
  let secGun = $state(1);
  $effect(() => { y; m; untrack(() => { secGun = varsayilan(); }); });

  // ay açıkken her veri değişikliğinde (puantaj, kişi, ayar) dağıtım güncellenir; geçmiş günler korunur
  // Ayın dağıtımı telefonda yarım saniyeyi geçebilir: sekme önce açılır, hesap ekran çizildikten sonra yapılır
  // (önbellekte varsa hemen gelir).
  let ay = $state<{ cizelgeVar: boolean; kayitVar: boolean } | null>(null);
  $effect(() => {
    const yy = y, mm = m;
    veriAnlik();   // veri değişince yeniden
    const hazir = servisAyiOnbellekte(yy, mm);
    if (hazir) { ay = hazir; return; }
    ay = null;
    let t: ReturnType<typeof setTimeout> | undefined;
    const r = requestAnimationFrame(() => { t = setTimeout(() => { ay = servisAyiniGuncelle(yy, mm); }, 0); });
    return () => { cancelAnimationFrame(r); clearTimeout(t); };
  });
  const gun = $derived(ay?.cizelgeVar ? (servisGunu(veriAnlik(), y, m, secGun) as GunVerisi) : null);

  const ix = $derived(isGunleri.indexOf(secGun));
  const gunAdi = (d: number) => `${d} ${AYLAR[m]} ${y} ${GUN_UZUN[haftaGunu(y, m, d)]}`;
  const ybMi = (sn: string) => /\sYB$/.test(sn);

  // geçmiş günde değişiklik onay ister (sonraki günler de yeniden dağıtılır)
  let bekleyen = $state<ServisIslemi | null>(null), onayAcik = $state(false);
  function yap(islem: ServisIslemi) {
    if (gun?.gecmis) { bekleyen = islem; onayAcik = true; return; }
    servisIslemYap(y, m, islem);
  }
  function onayla() { if (bekleyen) servisIslemYap(y, m, bekleyen); bekleyen = null; onayAcik = false; }

  // servisi elle başka teknikere verme
  let ataAcik = $state(false), ataSn = $state(""), ataUyarili = $state<number | null>(null);
  const ata = $derived(ataAcik ? (servisAtamaAdaylari(veriAnlik(), y, m, secGun, ataSn) as { kaynak: number; kaynakAd: string; elle: boolean; elleVar: boolean; adaylar: Aday[] } | null) : null);
  function ataAc(sn: string) { ataSn = sn; ataUyarili = null; ataAcik = true; }
  function ataSec(a: Aday) {
    if (a.uyari.length && ataUyarili !== a.id) { ataUyarili = a.id; return; }
    const kaynak = ata?.kaynakAd;
    servisIslemYap(y, m, { tur: "ata", gun: secGun, sn: ataSn, hedef: a.id, karsilik: a.karsilik });
    durum = `${ataSn} → ${a.ad}${a.karsilik ? `; karşılığında ${a.karsilik} → ${kaynak}` : ""}. Sonraki günler buna göre dengelendi.`;
    ataAcik = false;
  }
  function ataOto() { servisIslemYap(y, m, { tur: "oto", gun: secGun, sn: ataSn }); durum = `${ataSn} otomatik dağıtıma döndü.`; ataAcik = false; }
  const elleSayisi = $derived(gun?.sonuc ? Object.keys(gun.ata).filter(sn => gun.sonuc!.kisi.some(p => p.id === gun.ata[sn] && p.items.some(i => i.name === sn))).length : 0);

  // çıktılar
  let durum = $state("");
  $effect(() => { secGun; y; m; durum = ""; });
  let pdfAcik = $state(false), pdfTur = $state<"tek" | "kisi" | "toplu">("tek"), hazirlaniyor = $state(false);
  const ciktiVerisi = () => ({ kurum: depo.veri.kurum.ad, tarih: gunAdi(secGun), n: gun!.sonuc!.n, kisiler: gun!.sonuc!.kisi.map(p => ({ ad: p.name, yb: p.yb, items: p.items })) });
  async function pdf() {
    if (!gun?.sonuc) return;
    hazirlaniyor = true;
    try {
      const c = await ciktiPaketi();
      const v = ciktiVerisi(), blob = pdfTur === "tek" ? c.servisTekSayfaPdf(v) : pdfTur === "kisi" ? c.servisKisiPdf(v) : c.servisTopluPdf(v);
      const ad = `servis-${pdfTur === "toplu" ? "listesi" : "teknikerler"}-${y}-${String(m + 1).padStart(2, "0")}-${String(secGun).padStart(2, "0")}.pdf`;
      durum = (await dosyaKaydet(ad, blob, "application/pdf")) ? "PDF kaydedildi." : "";
      pdfAcik = false;
    } catch (e) { durum = hataMetni(e, "PDF oluşturulamadı."); }
    finally { hazirlaniyor = false; }
  }
  async function kopyala() {
    if (!gun?.sonuc) return;
    let t: string;
    try { t = (await ciktiPaketi()).servisMetni(ciktiVerisi()); }
    catch (e) { durum = hataMetni(e, "Kopyalanamadı."); return; }
    try { await navigator.clipboard.writeText(t); durum = "Kopyalandı."; }
    catch {
      const a = document.createElement("textarea"); a.value = t; document.body.appendChild(a); a.select();
      try { durum = document.execCommand("copy") ? "Kopyalandı." : "Kopyalanamadı."; } catch (e) { durum = hataMetni(e, "Kopyalanamadı."); }
      a.remove();
    }
  }

  const ort = $derived(gun?.sonuc ? gun.sonuc.kisi.reduce((t, p) => t + p.total, 0) / Math.max(1, gun.sonuc.kisi.length) : 0);
  const enCok = $derived(gun?.sonuc ? Math.max(1, ...gun.sonuc.kisi.map(p => p.total)) : 1);
</script>

{#if !ay}
  <section class="kart bos" role="status" aria-live="polite"><p>Servis dağıtımı hazırlanıyor…</p></section>
{:else if !ay.cizelgeVar}
  <section class="kart bos">
    <h2>{AYLAR[m]} {y} için nöbet çizelgesi yok</h2>
    <p>Servis dağıtımı nöbet çizelgesi oluşturulan aylar için yapılır; kimin o gün çalıştığı puantajdan gelir.</p>
    <div><button class="dugme ana" onclick={() => git("cizelge")}><Ikon ad="takvim" />Çizelgeye git</button></div>
  </section>
{:else if gecmisAy && !ay.kayitVar}
  <section class="kart bos">
    <h2>{AYLAR[m]} {y} için servis kaydı yok</h2>
    <p>Bu ay geçmişte kaldı ve o dönemde servis dağıtımı kaydedilmemiş. İsterseniz o ayın puantajına göre bir dağıtım oluşturup kayda geçirebilirsiniz.</p>
    <div><button class="dugme ana" onclick={() => servisIslemYap(y, m, { tur: "olustur" })}><Ikon ad="yenile" />Dağıtım oluştur</button></div>
  </section>
{:else if gun && !gun.teknikerVar && !gun.sonuc}
  <section class="kart bos">
    <h2>Bu ay çalışan tekniker yok</h2>
    <p>Servisler eczane teknikerlerine dağıtılır. Personel bölümünde görevi "Tekniker" olan kişileri ekleyin.</p>
    <div><button class="dugme ana" onclick={() => git("kisiler")}><Ikon ad="kisiler" />Personel ekle</button></div>
  </section>
{:else if gun}
  {@const calisan = gun.kisiler.filter(k => k.on).length}
  <section class="panel">
    <div class="panel-bas"><h2>Dağıtım bilgileri</h2><span class="ozet-bilgi rakam">Çalışan tekniker {calisan}/{gun.kisiler.length}{#if gun.sonuc}{" · "}Ortalama yük {Math.round(ort)}{/if}</span></div>
    <div class="panel-ic gun-secici">
      <label class="alan"><span>Dağıtım günü</span>
        <span class="gun-satir">
          <button class="dugme" onclick={() => (secGun = isGunleri[ix - 1])} disabled={ix <= 0} aria-label="Önceki iş günü"><Ikon ad="sol" />Önceki gün</button>
          <select id="sv-gun" class="girdi" bind:value={secGun}>{#each isGunleri as d}<option value={d}>{d} {AYLAR[m]} {GUN_UZUN[haftaGunu(y, m, d)]}</option>{/each}</select>
          <button class="dugme" onclick={() => (secGun = isGunleri[ix + 1])} disabled={ix < 0 || ix >= isGunleri.length - 1} aria-label="Sonraki iş günü">Sonraki gün<Ikon ad="sag" /></button>
        </span>
      </label>
      <label class="alan ngun"><span>Çok günlük servisler</span>
        <select class="girdi" onchange={e => yap({ tur: "ngun", gun: secGun, n: Number(e.currentTarget.value) })}>
          {#each Array.from({ length: Math.max(6, gun.oto, gun.n) }, (_, i) => i + 1) as v}<option value={v} selected={v === gun.n}>{v} gün{v === gun.oto ? " (takvime göre)" : ""}</option>{/each}
        </select>
      </label>
    </div>
  </section>

  {#if gun.bayat}
    <p class="bant dikkat"><Ikon ad="uyari" boyut={16} />Bu geçmiş günün kaydından sonra puantaj ya da servis ayarı değişti; kayıt olduğu gibi duruyor.
      <button class="baglanti" onclick={() => yap({ tur: "yeniden", gun: secGun })}>Bu günden itibaren yeniden dağıt</button></p>
  {/if}

  <section class="panel" aria-labelledby="sv-kisiler">
    <div class="panel-bas"><h2 id="sv-kisiler">O gün çalışan teknikerler</h2></div>
    <div class="panel-ic">
      <div class="cipler">
        {#each gun.kisiler as k (k.id)}
          <label class="cip" class:acik={k.on}>
            <input type="checkbox" checked={k.on} onchange={() => yap({ tur: "kisi", gun: secGun, id: k.id })} />
            <span>{k.name}{#if k.etiket}{" "}<small>({k.etiket})</small>{/if}{#if k.elle}{" "}<small class="elle">(elle)</small>{/if}</span>
          </label>
        {/each}
      </div>
      <p class="not">Kişiler puantajdan gelir; izin, rapor ya da nöbet ertesi izni olan kapalıdır. Buradan kapattığınız kişi yalnız servis dağıtımından çıkar.{gun.gecmis ? " Geçmiş gün: değişiklik sonraki günleri de yeniden dağıtır." : ""}</p>
    </div>
  </section>

  {#if gun.sonuc}
    {@const S = gun.sonuc}
    <IslemAlani>
      <button class="dugme" onclick={() => yap({ tur: "karistir", gun: secGun })}><Ikon ad="karisik" />Yeniden karıştır</button>
      {#if elleSayisi}<button class="dugme" onclick={() => yap({ tur: "ataSifirla", gun: secGun })}>Elle atamaları kaldır ({elleSayisi})</button>{/if}
      <button class="dugme" onclick={() => (pdfAcik = true)}><Ikon ad="indir" />PDF</button>
      <button class="dugme" onclick={kopyala}>Kopyala</button>
    </IslemAlani>
    {#if durum}<p class="bant tamam" role="status">{durum}</p>{/if}

    <section class="panel">
      <div class="panel-bas"><h2>Servis dağıtımı · {gunAdi(secGun)}</h2>
        <p class="lejant"><span><i class="etk yb">YB</i>Yoğun bakım</span><span><i class="etk zor">ZOR</i>Zor servis</span><span><i class="etk elle">✎</i>Elle atandı</span><span><u class="ort-ornek"></u>Ortalama</span></p></div>
      <div class="tablo-kap">
        <table class="tablo dagitim">
          <thead><tr><th class="sag">Sıra</th><th>Tekniker</th><th>Servisler <span class="ince">(başka teknikere vermek için servise dokunun)</span></th><th class="sag">Servis</th><th class="sag">YB</th><th class="sag">Zor</th><th class="sag">Yük</th><th>Yük dengesi</th></tr></thead>
          <tbody>
            {#each S.kisi as p, i (p.id)}
              <tr>
                <td class="sag">{i + 1}</td>
                <td class="ad-hucre">{p.name}</td>
                <td class="servisler">
                  {#each p.items as s (s.name)}
                    <button class="servis" class:zor={s.zor} onclick={() => ataAc(s.name)} aria-label="{s.name}{s.zor ? ', zor servis' : ''}{gun.ata[s.name] === p.id ? ', elle atandı' : ''}: başka teknikere ver">
                      <span>{s.name.replace(/\sYB$/, "")}</span>
                      {#if ybMi(s.name)}<i class="etk yb">YB</i>{/if}
                      {#if s.zor}<i class="etk zor">ZOR</i>{/if}
                      {#if s.multi && S.n > 1}<i class="etk">×{S.n}</i>{/if}
                      {#if gun.ata[s.name] === p.id}<i class="etk elle">✎</i>{/if}
                    </button>
                  {/each}
                </td>
                <td class="sag">{p.items.length}</td>
                <td class="sag">{p.yb}</td>
                <td class="sag">{p.zr}</td>
                <td class="sag yuk">{p.total}</td>
                <td class="denge"><span class="iz" title="Ortalama {Math.round(ort)}"><i style="width:{(p.total / enCok) * 92}%"></i><u style="left:{(ort / enCok) * 92}%"></u></span></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <p class="not dip">Servis-gün: {S.kisi.reduce((t, p) => t + p.w, 0)} · çok günlük servisler {S.n} gün için hazırlanır. Kırmızı çizgi kişi başı ortalama yükü ({Math.round(ort)}) gösterir.</p>
    </section>
  {:else}
    <p class="bant bilgi">Bu gün için dağıtım yok: seçili tekniker ya da hazırlanan servis yok.</p>
  {/if}
{/if}

<Pencere bind:acik={onayAcik} baslik="Geçmiş gün">
  <p>{gunAdi(secGun)} geçmiş bir gün. Bu gün ve sonraki günlerin servis dağıtımı yeniden yapılacak, kayıt değişecek. Devam edilsin mi?</p>
  {#snippet altlik()}<span style="flex:1"></span><button class="dugme" onclick={() => { bekleyen = null; onayAcik = false; }}>Vazgeç</button><button class="dugme ana" onclick={onayla}>Devam et</button>{/snippet}
</Pencere>

<Pencere bind:acik={ataAcik} baslik={ataSn || "Servis"} altBaslik="{gunAdi(secGun)} · şu an {ata?.kaynakAd ?? ''}{ata?.elle ? ' (elle atandı)' : ''}">
  {#if ata}
    <p class="not">Kime verilsin? Kişi başı servis ve YB sayısı eşit kalsın diye gerekirse karşılığında bir servis geri verilir.{gun?.gecmis ? " Geçmiş gün: sonraki günler de yeniden dengelenir." : ""}</p>
    <div class="adaylar">
      {#each ata.adaylar as a (a.id)}
        <button class="aday" class:uyarili={a.uyari.length} class:secili={ataUyarili === a.id} onclick={() => ataSec(a)}>
          <span class="ad"><b>{a.ad}</b><small>{a.servis} servis · {a.yb} YB · yük {a.yuk}</small></span>
          <span class="karsilik">{#if a.karsilik}Karşılığında <b>{a.karsilik}</b> → {ata.kaynakAd}{:else}Doğrudan geçer{/if}</span>
          {#if a.uyari.length}<span class="uyari"><Ikon ad="uyari" boyut={14} />{a.uyari.join(" ")}{ataUyarili === a.id ? " Yine de vermek için tekrar dokunun." : ""}</span>{/if}
        </button>
      {/each}
    </div>
  {/if}
  {#snippet altlik()}
    {#if ata?.elleVar}<button class="dugme sade" onclick={ataOto}>Otomatiğe döndür</button>{/if}
    <span style="flex:1"></span><button class="dugme" onclick={() => (ataAcik = false)}>Vazgeç</button>
  {/snippet}
</Pencere>

<Pencere bind:acik={pdfAcik} baslik="Servis listesi PDF" altBaslik={gunAdi(secGun)}>
  <fieldset class="secenekler">
    <legend class="gizli">Liste türü</legend>
    <label><input type="radio" name="pdf-tur" value="tek" bind:group={pdfTur} /><span><b>Tüm teknikerler tek sayfada</b><small>Panoya asmak için; A4 yatay</small></span></label>
    <label><input type="radio" name="pdf-tur" value="kisi" bind:group={pdfTur} /><span><b>Her teknikere ayrı sayfa</b><small>Hazırlandı işaret kutusuyla; A4 dikey</small></span></label>
    <label><input type="radio" name="pdf-tur" value="toplu" bind:group={pdfTur} /><span><b>Servis → hazırlayan listesi</b><small>Servisler alfabetik; A4 dikey</small></span></label>
  </fieldset>
  {#snippet altlik()}<span style="flex:1"></span><button class="dugme" onclick={() => (pdfAcik = false)}>Vazgeç</button><button class="dugme ana" onclick={pdf} disabled={hazirlaniyor}><Ikon ad="indir" />{hazirlaniyor ? "Hazırlanıyor…" : "PDF oluştur"}</button>{/snippet}
</Pencere>

<style>
  .bos { padding: var(--b5); display: grid; gap: var(--b3); max-width: 760px; }
  .bos h2 { font-size: var(--f-lg); }
  .bos p { color: var(--yazi-2); }
  .gizli { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .panel + .panel, .panel + .bant, .bant + .panel { margin-top: var(--b3); }
  .ozet-bilgi { font-size: var(--f-sm); font-weight: 700; color: var(--lacivert); }
  .gun-secici { display: flex; flex-wrap: wrap; align-items: flex-end; gap: var(--b3) var(--b5); }
  .gun-satir { display: flex; gap: var(--b2); align-items: center; flex-wrap: wrap; }
  .gun-satir select { width: auto; min-width: 230px; font-weight: 600; }
  .ngun select { width: auto; }
  .bant { display: flex; align-items: center; flex-wrap: wrap; gap: var(--b2); padding: var(--b2) var(--b4); border: 1px solid var(--cizgi); border-radius: var(--r); margin-top: var(--b3); font-size: var(--f-sm); font-weight: 600; }
  .bant.dikkat { background: var(--dikkat-zemin); color: var(--dikkat); }
  .bant.bilgi { background: var(--bilgi-zemin); color: var(--bilgi); }
  .bant.tamam { background: var(--vurgu-zemin); color: var(--vurgu); }
  .baglanti { border: 0; background: none; padding: 0; color: var(--baglanti); text-decoration: underline; cursor: pointer; font-weight: 600; }
  .cipler { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 4px var(--b3); }
  .cip { display: flex; align-items: center; gap: 8px; min-height: 32px; padding: 2px 6px; border: 1px solid transparent; border-radius: var(--r-kucuk); color: var(--yazi-2); font-size: var(--f-sm); cursor: pointer; min-width: 0; }
  .cip:hover { background: var(--yuzey-2); border-color: var(--cizgi-acik); }
  .cip.acik { color: var(--yazi); font-weight: 600; }
  .cip input { width: 16px; height: 16px; accent-color: var(--lacivert); flex: none; }
  .cip small { font-size: var(--f-xs); color: var(--soluk); font-weight: 400; }
  .cip small.elle { color: var(--dikkat); font-weight: 600; }
  .not { font-size: var(--f-xs); color: var(--yazi-2); margin-top: var(--b2); }
  .not.dip { margin: 0; padding: var(--b2) var(--b4); border-top: 1px solid var(--cizgi-acik); }
  .lejant { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: var(--f-xs); color: var(--yazi-2); }
  .lejant > span { display: inline-flex; align-items: center; gap: 5px; }
  .ince { font-weight: 400; color: var(--yazi-2); letter-spacing: 0; }
  .dagitim td { vertical-align: top; }
  .ad-hucre { font-weight: 700; white-space: nowrap; color: var(--lacivert); }
  .servisler { display: flex; flex-wrap: wrap; gap: 4px; min-width: 320px; }
  .dagitim td.servisler { display: table-cell; }
  .servis { display: inline-flex; align-items: center; gap: 4px; min-height: 26px; padding: 1px 6px; margin: 0 4px 4px 0; border: 1px solid var(--cizgi); border-radius: var(--r-kucuk); background: var(--yuzey); color: var(--yazi); font-size: var(--f-xs); font-weight: 600; text-align: left; cursor: pointer; }
  .servis:hover { border-color: var(--lacivert); background: var(--vurgu-zemin); }
  .etk { font-style: normal; font-size: 10px; font-weight: 700; padding: 0 3px; border-radius: 2px; color: var(--yazi-2); flex: none; }
  .etk.yb { background: var(--tek-zemin); color: var(--tek); }
  .etk.zor { background: var(--haz-zemin); color: var(--haz); }
  .etk.elle { color: var(--dikkat); }
  .yuk { font-weight: 700; color: var(--lacivert); }
  .denge { min-width: 160px; }
  .iz { position: relative; display: block; height: 12px; margin-top: 4px; background: var(--yuzey-2); border: 1px solid var(--cizgi-acik); }
  .iz i { position: absolute; inset: 0 auto 0 0; background: var(--nobet-hucre); }
  .iz u, .ort-ornek { position: absolute; top: -4px; bottom: -4px; width: 2px; background: var(--hata); }
  .ort-ornek { position: static; display: inline-block; height: 12px; }
  .adaylar { display: grid; gap: 6px; }
  .aday { display: grid; gap: 2px; text-align: left; padding: var(--b2) var(--b3); border: 1px solid var(--cizgi); border-radius: var(--r-kucuk); background: var(--yuzey); color: var(--yazi); cursor: pointer; }
  .aday:hover { border-color: var(--vurgu); }
  .aday.uyarili { border-left: 3px solid var(--dikkat); }
  .aday.secili { box-shadow: inset 0 0 0 1px var(--dikkat); background: var(--dikkat-zemin); }
  .aday .ad { display: flex; justify-content: space-between; gap: var(--b2); flex-wrap: wrap; }
  .aday small, .aday .karsilik { font-size: var(--f-xs); color: var(--yazi-2); }
  .aday .uyari { display: flex; gap: 6px; align-items: flex-start; font-size: var(--f-xs); color: var(--yazi); }
  .aday .uyari :global(svg) { color: var(--dikkat); flex: none; margin-top: 1px; }
  .secenekler { border: 0; margin: 0; padding: 0; display: grid; gap: 6px; }
  .secenekler label { display: flex; gap: var(--b3); align-items: center; padding: var(--b2) var(--b3); border: 1px solid var(--cizgi); border-radius: var(--r-kucuk); cursor: pointer; }
  .secenekler input { accent-color: var(--vurgu); width: 18px; height: 18px; }
  .secenekler span { display: grid; }
  .secenekler small { font-size: var(--f-xs); color: var(--soluk); }
  @media (max-width: 1100px) { .cipler { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (max-width: 720px) {
    .gun-satir select { flex: 1; min-width: 0; }
    .cipler { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
</style>
