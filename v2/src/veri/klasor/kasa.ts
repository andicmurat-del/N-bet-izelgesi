// Kasa: ortak klasördeki "kasa.json". Kullanıcılar, rolleri, açık anahtarları ve her kullanıcıya sarılmış veri anahtarı
// burada durur; veriler (veri/…) bu anahtarla şifrelidir. Sunucu yoktur: kimin ne yapabileceğini kasanın imzası ve
// kayıtlardaki imzalar belirler.
//
// - Giriş: kullanıcı adı + şifre → PBKDF2 → kişinin gizli anahtarları açılır → kendisine sarılmış veri anahtarı çözülür.
//   Şifre hiçbir yerde saklanmaz; unutulursa sahip (ya da kurtarma anahtarı) yeni şifre verir.
// - Kasa imzası: kullanıcı listesini, rolleri, açık anahtarları ve sarılmış anahtarları yalnız sahip değiştirebilir (kasa
//   imza anahtarı yalnız sahiplere sarılıdır). Bu bilgisayar kasanın imza anahtarını ve son sürümünü hatırlar: kasa
//   başkasıyla ya da eski bir kopyayla değiştirilirse açılmaz.
// - Herkes yalnız kendi giriş bilgisini (şifre değiştirme) yazabilir; o bölüm imzalı değildir ama yalnız kendi şifresiyle
//   açılır: başkası değiştirirse yalnız o kişinin girişi bozulur, kimse onun yerine giremez.
// - Kurtarma anahtarı: kasa kurulurken bir kez gösterilir. Bütün şifreler unutulursa sahibin şifresini yeniler.
// - Kullanıcı kaldırılınca veri anahtarı yenilenir (yeni nesil): kaldırılan kişi eski bir kasa kopyası saklamış olsa da
//   bundan sonraki verileri açamaz.
import { kararliJson } from "../bulutBicim";
import type { Klasor } from "./dosya";
import {
  ac,
  acigi,
  anahtarCiftiUret,
  ayniAnahtar,
  b64,
  ecdhGizli,
  b64Coz,
  baytMetin,
  dogrula,
  dogrulamaAnahtari,
  gizliAnahtarlar,
  imzala,
  kapat,
  kimlikUret,
  kurtarmaKoduDuzelt,
  kurtarmaKoduUret,
  metinBayt,
  parmakIzi,
  rastgele,
  sar,
  sarmaAc,
  sifredenAnahtar,
  veriAnahtari,
  veriAnahtariUret,
  type AcikAnahtarlar,
  type GizliAnahtarlar,
  type Paket,
  type Sarili,
} from "./sifre";

export const KASA_DOSYASI = "kasa.json",
  KASA_KILIDI = "kasa.lock";
/** şifreden anahtar türetme tekrar sayısı (OWASP önerisi); testlerde düşük verilir */
export const SIFRE_TEKRAR = 600_000;
export type KasaRol = "sahip" | "duzenleyen" | "katkida";
export const KASA_ROL_ADI: Record<KasaRol, string> = { sahip: "Sahip", duzenleyen: "Baş sorumlu", katkida: "Sorumlu" };
export const yoneticiRolu = (r: KasaRol) => r === "sahip" || r === "duzenleyen";

export interface KasaKisi {
  id: string;
  kullaniciAdi: string;
  ad: string;
  rol: KasaRol;
  durum: "aktif" | "kaldirildi";
  acik: AcikAnahtarlar;
  /** şifre sıfırlanmadan önceki imza anahtarları: eski kayıtlar doğrulanabilsin */
  eskiImza?: JsonWebKey[];
  olusturma: number;
}
export interface Giris {
  tuz: string;
  tekrar: number;
  gizli: Paket;
  /** sahip verdiği geçici şifreyle ilk girişte yeni şifre istenir */
  sifreDegismeli?: boolean;
}
export interface KasaImzali {
  id: string;
  olusturma: number;
  imzaAnahtari: JsonWebKey;
  kisiler: KasaKisi[];
  /** veri anahtarı nesilleri: nesil → (kişi | "kurtarma") → sarılı anahtar */
  anahtarlar: Record<string, Record<string, Sarili>>;
  guncel: string;
  /** kasa imza anahtarı (gizli): sahip | "kurtarma" → sarılı */
  kasaGizli: Record<string, Sarili>;
  kurtarmaAcik: JsonWebKey;
  /** eski anahtarla ya da kaldırılan kişinin imzasıyla kalan kayıtlar var: sahip girince yenilenir */
  bakim?: boolean;
  degisme: number;
  degistiren: string;
}
export interface KasaDosyasi {
  bicim: "eczane-nobet-kasa";
  surum: 1;
  imzali: KasaImzali;
  imza: string;
  /** kişi | "kurtarma" → giriş bilgisi (imzasız; yalnız kendi şifresiyle açılır) */
  giris: Record<string, Giris>;
}

/** kullanıcıya gösterilecek hata */
export class KasaHatasi extends Error {
  constructor(
    message: string,
    public code = "kasa",
  ) {
    super(message);
  }
}

// ---------- bu bilgisayarın hatırladıkları ----------
export interface IzDeposu {
  oku(kasa: string): { p: string; d: number } | null;
  yaz(kasa: string, iz: { p: string; d: number }): void;
}
const IZ_ANAHTAR = "nobet-kasa-izleri";
export const yerelIzDeposu: IzDeposu = {
  oku(k) {
    try {
      const o = JSON.parse(localStorage.getItem(IZ_ANAHTAR) || "{}")[k];
      return o && typeof o.p === "string" ? { p: o.p, d: Number(o.d) || 0 } : null;
    } catch {
      return null;
    }
  },
  yaz(k, iz) {
    try {
      const o = JSON.parse(localStorage.getItem(IZ_ANAHTAR) || "{}");
      o[k] = iz;
      localStorage.setItem(IZ_ANAHTAR, JSON.stringify(o));
    } catch {
      /* hatırlanamazsa bir sonraki açılışta yeniden öğrenilir */
    }
  },
};
/** bu bilgisayarın bu kasa için hatırladığı sürümü unutur (yedekten geri dönülürken, kullanıcı onayıyla) */
export function kasaIziniUnut(kasaId: string) {
  try {
    const o = JSON.parse(localStorage.getItem(IZ_ANAHTAR) || "{}");
    delete o[kasaId];
    localStorage.setItem(IZ_ANAHTAR, JSON.stringify(o));
  } catch {
    /* depolama yok */
  }
}
/** kasa dosyasının kimliği (imzası denetlenmeden; yalnız "yine de aç" için) */
export function kasaKimligi(metin: string): string | null {
  try {
    return kasaCoz(metin).imzali.id;
  } catch {
    return null;
  }
}
export function bellekIzDeposu(): IzDeposu {
  const m = new Map<string, { p: string; d: number }>();
  return { oku: k => m.get(k) ?? null, yaz: (k, iz) => void m.set(k, iz) };
}

// ---------- doğrulama ----------
export const kullaniciAdiDuzelt = (s: string) => s.trim().toLocaleLowerCase("tr");
export function kullaniciAdiSorunu(s: string): string {
  const k = kullaniciAdiDuzelt(s);
  if (k.length < 3 || k.length > 32) return "Kullanıcı adı 3–32 karakter olmalı.";
  if (!/^[\p{L}\p{N}._-]+$/u.test(k)) return "Kullanıcı adında yalnız harf, rakam, nokta, tire ve alt çizgi olabilir.";
  return "";
}
export const SIFRE_EN_AZ = 8;
export function sifreSorunu(sifre: string, kullaniciAdi = ""): string {
  if (sifre.length < SIFRE_EN_AZ) return `Şifre en az ${SIFRE_EN_AZ} karakter olmalı.`;
  if (sifre.length > 200) return "Şifre çok uzun.";
  if (kullaniciAdi && kullaniciAdiDuzelt(sifre) === kullaniciAdiDuzelt(kullaniciAdi)) return "Şifre kullanıcı adıyla aynı olamaz.";
  return "";
}

const nesne = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
/** kasa dosyasını okur ve biçimini denetler (imza ayrıca: kasaDogrula) */
export function kasaCoz(metin: string): KasaDosyasi {
  let o: unknown;
  try {
    o = JSON.parse(metin);
  } catch {
    throw new KasaHatasi("Kasa dosyası (kasa.json) okunamadı: bozuk.");
  }
  if (!nesne(o) || o.bicim !== "eczane-nobet-kasa") throw new KasaHatasi("Bu klasördeki kasa.json bu programın kasası değil.");
  if (o.surum !== 1) throw new KasaHatasi("Kasa programın daha yeni bir sürümüyle oluşturulmuş; programı güncelleyin.");
  const i = o.imzali;
  if (
    !nesne(i) ||
    !Array.isArray(i.kisiler) ||
    !nesne(i.anahtarlar) ||
    typeof i.guncel !== "string" ||
    !nesne(o.giris) ||
    typeof o.imza !== "string"
  )
    throw new KasaHatasi("Kasa dosyası (kasa.json) eksik ya da bozuk.");
  return o as unknown as KasaDosyasi;
}
/** kasa imzasını ve bu bilgisayarın hatırladığı kasa anahtarını / sürümünü denetler */
export async function kasaDogrula(k: KasaDosyasi, iz: IzDeposu): Promise<void> {
  const ka = await dogrulamaAnahtari(k.imzali.imzaAnahtari).catch(() => null);
  if (!ka || !(await dogrula(ka, kararliJson(k.imzali), k.imza)))
    throw new KasaHatasi("Kasa dosyası değiştirilmiş: imza tutmuyor. Sahip, yedek klasöründeki kopyayı geri koymalı.", "imza");
  const p = await parmakIzi(k.imzali.imzaAnahtari);
  const eski = iz.oku(k.imzali.id);
  if (eski && eski.p !== p) throw new KasaHatasi("Bu klasördeki kasa, bu bilgisayarın tanıdığı kasa değil (anahtarı farklı).", "imza");
  if (eski && k.imzali.degisme < eski.d)
    throw new KasaHatasi("Kasa dosyası eski bir kopyayla değiştirilmiş (bu bilgisayar daha yeni bir sürümünü gördü).", "eski");
  if (!eski || eski.d !== k.imzali.degisme) iz.yaz(k.imzali.id, { p, d: Math.max(eski?.d ?? 0, k.imzali.degisme) });
}
export async function kasaOku(klasor: Klasor, iz: IzDeposu): Promise<KasaDosyasi | null> {
  const m = await klasor.oku(KASA_DOSYASI);
  if (m === null) return null;
  const k = kasaCoz(m);
  await kasaDogrula(k, iz);
  return k;
}

// ---------- kilit ----------
const bekle = (ms: number) => new Promise(r => setTimeout(r, ms));
/** kısa süreli kilit dosyası; alınamazsa bekler. Bırakma işlevini döner. */
export async function kilitle(klasor: Klasor, yol: string, sahip: string, ttl = 15000, deneme = 60): Promise<() => Promise<void>> {
  for (let i = 0; i < deneme; i++) {
    const simdi = Date.now();
    if (await klasor.olustur(yol, JSON.stringify({ h: sahip, b: simdi + ttl })))
      return async () => {
        try {
          const m = JSON.parse((await klasor.oku(yol)) || "null");
          if (m?.h === sahip) await klasor.sil(yol);
        } catch {
          /* süresi dolunca kendiliğinden geçersiz olur */
        }
      };
    let m: { h?: string; b?: number } | null = null;
    try {
      m = JSON.parse((await klasor.oku(yol)) || "null");
    } catch {
      m = null;
    }
    if (!m || !(Number(m.b) > simdi)) {
      await klasor.sil(yol);
      continue;
    }
    await bekle(200 + Math.random() * 300);
  }
  throw new KasaHatasi("Kasa başka bir bilgisayarda değiştiriliyor; biraz sonra yeniden deneyin.", "kilit");
}

// ---------- yardımcılar ----------
const sarmaEki = (nesil: string, kim: string) => `veri|${nesil}|${kim}`;
const kasaEki = (kim: string) => `kasa|${kim}`;
const girisEki = (kim: string) => `giris|${kim}`;

async function girisKur(kim: string, sifre: string, gizli: unknown, tekrar: number, sifreDegismeli: boolean): Promise<Giris> {
  const tuz = rastgele(16);
  const kek = await sifredenAnahtar(sifre, tuz, tekrar);
  return {
    tuz: b64(tuz),
    tekrar,
    gizli: await kapat(kek, JSON.stringify(gizli), girisEki(kim)),
    ...(sifreDegismeli ? { sifreDegismeli: true } : {}),
  };
}
async function girisAc<T>(kim: string, g: Giris, sifre: string): Promise<T | null> {
  if (!Number.isInteger(g.tekrar) || g.tekrar < 1000 || g.tekrar > 10_000_000) return null;
  try {
    const kek = await sifredenAnahtar(sifre, b64Coz(g.tuz), g.tekrar);
    return JSON.parse(baytMetin(await ac(kek, g.gizli, girisEki(kim)))) as T;
  } catch {
    return null;
  }
}
type GizliJwk = { ecdh: JsonWebKey; ecdsa: JsonWebKey };

export interface KasaAyari {
  tekrar?: number;
  iz?: IzDeposu;
}
export interface YeniKisi {
  ad: string;
  kullaniciAdi: string;
  sifre: string;
}

/** Yeni kasa kurar (klasörde kasa yoksa). Sahip olarak giriş yapılmış oturumu ve kurtarma anahtarını döner. */
export async function kasaOlustur(
  klasor: Klasor,
  sahip: YeniKisi,
  ayar: KasaAyari = {},
): Promise<{ oturum: Oturum; kurtarmaKodu: string }> {
  const tekrar = ayar.tekrar ?? SIFRE_TEKRAR,
    iz = ayar.iz ?? yerelIzDeposu;
  const sorun =
    kullaniciAdiSorunu(sahip.kullaniciAdi) || sifreSorunu(sahip.sifre, sahip.kullaniciAdi) || (sahip.ad.trim() ? "" : "Adınızı yazın.");
  if (sorun) throw new KasaHatasi(sorun, "girdi");
  if ((await klasor.bilgi(KASA_DOSYASI)) !== null) throw new KasaHatasi("Bu klasörde zaten bir kasa var.", "var");
  const simdi = Date.now();
  const kasaCifti = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const kasaGizliJwk = await crypto.subtle.exportKey("jwk", kasaCifti.privateKey);
  const kisiId = kimlikUret(),
    nesil = kimlikUret(8),
    dk = veriAnahtariUret();
  const c = await anahtarCiftiUret(),
    kc = await anahtarCiftiUret();
  const kurtarmaKodu = kurtarmaKoduUret();
  const kisi: KasaKisi = {
    id: kisiId,
    kullaniciAdi: kullaniciAdiDuzelt(sahip.kullaniciAdi),
    ad: sahip.ad.trim().slice(0, 60),
    rol: "sahip",
    durum: "aktif",
    acik: c.acik,
    olusturma: simdi,
  };
  const kasaGizliBayt = metinBayt(JSON.stringify(kasaGizliJwk));
  const imzali: KasaImzali = {
    id: kimlikUret(),
    olusturma: simdi,
    imzaAnahtari: acigi(await crypto.subtle.exportKey("jwk", kasaCifti.publicKey)),
    kisiler: [kisi],
    anahtarlar: {
      [nesil]: {
        [kisiId]: await sar(c.acik.ecdh, dk, sarmaEki(nesil, kisiId)),
        kurtarma: await sar(kc.acik.ecdh, dk, sarmaEki(nesil, "kurtarma")),
      },
    },
    guncel: nesil,
    kasaGizli: {
      [kisiId]: await sar(c.acik.ecdh, kasaGizliBayt, kasaEki(kisiId)),
      kurtarma: await sar(kc.acik.ecdh, kasaGizliBayt, kasaEki("kurtarma")),
    },
    kurtarmaAcik: kc.acik.ecdh,
    degisme: simdi,
    degistiren: kisiId,
  };
  const dosya: KasaDosyasi = {
    bicim: "eczane-nobet-kasa",
    surum: 1,
    imzali,
    imza: await imzala(kasaCifti.privateKey, kararliJson(imzali)),
    giris: {
      [kisiId]: await girisKur(kisiId, sahip.sifre, c.gizli, tekrar, false),
      kurtarma: await girisKur("kurtarma", kurtarmaKodu, { ecdh: kc.gizli.ecdh }, Math.min(tekrar, 200_000), false),
    },
  };
  if (!(await klasor.olustur(KASA_DOSYASI, JSON.stringify(dosya)))) throw new KasaHatasi("Bu klasörde zaten bir kasa var.", "var");
  await kasaDogrula(dosya, iz);
  const o = new Oturum(klasor, dosya, kisi, await gizliAnahtarlar(c.gizli), iz, tekrar);
  await o.anahtarlariAc();
  return { oturum: o, kurtarmaKodu };
}

/** kullanıcı adı ve şifreyle giriş */
export async function girisYap(klasor: Klasor, kullaniciAdi: string, sifre: string, ayar: KasaAyari = {}): Promise<Oturum> {
  const iz = ayar.iz ?? yerelIzDeposu;
  const k = await kasaOku(klasor, iz);
  if (!k) throw new KasaHatasi("Bu klasörde kasa yok.", "yok");
  const ad = kullaniciAdiDuzelt(kullaniciAdi);
  const kisi = k.imzali.kisiler.find(x => x.kullaniciAdi === ad && x.durum === "aktif");
  const g = kisi ? k.giris[kisi.id] : undefined;
  // kullanıcı adı yoksa da aynı süre beklenir (adın var olup olmadığı anlaşılmasın)
  const j =
    kisi && g
      ? await girisAc<GizliJwk>(kisi.id, g, sifre)
      : await sifredenAnahtar(sifre, rastgele(16), ayar.tekrar ?? SIFRE_TEKRAR).then(() => null);
  if (!kisi || !j) throw new KasaHatasi("Kullanıcı adı ya da şifre yanlış.", "giris");
  if (!j.ecdh || !j.ecdsa || !ayniAnahtar(acigi(j.ecdh), kisi.acik.ecdh) || !ayniAnahtar(acigi(j.ecdsa), kisi.acik.ecdsa))
    throw new KasaHatasi(
      "Bu hesabın anahtarları kasadakiyle eşleşmiyor (kasa değiştirilmiş olabilir). Sahipten şifrenizi yenilemesini isteyin.",
    );
  const o = new Oturum(klasor, k, kisi, await gizliAnahtarlar(j), iz, ayar.tekrar ?? g!.tekrar);
  await o.anahtarlariAc();
  return o;
}

/** Kurtarma anahtarıyla bir kişiye (ör. şifresini unutan sahibe) yeni şifre verir */
export async function kurtarmaIleSifirla(klasor: Klasor, kod: string, kullaniciAdi: string, yeniSifre: string, ayar: KasaAyari = {}) {
  const iz = ayar.iz ?? yerelIzDeposu;
  const ilk = await kasaOku(klasor, iz);
  if (!ilk) throw new KasaHatasi("Bu klasörde kasa yok.", "yok");
  const kg = ilk.giris.kurtarma;
  const j = kg ? await girisAc<{ ecdh: JsonWebKey }>("kurtarma", kg, kurtarmaKoduDuzelt(kod)) : null;
  if (!j?.ecdh || !ayniAnahtar(acigi(j.ecdh), ilk.imzali.kurtarmaAcik)) throw new KasaHatasi("Kurtarma anahtarı yanlış.", "giris");
  const ecdh = await ecdhGizli(j.ecdh);
  const birak = await kilitle(klasor, KASA_KILIDI, "kurtarma-" + kimlikUret(6));
  try {
    const k = await kasaOku(klasor, iz);
    if (!k) throw new KasaHatasi("Bu klasörde kasa yok.", "yok");
    const kisi = k.imzali.kisiler.find(x => x.kullaniciAdi === kullaniciAdiDuzelt(kullaniciAdi) && x.durum === "aktif");
    if (!kisi) throw new KasaHatasi("Bu kullanıcı adıyla etkin bir kullanıcı yok.", "girdi");
    const s = sifreSorunu(yeniSifre, kisi.kullaniciAdi);
    if (s) throw new KasaHatasi(s, "girdi");
    const onceki = JSON.parse(JSON.stringify(k)) as KasaDosyasi;
    const kasaImza = await kasaImzaAnahtari(ecdh, k.imzali.kasaGizli.kurtarma, "kurtarma");
    const nesiller = await nesilleriAc(ecdh, k.imzali.anahtarlar, "kurtarma");
    await kisiyeYeniAnahtar(k, kisi, yeniSifre, nesiller, kasaImza.ham, ayar.tekrar ?? SIFRE_TEKRAR, false);
    k.imzali.bakim = true;
    await kasaYaz(klasor, k, kasaImza.k, "kurtarma", iz, onceki);
  } finally {
    await birak();
  }
}

async function nesilleriAc(ecdh: CryptoKey, anahtarlar: KasaImzali["anahtarlar"], kim: string): Promise<Map<string, Uint8Array>> {
  const m = new Map<string, Uint8Array>();
  for (const [n, l] of Object.entries(anahtarlar))
    if (l[kim])
      try {
        m.set(n, await sarmaAc(ecdh, l[kim], sarmaEki(n, kim)));
      } catch {
        /* bu nesil bu kişiye açılamıyor */
      }
  return m;
}
async function kasaImzaAnahtari(ecdh: CryptoKey, s: Sarili | undefined, kim: string): Promise<{ k: CryptoKey; ham: Uint8Array }> {
  if (!s) throw new KasaHatasi("Kasa imza anahtarı bu hesaba açık değil.");
  const ham = await sarmaAc(ecdh, s, kasaEki(kim));
  const k = await crypto.subtle.importKey("jwk", JSON.parse(baytMetin(ham)), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  return { k, ham };
}
/** kişiye yeni anahtar çifti ve şifre: bütün nesiller (ve sahipse kasa anahtarı) yeni açık anahtarına sarılır */
async function kisiyeYeniAnahtar(
  k: KasaDosyasi,
  kisi: KasaKisi,
  sifre: string,
  nesiller: Map<string, Uint8Array>,
  kasaGizliHam: Uint8Array | null,
  tekrar: number,
  sifreDegismeli: boolean,
) {
  const c = await anahtarCiftiUret();
  if (kisi.acik?.ecdsa) kisi.eskiImza = [...(kisi.eskiImza ?? []), kisi.acik.ecdsa].slice(-20);
  kisi.acik = c.acik;
  for (const [n, l] of Object.entries(k.imzali.anahtarlar)) {
    const dk = nesiller.get(n);
    if (dk) l[kisi.id] = await sar(c.acik.ecdh, dk, sarmaEki(n, kisi.id));
    else delete l[kisi.id];
  }
  if (kisi.rol === "sahip" && kasaGizliHam) k.imzali.kasaGizli[kisi.id] = await sar(c.acik.ecdh, kasaGizliHam, kasaEki(kisi.id));
  k.giris[kisi.id] = await girisKur(kisi.id, sifre, c.gizli, tekrar, sifreDegismeli);
}
async function kasaYaz(klasor: Klasor, k: KasaDosyasi, imza: CryptoKey | null, kim: string, iz: IzDeposu, onceki?: KasaDosyasi) {
  if (imza) {
    k.imzali.degisme = Math.max(Date.now(), (onceki ?? k).imzali.degisme + 1);
    k.imzali.degistiren = kim;
    k.imza = await imzala(imza, kararliJson(k.imzali));
  }
  await kasaDogrula(k, iz);
  await klasor.yaz(KASA_DOSYASI, JSON.stringify(k));
}

// ---------- oturum ----------
export type IptalNedeni = "kaldirildi" | "sifirlandi" | "kasa";
export class Oturum {
  /** kasadaki kendi kaydı (rol, ad) */
  ben: KasaKisi;
  /** oturum kapandı (kişi kaldırıldı, şifresi sıfırlandı ya da kasa okunamadı) */
  iptal: { neden: IptalNedeni; mesaj: string } | null = null;
  private anahtarlar = new Map<string, CryptoKey>();
  private hamNesiller = new Map<string, Uint8Array>();
  private kasaImza: { k: CryptoKey; ham: Uint8Array } | null = null;
  private dogrulayicilar = new Map<string, CryptoKey>();
  private sonBakis = 0;
  private kasaIzi = "";
  private dinleyiciler = new Set<(o: Oturum) => void>();

  constructor(
    public klasor: Klasor,
    public kasa: KasaDosyasi,
    ben: KasaKisi,
    private gizli: GizliAnahtarlar,
    private iz: IzDeposu,
    private tekrar: number,
  ) {
    this.ben = ben;
  }
  get id() {
    return this.ben.id;
  }
  get rol() {
    return this.ben.rol;
  }
  get sifreDegismeli() {
    return !!this.kasa.giris[this.ben.id]?.sifreDegismeli;
  }
  kisi(id: string): KasaKisi | undefined {
    return this.kasa.imzali.kisiler.find(k => k.id === id);
  }
  /** kasa değişince (rol, kişiler, oturumun kapanması) */
  dinle(f: (o: Oturum) => void): () => void {
    this.dinleyiciler.add(f);
    return () => this.dinleyiciler.delete(f);
  }
  async anahtarlariAc() {
    this.hamNesiller = await nesilleriAc(this.gizli.ecdh, this.kasa.imzali.anahtarlar, this.ben.id);
    this.anahtarlar = new Map();
    for (const [n, h] of this.hamNesiller) this.anahtarlar.set(n, await veriAnahtari(h));
    if (!this.anahtarlar.has(this.kasa.imzali.guncel))
      throw new KasaHatasi("Veri anahtarı bu hesaba açılamadı. Sahipten şifrenizi yenilemesini isteyin.");
    this.kasaImza =
      this.ben.rol === "sahip"
        ? await kasaImzaAnahtari(this.gizli.ecdh, this.kasa.imzali.kasaGizli[this.ben.id], this.ben.id).catch(() => null)
        : null;
  }
  /** yazımda kullanılan nesil ve anahtarı */
  guncel(): { nesil: string; k: CryptoKey } {
    return { nesil: this.kasa.imzali.guncel, k: this.anahtarlar.get(this.kasa.imzali.guncel)! };
  }
  anahtar(nesil: string): CryptoKey | undefined {
    return this.anahtarlar.get(nesil);
  }
  imzala(metin: string) {
    return imzala(this.gizli.ecdsa, metin);
  }
  async dogrulayici(j: JsonWebKey): Promise<CryptoKey> {
    const a = `${j.x}|${j.y}`;
    let k = this.dogrulayicilar.get(a);
    if (!k) this.dogrulayicilar.set(a, (k = await dogrulamaAnahtari(j)));
    return k;
  }

  /** Kasa dosyası değiştiyse yeniden okur (en çok aralik ms'de bir bakar). Kişi kaldırıldıysa ya da şifresi
   *  sıfırlandıysa oturum kapanır. */
  async tazele(aralik = 1500): Promise<void> {
    if (this.iptal) return;
    const simdi = Date.now();
    if (simdi - this.sonBakis < aralik) return;
    this.sonBakis = simdi;
    const b = await this.klasor.bilgi(KASA_DOSYASI);
    const iz = b ? `${b.z}|${b.boyut}` : "yok";
    if (iz === this.kasaIzi) return;
    let k: KasaDosyasi | null;
    try {
      k = await kasaOku(this.klasor, this.iz);
    } catch (e) {
      this.kapat("kasa", (e as Error).message);
      return;
    }
    this.kasaIzi = iz;
    if (!k) {
      this.kapat("kasa", "Ortak klasördeki kasa dosyası bulunamadı.");
      return;
    }
    if (k.imzali.degisme === this.kasa.imzali.degisme && kararliJson(k.giris[this.ben.id]) === kararliJson(this.kasa.giris[this.ben.id]))
      return;
    const ben = k.imzali.kisiler.find(x => x.id === this.ben.id);
    if (!ben || ben.durum !== "aktif") return this.kapat("kaldirildi", "Hesabınız kaldırıldı; oturum kapatıldı.");
    if (!ayniAnahtar(ben.acik.ecdh, this.ben.acik.ecdh))
      return this.kapat("sifirlandi", "Şifreniz yenilendi; yeni şifrenizle giriş yapın.");
    this.kasa = k;
    this.ben = ben;
    try {
      await this.anahtarlariAc();
    } catch (e) {
      return this.kapat("kasa", (e as Error).message);
    }
    for (const f of this.dinleyiciler) f(this);
  }
  private kapat(neden: IptalNedeni, mesaj: string) {
    this.iptal = { neden, mesaj };
    for (const f of this.dinleyiciler) f(this);
  }
  /** testler ve kasa yazımından sonra: bir sonraki tazelemede kesin bakılsın */
  tazeleZorla() {
    this.sonBakis = 0;
    return this.tazele(0);
  }

  // ---------- kasa değişiklikleri ----------
  private async degistir(f: (k: KasaDosyasi) => Promise<void>, imzali = true): Promise<KasaDosyasi> {
    if (this.iptal) throw new KasaHatasi(this.iptal.mesaj, "iptal");
    if (imzali && (this.ben.rol !== "sahip" || !this.kasaImza)) throw new KasaHatasi("Bunu yalnız sahip yapabilir.", "yetki");
    const birak = await kilitle(this.klasor, KASA_KILIDI, this.ben.id + "-" + kimlikUret(6));
    let onceki: KasaDosyasi;
    try {
      const k = await kasaOku(this.klasor, this.iz);
      if (!k) throw new KasaHatasi("Ortak klasördeki kasa dosyası bulunamadı.");
      onceki = JSON.parse(JSON.stringify(k));
      await f(k);
      if (!imzali && kararliJson(k.imzali) !== kararliJson(onceki.imzali)) throw new KasaHatasi("Bunu yalnız sahip yapabilir.", "yetki");
      await kasaYaz(this.klasor, k, imzali ? this.kasaImza!.k : null, this.ben.id, this.iz, onceki);
    } finally {
      await birak();
    }
    await this.tazeleZorla();
    return onceki;
  }
  private bul(k: KasaDosyasi, id: string): KasaKisi {
    const x = k.imzali.kisiler.find(y => y.id === id);
    if (!x) throw new KasaHatasi("Kullanıcı bulunamadı.", "girdi");
    return x;
  }
  private sonSahipMi(k: KasaDosyasi, id: string) {
    return !k.imzali.kisiler.some(x => x.id !== id && x.rol === "sahip" && x.durum === "aktif");
  }

  /** kendi şifresini değiştirir (her kullanıcı) */
  async sifreDegistir(eski: string, yeni: string) {
    const s = sifreSorunu(yeni, this.ben.kullaniciAdi);
    if (s) throw new KasaHatasi(s, "girdi");
    if (eski === yeni) throw new KasaHatasi("Yeni şifre eskisiyle aynı olamaz.", "girdi");
    await this.degistir(async k => {
      const g = k.giris[this.ben.id];
      const j = g ? await girisAc<GizliJwk>(this.ben.id, g, eski) : null;
      if (!j) throw new KasaHatasi("Şu anki şifre yanlış.", "giris");
      k.giris[this.ben.id] = await girisKur(this.ben.id, yeni, j, this.tekrar, false);
    }, false);
  }
  /** yeni kullanıcı: sahip geçici şifre verir, kişi ilk girişte kendi şifresini belirler */
  async kullaniciEkle(o: YeniKisi & { rol: KasaRol }): Promise<string> {
    const sorun = kullaniciAdiSorunu(o.kullaniciAdi) || sifreSorunu(o.sifre, o.kullaniciAdi) || (o.ad.trim() ? "" : "Adı yazın.");
    if (sorun) throw new KasaHatasi(sorun, "girdi");
    const id = kimlikUret();
    await this.degistir(async k => {
      const ad = kullaniciAdiDuzelt(o.kullaniciAdi);
      if (k.imzali.kisiler.some(x => x.kullaniciAdi === ad)) throw new KasaHatasi("Bu kullanıcı adı kullanılıyor.", "girdi");
      const kisi: KasaKisi = {
        id,
        kullaniciAdi: ad,
        ad: o.ad.trim().slice(0, 60),
        rol: o.rol,
        durum: "aktif",
        acik: null as unknown as AcikAnahtarlar,
        olusturma: Date.now(),
      };
      k.imzali.kisiler.push(kisi);
      await kisiyeYeniAnahtar(k, kisi, o.sifre, this.hamNesiller, this.kasaImza!.ham, this.tekrar, true);
    });
    return id;
  }
  /** ad ya da rol değiştirir. Baş sorumluluktan çıkan kişinin yazdığı personel / ayar kaydı sahibin imzasıyla
   *  yenilenir (dönüş: rolü yöneticilikten çıkan kişi) */
  async kullaniciGuncelle(id: string, o: { ad?: string; rol?: KasaRol }): Promise<{ yoneticilikten: string | null }> {
    let yoneticilikten: string | null = null;
    await this.degistir(async k => {
      const x = this.bul(k, id);
      if (o.ad !== undefined) {
        if (!o.ad.trim()) throw new KasaHatasi("Adı yazın.", "girdi");
        x.ad = o.ad.trim().slice(0, 60);
      }
      if (o.rol && o.rol !== x.rol) {
        if (x.rol === "sahip" && this.sonSahipMi(k, id)) throw new KasaHatasi("Kasada en az bir sahip kalmalı.", "girdi");
        if (yoneticiRolu(x.rol) && !yoneticiRolu(o.rol)) yoneticilikten = id;
        x.rol = o.rol;
        if (o.rol === "sahip") k.imzali.kasaGizli[id] = await sar(x.acik.ecdh, this.kasaImza!.ham, kasaEki(id));
        else delete k.imzali.kasaGizli[id];
      }
    });
    return { yoneticilikten };
  }
  /** unutulan şifre: yeni anahtar ve geçici şifre (kişi ilk girişte değiştirir) */
  async sifreSifirla(id: string, geciciSifre: string) {
    await this.degistir(async k => {
      const x = this.bul(k, id);
      if (x.durum !== "aktif") throw new KasaHatasi("Kaldırılmış kullanıcı.", "girdi");
      const s = sifreSorunu(geciciSifre, x.kullaniciAdi);
      if (s) throw new KasaHatasi(s, "girdi");
      await kisiyeYeniAnahtar(k, x, geciciSifre, this.hamNesiller, this.kasaImza!.ham, this.tekrar, id !== this.ben.id);
      k.imzali.bakim = true;
    });
  }
  /** Kullanıcıyı kaldırır: girişi kapanır, yeni veri anahtarı nesli açılır (kaldırılan kişiye sarılmaz). Eski kayıtlar
   *  sonra yeni anahtarla yeniden şifrelenir (belgeler.ts > belgeleriYenile). Kayıtlardaki adı ve geçmişi kalır. */
  async kullaniciKaldir(id: string) {
    if (id === this.ben.id) throw new KasaHatasi("Kendinizi kaldıramazsınız.", "girdi");
    await this.degistir(async k => {
      const x = this.bul(k, id);
      if (x.rol === "sahip" && this.sonSahipMi(k, id)) throw new KasaHatasi("Kasada en az bir sahip kalmalı.", "girdi");
      x.durum = "kaldirildi";
      delete k.giris[id];
      delete k.imzali.kasaGizli[id];
      for (const l of Object.values(k.imzali.anahtarlar)) delete l[id];
      // yeni nesil: etkin kişilere ve kurtarmaya
      const nesil = kimlikUret(8),
        dk = veriAnahtariUret();
      const l: Record<string, Sarili> = {};
      for (const y of k.imzali.kisiler) if (y.durum === "aktif") l[y.id] = await sar(y.acik.ecdh, dk, sarmaEki(nesil, y.id));
      l.kurtarma = await sar(k.imzali.kurtarmaAcik, dk, sarmaEki(nesil, "kurtarma"));
      k.imzali.anahtarlar[nesil] = l;
      k.imzali.guncel = nesil;
      k.imzali.bakim = true;
    });
  }
  /** yeni kurtarma anahtarı (eskisi geçersiz olur) */
  async kurtarmaYenile(): Promise<string> {
    const kod = kurtarmaKoduUret();
    await this.degistir(async k => {
      const kc = await anahtarCiftiUret();
      k.imzali.kurtarmaAcik = kc.acik.ecdh;
      for (const [n, l] of Object.entries(k.imzali.anahtarlar)) {
        const dk = this.hamNesiller.get(n);
        if (dk) l.kurtarma = await sar(kc.acik.ecdh, dk, sarmaEki(n, "kurtarma"));
        else delete l.kurtarma;
      }
      k.imzali.kasaGizli.kurtarma = await sar(kc.acik.ecdh, this.kasaImza!.ham, kasaEki("kurtarma"));
      k.giris.kurtarma = await girisKur("kurtarma", kod, { ecdh: kc.gizli.ecdh }, Math.min(this.tekrar, 200_000), false);
    });
    return kod;
  }
  /** bakım bitti: eski nesiller atılır, bakım işareti kalkar (belgeler.ts > belgeleriYenile) */
  async bakimBitti(atilacak: string[]) {
    await this.degistir(async k => {
      for (const n of atilacak) if (n !== k.imzali.guncel) delete k.imzali.anahtarlar[n];
      delete k.imzali.bakim;
    });
  }
  /** kasa imza anahtarı bu oturumda var mı (sahip) */
  get sahipMi() {
    return this.ben.rol === "sahip" && !!this.kasaImza;
  }
}
