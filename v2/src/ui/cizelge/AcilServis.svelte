<script lang="ts">
  import { puantajIzgarasi } from "../../veri/degisim.svelte";
  import { ciktiPaketi } from "../../disa/yukle";
  import IslemAlani from "../ortak/IslemAlani.svelte";
  import Bilgi from "../ortak/Bilgi.svelte";
  // Acil eczane nöbet listesi: günde 2 kişi; acil servis personeli ve "acilde nöbet tutar" işaretli eczacılar (kemoterapi dahil) arasından
  // otomatik oluşturulur (eczane çizelgesiyle çakışmadan), günler elle de düzenlenebilir (elle günler korunur).
  // Puantajda bu günler nöbet (24 saat) sayılır; ertesi gün mesai günüyse nöbet izni (Nİ), tatilse çalışılmadı (B) yazılır.
  import { depo, veriAnlik, aydaCalisanlar, acilGunu, acilGunuAyarla, acilAyiniSil, acilKaydet, acilElleMi, resmiTatilMi, tatilMi, listeOnayi, listeyiOnayla, listeOnayiniKaldir } from "../../veri/depo.svelte";
  import { acilAdaylariHesapla, acilDenetle, acilHesapla, acilKadrosunda, acilSorunluGunler } from "../../motor";
  import { dosyaKaydet, hataMetni } from "../../disa/indir";
  import { AYLAR as AYLAR_AD, GUN_KISA, GUN_UZUN, adIcerir, gunMetni, gunSayisi, haftaGunu, ayAdi, kisaAd } from "../../veri/tarih";
  import Ikon from "../ortak/Ikon.svelte";
  import Pencere from "../ortak/Pencere.svelte";
  import OnaySorusu from "../ortak/OnaySorusu.svelte";
  import AylikOzet from "../ortak/AylikOzet.svelte";
  import VurguSecici from "../ortak/VurguSecici.svelte";

  let { git }: { git: (ad: "kisiler") => void } = $props();

  const y = $derived(depo.yil), m = $derived(depo.ay);
  // kişiyi vurgula: seçilen kişinin acil nöbet günleri takvimde işaretlenir (özet tablosundan da seçilir)
  let vurgu = $state<number | null>(null);
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
  // güncel liste: puantajdaki acil nöbet değişimleri (yerine tutma) işlenmiş hâli; asıl (onaylanan) liste ayrı görünümde.
  // Her gün acil nöbetçileri puantajdan okunur; değişmeyen kişi yerinde kalır, değişenin yerine yeni gelen yazılır.
  const guncel = $derived.by(() => {
    if (!dolu) return null;
    const G = puantajIzgarasi(y, m) as { satirlar: { s: { id: number }; cells: { kod: string; acil?: boolean }[] }[] };
    const liste: Record<number, number[]> = {}, degisen = new Set<number>();
    for (const g of gunler) {
      const eski = acilGunu(y, m, g), yeni = G.satirlar.filter(r => r.cells[g - 1]?.kod === "N" && r.cells[g - 1]?.acil).map(r => r.s.id);
      if (eski.length === yeni.length && eski.every(id => yeni.includes(id))) { liste[g] = eski; continue; }
      const kalan = yeni.filter(id => !eski.includes(id));
      liste[g] = [...eski.map(id => (yeni.includes(id) ? id : kalan.shift())).filter((id): id is number => id !== undefined), ...kalan];
      degisen.add(g);
    }
    return { liste, degisen };
  });
  let gorunum = $state<"guncel" | "asil">("guncel");
  const degisimVar = $derived(!!guncel && guncel.degisen.size > 0);
  const guncelMi = $derived(degisimVar && gorunum === "guncel");
  // ekranda ve çıktıda (PDF / Excel) açık olan görünümün o günkü nöbetçileri
  const goster = (g: number) => (guncelMi ? guncel!.liste[g] : acilGunu(y, m, g));
  const ozet = $derived.by(() => {
    const o = new Map<number, number[]>();
    for (const g of gunler) for (const id of goster(g)) o.set(id, [...(o.get(id) ?? []), g]);
    return [...o.entries()].map(([id, l]) => ({ id, ad: ad(id), gunler: l, tatil: l.filter(g => tatilMi(y, m, g)).length })).sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
  });
  // kayıtlı nöbetçisi sonradan yazılamaz hâle gelen günler (izin / rapor girildi, eş durumu yok, dönem dışı)
  const sorunluGunler = $derived(dolu ? acilSorunluGunler(veriAnlik(), y, m).map(x => ({ gun: x.gun, adlar: x.ids.map(ad), artArda: (x.artArda ?? []).map(ad) })) : []);
  const sorunluMu = (g: number) => sorunluGunler.some(x => x.gun === g);
  // kişi başı aylık özet (puantajdaki gibi; acil kadrosu, hazırlama yok)
  const ozetSatirlari = $derived(dolu ? (puantajIzgarasi(y, m) as { satirlar: { s: { id: number; role: string; acilTutar?: true } }[] }).satirlar.filter(r => acilKadrosunda(r.s)) as never : []);
  // görünüm: Günlük Eczane'deki gibi Takvim / Liste; liste görünümünde süzgeç düğmeleri, kişi seçimi ve ad arama,
  // günler haftalara göre gruplanır
  let nobetGorunum = $state<"takvim" | "liste">("liste");
  type Filtre = "tumu" | "hi" | "hs" | "degisen" | "sorunlu" | "elle" | "bos";
  let filtre = $state<Filtre>("tumu");
  let kisiF = $state<number | null>(null);
  let ara = $state("");
  const degistiMi = (g: number) => guncelMi && !!guncel?.degisen.has(g);
  const filtreUy: Record<Filtre, (g: number) => boolean> = {
    tumu: () => true, hi: g => !tatilMi(y, m, g), hs: g => tatilMi(y, m, g), degisen: degistiMi, sorunlu: g => sorunluMu(g), elle: g => acilElleMi(y, m, g), bos: g => goster(g).length < 2,
  };
  const FILTRELER = $derived(([["tumu", "Tümü"], ["hi", "Hafta içi"], ["hs", "Hafta sonu / tatil"], ["degisen", "Değişen"], ["sorunlu", "Sorunlu"], ["elle", "Elle"], ["bos", "Eksik"]] as [Filtre, string][])
    .filter(([f]) => f !== "degisen" || guncelMi));
  const kisiUyar = (g: number) => {
    const l = goster(g);
    if (kisiF !== null && !l.includes(kisiF)) return false;
    return !ara.trim() || l.some(id => adIcerir(ad(id), ara));
  };
  const filtreSayisi = $derived(Object.fromEntries(FILTRELER.map(([f]) => [f, gunler.filter(g => filtreUy[f](g) && kisiUyar(g)).length])) as Record<Filtre, number>);
  // haftalar (Pazartesi başlar)
  const haftalar = $derived.by(() => {
    const ilk = haftaGunu(y, m, 1), n = gunler.length;
    const h: { no: number; yarim: boolean; gunler: number[] }[] = [];
    for (const g of gunler) {
      const w = Math.floor((g - 1 + ilk) / 7);
      if (!h[w]) { const bas = w * 7 - ilk + 1; h[w] = { no: w + 1, yarim: bas < 1 || bas + 6 > n, gunler: [] }; }
      if (filtreUy[filtre](g) && kisiUyar(g)) h[w].gunler.push(g);
    }
    return h.filter(x => x && x.gunler.length);
  });
  $effect(() => { if (filtre === "degisen" && !guncelMi) filtre = "tumu"; });
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
      const { acilKitabi, acilPdf } = await ciktiPaketi();
      const veri = { y, m, kurum: depo.veri.kurum.ad, gunler: gunler.map(g => ({ gun: g, dw: haftaGunu(y, m, g), tatil: tatilMi(y, m, g), resmi: resmiTatilMi(y, m, g), adlar: goster(g).map(ad) })), ozet };
      const blob = tur === "xlsx" ? acilKitabi(veri) : acilPdf(veri);
      const ok = await dosyaKaydet(dosyaAdi(tur), blob, tur === "pdf" ? "application/pdf" : blob.type);
      durum = ok ? (tur === "pdf" ? "PDF kaydedildi." : "Excel dosyası kaydedildi.") : "";
    } catch (e) { durum = hataMetni(e, "Dosya oluşturulamadı."); }
  }
  let onaySor = $state(false);
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
    <div><small>Sorunlu gün</small><b>{sorunluGunler.length}</b><span>{sorunluGunler.length ? "İzin / rapor ya da art arda nöbet" : "Yazılamayan nöbetçi yok"}</span></div>
    <div><small>Onay durumu</small><b>{#if onay}<span class="rozet tamam">Onaylı</span>{:else}<span class="rozet notr">Taslak</span>{/if}</b><span>{onay ? onayMetni : "Onaylanınca liste kilitlenir"}</span></div>
  </div>
  <IslemAlani>
      {#if onay}
        <button class="dugme" onclick={() => listeOnayiniKaldir("acil", y, m)}>Onayı kaldır</button>
      {:else}
        {#if adaylar.length}<button class="dugme{dolu ? '' : ' ana'}" onclick={olustur}><Ikon ad={dolu ? "yenile" : "takvim"} />{dolu ? "Yeniden oluştur" : "Acil nöbet listesini oluştur"}</button>{/if}
        {#if dolu}<button class="dugme ana" onclick={() => (onaySor = true)}><Ikon ad="tamam" />Onayla</button>{/if}
      {/if}
      {#if degisimVar}<div class="secim" role="group" aria-label="Liste"><button aria-pressed={gorunum === "guncel"} onclick={() => (gorunum = "guncel")} title="Nöbet değişimleri işlenmiş liste">Güncel</button><button aria-pressed={gorunum === "asil"} onclick={() => (gorunum = "asil")} title="Değişimlerden önceki liste">{onay ? "Onaylanan" : "Asıl liste"}</button></div>{/if}
      {#if dolu}<div class="secim" role="group" aria-label="Görünüm"><button aria-pressed={nobetGorunum === "takvim"} onclick={() => (nobetGorunum = "takvim")}>Takvim</button><button aria-pressed={nobetGorunum === "liste"} onclick={() => (nobetGorunum = "liste")}>Liste</button></div>{/if}
      {#if dolu}
        <button class="dugme" onclick={() => cikti("pdf")}><Ikon ad="indir" />PDF</button>
        <button class="dugme" onclick={() => cikti("xlsx")}><Ikon ad="indir" />Excel</button>
        {#if !onay}<button class="dugme sade tehlike" onclick={sil}><Ikon ad="sil" />{silOnayi ? "Evet, ayın acil nöbetlerini sil" : "Sil"}</button>{/if}
      {/if}
  </IslemAlani>
  <Bilgi baslik="Acil nöbeti kuralları"><p>Her gün 2 kişi; acil servis personeli ile nöbet yeri "Acil eczane" olan eczacılar ve kemoterapi eczacıları arasından eşit dağıtılır (eczane nöbetinden ayrı; her ay fazla mesai saati, yıl boyunca toplam ile Perşembe, Cuma, Cumartesi, Pazar ve resmi tatil ayrı ayrı; herkesin payı yazılabildiği gün sayısına göre: izinli / raporlu günler düşülür, telafi istenmez). Aynı ya da komşu günde eczane nöbeti olan kişi yazılmaz; art arda gün ve 5 günde 3 nöbet olmaz. Bir güne dokunup elle değiştirebilirsiniz: elle düzenlenen gün yeniden oluşturmada korunur.</p></Bilgi>
  {#if onay}<p class="bant bilgi">Onaylandı: {onayMetni}. Onaylı liste kilitlidir; yeniden oluşturulmaz ve elle değiştirilmez. Sonradan izin ya da rapor alan kişinin günü işaretli görünür: güne dokunup yerine yazılacak kişiyi seçin.</p>{/if}
  {#each sorunluGunler as g}
    {#if g.adlar.length}<p class="satir kutu dikkat"><Ikon ad="uyari" boyut={15} /><span>{g.gun} {AYLAR_AD[m]}: {g.adlar.join(", ")} bu gün yazılamaz (izin, rapor ya da çalışma dönemi dışı). Güne dokunup yerine birini seçin.</span></p>{/if}
    {#if g.artArda.length}<p class="satir kutu dikkat"><Ikon ad="uyari" boyut={15} /><span>{g.gun - 1} ve {g.gun} {AYLAR_AD[m]}: {g.artArda.join(", ")} art arda acil nöbeti tutuyor. Güne dokunup yerine birini seçin.</span></p>{/if}
  {/each}
  {#each uyarilar as u}<p class="satir kutu dikkat"><Ikon ad="uyari" boyut={15} /><span>{u}</span></p>{/each}
  {#if durum}<p class="bant" role="status">{durum}</p>{/if}
  {#if degisimVar}<p class="bant bilgi"><Ikon ad="bilgi" boyut={16} />{guncelMi ? `Güncel liste gösteriliyor: puantajdaki nöbet değişimleri işlendi; değişen ${guncel!.degisen.size} gün işaretli. Değişimlerden önceki liste "${onay ? "Onaylanan" : "Asıl liste"}" görünümünde.` : `${onay ? "Onaylanan" : "Asıl"} liste gösteriliyor (değişimlerden önceki hâli). Değişimler "Güncel" görünümünde.`}</p>{/if}

  {#snippet adSnip(id: number | undefined)}
    {#if id === undefined}—{:else if id === vurgu}<mark class="vurgu-ad">{ad(id)}</mark>{:else}{ad(id)}{/if}
  {/snippet}
  {#if dolu && nobetGorunum === "liste"}
  <section class="panel takvim-kutu" aria-label="{ayAdi(y, m)} acil eczane nöbet listesi">
    <div class="panel-bas"><h2>{ayAdi(y, m)} acil eczane nöbet listesi{guncelMi ? " · güncel" : ""}</h2><VurguSecici kisiler={adaylar} bind:vurgu /></div>
    <div class="filtreler">
      <div class="cipler" role="group" aria-label="Günleri süz">
        {#each FILTRELER as [f, fad]}<button class="cip" aria-pressed={filtre === f} onclick={() => (filtre = f)}>{fad} <span class="rakam">{filtreSayisi[f]}</span></button>{/each}
      </div>
      <div class="ara">
        <select bind:value={kisiF} aria-label="Kişi"><option value={null}>Kişi: Tümü</option>{#each adaylar as k (k.id)}<option value={k.id}>{k.name}</option>{/each}</select>
        <input type="search" bind:value={ara} placeholder="Ad ara" aria-label="Ad ara" />
      </div>
    </div>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (kaydırılan tablo klavyeyle kaydırılabilsin) -->
    <div class="tablo-kap" tabindex="0" role="region" aria-label="Acil eczane nöbet listesi tablosu">
      <table class="tablo liste">
        <thead><tr><th>Tarih</th><th>Gün</th><th>1. nöbetçi</th><th>2. nöbetçi</th><th>Durum</th></tr></thead>
        <tbody>
          {#each haftalar as h (h.no)}
            <tr class="grup"><td colspan="5">{h.no}. hafta{h.yarim ? " (yarım)" : ""}</td></tr>
            {#each h.gunler as g (g)}
              {@const l = goster(g)}
              <tr class:hs={tatilMi(y, m, g)} class:sorunlu-satir={sorunluMu(g)} class:vurgulu={vurgu !== null && l.includes(vurgu)} onclick={() => gunAc(g)}>
                <td class="rakam"><b>{g} {AYLAR_AD[m]}</b></td>
                <td>{GUN_UZUN[haftaGunu(y, m, g)]}</td>
                <td>{@render adSnip(l[0])}</td>
                <td>{@render adSnip(l[1])}</td>
                <td class="durum">
                  {#if degistiMi(g)}<span class="etk degisti">değişti</span>{/if}
                  {#if sorunluMu(g)}<span class="etk esnek"><Ikon ad="uyari" boyut={12} />sorunlu</span>{:else if l.length < 2}<span class="etk esnek"><Ikon ad="uyari" boyut={12} />{l.length ? "eksik" : "nöbetçi yok"}</span>{/if}
                  {#if acilElleMi(y, m, g)}<span class="etk elle"><Ikon ad="kilit" boyut={12} />elle</span>{/if}
                  {#if resmiTatilMi(y, m, g)}<span class="etk hsr">resmi tatil</span>{:else if tatilMi(y, m, g)}<span class="etk hsr">hafta sonu</span>{/if}
                </td>
              </tr>
            {/each}
          {:else}
            <tr><td colspan="5" class="bos-sonuc">Bu süzgece uyan gün yok.</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>
  {:else}
  <section class="panel takvim-kutu" aria-label="{ayAdi(y, m)} acil eczane nöbetleri">
    <div class="panel-bas"><h2>{ayAdi(y, m)} acil eczane nöbetleri{guncelMi ? " · güncel" : ""}</h2><VurguSecici kisiler={adaylar} bind:vurgu /></div>
    <div class="takvim" class:vurgulu={vurgu !== null}>
      {#each GUN_KISA as g}<div class="bas" aria-hidden="true">{g}</div>{/each}
      {#each { length: haftaGunu(y, m, 1) } as _}<div class="bosluk" aria-hidden="true"></div>{/each}
      {#each gunler as g (g)}
        {@const l = goster(g)}
        <button class="gun" class:tatil={tatilMi(y, m, g)} class:bugun={bugunMu(g)} class:dolu={l.length} class:sorunlu={sorunluMu(g)} class:vurgu={vurgu !== null && l.includes(vurgu)} class:soluk={vurgu !== null && !l.includes(vurgu)} onclick={() => gunAc(g)}
          aria-label="{gunMetni(y, m, g)}: acil eczane nöbetçisi {l.map(ad).join(' ve ') || 'yok'}">
          <span class="ust serit"><b class="no rakam">{g}</b>{#if acilElleMi(y, m, g)}<span class="elle" title="Elle düzenlendi; yeniden oluşturmada korunur">elle</span>{/if}<span class="gunadi">{GUN_KISA[haftaGunu(y, m, g)]}</span>{#if guncelMi && guncel!.degisen.has(g)}<span class="degisti" title="Bu günde nöbet değişimi var">değişti</span>{/if}{#if resmiTatilMi(y, m, g)}<span class="etiket">Resmi tatil</span>{/if}</span>
          <span class="kisiler">
            {#each l as id}<span class="kisi" class:ben={id === vurgu}><span class="isaret servis"></span><span class="ad">{ad(id)}</span><span class="ad-kisa">{kisa(id)}</span></span>{:else}<span class="yok"><span class="ad">Nöbetçi yok</span><span class="ad-kisa" aria-hidden="true">–</span></span>{/each}
          </span>
        </button>
      {/each}
    </div>
  </section>
  {/if}

  <div class="blok">
    {#if dolu}<AylikOzet satirlar={ozetSatirlari} baslik="Kişi özeti" hazirlama={false} bind:vurgu />
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


<OnaySorusu bind:acik={onaySor} ne="Acil eczane nöbet listesi" sorunlar={sorunluGunler.map(x => `${x.gun}. gün: ${[...x.adlar.map(a => a + " yazılamaz"), ...x.artArda.map(a => a + " art arda")].join(", ")}`)} onaylayan={depo.veri.kurum.onaylayan} onayla={() => listeyiOnayla("acil", y, m)} />
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
  .gun { display: flex; flex-direction: column; width: 100%; aspect-ratio: 5 / 4; padding: 0; text-align: left; border-top: 0; border-left: 0; border-radius: 0; background: var(--yuzey); cursor: pointer; min-width: 0; }
  .gun:hover { background: var(--yuzey-2); }
  .gun:focus-visible { outline: 2px solid var(--odak); outline-offset: -2px; }
  .gun.tatil .serit { background: color-mix(in srgb, var(--acik-mavi) 28%, var(--yuzey)); }
  .gun.bugun .serit b { text-decoration: underline; text-underline-offset: 3px; }
  .gun.sorunlu { background: var(--dikkat-zemin); }
  .gun.sorunlu .serit { box-shadow: inset 0 -2px 0 var(--dikkat); }
  .degisti { margin-left: auto; font-size: 11px; font-weight: 700; color: var(--dikkat); background: var(--dikkat-zemin); border-radius: 3px; padding: 0 4px; }
  .vurgulu .gun.soluk { opacity: .38; }
  .vurgulu .gun.vurgu { box-shadow: inset 0 0 0 2px var(--lacivert); }
  .kisi.ben { background: var(--vurgu-zemin); box-shadow: 0 0 0 2px var(--vurgu-zemin); border-radius: 3px; }
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

  /* liste görünümü (Günlük Eczane listesiyle aynı) */
  .liste tbody tr { cursor: pointer; }
  .liste tbody tr:hover > * { background: var(--vurgu-zemin); }
  .liste tr.hs > * { background: color-mix(in srgb, var(--acik-mavi) 14%, var(--yuzey)); }
  .liste tr.sorunlu-satir > * { background: var(--dikkat-zemin); }
  .liste tbody tr.vurgulu > * { background: color-mix(in srgb, var(--altin) 16%, var(--yuzey)); }
  .liste tbody tr.vurgulu > :first-child { box-shadow: inset 3px 0 0 var(--altin); }
  .liste tr.grup > td { background: var(--panel-bas); font-weight: 700; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--lacivert); padding-top: 5px; padding-bottom: 5px; cursor: default; }
  .liste tbody tr.grup:hover > * { background: var(--panel-bas); }
  .liste td:nth-child(3), .liste td:nth-child(4) { min-width: 150px; }
  .durum, .liste td:first-child { white-space: nowrap; }
  .vurgu-ad { background: color-mix(in srgb, var(--altin) 35%, transparent); color: inherit; font-weight: 700; padding: 0 3px; border-radius: 3px; }
  .etk { display: inline-flex; align-items: center; gap: 3px; font-size: var(--f-xs); font-weight: 600; padding: 1px 6px; border-radius: 2px; margin-right: 4px; }
  .etk.degisti { background: color-mix(in srgb, var(--izin) 14%, var(--yuzey)); color: var(--izin); }
  .etk.esnek { background: var(--hata-zemin); color: var(--hata); }
  .etk.elle { background: var(--yuzey-2); color: var(--yazi-2); }
  .etk.hsr { background: color-mix(in srgb, var(--acik-mavi) 30%, var(--yuzey)); color: var(--lacivert); }
  .bos-sonuc { color: var(--soluk); text-align: center; padding: var(--b4); cursor: default; }
  .filtreler { display: flex; flex-wrap: wrap; gap: var(--b2); align-items: center; justify-content: space-between; padding: var(--b3) var(--b4); border-bottom: 1px solid var(--cizgi); }
  .cipler { display: flex; flex-wrap: wrap; gap: 6px; }
  .cip { border: 1px solid var(--cizgi); background: var(--yuzey); color: var(--yazi); padding: 5px 12px; border-radius: 999px; font-weight: 600; font-size: var(--f-sm); cursor: pointer; min-height: 32px; }
  .cip span { color: var(--yazi-2); font-weight: 500; }
  .cip[aria-pressed="true"] { background: var(--vurgu); border-color: var(--vurgu); color: var(--vurgu-yazi); }
  .cip[aria-pressed="true"] span { color: var(--vurgu-yazi); opacity: .85; }
  .ara { display: flex; gap: 6px; }
  .ara select, .ara input { min-height: 34px; padding: 0 var(--b3); font-size: var(--f-sm); border: 1px solid var(--cizgi); border-radius: var(--r-kucuk); background: var(--yuzey); color: var(--yazi); }
  .ara select:focus-visible, .ara input:focus-visible { outline: none; border-color: var(--vurgu); box-shadow: 0 0 0 3px color-mix(in srgb, var(--vurgu) 22%, transparent); }
  .ara input { width: 180px; }

  .ad-kisa { display: none; }
  .elle { margin-left: auto; font-size: 11px; color: var(--soluk); }
  /* telefon: aynı 7 sütunlu takvim, kısa adlar */
  @media (max-width: 720px) {
    .bas { font-size: 11px; padding: 4px 0; }
    .gun { aspect-ratio: auto; min-height: 62px; }
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
    .ara { width: 100%; }
    .ara select, .ara input { flex: 1; min-width: 0; width: auto; }
  }
</style>
