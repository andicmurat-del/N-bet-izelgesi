// Çizelge motorunun dışa açık işlevleri. Her çağrı verinin kopyasıyla çalışır (Baglam), girdiyi hiç değiştirmez.
// Motor eski uygulamanın (../../../index.html) kural ve arama kodunun yeniden düzenlenmiş hâlidir; davranışı aynıdır:
// test/motor.test.js eski uygulamanın kayıtlı çizelgelerini, test/altin.test.js tüm işlevlerin çıktısını birebir denetler.
//
// Dosyalar:
//   baglam.ts       veri ve ona bağlı sorular (tatil mi, izinli mi, ayar…), roller
//   takvim.ts       saf tarih hesapları          sabitler.ts   kurallar, ayarlar, ağırlıklar (AGIRLIK)
//   istatistik.ts   ay sayımları                 devir.ts      önceki aylardan yıllık eşitlik devirleri
//   nobet/          çizelge oluşturma (olustur.ts adımları sıralar)
//   denetim.ts      elle gün düzenleme denetimi  puantaj.ts    aylık puantaj cetveli
//   degisim.ts      nöbet değişimi, yerine geçme raporlar.ts   çalışma listesi, acil servis, yıllık rapor, uyarı sınıfı
//   servis/         servis hazırlama dağıtımı
import type { Gorevli } from "../veri/tipler";
import { Baglam, type MotorCizelgesi } from "./baglam";
import { degisimDenetle as degisimDenetimi, yerineAdaylar, type Degisiklik } from "./degisim";
import { gunuDenetle as gunDenetimi } from "./denetim";
import { cizelgeUret } from "./nobet/olustur";
import { puantajIzgarasi } from "./puantaj";
import { acilDenetle as acilDenetimi, calismaListesi, yillikRapor } from "./raporlar";
import { ServisMotoru, type HesapSecenegi } from "./servis/ay";
import { ybMi, zorMu } from "./servis/liste";
import { tarihNo } from "./takvim";

export { AGIRLIK, FM_MAX_FARK, AYAR_VARSAYILAN } from "./sabitler";
export { PUANTAJ_KODLARI } from "./puantaj";
export { uyariSiniflandir } from "./raporlar";
export { ZOR_ESIK as SERVIS_ZOR_ESIK } from "./servis/liste";
export type { CizelgeSonucu } from "./nobet/olustur";

/**
 * Bir ayın çizelgesini oluşturur. veri: {staff, prefs, manualTatil, arife, settings, schedules, puantaj}; ay 0 = Ocak.
 * secenek.varyasyon: "farklı dağılım"; secenek.saat: aramanın süre sınırı için saat (testlerde sabit verilir).
 */
export function cizelgeOlustur(veri: unknown, yil: number, ay: number, secenek: { varyasyon?: number; saat?: () => number } = {}) {
  return cizelgeUret(new Baglam(veri), yil, ay, secenek.varyasyon || 0, secenek.saat || Date.now);
}

/** Elle düzenlenen bir günün kurallarını denetler. sch: ayın çizelgesi (düzenlenen gün eski hâliyle); gun 1'den */
export function gunuDenetle(veri: unknown, sch: MotorCizelgesi, gun: number, nobetciler: Gorevli[], hazirlama: Gorevli[]) {
  return gunDenetimi(new Baglam(veri), sch, gun, nobetciler, hazirlama);
}

/** Ayın puantaj cetveli: kişi başı gün gün kod ve saat, toplamlar, fazla mesai ve gündüz / gece dilimleri */
export function puantajHesapla(veri: unknown, yil: number, ay: number) { return puantajIzgarasi(new Baglam(veri), yil, ay); }

/** Değişim yapılırsa ne olur → {engel, uyari, bilgi} */
export function degisimDenetle(veri: unknown, d: Degisiklik) { return degisimDenetimi(new Baglam(veri), d); }
/** Görevden düşen kişinin (cik) yerine geçebilecekler: kurallara uyanlar önce, sonra yıl içinde en az görev alan */
export function yerineAdaylarHesapla(veri: unknown, y: number, m: number, gun: number, cik: number, gorev: "N" | "H") {
  return yerineAdaylar(new Baglam(veri), y, m, gun, cik, gorev);
}

/** Acil servis nöbeti denetimi: aynı kişi iki kez, izin/eş durumu, art arda iki gün, aynı gün eczane nöbeti */
export function acilDenetle(veri: unknown, y: number, m: number, g: number, ids: number[]) { return acilDenetimi(new Baglam(veri), y, m, g, ids); }
/** Günlük çalışma listesi: her gün kim onayda, kim hazırlamada, kim yok (izin/rapor) */
export function calismaListesiHesapla(veri: unknown, y: number, m: number) { return calismaListesi(new Baglam(veri), y, m); }
/** Yılın raporu: ay ay kişi başı puantaj özeti ve yıllık denge (çizelgeye göre) */
export function yillikRaporHesapla(veri: unknown, yil: number) { return yillikRapor(new Baglam(veri), yil); }

// ---- servis hazırlama: her çağrı verinin kopyasıyla çalışır; değişen ay kaydı (servisKayit["yıl-ay"]) sonuç olarak döner,
// ekran onu kaydeder. bugun: YYYYAAGG (öncesi geçmiş sayılır, kendiliğinden değişmez). ----
const bugunSayisi = () => { const n = new Date(); return tarihNo(n.getFullYear(), n.getMonth(), n.getDate()); };
const servisMotoru = (veri: unknown, bugun?: number) => new ServisMotoru(new Baglam(veri), ((veri || {}) as { servisAyar?: unknown }).servisAyar, bugun || bugunSayisi());

/** Servisler ekranı için servis listesi: kayıtlı ayarlar uygulanmış; varsayılanlar z0, h0, multi0 alanlarında */
export function servisListesi(veri: unknown) {
  return servisMotoru(veri).servisler.map(s => ({ id: s.id, name: s.name, z: s.z, h: s.h, multi: s.multi, on: s.on, z0: s.z0, h0: s.h0, multi0: s.multi0, ekstra: !!s.ekstra, yb: ybMi(s.name), zor: !!zorMu(s), grup: s.grps.length > 0 }));
}

/** Ayın dağıtımını günceller → {cizelgeVar, kayit (ayın kaydı ya da null), degisti, sil (çizelgesi silinen ayın kaydı silinmeli)} */
export function servisAyHesapla(veri: unknown, y: number, m: number, opts: HesapSecenegi | null | undefined, bugun?: number) {
  const S = servisMotoru(veri, bugun);
  opts = opts || {};
  if (!S.cizelgeVar(y, m)) return { cizelgeVar: false, kayit: null, degisti: false, sil: !!S.B.servisKayit[y + "-" + m] && !S.gecmisAy(y, m) };
  if (!opts.zorla && !S.otoHesaplanir(y, m)) return { cizelgeVar: true, kayit: S.kayitKopyasi(y, m), degisti: false };
  const degisti = S.ayHesapla(y, m, opts);
  return { cizelgeVar: true, kayit: S.kayitKopyasi(y, m), degisti };
}

/** Bir günün ekranı: kişiler (puantajdan, elle açılıp kapatılanlarla), dağıtım, çok günlük servis gün sayısı */
export function servisGunu(veri: unknown, y: number, m: number, d: number, bugun?: number) {
  const S = servisMotoru(veri, bugun);
  const V = S.ayVerisi(y, m), oto = S.otoGun(y, m, d), sonuc = S.gunSonucu(V, d), tatil = S.B.tatilMi(y, m, d);
  return {
    tatil, gecmis: tarihNo(y, m, d) < S.bugun, teknikerVar: V.satir.length > 0,
    kisiler: tatil ? [] : S.gunKisileri(V.G, V.R, d), oto, n: V.R.gunElle[d] || oto,
    ata: (V.R.ata && V.R.ata[d]) || {}, bayat: !!(sonuc && sonuc.rec.bayat),
    sonuc: sonuc ? { kisi: sonuc.kisi, svcs: sonuc.svcs, n: sonuc.rec.n } : null,
  };
}

export type ServisIslemi =
  | { tur: "kisi"; gun: number; id: number }        // kişiyi o gün dağıtıma kat / çıkar
  | { tur: "karistir"; gun: number }                // günü yeniden karıştır
  | { tur: "ngun"; gun: number; n: number }         // çok günlük servis gün sayısı
  | { tur: "yeniden"; gun: number }                 // bu günden itibaren yeniden dağıt
  | { tur: "ata"; gun: number; sn: string; hedef: number; karsilik: string | null }   // servisi elle başka teknikere ver
  | { tur: "oto"; gun: number; sn: string }         // elle atamayı kaldır
  | { tur: "ataSifirla"; gun: number }              // günün tüm elle atamalarını kaldır
  | { tur: "olustur"; gun?: number };               // geçmiş ay için dağıtım oluştur
/** Ay kaydında bir işlem yapar ve dağıtımı buna göre yeniler; ayın yeni kaydını döndürür */
export function servisIslem(veri: unknown, y: number, m: number, islem: ServisIslemi, bugun?: number) {
  const S = servisMotoru(veri, bugun);
  const R = S.kayit(y, m, true), d = islem.gun as number;
  let opts: HesapSecenegi = {};
  if (islem.tur === "kisi") {
    const V = S.ayVerisi(y, m), k = S.gunKisileri(V.G, R, d).find(x => x.id === islem.id);
    if (!k) return S.kayitKopyasi(y, m);
    const el = R.elle[d] || (R.elle[d] = {});
    if (!k.on === k.oto) delete el[k.id]; else el[k.id] = !k.on;
    if (!Object.keys(el).length) delete R.elle[d];
    opts = { from: d };
  } else if (islem.tur === "karistir") { R.sk[d] = (R.sk[d] || 0) + 1; opts = { from: d }; }
  else if (islem.tur === "ngun") { if (islem.n === S.otoGun(y, m, d)) delete R.gunElle[d]; else R.gunElle[d] = islem.n; opts = { from: d }; }
  else if (islem.tur === "yeniden") { opts = { from: d }; }
  else if (islem.tur === "ataSifirla") { delete R.ata[d]; opts = { zorlaGun: d, from: d + 1, gecmisKoru: true }; }
  else if (islem.tur === "oto") { const ata = R.ata[d] || {}; delete ata[islem.sn]; if (!Object.keys(ata).length) delete R.ata[d]; opts = { zorlaGun: d, from: d + 1, gecmisKoru: true }; }
  else if (islem.tur === "ata") {
    const rec = R.gun[d]; if (!rec || rec.a[islem.sn] === undefined) return S.kayitKopyasi(y, m);
    const kaynak = rec.a[islem.sn], A = R.ata[d] || (R.ata[d] = {});
    rec.a[islem.sn] = islem.hedef; A[islem.sn] = islem.hedef;
    if (islem.karsilik) { rec.a[islem.karsilik] = kaynak; A[islem.karsilik] = kaynak; }
    S.kayitTopla(rec); rec.z = Date.now();
    opts = { imzaTazele: d, from: d + 1, gecmisKoru: true };
  } else if (islem.tur === "olustur") { opts = { zorla: true }; }
  if (S.cizelgeVar(y, m)) S.ayHesapla(y, m, opts);
  return S.kayitKopyasi(y, m);
}

/** Bir servisi başka teknikere verme seçenekleri: gerekirse karşılığında geri verilecek servis ve uyarılar */
export function servisAtamaAdaylari(veri: unknown, y: number, m: number, d: number, sn: string, bugun?: number) {
  const S = servisMotoru(veri, bugun);
  const R = S.kayit(y, m, false), rec = R && R.gun[d];
  if (!R || !rec || rec.a[sn] === undefined) return null;
  const V = S.ayVerisi(y, m), kaynak = rec.a[sn], ata = R.ata[d] || {};
  const adaylar = rec.k.filter(id => id !== kaynak).map(id => {
    const pl = S.degisimPlani(rec, R, d, sn, id), L = S.kisiServisleri(rec, id);
    return { id, ad: V.ad(id), karsilik: pl.karsilik, uyari: pl.uyari, servis: L.length, yb: L.filter(ybMi).length, yuk: L.reduce((t, x) => t + S.yuk(x, rec.n), 0) };
  }).sort((a, b) => (a.uyari.length - b.uyari.length) || a.ad.localeCompare(b.ad, "tr"));
  return { kaynak, kaynakAd: V.ad(kaynak), elle: ata[sn] === kaynak, elleVar: ata[sn] !== undefined, adaylar };
}

/** Yılın servis raporu. Önce çizelgesi olan ayların dağıtımı güncellenir; dönüşte güncellenen kayıtlar (kayitlar) ve
 *  rapor verisi: kişi başı aylık yük, servis × kişi dağılımı. */
export function servisYillik(veri: unknown, yil: number, bugun?: number) {
  const S = servisMotoru(veri, bugun);
  const kayitlar: Record<string, unknown> = {};
  for (let mm = 0; mm < 12; mm++) {
    const k = yil + "-" + mm;
    if (!S.cizelgeVar(yil, mm)) { if (S.B.servisKayit[k] && !S.gecmisAy(yil, mm)) { delete S.B.servisKayit[k]; kayitlar[k] = null; } continue; }
    if (!S.otoHesaplanir(yil, mm)) continue;
    if (S.ayHesapla(yil, mm, {})) kayitlar[k] = S.kayitKopyasi(yil, mm);
  }
  const Y = S.yillikVeri(yil), adlar: Record<number, string> = {};
  Y.ids.forEach(id => { adlar[id] = Y.ad(id); });
  // servis × kişi: kaç kez ve çalıştığı günlere göre payı
  const recs = Y.aylar.flat(), say: Record<string, Record<number, number>> = {}, pay: Record<string, Record<number, number>> = {}, gun: Record<number, number> = {};
  for (const rec of recs) {
    const P = rec.k.length;
    rec.k.forEach(id => { gun[id] = (gun[id] || 0) + 1; });
    Object.keys(rec.a).forEach(sn => {
      const id = rec.a[sn]; (say[sn] = say[sn] || {})[id] = (say[sn][id] || 0) + 1;
      const ps = pay[sn] || (pay[sn] = {}); rec.k.forEach(k => { ps[k] = (ps[k] || 0) + 1 / P; });
    });
  }
  const grupOf = (sn: string) => { if (ybMi(sn)) return "yb"; const s = S.servis(sn); return s && s.multi ? "cok" : "tek"; };
  const servisler = Object.keys(say).sort((a, b) => a.localeCompare(b, "tr")).map(sn => ({ sn, grup: grupOf(sn), say: say[sn], pay: pay[sn] || {} }));
  // yük sapması: kişinin gün başı yükünün ekip ortalamasından farkı (oran)
  const yukSapma = (k: { gun: number; l: number; fl: number }) => { if (!k.gun || !k.fl) return 0; const o = k.l / k.gun, e = k.fl / k.gun; return (o - e) / e; };
  const kisi = Y.ids.map(id => { const k = Y.kisi[id]; return { id, ad: adlar[id], ay: k.ay, gun: k.gun, l: k.l, fl: k.fl, w: k.w, y: k.y, adet: k.adet, sapma: yukSapma(k) }; });
  return { kayitlar, kayitli: Y.kayitli, bosAy: Y.aylar.map(r => !r.length), kisi, matris: { servisler, gun } };
}
