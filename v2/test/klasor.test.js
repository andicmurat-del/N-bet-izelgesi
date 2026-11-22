// Ortak klasör kipi: kasa (giriş, roller, şifreler, kurtarma, kullanıcı kaldırma), şifreli ve imzalı kayıtlar, kurallar.
import { describe, expect, it } from "vitest";
import { bellekKlasoru } from "../src/veri/klasor/dosya";
import { bellekIzDeposu, girisYap, kasaOlustur, kurtarmaIleSifirla, KASA_DOSYASI, KasaHatasi } from "../src/veri/klasor/kasa";
import { belgeDosyasi, belgeleriYenile, klasorDb } from "../src/veri/klasor/belgeler";
import { klasorPlatformu } from "../src/veri/klasor/platform";

const T = { tekrar: 1000 };
async function kur() {
  const k = bellekKlasoru();
  const iz = bellekIzDeposu();
  const { oturum, kurtarmaKodu } = await kasaOlustur(k, { ad: "Ayşe Kaya", kullaniciAdi: "Ayse", sifre: "sahip-sifre-1" }, { ...T, iz });
  return { k, iz, sahip: oturum, kurtarmaKodu };
}
const hataKodu = async p => {
  try {
    await p;
  } catch (e) {
    return e.code ?? e.message;
  }
  return null;
};

describe("kasa", () => {
  it("kurulur; doğru şifreyle girilir, yanlışla girilmez; dosyada şifre ya da veri anahtarı açık durmaz", async () => {
    const { k, iz, sahip, kurtarmaKodu } = await kur();
    expect(sahip.rol).toBe("sahip");
    expect(kurtarmaKodu).toMatch(/^[A-Z2-9]{5}(-[A-Z2-9]{5}){4}$/);
    const metin = k.dosyalar.get(KASA_DOSYASI).metin;
    expect(metin).not.toContain("sahip-sifre-1");
    expect(metin).not.toContain('"d"');
    const o = await girisYap(k, "AYSE", "sahip-sifre-1", { iz });
    expect(o.id).toBe(sahip.id);
    expect(await hataKodu(girisYap(k, "ayse", "yanlis-sifre", { ...T, iz }))).toBe("giris");
    expect(await hataKodu(girisYap(k, "yok", "sahip-sifre-1", { ...T, iz }))).toBe("giris");
    // aynı klasöre ikinci kasa kurulmaz
    expect(await hataKodu(kasaOlustur(k, { ad: "B", kullaniciAdi: "bbb", sifre: "12345678x" }, { ...T, iz }))).toBe("var");
  });

  it("değiştirilen kasa dosyası açılmaz; bu bilgisayar eski kopyaya dönüşü fark eder", async () => {
    const { k, iz, sahip } = await kur();
    const ilk = k.dosyalar.get(KASA_DOSYASI).metin;
    const o = JSON.parse(ilk);
    o.imzali.kisiler[0].rol = "katkida";
    await k.yaz(KASA_DOSYASI, JSON.stringify(o));
    expect(await hataKodu(girisYap(k, "ayse", "sahip-sifre-1", { iz }))).toBe("imza");
    await k.yaz(KASA_DOSYASI, ilk);
    await sahip.kullaniciEkle({ ad: "Can", kullaniciAdi: "can", sifre: "gecici-123", rol: "katkida" });
    // eski (imzası doğru) kopya geri konursa: bu bilgisayar daha yeni sürümü gördü
    await k.yaz(KASA_DOSYASI, ilk);
    expect(await hataKodu(girisYap(k, "ayse", "sahip-sifre-1", { iz }))).toBe("eski");
    // başka bir bilgisayar (iz yok) eski kopyayı açabilir: koruma bu bilgisayarın hatırladığıyla sınırlı
    await girisYap(k, "ayse", "sahip-sifre-1", { iz: bellekIzDeposu() });
  });

  it("yeni kullanıcı geçici şifreyle girer, şifresini değiştirir; sorumlu kullanıcı ekleyemez", async () => {
    const { k, iz, sahip } = await kur();
    await sahip.kullaniciEkle({ ad: "Can Demir", kullaniciAdi: "can", sifre: "gecici-123", rol: "katkida" });
    const can = await girisYap(k, "can", "gecici-123", { iz });
    expect(can.sifreDegismeli).toBe(true);
    expect(can.rol).toBe("katkida");
    await can.sifreDegistir("gecici-123", "can-yeni-sifre");
    expect(can.sifreDegismeli).toBe(false);
    expect(await hataKodu(girisYap(k, "can", "gecici-123", { ...T, iz }))).toBe("giris");
    const can2 = await girisYap(k, "can", "can-yeni-sifre", { iz });
    expect(await hataKodu(can2.kullaniciEkle({ ad: "X", kullaniciAdi: "xxx", sifre: "12345678x", rol: "sahip" }))).toBe("yetki");
    expect(await hataKodu(can2.sifreDegistir("yanlis-eski", "baska-sifre-1"))).toBe("giris");
    // aynı kullanıcı adı ikinci kez eklenmez; kısa şifre kabul edilmez
    expect(await hataKodu(sahip.kullaniciEkle({ ad: "C", kullaniciAdi: "CAN", sifre: "12345678x", rol: "katkida" }))).toBe("girdi");
    expect(await hataKodu(sahip.kullaniciEkle({ ad: "D", kullaniciAdi: "ddd", sifre: "kisa", rol: "katkida" }))).toBe("girdi");
  });

  it("son sahip kaldırılamaz ya da düşürülemez; sahip yapılan kişi kullanıcı yönetebilir", async () => {
    const { k, iz, sahip } = await kur();
    expect(await hataKodu(sahip.kullaniciGuncelle(sahip.id, { rol: "katkida" }))).toBe("girdi");
    const id = await sahip.kullaniciEkle({ ad: "Ece", kullaniciAdi: "ece", sifre: "gecici-123", rol: "duzenleyen" });
    await sahip.kullaniciGuncelle(id, { rol: "sahip" });
    const ece = await girisYap(k, "ece", "gecici-123", { iz });
    expect(ece.sahipMi).toBe(true);
    await ece.kullaniciEkle({ ad: "Fatma", kullaniciAdi: "fatma", sifre: "gecici-123", rol: "katkida" });
    await sahip.kullaniciGuncelle(sahip.id, { rol: "katkida" });
    await sahip.tazeleZorla();
    expect(sahip.rol).toBe("katkida");
    expect(sahip.sahipMi).toBe(false);
  });

  it("kurtarma anahtarı sahibin unutulan şifresini yeniler; yanlış anahtar işe yaramaz", async () => {
    const { k, iz, kurtarmaKodu } = await kur();
    expect(await hataKodu(kurtarmaIleSifirla(k, "AAAAA-AAAAA-AAAAA-AAAAA-AAAAA", "ayse", "yeni-sifre-99", { ...T, iz }))).toBe("giris");
    await kurtarmaIleSifirla(k, kurtarmaKodu.toLowerCase().replace(/-/g, " "), "ayse", "yeni-sifre-99", { ...T, iz });
    const o = await girisYap(k, "ayse", "yeni-sifre-99", { iz });
    expect(o.sahipMi).toBe(true);
    expect(o.kasa.imzali.bakim).toBe(true);
  });
});

describe("şifreli kayıtlar", () => {
  it("kayıt şifreli yazılır, öteki kullanıcı okur; değiştirilen ya da yeri değiştirilen dosya kullanılmaz", async () => {
    const { k, iz, sahip } = await kur();
    await sahip.kullaniciEkle({ ad: "Can", kullaniciAdi: "can", sifre: "gecici-123", rol: "katkida" });
    const db = klasorDb(sahip);
    await db.doc("nobet/ana").set({ z: 5, json: '{"gizli":"Ahmet Yılmaz izinli"}' });
    await db.collection("nobet/ana/aylar").doc("2026-11").set({ json: "kasım" });
    const ham = k.dosyalar.get(belgeDosyasi("nobet/ana")).metin;
    expect(ham).not.toContain("Ahmet");
    const can = klasorDb(await girisYap(k, "can", "gecici-123", { iz }));
    expect((await can.doc("nobet/ana").get()).data()).toEqual({ z: 5, json: '{"gizli":"Ahmet Yılmaz izinli"}' });
    expect((await can.collection("nobet/ana/aylar").limit(10).get()).docs.map(d => d.id)).toEqual(["2026-11"]);
    // başka kaydın dosyası buraya kopyalanırsa açılmaz (yol şifrelemeye bağlı)
    await k.yaz(belgeDosyasi("nobet/yonetim"), ham);
    expect(await hataKodu(can.doc("nobet/yonetim").get())).toBe("bozuk");
    // tek bir harfi değişen dosya açılmaz
    const z = JSON.parse(ham);
    z.v = (z.v[0] === "A" ? "B" : "A") + z.v.slice(1);
    await k.yaz(belgeDosyasi("nobet/ana"), JSON.stringify(z));
    expect(await hataKodu(can.doc("nobet/ana").get())).toBe("bozuk");
  });

  it("yetki: sorumlu personel / ayar kaydını yazamaz; yazdığı sahte kayıt (kuralı atlayarak) kullanılmaz", async () => {
    const { k, iz, sahip } = await kur();
    await sahip.kullaniciEkle({ ad: "Can", kullaniciAdi: "can", sifre: "gecici-123", rol: "katkida" });
    const canO = await girisYap(k, "can", "gecici-123", { iz });
    const can = klasorDb(canO);
    expect(await hataKodu(can.doc("nobet/yonetim").set({ json: "{}" }))).toBe("invalid_argument");
    expect(await hataKodu(can.doc(`gecmis/${sahip.id}`).set({ ilk: 1 }))).toBe("invalid_argument");
    await can.doc(`gecmis/${canO.id}`).set({ ilk: 1 });
    // programı atlayıp kendi imzasıyla yönetim kaydı yazan sorumlu: kurala uymadığı için okunmaz
    canO.ben = { ...canO.ben, rol: "duzenleyen" };
    await can.doc("nobet/yonetim").set({ json: '{"staff":[]}' });
    expect(await hataKodu(klasorDb(sahip).doc("nobet/yonetim").get())).toBe("imza");
  });

  it("kaldırılan kullanıcı: oturumu kapanır, yeni anahtarla yazılanları açamaz; yazdığı kayıtlar sahibin imzasıyla yenilenir", async () => {
    const { k, iz, sahip } = await kur();
    await sahip.kullaniciEkle({ ad: "Ece", kullaniciAdi: "ece", sifre: "gecici-123", rol: "duzenleyen" });
    const eceO = await girisYap(k, "ece", "gecici-123", { iz });
    const ece = klasorDb(eceO);
    await ece.doc("nobet/yonetim").set({ json: "ece yazdı" });
    await ece.collection(`gecmis/${eceO.id}/aylar`).doc("2026-11").set({ ay: "2026-11", n: 1, bas: 1, k: [] });
    const eskiKasa = k.dosyalar.get(KASA_DOSYASI).metin;
    const eskiNesil = sahip.kasa.imzali.guncel;

    await sahip.kullaniciKaldir(eceO.id);
    expect(sahip.kasa.imzali.guncel).not.toBe(eskiNesil);
    // kaldırılan kişinin yönetim kaydı bakımdan önce geçersiz (yazan artık etkin değil)
    const sdb = klasorDb(sahip);
    expect(await hataKodu(sdb.doc("nobet/yonetim").get())).toBe("imza");
    const r = await belgeleriYenile(sahip, { bekleme: 0 });
    expect(r).toEqual({ yenilenen: 2, kalan: 0 });
    expect(Object.keys(sahip.kasa.imzali.anahtarlar)).toEqual([sahip.kasa.imzali.guncel]);
    expect(sahip.kasa.imzali.bakim).toBeUndefined();
    expect((await sdb.doc("nobet/yonetim").get()).data()).toEqual({ json: "ece yazdı" });
    // geçmiş kaydı Ece'nin kendi imzasıyla kalır ve geçerlidir
    const g = await sdb.collection(`gecmis/${eceO.id}/aylar`).get();
    expect(g.docs.length).toBe(1);
    // Ece'nin açık oturumu kapanır (kasaya birkaç saniyede bir bakılır)
    await eceO.tazeleZorla();
    expect(await hataKodu(ece.doc("nobet/ana").get())).toBe("revoked");
    expect(eceO.iptal?.neden).toBe("kaldirildi");
    // eski kasa kopyasını saklayan Ece giremez (bu bilgisayar yeni sürümü gördü); başka bilgisayarda girse de yeni
    // anahtarla yazılan kayıtları açamaz
    await sdb.doc("nobet/ana").set({ z: 9, json: "yeni" });
    const k2 = bellekKlasoru();
    for (const [y, d] of k.dosyalar) k2.dosyalar.set(y, d);
    k2.dosyalar.set(KASA_DOSYASI, { metin: eskiKasa, z: 1 });
    const eceEski = await girisYap(k2, "ece", "gecici-123", { iz: bellekIzDeposu() });
    expect(await hataKodu(klasorDb(eceEski).doc("nobet/ana").get())).toBe("anahtar");
  });

  it("kaldırma sırasında başka bir bilgisayarın eski anahtarla yazdığı kayıt da yeni anahtara geçer (eski nesil sonra atılır)", async () => {
    const { k, iz, sahip } = await kur();
    await sahip.kullaniciEkle({ ad: "Can", kullaniciAdi: "can", sifre: "gecici-123", rol: "katkida" });
    const xId = await sahip.kullaniciEkle({ ad: "X", kullaniciAdi: "xxx", sifre: "gecici-123", rol: "katkida" });
    const canO = await girisYap(k, "can", "gecici-123", { iz });
    const can = klasorDb(canO);
    await can.doc("nobet/ana").get(); // Can'ın kasaya son bakışı şimdi: birkaç saniye yeniden bakmaz
    await sahip.kullaniciKaldir(xId);
    await can.doc("nobet/ana").set({ z: 1, json: "can eski anahtarla" });
    expect(JSON.parse(k.dosyalar.get(belgeDosyasi("nobet/ana")).metin).a).not.toBe(sahip.kasa.imzali.guncel);
    const r = await belgeleriYenile(sahip, { bekleme: 0 });
    expect(r.kalan).toBe(0);
    expect(Object.keys(sahip.kasa.imzali.anahtarlar)).toEqual([sahip.kasa.imzali.guncel]);
    expect((await klasorDb(sahip).doc("nobet/ana").get()).data().json).toBe("can eski anahtarla");
  });

  it("şifresi sıfırlanan kişinin oturumu kapanır; eski imzalı kayıtları bakımla yenilenir", async () => {
    const { k, iz, sahip } = await kur();
    await sahip.kullaniciEkle({ ad: "Can", kullaniciAdi: "can", sifre: "gecici-123", rol: "katkida" });
    const canO = await girisYap(k, "can", "gecici-123", { iz });
    await klasorDb(canO).doc("nobet/ana").set({ z: 3, json: "can" });
    await sahip.sifreSifirla(canO.id, "yeni-gecici-1");
    await canO.tazeleZorla();
    expect(canO.iptal?.neden).toBe("sifirlandi");
    const sdb = klasorDb(sahip);
    expect(await hataKodu(sdb.doc("nobet/ana").get())).toBe("imza");
    await belgeleriYenile(sahip, { bekleme: 0 });
    expect((await sdb.doc("nobet/ana").get()).data()).toEqual({ z: 3, json: "can" });
    const yeni = await girisYap(k, "can", "yeni-gecici-1", { iz });
    expect(yeni.sifreDegismeli).toBe(true);
  });

  it("baş sorumluluktan çıkan kişinin yazdığı personel kaydı sahibin imzasıyla yenilenir", async () => {
    const { k, iz, sahip } = await kur();
    const id = await sahip.kullaniciEkle({ ad: "Ece", kullaniciAdi: "ece", sifre: "gecici-123", rol: "duzenleyen" });
    await klasorDb(await girisYap(k, "ece", "gecici-123", { iz }))
      .doc("nobet/yonetim")
      .set({ json: "ece" });
    const { yoneticilikten } = await sahip.kullaniciGuncelle(id, { rol: "katkida" });
    expect(yoneticilikten).toBe(id);
    const sdb = klasorDb(sahip);
    expect(await hataKodu(sdb.doc("nobet/yonetim").get())).toBe("imza");
    await belgeleriYenile(sahip, { eskiYoneticiler: [id], bekleme: 0 });
    expect((await sdb.doc("nobet/yonetim").get()).data()).toEqual({ json: "ece" });
  });

  it("kilit: biri tutarken öteki alamaz, süresi dolunca alınır", async () => {
    const { sahip } = await kur();
    const db = klasorDb(sahip);
    const a = await db.doc("nobet/kilit").acquire({ holder: "a", ttlMs: 200 });
    const b = await db.doc("nobet/kilit").acquire({ holder: "b", ttlMs: 200 });
    expect([a.acquired, b.acquired]).toEqual([true, false]);
    expect((await db.doc("nobet/kilit").acquire({ holder: "a", ttlMs: 200 })).acquired).toBe(true);
    await new Promise(r => setTimeout(r, 250));
    expect((await db.doc("nobet/kilit").acquire({ holder: "b", ttlMs: 200 })).acquired).toBe(true);
  });

  it("dinleme: başka oturumun yazdığı kayıt bildirilir", async () => {
    const { k, iz, sahip } = await kur();
    await sahip.kullaniciEkle({ ad: "Can", kullaniciAdi: "can", sifre: "gecici-123", rol: "katkida" });
    const can = klasorDb(await girisYap(k, "can", "gecici-123", { iz }), { yoklama: 20 });
    const gelen = [];
    const dur = can.doc("nobet/ana").onSnapshot(b => gelen.push(b.exists ? b.data().z : null));
    await new Promise(r => setTimeout(r, 60));
    await klasorDb(sahip).doc("nobet/ana").set({ z: 7, json: "x" });
    await new Promise(r => setTimeout(r, 100));
    dur();
    can.kapat();
    expect(gelen).toEqual([null, 7]);
  });

  it("platform: kullanıcı yeteneği kasadan; oda öteki oturumları gösterir", async () => {
    const { k, iz, sahip } = await kur();
    await sahip.kullaniciEkle({ ad: "Can Demir", kullaniciAdi: "can", sifre: "gecici-123", rol: "katkida" });
    const canO = await girisYap(k, "can", "gecici-123", { iz });
    const p1 = klasorPlatformu(sahip, klasorDb(sahip), { odaAraligi: 30 });
    const p2 = klasorPlatformu(canO, klasorDb(canO), { odaAraligi: 30 });
    const u = await p2.use("user");
    expect(await u.me()).toEqual({ id: canO.id, name: "Can Demir", isOwner: false, canEdit: false });
    expect((await u.profiles([sahip.id]))[sahip.id].name).toBe("Ayşe Kaya");
    const oda1 = await p1.use("room"),
      oda2 = await p2.use("room");
    await oda1.presence({ sayfa: "gunluk", alt: "nobet", ay: "2026-10" });
    await oda2.presence({ sayfa: "ayarlar", alt: "genel", ay: "2026-10" });
    const gorulen = await new Promise(r => {
      const dur = oda1.onPeers(({ peers }) => {
        if (peers.length === 2) {
          dur();
          r(peers);
        }
      });
    });
    expect(gorulen.find(p => !p.isMe)).toMatchObject({ by: canO.id, presence: { sayfa: "ayarlar" } });
    await p1.kapat();
    await p2.kapat();
    expect([...k.dosyalar.keys()].some(y => y.startsWith("veri/oda/"))).toBe(false);
  });
});

it("KasaHatasi kullanıcıya gösterilecek mesajı taşır", () => {
  expect(new KasaHatasi("x", "giris").code).toBe("giris");
});
