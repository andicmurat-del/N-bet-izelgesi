// Şifreleme yardımcıları (tarayıcının Web Crypto'su; dış kütüphane yok):
// - Şifreden anahtar: PBKDF2-SHA256 (kasada yazan tekrar sayısıyla), AES-GCM 256.
// - Veri şifreleme: AES-GCM 256, her yazımda yeni 12 baytlık iv; "ek" (ör. dosyanın yolu) doğrulanır ama şifrelenmez.
// - Anahtar sarma: alıcının ECDH P-256 açık anahtarına (geçici ECDH + HKDF-SHA256 + AES-GCM): sahip, yeni kullanıcıya
//   veri anahtarını şifresini bilmeden verebilir.
// - İmza: ECDSA P-256 / SHA-256. Kayıtlar yazanın anahtarıyla imzalanır; kimin yazdığı şifreyle girişe dayanır.
const yazi = new TextEncoder(),
  okuma = new TextDecoder();
const sc = () => globalThis.crypto.subtle;
const ECDH = { name: "ECDH", namedCurve: "P-256" } as const,
  ECDSA = { name: "ECDSA", namedCurve: "P-256" } as const;

export const rastgele = (n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n));
export function b64(b: ArrayBuffer | Uint8Array): string {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}
export function b64Coz(s: string): Uint8Array<ArrayBuffer> {
  const t = atob(s);
  const u = new Uint8Array(t.length);
  for (let i = 0; i < t.length; i++) u[i] = t.charCodeAt(i);
  return u;
}
export const metinBayt = (s: string) => yazi.encode(s);
export const baytMetin = (b: ArrayBuffer | Uint8Array) => okuma.decode(b);
/** kısa rastgele kimlik (dosya adlarında güvenli) */
export const kimlikUret = (n = 12) => Array.from(rastgele(n), x => "abcdefghijkmnpqrstuvwxyz23456789"[x % 32]).join("");

/** şifreli paket: iv ve şifreli metin (base64) */
export interface Paket {
  iv: string;
  v: string;
}
const bayt = (x: Uint8Array | string) => (typeof x === "string" ? yazi.encode(x) : x);

export async function sifredenAnahtar(sifre: string, tuz: Uint8Array<ArrayBuffer>, tekrar: number): Promise<CryptoKey> {
  const ham = await sc().importKey("raw", yazi.encode(sifre.normalize("NFC")), "PBKDF2", false, ["deriveKey"]);
  return sc().deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: tuz, iterations: tekrar }, ham, { name: "AES-GCM", length: 256 }, false, [
    "encrypt",
    "decrypt",
  ]);
}
export async function kapat(anahtar: CryptoKey, veri: Uint8Array | string, ek = ""): Promise<Paket> {
  const iv = rastgele(12);
  const v = await sc().encrypt({ name: "AES-GCM", iv, additionalData: yazi.encode(ek) }, anahtar, bayt(veri) as Uint8Array<ArrayBuffer>);
  return { iv: b64(iv), v: b64(v) };
}
/** şifreyi çözer; anahtar yanlışsa ya da paket değiştirilmişse hata fırlatır */
export async function ac(anahtar: CryptoKey, p: Paket, ek = ""): Promise<Uint8Array> {
  const d = await sc().decrypt({ name: "AES-GCM", iv: b64Coz(p.iv), additionalData: yazi.encode(ek) }, anahtar, b64Coz(p.v));
  return new Uint8Array(d);
}

// ---------- veri anahtarı ----------
export const veriAnahtariUret = () => rastgele(32);
export const veriAnahtari = (ham: Uint8Array) =>
  sc().importKey("raw", ham as Uint8Array<ArrayBuffer>, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);

// ---------- kullanıcı anahtarları ----------
/** açık anahtarlar (kasada herkes görür): ECDH (veri anahtarı buna sarılır), ECDSA (imzaları doğrular) */
export interface AcikAnahtarlar {
  ecdh: JsonWebKey;
  ecdsa: JsonWebKey;
}
export interface GizliAnahtarlar {
  ecdh: CryptoKey;
  ecdsa: CryptoKey;
}
const acikJwk = (j: JsonWebKey): JsonWebKey => ({ kty: j.kty, crv: j.crv, x: j.x, y: j.y });
const gizliJwk = (j: JsonWebKey): JsonWebKey => ({ ...acikJwk(j), d: j.d });

/** yeni anahtar çifti: açıkları ve gizlilerin JWK'si (gizliler şifreyle kapatılıp saklanır) */
export async function anahtarCiftiUret(): Promise<{ acik: AcikAnahtarlar; gizli: { ecdh: JsonWebKey; ecdsa: JsonWebKey } }> {
  const a = (await sc().generateKey(ECDH, true, ["deriveBits"])) as CryptoKeyPair;
  const b = (await sc().generateKey(ECDSA, true, ["sign", "verify"])) as CryptoKeyPair;
  const [aj, bj] = await Promise.all([sc().exportKey("jwk", a.privateKey), sc().exportKey("jwk", b.privateKey)]);
  return { acik: { ecdh: acikJwk(aj), ecdsa: acikJwk(bj) }, gizli: { ecdh: gizliJwk(aj), ecdsa: gizliJwk(bj) } };
}
export async function gizliAnahtarlar(j: { ecdh: JsonWebKey; ecdsa: JsonWebKey }): Promise<GizliAnahtarlar> {
  const [ecdh, ecdsa] = await Promise.all([
    sc().importKey("jwk", gizliJwk(j.ecdh), ECDH, false, ["deriveBits"]),
    sc().importKey("jwk", gizliJwk(j.ecdsa), ECDSA, false, ["sign"]),
  ]);
  return { ecdh, ecdsa };
}
/** yalnız ECDH gizli anahtarı (kurtarma anahtarında imza anahtarı yok) */
export const ecdhGizli = (j: JsonWebKey) => sc().importKey("jwk", gizliJwk(j), ECDH, false, ["deriveBits"]);
export const dogrulamaAnahtari = (j: JsonWebKey) => sc().importKey("jwk", acikJwk(j), ECDSA, false, ["verify"]);
const ecdhAcik = (j: JsonWebKey) => sc().importKey("jwk", acikJwk(j), ECDH, false, []);
/** gizli JWK'den açık JWK (girişte gizli anahtarların kasadaki açık anahtarla eşleştiği denetlenir) */
export const acigi = (j: JsonWebKey) => acikJwk(j);
export const ayniAnahtar = (a: JsonWebKey, b: JsonWebKey) => a.kty === b.kty && a.crv === b.crv && a.x === b.x && a.y === b.y;

// ---------- sarma ----------
export interface Sarili {
  /** geçici ECDH açık anahtarı */
  e: JsonWebKey;
  iv: string;
  v: string;
}
async function sarmaAnahtari(gizli: CryptoKey, acik: CryptoKey, e: JsonWebKey): Promise<CryptoKey> {
  const ortak = await sc().deriveBits({ name: "ECDH", public: acik }, gizli, 256);
  const hk = await sc().importKey("raw", ortak, "HKDF", false, ["deriveKey"]);
  return sc().deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: yazi.encode(String(e.x) + String(e.y)), info: yazi.encode("eczane-nobet-sarma-1") },
    hk,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
/** gizli baytları alıcının açık ECDH anahtarına sarar */
export async function sar(alici: JsonWebKey, gizli: Uint8Array, ek = ""): Promise<Sarili> {
  const gecici = (await sc().generateKey(ECDH, true, ["deriveBits"])) as CryptoKeyPair;
  const e = acikJwk(await sc().exportKey("jwk", gecici.publicKey));
  const k = await sarmaAnahtari(gecici.privateKey, await ecdhAcik(alici), e);
  return { e, ...(await kapat(k, gizli, ek)) };
}
export async function sarmaAc(benim: CryptoKey, s: Sarili, ek = ""): Promise<Uint8Array> {
  const k = await sarmaAnahtari(benim, await ecdhAcik(s.e), s.e);
  return ac(k, s, ek);
}

// ---------- imza ----------
export async function imzala(k: CryptoKey, metin: string): Promise<string> {
  return b64(await sc().sign({ name: "ECDSA", hash: "SHA-256" }, k, yazi.encode(metin)));
}
export async function dogrula(k: CryptoKey, metin: string, imza: string): Promise<boolean> {
  try {
    return await sc().verify({ name: "ECDSA", hash: "SHA-256" }, k, b64Coz(imza), yazi.encode(metin));
  } catch {
    return false;
  }
}
/** açık anahtarın kısa parmak izi (bu bilgisayarda kasa anahtarını hatırlamak için) */
export async function parmakIzi(j: JsonWebKey): Promise<string> {
  const h = new Uint8Array(await sc().digest("SHA-256", yazi.encode(`${j.crv}|${j.x}|${j.y}`)));
  return Array.from(h.subarray(0, 16), x => x.toString(16).padStart(2, "0")).join("");
}

// ---------- kurtarma anahtarı ----------
// 25 karakter (5'erli öbek), karışan harfler yok (0/O, 1/I/L): ~124 bit
const KURTARMA_ABECE = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function kurtarmaKoduUret(): string {
  const l = Array.from(rastgele(25), x => KURTARMA_ABECE[x % KURTARMA_ABECE.length]);
  return [0, 5, 10, 15, 20].map(i => l.slice(i, i + 5).join("")).join("-");
}
/** yazılan kodu düzeltir: boşluk ve tire atılır, küçük harf büyür */
export function kurtarmaKoduDuzelt(s: string): string {
  const t = s.toLocaleUpperCase("en").replace(/[\s-]/g, "");
  return t.length === 25 ? [0, 5, 10, 15, 20].map(i => t.slice(i, i + 5)).join("-") : t;
}
