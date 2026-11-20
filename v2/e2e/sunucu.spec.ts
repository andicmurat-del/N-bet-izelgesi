// claude.ai'de birden çok sorumlu: sayfaya sahte bir claude.ai ortamı (kimlik, veritabanı, "şu an kim açık") verilir.
// Giriş yapanın adı ve yetkisi görünür, değişiklik sunucu geçmişine giriş yapanın kimliğiyle yazılır, bütün sorumluların
// geçmişi adlarıyla listelenir, aynı ekrandaki öteki sorumlu belirtilir, tüm verileri yalnız sahip silebilir. Erişimi
// olmayan ya da sayfa açıkken erişimi kaldırılan hesapta bu tarayıcıdaki kopya silinir (sunucudaki veriler durur).
import AxeBuilder from "@axe-core/playwright";
import { test, expect, git, type Page } from "./yardimci";

type Rol = "sahip" | "duzenleyen" | "katkida" | "okuyan" | "kaldirilan";
async function claudeOrtami(page: Page, rol: Rol) {
  await page.addInitScript(r0 => {
    // rol ve veritabanı oturum boyunca saklanır: sayfa yenilenince (ya da test rolü değiştirince) aynı sunucu
    const r = (sessionStorage.getItem("sahte-rol") as typeof r0 | null) ?? r0;
    const belgeler = new Map<string, Record<string, unknown>>(JSON.parse(sessionStorage.getItem("sahte-db") ?? "[]"));
    const sakla = () => sessionStorage.setItem("sahte-db", JSON.stringify([...belgeler.entries()]));
    const ust = (y: string) => y.split("/").slice(0, -1).join("/");
    const kopya = <T>(x: T): T => JSON.parse(JSON.stringify(x));
    const anlik = (y: string, d?: Record<string, unknown>) => ({
      id: y.split("/").pop(),
      exists: d !== undefined,
      data: () => (d ? kopya(d) : undefined),
      metadata: { fromCache: false, hasPendingWrites: false },
    });
    const doc = (y: string) => ({
      id: y.split("/").pop(),
      path: y,
      get: async () => anlik(y, belgeler.get(y)),
      set: async (d: Record<string, unknown>) => {
        if (r === "okuyan") throw { code: "invalid_argument", message: "yetki yok" };
        // sunucudaki kural: yönetim belgesine yalnız sahip ve Editor yazar
        if (y === "nobet/yonetim" && r !== "sahip" && r !== "duzenleyen") throw { code: "invalid_argument", message: "yetki yok" };
        belgeler.set(y, kopya(d));
        sakla();
      },
      delete: async () => {
        belgeler.delete(y);
        sakla();
      },
      // "kaldirilan": sayfa açıkken erişim kaldırılır (platform dinleyiciye "revoked" bildirir)
      onSnapshot: (_n: unknown, h?: (e: unknown) => void) => {
        if (r === "kaldirilan" && y === "nobet/ana") setTimeout(() => h?.({ code: "revoked", message: "erişim kaldırıldı" }), 2500);
        return () => {};
      },
      collection: (a: string) => kol(y + "/" + a),
    });
    type F = [string, unknown][];
    const sorgu = (y: string, f: F = [], s: [string, string] | null = null, n = 1000): unknown => ({
      where: (a: string, _op: string, v: unknown) => sorgu(y, [...f, [a, v]], s, n),
      orderBy: (a: string, yon = "asc") => sorgu(y, f, [a, yon], n),
      limit: (k: number) => sorgu(y, f, s, k),
      get: async () => {
        let l = [...belgeler.entries()].filter(([k]) => ust(k) === y).filter(([, d]) => f.every(([a, v]) => d[a] === v));
        if (s) l = l.sort((p, q) => ((p[1][s[0]] as number) - (q[1][s[0]] as number)) * (s[1] === "desc" ? -1 : 1));
        return { docs: l.slice(0, n).map(([k, d]) => anlik(k, d)) };
      },
    });
    const kol = (y: string) => ({ ...(sorgu(y) as object), path: y, doc: (id: string) => doc(y + "/" + id) });
    const db = { doc, collection: kol };
    const id = r === "sahip" ? "u_sahip" : r === "duzenleyen" ? "u_bas" : "u_ayse";
    const adlar: Record<string, string> = { u_sahip: "Selin Sahip", u_bas: "Banu Baş", u_ayse: "Ayşe Kaya", u_mehmet: "Mehmet Demir" };
    const user = {
      me: async () => ({ id, name: adlar[id], isOwner: r === "sahip", canEdit: r === "sahip" || r === "duzenleyen" }),
      can: async () => r !== "okuyan",
      profiles: async (ids: string[]) =>
        Object.fromEntries(ids.map(i => [i, { id: i, name: adlar[i] ?? "", color: "#000", guest: false }])),
    };
    const room = {
      presence: async () => {},
      onPeers: (f: (d: unknown) => void) => {
        setTimeout(
          () =>
            f({
              peers: [
                { peer: "p0", by: id, isMe: true, kind: "viewer", presence: {} },
                { peer: "p1", by: "u_mehmet", isMe: false, kind: "viewer", presence: { sayfa: "gunluk", alt: "nobet", ay: "2026-10" } },
              ],
            }),
          50,
        );
        return () => {};
      },
    };
    (window as unknown as { __db: typeof belgeler }).__db = belgeler;
    (window as unknown as { claude: unknown }).claude = {
      use: async (ad: string) => ({ db, user, room })[ad as "db"] ?? null,
    };
  }, rol);
}
const sunucuBelgeleri = (page: Page, onek: string) =>
  page.evaluate(o => [...(window as unknown as { __db: Map<string, unknown> }).__db.entries()].filter(([k]) => k.startsWith(o)), onek);

test("katkıda bulunan sorumlu: adı görünür, değişikliği kendi kimliğiyle sunucu geçmişine yazılır", async ({ page, kur }) => {
  await claudeOrtami(page, "katkida");
  await kur();
  const serit = page.locator(".ust-serit");
  await expect(serit).toContainText("Ayşe Kaya");
  await expect(serit).toContainText("Şu an açık: Mehmet Demir");
  await expect(serit).toContainText("Veriler sunucuya kaydedildi");
  // öbür sorumlu aynı ekranda (Kasım 2026 nöbet çizelgesi)
  await expect(page.locator("main")).toContainText("Mehmet Demir de şu an bu ekranda");
  // veriler sunucuya bölüm bölüm yazıldı
  expect((await sunucuBelgeleri(page, "nobet/ana")).length).toBeGreaterThan(1);

  // sorumlu personel ve ayarları değiştiremez (ekranda salt okunur)
  await git(page, "ayarlar/personel");
  await expect(page.locator("main")).toContainText("Personeli görüntülüyorsunuz");
  await expect(page.locator("main button", { hasText: /^Ekle$/ })).toBeDisabled();
  await git(page, "ayarlar/genel");
  await expect(page.locator("main input").first()).toBeDisabled();
  await expect(page.locator("main button", { hasText: "Yedekten yükle" })).toBeDisabled();

  // bir değişiklik: gün notu
  await git(page, "gunluk/nobet");
  await page
    .locator("main button", { hasText: /^Liste$/ })
    .first()
    .click();
  await page.locator("main tbody tr", { hasText: "14 Kasım" }).first().click();
  await page.locator("main button", { hasText: "Nöbet değişikliği yap" }).first().click();
  const p = page.locator("dialog[open]");
  await p.getByLabel("Yeni not").fill("Takas konuşuldu");
  await p.locator("button", { hasText: "Not ekle" }).click();
  await p.locator("button", { hasText: /^(Vazgeç|Kapat)$/ }).click();
  await expect(async () => {
    const g = await sunucuBelgeleri(page, "gecmis/u_ayse/aylar/");
    expect(JSON.stringify(g)).toContain("gün notu");
  }).toPass({ timeout: 8000 });
  // yönetim belgesine yazmaya kalkmadı (sunucu reddederdi); boş sunucuya personel ana belgede yazıldı
  await expect(page.locator(".ust-serit")).toContainText("Veriler sunucuya kaydedildi");
  expect(await sunucuBelgeleri(page, "nobet/yonetim")).toEqual([]);

  await git(page, "ayarlar/gecmis");
  const m = page.locator("main");
  await expect(m).toContainText("Kullanıcılar ve yetki");
  await expect(m).toContainText("Sorumlu (Contributor)");
  await expect(m.locator(".kayitlar li").first()).toContainText("Ayşe Kaya");
  await expect(m.locator(".kayitlar li").first()).toContainText("gün notu");
  // erişilebilirlik (sunucu geçmişi, kullanıcılar ve yetki, üst şeritteki bilgiler)
  await page.waitForTimeout(500);
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .disableRules(["label-content-name-mismatch"])
    .analyze();
  expect(axe.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(" ")).join(" | ")}`)).toEqual([]);
  // tüm verileri yalnız sahip siler
  await git(page, "ayarlar/genel");
  await expect(m).toContainText("Tüm verileri yalnız sayfanın sahibi silebilir");
  await expect(m.locator("button", { hasText: "Tüm verileri sil" })).toHaveCount(0);
  // onaylayan: giriş yapan sorumlu kaydedilir, adıyla görünür
  await git(page, "gunluk/nobet");
  await page
    .locator("main button:not([disabled])", { hasText: /^Onayla$/ })
    .first()
    .click();
  await page.locator("dialog[open] button", { hasText: /^Onayla$/ }).click();
  await expect(m.locator("dl.onay")).toContainText("Programda onaylayan");
  await expect(m.locator("dl.onay")).toContainText("Ayşe Kaya");
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("nobet-cizelgesi-v2") ?? "{}").schedules?.["2026-10"]?.onay?.kimId))
    .toBe("u_ayse");
});

test("sahip: sorumlu ekleme yolu anlatılır, tüm verileri silebilir", async ({ page, kur }) => {
  await claudeOrtami(page, "sahip");
  await kur();
  await git(page, "ayarlar/gecmis");
  await expect(page.locator("main")).toContainText("Paylaş");
  await expect(page.locator("main")).toContainText("Sahip");
  await git(page, "ayarlar/genel");
  await expect(page.locator("main button", { hasText: "Tüm verileri sil" })).toBeVisible();
});

const yerelAnahtarlar = (page: Page) =>
  page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith("nobet-cizelgesi-v2") && !k.endsWith("-yedek")));

test("yalnız görüntüleyen hesap: erişemediği söylenir, sunucuya yazmaz, bu tarayıcıdaki kopya silinir", async ({ page, kur }) => {
  await claudeOrtami(page, "okuyan");
  await kur();
  await expect(page.locator("main")).toContainText("bu tarayıcıdaki kopya da silindi");
  expect(await sunucuBelgeleri(page, "")).toEqual([]);
  expect(await yerelAnahtarlar(page)).toEqual([]);
  await git(page, "ayarlar/personel");
  await expect(page.locator("main")).not.toContainText("Ayşe");
});

test("sayfa açıkken erişimi kaldırılan sorumlu: kopya silinir, sunucudaki veriler durur", async ({ page, kur }) => {
  await claudeOrtami(page, "kaldirilan");
  await kur();
  await expect(page.locator(".ust-serit")).toContainText("Veriler sunucuya kaydedildi");
  expect((await yerelAnahtarlar(page)).length).toBeGreaterThan(0);
  await expect(page.locator("main")).toContainText("bu tarayıcıdaki kopya da silindi", { timeout: 8000 });
  expect(await yerelAnahtarlar(page)).toEqual([]);
  expect((await sunucuBelgeleri(page, "nobet/ana")).length).toBeGreaterThan(1);
  // silme bir değişiklik olarak sunucuya ya da geçmişe gitmez
  expect(JSON.stringify(await sunucuBelgeleri(page, "gecmis/"))).not.toContain("silindi");
});

test("baş sorumlu (Editor): personeli değiştirebilir; personel ve ayarlar sunucuda ayrı yönetim belgesinde", async ({ page, kur }) => {
  await claudeOrtami(page, "duzenleyen");
  await kur();
  await expect(page.locator(".ust-serit")).toContainText("Veriler sunucuya kaydedildi");
  const y = await sunucuBelgeleri(page, "nobet/yonetim");
  expect(y.length).toBe(1);
  const ana = (await sunucuBelgeleri(page, "nobet/ana")).find(([k]) => k === "nobet/ana")![1] as { json: string };
  expect(JSON.parse(ana.json).staff).toBeUndefined();
  await git(page, "ayarlar/personel");
  await expect(page.locator("main")).not.toContainText("Personeli görüntülüyorsunuz");
  await expect(page.locator("main button", { hasText: /^Ekle$/ })).toBeEnabled();
  await git(page, "ayarlar/gecmis");
  await expect(page.locator("main")).toContainText("Baş sorumlu (Editor)");
  await git(page, "ayarlar/genel");
  await expect(page.locator("main button", { hasText: "Tüm verileri sil" })).toHaveCount(0);
});

test("sorumlu, baş sorumlunun yazdığı sunucuyla: yönetim belgesine yazmaz; personeldeki yerel değişiklik geri alınır", async ({
  page,
  kur,
}) => {
  await claudeOrtami(page, "duzenleyen");
  await kur();
  await expect(page.locator(".ust-serit")).toContainText("Veriler sunucuya kaydedildi");
  expect((await sunucuBelgeleri(page, "nobet/yonetim")).length).toBe(1);
  // aynı sunucuya sorumlu olarak bağlan
  await page.evaluate(() => sessionStorage.setItem("sahte-rol", "katkida"));
  await page.reload();
  await expect(page.locator(".ust-serit")).toContainText("Ayşe Kaya");
  await expect(page.locator(".ust-serit")).toContainText("Veriler sunucuya kaydedildi");
  // bu tarayıcıdaki kayıtta personel değiştirilmiş olsun (ekran izin vermez; elle ya da eski sürümle)
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const v = JSON.parse(localStorage.getItem("nobet-cizelgesi-v2")!);
    v.staff[0].name = "Değiştirilmiş Ad";
    localStorage.setItem("nobet-cizelgesi-v2", JSON.stringify(v));
  });
  await page.reload();
  await expect(page.locator("main")).toContainText("değişiklik geri alındı");
  await expect(page.locator(".ust-serit")).toContainText("Veriler sunucuya kaydedildi");
  await git(page, "ayarlar/personel");
  await expect(page.locator("main")).not.toContainText("Değiştirilmiş Ad");
  const y = await sunucuBelgeleri(page, "nobet/yonetim");
  expect(JSON.stringify(y)).not.toContain("Değiştirilmiş Ad");
});

test("eski biçimdeki sunucu (personel ana belgede): sahip açınca yönetim belgesine taşınır", async ({ page, kur }) => {
  await claudeOrtami(page, "katkida");
  await kur();
  await expect(page.locator(".ust-serit")).toContainText("Veriler sunucuya kaydedildi");
  expect(await sunucuBelgeleri(page, "nobet/yonetim")).toEqual([]);
  await page.evaluate(() => sessionStorage.setItem("sahte-rol", "sahip"));
  await page.reload();
  await expect(page.locator(".ust-serit")).toContainText("Selin Sahip");
  // sahibin ilk eşitlemesi yeni biçime geçirir (bir değişiklik gerekmeden: biçim farkı yazım sayılır)
  await expect.poll(async () => (await sunucuBelgeleri(page, "nobet/yonetim")).length, { timeout: 8000 }).toBe(1);
  const ana = (await sunucuBelgeleri(page, "nobet/ana")).find(([k]) => k === "nobet/ana")![1] as { json: string };
  expect(JSON.parse(ana.json).staff).toBeUndefined();
  await git(page, "ayarlar/personel");
  await expect(page.locator("main")).toContainText("Ayşe Yılmaz");
});
