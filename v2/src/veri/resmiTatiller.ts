// Türkiye'nin resmi tatilleri (2429 sayılı Kanun): sabit günler ve dini bayramlar, 2026–2050. Durumdan bağımsız.
//
// Dini bayramlar Hicri takvime göre her yıl yaklaşık 11 gün öne kayar. Aşağıdaki ilk gün tarihleri Ümmü'l-Kurâ Hicri
// takvimiyle hesaplanmıştır (Ramazan Bayramı: 1 Şevval, Kurban Bayramı: 10 Zilhicce); bu takvim 2019–2026 arasındaki
// bütün bayramlarda Diyanet'in ilan ettiği tarihlerle aynıdır. İleriki yıllarda Diyanet'in ilanı bir gün farklı olursa
// İzinler > Resmi tatil ve arife ekranından elle düzeltilir. Bayramdan önceki gün arifedir (yarım gün); 28 Ekim de
// Cumhuriyet Bayramı arifesidir.

/** tablonun kapsadığı yıllar (dini bayramlar); dışında yalnız sabit tatiller verilir */
export const TATIL_TABLO_YILLARI = [2026, 2050] as const;

/** Ramazan Bayramı ilk günü (1 Şevval), 2026–2050 (bazı yıllarda iki kez: 2033) */
const RAMAZAN = ["2026-03-20", "2027-03-09", "2028-02-26", "2029-02-14", "2030-02-04", "2031-01-24", "2032-01-14", "2033-01-03", "2033-12-23",
  "2034-12-12", "2035-12-01", "2036-11-19", "2037-11-09", "2038-10-29", "2039-10-19", "2040-10-07", "2041-09-27", "2042-09-16", "2043-09-05",
  "2044-08-24", "2045-08-14", "2046-08-04", "2047-07-24", "2048-07-13", "2049-07-02", "2050-06-21"];
/** Kurban Bayramı ilk günü (10 Zilhicce), 2026–2050 (bazı yıllarda iki kez: 2039) */
const KURBAN = ["2026-05-27", "2027-05-16", "2028-05-05", "2029-04-24", "2030-04-13", "2031-04-02", "2032-03-22", "2033-03-12", "2034-03-01",
  "2035-02-19", "2036-02-08", "2037-01-27", "2038-01-16", "2039-01-05", "2039-12-26", "2040-12-15", "2041-12-04", "2042-11-23", "2043-11-12",
  "2044-11-01", "2045-10-21", "2046-10-11", "2047-09-30", "2048-09-19", "2049-09-08", "2050-08-28"];
/** her yıl aynı gün (ay 1'den, gün) */
const SABIT: [number, number, string][] = [
  [1, 1, "Yılbaşı"], [4, 23, "Ulusal Egemenlik ve Çocuk Bayramı"], [5, 1, "Emek ve Dayanışma Günü"],
  [5, 19, "Atatürk'ü Anma, Gençlik ve Spor Bayramı"], [7, 15, "Demokrasi ve Millî Birlik Günü"], [8, 30, "Zafer Bayramı"], [10, 29, "Cumhuriyet Bayramı"],
];

/** bir tatil ya da arife günü; m 0'dan (Ocak 0) */
export interface TatilGunu { y: number; m: number; d: number; ad: string; arife: boolean }

const gunEkle = (iso: string, k: number) => { const [y, m, d] = iso.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1, d + k)); return [t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()] as const; };

/** Yılın resmi tatilleri ve arifeleri, tarih sırasıyla. Aynı gün hem tatil hem arife olursa tatil sayılır; iki tatil
 *  aynı güne düşerse adları birlikte yazılır (ör. 29 Ekim 2038). */
const onbellek = new Map<number, TatilGunu[]>();
export function yilinTatilleri(yil: number): TatilGunu[] {
  const hazir = onbellek.get(yil);
  if (hazir) return hazir;
  const l = new Map<string, TatilGunu>();
  const ekle = (y: number, m: number, d: number, ad: string, arife: boolean) => {
    if (y !== yil) return;
    const k = `${m}-${d}`, o = l.get(k);
    if (!o) { l.set(k, { y, m, d, ad, arife }); return; }
    if (o.arife && !arife) l.set(k, { y, m, d, ad, arife });          // tatil arifeden önce gelir
    else if (o.arife === arife && !o.ad.includes(ad)) o.ad += " · " + ad;
  };
  for (const [m, d, ad] of SABIT) ekle(yil, m - 1, d, ad, false);
  ekle(yil, 9, 28, "Cumhuriyet Bayramı arifesi", true);
  for (const [liste, ad, gun] of [[RAMAZAN, "Ramazan Bayramı", 3], [KURBAN, "Kurban Bayramı", 4]] as const) {
    for (const ilk of liste) {
      const [ay] = gunEkle(ilk, 0);
      if (Math.abs(ay - yil) > 1) continue;
      ekle(...gunEkle(ilk, -1), ad + " arifesi", true);
      for (let i = 0; i < gun; i++) ekle(...gunEkle(ilk, i), `${ad} ${i + 1}. gün`, false);
    }
  }
  const sonuc = [...l.values()].sort((a, b) => a.m - b.m || a.d - b.d);
  onbellek.set(yil, sonuc);
  return sonuc;
}

/** dini bayram tarihleri bu yıl için tabloda var mı */
export const diniBayramlarVar = (yil: number) => yil >= TATIL_TABLO_YILLARI[0] && yil <= TATIL_TABLO_YILLARI[1];

/** günün resmi tatil / arife adı (tabloya göre; yoksa null) */
export function tatilAdi(y: number, m: number, d: number): string | null {
  return yilinTatilleri(y).find(t => t.m === m && t.d === d)?.ad ?? null;
}
