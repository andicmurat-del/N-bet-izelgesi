// Veri katmanı: yedek doğrulama, kişi numarası, silme koruması, izin/rapor ve nöbet değişimi (geri alma dahil).
// .svelte.ts dosyaları vitest'te sunucu kipinde derlenir: $state düz nesnedir, $effect çalışmaz (kayıt yapılmaz).
import { describe, test, expect, beforeEach, vi } from "vitest";
import { depo, bosVeri, veriyiDogrula, cizelgeKaydet, yedekVerisi, yedektenYukle, kisiEkle, kisiSil, onayliGoreviVar, gecmis, gecmiseIsle, gecmisiSifirla, geriAl, yinele, onayla, tercihAyarla, listeyiOnayla, listeOnayiniKaldir, acilGunuAyarla, acilKaydet, acilAyiniSil, oglenGunuAyarla, oglenHaftasiniSil, oglenHaftaKaydet, oglenKaydet, haftayiOnayla, haftaOnayiniKaldir, haftaOnayi, onayGunuAyarla } from "../src/veri/depo.svelte.ts";
import { degisimUygula, degisimGeriAl, izinUygula, puantajIzgarasi } from "../src/veri/degisim.svelte.ts";
import { adAnahtari, adIcerir } from "../src/veri/tarih.ts";

const Y = 2026, M = 9, AY = `${Y}-${M}`;
const kopya = o => JSON.parse(JSON.stringify(o));
const haftaSonu = d => [0, 6].includes(new Date(Y, M, d).getDay());
// 4 eczacı (1-4) + 4 tekniker (5-8); her gün bir eczacı + bir tekniker nöbetçi, elle kurulmuş Ekim 2026 çizelgesi
function ornekVeri() {
  const v = bosVeri();
  for (let i = 1; i <= 8; i++) v.staff.push({ id: i, name: `K${i}`, role: i <= 4 ? "eczaci" : "teknisyen" });
  const kisi = id => ({ id, name: `K${id}`, role: id <= 4 ? "eczaci" : "teknisyen" });
  v.schedules[AY] = { year: Y, month: M, uyarilar: [], olusturma: 0,
    days: Array.from({ length: 31 }, (_, i) => ({ day: i + 1, tatil: haftaSonu(i + 1), conflict: false, fazlaMesai: 16, locked: false,
      assigned: [kisi((i % 4) + 1), kisi((i % 4) + 5)], prep: [] })) };
  return v;
}
const kod = (id, gun) => puantajIzgarasi(Y, M).satirlar.find(r => r.s.id === id).cells[gun - 1].kod;

beforeEach(() => { depo.veri = ornekVeri(); });

describe("yedek doğrulama", () => {
  test("onay listesinde elle değiştirilen günler: geçersiz gün, kişi ve yer atılır", () => {
    const o = kopya(depo.veri);
    o.onayMasa = { yerlesim: {}, elle: { "2026-11-09": { 1: "1", 2: "J", 3: "9", 99: "2" }, "x": { 1: "1" } } };
    const v = veriyiDogrula(o);
    expect(v.onayMasa.elle).toEqual({ "2026-11-09": { 1: "1", 2: "J" } });
  });
  test("bozuk gün kaydı olan çizelge atılır; sağlam çizelgenin günleri alan alan kurulur", () => {
    const v = ornekVeri();
    v.schedules["2026-10"] = { year: 2026, month: 10, days: [null], uyarilar: [], olusturma: 0 };
    v.schedules[AY].days[3] = { day: 4, assigned: [{ id: 1, name: "K1", role: "x" }, null] };
    const d = veriyiDogrula(v);
    expect(d.schedules["2026-10"]).toBeUndefined();
    expect(d.schedules[AY].days[3]).toEqual({ day: 4, tatil: false, conflict: false, fazlaMesai: 0, assigned: [{ id: 1, name: "K1", role: "eczaci" }], prep: [], locked: false });
  });
  test("boş bırakılan sayı ayarı varsayılana döner (0 olmaz)", () => {
    const v = ornekVeri(); v.settings.destekAylik = null; v.settings.arifeSaat = "";
    expect(veriyiDogrula(v).settings).toMatchObject({ destekAylik: 2, arifeSaat: 3 });
  });
  test("yedek gidiş-dönüş veriyi aynen korur", () => {
    const once = kopya(depo.veri);
    const metin = yedekVerisi();
    depo.veri = bosVeri();
    expect(yedektenYukle(metin)).toEqual({ tamam: true, atlanan: 0 });
    expect(kopya(depo.veri)).toEqual(once);
  });
  test("yedekteki \"__proto__\" alanları ortak nesne atasını (Object.prototype) kirletmez", () => {
    const veri = '{"staff":[{"id":1,"name":"A","role":"eczaci"}],"schedules":{},"puantaj":{"2026-0":{"__proto__":{"kirli":"M","toString":"M"},"1":{"3":"R","x":"M","45":"M"}}},"servisAyar":{"svc":{"__proto__":{"z":5}}},"servisKayit":{"2026-0":{"gun":{"__proto__":{"kirli":1}}}}}';
    try {
      // doğrulama tek başına da (ayrıştırılmış nesneyle) güvenli olmalı
      const v = veriyiDogrula(JSON.parse(veri));
      expect({}.kirli).toBeUndefined();
      expect(typeof {}.toString).toBe("function");
      // kişi no ve gün yalnız sayı: geçerli kayıt kalır, diğerleri atılır
      expect(v.puantaj).toEqual({ "2026-0": { 1: { 3: "R" } } });
      expect(yedektenYukle(`{"uygulama":"nobet-cizelgesi-v2","veri":${veri}}`).tamam).toBe(true);
      expect({}.kirli).toBeUndefined();
      expect(Object.getPrototypeOf(depo.veri.servisKayit["2026-0"].gun)).toBe(Object.prototype);
      expect(Object.keys(depo.veri.servisAyar.svc)).toEqual([]);
    } finally { delete Object.prototype.kirli; if (typeof Object.prototype.toString !== "function") delete Object.prototype.toString; }
  });
  test("ay ya da günü olmayacak değerde olan değişim kaydı atılır", () => {
    const d = { id: 1, zaman: 1, y: Y, m: M, gun: 3, cik: 1, yer: 2, cikAd: "a", yerAd: "b", cikOnce: null, yerOnce: null, cikYeni: "M", yerYeni: "N", gorev: "N" };
    const v = veriyiDogrula({ ...kopya(depo.veri), degisimler: [d, { ...d, id: 2, m: 99 }, { ...d, id: 3, gun: -4 }, { ...d, id: 4, gun: 32 }] });
    expect(v.degisimler.map(x => x.id)).toEqual([1]);
  });
  test("içi boş ya da bozuk yedek reddedilir, mevcut veri değişmez", () => {
    const once = kopya(depo.veri);
    for (const veri of [{}, "x", { staff: "a", schedules: {} }]) {
      expect(yedektenYukle(JSON.stringify({ uygulama: "nobet-cizelgesi-v2", veri })).tamam).toBe(false);
    }
    expect(kopya(depo.veri)).toEqual(once);
  });
});

describe("kişiler", () => {
  test("silinen kişinin numarası yeni kişiye verilmez", () => {
    depo.veri.staff = depo.veri.staff.filter(k => k.id !== 8);   // 8 çizelgede duruyor (onaysız ay olsa da)
    expect(kisiEkle("Yeni", "teknisyen").id).toBe(9);
  });
  test("onaylı ayda kaydı olan kişi silinmez (acil servis nöbeti dahil)", () => {
    depo.veri.staff.push({ id: 9, name: "Acil", role: "servis" });
    depo.veri.acil[AY] = { 5: [9] };
    depo.veri.schedules[AY].onay = { zaman: 1, kim: "" };
    expect(onayliGoreviVar(9)).toEqual([AY]);
    expect(kisiSil(9)).toBe(false);
    expect(kisiSil(1)).toBe(false);
    expect(depo.veri.staff.some(k => k.id === 9)).toBe(true);
    expect(depo.veri.acil[AY][5]).toEqual([9]);
  });
  test("onaysız ayda silinen kişinin değişim kayıtları da gider", () => {
    degisimUygula({ y: Y, m: M, gorev: "N", tur: "devir", gun: 1, cik: 1, yer: 3 });
    expect(kisiSil(3)).toBe(true);
    expect(depo.veri.degisimler).toEqual([]);
  });
});

describe("nöbet değişimi ve izin", () => {
  test("yerine tutma ve karşılıklı takas geri alınınca puantaj eski haline döner", () => {
    const once = kopya(depo.veri.puantaj);
    degisimUygula({ y: Y, m: M, gorev: "N", tur: "devir", gun: 1, cik: 1, yer: 3 });
    expect([kod(1, 1), kod(3, 1)]).toEqual(["M", "N"]);
    degisimUygula({ y: Y, m: M, gorev: "N", tur: "takas", gun: 6, cik: 2, yer: 4, gun2: 8, gorev2: "N" });
    expect([kod(2, 6), kod(4, 6), kod(2, 8), kod(4, 8)]).toEqual(["M", "N", "N", "M"]);
    const [devir, takas] = depo.veri.degisimler;
    expect(degisimGeriAl(takas.id).tamam).toBe(true);
    expect(degisimGeriAl(devir.id).tamam).toBe(true);
    expect(depo.veri.puantaj).toEqual(once);
    expect(depo.veri.degisimler).toEqual([]);
  });
  test("aynı güne sonradan yapılan değişim varsa önceki geri alınmaz", () => {
    degisimUygula({ y: Y, m: M, gorev: "N", tur: "devir", gun: 1, cik: 1, yer: 3 });
    degisimUygula({ y: Y, m: M, gorev: "N", tur: "devir", gun: 1, cik: 3, yer: 2 });
    expect(degisimGeriAl(depo.veri.degisimler[0].id)).toMatchObject({ tamam: false });
  });
  test("rapor: çizelgedeki görevin yerine geçen çizelgeye ve puantaja yazılır", () => {
    izinUygula(Y, M, 1, "R", 1, 1, [{ gun: 1, gorev: "N", yer: 3 }]);
    expect(depo.veri.schedules[AY].days[0].assigned.map(p => p.id)).toEqual([3, 5]);
    expect([kod(1, 1), kod(3, 1)]).toEqual(["R", "N"]);
    expect(depo.veri.degisimler[0]).toMatchObject({ zorunlu: true, cik: 1, yer: 3, sebep: "R" });
  });
  test("2 günlük rapor: devredilen nöbetin ertesi günü (nöbet izni değil artık) de rapor olur", () => {
    // 1 Ekim K1 nöbetçi, 2 Ekim nöbet ertesi izin (NI). 1–2 Ekim rapor, 1 Ekim nöbeti K3'e devredildi: 2 Ekim de R olmalı
    expect([kod(1, 1), kod(1, 2)]).toEqual(["N", "NI"]);
    izinUygula(Y, M, 1, "R", 1, 2, [{ gun: 1, gorev: "N", yer: 3 }]);
    expect([kod(1, 1), kod(1, 2)]).toEqual(["R", "R"]);
    expect(kod(3, 1)).toBe("N");
  });
  test("rapor: görev bir nöbet değişiminden geldiyse de yerine geçen puantaja yazılır", () => {
    // 2. gün çizelgede K2 nöbetçi; K1 değişimle onun yerine geçti, sonra K1 rapor aldı ve yerine K4 seçildi
    degisimUygula({ y: Y, m: M, gorev: "N", tur: "devir", gun: 2, cik: 2, yer: 1 });
    izinUygula(Y, M, 1, "R", 2, 2, [{ gun: 2, gorev: "N", yer: 4 }]);
    expect([kod(1, 2), kod(4, 2)]).toEqual(["R", "N"]);
    expect(depo.veri.schedules[AY].days[1].assigned.map(p => p.id)).toEqual([2, 6]);   // çizelge değişmez
    expect(depo.veri.degisimler.at(-1)).toMatchObject({ cik: 1, yer: 4, sebep: "R" });
    expect(depo.veri.degisimler.at(-1).zorunlu).toBeUndefined();
    // geri alınınca çizelgeye dokunulmaz, puantaj rapordan önceki haline döner
    expect(degisimGeriAl(depo.veri.degisimler.at(-1).id).tamam).toBe(true);
    expect(depo.veri.schedules[AY].days[1].assigned.map(p => p.id)).toEqual([2, 6]);
    expect([kod(1, 2), kod(4, 2)]).toEqual(["N", "M"]);
  });
});

describe("geri al / yinele", () => {
  // kayıt zamanlayıcısı testte çalışmaz: her değişiklikten sonra gecmiseIsle elle çağrılır, saat elle ilerletilir
  let saat = 1_000_000;
  const adim = (fn) => { fn(); saat += 1000; vi.setSystemTime(saat); gecmiseIsle(); };
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(saat); gecmisiSifirla(); });

  test("değişiklikler sırayla geri alınır ve yinelenir", () => {
    const bas = kopya(depo.veri);
    adim(() => { depo.veri.kurum.ad = "A"; });
    adim(() => { kisiEkle("Yeni", "eczaci"); });
    const son = kopya(depo.veri);
    expect(geriAl()).toBe(true);
    expect(depo.veri.staff.length).toBe(8);
    expect(depo.veri.kurum.ad).toBe("A");
    expect(geriAl()).toBe(true);
    expect(kopya(depo.veri)).toEqual(bas);
    expect(geriAl()).toBe(false);
    expect(yinele()).toBe(true);
    expect(yinele()).toBe(true);
    expect(kopya(depo.veri)).toEqual(son);
    expect(yinele()).toBe(false);
  });
  test("çok hızlı art arda değişiklikler tek adım sayılır; yeni değişiklik yinelemeyi siler", () => {
    for (let d = 1; d <= 5; d++) { tercihAyarla(1, 2026, 9, d, "izinli"); saat += 50; vi.setSystemTime(saat); gecmiseIsle(); }
    expect(gecmis.geri.length).toBe(1);
    geriAl();
    expect(Object.keys(depo.veri.prefs)).toEqual([]);
    adim(() => { depo.veri.kurum.ad = "B"; });
    expect(gecmis.ileri.length).toBe(0);
  });
  test("onay bir geri alma noktasıdır; geri alma onayı kaldırmaz", () => {
    adim(() => { depo.veri.kurum.ad = "C"; });
    onayla(2026, 9);
    expect(gecmis.geri.length).toBe(0);
    adim(() => { depo.veri.kurum.ad = "D"; });
    geriAl();
    expect(depo.veri.kurum.ad).toBe("C");
    expect(depo.veri.schedules[AY].onay).toBeTruthy();
  });
  test("onaylı ayın çizelgesi yeniden oluşturma sonucuyla ezilmez", () => {
    const gunler = kopya(depo.veri.schedules[AY].days);
    expect(cizelgeKaydet(Y, M, gunler, ["x"])).toBe(true);
    expect(depo.veri.schedules[AY].uyarilar).toEqual(["x"]);
    onayla(Y, M);
    expect(cizelgeKaydet(Y, M, gunler, ["y"])).toBe(false);
    expect(depo.veri.schedules[AY].uyarilar).toEqual(["x"]);
    expect(depo.veri.schedules[AY].onay).toBeTruthy();
  });
  test("servis dağıtım kaydı geri alınmaz", () => {
    adim(() => { depo.veri.kurum.ad = "E"; });
    depo.veri.servisKayit[AY] = { gun: {}, elle: {}, gunElle: {}, sk: {}, ad: {}, ata: {} };
    geriAl();
    expect(depo.veri.kurum.ad).toBe("");
    expect(depo.veri.servisKayit[AY]).toBeTruthy();
  });
});

describe("acil ve öğlen listesi onayı", () => {
  beforeEach(() => {
    depo.veri = ornekVeri();
    depo.veri.staff.push({ id: 9, name: "A1", role: "servis" }, { id: 10, name: "A2", role: "servis" }, { id: 11, name: "A3", role: "servis" });
    depo.veri.acil[AY] = { 5: [9, 10], 6: [11, 9] };
    depo.veri.oglen[AY] = { 5: { e: [1, 2], t: [5] } };
    gecmisiSifirla();
  });
  test("onaylı acil ayı değiştirilemez, silinemez, yeniden kaydedilemez; onay kaldırılınca açılır", () => {
    listeyiOnayla("acil", Y, M);
    acilGunuAyarla(Y, M, 5, [11]); acilKaydet(Y, M, [{ gun: 1, ids: [9] }]); acilAyiniSil(Y, M);
    expect(depo.veri.acil[AY]).toEqual({ 5: [9, 10], 6: [11, 9] });
    // sonradan izin alanın yerine yazma (onaylı düzeltme) yapılabilir
    acilGunuAyarla(Y, M, 6, [11, 10], true, true);
    expect(depo.veri.acil[AY][6]).toEqual([11, 10]);
    listeOnayiniKaldir("acil", Y, M);
    acilGunuAyarla(Y, M, 5, [11]);
    expect(depo.veri.acil[AY][5]).toEqual([11]);
  });
  // 5 Ekim 2026 Pazartesi: haftası 5–9 Ekim; 30 Kasım haftası Aralık'a uzanır
  test("onaylı öğlen haftası elle değiştirilemez ama izin / rapor onarımı yazılır", () => {
    haftayiOnayla("onay", Y, M, 5); haftayiOnayla("oglen", Y, M, 7);
    expect(haftaOnayi("oglen", Y, M, 9)).toBeTruthy();
    oglenGunuAyarla(Y, M, 5, [3], [6], { e: [3], t: [] }); oglenHaftasiniSil(Y, M, 5); oglenKaydet(Y, M, [{ gun: 5, e: [4], t: [7] }]);
    oglenHaftaKaydet([{ y: Y, m: M, bas: 5, bit: 9, gunler: [{ gun: 5, e: [4], t: [7] }] }]);
    expect(depo.veri.oglen[AY][5]).toEqual({ e: [1, 2], t: [5] });
    oglenKaydet(Y, M, [{ gun: 5, e: [1, 3], t: [5] }], true);
    expect(depo.veri.oglen[AY][5]).toEqual({ e: [1, 3], t: [5] });
  });
  test("öğlen nöbeti haftanın onay listesi onaylanmadan yazılmaz ve onaylanmaz", () => {
    oglenHaftaKaydet([{ y: Y, m: M, bas: 12, bit: 16, gunler: [{ gun: 12, e: [1, 2], t: [5] }] }]);
    expect(depo.veri.oglen[AY][12]).toBeUndefined();
    haftayiOnayla("oglen", Y, M, 12);
    expect(haftaOnayi("oglen", Y, M, 12)).toBeUndefined();
    haftayiOnayla("onay", Y, M, 14);
    oglenHaftaKaydet([{ y: Y, m: M, bas: 12, bit: 16, gunler: [{ gun: 12, e: [1, 2], t: [5] }, { gun: 13, e: [3, 4], t: [6] }] }]);
    expect(depo.veri.oglen[AY][12]).toEqual({ e: [1, 2], t: [5] });
    // öteki haftaların günleri değişmez
    expect(depo.veri.oglen[AY][5]).toEqual({ e: [1, 2], t: [5] });
  });
  test("ay sınırını aşan hafta tek parça yazılır ve onaylanır", () => {
    haftayiOnayla("onay", 2026, 11, 2);   // 2 Aralık Çarşamba: 30 Kasım – 4 Aralık
    expect(haftaOnayi("onay", 2026, 10, 30)).toBeTruthy();
    oglenHaftaKaydet([{ y: 2026, m: 10, bas: 30, bit: 30, gunler: [{ gun: 30, e: [1, 2], t: [5] }] }, { y: 2026, m: 11, bas: 1, bit: 4, gunler: [{ gun: 4, e: [1, 2, 3], t: [5, 6] }] }]);
    expect(depo.veri.oglen["2026-10"][30]).toEqual({ e: [1, 2], t: [5] });
    expect(depo.veri.oglen["2026-11"][4]).toEqual({ e: [1, 2, 3], t: [5, 6] });
  });
  test("onay listesinin onayı kalkınca haftanın öğlen nöbeti ve onayı silinir; onaylı onay listesi elle değiştirilmez", () => {
    haftayiOnayla("onay", Y, M, 5); haftayiOnayla("oglen", Y, M, 5);
    onayGunuAyarla("2026-10-06", { 1: "2", 2: "1" });
    expect(depo.veri.onayMasa.elle["2026-10-06"]).toBeUndefined();
    haftaOnayiniKaldir("onay", Y, M, 8);
    expect(haftaOnayi("oglen", Y, M, 5)).toBeUndefined();
    expect(depo.veri.oglen[AY]).toBeUndefined();
    onayGunuAyarla("2026-10-06", { 1: "2", 2: "1" });
    expect(depo.veri.onayMasa.elle["2026-10-06"]).toEqual({ 1: "2", 2: "1" });
  });
  test("eski kayıt: aylık öğlen onayı haftalara, yazılmış öğlen haftaları onay listesi onayına çevrilir", () => {
    const v = veriyiDogrula({ ...bosVeri(), staff: [{ id: 1, name: "A", role: "eczaci" }], oglen: { "2026-10": { 30: { e: [1], t: [] } } },
      listeOnay: { acil: {}, oglen: { "2026-10": { zaman: 5, kim: "X" } } } });
    expect(Object.keys(v.listeOnay.oglen).sort()).toEqual(["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30"]);
    expect(Object.keys(v.listeOnay.onay)).toEqual(["2026-11-30"]);
    // yeni kayıtta onay listesi onayı olduğu gibi okunur (öğlen nöbeti olan hafta kendiliğinden onaylanmaz)
    const w = veriyiDogrula({ ...bosVeri(), staff: [{ id: 1, name: "A", role: "eczaci" }], oglen: { "2026-10": { 30: { e: [1], t: [] } } }, listeOnay: { acil: {}, oglen: {}, onay: { "2026-11-30": { zaman: 5, kim: "" }, "2026-12-01": { zaman: 5, kim: "" } } } });
    expect(Object.keys(w.listeOnay.onay)).toEqual(["2026-11-30"]);
  });
  test("öğlen gününün elle yerleri yedekte korunur; listede olmayan kişi elle yer sayılmaz", () => {
    const v = veriyiDogrula({ ...bosVeri(), staff: [{ id: 1, name: "A", role: "eczaci" }, { id: 2, name: "B", role: "teknisyen" }],
      oglen: { [AY]: { 5: { e: [1], t: [], sabit: { e: [1, 2], t: [2], bt: 1 } }, 6: { e: [1], t: [2], sabit: { e: [], t: [] } } } } });
    expect(v.oglen[AY][5]).toEqual({ e: [1], t: [], sabit: { e: [1], t: [], bt: 1 } });
    expect(v.oglen[AY][6]).toEqual({ e: [1], t: [2] });
  });
  test("onay yedekte korunur, geri alma onayı ve onaylı listeyi değiştirmez; onaylı listedeki kişi silinmez", () => {
    depo.veri.acil[AY][5] = [9, 10]; gecmiseIsle();
    listeyiOnayla("acil", Y, M);
    const metin = yedekVerisi(); depo.veri = bosVeri(); yedektenYukle(metin);
    expect(depo.veri.listeOnay.acil[AY].zaman).toBeGreaterThan(0);
    expect(onayliGoreviVar(11)).toContain(AY);
    expect(kisiSil(11)).toBe(false);
    gecmisiSifirla(); depo.veri.oglen[AY][5].e = [3, 4]; gecmiseIsle();
    expect(geriAl()).toBe(true);
    expect(depo.veri.listeOnay.acil[AY]).toBeTruthy();
    expect(depo.veri.acil[AY][6]).toEqual([11, 9]);
  });
});

describe("ad karşılaştırma ve arama", () => {
  // eskiden "Ayşe  Kaya" (iki boşluk) ile "ayşe kaya" ayrı kişi sayılıyor, "sahin" araması "Şahin"i bulmuyordu
  test("aynı ad: boşluklar ve Türkçe büyük/küçük harf farkı yok sayılır", () => {
    expect(adAnahtari("  Ayşe   KAYA ")).toBe(adAnahtari("ayşe kaya"));
    expect(adAnahtari("IŞIK İNCE")).toBe(adAnahtari("ışık ince"));
    expect(adAnahtari("Ali")).not.toBe(adAnahtari("Âli Veli"));
  });
  test("arama Türkçe harflere duyarsız", () => {
    expect(adIcerir("Mehmet Şahin", "sahin")).toBe(true);
    expect(adIcerir("Işık Öztürk", "isik oz")).toBe(true);
    expect(adIcerir("Çağla Güneş", "CAGLA")).toBe(true);
    expect(adIcerir("Ayşe", "")).toBe(true);
    expect(adIcerir("Ayşe", "x")).toBe(false);
  });
});
