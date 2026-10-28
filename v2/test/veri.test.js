// Veri katmanı: yedek doğrulama, kişi numarası, silme koruması, izin/rapor ve nöbet değişimi (geri alma dahil).
// .svelte.ts dosyaları vitest'te sunucu kipinde derlenir: $state düz nesnedir, $effect çalışmaz (kayıt yapılmaz).
import { describe, test, expect, beforeEach } from "vitest";
import { depo, bosVeri, veriyiDogrula, yedekVerisi, yedektenYukle, kisiEkle, kisiSil, onayliGoreviVar } from "../src/veri/depo.svelte.ts";
import { degisimUygula, degisimGeriAl, izinUygula, puantajIzgarasi } from "../src/veri/degisim.svelte.ts";

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
