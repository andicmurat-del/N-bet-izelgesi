<script lang="ts">
  // Günün servis dağıtımı: o gün çalışan teknikerler (puantajdan) servislere zorluk × hasta sayısına göre dengeli
  // dağıtılır. Kişi dağıtımdan çıkarılabilir, gün yeniden karıştırılabilir, bir servis elle başka teknikere verilebilir.
  // Geçmiş günler kendiliğinden değişmez; değiştirilirse sonraki günler de yeniden dengelenir.
  import { untrack } from "svelte";
  import { depo, tatilMi } from "../../veri/depo.svelte";
  import { servisGunu, servisAtamaAdaylari } from "../../motor/cizelge.js";
  import { servisAyiniGuncelle, servisIslemYap, type ServisIslemi } from "../../veri/servis.svelte";
  import { dosyaKaydet } from "../../disa/indir";
  import { AYLAR, GUN_UZUN, gunSayisi, haftaGunu } from "../../veri/tarih";
  import Ikon from "../ortak/Ikon.svelte";
  import Pencere from "../ortak/Pencere.svelte";

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
  let ay = $state({ cizelgeVar: false, kayitVar: false });
  $effect(() => { ay = servisAyiniGuncelle(y, m); });
  const gun = $derived(ay.cizelgeVar ? (servisGunu($state.snapshot(depo.veri), y, m, secGun) as GunVerisi) : null);

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
  const ata = $derived(ataAcik ? (servisAtamaAdaylari($state.snapshot(depo.veri), y, m, secGun, ataSn) as { kaynak: number; kaynakAd: string; elle: boolean; elleVar: boolean; adaylar: Aday[] } | null) : null);
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
      const c = await import("../../disa/servisCikti");
      const v = ciktiVerisi(), blob = pdfTur === "tek" ? c.servisTekSayfaPdf(v) : pdfTur === "kisi" ? c.servisKisiPdf(v) : c.servisTopluPdf(v);
      const ad = `servis-${pdfTur === "toplu" ? "listesi" : "teknikerler"}-${y}-${String(m + 1).padStart(2, "0")}-${String(secGun).padStart(2, "0")}.pdf`;
      durum = (await dosyaKaydet(ad, blob, "application/pdf")) ? "PDF kaydedildi." : "";
      pdfAcik = false;
    } catch { durum = "PDF oluşturulamadı."; }
    finally { hazirlaniyor = false; }
  }
  async function kopyala() {
    if (!gun?.sonuc) return;
    const { servisMetni } = await import("../../disa/servisCikti");
    const t = servisMetni(ciktiVerisi());
    try { await navigator.clipboard.writeText(t); durum = "Kopyalandı."; }
    catch {
      const a = document.createElement("textarea"); a.value = t; document.body.appendChild(a); a.select();
      try { durum = document.execCommand("copy") ? "Kopyalandı." : "Kopyalanamadı."; } catch { durum = "Kopyalanamadı."; }
      a.remove();
    }
  }

  const ort = $derived(gun?.sonuc ? gun.sonuc.kisi.reduce((t, p) => t + p.total, 0) / Math.max(1, gun.sonuc.kisi.length) : 0);
  const enCok = $derived(gun?.sonuc ? Math.max(1, ...gun.sonuc.kisi.map(p => p.total)) : 1);
  const toplu = $derived(gun?.sonuc ? gun.sonuc.kisi.flatMap(p => p.items.map(i => ({ sn: i.name, ad: p.name }))).sort((a, b) => a.sn.localeCompare(b.sn, "tr")) : []);
</script>

{#if !ay.cizelgeVar}
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
  <div class="gun-secici">
    <button class="dugme sade" onclick={() => (secGun = isGunleri[ix - 1])} disabled={ix <= 0} aria-label="Önceki iş günü"><Ikon ad="sol" /></button>
    <label class="gizli" for="sv-gun">Gün</label>
    <select id="sv-gun" class="girdi" bind:value={secGun}>{#each isGunleri as d}<option value={d}>{d} {AYLAR[m]} {GUN_UZUN[haftaGunu(y, m, d)]}</option>{/each}</select>
    <button class="dugme sade" onclick={() => (secGun = isGunleri[ix + 1])} disabled={ix < 0 || ix >= isGunleri.length - 1} aria-label="Sonraki iş günü"><Ikon ad="sag" /></button>
    <label class="ngun"><span>Çok günlük servisler</span>
      <select class="girdi" onchange={e => yap({ tur: "ngun", gun: secGun, n: Number(e.currentTarget.value) })}>
        {#each Array.from({ length: Math.max(6, gun.oto, gun.n) }, (_, i) => i + 1) as v}<option value={v} selected={v === gun.n}>{v} gün{v === gun.oto ? " (takvime göre)" : ""}</option>{/each}
      </select>
    </label>
  </div>

  {#if gun.bayat}
    <p class="bant dikkat"><Ikon ad="uyari" boyut={16} />Bu geçmiş günün kaydından sonra puantaj ya da servis ayarı değişti; kayıt olduğu gibi duruyor.
      <button class="baglanti" onclick={() => yap({ tur: "yeniden", gun: secGun })}>Bu günden itibaren yeniden dağıt</button></p>
  {/if}

  <section class="kisiler" aria-labelledby="sv-kisiler">
    <h2 id="sv-kisiler" class="kucuk-baslik">O gün çalışan teknikerler</h2>
    <div class="cipler">
      {#each gun.kisiler as k (k.id)}
        <button class="cip" class:acik={k.on} aria-pressed={k.on} onclick={() => yap({ tur: "kisi", gun: secGun, id: k.id })}>
          <span class="kutucuk" aria-hidden="true">{#if k.on}<Ikon ad="tamam" boyut={13} />{/if}</span>{k.name}{#if k.etiket}<small>{k.etiket}</small>{/if}{#if k.elle}<small class="elle">elle</small>{/if}
        </button>
      {/each}
    </div>
    <p class="not">Kişiler puantajdan gelir; izin, rapor ya da nöbet ertesi izni olan kapalıdır. Buradan kapattığınız kişi yalnız servis dağıtımından çıkar.{gun.gecmis ? " Geçmiş gün: değişiklik sonraki günleri de yeniden dağıtır." : ""}</p>
  </section>

  {#if gun.sonuc}
    {@const S = gun.sonuc}
    <div class="arac">
      <div class="dugmeler">
        <button class="dugme" onclick={() => yap({ tur: "karistir", gun: secGun })}><Ikon ad="karisik" />Yeniden karıştır</button>
        {#if elleSayisi}<button class="dugme" onclick={() => yap({ tur: "ataSifirla", gun: secGun })}>Elle atamaları kaldır ({elleSayisi})</button>{/if}
      </div>
      <div class="dugmeler">
        <button class="dugme" onclick={() => (pdfAcik = true)}><Ikon ad="indir" />PDF</button>
        <button class="dugme" onclick={kopyala}>Kopyala</button>
      </div>
    </div>
    {#if durum}<p class="bant tamam" role="status">{durum}</p>{/if}
    <p class="not">Bir servisi başka teknikere vermek için servis adına dokunun. <span aria-hidden="true">✎</span> elle atanan servis; yeniden dağıtımda yeri değişmez. Turuncu çizgili servisler zor servistir.</p>

    <div class="kartlar">
      {#each S.kisi as p (p.id)}
        <section class="kart kisi" aria-label="{p.name}: {p.items.length} servis">
          <header><b>{p.name}</b><span class="rakam">{p.items.length}</span></header>
          <p class="meta">{p.w} servis-gün · {p.yb} YB · {p.zr} zor · yük {p.total}</p>
          <ul>
            {#each p.items as s (s.name)}
              <li><button class="servis" class:zor={s.zor} onclick={() => ataAc(s.name)} aria-label="{s.name}{s.zor ? ', zor servis' : ''}{gun.ata[s.name] === p.id ? ', elle atandı' : ''}: başka teknikere ver">
                <span>{s.name.replace(/\sYB$/, "")}</span>
                {#if ybMi(s.name)}<i class="etiket yb">YB</i>{/if}
                {#if s.multi && S.n > 1}<i class="etiket">×{S.n}</i>{/if}
                {#if gun.ata[s.name] === p.id}<i class="etiket elle">✎</i>{/if}
              </button></li>
            {/each}
          </ul>
        </section>
      {/each}
    </div>

    <details class="kart detay" open>
      <summary>Günlük yük dengesi <span class="not">çizgi: kişi başı ortalama ({Math.round(ort)})</span></summary>
      <div class="cubuklar">
        {#each S.kisi as p (p.id)}
          <div class="cubuk-satir"><span class="ad">{p.name}</span><span class="iz"><i style="width:{(p.total / enCok) * 92}%"></i><u style="left:{(ort / enCok) * 92}%"></u></span><span class="rakam">{p.total}</span></div>
        {/each}
      </div>
    </details>
    <details class="kart detay">
      <summary>Toplu servis listesi <span class="not">{S.kisi.length} kişi, {S.svcs.length} servis</span></summary>
      <ul class="toplu">{#each toplu as t}<li><span>{t.sn}</span><b>{t.ad}</b></li>{/each}</ul>
    </details>
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
    <label><input type="radio" name="pdf-tur" value="toplu" bind:group={pdfTur} /><span><b>Servis → hazırlayan listesi</b><small>Servisler alfabetik; A4 yatay</small></span></label>
  </fieldset>
  {#snippet altlik()}<span style="flex:1"></span><button class="dugme" onclick={() => (pdfAcik = false)}>Vazgeç</button><button class="dugme ana" onclick={pdf} disabled={hazirlaniyor}><Ikon ad="indir" />{hazirlaniyor ? "Hazırlanıyor…" : "PDF oluştur"}</button>{/snippet}
</Pencere>

<style>
  .bos { padding: var(--b5); display: grid; gap: var(--b3); max-width: 760px; }
  .bos p { color: var(--yazi-2); }
  .gizli { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .gun-secici { display: flex; flex-wrap: wrap; align-items: center; gap: var(--b2); margin-bottom: var(--b4); }
  .gun-secici > select { width: auto; min-width: 230px; font-weight: 600; }
  .ngun { display: inline-flex; align-items: center; gap: var(--b2); margin-left: auto; font-size: var(--f-sm); color: var(--yazi-2); }
  .ngun select { width: auto; }
  .bant { display: flex; align-items: center; flex-wrap: wrap; gap: var(--b2); padding: var(--b2) var(--b4); border-radius: var(--r); margin-bottom: var(--b3); font-size: var(--f-sm); font-weight: 500; }
  .bant.dikkat { background: var(--dikkat-zemin); color: var(--dikkat); }
  .bant.bilgi { background: var(--bilgi-zemin); color: var(--bilgi); }
  .bant.tamam { background: var(--vurgu-zemin); color: var(--vurgu); }
  .baglanti { border: 0; background: none; padding: 0; color: inherit; text-decoration: underline; cursor: pointer; font-weight: 600; }
  .kucuk-baslik { font-size: var(--f-sm); font-weight: 600; color: var(--yazi-2); margin-bottom: var(--b2); }
  .kisiler { margin-bottom: var(--b4); }
  .cipler { display: flex; flex-wrap: wrap; gap: 6px; }
  .cip { display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 0 var(--b3) 0 var(--b2); border: 1px solid var(--cizgi); border-radius: 999px; background: var(--yuzey); color: var(--yazi-2); font-weight: 500; cursor: pointer; }
  .cip.acik { border-color: var(--tek); background: var(--tek-zemin); color: var(--yazi); }
  .cip small { font-size: var(--f-xs); color: var(--soluk); }
  .cip small.elle { color: var(--dikkat); font-weight: 600; }
  .kutucuk { display: inline-grid; place-items: center; width: 18px; height: 18px; border-radius: 5px; border: 1.5px solid var(--soluk); color: var(--yuzey); }
  .cip.acik .kutucuk { background: var(--tek); border-color: var(--tek); }
  .not { font-size: var(--f-xs); color: var(--soluk); margin-top: var(--b2); }
  .arac { display: flex; flex-wrap: wrap; justify-content: space-between; gap: var(--b2); margin-bottom: var(--b2); }
  .dugmeler { display: flex; flex-wrap: wrap; gap: var(--b2); }
  .kartlar { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: var(--b3); margin: var(--b3) 0 var(--b4); }
  .kisi { padding: var(--b3); display: grid; gap: var(--b2); align-content: start; }
  .kisi header { display: flex; justify-content: space-between; align-items: baseline; gap: var(--b2); }
  .kisi header span { font-size: var(--f-lg); font-weight: 600; color: var(--tek); }
  .meta { font-size: var(--f-xs); color: var(--soluk); }
  ul { list-style: none; margin: 0; padding: 0; }
  .kisi ul { display: grid; gap: 3px; }
  .servis { display: flex; align-items: center; gap: 6px; width: 100%; min-height: 30px; padding: 3px 8px; border: 1px solid transparent; border-radius: 6px; background: var(--yuzey-2); color: var(--yazi); font-size: var(--f-sm); font-weight: 500; text-align: left; cursor: pointer; }
  .servis:hover { border-color: var(--soluk); }
  .servis > span { flex: 1; min-width: 0; overflow-wrap: anywhere; }
  .servis.zor { box-shadow: inset 3px 0 0 var(--haz); }
  .etiket { font-style: normal; font-size: var(--f-xs); font-weight: 700; color: var(--yazi-2); flex: none; }
  .etiket.yb { color: var(--bilgi); }
  .etiket.elle { color: var(--dikkat); }
  .detay { padding: var(--b3) var(--b4); margin-bottom: var(--b3); }
  summary { cursor: pointer; font-weight: 600; }
  summary .not { margin: 0 0 0 var(--b2); font-weight: 400; }
  .cubuklar { display: grid; gap: 6px; margin-top: var(--b3); }
  .cubuk-satir { display: grid; grid-template-columns: minmax(100px, 170px) minmax(0, 1fr) 48px; align-items: center; gap: var(--b3); font-size: var(--f-sm); }
  .cubuk-satir .ad { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cubuk-satir .rakam { text-align: right; }
  .iz { position: relative; height: 12px; background: var(--yuzey-2); border-radius: 6px; }
  .iz i { position: absolute; inset: 0 auto 0 0; background: var(--tek); border-radius: 6px; }
  .iz u { position: absolute; top: -3px; bottom: -3px; width: 2px; background: var(--yazi); }
  .toplu { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 2px var(--b4); margin-top: var(--b3); font-size: var(--f-sm); }
  .toplu li { display: flex; justify-content: space-between; gap: var(--b3); padding: 4px 0; border-bottom: 1px solid var(--cizgi-acik); }
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
  @media (max-width: 720px) {
    .gun-secici > select { flex: 1; min-width: 0; }
    .ngun { margin-left: 0; width: 100%; justify-content: space-between; }
  }
</style>
