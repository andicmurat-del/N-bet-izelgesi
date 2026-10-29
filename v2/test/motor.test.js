// Eski uygulamanın (../index.html) senaryo testleri yeni motorla: sonuç eski uygulamanın kaydından (../tests/beklenen.json)
// kötü olmamalı. Kurallar sonradan bilerek değiştirildiği için (Cuma–Pazar tercihi, kesin kural ihlallerinin giderilmesi,
// destek sınırı…) çizelgeler artık eski uygulamayla birebir aynı değil; birebir davranış güvencesi altın kayıt testidir
// (test/altin.test.js). Burada her ay için: "hata" düzeyinde uyarı sayısı, aylık nöbet / hazırlama / fazla mesai farkı
// eski uygulamanınkinden büyük olmamalı; senaryonun kendi denetimi (izinli gün, işe başlama) tutmalı.
// Arama süreyle de sınırlı olduğundan saat sabit verilir; arama yalnız deneme sayısıyla biter.
import { describe, test, expect } from "vitest";
import { createRequire } from "module";
import { cizelgeOlustur, uyariSiniflandir } from "../src/motor";
import { Baglam, hazirlamaRol } from "../src/motor/baglam";
import { fmFarkBilgisi, fmKuralKisileri } from "../src/motor/istatistik";
import { FM_MAX_FARK } from "../src/motor/sabitler";

const require = createRequire(import.meta.url);
const senaryolar = require("../../tests/senaryolar.js");
const beklenen = require("../../tests/beklenen.json");

const fark = v => (v.length > 1 ? Math.max(...v) - Math.min(...v) : 0);

// Her ay ayrı bir test: aylar sırayla çalışır ve önceki ayların çizelgesi sonrakine aktarılır (yıllık eşitlik).
// Uzun ve kesintisiz hesap tek testte toplanınca test aracının iç haberleşmesi zaman aşımına düşüyor.
for (const sen of senaryolar) {
  describe(sen.ad + " (" + sen.aciklama + ")", () => {
    const veri = { staff: sen.staff, prefs: sen.prefs || {}, settings: sen.settings || {}, schedules: {} };
    const personel = JSON.stringify(sen.staff), ad = id => sen.staff.find(s => s.id === id).name;
    const aylar = [];   // senaryonun kendi denetimi (kontrol) için eski uygulamanın biçimi
    sen.aylar.forEach((m, i) => {
      test((m + 1) + ". ay eski uygulamadan kötü değil", () => {
        const r = cizelgeOlustur(veri, sen.yil, m, { saat: () => 0 });
        // sonraki ay bu ayın çizelgesine bakar: beklenti tutmasa da kaydedilsin (yoksa sonraki ay da yanlış görünür)
        veri.schedules[sen.yil + "-" + m] = { year: sen.yil, month: m, days: r.days };
        aylar[i] = { gunler: r.days.map(g => ({ gun: g.day, nobet: g.assigned.map(p => ad(p.id)), hazirlama: (g.prep || []).map(p => ad(p.id)) })) };
        expect(JSON.stringify(sen.staff), "motor girdiyi değiştirmemeli").toBe(personel);

        const eski = beklenen[sen.ad][i], B = new Baglam(veri), k = fmKuralKisileri(B, sen.yil, m);
        // kadro yetersizliği uyarısı (eski uygulamada yoktu) bilgi amaçlıdır; çizelgenin kötüleştiğini göstermez
        const hata = r.warnings.filter(w => uyariSiniflandir(w).seviye === "hata" && !/matematiksel olarak mümkün değil/.test(w)).length;
        const nobet = {}, haz = {};
        k.forEach(s => { nobet[s.id] = 0; if (hazirlamaRol(s.role)) haz[s.id] = 0; });
        r.days.forEach(g => { g.assigned.forEach(p => { if (nobet[p.id] !== undefined) nobet[p.id]++; }); (g.prep || []).forEach(p => { if (haz[p.id] !== undefined) haz[p.id]++; }); });
        const fm = fmFarkBilgisi(B, sen.yil, m, r.days).fark;
        expect(hata, "hata düzeyinde uyarı: " + r.warnings.join(" | ")).toBeLessThanOrEqual(eski.hatalar.length);
        // kadro kurallara yetmiyorsa motor eşitlik yerine daha az kural ihlalini seçer (eski uygulama ihlali bırakıyordu):
        // bu aylarda farklar karşılaştırılmaz
        if (r.warnings.some(w => /matematiksel olarak mümkün değil/.test(w))) return;
        expect(fark(Object.values(nobet)), "nöbet farkı").toBeLessThanOrEqual(eski.nobetFarki);
        expect(fark(Object.values(haz)), "hazırlama farkı").toBeLessThanOrEqual(eski.hazirlamaFarki);
        expect(fm, "fazla mesai farkı").toBeLessThanOrEqual(eski.fazlaMesaiFarki ?? FM_MAX_FARK);
      });
    });
    if (sen.kontrol) test("senaryo denetimi (izinli gün, işe başlama)", () => { expect(sen.kontrol(aylar)).toBe(null); });
  });
}
