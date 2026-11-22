// Ortak klasör kipi (Edge / Chrome; masaüstü uygulaması aynı kodu kullanır): kasa kurulur, tarayıcıdaki veriler kasaya
// aktarılır (tarayıcıdaki şifresiz kopya silinir, klasörde açık metin yok), sahip kullanıcı ekler, sorumlu geçici
// şifreyle girip kendi şifresini belirler ve personeli değiştiremez; iki oturum birbirinin değişikliğini ve varlığını
// görür; kaldırılan kullanıcının oturumu kapanır. Klasör seçme penceresi yerine tarayıcının kendi klasörü (OPFS)
// kullanılır. Saat sabitlenmez: kilitler ve "şu an açık" gerçek zamanla çalışır.
import AxeBuilder from "@axe-core/playwright";
import { test, expect, git, DURUM, ANAHTAR, type Page } from "./yardimci";

test.skip(({ browserName }) => browserName !== "chromium", "ortak klasör kipi yalnız Edge / Chrome'da (File System Access)");

async function ortakKlasor(page: Page, veri?: unknown) {
  await page.addInitScript(
    ([anahtar, v]) => {
      const ortak = async () => (await navigator.storage.getDirectory()).getDirectoryHandle("ortak", { create: true });
      (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker = ortak;
      // Test tarayıcısı, IndexedDB'ye yazılmış OPFS klasör tutamağını geri okurken çöküyor (gerçek kullanıcının seçtiği
      // klasörde bu yol yok). Program tutamağı "tutamak" deposuna yazar: burada yalnız yazıldığı not edilir, okununca
      // aynı OPFS klasörü yeniden verilir.
      const put = IDBObjectStore.prototype.put,
        get = IDBObjectStore.prototype.get;
      IDBObjectStore.prototype.put = function (this: IDBObjectStore, deger: unknown, k?: IDBValidKey) {
        if (this.name !== "tutamak") return put.call(this, deger, k);
        localStorage.setItem("e2e-tutamak-" + String(k), "1");
        return put.call(this, "e2e", k);
      };
      IDBObjectStore.prototype.get = function (this: IDBObjectStore, k: IDBValidKey) {
        if (this.name !== "tutamak") return get.call(this, k);
        const istek: { result: unknown; onerror: unknown; onsuccess: (() => void) | null } = {
          result: null,
          onerror: null,
          onsuccess: null,
        };
        void (async () => {
          istek.result = localStorage.getItem("e2e-tutamak-" + String(k)) ? await ortak() : null;
          setTimeout(() => istek.onsuccess?.(), 0);
        })();
        return istek as unknown as IDBRequest;
      };
      if (v && !sessionStorage.getItem("e2e-kuruldu")) {
        sessionStorage.setItem("e2e-kuruldu", "1");
        localStorage.setItem(anahtar, v);
      }
    },
    [ANAHTAR, veri ? JSON.stringify(veri) : ""] as const,
  );
}
/** klasördeki bütün dosyaların adları ve içerikleri */
const klasorIcerigi = (page: Page) =>
  page.evaluate(async () => {
    const l: string[] = [];
    async function gez(d: FileSystemDirectoryHandle, yol: string) {
      for await (const h of (d as unknown as { values(): AsyncIterable<FileSystemHandle> }).values()) {
        if (h.kind === "directory") await gez(h as FileSystemDirectoryHandle, yol + h.name + "/");
        else l.push(yol + h.name + "\n" + (await (await (h as FileSystemFileHandle).getFile()).text()));
      }
    }
    await gez(await (await navigator.storage.getDirectory()).getDirectoryHandle("ortak"), "");
    return l.join("\n");
  });

async function kasaKur(page: Page) {
  await page.goto("/#ayarlar/gecmis");
  await page.getByRole("button", { name: "Ortak klasörde çalış (kullanıcı adı ve şifreyle)" }).click();
  await expect(page.getByRole("heading", { name: "Ortak klasörü seçin" })).toBeVisible();
  await page.getByRole("button", { name: "Klasör seç" }).click();
  await expect(page.getByRole("heading", { name: "Yeni kasa kurun" })).toBeVisible();
  await page.getByLabel("Adınız soyadınız").fill("Ayşe Kaya");
  await page.getByLabel("Kullanıcı adı").fill("ayse");
  await page
    .getByLabel(/^Şifre/)
    .first()
    .fill("sahip-sifre-1");
  await page.getByLabel("Şifre (tekrar)").fill("sahip-sifre-1");
  await page.getByRole("button", { name: "Kasayı kur" }).click();
  await expect(page.getByRole("heading", { name: "Kurtarma anahtarınızı saklayın" })).toBeVisible();
  const kod = await page.getByLabel("Kurtarma anahtarı", { exact: true }).textContent();
  expect(kod?.trim()).toMatch(/^[A-Z2-9]{5}(-[A-Z2-9]{5}){4}$/);
  await expect(page.getByRole("button", { name: "Devam" })).toBeDisabled();
  await page.getByLabel("Kurtarma anahtarını güvenli bir yere kaydettim").check();
  await page.getByRole("button", { name: "Devam" }).click();
  await expect(page.locator(".ust-serit")).toContainText("Veriler ortak klasöre kaydedildi", { timeout: 20_000 });
}
/** sahip, Ayarlar > Geçmiş'ten kullanıcı ekler; geçici şifreyi döner */
async function kullaniciEkle(page: Page, ad: string, kullanici: string): Promise<string> {
  await git(page, "#ayarlar/gecmis");
  const form = page.locator("details", { hasText: "Kullanıcı ekle" });
  await form.locator("summary").click();
  await form.getByLabel("Adı soyadı").fill(ad);
  await form.getByLabel("Kullanıcı adı").fill(kullanici);
  await form.getByRole("button", { name: "Ekle" }).click();
  const bilgi = form.locator(".kutu.bilgi");
  await expect(bilgi).toContainText(kullanici);
  return (await bilgi.locator("b.rakam").textContent())!.trim();
}
async function girisYap(page: Page, kullanici: string, sifre: string, yeniSifre?: string) {
  await expect(page.getByRole("heading", { name: "Giriş" })).toBeVisible();
  await page.getByLabel("Kullanıcı adı").fill(kullanici);
  await page.getByLabel("Şifre").fill(sifre);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  if (yeniSifre) {
    await expect(page.getByRole("heading", { name: "Kendi şifrenizi belirleyin" })).toBeVisible();
    await page
      .getByLabel(/^Yeni şifre/)
      .first()
      .fill(yeniSifre);
    await page.getByLabel("Yeni şifre (tekrar)").fill(yeniSifre);
    await page.getByRole("button", { name: "Şifreyi kaydet ve devam et" }).click();
  }
  await expect(page.locator(".ust-serit")).toContainText("Veriler ortak klasöre kaydedildi", { timeout: 20_000 });
}

test("kasa kurulur, veriler aktarılır; sorumlu geçici şifreyle girip kendi şifresini belirler, personeli değiştiremez", async ({
  page,
  hatalar,
}) => {
  void hatalar;
  await ortakKlasor(page, DURUM);
  await kasaKur(page);
  await expect(page.locator(".ust-serit")).toContainText("Ayşe Kaya");
  // aktarılan şifresiz kopya tarayıcıdan silinir; klasörde kişi adları açık metin olarak durmaz
  await expect.poll(() => page.evaluate(a => localStorage.getItem(a), ANAHTAR), { timeout: 10_000 }).toBeNull();
  const icerik = await klasorIcerigi(page);
  expect(icerik).toContain("kasa.json");
  expect(icerik).toContain("veri/nobet/yonetim.nbk");
  for (const k of DURUM.staff.slice(0, 5)) expect(icerik).not.toContain(k.name);
  expect(icerik).not.toContain("sahip-sifre-1");

  const gecici = await kullaniciEkle(page, "Can Demir", "can");
  await expect(
    new AxeBuilder({ page })
      .include("main")
      .analyze()
      .then(r => r.violations.map(v => v.id)),
  ).resolves.toEqual([]);
  await page.locator(".ust-serit").getByRole("button", { name: "Oturumu kapat" }).click();
  await expect(page.getByText("Oturum kapatıldı.")).toBeVisible();
  await expect(new AxeBuilder({ page }).analyze().then(r => r.violations.map(v => v.id))).resolves.toEqual([]);
  // yanlış şifre
  await page.getByLabel("Kullanıcı adı").fill("can");
  await page.getByLabel("Şifre").fill("yanlis-sifre");
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page.getByRole("alert")).toContainText("Kullanıcı adı ya da şifre yanlış.");
  await girisYap(page, "can", gecici, "can-kendi-sifresi");
  await expect(page.locator(".ust-serit")).toContainText("Can Demir");
  // aktarılan personel görünür; sorumlu personeli değiştiremez
  await git(page, "#ayarlar/personel");
  await expect(page.getByText("Personeli görüntülüyorsunuz.")).toBeVisible();
  await expect(page.locator("main")).toContainText(DURUM.staff[0].name);
  // değişiklik geçmişinde aktarımı yapan sahip görünür
  await git(page, "#ayarlar/gecmis");
  await expect(page.locator("ol.kayitlar")).toContainText("Ayşe Kaya");
  await expect(page.locator("main")).toContainText("Sorumlu");
  // geçici şifre artık geçmez, kendi şifresi geçer
  await page.locator(".ust-serit").getByRole("button", { name: "Oturumu kapat" }).click();
  await page.getByLabel("Kullanıcı adı").fill("can");
  await page.getByLabel("Şifre").fill(gecici);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page.getByRole("alert")).toContainText("Kullanıcı adı ya da şifre yanlış.");
  await girisYap(page, "can", "can-kendi-sifresi");
});

test("iki oturum: değişiklik ve 'şu an açık' öbür bilgisayara geçer; kaldırılan kullanıcının oturumu kapanır", async ({
  page,
  context,
  hatalar,
}) => {
  test.setTimeout(180_000);
  void hatalar;
  await ortakKlasor(page, DURUM);
  await kasaKur(page);
  const gecici = await kullaniciEkle(page, "Can Demir", "can");

  const b = await context.newPage();
  await ortakKlasor(b);
  await b.goto("/");
  await girisYap(b, "can", gecici, "can-kendi-sifresi");

  // sahip kurum adını değiştirir: sorumlunun ekranına gelir
  await git(page, "#ayarlar/genel");
  await page.getByLabel("Kurum adı").fill("Deneme Hastanesi");
  await expect(b.locator(".baslik-bandi")).toContainText("DENEME HASTANESİ", { timeout: 20_000 });
  // şu an açık olanlar
  await expect(page.locator(".ust-serit")).toContainText("Şu an açık: Can Demir", { timeout: 30_000 });

  // sahip sorumluyu kaldırır: sorumlunun oturumu kapanır
  await git(page, "#ayarlar/gecmis");
  const satir = page.locator("tr", { hasText: "can" });
  await satir.getByRole("button", { name: "Kaldır" }).click();
  await satir.getByRole("button", { name: "Kaldır" }).click();
  await expect(page.locator("main")).toContainText("Can Demir kaldırıldı");
  await expect(b.getByText("Hesabınız kaldırıldı; oturum kapatıldı.")).toBeVisible({ timeout: 20_000 });
  await b.getByLabel("Kullanıcı adı").fill("can");
  await b.getByLabel("Şifre").fill("can-kendi-sifresi");
  await b.getByRole("button", { name: "Giriş yap" }).click();
  await expect(b.getByRole("alert")).toContainText("Kullanıcı adı ya da şifre yanlış.");
  await b.close();
});
