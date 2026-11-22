// Ortak klasör kipinde açılış: klasör seçimi, kasa kurulumu, giriş, ilk şifre, kurtarma; giriş yapılınca uygulamanın
// yeteneklerini (veritabanı, kullanıcı, oda) klasör oturumuna bağlar. Oturum kapanınca (çıkış, 30 dakika işlem
// yapılmaması, hesabın kaldırılması) sayfa yenilenir: bellekteki veriler ve anahtarlar silinir.
import { platformAyarla } from "../yetenek";
import { kimlikGuncelle } from "../kimlik.svelte";
import {
  altKlasor,
  masaustuKlasoru,
  masaustuKlasorSec,
  masaustuKokEkle,
  masaustuMu,
  tarayiciIzni,
  tarayiciKlasoru,
  tauri,
  tutamakOku,
  tutamakYaz,
  type Klasor,
} from "./dosya";
import {
  bellekIzDeposu,
  girisYap,
  kasaIziniUnut,
  kasaKimligi,
  kasaOku,
  kasaOlustur,
  KASA_DOSYASI,
  kurtarmaIleSifirla,
  yerelIzDeposu,
  type KasaHatasi,
  type KasaKisi,
  type KasaRol,
  type Oturum,
} from "./kasa";
import { belgeleriYenile, klasorDb } from "./belgeler";
import { klasorPlatformu } from "./platform";
import { klasoruYedekle, yedekler, type YedekBilgisi } from "./yedekle";
import { birlestir, type Parcalar } from "../bulutBicim";
import { guvenliJson, veriyiDogrula } from "../dogrulama";
import type { Veri } from "../tipler";

export type GirisAsamasi = "hazirlaniyor" | "klasor" | "izin" | "kur" | "giris" | "kod" | "sifre" | "kurtarma" | "acik";
/** işlem yapılmazsa oturum bu kadar sonra kapanır */
export const OTURUM_SURE_DK = 30;

const YOL_ANAHTAR = "nobet-klasor-yolu",
  YEDEK_YOL_ANAHTAR = "nobet-yedek-yolu",
  AD_ANAHTAR = "nobet-son-kullanici",
  CIKIS_MESAJI = "nobet-cikis-mesaji";
const kayitOku = (a: string) => {
  try {
    return localStorage.getItem(a) ?? "";
  } catch {
    return "";
  }
};
const kayitYaz = (a: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(a);
    else localStorage.setItem(a, v);
  } catch {
    /* depolama yok */
  }
};

export const giris = $state({
  asama: "hazirlaniyor" as GirisAsamasi,
  /** seçili klasörün adı / yolu */
  klasorAdi: "",
  hata: "",
  /** "eski kopya" hatasında: kullanıcı yine de açabilir (yedekten dönülüyorsa) */
  eskiKopya: false,
  bilgi: "",
  mesgul: false,
  kurtarmaKodu: "",
  /** bu bilgisayarda son giren kullanıcı adı (kolaylık; gizli değil) */
  sonKullanici: kayitOku(AD_ANAHTAR),
  /** giriş yapılan kişi (üst şerit, kullanıcı yönetimi) */
  ad: "",
});
export const yedekDurumu = $state({
  hedef: "",
  son: null as YedekBilgisi | null,
  liste: [] as YedekBilgisi[],
  calisiyor: false,
  hata: "",
});

/** açık oturumun kasası (ekranda: kullanıcı listesi, rol) */
export const kasaDurumu = $state({ kisiler: [] as KasaKisi[], benId: "", rol: "" as KasaRol | "", sahip: false, kullaniciAdi: "" });
function kasaGoster(o: Oturum) {
  kasaDurumu.kisiler = JSON.parse(JSON.stringify(o.kasa.imzali.kisiler));
  kasaDurumu.benId = o.id;
  kasaDurumu.rol = o.rol;
  kasaDurumu.sahip = o.sahipMi;
  kasaDurumu.kullaniciAdi = o.ben.kullaniciAdi;
}

let klasor: Klasor | null = null,
  oturum: Oturum | null = null,
  platformu: ReturnType<typeof klasorPlatformu> | null = null,
  bekleyenOturum: Oturum | null = null,
  geciciSifre = "",
  aktarilacak: Veri | null = null;
const hataMetni = (e: unknown) => (e as KasaHatasi)?.message || "Beklenmeyen bir hata oldu.";
async function is<T>(f: () => Promise<T>): Promise<T | undefined> {
  giris.mesgul = true;
  giris.hata = "";
  giris.eskiKopya = false;
  try {
    return await f();
  } catch (e) {
    giris.hata = hataMetni(e);
    giris.eskiKopya = (e as KasaHatasi)?.code === "eski";
    if (!(e as KasaHatasi)?.code) console.error(e);
    return undefined;
  } finally {
    giris.mesgul = false;
  }
}

/** açık oturum (kullanıcı yönetimi ekranı için) */
export const aktifOturum = () => oturum;

// ---------- klasör ----------
export async function girisBaslat() {
  try {
    const m = sessionStorage.getItem(CIKIS_MESAJI);
    if (m) {
      giris.bilgi = m;
      sessionStorage.removeItem(CIKIS_MESAJI);
    }
  } catch {
    /* yok */
  }
  if (masaustuMu()) {
    const yol = kayitOku(YOL_ANAHTAR);
    if (!yol) return void (giris.asama = "klasor");
    giris.klasorAdi = yol;
    const var_ = await masaustuKokEkle(yol).catch(() => false);
    if (!var_) {
      giris.hata = `Kayıtlı ortak klasöre ulaşılamadı: ${yol}. Ağ bağlantısını denetleyin ya da başka klasör seçin.`;
      giris.asama = "klasor";
      return;
    }
    await klasorHazir(masaustuKlasoru(yol));
    return;
  }
  const h = await tutamakOku("veri");
  if (!h) return void (giris.asama = "klasor");
  giris.klasorAdi = h.name;
  if (await tarayiciIzni(h, false).catch(() => false)) await klasorHazir(tarayiciKlasoru(h));
  else {
    giris.asama = "izin";
    tarayiciTutamak = h;
  }
}
let tarayiciTutamak: FileSystemDirectoryHandle | null = null;
/** tarayıcı: kayıtlı klasöre yeniden izin (düğmeye basınca) */
export async function izinVer() {
  await is(async () => {
    if (!tarayiciTutamak || !(await tarayiciIzni(tarayiciTutamak, true))) throw new Error("Klasöre erişim izni verilmedi.");
    await klasorHazir(tarayiciKlasoru(tarayiciTutamak));
  });
}
/** klasör seçme penceresi */
export async function klasorSec() {
  await is(async () => {
    if (masaustuMu()) {
      const yol = await masaustuKlasorSec("Ortak klasörü seçin");
      if (!yol) return;
      kayitYaz(YOL_ANAHTAR, yol);
      giris.klasorAdi = yol;
      await klasorHazir(masaustuKlasoru(yol));
      return;
    }
    const sec = (window as unknown as { showDirectoryPicker?: (o: object) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker;
    if (!sec) throw new Error("Bu tarayıcı klasör seçmeyi desteklemiyor; Edge ya da Chrome kullanın.");
    let h: FileSystemDirectoryHandle;
    try {
      h = await sec({ id: "nobet-klasor", mode: "readwrite" });
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      throw e;
    }
    if (!(await tarayiciIzni(h, true))) throw new Error("Klasöre yazma izni verilmedi.");
    await tutamakYaz("veri", h);
    giris.klasorAdi = h.name;
    await klasorHazir(tarayiciKlasoru(h));
  });
}
/** masaüstü: yolu yazarak klasör açma (ör. \\sunucu\eczane) */
export async function klasorYoluAc(yol: string) {
  await is(async () => {
    const t = yol.trim();
    if (!t) throw new Error("Klasörün yolunu yazın.");
    if (!(await masaustuKokEkle(t))) throw new Error(`Bu klasöre ulaşılamadı: ${t}`);
    kayitYaz(YOL_ANAHTAR, t);
    giris.klasorAdi = t;
    await klasorHazir(masaustuKlasoru(t));
  });
}
export function baskaKlasor() {
  giris.asama = "klasor";
  giris.hata = "";
  giris.bilgi = "";
}
async function klasorHazir(k: Klasor) {
  klasor = k;
  giris.hata = "";
  try {
    const kasa = await kasaOku(k, yerelIzDeposu);
    giris.asama = kasa ? "giris" : "kur";
  } catch (e) {
    giris.hata = hataMetni(e);
    giris.eskiKopya = (e as KasaHatasi)?.code === "eski";
    giris.asama = "giris";
  }
}
/** "eski kopya" uyarısında: bu bilgisayar kasanın daha yeni sürümünü unutur (yedekten dönülüyorsa) */
export async function eskiKopyayiKabulEt() {
  await is(async () => {
    const m = klasor ? await klasor.oku(KASA_DOSYASI) : null;
    const id = m ? kasaKimligi(m) : null;
    if (id) kasaIziniUnut(id);
    if (klasor) await klasorHazir(klasor);
  });
}

// ---------- kurulum ve giriş ----------
/** tarayıcıda klasör kipine geçmeden önceki (şifresiz) veriler: kasaya aktarılabilir */
export function aktarilabilirVeri(): Veri | null {
  try {
    const s = localStorage.getItem("nobet-cizelgesi-v2");
    if (!s) return null;
    const v = veriyiDogrula(guvenliJson(s));
    return v.staff.length || Object.keys(v.schedules).length ? v : null;
  } catch {
    return null;
  }
}
export async function kasaKur(o: { ad: string; kullaniciAdi: string; sifre: string; aktar: boolean }) {
  await is(async () => {
    if (!klasor) throw new Error("Önce klasörü seçin.");
    const r = await kasaOlustur(klasor, o);
    aktarilacak = o.aktar ? aktarilabilirVeri() : null;
    bekleyenOturum = r.oturum;
    giris.kurtarmaKodu = r.kurtarmaKodu;
    giris.asama = "kod";
    kayitYaz(AD_ANAHTAR, r.oturum.ben.kullaniciAdi);
  });
}
/** kurtarma anahtarı kaydedildi: oturum açılır */
export async function kodKaydedildi() {
  const o = bekleyenOturum;
  bekleyenOturum = null;
  giris.kurtarmaKodu = "";
  if (o) await oturumuAc(o);
}
let yanlis = 0,
  bekleSon = 0;
export async function girisYapIste(kullaniciAdi: string, sifre: string) {
  if (Date.now() < bekleSon) {
    giris.hata = `Çok fazla yanlış deneme. ${Math.ceil((bekleSon - Date.now()) / 1000)} saniye sonra yeniden deneyin.`;
    return;
  }
  await is(async () => {
    if (!klasor) throw new Error("Önce klasörü seçin.");
    let o: Oturum;
    try {
      o = await girisYap(klasor, kullaniciAdi, sifre);
    } catch (e) {
      if ((e as KasaHatasi)?.code === "giris" && ++yanlis >= 5) {
        bekleSon = Date.now() + 30_000;
        yanlis = 0;
      }
      throw e;
    }
    yanlis = 0;
    kayitYaz(AD_ANAHTAR, o.ben.kullaniciAdi);
    giris.sonKullanici = o.ben.kullaniciAdi;
    if (o.sifreDegismeli) {
      bekleyenOturum = o;
      geciciSifre = sifre;
      giris.asama = "sifre";
      return;
    }
    await oturumuAc(o);
  });
}
/** sahibin verdiği geçici şifreyle ilk girişte yeni şifre */
export async function ilkSifreBelirle(yeni: string) {
  await is(async () => {
    const o = bekleyenOturum;
    if (!o) throw new Error("Oturum yok; yeniden giriş yapın.");
    await o.sifreDegistir(geciciSifre, yeni);
    geciciSifre = "";
    bekleyenOturum = null;
    await oturumuAc(o);
  });
}
export const kurtarmaAc = () => {
  giris.asama = "kurtarma";
  giris.hata = "";
};
export const giriseDon = () => {
  giris.asama = "giris";
  giris.hata = "";
};
export async function kurtar(kod: string, kullaniciAdi: string, yeni: string) {
  await is(async () => {
    if (!klasor) throw new Error("Önce klasörü seçin.");
    await kurtarmaIleSifirla(klasor, kod, kullaniciAdi, yeni);
    giris.asama = "giris";
    giris.bilgi = "Şifre yenilendi; yeni şifreyle giriş yapın.";
  });
}

// ---------- açık oturum ----------
let sonIslem = Date.now(),
  bosZaman: ReturnType<typeof setInterval> | undefined,
  kasaZaman: ReturnType<typeof setInterval> | undefined;
async function oturumuAc(o: Oturum) {
  oturum = o;
  const db = klasorDb(o);
  platformu = klasorPlatformu(o, db);
  platformAyarla(platformu);
  giris.ad = o.ben.ad;
  kasaGoster(o);
  o.dinle(x => {
    if (x.iptal) void cikisYap(x.iptal.mesaj);
    else {
      giris.ad = x.ben.ad;
      kasaGoster(x);
      kimlikGuncelle({ ad: x.ben.ad, rol: x.ben.rol, adlar: Object.fromEntries(x.kasa.imzali.kisiler.map(k => [k.id, k.ad])) });
    }
  });
  // kasa (kişiler, roller, anahtarlar) birkaç saniyede bir denetlenir: kaldırılan kişinin oturumu kapanır
  kasaZaman = setInterval(() => void o.tazele(4000).catch(() => {}), 5000);
  // işlem yapılmazsa oturum kapanır
  sonIslem = Date.now();
  for (const t of ["pointerdown", "keydown", "wheel", "touchstart"]) addEventListener(t, () => (sonIslem = Date.now()), { passive: true });
  bosZaman = setInterval(() => {
    if (Date.now() - sonIslem > OTURUM_SURE_DK * 60_000)
      void cikisYap(`${OTURUM_SURE_DK} dakika işlem yapılmadığı için oturum kapatıldı. Yeniden giriş yapın.`);
  }, 30_000);
  // tarayıcıda: eşitlenmemiş değişiklik varken sayfa kapatılırsa sorulur (masaüstünde: aşağıda, kapanma isteği)
  if (!masaustuMu())
    addEventListener("beforeunload", e => {
      if (kapanisOnaylandi) return;
      if (bekleyenVarMi()) e.preventDefault();
    });
  if (aktarilacak) {
    const v = aktarilacak;
    aktarilacak = null;
    const { kaynakBelirt, tumVeriyiDegistir } = await import("../depo.svelte");
    kaynakBelirt("yukleme");
    tumVeriyiDegistir(v);
    aktarimSonrasiSil = true;
  }
  giris.asama = "acik";
  giris.bilgi = "";
  if (o.sahipMi && o.kasa.imzali.bakim) void bakimYap();
  void gunlukYedek();
}
let aktarimSonrasiSil = false,
  kapanisOnaylandi = false;
/** aktarılan şifresiz tarayıcı verisi, klasöre yazılınca silinir */
export async function aktarimiTamamla() {
  if (!aktarimSonrasiSil) return;
  const { bulut } = await import("../bulut.svelte");
  if (bulut.durum !== "esit") return;
  aktarimSonrasiSil = false;
  try {
    const l: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith("nobet-cizelgesi-v2")) l.push(k);
    }
    for (const k of l) localStorage.removeItem(k);
  } catch {
    /* depolama yok */
  }
}
function bekleyenVarMi(): boolean {
  return bekleyenKontrol?.() ?? false;
}
let bekleyenKontrol: (() => boolean) | null = null;
async function bekleyenleriYaz() {
  const [{ bulutBekleyeniYaz, bulutBekleyenVar }, { sunucuGecmisiYaz }, { bekleyenKaydiYaz }] = await Promise.all([
    import("../bulut.svelte"),
    import("../sunucuGecmis.svelte"),
    import("../depo.svelte"),
  ]);
  bekleyenKontrol = bulutBekleyenVar;
  bekleyenKaydiYaz();
  await bulutBekleyeniYaz(8000).catch(() => false);
  await sunucuGecmisiYaz().catch(() => {});
}
void import("../bulut.svelte").then(m => (bekleyenKontrol = m.bulutBekleyenVar));
// masaüstünde pencere kapatılırken: açık oturumda bekleyen değişiklikler önce ortak klasöre yazılır, sonra kapanır
if (masaustuMu())
  void tauri().event.listen("kapanma-istegi", async () => {
    if (oturum && !oturum.iptal) await bekleyenleriYaz().catch(() => {});
    await platformu?.kapat().catch(() => {});
    await tauri().core.invoke("uygulamayi_kapat");
  });

/** oturumu kapatır: bekleyen değişiklikler yazılır, sayfa yenilenir (bellekteki veri ve anahtarlar silinir) */
export async function cikisYap(mesaj = "") {
  if (giris.mesgul && giris.asama !== "acik") return;
  giris.mesgul = true;
  clearInterval(bosZaman);
  clearInterval(kasaZaman);
  if (oturum && !oturum.iptal) await bekleyenleriYaz();
  await platformu?.kapat().catch(() => {});
  try {
    if (mesaj) sessionStorage.setItem(CIKIS_MESAJI, mesaj);
  } catch {
    /* yok */
  }
  kapanisOnaylandi = true;
  location.reload();
}

// ---------- bakım ve yedek ----------
export const bakimDurumu = $state({ calisiyor: false, oran: 0, sonuc: "" });
/** kasa değişikliğinden sonra kayıtları yeniler (sahip): kullanıcı kaldırma, şifre sıfırlama, yöneticilikten çıkarma */
export async function bakimYap(eskiYoneticiler: string[] = []) {
  if (!oturum?.sahipMi || bakimDurumu.calisiyor) return;
  bakimDurumu.calisiyor = true;
  bakimDurumu.oran = 0;
  try {
    const r = await belgeleriYenile(oturum, { eskiYoneticiler, ilerleme: (b, t) => (bakimDurumu.oran = t ? b / t : 1) });
    bakimDurumu.sonuc = r.kalan
      ? `${r.yenilenen} kayıt yenilendi; ${r.kalan} kayıt o sırada kullanımdaydı, sonraki girişinizde yenilenecek.`
      : r.yenilenen
        ? `${r.yenilenen} kayıt yeni anahtar ve imzayla yenilendi.`
        : "";
  } catch (e) {
    bakimDurumu.sonuc = "Kayıtlar yenilenemedi: " + hataMetni(e);
  } finally {
    bakimDurumu.calisiyor = false;
  }
}

let yedekKlasoru: Klasor | null = null;
async function yedekKlasorunuAc(iste: boolean): Promise<Klasor | null> {
  if (yedekKlasoru) return yedekKlasoru;
  if (masaustuMu()) {
    const yol = kayitOku(YEDEK_YOL_ANAHTAR);
    yedekDurumu.hedef = yol;
    if (!yol || !(await masaustuKokEkle(yol).catch(() => false))) return null;
    return (yedekKlasoru = masaustuKlasoru(yol));
  }
  const h = await tutamakOku("yedek");
  yedekDurumu.hedef = h?.name ?? "";
  if (!h || !(await tarayiciIzni(h, iste).catch(() => false))) return null;
  return (yedekKlasoru = tarayiciKlasoru(h));
}
/** yedek klasörünü seçer (bu bilgisayar için) */
export async function yedekKlasoruSec() {
  yedekDurumu.hata = "";
  try {
    if (masaustuMu()) {
      const yol = await masaustuKlasorSec("Yedek klasörünü seçin (USB bellek ya da başka bir ağ klasörü)");
      if (!yol) return;
      kayitYaz(YEDEK_YOL_ANAHTAR, yol);
      yedekKlasoru = masaustuKlasoru(yol);
      yedekDurumu.hedef = yol;
    } else {
      const sec = (window as unknown as { showDirectoryPicker?: (o: object) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker;
      if (!sec) return;
      const h = await sec({ id: "nobet-yedek", mode: "readwrite" });
      if (!(await tarayiciIzni(h, true))) return;
      await tutamakYaz("yedek", h);
      yedekKlasoru = tarayiciKlasoru(h);
      yedekDurumu.hedef = h.name;
    }
    await yedekAl(true);
  } catch (e) {
    if ((e as Error)?.name !== "AbortError") yedekDurumu.hata = hataMetni(e);
  }
}
export async function yedekKlasorunuKaldir() {
  if (masaustuMu()) kayitYaz(YEDEK_YOL_ANAHTAR, null);
  else await tutamakYaz("yedek", null);
  yedekKlasoru = null;
  yedekDurumu.hedef = "";
  yedekDurumu.liste = [];
  yedekDurumu.son = null;
}
/** yedek alır (zorla: bugün alınmış olsa da) */
export async function yedekAl(zorla = false, iste = true) {
  if (!klasor || yedekDurumu.calisiyor) return;
  yedekDurumu.calisiyor = true;
  yedekDurumu.hata = "";
  try {
    const h = await yedekKlasorunuAc(iste);
    if (!h) return;
    const b = await klasoruYedekle(klasor, h, { zorla });
    yedekDurumu.liste = await yedekler(h);
    yedekDurumu.son = b ?? yedekDurumu.liste[0] ?? null;
  } catch (e) {
    yedekDurumu.hata = "Yedek alınamadı: " + hataMetni(e);
  } finally {
    yedekDurumu.calisiyor = false;
  }
}
/** girişten sonra günde bir kez (izin istemeden ulaşılabiliyorsa) */
async function gunlukYedek() {
  await yedekAl(false, false);
}
export async function yedekListesi() {
  const h = await yedekKlasorunuAc(false);
  yedekDurumu.liste = h ? await yedekler(h) : [];
}
/** yedek klasöründeki bir günün verilerini okur (o günkü kasayla: kendi kullanıcı adınız ve o günkü şifrenizle) */
export async function yedektenVeriOku(gun: string, sifre: string): Promise<Veri> {
  const h = await yedekKlasorunuAc(true);
  if (!h || !oturum) throw new Error("Yedek klasörüne ulaşılamadı.");
  const alt = altKlasor(h, "eczane-yedek-" + gun);
  const o = await girisYap(alt, oturum.ben.kullaniciAdi, sifre, { iz: bellekIzDeposu() });
  const db = klasorDb(o);
  try {
    const ana = await db.doc("nobet/ana").get();
    const a = ana.data();
    if (!ana.exists || typeof a?.json !== "string") throw new Error("Bu yedekte çizelge verisi yok.");
    const aylar: Record<string, string> = {};
    for (const b of (await db.collection("nobet/ana/aylar").limit(1000).get()).docs) {
      const j = b.data()?.json;
      if (typeof j === "string") aylar[b.id] = j;
    }
    const y = await db.doc("nobet/yonetim").get();
    const yj = y.exists ? y.data()?.json : undefined;
    const p: Parcalar = { ana: a.json, aylar, ...(typeof yj === "string" ? { yonetim: yj } : {}) };
    return veriyiDogrula(birlestir(p, guvenliJson));
  } finally {
    db.kapat();
  }
}

// ---------- kullanıcı yönetimi (sahip) ve kendi şifresi ----------
function oturumGerek(): Oturum {
  if (!oturum) throw new Error("Oturum yok.");
  return oturum;
}
export async function sifremiDegistir(eski: string, yeni: string) {
  await oturumGerek().sifreDegistir(eski, yeni);
}
export async function kullaniciEkle(o: { ad: string; kullaniciAdi: string; sifre: string; rol: KasaRol }) {
  const ot = oturumGerek();
  await ot.kullaniciEkle(o);
  kasaGoster(ot);
}
export async function kullaniciRolu(id: string, rol: KasaRol) {
  const ot = oturumGerek();
  const r = await ot.kullaniciGuncelle(id, { rol });
  kasaGoster(ot);
  if (r.yoneticilikten) await bakimYap([r.yoneticilikten]);
}
export async function kullaniciAdiniDegistir(id: string, ad: string) {
  const ot = oturumGerek();
  await ot.kullaniciGuncelle(id, { ad });
  kasaGoster(ot);
}
export async function kullaniciSifresiniYenile(id: string, gecici: string) {
  const ot = oturumGerek();
  await ot.sifreSifirla(id, gecici);
  kasaGoster(ot);
  await bakimYap();
}
export async function kullaniciyiKaldir(id: string) {
  const ot = oturumGerek();
  const k = ot.kisi(id);
  await ot.kullaniciKaldir(id);
  kasaGoster(ot);
  await bakimYap(k && (k.rol === "sahip" || k.rol === "duzenleyen") ? [id] : []);
}
export async function kurtarmaAnahtariniYenile(): Promise<string> {
  return oturumGerek().kurtarmaYenile();
}
/** geçici şifre önerisi (karışan harfler yok) */
export function geciciSifreUret(): string {
  const a = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), x => a[x % a.length]).join("");
}
