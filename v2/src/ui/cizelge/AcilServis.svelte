<script lang="ts">
  import IslemAlani from "../ortak/IslemAlani.svelte";
  import Bilgi from "../ortak/Bilgi.svelte";
  // Acil eczane nöbet listesi: günde 2 kişi; acil servis personeli ve "acilde nöbet tutar" işaretli eczacılar (kemoterapi dahil) arasından
  // otomatik oluşturulur (eczane çizelgesiyle çakışmadan), günler elle de düzenlenebilir (elle günler korunur).
  // Puantajda bu günler nöbet (24 saat) sayılır; ertesi gün mesai günüyse nöbet izni (Nİ), tatilse çalışılmadı (B) yazılır.
  import { depo, veriAnlik, aydaCalisanlar, acilGunu, acilGunuAyarla, acilAyiniSil, acilKaydet, acilElleMi, resmiTatilMi, tatilMi, listeOnayi, listeyiOnayla, listeOnayiniKaldir } from "../../veri/depo.svelte";
  import { acilAdaylariHesapla, acilDenetle, acilHesapla, acilKadrosunda, acilSorunluGunler, puantajHesapla } from "../../motor";
  import { dosyaKaydet, hataMetni } from "../../disa/indir";
  import { AYLAR as AYLAR_AD, GUN_KISA, GUN_UZUN, gunMetni, gunSayisi, haftaGunu, ayAdi, kisaAd } from "../../veri/tarih";
  import Ikon from "../ortak/Ikon.svelte";
  import Pencere from "../ortak/Pencere.svelte";
  import AylikOzet from "../ortak/AylikOzet.svelte";

  let { git }: { git: (ad: "kisiler") => void } = $props();

  const y = $derived(depo.yil), m = $derived(depo.ay);
  const adaylar = $derived(aydaCalisanlar(y, m).filter(k => acilKadrosunda(k)).sort((a, b) => a.name.localeCompare(b.name, "tr")));
  let uyarilar = $state<string[]>([]);
  // onaylı ay: liste kilitli (yeniden oluşturma, silme, elle değiştirme yok); yalnız sonradan izin / rapor alan kişinin
  // yerine başkası yazılabilir
  const onay = $derived(listeOnayi("acil", y, m));
  const onayMetni = $derived(onay ? new Date(onay.zaman).toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" }) + (onay.kim ? " · " + onay.kim : "") : "");
  $effect(() => { y; m; uyarilar = []; });
  function olustur() {
    const r = acilHesapla(veriAnlik(), y, m) as { gunler: { gun: number; ids: number[] }[]; uyarilar: string[] };
    acilKaydet(y, m, r.gunler);
    uyarilar = r.uyarilar;
  }
  const gunler = $derived(Array.from({ length: gunSayisi(y, m) }, (_, i) => i + 1));
  const ad = (id: number) => depo.veri.staff.find(k => k.id === id)?.name ?? "(silinmiş kişi)";
  const kisa = (id: number) => kisaAd(ad(id), depo.veri.staff.map(k => k.name));
  const dolu = $derived(gunler.filter(g => acilGunu(y, m, g).length).length);
  const ozet = $derived.by(() => {
    const o = new Map<number, number[]>();
    for (const g of gunler) for (const id of acilGunu(y, m, g)) o.set(id, [...(o.get(id) ?? []), g]);
    return [...o.entries()].map(([id, l]) => ({ id, ad: ad(id), gunler: l, tatil: l.filter(g => tatilMi(y, m, g)).length })).sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
  });
  // kayıtlı nöbetçisi sonradan yazılamaz hâle gelen günler (izin / rapor girildi, eş durumu yok, dönem dışı)
  const sorunluGunler = $derived(dolu ? acilSorunluGunler(veriAnlik(), y, m).map(x => ({ gun: x.gun, adlar: x.ids.map(ad) })) : []);
  const sorunluMu = (g: number) => sorunluGunler.some(x => x.gun === g);
  // kişi başı aylık özet (puantajdaki gibi; acil kadrosu, hazırlama yok)
  const ozetSatirlari = $derived(dolu ? (puantajHesapla(veriAnlik(), y, m) as { satirlar: { s: { id: number; role: string; acilTutar?: true } }[] }).satirlar.filter(r => acilKadrosunda(r.s)) as never : []);
  const bugun = new Date();
  const bugunMu = (d: number) => bugun.getFullYear() === y && bugun.getMonth() === m && bugun.getDate() === d;

  // gün penceresi
  let acik = $state(false), gun = $state(1), s1 = $state(""), s2 = $state("");
  function gunAc(g: number) { const l = acilGunu(y, m, g); gun = g; s1 = String(l[0] ?? ""); s2 = String(l[1] ?? ""); acik = true; }
  const secim = $derived([s1, s2].filter(Boolean).map(Number));
  const ayni = $derived(!!s1 && s1 === s2);
  const denetim = $derived(acik ? (acilDenetle(veriAnlik(), y, m, gun, secim) as { sev: "hata" | "uyari"; t: string }[]).filter(x => x.sev !== "hata") : []);
  // seçenekler: o gün çalışma dönemi içinde olan acil kadrosu
  const gunAday = $derived(adaylar.filter(k => { const t = `${y}-${String(m + 1).padStart(2, "0")}-${String(gun).padStart(2, "0")}`; return !(k.baslangic && t < k.baslangic) && !(k.bitis && t > k.bitis); }));
  function kaydet() { if (ayni || onay) return; acilGunuAyarla(y, m, gun, secim); acik = false; }
  function temizle() { if (onay) return; acilGunuAyarla(y, m, gun, []); acik = false; }
  // yerine yazılabilecekler: günün kayıtlı nöbetçilerinden o gün yazılamayan (sonradan izin / rapor) varsa onun yerine,
  // yoksa boş yer için; uygunluğa ve yıl içindeki acil nöbet sayısına göre sıralı
  const kayitli = $derived(acik ? acilGunu(y, m, gun) : []);
  const oneri = $derived(acik ? acilAdaylariHesapla(veriAnlik(), y, m, gun, kayitli, null) as { sorunlu: number[]; adaylar: { id: number; ad: string; engel: boolean; uyarilar: string[]; yil: number }[] } : { sorunlu: [], adaylar: [] });
  const bosYer = $derived(kayitli.length < 2);
  const yerineBakilan = $derived(oneri.sorunlu[0] ?? null);
  const gosterOneri = $derived(acik && (oneri.sorunlu.length > 0 || bosYer) && (!onay || oneri.sorunlu.length > 0));
  function yerineYaz(id: number) {
    const yeni = yerineBakilan !== null ? kayitli.map(i => (i === yerineBakilan ? id : i)) : [...kayitli, id];
    acilGunuAyarla(y, m, gun, yeni, true, !!onay);
    const l = acilGunu(y, m, gun); s1 = String(l[0] ?? ""); s2 = String(l[1] ?? "");
    if (!acilAdaylariHesapla(veriAnlik(), y, m, gun, l, null).sorunlu.length && l.length >= 2) acik = false;
  }

  let silOnayi = $state(false), durum = $state("");
  $effect(() => { y; m; silOnayi = false; durum = ""; });
  function sil() { if (!silOnayi) { silOnayi = true; return; } acilAyiniSil(y, m); silOnayi = false; }
  const dosyaAdi = (uz: string) => `acil-eczane-${y}-${String(m + 1).padStart(2, "0")}.${uz}`;
  async function cikti(tur: "xlsx" | "pdf") {
    durum = "";
    try {
      const { acilKitabi, acilPdf } = await import("../../disa/acilCikti");
      const veri = { y, m, kurum: depo.veri.kurum.ad, gunler: gunler.map(g => ({ gun: g, dw: haftaGunu(y, m, g), tatil: tatilMi(y, m, g), resmi: resmiTatilMi(y, m, g), adlar: acilGunu(y, m, g).map(ad) })), ozet };
      const blob = tur === "xlsx" ? acilKitabi(veri) : acilPdf(veri);
      const ok = await dosyaKaydet(dosyaAdi(tur), blob, tur === "pdf" ? "application/pdf" : blob.type);
      durum = ok ? (tur === "pdf" ? "PDF kaydedildi." : "Excel dosyası kaydedildi.") : "";
    } catch (e) { durum = hataMetni(e, "Dosya oluşturulamadı."); }
  }
</script>

{#if !adaylar.length && !dolu}
  <section class="kart bos">
    <h2>Acilde nöbet tutan yok</h2>
    <p>Acil eczane nöbet listesi, görevi "Acil servis personeli" olanlar ile Personel bölümünde nöbet yeri "Acil eczane" seçilen eczacılar ve kemoterapi eczacıları arasından oluşturulur. Önce bu kişileri ekleyin ya da nöbet yerlerini seçin. Puantajda acil nöbetleri 24 saat, ertesi mesai günü nöbet izni olarak işlenir.</p>
    <div><button class="dugme ana" onclick={() => git("kisiler")}><Ikon ad="kisiler" />Personel ekle</button></div>
  </section>
{:else}
  <div class="ozet-serit">
    <div><small>Doluluk</small><b>{dolu}/{gunler.length} gün</b><span>Her gün 2 nöbetçi</span></div>
    <div><small>Acil kadrosu</small><b>{adaylar.length} kişi</b><span>Acil servis personeli ve acilde tutan eczacılar</span></div>
    <div><small>Sorunlu gün</small><b>{sorunluGunler.length}</b><span>{sorunluGunler.length ? "Sonradan izin / rapor girildi" : "Yazılamayan nöbetçi yok"}</span></div>
    <div><small>Onay durumu</small><b>{#if onay}<span class="rozet tamam">Onaylı</span>{:else}<span class="rozet notr">Taslak</span>{/if}</b><span>{onay ? onayMetni : "Onaylanınca liste kilitlenir"}</span></div>
  </div>
  <IslemAlani>
      {#if onay}
        <button class="dugme" onclick={() => listeOnayiniKaldir("acil", y, m)}>Onayı kaldır</button>
      {:else}
        {#if adaylar.length}<button class="dugme{dolu ? '' : ' ana'}" onclick={olustur}><Ikon ad={dolu ? "yenile" : "takvim"} />{dolu ? "Yeniden oluştur" : "Acil nöbet listesini oluştur"}</button>{/if}
        {#if dolu}<button class="dugme ana" onclick={() => listeyiOnayla("acil", y, m)}><Ikon ad="tamam" />Onayla</button>{/if}
      {/if}
      {#if dolu}
        <button class="dugme" onclick={() => cikti("pdf")}><Ikon ad="indir" />PDF</button>
        <button class="dugme" onclick={() => cikti("xlsx")}><Ikon ad="indir" />Excel</button>
        {#if !onay}<button class="dugme sade tehlike" onclick={sil}><Ikon ad="sil" />{silOnayi ? "Evet, ayın acil nöbetlerini sil" : "Sil"}</button>{/if}
      {/if}
  </IslemAlani>
  <Bilgi baslik="Acil nöbeti kuralları"><p>Her gün 2 kişi; acil servis personeli ile nöbet yeri "Acil eczane" olan eczacılar ve kemoterapi eczacıları arasından eşit dağıtılır (eczane nöbetinden ayrı; her ay fazla mesai saati, yıl boyunca toplam ile Perşembe, Cuma, Cumartesi, Pazar ve resmi tatil ayrı ayrı; herkesin payı yazılabildiği gün sayısına göre: izinli / raporlu günler düşülür, telafi istenmez). Aynı ya da komşu günde eczane nöbeti olan kişi yazılmaz; art arda gün ve 5 günde 3 nöbet olmaz. Bir güne dokunup elle değiştirebilirsiniz: elle düzenlenen gün yeniden oluşturmada korunur.</p></Bilgi>
  {#if onay}<p class="bant bilgi">Onaylandı: {onayMetni}. Onaylı liste kilitlidir; yeniden oluşturulmaz ve elle değiştirilmez. Sonradan izin ya da rapor alan kişinin günü işaretli görünür: güne dokunup yerine yazılacak kişiyi seçin.</p>{/if}
  {#each sorunluGunler as g}<p class="satir kutu dikkat"><Ikon ad="uyari" boyut={15} /><span>{g.gun} {AYLAR_AD[m]}: {g.adlar.join(", ")} bu gün yazılamaz (izin, rapor ya da çalışma dönemi dışı). Güne dokunup yerine birini seçin.</span></p>{/each}
  {#each uyarilar as u}<p class="satir kutu dikkat"><Ikon ad="uyari" boyut={15} /><span>{u}</span></p>{/each}
  {#if durum}<p class="bant" role="status">{durum}</p>{/if}

  <section class="panel takvim-kutu" aria-label="{ayAdi(y, m)} acil eczane nöbetleri">
    <div class="panel-bas"><h2>{ayAdi(y, m)} acil eczane nöbetleri</h2></div>
    <div class="takvim">
      {#each GUN_KISA as g}<div class="bas" aria-hidden="true">{g}</div>{/each}
      {#each { length: haftaGunu(y, m, 1) } as _}<div class="bosluk" aria-hidden="true"></div>{/each}
      {#each gunler as g (g)}
        {@const l = acilGunu(y, m, g)}
        <button class="gun" class:tatil={tatilMi(y, m, g)} class:bugun={bugunMu(g)} class:dolu={l.length} class:sorunlu={sorunluMu(g)} onclick={() => gunAc(g)}
          aria-label="{gunMetni(y, m, g)}: acil eczane nöbetçisi {l.map(ad).join(' ve ') || 'yok'}">
          <span class="ust serit"><b class="no rakam">{g}</b>{#if acilElleMi(y, m, g)}<span class="elle" title="Elle düzenlendi; yeniden oluşturmada korunur">elle</span>{/if}<span class="gunadi">{GUN_KISA[haftaGunu(y, m, g)]}</span>{#if resmiTatilMi(y, m, g)}<span class="etiket">Resmi tatil</span>{/if}</span>
          <span class="kisiler">
            {#each l as id}<span class="kisi"><span class="isaret servis"></span><span class="ad">{ad(id)}</span><span class="ad-kisa">{kisa(id)}</span></span>{:else}<span class="yok"><span class="ad">Nöbetçi yok</span><span class="ad-kisa" aria-hidden="true">–</span></span>{/each}
          </span>
        </button>
      {/each}
    </div>
  </section>

  <div class="blok">
    {#if dolu}<AylikOzet satirlar={ozetSatirlari} baslik="Kişi özeti" hazirlama={false} />
    {:else}<h2>Kişi özeti</h2><p class="aciklama">Bu ay için henüz acil eczane nöbet listesi oluşturulmadı.</p>{/if}
  </div>
{/if}

<Pencere bind:acik baslik={gunMetni(y, m, gun)} altBaslik={onay ? "Acil eczane nöbeti · onaylı liste" : "Acil eczane nöbeti · günde 2 kişi · kaydedilen gün elle düzenlenmiş sayılır"}>
  {#if !gunAday.length}<p class="not">Bu gün acilde nöbet tutabilecek kimse yok.</p>{/if}
  {#if gosterOneri}
    <section class="oneri" aria-label="Yerine yazılabilecekler">
      <h3>{yerineBakilan !== null ? ad(yerineBakilan) + " bu gün yazılamaz; yerine yazılabilecekler" : "Boş yere yazılabilecekler"}</h3>
      {#each oneri.adaylar.filter(a => !a.engel).slice(0, 6) as a, i (a.id)}
        <div class="aday" class:ilk={i === 0}>
          <div><b>{a.ad}</b> <small class="rakam">yılda {a.yil} acil nöbeti</small>
            {#if a.uyarilar.length}<small class="uyari">{a.uyarilar.join(" · ")}</small>{:else}<small class="uygun">uygun</small>{/if}</div>
          <button class="dugme{i === 0 ? ' ana' : ''}" onclick={() => yerineYaz(a.id)}>Yaz</button>
        </div>
      {:else}<p class="not">Bu gün yazılabilecek başka kimse yok.</p>{/each}
      <p class="ipucu">Sıra: kural uyarısı olmayanlar önce, sonra yıl içinde daha az acil nöbeti tutan. Yazılan gün elle düzenlenmiş sayılır.</p>
    </section>
  {/if}
  <div class="iki">
    <label class="alan"><span>1. nöbetçi</span><select class="girdi" disabled={!!onay} bind:value={s1}><option value="">Seçilmedi</option>{#each gunAday as k}<option value={String(k.id)}>{k.name}</option>{/each}</select></label>
    <label class="alan"><span>2. nöbetçi</span><select class="girdi" disabled={!!onay} bind:value={s2}><option value="">Seçilmedi</option>{#each gunAday as k}<option value={String(k.id)}>{k.name}</option>{/each}</select></label>
  </div>
  {#if ayni}<p class="not hata" role="alert">Aynı kişi iki kez seçilemez.</p>
  {:else if denetim.length}
    <div class="denetim" aria-live="polite">{#each denetim as x}<p class="satir kutu dikkat"><Ikon ad="uyari" boyut={15} /><span>{x.t}</span></p>{/each}</div>
  {/if}
  {#snippet altlik()}
    {#if acilGunu(y, m, gun).length && !onay}<button class="dugme sade" onclick={temizle}>Günü temizle</button>{/if}
    <span style="flex:1"></span>
    {#if onay}<button class="dugme" onclick={() => (acik = false)}>Kapat</button>
    {:else}
      <button class="dugme" onclick={() => (acik = false)}>Vazgeç</button>
      <button class="dugme ana" onclick={kaydet} disabled={ayni}>Kaydet</button>
    {/if}
  {/snippet}
</Pencere>

<style>
  .bos { padding: var(--b5); display: grid; gap: var(--b3); max-width: 760px; }
  .bos p { color: var(--yazi-2); }
  .aciklama { font-size: var(--f-sm); color: var(--soluk); margin-bottom: var(--b3); max-width: 80ch; }
  .bant { padding: var(--b2) var(--b4); border: 1px solid var(--cizgi); border-radius: var(--r); margin-bottom: var(--b3); font-size: var(--f-sm); font-weight: 600; background: var(--vurgu-zemin); color: var(--vurgu); }
  .ozet-serit { margin-bottom: var(--b3); }
  .takvim-kutu { margin-top: var(--b3); }
  .takvim { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
  .bas, .bosluk, .gun { border-right: 1px solid var(--cizgi); border-bottom: 1px solid var(--cizgi); }
  .takvim > :nth-child(7n) { border-right: 0; }
  .bas { background: var(--tablo-bas); color: var(--lacivert); font-size: var(--f-xs); font-weight: 700; text-align: center; padding: 6px 0; }
  .bosluk { background: var(--yuzey-2); }
  .gun { display: flex; flex-direction: column; min-height: 88px; padding: 0; text-align: left; border-top: 0; border-left: 0; border-radius: 0; background: var(--yuzey); cursor: pointer; min-width: 0; }
  .gun:hover { background: var(--yuzey-2); }
  .gun:focus-visible { outline: 2px solid var(--odak); outline-offset: -2px; }
  .gun.tatil .serit { background: color-mix(in srgb, var(--acik-mavi) 28%, var(--yuzey)); }
  .gun.bugun .serit b { text-decoration: underline; text-underline-offset: 3px; }
  .gun.sorunlu { background: var(--dikkat-zemin); }
  .gun.sorunlu .serit { box-shadow: inset 0 -2px 0 var(--dikkat); }
  .bant { display: block; }
  .bant.bilgi { background: var(--bilgi-zemin); color: var(--bilgi); }
  .oneri { display: grid; gap: 6px; padding: var(--b3); border: 1px solid var(--cizgi); border-radius: var(--r-kucuk); background: var(--yuzey-2); margin-bottom: var(--b3); }
  .oneri h3 { font-size: var(--f-sm); font-weight: 600; }
  .aday { display: flex; align-items: center; justify-content: space-between; gap: var(--b3); padding: 6px 8px; border-radius: var(--r-kucuk); background: var(--yuzey); }
  .aday.ilk { box-shadow: inset 0 0 0 1px var(--vurgu); }
  .aday small { display: block; font-size: var(--f-xs); color: var(--soluk); }
  .aday small.uyari { color: var(--dikkat); }
  .aday small.uygun { color: var(--vurgu); }
  .ipucu { font-size: var(--f-xs); color: var(--soluk); }
  .ust { display: flex; align-items: center; gap: 6px; min-height: 24px; padding: 2px 8px; background: var(--panel-bas); border-bottom: 1px solid var(--cizgi-acik); font-size: var(--f-xs); color: var(--yazi-2); }
  .no { font-weight: 700; font-size: var(--f-sm); color: var(--lacivert); }
  .gunadi { font-size: var(--f-xs); color: var(--yazi-2); }
  .etiket { font-size: var(--f-xs); font-weight: 600; color: var(--tatil); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .kisiler { display: grid; gap: 3px; min-width: 0; padding: 6px 8px 8px; }
  .kisi { display: flex; align-items: baseline; gap: 6px; font-size: 13px; font-weight: 600; overflow-wrap: anywhere; min-width: 0; }
  .kisi .isaret { transform: translateY(-1px) rotate(45deg) scale(.85); }
  .yok { font-size: var(--f-xs); color: var(--soluk); }
  .blok { margin-top: var(--b5); display: grid; gap: var(--b2); }
  .blok h2 { font-size: var(--f-lg); }
  .iki { display: grid; grid-template-columns: 1fr 1fr; gap: var(--b3); }
  .denetim { display: grid; gap: 6px; }
  .satir { display: flex; gap: var(--b2); align-items: flex-start; margin-bottom: var(--b2); }
  .satir :global(svg) { flex: none; margin-top: 2px; color: var(--dikkat); }
  .not { padding: var(--b2) var(--b3); border-radius: var(--r-kucuk); font-size: var(--f-sm); font-weight: 500; background: var(--yuzey-2); color: var(--yazi-2); }
  .not.hata { background: var(--hata-zemin); color: var(--hata); }

  .ad-kisa { display: none; }
  .elle { margin-left: auto; font-size: 11px; color: var(--soluk); }
  /* telefon: aynı 7 sütunlu takvim, kısa adlar */
  @media (max-width: 720px) {
    .bas { font-size: 11px; padding: 4px 0; }
    .gun { min-height: 62px; }
    .ust { padding: 1px 4px; min-height: 18px; }
    .kisiler { padding: 3px 3px 4px; gap: 1px; }
    .no { font-size: 12px; }
    .etiket, .gunadi { display: none; }
    .kisi { font-size: 10.5px; gap: 2px; font-weight: 600; }
    .kisi .isaret { display: none; }
    .kisi .ad { display: none; }
    .ad-kisa { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .yok { font-size: 10px; }
    .iki { grid-template-columns: 1fr; }
  }
</style>
