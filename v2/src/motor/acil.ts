// Acil eczane nöbet listesi: her gün 2 nöbetçi (24 saat). Eczane nöbet çizelgesinden bağımsız oluşturulur; hazırlama ve
// "her gün en az bir eczacı" kuralı yoktur. Nöbet tutanlar: acil servis personeli ve Personel'de "acilde nöbet tutar"
// işaretli eczacılar (görevi eczacı kalır; günlük eczanede mesai yapar, eczane nöbeti ve hazırlaması tutmaz). Kurallar eczane nöbetindeki gibi: izinli / eş durumu yok / çalışma dönemi
// dışındaki güne yazılmaz, art arda iki gün ve 5 günde 3 nöbet olmaz, mümkünse 2 gün aradan kaçınılır, ayda en fazla bir
// Cumartesi ve bir Pazar; izin, rapor (puantaj), eş durumu ve istiyor / istemiyor tercihleri eczane nöbetindeki gibi
// (eş durumu var: o gün yazılır; istemiyor: mümkünse yazılmaz; ertesi gün izne çıkana mümkünse yazılmaz); eşitlik ayrı (yalnız acil nöbetleri) ve yıl boyunca: toplam nöbet ile Perşembe, Cuma, Cumartesi, Pazar
// ve resmi tatil nöbetleri ayrı ayrı (günlük eczanedeki gibi), fazla mesai saati de her ay kişiler arasında; herkesin payı yazılabildiği gün sayısına göredir (izinli / raporlu günler düşülür, telafi istenmez). Kişinin aynı gün ya da komşu günde eczane nöbeti / hazırlaması varsa o güne yazılmaz (iki liste çakışmaz).
// Elle düzenlenen günler korunur.
import type { Kisi } from "../veri/tipler";
import { aktifAydaMi, aktifGunMu, type Baglam } from "./baglam";
import { ayAnahtari, ayGunSayisi, AYLAR, CUMA, CUMARTESI, gunKaydir, haftaGunu, oncekiAy, PAZAR, PERSEMBE } from "./takvim";

/** acil nöbetine yazılabilir mi: acil servis personeli ya da "acilde nöbet tutar" işaretli eczacı / kemoterapi eczacısı */
export const acilKadrosunda = (s: { role: string; acilTutar?: true }) =>
  s.role === "servis" || ((s.role === "eczaci" || s.role === "nobetci") && !!s.acilTutar);
/** günde acil nöbetçi sayısı */
const ACIL_GUNLUK = 2;

/** amaç ağırlıkları (küçük daha iyi) */
export const W = {
  ardArda: 1000,
  ucBes: 500,
  eksik: 5000,
  hsFazla: 60,
  hsKesin: 400,
  araIki: 3,
  toplam: 6,
  tur: 3,
  fm: 8,
  istemiyor: 20,
  istiyor: 1,
  esVar: 300,
  izinOnce: 200,
};

export interface AcilSonucu {
  gunler: { gun: number; ids: number[]; elle?: true }[];
  uyarilar: string[];
}

/** kişinin o gün ya da komşu günde eczane nöbeti / hazırlaması var mı (gerçekte tutulana göre; ay sınırı dahil) */
export function eczaneGoreviYakin(B: Baglam, id: number, y: number, m: number, d: number): boolean {
  for (const k of [-1, 0, 1]) {
    const [a, b, c] = gunKaydir(y, m, d, k),
      g = B.gercekGorev(a, b, c);
    if (g.N.includes(id) || g.H.includes(id)) return true;
  }
  return false;
}
/** kişinin o gün ya da komşu günde acil nöbeti var mı (eczane çizelgesi bu günlere yazmaz) */
export function acilNobetiYakin(B: Baglam, id: number, y: number, m: number, d: number): boolean {
  for (const k of [-1, 0, 1]) {
    const [a, b, c] = gunKaydir(y, m, d, k),
      l = B.acil[ayAnahtari(a, b)]?.[c];
    if (l && l.includes(id)) return true;
  }
  return false;
}

/** Eşitlenen gün türleri (günlük eczanedeki gibi, her biri yıl boyunca ayrı): toplam nöbet, Perşembe, Cuma (resmi tatil
 *  olmayan), Cumartesi, Pazar, resmi tatil. */
const TURLER = ["top", "pe", "cu", "cmt", "paz", "resmi", "fm"] as const;
type Tur = (typeof TURLER)[number];
type TurSayi = Record<Tur, Record<number, number>>;
const bosTur = (): TurSayi => ({ top: {}, pe: {}, cu: {}, cmt: {}, paz: {}, resmi: {}, fm: {} });
/** günün girdiği türler ve ağırlıkları (toplam her gün 1). "fm": nöbetin puantajdaki fazla mesaisi, 8 saat = 1
 *  (24 − o günün mesaisi − ertesi günün mesaisi): Cuma / hafta sonu nöbeti hafta içi nöbetinden fazla yazar; fazla
 *  mesai saati de kişiler arasında eşitlenir (günlük eczanedeki gibi). */
function gunTurleri(B: Baglam, y: number, m: number, d: number): [Tur, number][] {
  const dw = haftaGunu(y, m, d),
    resmi = B.resmiTatilMi(y, m, d),
    l: [Tur, number][] = [["top", 1]];
  if (dw === PERSEMBE && !resmi) l.push(["pe", 1]);
  if (dw === CUMA && !resmi) l.push(["cu", 1]);
  if (dw === CUMARTESI) l.push(["cmt", 1]);
  if (dw === PAZAR) l.push(["paz", 1]);
  if (resmi) l.push(["resmi", 1]);
  l.push(["fm", B.fazlaMesai(y, m, d, ayGunSayisi(y, m)) / 8]);
  return l;
}

/** Kişinin ayın nöbetinden payı (günlük eczanedeki gibi): her gün türünde o ay yazılabildiği gün sayısına göre. İzinli,
 *  raporlu, eş durumu yok, çalışma dönemi dışı günler kişiden düşülür; bu günler için sonradan telafi istenmez
 *  (her türde oranların toplamı 1; o türden müsait günü olmayanın payı 0). */
function acilPaylari(B: Baglam, y: number, m: number, havuz: Kisi[]): TurSayi {
  const mus = bosTur(),
    top: Record<string, number> = {},
    pay = bosTur();
  for (const s of havuz) for (const t of TURLER) mus[t][s.id] = 0;
  for (let d = 1; d <= ayGunSayisi(y, m); d++) {
    const tl = gunTurleri(B, y, m, d);
    for (const s of havuz) {
      if (!aktifGunMu(s, y, m, d) || B.kesinYasak(s.id, y, m, d)) continue;
      for (const [t, a] of tl) {
        mus[t][s.id] += a;
        top[t] = (top[t] || 0) + a;
      }
    }
  }
  for (const t of TURLER) for (const s of havuz) pay[t][s.id] = top[t] ? mus[t][s.id] / top[t] : 0;
  return pay;
}

/** yılın önceki aylarından kişi başı fark, her gün türünde: tutulan acil nöbeti − o ayki payı (yazılabildiği güne göre).
 *  İzin / rapor ayları telafi ettirilmez; ay ortası başlayan / ayrılan çalıştığı gün kadar pay alır. */
function acilDevir(B: Baglam, y: number, m: number): TurSayi {
  const off = bosTur();
  for (let mm = 0; mm < m; mm++) {
    const kayit = B.acil[ayAnahtari(y, mm)];
    if (!kayit) continue;
    const havuz = B.staff.filter(s => acilKadrosunda(s) && aktifAydaMi(s, y, mm));
    if (!havuz.length) continue;
    const c = bosTur(),
      T: Record<string, number> = {};
    for (const t of TURLER)
      havuz.forEach(s => {
        c[t][s.id] = 0;
      });
    for (const [gun, l] of Object.entries(kayit)) {
      const tl = gunTurleri(B, y, mm, Number(gun));
      l.forEach(id => {
        if (c.top[id] === undefined) return;
        for (const [t, a] of tl) {
          c[t][id] += a;
          T[t] = (T[t] || 0) + a;
        }
      });
    }
    const pay = acilPaylari(B, y, mm, havuz);
    for (const t of TURLER)
      havuz.forEach(s => {
        off[t][s.id] = (off[t][s.id] || 0) + c[t][s.id] - (T[t] || 0) * pay[t][s.id];
      });
  }
  return off;
}

/** Ayın acil nöbet listesini oluşturur (aynı veriyle her zaman aynı sonuç). elle: elle düzenlenen günler (korunur). */
export function acilOlustur(B: Baglam, y: number, m: number, elle: Record<string, true> = {}): AcilSonucu {
  const dim = ayGunSayisi(y, m),
    uyarilar: string[] = [],
    kayit = B.acil[ayAnahtari(y, m)] || {};
  const havuz = B.staff.filter(s => acilKadrosunda(s) && aktifAydaMi(s, y, m));
  const devir = acilDevir(B, y, m),
    pay = acilPaylari(B, y, m, havuz);
  // ay sınırı: önceki ayın son 6 günü ve sonraki ayın ilk 6 günündeki acil nöbetleri (art arda / 5 günde 3 için)
  const disGun: Record<number, number[]> = {};
  for (const k of [-5, -4, -3, -2, -1, 0, dim + 1, dim + 2, dim + 3, dim + 4, dim + 5, dim + 6]) {
    const [a, b, c] = gunKaydir(y, m, 1, k - 1);
    disGun[k] = B.acil[ayAnahtari(a, b)]?.[c] || [];
  }
  const aday: number[][] = [],
    sabit: boolean[] = [],
    sec: number[][] = [];
  for (let d = 1; d <= dim; d++) {
    const ca = havuz.filter(s => !B.kesinYasak(s.id, y, m, d) && !eczaneGoreviYakin(B, s.id, y, m, d)).map(s => s.id);
    aday.push(ca);
    if (elle[d]) {
      sabit.push(true);
      sec.push((kayit[d] || []).slice());
      continue;
    }
    sabit.push(false);
    sec.push([]);
    if (ca.length < ACIL_GUNLUK)
      uyarilar.push(
        d +
          " " +
          AYLAR[m] +
          ": acil nöbeti için " +
          ACIL_GUNLUK +
          " kişi gerekli, yazılabilen " +
          ca.length +
          " kişi var (izin ya da aynı / komşu günde eczane nöbeti).",
      );
  }
  const dw = Array.from({ length: dim }, (_, i) => haftaGunu(y, m, i + 1)),
    turler = Array.from({ length: dim }, (_, i) => gunTurleri(B, y, m, i + 1));
  // ayda en fazla 1 Cumartesi ve 1 Pazar: kadro yettiği ölçüde kesin. Kaçınılmaz fazla (o günlerin yerleri, o gün
  // yazılabilen kişilere birer gün düşecek biçimde dağıtılamıyorsa) hafif, kaçınılabilir fazla ağır cezalıdır.
  const hsSinir = (gun: number) => {
    const kullanildi = new Map<number, number>(),
      acik: number[][] = [];
    let zorunlu = 0,
      yer = 0;
    for (let i = 0; i < dim; i++) {
      if (dw[i] !== gun) continue;
      if (sabit[i]) {
        for (const id of sec[i]) {
          if (kullanildi.has(id)) zorunlu++;
          kullanildi.set(id, -1);
        }
        continue;
      }
      for (let k = 0; k < Math.min(ACIL_GUNLUK, aday[i].length); k++) acik.push(aday[i]);
    }
    yer = acik.length;
    // en çok eşleşme (her kişiye en çok bir yer): artırıcı yol
    const eslesen = new Map<number, number>();
    const dene = (y0: number, gorulen: Set<number>): boolean => {
      for (const id of acik[y0]) {
        if (kullanildi.get(id) === -1 || gorulen.has(id)) continue;
        gorulen.add(id);
        const o = eslesen.get(id);
        if (o === undefined || dene(o, gorulen)) {
          eslesen.set(id, y0);
          return true;
        }
      }
      return false;
    };
    let n = 0;
    for (let y0 = 0; y0 < acik.length; y0++) if (dene(y0, new Set())) n++;
    return { kacinilmaz: zorunlu + yer - n, yer, kisi: n };
  };
  const cmtSinir = hsSinir(CUMARTESI),
    pazSinir = hsSinir(PAZAR);
  // tercihler bir kez okunur (amaç işlevi her denemede yeniden hesaplanır)
  const tercihler = Array.from({ length: dim }, (_, i) => new Map(havuz.map(s => [s.id, B.tercih(s.id, y, m, i + 1)])));
  const tercih = (id: number, i: number) => tercihler[i].get(id) ?? B.tercih(id, y, m, i + 1);
  const esVarlar = aday.map((l, i) => l.filter(id => tercih(id, i) === "esVar"));
  // ertesi gün izne çıkana nöbet yazılmaz (nöbet ertesi izni izne denk gelir); başka kimse yoksa yazılır
  const izinOnce = Array.from({ length: dim }, (_, i) => new Set(havuz.filter(s => B.izinOncesiMi(s.id, y, m, i + 1)).map(s => s.id)));
  const var_ = (id: number, d: number) => (d >= 1 && d <= dim ? sec[d - 1].includes(id) : (disGun[d] || []).includes(id));
  // iki acil nöbeti arasında önerilen en az gün (Ayarlar > Acil eczane): daha yakın her nöbet çifti hafif cezalı
  const ara = Math.max(2, Math.min(6, B.sayi("acilMinAra") || 3));
  // Ayarlar: kadro yetmezse art arda acil nöbeti yazılsın mı. Kapalıysa art arda nöbet, boş kalan yerden daha ağır
  // cezalıdır ve hiç yazılmaz: gün eksik kalır, kullanıcıya söylenir
  const ardArdaSerbest = B.ayar("acilArdArda") !== false,
    W_ARDARDA = ardArdaSerbest ? W.ardArda : 3 * W.eksik;
  // kişi sırası (havuz) ve gün türleri dizi indisine çevrilir: amaç işlevi her denemede baştan hesaplanır, nesne yerine dizi
  const H = havuz.length,
    sira = new Map(havuz.map((s, k) => [s.id, k])),
    TN = TURLER.length;
  const turIdx = turler.map(l => l.map(([t, a]) => [TURLER.indexOf(t), a] as [number, number]));
  const payDz = new Float64Array(TN * H),
    devirDz = new Float64Array(TN * H),
    wDz = TURLER.map(t => (t === "top" ? W.toplam : t === "fm" ? W.fm : W.tur));
  TURLER.forEach((t, ti) =>
    havuz.forEach((s, k) => {
      payDz[ti * H + k] = pay[t][s.id];
      devirDz[ti * H + k] = t === "fm" ? 0 : devir[t][s.id] || 0;
    }),
  );
  const say = new Float64Array(TN * H),
    cmt = new Int32Array(H),
    paz = new Int32Array(H);
  // nöbet var mı tablosu (kişi × gün; ay dışındaki komşu günler sabit): var_ yerine dizi okuması
  const KAY = 6,
    L = dim + 2 * KAY + 1,
    dolu0 = new Uint8Array(H * L),
    dolu = new Uint8Array(H * L);
  for (const [d, l] of Object.entries(disGun))
    for (const id of l) {
      const k = sira.get(id);
      if (k !== undefined) dolu0[k * L + Number(d) + KAY] = 1;
    }
  const varK = (id: number, k: number | undefined, d: number) => (k === undefined ? var_(id, d) : dolu[k * L + d + KAY] === 1);
  const J = (): number => {
    let j = 0;
    say.fill(0);
    cmt.fill(0);
    paz.fill(0);
    dolu.set(dolu0);
    for (let i = 0; i < dim; i++)
      for (const id of sec[i]) {
        const k = sira.get(id);
        if (k !== undefined) dolu[k * L + i + 1 + KAY] = 1;
      }
    for (let i = 0; i < dim; i++) {
      if (!sabit[i]) j += W.eksik * Math.max(0, Math.min(ACIL_GUNLUK, aday[i].length) - sec[i].length);
      const d = i + 1;
      for (const id of sec[i]) {
        const k = sira.get(id);
        if (k !== undefined) {
          for (const [ti, a] of turIdx[i]) say[ti * H + k] += a;
          if (dw[i] === CUMARTESI) cmt[k]++;
          if (dw[i] === PAZAR) paz[k]++;
        }
        // ileriye bakan çiftler bir kez sayılır; ay başında önceki ayla olanlar da
        const v = (x: number) => varK(id, k, x);
        if (v(d + 1)) j += W_ARDARDA;
        for (let q = 2; q < ara; q++) if (v(d + q)) j += W.araIki;
        if (v(d + 2) && v(d + 4)) j += W.ucBes;
        if (d === 1 && v(0)) j += W_ARDARDA;
        for (let q = 2; q < ara; q++) if (d <= q && v(d - q)) j += W.araIki;
        if (d <= 4 && v(d - 2) && v(d - 4)) j += W.ucBes;
        if (d <= 2 && v(d - 2) && v(d + 2)) j += W.ucBes;
        const t = tercih(id, i);
        if (t === "avoid") j += W.istemiyor;
        else if (t === "want") j -= W.istiyor;
        if (izinOnce[i].has(id)) j += W.izinOnce;
      }
      for (const id of esVarlar[i]) if (!sec[i].includes(id)) j += W.esVar;
    }
    // bu ayın payı da yazılabildiği güne göre: izinli / raporlu olan o ay daha az alır, sonra telafi etmez;
    // fazla mesai saati her ay kendi içinde eşitlenir (günlük eczanedeki gibi aylık), diğer türler yıl boyunca
    for (let ti = 0; ti < TN; ti++) {
      let N = 0;
      for (let k = 0; k < H; k++) N += say[ti * H + k];
      for (let k = 0; k < H; k++) {
        const a = say[ti * H + k] - N * payDz[ti * H + k] + devirDz[ti * H + k];
        j += wDz[ti] * a * a;
      }
    }
    let fc = 0,
      fp = 0;
    for (let k = 0; k < H; k++) {
      if (cmt[k] > 1) fc += cmt[k] - 1;
      if (paz[k] > 1) fp += paz[k] - 1;
    }
    j += W.hsFazla * (fc + fp) + W.hsKesin * (Math.max(0, fc - cmtSinir.kacinilmaz) + Math.max(0, fp - pazSinir.kacinilmaz));
    return j;
  };
  // açgözlü başlangıç, sonra yerel arama (bir yeri değiştir / iki günün kişilerini takas et)
  for (let i = 0; i < dim; i++) {
    if (sabit[i]) continue;
    while (sec[i].length < Math.min(ACIL_GUNLUK, aday[i].length)) {
      let en = -1,
        enJ = Infinity;
      for (const id of aday[i]) {
        // art arda serbest değilse önceki / sonraki gün nöbeti olan yazılmaz
        if (sec[i].includes(id) || (!ardArdaSerbest && (var_(id, i) || var_(id, i + 2)))) continue;
        sec[i].push(id);
        const v = J();
        sec[i].pop();
        if (v < enJ - 1e-9) {
          enJ = v;
          en = id;
        }
      }
      if (en < 0) break;
      sec[i].push(en);
    }
  }
  let cur = J();
  for (let tur = 0; tur < 60; tur++) {
    let iyi = false;
    // eksik kalan yerler: yazılınca amaç iyileşiyorsa doldurulur (art arda serbest değilken yerler sonradan açılabilir)
    for (let i = 0; i < dim; i++) {
      if (sabit[i] || sec[i].length >= Math.min(ACIL_GUNLUK, aday[i].length)) continue;
      for (const id of aday[i]) {
        if (sec[i].includes(id) || sec[i].length >= ACIL_GUNLUK) continue;
        sec[i].push(id);
        const v = J();
        if (v < cur - 1e-9) {
          cur = v;
          iyi = true;
        } else sec[i].pop();
      }
    }
    for (let i = 0; i < dim; i++) {
      if (sabit[i]) continue;
      for (let q = 0; q < sec[i].length; q++)
        for (const id of aday[i]) {
          if (sec[i].includes(id)) continue;
          const eski = sec[i][q];
          sec[i][q] = id;
          const v = J();
          if (v < cur - 1e-9) {
            cur = v;
            iyi = true;
          } else sec[i][q] = eski;
        }
    }
    for (let i = 0; i < dim; i++)
      for (let k = i + 1; k < dim; k++) {
        if (sabit[i] || sabit[k]) continue;
        for (let a = 0; a < sec[i].length; a++)
          for (let b = 0; b < sec[k].length; b++) {
            const p = sec[i][a],
              r = sec[k][b];
            if (p === r || sec[k].includes(p) || sec[i].includes(r) || !aday[k].includes(p) || !aday[i].includes(r)) continue;
            sec[i][a] = r;
            sec[k][b] = p;
            const v = J();
            if (v < cur - 1e-9) {
              cur = v;
              iyi = true;
            } else {
              sec[i][a] = p;
              sec[k][b] = r;
            }
          }
      }
    // kuyruk takası: iki kişinin d gününden sonraki tüm nöbetleri yer değiştirir (aralar korunur; sıkışık dönüşümde
    // tek yer değişikliği hep art arda nöbet doğurduğu için eşitlik ancak böyle düzelir)
    for (let a = 0; a < havuz.length; a++)
      for (let b = a + 1; b < havuz.length; b++) {
        const p = havuz[a].id,
          r = havuz[b].id;
        for (let d0 = 0; d0 < dim; d0++) {
          const degisen: number[] = [];
          let olur = true;
          for (let i = d0; i < dim && olur; i++) {
            if (sabit[i]) continue;
            const vp = sec[i].includes(p),
              vr = sec[i].includes(r);
            if (vp === vr) continue;
            if ((vp && !aday[i].includes(r)) || (vr && !aday[i].includes(p))) olur = false;
            else degisen.push(i);
          }
          if (!olur || !degisen.length) continue;
          const takas = () =>
            degisen.forEach(i => {
              sec[i] = sec[i].map(x => (x === p ? r : x === r ? p : x));
            });
          takas();
          const v = J();
          if (v < cur - 1e-9) {
            cur = v;
            iyi = true;
          } else takas();
        }
      }
    if (!iyi) break;
  }
  // personel yetmediği için kalan art arda nöbetler ve karşılanamayan eş durumu / istemiyor bildirilir
  const ad = (id: number) => B.kisi(id)?.name ?? "";
  for (let i = 0; i < dim; i++) {
    if (sabit[i]) continue;
    for (const id of aday[i])
      if (tercih(id, i) === "esVar" && !sec[i].includes(id))
        uyarilar.push(i + 1 + " " + AYLAR[m] + ": " + ad(id) + " için eş durumu isteği acil listesinde karşılanamadı.");
    // o gün yazılamayan kişinin eş durumu isteği de söylenir (izin, izin kenarındaki hafta sonu, eczane görevi)
    for (const s of havuz)
      if (!aday[i].includes(s.id) && aktifGunMu(s, y, m, i + 1) && tercih(s.id, i) === "esVar")
        uyarilar.push(
          i +
            1 +
            " " +
            AYLAR[m] +
            ": " +
            s.name +
            " için eş durumu isteği acil listesinde karşılanamadı (o gün yazılamıyor: izin ya da aynı / komşu günde eczane görevi).",
        );
    for (const id of sec[i])
      if (tercih(id, i) === "avoid")
        uyarilar.push(i + 1 + " " + AYLAR[m] + ": " + ad(id) + " nöbet istemiyordu, başka uygun kişi olmadığı için yazıldı.");
  }
  const artArda: string[] = [];
  for (let i = 0; i < dim; i++)
    for (const id of sec[i]) {
      if (var_(id, i + 2))
        artArda.push(ad(id) + ": " + (i + 1) + " ve " + (i + 2) + " " + AYLAR[m] + " art arda acil nöbeti (personel yetmiyor).");
    }
  // art arda serbest değilken boş kalan yerler
  if (!ardArdaSerbest) {
    const eksik = sec
      .map((l, i) =>
        !sabit[i] && l.length < ACIL_GUNLUK && aday[i].length >= ACIL_GUNLUK
          ? i + 1 + " " + AYLAR[m] + " (" + l.length + "/" + ACIL_GUNLUK + ")"
          : "",
      )
      .filter(Boolean);
    if (eksik.length)
      uyarilar.push(
        AYLAR[m] +
          ": art arda nöbet yazılmadığı için (Ayarlar) şu günlerde acil nöbeti eksik kaldı: " +
          eksik.join(", ") +
          ". Acil kadrosu yetmiyor; günleri elle doldurun ya da kadroyu artırın.",
      );
  }
  // 5 günde 3 nöbet (d, d+2, d+4; ay başında önceki ayın günleriyle): kadro yetmediğinde yazılır, söylenir
  const ucBes: string[] = [];
  const onc = oncekiAy(y, m);
  const gunAdi = (d: number) => (d >= 1 ? d + " " + AYLAR[m] : ayGunSayisi(onc.y, onc.m) + d + " " + AYLAR[onc.m]);
  for (const s of havuz)
    for (let d = -3; d <= dim - 4; d++)
      if (d + 4 >= 1 && var_(s.id, d) && var_(s.id, d + 2) && var_(s.id, d + 4))
        ucBes.push(
          ad(s.id) + ": " + gunAdi(d) + ", " + gunAdi(d + 2) + " ve " + gunAdi(d + 4) + " 5 günde 3 acil nöbeti (personel yetmiyor).",
        );
  // çok sayıda art arda / 5 günde 3 nöbet kadronun yetmediğini gösterir: tek tek yerine tek satır
  if (artArda.length + ucBes.length > 5)
    uyarilar.push(
      AYLAR[m] +
        ": acil kadrosu yetmiyor; " +
        [artArda.length ? artArda.length + " kez art arda" : "", ucBes.length ? ucBes.length + " kez 5 günde 3" : ""]
          .filter(Boolean)
          .join(", ") +
        " acil nöbeti yazıldı (günde " +
        ACIL_GUNLUK +
        " kişi için art arda gün ve 5 günde 3 nöbet olmadan en az " +
        Math.ceil((5 * ACIL_GUNLUK) / 2) +
        " kişi gerekir).",
    );
  else uyarilar.push(...artArda, ...ucBes);
  // ayda en fazla 1 Cumartesi / 1 Pazar: aşıldıysa kimde ve neden (kadro yetmiyor ya da izin / komşu gün görevleri)
  {
    const hsSay = new Map<number, { c: number; p: number }>();
    sec.forEach((l, i) => {
      if (dw[i] !== CUMARTESI && dw[i] !== PAZAR) return;
      for (const id of l) {
        const o = hsSay.get(id) ?? { c: 0, p: 0 };
        if (dw[i] === CUMARTESI) o.c++;
        else o.p++;
        hsSay.set(id, o);
      }
    });
    let fc = 0,
      fp = 0;
    const asan: string[] = [];
    hsSay.forEach((o, id) => {
      fc += Math.max(0, o.c - 1);
      fp += Math.max(0, o.p - 1);
      const l = [o.c > 1 ? o.c + " Cumartesi" : "", o.p > 1 ? o.p + " Pazar" : ""].filter(Boolean);
      if (l.length) asan.push(ad(id) + " (" + l.join(", ") + ")");
    });
    if (asan.length) {
      asan.sort((p, q) => p.localeCompare(q, "tr"));
      const kadro = (ad: string, S: { kacinilmaz: number; yer: number; kisi: number }) =>
        S.kacinilmaz > 0 ? ad + ": " + S.yer + " yer, yazılabilen " + S.kisi + " kişiye birer gün düşüyor" : "";
      const yetmiyor = fc <= cmtSinir.kacinilmaz && fp <= pazSinir.kacinilmaz;
      uyarilar.push(
        AYLAR[m] +
          ": ayda en fazla 1 Cumartesi / 1 Pazar " +
          (yetmiyor
            ? "için acil kadrosu yetmiyor (" + [kadro("Cumartesi", cmtSinir), kadro("Pazar", pazSinir)].filter(Boolean).join("; ") + ")"
            : "kuralı esnetildi (izin, art arda nöbet ve eczane görevleri nedeniyle)") +
          ": " +
          asan.join(", ") +
          ".",
      );
    }
  }
  return {
    gunler: sec.map((ids, i) => ({
      gun: i + 1,
      ids: sabit[i] ? ids : ids.slice().sort((a, b) => a - b),
      ...(sabit[i] ? { elle: true as const } : {}),
    })),
    uyarilar,
  };
}
