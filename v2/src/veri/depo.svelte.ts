// Uygulama durumu ve tarayıcıda saklanması. Veriler yalnız bu tarayıcıda durur; taşımak için yedek dosyası kullanılır.
// Ortak klasör kipinde tarayıcı kaydı yerine bellek kullanılır (veri/saklama.ts); asıl kayıt klasördeki kasadır.
// Burada: durum (depo), kayıt, geri al / yinele. Konu konu işlemler ayrı modüllerde; hepsi buradan da dışa verilir:
// kişiler (kisiler), izin ve tatil işaretleri (izinler), çizelge (cizelge), acil / onay / öğlen listeleri ve puantaj
// kodları (listeler), yedek (yedek). Modüller birbirini yalnız işlev içinden çağırır (yükleme sırası önemsiz).
import type { Veri } from "./tipler";
import { haftaAnahtari } from "./tarih";
import { oglenOnarimlariHesapla } from "../motor";

// biçim ve doğrulama ayrı modülde (veri/dogrulama.ts); eski içe aktarmalar bozulmasın diye buradan da verilir
export { AYAR_VARSAYILAN, AYAR_SINIR, bosVeri, guvenliJson, gunDuzeniDogrula, veriyiDogrula } from "./dogrulama";
import { KAYIT_ANAHTARI as ANAHTAR, bosVeri, guvenliJson, veriyiDogrula } from "./dogrulama";
import { oglenKaydet } from "./listeler.svelte";
import { degisiklikIsle, gunlukBosalt, gunlukKopyaAl, kaynakBelirt } from "./gunluk.svelte";
import { klasorKipi, yerel } from "./saklama";

let acilisSorunu = "";
function yukle(): Veri {
  let s: string | null = null;
  try {
    s = yerel.getItem(ANAHTAR);
  } catch {
    return bosVeri();
  }
  if (!s) return bosVeri();
  try {
    return veriyiDogrula(guvenliJson(s));
  } catch {
    // kayıt okunamadı: boş veri kaydedilmeden önce ham hali ayrı anahtara alınır, kullanıcıya söylenir
    try {
      yerel.setItem(ANAHTAR + "-okunamayan", s);
    } catch {
      /* yer yoksa yapılacak bir şey yok */
    }
    acilisSorunu =
      "Bu tarayıcıdaki kayıtlı veriler okunamadı; uygulama boş açıldı. Okunamayan kayıt ayrıca saklandı. Yedeğiniz varsa Ayarlar > Yedekten yükle ile geri alın.";
    return bosVeri();
  }
}

const bugun = new Date();
export const depo = $state({
  veri: yukle(),
  yil: bugun.getFullYear(),
  ay: bugun.getMonth(),
  /** tarayıcı kaydı yazamazsa gösterilecek uyarı */
  kayitSorunu: acilisSorunu,
  /** veriler başka bir pencerede (sekmede) değişti: bu pencere kaydetmez, yenilenmesi gerekir */
  baskaPencere: false,
});

/** Düz (proxy'siz) derin kopya. Svelte'in anlık görüntü işlevi her yaprak değerde structuredClone çağırdığından büyük
 *  veride çok yavaş; veri yalnız düz nesne, dizi ve ilkel değerlerden oluşur (JSON'a yazılan biçim). */
export function duzKopya<T>(x: T): T {
  if (Array.isArray(x)) {
    const k = new Array(x.length);
    for (let i = 0; i < x.length; i++) k[i] = duzKopya(x[i]);
    return k as T;
  }
  if (x !== null && typeof x === "object") {
    const k: Record<string, unknown> = {};
    for (const a of Object.keys(x)) k[a] = duzKopya((x as Record<string, unknown>)[a]);
    return k as T;
  }
  return x;
}
/** Durum (state) nesnesinde k alanını yoksa kurar ve alanın kendisini (izlenen hâlini) verir. "(o[k] ??= {})" atanan ham
 *  nesneyi döndürür; ona yazılan değişiklik izlenmez (Svelte uyarısı: assignment_value_stale). */
export function alan<T>(o: Record<string, T>, k: string | number, yeni: () => NoInfer<T>): T {
  if (o[k] === undefined) o[k] = yeni();
  return o[k];
}
// Verinin tek ortak kopyası: veri değişince bir kez alınır; motor hesapları (yalnız okur), kayıt ve geri alma bunu kullanır.
// Bu kopya değiştirilmez: üzerinde değişiklik yapacak iş duzKopya(depo.veri) ile kendi kopyasını alır.
const anlik = $derived(duzKopya(depo.veri));
export const veriAnlik = (): Veri => anlik;

/** Sonradan girilen izin / rapor vb. öğlen nöbetini bozduysa bugünden sonraki eksikler kendiliğinden doldurulur
 *  (elle düzenlenen ve geçmiş günler değişmez); onarım, onu doğuran değişiklikle aynı geri alma adımına girer. */
function oglenOnar() {
  if (!Object.keys(depo.veri.oglen).length) return;
  const b = new Date();
  try {
    for (const o of oglenOnarimlariHesapla(veriAnlik(), b.getFullYear() * 10000 + (b.getMonth() + 1) * 100 + b.getDate()))
      oglenKaydet(o.y, o.m, o.gunler, true);
  } catch {
    /* onarım yapılamazsa kayıt yine yazılır; ekranda bozuk günler işaretli kalır */
  }
}
let kayitZamanlayici: ReturnType<typeof setTimeout> | undefined;
// son yazılan hâl: değişiklik geçmişi bununla karşılaştırır (açılıştaki ilk kayıt geçmişe girmez)
let sonKaydedilen: Veri | null = null;
/** yerel kayıt kapalı: erişimi kaldırılan hesapta bu tarayıcıdaki veriler silindi, bu oturumda bir daha yazılmaz */
let yerelKayitKapali = false;
function simdiKaydet() {
  clearTimeout(kayitZamanlayici);
  kayitZamanlayici = undefined;
  if (yerelKayitKapali) return;
  // başka pencere yeni veriyi yazdıysa bu penceredeki eski veriyle üzerine yazılmaz
  if (depo.baskaPencere) return;
  oglenOnar();
  gecmiseIsle();
  const v = veriAnlik();
  degisiklikIsle(sonKaydedilen, v);
  sonKaydedilen = v;
  try {
    yerel.setItem(ANAHTAR, JSON.stringify(v));
    gunlukKopyaAl(v);
    if (depo.kayitSorunu !== acilisSorunu && !depo.baskaPencere) depo.kayitSorunu = "";
  } catch {
    depo.kayitSorunu =
      "Veriler bu tarayıcıya kaydedilemedi (gizli pencere ya da depolama dolu olabilir). Sayfayı kapatmadan önce Ayarlar'dan yedek alın.";
  }
}
function kaydet() {
  clearTimeout(kayitZamanlayici);
  kayitZamanlayici = setTimeout(simdiKaydet, 150);
}
/** Bekleyen kayıt varsa hemen yazar: değişiklikten hemen sonra sayfa kapanır ya da arka plana alınırsa (telefonda sekme
 *  kapatma, uygulama değiştirme) son değişiklik kaybolmasın */
export function bekleyenKaydiYaz() {
  if (kayitZamanlayici !== undefined) simdiKaydet();
}
$effect.root(() => {
  $effect(() => {
    veriAnlik();
    kaydet();
  });
});
// aynı tarayıcıda başka bir pencere (sekme) veriyi değiştirince: bu pencere kaydetmeyi durdurur ve uyarır
export const BASKA_PENCERE_UYARISI =
  "Veriler başka bir pencerede değiştirildi. Bu penceredeki değişiklikler artık kaydedilmiyor; güncel verilerle devam etmek için sayfayı yenileyin.";
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", bekleyenKaydiYaz);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") bekleyenKaydiYaz();
  });
}
// (ortak klasör kipinde veri bellekte: pencereler birbirini etkilemez)
if (typeof window !== "undefined" && !klasorKipi)
  window.addEventListener("storage", e => {
    if (e.key !== ANAHTAR && e.key !== null) return;
    clearTimeout(kayitZamanlayici);
    kayitZamanlayici = undefined;
    depo.baskaPencere = true;
    depo.kayitSorunu = BASKA_PENCERE_UYARISI;
  });

// ---------- geri al / yinele (eski uygulamadaki gibi) ----------
// Her kayıtta verinin görüntüsü alınır. Servis dağıtım kaydı görüntüye girmez: puantaja göre kendiliğinden
// yeniden hesaplanır. Art arda çok hızlı değişiklikler (sürükleyerek işaretleme, yazı yazma) tek adım sayılır.
// Onay bir geri alma noktasıdır: onaydan önceki adımlara dönülmez, geri alma onayı kaldırmaz.
// Geçmiş yalnız bu oturumda tutulur (sayfa yenilenince sıfırlanır).
const GECMIS_SINIR = 30,
  GRUPLAMA_MS = 350;
export const gecmis = $state({ geri: [] as string[], ileri: [] as string[] });
let sonGoruntu: string | null = null,
  sonEkleme = 0;
const goruntu = () => JSON.stringify({ ...veriAnlik(), servisKayit: undefined });

/** Son kayıttan bu yana değişiklik varsa önceki görüntü geri alma yığınına girer (kayıt sırasında çağrılır) */
export function gecmiseIsle() {
  const t = goruntu();
  if (sonGoruntu === null) {
    sonGoruntu = t;
    return;
  }
  if (t === sonGoruntu) return;
  const su = Date.now();
  if (su - sonEkleme > GRUPLAMA_MS || !gecmis.geri.length) {
    gecmis.geri.push(sonGoruntu);
    if (gecmis.geri.length > GECMIS_SINIR) gecmis.geri.shift();
  }
  sonEkleme = su;
  gecmis.ileri = [];
  sonGoruntu = t;
}
/** Bu tarayıcıdaki bütün kayıtları siler: veri, tarayıcıdaki değişiklik geçmişi, günlük kopyalar, yükleme öncesi kopya,
 *  eşitleme izi (hepsi KAYIT_ANAHTARI ile başlar). Sayfadaki veri boşalır; bu oturumda tarayıcıya bir daha yazılmaz,
 *  değişiklik geçmişine kayıt düşülmez. Erişimi kaldırılan hesap için (veri/bulut.svelte.ts). */
export function yerelVerileriSil() {
  yerelKayitKapali = true;
  clearTimeout(kayitZamanlayici);
  kayitZamanlayici = undefined;
  const bos = bosVeri();
  sonKaydedilen = bos;
  depo.veri = bos;
  gecmisiSifirla();
  gunlukBosalt();
  try {
    const l: string[] = [];
    for (let i = 0; i < yerel.length; i++) {
      const k = yerel.key(i);
      if (k?.startsWith(ANAHTAR)) l.push(k);
    }
    for (const k of l) yerel.removeItem(k);
  } catch {
    /* depolama yok */
  }
}
/** Geri alma noktası: önceki adımlar unutulur */
export function gecmisiSifirla() {
  gecmis.geri = [];
  gecmis.ileri = [];
  sonGoruntu = goruntu();
}
function goruntuyuUygula(t: string) {
  const simdi = duzKopya(depo.veri);
  const v = veriyiDogrula(JSON.parse(t));
  v.servisKayit = simdi.servisKayit;
  // onay geri alma ile değişmez: onaylı çizelge olduğu gibi kalır, onaysız ayın onayı geri gelmez
  for (const [k, c] of Object.entries(simdi.schedules)) if (c.onay) v.schedules[k] = c;
  for (const [k, c] of Object.entries(v.schedules)) if (c.onay && !simdi.schedules[k]?.onay) delete c.onay;
  // acil / öğlen listesi onayı da geri almayla değişmez: onaylı ayın listesi ve onayı olduğu gibi kalır
  v.listeOnay = simdi.listeOnay;
  for (const ayK of Object.keys(simdi.listeOnay.acil)) {
    if (simdi.acil[ayK]) v.acil[ayK] = simdi.acil[ayK];
    else delete v.acil[ayK];
    if (simdi.acilElle[ayK]) v.acilElle[ayK] = simdi.acilElle[ayK];
    else delete v.acilElle[ayK];
  }
  // öğlen nöbeti: onaylı haftalar olduğu gibi kalır; onay listesi onaysız haftada öğlen nöbeti olmaz
  const ogGunleri = (x: Veri) =>
    Object.entries(x.oglen).flatMap(([ayK, a]) => {
      const [y, m] = ayK.split("-").map(Number);
      return Object.keys(a).map(g => ({ y, m, g: Number(g), ayK }));
    });
  for (const { y, m, g, ayK } of ogGunleri(v))
    if (simdi.listeOnay.oglen[haftaAnahtari(y, m, g)] || !simdi.listeOnay.onay[haftaAnahtari(y, m, g)]) {
      delete v.oglen[ayK][g];
      if (!Object.keys(v.oglen[ayK]).length) delete v.oglen[ayK];
    }
  for (const { y, m, g, ayK } of ogGunleri(simdi))
    if (simdi.listeOnay.oglen[haftaAnahtari(y, m, g)]) (v.oglen[ayK] ??= {})[g] = simdi.oglen[ayK][g];
  depo.veri = v;
  sonGoruntu = goruntu();
}
/** Son değişikliği geri alır; geri alınacak bir şey yoksa false */
export function geriAl(): boolean {
  gecmiseIsle(); // henüz kayda girmemiş son değişiklik de bir adım sayılır
  const t = gecmis.geri.pop();
  if (t === undefined) return false;
  gecmis.ileri.push(sonGoruntu!);
  kaynakBelirt("geri");
  goruntuyuUygula(t);
  return true;
}
/** Geri alınanı yineler; yinelenecek bir şey yoksa false */
export function yinele(): boolean {
  gecmiseIsle();
  const t = gecmis.ileri.pop();
  if (t === undefined) return false;
  gecmis.geri.push(sonGoruntu!);
  kaynakBelirt("yinele");
  goruntuyuUygula(t);
  return true;
}

export * from "./kisiler.svelte";
export * from "./izinler.svelte";
export * from "./cizelge.svelte";
export * from "./listeler.svelte";
export * from "./yedek.svelte";
export * from "./gunluk.svelte";
export * from "./notlar.svelte";
