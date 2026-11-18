// Kayıtlı verinin biçimi ve doğrulaması: boş veri, varsayılan ayarlar ve dışarıdan gelen metnin (yedek dosyası,
// tarayıcı kaydı, sunucu) güvenli biçime getirilmesi. Durumdan (depo) bağımsızdır.
import type { Ayarlar, GunDuzeni, Gorevli, Kisi, OglenSabit, PuantajKodu, Rol, Tercih, Veri } from "./tipler";
import { ayAnahtari, gunSayisi, haftaAnahtari, haftaGunu } from "./tarih";

export const AYAR_VARSAYILAN: Ayarlar = { minAra: 3, acilMinAra: 3, destekAylik: 2, arifeSaat: 3,
  nobetSuresi: 24, mesai: 8, hazSaat: 8, maxThu: 1, hsUst: 2, thuHaftaSonu: true, cumaEsles: true, fmHedef: 8, niDusum: 1, acilArdArda: true,
  oglenHE: 2, oglenHT: 1, oglenCE: 3, oglenCT: 2, tatilOtomatik: true };
/** gelişmiş kuralların sınırları (Ayarlar ekranı ve doğrulama ortak): [en az, en çok, adım] */
export const AYAR_SINIR = {
  nobetSuresi: [12, 24, 1], mesai: [4, 12, 0.5], hazSaat: [1, 12, 0.5], maxThu: [1, 99, 1], hsUst: [1, 4, 1], fmHedef: [2, 24, 1], niDusum: [1, 2, 1],
  oglenHE: [0, 4, 1], oglenHT: [0, 3, 1], oglenCE: [0, 4, 1], oglenCT: [0, 3, 1],
} as const;

export function bosVeri(): Veri {
  return {
    surum: 1,
    kurum: { ad: "", onaylayan: "" },
    staff: [],
    prefs: {},
    manualTatil: {},
    arife: {},
    settings: { ...AYAR_VARSAYILAN },
    schedules: {},
    puantaj: {},
    acil: {},
    acilElle: {},
    oglen: {},
    listeOnay: { acil: {}, oglen: {}, onay: {} },
    degisimler: [],
    servisAyar: { svc: {}, ekstra: [] },
    servisKayit: {},
    onayMasa: { yerlesim: {}, elle: {} },
    tatilYillari: {},
  };
}

/** Dışarıdan gelen metni (yedek dosyası, tarayıcı kaydı) okur. "__proto__" adlı alanlar atılır: böyle bir alan
 *  doğrulama ve kopyalama sırasında nesnelerin ortak atasına (Object.prototype) yazılmasına yol açabiliyordu. */
export const guvenliJson = (metin: string): unknown => JSON.parse(metin, (k, x) => (k === "__proto__" ? undefined : x));

/** öğlen gününün elle yerleri: yalnız o günün listesinde olan kişiler; boş yer sayısı 0–3; hiçbiri yoksa undefined */
export function oglenSabitDogrula(x: unknown, e: number[], t: number[]): OglenSabit | undefined {
  if (!x || typeof x !== "object") return undefined;
  const o = x as Record<string, unknown>, ic = (l: unknown, izin: number[]) => (Array.isArray(l) ? [...new Set(l.filter((id): id is number => izin.includes(id as number)))] : []);
  const bos = (n: unknown) => (Number.isInteger(n) && (n as number) > 0 ? Math.min(3, n as number) : 0);
  const sb: OglenSabit = { e: ic(o.e, e), t: ic(o.t, t) }, be = bos(o.be), bt = bos(o.bt);
  if (be) sb.be = be; if (bt) sb.bt = bt;
  return sb.e.length || sb.t.length || be || bt ? sb : undefined;
}

/** elle düzenlenen tatil gününün düzeni: nöbetçi sayısı 1–4, hazırlama 0–4, saatler 0–48 (tam ya da yarım saat) */
export function gunDuzeniDogrula(x: Record<string, unknown> | null | undefined): GunDuzeni {
  const o: GunDuzeni = {};
  if (!x) return o;
  const tam = (v: unknown, a: number, b: number) => (Number.isInteger(v) && (v as number) >= a && (v as number) <= b ? (v as number) : undefined);
  const saat = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 48 ? Math.round(v * 2) / 2 : undefined);
  const ns = tam(x.nobetSay, 1, 4), hs = tam(x.hazSay, 0, 4), fn = saat(x.fmNobet), fh = saat(x.fmHaz);
  if (ns !== undefined && ns !== 2) o.nobetSay = ns;
  if (hs !== undefined && hs !== 2) o.hazSay = hs;
  if (fn !== undefined) o.fmNobet = fn;
  if (fh !== undefined) o.fmHaz = fh;
  return o;
}

/** Yedekten ya da tarayıcıdan okunan veriyi güvenli biçime getirir; tanınmayan alanlar atılır. */
export function veriyiDogrula(ham: unknown): Veri {
  const v = bosVeri();
  if (!ham || typeof ham !== "object") return v;
  const o = ham as Record<string, any>;
  const nesne = (x: unknown) => (x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, any>) : {});
  const roller: Rol[] = ["eczaci", "teknisyen", "destek", "nobetci", "servis"];
  const iso = (t: unknown) => (typeof t === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : undefined);
  const kurum = nesne(o.kurum);
  v.kurum = { ad: String(kurum.ad ?? ""), onaylayan: String(kurum.onaylayan ?? "") };
  const goruldu = new Set<number>();
  v.staff = (Array.isArray(o.staff) ? o.staff : [])
    .filter((k: any) => k && Number.isInteger(k.id) && !goruldu.has(k.id) && goruldu.add(k.id))
    .map((k: any): Kisi => ({
      id: k.id,
      name: String(k.name ?? "").trim().slice(0, 60),
      role: roller.includes(k.role) ? k.role : "eczaci",
      ...(iso(k.baslangic) ? { baslangic: iso(k.baslangic) } : {}),
      ...(iso(k.bitis) ? { bitis: iso(k.bitis) } : {}),
      ...(k.cumaMuaf === true ? { cumaMuaf: true as const } : {}),
      ...(k.acilTutar === true && (k.role === "eczaci" || k.role === "nobetci") ? { acilTutar: true as const } : {}),
    }));
  const tercihler: Tercih[] = ["izinli", "want", "avoid", "esVar", "esYok"];
  for (const [k, t] of Object.entries(nesne(o.prefs))) if (tercihler.includes(t)) v.prefs[k] = t;
  // yalnız işaretli günler (eski kayıtlarda kaldırılan işaret false olarak durabilir)
  for (const [k, x] of Object.entries(nesne(o.manualTatil))) if (x) v.manualTatil[k] = true;
  for (const [k, x] of Object.entries(nesne(o.arife))) if (x) v.arife[k] = true;
  const s = nesne(o.settings);
  const sayi = (x: unknown, a: number, b: number, vars: number) => (x !== null && x !== "" && Number.isFinite(Number(x)) && Number(x) >= a && Number(x) <= b ? Number(x) : vars);
  v.settings = {
    minAra: sayi(s.minAra, 2, 6, AYAR_VARSAYILAN.minAra),
    acilMinAra: sayi(s.acilMinAra, 2, 6, AYAR_VARSAYILAN.acilMinAra),
    destekAylik: sayi(s.destekAylik, 0, 8, AYAR_VARSAYILAN.destekAylik),
    arifeSaat: sayi(s.arifeSaat, 0, 8, AYAR_VARSAYILAN.arifeSaat),
    ...(Object.fromEntries(Object.entries(AYAR_SINIR).map(([k, [a, b, adim]]) => {
      const v = sayi(s[k], a, b, AYAR_VARSAYILAN[k as keyof typeof AYAR_SINIR]);
      return [k, Math.round(v / adim) * adim];
    })) as Pick<Ayarlar, keyof typeof AYAR_SINIR>),
    thuHaftaSonu: s.thuHaftaSonu !== false, cumaEsles: s.cumaEsles !== false, acilArdArda: s.acilArdArda !== false, tatilOtomatik: s.tatilOtomatik !== false,
  };
  const kodlar: PuantajKodu[] = ["M", "N", "H", "NI", "YI", "R", "DI", "B"];
  for (const [ayK, kisiler] of Object.entries(nesne(o.puantaj))) {
    if (!/^\d{4}-\d{1,2}$/.test(ayK)) continue;
    // kişi no ve gün yalnız sayı olabilir (başka anahtar, ör. "__proto__", yazılmaz)
    for (const [id, gunler] of Object.entries(nesne(kisiler))) {
      if (!/^\d{1,9}$/.test(id)) continue;
      for (const [gun, kod] of Object.entries(nesne(gunler)))
        if (/^\d{1,2}$/.test(gun) && Number(gun) >= 1 && Number(gun) <= 31 && kodlar.includes(kod as PuantajKodu)) ((v.puantaj[ayK] ??= {})[id] ??= {})[gun] = kod as PuantajKodu;
    }
  }
  const kisiIdleri = new Set(v.staff.map(k => k.id));
  for (const [ayK, gunler] of Object.entries(nesne(o.acil))) {
    if (!/^\d{4}-\d{1,2}$/.test(ayK)) continue;
    for (const [gun, ids] of Object.entries(nesne(gunler))) {
      const l = (Array.isArray(ids) ? ids : []).filter((id: unknown): id is number => Number.isInteger(id) && kisiIdleri.has(id as number));
      const tek = [...new Set(l)].slice(0, 2);
      if (/^\d{1,2}$/.test(gun) && tek.length) (v.acil[ayK] ??= {})[gun] = tek;
    }
  }
  for (const [ayK, gunler] of Object.entries(nesne(o.acilElle))) {
    if (!/^\d{4}-\d{1,2}$/.test(ayK)) continue;
    for (const [gun, x] of Object.entries(nesne(gunler))) if (/^\d{1,2}$/.test(gun) && x === true) (v.acilElle[ayK] ??= {})[gun] = true;
  }
  for (const [ayK, gunler] of Object.entries(nesne(o.oglen))) {
    if (!/^\d{4}-\d{1,2}$/.test(ayK)) continue;
    const ids = (l: unknown) => [...new Set((Array.isArray(l) ? l : []).filter((id: unknown): id is number => Number.isInteger(id) && kisiIdleri.has(id as number)))];
    for (const [gun, g] of Object.entries(nesne(gunler))) {
      const x = nesne(g), e = ids(x.e), t = ids(x.t), sb = oglenSabitDogrula(x.sabit, e, t);
      if (/^\d{1,2}$/.test(gun) && (e.length || t.length || x.elle === true || sb)) (v.oglen[ayK] ??= {})[gun] = { e, t, ...(x.elle === true ? { elle: true as const } : {}), ...(sb ? { sabit: sb } : {}) };
    }
  }
  const lo = nesne(o.listeOnay), onayKaydi = (x: unknown) => { const a = nesne(x); return Number(a.zaman) > 0 ? { zaman: Number(a.zaman), kim: String(a.kim ?? "") } : null; };
  for (const [ayK, x] of Object.entries(nesne(lo.acil))) { const a = onayKaydi(x); if (/^\d{4}-\d{1,2}$/.test(ayK) && a) v.listeOnay.acil[ayK] = a; }
  const haftaMi = (k: string) => { const t = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k); return !!t && haftaAnahtari(+t[1], +t[2] - 1, +t[3]) === k; };
  for (const tur of ["oglen", "onay"] as const)
    for (const [k, x] of Object.entries(nesne(lo[tur]))) {
      const a = onayKaydi(x); if (!a) continue;
      if (haftaMi(k)) v.listeOnay[tur][k] = a;
      else if (tur === "oglen" && /^\d{4}-\d{1,2}$/.test(k)) {
        // eski kayıt: öğlen nöbeti aylık onaylanırdı; ayın hafta içi günlerinin haftaları onaylı sayılır
        const [y, m] = k.split("-").map(Number);
        if (m >= 0 && m <= 11) for (let d = 1; d <= gunSayisi(y, m); d++) if (haftaGunu(y, m, d) <= 4) v.listeOnay.oglen[haftaAnahtari(y, m, d)] ??= a;
      }
    }
  // eski kayıt (onay listesi onayı yokken): öğlen nöbeti yazılmış haftaların onay listesi onaylı sayılır
  if (lo.onay === undefined)
    for (const [ayK, a] of Object.entries(v.oglen)) { const [y, m] = ayK.split("-").map(Number); for (const g of Object.keys(a)) v.listeOnay.onay[haftaAnahtari(y, m, Number(g))] ??= { zaman: 1, kim: "" }; }
  for (const [k, c] of Object.entries(nesne(o.schedules))) {
    if (!c || !Array.isArray(c.days) || !Number.isInteger(c.year) || !Number.isInteger(c.month)) continue;
    // anahtar, ay ve gün sayısı tutmalı; günler alan alan kurulur (bozuk bir gün sayfayı her açılışta çökertmesin)
    if (c.month < 0 || c.month > 11 || k !== ayAnahtari(c.year, c.month) || c.days.length !== gunSayisi(c.year, c.month)) continue;
    const gorevli = (l: unknown): Gorevli[] => (Array.isArray(l) ? l : [])
      .filter((p: any) => p && Number.isInteger(p.id))
      .map((p: any) => ({ id: p.id, name: String(p.name ?? ""), role: roller.includes(p.role) ? p.role : "eczaci" }));
    v.schedules[k] = {
      year: c.year, month: c.month,
      // Array.from: dizide eksik (silinmiş) gün de boş gün olarak kurulur (map boşlukları atlardı)
      days: Array.from({ length: c.days.length }, (_, i: number) => c.days[i]).map((g: unknown, i: number) => {
        const x = nesne(g);
        return { day: i + 1, tatil: x.tatil === true, conflict: x.conflict === true, fazlaMesai: Number.isFinite(Number(x.fazlaMesai)) ? Number(x.fazlaMesai) : 0,
          assigned: gorevli(x.assigned), prep: gorevli(x.prep), locked: x.locked === true, ...gunDuzeniDogrula(x) };
      }),
      uyarilar: Array.isArray(c.uyarilar) ? c.uyarilar.map(String) : [],
      olusturma: Number(c.olusturma) || 0,
      ...(c.onay && typeof c.onay === "object" ? { onay: { zaman: Number(c.onay.zaman) || 0, kim: String(c.onay.kim ?? "") } } : {}),
    };
  }
  const tamsayi = (x: unknown) => Number.isInteger(x);
  const kodMu = (x: unknown) => kodlar.includes(x as PuantajKodu);
  v.degisimler = (Array.isArray(o.degisimler) ? o.degisimler : [])
    .filter((d: any) => d && [d.id, d.y, d.m, d.gun, d.cik, d.yer].every(tamsayi) && d.m >= 0 && d.m <= 11 && d.gun >= 1 && d.gun <= 31 && (d.gorev === "N" || d.gorev === "H") && kodMu(d.cikYeni) && (d.yerYeni === "N" || d.yerYeni === "H"))
    .slice(-300)
    .map((d: any) => ({
      id: d.id, zaman: Number(d.zaman) || 0, y: d.y, m: d.m, gun: d.gun, cik: d.cik, yer: d.yer,
      cikAd: String(d.cikAd ?? ""), yerAd: String(d.yerAd ?? ""),
      cikOnce: kodMu(d.cikOnce) ? d.cikOnce : null, yerOnce: kodMu(d.yerOnce) ? d.yerOnce : null,
      cikYeni: d.cikYeni, yerYeni: d.yerYeni, gorev: d.gorev,
      ...(typeof d.grup === "string" ? { grup: d.grup } : {}),
      ...(d.zorunlu === true ? { zorunlu: true as const } : {}),
      ...(kodMu(d.sebep) ? { sebep: d.sebep } : {}),
      ...(typeof d.not === "string" && d.not ? { not: d.not.slice(0, 160) } : {}),
    }));
  // servis hazırlama: ayarlar sınırlar içinde; ay kayıtları motorun biçiminde (motor bozuk gün kayıtlarını kendisi atar)
  const sa = nesne(o.servisAyar);
  for (const [ad, k] of Object.entries(nesne(sa.svc))) {
    const x = nesne(k);
    if (ad === "__proto__") continue;
    v.servisAyar.svc[ad] = { z: sayi(x.z, 1, 10, 1), h: sayi(x.h, 0, 999, 0), multi: x.multi === true, on: x.on !== false };
  }
  v.servisAyar.ekstra = (Array.isArray(sa.ekstra) ? sa.ekstra : [])
    .filter((e: any) => e && typeof e.name === "string" && e.name.trim())
    .map((e: any) => ({ name: String(e.name).trim().slice(0, 40), z: sayi(e.z, 1, 10, 1), h: sayi(e.h, 0, 999, 0), multi: e.multi === true }));
  for (const [k, R] of Object.entries(nesne(o.servisKayit))) {
    if (!/^\d{4}-\d{1,2}$/.test(k) || !R || typeof R !== "object") continue;
    const r = R as Record<string, unknown>;
    v.servisKayit[k] = { gun: nesne(r.gun), elle: nesne(r.elle), gunElle: nesne(r.gunElle), sk: nesne(r.sk), ad: nesne(r.ad), ata: nesne(r.ata) } as any;
  }
  for (const [hafta, x] of Object.entries(nesne(nesne(o.onayMasa).yerlesim))) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(hafta)) continue;
    const l: Record<string, number> = {};
    for (const [id, yer] of Object.entries(nesne(x))) if (kisiIdleri.has(Number(id)) && Number.isInteger(yer) && (yer as number) >= 0 && (yer as number) < 30) l[id] = yer as number;
    v.onayMasa.yerlesim[hafta] = l;
  }
  for (const [gun, x] of Object.entries(nesne(nesne(o.onayMasa).elle))) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(gun)) continue;
    const l: Record<string, string> = {};
    for (const [id, yer] of Object.entries(nesne(x))) if (kisiIdleri.has(Number(id)) && typeof yer === "string" && /^([1-7]|J)$/.test(yer)) l[id] = yer;
    if (Object.keys(l).length) v.onayMasa.elle[gun] = l;
  }
  for (const [yil, x] of Object.entries(nesne(o.tatilYillari))) if (/^\d{4}$/.test(yil) && x === true) v.tatilYillari[yil] = true;
  return v;
}
